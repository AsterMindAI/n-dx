/**
 * ELM-based pre-filter for file archetype classification.
 *
 * Implements ADR-2026-08-11-jarrett-elm-prefilter-classify.md / IMPL-2026-08-11-
 * jarrett-classify-elm-swap.md (Knight's independent implementation — see
 * Claude-Context/Jarrett-Agents/Knight.md session log for the comparison writeup).
 *
 * Not wired into `runClassificationsPhase` yet — this module only trains and
 * evaluates. Production wiring is gated on scripts/eval-classify-elm.ts clearing
 * the ADR's precision-at-threshold bar.
 */

import { ELM } from "@astermind/astermind-community";
import type {
  Inventory,
  Imports,
  Classifications,
  ClassificationEvidence,
} from "../schema/index.js";
import { analyzeClassifications } from "./classify.js";
import { BUILTIN_ARCHETYPES } from "./archetypes.js";

/** How many partial-evidence hints to fold into the encoder input, mirroring
 * classify.ts's own LLM prompt (`buildLLMClassifyPrompt` takes the first 3). */
const MAX_EVIDENCE_HINTS = 3;

/** Fixed archetype-ID ordering for the numeric evidence-vector representation
 * (see `buildEvidenceVector`) — the full catalog, not just whatever archetypes
 * happen to appear in a given training run, so the vector's dimensionality is
 * stable across runs/datasets. */
const ARCHETYPE_IDS = BUILTIN_ARCHETYPES.map((a) => a.id).sort();

export interface ArchetypeExample {
  path: string;
  /** Encoder input: file path plus algorithmic partial-evidence hints. */
  text: string;
  /** Ground-truth label — the file's FINAL resolved archetype, whichever stage set it. */
  archetype: string;
  /** Raw per-file evidence, kept alongside `text` for the numeric-feature
   * representation (`buildEvidenceVector`) — see that function's doc for why
   * the text encoding alone isn't a faithful carrier of this signal. */
  evidence?: ClassificationEvidence[];
}

function fileToText(path: string, evidence?: ClassificationEvidence[]): string {
  const hints = (evidence ?? [])
    .slice(0, MAX_EVIDENCE_HINTS)
    .map((e) => `${e.archetypeId}(${e.weight})`)
    .join(" ");
  return hints ? `${path} ${hints}` : path;
}

/**
 * Build (text, label) training pairs from a completed `ndx analyze` run.
 *
 * `classifications.json` only stores each file's FINAL resolved archetype —
 * for files the LLM stage relabeled, `mergeClassificationResults` overwrites
 * the original algorithmic pass's partial-evidence signals entirely, and
 * nothing preserves the pre-merge evidence on disk. So for every file (not
 * just the ones the algorithmic pass alone resolved) to carry real evidence
 * hints, this re-runs the pure, free, deterministic `analyzeClassifications`
 * against the same inventory/imports data that produced `classifications`,
 * then pairs its freshly-computed per-file evidence with the FINAL label
 * from `classifications` — whichever stage actually resolved it.
 *
 * `user-override` entries are excluded: they're human fiat, not a signal
 * about file content the classifier could learn to reproduce.
 */
export function extractExamples(
  inventory: Inventory,
  imports: Imports,
  classifications: Classifications,
): ArchetypeExample[] {
  const fresh = analyzeClassifications(inventory, imports);
  const evidenceByPath = new Map(fresh.files.map((f) => [f.path, f.evidence]));

  const examples: ArchetypeExample[] = [];
  for (const fc of classifications.files) {
    if (!fc.archetype) continue;
    if (fc.source === "user-override") continue;
    const evidence = evidenceByPath.get(fc.path);
    examples.push({
      path: fc.path,
      text: fileToText(fc.path, evidence),
      archetype: fc.archetype,
      evidence,
    });
  }
  return examples;
}

export interface TrainedArchetypeELM {
  elm: ELM;
  categories: string[];
}

export interface TrainOptions {
  hiddenUnits?: number;
  seed?: number;
}

/** '-' MUST stay last in a charSet interpolated into ELM's internal regex — see
 * scripts/elm-hello-world.mjs's documented gotcha. Includes digits/'.' for the
 * "(0.8)" weight suffix in evidence hints. */
const CHAR_SET = "abcdefghijklmnopqrstuvwxyz0123456789./_()-";
const TOKENIZER_DELIMITER = /[\s/._()-]+/;

/**
 * Train a base ELM (text mode) on real labeled examples.
 *
 * Deliberately uses `trainFromData()` with manually-encoded vectors, NOT
 * `train()`: `train()`'s first parameter is `augmentationOptions`
 * (`{suffixes?, prefixes?, includeNoise?}`), not a data array — passing a
 * training-example array there is silently ignored (confirmed by running the
 * installed `@astermind/astermind-community@3.0.0` package directly:
 * `elm.train(realExamples)` and `elm.train()` produce byte-identical models).
 * See IN-FLIGHT.md 2026-08-12 for the reproduction.
 */
export function trainArchetypeELM(
  examples: ArchetypeExample[],
  opts?: TrainOptions,
): TrainedArchetypeELM {
  if (examples.length === 0) throw new Error("trainArchetypeELM: no examples");

  const categories = [...new Set(examples.map((e) => e.archetype))].sort();

  const elm = new ELM({
    categories,
    hiddenUnits: opts?.hiddenUnits ?? 512,
    maxLen: 64,
    activation: "relu",
    charSet: CHAR_SET,
    useTokenizer: true,
    tokenizerDelimiter: TOKENIZER_DELIMITER,
    seed: opts?.seed ?? 20260812,
    log: { modelName: "classify-elm-knight", verbose: false },
  });

  const enc = elm.getEncoder();
  if (!enc) throw new Error("trainArchetypeELM: encoder not initialized (useTokenizer should force this on)");

  const X = examples.map((e) => enc.normalize(enc.encode(e.text)));
  const y = examples.map((e) => categories.indexOf(e.archetype));
  elm.trainFromData(X, y);

  return { elm, categories };
}

export interface ArchetypePrediction {
  archetype: string;
  confidence: number;
}

/** Predict a single file's archetype + confidence (softmax prob of the top label). */
export function predictArchetype(model: TrainedArchetypeELM, text: string): ArchetypePrediction {
  const [top] = model.elm.predict(text, 1);
  return { archetype: top.label, confidence: top.prob };
}

/* =========================================================================
 * Numeric-feature-vector representation
 *
 * Realm's 2026-08-19 review (Claude-Context/Jarrett-Agents/Notes/NOTE-realm-
 * to-archer-and-knight-2026-08-19-elm-prefilter-review.md, item 2) argued the
 * text-hint approach above buries `classifyFile`'s already-structured
 * per-archetype evidence scores inside a tokenized string, when it's really a
 * clean, fixed-length numeric feature vector — and a ridge-regression readout
 * should do better on structured numeric input than on the same information
 * carried indirectly through text.
 *
 * Checked how much worse "indirectly" actually is before building around it
 * (AsterMind-Community-Edition/src/preprocessing/TextEncoder.ts:45-59, read
 * directly rather than assumed): `useTokenizer: true` does NOT produce a
 * token/word embedding. `Tokenizer.tokenize(text).join('')` splits on the
 * delimiter and immediately rejoins with no separator, so all token/word
 * boundaries are destroyed; the result is then one-hot encoded *per
 * character*, truncated/padded to a fixed `maxLen`. So `fileToText`'s
 * "path utility(0.7)" input isn't seen as [path-tokens, archetypeId,
 * weight] — it's seen as a flat character window over
 * "pathutility07" with no structure at all, and for ~3.8% of real n-dx
 * examples (measured against this repo's own classification data) the
 * combined (path + hints) text exceeds the 64-char window entirely, silently
 * dropping the evidence hints outright. Truncation is real but a minor
 * contributor; the dominant issue is that even *untruncated* input carries
 * the evidence as an undifferentiated character blob, not as an
 * archetype-indexed value.
 * ========================================================================= */

/**
 * Sum `classifyFile`'s per-archetype signal weights into a fixed-length
 * numeric vector, ordered by `ARCHETYPE_IDS` — mirrors the accumulation
 * `classifyFile` itself does internally (`classify.ts:147-171`,
 * `archetypeScore += signal.weight` per matching signal) rather than
 * re-deriving it a different way.
 */
export function buildEvidenceVector(evidence: ClassificationEvidence[] | undefined): number[] {
  const scores = new Map<string, number>();
  for (const e of evidence ?? []) {
    scores.set(e.archetypeId, (scores.get(e.archetypeId) ?? 0) + e.weight);
  }
  return ARCHETYPE_IDS.map((id) => scores.get(id) ?? 0);
}

/**
 * Numeric feature vector for one file: the archetype-evidence vector
 * (clean, structured, immune to the tokenizer's truncation/boundary loss)
 * concatenated with the path's own encoded representation (still routed
 * through the char-level encoder — but path-only now, no appended hint text,
 * so it doesn't compete with the hints for truncation budget and doesn't mix
 * the two signal types in one undifferentiated stream).
 */
function buildNumericFeatureVector(
  enc: NonNullable<ReturnType<ELM["getEncoder"]>>,
  path: string,
  evidence: ClassificationEvidence[] | undefined,
): number[] {
  const pathVec = enc.normalize(enc.encode(path));
  const evidenceVec = buildEvidenceVector(evidence);
  return [...evidenceVec, ...pathVec];
}

/** Same charSet/delimiter as the text-hint encoder — only the composition of
 * the final input vector differs, not how path text itself gets encoded. */
const PATH_ONLY_CHAR_SET = "abcdefghijklmnopqrstuvwxyz0123456789./_-";
const PATH_ONLY_DELIMITER = /[\s/._-]+/;

/**
 * Train a base ELM on the numeric-feature representation instead of the
 * tokenized-text one. Same `hiddenUnits`/seed contract as `trainArchetypeELM`
 * so a comparison between the two isolates the feature representation as the
 * only changed variable — the same controlled-experiment discipline Realm's
 * review asked the data-volume question to meet, applied here instead.
 */
export function trainArchetypeELMNumeric(
  examples: ArchetypeExample[],
  opts?: TrainOptions,
): TrainedArchetypeELM {
  if (examples.length === 0) throw new Error("trainArchetypeELMNumeric: no examples");

  const categories = [...new Set(examples.map((e) => e.archetype))].sort();

  const elm = new ELM({
    categories,
    hiddenUnits: opts?.hiddenUnits ?? 512,
    maxLen: 64,
    activation: "relu",
    charSet: PATH_ONLY_CHAR_SET,
    useTokenizer: true,
    tokenizerDelimiter: PATH_ONLY_DELIMITER,
    seed: opts?.seed ?? 20260812,
    log: { modelName: "classify-elm-knight-numeric", verbose: false },
  });

  const enc = elm.getEncoder();
  if (!enc) throw new Error("trainArchetypeELMNumeric: encoder not initialized");

  const X = examples.map((e) => buildNumericFeatureVector(enc, e.path, e.evidence));
  const y = examples.map((e) => categories.indexOf(e.archetype));
  elm.trainFromData(X, y);

  return { elm, categories };
}

/** Predict using the numeric-feature representation — mirrors
 * `predictArchetype`'s shape, but needs the raw path + evidence (not
 * pre-joined text) since the encoder is only ever applied to the path. */
export function predictArchetypeNumeric(
  model: TrainedArchetypeELM,
  path: string,
  evidence: ClassificationEvidence[] | undefined,
): ArchetypePrediction {
  const enc = model.elm.getEncoder();
  if (!enc) throw new Error("predictArchetypeNumeric: encoder not initialized");
  const vec = buildNumericFeatureVector(enc, path, evidence);
  const probs = model.elm.predictProbaFromVector(vec);
  let bestIdx = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[bestIdx]) bestIdx = i;
  return { archetype: model.categories[bestIdx], confidence: probs[bestIdx] };
}
