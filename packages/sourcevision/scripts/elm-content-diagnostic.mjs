/**
 * TJ-E1 diagnostic — does the content representation produce a working classifier at all?
 *
 * This is IMPL step 7 (calibrate the sweep range before trusting a zero), NOT step 6/8 (the
 * eval). It costs zero LLM calls.
 *
 * READ THIS BEFORE QUOTING ANY NUMBER IT PRINTS
 * ---------------------------------------------
 * Part A trains and tests on ALGORITHMICALLY-labelled files. That is **not** the population the
 * gate is invoked for, and measuring there is precisely the mistake four prior efforts on this
 * project made (100%@59.0%, 97.0%@42.3%, Realm's reproduction, Nala's 90.6% k-fold — all
 * measured files that already had algorithmic signal). Part A answers one narrow question:
 * *can the representation learn a label at all?* A low number here kills the approach; a high
 * number does NOT validate it.
 *
 * Part B is the one that matters for a gate decision. It runs the trained model over the REAL
 * unclassified population — the files that actually reach the ELM — and reports the confidence
 * distribution and prediction spread. There is no ground truth for these files (that is what the
 * LLM teacher is for), so it reports NO accuracy. It exists to answer:
 *   1. Does the model produce varied predictions here, or one class for everything?
 *      (The evidence representation produced ONE prediction for every file, by construction.)
 *   2. Where does confidence actually sit, so a threshold can be chosen from data?
 *      Three agents here have swept a range entirely above the observed distribution and read
 *      the resulting 0% coverage as "the model is broken."
 *
 * Usage:  node packages/sourcevision/scripts/elm-content-diagnostic.mjs [projectDir]
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const SEED = 20260922;

const root = process.argv[2] ? process.argv[2] : process.cwd();
const svDir = join(root, ".sourcevision");

const {
  buildFeatureVector,
  readFileContentSafely,
  FEATURE_VERSION,
  FEATURE_VECTOR_SIZE,
} = await import("../dist/analyzers/classify-elm-features.js");
const { trainArchetypeELMNumeric, predictArchetypeNumeric } = await import(
  "../dist/analyzers/classify-elm.js"
);

function readJSON(name) {
  return JSON.parse(readFileSync(join(svDir, name), "utf-8"));
}

const inventory = readJSON("inventory.json");
const classifications = readJSON("classifications.json");

/** Seeded Fisher-Yates so the split is reproducible from SEED alone. */
function shuffled(arr, seed) {
  let s = seed >>> 0;
  const next = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 0x100000000;
  };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const byPath = new Map(classifications.files.map((f) => [f.path, f]));
const sourcePaths = new Set(
  inventory.files.filter((f) => f.role === "source").map((f) => f.path),
);

const labelled = [];
const unclassified = [];
for (const fc of classifications.files) {
  if (!sourcePaths.has(fc.path)) continue;
  if (fc.archetype) {
    if (fc.source === "algorithmic" || fc.source === "llm") labelled.push(fc);
  } else if (fc.source === "algorithmic") {
    unclassified.push(fc);
  }
}

const llmLabelled = labelled.filter((f) => f.source === "llm").length;

console.log("=".repeat(78));
console.log(`TJ-E1 content-representation diagnostic   seed=${SEED}`);
console.log(`feature layout v${FEATURE_VERSION}, ${FEATURE_VECTOR_SIZE} dimensions`);
console.log("=".repeat(78));
console.log(`project              ${root}`);
console.log(`source files         ${sourcePaths.size}`);
console.log(`labelled             ${labelled.length}  (algorithmic ${labelled.length - llmLabelled}, llm ${llmLabelled})`);
console.log(`UNCLASSIFIED         ${unclassified.length}   <-- the population the gate is for`);

if (labelled.length < 20) {
  console.log("\nNot enough labelled data to train. Run `analyze --phase=3` first.");
  process.exit(0);
}

function vectorFor(path) {
  return buildFeatureVector({ path, content: readFileContentSafely(root, path) });
}

// ── Part A — can the representation learn a label at all? (WRONG POPULATION) ──────────────

const shuf = shuffled(labelled, SEED);
const cut = Math.floor(shuf.length * 0.8);
const train = shuf.slice(0, cut);
const heldOut = shuf.slice(cut);

const trainExamples = train.map((f) => ({ vector: vectorFor(f.path), archetype: f.archetype }));
const categories = [...new Set(trainExamples.map((e) => e.archetype))].sort();
const model = trainArchetypeELMNumeric(trainExamples, categories, SEED);

// Baselines. Majority class is the honest bar, not 1/17.
const counts = new Map();
for (const e of trainExamples) counts.set(e.archetype, (counts.get(e.archetype) ?? 0) + 1);
const [majorityClass, majorityN] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
const majorityBaseline = heldOut.filter((f) => f.archetype === majorityClass).length / heldOut.length;

let correct = 0;
const confidences = [];
for (const f of heldOut) {
  const p = predictArchetypeNumeric(model, vectorFor(f.path));
  if (p.archetype === f.archetype) correct++;
  confidences.push(p.confidence);
}

console.log("\n" + "-".repeat(78));
console.log("PART A — learnability on ALGORITHMIC labels. NOT the target population.");
console.log("-".repeat(78));
console.log(`train / held-out     ${train.length} / ${heldOut.length}`);
console.log(`classes              ${categories.length}`);
console.log(`held-out accuracy    ${(100 * correct / heldOut.length).toFixed(1)}%   (${correct}/${heldOut.length})`);
console.log(`majority baseline    ${(100 * majorityBaseline).toFixed(1)}%   ("${majorityClass}", ${majorityN} train rows)`);
console.log(`uniform baseline     ${(100 / categories.length).toFixed(1)}%   (1/${categories.length})`);
console.log(`\n  A high number here does NOT validate the approach -- see this file's header.`);

// ── Part B — behaviour on the REAL population. No accuracy; there is no truth here. ──────

if (unclassified.length === 0) {
  console.log("\nNo unclassified files; nothing to report for Part B.");
  process.exit(0);
}

const fullExamples = labelled.map((f) => ({ vector: vectorFor(f.path), archetype: f.archetype }));
const fullCategories = [...new Set(fullExamples.map((e) => e.archetype))].sort();
const fullModel = trainArchetypeELMNumeric(fullExamples, fullCategories, SEED);

const predByClass = new Map();
const targetConf = [];
let allZeroVectors = 0;
for (const fc of unclassified) {
  const v = vectorFor(fc.path);
  if (!v.some((x) => x !== 0)) allZeroVectors++;
  const p = predictArchetypeNumeric(fullModel, v);
  predByClass.set(p.archetype, (predByClass.get(p.archetype) ?? 0) + 1);
  targetConf.push(p.confidence);
}
targetConf.sort((a, b) => a - b);
const q = (f) => targetConf[Math.min(targetConf.length - 1, Math.floor(f * targetConf.length))];

console.log("\n" + "-".repeat(78));
console.log("PART B — the REAL unclassified population. No accuracy: no ground truth exists.");
console.log("-".repeat(78));
console.log(`files                ${unclassified.length}`);
console.log(`all-zero vectors     ${allZeroVectors}   <-- evidence representation had ${unclassified.length}/${unclassified.length} here`);
console.log(`distinct predictions ${predByClass.size} of ${fullCategories.length} trained classes`);
console.log(`\nconfidence           min ${q(0).toFixed(4)}  p25 ${q(0.25).toFixed(4)}  median ${q(0.5).toFixed(4)}  p75 ${q(0.75).toFixed(4)}  max ${targetConf[targetConf.length - 1].toFixed(4)}`);

console.log(`\nprediction spread (a single class for everything = no discrimination):`);
for (const [a, n] of [...predByClass.entries()].sort((x, y) => y[1] - x[1])) {
  const pct = (100 * n / unclassified.length).toFixed(1).padStart(5);
  console.log(`  ${pct}%  ${String(n).padStart(4)}  ${a}`);
}

console.log(`\ncoverage if the gate threshold were set to:`);
for (const t of [0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.8]) {
  const n = targetConf.filter((c) => c >= t).length;
  const flag = t === 0.8 ? "   <-- the diagram's illustrative 80%" : "";
  console.log(`  >= ${t.toFixed(2)}   ${(100 * n / targetConf.length).toFixed(1).padStart(5)}%  (${n}/${targetConf.length})${flag}`);
}
console.log("\nCoverage here is files-resolved, NOT accuracy, and NOT Team Nolan's coverage");
console.log("metric (theirs counts answering something other than service/utility).");

// ── Part C — top1/top2 margin, the other candidate gate shape ────────────────────────────
//
// Part B's absolute-confidence curve is measured to be unusable as a gate on this population:
// the distribution is compressed into roughly 0.10-0.22, so a threshold falls off a cliff
// (100% resolved at 0.10, 10% at 0.15, 0% at 0.25) instead of trading off smoothly. The margin
// between the best and second-best class is scale-free and does not have that problem. Nala's
// TT-N1 chose a margin for the same underlying reason; this measures what value actually works
// here rather than inheriting their hardcoded 0.3.

const margins = [];
for (const fc of unclassified) {
  const top = fullModel.elm.predictTopKFromVector(vectorFor(fc.path), 2);
  margins.push(top.length > 1 ? top[0].prob - top[1].prob : top[0].prob);
}
margins.sort((a, b) => a - b);
const mq = (f) => margins[Math.min(margins.length - 1, Math.floor(f * margins.length))];

console.log("\n" + "-".repeat(78));
console.log("PART C — top1/top2 margin on the same real population.");
console.log("-".repeat(78));
console.log(
  `margin               min ${mq(0).toFixed(4)}  p25 ${mq(0.25).toFixed(4)}  median ${mq(0.5).toFixed(4)}  p75 ${mq(0.75).toFixed(4)}  p90 ${mq(0.9).toFixed(4)}  max ${margins[margins.length - 1].toFixed(4)}`,
);
console.log(`\ncoverage by margin threshold:`);
for (const t of [0.005, 0.01, 0.02, 0.03, 0.05, 0.08, 0.1, 0.15, 0.3]) {
  const n = margins.filter((x) => x >= t).length;
  const note = t === 0.3 ? "   <-- TT-N1's hardcoded constant" : "";
  console.log(`  >= ${t.toFixed(3)}   ${(100 * n / margins.length).toFixed(1).padStart(5)}%  (${n}/${margins.length})${note}`);
}
console.log("\nStill no accuracy in Part B or C. Choosing between these two gate shapes on");
console.log("coverage alone would repeat this project's original mistake -- precision needs");
console.log("teacher labels for THIS population, which is IMPL steps 5-6.");
