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

import { basename } from "node:path";
import { ELM } from "@astermind/astermind-community";
import type {
  ArchetypeDefinition,
  ArchetypeSignal,
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

// ── Numeric feature representation (Realm's review, 2026-08-19/20) ─────────────
//
// The text-mode functions above encode a file as tokenized text (path + up to 5
// "archetypeId(weight)" hints), which is what classifyFile's algorithmic pass evidence
// naturally looks like as a prompt hint. Realm's review pointed out this indirectly encodes
// a fixed-length numeric signal (the per-archetype weighted score every file already gets
// scored against) as a string, which a ridge-regression readout has to re-derive from
// tokenized text rather than receiving directly. This section builds the same score
// deliberately as a raw numeric vector instead, trained via NumericConfig (no tokenizer).
//
// matchSignal/scoreArchetypes below are reimplemented independently from classify.ts's
// private matchSignal/classifyFile (classify.ts:135-250) rather than importing anything new
// from that module — classify.ts stays genuinely untouched (see IMPL Files-touched table).
// Known tradeoff: this duplicates signal-matching logic, so it can drift out of sync if
// classify.ts's archetype-matching regexes change. Acceptable for a prototype; would need
// reconciling (ideally by exporting the scoring function from classify.ts for real) before
// any production use.

function matchesSignal(signal: ArchetypeSignal, filePath: string, fileName: string, exportsForFile?: string[]): boolean {
  const re = new RegExp(signal.pattern);
  switch (signal.kind) {
    case "path":
      return re.test(filePath);
    case "filename":
      return re.test(fileName);
    case "directory":
      return filePath.includes(signal.pattern);
    case "export":
      return !!exportsForFile && exportsForFile.some((sym) => re.test(sym));
    default:
      return false;
  }
}

/**
 * Compute the same per-archetype weighted score classifyFile computes internally
 * (classify.ts:147-171), but returned as a full fixed-length vector (one entry per
 * archetype, 0 if unmatched) instead of only the winning archetype + truncated evidence.
 */
export function scoreArchetypeVector(
  filePath: string,
  archetypes: ArchetypeDefinition[],
  exportsForFile?: string[],
  projectLanguages?: string[],
): number[] {
  const fileName = basename(filePath);
  return archetypes.map((archetype) => {
    let score = 0;
    for (const signal of archetype.signals) {
      if (signal.languages && signal.languages.length > 0 && projectLanguages && projectLanguages.length > 0) {
        if (!projectLanguages.some((lang) => signal.languages!.includes(lang))) continue;
      }
      if (matchesSignal(signal, filePath, fileName, exportsForFile)) score += signal.weight;
    }
    return score;
  });
}

/** Mirrors classify.ts's buildExportMap (classify.ts:256-274) — reexport edges only. */
function buildExportMap(imports: Imports): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const edge of imports.edges) {
    if (edge.type !== "reexport") continue;
    let list = result.get(edge.to);
    if (!list) {
      list = [];
      result.set(edge.to, list);
    }
    for (const sym of edge.symbols) {
      if (!list.includes(sym)) list.push(sym);
    }
  }
  return result;
}

export interface NumericArchetypeExample {
  vector: number[];
  archetype: string;
}

/**
 * Extract (score-vector, archetype) pairs by recomputing the algorithmic score fresh from
 * inventory.json/imports.json, joined with classifications.json's FINAL label regardless of
 * which stage resolved it. Unlike fileToText's evidence-hint approach, this needs no
 * source: "algorithmic"-only carve-out — recomputing from first principles instead of reading
 * the stored (and, for source: "llm" entries, answer-shaped) `evidence` field sidesteps the
 * leakage question entirely rather than working around it.
 */
export function extractNumericExamples(
  classifications: Classifications,
  inventory: Inventory,
  imports: Imports,
): NumericArchetypeExample[] {
  const exportMap = buildExportMap(imports);
  const classificationByPath = new Map(classifications.files.map((f) => [f.path, f]));
  const examples: NumericArchetypeExample[] = [];

  for (const file of inventory.files) {
    if (file.role !== "source") continue;
    const fc = classificationByPath.get(file.path);
    if (!fc?.archetype) continue;
    if (fc.source !== "algorithmic" && fc.source !== "llm") continue;
    const vector = scoreArchetypeVector(file.path, classifications.archetypes, exportMap.get(file.path));
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
