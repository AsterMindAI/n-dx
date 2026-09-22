/**
 * Feature extraction for the ELM archetype classifier (TJ-E1).
 *
 * Implements `ADR-2026-09-17-elon-content-based-elm-classifier.md`, Decision point 3.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * The evidence-vector representation in `classify-elm.ts` is provably all-zero for the
 * population that actually reaches `runELMGate` (ADR-2026-08-11's "Zero-evidence population",
 * measured 2026-08-27 across 5 corpora, zero exceptions). The guard at the top of
 * `classifyWithELM` therefore skips 100% of that population, so the ELM stage resolves nothing.
 * This module produces a vector that is never degenerate for a real file, by reading the file.
 *
 * WHY NOT `UniversalEncoder` (the obvious choice, and the one TJ-R2 used for paths)
 * ---------------------------------------------------------------------------------
 * Verified by reading the installed @astermind/astermind-community v3.0.0 bundle
 * (dist/astermind.esm.js), not its docs. `TextEncoder.textToVector` lowercases, strips anything
 * outside `charSet`, pads/truncates to exactly `maxLen`, then emits a ONE-HOT PER CHARACTER
 * POSITION -- so the vector is `maxLen * charSize` and the input is hard-truncated at `maxLen`.
 * Four disqualifying consequences for file content:
 *
 *   1. Truncation. TJ-R2's config (maxLen 80) sees the first 80 characters of a file -- for
 *      most source files, a license header or a single import line.
 *   2. Dimension blow-up. A 2,000-character window at charSize 41 is 82,000 input dimensions
 *      feeding a 128-unit hidden layer, fitted from a few hundred training examples.
 *   3. Position brittleness. One extra directory level shifts every following character into
 *      different dimensions; `src/foo.ts` and `lib/src/foo.ts` share almost no active features.
 *   4. A latent charSet bug that only bites on content: the strip regex is built by
 *      interpolating `charSet` into a character class, so TJ-R2's "...9/.-_ " makes `.-_` a
 *      RANGE (0x2E-0x5F), not three literals. `: ; < = > ? @` survive the strip and then encode
 *      to an all-zero one-hot (indexOf -> -1) while still consuming a position slot. Paths
 *      rarely contain those characters. Source code is full of them.
 *
 * So content is encoded with FEATURE HASHING instead: token -> bucket, accumulate, log-weight,
 * normalize. Fixed width regardless of file length (a 10-line and a 30,000-line file produce the
 * same width), position-independent, and no vocabulary to persist alongside the model.
 *
 * VECTOR LAYOUT (v2) -- see FEATURE_VERSION. A model trained under one layout is meaningless
 * under another, which is why the version is stamped into the model artifact.
 *
 *   [ extension ][ path scalars ][ path tokens ][ content tokens ][ structural ][ indicators ]
 *
 * The first five blocks are L2-normalized independently before concatenation, so the
 * 512-dimension content block cannot swamp the 4-dimension scalar block purely by magnitude.
 * The indicator block is raw 0/1 and is never normalized -- see Block 6.
 *
 * ON BLOCK ENERGY -- this is a CHOICE, not a neutral default. Team Nolan measured
 * (ELM-database-ndx, methodology/FEATURES.md § 9) that concatenating unscaled blocks let a
 * 22-column structural block carry ~2.7x the energy of an entire 2,890-dimension path block,
 * because an ELM's hidden layer is a random projection and relative block energy decides which
 * signal dominates. Per-block L2 avoids that failure, but it has its own consequence worth
 * stating: it gives the 21-dimension extension block the SAME energy as the 512-dimension
 * content block. Whether that is right is an ablation question (IMPL step 8), not settled here.
 */

import { readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

/**
 * Bump when the layout below changes in any way that moves a value to a different index.
 * `classify-elm.ts` stamps this into the trained-model artifact so a model trained under v1 can
 * never be silently loaded by code expecting v2 (IMPL step 10).
 */
export const FEATURE_VERSION = 2;

// -- Block 1: extension -------------------------------------------------------------------
//
// A fixed vocabulary rather than a hash: extensions are a small, effectively closed set, and
// keeping them interpretable means a wrong prediction can be explained ("it fired on .tsx")
// rather than shrugged at. Unknown extensions collapse into a single OTHER slot, which is
// correct behavior rather than a gap -- an unrecognized extension is itself a signal.

export const EXT_VOCAB = [
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".go", ".swift", ".py", ".rb",
  ".java", ".json", ".md", ".css", ".scss", ".html", ".yml", ".yaml", ".sh", ".sql",
] as const;

const EXT_OTHER_SLOTS = 1;
export const EXT_BLOCK_SIZE = EXT_VOCAB.length + EXT_OTHER_SLOTS;

// -- Block 2: path scalars ----------------------------------------------------------------

// NOTE: `depth`/`segmentCount` were here in v1 and are deliberately GONE in v2. Two reasons,
// both found by reading Team Nolan's measured feature survey (ELM-database-ndx,
// methodology/FEATURES.md § 8) rather than by reasoning about it here:
//   1. They encode monorepo layout, not archetype. Nolan withheld `depthFromRoot` on measured
//      evidence -- n-dx paths start `packages/x/src/...`, express is flat -- so the feature
//      fingerprints the repo. That is the same class of leak as their `category`/`zone` findings.
//   2. They were perfectly collinear with each other (`segmentCount === depth + 1`), so one of
//      the two was pure redundancy regardless.
// What is kept below are properties of the FILE, not of the tree it happens to sit in.
export const PATH_SCALAR_NAMES = [
  "filenameLength",
  "isIndexFile",
  "inTestPath",
  "hasDotSuffix",
] as const;
export const PATH_SCALAR_BLOCK_SIZE = PATH_SCALAR_NAMES.length;

// -- Blocks 3 & 4: hashed token blocks ----------------------------------------------------
//
// Bucket counts are ablation parameters (IMPL step 8), not tuned values. Content gets more
// buckets than the path because a file body has far more distinct identifiers than a path has
// segments; too few buckets collides unrelated identifiers, too many leaves the vector sparse
// against a few hundred training examples.

export const PATH_TOKEN_BUCKETS = 96;
export const CONTENT_TOKEN_BUCKETS = 512;

// -- Block 5: structural counts -----------------------------------------------------------
//
// Cheap regex/substring work, no parser (a parser per language across TS/JS/Go/Swift is a much
// larger surface than this task needs -- ADR Alternatives). These are the interpretable
// features: each one is a claim about the file that a human can check.

export const STRUCTURAL_FEATURE_NAMES = [
  "importCount",
  "exportCount",
  "hasDefaultExport",
  "hasJsx",
  "isTestFile",
  "classCount",
  "functionCount",
  "arrowFunctionCount",
  "typeDeclCount",
  "reactHookUsage",
  "routeDefinition",
  "commonJsExport",
  "asyncCount",
  "envAccess",
  "schemaBuilder",
  "lineCount",
] as const;
export const STRUCTURAL_BLOCK_SIZE = STRUCTURAL_FEATURE_NAMES.length;

// -- Block 6: missing indicators ----------------------------------------------------------
//
// "ZERO IS NOT MISSING." Adopted from Team Nolan's measured feature survey (ELM-database-ndx,
// methodology/FEATURES.md § 5), which calls this "the single easiest way to get wrong numbers
// from this dataset" -- and v1 of this module had exactly the bug.
//
// In v1, a file whose content could not be read (deleted, binary, unreadable) and a file whose
// content contains no identifiers at all BOTH produced an all-zero content block. Those are
// different facts and the model could not tell them apart: it was being told that an unmeasured
// file definitively has no content signal. Nolan's convention is a 0 value plus an explicit
// `<field>Missing = 1` column, and that is what this block is.
//
// This block is deliberately NOT L2-normalized -- it is a raw 0/1 fact about measurement, not a
// magnitude to be balanced against the other blocks.

export const INDICATOR_NAMES = ["contentMissing", "contentEmpty"] as const;
export const INDICATOR_BLOCK_SIZE = INDICATOR_NAMES.length;

// -- Offsets ------------------------------------------------------------------------------

export const OFFSET_EXT = 0;
export const OFFSET_PATH_SCALARS = OFFSET_EXT + EXT_BLOCK_SIZE;
export const OFFSET_PATH_TOKENS = OFFSET_PATH_SCALARS + PATH_SCALAR_BLOCK_SIZE;
export const OFFSET_CONTENT_TOKENS = OFFSET_PATH_TOKENS + PATH_TOKEN_BUCKETS;
export const OFFSET_STRUCTURAL = OFFSET_CONTENT_TOKENS + CONTENT_TOKEN_BUCKETS;
export const OFFSET_INDICATORS = OFFSET_STRUCTURAL + STRUCTURAL_BLOCK_SIZE;
export const FEATURE_VECTOR_SIZE = OFFSET_INDICATORS + INDICATOR_BLOCK_SIZE;

/**
 * Read cap. Bounds worst-case work on a generated or minified file; the vector width is
 * unaffected either way, so this trades a tail of content for a predictable cost ceiling.
 */
export const MAX_CONTENT_BYTES = 64 * 1024;

// -- Hashing ------------------------------------------------------------------------------

/**
 * FNV-1a, 32-bit. Chosen because it is dependency-free and **stable across processes** -- a
 * persisted model is worthless if the same token hashes to a different bucket in the session
 * that loads it. Asserted directly in the unit tests.
 */
export function hashToken(token: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// -- Tokenization -------------------------------------------------------------------------

/** Split a camelCase/PascalCase identifier. `parseHTTPResponse` -> parse, http, response. */
function splitCamel(token: string): string[] {
  return token
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean);
}

/**
 * Path -> tokens. Splits on separators and camelCase, keeping both the whole segment and its
 * parts: `branch-work-store.ts` yields `branch`, `work`, `store`, so a signal can attach at
 * either granularity.
 */
export function tokenizePath(path: string): string[] {
  const raw = path.split(/[/\\.\-_]+/).filter(Boolean);
  const out: string[] = [];
  for (const seg of raw) {
    const lower = seg.toLowerCase();
    if (lower) out.push(lower);
    for (const part of splitCamel(seg)) {
      const p = part.toLowerCase();
      if (p && p !== lower) out.push(p);
    }
  }
  return out;
}

/** Content -> identifier/keyword tokens, plus their camelCase parts. */
export function tokenizeContent(content: string): string[] {
  const matches = content.match(/[A-Za-z_$][A-Za-z0-9_$]*/g);
  if (!matches) return [];
  const out: string[] = [];
  for (const m of matches) {
    const lower = m.toLowerCase();
    out.push(lower);
    for (const part of splitCamel(m)) {
      const p = part.toLowerCase();
      if (p && p !== lower) out.push(p);
    }
  }
  return out;
}

// -- Block builders -----------------------------------------------------------------------

/**
 * L2-normalize a slice in place. A zero slice is left as zeros rather than producing NaN --
 * the degraded (no content) case must stay a usable vector, not poison the whole feature row.
 */
function l2NormalizeInPlace(vec: number[], from: number, to: number): void {
  let sum = 0;
  for (let i = from; i < to; i++) sum += vec[i] * vec[i];
  if (sum <= 0) return;
  const norm = Math.sqrt(sum);
  for (let i = from; i < to; i++) vec[i] /= norm;
}

/** Hash tokens into a bucket range with log-TF weighting (damps repeated identifiers). */
function hashTokensInto(vec: number[], tokens: string[], offset: number, buckets: number): void {
  if (tokens.length === 0) return;
  const counts = new Map<number, number>();
  for (const t of tokens) {
    const b = hashToken(t) % buckets;
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  for (const [bucket, count] of counts) {
    vec[offset + bucket] = Math.log1p(count);
  }
}

function writeExtensionBlock(vec: number[], path: string): void {
  const ext = extname(path).toLowerCase();
  const idx = EXT_VOCAB.indexOf(ext as (typeof EXT_VOCAB)[number]);
  vec[OFFSET_EXT + (idx >= 0 ? idx : EXT_VOCAB.length)] = 1;
}

function writePathScalarBlock(vec: number[], path: string): void {
  const segments = path.split(/[/\\]+/).filter(Boolean);
  const filename = segments[segments.length - 1] ?? "";
  const base = filename.replace(/\.[^.]*$/, "");
  const o = OFFSET_PATH_SCALARS;
  vec[o + 0] = Math.log1p(filename.length);
  vec[o + 1] = base.toLowerCase() === "index" ? 1 : 0;
  vec[o + 2] = /(^|[/\\])(tests?|__tests__|spec|e2e)([/\\]|$)/i.test(path) ? 1 : 0;
  vec[o + 3] = /\.[^./\\]+\.[^./\\]+$/.test(filename) ? 1 : 0; // foo.test.ts, foo.d.ts
}

function countMatches(content: string, re: RegExp): number {
  const m = content.match(re);
  return m ? m.length : 0;
}

/**
 * Structural counts. Every value is log1p-scaled so one 400-import file cannot dominate the
 * block, and booleans stay 0/1.
 */
export function structuralFeatures(content: string, path: string): number[] {
  const out = new Array<number>(STRUCTURAL_BLOCK_SIZE).fill(0);
  out[0] = Math.log1p(countMatches(content, /(^|\n)\s*import\s|require\s*\(/g));
  out[1] = Math.log1p(countMatches(content, /(^|\n)\s*export\s/g));
  out[2] = /(^|\n)\s*export\s+default\s/.test(content) ? 1 : 0;
  out[3] = /<[A-Z][A-Za-z0-9]*[\s/>]|<\/[A-Z][A-Za-z0-9]*>/.test(content) ? 1 : 0;
  out[4] =
    /(^|\n|\s)(describe|it|test)\s*\(/.test(content) ||
    /(^|[/\\])(tests?|__tests__|spec)([/\\]|$)/i.test(path)
      ? 1
      : 0;
  out[5] = Math.log1p(
    countMatches(content, /(^|\n)\s*(export\s+)?(abstract\s+)?class\s+[A-Za-z_$]/g),
  );
  out[6] = Math.log1p(
    countMatches(content, /(^|\n)\s*(export\s+)?(async\s+)?function\s+[A-Za-z_$]/g),
  );
  out[7] = Math.log1p(countMatches(content, /=>\s*[{(]/g));
  out[8] = Math.log1p(countMatches(content, /(^|\n)\s*(export\s+)?(interface|type)\s+[A-Za-z_$]/g));
  out[9] = /\buse[A-Z][A-Za-z0-9]*\s*\(/.test(content) ? 1 : 0;
  out[10] =
    /\.(get|post|put|patch|delete|use)\s*\(\s*["'`]\//.test(content) ||
    /\b(Router|createRouter|app\.listen)\b/.test(content)
      ? 1
      : 0;
  out[11] = /\bmodule\.exports\b|\bexports\.[A-Za-z_$]/.test(content) ? 1 : 0;
  out[12] = Math.log1p(countMatches(content, /\basync\b/g));
  out[13] = /\bprocess\.env\b|\bimport\.meta\.env\b/.test(content) ? 1 : 0;
  out[14] = /\bz\.(object|string|number)\b|\bJoi\.|\byup\.|\bSchema\s*\(/.test(content) ? 1 : 0;
  out[15] = Math.log1p(content.split("\n").length);
  return out;
}

// -- File reading (degradation paths) -----------------------------------------------------

/** A NUL byte in the first 8KB is the standard cheap binary heuristic. */
function looksBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8192);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

/**
 * Read a file for feature extraction, or return `undefined` when it cannot be used.
 *
 * **Never throws.** A missing, unreadable, or binary file degrades to metadata-only features
 * rather than failing the whole analysis run -- `inventory.json` can legitimately list a file
 * that has since been deleted, and one unreadable file must not take down `ndx analyze`.
 */
export function readFileContentSafely(rootDir: string, relPath: string): string | undefined {
  try {
    const full = join(rootDir, relPath);
    const st = statSync(full);
    if (!st.isFile()) return undefined;
    const buf = readFileSync(full);
    if (looksBinary(buf)) return undefined;
    return buf.subarray(0, MAX_CONTENT_BYTES).toString("utf8");
  } catch {
    return undefined;
  }
}

// -- Assembly -----------------------------------------------------------------------------

export interface FeatureInput {
  path: string;
  /** Omit for metadata-only extraction (unreadable, binary, or missing file). */
  content?: string;
}

/**
 * Build the full fixed-width feature vector for one file.
 *
 * Width is `FEATURE_VECTOR_SIZE` for every input -- independent of file length, of the archetype
 * catalog size, and of whether content was available at all. That invariant is what lets a model
 * trained on one corpus be applied to another, and it is asserted directly in the unit tests.
 */
export function buildFeatureVector(input: FeatureInput): number[] {
  const vec = new Array<number>(FEATURE_VECTOR_SIZE).fill(0);

  writeExtensionBlock(vec, input.path);
  l2NormalizeInPlace(vec, OFFSET_EXT, OFFSET_EXT + EXT_BLOCK_SIZE);

  writePathScalarBlock(vec, input.path);
  l2NormalizeInPlace(vec, OFFSET_PATH_SCALARS, OFFSET_PATH_SCALARS + PATH_SCALAR_BLOCK_SIZE);

  hashTokensInto(vec, tokenizePath(input.path), OFFSET_PATH_TOKENS, PATH_TOKEN_BUCKETS);
  l2NormalizeInPlace(vec, OFFSET_PATH_TOKENS, OFFSET_PATH_TOKENS + PATH_TOKEN_BUCKETS);

  if (input.content === undefined) {
    // Content was not measurable. Say so explicitly rather than letting an all-zero content
    // block imply "measured, and found nothing" -- see the Block 6 note.
    vec[OFFSET_INDICATORS + 0] = 1;
  } else {
    hashTokensInto(
      vec,
      tokenizeContent(input.content),
      OFFSET_CONTENT_TOKENS,
      CONTENT_TOKEN_BUCKETS,
    );
    l2NormalizeInPlace(vec, OFFSET_CONTENT_TOKENS, OFFSET_CONTENT_TOKENS + CONTENT_TOKEN_BUCKETS);

    const structural = structuralFeatures(input.content, input.path);
    for (let i = 0; i < structural.length; i++) vec[OFFSET_STRUCTURAL + i] = structural[i];
    l2NormalizeInPlace(vec, OFFSET_STRUCTURAL, OFFSET_STRUCTURAL + STRUCTURAL_BLOCK_SIZE);

    // Measured, but there was nothing in it. Distinct from both "not measured" above and from
    // "measured, has content" -- an empty file is a real and different fact.
    if (input.content.length === 0) vec[OFFSET_INDICATORS + 1] = 1;
  }

  return vec;
}
