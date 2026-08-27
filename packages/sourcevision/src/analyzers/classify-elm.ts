/**
 * ELM-based pre-filter for classify.ts's LLM fallback.
 *
 * TJ-A1/TJ-A2 — see Claude-Context/ADR/ADR-2026-08-11-jarrett-elm-prefilter-classify.md and
 * Claude-Context/IMPL/IMPL-2026-08-23-jarrett-classify-elm-production-hardening.md.
 *
 * This module is intentionally standalone: it doesn't modify classify.ts or
 * analyze-phases.ts, it only reads the same FileClassification/Inventory/Imports shapes
 * those already produce and export (`analyzeClassifications` and `BUILTIN_ARCHETYPES` are
 * both imported, not reimplemented — see `extractNumericExamples`).
 *
 * Text-mode training (`fileToText`/`trainArchetypeELM`/`predictArchetype`) was retired here
 * 2026-08-27 — the numeric feature representation measurably outperforms it (100%@59.0%
 * vs. 60.9%@29.5% out-of-domain precision/coverage, see the ADR's Evidence section) and
 * Knight's TJ-K1 found the underlying reason: `useTokenizer: true`'s tokenizer doesn't
 * produce real token embeddings at all (`tokenize().join('')` with no separator destroys
 * word boundaries). The text-mode code is preserved in git history
 * (`elm/jarrett/classify-elm-prefilter` prior to this commit), not carried forward.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ELM } from "@astermind/astermind-community";
import { analyzeClassifications } from "./classify.js";
import { BUILTIN_ARCHETYPES } from "./archetypes.js";
import type {
  Classifications,
  FileClassification,
  Imports,
  Inventory,
} from "../schema/index.js";

const HIDDEN_UNITS = 128;

/**
 * Default confidence threshold for production wiring. Resolved 2026-08-24
 * (`ADR-2026-08-24-realm-elm-primary-classifier-pivot.md`, independently reproduced from
 * both `TJ-A1`'s and `TJ-K1`'s actual committed eval scripts): the coverage-favoring end of
 * the verified 0.11-0.15 range, where this repo's own held-out curve shows 100% precision
 * at 59.0% coverage — identical across that whole range, so the lower (more permissive)
 * end is used. Provisional pending re-verification once `TJ-A3`'s archetype-catalog work
 * lands (see `Notes/NOTE-realm-to-archer-2026-08-27-tjr1-stays-provisional.md`) — overridable
 * via `.n-dx.json`'s `sourcevision.classification.elmPrefilter.confidenceThreshold` in the
 * meantime, which is exactly what that override exists for.
 */
export const DEFAULT_ELM_CONFIDENCE_THRESHOLD = 0.11;

export interface ELMPrediction {
  archetype: string;
  confidence: number;
}

// ── Numeric feature representation (Realm's review, 2026-08-19/20; extraction reworked
// 2026-08-24 per Knight's TJ-K1 critique) ───────────────────────────────────────────────
//
// classifyFile computes a per-archetype weighted score for every file
// (classify.ts:135-208/159-165). Feeding that directly as a numeric vector — rather than
// as a tokenized "path + archetypeId(weight) hint" string — is what made the difference
// between not clearing the ADR's gate and clearing it by a wide margin.
//
// Originally (2026-08-20) this reimplemented classify.ts's private matchSignal/classifyFile
// independently, to avoid needing any new export from classify.ts. Knight's TJ-K1 correctly
// called that out as a real maintenance risk — duplicated logic drifts silently if
// classify.ts's archetype-matching regexes ever change. Reworked 2026-08-24 to instead call
// the real, already-exported analyzeClassifications() and derive the per-archetype vector
// from its returned evidence array. classify.ts still isn't modified — analyzeClassifications
// was already public — this just uses it instead of reimplementing what it does.

/**
 * Build a fixed-length per-archetype score vector (one entry per archetype in `archetypes`,
 * 0 if no signal matched) from a FileClassification's evidence array. Evidence can contain
 * multiple entries for the same archetype (one per matched signal) — summed, matching how
 * classifyFile accumulates archetypeScore internally (classify.ts:147-171).
 */
function evidenceToVector(evidence: FileClassification["evidence"], archetypeIndex: Map<string, number>): number[] {
  const vector = new Array(archetypeIndex.size).fill(0);
  for (const e of evidence ?? []) {
    const idx = archetypeIndex.get(e.archetypeId);
    if (idx !== undefined) vector[idx] += e.weight;
  }
  return vector;
}

export interface NumericArchetypeExample {
  vector: number[];
  archetype: string;
}

/**
 * Extract (score-vector, archetype) pairs by re-running the free, deterministic
 * analyzeClassifications() against inventory.json/imports.json to get fresh evidence for
 * every file, then joining it with classifications.json's FINAL label regardless of which
 * stage resolved it. Recomputing from analyzeClassifications() (rather than reading
 * classifications.json's own stored evidence field) sidesteps the evidence-leakage question
 * entirely rather than working around it — nothing stored to leak, since source: "llm"
 * entries' stored evidence (classify.ts:461-469) is never read here.
 *
 * Passes through any custom archetypes present in `classifications.archetypes` so a project
 * with `.n-dx.json` archetype overrides gets a faithful re-score, not just the built-in set.
 */
export function extractNumericExamples(
  classifications: Classifications,
  inventory: Inventory,
  imports: Imports,
): NumericArchetypeExample[] {
  const builtinIds = new Set(BUILTIN_ARCHETYPES.map((a) => a.id));
  const customArchetypes = classifications.archetypes.filter((a) => !builtinIds.has(a.id));

  const freshPass = analyzeClassifications(inventory, imports, {
    customArchetypes: customArchetypes.length > 0 ? customArchetypes : undefined,
  });
  const evidenceByPath = new Map(freshPass.files.map((f) => [f.path, f.evidence]));
  const archetypeIndex = new Map(classifications.archetypes.map((a, i) => [a.id, i]));
  const classificationByPath = new Map(classifications.files.map((f) => [f.path, f]));

  const examples: NumericArchetypeExample[] = [];
  for (const file of inventory.files) {
    if (file.role !== "source") continue;
    const fc = classificationByPath.get(file.path);
    if (!fc?.archetype) continue;
    if (fc.source !== "algorithmic" && fc.source !== "llm") continue;
    const vector = evidenceToVector(evidenceByPath.get(file.path), archetypeIndex);
    examples.push({ vector, archetype: fc.archetype });
  }
  return examples;
}

export interface TrainedArchetypeELMNumeric {
  elm: ELM;
  categories: string[];
}

/** Train a base ELM on raw numeric score vectors (NumericConfig, no tokenizer) instead of text. */
export function trainArchetypeELMNumeric(
  examples: NumericArchetypeExample[],
  categories: string[],
  seed: number,
): TrainedArchetypeELMNumeric {
  const inputSize = examples[0]?.vector.length;
  if (!inputSize) {
    throw new Error("trainArchetypeELMNumeric: no examples to infer vector length from");
  }

  const elm = new ELM({
    categories,
    hiddenUnits: HIDDEN_UNITS,
    useTokenizer: false,
    inputSize,
    seed,
  });

  const categoryIndex = new Map(categories.map((c, i) => [c, i]));
  const X: number[][] = [];
  const y: number[] = [];
  for (const ex of examples) {
    const idx = categoryIndex.get(ex.archetype);
    if (idx === undefined) continue;
    X.push(ex.vector);
    y.push(idx);
  }
  if (X.length === 0) {
    throw new Error("trainArchetypeELMNumeric: no examples matched the given category set");
  }

  elm.trainFromData(X, y);
  return { elm, categories };
}

/** Classify one file's precomputed score vector. Same confidence semantics as predictArchetype. */
export function predictArchetypeNumeric(trained: TrainedArchetypeELMNumeric, vector: number[]): ELMPrediction {
  const [top] = trained.elm.predictTopKFromVector(vector, 1);
  return { archetype: top.label, confidence: top.prob };
}

// ── Model lifecycle (TJ-A2, option C: hybrid — confirmed by the user 2026-08-24) ────────
//
// Neither TJ-A1 nor TJ-K1's prototypes addressed how a trained model actually exists at
// real `ndx analyze` runtime — the eval scripts train fresh inside a one-off invocation and
// discard it. Production needs an actual answer:
//
// - A brand-new project's first `ndx analyze` run has no classification history to train
//   on — falls back to a bundled baseline model, trained offline on a pooled 5-codebase
//   corpus (`scripts/train-baseline-elm.ts`) and shipped with the npm package
//   (`classify-elm-baseline-model.json`, copied into `dist/` by `copy-assets.mjs`).
// - Once a project's own history clears a minimum size, train fresh on that project's own
//   data instead — no persisted per-project model to version or go stale, consistent with
//   how this codebase already treats zones/classifications (recomputed each run from
//   cached inputs, not a trained artifact).

const COLD_START_MIN_EXAMPLES = 30;
const COLD_START_MIN_CATEGORIES = 3;
// Found empirically 2026-08-27, not assumed: trained a fresh model on this repo's own
// 423 purely-algorithmic examples (11 categories — clears the two thresholds above easily)
// and found its confidence on the actual unclassified population sits right at a cliff
// (0% resolved at t=0.10, ~all-or-nothing at 0.11) that the validated 0.11-0.15 default
// was never calibrated against — that default came from a training set that included 94
// source: "llm" examples (see ADR Evidence, "Numeric feature representation"). A model
// trained on algorithmic-only data generalizes to genuinely novel files differently than
// one that's also seen some of the "hard" (LLM-resolved) population during training — the
// confidence threshold isn't just data-*volume*-sensitive, it's sensitive to whether the
// training set includes examples of the population it's meant to generalize to. Requiring
// a minimum of LLM-sourced examples specifically, not just any-source volume, keeps fresh
// training gated on the kind of data the validated threshold actually applies to; below
// that, the bundled baseline (trained on a corpus that does include LLM-sourced examples)
// is the safer choice even if the project's own algorithmic-only history is large.
const COLD_START_MIN_LLM_EXAMPLES = 20;

/**
 * Whether a project's own classification history is large/diverse enough to train a fresh
 * ELM on, rather than falling back to the bundled baseline. Thresholds are deliberately
 * conservative (IMPL-2026-08-23's Design decision) — training on too few examples, too few
 * categories, or without enough LLM-sourced ("hard case") examples specifically risks a
 * confidently-wrong model, which has no safety net once wired in ahead of the LLM fallback.
 */
export function hasEnoughHistoryForFreshTraining(classifications: Classifications): boolean {
  const labeled = classifications.files.filter(
    (fc): fc is FileClassification & { archetype: string } =>
      !!fc.archetype && (fc.source === "algorithmic" || fc.source === "llm"),
  );
  const categories = new Set(labeled.map((fc) => fc.archetype));
  const llmSourcedCount = labeled.filter((fc) => fc.source === "llm").length;
  return (
    labeled.length >= COLD_START_MIN_EXAMPLES &&
    categories.size >= COLD_START_MIN_CATEGORIES &&
    llmSourcedCount >= COLD_START_MIN_LLM_EXAMPLES
  );
}

/**
 * Whether the bundled baseline model is usable for this project's archetype catalog. The
 * baseline was trained on the built-in archetype set only (see `train-baseline-elm.ts`) — a
 * project with `.n-dx.json` custom archetypes has categories the baseline has never seen
 * and whose input-vector dimensionality won't match, so it's excluded rather than silently
 * mismatched.
 */
export function canUseBaselineModel(classifications: Classifications): boolean {
  const builtinIds = new Set(BUILTIN_ARCHETYPES.map((a) => a.id));
  return (
    classifications.archetypes.length === BUILTIN_ARCHETYPES.length &&
    classifications.archetypes.every((a) => builtinIds.has(a.id))
  );
}

interface BaselineModelArtifact {
  schemaVersion: number;
  trainedAt: string;
  seed: number;
  categories: string[];
  catalogSize: number;
  trainingExampleCount: number;
  trainingSources: string[];
  model: unknown; // ELM's own serialized {config, W, b, B} shape — opaque here, see ELM.loadModelFromJSON
}

// Resolved relative to this module's own location (not process.cwd()) so it works
// regardless of where `ndx analyze` is invoked from — same reasoning as any other
// package-bundled asset.
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const BASELINE_MODEL_PATH = join(MODULE_DIR, "classify-elm-baseline-model.json");

let cachedBaselineArtifact: BaselineModelArtifact | undefined;

function loadBaselineModelArtifact(): BaselineModelArtifact {
  if (!cachedBaselineArtifact) {
    const parsed: BaselineModelArtifact = JSON.parse(readFileSync(BASELINE_MODEL_PATH, "utf-8"));
    cachedBaselineArtifact = parsed;
  }
  return cachedBaselineArtifact;
}

/** Load the bundled cold-start baseline model. Caller should check `canUseBaselineModel` first. */
export function loadBaselineArchetypeELM(): TrainedArchetypeELMNumeric {
  const artifact = loadBaselineModelArtifact();
  const elm = new ELM({
    categories: artifact.categories,
    hiddenUnits: HIDDEN_UNITS,
    useTokenizer: false,
    inputSize: artifact.catalogSize,
  });
  elm.loadModelFromJSON(JSON.stringify(artifact.model));
  return { elm, categories: artifact.categories };
}

/**
 * Single entry point for production wiring: returns a trained model, choosing fresh
 * per-project training or the bundled baseline per the hybrid lifecycle above, or
 * `undefined` if neither is usable (too little project history *and* custom archetypes
 * present) — callers should skip the ELM stage entirely in that case and fall through to
 * the LLM exactly as if this module didn't exist.
 */
export function getArchetypeELM(
  classifications: Classifications,
  inventory: Inventory,
  imports: Imports,
  seed: number,
): TrainedArchetypeELMNumeric | undefined {
  if (hasEnoughHistoryForFreshTraining(classifications)) {
    const examples = extractNumericExamples(classifications, inventory, imports);
    const categories = [...new Set(examples.map((e) => e.archetype))].sort();
    if (categories.length > 0) {
      return trainArchetypeELMNumeric(examples, categories, seed);
    }
  }
  if (canUseBaselineModel(classifications)) {
    return loadBaselineArchetypeELM();
  }
  return undefined;
}

export interface ELMClassifyResult {
  updatedFiles: FileClassification[];
}

/**
 * Classify the currently-unclassified population with a trained ELM. Mirrors
 * `enrichClassificationsWithLLM`'s `{ updatedFiles }` return shape so `runClassificationsPhase`
 * can merge the result via `mergeClassificationResults` exactly the same way it already merges
 * LLM results. Targets the same population `enrichClassificationsWithLLM` does
 * (`archetype === null && source === "algorithmic"`) — files this resolves never reach the
 * LLM; everything below `confidenceThreshold` (or predicting a category outside what the
 * model was trained on) is left untouched for the LLM fallback to handle as it does today.
 */
export function classifyWithELM(
  classifications: Classifications,
  inventory: Inventory,
  imports: Imports,
  trained: TrainedArchetypeELMNumeric,
  confidenceThreshold: number,
): ELMClassifyResult {
  const builtinIds = new Set(BUILTIN_ARCHETYPES.map((a) => a.id));
  const customArchetypes = classifications.archetypes.filter((a) => !builtinIds.has(a.id));
  const freshPass = analyzeClassifications(inventory, imports, {
    customArchetypes: customArchetypes.length > 0 ? customArchetypes : undefined,
  });
  const evidenceByPath = new Map(freshPass.files.map((f) => [f.path, f.evidence]));
  const archetypeIndex = new Map(classifications.archetypes.map((a, i) => [a.id, i]));
  const trainedCategorySet = new Set(trained.categories);

  const updatedFiles: FileClassification[] = [];
  for (const fc of classifications.files) {
    if (fc.archetype !== null || fc.source !== "algorithmic") continue;
    const vector = evidenceToVector(evidenceByPath.get(fc.path), archetypeIndex);
    const prediction = predictArchetypeNumeric(trained, vector);
    if (prediction.confidence < confidenceThreshold) continue;
    if (!trainedCategorySet.has(prediction.archetype)) continue; // defensive — shouldn't happen
    updatedFiles.push({
      path: fc.path,
      archetype: prediction.archetype,
      confidence: prediction.confidence,
      source: "elm",
    });
  }
  return { updatedFiles };
}
