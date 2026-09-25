/**
 * Regenerates the bundled cold-start baseline model — TJ-A2 IMPL Step 3/4, option C
 * (hybrid model lifecycle): a project's first `ndx analyze` run has no classification
 * history to train the ELM pre-filter on, so it falls back to this pre-trained baseline
 * until its own history clears the cold-start threshold (see `classify-elm.ts`'s
 * `hasEnoughHistoryForFreshTraining`).
 *
 * Run at release time, not at user runtime — this is a development script, its output
 * (`classify-elm-baseline-model.json`) is what ships in the npm package.
 *
 * Trains on the pooled 5-codebase corpus confirmed in IMPL-2026-08-23's Design decision
 * section (this repo + AsterMind-Community-Edition + express + indie-stack + zustand) —
 * pooling was measured neutral-to-positive under the numeric representation (ADR
 * Evidence, "Reconciling TJ-A1/TJ-K1's divergent extraction methods"), and adds archetype
 * coverage (`middleware`, `model`) the 2-codebase set lacks, which matters more for a
 * cold-start baseline than optimizing one held-out number.
 *
 * Usage:
 *   SV_ELM_BASELINE_TRAINING_DIRS=/path/to/AsterMind-Community-Edition/.sourcevision,/path/to/express/.sourcevision,/path/to/indie-stack/.sourcevision,/path/to/zustand/.sourcevision \
 *     node --experimental-strip-types packages/sourcevision/scripts/train-baseline-elm.ts
 *
 * (This repo's own .sourcevision/ is always included automatically, same as the eval scripts.)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Classifications, Inventory, Imports } from "../src/schema/index.ts";
import { extractNumericExamples, trainArchetypeELMNumeric } from "../src/analyzers/classify-elm.ts";

const SEED = 20260812; // same seed used throughout TJ-A1/TJ-A2 for comparability

const TRAINING_DIR = resolve(import.meta.dirname, "../../../.sourcevision");
const EXTRA_TRAINING_DIRS = (process.env.SV_ELM_BASELINE_TRAINING_DIRS ?? "")
  .split(",")
  .map((p) => p.trim())
  .filter((p) => p.length > 0);

const OUTPUT_PATH = resolve(import.meta.dirname, "../src/analyzers/classify-elm-baseline-model.json");

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

async function main(): Promise<void> {
  const training = loadSourcevisionDir(TRAINING_DIR, "training-source (this repo)");
  let allExamples = extractNumericExamples(training.classifications, training.inventory, training.imports);
  const catalogSize = training.classifications.archetypes.length;

  console.log(`Base training examples (this repo): ${allExamples.length}`);
  for (const dir of EXTRA_TRAINING_DIRS) {
    const extra = loadSourcevisionDir(dir, `extra training source (${dir})`);
    const extraExamples = extractNumericExamples(extra.classifications, extra.inventory, extra.imports);
    console.log(`  + ${dir} — ${extraExamples.length} examples`);
    allExamples = allExamples.concat(extraExamples);
  }

  const categories = [...new Set(allExamples.map((e) => e.archetype))].sort();
  console.log(`Total training examples: ${allExamples.length}, categories: ${categories.length}`);

  if (allExamples.length === 0) {
    throw new Error("No training examples found — nothing to train the baseline on.");
  }

  const trained = trainArchetypeELMNumeric(allExamples, categories, SEED);
  const modelJSON = trained.elm.savedModelJSON;
  if (!modelJSON) {
    throw new Error("ELM training did not populate savedModelJSON — check trainFromData's metrics-gating logic.");
  }

  const artifact = {
    schemaVersion: 1,
    trainedAt: new Date().toISOString(),
    seed: SEED,
    categories,
    catalogSize,
    trainingExampleCount: allExamples.length,
    trainingSources: ["this-repo", ...EXTRA_TRAINING_DIRS],
    model: JSON.parse(modelJSON),
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(artifact, null, 2));
  console.log(`Wrote baseline model to ${OUTPUT_PATH}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
