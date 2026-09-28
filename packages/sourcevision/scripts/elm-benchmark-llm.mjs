/**
 * TJ-E1 LLM-side benchmark — how long does one real classify call actually take?
 *
 * ⚠️ THIS SPENDS REAL MONEY. Each invocation is one Claude CLI call, measured at 22k-46k tokens
 * of mostly cache traffic — roughly 2-6 cents at Sonnet 5 rates. It defaults to 3 calls.
 * Nothing else in this repo's benchmark suite costs anything; this is the exception, and it is
 * a separate script for exactly that reason.
 *
 * WHY IT CANNOT BE ESTIMATED: the dominant cost and the dominant latency are both process-spawn
 * overhead, not prompt size. The real prompt is ~924 tokens inside a 22k-46k token call. Guessing
 * from prompt size understates it by more than an order of magnitude.
 *
 * It builds a REAL classify prompt — the actual archetype catalog and 30 real unclassified paths
 * from this repo — so the timing reflects the production shape, not a toy request.
 *
 * Usage: node packages/sourcevision/scripts/elm-benchmark-llm.mjs [calls]
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

const CALLS = Number(process.argv[2] ?? 3);
const BATCH = 30;

const { BUILTIN_ARCHETYPES } = await import("../dist/analyzers/archetypes.js");

const classifications = JSON.parse(readFileSync(".sourcevision/classifications.json", "utf-8"));
const unclassified = classifications.files
  .filter((f) => f.archetype === null && f.source === "algorithmic")
  .slice(0, BATCH);

if (unclassified.length < BATCH) {
  console.error(`Need ${BATCH} unclassified files; found ${unclassified.length}. Run analyze --phase=3 --fast first.`);
  process.exit(1);
}

// Mirrors buildLLMClassifyPrompt in classify-llm.ts.
const archetypeLines = BUILTIN_ARCHETYPES.map((a) => `- ${a.id}: ${a.name} — ${a.description}`).join("\n");
const fileLines = unclassified.map((f, i) => `${i + 1}. ${f.path}`).join("\n");
const prompt = `Classify these source files. Assign each the best-fit archetype by path and likely purpose. Omit files with no clear fit.

Archetypes:
${archetypeLines}

Files:
${fileLines}

Respond with JSON: [{"path":"...","archetype":"...","reason":"..."}]`;

console.log("=".repeat(80));
console.log("TJ-E1 LLM-side benchmark — REAL CALLS, REAL COST");
console.log("=".repeat(80));
console.log(`calls           ${CALLS}`);
console.log(`batch           ${BATCH} files (production LLM_BATCH_SIZE)`);
console.log(`prompt chars    ${prompt.length}  (~${Math.round(prompt.length / 4)} tokens of real content)`);
console.log(`est. cost       ~$${(CALLS * 0.02).toFixed(2)}-$${(CALLS * 0.06).toFixed(2)} at Sonnet 5 rates\n`);

const times = [];
for (let i = 0; i < CALLS; i++) {
  const t = performance.now();
  let ok = true;
  let outLen = 0;
  try {
    // Windows: node refuses to spawn a .cmd without a shell (EINVAL), and the prompt is far
    // too long and punctuation-heavy to pass safely through one. Write it to a temp file and
    // have the shell cat it in, which is also how a human would reproduce this by hand.
    const pf = join(tmpdir(), `elm-bench-${process.pid}-${i}.txt`);
    writeFileSync(pf, prompt, "utf-8");
    const cmd = process.platform === "win32" ? "claude.cmd" : "claude";
    const res = spawnSync(`${cmd} -p "$(cat '${pf}')"`, {
      shell: true, encoding: "utf-8", timeout: 600_000, maxBuffer: 20 * 1024 * 1024,
    });
    try { unlinkSync(pf); } catch { /* best effort */ }
    if (res.status !== 0 || res.error) throw res.error ?? new Error(`exit ${res.status}: ${String(res.stderr).slice(0, 200)}`);
    outLen = (res.stdout ?? "").length;
  } catch (err) {
    ok = false;
    console.log(`  call ${i + 1}: FAILED — ${String(err.message).slice(0, 120)}`);
  }
  const el = performance.now() - t;
  if (ok) {
    times.push(el);
    console.log(`  call ${i + 1}: ${(el / 1000).toFixed(2)} s   (${outLen} chars back)`);
  }
}

if (times.length === 0) {
  console.log("\nNo successful calls — nothing to report. Do not substitute an estimate.");
  process.exit(1);
}

const mean = times.reduce((a, b) => a + b, 0) / times.length;
const lo = Math.min(...times);
const hi = Math.max(...times);

console.log("\n" + "-".repeat(80));
console.log(`ONE CALL        ${(lo / 1000).toFixed(2)}-${(hi / 1000).toFixed(2)} s   (mean ${(mean / 1000).toFixed(2)} s, n=${times.length})`);
console.log(`FULL PASS       ${((mean * 9) / 1000).toFixed(1)} s   — 9 calls for n-dx's 255-file residue`);
console.log(`                (sequential; classify-llm.ts does not parallelise batches)`);
console.log("-".repeat(80));
console.log(`\nCompare against elm-benchmark.mjs's end-to-end figure for the same 255 files.`);
console.log(`n is small — treat this as an order-of-magnitude reading, not a precise constant.`);
