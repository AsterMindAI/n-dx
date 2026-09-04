#!/usr/bin/env node
/**
 * Real-data accuracy benchmark for a text-mode ELM classifying source-file paths
 * into sourcevision archetypes.
 *
 * Phase 1 of `Claude-Context/IMPL/IMPL-2026-08-31-nala-classify-elm-rewrite.md`. Reports the
 * number the paired ADR's Evidence section requires before any gate code is written.
 *
 * Run: node scripts/classify-elm-eval.mjs
 * Reads: .sourcevision/classifications.json (regenerate first with `ndx analyze .` /
 *   `node packages/sourcevision/dist/cli/index.js analyze .` if it's missing or stale).
 *
 * ── Important correction to a prior assumption in this repo ─────────────────────────────
 * `scripts/elm-hello-world.mjs` calls `elm.train(TRAINING_SET)` expecting `TRAINING_SET` (an
 * array of {text,label} pairs) to be the training data. It is not: `ELM.train()`'s only
 * parameter is `augmentationOptions` (`{suffixes, prefixes, includeNoise}`) — passed an array,
 * every one of those properties reads `undefined`, so the call is silently equivalent to
 * `elm.train()` with defaults. The model that method builds is trained ONLY on character-level
 * augmented variants of `categories` (the label strings themselves, e.g. "route"), never on any
 * example text supplied by a caller. Confirmed empirically: three ELMs trained with (a) a
 * real-looking training set, (b) a contradictory/garbage training set, and (c) no argument at
 * all produce byte-identical model weights and byte-identical predictions. `elm-hello-world.mjs`'s
 * 83%-accuracy claim is therefore not evidence that the library learns from labeled path
 * examples — it measures something else (character similarity between raw path text and the
 * three label words themselves), and should not be cited as proof of that going forward.
 *
 * This script uses the API that actually does train from labeled examples:
 * `UniversalEncoder` (encode text → fixed-length numeric vector) feeding `ELM.trainFromData(X, y)`
 * — the same numeric-mode training path the (abandoned) evidence-vector design used correctly.
 * Sanity-checked with a shuffled-label control: real labels scored 6/6 on held-out synthetic
 * paths, shuffled labels scored 3/6 (chance, for 3 classes) — confirming `trainFromData` genuinely
 * learns from X/y and doesn't share `train()`'s bug.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Split method: stratified 80/20 per archetype, not a single global shuffle-and-cut. With class
 * counts this imbalanced (1 to 83 examples per archetype at last run), a global split risks a
 * held-out set with zero examples of a rare class. Classes with fewer than 2 examples are kept
 * entirely in training and excluded from the held-out count (can't evaluate what you never
 * held out) — reported separately below, not silently dropped.
 *
 * Seed: 42 (kept for continuity with elm-hello-world.mjs's seed, though that script's number
 * doesn't transfer — see correction above). Seeded shuffle is a local mulberry32, not
 * Math.random(), so this run is exactly reproducible.
 */

import { readFileSync } from "node:fs";
import { ELM, UniversalEncoder } from "@astermind/astermind-community";

const CLASSIFICATIONS_PATH = ".sourcevision/classifications.json";
const SEED = 42;
const HIDDEN_UNITS = 512;
/** '-' MUST stay last in the char set — unescaped RegExp class gotcha (see elm-hello-world.mjs). */
const CHAR_SET = "abcdefghijklmnopqrstuvwxyz0123456789./_-";
const TOKENIZER_DELIMITER = /[/._-]+/;
/** Longest real path in this run's labeled set was 70 chars; 80 gives headroom without measuring per-run. */
const MAX_LEN = 80;
const TRAIN_FRACTION = 0.8;
/** Below this many examples, a class stays entirely in training (see Split method above). */
const MIN_FOR_HOLDOUT = 2;

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function main() {
  console.log("classify-elm-eval — text-mode ELM on real sourcevision path/archetype labels\n");

  const raw = JSON.parse(readFileSync(CLASSIFICATIONS_PATH, "utf8"));
  const allArchetypeIds = raw.archetypes.map((a) => a.id);
  const labeled = raw.files.filter(
    (f) => f.archetype && (f.source === "algorithmic" || f.source === "llm"),
  );

  if (labeled.length === 0) {
    console.error(`No labeled files found in ${CLASSIFICATIONS_PATH}. Run analyze first.`);
    process.exit(1);
  }

  console.log(`archetype catalog: ${allArchetypeIds.length} ids`);
  console.log(`labeled examples: ${labeled.length} (source algorithmic/llm, archetype != null)\n`);

  // Group by archetype, stratified shuffle+split.
  const byArchetype = new Map();
  for (const f of labeled) {
    if (!byArchetype.has(f.archetype)) byArchetype.set(f.archetype, []);
    byArchetype.get(f.archetype).push(f);
  }

  const rng = mulberry32(SEED);
  const trainSet = [];
  const heldOut = [];
  const excludedFromHoldout = [];

  for (const [archetype, files] of byArchetype) {
    const shuffled = seededShuffle(files, rng);
    if (shuffled.length < MIN_FOR_HOLDOUT) {
      trainSet.push(...shuffled);
      excludedFromHoldout.push({ archetype, count: shuffled.length });
      continue;
    }
    const splitAt = Math.max(1, Math.round(shuffled.length * TRAIN_FRACTION));
    trainSet.push(...shuffled.slice(0, splitAt));
    heldOut.push(...shuffled.slice(splitAt));
  }

  console.log(`train: ${trainSet.length} · held-out: ${heldOut.length}`);
  if (excludedFromHoldout.length > 0) {
    console.log(
      `classes kept entirely in training (< ${MIN_FOR_HOLDOUT} examples, not evaluable): ` +
        excludedFromHoldout.map((e) => `${e.archetype}(${e.count})`).join(", "),
    );
  }
  console.log("");

  // Baselines
  const uniformBaseline = 1 / allArchetypeIds.length;
  const trainCounts = new Map();
  for (const f of trainSet) trainCounts.set(f.archetype, (trainCounts.get(f.archetype) ?? 0) + 1);
  const majorityClass = [...trainCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const majorityBaseline = majorityClass[1] / trainSet.length;

  console.log(`uniform baseline (1/${allArchetypeIds.length}): ${(uniformBaseline * 100).toFixed(1)}%`);
  console.log(
    `majority-class baseline (always predict "${majorityClass[0]}"): ${(majorityBaseline * 100).toFixed(1)}%`,
  );
  console.log("(majority-class is the harder, more honest baseline to beat — report both.)\n");

  // Encode + train
  const encoder = new UniversalEncoder({
    charSet: CHAR_SET,
    maxLen: MAX_LEN,
    useTokenizer: true,
    tokenizerDelimiter: TOKENIZER_DELIMITER,
    mode: "char",
  });

  const X = trainSet.map((f) => encoder.normalize(encoder.encode(f.path)));
  const y = trainSet.map((f) => allArchetypeIds.indexOf(f.archetype));

  const elm = new ELM({
    categories: allArchetypeIds,
    hiddenUnits: HIDDEN_UNITS,
    inputSize: encoder.getVectorSize(),
    activation: "relu",
    useTokenizer: false, // numeric mode — encoding is done manually above via UniversalEncoder
    seed: SEED,
    log: { modelName: "classify-elm-eval", verbose: false },
  });

  const startedAt = process.hrtime.bigint();
  elm.trainFromData(X, y);
  const trainMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  console.log(`trained on ${trainSet.length} examples in ${trainMs.toFixed(1)}ms\n`);

  // Evaluate
  let correct = 0;
  const confusion = [];
  for (const f of heldOut) {
    const vec = encoder.normalize(encoder.encode(f.path));
    const probs = elm.predictProbaFromVector(vec);
    let bestIdx = 0;
    for (let i = 1; i < probs.length; i++) if (probs[i] > probs[bestIdx]) bestIdx = i;
    const predicted = allArchetypeIds[bestIdx];
    const hit = predicted === f.archetype;
    if (hit) correct++;
    else confusion.push({ path: f.path, expected: f.archetype, predicted, prob: probs[bestIdx] });
  }

  const accuracy = correct / heldOut.length;
  console.log(`held-out accuracy: ${correct}/${heldOut.length} (${(accuracy * 100).toFixed(1)}%)`);
  console.log(`  vs uniform baseline:        ${(uniformBaseline * 100).toFixed(1)}%`);
  console.log(`  vs majority-class baseline: ${(majorityBaseline * 100).toFixed(1)}%\n`);

  if (confusion.length > 0) {
    console.log(`misclassified (${confusion.length}):`);
    for (const c of confusion.slice(0, 30)) {
      console.log(`  ${c.path.padEnd(55)} expected ${c.expected.padEnd(15)} got ${c.predicted} (${c.prob.toFixed(3)})`);
    }
    if (confusion.length > 30) console.log(`  ... and ${confusion.length - 30} more`);
  }

  // Acceptance bar per the IMPL: 2x majority-class baseline, floor 60%.
  const bar = Math.max(majorityBaseline * 2, 0.6);
  console.log(`\nacceptance bar (2x majority-class baseline, 60% floor): ${(bar * 100).toFixed(1)}%`);
  if (accuracy >= bar) {
    console.log("RESULT: CLEARS the bar — Phase 2 (shadow-mode implementation) is justified.");
  } else {
    console.log("RESULT: DOES NOT CLEAR the bar — do not proceed to Phase 2 on this evidence.");
    process.exitCode = 1;
  }
}

main();
