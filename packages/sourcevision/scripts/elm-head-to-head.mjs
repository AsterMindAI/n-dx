/**
 * TJ-E1 — head to head: the original design vs the top-5 gate, on every axis that matters.
 *
 * Everything on this branch has been measured piecemeal across eight scripts, with the label
 * set, the training scope, the gate shape and the seed count all varying between them. That
 * makes the numbers hard to compare and easy to quote wrongly. This runs every configuration
 * through ONE methodology so the columns actually line up.
 *
 * THE CONFIGURATIONS
 *   0. LLM only                 status quo: 9 calls, no ELM
 *   1. ORIGINAL, bundled        16 classes, cross-repo pre-trained model   <- what was built
 *   2. ORIGINAL, per-project    16 classes, trained on the project's own history
 *   3. TOP-5, bundled           6 classes, cross-repo pre-trained model
 *   4. TOP-5, per-project       6 classes, project's own history — n-dx TODAY (191 train rows)
 *   5. TOP-5, per-project       6 classes — a MATURE project (nest, 627 train rows)
 *
 * All ELM configurations use the unanimity gate (all 5 models agree), which is the only gate
 * shape measured to be safe. Configurations 3-5 additionally defer any "other" prediction.
 *
 * EVERY ECONOMIC FIGURE IS MEASURED, NOT ASSUMED
 *   LLM call      105.4 s mean (71.2 / 172.6 / 101.7 / 75.9 timed on real calls)
 *                 22k-46k tokens, cache-state dependent (Team Nolan)
 *                 $0.021-0.061 at Sonnet 5 rates, cache-weighted
 *   batch         30 files per call (classify-llm.ts LLM_BATCH_SIZE)
 *   residue       255 files on n-dx (Nolan, elm-calls-avoided.json)
 *   ELM runtime   measured live here and SUBTRACTED from time saved
 *
 * "Precision" is agreement with an LLM teacher itself measured at 72.3% against human
 * judgement. A disagreement is a CHANGED label, not a proven wrong one.
 *
 * Usage: node --max-old-space-size=6144 packages/sourcevision/scripts/elm-head-to-head.mjs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

const SEED = 20260922, SEEDS = 8, ENSEMBLE = 5;
const CROSS_HELD = ["core", "fastify"];
const ROOTS = {
  "n-dx-1": ".", "AsterMind-Community-Edition": "../elm-fresh/AsterMind-Community-Edition",
  express: "../elm-fresh/express", fastify: "../elm-fresh/fastify",
  commerce: "../elm-fresh/commerce", got: "../elm-fresh/got", core: "../elm-fresh/core",
  typeorm: "../elm-fresh/typeorm", nest: "../elm-fresh/nest", remix: "../elm-fresh/remix",
};

const LLM_SEC = 105.4, BATCH = 30, RESIDUE = 255;
const TOK_LO = 22_000, TOK_HI = 46_000, USD_LO = 0.021, USD_HI = 0.061;

const F = await import("../dist/analyzers/classify-elm-features.js");
const { trainArchetypeELMNumeric } = await import("../dist/analyzers/classify-elm.js");

const corpus = JSON.parse(readFileSync("scripts/data/elm-archetype-corpus-v3-classtargeted.json", "utf-8"));
const all = [...corpus.train, ...corpus.heldOut].filter((r) => ROOTS[r.repo]);

process.stdout.write("extracting features... ");
const tEx = performance.now();
const vecs = new Map();
for (const r of all) {
  vecs.set(`${r.repo}::${r.text}`, F.buildFeatureVector({
    path: r.text, content: F.readFileContentSafely(resolve(ROOTS[r.repo]), r.text),
  }));
}
const EXTRACT_MS = (performance.now() - tEx) / all.length;
console.log(`${vecs.size} vectors (${EXTRACT_MS.toFixed(2)} ms/file)\n`);
const V = (r) => vecs.get(`${r.repo}::${r.text}`);

const gf = new Map();
for (const r of all) gf.set(r.label, (gf.get(r.label) ?? 0) + 1);
const TOP5 = new Set([...gf.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([l]) => l));
const foldTop5 = (rows) => rows.map((r) => (TOP5.has(r.label) ? r : { ...r, label: "other" }));

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const calls = (n) => Math.ceil(n / BATCH);
const pct = (x) => `${(100 * x).toFixed(1)}%`;

function shuffled(a, seed) {
  let s = seed >>> 0;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 0x100000000; };
  const c = [...a];
  for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
  return c;
}

function run(trainRows, testRows, base, deferOther) {
  const ex = trainRows.map((r) => ({ vector: V(r), archetype: r.label }));
  const cats = [...new Set(ex.map((e) => e.archetype))].sort();
  const t1 = performance.now();
  const ms = Array.from({ length: ENSEMBLE }, (_, i) => trainArchetypeELMNumeric(ex, cats, base + i * 7919, 128));
  const trainMs = performance.now() - t1;
  const t2 = performance.now();
  let kept = 0, hit = 0;
  for (const r of testRows) {
    const v = V(r), votes = new Map();
    for (const m of ms) { const [t] = m.elm.predictTopKFromVector(v, 1); votes.set(t.label, (votes.get(t.label) ?? 0) + 1); }
    const [lab, n] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n / ms.length < 1) continue;
    if (deferOther && lab === "other") continue;
    kept++;
    if (lab === r.label) hit++;
  }
  const inferMs = (performance.now() - t2) / testRows.length;
  return { cov: kept / testRows.length, prec: kept ? hit / kept : NaN, trainMs, inferMs, classes: cats.length };
}

/** Pool-and-split within each repo: what per-project training actually looks like. */
function perProject(rows, base, deferOther, repos) {
  const by = new Map();
  for (const r of rows) { if (!by.has(r.repo)) by.set(r.repo, []); by.get(r.repo).push(r); }
  const picks = repos ? repos : [...by.keys()].filter((k) => by.get(k).length >= 150);
  const out = [];
  for (const k of picks) {
    const sh = shuffled(by.get(k), base), cut = Math.floor(sh.length * 0.75);
    out.push(run(sh.slice(0, cut), sh.slice(cut), base, deferOther));
  }
  return {
    cov: mean(out.map((o) => o.cov)),
    prec: mean(out.map((o) => o.prec).filter((x) => !Number.isNaN(x))),
    trainMs: mean(out.map((o) => o.trainMs)),
    inferMs: mean(out.map((o) => o.inferMs)),
    classes: Math.round(mean(out.map((o) => o.classes))),
    trainRows: Math.round(mean(picks.map((k) => Math.floor(by.get(k).length * 0.75)))),
  };
}

const CONFIGS = [
  ["1. ORIGINAL · bundled", () => {
    const tr = all.filter((r) => !CROSS_HELD.includes(r.repo)), te = all.filter((r) => CROSS_HELD.includes(r.repo));
    return Array.from({ length: SEEDS }, (_, s) => run(tr, te, SEED + s * 31337, false));
  }],
  ["2. ORIGINAL · per-project", () => Array.from({ length: SEEDS }, (_, s) => perProject(all, SEED + s * 31337, false))],
  ["3. TOP-5 · bundled", () => {
    const f = foldTop5(all);
    const tr = f.filter((r) => !CROSS_HELD.includes(r.repo)), te = f.filter((r) => CROSS_HELD.includes(r.repo));
    return Array.from({ length: SEEDS }, (_, s) => run(tr, te, SEED + s * 31337, true));
  }],
  ["4. TOP-5 · per-project (n-dx today)", () => Array.from({ length: SEEDS }, (_, s) => perProject(foldTop5(all), SEED + s * 31337, true, ["n-dx-1"]))],
  ["5. TOP-5 · per-project (mature)", () => Array.from({ length: SEEDS }, (_, s) => perProject(foldTop5(all), SEED + s * 31337, true, ["nest"]))],
];

console.log("=".repeat(104));
console.log(`HEAD TO HEAD — original design vs top-5 gate   ${SEEDS} seeds · ${ENSEMBLE}-model ensemble · unanimity gate`);
console.log("=".repeat(104));
console.log(`n-dx residue ${RESIDUE} files · batch ${BATCH} · ${calls(RESIDUE)} LLM calls today`);
console.log(`measured: ${LLM_SEC}s, ${TOK_LO / 1000}-${TOK_HI / 1000}k tokens, $${USD_LO}-${USD_HI} per call\n`);

const base = calls(RESIDUE);
const rows = [];
for (const [name, fn] of CONFIGS) {
  const rs = fn();
  const cov = mean(rs.map((r) => r.cov)), prec = mean(rs.map((r) => r.prec).filter((x) => !Number.isNaN(x)));
  const elmSec = (EXTRACT_MS * RESIDUE + mean(rs.map((r) => r.trainMs)) + mean(rs.map((r) => r.inferMs)) * RESIDUE) / 1000;
  const resolved = Math.round(RESIDUE * cov);
  const remaining = calls(RESIDUE - resolved);
  rows.push({
    name, cov, covSd: sd(rs.map((r) => r.cov)), prec, precSd: sd(rs.map((r) => r.prec).filter((x) => !Number.isNaN(x))),
    saved: base - remaining, remaining, elmSec, resolved,
    changed: Math.round(resolved * (1 - prec)),
    classes: rs[0].classes, trainRows: rs[0].trainRows ?? null,
  });
}

console.log(`${"configuration".padEnd(36)} ${"cls".padStart(4)} ${"coverage".padStart(10)} ${"precision".padStart(11)} ${"calls".padStart(6)}`);
console.log("-".repeat(104));
console.log(`${"0. LLM only (status quo)".padEnd(36)} ${"16".padStart(4)} ${"—".padStart(10)} ${"(reference)".padStart(11)} ${String(base).padStart(6)}`);
for (const r of rows) {
  console.log(`${r.name.padEnd(36)} ${String(r.classes).padStart(4)} ${(pct(r.cov) + "±" + (100 * r.covSd).toFixed(0)).padStart(10)} ${(pct(r.prec) + "±" + (100 * r.precSd).toFixed(0)).padStart(11)} ${String(r.remaining).padStart(6)}`);
}

console.log("\n" + "=".repeat(104));
console.log("ECONOMICS — per full `ndx analyze` on n-dx");
console.log("=".repeat(104));
console.log(`${"configuration".padEnd(36)} ${"tokens".padStart(13)} ${"saved".padStart(13)} ${"cost".padStart(14)} ${"wall clock".padStart(12)} ${"labels changed".padStart(15)}`);
console.log("-".repeat(104));
const llmSecTotal = base * LLM_SEC;
console.log(`${"0. LLM only (status quo)".padEnd(36)} ${`${(base * TOK_LO / 1000).toFixed(0)}-${(base * TOK_HI / 1000).toFixed(0)}k`.padStart(13)} ${"—".padStart(13)} ${`$${(base * USD_LO).toFixed(2)}-${(base * USD_HI).toFixed(2)}`.padStart(14)} ${`${(llmSecTotal / 60).toFixed(1)} min`.padStart(12)} ${"0 (reference)".padStart(15)}`);
for (const r of rows) {
  const tok = `${(r.remaining * TOK_LO / 1000).toFixed(0)}-${(r.remaining * TOK_HI / 1000).toFixed(0)}k`;
  const sav = r.saved === 0 ? "none" : `${(r.saved * TOK_LO / 1000).toFixed(0)}-${(r.saved * TOK_HI / 1000).toFixed(0)}k`;
  const usd = `$${(r.remaining * USD_LO).toFixed(2)}-${(r.remaining * USD_HI).toFixed(2)}`;
  const wall = (r.remaining * LLM_SEC + r.elmSec) / 60;
  console.log(`${r.name.padEnd(36)} ${tok.padStart(13)} ${sav.padStart(13)} ${usd.padStart(14)} ${`${wall.toFixed(1)} min`.padStart(12)} ${String(r.changed).padStart(15)}`);
}

console.log("\n" + "=".repeat(104));
console.log("WHAT EACH CONFIGURATION COSTS YOU BEYOND TOKENS");
console.log("=".repeat(104));
console.log(`${"configuration".padEnd(36)} ${"ELM runtime".padStart(12)} ${"artifact".padStart(10)}  notes`);
console.log("-".repeat(104));
for (const r of rows) {
  const bundled = r.name.includes("bundled");
  console.log(`${r.name.padEnd(36)} ${`${r.elmSec.toFixed(1)} s`.padStart(12)} ${(bundled ? "25.5 MB" : "none").padStart(10)}  ${
    bundled ? "ships in the package; must be retrained on catalog change"
            : "trained per run from project history; nothing to ship"}`);
}

console.log("\n" + "=".repeat(104));
console.log("READING THIS");
console.log("=".repeat(104));
console.log("· 'labels changed' is how many of the 255 residue files get a different archetype");
console.log("  than the LLM would have assigned. Archetypes drive finding-severity thresholds and");
console.log("  the AI-readable summary, so these are not cosmetic.");
console.log("· Precision is agreement with a teacher measured at 72.3% vs human judgement.");
console.log("· Wall clock includes the ELM's own runtime; token and cost columns do not, because");
console.log("  the ELM spends none.");
console.log("· Config 5 is the same code as config 4 on a project with 627 labelled files instead");
console.log("  of 191. The difference between those two rows is the entire argument.");
