/**
 * LLM-based fallback classifier for classify.ts's gate.
 *
 * Extracted from classify.ts's enrichClassificationsWithLLM/classifyBatchWithLLM/
 * buildLLMClassifyPrompt/retry-degrade machinery — moved, not rewritten. Same batching, same
 * prompt, same behavior; only the file it lives in changed
 * (ADR-2026-09-07-realm-classify-gate-split.md, TJ-R3).
 *
 * classify.ts's gate calls this only for files classify-elm.ts didn't resolve — this module has
 * no knowledge that an ELM stage exists or ran first.
 */

import type {
  ArchetypeDefinition,
  FileClassification,
  AnalyzeTokenUsage,
} from "../schema/index.js";
import { callClaude, ClaudeClientError } from "./claude-client.js";
import { emptyAnalyzeTokenUsage, accumulateTokenUsage } from "./token-usage.js";
import { startSpinner } from "../cli/output.js";

export interface LLMClassifyResult {
  updatedFiles: FileClassification[];
  tokenUsage: AnalyzeTokenUsage;
}

/** Maximum files per LLM batch. */
const LLM_BATCH_SIZE = 30;

/**
 * Classify a set of unclassified files via the LLM. Files the LLM can't classify stay null.
 * Callers pass in exactly the files that should be sent — classify.ts's gate is responsible for
 * deciding which files reach this stage (i.e. whatever classify-elm.ts didn't resolve).
 */
export async function classifyUnclassifiedWithLLM(
  unclassified: FileClassification[],
  archetypes: ArchetypeDefinition[],
): Promise<LLMClassifyResult> {
  const tokenUsage = emptyAnalyzeTokenUsage();
  const updatedFiles: FileClassification[] = [];

  if (unclassified.length === 0) {
    return { updatedFiles, tokenUsage };
  }

  const archetypeCatalog = archetypes.map((a) => ({ id: a.id, name: a.name, description: a.description }));
  const validIds = new Set(archetypes.map((a) => a.id));

  // Batch unclassified files
  const batches: FileClassification[][] = [];
  for (let i = 0; i < unclassified.length; i += LLM_BATCH_SIZE) {
    batches.push(unclassified.slice(i, i + LLM_BATCH_SIZE));
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const batchLabel = batches.length > 1 ? ` batch ${batchIdx + 1}/${batches.length}` : "";

    const result = await classifyBatchWithLLM(
      batch,
      archetypeCatalog,
      validIds,
      batchLabel,
      tokenUsage,
    );

    if (result === "auth-error") {
      // Stop all batches on auth/not-found error
      break;
    }

    if (result) {
      updatedFiles.push(...result);
    }
  }

  return { updatedFiles, tokenUsage };
}

/** Attempt configs for retry degradation. */
interface LLMClassifyAttemptConfig {
  includeDescriptions: boolean;
  maxFiles: number;
}

function computeLLMClassifyAttempts(batchSize: number): LLMClassifyAttemptConfig[] {
  return [
    { includeDescriptions: true, maxFiles: batchSize },
    { includeDescriptions: false, maxFiles: batchSize },
    { includeDescriptions: false, maxFiles: Math.min(15, batchSize) },
  ];
}

/**
 * Classify a single batch of files via Claude with retry.
 * Returns classified files, null on total failure, or "auth-error" to signal stop.
 */
async function classifyBatchWithLLM(
  batch: FileClassification[],
  archetypeCatalog: { id: string; name: string; description: string }[],
  validIds: Set<string>,
  batchLabel: string,
  tokenUsage: AnalyzeTokenUsage,
): Promise<FileClassification[] | null | "auth-error"> {
  const attempts = computeLLMClassifyAttempts(batch.length);

  for (let attempt = 0; attempt < attempts.length; attempt++) {
    const config = attempts[attempt];
    const filesToClassify = batch.slice(0, config.maxFiles);

    const prompt = buildLLMClassifyPrompt(filesToClassify, archetypeCatalog, config.includeDescriptions);
    const promptLevel = config.includeDescriptions ? "full" : "compact";
    const spinner = startSpinner(
      `  [classify]${batchLabel} Calling LLM (attempt ${attempt + 1}/${attempts.length}, ${promptLevel} prompt, ${filesToClassify.length} files)...`,
    );

    let callText: string;
    try {
      const callResult = await callClaude(prompt);
      accumulateTokenUsage(tokenUsage, callResult.tokenUsage);
      callText = callResult.text;
    } catch (err) {
      spinner.stop();
      if (err instanceof ClaudeClientError) {
        if (err.reason === "auth" || err.reason === "not-found") {
          console.warn(`  [classify] ${err.reason === "auth" ? "Authentication error — run 'ndx config' and verify vendor credentials" : "LLM CLI not found"}`);
          console.warn(`  [classify]   ${err.message.slice(0, 200)}`);
          return "auth-error";
        }
        accumulateTokenUsage(tokenUsage, undefined);
        const label = attempt < attempts.length - 1 ? "retrying with simpler prompt" : "giving up on this batch";
        console.warn(`  [classify]${batchLabel} Attempt ${attempt + 1}/${attempts.length} failed (${err.reason}) — ${label}`);
        continue;
      }
      throw err;
    }
    spinner.stop();

    // Parse JSON array response
    const parsed = tryParseClassifyResponse(callText);
    if (!parsed || parsed.length === 0) {
      const label = attempt < attempts.length - 1 ? "retrying with simpler prompt" : "giving up on this batch";
      console.warn(`  [classify]${batchLabel} Attempt ${attempt + 1}/${attempts.length}: invalid response — ${label}`);
      continue;
    }

    // Map results back to FileClassification objects
    const pathSet = new Set(filesToClassify.map((f) => f.path));
    const results: FileClassification[] = [];

    for (const item of parsed) {
      if (!item.path || !pathSet.has(item.path)) continue;
      if (!item.archetype || !validIds.has(item.archetype)) continue;

      results.push({
        path: item.path,
        archetype: item.archetype,
        confidence: 0.7,
        source: "llm" as const,
        evidence: item.reason
          ? [{ archetypeId: item.archetype, signalKind: "path" as const, detail: item.reason, weight: 0.7 }]
          : undefined,
      });
    }

    if (attempt > 0 && results.length > 0) {
      console.log(`  [classify]${batchLabel} Succeeded on attempt ${attempt + 1}`);
    }

    return results;
  }

  console.warn(`  [classify]${batchLabel} All attempts exhausted — leaving files unclassified`);
  return null;
}

/**
 * Build the LLM prompt for file classification.
 */
function buildLLMClassifyPrompt(
  files: FileClassification[],
  archetypes: { id: string; name: string; description: string }[],
  includeDescriptions: boolean,
): string {
  const archetypeLines = archetypes.map((a) =>
    includeDescriptions
      ? `- ${a.id}: ${a.name} — ${a.description}`
      : `- ${a.id}: ${a.name}`,
  ).join("\n");

  const fileLines = files.map((f, i) => {
    const parts = [`${i + 1}. ${f.path}`];
    // Include partial evidence from algorithmic pass if available
    if (f.evidence && f.evidence.length > 0) {
      const hints = f.evidence
        .slice(0, 3)
        .map((e) => `${e.archetypeId}(${e.weight})`)
        .join(", ");
      parts.push(`  [partial signals: ${hints}]`);
    }
    return parts.join("");
  }).join("\n");

  return `Classify these source files. Assign each the best-fit archetype by path and likely purpose. Omit files with no clear fit.

Archetypes:
${archetypeLines}

Files:
${fileLines}

Respond with ONLY a JSON array (no markdown, no explanation):
[{"path":"<file path>","archetype":"<archetype id>","reason":"<brief reason>"}]`;
}

/**
 * Parse the LLM response as a JSON array of classification results.
 */
function tryParseClassifyResponse(
  response: string,
): Array<{ path: string; archetype: string; reason?: string }> | null {
  // Direct parse
  try {
    const parsed = JSON.parse(response);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  // Extract from markdown fences
  const fenceMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  // Find JSON array in response
  const arrayMatch = response.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  return null;
}
