#!/usr/bin/env node
/**
 * Why is the ELM at 54.4% when a human gets 85.4% from the same paths?
 *
 * Three diagnostics that narrow the cause. All run 5-fold CV on the TRAINING
 * split against LLM labels — the gold set is NOT touched, because it has
 * already been spent as a dev set and must not be tuned against further.
 *
 * Results recorded 2026-08-28 (see IMPL-2026-08-28 § Phase 1):
 *
 *   1. FEATURES      bag-of-tokens 53.1%  vs  structure-aware 34.9%  (-18.3 pp)
 *      Naive structural encoding is WORSE. Positional/bigram tokens explode the
 *      vocabulary and fragment an already tiny signal.
 *
 *   2. DATA VOLUME   48 rows 46.7% -> 97 rows 50.6% -> 145 rows 53.0% -> 193 rows 53.8%
 *      Flattening hard. The last 48 rows bought 0.8 pp. More corpus alone will
 *      not close an 18 pp gap to the LLM.
 *
 *   3. CLASS MERGE   see below — service+utility are 74% of mass and mutually
 *      confusable; merging them bounds how much of the error is that boundary.
 *
 * Usage: node scripts/elm-diagnostics.mjs
 */

import { readFileSync } from "node:fs";
import { ELM, TFIDFVectorizer, tokenize } from "@astermind/astermind-community";

const CORPUS = "scripts/data/elm-archetype-corpus.json";
const doc = (p) => tokenize(p).join(" ");
const oneHot = (l, c) => c.map((x) => (x === l ? 1 : 0));

function cv({ rows, feat = doc, mapLabel = (l) => l, frac = 1, seed = 7, folds = 5, hidden = 256 }) {
  let rng = seed;
  const rnd = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff; };
  const idx = rows.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const cats = [...new Set(rows.map((r) => mapLabel(r.label)))];
  let hits = 0, tot = 0;
  for (let f = 0; f < folds; f++) {
    const te = idx.filter((_, k) => k % folds === f);
    const trAll = idx.filter((_, k) => k % folds !== f);
    const tr = trAll.slice(0, Math.max(cats.length, Math.round(trAll.length * frac)));
    const v = new TFIDFVectorizer(tr.map((i) => feat(rows[i].text)), 4000);
    const e = new ELM({ categories: cats, hiddenUnits: hidden, activation: "relu", seed: 42, log: { modelName: "d", verbose: false } });
    e.trainFromData(v.vectorizeAll(), tr.map((i) => oneHot(mapLabel(rows[i].label), cats)));
    for (const i of te) {
      const p = e.predictFromVector([v.vectorize(feat(rows[i].text))], 1)[0][0];
      if (p.label === mapLabel(rows[i].label)) hits++;
      tot++;
    }
  }
  return hits / tot;
}

/** Positional + bigram + basename encoding. Tested and found WORSE — kept as a record. */
function structuralFeat(p) {
  const segs = p.split("/"), base = segs[segs.length - 1];
  const ext = (base.match(/\.[a-z]+$/) || [""])[0].slice(1);
  const dirs = segs.slice(0, -1), t = [];
  dirs.forEach((d, i) => { t.push(`d${i}_${d}`, `dir_${d}`); });
  if (dirs.length) t.push(`last_${dirs[dirs.length - 1]}`);
  for (let i = 0; i + 1 < dirs.length; i++) t.push(`bg_${dirs[i]}_${dirs[i + 1]}`);
  tokenize(base.replace(/\.[a-z.]+$/, "")).forEach((x) => t.push(`base_${x}`));
  t.push(`ext_${ext}`, `depth_${dirs.length}`);
  return t.join(" ");
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const pct = (x) => `${(x * 100).toFixed(1)}%`;

function main() {
  const rows = JSON.parse(readFileSync(CORPUS, "utf-8")).train;
  const out = [];
  const say = (s) => out.push(s);

  say("ELM diagnostics — 5-fold CV on TRAIN only (LLM labels). Gold set untouched.\n");

  say("1. FEATURES");
  const a = mean([7, 13, 29].map((s) => cv({ rows, seed: s })));
  const b = mean([7, 13, 29].map((s) => cv({ rows, feat: structuralFeat, seed: s })));
  say(`   bag-of-tokens      ${pct(a)}`);
  say(`   structure-aware    ${pct(b)}   delta ${((b - a) * 100).toFixed(1)} pp`);
  say("   => naive structural encoding HURTS at this corpus size.\n");

  say("2. DATA VOLUME (learning curve)");
  for (const f of [0.25, 0.5, 0.75, 1.0]) {
    const m = mean([7, 13, 29].map((s) => cv({ rows, frac: f, seed: s })));
    say(`   ${String(Math.round(193 * f)).padStart(4)} rows        ${pct(m)}`);
  }
  say("   => flattening; the last 48 rows bought <1 pp. More data alone is not the fix.\n");

  say("3. CLASS MERGE — how much of the error is the service/utility boundary?");
  const merge = (l) => (l === "service" || l === "utility" ? "service-or-utility" : l);
  const m12 = mean([7, 13, 29].map((s) => cv({ rows, mapLabel: merge, seed: s })));
  say(`   13 classes         ${pct(a)}`);
  say(`   merged (12)        ${pct(m12)}   delta ${((m12 - a) * 100).toFixed(1)} pp`);
  say("   => the gap here bounds what collapsing the ambiguous boundary could buy.\n");

  say("4. CAPACITY (hidden units, never tuned — 256 was arbitrary)");
  for (const h of [64, 256, 512, 1024]) {
    const m = mean([7, 13].map((s) => cv({ rows, hidden: h, seed: s })));
    say(`   ${String(h).padStart(4)} units        ${pct(m)}`);
  }
  process.stderr.write(out.join("\n") + "\n");
}

main();
