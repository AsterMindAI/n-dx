/**
 * Eval script for TJ-A1 — the classify.ts ELM pre-filter prototype.
 *
 * Produces the numbers that fill in ADR-2026-08-11-jarrett-elm-prefilter-classify.md's
 * Evidence section: fixed seed, an explicit train/held-out split, a majority-class
 * baseline (reported for context only), and a precision/coverage curve across
 * confidence thresholds — the actual gate, see the ADR for why a flat
 * accuracy-vs-baseline number was replaced with this.
 *
 * Prerequisite (not yet satisfied as of 2026-08-12 — see IMPL Step 2b): both
 * classification sources below need `ndx analyze` run against them first. This script
 * errors with the exact missing path rather than silently producing fake numbers.
 *
 * The held-out source is deliberately NOT a hardcoded relative sibling path — see the
 * ADR Evidence section on why `../AsterMind-Community-Edition` isn't portable across
 * checkouts/machines. Pass it explicitly:
 *
 *   SV_ELM_HELDOUT_CLASSIFICATIONS=/path/to/AsterMind-Community-Edition/.sourcevision/classifications.json \
 *     node --experimental-strip-types packages/sourcevision/scripts/eval-classify-elm.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Classifications } from "../src/schema/index.ts";
import {
  extractExamples,
  trainArchetypeELM,
  predictArchetype,
  type ArchetypeExample,
  type TrainedArchetypeELM,
} from "../src/analyzers/classify-elm.ts";

const SEED = 20260812; // fixed — see ADR Evidence
const TRAIN_FRACTION = 0.8; // 80% train / 20% internal held-out, drawn from the training-source repo
const PRECISION_TARGET = 0.95; // proposed gate, ADR Evidence
// A threshold that resolves one lucky example at 100% precision is not a pass. Require the
// gate to hold over a meaningful slice of the held-out set, not just whatever the threshold
// happens to catch.
const MIN_COVERAGE_FOR_GATE = 0.15;
// Empirically calibrated 2026-08-12: this ELM's ridge-regression softmax readout produces a
// diffuse confidence distribution (observed range ~0.08-0.20 on training data, argmax still
// meaningful) rather than the near-0/near-1 spread a sweep starting at 0.5 assumes. A sweep
// anchored above the model's actual output range shows 0% coverage everywhere and looks like
// a broken model rather than a miscalibrated sweep — verify against your own model's
// distribution before reusing these numbers on a different feature encoding or label set.
const THRESHOLDS = [0.08, 0.10, 0.12, 0.14, 0.16, 0.18, 0.20, 0.25, 0.30];

const TRAINING_SOURCE = resolve(import.meta.dirname, "../../../.sourcevision/classifications.json");
const HELD_OUT_SOURCE = process.env.SV_ELM_HELDOUT_CLASSIFICATIONS;

function loadClassifications(path: string, label: string): Classifications {
  if (!existsSync(path)) {
    throw new Error(
      `Missing ${label} classifications at ${path}. Run \`ndx analyze\` there first — ` +
        `see IMPL-2026-08-11-jarrett-classify-elm-swap.md Step 2b.`,
    );
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

/** Seeded Fisher-Yates, independent of the ELM's own seeded PRNG, so the split is reproducible on its own. */
function splitTrainHeldOut(
  examples: ArchetypeExample[],
  seed: number,
  trainFraction: number,
): { train: ArchetypeExample[]; heldOut: ArchetypeExample[] } {
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

function majorityBaseline(train: ArchetypeExample[]): {
  label: string;
  accuracy: (test: ArchetypeExample[]) => number;
} {
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
  trained: TrainedArchetypeELM,
  heldOut: ArchetypeExample[],
  thresholds: number[],
): CurveRow[] {
  const predictions = heldOut.map((ex) => ({
    truth: ex.archetype,
    ...predictArchetype(trained, ex.text),
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
    const belowCoverageFloor = row.precision !== null && row.precision >= PRECISION_TARGET && row.coverage < MIN_COVERAGE_FOR_GATE;
    const flag = clearsGate ? "  <- clears gate" : belowCoverageFloor ? `  <- precision clears target but coverage < ${(MIN_COVERAGE_FOR_GATE * 100).toFixed(0)}% floor, not a real pass` : "";
    console.log(
      `  t=${row.threshold.toFixed(2)}  coverage=${(row.coverage * 100).toFixed(1)}%  precision=${precisionStr}${flag}`,
    );
  }
}

async function main(): Promise<void> {
  if (!HELD_OUT_SOURCE) {
    throw new Error(
      "SV_ELM_HELDOUT_CLASSIFICATIONS is not set. Point it at the held-out codebase's " +
        "classifications.json (AsterMind-Community-Edition, per ADR Evidence) — see this " +
        "script's header comment for the exact invocation.",
    );
  }

  const trainingSource = loadClassifications(TRAINING_SOURCE, "training-source (this repo)");
  const heldOutSource = loadClassifications(HELD_OUT_SOURCE, "held-out (AsterMind-Community-Edition)");

  const allExamples = extractExamples(trainingSource);
  const categories = [...new Set(allExamples.map((e) => e.archetype))].sort();

  const { train, heldOut: internalHeldOut } = splitTrainHeldOut(allExamples, SEED, TRAIN_FRACTION);
  const externalHeldOut = extractExamples(heldOutSource).filter((e) => categories.includes(e.archetype));

  console.log(`Training examples: ${train.length}`);
  console.log(`Internal held-out (this repo, unseen split): ${internalHeldOut.length}`);
  console.log(`External held-out (AsterMind-Community-Edition): ${externalHeldOut.length}`);
  console.log(`Categories (${categories.length}): ${categories.join(", ")}`);

  const baseline = majorityBaseline(train);
  console.log(`\nMajority-class baseline: "${baseline.label}" (context only, not the gate — see ADR)`);
  console.log(`  internal held-out accuracy: ${(baseline.accuracy(internalHeldOut) * 100).toFixed(1)}%`);
  if (externalHeldOut.length > 0) {
    console.log(`  external held-out accuracy: ${(baseline.accuracy(externalHeldOut) * 100).toFixed(1)}%`);
  }

  const trained = trainArchetypeELM(train, categories, SEED);

  printCurve("Internal held-out precision/coverage curve", precisionCoverageCurve(trained, internalHeldOut, THRESHOLDS));
  if (externalHeldOut.length > 0) {
    printCurve(
      "External held-out (AsterMind-Community-Edition) precision/coverage curve",
      precisionCoverageCurve(trained, externalHeldOut, THRESHOLDS),
    );
  } else {
    console.log("\nNo external held-out examples matched the trained category set — nothing to report.");
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
