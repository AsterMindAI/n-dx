#!/usr/bin/env node
/**
 * Phase 1 remainder — architecture and regularisation sweep.
 *
 * Implements the PRE-REGISTERED bar in
 * Claude-Context/IMPL/IMPL-2026-08-28-jam-elm-tier-implementation.md
 * § "Phase 1 pre-registration", committed at f4a06175 BEFORE this file existed.
 * The constants in ADOPTION and the CONFIGS list are a RECORD, NOT A KNOB.
 * If you edit either after a run, the run is void.
 *
 * ── What this measures ────────────────────────────────────────────────────
 * 5-fold CV accuracy against LLM labels on the TRAIN split ONLY — 241 rows for
 * corpus v1 (Phase 1), 464 for corpus v2 (Phase 1b/1c, via --corpus).
 * The held-out split and gold set #1 are never read by this file —
 * grep it: `corpus.heldOut` does not appear. Model selection that touches
 * either would be tuning toward the test set, which is the error this project
 * has already corrected twice.
 *
 * ── Why paired ────────────────────────────────────────────────────────────
 * Every configuration sees the IDENTICAL 9 (fold-seed, model-seed) pairs and
 * identical fold assignments, so the incumbent-vs-challenger comparison is
 * paired. The adoption rule needs both a mean margin and a sign test, because
 * seed-to-seed spread on this corpus is ~16 pp and a single lucky fold can
 * otherwise carry a mean.
 *
 * ⚠️ elm-diagnostics.mjs varies its `seed` argument over FOLDS but constructs
 * every ELM with a hard-coded `seed: 42`, so it never sampled model randomness
 * at all. This file varies both, independently.
 *
 * Usage: node scripts/elm-architecture-sweep.mjs [--only=<substring>] [--quick]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { ELM, KernelELM, TFIDFVectorizer, VotingClassifierELM, tokenize } from "@astermind/astermind-community";

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const CORPUS = arg("corpus", "scripts/data/elm-archetype-corpus.json");
const OUT = arg("out", process.argv.includes("--phase1c")
  ? "scripts/data/elm-architecture-sweep-v2-capacity.json"
  : CORPUS.includes("-v2") ? "scripts/data/elm-architecture-sweep-v2.json" : "scripts/data/elm-architecture-sweep.json");

/** Pre-registered at f4a06175. A record, not a knob. */
const ADOPTION = { meanMarginPp: 1.5, minPairedWins: 7, totalPairs: 9 };
const FOLD_SEEDS = [7, 13, 29];
const MODEL_SEEDS = [101, 202, 303];
const FOLDS = 5;

const docOf = (p) => tokenize(p).join(" ");
const oneHot = (label, cats) => cats.map((c) => (c === label ? 1 : 0));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const pct = (x) => `${(x * 100).toFixed(1)}%`;

/**
 * ⚠️ TRAP (2026-08-27). ELM.trainFromData(X, y) accepts STRING labels without
 * error and silently trains nothing — every prediction collapses to one class.
 * That produced 2.4% agreement and would have shipped as "Path B is not viable".
 * A broken harness and a genuine negative look identical in a results table, so
 * this runs before any number is reported and throws rather than warning.
 */
function assertHarnessCanLearn() {
  const cats = ["a", "b"];
  const X = [[1, 0], [1, 0], [1, 0], [0, 1], [0, 1], [0, 1]];
  const Y = ["a", "a", "a", "b", "b", "b"].map((l) => oneHot(l, cats));
  const elm = new ELM({ categories: cats, hiddenUnits: 16, activation: "relu", seed: 1, log: { modelName: "sanity", verbose: false } });
  elm.trainFromData(X, Y);
  const a = elm.predictFromVector([[1, 0]], 1)[0][0].label;
  const b = elm.predictFromVector([[0, 1]], 1)[0][0].label;
  if (a !== "a" || b !== "b") {
    throw new Error(`HARNESS SANITY CHECK FAILED: separable 2-class problem gave [${a}, ${b}]. Any number from this run is meaningless.`);
  }
}

/**
 * The same guard for KernelELM. Added because the pre-registered RBF arm scores
 * badly and a bad score has two explanations — a bad model or a bad harness.
 * KernelELM returns correct labels on a separable 2-class problem in all six
 * (kernel x mode) combinations, so a kernel negative below is about the model.
 *
 * ⚠️ What this does NOT rule out is a degenerate KERNEL. RBF's gamma defaults to
 * 1/D = 5.9e-4 while mean ||x-z||^2 on this TF-IDF space is 1.86, so the default
 * kernel is exp(-0.0011) ~ 0.999 for EVERY pair — an all-ones Gram matrix. The
 * default-gamma arms are reported but marked confounded; see the gamma arm.
 */
function assertKernelHarnessCanLearn() {
  const X = [[1, 0], [1, 0], [0.9, 0.1], [0, 1], [0, 1], [0.1, 0.9]];
  const Y = [[1, 0], [1, 0], [1, 0], [0, 1], [0, 1], [0, 1]];
  for (const kernel of [{ type: "rbf", gamma: 1 }, { type: "linear" }]) {
    for (const mode of ["exact", "nystrom"]) {
      const k = new KernelELM({ outputDim: 2, kernel, task: "classification", mode, nystrom: { m: 4, strategy: "kmeans++", seed: 1 }, log: { verbose: false } });
      k.fit(X, Y);
      const p = k.predictTopKFromVectors([[1, 0], [0, 1]], 1).map((t) => t[0].index);
      if (p[0] !== 0 || p[1] !== 1) {
        throw new Error(`KERNEL HARNESS SANITY CHECK FAILED for ${kernel.type}/${mode}: got [${p}], expected [0, 1].`);
      }
    }
  }
}

/** Deterministic LCG — same generator elm-diagnostics.mjs uses, so folds are comparable. */
function shuffledIndices(n, seed) {
  let rng = seed;
  const rnd = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff; };
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}

/**
 * TF-IDF is refit per (foldSeed, fold, vocabCap) on the TRAIN rows of that fold only.
 *
 * ⚠️ The cache is bounded to ONE vocabCap at a time. Unbounded, it accumulates
 * 3 fold-seeds x 5 folds x 3 caps = 45 dense 193x1688 matrices; as nested JS
 * arrays that is enough to exhaust an 8 GB machine, and the first full run of
 * this sweep was OOM-killed on the voting config with no error and no verdict —
 * an empty results table that looks exactly like a crash-free early exit.
 */
const vecCache = new Map();
let vecCacheCap = null;
function vectorsFor(rows, trIdx, teIdx, key, vocabCap) {
  if (vecCacheCap !== vocabCap) { vecCache.clear(); vecCacheCap = vocabCap; }
  const cached = vecCache.get(key);
  if (cached) return cached;
  const v = new TFIDFVectorizer(trIdx.map((i) => docOf(rows[i].text)), vocabCap);
  const out = { Xtr: v.vectorizeAll(), Xte: teIdx.map((i) => v.vectorize(docOf(rows[i].text))) };
  vecCache.set(key, out);
  return out;
}

// ── Model adapters. Each returns predicted labels for Xte. ─────────────────

function fitPlainELM(cfg, cats, Xtr, Ytr, Xte, modelSeed) {
  const elm = new ELM({
    categories: cats,
    hiddenUnits: cfg.hidden ?? 1024,
    activation: cfg.activation ?? "relu",
    ridgeLambda: cfg.ridgeLambda ?? 1e-2,
    seed: modelSeed,
    log: { modelName: "sweep", verbose: false },
  });
  elm.trainFromData(Xtr, Ytr);
  return Xte.map((x) => elm.predictFromVector([x], 1)[0][0].label);
}

function fitKernelELM(cfg, cats, Xtr, Ytr, Xte, modelSeed) {
  const k = new KernelELM({
    outputDim: cats.length,
    kernel: cfg.gamma === undefined ? { type: cfg.kernel } : { type: cfg.kernel, gamma: cfg.gamma },
    ridgeLambda: cfg.ridgeLambda ?? 1e-2,
    task: "classification",
    mode: cfg.mode ?? "nystrom",
    // Landmarks are the ONLY randomness in a KernelELM. In exact mode the fit is
    // deterministic, so its 9 "paired runs" collapse to 3 distinct fits — reported
    // rather than hidden, because a zero-width range is a property of the model,
    // not evidence of stability.
    nystrom: { m: cfg.m ?? 128, strategy: "kmeans++", seed: modelSeed },
    log: { modelName: "sweep-k", verbose: false },
  });
  k.fit(Xtr, Ytr);
  return k.predictTopKFromVectors(Xte, 1).map((top) => cats[top[0].index]);
}

/**
 * Stacked voting. The meta-learner is trained on OUT-OF-FOLD base predictions
 * (inner 3-fold), not on the base models' own training predictions — otherwise
 * it learns from predictions the base models have already memorised and the
 * whole ensemble scores its own homework.
 */
function fitVotingELM(cfg, cats, Xtr, Ytr, Xte, modelSeed, ytrLabels) {
  const nBase = cfg.nBase ?? 5;
  const baseSeeds = Array.from({ length: nBase }, (_, i) => modelSeed * 1000 + i);
  const mk = (seed) => new ELM({
    categories: cats, hiddenUnits: cfg.hidden ?? 1024, activation: "relu",
    ridgeLambda: cfg.ridgeLambda ?? 1e-2, seed, log: { modelName: "sweep-v", verbose: false },
  });

  const INNER = 3;
  const innerIdx = shuffledIndices(Xtr.length, modelSeed);
  const oofPred = Array.from({ length: nBase }, () => new Array(Xtr.length));
  const oofConf = Array.from({ length: nBase }, () => new Array(Xtr.length));
  for (let f = 0; f < INNER; f++) {
    const te = innerIdx.filter((_, k) => k % INNER === f);
    const tr = innerIdx.filter((_, k) => k % INNER !== f);
    baseSeeds.forEach((s, m) => {
      const e = mk(s);
      e.trainFromData(tr.map((i) => Xtr[i]), tr.map((i) => Ytr[i]));
      for (const i of te) {
        const p = e.predictFromVector([Xtr[i]], 1)[0][0];
        oofPred[m][i] = p.label; oofConf[m][i] = p.prob;
      }
    });
  }

  const voter = new VotingClassifierELM({
    categories: cats, hiddenUnits: cfg.metaHidden ?? 128, activation: "relu",
    seed: modelSeed, log: { modelName: "voter", verbose: false },
  });
  voter.train(oofPred, oofConf, ytrLabels);

  // Predict per base model and discard it, rather than holding five 1688x1024
  // weight matrices live at once — that is what pushed the first run into swap.
  const labelsByModel = [], confByModel = [];
  for (const s of baseSeeds) {
    const e = mk(s);
    e.trainFromData(Xtr, Ytr);
    const tops = Xte.map((x) => e.predictFromVector([x], 1)[0][0]);
    labelsByModel.push(tops.map((t) => t.label));
    confByModel.push(tops.map((t) => t.prob));
  }
  return Xte.map((_, j) =>
    voter.predict(labelsByModel.map((l) => l[j]), confByModel.map((c) => c[j]), 1)[0].label);
}

const FITTERS = { elm: fitPlainELM, kernel: fitKernelELM, voting: fitVotingELM };

/** One 5-fold CV pass for one config at one (foldSeed, modelSeed) pair. */
function cvAccuracy(rows, cfg, foldSeed, modelSeed) {
  const cats = [...new Set(rows.map((r) => r.label))];
  const idx = shuffledIndices(rows.length, foldSeed);
  const cap = cfg.vocabCap ?? 4000;
  let hits = 0, total = 0;
  for (let f = 0; f < FOLDS; f++) {
    const teIdx = idx.filter((_, k) => k % FOLDS === f);
    const trIdx = idx.filter((_, k) => k % FOLDS !== f);
    const { Xtr, Xte } = vectorsFor(rows, trIdx, teIdx, `${foldSeed}:${f}:${cap}`, cap);
    const ytrLabels = trIdx.map((i) => rows[i].label);
    const Ytr = ytrLabels.map((l) => oneHot(l, cats));
    const pred = FITTERS[cfg.kind](cfg, cats, Xtr, Ytr, Xte, modelSeed, ytrLabels);
    teIdx.forEach((i, j) => { if (pred[j] === rows[i].label) hits++; total++; });
  }
  return hits / total;
}

/**
 * The configuration set, fixed and CLOSED at f4a06175. Adding an entry after a
 * run has been seen is how a sweep turns into a search for a flattering cell.
 */
const CONFIGS = [
  { name: "INCUMBENT elm-1024 relu λ1e-2 v4000", kind: "elm", incumbent: true },

  { name: "elm-1024 λ1e-4", kind: "elm", ridgeLambda: 1e-4 },
  { name: "elm-1024 λ1e-3", kind: "elm", ridgeLambda: 1e-3 },
  { name: "elm-1024 λ1e-1", kind: "elm", ridgeLambda: 1e-1 },
  { name: "elm-1024 λ1e+0", kind: "elm", ridgeLambda: 1e0 },

  { name: "elm-1024 tanh", kind: "elm", activation: "tanh" },
  { name: "elm-1024 gelu", kind: "elm", activation: "gelu" },

  { name: "elm-1024 vocab1000", kind: "elm", vocabCap: 1000 },
  { name: "elm-1024 vocab2000", kind: "elm", vocabCap: 2000 },

  { name: "kelm rbf nystrom m64 λ1e-3", kind: "kernel", kernel: "rbf", m: 64, ridgeLambda: 1e-3 },
  { name: "kelm rbf nystrom m64 λ1e-2", kind: "kernel", kernel: "rbf", m: 64, ridgeLambda: 1e-2 },
  { name: "kelm rbf nystrom m64 λ1e-1", kind: "kernel", kernel: "rbf", m: 64, ridgeLambda: 1e-1 },
  { name: "kelm rbf nystrom m128 λ1e-3", kind: "kernel", kernel: "rbf", m: 128, ridgeLambda: 1e-3 },
  { name: "kelm rbf nystrom m128 λ1e-2", kind: "kernel", kernel: "rbf", m: 128, ridgeLambda: 1e-2 },
  { name: "kelm rbf nystrom m128 λ1e-1", kind: "kernel", kernel: "rbf", m: 128, ridgeLambda: 1e-1 },
  { name: "kelm linear nystrom m128 λ1e-3", kind: "kernel", kernel: "linear", m: 128, ridgeLambda: 1e-3 },
  { name: "kelm linear nystrom m128 λ1e-2", kind: "kernel", kernel: "linear", m: 128, ridgeLambda: 1e-2 },
  { name: "kelm linear nystrom m128 λ1e-1", kind: "kernel", kernel: "linear", m: 128, ridgeLambda: 1e-1 },
  { name: "kelm rbf EXACT λ1e-2", kind: "kernel", kernel: "rbf", mode: "exact", ridgeLambda: 1e-2 },
  { name: "kelm rbf EXACT λ1e-1", kind: "kernel", kernel: "rbf", mode: "exact", ridgeLambda: 1e-1 },

  // Declared addendum, committed before the sweep ran. Added because the default
  // gamma is degenerate on this feature space (a property of the data, measured
  // without reference to any accuracy), NOT because the default arm scored badly.
  { name: "kelm rbf γ0.5 m128 λ1e-2", kind: "kernel", kernel: "rbf", gamma: 0.5, m: 128, ridgeLambda: 1e-2 },
  { name: "kelm rbf γ1 m128 λ1e-2", kind: "kernel", kernel: "rbf", gamma: 1, m: 128, ridgeLambda: 1e-2 },
  { name: "kelm rbf γ2 m128 λ1e-2", kind: "kernel", kernel: "rbf", gamma: 2, m: 128, ridgeLambda: 1e-2 },
  { name: "kelm rbf γ4 m128 λ1e-2", kind: "kernel", kernel: "rbf", gamma: 4, m: 128, ridgeLambda: 1e-2 },
  { name: "kelm rbf γ0.5 m128 λ1e-1", kind: "kernel", kernel: "rbf", gamma: 0.5, m: 128, ridgeLambda: 1e-1 },
  { name: "kelm rbf γ1 m128 λ1e-1", kind: "kernel", kernel: "rbf", gamma: 1, m: 128, ridgeLambda: 1e-1 },
  { name: "kelm rbf γ2 m128 λ1e-1", kind: "kernel", kernel: "rbf", gamma: 2, m: 128, ridgeLambda: 1e-1 },
  { name: "kelm rbf γ4 m128 λ1e-1", kind: "kernel", kernel: "rbf", gamma: 4, m: 128, ridgeLambda: 1e-1 },

  { name: "voting 5x elm-1024 (stacked, OOF)", kind: "voting" },
];

/**
 * Phase 1b grid — corpus v2 (624 rows, 7 ecosystems). Declared and committed
 * before this ran, per the Phase 1b pre-registration.
 *
 * Capacity is re-opened ONLY because the corpus roughly doubled: the 1024
 * plateau was measured on 241 rows, so leaving it pinned would be assuming
 * rather than measuring. Everything else Phase 1 settled stays settled --
 * ridgeLambda, voting, RBF and feature engineering are not re-litigated.
 *
 * Incumbent is Phase 1's winner. Adoption rule is unchanged: mean +1.5 pp AND
 * >= 7 of 9 paired wins.
 */
const PHASE1B_CONFIGS = [
  { name: "INCUMBENT elm-1024 tanh (phase 1 winner)", kind: "elm", activation: "tanh", hidden: 1024, incumbent: true },
  { name: "elm-512 tanh", kind: "elm", activation: "tanh", hidden: 512 },
  { name: "elm-2048 tanh", kind: "elm", activation: "tanh", hidden: 2048 },
  { name: "elm-4096 tanh", kind: "elm", activation: "tanh", hidden: 4096 },
  { name: "elm-512 gelu", kind: "elm", activation: "gelu", hidden: 512 },
  { name: "elm-1024 gelu", kind: "elm", activation: "gelu", hidden: 1024 },
  { name: "elm-2048 gelu", kind: "elm", activation: "gelu", hidden: 2048 },
  { name: "elm-1024 relu", kind: "elm", activation: "relu", hidden: 1024 },
  { name: "elm-2048 relu", kind: "elm", activation: "relu", hidden: 2048 },
];

/**
 * Phase 1c grid — the capacity extension. Declared and committed BEFORE the run.
 *
 * ── Why this arm exists ───────────────────────────────────────────────────
 * Phase 1b adopted `elm-4096 tanh` (+2.06 pp, 7 of 9). 4096 was the TOP EDGE of
 * that grid, so the win is not evidence of a plateau — it is evidence that the
 * grid stopped too early. Phase 1's 1024 plateau was measured on 241 rows; the
 * corpus is now 624. Leaving capacity pinned at a boundary value would be the
 * `hiddenUnits: 256` mistake in its third incarnation: a number nobody chose,
 * carried forward because no one re-opened it.
 *
 * ── The stopping rule, fixed here so it cannot be chosen afterwards ────────
 * Capacity is a one-dimensional sweep with an obvious failure mode: crawl the
 * grid upward until something wins by chance. So:
 *
 *   If 8192 does NOT clear the adoption bar, capacity is CLOSED at 4096 and
 *   16384 is not run. A non-winning 8192 is a plateau result, not an invitation.
 *
 *   If 8192 DOES clear it, capacity is still closed for this phase — the tier
 *   ships at 8192 and any further extension needs its own pre-registration and
 *   a stated reason beyond "the last one won."
 *
 * Either way this is the last capacity arm run against corpus v2. Recorded now,
 * before the numbers exist, because that is the only time the rule is credible.
 *
 * ── Activation ────────────────────────────────────────────────────────────
 * `tanh` only. It has now beaten `relu` at equal capacity on 3 of 3 comparisons
 * and beaten or tied `gelu` throughout, so this arm tests ONE variable. `gelu`
 * at 8192 is included solely as a tie-breaker guard: if tanh's lead came from
 * capacity interacting with the activation, that shows up as gelu closing the
 * gap, and it is better to see it than to assume it away.
 *
 * ⚠️ MEMORY. At 8192 units and a 2411-term vocabulary, W is ~158 MB per model
 * and the sweep holds several at once, on an 8 GB box that already carries
 * ~4.5 GB of swap. A Phase 1 sweep was OOM-killed on this machine and EXITED 0
 * WITH AN EMPTY TABLE — indistinguishable from a clean run. Run this arm alone,
 * and verify the results table is populated rather than trusting the exit code.
 */
const PHASE1C_CONFIGS = [
  { name: "INCUMBENT elm-4096 tanh (phase 1b winner)", kind: "elm", activation: "tanh", hidden: 4096, incumbent: true },
  { name: "elm-8192 tanh", kind: "elm", activation: "tanh", hidden: 8192 },
  { name: "elm-8192 gelu", kind: "elm", activation: "gelu", hidden: 8192 },
];

function main() {
  const phase1b = process.argv.includes("--phase1b");
  const phase1c = process.argv.includes("--phase1c");
  const only = (process.argv.find((a) => a.startsWith("--only=")) ?? "").slice(7);
  const quick = process.argv.includes("--quick");
  const foldSeeds = quick ? FOLD_SEEDS.slice(0, 1) : FOLD_SEEDS;
  const modelSeeds = quick ? MODEL_SEEDS.slice(0, 1) : MODEL_SEEDS;

  assertHarnessCanLearn();
  assertKernelHarnessCanLearn();

  const corpus = JSON.parse(readFileSync(CORPUS, "utf-8"));
  const rows = corpus.train; // heldOut is deliberately not read anywhere in this file.
  const pairs = foldSeeds.flatMap((fs) => modelSeeds.map((ms) => [fs, ms]));

  console.log("ELM architecture + regularisation sweep — Phase 1 remainder");
  console.log(`  corpus ${CORPUS} — TRAIN split only, ${rows.length} rows, ${new Set(rows.map((r) => r.label)).size} classes`);
  console.log(`  ${FOLDS}-fold CV vs LLM labels · ${pairs.length} paired runs (fold-seeds ${foldSeeds} x model-seeds ${modelSeeds})`);
  console.log(`  PRE-REGISTERED adoption (f4a06175): mean >= incumbent + ${ADOPTION.meanMarginPp} pp AND >= ${ADOPTION.minPairedWins} of ${ADOPTION.totalPairs} paired wins`);
  console.log("  held-out split and gold set #1 are NOT read by this script\n");

  const grid = phase1c ? PHASE1C_CONFIGS : phase1b ? PHASE1B_CONFIGS : CONFIGS;
  const configs = grid.filter((c) => c.incumbent || !only || c.name.includes(only));
  const results = [];
  for (const cfg of configs) {
    const t0 = Date.now();
    const runs = pairs.map(([fs, ms]) => cvAccuracy(rows, cfg, fs, ms));
    const r = { name: cfg.name, kind: cfg.kind, incumbent: !!cfg.incumbent, confounded: cfg.kind === "kernel" && cfg.kernel === "rbf" && cfg.gamma === undefined ? "default gamma 1/D makes the Gram matrix all-ones on this feature space" : undefined, runs, mean: mean(runs), min: Math.min(...runs), max: Math.max(...runs), seconds: (Date.now() - t0) / 1000 };
    results.push(r);
    console.log(`  ${r.name.padEnd(34)} ${pct(r.mean)}  range ${pct(r.min)}–${pct(r.max)}   (${r.seconds.toFixed(1)}s)`);
  }

  const inc = results.find((r) => r.incumbent);
  console.log(`\n  incumbent: ${inc.name} @ ${pct(inc.mean)}\n`);
  console.log("  challenger                          mean     delta    paired wins   adopted?");
  const verdicts = [];
  for (const r of results) {
    if (r.incumbent) continue;
    const deltaPp = (r.mean - inc.mean) * 100;
    const wins = r.runs.filter((v, i) => v > inc.runs[i]).length;
    const adopted = deltaPp >= ADOPTION.meanMarginPp && wins >= ADOPTION.minPairedWins;
    verdicts.push({ name: r.name, mean: r.mean, deltaPp, pairedWins: wins, of: r.runs.length, adopted });
    console.log(`  ${r.name.padEnd(34)} ${pct(r.mean).padStart(6)}  ${(deltaPp >= 0 ? "+" : "")}${deltaPp.toFixed(1)} pp   ${String(wins).padStart(2)} of ${r.runs.length}      ${adopted ? "ADOPT" : "no"}`);
  }

  const winners = verdicts.filter((v) => v.adopted);
  const verdict = winners.length
    ? `ADOPT: ${winners.map((w) => w.name).join(", ")}`
    : "NO CHANGE — architecture and regularisation are not levers either. Incumbent frozen for Phase 2.";
  console.log(`\n  VERDICT: ${verdict}\n`);

  writeFileSync(OUT, JSON.stringify({
    schema: "elm-architecture-sweep/v1",
    generatedAt: new Date().toISOString(),
    generatedBy: "scripts/elm-architecture-sweep.mjs",
    preRegistered: { committedAt: "f4a06175", adoption: ADOPTION, foldSeeds: FOLD_SEEDS, modelSeeds: MODEL_SEEDS, folds: FOLDS, note: "Fixed before this script existed. Editing these voids the run." },
    method: {
      split: "TRAIN only (corpus.train); heldOut and gold set #1 not read",
      metric: "5-fold CV accuracy vs LLM labels — agreement with the teacher, NOT accuracy vs truth",
      feature: "path string only; library tokenize() + TF-IDF fitted per fold on that fold's train rows",
      paired: true,
    },
    corpusProvenance: corpus.provenance ?? null,
    incumbent: inc,
    results,
    verdicts,
    verdict,
  }, null, 2) + "\n");
  console.log(`  wrote ${OUT}`);
}

main();
