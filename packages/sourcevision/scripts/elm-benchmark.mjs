/**
 * TJ-E1 performance benchmark — how fast is the ELM, and where does its time actually go?
 *
 * The accuracy and cost work (elm-savings-curve, elm-gate-separability, elm-capacity-corpus-sweep)
 * answers "is it right" and "what does it save". This answers the question a reader asks next:
 * "but isn't it enormously faster?" -- because if it is, that is a real argument in its favour
 * that the findings report owes an honest answer to.
 *
 * WHAT IS MEASURED HERE (all free, no API calls):
 *   1. Feature extraction throughput  -- reading and vectorising files
 *   2. Training time                  -- across corpus size and hidden units
 *   3. Inference latency              -- single model and 15-model ensemble
 *   4. Model artifact size            -- what would ship
 *   5. End-to-end                     -- the full 255-file residue, cold
 *
 * WHAT IS NOT MEASURED HERE: the LLM side. Timing that requires spending real money on a real
 * call, so it is deliberately a separate, explicit step -- see elm-benchmark-llm.mjs. Do not
 * substitute an estimate: the dominant cost is process-spawn overhead, which cannot be guessed.
 *
 * Usage: node packages/sourcevision/scripts/elm-benchmark.mjs
 */

import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

const SEED = 20260922;
const CORPUS = "scripts/data/elm-archetype-corpus-v3-classtargeted.json";
const ROOTS = {
  "n-dx-1": ".",
  "AsterMind-Community-Edition": "../elm-fresh/AsterMind-Community-Edition",
  express: "../elm-fresh/express",
  fastify: "../elm-fresh/fastify",
  commerce: "../elm-fresh/commerce",
  got: "../elm-fresh/got",
  core: "../elm-fresh/core",
  typeorm: "../elm-fresh/typeorm",
  nest: "../elm-fresh/nest",
  remix: "../elm-fresh/remix",
};

const { buildFeatureVector, readFileContentSafely, FEATURE_VECTOR_SIZE } = await import(
  "../dist/analyzers/classify-elm-features.js"
);
const { trainArchetypeELMNumeric } = await import("../dist/analyzers/classify-elm.js");

const corpus = JSON.parse(readFileSync(CORPUS, "utf-8"));
const rows = [...corpus.train, ...corpus.heldOut].filter((r) => ROOTS[r.repo]);

const ms = (n) => `${n.toFixed(1)} ms`;
const line = (c = "-") => console.log(c.repeat(84));

console.log("=".repeat(84));
console.log(`TJ-E1 performance benchmark   seed=${SEED}   ${FEATURE_VECTOR_SIZE}-dim vectors`);
console.log("=".repeat(84));
console.log(`node ${process.version} · ${process.platform} ${process.arch}`);
console.log(`corpus: ${rows.length} rows across ${Object.keys(ROOTS).length} repos\n`);

// ── 1. Feature extraction ────────────────────────────────────────────────────────────────
// Split reading from vectorising, because they have very different costs and only one of them
// is avoidable. Disk I/O is the part that scales with file size.

line("=");
console.log("1. FEATURE EXTRACTION");
line();

let readNs = 0;
const contents = [];
for (const r of rows) {
  const root = resolve(ROOTS[r.repo]);
  const t = performance.now();
  contents.push(readFileContentSafely(root, r.text));
  readNs += performance.now() - t;
}

let vecNs = 0;
const vectors = [];
for (let i = 0; i < rows.length; i++) {
  const t = performance.now();
  vectors.push(buildFeatureVector({ path: rows[i].text, content: contents[i] }));
  vecNs += performance.now() - t;
}

const totalBytes = contents.reduce((a, c) => a + (c ? c.length : 0), 0);
console.log(`  file read          ${ms(readNs).padStart(10)}   ${(readNs / rows.length).toFixed(3)} ms/file`);
console.log(`  vectorise          ${ms(vecNs).padStart(10)}   ${(vecNs / rows.length).toFixed(3)} ms/file`);
console.log(`  combined           ${ms(readNs + vecNs).padStart(10)}   ${((readNs + vecNs) / rows.length).toFixed(3)} ms/file`);
console.log(`  throughput         ${(rows.length / ((readNs + vecNs) / 1000)).toFixed(0)} files/sec`);
console.log(`  content read       ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);

// ── 2. Training ──────────────────────────────────────────────────────────────────────────
// Both axes matter: corpus size is what you would grow, hidden units is what the other team's
// certified spec would have had us raise (and which measured WORSE on accuracy).

line("=");
console.log("2. TRAINING TIME");
line();
console.log(`  ${"rows".padStart(6)} ${"hidden".padStart(7)} ${"time".padStart(12)} ${"per row".padStart(10)}`);

const trainCases = [
  [255, 128], [1000, 128], [rows.length, 128],
  [255, 512], [rows.length, 512],
  [255, 4096], [rows.length, 4096],
];
const trainTimes = new Map();
for (const [n, hidden] of trainCases) {
  const ex = vectors.slice(0, n).map((v, i) => ({ vector: v, archetype: rows[i].label }));
  const cats = [...new Set(ex.map((e) => e.archetype))].sort();
  const t = performance.now();
  const model = trainArchetypeELMNumeric(ex, cats, SEED, hidden);
  const el = performance.now() - t;
  trainTimes.set(`${n}/${hidden}`, { el, model });
  console.log(`  ${String(n).padStart(6)} ${String(hidden).padStart(7)} ${ms(el).padStart(12)} ${(el / n).toFixed(3).padStart(8)} ms`);
}

// ── 3. Inference ─────────────────────────────────────────────────────────────────────────
// The number that matters in production is the ensemble, not a single model -- a single model's
// confidence was measured to be uninformative, so the shipped gate needs all 15.

line("=");
console.log("3. INFERENCE LATENCY");
line();

const model128 = trainTimes.get(`${rows.length}/128`).model;
const sample = vectors.slice(0, 255);

function timeInference(models, vecs) {
  const t = performance.now();
  for (const v of vecs) for (const m of models) m.elm.predictTopKFromVector(v, 2);
  return performance.now() - t;
}

const solo = timeInference([model128], sample);
console.log(`  single model, 255 files     ${ms(solo).padStart(11)}   ${(solo / 255).toFixed(4)} ms/file`);

const ens = [];
const tEns = performance.now();
{
  const ex = vectors.map((v, i) => ({ vector: v, archetype: rows[i].label }));
  const cats = [...new Set(ex.map((e) => e.archetype))].sort();
  for (let i = 0; i < 15; i++) ens.push(trainArchetypeELMNumeric(ex, cats, SEED + i * 7919, 128));
}
const ensTrain = performance.now() - tEns;
const ens255 = timeInference(ens, sample);
console.log(`  15-model ensemble, 255      ${ms(ens255).padStart(11)}   ${(ens255 / 255).toFixed(4)} ms/file`);
console.log(`  15-model ensemble training  ${ms(ensTrain).padStart(11)}`);

// ── 4. Artifact size ─────────────────────────────────────────────────────────────────────

line("=");
console.log("4. MODEL ARTIFACT SIZE");
line();
for (const hidden of [128, 512, 4096]) {
  const entry = trainTimes.get(`${rows.length}/${hidden}`) ?? trainTimes.get(`255/${hidden}`);
  if (!entry) continue;
  let bytes = null;
  try {
    bytes = JSON.stringify(entry.model.elm.model ?? entry.model.elm).length;
  } catch {
    bytes = null;
  }
  const one = bytes === null ? "n/a" : `${(bytes / 1024).toFixed(0)} KB`;
  const fifteen = bytes === null ? "n/a" : `${((bytes * 15) / 1024 / 1024).toFixed(1)} MB`;
  console.log(`  hidden ${String(hidden).padStart(4)}   one model ${one.padStart(9)}   15-model ensemble ${fifteen.padStart(9)}`);
}
try {
  const b = statSync("packages/sourcevision/src/analyzers/classify-elm-baseline-model.json").size;
  console.log(`  shipped baseline artifact (old evidence representation): ${(b / 1024).toFixed(0)} KB`);
} catch { /* not present */ }

// ── 5. End to end ────────────────────────────────────────────────────────────────────────
// Cold: what one `ndx analyze` would actually pay to run the ELM stage over n-dx's residue.

line("=");
console.log("5. END TO END — n-dx's 255-file residue, cold start");
line();
const extract255 = ((readNs + vecNs) / rows.length) * 255;
const e2e = extract255 + ensTrain + ens255;
console.log(`  feature extraction (255 files)   ${ms(extract255).padStart(11)}`);
console.log(`  train 15-model ensemble          ${ms(ensTrain).padStart(11)}`);
console.log(`  inference (255 files x 15)       ${ms(ens255).padStart(11)}`);
console.log(`  ${"TOTAL".padEnd(32)} ${ms(e2e).padStart(11)}   (${(e2e / 1000).toFixed(2)} s)`);
console.log(`\n  Training dominates and is UNAVOIDABLE: the model is retrained every run by design`);
console.log(`  (no persisted per-project model). Extraction is the part that grows with repo size.`);

line("=");
console.log("COMPARISON BASELINE NOT MEASURED HERE");
line();
console.log("  The LLM side costs real money to time. Run elm-benchmark-llm.mjs for a measured");
console.log("  number. Do not estimate it -- the dominant term is process-spawn overhead");
console.log("  (22k-46k tokens of cache traffic per call), which is not guessable from prompt size.");
