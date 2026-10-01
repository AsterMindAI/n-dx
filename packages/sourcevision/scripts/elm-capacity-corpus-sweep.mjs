/**
 * TJ-E1 capacity x corpus sweep — is the content representation starved, or broken?
 *
 * WHY THIS EXISTS
 * ---------------
 * Two measurements said the content representation does not work:
 *   - it fails to generalise (below majority baseline on unseen ecosystems), and
 *   - its confidence does not predict its own correctness (AUC ~0.6).
 * Both were measured with the model trained on n-dx ALONE: 186 rows, 11 classes, where
 * `utility` and `service` hold ~200 of 255 rows and eleven classes share the rest.
 *
 * Team Nolan then certified their own corpus and REVERSED their conclusion
 * (ELM-database-ndx, methodology/FEATURES.md): "The failure was a starved class distribution,
 * NOT the feature space." Their fix -- harvesting rows for the thin classes -- took fresh-
 * ecosystem coverage 21.6% -> 47.2% with no change to their features.
 *
 * If that applies here, my negative results are an artifact of training on one repo, not a
 * property of content features. This isolates the two candidate causes:
 *
 *   CORPUS:   n-dx only (186 rows)        vs   all 9 other repos (~1900 rows)
 *   CAPACITY: 128 hidden units (my default) vs 4096 (Nolan's certified spec)
 *
 * Held-out is always the SAME set, so all four cells are directly comparable.
 *
 * CONTAMINATION: hono and trpc are Nolan's blind certification set. They are absent from this
 * corpus and from this script. Not trained on, not evaluated on.
 *
 * NOTE ON HEAP: 4096 units over ~1900 rows builds a large Gram matrix. Nolan's runs need
 * `--max-old-space-size=6144`; if a cell dies or returns nothing, that is why.
 *
 * Usage: node --max-old-space-size=6144 packages/sourcevision/scripts/elm-capacity-corpus-sweep.mjs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_SEED = 20260922;
const ENSEMBLE = 5; // smaller than the uncertainty study: 4 cells x folds is the cost here
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

/** Held out from EVERY cell, so the four numbers are comparable. Chosen as two mid-size repos
 *  that are neither the training repo under test nor Nolan's blind set. */
const HELD_OUT_REPOS = ["core", "fastify"];

const { buildFeatureVector, readFileContentSafely, FEATURE_VECTOR_SIZE } = await import(
  "../dist/analyzers/classify-elm-features.js"
);
const { trainArchetypeELMNumeric } = await import("../dist/analyzers/classify-elm.js");

const corpus = JSON.parse(readFileSync(CORPUS, "utf-8"));
const allRows = [...corpus.train, ...corpus.heldOut].filter((r) => ROOTS[r.repo]);

process.stdout.write("extracting features for all rows... ");
const cache = new Map();
for (const r of allRows) {
  const key = `${r.repo}::${r.text}`;
  cache.set(key, buildFeatureVector({
    path: r.text,
    content: readFileContentSafely(resolve(ROOTS[r.repo]), r.text),
  }));
}
console.log(`done (${cache.size} vectors, ${FEATURE_VECTOR_SIZE} dims)`);

const vec = (r) => cache.get(`${r.repo}::${r.text}`);
const SINK = new Set(["service", "utility"]);

const testRows = allRows.filter((r) => HELD_OUT_REPOS.includes(r.repo));
const poolRows = allRows.filter((r) => !HELD_OUT_REPOS.includes(r.repo));

const CORPORA = {
  "n-dx only": poolRows.filter((r) => r.repo === "n-dx-1"),
  "all repos": poolRows,
};
const CAPACITIES = [128, 4096];

function auc(items) {
  const pos = items.filter((s) => s.correct).map((s) => s.signal);
  const neg = items.filter((s) => !s.correct).map((s) => s.signal);
  if (!pos.length || !neg.length) return null;
  let w = 0;
  for (const p of pos) for (const n of neg) w += p > n ? 1 : p === n ? 0.5 : 0;
  return w / (pos.length * neg.length);
}

function runCell(trainRows, hidden) {
  const ex = trainRows.map((r) => ({ vector: vec(r), archetype: r.label }));
  const cats = [...new Set(ex.map((e) => e.archetype))].sort();
  const models = [];
  for (let i = 0; i < ENSEMBLE; i++) {
    models.push(trainArchetypeELMNumeric(ex, cats, BASE_SEED + i * 7919, hidden));
  }

  const scored = [];
  let sinkPred = 0;
  for (const r of testRows) {
    const votes = new Map();
    let marginSum = 0;
    for (const m of models) {
      const top = m.elm.predictTopKFromVector(vec(r), 2);
      votes.set(top[0].label, (votes.get(top[0].label) ?? 0) + 1);
      marginSum += top.length > 1 ? top[0].prob - top[1].prob : top[0].prob;
    }
    const [winner, wv] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    if (SINK.has(winner)) sinkPred++;
    scored.push({ correct: winner === r.label, signal: wv / models.length, margin: marginSum / models.length });
  }

  const correct = scored.filter((s) => s.correct).length;
  const labelCounts = new Map();
  for (const r of testRows) labelCounts.set(r.label, (labelCounts.get(r.label) ?? 0) + 1);
  const majority = Math.max(...labelCounts.values()) / testRows.length;

  return {
    trainRows: trainRows.length,
    classes: cats.length,
    precision: correct / scored.length,
    majority,
    aucVote: auc(scored),
    aucMargin: auc(scored.map((s) => ({ correct: s.correct, signal: s.margin }))),
    predSink: sinkPred / testRows.length,
    teachSink: testRows.filter((r) => SINK.has(r.label)).length / testRows.length,
    distinct: new Set(scored.map((_, i) => i)).size && new Set(testRows.map((r, i) => scored[i])).size,
  };
}

console.log("\n" + "=".repeat(100));
console.log(`TJ-E1 capacity x corpus sweep   ensemble=${ENSEMBLE}   seed=${BASE_SEED}`);
console.log("=".repeat(100));
console.log(`held out (all cells)  ${HELD_OUT_REPOS.join(" + ")} — ${testRows.length} rows`);
console.log(`majority baseline     ${(100 * Math.max(...(() => { const m = new Map(); for (const r of testRows) m.set(r.label, (m.get(r.label) ?? 0) + 1); return [...m.values()]; })()) / testRows.length).toFixed(1)}%`);
console.log(`teacher sink share    ${(100 * testRows.filter((r) => SINK.has(r.label)).length / testRows.length).toFixed(1)}%`);

console.log("\n" + "-".repeat(100));
console.log(
  `${"corpus".padEnd(12)} ${"hidden".padStart(7)} ${"rows".padStart(6)} ${"cls".padStart(4)} ` +
    `${"precision".padStart(10)} ${"vs maj".padStart(7)} ${"AUC vote".padStart(9)} ${"AUC margin".padStart(11)} ${"predSink".padStart(9)}`,
);
console.log("-".repeat(100));

const results = [];
for (const [cname, rows] of Object.entries(CORPORA)) {
  for (const h of CAPACITIES) {
    const t0 = Date.now();
    const r = runCell(rows, h);
    const d = r.precision - r.majority;
    results.push({ corpus: cname, hidden: h, ...r });
    console.log(
      `${cname.padEnd(12)} ${String(h).padStart(7)} ${String(r.trainRows).padStart(6)} ${String(r.classes).padStart(4)} ` +
        `${(100 * r.precision).toFixed(1).padStart(9)}% ${((d >= 0 ? "+" : "") + (100 * d).toFixed(1)).padStart(7)} ` +
        `${(r.aucVote ?? NaN).toFixed(3).padStart(9)} ${(r.aucMargin ?? NaN).toFixed(3).padStart(11)} ` +
        `${(100 * r.predSink).toFixed(1).padStart(8)}%   ${((Date.now() - t0) / 1000).toFixed(0)}s`,
    );
  }
}

console.log("-".repeat(100));
const base = results.find((r) => r.corpus === "n-dx only" && r.hidden === 128);
const best = results.reduce((a, b) => (b.precision > a.precision ? b : a));
const corpusEffect =
  results.find((r) => r.corpus === "all repos" && r.hidden === 128).precision - base.precision;
const capacityEffect =
  results.find((r) => r.corpus === "n-dx only" && r.hidden === 4096).precision - base.precision;

console.log(`\nEFFECT ISOLATION (both vs the n-dx/128 baseline of ${(100 * base.precision).toFixed(1)}%):`);
console.log(`  more corpus, same capacity   ${(corpusEffect >= 0 ? "+" : "") + (100 * corpusEffect).toFixed(1)} pp`);
console.log(`  more capacity, same corpus   ${(capacityEffect >= 0 ? "+" : "") + (100 * capacityEffect).toFixed(1)} pp`);
console.log(`  best cell                    ${best.corpus} @ ${best.hidden} = ${(100 * best.precision).toFixed(1)}% (majority ${(100 * best.majority).toFixed(1)}%)`);
console.log(
  `\n  Beating the majority baseline on UNSEEN repos is the thing that was previously failing.` +
    `\n  Baseline cell was ${((base.precision - base.majority) * 100).toFixed(1)} pp vs majority; best cell is ${((best.precision - best.majority) * 100).toFixed(1)} pp.`,
);
