#!/usr/bin/env node
/**
 * Content-availability check for re-featurising the corpus into a content-based
 * feature space (Syrup's 4B).
 *
 * For every row: does the pinned commit still resolve, does the path still exist
 * at that commit, and how big is the blob against MAX_CONTENT_BYTES (64 KB)?
 *
 * Reads only. Never fetches. Uses each repo's local clone at the path recorded in
 * the corpus provenance, and resolves blobs out of git rather than the working
 * tree, so a dirty checkout cannot contaminate the answer.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const MAX_CONTENT_BYTES = 64 * 1024; // classify-elm-features.ts:133
const CORPUS = process.argv[2] ?? "scripts/data/elm-archetype-corpus-v3-classtargeted.json";

const git = (dir, args) => {
  try {
    return execFileSync("git", ["-C", dir, ...args], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
};

const corpus = JSON.parse(readFileSync(CORPUS, "utf-8"));
const rows = [...corpus.train, ...corpus.heldOut];
const repoMeta = new Map(corpus.provenance.repos.map((r) => [r.repo, r]));

console.log(`corpus   ${CORPUS}`);
console.log(`rows     ${rows.length}  (train ${corpus.train.length} + heldOut ${corpus.heldOut.length})`);
console.log(`cap      ${MAX_CONTENT_BYTES} bytes\n`);

// --- per repo: is the pinned commit reachable in the local clone? ---
const repoState = new Map();
for (const [name, meta] of repoMeta) {
  const dir = meta.path;
  const commit = meta.git?.commit;
  const isRepo = git(dir, ["rev-parse", "--git-dir"]) !== null;
  const hasCommit = isRepo && commit ? git(dir, ["cat-file", "-e", `${commit}^{commit}`]) !== null : false;
  repoState.set(name, { dir, commit, remote: meta.git?.remote, isRepo, hasCommit });
}

console.log("repo                          clone  commit  rows");
console.log("─".repeat(60));
const rowsByRepo = {};
for (const r of rows) rowsByRepo[r.repo] = (rowsByRepo[r.repo] || 0) + 1;
for (const [name, s] of repoState) {
  console.log(
    `${name.padEnd(30)}${(s.isRepo ? "yes" : "NO ").padEnd(7)}${(s.hasCommit ? "yes" : "MISSING").padEnd(8)}${String(rowsByRepo[name] ?? 0).padStart(5)}`,
  );
}

// --- per row: blob presence and size at the pinned commit ---
const stats = {
  resolved: 0,
  missingCommit: 0,
  missingPath: 0,
  truncated: 0,
  empty: 0,
  bytesTotal: 0,
  bytesUsable: 0,
};
const perRepo = {};
const missingPaths = [];
const truncatedPaths = [];

for (const row of rows) {
  const s = repoState.get(row.repo);
  const p = (perRepo[row.repo] ??= { rows: 0, ok: 0, missing: 0, truncated: 0, empty: 0 });
  p.rows++;
  if (!s || !s.hasCommit) {
    stats.missingCommit++;
    p.missing++;
    continue;
  }
  const size = git(s.dir, ["cat-file", "-s", `${s.commit}:${row.text}`]);
  if (size === null) {
    stats.missingPath++;
    p.missing++;
    if (missingPaths.length < 12) missingPaths.push(`${row.repo}  ${row.text}`);
    continue;
  }
  const n = Number(size);
  stats.resolved++;
  p.ok++;
  stats.bytesTotal += n;
  stats.bytesUsable += Math.min(n, MAX_CONTENT_BYTES);
  if (n === 0) {
    stats.empty++;
    p.empty++;
  }
  if (n > MAX_CONTENT_BYTES) {
    stats.truncated++;
    p.truncated++;
    if (truncatedPaths.length < 12) truncatedPaths.push(`${row.repo}  ${row.text}  ${(n / 1024).toFixed(0)} KB`);
  }
}

const pct = (n) => `${((100 * n) / rows.length).toFixed(1)}%`;
console.log(`\n── Availability ${"─".repeat(44)}`);
console.log(`  resolved            ${String(stats.resolved).padStart(5)}  ${pct(stats.resolved)}`);
console.log(`  commit unreachable  ${String(stats.missingCommit).padStart(5)}  ${pct(stats.missingCommit)}`);
console.log(`  path gone at commit ${String(stats.missingPath).padStart(5)}  ${pct(stats.missingPath)}`);
console.log(`\n── Content, of the resolved ${"─".repeat(33)}`);
console.log(`  over the 64 KB cap  ${String(stats.truncated).padStart(5)}  ${pct(stats.truncated)}  (truncated, not lost)`);
console.log(`  zero bytes          ${String(stats.empty).padStart(5)}  ${pct(stats.empty)}  (all-zero content block)`);
console.log(`  bytes on disk       ${(stats.bytesTotal / 1024 / 1024).toFixed(1)} MB`);
console.log(`  bytes after cap     ${(stats.bytesUsable / 1024 / 1024).toFixed(1)} MB  (what the extractor would read)`);

console.log(`\n── Per repo ${"─".repeat(48)}`);
console.log("repo                          rows    ok  missing  trunc  empty");
for (const [name, p] of Object.entries(perRepo).sort((a, b) => b[1].rows - a[1].rows)) {
  console.log(
    `${name.padEnd(28)}${String(p.rows).padStart(6)}${String(p.ok).padStart(6)}${String(p.missing).padStart(9)}${String(p.truncated).padStart(7)}${String(p.empty).padStart(7)}`,
  );
}

if (missingPaths.length) {
  console.log(`\n  sample of paths that no longer resolve:`);
  for (const m of missingPaths) console.log(`    ${m}`);
}
if (truncatedPaths.length) {
  console.log(`\n  largest-file sample (truncated to 64 KB, still usable):`);
  for (const m of truncatedPaths) console.log(`    ${m}`);
}

const viable = stats.resolved / rows.length;
console.log(`\n── Verdict ${"─".repeat(49)}`);
console.log(`  ${(100 * viable).toFixed(1)}% of rows have retrievable content at their pinned commit.`);
console.log(`  Re-featurising is ${viable > 0.95 ? "VIABLE" : viable > 0.8 ? "VIABLE WITH LOSSES" : "NOT VIABLE AS PINNED"}.`);
