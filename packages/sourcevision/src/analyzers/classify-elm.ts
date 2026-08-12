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

/** How many partial-evidence hints to fold into the encoder input, mirroring
 * classify.ts's own LLM prompt (`buildLLMClassifyPrompt` takes the first 3). */
const MAX_EVIDENCE_HINTS = 3;

export interface ArchetypeExample {
  path: string;
  /** Encoder input: file path plus algorithmic partial-evidence hints. */
  text: string;
  /** Ground-truth label — the file's FINAL resolved archetype, whichever stage set it. */
  archetype: string;
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
    examples.push({
      path: fc.path,
      text: fileToText(fc.path, evidenceByPath.get(fc.path)),
      archetype: fc.archetype,
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
