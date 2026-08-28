#!/usr/bin/env node
/**
 * K2 analysis — Part B of IMPL-2026-08-27-jam-k2-gold-set-labelling.md.
 *
 * Joins the returned gold-set packet to the LLM's corpus labels and to fresh
 * ELM predictions, and reports the five comparisons the ADR asks for.
 *
 * Constraints (IMPL § B3), enforced here rather than remembered:
 *  - Held-out rows only. Never the 241 training rows.
 *  - ELM figures are multi-seed mean + range. The observed spread is ~16 pp,
 *    so a single run is meaningless.
 *  - unclear/missing rows are EXCLUDED from agreement rates and reported
 *    separately — the unclear rate is a result, not a nuisance.
 *  - Nothing is tuned. This script only measures.
 *
 * Usage: node scripts/elm-k2-analysis.mjs [--repeats=N]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { ELM, TFIDFVectorizer, tokenize } from "@astermind/astermind-community";

const CORPUS = "scripts/data/elm-archetype-corpus.json";
const PACKET = "scripts/data/k2-goldset-packet.csv";
const OUT = "scripts/data/k2-analysis.json";
const NON_LABELS = new Set(["unclear", "missing"]);

const docOf = (p) => tokenize(p).join(" ");
const oneHot = (l, cats) => cats.map((c) => (c === l ? 1 : 0));

/** Minimal RFC4180-ish parser — fields may be quoted and contain commas. */
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

/** Agreement over rows where BOTH sides carry a real label. */
function agree(pairs) {
  const usable = pairs.filter(([a, b]) => a && b && !NON_LABELS.has(a) && !NON_LABELS.has(b));
  const n = usable.length;
  return { rate: n ? usable.filter(([a, b]) => a === b).length / n : 0, n, excluded: pairs.length - n };
}

function main() {
  const repeats = Number((process.argv.find((a) => a.startsWith("--repeats=")) ?? "--repeats=7").slice(10));
  const corpus = JSON.parse(readFileSync(CORPUS, "utf-8"));
  const packet = parseCsv(readFileSync(PACKET, "utf-8"));

  const key = (repo, path) => `${repo}::${path}`;
  const gold = new Map(packet.map((r) => [key(r.repo, r.path), r]));
  const held = corpus.heldOut;
  const missing = held.filter((h) => !gold.has(key(h.repo, h.text)));
  if (missing.length) throw new Error(`${missing.length} held-out rows absent from packet — join is unsound`);

  // ELM, trained exactly as the screen does. Not retuned.
  const labels = [...new Set(corpus.train.map((r) => r.label))];
  const v = new TFIDFVectorizer(corpus.train.map((r) => docOf(r.text)), 2000);
  const Xtr = v.vectorizeAll();
  const Ytr = corpus.train.map((r) => oneHot(r.label, labels));
  const Xho = held.map((r) => v.vectorize(docOf(r.text)));

  const elmRuns = [];
  for (let i = 0; i < repeats; i++) {
    const elm = new ELM({ categories: labels, hiddenUnits: 256, activation: "relu", seed: 42 + i, log: { modelName: "k2", verbose: false } });
    elm.trainFromData(Xtr, Ytr);
    elmRuns.push(Xho.map((x) => elm.predictFromVector([x], 1)[0][0].label));
  }

  const p1 = held.map((h) => gold.get(key(h.repo, h.text)).pass1_path_only);
  const p2 = held.map((h) => gold.get(key(h.repo, h.text)).pass2_after_reading_file);
  const llm = held.map((h) => h.label);
  const conf = held.map((h) => gold.get(key(h.repo, h.text)).confident_yes_no);

  const c1 = agree(p1.map((a, i) => [a, p2[i]]));
  const c2 = agree(llm.map((a, i) => [a, p2[i]]));
  const c3s = elmRuns.map((pred) => agree(pred.map((a, i) => [a, p2[i]])).rate);
  const c4s = elmRuns.map((pred) => agree(pred.map((a, i) => [a, llm[i]])).rate);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  const rng = (a) => `${pct(Math.min(...a))} – ${pct(Math.max(...a))}`;

  console.log("K2 analysis — gold set vs LLM vs ELM\n");
  console.log(`  held-out rows: ${held.length} · ELM: ${repeats} seeds · gold: single rater\n`);
  console.log(`  (1) human path-only vs human after-reading   ${pct(c1.rate)}   n=${c1.n}   <- PATH-INFORMATION CEILING`);
  console.log(`  (2) LLM            vs human after-reading    ${pct(c2.rate)}   n=${c2.n}   <- is the corpus correct?`);
  console.log(`  (3) ELM            vs human after-reading    ${pct(mean(c3s))}   range ${rng(c3s)}   <- K2`);
  console.log(`  (4) ELM            vs LLM                    ${pct(mean(c4s))}   range ${rng(c4s)}   <- what we measured before`);
  console.log(`  (5) rater A vs rater B                       n/a — single rater\n`);

  const k2 = mean(c3s) >= c2.rate;
  console.log(`  K2 (3) >= (2):  ${pct(mean(c3s))} vs ${pct(c2.rate)}  ->  ${k2 ? "PASS" : "FAIL"}\n`);

  // Nolan's flag: the unclear rate alone under-reads uncertainty.
  const unclear = p2.filter((x) => NON_LABELS.has(x)).length;
  const notConf = conf.filter((x) => x === "no").length;
  console.log(`  uncertainty — unclear ${unclear}/${held.length} (${pct(unclear / held.length)})` +
              ` but NOT-CONFIDENT ${notConf}/${held.length} (${pct(notConf / held.length)})`);
  console.log("    Reading the unclear column alone understates it by an order of magnitude.\n");

  // Where the machines disagree with truth, split by rater confidence.
  for (const [name, preds] of [["LLM", llm], ["ELM(seed42)", elmRuns[0]]]) {
    const on = (want) => {
      const idx = held.map((_, i) => i).filter((i) => conf[i] === want && !NON_LABELS.has(p2[i]));
      const hit = idx.filter((i) => preds[i] === p2[i]).length;
      return idx.length ? `${pct(hit / idx.length)} (n=${idx.length})` : "n/a";
    };
    console.log(`  ${name.padEnd(12)} vs truth — rater confident: ${on("yes")} · rater unsure: ${on("no")}`);
  }

  const su = ["service", "utility"];
  const suIdx = held.map((_, i) => i).filter((i) => su.includes(p2[i]));
  const suLlm = suIdx.filter((i) => llm[i] === p2[i]).length / suIdx.length;
  const suElm = suIdx.filter((i) => elmRuns[0][i] === p2[i]).length / suIdx.length;
  console.log(`\n  service/utility only (n=${suIdx.length}, ${pct(suIdx.length / held.length)} of held-out):`);
  console.log(`    LLM vs truth ${pct(suLlm)} · ELM(seed42) vs truth ${pct(suElm)}`);

  writeFileSync(OUT, JSON.stringify({
    schema: "k2-analysis/v1", generatedAt: new Date().toISOString(),
    heldOut: held.length, repeats, rater: "single",
    comparisons: {
      pathCeiling: c1, llmVsTruth: c2,
      elmVsTruth: { mean: mean(c3s), range: [Math.min(...c3s), Math.max(...c3s)], runs: c3s },
      elmVsLlm: { mean: mean(c4s), range: [Math.min(...c4s), Math.max(...c4s)], runs: c4s },
      raterVsRater: null,
    },
    k2Pass: k2,
    uncertainty: { unclear, notConfident: notConf, total: held.length },
    serviceUtility: { n: suIdx.length, llmVsTruth: suLlm, elmVsTruth: suElm },
  }, null, 2) + "\n");
  console.log(`\n  wrote ${OUT}`);
}

main();
