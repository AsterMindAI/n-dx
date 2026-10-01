/**
 * TJ-E1 ensemble uncertainty — can disagreement tell the gate what softmax confidence cannot?
 *
 * THE PROBLEM THIS ATTACKS
 * ------------------------
 * `elm-gate-separability.mjs` measured that a single model's confidence does not predict its own
 * correctness (margin AUC 0.595, confidence AUC 0.551, and incorrect predictions were marginally
 * MORE confident than correct ones). The ELM-before-LLM gate depends on exactly that signal: it
 * keeps what it is sure about and sends the rest to an LLM. With an uninformative signal the
 * threshold rejects a near-random slice, so no tuning can make the gate safe.
 *
 * WHY AN ENSEMBLE IS THE NATURAL FIX HERE, AND CHEAP
 * --------------------------------------------------
 * An ELM's hidden layer is RANDOM and never trained -- only the output weights are solved. So two
 * ELMs with different seeds are genuinely different models, not two runs of the same one. Training
 * is a single ridge solve (milliseconds), so an N-model ensemble costs roughly N ridge solves and
 * no extra labelled data. Disagreement among independently-random projections is a real
 * uncertainty estimate, and it is usually far better calibrated than one model's softmax.
 *
 * SIGNALS COMPARED (all as "does this predict correctness", measured by AUC):
 *   voteShare      fraction of the ensemble voting for the winning label (1.0 = unanimous)
 *   voteEntropy    Shannon entropy of the vote distribution, negated (0 = unanimous)
 *   meanMargin     ensemble-averaged top1-top2 margin
 *   meanConfidence ensemble-averaged top1 probability
 *   [baselines]    single-model margin and confidence, the ones already measured
 *
 * TWO PROTOCOLS, reported separately and never mixed:
 *   A) Nolan's seed-42 hold-out (69 rows) -- comparable to every prior number in this project.
 *   B) 5-fold CV over all 255 n-dx rows -- a DIFFERENT protocol, reported only to get the
 *      standard error down, since 69 rows cannot separate AUC 0.50 from 0.65. Nolan's "do not
 *      re-split" rule is about coverage benchmarks being comparable; this is a calibration
 *      question and the protocol is labelled, not substituted.
 *
 * "Correct" = agrees with the LLM teacher, itself 72.3% vs human judgement.
 *
 * SETUP: see elm-generalisation-check.mjs's header for fetching the corpus.
 * Usage: node packages/sourcevision/scripts/elm-ensemble-uncertainty.mjs [ensembleSize]
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_SEED = 20260922;
const ENSEMBLE_SIZE = Number(process.argv[2] ?? 15);
const CORPUS = "scripts/data/elm-archetype-corpus-v3-classtargeted.json";
const REPO = "n-dx-1";

const { buildFeatureVector, readFileContentSafely, FEATURE_VERSION } = await import(
  "../dist/analyzers/classify-elm-features.js"
);
const { trainArchetypeELMNumeric } = await import("../dist/analyzers/classify-elm.js");

const corpus = JSON.parse(readFileSync(CORPUS, "utf-8"));
const root = resolve(".");

// Feature extraction reads files off disk; do it once and reuse everywhere.
const allRows = [...corpus.train, ...corpus.heldOut].filter((r) => r.repo === REPO);
const cache = new Map();
for (const r of allRows) {
  cache.set(r.text, buildFeatureVector({ path: r.text, content: readFileContentSafely(root, r.text) }));
}
const vec = (p) => cache.get(p);

function trainEnsemble(rows, size) {
  const models = [];
  for (let i = 0; i < size; i++) {
    const ex = rows.map((r) => ({ vector: vec(r.text), archetype: r.label }));
    const cats = [...new Set(ex.map((e) => e.archetype))].sort();
    models.push(trainArchetypeELMNumeric(ex, cats, BASE_SEED + i * 7919));
  }
  return models;
}

/** Score one row against the ensemble, returning the vote winner plus every uncertainty signal. */
function scoreRow(models, row) {
  const votes = new Map();
  let marginSum = 0;
  let confSum = 0;
  for (const m of models) {
    const top = m.elm.predictTopKFromVector(vec(row.text), 2);
    votes.set(top[0].label, (votes.get(top[0].label) ?? 0) + 1);
    marginSum += top.length > 1 ? top[0].prob - top[1].prob : top[0].prob;
    confSum += top[0].prob;
  }
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const [winner, winnerVotes] = ranked[0];
  const n = models.length;
  let entropy = 0;
  for (const [, c] of votes) {
    const p = c / n;
    entropy -= p * Math.log2(p);
  }
  // Single-model baselines come from the FIRST ensemble member, so they are the same model
  // family the ensemble is built from -- an honest like-for-like comparison.
  const solo = models[0].elm.predictTopKFromVector(vec(row.text), 2);
  return {
    correct: winner === row.label,
    soloCorrect: solo[0].label === row.label,
    voteShare: winnerVotes / n,
    voteEntropy: -entropy, // negate so "higher = more certain" for every signal
    meanMargin: marginSum / n,
    meanConfidence: confSum / n,
    soloMargin: solo.length > 1 ? solo[0].prob - solo[1].prob : solo[0].prob,
    soloConfidence: solo[0].prob,
  };
}

/** AUC via the Mann-Whitney U identity. `correctKey` picks which correctness column to use. */
function auc(items, key, correctKey = "correct") {
  const pos = items.filter((s) => s[correctKey]).map((s) => s[key]);
  const neg = items.filter((s) => !s[correctKey]).map((s) => s[key]);
  if (!pos.length || !neg.length) return null;
  let wins = 0;
  for (const p of pos) for (const n of neg) wins += p > n ? 1 : p === n ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}

function seededShuffle(arr, seed) {
  let s = seed >>> 0;
  const next = () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SIGNALS = ["voteShare", "voteEntropy", "meanMargin", "meanConfidence"];

function report(title, scored, note) {
  const nPos = scored.filter((s) => s.correct).length;
  const soloPos = scored.filter((s) => s.soloCorrect).length;
  console.log("\n" + "=".repeat(86));
  console.log(title);
  console.log("=".repeat(86));
  if (note) console.log(note);
  console.log(`rows                   ${scored.length}`);
  console.log(`ensemble precision     ${(100 * nPos / scored.length).toFixed(1)}%   (majority vote of ${ENSEMBLE_SIZE})`);
  console.log(`single-model precision ${(100 * soloPos / scored.length).toFixed(1)}%   (one member, for reference)`);
  const se = 1 / (2 * Math.sqrt(Math.min(nPos, scored.length - nPos)));
  console.log(`AUC standard error     ~+/-${se.toFixed(2)}`);

  console.log(`\n${"signal".padEnd(18)} ${"AUC".padStart(6)}   verdict`);
  console.log("-".repeat(86));
  const rows = [];
  for (const k of SIGNALS) {
    const a = auc(scored, k);
    rows.push([k, a]);
  }
  rows.push(["soloMargin", auc(scored, "soloMargin", "soloCorrect")]);
  rows.push(["soloConfidence", auc(scored, "soloConfidence", "soloCorrect")]);
  for (const [k, a] of rows) {
    if (a === null) continue;
    const v = a >= 0.7 ? "informative" : a >= 0.6 ? "weak" : "≈ noise";
    const bar = "#".repeat(Math.max(0, Math.round((a - 0.5) * 100)));
    const tag = k.startsWith("solo") ? " (baseline)" : "";
    console.log(`${(k + tag).padEnd(18)} ${a.toFixed(3).padStart(6)}   ${v.padEnd(12)} ${bar}`);
  }
  return rows;
}

// ── Protocol A: Nolan's seed-42 hold-out ─────────────────────────────────────────────────

const trainRows = corpus.train.filter((r) => r.repo === REPO);
const testRows = corpus.heldOut.filter((r) => r.repo === REPO);
const modelsA = trainEnsemble(trainRows, ENSEMBLE_SIZE);
const scoredA = testRows.map((r) => scoreRow(modelsA, r));

console.log("=".repeat(86));
console.log(`TJ-E1 ensemble uncertainty   ensemble=${ENSEMBLE_SIZE}   baseSeed=${BASE_SEED}   layout v${FEATURE_VERSION}`);
console.log("=".repeat(86));
console.log(`Testing whether ensemble DISAGREEMENT predicts correctness where softmax confidence`);
console.log(`does not. Baseline to beat: solo margin AUC 0.595, solo confidence AUC 0.551.`);

report("PROTOCOL A — Nolan seed-42 hold-out (comparable to prior numbers)", scoredA);

// ── Protocol B: 5-fold CV for statistical power ──────────────────────────────────────────

const FOLDS = 5;
const shuffled = seededShuffle(allRows, BASE_SEED);
const scoredB = [];
for (let f = 0; f < FOLDS; f++) {
  const test = shuffled.filter((_, i) => i % FOLDS === f);
  const train = shuffled.filter((_, i) => i % FOLDS !== f);
  const models = trainEnsemble(train, ENSEMBLE_SIZE);
  for (const r of test) scoredB.push(scoreRow(models, r));
}

const rowsB = report(
  "PROTOCOL B — 5-fold CV over all n-dx rows (different protocol, for power only)",
  scoredB,
  "NOT comparable to Nolan's benchmarks. Reported because 69 rows cannot separate 0.50 from 0.65.\n",
);

// ── Verdict ──────────────────────────────────────────────────────────────────────────────

const bestEnsemble = rowsB.filter(([k]) => !k.startsWith("solo")).reduce((a, b) => (b[1] > a[1] ? b : a));
const bestSolo = rowsB.filter(([k]) => k.startsWith("solo")).reduce((a, b) => (b[1] > a[1] ? b : a));
const gain = bestEnsemble[1] - bestSolo[1];

console.log("\n" + "=".repeat(86));
console.log("VERDICT (on protocol B, the higher-powered one)");
console.log("=".repeat(86));
console.log(`best ensemble signal   ${bestEnsemble[0]} AUC ${bestEnsemble[1].toFixed(3)}`);
console.log(`best single-model      ${bestSolo[0]} AUC ${bestSolo[1].toFixed(3)}`);
console.log(`gain from ensembling   ${gain >= 0 ? "+" : ""}${gain.toFixed(3)} AUC`);
console.log("");
if (bestEnsemble[1] >= 0.7) {
  console.log("=> The gate architecture is VIABLE. Disagreement is informative enough to route");
  console.log("   uncertain files to the LLM as designed. Next: re-run the savings curve using");
  console.log("   this signal instead of softmax confidence, and find the operating point.");
} else if (bestEnsemble[1] >= 0.62) {
  console.log("=> MARGINAL. Better than a single model, still well short of what a safe gate");
  console.log("   needs. Worth one more push (larger ensemble, better features) but not worth");
  console.log("   shipping on.");
} else {
  console.log("=> Ensembling does NOT rescue the gate. Disagreement is no more informative than");
  console.log("   softmax confidence was. The models fail together rather than independently,");
  console.log("   which points at the REPRESENTATION being the limit, not the uncertainty");
  console.log("   estimate -- the files it gets wrong are genuinely ambiguous given what the");
  console.log("   model can see, so every random projection agrees on the same wrong answer.");
}

// ── The gate, priced with the best available signal ──────────────────────────────────────
//
// No extrapolation needed here: n-dx's residue measured by Nolan is 255 files
// (elm-calls-avoided.json, byLLM: 255) and protocol B evaluates exactly those 255 rows. So
// coverage maps 1:1 onto the real population and the call arithmetic is direct, not estimated.

const LLM_BATCH_SIZE = 30;
const TOK_LOW = 22_000;
const TOK_HIGH = 46_000;
const calls = (n) => Math.ceil(n / LLM_BATCH_SIZE);
const baseCalls = calls(scoredB.length);

console.log("\n" + "=".repeat(86));
console.log("THE GATE, PRICED — voteShare threshold, protocol B (all 255 residue files)");
console.log("=".repeat(86));
console.log(`"at least N of ${ENSEMBLE_SIZE} models agreed" -> keep the ELM answer, else send to the LLM.`);
console.log(`${scoredB.length} residue files = ${baseCalls} LLM calls today at batch ${LLM_BATCH_SIZE}.\n`);
console.log(
  `${"agree".padStart(7)} ${"coverage".padStart(9)} ${"precision".padStart(10)} ${"changed".padStart(8)} ` +
    `${"calls".padStart(6)} ${"saved".padStart(6)} ${"tokens".padStart(14)}`,
);
console.log("-".repeat(86));
for (let k = 2; k <= ENSEMBLE_SIZE; k++) {
  const thresh = k / ENSEMBLE_SIZE;
  const kept = scoredB.filter((s) => s.voteShare >= thresh);
  if (!kept.length) continue;
  const prec = kept.filter((s) => s.correct).length / kept.length;
  const left = scoredB.length - kept.length;
  const saved = baseCalls - calls(left);
  const changed = Math.round(kept.length * (1 - prec));
  const tok = saved === 0 ? "none" : `${((saved * TOK_LOW) / 1000).toFixed(0)}k-${((saved * TOK_HIGH) / 1000).toFixed(0)}k`;
  console.log(
    `${`${k}/${ENSEMBLE_SIZE}`.padStart(7)} ${(100 * kept.length / scoredB.length).toFixed(1).padStart(8)}% ` +
      `${(100 * prec).toFixed(1).padStart(9)}% ${String(changed).padStart(8)} ${String(calls(left)).padStart(6)} ` +
      `${String(saved).padStart(6)} ${tok.padStart(14)}`,
  );
}
console.log("-".repeat(86));
console.log("Unanimity is the strictest gate available. If precision there is still far below the");
console.log("LLM it replaces, the gate has no safe operating point -- not at any threshold, since");
console.log("there is no stricter one to reach for.");
