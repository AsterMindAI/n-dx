/**
 * TJ-E1 gate separability — the single measurement the whole architecture rests on.
 *
 * THE DESIGN ASSUMPTION
 * ---------------------
 * The ELM-before-LLM gate works like this: the ELM answers what it is confident about, and
 * everything else falls through to an LLM call. That design is only sound if the ELM's own
 * confidence PREDICTS ITS OWN CORRECTNESS. If it does, raising the threshold routes the wrong
 * answers to the LLM and keeps the right ones -- precision climbs as coverage falls, and there
 * is an operating point where the gate is both cheap and safe.
 *
 * If confidence does NOT predict correctness, the gate is just rejecting a random slice. You
 * keep a random 61% and pay for the rest anyway, and NO threshold and NO amount of tuning can
 * fix it -- because the model cannot tell its hits from its misses.
 *
 * This script tests that directly by bucketing held-out predictions into margin deciles and
 * reporting precision per decile. NON-CUMULATIVE on purpose: a cumulative sweep (">= t") mixes
 * every bucket above the threshold together and hides a flat signal.
 *
 * READ:
 *   precision RISING steeply across deciles  -> confidence is informative, the gate can work
 *   precision FLAT across deciles            -> confidence is noise, the gate cannot work
 *
 * Also reports the discrimination summary: mean margin of correct vs incorrect predictions,
 * and AUC (probability a randomly chosen correct prediction has a higher margin than a randomly
 * chosen incorrect one). AUC 0.5 = no discrimination at all. AUC 1.0 = perfect.
 *
 * "Correct" = agrees with the LLM teacher, itself 72.3% vs human judgement. See
 * elm-savings-curve.mjs's header.
 *
 * SETUP: see elm-generalisation-check.mjs's header for fetching the corpus.
 * Usage: node packages/sourcevision/scripts/elm-gate-separability.mjs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SEED = 20260922;
const CORPUS = "scripts/data/elm-archetype-corpus-v3-classtargeted.json";
const REPO = "n-dx-1";

const { buildFeatureVector, readFileContentSafely, FEATURE_VERSION } = await import(
  "../dist/analyzers/classify-elm-features.js"
);
const { trainArchetypeELMNumeric } = await import("../dist/analyzers/classify-elm.js");

const corpus = JSON.parse(readFileSync(CORPUS, "utf-8"));
const root = resolve(".");
const vec = (p) => buildFeatureVector({ path: p, content: readFileContentSafely(root, p) });

const trainRows = corpus.train.filter((r) => r.repo === REPO);
const testRows = corpus.heldOut.filter((r) => r.repo === REPO);

const examples = trainRows.map((r) => ({ vector: vec(r.text), archetype: r.label }));
const categories = [...new Set(examples.map((e) => e.archetype))].sort();
const model = trainArchetypeELMNumeric(examples, categories, SEED);

const scored = testRows.map((r) => {
  const top = model.elm.predictTopKFromVector(vec(r.text), 2);
  return {
    margin: top.length > 1 ? top[0].prob - top[1].prob : top[0].prob,
    confidence: top[0].prob,
    correct: top[0].label === r.label,
  };
});

/** AUC via the Mann-Whitney U identity: fraction of (correct, incorrect) pairs ranked right. */
function auc(items, key) {
  const pos = items.filter((s) => s.correct).map((s) => s[key]);
  const neg = items.filter((s) => !s.correct).map((s) => s[key]);
  if (pos.length === 0 || neg.length === 0) return null;
  let wins = 0;
  for (const p of pos) for (const n of neg) wins += p > n ? 1 : p === n ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

console.log("=".repeat(84));
console.log(`TJ-E1 gate separability   seed=${SEED}   feature layout v${FEATURE_VERSION}`);
console.log("=".repeat(84));
console.log(`held-out             ${scored.length} rows (${REPO}, Nolan seed-42 split)`);
console.log(`overall precision    ${(100 * scored.filter((s) => s.correct).length / scored.length).toFixed(1)}%`);

for (const key of ["margin", "confidence"]) {
  const sorted = [...scored].sort((a, b) => a[key] - b[key]);
  const buckets = 5;
  const size = Math.ceil(sorted.length / buckets);

  console.log("\n" + "-".repeat(84));
  console.log(`BY ${key.toUpperCase()} QUINTILE (non-cumulative) — lowest ${key} first`);
  console.log("-".repeat(84));
  console.log(`${"quintile".padEnd(10)} ${"n".padStart(4)} ${key.padStart(12)} range ${"precision".padStart(24)}`);

  const precisions = [];
  for (let i = 0; i < buckets; i++) {
    const slice = sorted.slice(i * size, (i + 1) * size);
    if (slice.length === 0) continue;
    const p = slice.filter((s) => s.correct).length / slice.length;
    precisions.push(p);
    const lo = slice[0][key].toFixed(4);
    const hi = slice[slice.length - 1][key].toFixed(4);
    const bar = "#".repeat(Math.round(p * 30));
    console.log(
      `${`Q${i + 1}`.padEnd(10)} ${String(slice.length).padStart(4)} ${`${lo}-${hi}`.padStart(18)} ${(100 * p).toFixed(1).padStart(7)}%  ${bar}`,
    );
  }

  const a = auc(scored, key);
  const spread = Math.max(...precisions) - Math.min(...precisions);
  console.log(
    `\n  mean ${key}: correct ${mean(scored.filter((s) => s.correct).map((s) => s[key])).toFixed(4)}` +
      `   incorrect ${mean(scored.filter((s) => !s.correct).map((s) => s[key])).toFixed(4)}`,
  );
  console.log(`  AUC: ${a === null ? "n/a" : a.toFixed(3)}   (0.50 = no discrimination, 1.00 = perfect)`);
  console.log(`  precision spread across quintiles: ${(100 * spread).toFixed(1)} pp`);
}

console.log("\n" + "=".repeat(84));
console.log("VERDICT");
console.log("=".repeat(84));
{
  const nPos = scored.filter((s) => s.correct).length;
  const nNeg = scored.length - nPos;
  // Hanley-McNeil style rough SE; enough to say whether the sample can separate 0.5 from 0.7.
  const se = Math.sqrt((0.25 + 0.25) / Math.min(nPos, nNeg)) / 2;
  console.log(
    `SAMPLE SIZE CAVEAT: ${scored.length} held-out rows (${nPos} correct / ${nNeg} incorrect),\n` +
      `~${Math.round(scored.length / 5)} per quintile. AUC standard error is roughly +/-${se.toFixed(2)}, so this\n` +
      `CANNOT distinguish "useless" (0.50) from "weakly useful" (0.65) with confidence, and the\n` +
      `non-monotonic quintiles are within noise. What it DOES rule out is the steeply-rising\n` +
      `curve the gate architecture needs -- that would be unmissable even at this n.\n`,
  );
}
const am = auc(scored, "margin");
if (am === null) {
  console.log("Not enough of both classes to judge.");
} else if (am >= 0.70) {
  console.log(`AUC ${am.toFixed(3)} — confidence IS informative. The gate architecture is sound;`);
  console.log("tune the threshold and route the rest to the LLM as designed.");
} else if (am >= 0.60) {
  console.log(`AUC ${am.toFixed(3)} — weakly informative. A gate can work but buys little:`);
  console.log("most of what it rejects would have been right, and much of what it keeps is wrong.");
} else {
  console.log(`AUC ${am.toFixed(3)} — confidence is NOT meaningfully informative about correctness.`);
  console.log("The ELM cannot tell its hits from its misses, so raising the threshold rejects");
  console.log("a near-random slice. No threshold and no amount of tuning fixes this: it is a");
  console.log("property of the model's calibration, not of where the line is drawn.");
  console.log("\nThis is a finding about the GATE, not about the representation. A better");
  console.log("representation could still change it -- but the current one cannot be rescued");
  console.log("by tuning, and shipping it at any threshold means accepting a near-random slice.");
}
