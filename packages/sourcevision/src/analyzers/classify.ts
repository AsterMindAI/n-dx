/**
 * File classification engine.
 *
 * Classifies each source file against the archetype catalog by matching
 * weighted signals (path patterns, directory patterns, filename patterns,
 * export patterns) and accumulating evidence scores.
 *
 * The highest-scoring archetype above the confidence threshold becomes
 * the primary classification. Additional archetypes above a secondary
 * threshold are recorded as secondaryArchetypes.
 */

import { basename } from "node:path";
import type {
  Inventory,
  Imports,
  ImportEdge,
  ArchetypeDefinition,
  ArchetypeSignal,
  FileClassification,
  ClassificationEvidence,
  Classifications,
  ClassificationsSummary,
  AnalyzeTokenUsage,
} from "../schema/index.js";
import { BUILTIN_ARCHETYPES } from "./archetypes.js";
import { sortClassifications } from "../util/sort.js";
import { emptyAnalyzeTokenUsage } from "./token-usage.js";
import { runELMGate, type ELMGateOptions } from "./classify-elm.js";
import { classifyUnclassifiedWithLLM } from "./classify-llm.js";

/** Minimum accumulated score for a primary classification. */
const PRIMARY_THRESHOLD = 0.4;

/** Minimum accumulated score for a secondary classification. */
const SECONDARY_THRESHOLD = 0.3;

export interface ClassifyOptions {
  /** Previous classifications for incremental mode. */
  previousClassifications?: Classifications;
  /** Changed files (from inventory diff) — only reclassify these. */
  changedFiles?: Set<string>;
  /** Custom archetypes to merge with built-ins. */
  customArchetypes?: ArchetypeDefinition[];
  /** Per-file overrides: path → archetype ID. */
  overrides?: Record<string, string>;
  /** Detected project language (e.g. "go", "typescript"). Signals with a `languages` filter only fire when the project language matches. */
  projectLanguage?: string;
  /**
   * All detected project languages, ordered primary-first (e.g. `["go", "typescript"]`).
   * When provided, archetype signals with a `languages` filter fire if ANY of these
   * languages match. Falls back to `[projectLanguage]` when omitted.
   */
  projectLanguages?: string[];
}

/**
 * Classify all source files against the archetype catalog.
 */
export function analyzeClassifications(
  inventory: Inventory,
  imports: Imports,
  options?: ClassifyOptions,
): Classifications {
  const archetypes = mergeArchetypes(
    BUILTIN_ARCHETYPES,
    options?.customArchetypes,
  );

  // Build export map: file → exported symbol names
  const exportMap = buildExportMap(imports.edges);

  // Determine which files need reclassification
  const previousMap = new Map<string, FileClassification>();
  if (options?.previousClassifications) {
    for (const fc of options.previousClassifications.files) {
      previousMap.set(fc.path, fc);
    }
  }

  const sourceFiles = inventory.files.filter((f) => f.role === "source");
  const classifications: FileClassification[] = [];

  for (const file of sourceFiles) {
    // User override takes highest priority
    if (options?.overrides?.[file.path]) {
      const archetypeId = options.overrides[file.path];
      const valid = archetypes.some((a) => a.id === archetypeId);
      classifications.push({
        path: file.path,
        archetype: valid ? archetypeId : null,
        confidence: valid ? 1.0 : 0,
        source: "user-override",
      });
      continue;
    }

    // Incremental: reuse cached classification for unchanged files
    if (
      options?.changedFiles &&
      !options.changedFiles.has(file.path) &&
      previousMap.has(file.path)
    ) {
      const prev = previousMap.get(file.path)!;
      // Don't reuse user overrides that were removed
      if (prev.source !== "user-override" || options?.overrides?.[file.path]) {
        classifications.push(prev);
        continue;
      }
    }

    // Classify the file — prefer projectLanguages array over single projectLanguage
    const result = classifyFile(
      file.path,
      archetypes,
      exportMap.get(file.path),
      options?.projectLanguages
        ?? (options?.projectLanguage ? [options.projectLanguage] : undefined),
    );
    classifications.push(result);
  }

  const summary = computeSummary(classifications);

  return sortClassifications({
    archetypes,
    files: classifications,
    summary,
  });
}

/**
 * Classify a single file against all archetypes.
 */
function classifyFile(
  filePath: string,
  archetypes: ArchetypeDefinition[],
  exports?: string[],
  projectLanguages?: string[],
): FileClassification {
  const fileName = basename(filePath);
  const evidence: ClassificationEvidence[] = [];

  // Accumulate scores per archetype
  const scores = new Map<string, number>();

  for (const archetype of archetypes) {
    let archetypeScore = 0;

    for (const signal of archetype.signals) {
      // Skip signals scoped to languages that don't match any project language
      if (signal.languages && signal.languages.length > 0 && projectLanguages && projectLanguages.length > 0) {
        if (!projectLanguages.some((lang) => signal.languages!.includes(lang))) continue;
      }

      const match = matchSignal(signal, filePath, fileName, exports);
      if (match) {
        archetypeScore += signal.weight;
        evidence.push({
          archetypeId: archetype.id,
          signalKind: signal.kind,
          detail: match,
          weight: signal.weight,
        });
      }
    }

    if (archetypeScore > 0) {
      scores.set(archetype.id, archetypeScore);
    }
  }

  // Find primary archetype (highest score above threshold)
  let primaryId: string | null = null;
  let primaryScore = 0;
  for (const [id, score] of scores) {
    if (score > primaryScore) {
      primaryScore = score;
      primaryId = id;
    }
  }

  if (primaryScore < PRIMARY_THRESHOLD) {
    primaryId = null;
    primaryScore = 0;
  }

  // Find secondary archetypes (above secondary threshold, not primary)
  const secondaryArchetypes: string[] = [];
  for (const [id, score] of scores) {
    if (id !== primaryId && score >= SECONDARY_THRESHOLD) {
      secondaryArchetypes.push(id);
    }
  }
  secondaryArchetypes.sort();

  // Normalize confidence to 0-1 range (cap at 1.0)
  const confidence = Math.min(primaryScore, 1.0);

  return {
    path: filePath,
    archetype: primaryId,
    ...(secondaryArchetypes.length > 0 ? { secondaryArchetypes } : {}),
    confidence: Math.round(confidence * 100) / 100,
    source: "algorithmic" as const,
    ...(evidence.length > 0 ? { evidence } : {}),
  };
}

/**
 * Match a single signal against a file. Returns a description string if matched.
 */
function matchSignal(
  signal: ArchetypeSignal,
  filePath: string,
  fileName: string,
  exports?: string[],
): string | null {
  const re = new RegExp(signal.pattern);

  switch (signal.kind) {
    case "path":
      if (re.test(filePath)) return `path matches ${signal.pattern}`;
      return null;

    case "filename":
      if (re.test(fileName)) return `filename "${fileName}" matches ${signal.pattern}`;
      return null;

    case "directory":
      // Directory signals use string containment for simple patterns
      if (filePath.includes(signal.pattern)) return `path contains "${signal.pattern}"`;
      return null;

    case "export":
      if (!exports) return null;
      for (const sym of exports) {
        if (re.test(sym)) return `exports "${sym}" matching ${signal.pattern}`;
      }
      return null;

    case "import":
      // Import signal matching would require the full import graph
      // For now, handle via evidence from the import data
      return null;

    default:
      return null;
  }
}

/**
 * Build a map of file → exported symbol names from re-export edges.
 * This captures symbols available for export-based classification.
 */
function buildExportMap(edges: ImportEdge[]): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const edge of edges) {
    if (edge.type === "reexport") {
      // The source file exports these symbols
      let list = result.get(edge.to);
      if (!list) {
        list = [];
        result.set(edge.to, list);
      }
      for (const sym of edge.symbols) {
        if (!list.includes(sym)) list.push(sym);
      }
    }
  }

  return result;
}

/**
 * Merge custom archetypes with built-ins. Custom archetypes with the same ID
 * override the built-in definition.
 */
function mergeArchetypes(
  builtins: ArchetypeDefinition[],
  custom?: ArchetypeDefinition[],
): ArchetypeDefinition[] {
  if (!custom || custom.length === 0) return [...builtins];

  const merged = new Map<string, ArchetypeDefinition>();
  for (const a of builtins) merged.set(a.id, a);
  for (const a of custom) merged.set(a.id, a);
  return [...merged.values()];
}

/**
 * Compute summary statistics from classifications.
 */
function computeSummary(files: FileClassification[]): ClassificationsSummary {
  const byArchetype: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let totalClassified = 0;
  let totalUnclassified = 0;

  for (const fc of files) {
    if (fc.archetype) {
      totalClassified++;
      byArchetype[fc.archetype] = (byArchetype[fc.archetype] ?? 0) + 1;
    } else {
      totalUnclassified++;
    }
    bySource[fc.source] = (bySource[fc.source] ?? 0) + 1;
  }

  return { totalClassified, totalUnclassified, byArchetype, bySource };
}

// ── Classification gate (TJ-R3, ADR-2026-09-07-realm-classify-gate-split.md) ───────────────
//
// classify.ts is the only file that calls either classifier — classify-elm.ts and
// classify-llm.ts never call each other or know the other exists. For each file the
// algorithmic pass left at archetype: null: try classify-elm.ts first; whatever it doesn't
// confidently resolve falls through to classify-llm.ts. This replaces two things that used to
// exist side by side: TT-N1's shadow-mode ELM attempt that lived inline in this function
// (dead code — ELM_GATE_ENABLED was hardcoded false, and its trainClassifyPathELM/
// predictWithClassifyPathELM never actually shipped in classify-elm.ts, so that block never
// compiled after the dev-branch merge), and analyze-phases.ts's own separate, working,
// config-driven ELM-then-LLM sequencing (TJ-A2) — moved here so there's exactly one place that
// makes this decision, per the ADR's Decision #1.

export interface GateOptions {
  /** Whether to attempt the ELM stage at all (`.n-dx.json`'s elmPrefilter.enabled). Defaults false (opt-in). */
  elmEnabled: boolean;
  elm: ELMGateOptions;
}

export interface GateResult {
  updatedFiles: FileClassification[];
  tokenUsage: AnalyzeTokenUsage;
}

/**
 * Route whatever the algorithmic pass left unclassified through the ELM stage, then the LLM
 * stage for anything ELM didn't confidently resolve. Reads the kill switch (`options.elmEnabled`)
 * before attempting the ELM call at all — when disabled, behaves exactly as if classify-elm.ts
 * didn't exist. `inventory`/`imports` are passed straight through to classify-elm.ts, which
 * needs them to regenerate fresh per-archetype evidence vectors (classify-llm.ts needs neither).
 */
export async function runClassificationGate(
  classifications: Classifications,
  inventory: Inventory,
  imports: Imports,
  options: GateOptions,
): Promise<GateResult> {
  const tokenUsage = emptyAnalyzeTokenUsage();
  const updatedFiles: FileClassification[] = [];

  const unclassified = classifications.files.filter(
    (f) => f.archetype === null && f.source === "algorithmic",
  );
  if (unclassified.length === 0) {
    return { updatedFiles, tokenUsage };
  }

  let current = classifications;

  if (options.elmEnabled) {
    const elmResult = runELMGate(current, inventory, imports, options.elm);
    if (elmResult.updatedFiles.length > 0) {
      updatedFiles.push(...elmResult.updatedFiles);
      current = mergeClassificationResults(current, elmResult.updatedFiles);
    }
  }

  const stillUnclassified = current.files.filter(
    (f) => f.archetype === null && f.source === "algorithmic",
  );
  if (stillUnclassified.length === 0) {
    return { updatedFiles, tokenUsage };
  }

  const llmResult = await classifyUnclassifiedWithLLM(stillUnclassified, current.archetypes);
  updatedFiles.push(...llmResult.updatedFiles);
  mergeTokenUsageAggregate(tokenUsage, llmResult.tokenUsage);

  return { updatedFiles, tokenUsage };
}

/** Merge one AnalyzeTokenUsage aggregate into another (classify-llm.ts's result into the gate's). */
function mergeTokenUsageAggregate(target: AnalyzeTokenUsage, source: AnalyzeTokenUsage): void {
  target.calls += source.calls;
  target.inputTokens += source.inputTokens;
  target.outputTokens += source.outputTokens;
  if (source.cacheCreationInputTokens) {
    target.cacheCreationInputTokens = (target.cacheCreationInputTokens ?? 0) + source.cacheCreationInputTokens;
  }
  if (source.cacheReadInputTokens) {
    target.cacheReadInputTokens = (target.cacheReadInputTokens ?? 0) + source.cacheReadInputTokens;
  }
}

/**
 * Merge LLM classification results into existing classifications.
 * Replaces null-archetype entries with LLM results and recomputes summary.
 */
export function mergeClassificationResults(
  base: Classifications,
  llmFiles: FileClassification[],
): Classifications {
  if (llmFiles.length === 0) return base;

  const llmMap = new Map(llmFiles.map((f) => [f.path, f]));
  const mergedFiles = base.files.map((f) => llmMap.get(f.path) ?? f);
  const summary = computeSummary(mergedFiles);

  return sortClassifications({
    archetypes: base.archetypes,
    files: mergedFiles,
    summary,
  });
}

/**
 * Build a lookup map from file path to archetype ID.
 * Returns null for unclassified files.
 */
export function buildClassificationMap(
  classifications: Classifications | null | undefined,
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  if (!classifications) return map;
  for (const fc of classifications.files) {
    map.set(fc.path, fc.archetype);
  }
  return map;
}
