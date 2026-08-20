#!/usr/bin/env node
/**
 * Eval script for the ELM archetype pre-filter (Knight's independent implementation
 * of ADR-2026-08-11-jarrett-elm-prefilter-classify.md / IMPL-2026-08-11-jarrett-
 * classify-elm-swap.md).
 *
 * Runs TWO feature representations side by side, controlled (same data, same
 * split, same hiddenUnits/seed) so the only thing that differs between them is
 * the representation itself — per Realm's 2026-08-19 review
 * (Claude-Context/Jarrett-Agents/Notes/NOTE-realm-to-archer-and-knight-2026-08-19-
 * elm-prefilter-review.md), the earlier pooled-training retry changed two
 * variables at once and couldn't isolate its own result; this comparison is
 * built not to repeat that mistake:
 *
 *   - "text"    — the original approach: path + evidence hints joined into one
 *                 string, run through the ELM's own char-level tokenizer.
 *   - "numeric" — Realm's suggested fix: `classifyFile`'s per-archetype
 *                 evidence scores as a direct fixed-length numeric vector,
 *                 concatenated with a path-only encoded vector.
 *
 * And two eval axes per representation, because they answer different questions:
 *
 *  1. In-domain (seeded Fisher-Yates 80/20 split of this repo's own classification
 *     data): trains on 80%, measures precision/coverage on the other 20%. Fast
 *     signal, but doesn't test generalization beyond n-dx's own naming conventions.
 *
 *  2. Out-of-domain generalization: trains on ALL of this repo's data, evaluates
 *     against a genuinely different codebase via SV_ELM_HELDOUT_DIR. This is the
 *     number that actually matters for the ADR's acceptance gate.
 *
 * Both a repo's classification data must already exist (run `ndx analyze` first —
 * this script does not call the LLM itself).
 *
 * Run:
 *   SV_ELM_HELDOUT_DIR=../../AsterMind-Community-Edition/.sourcevision \
 *     node --experimental-strip-types scripts/eval-classify-elm.ts
 *
 * (Node 26 also runs .ts files directly without the flag; kept explicit for
 * portability with older Node in CI.)
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
// Imports from dist/, not src/: this script runs via type-stripping without a
// bundler, and the compiled output is what actually resolves the .js-extension
// import specifiers NodeNext-style source uses. Run `pnpm build` after editing
// src/analyzers/classify-elm.ts before re-running this script.
import {
  extractExamples,
  trainArchetypeELM,
  predictArchetype,
  trainArchetypeELMNumeric,
  predictArchetypeNumeric,
  type ArchetypeExample,
  type TrainedArchetypeELM,
} from "../dist/analyzers/classify-elm.js";
import type { Inventory, Imports, Classifications } from "../dist/schema/index.js";

const SEED = 20260812;
const TRAIN_DIR = process.env.SV_TRAIN_DIR ?? join(process.cwd(), ".sourcevision");
const HELDOUT_DIR = process.env.SV_ELM_HELDOUT_DIR;
// Wide low-end range: with ~17 candidate archetypes, softmax confidence over a
// ridge-regression readout stays diffuse even when the argmax is reliably
// correct (observed cluster on n-dx's own data: 0.13-0.23) — a naive high
// threshold range (0.5+) silently produces zero coverage everywhere and looks
// like a broken model when it's actually a miscalibrated sweep. Kept wide
// rather than narrowed to the observed cluster because the held-out codebase's
// distribution isn't known in advance.
const THRESHOLDS = [0.05, 0.1, 0.15, 0.18, 0.2, 0.22, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const TRAIN_SPLIT = 0.8;

// Same xorshift-ish PRNG shape AsterMind's own ELM uses internally, so the
// split's "randomness" is drawn from the same family as the model's own
// weight init — not load-bearing, just consistent style.
function makePRNG(seed: number): () => number {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadSV(dir: string): { inventory: Inventory; imports: Imports; classifications: Classifications } {
  const need = ["inventory.json", "imports.json", "classifications.json"];
  for (const f of need) {
    if (!existsSync(join(dir, f))) {
      throw new Error(
        `loadSV: ${join(dir, f)} missing. Run \`ndx analyze\` in that project first ` +
        `(this script only reads existing .sourcevision output, it never calls the LLM).`,
      );
    }
  }
  return {
    inventory: JSON.parse(readFileSync(join(dir, "inventory.json"), "utf-8")),
    imports: JSON.parse(readFileSync(join(dir, "imports.json"), "utf-8")),
    classifications: JSON.parse(readFileSync(join(dir, "classifications.json"), "utf-8")),
  };
}

function majorityBaseline(examples: ArchetypeExample[]): { archetype: string; rate: number } {
  const counts = new Map<string, number>();
  for (const e of examples) counts.set(e.archetype, (counts.get(e.archetype) ?? 0) + 1);
  let best = "", bestN = 0;
  for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n; }
  return { archetype: best, rate: examples.length ? bestN / examples.length : NaN };
}

interface CurveRow { threshold: number; n: number; correct: number; precision: number; coverage: number; }

type Representation = "text" | "numeric";

function trainByRepresentation(rep: Representation, examples: ArchetypeExample[], seed: number): TrainedArchetypeELM {
  return rep === "text"
    ? trainArchetypeELM(examples, { seed })
    : trainArchetypeELMNumeric(examples, { seed });
}

function predictByRepresentation(
  rep: Representation,
  model: TrainedArchetypeELM,
  e: ArchetypeExample,
): { archetype: string; confidence: number } {
  return rep === "text" ? predictArchetype(model, e.text) : predictArchetypeNumeric(model, e.path, e.evidence);
}

function precisionCoverageCurve(
  rep: Representation,
  model: TrainedArchetypeELM,
  testExamples: ArchetypeExample[],
): CurveRow[] {
  // Predict once, sweep thresholds over cached results — avoids re-running
  // inference per threshold.
  const preds = testExamples.map((e) => {
    const p = predictByRepresentation(rep, model, e);
    return { truth: e.archetype, predicted: p.archetype, confidence: p.confidence };
  });

  return THRESHOLDS.map((t) => {
    const atOrAbove = preds.filter((p) => p.confidence >= t);
    const correct = atOrAbove.filter((p) => p.predicted === p.truth).length;
    return {
      threshold: t,
      n: atOrAbove.length,
      correct,
      precision: atOrAbove.length ? correct / atOrAbove.length : NaN,
      coverage: preds.length ? atOrAbove.length / preds.length : NaN,
    };
  });
}

function printCurve(label: string, baseline: { archetype: string; rate: number }, rows: CurveRow[]) {
  console.log(`\n--- ${label} ---`);
  console.log(`majority-class baseline: "${baseline.archetype}" @ ${(baseline.rate * 100).toFixed(1)}% (context only, not the gate)`);
  console.log("threshold | n resolved | correct | precision | coverage");
  for (const r of rows) {
    const prec = Number.isNaN(r.precision) ? "  n/a " : `${(r.precision * 100).toFixed(1)}%`;
    console.log(
      `  ${r.threshold.toFixed(2)}    |    ${String(r.n).padStart(4)}    |  ${String(r.correct).padStart(4)}   |  ${prec.padStart(6)}  | ${(r.coverage * 100).toFixed(1)}%`,
    );
  }
}

// A threshold clearing 95% precision on a handful of resolved predictions
// (e.g. 1/47) isn't a meaningful pass — it's noise from a tiny n. Require
// real coverage too, or the gate silently overstates a trivial result.
const MIN_MEANINGFUL_COVERAGE = 0.1;

function reportGate(curve: CurveRow[]): void {
  const gateRow = curve.find((r) => r.precision >= 0.95 && r.coverage >= MIN_MEANINGFUL_COVERAGE);
  const trivialRow = curve.find((r) => r.precision >= 0.95 && r.n > 0 && r.coverage < MIN_MEANINGFUL_COVERAGE);
  if (gateRow) {
    console.log(`GATE: threshold ${gateRow.threshold} clears >=95% precision at ${(gateRow.coverage * 100).toFixed(1)}% coverage (n=${gateRow.n}) on held-out data. Passes.`);
  } else if (trivialRow) {
    console.log(
      `GATE: threshold ${trivialRow.threshold} technically clears >=95% precision but only resolves ${trivialRow.n} example(s) ` +
      `(${(trivialRow.coverage * 100).toFixed(1)}% coverage) — below the ${(MIN_MEANINGFUL_COVERAGE * 100).toFixed(0)}% coverage floor for a meaningful result. ` +
      `Does NOT pass the ADR's bar in any practically useful sense.`,
    );
  } else {
    console.log(`GATE: no threshold in [${THRESHOLDS.join(", ")}] clears >=95% precision at >=${(MIN_MEANINGFUL_COVERAGE * 100).toFixed(0)}% coverage on held-out data. Does not pass the ADR's bar as currently trained.`);
  }
}

function runRepresentation(
  rep: Representation,
  inDomainTrain: ArchetypeExample[],
  inDomainTest: ArchetypeExample[],
  allExamples: ArchetypeExample[],
  heldOutExamples: ArchetypeExample[] | null,
): void {
  console.log(`\n\n########## Representation: ${rep} ##########`);

  const inDomainModel = trainByRepresentation(rep, inDomainTrain, SEED);
  const inDomainCurve = precisionCoverageCurve(rep, inDomainModel, inDomainTest);
  printCurve(`[${rep}] In-domain (n-dx held-out split)`, majorityBaseline(inDomainTest), inDomainCurve);

  if (heldOutExamples) {
    const fullModel = trainByRepresentation(rep, allExamples, SEED); // train on ALL n-dx data this time
    const heldOutCurve = precisionCoverageCurve(rep, fullModel, heldOutExamples);
    printCurve(`[${rep}] Out-of-domain (genuinely different codebase)`, majorityBaseline(heldOutExamples), heldOutCurve);
    reportGate(heldOutCurve);
  }
}

function main() {
  console.log("=== ELM archetype classifier eval — Knight's independent implementation ===");
  console.log("Comparing 'text' (original) vs 'numeric' (Realm's 2026-08-19 fix) representations, controlled.");
  console.log(`seed=${SEED}  train dir=${TRAIN_DIR}  held-out dir=${HELDOUT_DIR ?? "(not set — skipping generalization eval)"}\n`);

  const train = loadSV(TRAIN_DIR);
  const allExamples = extractExamples(train.inventory, train.imports, train.classifications);
  console.log(`Loaded ${allExamples.length} labeled examples from ${TRAIN_DIR} (${train.classifications.files.length} files total).`);

  if (allExamples.length < 20) {
    console.error(`Too few examples (${allExamples.length}) to evaluate meaningfully. Aborting.`);
    process.exit(1);
  }

  const rng = makePRNG(SEED);
  const shuffled = shuffle(allExamples, rng);
  const splitAt = Math.floor(shuffled.length * TRAIN_SPLIT);
  const inDomainTrain = shuffled.slice(0, splitAt);
  const inDomainTest = shuffled.slice(splitAt);
  console.log(`In-domain split: ${inDomainTrain.length} train / ${inDomainTest.length} held-out (identical split for both representations).`);

  let heldOutExamples: ArchetypeExample[] | null = null;
  if (HELDOUT_DIR) {
    const heldOutData = loadSV(HELDOUT_DIR);
    heldOutExamples = extractExamples(heldOutData.inventory, heldOutData.imports, heldOutData.classifications);
    console.log(`Loaded ${heldOutExamples.length} labeled examples from held-out codebase ${HELDOUT_DIR}.`);
  } else {
    console.log("SKIPPED out-of-domain eval — set SV_ELM_HELDOUT_DIR to a second codebase's .sourcevision/ dir to run it.");
    console.log("The ADR's acceptance gate is measured on held-out data — run with SV_ELM_HELDOUT_DIR before treating any number here as a real result.");
  }

  runRepresentation("text", inDomainTrain, inDomainTest, allExamples, heldOutExamples);
  runRepresentation("numeric", inDomainTrain, inDomainTest, allExamples, heldOutExamples);
}

main();
