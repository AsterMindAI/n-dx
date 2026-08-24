#!/usr/bin/env node
/**
 * Measure per-spawn token overhead on REAL classify calls.
 *
 * Implements Lane A steps A4 + A6 of
 * Claude-Context/IMPL/IMPL-2026-08-23-butter-token-measurement-and-path-a-b-seam.md
 * and answers Jam's request in
 * Claude-Context/Nolan-Agents/Notes/NOTE-nolan-internal-2026-08-23-tn-j13-fixed-and-a-denominator-correction.md § 3.
 *
 * ── Why this script exists ────────────────────────────────────────────────
 *
 * The first overhead numbers on this project (22,110 / 34,526 / 45,948 tokens)
 * came from trivial 2-in/4-out prompts. A real classify batch carries 30 file
 * paths plus a 17-archetype catalog, so its cache-creation component may differ
 * materially — and that is the one number Path B's savings case rests on.
 *
 * Under ADR-2026-08-23-butter-savings-measurement-contract, Path A owns this
 * measurement and Path B quotes it. This script is the instrument.
 *
 * ── Honesty rules this script enforces ────────────────────────────────────
 *
 * - Records WHICH claude binary produced the numbers. Two coexist on this
 *   machine (pnpm 2.1.231, VS Code extension 2.1.237) and they are not
 *   interchangeable for reproducibility. Jam's finding.
 * - Reports a RANGE with per-call detail, never a single multiplier. Observed
 *   spread on trivial prompts was better than 2x.
 * - Emits provenance: repo, commit, binary, version, date, batch size, seed.
 * - Makes NO claim about calls avoided. That is Path B's number
 *   (scripts/elm-calls-avoided.mjs), and deriving it here would be exactly the
 *   two-independent-numbers failure the ADR exists to prevent.
 *
 * Usage:
 *   node scripts/elm-token-baseline.mjs <analyzed-repo> [--calls=3] [--dry-run]
 *
 * Requires a reachable Claude CLI. Put it on PATH for the run — do NOT persist
 * it to .n-dx.json, which is committed, shared, and machine-specific.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve, basename, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");

/** Matches LLM_BATCH_SIZE at packages/sourcevision/src/analyzers/classify.ts:322. */
const BATCH_SIZE = 30;
/** Deterministic file selection so re-runs measure the same prompts. */
const SEED = 42;

// ── args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const repoArg = args.find((a) => !a.startsWith("--"));
const callsArg = Number((args.find((a) => a.startsWith("--calls=")) || "").split("=")[1]) || 3;
const dryRun = args.includes("--dry-run");

if (!repoArg) {
  console.error("usage: node scripts/elm-token-baseline.mjs <analyzed-repo> [--calls=N] [--dry-run]");
  process.exit(2);
}
const repoDir = resolve(repoArg);
const classPath = join(repoDir, ".sourcevision", "classifications.json");
if (!existsSync(classPath)) {
  console.error(`No classifications.json at ${classPath}`);
  console.error("Run `sourcevision analyze <repo>` first.");
  process.exit(2);
}

// ── deterministic sampling (mulberry32, same spirit as elm-hello-world's seed) ──

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── provenance ────────────────────────────────────────────────────────────

function git(cwd, ...a) {
  try { return execFileSync("git", a, { cwd, encoding: "utf8" }).trim(); }
  catch { return "unknown"; }
}

function resolveBinary() {
  try {
    const path = execFileSync("sh", ["-c", "command -v claude"], { encoding: "utf8" }).trim();
    let version = "unknown";
    try { version = execFileSync(path, ["--version"], { encoding: "utf8" }).trim(); } catch { /* ignore */ }
    return { path, version };
  } catch {
    return null;
  }
}

// ── the prompt ────────────────────────────────────────────────────────────

/**
 * Replicates buildLLMClassifyPrompt (packages/sourcevision/src/analyzers/classify.ts:486-519)
 * verbatim in structure. It is module-private and not exported, so it cannot be
 * imported; it is reproduced here rather than edited in place, because
 * packages/sourcevision/** belongs to Path B.
 *
 * If that function changes, this measurement drifts from what analyze actually
 * sends. Re-check it against classify.ts:486 before quoting a fresh number.
 */
function buildClassifyPrompt(files, archetypes, includeDescriptions) {
  const archetypeLines = archetypes.map((a) =>
    includeDescriptions ? `- ${a.id}: ${a.name} — ${a.description}` : `- ${a.id}: ${a.name}`,
  ).join("\n");

  const fileLines = files.map((f, i) => {
    const parts = [`${i + 1}. ${f.path}`];
    if (f.evidence && f.evidence.length > 0) {
      const hints = f.evidence.slice(0, 3).map((e) => `${e.archetypeId}(${e.weight})`).join(", ");
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

// ── main ──────────────────────────────────────────────────────────────────

const raw = JSON.parse(readFileSync(classPath, "utf8"));
const rows = Array.isArray(raw) ? raw : (raw.files ?? []);
if (rows.length === 0) {
  console.error("classifications.json contains no file rows.");
  process.exit(2);
}

const { BUILTIN_ARCHETYPES } = await import(
  join(REPO_ROOT, "packages/sourcevision/dist/analyzers/archetypes.js")
);
const catalog = BUILTIN_ARCHETYPES.map((a) => ({ id: a.id, name: a.name, description: a.description }));

const rand = mulberry32(SEED);
const shuffled = [...rows].sort(() => rand() - 0.5);

console.log(`elm-token-baseline — per-spawn overhead on real classify calls\n`);
console.log(`repo:      ${basename(repoDir)} @ ${git(repoDir, "rev-parse", "--short", "HEAD")}`);
console.log(`rows:      ${rows.length}  ·  batch size: ${BATCH_SIZE}  ·  seed: ${SEED}`);
console.log(`archetypes: ${catalog.length}`);

const binary = resolveBinary();
if (!binary) {
  console.error(`\nNo 'claude' on PATH. Put one there for this run, e.g.:`);
  console.error(`  export PATH="<claude-dir>:$PATH"`);
  console.error(`Do NOT persist it via 'ndx config llm.claude.cli_path' — .n-dx.json is committed and shared.`);
  process.exit(1);
}
console.log(`binary:    ${binary.path}`);
console.log(`version:   ${binary.version}\n`);

const batches = [];
for (let i = 0; i < callsArg; i++) {
  const slice = shuffled.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
  if (slice.length === 0) break;
  batches.push(slice);
}

if (dryRun) {
  batches.forEach((b, i) => {
    const p = buildClassifyPrompt(b, catalog, true);
    console.log(`  batch ${i + 1}: ${b.length} files, prompt ${p.length} chars — NOT SENT (--dry-run)`);
  });
  console.log(`\nDry run: no calls made, no tokens spent.`);
  process.exit(0);
}

const { callClaude } = await import(
  join(REPO_ROOT, "packages/sourcevision/dist/analyzers/claude-client.js")
);

const observations = [];
for (const [i, batch] of batches.entries()) {
  const prompt = buildClassifyPrompt(batch, catalog, true);
  process.stdout.write(`  call ${i + 1}/${batches.length} — ${batch.length} files, ${prompt.length} chars ... `);
  const startedAt = Date.now();
  let usage, error;
  try {
    const r = await callClaude(prompt);
    usage = r.tokenUsage;
  } catch (err) {
    error = String(err?.message ?? err).slice(0, 200);
  }
  const ms = Date.now() - startedAt;

  if (error) {
    console.log(`FAILED (${ms}ms): ${error}`);
    observations.push({ call: i + 1, files: batch.length, promptChars: prompt.length, ms, error });
    continue;
  }
  if (!usage) {
    console.log(`NO USAGE RETURNED (${ms}ms) — parser regression?`);
    observations.push({ call: i + 1, files: batch.length, promptChars: prompt.length, ms, usage: null });
    continue;
  }
  const overhead = (usage.cacheCreationInput ?? 0) + (usage.cacheReadInput ?? 0);
  console.log(`in=${usage.input} out=${usage.output} cacheCreate=${usage.cacheCreationInput ?? 0} cacheRead=${usage.cacheReadInput ?? 0} (${ms}ms)`);
  observations.push({
    call: i + 1, files: batch.length, promptChars: prompt.length, ms,
    input: usage.input, output: usage.output,
    cacheCreationInput: usage.cacheCreationInput ?? 0,
    cacheReadInput: usage.cacheReadInput ?? 0,
    overheadTokens: overhead,
    totalTokens: usage.input + usage.output + overhead,
  });
}

const ok = observations.filter((o) => typeof o.totalTokens === "number");
if (ok.length === 0) {
  console.error(`\nNo successful observations — nothing to report. Not writing a fixture.`);
  process.exit(1);
}

const totals = ok.map((o) => o.totalTokens).sort((a, b) => a - b);
const overheads = ok.map((o) => o.overheadTokens).sort((a, b) => a - b);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

console.log(`\n── per classify call, n=${ok.length} ──`);
console.log(`  total tokens:    min ${totals[0].toLocaleString()}  max ${totals[totals.length - 1].toLocaleString()}  mean ${Math.round(sum(totals) / totals.length).toLocaleString()}`);
console.log(`  of which overhead (cache create + read):`);
console.log(`                   min ${overheads[0].toLocaleString()}  max ${overheads[overheads.length - 1].toLocaleString()}  mean ${Math.round(sum(overheads) / overheads.length).toLocaleString()}`);
const meanPromptShare = sum(ok.map((o) => o.input + o.output)) / sum(ok.map((o) => o.totalTokens));
console.log(`  prompt+completion as a share of the call: ${(meanPromptShare * 100).toFixed(2)}%`);
console.log(`\n  n=${ok.length} is a small sample. Quote the range, not the mean.`);
console.log(`  This is the cost of ONE classify call. It is NOT a savings figure —`);
console.log(`  calls avoided is Path B's number (scripts/elm-calls-avoided.mjs).`);

const out = {
  measurement: "per-spawn token cost of one sourcevision classify call",
  producedBy: "scripts/elm-token-baseline.mjs",
  implements: "IMPL-2026-08-23-butter-token-measurement-and-path-a-b-seam.md § A4",
  contract: "ADR-2026-08-23-butter-savings-measurement-contract.md",
  provenance: {
    date: new Date().toISOString(),
    repo: basename(repoDir),
    repoCommit: git(repoDir, "rev-parse", "HEAD"),
    ndxCommit: git(REPO_ROOT, "rev-parse", "HEAD"),
    claudeBinary: binary.path,
    claudeVersion: binary.version,
    batchSize: BATCH_SIZE,
    seed: SEED,
    promptSource: "replicated from packages/sourcevision/src/analyzers/classify.ts:486-519",
  },
  caveats: [
    "Small sample — quote the range, not the mean.",
    "Overhead varies with cache state; it is not a constant.",
    "Cost of one classify call. NOT a savings figure.",
    "Zone-enrichment calls are a separate, larger population an ELM cannot replace.",
  ],
  observations,
  summary: {
    n: ok.length,
    totalTokens: { min: totals[0], max: totals[totals.length - 1], mean: Math.round(sum(totals) / totals.length) },
    overheadTokens: { min: overheads[0], max: overheads[overheads.length - 1], mean: Math.round(sum(overheads) / overheads.length) },
    promptShareOfCall: Number(meanPromptShare.toFixed(4)),
  },
};

const outPath = join(REPO_ROOT, "scripts/data/elm-token-baseline.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(`\nwrote ${outPath}`);
