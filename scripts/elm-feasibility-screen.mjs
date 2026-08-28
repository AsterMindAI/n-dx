#!/usr/bin/env node
/**
 * Step 3 feasibility screen — can an ELM reproduce the teacher at all?
 *
 * Implements the PRE-REGISTERED bar in
 * Claude-Context/IMPL/IMPL-2026-08-13-jam-elm-classification-build.md § Step 3,
 * committed at f3205143 BEFORE this script was run. Do not edit the thresholds
 * here; they are a record, not a knob.
 *
 * ── What this measures, and what it does NOT ──────────────────────────────
 * PRIMARY: agreement-with-teacher on the held-out split. This is NOT accuracy.
 * The teacher (the LLM that labelled the corpus) is known inconsistent on the
 * service/utility boundary, which is 74% of the mass — that is TN-J10, still
 * unresolved. A model can agree with a wrong teacher.
 *
 * The screen exists because infeasibility is establishable without a gold set:
 * a model that cannot learn the mapping does not become useful if the mapping
 * is later corrected. Butter's argument, accepted.
 *
 * ── Method ───────────────────────────────────────────────────────────────
 * Feature: the path string only. Established in Step 0 — all unclassified
 * files have zero signal evidence, so the path is the only thing available.
 * Tokenised with the library's own tokenize(), TF-IDF fitted on TRAIN ONLY
 * (held-out uses the train vocabulary; no leakage).
 *
 * ELM hidden weights are random but SEEDED — cfg.seed defaults to 1337, so
 * repeats that do not vary the seed are byte-identical copies, not independent
 * samples. This script passes seed = 42 + i explicitly. A single run is a
 * sample, not a result; mean and full range across seeds are both reported.
 *
 * Usage: node scripts/elm-feasibility-screen.mjs [--repeats=N] [--hidden=N]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { ELM, TFIDFVectorizer, tokenize } from "@astermind/astermind-community";

const CORPUS = "scripts/data/elm-archetype-corpus.json";
const OUT = "scripts/data/elm-feasibility-screen.json";

/** Pre-registered in IMPL § Step 3 at f3205143, before any model ran. */
const BAR = { proceed: 0.55, notViable: 0.45 };

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? Number(a.slice(k.length + 3)) : d;
};

const docOf = (path) => tokenize(path).join(" ");

/**
 * ⚠️ TRAP, found the hard way 2026-08-27.
 * ELM.trainFromData(X, y) accepts STRING labels without error and silently
 * trains nothing — coerceXY routes them through toOneHotClamped(), which
 * coerces non-numeric labels to index 0. The model then predicts one class for
 * every input, identically across independent random inits.
 *
 * The first run of this screen produced 2.4% agreement that way and would have
 * been published as "Path B is not viable". It is NOT a negative result; it is
 * a broken harness. Always pass explicit one-hot Y.
 */
const oneHot = (label, categories) => categories.map((c) => (c === label ? 1 : 0));

/**
 * Refuse to report a negative from a harness that cannot learn a trivially
 * separable problem. Runs before every screen; throws rather than returning,
 * because a silent skip here is how the false negative happened.
 */
function assertHarnessCanLearn() {
  const cats = ["a", "b"];
  const X = [[1, 0], [1, 0], [1, 0], [0, 1], [0, 1], [0, 1]];
  const Y = ["a", "a", "a", "b", "b", "b"].map((l) => oneHot(l, cats));
  const elm = new ELM({ categories: cats, hiddenUnits: 16, activation: "relu", log: { modelName: "sanity", verbose: false } });
  elm.trainFromData(X, Y);
  const a = elm.predictFromVector([[1, 0]], 1)[0][0].label;
  const b = elm.predictFromVector([[0, 1]], 1)[0][0].label;
  if (a !== "a" || b !== "b") {
    throw new Error(
      `HARNESS SANITY CHECK FAILED: separable 2-class problem gave [${a}, ${b}], expected [a, b].\n` +
      "  Any agreement number from this run would be meaningless. Fix the harness before reporting.",
    );
  }
}

function fitVectorizer(trainDocs, maxVocab) {
  const v = new TFIDFVectorizer(trainDocs, maxVocab);
  return {
    all: () => v.vectorizeAll(),
    one: (doc) => v.vectorize(doc),
  };
}

/** Macro-F1 plus the service/utility confusion the leads need for TN-J10. */
function score(truth, pred, labels) {
  const agree = truth.filter((t, i) => t === pred[i]).length / truth.length;
  const per = {};
  for (const L of labels) {
    const tp = truth.filter((t, i) => t === L && pred[i] === L).length;
    const fp = truth.filter((t, i) => t !== L && pred[i] === L).length;
    const fn = truth.filter((t, i) => t === L && pred[i] !== L).length;
    const prec = tp + fp ? tp / (tp + fp) : 0;
    const rec = tp + fn ? tp / (tp + fn) : 0;
    per[L] = { support: tp + fn, precision: prec, recall: rec, f1: prec + rec ? (2 * prec * rec) / (prec + rec) : 0 };
  }
  const su = { su: 0, us: 0, ss: 0, uu: 0 };
  truth.forEach((t, i) => {
    const p = pred[i];
    if (t === "service" && p === "utility") su.su++;
    else if (t === "utility" && p === "service") su.us++;
    else if (t === "service" && p === "service") su.ss++;
    else if (t === "utility" && p === "utility") su.uu++;
  });
  return { agreement: agree, perClass: per, serviceUtility: su };
}

function main() {
  const repeats = arg("repeats", 7);
  const hidden = arg("hidden", 256);
  assertHarnessCanLearn();
  const corpus = JSON.parse(readFileSync(CORPUS, "utf-8"));
  const train = corpus.train, held = corpus.heldOut;
  const labels = [...new Set(corpus.train.map((r) => r.label))];

  const trainDocs = train.map((r) => docOf(r.text));
  const vec = fitVectorizer(trainDocs, 2000);
  const Xtr = vec.all();
  const Xho = held.map((r) => vec.one(docOf(r.text)));
  const ytr = train.map((r) => r.label);
  const Ytr = ytr.map((l) => oneHot(l, labels));
  const truth = held.map((r) => r.label);

  // Baselines, recomputed from the split actually used — never quoted.
  const counts = {};
  for (const t of truth) counts[t] = (counts[t] ?? 0) + 1;
  const majority = Math.max(...Object.values(counts)) / truth.length;

  console.log("ELM feasibility screen — Step 3");
  console.log(`  corpus ${CORPUS} (${train.length} train / ${held.length} held-out, ${labels.length} classes)`);
  console.log(`  feature: path string only, TF-IDF fitted on TRAIN ONLY (dim ${Xtr[0].length})`);
  console.log(`  ${repeats} independent models, ${hidden} hidden units`);
  console.log(`  held-out majority baseline: ${(majority * 100).toFixed(1)}%`);
  console.log(`  PRE-REGISTERED bar (f3205143): >=${BAR.proceed * 100}% proceed · <${BAR.notViable * 100}% not viable\n`);

  const runs = [];
  for (let i = 0; i < repeats; i++) {
    // ELM seeds its PRNG from cfg.seed, DEFAULTING TO 1337 — so repeats without
    // an explicit seed are byte-identical, not independent. The first version of
    // this script reported "range 57.8-57.8%" from 7 copies of one model.
    const elm = new ELM({ categories: labels, hiddenUnits: hidden, activation: "relu", seed: 42 + i, log: { modelName: "screen", verbose: false } });
    elm.trainFromData(Xtr, Ytr); // one-hot, NOT strings — see the trap note above
    const pred = Xho.map((v) => elm.predictFromVector([v], 1)[0][0].label);
    const conf = Xho.map((v) => elm.predictFromVector([v], 1)[0][0].prob);
    runs.push({ ...score(truth, pred, labels), meanConfidence: conf.reduce((a, b) => a + b, 0) / conf.length });
    process.stdout.write(`    run ${i + 1}: ${(runs[i].agreement * 100).toFixed(1)}%\n`);
  }

  const ags = runs.map((r) => r.agreement);
  const mean = ags.reduce((a, b) => a + b, 0) / ags.length;
  const lo = Math.min(...ags), hi = Math.max(...ags);
  const verdict = mean >= BAR.proceed ? "PROCEED — mapping is learnable; TN-J10 now binds"
    : mean < BAR.notViable ? "NOT VIABLE — publish the negative; TN-J10 moot"
    : "INCONCLUSIVE — take to the leads with the confusion matrix";

  console.log(`\n  agreement-with-teacher: mean ${(mean * 100).toFixed(1)}%  range ${(lo * 100).toFixed(1)}–${(hi * 100).toFixed(1)}%`);
  console.log(`  vs majority baseline    ${(majority * 100).toFixed(1)}%   (lift ${((mean - majority) * 100).toFixed(1)} pp)`);
  console.log(`\n  VERDICT: ${verdict}\n`);

  const best = runs[ags.indexOf(hi)];
  console.log("  service/utility — the 74% of mass where the teacher is shakiest (best run):");
  const su = best.serviceUtility;
  console.log(`    service→service ${su.ss}   service→utility ${su.su}`);
  console.log(`    utility→service ${su.us}   utility→utility ${su.uu}\n`);
  console.log("  per-class (best run) — 9 of 13 classes have <10 training rows; those F1s are near-meaningless:");
  for (const L of labels.sort()) {
    const p = best.perClass[L];
    if (!p.support) continue;
    console.log(`    ${L.padEnd(14)} n=${String(p.support).padStart(2)}  P ${p.precision.toFixed(2)}  R ${p.recall.toFixed(2)}  F1 ${p.f1.toFixed(2)}`);
  }

  writeFileSync(OUT, JSON.stringify({
    schema: "elm-feasibility-screen/v1",
    generatedAt: new Date().toISOString(),
    preRegisteredBar: { ...BAR, committedAt: "f3205143", note: "Fixed before any model was run." },
    corpusProvenance: corpus.provenance ?? null,
    method: {
      feature: "path string only; library tokenize() + TF-IDF fitted on TRAIN ONLY",
      metric: "agreement-with-teacher — NOT accuracy; teacher is known inconsistent (TN-J10)",
      repeats, hiddenUnits: hidden, featureDim: Xtr[0].length,
    },
    baselines: { heldOutMajority: majority },
    result: { meanAgreement: mean, range: [lo, hi], verdict },
    runs,
  }, null, 2) + "\n");
  console.log(`\n  wrote ${OUT}`);
}

main();
