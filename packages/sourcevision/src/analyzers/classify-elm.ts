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
import { analyzeClassifications } from "./classify.js";
import { BUILTIN_ARCHETYPES } from "./archetypes.js";
import type {
  Classifications,
  FileClassification,
  Imports,
  Inventory,
} from "../schema/index.js";

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
 *
 * Evidence hints are only used for source: "algorithmic" entries. For source: "llm" entries,
 * classifyBatchWithLLM (classify.ts:461-469) writes `evidence: [{archetypeId: item.archetype,
 * ...}]` — i.e. the evidence *is* the resolved label restated, not independent signal. Using
 * it as a training feature would leak the answer into the input text for every LLM-labeled
 * example. Confirmed empirically 2026-08-12: including it here inflated held-out precision
 * before this fix. This is a property of the real production schema, not an artifact of the
 * manually-generated labels used for this prototype's training data.
 */
export function fileToText(fc: FileClassification): string {
  const hints = fc.source === "algorithmic"
    ? (fc.evidence ?? [])
        .slice(0, 5)
        .map((e) => `${e.archetypeId}(${e.weight})`)
        .join(" ")
    : "";
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

// ── Numeric feature representation (Realm's review, 2026-08-19/20; extraction reworked
// 2026-08-24 per Knight's TJ-K1 critique) ───────────────────────────────────────────────
//
// The text-mode functions above encode a file as tokenized text (path + up to 5
// "archetypeId(weight)" hints), which is what classifyFile's algorithmic pass evidence
// naturally looks like as a prompt hint. Realm's review pointed out this indirectly encodes
// a fixed-length numeric signal (the per-archetype weighted score every file already gets
// scored against) as a string, which a ridge-regression readout has to re-derive from
// tokenized text rather than receiving directly. This section builds the same score
// deliberately as a raw numeric vector instead, trained via NumericConfig (no tokenizer).
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
