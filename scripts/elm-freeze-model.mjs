#!/usr/bin/env node
/**
 * Freeze the Phase 3 candidate. Run ONCE, before gold set #2 exists.
 *
 * ── Why this file has to exist, and has to come first ─────────────────────
 * "Evaluate the frozen model once. No tuning after this point." is only
 * enforceable if there is an artifact saying what "the model" IS. Without one,
 * certification is a promise rather than a fact, and every ambiguity — which
 * seed? one model or several? which operating point? — gets resolved after the
 * labels are visible, which is the whole failure mode Phase 3 exists to avoid.
 *
 * This writes `scripts/data/elm-frozen-model.json`: the full specification and a
 * refit fingerprint, with a content hash. The certification script must refuse
 * to run against anything else.
 *
 * ⚠️ It deliberately does NOT store the weight matrices. Nine models at
 * 1024x1688 serialise to **536 MB of JSON** — I committed exactly that once and
 * had to reset it out before it was pushed. The weights are *derived* data: the
 * fit is deterministic given (corpus, spec, seed), which is verified here, so
 * the recipe plus a fingerprint pins the model exactly and costs 2 KB. If a
 * library upgrade ever changes the fit, the fingerprint mismatches loudly
 * instead of the result drifting quietly.
 *
 * ── The one decision made here, and why it is legitimate ──────────────────
 * A shipped tier is ONE deterministic thing. The DEV figures are means over 15
 * random seeds, and seed spread on this corpus is ~16 pp — so shipping "seed
 * 42" would ship an arbitrary draw from a wide distribution, and certifying it
 * would certify that draw rather than the design.
 *
 * So the frozen artifact is a MAJORITY VOTE over a fixed seed set. That is
 * variance reduction, not model selection, and it is chosen on **train-CV
 * only** — the same channel Phase 1 used. The gold set is not consulted.
 *
 * ⚠️ Do not confuse this with the `VotingClassifierELM` that LOST 2.8 pp in
 * Phase 1. That was STACKING: a learned meta-classifier over base predictions,
 * with its own parameters to overfit. This is a plain unweighted vote over
 * seeds of one architecture, with nothing learned on top.
 *
 * Usage: node scripts/elm-freeze-model.mjs [--force]
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ELM, TFIDFVectorizer, tokenize } from "@astermind/astermind-community";

const argStr = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const CORPUS = argStr("corpus", "scripts/data/elm-archetype-corpus.json");
const OUT = argStr("out", "scripts/data/elm-frozen-model.json");

/** Phase 1's adopted configuration. See IMPL § Phase 1 RESULT; adopted at 5c5b87b0. */
const SPEC = {
  hiddenUnits: Number(argStr("hidden", "1024")),
  activation: argStr("activation", "tanh"),
  ridgeLambda: 1e-2,
  vocabCap: 4000,
  /** Fixed and odd, so majority vote never ties on a two-way split. */
  ensembleSeeds: [42, 43, 44, 45, 46, 47, 48, 49, 50],
  /** B+su: answer on non-service/utility, plus the top 10% most-confident service/utility. */
  operatingPoint: { design: "B+su", abstainOn: ["service", "utility"], suAdmitFraction: 0.10 },
};

// Reducible for cost: the ensemble-vs-single check at 4096 units costs 135 fits
// across 3 fold-seeds (~2.3 h). The check only has to show the ensemble is not
// WORSE — it is a determinism decision, not a model selection — so one fold-seed
// is sufficient and the reduction is stated rather than silently taken.
const FOLD_SEEDS = argStr("fold-seeds", "7,13,29").split(",").map(Number);
const FOLDS = 5;

const docOf = (p) => tokenize(p).join(" ");
const oneHot = (l, cs) => cs.map((c) => (c === l ? 1 : 0));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const pct = (x) => `${(x * 100).toFixed(1)}%`;

function assertHarnessCanLearn() {
  const cats = ["a", "b"];
  const X = [[1, 0], [1, 0], [1, 0], [0, 1], [0, 1], [0, 1]];
  const Y = ["a", "a", "a", "b", "b", "b"].map((l) => oneHot(l, cats));
  const e = new ELM({ categories: cats, hiddenUnits: 16, activation: "relu", seed: 1, log: { modelName: "sanity", verbose: false } });
  e.trainFromData(X, Y);
  if (e.predictFromVector([[1, 0]], 1)[0][0].label !== "a" || e.predictFromVector([[0, 1]], 1)[0][0].label !== "b") {
    throw new Error("HARNESS SANITY CHECK FAILED — a frozen model built from this run would be meaningless.");
  }
}

function shuffledIndices(n, seed) {
  let rng = seed;
  const rnd = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff; };
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}

/** Unweighted majority vote over seeds; ties broken by summed probability. */
function voteLabels(perSeedTop, cats) {
  return perSeedTop[0].map((_, i) => {
    const tally = new Map();
    for (const seedTop of perSeedTop) {
      const { label, prob } = seedTop[i];
      const cur = tally.get(label) ?? { n: 0, p: 0 };
      tally.set(label, { n: cur.n + 1, p: cur.p + prob });
    }
    let best = null;
    for (const [label, v] of tally) {
      if (!best || v.n > best.v.n || (v.n === best.v.n && v.p > best.v.p)) best = { label, v };
    }
    // Vote share doubles as the ensemble's confidence — bounded [0,1], unlike the
    // 13-class softmax which caps near 0.245 and defeats absolute thresholds.
    return { label: best.label, prob: best.v.n / perSeedTop.length };
  });
}

/** Train-CV comparison of a single seed against the ensemble. Gold set is NOT read. */
function cvCompare(rows, cats) {
  const single = [], ens = [];
  for (const fs of FOLD_SEEDS) {
    const idx = shuffledIndices(rows.length, fs);
    let sHit = 0, eHit = 0, tot = 0;
    for (let f = 0; f < FOLDS; f++) {
      const te = idx.filter((_, k) => k % FOLDS === f);
      const tr = idx.filter((_, k) => k % FOLDS !== f);
      const v = new TFIDFVectorizer(tr.map((i) => docOf(rows[i].text)), SPEC.vocabCap);
      const Xtr = v.vectorizeAll();
      const Ytr = tr.map((i) => oneHot(rows[i].label, cats));
      const Xte = te.map((i) => v.vectorize(docOf(rows[i].text)));
      const perSeed = SPEC.ensembleSeeds.map((seed) => {
        const e = new ELM({ categories: cats, hiddenUnits: SPEC.hiddenUnits, activation: SPEC.activation, ridgeLambda: SPEC.ridgeLambda, seed, log: { modelName: "freeze", verbose: false } });
        e.trainFromData(Xtr, Ytr);
        return Xte.map((x) => e.predictFromVector([x], 1)[0][0]);
      });
      const voted = voteLabels(perSeed, cats);
      te.forEach((i, j) => {
        if (perSeed[0][j].label === rows[i].label) sHit++;
        if (voted[j].label === rows[i].label) eHit++;
        tot++;
      });
    }
    single.push(sHit / tot); ens.push(eHit / tot);
  }
  return { single, ensemble: ens };
}

function main() {
  if (existsSync(OUT) && !process.argv.includes("--force")) {
    const prev = JSON.parse(readFileSync(OUT, "utf-8"));
    console.error(`REFUSING: ${OUT} already exists (frozen ${prev.frozenAt}, hash ${prev.contentHash.slice(0, 12)}).`);
    console.error("A frozen model is frozen. Re-running would silently replace the thing Phase 3 certifies.");
    console.error("If the freeze genuinely needs redoing, pass --force and say why in the commit message.");
    process.exit(1);
  }
  assertHarnessCanLearn();

  const corpus = JSON.parse(readFileSync(CORPUS, "utf-8"));
  const rows = corpus.train;
  const cats = [...new Set(rows.map((r) => r.label))];

  console.log("Freezing the Phase 3 candidate\n");
  console.log(`  spec: ELM ${SPEC.hiddenUnits} / ${SPEC.activation} / λ${SPEC.ridgeLambda} / vocab ${SPEC.vocabCap}`);
  console.log(`  ensemble: majority vote over ${SPEC.ensembleSeeds.length} seeds ${JSON.stringify(SPEC.ensembleSeeds)}`);
  console.log(`  operating point: ${SPEC.operatingPoint.design}, admitting top ${SPEC.operatingPoint.suAdmitFraction * 100}% of service/utility\n`);

  console.log("  Checking the ensemble is not worse than a single seed — TRAIN-CV ONLY, gold untouched:");
  const cmp = cvCompare(rows, cats);
  console.log(`    single seed (${SPEC.ensembleSeeds[0]})   ${pct(mean(cmp.single))}   runs ${cmp.single.map((x) => pct(x)).join(" ")}`);
  console.log(`    ${SPEC.ensembleSeeds.length}-seed majority vote  ${pct(mean(cmp.ensemble))}   runs ${cmp.ensemble.map((x) => pct(x)).join(" ")}`);
  const delta = (mean(cmp.ensemble) - mean(cmp.single)) * 100;
  console.log(`    delta ${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pp`);
  if (mean(cmp.ensemble) < mean(cmp.single)) {
    console.log("    ⚠️  The ensemble is WORSE on train-CV. Freezing it anyway would be choosing");
    console.log("        determinism over accuracy — a real trade, but it must be a stated one.");
  } else {
    console.log("    => the ensemble is at least as good AND removes the seed lottery. Frozen.\n");
  }

  // Fit the shipping artifact on the FULL training split.
  const v = new TFIDFVectorizer(rows.map((r) => docOf(r.text)), SPEC.vocabCap);
  const Xtr = v.vectorizeAll();
  const Ytr = rows.map((r) => oneHot(r.label, cats));
  // The library exposes no toJSON()/saveModelAsJSON(); weights live on `.model`
  // as {W, b, beta}, and `serializeConfig()` gives the resolved config. Both are
  // captured, so the artifact does not depend on re-fitting to be readable.
  // ⚠️ MEMORY. Fitting all 9 seeds and HOLDING them was fine at 1024 units but
  // OOMs at 4096: W is 4096 x 2890 doubles per model, and nine of those plus the
  // ridge solve's transient 4096 x 4096 exceed node's 2096 MB default heap. The
  // first 4096 freeze died exactly there, AFTER completing the CV comparison.
  //
  // Nothing downstream needs nine live models — it needs each model's PREDICTIONS
  // on the probe set, plus shapes and configs. So fits are streamed: fit, extract,
  // drop. Peak is one model instead of nine. This changes no number in the
  // artifact; it is the same seeds, the same fits, in the same order.
  const probe = rows.map((r) => docOf(r.text));
  const probeVecs = probe.map((d) => v.vectorize(d));

  const models = [];
  const perSeedProbe = [];
  let firstBeta = null;
  for (const seed of SPEC.ensembleSeeds) {
    const e = new ELM({ categories: cats, hiddenUnits: SPEC.hiddenUnits, activation: SPEC.activation, ridgeLambda: SPEC.ridgeLambda, seed, log: { modelName: "frozen", verbose: false } });
    e.trainFromData(Xtr, Ytr);
    models.push({
      seed,
      config: e.serializeConfig(),
      // Shape only. See the header: the weights themselves are 536 MB of JSON and
      // are reproducible from (corpus, spec, seed).
      weightShape: { W: [e.model.W.length, e.model.W[0].length], b: [e.model.b.length, e.model.b[0].length], beta: [e.model.beta.length, e.model.beta[0].length] },
    });
    perSeedProbe.push(probeVecs.map((x) => e.predictFromVector([x], 1)[0][0]));
    // Retained for the determinism check below — beta is 4096 x 16, ~0.5 MB, so
    // keeping it costs nothing while keeping the whole model costs ~95 MB.
    if (firstBeta === null) firstBeta = JSON.stringify(e.model.beta);
  }

  // A refit fingerprint. The fit is deterministic given the seed (verified), so
  // certification can re-fit and confirm it is scoring the SAME model rather than
  // trusting that nothing drifted — a library bump would show up here as a
  // mismatch instead of as a quietly different result.
  const votedProbe = voteLabels(perSeedProbe, cats);
  const fingerprint = createHash("sha256")
    .update(votedProbe.map((p) => `${p.label}:${p.prob.toFixed(6)}`).join("|"))
    .digest("hex");

  // The artifact stores a recipe, not weights, so determinism is load-bearing.
  // Verify it rather than assuming it: refit one seed and require an identical fit.
  const check = new ELM({ categories: cats, hiddenUnits: SPEC.hiddenUnits, activation: SPEC.activation, ridgeLambda: SPEC.ridgeLambda, seed: SPEC.ensembleSeeds[0], log: { modelName: "determinism", verbose: false } });
  check.trainFromData(Xtr, Ytr);
  const a = firstBeta;
  const b2 = JSON.stringify(check.model.beta);
  if (a !== b2) {
    throw new Error("DETERMINISM CHECK FAILED: refitting the same seed gave different weights.\n" +
      "  The frozen artifact stores a recipe, not weights, so a non-deterministic fit makes it meaningless.\n" +
      "  Store the weights instead, or pin whatever is varying, before freezing.");
  }
  console.log("  determinism verified: refitting seed " + SPEC.ensembleSeeds[0] + " reproduces identical weights");
  console.log(`  refit fingerprint (${probe.length} train paths, ensemble vote): ${fingerprint.slice(0, 16)}…`);

  const payload = {
    schema: "elm-frozen-model/v1",
    frozenAt: new Date().toISOString(),
    frozenBy: "scripts/elm-freeze-model.mjs",
    status: "FROZEN. Phase 3 evaluates this and only this. Any change voids the certification.",
    spec: SPEC,
    categories: cats,
    trainedOn: {
      corpus: CORPUS,
      split: "train",
      rows: rows.length,
      corpusProvenance: corpus.provenance ?? null,
    },
    selection: {
      // Derived, never hard-coded: --fold-seeds is reducible, and an artifact that
      // states a fold-seed set it did not use is the exact "consistent with vs
      // recorded" failure this project has already hit twice.
      channel: `${FOLDS}-fold CV on the TRAIN split only, fold seeds [${FOLD_SEEDS.join(",")}]. Gold sets NOT consulted.`,
      foldSeeds: FOLD_SEEDS,
      foldSeedsReduced: FOLD_SEEDS.length < 3
        ? `REDUCED from the default [7,13,29] to [${FOLD_SEEDS.join(",")}] for cost. Legitimate here because this CV only has to show the ensemble is not WORSE than a single seed — a determinism decision, not model selection. Do not quote these CV figures as a model-selection result.`
        : null,
      singleSeedCv: cmp.single,
      ensembleCv: cmp.ensemble,
      deltaPp: delta,
      note: "Majority vote over seeds is variance reduction, NOT the stacked VotingClassifierELM that lost 2.8 pp in Phase 1.",
    },
    vectorizer: { kind: "TFIDFVectorizer", vocabCap: SPEC.vocabCap, fittedOn: "train split only", tokenizer: "library tokenize()", featureDim: Xtr[0].length },
    refitFingerprint: { sha256: fingerprint, over: "ensemble vote on the train split paths", note: "Certification must re-fit and match this before scoring anything." },
    library: { name: "@astermind/astermind-community", version: JSON.parse(readFileSync("node_modules/@astermind/astermind-community/package.json", "utf-8")).version },
    models,
  };
  const body = JSON.stringify(payload, null, 2);
  const hash = createHash("sha256").update(body).digest("hex");
  writeFileSync(OUT, JSON.stringify({ ...payload, contentHash: hash }, null, 2) + "\n");

  console.log(`  wrote ${OUT}`);
  console.log(`  content hash ${hash.slice(0, 16)}…`);
  console.log("\n  From here on: no tuning. If Phase 3 fails, the honest move is a THIRD gold set,");
  console.log("  not a retune against the second.");
}

main();
