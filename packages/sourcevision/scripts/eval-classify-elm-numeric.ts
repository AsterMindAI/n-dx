/**
 * Numeric-feature-representation eval for TJ-A1 — Realm's review item #2 (2026-08-19/20).
 *
 * Controlled A/B against eval-classify-elm.ts: same two codebases (this repo + AsterMind
 * Community Edition), same seed, same threshold sweep, same coverage floor — the ONLY thing
 * that changes is the feature representation (raw numeric per-archetype score vector instead
 * of tokenized "path + evidence hint" text). Deliberately NOT using the pooled 5-codebase data
 * from 2026-08-13 here — Realm's review point was that experiment confounded two variables
 * (more examples + more categories) in one run; this test isolates feature representation
 * alone by holding data volume and category count exactly constant against the original run.
 *
 * Needs inventory.json + imports.json alongside classifications.json for each codebase (the
 * text-mode script only needed classifications.json) — scoreArchetypeVector recomputes the
 * algorithmic signal fresh rather than reading classifications.json's evidence field.
 *
 * Usage:
 *   SV_ELM_HELDOUT_DIR=/path/to/AsterMind-Community-Edition/.sourcevision \
 *     node --experimental-strip-types packages/sourcevision/scripts/eval-classify-elm-numeric.ts
 *
 * TJ-A2 addition (2026-08-24): SV_ELM_EXTRA_TRAINING_DIRS (comma-separated .sourcevision dirs)
 * pools additional codebases into training, held-out set held fixed — retests the 2026-08-13
 * pooling question ("does more/diverse data help?") under the numeric representation, since the
 * only prior pooling result was measured under the text representation Knight's TextEncoder.ts
 * finding has since shown was separately broken (word-boundary loss, not just "indirect
 * encoding"). That result doesn't transfer automatically; this is the controlled re-run:
 *
 *   SV_ELM_EXTRA_TRAINING_DIRS=/path/to/express/.sourcevision,/path/to/indie-stack/.sourcevision,/path/to/zustand/.sourcevision \
 *     SV_ELM_HELDOUT_DIR=/path/to/AsterMind-Community-Edition/.sourcevision \
 *     node --experimental-strip-types packages/sourcevision/scripts/eval-classify-elm-numeric.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Classifications, Inventory, Imports } from "../src/schema/index.ts";
import {
  extractNumericExamples,
  trainArchetypeELMNumeric,
  predictArchetypeNumeric,
  type NumericArchetypeExample,
  type TrainedArchetypeELMNumeric,
} from "../src/analyzers/classify-elm.ts";

const SEED = 20260812; // same seed as the text-mode run, for comparability
const TRAIN_FRACTION = 0.8;
const PRECISION_TARGET = 0.95;
const MIN_COVERAGE_FOR_GATE = 0.15;
// Checked empirically before picking these (see 2026-08-20 session log): the numeric-feature
// model's observed confidence range on training data is ~0.09-0.18, even tighter than the
// text-mode model's ~0.08-0.19 — despite being a completely different input representation,
// this ELM's ridge-regression softmax readout produces a diffuse spread either way. Reusing
// the text-mode script's thresholds unchanged would have shown 0% coverage everywhere again.
const THRESHOLDS = [0.09, 0.11, 0.13, 0.15, 0.17, 0.19, 0.21, 0.25, 0.30];

const TRAINING_DIR = resolve(import.meta.dirname, "../../../.sourcevision");
const HELD_OUT_DIR = process.env.SV_ELM_HELDOUT_DIR;
const EXTRA_TRAINING_DIRS = (process.env.SV_ELM_EXTRA_TRAINING_DIRS ?? "")
  .split(",")
  .map((p) => p.trim())
  .filter((p) => p.length > 0);

interface SourcevisionData {
  classifications: Classifications;
  inventory: Inventory;
  imports: Imports;
}

function loadSourcevisionDir(dir: string, label: string): SourcevisionData {
  const paths = {
    classifications: join(dir, "classifications.json"),
    inventory: join(dir, "inventory.json"),
    imports: join(dir, "imports.json"),
  };
  for (const [key, path] of Object.entries(paths)) {
    if (!existsSync(path)) {
      throw new Error(`Missing ${label} ${key} at ${path}. Run \`ndx analyze --phase=1/2/3\` there first.`);
    }
  }
  return {
    classifications: JSON.parse(readFileSync(paths.classifications, "utf-8")),
    inventory: JSON.parse(readFileSync(paths.inventory, "utf-8")),
    imports: JSON.parse(readFileSync(paths.imports, "utf-8")),
  };
}

function splitTrainHeldOut(
  examples: NumericArchetypeExample[],
  seed: number,
  trainFraction: number,
): { train: NumericArchetypeExample[]; heldOut: NumericArchetypeExample[] } {
  let s = seed | 0 || 1;
  const rng = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
  const shuffled = [...examples];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const cut = Math.floor(shuffled.length * trainFraction);
  return { train: shuffled.slice(0, cut), heldOut: shuffled.slice(cut) };
}

function majorityBaseline(train: NumericArchetypeExample[]): { label: string; accuracy: (t: NumericArchetypeExample[]) => number } {
  const counts = new Map<string, number>();
  for (const ex of train) counts.set(ex.archetype, (counts.get(ex.archetype) ?? 0) + 1);
  let best = "";
  let bestCount = -1;
  for (const [label, count] of counts) {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }
  return {
    label: best,
    accuracy: (test) => (test.length === 0 ? NaN : test.filter((ex) => ex.archetype === best).length / test.length),
  };
}

interface CurveRow {
  threshold: number;
  coverage: number;
  precision: number | null;
}

function precisionCoverageCurve(
  trained: TrainedArchetypeELMNumeric,
  heldOut: NumericArchetypeExample[],
  thresholds: number[],
): CurveRow[] {
  const predictions = heldOut.map((ex) => ({
    truth: ex.archetype,
    ...predictArchetypeNumeric(trained, ex.vector),
  }));
  return thresholds.map((threshold) => {
    const resolved = predictions.filter((p) => p.confidence >= threshold);
    const correct = resolved.filter((p) => p.archetype === p.truth);
    return {
      threshold,
      coverage: predictions.length === 0 ? 0 : resolved.length / predictions.length,
      precision: resolved.length > 0 ? correct.length / resolved.length : null,
    };
  });
}

function printCurve(label: string, rows: CurveRow[]): void {
  console.log(`\n${label} (target precision >= ${PRECISION_TARGET}):`);
  for (const row of rows) {
    const precisionStr = row.precision === null ? "n/a" : `${(row.precision * 100).toFixed(1)}%`;
    const clearsGate = row.precision !== null && row.precision >= PRECISION_TARGET && row.coverage >= MIN_COVERAGE_FOR_GATE;
    const belowFloor = row.precision !== null && row.precision >= PRECISION_TARGET && row.coverage < MIN_COVERAGE_FOR_GATE;
    const flag = clearsGate ? "  <- clears gate" : belowFloor ? "  <- below coverage floor, not a real pass" : "";
    console.log(`  t=${row.threshold.toFixed(2)}  coverage=${(row.coverage * 100).toFixed(1)}%  precision=${precisionStr}${flag}`);
  }
}

async function main(): Promise<void> {
  if (!HELD_OUT_DIR) {
    throw new Error("SV_ELM_HELDOUT_DIR is not set — point it at AsterMind-Community-Edition's .sourcevision/ dir.");
  }

  const training = loadSourcevisionDir(TRAINING_DIR, "training-source (this repo)");
  const heldOut = loadSourcevisionDir(HELD_OUT_DIR, "held-out (AsterMind-Community-Edition)");

  let allExamples = extractNumericExamples(training.classifications, training.inventory, training.imports);
  if (EXTRA_TRAINING_DIRS.length > 0) {
    console.log(`Pooling ${EXTRA_TRAINING_DIRS.length} additional training source(s):`);
    for (const dir of EXTRA_TRAINING_DIRS) {
      const extra = loadSourcevisionDir(dir, `extra training source (${dir})`);
      const extraExamples = extractNumericExamples(extra.classifications, extra.inventory, extra.imports);
      console.log(`  ${dir} — ${extraExamples.length} examples`);
      allExamples = allExamples.concat(extraExamples);
    }
  }
  const categories = [...new Set(allExamples.map((e) => e.archetype))].sort();

  const { train, heldOut: internalHeldOut } = splitTrainHeldOut(allExamples, SEED, TRAIN_FRACTION);
  const externalAll = extractNumericExamples(heldOut.classifications, heldOut.inventory, heldOut.imports);
  const externalHeldOut = externalAll.filter((e) => categories.includes(e.archetype));

  console.log(`Training examples: ${train.length}`);
  console.log(`Internal held-out (this repo, unseen split): ${internalHeldOut.length}`);
  console.log(`External held-out (AsterMind-Community-Edition): ${externalHeldOut.length}`);
  console.log(`Categories (${categories.length}): ${categories.join(", ")}`);
  console.log(`Vector length: ${allExamples[0]?.vector.length} (= archetype catalog size)`);

  const baseline = majorityBaseline(train);
  console.log(`\nMajority-class baseline: "${baseline.label}" (context only, not the gate)`);
  console.log(`  internal held-out accuracy: ${(baseline.accuracy(internalHeldOut) * 100).toFixed(1)}%`);
  if (externalHeldOut.length > 0) {
    console.log(`  external held-out accuracy: ${(baseline.accuracy(externalHeldOut) * 100).toFixed(1)}%`);
  }

  const trained = trainArchetypeELMNumeric(train, categories, SEED);

  printCurve("Internal held-out precision/coverage curve", precisionCoverageCurve(trained, internalHeldOut, THRESHOLDS));
  if (externalHeldOut.length > 0) {
    printCurve("External held-out (AsterMind-Community-Edition) precision/coverage curve", precisionCoverageCurve(trained, externalHeldOut, THRESHOLDS));
  } else {
    console.log("\nNo external held-out examples matched the trained category set.");
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
