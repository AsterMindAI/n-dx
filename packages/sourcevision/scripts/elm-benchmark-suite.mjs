/**
 * TJ-E1 benchmark suite — the five measurements the other scripts left open.
 *
 * Each section exists because a decision depends on it, not because the number is interesting.
 *
 *   A. ABLATION        Does file content earn its place? This is IMPL step 8 and the ADR's OWN
 *                      stated success criterion ("beats the best metadata-only representation").
 *                      It was never run, and the ADR records that as an open gap. Closing it.
 *   B. PER-CLASS       Which archetypes does it get right? If accuracy is concentrated in a few
 *                      classes, a PARTIAL gate — trust it only for those — is a real product that
 *                      nobody has evaluated.
 *   C. LEARNING CURVE  The published data-scaling extrapolation rests on TWO points, log-linear.
 *                      This measures the actual curve so the projection can be corrected or
 *                      retracted rather than defended.
 *   D. ABSTAIN GATE    Nolan's B+su design: refuse to answer when about to say service/utility.
 *                      Named three times as "the one cheap idea left" and never tested.
 *   E. SEED VARIANCE   Every headline number in this project came from ONE seed. This says how
 *                      much of the spread between them is real.
 *
 * Held-out is core + fastify in every section, so all figures here are mutually comparable and
 * comparable to elm-capacity-corpus-sweep.mjs. hono/trpc are Nolan's blind set: absent throughout.
 *
 * Usage: node --max-old-space-size=6144 packages/sourcevision/scripts/elm-benchmark-suite.mjs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SEED = 20260922;
const CORPUS = "scripts/data/elm-archetype-corpus-v3-classtargeted.json";
const HELD_OUT = ["core", "fastify"];
const ROOTS = {
  "n-dx-1": ".", "AsterMind-Community-Edition": "../elm-fresh/AsterMind-Community-Edition",
  express: "../elm-fresh/express", fastify: "../elm-fresh/fastify",
  commerce: "../elm-fresh/commerce", got: "../elm-fresh/got", core: "../elm-fresh/core",
  typeorm: "../elm-fresh/typeorm", nest: "../elm-fresh/nest", remix: "../elm-fresh/remix",
};

const F = await import("../dist/analyzers/classify-elm-features.js");
const { trainArchetypeELMNumeric } = await import("../dist/analyzers/classify-elm.js");

const corpus = JSON.parse(readFileSync(CORPUS, "utf-8"));
const all = [...corpus.train, ...corpus.heldOut].filter((r) => ROOTS[r.repo]);

process.stdout.write("extracting features... ");
const vecs = new Map();
for (const r of all) {
  vecs.set(`${r.repo}::${r.text}`, F.buildFeatureVector({
    path: r.text, content: F.readFileContentSafely(resolve(ROOTS[r.repo]), r.text),
  }));
}
console.log(`${vecs.size} vectors\n`);

const V = (r) => vecs.get(`${r.repo}::${r.text}`);
const test = all.filter((r) => HELD_OUT.includes(r.repo));
const pool = all.filter((r) => !HELD_OUT.includes(r.repo));
const SINK = new Set(["service", "utility"]);

const majority = (() => {
  const m = new Map();
  for (const r of test) m.set(r.label, (m.get(r.label) ?? 0) + 1);
  return Math.max(...m.values()) / test.length;
})();

function train(rows, seed = SEED, mask = null, hidden = 128) {
  const ex = rows.map((r) => ({ vector: mask ? mask(V(r)) : V(r), archetype: r.label }));
  const cats = [...new Set(ex.map((e) => e.archetype))].sort();
  return trainArchetypeELMNumeric(ex, cats, seed, hidden);
}
function predictAll(models, rows, mask = null) {
  return rows.map((r) => {
    const v = mask ? mask(V(r)) : V(r);
    const votes = new Map();
    for (const m of models) {
      const [t] = m.elm.predictTopKFromVector(v, 1);
      votes.set(t.label, (votes.get(t.label) ?? 0) + 1);
    }
    const [lab, n] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    return { predicted: lab, actual: r.label, share: n / models.length };
  });
}
const acc = (p) => p.filter((x) => x.predicted === x.actual).length / p.length;
const line = (c = "-") => console.log(c.repeat(88));
const pct = (x) => `${(100 * x).toFixed(1)}%`;

console.log("=".repeat(88));
console.log(`TJ-E1 BENCHMARK SUITE   seed=${SEED}   held-out ${HELD_OUT.join("+")} (${test.length} rows)`);
console.log(`majority baseline ${pct(majority)}   ·   train pool ${pool.length} rows`);
console.log("=".repeat(88));

// ── A. ABLATION ──────────────────────────────────────────────────────────────────────────
// Masking zeroes a block rather than removing it, so vector width (and therefore the random
// projection) is identical across configs. Changing width would confound the comparison.
function masker(keep) {
  const B = {
    ext: [F.OFFSET_EXT, F.OFFSET_EXT + F.EXT_BLOCK_SIZE],
    pathScalars: [F.OFFSET_PATH_SCALARS, F.OFFSET_PATH_SCALARS + F.PATH_SCALAR_BLOCK_SIZE],
    pathTokens: [F.OFFSET_PATH_TOKENS, F.OFFSET_PATH_TOKENS + F.PATH_TOKEN_BUCKETS],
    content: [F.OFFSET_CONTENT_TOKENS, F.OFFSET_CONTENT_TOKENS + F.CONTENT_TOKEN_BUCKETS],
    structural: [F.OFFSET_STRUCTURAL, F.OFFSET_STRUCTURAL + F.STRUCTURAL_BLOCK_SIZE],
    indicators: [F.OFFSET_INDICATORS, F.OFFSET_INDICATORS + F.INDICATOR_BLOCK_SIZE],
  };
  return (v) => {
    const out = new Array(v.length).fill(0);
    for (const k of keep) for (let i = B[k][0]; i < B[k][1]; i++) out[i] = v[i];
    return out;
  };
}
const ALL_BLOCKS = ["ext", "pathScalars", "pathTokens", "content", "structural", "indicators"];
const CONFIGS = [
  ["everything", ALL_BLOCKS],
  ["metadata only (no content)", ["ext", "pathScalars", "pathTokens"]],
  ["content only", ["content", "structural", "indicators"]],
  ["content tokens only", ["content"]],
  ["no content tokens", ["ext", "pathScalars", "pathTokens", "structural", "indicators"]],
  ["no structural counts", ["ext", "pathScalars", "pathTokens", "content", "indicators"]],
  ["extension only", ["ext"]],
];

line("=");
console.log("A. ABLATION — does file content earn its place?  (the ADR's own open gap)");
line();
console.log(`${"configuration".padEnd(30)} ${"accuracy".padStart(9)} ${"vs majority".padStart(12)} ${"vs full".padStart(9)}`);
let fullAcc = null;
for (const [name, keep] of CONFIGS) {
  const mask = masker(keep);
  const models = [0, 1, 2].map((i) => train(pool, SEED + i * 7919, mask));
  const a = acc(predictAll(models, test, mask));
  if (fullAcc === null) fullAcc = a;
  const d = a - majority, dv = a - fullAcc;
  console.log(`${name.padEnd(30)} ${pct(a).padStart(9)} ${((d >= 0 ? "+" : "") + (100 * d).toFixed(1)).padStart(12)} ${((dv >= 0 ? "+" : "") + (100 * dv).toFixed(1)).padStart(9)}`);
}

// ── B. PER-CLASS ─────────────────────────────────────────────────────────────────────────
line("=");
console.log("B. PER-CLASS — is accuracy concentrated? (could a PARTIAL gate ship?)");
line();
const ens = [0, 1, 2, 3, 4].map((i) => train(pool, SEED + i * 7919));
const preds = predictAll(ens, test);
const stats = new Map();
for (const p of preds) {
  if (!stats.has(p.actual)) stats.set(p.actual, { support: 0, hit: 0, predicted: 0 });
  if (!stats.has(p.predicted)) stats.set(p.predicted, { support: 0, hit: 0, predicted: 0 });
  stats.get(p.actual).support++;
  stats.get(p.predicted).predicted++;
  if (p.actual === p.predicted) stats.get(p.actual).hit++;
}
console.log(`${"archetype".padEnd(16)} ${"support".padStart(8)} ${"recall".padStart(8)} ${"predicted".padStart(10)} ${"precision".padStart(10)}`);
const rows = [...stats.entries()].sort((a, b) => b[1].support - a[1].support);
for (const [lab, s] of rows) {
  const rec = s.support ? s.hit / s.support : NaN;
  const prec = s.predicted ? s.hit / s.predicted : NaN;
  console.log(`${lab.padEnd(16)} ${String(s.support).padStart(8)} ${(s.support ? pct(rec) : "—").padStart(8)} ${String(s.predicted).padStart(10)} ${(s.predicted ? pct(prec) : "—").padStart(10)}`);
}
const conf = new Map();
for (const p of preds) if (p.predicted !== p.actual) {
  const k = `${p.actual} → ${p.predicted}`;
  conf.set(k, (conf.get(k) ?? 0) + 1);
}
console.log("\ntop confusions:");
for (const [k, n] of [...conf.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
  console.log(`  ${String(n).padStart(4)}  ${k}`);
}

// ── C. LEARNING CURVE ────────────────────────────────────────────────────────────────────
line("=");
console.log("C. LEARNING CURVE — replacing a two-point extrapolation with the real shape");
line();
function shuffled(a, seed) {
  let s = seed >>> 0;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 0x100000000; };
  const c = [...a];
  for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
  return c;
}
console.log(`${"train rows".padStart(11)} ${"accuracy".padStart(9)} ${"vs majority".padStart(12)} ${"spread".padStart(8)}`);
const curve = [];
for (const n of [100, 250, 500, 800, 1200, 1600, pool.length]) {
  const runs = [0, 1, 2].map((k) => {
    const sub = shuffled(pool, SEED + k * 104729).slice(0, n);
    return acc(predictAll([train(sub, SEED + k * 7919)], test));
  });
  const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
  curve.push([n, mean]);
  console.log(`${String(n).padStart(11)} ${pct(mean).padStart(9)} ${((mean - majority >= 0 ? "+" : "") + (100 * (mean - majority)).toFixed(1)).padStart(12)} ${(100 * (Math.max(...runs) - Math.min(...runs))).toFixed(1).padStart(7)}pp`);
}
const [n1, a1] = curve[0], [n2, a2] = curve[curve.length - 1];
const slope = (a2 - a1) / (Math.log10(n2) - Math.log10(n1));
console.log(`\nmeasured slope across the full range: ${(100 * slope).toFixed(1)} pp per 10x data`);
const mid = curve[Math.floor(curve.length / 2)];
const early = (mid[1] - a1) / (Math.log10(mid[0]) - Math.log10(n1));
const late = (a2 - mid[1]) / (Math.log10(n2) - Math.log10(mid[0]));
console.log(`  first half ${(100 * early).toFixed(1)} pp/10x   ·   second half ${(100 * late).toFixed(1)} pp/10x`);
console.log(late < early * 0.6
  ? "  => FLATTENING. The published two-point projection is optimistic; treat it as an upper bound."
  : "  => still roughly log-linear over this range; the projection's shape holds so far.");

// ── D. ABSTAIN GATE ──────────────────────────────────────────────────────────────────────
line("=");
console.log("D. ABSTAIN-ON-SINK GATE — Nolan's B+su, tested at last");
line();
console.log("Refuse to answer when the ensemble's pick is service/utility; defer those to the LLM.");
console.log(`\n${"gate".padEnd(34)} ${"coverage".padStart(9)} ${"precision".padStart(10)} ${"vs majority".padStart(12)}`);
for (const [name, keep] of [
  ["unanimous only", (p) => p.share >= 1],
  ["unanimous + not sink", (p) => p.share >= 1 && !SINK.has(p.predicted)],
  ["majority + not sink", (p) => p.share > 0.5 && !SINK.has(p.predicted)],
  ["any + not sink", (p) => !SINK.has(p.predicted)],
  ["no gate (all answers)", () => true],
]) {
  const kept = preds.filter(keep);
  if (!kept.length) { console.log(`${name.padEnd(34)} ${"0.0%".padStart(9)} ${"—".padStart(10)}`); continue; }
  const a = acc(kept), cov = kept.length / preds.length;
  console.log(`${name.padEnd(34)} ${pct(cov).padStart(9)} ${pct(a).padStart(10)} ${((a - majority >= 0 ? "+" : "") + (100 * (a - majority)).toFixed(1)).padStart(12)}`);
}

// ── E. SEED VARIANCE ─────────────────────────────────────────────────────────────────────
line("=");
console.log("E. SEED VARIANCE — how much of this project's spread is real?");
line();
const singles = [];
for (let i = 0; i < 10; i++) singles.push(acc(predictAll([train(pool, SEED + i * 31337)], test)));
const mean = singles.reduce((a, b) => a + b, 0) / singles.length;
const sd = Math.sqrt(singles.reduce((a, b) => a + (b - mean) ** 2, 0) / (singles.length - 1));
console.log(`single model, 10 seeds:  mean ${pct(mean)}  sd ${(100 * sd).toFixed(2)}pp  range ${pct(Math.min(...singles))}–${pct(Math.max(...singles))}`);
const ensAcc = [];
for (let i = 0; i < 5; i++) ensAcc.push(acc(predictAll([0, 1, 2, 3, 4].map((k) => train(pool, SEED + (i * 10 + k) * 7919)), test)));
const em = ensAcc.reduce((a, b) => a + b, 0) / ensAcc.length;
const esd = Math.sqrt(ensAcc.reduce((a, b) => a + (b - em) ** 2, 0) / (ensAcc.length - 1));
console.log(`5-model ensemble, 5 runs: mean ${pct(em)}  sd ${(100 * esd).toFixed(2)}pp  range ${pct(Math.min(...ensAcc))}–${pct(Math.max(...ensAcc))}`);
console.log(`\nEnsembling cuts seed variance ${(sd / esd).toFixed(1)}x — that, not accuracy, may be its main contribution.`);
console.log(`Any single-seed difference smaller than ~${(2 * sd * 100).toFixed(1)}pp is noise, not a finding.`);
line("=");
