#!/usr/bin/env node
/**
 * Classify ONLY a repo's still-unclassified files, with the production prompt and
 * the repo's own pinned teacher. Incremental, which `sourcevision analyze` is not
 * when run as `--only=classifications`.
 *
 * Why this exists (TN-N20, 2026-09-21):
 *   `analyze <repo> --only=classifications` skips the inventory phase, so
 *   `ctx.inventoryResult.changedFiles` is undefined. The reuse branch at
 *   packages/sourcevision/src/analyzers/classify.ts:100 requires `changedFiles`, so
 *   it never fires and EVERY residue file is re-sent to the LLM — including labels
 *   already paid for. Found when nest's 17 failed batches needed retrying and the
 *   rerun started re-labelling all 844 residue files instead of the 485 left.
 *
 * What this does instead, mirroring analyze.ts:107-108 exactly:
 *   loadLLMConfig(<repo>)          -> teacher from <repo>/.n-dx.json (the pin)
 *   setLLMConfig(config)
 *   enrichClassificationsWithLLM() -> sends only archetype === null files
 *   mergeClassificationResults()   -> existing labels are kept untouched
 *
 * It uses sourcevision's REAL prompt, not a replica, so rows labelled here are the
 * same provenance as rows labelled by `analyze`.
 *
 * Safety:
 *   - refuses hono and trpc (the evaluation set) by repo identity
 *   - backs up classifications.json before writing (the staging tree is unversioned)
 *   - refuses to write if any previously-labelled file would change
 *   - prints the resolved teacher model BEFORE any call is made
 *
 * Usage: node scripts/elm-classify-residue.mjs <repo-dir> [--dry-run]
 * Needs the `claude` binary on PATH.
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { loadLLMConfig } from "../packages/llm-client/dist/public.js";
import { setLLMConfig } from "../packages/sourcevision/dist/analyzers/claude-client.js";
import { enrichClassificationsWithLLM, mergeClassificationResults } from "../packages/sourcevision/dist/analyzers/classify.js";

const EVALUATION_REPOS = new Set(["hono", "trpc"]);

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const dir = args.find((a) => !a.startsWith("--"));
  if (!dir) { console.error("usage: elm-classify-residue.mjs <repo-dir> [--dry-run]"); process.exit(2); }

  const abs = resolve(dir);
  const repo = basename(abs);
  if (EVALUATION_REPOS.has(repo)) {
    console.error(`REFUSED: ${repo} is part of gold set #2, the evaluation set. It is never labelled for training.`);
    process.exit(1);
  }

  const sv = join(abs, ".sourcevision");
  const read = (n) => JSON.parse(readFileSync(join(sv, n), "utf-8"));
  for (const n of ["classifications.json", "inventory.json", "imports.json"]) {
    if (!existsSync(join(sv, n))) { console.error(`missing ${n} in ${sv} — run analyze --fast first`); process.exit(1); }
  }
  const classifications = read("classifications.json");
  const inventory = read("inventory.json");
  const imports = read("imports.json");

  const before = new Map(classifications.files.map((f) => [f.path, f]));
  const pending = classifications.files.filter((f) => f.archetype == null && f.source === "algorithmic").length;

  const config = await loadLLMConfig(abs);
  const model = config?.claude?.model ?? config?.model ?? "(unresolved)";
  console.log(`repo      ${repo}`);
  console.log(`teacher   ${model}  (from ${repo}/.n-dx.json)`);
  console.log(`pending   ${pending} unclassified files -> ${Math.ceil(pending / 30)} batches`);
  console.log(`keeping   ${classifications.files.length - pending} existing classifications untouched`);
  if (!model || model === "(unresolved)") { console.error("REFUSED: teacher model did not resolve. Pin it in .n-dx.json first."); process.exit(1); }
  if (pending === 0) { console.log("nothing to do"); return; }
  if (dryRun) { console.log("dry run — no calls made"); return; }

  setLLMConfig(config);
  const result = await enrichClassificationsWithLLM(classifications, inventory, imports);
  const merged = mergeClassificationResults(classifications, result.updatedFiles);

  // Refuse to write if anything that was already labelled has changed.
  let altered = 0;
  for (const f of merged.files) {
    const prev = before.get(f.path);
    if (prev && prev.archetype != null && (prev.archetype !== f.archetype || prev.source !== f.source)) altered++;
  }
  if (altered > 0) {
    console.error(`REFUSED to write: ${altered} previously-labelled files would change. Nothing written.`);
    process.exit(1);
  }

  const backup = join(sv, `classifications.pre-residue-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  copyFileSync(join(sv, "classifications.json"), backup);
  writeFileSync(join(sv, "classifications.json"), JSON.stringify(merged, null, 2));

  const after = merged.files.filter((f) => f.archetype == null).length;
  console.log(`\nlabelled  ${result.updatedFiles.length} files`);
  console.log(`remaining ${after} unclassified  (${after > 0 ? "teacher declined or batches failed — see log" : "none"})`);
  console.log(`backup    ${backup}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
