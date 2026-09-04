/**
 * Text-encoded ELM classifier for files the algorithmic pass leaves unclassified.
 *
 * Trains on this run's already-labeled files (`source: "algorithmic" | "llm"`) — no separate
 * labeling step. Encodes each file path with `UniversalEncoder` and trains via
 * `ELM.trainFromData(X, y)`, NOT `ELM.train()` / `useTokenizer: true` text mode: that call
 * doesn't train on supplied examples at all (its only parameter is `augmentationOptions`, not a
 * training set — see `scripts/classify-elm-eval.mjs`'s header and
 * `scripts/classify-elm-eval-results.md` for how that was found and confirmed). Config here
 * mirrors that eval script exactly, since a different config in production than in the eval
 * would invalidate the accuracy number it measured.
 *
 * Shadow-mode gate: `ELM_GATE_ENABLED` is `false` until a documented decision flips it. See
 * `Claude-Context/ADR/ADR-2026-08-31-nala-classify-elm-rewrite.md` and the paired IMPL.
 */

import { ELM, UniversalEncoder } from "@astermind/astermind-community";
import type { Classifications, FileClassification } from "../schema/index.js";

/**
 * Shadow-mode gate. While false, `enrichClassificationsWithLLM` always trains and predicts with
 * this model (so the code path is exercised) but never uses a prediction to skip the Claude
 * batch. A wrong ELM label is silent — no LLM in the loop to catch it — so this stays false until
 * shadow-mode evidence (beyond the cross-validation run in `classify-elm-eval-results.md`)
 * justifies flipping it.
 */
export const ELM_GATE_ENABLED = false;

/** Same config family as `scripts/classify-elm-eval.mjs` — keep in sync; see file header. */
const SEED = 42;
const HIDDEN_UNITS = 512;
/** '-' MUST stay last — unescaped RegExp character-class gotcha in the underlying encoder. */
const CHAR_SET = "abcdefghijklmnopqrstuvwxyz0123456789./_-";
const TOKENIZER_DELIMITER = /[/._-]+/;
/** Longest real path measured in `classify-elm-eval-results.md` was 70 chars; 80 gives headroom. */
const MAX_LEN = 80;

/** Below this many labeled examples, don't train at all — too little data to trust a model. */
const MIN_TRAINING_EXAMPLES = 20;
/** Minimum top1/top2 probability margin to treat a prediction as confident. */
const MARGIN_THRESHOLD = 0.3;

export interface ClassifyPathELMModel {
  elm: ELM;
  encoder: UniversalEncoder;
  /** Archetype IDs, in the index order used for training/prediction (matches `elm`'s categories). */
  categories: string[];
}

/**
 * Train a path-text ELM on this run's already-labeled files.
 * Returns null if there isn't enough labeled data yet to train a trustworthy model.
 */
export function trainClassifyPathELM(
  classifications: Classifications,
): ClassifyPathELMModel | null {
  const labeled = classifications.files.filter(
    (f): f is FileClassification & { archetype: string } =>
      f.archetype !== null && (f.source === "algorithmic" || f.source === "llm"),
  );

  if (labeled.length < MIN_TRAINING_EXAMPLES) return null;

  const categories = classifications.archetypes.map((a) => a.id);
  const encoder = new UniversalEncoder({
    charSet: CHAR_SET,
    maxLen: MAX_LEN,
    useTokenizer: true,
    tokenizerDelimiter: TOKENIZER_DELIMITER,
    mode: "char",
  });

  const X = labeled.map((f) => encoder.normalize(encoder.encode(f.path)));
  const y = labeled.map((f) => categories.indexOf(f.archetype));

  const elm = new ELM({
    categories,
    hiddenUnits: HIDDEN_UNITS,
    inputSize: encoder.getVectorSize(),
    activation: "relu",
    useTokenizer: false, // numeric mode — encoding is done manually above via UniversalEncoder
    seed: SEED,
    log: { modelName: "classify-elm", verbose: false },
  });

  elm.trainFromData(X, y);

  return { elm, encoder, categories };
}

export interface ClassifyPathELMPrediction {
  archetype: string;
  /** Top-1 softmax probability, rounded to 2 decimals. */
  confidence: number;
  /** Top1 − top2 probability margin, rounded to 2 decimals. */
  margin: number;
}

/**
 * Predict an archetype for a single file path. Returns null when the model isn't confident
 * enough (top1/top2 margin below `MARGIN_THRESHOLD`) — callers should treat null the same as "no
 * ELM opinion," not as a low-confidence label.
 */
export function predictWithClassifyPathELM(
  path: string,
  model: ClassifyPathELMModel,
): ClassifyPathELMPrediction | null {
  const vec = model.encoder.normalize(model.encoder.encode(path));
  const probs = model.elm.predictProbaFromVector(vec);

  let topIdx = 0;
  let secondIdx = -1;
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > probs[topIdx]) {
      secondIdx = topIdx;
      topIdx = i;
    } else if (secondIdx === -1 || probs[i] > probs[secondIdx]) {
      secondIdx = i;
    }
  }

  const top = probs[topIdx];
  const second = secondIdx >= 0 ? probs[secondIdx] : 0;
  const margin = top - second;

  if (margin < MARGIN_THRESHOLD) return null;

  return {
    archetype: model.categories[topIdx],
    confidence: Math.round(top * 100) / 100,
    margin: Math.round(margin * 100) / 100,
  };
}
