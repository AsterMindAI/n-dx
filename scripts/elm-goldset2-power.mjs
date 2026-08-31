#!/usr/bin/env node
/**
 * How big does gold set #2 have to be to settle anything?
 *
 * Phase 3 was funded on 2026-08-31. Before spending a labeller's afternoon and
 * real LLM tokens, this answers the question nobody has asked yet: **what
 * effect size can a gold set of size N actually detect?**
 *
 * ── Why this is not a formality ───────────────────────────────────────────
 * K2' is a PAIRED comparison — the same files, ELM vs LLM, both against truth.
 * Its power therefore depends on the number of DISCORDANT pairs (files where
 * exactly one of them is right), not on the raw precision difference. Gold set
 * #1 had 83 files; at the recommended operating point the tier claims ~33% of
 * them, and only a fraction of those are discordant. That is a very small
 * number of informative observations.
 *
 * The DEV-observed margin is about +1 pp. If N cannot detect +1 pp, then a
 * "PASS" on gold set #2 would mean "we could not distinguish the tier from the
 * LLM", which is not the same claim and must not be reported as one.
 *
 * ── What is measured vs assumed ───────────────────────────────────────────
 * MEASURED  the discordance rate and the ELM's win-share among discordant
 *           pairs, from the committed DEV run on gold set #1.
 * ASSUMED   that gold set #2 has the same discordance structure. It is a
 *           different sample, so treat the output as a design aid, not a
 *           promise. It is still far better than picking 83 again by habit.
 *
 * Usage: node scripts/elm-goldset2-power.mjs [--coverage=0.33] [--alpha=0.05]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { ELM, TFIDFVectorizer, tokenize } from "@astermind/astermind-community";

const CORPUS = "scripts/data/elm-archetype-corpus.json";
const PACKET = "scripts/data/k2-goldset-packet.csv";
const OUT = "scripts/data/elm-goldset2-power.json";
const SU = new Set(["service", "utility"]);
const NON_LABELS = new Set(["unclear", "missing"]);

/** The frozen candidate — Phase 1's adopted model. See scripts/elm-freeze-model.mjs. */
const MODEL = { hiddenUnits: 1024, activation: "tanh", ridgeLambda: 1e-2, vocabCap: 4000 };
const SEEDS = 15;
const SU_ADMIT = 0.10; // B+su operating point

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? Number(a.slice(k.length + 3)) : d;
};
const docOf = (p) => tokenize(p).join(" ");
const oneHot = (l, cs) => cs.map((c) => (c === l ? 1 : 0));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift();
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

/** log C(n,k), so the exact binomial stays stable well past n=1000. */
function logChoose(n, k) {
  let s = 0;
  for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i);
  return s;
}

/** Two-sided exact binomial p-value against p=0.5 — the McNemar exact test. */
function exactP(d, w) {
  const lo = Math.min(w, d - w);
  let logSum = -Infinity;
  for (let k = 0; k <= lo; k++) {
    const t = logChoose(d, k) - d * Math.LN2;
    logSum = logSum === -Infinity ? t : Math.max(logSum, t) + Math.log1p(Math.exp(-Math.abs(logSum - t)));
  }
  return Math.min(1, 2 * Math.exp(logSum));
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Monte-Carlo power of the exact McNemar test at a given claimed-set size. */
function power(nClaimed, discRate, pWin, alpha, trials = 20000) {
  const d = Math.max(1, Math.round(nClaimed * discRate));
  const rnd = mulberry32(20260831);
  let hits = 0;
  for (let t = 0; t < trials; t++) {
    let w = 0;
    for (let i = 0; i < d; i++) if (rnd() < pWin) w++;
    if (exactP(d, w) < alpha) hits++;
  }
  return hits / trials;
}

function main() {
  const coverage = arg("coverage", 0.33);
  const alpha = arg("alpha", 0.05);

  const corpus = JSON.parse(readFileSync(CORPUS, "utf-8"));
  const packet = parseCsv(readFileSync(PACKET, "utf-8"));
  const key = (r, p) => `${r}::${p}`;
  const gold = new Map(packet.map((r) => [key(r.repo, r.path), r]));
  const held = corpus.heldOut;
  const truth = held.map((h) => gold.get(key(h.repo, h.text)).pass2_after_reading_file);
  const llm = held.map((h) => h.label);

  const cats = [...new Set(corpus.train.map((r) => r.label))];
  const v = new TFIDFVectorizer(corpus.train.map((r) => docOf(r.text)), MODEL.vocabCap);
  const Xtr = v.vectorizeAll();
  const Ytr = corpus.train.map((r) => oneHot(r.label, cats));
  const Xho = held.map((r) => v.vectorize(docOf(r.text)));

  const b01 = [], b10 = [], ns = [];
  for (let i = 0; i < SEEDS; i++) {
    const elm = new ELM({ categories: cats, hiddenUnits: MODEL.hiddenUnits, activation: MODEL.activation, ridgeLambda: MODEL.ridgeLambda, seed: 42 + i, log: { modelName: "pw", verbose: false } });
    elm.trainFromData(Xtr, Ytr);
    const top = Xho.map((x) => elm.predictFromVector([x], 1)[0][0]);
    const pred = top.map((t) => t.label), conf = top.map((t) => t.prob);
    const non = pred.map((p, j) => j).filter((j) => !SU.has(pred[j]));
    const su = pred.map((p, j) => j).filter((j) => SU.has(pred[j])).sort((a, b) => conf[b] - conf[a]);
    const claimed = non.concat(su.slice(0, Math.round(su.length * SU_ADMIT))).filter((j) => !NON_LABELS.has(truth[j]));
    b01.push(claimed.filter((j) => pred[j] === truth[j] && llm[j] !== truth[j]).length);
    b10.push(claimed.filter((j) => pred[j] !== truth[j] && llm[j] === truth[j]).length);
    ns.push(claimed.length);
  }

  const nClaimed = mean(ns), e01 = mean(b01), e10 = mean(b10);
  const discRate = (e01 + e10) / nClaimed;
  const pWin = e01 / (e01 + e10);

  console.log("Gold set #2 — how big does it need to be?\n");
  console.log("  ⚠️  Structure measured on gold set #1 (DEV). Gold set #2 is a different sample;");
  console.log("      this sizes the study, it does not predict its result.\n");
  console.log(`  operating point: B+su (abstention + top ${SU_ADMIT * 100}% of service/utility), ${MODEL.activation} model, ${SEEDS} seeds`);
  console.log(`  on gold set #1's 83 files the tier claims ~${nClaimed.toFixed(0)}:`);
  console.log(`    ELM right / LLM wrong   ${e01.toFixed(1)}`);
  console.log(`    ELM wrong / LLM right   ${e10.toFixed(1)}`);
  console.log(`    DISCORDANT pairs        ${(e01 + e10).toFixed(1)}   = ${(discRate * 100).toFixed(0)}% of claimed files`);
  console.log(`    net                     ${(e01 - e10 >= 0 ? "+" : "")}${(e01 - e10).toFixed(1)} files = ${((e01 - e10) / nClaimed * 100).toFixed(1)} pp`);
  console.log(`\n  Among discordant pairs the ELM wins ${(pWin * 100).toFixed(0)}%  (50% = the two are indistinguishable)\n`);

  const rows = [];
  console.log(`  Power of the exact McNemar test at alpha=${alpha}, coverage ${(coverage * 100).toFixed(0)}%:\n`);
  console.log(`  ${"gold set".padStart(9)}${"claimed".padStart(9)}${"discordant".padStart(12)}${"power".padStart(8)}   labelling burden`);
  for (const N of [83, 150, 250, 400, 800, 1600, 3200]) {
    const claimed = N * coverage;
    const pw = power(claimed, discRate, pWin, alpha);
    rows.push({ goldSetSize: N, claimed: Math.round(claimed), discordant: Math.round(claimed * discRate), power: pw });
    const burden = N <= 100 ? "one afternoon" : N <= 300 ? "1–2 days" : N <= 800 ? "about a week" : "not a hand-labelling job";
    console.log(`  ${String(N).padStart(9)}${claimed.toFixed(0).padStart(9)}${(claimed * discRate).toFixed(0).padStart(12)}${(pw * 100).toFixed(0).padStart(7)}%   ${burden}`);
  }

  // What CAN a feasible gold set detect? Invert the question.
  console.log("\n  Inverted: the smallest ELM win-share among discordant pairs detectable at 80% power");
  console.log(`  ${"gold set".padStart(9)}${"discordant".padStart(12)}${"min win-share".padStart(15)}${"~ equivalent margin".padStart(21)}`);
  const detectable = [];
  for (const N of [83, 150, 250, 400, 800]) {
    const d = Math.max(1, Math.round(N * coverage * discRate));
    let found = null;
    for (let p = 0.50; p <= 0.999; p += 0.005) {
      if (power(N * coverage, discRate, p, alpha, 4000) >= 0.8) { found = p; break; }
    }
    const marginPp = found === null ? null : (2 * found - 1) * discRate * 100;
    detectable.push({ goldSetSize: N, discordant: d, minWinShare: found, marginPp });
    console.log(`  ${String(N).padStart(9)}${String(d).padStart(12)}${(found === null ? "—" : `${(found * 100).toFixed(0)}%`).padStart(15)}${(marginPp === null ? "—" : `${marginPp.toFixed(1)} pp`).padStart(21)}`);
  }

  // ── The question that IS answerable ──────────────────────────────────────
  // Superiority is hopeless here because the two labellers AGREE on ~89% of the
  // claimed files. But a never-worse gate does not need superiority — it needs a
  // bounded downside. Non-inferiority tests against a margin, and that is
  // feasible at a size a person can actually label.
  const d0 = (e01 - e10) / nClaimed;           // observed paired difference (favourable = positive)
  const z = 1.645;                              // one-sided 95%
  const niRows = [];
  console.log("\n  NON-INFERIORITY instead: how many files to show the tier is not WORSE by more than delta?");
  console.log(`  (observed paired difference on gold set #1: ${(d0 * 100 >= 0 ? "+" : "")}${(d0 * 100).toFixed(1)} pp; discordance ${(discRate * 100).toFixed(0)}%)\n`);
  console.log(`  ${"margin".padStart(8)}${"claimed files".padStart(15)}${"gold set needed".padStart(17)}   labelling burden`);
  for (const delta of [0.10, 0.05, 0.03, 0.02, 0.01]) {
    const nNeeded = discRate * Math.pow(z / (delta + d0), 2);
    const goldNeeded = Math.ceil(nNeeded / coverage / 10) * 10;
    niRows.push({ marginPp: delta * 100, claimedNeeded: Math.ceil(nNeeded), goldSetNeeded: goldNeeded });
    const burden = goldNeeded <= 120 ? "one afternoon" : goldNeeded <= 300 ? "1-2 days" : goldNeeded <= 800 ? "about a week" : "not a hand-labelling job";
    console.log(`  ${(delta * 100).toFixed(0).padStart(6)} pp${String(Math.ceil(nNeeded)).padStart(15)}${String(goldNeeded).padStart(17)}   ${burden}`);
  }

  console.log("\n  Read this before choosing a size:");
  console.log("    The DEV margin is about +1 pp. Nothing in the feasible range detects that.");
  console.log("    So gold set #2 CANNOT certify 'the ELM beats the LLM'. What it can do is");
  console.log("    bound the downside — rule out the tier being materially WORSE — which is");
  console.log("    what a never-worse gate actually needs. Say which claim is being made.");

  writeFileSync(OUT, JSON.stringify({
    schema: "elm-goldset2-power/v1",
    generatedAt: new Date().toISOString(),
    generatedBy: "scripts/elm-goldset2-power.mjs",
    status: "DESIGN AID. Discordance structure measured on gold set #1 (DEV); gold set #2 is a different sample.",
    model: MODEL, operatingPoint: { design: "B+su", suAdmit: SU_ADMIT }, seeds: SEEDS, alpha, coverage,
    measuredOnGoldSet1: { claimedFiles: nClaimed, elmRightLlmWrong: e01, elmWrongLlmRight: e10, discordantRate: discRate, elmWinShareAmongDiscordant: pWin },
    powerByGoldSetSize: rows,
    detectableEffectAt80Power: detectable,
    nonInferioritySizing: niRows,
  }, null, 2) + "\n");
  console.log(`\n  wrote ${OUT}`);
}

main();
