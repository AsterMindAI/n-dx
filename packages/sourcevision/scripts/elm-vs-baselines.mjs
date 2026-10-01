/**
 * TJ-E1 — is the ELM the weak link, or is the task hard?
 *
 * THE CHALLENGE THIS ANSWERS
 * --------------------------
 * "Almost anywhere an LLM call is made, an ELM call can be made instead, with enough training
 * data." That is a reasonable prior, and standard for text classification: with thousands of
 * labelled examples a small supervised model routinely beats a zero-shot LLM. So a 35.8%
 * classifier on a 16-class problem is not evidence the task is hard -- it is evidence something
 * in OUR setup is wrong.
 *
 * Everything measured on this branch so far compares the ELM against ITSELF (different features,
 * different corpus sizes, different capacities). Nothing ever asked whether a different learner
 * on the SAME features does better. If a five-line lookup table beats the ELM, the finding is
 * "the ELM is the wrong model", not "the task cannot be learned" -- and every conclusion drawn
 * from its failure needs revisiting.
 *
 * So: identical feature vectors, identical split, six learners.
 *   1. majority class          the floor
 *   2. extension lookup        a five-line rule: most common label per file extension
 *   3. nearest centroid        one average vector per class
 *   4. k-NN (cosine, k=5)      no training at all
 *   5. logistic regression     the standard linear baseline anyone would reach for
 *   6. ELM (128 / 4096)        what this project actually built
 *
 * Plus: does COLLAPSING THE LABEL SET help? Six of sixteen classes have under 20 rows; the top
 * five carry 76%. A model cannot learn a class from one example, and those classes may be pure
 * noise that costs accuracy on the classes that matter.
 *
 * Usage: node --max-old-space-size=6144 packages/sourcevision/scripts/elm-vs-baselines.mjs
 */

import { readFileSync } from "node:fs";
import { resolve, extname } from "node:path";

const SEED = 20260922;
const HELD_OUT = ["core", "fastify"];
const ROOTS = {
  "n-dx-1": ".", "AsterMind-Community-Edition": "../elm-fresh/AsterMind-Community-Edition",
  express: "../elm-fresh/express", fastify: "../elm-fresh/fastify",
  commerce: "../elm-fresh/commerce", got: "../elm-fresh/got", core: "../elm-fresh/core",
  typeorm: "../elm-fresh/typeorm", nest: "../elm-fresh/nest", remix: "../elm-fresh/remix",
};

const F = await import("../dist/analyzers/classify-elm-features.js");
const { trainArchetypeELMNumeric } = await import("../dist/analyzers/classify-elm.js");

const corpus = JSON.parse(readFileSync("scripts/data/elm-archetype-corpus-v3-classtargeted.json", "utf-8"));
const all = [...corpus.train, ...corpus.heldOut].filter((r) => ROOTS[r.repo]);

process.stdout.write("extracting features... ");
const vecs = new Map();
for (const r of all) {
  vecs.set(`${r.repo}::${r.text}`, F.buildFeatureVector({
    path: r.text, content: F.readFileContentSafely(resolve(ROOTS[r.repo]), r.text),
  }));
}
console.log(`${vecs.size} vectors, ${F.FEATURE_VECTOR_SIZE} dims\n`);
const V = (r) => vecs.get(`${r.repo}::${r.text}`);

let test = all.filter((r) => HELD_OUT.includes(r.repo));
let pool = all.filter((r) => !HELD_OUT.includes(r.repo));
const pct = (x) => `${(100 * x).toFixed(1)}%`;
const line = (c = "-") => console.log(c.repeat(80));

// ── learners ─────────────────────────────────────────────────────────────────────────────

function majorityClass(tr) {
  const m = new Map();
  for (const r of tr) m.set(r.label, (m.get(r.label) ?? 0) + 1);
  const best = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return () => best;
}

/** Five lines of logic. If this beats the ELM, the ELM is the problem. */
function extensionLookup(tr) {
  const byExt = new Map();
  for (const r of tr) {
    const e = extname(r.text).toLowerCase();
    if (!byExt.has(e)) byExt.set(e, new Map());
    const m = byExt.get(e);
    m.set(r.label, (m.get(r.label) ?? 0) + 1);
  }
  const best = new Map();
  for (const [e, m] of byExt) best.set(e, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  const fallback = majorityClass(tr)();
  return (r) => best.get(extname(r.text).toLowerCase()) ?? fallback;
}

function nearestCentroid(tr) {
  const sums = new Map(), counts = new Map();
  for (const r of tr) {
    const v = V(r);
    if (!sums.has(r.label)) { sums.set(r.label, new Array(v.length).fill(0)); counts.set(r.label, 0); }
    const s = sums.get(r.label);
    for (let i = 0; i < v.length; i++) s[i] += v[i];
    counts.set(r.label, counts.get(r.label) + 1);
  }
  const cent = [...sums.entries()].map(([lab, s]) => {
    const n = counts.get(lab);
    const c = s.map((x) => x / n);
    const norm = Math.sqrt(c.reduce((a, b) => a + b * b, 0)) || 1;
    return [lab, c.map((x) => x / norm)];
  });
  return (r) => {
    const v = V(r);
    const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
    let bl = cent[0][0], bs = -Infinity;
    for (const [lab, c] of cent) {
      let d = 0;
      for (let i = 0; i < v.length; i++) d += (v[i] / norm) * c[i];
      if (d > bs) { bs = d; bl = lab; }
    }
    return bl;
  };
}

function knn(tr, k = 5) {
  const pts = tr.map((r) => {
    const v = V(r);
    const n = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
    return { v: v.map((x) => x / n), label: r.label };
  });
  return (r) => {
    const v = V(r);
    const n = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
    const nv = v.map((x) => x / n);
    const scored = pts.map((p) => {
      let d = 0;
      for (let i = 0; i < nv.length; i++) d += nv[i] * p.v[i];
      return { d, label: p.label };
    }).sort((a, b) => b.d - a.d).slice(0, k);
    const m = new Map();
    for (const s of scored) m.set(s.label, (m.get(s.label) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };
}

/** Multinomial logistic regression, plain minibatch SGD. The obvious baseline. */
function logreg(tr, { epochs = 120, lr = 0.5, l2 = 1e-4 } = {}) {
  const labels = [...new Set(tr.map((r) => r.label))].sort();
  const li = new Map(labels.map((l, i) => [l, i]));
  const D = F.FEATURE_VECTOR_SIZE, K = labels.length;
  const W = Array.from({ length: K }, () => new Array(D).fill(0));
  const b = new Array(K).fill(0);
  const X = tr.map(V), Y = tr.map((r) => li.get(r.label));
  let s = SEED >>> 0;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 0x100000000; };
  const idx = [...X.keys()];
  for (let e = 0; e < epochs; e++) {
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const step = lr / (1 + e * 0.02);
    for (const n of idx) {
      const x = X[n], y = Y[n];
      const z = new Array(K).fill(0);
      for (let k = 0; k < K; k++) { let a = b[k]; const w = W[k]; for (let d = 0; d < D; d++) a += w[d] * x[d]; z[k] = a; }
      const mx = Math.max(...z);
      let sum = 0;
      for (let k = 0; k < K; k++) { z[k] = Math.exp(z[k] - mx); sum += z[k]; }
      for (let k = 0; k < K; k++) {
        const g = z[k] / sum - (k === y ? 1 : 0);
        const w = W[k];
        for (let d = 0; d < D; d++) if (x[d] !== 0) w[d] -= step * (g * x[d] + l2 * w[d]);
        b[k] -= step * g;
      }
    }
  }
  return (r) => {
    const x = V(r);
    let bl = labels[0], bs = -Infinity;
    for (let k = 0; k < K; k++) { let a = b[k]; const w = W[k]; for (let d = 0; d < x.length; d++) a += w[d] * x[d]; if (a > bs) { bs = a; bl = labels[k]; } }
    return bl;
  };
}

function elm(tr, hidden = 128, n = 5) {
  const ex = tr.map((r) => ({ vector: V(r), archetype: r.label }));
  const cats = [...new Set(ex.map((e) => e.archetype))].sort();
  const ms = Array.from({ length: n }, (_, i) => trainArchetypeELMNumeric(ex, cats, SEED + i * 7919, hidden));
  return (r) => {
    const v = V(r), votes = new Map();
    for (const m of ms) { const [t] = m.elm.predictTopKFromVector(v, 1); votes.set(t.label, (votes.get(t.label) ?? 0) + 1); }
    return [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };
}

function evaluate(fit, tr, te) {
  const f = fit(tr);
  let hit = 0;
  for (const r of te) if (f(r) === r.label) hit++;
  return hit / te.length;
}

// ── run ──────────────────────────────────────────────────────────────────────────────────

console.log("=".repeat(80));
console.log(`SAME FEATURES, SAME SPLIT, DIFFERENT LEARNERS   seed=${SEED}`);
console.log(`train ${pool.length} · held-out ${test.length} (${HELD_OUT.join("+")})`);
console.log("=".repeat(80));

const LEARNERS = [
  ["majority class", (tr) => majorityClass(tr)],
  ["extension lookup (5 lines)", (tr) => extensionLookup(tr)],
  ["nearest centroid", (tr) => nearestCentroid(tr)],
  ["k-NN cosine, k=5", (tr) => knn(tr, 5)],
  ["logistic regression", (tr) => logreg(tr)],
  ["ELM 128, 5-model ensemble", (tr) => elm(tr, 128, 5)],
  ["ELM 4096, 5-model ensemble", (tr) => elm(tr, 4096, 5)],
];

console.log(`\n${"learner".padEnd(30)} ${"accuracy".padStart(9)}`);
line();
const base = {};
for (const [name, fit] of LEARNERS) {
  const t0 = Date.now();
  const a = evaluate(fit, pool, test);
  base[name] = a;
  console.log(`${name.padEnd(30)} ${pct(a).padStart(9)}   ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// ── collapsing the label set ─────────────────────────────────────────────────────────────
line("=");
console.log("DOES A SMALLER LABEL SET HELP?");
line();
console.log("Rare classes are folded into `other` rather than dropped, so the test set stays");
console.log("the same size and accuracies remain comparable down the column.\n");

const freq = new Map();
for (const r of pool) freq.set(r.label, (freq.get(r.label) ?? 0) + 1);
const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);

console.log(`${"labels kept".padStart(12)} ${"ext lookup".padStart(11)} ${"logreg".padStart(9)} ${"ELM 128".padStart(9)}`);
for (const keepN of [16, 10, 8, 6, 5, 4, 3]) {
  const keep = new Set(ranked.slice(0, keepN));
  const fold = (rows) => rows.map((r) => (keep.has(r.label) ? r : { ...r, label: "other" }));
  const tr = fold(pool), te = fold(test);
  const e = evaluate((x) => extensionLookup(x), tr, te);
  const l = evaluate((x) => logreg(x), tr, te);
  const m = evaluate((x) => elm(x, 128, 5), tr, te);
  console.log(`${String(keepN).padStart(12)} ${pct(e).padStart(11)} ${pct(l).padStart(9)} ${pct(m).padStart(9)}`);
}

line("=");
console.log("HOW TO READ THIS");
line();
console.log("If a five-line lookup table or a plain logistic regression beats the ELM on the");
console.log("SAME features, then this project's negative results are about the LEARNER, not");
console.log("about whether the task can be learned -- and the conclusions drawn from the ELM's");
console.log("failure have to be revisited rather than defended.");
