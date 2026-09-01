#!/usr/bin/env node
/**
 * Build the gold set #2 labelling packet — Phase 3, Option B.
 *
 * Implements the Phase 3 pre-registration in
 * Claude-Context/IMPL/IMPL-2026-08-28-jam-elm-tier-implementation.md, committed
 * at 55236e3c/b028b589 with the teacher amendment at d2ea812c — all BEFORE this
 * script ran and before any file was labelled.
 *
 * ── The contamination rule this file enforces mechanically ────────────────
 * Gold set #1 is spent. Gold set #2 must contain NO file that appears in
 * `elm-archetype-corpus.json`, or the model would be certified partly on its
 * own training data. That is asserted here rather than trusted — corpus #1
 * harvested the ENTIRE LLM-labelled population of n-dx and AsterMind-CE, so
 * both repos are excluded outright and the assertion is the backstop.
 *
 * ── What the labeller sees ────────────────────────────────────────────────
 * Paths only. No teacher label, no ELM prediction, no confidence. Same blind
 * two-pass protocol as gold set #1: pass 1 from the path alone (what both
 * machines see), pass 2 after opening the file (ground truth). The gap between
 * them is the path-information ceiling.
 *
 * The LLM's own labels ARE written, to a SEPARATE file, so certification can
 * join them later. They must never be merged into the packet.
 *
 * Usage: node scripts/elm-goldset2-packet.mjs [--n=250] [--seed=20260901]
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const CORPUS1 = "scripts/data/elm-archetype-corpus.json";
const OUT_PACKET = "scripts/data/k2-goldset2-packet.csv";
const OUT_LABELS = "scripts/data/k2-goldset2-llm-labels.json";

/** Pre-registered: 250 files, seed 20260901, simple random sample (NOT stratified). */
const DEFAULT_N = 250;
const DEFAULT_SEED = 20260901;

/** Fresh repos. Neither contributed a single row to corpus #1. */
const REPOS = [
  { repo: "hono", path: "/Users/nolanmoore/n-dx-elm-corpus/hono", classifyCalls: 4 },
  { repo: "trpc", path: "/Users/nolanmoore/n-dx-elm-corpus/trpc", classifyCalls: 8 },
];

/** Pinned explicitly in each target's .n-dx.json — see the Phase 3 teacher amendment. */
const TEACHER = "claude-sonnet-5";

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? Number(a.slice(k.length + 3)) : d;
};

/** mulberry32 — the same generator the corpus builder and packet #1 use. */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gitInfo(dir) {
  const run = (...args) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf-8" }).trim();
  try {
    return { commit: run("rev-parse", "HEAD"), remote: run("config", "--get", "remote.origin.url") };
  } catch {
    return { commit: null, remote: null };
  }
}

const csvField = (v) => `"${String(v).replaceAll('"', '""')}"`;

function main() {
  const n = arg("n", DEFAULT_N);
  const seed = arg("seed", DEFAULT_SEED);

  // ── The sampling frame: files the LLM actually labelled. ────────────────
  // A paired ELM-vs-LLM comparison is only defined where the LLM produced a
  // label. The prompt permits omissions ("Omit files with no clear fit") and a
  // handful were omitted — all non-source files (.sh, .sql) that the inventory
  // catalogued. They are counted and reported, not silently dropped.
  const pool = [];
  const omitted = [];
  for (const r of REPOS) {
    const cls = JSON.parse(readFileSync(`${r.path}/.sourcevision/classifications.json`, "utf-8"));
    for (const f of cls.files) {
      if (f.source === "llm" && f.archetype) pool.push({ repo: r.repo, path: f.path, llmLabel: f.archetype, llmConfidence: f.confidence ?? null });
      else if (!f.archetype) omitted.push({ repo: r.repo, path: f.path });
    }
  }

  // ── Contamination assertion. Not a comment — a check. ───────────────────
  const c1 = JSON.parse(readFileSync(CORPUS1, "utf-8"));
  const seen = new Set([...c1.train, ...c1.heldOut].map((r) => `${r.repo}::${r.text}`));
  const alsoByPath = new Set([...c1.train, ...c1.heldOut].map((r) => r.text));
  const collide = pool.filter((p) => seen.has(`${p.repo}::${p.path}`) || alsoByPath.has(p.path));
  if (collide.length) {
    throw new Error(
      `CONTAMINATION: ${collide.length} candidate files also appear in corpus #1.\n` +
      collide.slice(0, 5).map((c) => `  ${c.repo}::${c.path}`).join("\n") +
      "\nGold set #2 must be disjoint from the training corpus. Refusing to build the packet.",
    );
  }
  if (pool.length < n) throw new Error(`Pool has ${pool.length} files, need ${n}.`);

  // ── Sample: simple random, fixed seed, NOT stratified. ──────────────────
  // Stratifying by predicted class would distort the coverage the tier
  // achieves, and coverage is one of the quantities being measured.
  const rand = mulberry32(seed);
  const idx = pool.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const sample = idx.slice(0, n).map((i) => pool[i]);

  // Shuffle again for presentation order, so the packet carries no repo grouping.
  const order = sample.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const rows = order.map((i) => sample[i]);

  const rootByRepo = Object.fromEntries(REPOS.map((r) => [r.repo, r.path]));
  const header = "id,repo,path,full_path_to_open,pass1_path_only,pass2_after_reading_file,confident_yes_no,notes";
  const body = rows.map((r, i) =>
    [i + 1, csvField(r.repo), csvField(r.path), csvField(`${rootByRepo[r.repo]}/${r.path}`), "", "", "", ""].join(","),
  ).join("\n");
  writeFileSync(OUT_PACKET, `${header}\n${body}\n`);

  // The teacher's answers — a SEPARATE file. Never merged into the packet.
  writeFileSync(OUT_LABELS, JSON.stringify({
    schema: "k2-goldset2-llm-labels/v1",
    generatedAt: new Date().toISOString(),
    generatedBy: "scripts/elm-goldset2-packet.mjs",
    warning: "TEACHER LABELS, NOT TRUTH. Truth comes from the human packet. Do not merge into the packet.",
    teacher: { model: TEACHER, pinnedVia: "target .n-dx.json llm.claude.model", promptSite: "classify.ts:486", batchSize: 30 },
    provenance: REPOS.map((r) => ({ repo: r.repo, path: r.path, git: gitInfo(r.path), classifyCalls: r.classifyCalls })),
    totalClassifyCalls: REPOS.reduce((s, r) => s + r.classifyCalls, 0),
    poolSize: pool.length,
    sampled: n, seed,
    omittedByLlm: omitted,
    labels: rows.map((r, i) => ({ id: i + 1, repo: r.repo, path: r.path, llmLabel: r.llmLabel, llmConfidence: r.llmConfidence })),
  }, null, 2) + "\n");

  // ── Report. Distribution is from TEACHER labels, so it leaks no truth. ──
  const dist = {};
  for (const r of rows) dist[r.llmLabel] = (dist[r.llmLabel] ?? 0) + 1;
  const byRepo = {};
  for (const r of rows) byRepo[r.repo] = (byRepo[r.repo] ?? 0) + 1;
  const SU = new Set(["service", "utility"]);
  const suShare = rows.filter((r) => SU.has(r.llmLabel)).length / rows.length;
  const c1dist = c1.stats.distribution;
  const c1su = (c1dist.service + c1dist.utility) / c1.stats.total;

  console.log("Gold set #2 packet — Phase 3, Option B\n");
  console.log(`  pool ${pool.length} LLM-labelled files across ${REPOS.length} fresh repos`);
  console.log(`  sampled ${n} (simple random, seed ${seed}) — ${Object.entries(byRepo).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(`  teacher: ${TEACHER}, ${REPOS.reduce((s, r) => s + r.classifyCalls, 0)} classify calls spent`);
  console.log(`  contamination check: PASSED — 0 of ${pool.length} candidates appear in corpus #1`);
  console.log(`  LLM omitted ${omitted.length} file(s) entirely (non-source: .sh/.sql); excluded from the frame\n`);

  console.log("  Teacher-label distribution in the packet (NOT truth):");
  for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(14)} ${String(v).padStart(3)}  ${(v / n * 100).toFixed(1)}%`);
  }

  console.log(`\n  ⚠️  DISTRIBUTION SHIFT vs corpus #1 — record this before the labels come back:`);
  console.log(`    service+utility   corpus #1 ${(c1su * 100).toFixed(1)}%   ->   gold set #2 ${(suShare * 100).toFixed(1)}%`);
  console.log("    The tier abstains on service/utility, so its COVERAGE here will be much higher");
  console.log("    than the 32.9% measured on gold set #1. That is a property of these repos, not");
  console.log("    an improvement in the model, and K1' must be read with that stated.");
  const unseen = Object.keys(dist).filter((k) => !(k in c1dist));
  const thin = Object.keys(dist).filter((k) => (c1dist[k] ?? 0) > 0 && (c1dist[k] ?? 0) < 10);
  if (unseen.length) console.log(`    ⚠️  classes with ZERO training rows: ${unseen.join(", ")} — the ELM cannot predict these at all`);
  if (thin.length) console.log(`    classes with <10 training rows: ${thin.join(", ")}`);

  console.log(`\n  wrote ${OUT_PACKET}   (blind — paths only)`);
  console.log(`  wrote ${OUT_LABELS}   (teacher labels, kept separate)`);
  console.log("\n  Protocol, unchanged from gold set #1:");
  console.log("    pass1 — label from the `path` column ALONE, before opening anything");
  console.log("    pass2 — open `full_path_to_open`, then label again. This is truth.");
  console.log("    confident_yes_no — judge taxonomy health on THIS, not on `unclear`");
  console.log("                       (`unclear` was 0/83 on #1 while not-confident was 30/83)");
  console.log("\n  A different labeller from gold set #1 also yields the inter-rater number TN-J20 could not.");
}

main();
