/**
 * ELM-based pre-filter for classify.ts's LLM fallback.
 *
 * TJ-A1 — see Claude-Context/ADR/ADR-2026-08-11-jarrett-elm-prefilter-classify.md and
 * Claude-Context/IMPL/IMPL-2026-08-11-jarrett-classify-elm-swap.md.
 *
 * Prototype/eval only — not yet wired into runClassificationsPhase (gated on the IMPL's
 * Step 5 precision check). This module is intentionally standalone: it doesn't modify
 * classify.ts or analyze-phases.ts, it only reads the same FileClassification shape they
 * already produce and export.
 */

import { ELM } from "@astermind/astermind-community";
import type { Classifications, FileClassification } from "../schema/index.js";

const HIDDEN_UNITS = 128;
const MAX_LEN = 120;

export interface ArchetypeExample {
  text: string;
  archetype: string;
}

/**
 * Build the text representation fed to the ELM for one file: path plus the algorithmic
 * pass's partial evidence hints, mirroring what buildLLMClassifyPrompt already shows the
 * LLM (classify.ts:497-508) so both stages see comparable signal.
 */
export function fileToText(fc: FileClassification): string {
  const hints = (fc.evidence ?? [])
    .slice(0, 5)
    .map((e) => `${e.archetypeId}(${e.weight})`)
    .join(" ");
  return hints ? `${fc.path} ${hints}` : fc.path;
}

/**
 * Extract labeled (text, archetype) pairs from a Classifications result. Only
 * algorithmic- and LLM-resolved files carry a trustworthy label; user overrides are
 * excluded (they reflect a human correction, not the file's natural signal) and
 * unclassified files have no label to train on.
 */
export function extractExamples(classifications: Classifications): ArchetypeExample[] {
  const examples: ArchetypeExample[] = [];
  for (const fc of classifications.files) {
    if (!fc.archetype) continue;
    if (fc.source !== "algorithmic" && fc.source !== "llm") continue;
    examples.push({ text: fileToText(fc), archetype: fc.archetype });
  }
  return examples;
}

export interface TrainedArchetypeELM {
  elm: ELM;
  categories: string[];
}

/**
 * Train a base ELM (text mode) on labeled examples.
 *
 * Deliberately does NOT use ELM.train() — verified 2026-08-12 by reading ELM.ts directly
 * (AsterMind-Community-Edition/src/core/ELM.ts:403-487): that method bootstraps its own
 * training set from augmented *variants of the category names themselves* (e.g. spelling
 * variations of "component"), not from a supplied corpus. It's built for zero-shot-style
 * intent classifiers, not for training on real labeled examples. We have real labeled
 * examples (file → archetype), so instead we encode them ourselves with the same encoder
 * predict() uses internally, and call trainFromData() — the numeric-vector supervised
 * path. Flagging this prominently in the module doc so Knight's parallel implementation
 * doesn't reach for train() first, the way the API surface makes it look like the obvious
 * choice for text input.
 */
export function trainArchetypeELM(
  examples: ArchetypeExample[],
  categories: string[],
  seed: number,
): TrainedArchetypeELM {
  const elm = new ELM({
    categories,
    hiddenUnits: HIDDEN_UNITS,
    useTokenizer: true,
    maxLen: MAX_LEN,
    seed,
  });

  const encoder = elm.encoder;
  if (!encoder) throw new Error("ELM text-mode encoder not initialized");

  const categoryIndex = new Map(categories.map((c, i) => [c, i]));
  const X: number[][] = [];
  const y: number[] = [];
  for (const ex of examples) {
    const idx = categoryIndex.get(ex.archetype);
    if (idx === undefined) continue; // label outside the trained category set
    X.push(encoder.normalize(encoder.encode(ex.text)));
    y.push(idx);
  }
  if (X.length === 0) {
    throw new Error("trainArchetypeELM: no examples matched the given category set");
  }

  elm.trainFromData(X, y);
  return { elm, categories };
}

export interface ELMPrediction {
  archetype: string;
  confidence: number;
}

/**
 * Classify one file's text. Confidence is the ELM's own softmax probability for its
 * top pick (ELM.predict() already sorts by probability descending) — this is the signal
 * the precision/coverage threshold gate operates on, both in the eval script and in
 * eventual production wiring.
 */
export function predictArchetype(trained: TrainedArchetypeELM, text: string): ELMPrediction {
  const [top] = trained.elm.predict(text, 1);
  return { archetype: top.label, confidence: top.prob };
}
