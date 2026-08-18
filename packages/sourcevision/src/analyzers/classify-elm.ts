/**
 * ELM-based confidence gate for LLM-assisted classification.
 *
 * `classify.ts`'s algorithmic pass already accumulates a weighted
 * per-archetype evidence score for every file; files that don't clear
 * PRIMARY_THRESHOLD fall through to the LLM. This module trains a small
 * Extreme Learning Machine (@astermind/astermind-community) on the current
 * run's confidently-classified files — evidence vector -> true archetype —
 * and uses it to try to resolve some of those below-threshold files locally,
 * at zero token cost, before they ever reach the LLM batch queue.
 *
 * Shadow mode by default: see ELM_GATE_ENABLED. The model always trains and
 * predicts so agreement-vs-LLM can be measured on real runs, but it does not
 * skip the LLM call until explicitly enabled. A wrong ELM label is silent
 * (no LLM in the loop to catch it), so this needs a validated agreement rate
 * before it's allowed to affect output. See HEAD_ENGINEER.md §5,
 * "2026-08-06 — ELM mechanism explained" for the reasoning behind this gate.
 */

import { ELM } from "@astermind/astermind-community";
import type { ClassificationEvidence, FileClassification } from "../schema/index.js";

/** Flip to true once shadow-mode agreement (logged during normal runs) has been validated. */
export const ELM_GATE_ENABLED: boolean = false;

/**
 * Minimum top1-vs-top2 probability margin required to trust an ELM
 * prediction. A margin gate is more conservative than raw top-1 probability
 * alone — softmax can be confidently wrong on inputs unlike its training data.
 */
const CONFIDENCE_MARGIN_THRESHOLD = 0.3;

/** Don't bother training on fewer confidently-labeled examples than this — too little signal. */
const MIN_TRAINING_EXAMPLES = 20;

const HIDDEN_UNITS = 64;
const RIDGE_LAMBDA = 1e-2;
/** Fixed seed: keeps gating/logging behavior reproducible run to run, not dependent on random init. */
const SEED = 42;

export interface ClassifyELMPrediction {
  archetype: string;
  /** Top-1 softmax probability. */
  confidence: number;
  /** Top1 - top2 probability gap — the actual gating signal. */
  margin: number;
}

export interface TrainedClassifyELM {
  elm: ELM;
  archetypeIds: string[];
}

/**
 * Build a dense per-archetype evidence-score vector from the sparse
 * evidence list the algorithmic pass already computed (grouped by
 * archetypeId and summed, since a file can match multiple signals for the
 * same archetype). Archetypes with no matching signal score 0.
 */
export function buildFeatureVector(
  evidence: ClassificationEvidence[] | undefined,
  archetypeIds: string[],
): number[] {
  const scores = new Map<string, number>();
  for (const e of evidence ?? []) {
    scores.set(e.archetypeId, (scores.get(e.archetypeId) ?? 0) + e.weight);
  }
  return archetypeIds.map((id) => scores.get(id) ?? 0);
}

/**
 * Train an ELM on this run's confidently-classified files
 * (source: "algorithmic", archetype assigned). Returns null if there isn't
 * enough training data yet — callers should fall back to the LLM for
 * everything in that case, same as before this module existed.
 */
export function trainClassifyELM(
  files: FileClassification[],
  archetypeIds: string[],
): TrainedClassifyELM | null {
  const X: number[][] = [];
  const y: number[] = [];

  for (const f of files) {
    if (f.source !== "algorithmic" || !f.archetype) continue;
    const idx = archetypeIds.indexOf(f.archetype);
    if (idx === -1) continue;
    X.push(buildFeatureVector(f.evidence, archetypeIds));
    y.push(idx);
  }

  if (X.length < MIN_TRAINING_EXAMPLES) return null;

  const elm = new ELM({
    hiddenUnits: HIDDEN_UNITS,
    inputSize: archetypeIds.length,
    categories: archetypeIds,
    useTokenizer: false,
    activation: "relu",
    ridgeLambda: RIDGE_LAMBDA,
    seed: SEED,
  });

  elm.trainFromData(X, y);

  return { elm, archetypeIds };
}

/**
 * Predict an archetype for a file the algorithmic pass left unclassified.
 * Returns null if the model isn't confident enough (margin below threshold)
 * — callers should fall back to the LLM in that case.
 */
export function predictWithClassifyELM(
  model: TrainedClassifyELM,
  evidence: ClassificationEvidence[] | undefined,
): ClassifyELMPrediction | null {
  const vec = buildFeatureVector(evidence, model.archetypeIds);
  const probs = model.elm.predictProbaFromVector(vec);

  const ranked = probs
    .map((prob, i) => ({ archetype: model.archetypeIds[i], prob }))
    .sort((a, b) => b.prob - a.prob);

  const top1 = ranked[0];
  const top2 = ranked[1];
  if (!top1) return null;
  const margin = top1.prob - (top2?.prob ?? 0);

  if (margin < CONFIDENCE_MARGIN_THRESHOLD) return null;

  return { archetype: top1.archetype, confidence: top1.prob, margin };
}
