#!/usr/bin/env node
/**
 * The corpus -> features bridge. ADR-2026-09-04 step 5 (Nutella).
 *
 * Turns the labelled archetype corpus into training matrices in sourcevision's
 * CONTENT feature space, so a model can be trained on ten ecosystems instead of
 * on one repo's own history.
 *
 * Why this exists (TN-S2, 2026-09-25):
 *   `runELMGate` trains on the target repo's own classifications, gated by a
 *   cold-start floor (classify-elm.ts: 30 examples / 3 categories / 20 llm-sourced).
 *   A fresh repo has no llm-sourced rows at gate time, so the floor bails and the
 *   gate never runs — which is exactly the population the tier was built for. A
 *   corpus IS prior knowledge, so training on it removes the floor from the path.
 *   Syrup demonstrated this works from a scratchpad file; by this project's own bar
 *   that does not count until it is committed and seeded. This is that script.
 *
 * What it does NOT do:
 *   - It does not re-split. Train/held-out assignments are carried through exactly
 *     as the corpus records them. Re-splitting would void every comparison to the
 *     certified 47.2%.
 *   - It does not train a shippable model, certify anything, or flip any flag.
 *     `--train` is a smoke check that the matrices learn, not an evaluation.
 *   - It never touches the evaluation repos. hono and trpc are refused by name.
 *
 * Two deliberate choices, both stricter than the ADR asked for:
 *
 *   1. Bytes are read from git AT EACH REPO'S PINNED COMMIT, not from the working
 *      tree. The corpus pins `git.commit` and `git.remote` per repo; all 2,195 rows
 *      were verified retrievable that way (`elm-content-availability.log`), and all
 *      ten commits still resolve on their remotes. Reading the working tree would
 *      make the output depend on whatever happens to be checked out.
 *
 *   2. Content is decoded by sourcevision's own `readFileContentSafely`, via a temp
 *      file, rather than by reimplementing it here. That function applies a binary
 *      sniff (`looksBinary`, not exported) and the MAX_CONTENT_BYTES truncation. A
 *      local reimplementation would drift, and the drift would land in the
 *      `contentMissing` / `contentEmpty` indicators — silently, and only for the
 *      files hardest to notice. Routing through the real function makes divergence
 *      impossible rather than unlikely.
 *
 * Provenance the output carries, so a stale featurisation is loud rather than silent:
 *   featureVersion, featureVectorSize, maxContentBytes, extractorSha256, corpusSha256.
 *   FEATURE_VERSION alone is not enough — a changed cap or a changed extractor with
 *   the same version number would invalidate the matrices with no error.
 *
 * Usage:
 *   node scripts/elm-corpus-featurise.mjs [corpus.json] [--out=path] [--train] [--seeds=N]
 */

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildFeatureVector,
  readFileContentSafely,
  FEATURE_VERSION,
  FEATURE_VECTOR_SIZE,
  MAX_CONTENT_BYTES,
} from "../packages/sourcevision/dist/analyzers/classify-elm-features.js";

const EVALUATION_REPOS = new Set(["hono", "trpc"]);

const arg = (k, d) => {
  const a = process.argv.slice(2).find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const flag = (k) => process.argv.slice(2).includes(`--${k}`);

const CORPUS = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "scripts/data/elm-archetype-corpus-v3-classtargeted.json";
const OUT = arg("out", CORPUS.replace(/elm-archetype-corpus-/, "elm-corpus-featurised-"));
const SEEDS = Number(arg("seeds", "15"));      // ELM_ENSEMBLE_SIZE, classify-elm.ts:647
const HIDDEN = Number(arg("hidden", "128"));   // HIDDEN_UNITS,        classify-elm.ts:36

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const git = (dir, args) => {
  try {
    return execFileSync("git", ["-C", dir, ...args], { encoding: "buffer", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return null;
  }
};

const corpusRaw = readFileSync(CORPUS);
const corpus = JSON.parse(corpusRaw.toString("utf-8"));
const extractorPath = "packages/sourcevision/dist/analyzers/classify-elm-features.js";

console.log("corpus          " + CORPUS);
console.log("rows            " + (corpus.train.length + corpus.heldOut.length) + `  (train ${corpus.train.length} + heldOut ${corpus.heldOut.length})`);
console.log("featureVersion  " + FEATURE_VERSION + `  (vector ${FEATURE_VECTOR_SIZE}, cap ${MAX_CONTENT_BYTES} bytes)`);

if (/resolved/.test(CORPUS)) {
  console.log("\n⚠️  This is the RESOLVED corpus — the rules' own output.");
  console.log("   A model trained on it learns archetypes.ts, and in production the rules run");
  console.log("   first, so those files never reach the tier. Residue-only for anything shipped.");
  console.log("   Continuing, because it is a legitimate input for catalog-coverage work.\n");
}

const repoMeta = new Map(corpus.provenance.repos.map((r) => [r.repo, r]));
for (const name of repoMeta.keys()) {
  if (EVALUATION_REPOS.has(name)) {
    console.error(`REFUSED: ${name} is part of the blind evaluation set and must never be trained on.`);
    process.exit(1);
  }
}

// Verify each pinned commit resolves before spending any work.
for (const [name, meta] of repoMeta) {
  if (!meta.git?.commit || git(meta.path, ["cat-file", "-e", `${meta.git.commit}^{commit}`]) === null) {
    console.error(`REFUSED: ${name} has no resolvable pinned commit at ${meta.path}. Run elm-content-availability.mjs first.`);
    process.exit(1);
  }
}

const tmp = mkdtempSync(join(tmpdir(), "elm-featurise-"));
const stats = { rows: 0, contentRead: 0, contentMissing: 0, truncated: 0, byRepo: {} };

/** One row -> one fixed-width vector, with content taken from git at the pinned commit. */
function vectorise(row) {
  const meta = repoMeta.get(row.repo);
  const blob = git(meta.path, ["cat-file", "blob", `${meta.git.commit}:${row.text}`]);
  const p = (stats.byRepo[row.repo] ??= { rows: 0, missing: 0 });
  p.rows++;
  stats.rows++;

  let content;
  if (blob !== null) {
    if (blob.length > MAX_CONTENT_BYTES) stats.truncated++;
    // Route through sourcevision's own reader so the binary sniff and the truncation
    // are the production ones, not a local copy of them.
    const scratch = join(tmp, "blob");
    writeFileSync(scratch, blob);
    content = readFileContentSafely(tmp, "blob");
  }
  if (content === undefined) {
    stats.contentMissing++;
    p.missing++;
  } else {
    stats.contentRead++;
  }

  // `path` is the REAL repo-relative path from the corpus — never the temp file's.
  const vec = buildFeatureVector(content === undefined ? { path: row.text } : { path: row.text, content });
  if (vec.length !== FEATURE_VECTOR_SIZE) throw new Error(`vector width ${vec.length} != ${FEATURE_VECTOR_SIZE} for ${row.repo}/${row.text}`);
  return vec;
}

const t0 = Date.now();
const featurise = (rows) => rows.map((r) => ({ x: vectorise(r), label: r.label, repo: r.repo, text: r.text }));
const train = featurise(corpus.train);
const heldOut = featurise(corpus.heldOut);
const featuriseSeconds = (Date.now() - t0) / 1000;
rmSync(tmp, { recursive: true, force: true });

const labels = [...new Set([...train, ...heldOut].map((r) => r.label))].sort();

const out = {
  schema: "elm-corpus-featurised/v1",
  generatedAt: new Date().toISOString(),
  generatedBy: "scripts/elm-corpus-featurise.mjs",
  featureSpace: {
    // All five must match at train time and at predict time. FEATURE_VERSION alone
    // is not sufficient: a changed cap or a rebuilt extractor invalidates these
    // matrices with no error and no version bump.
    featureVersion: FEATURE_VERSION,
    featureVectorSize: FEATURE_VECTOR_SIZE,
    maxContentBytes: MAX_CONTENT_BYTES,
    extractor: extractorPath,
    extractorSha256: sha256(readFileSync(extractorPath)),
  },
  source: {
    corpus: CORPUS,
    corpusSha256: sha256(corpusRaw),
    split: "carried from the corpus verbatim — NOT re-split",
    seed: corpus.provenance.seed,
    holdout: corpus.provenance.holdout,
    repos: [...repoMeta.values()].map((r) => ({ repo: r.repo, commit: r.git.commit, remote: r.git.remote })),
  },
  stats: {
    rows: stats.rows,
    contentRead: stats.contentRead,
    contentMissing: stats.contentMissing,
    truncatedAtCap: stats.truncated,
    featuriseSeconds,
    labels: labels.length,
    byRepo: stats.byRepo,
  },
  labels,
  train,
  heldOut,
};

writeFileSync(OUT, JSON.stringify(out));
const mb = (readFileSync(OUT).length / 1024 / 1024).toFixed(1);

console.log(`\n── Featurised ${"─".repeat(46)}`);
console.log(`  rows              ${stats.rows}`);
console.log(`  content read      ${stats.contentRead}`);
console.log(`  content missing   ${stats.contentMissing}   (binary or unreadable -> metadata-only vector)`);
console.log(`  truncated at cap  ${stats.truncated}`);
console.log(`  distinct labels   ${labels.length}`);
console.log(`  elapsed           ${featuriseSeconds.toFixed(1)}s`);
console.log(`  written           ${OUT}  (${mb} MB)`);

if (!flag("train")) {
  console.log("\n  --train to smoke-check that the matrices learn (not an evaluation).");
  process.exit(0);
}

// ── Smoke check ────────────────────────────────────────────────────────────────
// Trains the ensemble and reports TRAIN-SPLIT accuracy only. This says the bridge
// produces learnable matrices. It is NOT a generalisation result, NOT a
// certification, and must never be quoted as one.
const { ELM } = await import("@astermind/astermind-community");
const oneHot = (l) => labels.map((c) => (c === l ? 1 : 0));
const X = train.map((r) => r.x);
const Y = train.map((r) => oneHot(r.label));

const t1 = Date.now();
const models = [];
for (let i = 0; i < SEEDS; i++) {
  const e = new ELM({ categories: labels, hiddenUnits: HIDDEN, activation: "tanh", ridgeLambda: 0.01, seed: 1000 + i, log: { modelName: "bridge", verbose: false } });
  e.trainFromData(X, Y);
  models.push(e);
}
const trainSeconds = (Date.now() - t1) / 1000;

const vote = (vec) => {
  const tally = new Map();
  for (const m of models) {
    const { label } = m.predictFromVector([vec], 1)[0][0];
    tally.set(label, (tally.get(label) ?? 0) + 1);
  }
  let best = null;
  for (const [label, n] of tally) if (!best || n > best.n) best = { label, n };
  return { label: best.label, share: best.n / models.length };
};

let correct = 0;
for (const r of train) if (vote(r.x).label === r.label) correct++;

console.log(`\n── Smoke check ${"─".repeat(45)}`);
console.log(`  ${SEEDS} models x ${HIDDEN} hidden trained in ${trainSeconds.toFixed(1)}s on ${train.length} rows`);
console.log(`  (production geometry: ELM_ENSEMBLE_SIZE 15, HIDDEN_UNITS 128)`);
console.log(`  train-split agreement  ${((100 * correct) / train.length).toFixed(1)}%`);
console.log(`\n  ⚠️  TRAIN-SPLIT ONLY. The model was fitted on these rows, so this number is`);
console.log(`     capacity, not generalisation. It shows the bridge produces learnable`);
console.log(`     matrices and nothing else. Held-out and fresh-ecosystem numbers need a`);
console.log(`     pre-registered bar, committed before the run.`);
