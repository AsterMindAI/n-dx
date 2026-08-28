#!/usr/bin/env node
/**
 * Train the ELM prototype on the committed corpus and print a classification report.
 *
 * ⚠️ THIS SCRIPT RETURNS NO VERDICT. It prints numbers and stops.
 *
 * Setting the bar, reading the confusion matrix and deciding whether the ELM is good
 * enough is TN-B5 / TN-J4 Step 3 — Jam's, under the Path A/B split agreed 2026-08-23.
 * Path A builds the instrument; Path B grades the result.
 *
 * ⚠️ THE NUMBER IT PRINTS IS *AGREEMENT WITH THE TEACHER*, NOT ACCURACY.
 * The corpus labels come from an LLM whose consistency is itself under review (TN-J10):
 * `service` and `utility` are 74% of the corpus and the boundary between them is fuzzy.
 * A model that agrees perfectly with an inconsistent teacher is not therefore correct.
 *
 * Usage:
 *   node scripts/elm-prototype/train-eval.mjs [--seed=42] [--hidden=512] [--topk=3]
 *                                             [--corpus=<path>] [--threshold=0.5]
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateClassification, formatClassificationReport } from "@astermind/astermind-community";
import { ElmClassifier } from "./classifier.mjs";
import { DEFAULT_SEED, DEFAULT_HIDDEN_UNITS } from "./config.mjs";
import { runControl, CONTROL_FLOOR } from "./self-test.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
};

const corpusPath = resolve(arg("corpus", resolve(REPO_ROOT, "scripts/data/elm-archetype-corpus.json")));
const seed = Number(arg("seed", DEFAULT_SEED));
const hiddenUnits = Number(arg("hidden", DEFAULT_HIDDEN_UNITS));
const topK = Number(arg("topk", 3));
const threshold = Number(arg("threshold", 0.5));

// ── Control first. An instrument that has not proved itself must not report. ──
const control = runControl({ seed });
if (!control.passed) {
  console.error("CONTROL FAILED — the wrapper cannot learn a task known to be learnable.\n");
  control.detail.forEach((d) => console.error("  " + d));
  console.error(`\n  control accuracy ${(control.accuracy * 100).toFixed(0)}% is below the ${(CONTROL_FLOOR * 100).toFixed(0)}% floor.`);
  console.error("  REFUSING to report a corpus number: it would be indistinguishable from a broken wrapper.");
  process.exit(1);
}

const corpus = JSON.parse(readFileSync(corpusPath, "utf8"));
const train = corpus.train ?? [];
const heldOut = corpus.heldOut ?? [];
if (train.length === 0 || heldOut.length === 0) {
  console.error(`Corpus at ${corpusPath} has no train/heldOut rows.`);
  process.exit(2);
}

/**
 * Majority-class share, COMPUTED from the corpus actually loaded.
 *
 * Deliberately not hardcoded to 38.0%: that figure is derived (`service` 123/324) and
 * is not stored in the corpus, so hardcoding it would silently go stale the moment the
 * distribution changes — which is exactly what a golden-list rebuild will do.
 */
function majorityBaseline(rows) {
  const counts = new Map();
  for (const r of rows) counts.set(r.label, (counts.get(r.label) ?? 0) + 1);
  const [label, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return { label, share: n / rows.length, n, total: rows.length };
}

const categories = [...new Set([...train, ...heldOut].map((r) => r.label))].sort();
const baselineAll = majorityBaseline([...train, ...heldOut]);
const baselineHeld = majorityBaseline(heldOut);

console.log("elm-prototype — train / evaluate against the committed corpus\n");
console.log(`control:    PASSED ${(control.accuracy * 100).toFixed(0)}% on the hello-world task (floor ${(CONTROL_FLOOR * 100).toFixed(0)}%, baseline 33%), max prob ${control.maxProb.toFixed(3)}`);
console.log(`            -> the wrapper CAN learn a separable task, so anything below is about the data, not the code`);
console.log(`corpus:     ${corpusPath.replace(REPO_ROOT + "/", "")}`);
console.log(`provenance: repos=${(corpus.provenance?.repos ?? []).map((r) => (typeof r === "string" ? r : r.name ?? r.repo ?? JSON.stringify(r))).join(", ") || "?"}  seed=${corpus.provenance?.seed ?? "?"}`);
console.log(`rows:       ${train.length} train / ${heldOut.length} held-out  ·  ${categories.length} classes`);
console.log(`config:     seed=${seed} hidden=${hiddenUnits} topK=${topK} threshold=${threshold}`);
console.log(`baseline:   majority class "${baselineAll.label}" = ${(baselineAll.share * 100).toFixed(1)}% over the whole corpus`);
console.log(`            majority class "${baselineHeld.label}" = ${(baselineHeld.share * 100).toFixed(1)}% over held-out only  <- compare against THIS\n`);

const clf = new ElmClassifier({ categories, seed, hiddenUnits });
clf.train(train.map((r) => ({ text: r.text, label: r.label })));
console.log(`trained on ${train.length} rows in ${clf.trainMs.toFixed(1)}ms`);
console.log(`  ADR-2026-08-23 § Decision 4 revisit threshold is 2000ms — ${clf.trainMs < 2000 ? "in-process training stays the plan" : "EXCEEDED: the ship-vs-retrain question reopens"}\n`);

const yTrue = [];
const yPred = [];
let gatedThrough = 0;
let topKHits = 0;

for (const row of heldOut) {
  const preds = clf.predict(row.text, topK);
  const top = preds[0];
  yTrue.push(row.label);
  yPred.push(top ? top.label : "<none>");
  if (preds.some((p) => p.label === row.label)) topKHits++;
  if (clf.classifyGated(row.text, threshold) !== null) gatedThrough++;
}

const report = evaluateClassification(yTrue, yPred, { labels: categories });
console.log(formatClassificationReport(report));

const agreement = yTrue.filter((t, i) => t === yPred[i]).length / yTrue.length;
console.log(`\n── summary (n=${heldOut.length} held-out) ──`);
console.log(`  top-1 AGREEMENT WITH TEACHER .. ${(agreement * 100).toFixed(1)}%`);
console.log(`  held-out majority baseline .... ${(baselineHeld.share * 100).toFixed(1)}%`);
console.log(`  margin over baseline .......... ${((agreement - baselineHeld.share) * 100).toFixed(1)} points`);
console.log(`  top-${topK} agreement ............. ${((topKHits / heldOut.length) * 100).toFixed(1)}%`);
console.log(`  passed the ${threshold} confidence gate ... ${gatedThrough}/${heldOut.length} (${((gatedThrough / heldOut.length) * 100).toFixed(1)}%)`);
console.log(`  seed ${seed}, hidden ${hiddenUnits} — re-runnable: node scripts/elm-prototype/train-eval.mjs --seed=${seed} --hidden=${hiddenUnits}`);
console.log(`
  ⚠️  AGREEMENT, NOT ACCURACY. The teacher's own consistency is TN-J10. Read the
      service/utility cells of the confusion matrix above before trusting any of this:
      those two classes are ~74% of the corpus and the boundary between them is the
      thing under review.
  ⚠️  NO VERDICT IS OFFERED HERE. The bar is Jam's to set (TN-B5 / TN-J4 Step 3).`);
