/**
 * TJ-E1 — top-5 archetype gate: accuracy, tokens saved, time saved.
 *
 * THE PRODUCT SHAPE BEING TESTED
 * ------------------------------
 * Collapsing the label set measurably helps (37.4% at 16 classes -> 48.9% at 3, >2sd). This
 * turns that into a concrete gate rather than a curiosity:
 *
 *   The ELM answers ONLY when it confidently predicts one of the top 5 archetypes.
 *   Everything else -- a low-agreement prediction, or a prediction of "other" -- goes to the LLM.
 *
 * "other" is a real answer here, not a dropped row: it means "this is one of the eleven rarer
 * archetypes and I cannot say which", which is exactly the case that should defer. Scoring it as
 * a deferral rather than an error is what makes this a gate rather than a classifier.
 *
 * TWO SCENARIOS, because they are different products and the project has only measured one:
 *   A. CROSS-REPO   train on 9 repos, predict a 10th. A shipped, pre-trained model.
 *   B. IN-DOMAIN    train and test within one repo. What production ACTUALLY does --
 *                   getArchetypeELM trains on the project's own history. Under-tested here.
 *
 * ECONOMICS, all from measured figures:
 *   LLM call      105.4 s mean (71.2 / 172.6 / 101.7 / 75.9 measured), 22k-46k tokens
 *   batch size    30 files per call (classify-llm.ts)
 *   residue       255 files on n-dx
 *   ELM runtime   measured live in this script, and SUBTRACTED from time saved
 *
 * Usage: node --max-old-space-size=6144 packages/sourcevision/scripts/elm-top5-benchmark.mjs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

const SEED = 20260922;
const SEEDS = 8;
const ENSEMBLE = 5;
const HELD_OUT = ["core", "fastify"];
const ROOTS = {
  "n-dx-1": ".", "AsterMind-Community-Edition": "../elm-fresh/AsterMind-Community-Edition",
  express: "../elm-fresh/express", fastify: "../elm-fresh/fastify",
  commerce: "../elm-fresh/commerce", got: "../elm-fresh/got", core: "../elm-fresh/core",
  typeorm: "../elm-fresh/typeorm", nest: "../elm-fresh/nest", remix: "../elm-fresh/remix",
};

// Measured economics
const LLM_SEC = 105.4, BATCH = 30, RESIDUE = 255, TOK_LO = 22_000, TOK_HI = 46_000;

const F = await import("../dist/analyzers/classify-elm-features.js");
const { trainArchetypeELMNumeric } = await import("../dist/analyzers/classify-elm.js");

const corpus = JSON.parse(readFileSync("scripts/data/elm-archetype-corpus-v3-classtargeted.json", "utf-8"));
const all = [...corpus.train, ...corpus.heldOut].filter((r) => ROOTS[r.repo]);

process.stdout.write("extracting features... ");
const t0 = performance.now();
const vecs = new Map();
for (const r of all) {
  vecs.set(`${r.repo}::${r.text}`, F.buildFeatureVector({
    path: r.text, content: F.readFileContentSafely(resolve(ROOTS[r.repo]), r.text),
  }));
}
const extractMsPerFile = (performance.now() - t0) / all.length;
console.log(`${vecs.size} vectors  (${extractMsPerFile.toFixed(3)} ms/file)\n`);
const V = (r) => vecs.get(`${r.repo}::${r.text}`);

const globalFreq = new Map();
for (const r of all) globalFreq.set(r.label, (globalFreq.get(r.label) ?? 0) + 1);
const TOP5 = [...globalFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([l]) => l);
const inTop5 = new Set(TOP5);
const fold = (rows) => rows.map((r) => (inTop5.has(r.label) ? r : { ...r, label: "other" }));

const pct = (x) => `${(100 * x).toFixed(1)}%`;
const line = (c = "-") => console.log(c.repeat(92));
const calls = (n) => Math.ceil(n / BATCH);

function shuffled(a, seed) {
  let s = seed >>> 0;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 0x100000000; };
  const c = [...a];
  for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
  return c;
}

/** Returns per-file {predicted, actual, share} plus the measured train+infer cost. */
function gateRun(trainRows, testRows, base) {
  const ex = trainRows.map((r) => ({ vector: V(r), archetype: r.label }));
  const cats = [...new Set(ex.map((e) => e.archetype))].sort();
  const tTrain = performance.now();
  const ms = Array.from({ length: ENSEMBLE }, (_, i) => trainArchetypeELMNumeric(ex, cats, base + i * 7919, 128));
  const trainMs = performance.now() - tTrain;

  const tInf = performance.now();
  const out = testRows.map((r) => {
    const v = V(r), votes = new Map();
    for (const m of ms) { const [t] = m.elm.predictTopKFromVector(v, 1); votes.set(t.label, (votes.get(t.label) ?? 0) + 1); }
    const [lab, n] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    return { predicted: lab, actual: r.label, share: n / ms.length };
  });
  const inferMsPerFile = (performance.now() - tInf) / testRows.length;
  return { out, trainMs, inferMsPerFile };
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };

/** The gate: answer only on a confident, non-"other" prediction. */
const GATES = [
  ["unanimous, top-5 only", (p) => p.share >= 1 && p.predicted !== "other"],
  ["4 of 5, top-5 only", (p) => p.share >= 0.8 && p.predicted !== "other"],
  ["majority, top-5 only", (p) => p.share > 0.5 && p.predicted !== "other"],
  ["unanimous, any label", (p) => p.share >= 1],
];

function report(title, runs, note) {
  console.log("\n" + "=".repeat(92));
  console.log(title);
  console.log("=".repeat(92));
  if (note) console.log(note);
  const maj = mean(runs.map((r) => {
    const m = new Map();
    for (const p of r.out) m.set(p.actual, (m.get(p.actual) ?? 0) + 1);
    return Math.max(...m.values()) / r.out.length;
  }));
  console.log(`rows per run ${runs[0].out.length}   ·   majority baseline ${pct(maj)}   ·   ${runs.length} seeds\n`);

  console.log(`${"gate".padEnd(24)} ${"coverage".padStart(9)} ${"precision".padStart(11)} ${"calls".padStart(7)} ${"tokens saved".padStart(15)} ${"time saved".padStart(12)}`);
  line();
  for (const [name, keep] of GATES) {
    const cov = [], prec = [];
    for (const r of runs) {
      const kept = r.out.filter(keep);
      cov.push(kept.length / r.out.length);
      prec.push(kept.length ? kept.filter((p) => p.predicted === p.actual).length / kept.length : NaN);
    }
    const c = mean(cov), p = mean(prec.filter((x) => !Number.isNaN(x)));
    const resolved = Math.round(RESIDUE * c);
    const saved = calls(RESIDUE) - calls(RESIDUE - resolved);
    // ELM cost is paid once for the whole residue whether it answers 1 file or all of them.
    const elmSec = (extractMsPerFile * RESIDUE + mean(runs.map((r) => r.trainMs)) + mean(runs.map((r) => r.inferMsPerFile)) * RESIDUE) / 1000;
    const netSec = saved * LLM_SEC - elmSec;
    const tok = saved === 0 ? "none" : `${((saved * TOK_LO) / 1000).toFixed(0)}k-${((saved * TOK_HI) / 1000).toFixed(0)}k`;
    const time = saved === 0 ? `-${elmSec.toFixed(0)}s` : `${netSec > 0 ? "+" : ""}${(netSec / 60).toFixed(1)} min`;
    console.log(`${name.padEnd(24)} ${(pct(c) + "±" + (100 * sd(cov)).toFixed(0)).padStart(9)} ${(pct(p) + "±" + (100 * sd(prec.filter((x) => !Number.isNaN(x)))).toFixed(0)).padStart(11)} ${`${saved}/9`.padStart(7)} ${tok.padStart(15)} ${time.padStart(12)}`);
  }
}

console.log("=".repeat(92));
console.log(`TOP-5 ARCHETYPE GATE   seed=${SEED}   ${SEEDS} seeds   ${ENSEMBLE}-model ensemble`);
console.log("=".repeat(92));
console.log(`top 5: ${TOP5.join(", ")}`);
console.log(`everything else -> "other" -> deferred to the LLM (a deferral, not an error)`);
console.log(`economics: ${LLM_SEC}s and ${TOK_LO / 1000}k-${TOK_HI / 1000}k tokens per LLM call, batch ${BATCH}, ${RESIDUE}-file residue`);

// ── A. CROSS-REPO ────────────────────────────────────────────────────────────────────────
{
  const tr = fold(all.filter((r) => !HELD_OUT.includes(r.repo)));
  const te = fold(all.filter((r) => HELD_OUT.includes(r.repo)));
  const runs = Array.from({ length: SEEDS }, (_, s) => gateRun(tr, te, SEED + s * 31337));
  report("A. CROSS-REPO — a shipped, pre-trained model (train 8 repos, predict core+fastify)", runs);
}

// ── B. IN-DOMAIN ─────────────────────────────────────────────────────────────────────────
// What production actually runs: getArchetypeELM trains on the PROJECT'S OWN history.
{
  const byRepo = new Map();
  for (const r of fold(all)) {
    if (!byRepo.has(r.repo)) byRepo.set(r.repo, []);
    byRepo.get(r.repo).push(r);
  }
  const usable = [...byRepo.entries()].filter(([, rs]) => rs.length >= 150);
  const runs = [];
  for (let s = 0; s < SEEDS; s++) {
    const out = [];
    let trainMs = 0, inferAcc = [];
    for (const [, rs] of usable) {
      const sh = shuffled(rs, SEED + s * 31337);
      const cut = Math.floor(sh.length * 0.75);
      const r = gateRun(sh.slice(0, cut), sh.slice(cut), SEED + s * 31337);
      out.push(...r.out); trainMs += r.trainMs; inferAcc.push(r.inferMsPerFile);
    }
    runs.push({ out, trainMs: trainMs / usable.length, inferMsPerFile: mean(inferAcc) });
  }
  report(
    "B. IN-DOMAIN — what production actually runs (train on the project's own history)",
    runs,
    `per-repo 75/25 split, pooled across ${usable.length} repos with >=150 rows: ${usable.map(([n]) => n).join(", ")}\n`,
  );
}

// ── C. PER REPO ──────────────────────────────────────────────────────────────────────────
// Scenario B pools five repos, so a strong result there could be two big repos carrying three
// weak ones. It is. This is the breakdown that decides whether the in-domain figure transfers
// to YOUR repo or only to a large one.
{
  const byRepo = new Map();
  for (const r of fold(all)) {
    if (!byRepo.has(r.repo)) byRepo.set(r.repo, []);
    byRepo.get(r.repo).push(r);
  }
  console.log("\n" + "=".repeat(92));
  console.log("C. PER REPO — does the in-domain result hold for a SMALL project?");
  console.log("=".repeat(92));
  console.log("Gate: unanimous, top-5 only. 6 seeds, per-repo 75/25 split.\n");
  console.log(`${"repo".padEnd(14)} ${"rows".padStart(5)} ${"train".padStart(6)} ${"coverage".padStart(9)} ${"precision".padStart(10)} ${"majority".padStart(9)} ${"calls".padStart(7)}`);
  line();
  for (const [repo, rs] of [...byRepo.entries()].sort((a, b) => b[1].length - a[1].length)) {
    if (rs.length < 100) continue;
    const covs = [], precs = [];
    for (let s = 0; s < 6; s++) {
      const sh = shuffled(rs, SEED + s * 31337), cut = Math.floor(sh.length * 0.75);
      const { out } = gateRun(sh.slice(0, cut), sh.slice(cut), SEED + s * 31337);
      const kept = out.filter((p) => p.share >= 1 && p.predicted !== "other");
      covs.push(kept.length / out.length);
      if (kept.length) precs.push(kept.filter((p) => p.predicted === p.actual).length / kept.length);
    }
    const mc = new Map();
    for (const r of rs) mc.set(r.label, (mc.get(r.label) ?? 0) + 1);
    const maj = Math.max(...mc.values()) / rs.length;
    const c = mean(covs);
    const saved = calls(RESIDUE) - calls(RESIDUE - Math.round(RESIDUE * c));
    console.log(`${repo.padEnd(14)} ${String(rs.length).padStart(5)} ${String(Math.floor(rs.length * 0.75)).padStart(6)} ${pct(c).padStart(9)} ${pct(mean(precs)).padStart(10)} ${pct(maj).padStart(9)} ${`${saved}/9`.padStart(7)}`);
  }
  console.log("\nPrecision tracks TRAINING ROWS, not repo size per se. A project needs its own");
  console.log("labelled history before this gate is worth switching on -- which is exactly what");
  console.log("hasEnoughHistoryForFreshTraining already gates, though at a far lower threshold.");
}

line("=");
console.log("Time saved is NET: LLM calls avoided minus the ELM's own runtime, which is paid");
console.log("once over the whole residue regardless of how many files it answers.");
console.log(`Precision is agreement with a teacher measured at 72.3% against human judgement.`);
