/**
 * TJ-E1 savings curve — what does the ELM gate actually save, and what does it cost?
 *
 * The project's objective is to reduce en-dash's LLM spend by answering some archetype
 * classifications with an ELM instead of a Claude call. Accuracy is a constraint, not the goal.
 * So this measures the thing that decides whether the gate is worth shipping:
 *
 *     LLM calls avoided   vs   labels that differ from what the LLM would have said
 *
 * WHY THIS IS IN-DOMAIN, ON PURPOSE
 * ---------------------------------
 * `getArchetypeELM` trains fresh on the PROJECT'S OWN accumulated history and only falls back
 * to a bundled baseline at cold start. So production steady-state is per-project: the model
 * running on repo X is trained on repo X's own LLM labels. This script measures that path.
 *
 * `elm-generalisation-check.mjs` measures the OTHER path -- one model shipped across repos --
 * and found it fails badly (below majority baseline on unseen ecosystems). Both are real; they
 * answer different questions. Do not quote one as the other.
 *
 * THE BATCHING FACT THAT DOMINATES THE ECONOMICS
 * ----------------------------------------------
 * `classify-llm.ts` batches 30 files per call, so savings are STEP-WISE, not linear. Resolving
 * 5% of n-dx's 255-file residue saves ZERO calls (243 files still needs 9 calls). Roughly every
 * 11.8% of coverage saves one call. A high-precision / low-coverage gate is worth nothing here,
 * which is the opposite of the intuition that "be conservative" is the safe default.
 *
 * COST BASIS: 22k-46k tokens per classify call, cache-state dependent. Measured by Team Nolan
 * (scripts/data/elm-calls-avoided.json on Nolan-Work; ADR-2026-08-23-butter-savings-measurement
 * -contract.md). Their note says to cite it as a RANGE and not multiply it out to a single
 * figure, so this prints a range.
 *
 * WHAT "PRECISION" MEANS HERE, EXACTLY
 * ------------------------------------
 * Agreement with the LLM teacher, which is itself 72.3% against human judgement. This is NOT
 * accuracy. A disagreement is a label the ELM produced that the LLM would not have -- it is not
 * automatically wrong, and nobody has measured which is better. Read it as "how often the gate
 * changes the answer", not "how often the gate is wrong".
 *
 * SETUP: see elm-generalisation-check.mjs's header for fetching the corpus.
 * Usage: node packages/sourcevision/scripts/elm-savings-curve.mjs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SEED = 20260922;
const CORPUS = "scripts/data/elm-archetype-corpus-v3-classtargeted.json";
const REPO = "n-dx-1";
const REPO_ROOT = ".";
const LLM_BATCH_SIZE = 30; // classify-llm.ts's LLM_BATCH_SIZE
const TOKENS_PER_CALL_LOW = 22_000;
const TOKENS_PER_CALL_HIGH = 46_000;
const RESIDUE_POPULATION = 255; // Nolan's measured n-dx residue (elm-calls-avoided.json)

const { buildFeatureVector, readFileContentSafely, FEATURE_VERSION } = await import(
  "../dist/analyzers/classify-elm-features.js"
);
const { trainArchetypeELMNumeric } = await import("../dist/analyzers/classify-elm.js");

const corpus = JSON.parse(readFileSync(CORPUS, "utf-8"));
const root = resolve(REPO_ROOT);
const vec = (p) => buildFeatureVector({ path: p, content: readFileContentSafely(root, p) });

// Reuse Team Nolan's seed-42 stratified split rather than making a new one -- their note is
// explicit: "Do not re-split. Reuse it and your numbers are comparable to everything in
// ELM-FINDINGS.txt; re-split and they are comparable to nothing."
const trainRows = corpus.train.filter((r) => r.repo === REPO);
const testRows = corpus.heldOut.filter((r) => r.repo === REPO);

const examples = trainRows.map((r) => ({ vector: vec(r.text), archetype: r.label }));
const categories = [...new Set(examples.map((e) => e.archetype))].sort();
const model = trainArchetypeELMNumeric(examples, categories, SEED);

// Score every test row once: margin and whether it agrees with the teacher.
const scored = testRows.map((r) => {
  const top = model.elm.predictTopKFromVector(vec(r.text), 2);
  const margin = top.length > 1 ? top[0].prob - top[1].prob : top[0].prob;
  return { margin, agrees: top[0].label === r.label, predicted: top[0].label, teacher: r.label };
});

const calls = (n) => Math.ceil(n / LLM_BATCH_SIZE);
const baseCalls = calls(RESIDUE_POPULATION);

console.log("=".repeat(96));
console.log(`TJ-E1 savings curve   seed=${SEED}   feature layout v${FEATURE_VERSION}   PER-PROJECT (in-domain)`);
console.log("=".repeat(96));
console.log(`repo                 ${REPO}`);
console.log(`split                Nolan seed-42 stratified, reused: train ${trainRows.length} / held-out ${testRows.length}`);
console.log(`classes              ${categories.length}`);
console.log(`residue population   ${RESIDUE_POPULATION} files -> ${baseCalls} LLM calls today (batch ${LLM_BATCH_SIZE})`);
console.log(`cost basis           ${(TOKENS_PER_CALL_LOW / 1000).toFixed(0)}k-${(TOKENS_PER_CALL_HIGH / 1000).toFixed(0)}k tokens per call (Nolan, cache-dependent)`);
console.log(`\n"precision" = agreement with an LLM teacher that is itself 72.3% vs human judgement.`);
console.log(`It is NOT accuracy. A disagreement is a CHANGED answer, not a proven wrong one.`);

console.log("\n" + "-".repeat(96));
console.log(
  `${"margin".padStart(7)} ${"coverage".padStart(9)} ${"precision".padStart(10)} ${"changed".padStart(8)} ` +
    `${"files left".padStart(11)} ${"calls".padStart(6)} ${"saved".padStart(6)} ${"tokens saved".padStart(18)}`,
);
console.log("-".repeat(96));

const thresholds = [0.0, 0.002, 0.005, 0.01, 0.015, 0.02, 0.03, 0.04, 0.05, 0.08, 0.1];
let best = null;
for (const t of thresholds) {
  const resolved = scored.filter((s) => s.margin >= t);
  if (resolved.length === 0) continue;
  const coverage = resolved.length / scored.length;
  const agreed = resolved.filter((s) => s.agrees).length;
  const precision = agreed / resolved.length;

  // Extrapolate the held-out coverage rate onto the real residue population.
  const wouldResolve = Math.round(RESIDUE_POPULATION * coverage);
  const left = RESIDUE_POPULATION - wouldResolve;
  const remainingCalls = calls(left);
  const saved = baseCalls - remainingCalls;
  const changed = Math.round(wouldResolve * (1 - precision));

  const tokLow = (saved * TOKENS_PER_CALL_LOW) / 1000;
  const tokHigh = (saved * TOKENS_PER_CALL_HIGH) / 1000;
  const tokStr = saved === 0 ? "none" : `${tokLow.toFixed(0)}k-${tokHigh.toFixed(0)}k`;

  console.log(
    `${t.toFixed(3).padStart(7)} ${(100 * coverage).toFixed(1).padStart(8)}% ${(100 * precision).toFixed(1).padStart(9)}% ` +
      `${String(changed).padStart(8)} ${String(left).padStart(11)} ${String(remainingCalls).padStart(6)} ` +
      `${String(saved).padStart(6)} ${tokStr.padStart(18)}`,
  );

  // Track the cheapest-per-changed-label point among those that actually save something.
  // NOT "most calls saved" -- that degenerates to margin 0.0, i.e. never call the LLM and
  // accept every ELM guess, which maximises the metric by abandoning the job. A savings
  // metric with no quality term will always recommend switching the LLM off entirely.
  if (saved > 0) {
    const perCall = changed / saved; // labels changed per call saved -- lower is better
    if (!best || perCall < best.perCall) {
      best = { t, coverage, precision, saved, changed, remainingCalls, perCall };
    }
  }
}

console.log("-".repeat(96));
if (best) {
  const pctCalls = (100 * best.saved) / baseCalls;
  console.log(
    `\nMost efficient trade on this measurement: margin >= ${best.t.toFixed(3)}\n` +
      `  saves ${best.saved} of ${baseCalls} calls (${pctCalls.toFixed(0)}% of the classify pass)\n` +
      `  resolves ${(100 * best.coverage).toFixed(1)}% of the residue at ${(100 * best.precision).toFixed(1)}% teacher agreement\n` +
      `  changes ~${best.changed} of ${RESIDUE_POPULATION} labels (${best.perCall.toFixed(0)} changed per call saved)`,
  );
  console.log(
    `\nThis is NOT a recommendation to ship. Peak agreement across the whole sweep is ` +
      `${(100 * Math.max(...thresholds.map((t) => { const r = scored.filter((s) => s.margin >= t); return r.length ? r.filter((s) => s.agrees).length / r.length : 0; }))).toFixed(1)}%,` +
      `\nso at every operating point that saves a call, a large minority of labels change.` +
      `\nWhether that trade is acceptable is a business call, not a measurement.`,
  );
}

console.log("\nCAVEATS, all load-bearing:");
console.log("  - IN-DOMAIN ONLY. The cross-repo model fails badly; see elm-generalisation-check.mjs.");
console.log("    This is the per-project path, which is what production steady-state actually runs.");
console.log(`  - Held-out is ${testRows.length} rows. Coverage extrapolated to ${RESIDUE_POPULATION} files is an estimate,`);
console.log("    and the call-savings column inherits that error. Treat call counts as +/- 1.");
console.log("  - Savings are step-wise: below ~11.8% coverage the gate saves NOTHING at batch 30.");
console.log("  - Cold start saves nothing by construction: no project history, no model, all LLM.");
