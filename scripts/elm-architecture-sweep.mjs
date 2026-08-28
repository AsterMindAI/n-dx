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
 * 5-fold CV accuracy against LLM labels on the 241-row TRAIN split ONLY.
 * The 83-row held-out split and gold set #1 are never read by this file —
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

const CORPUS = "scripts/data/elm-archetype-corpus.json";
const OUT = "scripts/data/elm-architecture-sweep.json";

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

/** TF-IDF is refit per (foldSeed, fold, vocabCap) on the TRAIN rows of that fold only. */
const vecCache = new Map();
function vectorsFor(rows, trIdx, teIdx, key, vocabCap) {
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

  const full = baseSeeds.map((s) => { const e = mk(s); e.trainFromData(Xtr, Ytr); return e; });
  return Xte.map((x) => {
    const tops = full.map((e) => e.predictFromVector([x], 1)[0][0]);
    return voter.predict(tops.map((t) => t.label), tops.map((t) => t.prob), 1)[0].label;
  });
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

function main() {
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

  const configs = CONFIGS.filter((c) => c.incumbent || !only || c.name.includes(only));
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
