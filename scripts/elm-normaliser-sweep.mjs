#!/usr/bin/env node
/**
 * Phase 3 — select the normaliser and the block scale on TRAIN-CV ONLY.
 *
 * IMPL-2026-09-18-nutella-elm-training-database-construction.md
 *
 * ⛔ THIS SCRIPT NEVER READS GOLD SET #2. Selection on the evaluation set is how a
 * held-out number becomes a training signal, and this project has a pre-registered
 * stopping rule forbidding it (scripts/data/elm-v3-preregistration.json).
 *
 * The grid is declared here, in code, and committed BEFORE the run. Two of the three
 * largest effects ever found on this project were defaults nobody chose, so every
 * value swept is a value someone picked on purpose:
 *
 *   normaliser   percentile | log1p | pooled
 *                percentile imports repo composition (inDegree 1 is the 12.5th
 *                percentile in n-dx and the 72.7th in commerce); log1p is a property
 *                of the file alone; pooled fixes one yardstick across repos and is
 *                the only one with a single-file runtime definition.
 *
 *   blockScale   0.25 | 0.5 | 1.0 | 2.0
 *                The structural block carries ~2.7x the energy of the entire 2,890-dim
 *                path block unscaled (path squared-L2 mean 1.464; 22 columns near
 *                [0,1]). Unswept, the balance falls out of an unstated constant. The
 *                path is not a weak signal to down-weight by default — the human
 *                path-only ceiling is 85.4%.
 *
 * Model config is PINNED to the frozen v2 spec so this measures the feature space,
 * not a re-tune. Changing two things at once has already cost this project a result.
 *
 * Cost control: selection uses ONE seed and K folds, not the 9-model ensemble. The
 * ensemble is a determinism device for the final model, not a selection instrument,
 * and 9x the fits would put this run into the OOM territory that has already
 * produced a run exiting 0 with an empty table.
 *
 * Usage: node --max-old-space-size=6144 scripts/elm-normaliser-sweep.mjs [--folds=3] [--seed=42]
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { ELM, TFIDFVectorizer, tokenize } from "@astermind/astermind-community";
import { collectRaw, buildStats, deriveFeatures } from "./elm-features.mjs";

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const FROZEN = "scripts/data/elm-frozen-model-v2.json";
const OUT = arg("out", "scripts/data/elm-normaliser-sweep.json");
const FOLDS = Number(arg("folds", "3"));
if (!Number.isInteger(FOLDS) || FOLDS < 2) {
  // With one fold every row is in the test set and the training fold is empty,
  // which surfaces deep inside the library as "trainFromData: X is empty".
  console.error(`--folds must be an integer >= 2 (got ${arg("folds", "3")}). One fold leaves no training rows.`);
  process.exit(1);
}
const SEED = Number(arg("seed", "42"));
const STAGING = "/Users/nolanmoore/Work/n-dx-elm-corpus";

const GRID = {
  normaliser: (arg("normalisers", "percentile,log1p,pooled")).split(","),
  /**
   * blockScale 0 is the CONTROL, not a candidate: it zeroes the structural block
   * so the model is path-only, on identical folds and seed.
   *
   * Added 2026-09-18 AFTER the first 12-config run, and recorded as an addition
   * rather than folded in silently. The first run came out monotone decreasing in
   * block scale (0.25 > 0.5 > 1.0 > 2.0, consistently across all three
   * normalisers), and the limit of "less structural is better" is none at all.
   * Without this arm the sweep cannot say whether structural features help, only
   * which non-zero amount of them hurts least.
   *
   * This touches only train-CV. Gold set #2 is still read exactly once, after
   * selection is frozen, so the pre-registered stopping rule is intact.
   */
  blockScale: (arg("scales", "0.25,0.5,1,2")).split(",").map(Number),
};

const docOf = (p) => tokenize(p).join(" ");
const oneHot = (l, cs) => cs.map((c) => (c === l ? 1 : 0));
const repoDir = (r) => (r === "n-dx-1" ? "." : `${STAGING}/${r}`);

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * Guard from K2's trap list: a broken harness and a genuine negative look identical
 * in a results table. If a trivially separable problem cannot be learned, every
 * number below is noise and the run must not be believed.
 */
function assertHarnessCanLearn() {
  const cats = ["a", "b"];
  const X = [], Y = [];
  for (let i = 0; i < 40; i++) {
    const a = i % 2 === 0;
    X.push(a ? [1, 0, 0] : [0, 1, 0]);
    Y.push(oneHot(a ? "a" : "b", cats));
  }
  const e = new ELM({ categories: cats, hiddenUnits: 64, activation: "tanh", seed: 1, log: { modelName: "sanity", verbose: false } });
  e.trainFromData(X, Y);
  const ok = e.predictFromVector([[1, 0, 0]], 1)[0][0].label === "a" && e.predictFromVector([[0, 1, 0]], 1)[0][0].label === "b";
  if (!ok) { console.error("FATAL: assertHarnessCanLearn() failed — the harness cannot learn a separable problem. No number below would mean anything."); process.exit(1); }
}

function main() {
  assertHarnessCanLearn();

  const frozen = JSON.parse(readFileSync(FROZEN, "utf-8"));
  const { hiddenUnits, activation, ridgeLambda, vocabCap } = frozen.spec;
  const cats = frozen.categories;
  const corpus = JSON.parse(readFileSync(frozen.trainedOn.corpus, "utf-8"));
  const rows = corpus.train;                      // TRAIN SPLIT ONLY. heldOut is not read.
  const trainRepos = [...new Set(rows.map((r) => r.repo))];

  const byRepo = new Map();
  for (const r of trainRepos) { const raw = collectRaw(repoDir(r)); if (raw) byRepo.set(r, raw); }

  console.log("Phase 3 — normaliser & block-scale sweep (TRAIN-CV ONLY; gold set #2 is never read)");
  console.log(`  corpus ${frozen.trainedOn.corpus}  ${rows.length} train rows  ${trainRepos.length} repos`);
  console.log(`  model  ELM ${hiddenUnits} / ${activation} / ridge ${ridgeLambda} / vocabCap ${vocabCap}  [pinned to frozen v2]`);
  console.log(`  folds  ${FOLDS}  seed ${SEED}`);
  console.log(`  grid   ${GRID.normaliser.length} normalisers x ${GRID.blockScale.length} block scales = ${GRID.normaliser.length * GRID.blockScale.length} configs\n`);

  // Fixed fold assignment, shared by every config, so configs are compared on
  // identical splits rather than on their own lucky partition.
  const rand = mulberry32(SEED);
  const fold = rows.map(() => Math.floor(rand() * FOLDS));

  const results = [];
  const partial = () => writeFileSync(OUT, JSON.stringify({
    generatedBy: "scripts/elm-normaliser-sweep.mjs", generatedAt: new Date().toISOString(),
    note: "TRAIN-CV ONLY. Gold set #2 is never read by this script.",
    corpus: frozen.trainedOn.corpus, spec: { hiddenUnits, activation, ridgeLambda, vocabCap },
    folds: FOLDS, seed: SEED, grid: GRID, complete: results.length === GRID.normaliser.length * GRID.blockScale.length,
    results,
  }, null, 2));

  for (const normaliser of GRID.normaliser) {
    const stats = buildStats(byRepo, normaliser);
    // Structural vectors are derived once per normaliser and reused across block
    // scales — the scale is a multiplier, not a different derivation.
    const struct = rows.map((r) => {
      const raw = byRepo.get(r.repo)?.rows.get(r.text);
      const probe = raw ?? { inDegree: null, outDegree: null, loc: null, size: null, edgeTypes: null, isolated: null, inCycle: null, externalPackages: null };
      return deriveFeatures(probe, r.repo, stats).vector;
    });

    for (const blockScale of GRID.blockScale) {
      const t0 = Date.now();
      let correct = 0, total = 0;
      const labelsSeen = new Set();

      process.stdout.write(`  ${normaliser.padEnd(11)} scale ${String(blockScale).padEnd(5)} `);
      for (let f = 0; f < FOLDS; f++) {
        process.stdout.write(`.`);
        const trIdx = rows.map((_, i) => i).filter((i) => fold[i] !== f);
        const teIdx = rows.map((_, i) => i).filter((i) => fold[i] === f);
        if (teIdx.length === 0 || trIdx.length === 0) continue;

        // The vectorizer is fitted on the TRAINING FOLD only. Fitting it on all rows
        // would leak the test fold's vocabulary into its own features.
        const v = new TFIDFVectorizer(trIdx.map((i) => docOf(rows[i].text)), vocabCap);
        // vectorizeAll() ONCE. Calling it inside the map ran a full corpus
        // vectorization per row — O(n^2), and silent: the job simply never finished,
        // which on this project looks exactly like "4096 units is slow".
        const XtrPath = v.vectorizeAll();
        const Xtr = trIdx.map((i, k) => [...XtrPath[k], ...struct[i].map((x) => x * blockScale)]);
        const Ytr = trIdx.map((i) => oneHot(rows[i].label, cats));
        const e = new ELM({ categories: cats, hiddenUnits, activation, ridgeLambda, seed: SEED, log: { modelName: "sweep", verbose: false } });
        e.trainFromData(Xtr, Ytr);

        for (const i of teIdx) {
          const x = [...v.vectorize(docOf(rows[i].text)), ...struct[i].map((q) => q * blockScale)];
          const p = e.predictFromVector([x], 1)[0][0];
          labelsSeen.add(p.label);
          if (p.label === rows[i].label) correct++;
          total++;
        }
      }

      const acc = total ? correct / total : 0;
      const secs = (Date.now() - t0) / 1000;
      results.push({ normaliser, blockScale, cvAgreement: acc, distinctLabels: labelsSeen.size, n: total, seconds: Math.round(secs) });
      console.log(` CV-agreement ${(acc * 100).toFixed(2)}%   labels ${String(labelsSeen.size).padStart(2)}   ${secs.toFixed(0)}s`);
      partial();
    }
  }

  if (results.length === 0) { console.error("\nFATAL: empty results table — an OOM exits 0 on this job. Treat as failed."); process.exit(1); }

  const best = [...results].sort((a, b) => b.cvAgreement - a.cvAgreement)[0];
  console.log(`\n  SELECTED  normaliser=${best.normaliser}  blockScale=${best.blockScale}  CV-agreement ${(best.cvAgreement * 100).toFixed(2)}%`);
  console.log(`  ⚠️  CV-agreement is agreement with a teacher that is 72.3% against truth — not accuracy.`);
  console.log(`  This selection is now FROZEN. Phase 4 evaluates it once on gold set #2.`);
  partial();
  console.log(`\n  wrote ${OUT}`);
}

main();
