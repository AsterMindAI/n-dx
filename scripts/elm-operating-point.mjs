#!/usr/bin/env node
/**
 * Phase 2 — operating-point search on the DEV gold set.
 *
 * ⚠️⚠️ EVERY NUMBER THIS SCRIPT PRINTS IS A **DEV** NUMBER. ⚠️⚠️
 * Gold set #1 (`k2-goldset-packet.csv`) has been read. It is a development set,
 * not a test set. Nothing here certifies anything, and no figure from this file
 * may be published as a result. Certification is Phase 3, on gold set #2,
 * against a frozen model, once.
 *
 * ── Why this file exists ──────────────────────────────────────────────────
 * The abstention design was ADOPTED in
 * ADR-2026-08-28-jam-implement-the-elm-tier.md § 3a on the strength of
 * "22.9% of files at 75.5% precision" — and **no committed script produced
 * those numbers.** `elm-diagnostics.mjs` covers capacity, features, data volume
 * and the class merge; none of them covers abstention. That is the handbook's
 * § 6.2 trap ("distinguish 'consistent with' from 'recorded'") in the live plan,
 * so the adopted design gets reproduced by an instrument before anything is
 * built on top of it.
 *
 * ── The comparison that matters, and the one that flatters ────────────────
 * S1 asks whether the gated ELM beats the LLM **on the same files**. Quoting
 * the LLM's global 72.3% against a gate that hand-picks its files is not that
 * test: if the gate claims files the LLM already gets right 90% of the time,
 * clearing 72.3% means nothing. This script reports both and makes the
 * same-files comparison primary. The global figure is kept only so the two can
 * be seen to differ.
 *
 * Usage:
 *   node scripts/elm-operating-point.mjs [--repeats=N] [--hidden=N] [--lambda=F]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { ConfidenceClassifierELM, ELM, TFIDFVectorizer, tokenize } from "@astermind/astermind-community";

const CORPUS = "scripts/data/elm-archetype-corpus.json";
const PACKET = "scripts/data/k2-goldset-packet.csv";
/** One file per activation, so a Phase-2 re-run under a new Phase-1 winner does not erase the old one. */
const outPath = (act) => `scripts/data/elm-operating-point${act === "relu" ? "" : `-${act}`}.json`;
const NON_LABELS = new Set(["unclear", "missing"]);
const ABSTAIN_ON = new Set(["service", "utility"]);
const BATCH = 30; // classify.ts:322

/** Measured by scripts/elm-calls-avoided.mjs (f91370f8). Files reaching the LLM, and batches. */
const REPOS = [
  { repo: "n-dx-1", residue: 255, batches: 9 },
  { repo: "AsterMind-Community-Edition", residue: 69, batches: 3 },
];

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? Number(a.slice(k.length + 3)) : d;
};
const argStr = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const docOf = (p) => tokenize(p).join(" ");
const oneHot = (l, cats) => cats.map((c) => (c === l ? 1 : 0));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const rng = (a) => `${pct(Math.min(...a))}–${pct(Math.max(...a))}`;

function assertHarnessCanLearn() {
  const cats = ["a", "b"];
  const X = [[1, 0], [1, 0], [1, 0], [0, 1], [0, 1], [0, 1]];
  const Y = ["a", "a", "a", "b", "b", "b"].map((l) => oneHot(l, cats));
  const elm = new ELM({ categories: cats, hiddenUnits: 16, activation: "relu", seed: 1, log: { modelName: "sanity", verbose: false } });
  elm.trainFromData(X, Y);
  if (elm.predictFromVector([[1, 0]], 1)[0][0].label !== "a" || elm.predictFromVector([[0, 1]], 1)[0][0].label !== "b") {
    throw new Error("HARNESS SANITY CHECK FAILED — any number from this run is meaningless.");
  }
}

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

/**
 * Calls avoided is `ceil(n/30)` on each repo — a STEP function, not a rate.
 * A design that claims 4 more files usually avoids zero more calls; the Step 1
 * gateway fix reclassified 4 real files (259 -> 255) and saved nothing.
 */
function callsAvoided(coverage) {
  const per = REPOS.map((r) => {
    const remaining = Math.round(r.residue * (1 - coverage));
    return { repo: r.repo, batchesAfter: Math.ceil(remaining / BATCH), avoided: r.batches - Math.ceil(remaining / BATCH) };
  });
  return { perRepo: Object.fromEntries(per.map((p) => [p.repo, p.avoided])), total: per.reduce((s, p) => s + p.avoided, 0) };
}

/** The smallest coverage that avoids `k` calls on a repo — the batch boundaries K1 actually lives on. */
function coverageForCalls(repo, k) {
  const r = REPOS.find((x) => x.repo === repo);
  const maxRemaining = (r.batches - k) * BATCH;
  return Math.max(0, (r.residue - maxRemaining) / r.residue);
}

/**
 * Score one claimed subset against truth, and against the LLM ON THE SAME FILES.
 * `claimed` is an array of held-out indices.
 */
function scoreClaim(claimed, pred, truth, llm) {
  const usable = claimed.filter((i) => !NON_LABELS.has(truth[i]));
  if (!usable.length) return null;
  return {
    coverage: claimed.length / truth.length,
    n: usable.length,
    elmPrecision: usable.filter((i) => pred[i] === truth[i]).length / usable.length,
    llmOnSameFiles: usable.filter((i) => llm[i] === truth[i]).length / usable.length,
  };
}

/** Aggregate the per-seed scores for one design into a reportable cell. */
function cell(name, perSeed, llmGlobal) {
  const ok = perSeed.filter(Boolean);
  if (!ok.length) return { name, empty: true };
  const cov = ok.map((s) => s.coverage);
  const prec = ok.map((s) => s.elmPrecision);
  const same = ok.map((s) => s.llmOnSameFiles);
  const c = mean(cov);
  const beatsSameFiles = mean(prec) >= mean(same);
  return {
    name,
    coverage: { mean: c, range: [Math.min(...cov), Math.max(...cov)] },
    elmPrecision: { mean: mean(prec), range: [Math.min(...prec), Math.max(...prec)] },
    llmOnSameFiles: { mean: mean(same), range: [Math.min(...same), Math.max(...same)] },
    llmGlobal,
    // Pre-registered reporting rule: a range that straddles the bar is never a pass.
    straddlesBar: Math.min(...prec) < mean(same) && Math.max(...prec) >= mean(same),
    beatsSameFiles,
    beatsGlobal: mean(prec) >= llmGlobal,
    callsAvoided: callsAvoided(c),
    meanClaimedRows: mean(ok.map((s) => s.n)),
  };
}

function main() {
  const repeats = arg("repeats", 15);
  const hidden = arg("hidden", 1024);
  const lambda = arg("lambda", 1e-2);
  // Phase 1 freezes the activation; Phase 2 must run the model Phase 1 adopted, not the one it started with.
  const activation = argStr("activation", "relu");
  assertHarnessCanLearn();

  const corpus = JSON.parse(readFileSync(CORPUS, "utf-8"));
  const packet = parseCsv(readFileSync(PACKET, "utf-8"));
  const key = (repo, path) => `${repo}::${path}`;
  const gold = new Map(packet.map((r) => [key(r.repo, r.path), r]));
  const held = corpus.heldOut;
  const missing = held.filter((h) => !gold.has(key(h.repo, h.text)));
  if (missing.length) throw new Error(`${missing.length} held-out rows absent from packet — join is unsound`);

  const truth = held.map((h) => gold.get(key(h.repo, h.text)).pass2_after_reading_file);
  const llm = held.map((h) => h.label);
  const cats = [...new Set(corpus.train.map((r) => r.label))];

  const v = new TFIDFVectorizer(corpus.train.map((r) => docOf(r.text)), 4000);
  const Xtr = v.vectorizeAll();
  const Ytr = corpus.train.map((r) => oneHot(r.label, cats));
  const Xho = held.map((r) => v.vectorize(docOf(r.text)));

  const usableIdx = held.map((_, i) => i).filter((i) => !NON_LABELS.has(truth[i]));
  const llmGlobal = usableIdx.filter((i) => llm[i] === truth[i]).length / usableIdx.length;

  console.log("Operating-point search — Phase 2\n");
  console.log("  ⚠️  DEV NUMBERS. Gold set #1 has been read. Nothing here certifies anything.\n");
  console.log(`  model: ELM hidden=${hidden} ${activation} λ=${lambda}, TF-IDF vocab 4000 fitted on train only`);
  console.log(`  ${repeats} seeds · held-out ${held.length} rows (${usableIdx.length} with usable truth)`);
  console.log(`  LLM vs truth, all held-out files: ${pct(llmGlobal)}  <- the bar, GLOBALLY`);
  const b3 = coverageForCalls("n-dx-1", 3), b2 = coverageForCalls("n-dx-1", 2);
  console.log(`  batch boundaries on n-dx (255 files, 9 batches): 2 calls @ ${pct(b2)} coverage · 3 calls @ ${pct(b3)}\n`);

  // ── Fit the seeds once; every design reads the same predictions. ──────────
  const seeds = [];
  for (let i = 0; i < repeats; i++) {
    const elm = new ELM({ categories: cats, hiddenUnits: hidden, activation, ridgeLambda: lambda, seed: 42 + i, log: { modelName: "op", verbose: false } });
    elm.trainFromData(Xtr, Ytr);
    const top = Xho.map((x) => elm.predictFromVector([x], 1)[0][0]);
    seeds.push({ elm, pred: top.map((t) => t.label), conf: top.map((t) => t.prob) });
  }

  const designs = {};
  const order = [];
  const add = (name, perSeed) => { designs[name] = cell(name, perSeed, llmGlobal); order.push(name); };

  // ── g: percentile confidence gate alone (the TN-J19 design, vs TRUTH). ────
  for (const q of [0.1, 0.2, 0.3, 0.4, 0.5]) {
    add(`g   gate top ${(q * 100).toFixed(0)}%`, seeds.map((s) => {
      const ranked = s.conf.map((c, i) => [c, i]).sort((a, b) => b[0] - a[0]);
      return scoreClaim(ranked.slice(0, Math.round(ranked.length * q)).map(([, i]) => i), s.pred, truth, llm);
    }));
  }

  // ── B: abstention, exactly as adopted in ADR § 3a. ────────────────────────
  add("B   abstention (ADOPTED)", seeds.map((s) =>
    scoreClaim(s.pred.map((p, i) => [p, i]).filter(([p]) => !ABSTAIN_ON.has(p)).map(([, i]) => i), s.pred, truth, llm)));

  // ── B+g: abstention, then keep only the most confident of what remains. ───
  for (const q of [0.5, 0.75]) {
    add(`B+g abstention, top ${(q * 100).toFixed(0)}% of it`, seeds.map((s) => {
      const kept = s.pred.map((p, i) => i).filter((i) => !ABSTAIN_ON.has(s.pred[i]));
      const ranked = kept.sort((a, b) => s.conf[b] - s.conf[a]);
      return scoreClaim(ranked.slice(0, Math.max(1, Math.round(ranked.length * q))), s.pred, truth, llm);
    }));
  }

  // ── B+su: abstention PLUS the most confident service/utility calls. ───────
  // The handbook's own suggestion, and the only candidate that RAISES coverage.
  for (const q of [0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5]) {
    add(`B+su abstention + top ${(q * 100).toFixed(0)}% of S/U`, seeds.map((s) => {
      const nonSU = s.pred.map((p, i) => i).filter((i) => !ABSTAIN_ON.has(s.pred[i]));
      const su = s.pred.map((p, i) => i).filter((i) => ABSTAIN_ON.has(s.pred[i])).sort((a, b) => s.conf[b] - s.conf[a]);
      return scoreClaim(nonSU.concat(su.slice(0, Math.round(su.length * q))), s.pred, truth, llm);
    }));
  }

  // ── cc: ConfidenceClassifierELM as a LEARNED gate. ───────────────────────
  // Carried forward from the Phase 1 pre-registration, where it was excluded on
  // the grounds that it is a binary low/high head over an upstream prediction,
  // not a 13-class classifier. Its training labels come from OUT-OF-FOLD train
  // predictions — training it on in-sample predictions would teach it that the
  // base model is always right, which is exactly what it must not learn.
  //
  // The gate is fitted ONCE per seed and then cut at several coverages. Fitting
  // it inside the coverage loop would train a different gate per threshold and
  // quietly turn one design into three.
  const INNER = 5;
  const ccScores = seeds.map((s, si) => {
    const idx = Array.from({ length: Xtr.length }, (_, i) => i);
    const oof = new Array(Xtr.length);
    for (let f = 0; f < INNER; f++) {
      const te = idx.filter((_, k) => k % INNER === f), tr = idx.filter((_, k) => k % INNER !== f);
      const e = new ELM({ categories: cats, hiddenUnits: hidden, activation, ridgeLambda: lambda, seed: 900 + si, log: { modelName: "cc-oof", verbose: false } });
      e.trainFromData(tr.map((i) => Xtr[i]), tr.map((i) => Ytr[i]));
      for (const i of te) {
        const p = e.predictFromVector([Xtr[i]], 1)[0][0];
        oof[i] = { label: p.label, conf: p.prob, correct: p.label === corpus.train[i].label };
      }
    }
    const cc = new ConfidenceClassifierELM(
      // The gate itself stays relu: Phase 1 swept the ARCHETYPE classifier, not this binary head.
      { categories: ["low", "high"], hiddenUnits: 256, activation: "relu", seed: 700 + si, log: { modelName: "cc", verbose: false } },
      { categories: ["low", "high"] },
    );
    cc.train(Xtr, oof.map((o) => [o.conf, ABSTAIN_ON.has(o.label) ? 1 : 0]), oof.map((o) => (o.correct ? "high" : "low")));
    return Xho.map((x, i) => cc.predictScore(x, [s.conf[i], ABSTAIN_ON.has(s.pred[i]) ? 1 : 0], "high"));
  });

  for (const q of [0.3, 0.5, 0.7]) {
    add(`cc  learned gate, top ${(q * 100).toFixed(0)}%`, seeds.map((s, si) => {
      const ranked = ccScores[si].map((c, i) => [c, i]).sort((a, b) => b[0] - a[0]);
      return scoreClaim(ranked.slice(0, Math.round(ranked.length * q)).map(([, i]) => i), s.pred, truth, llm);
    }));
  }

  console.log("  design                            coverage   ELM prec (range)      LLM same files   n-dx calls   verdict");
  for (const name of order) {
    const c = designs[name];
    if (c.empty) { console.log(`  ${name.padEnd(33)} (empty)`); continue; }
    const verdict = c.straddlesBar ? "STRADDLES" : c.beatsSameFiles ? "beats" : "below";
    console.log(
      `  ${name.padEnd(33)} ${pct(c.coverage.mean).padStart(6)}   ${pct(c.elmPrecision.mean).padStart(6)} (${rng(c.elmPrecision.range)})   ` +
      `${pct(c.llmOnSameFiles.mean).padStart(6)}          ${String(c.callsAvoided.perRepo["n-dx-1"]).padStart(2)}        ${verdict}`,
    );
  }

  console.log("\n  Reading the table:");
  console.log("    'beats'     = mean ELM precision >= mean LLM precision ON THE FILES THE DESIGN CLAIMS.");
  console.log("    'STRADDLES' = the seed range crosses the bar. Not a pass. Never report it as one.");
  console.log("    n-dx calls  = ceil(255*(1-coverage)/30) subtracted from 9. A STEP function.");
  console.log(`    K1 as written needs 3, which needs ${pct(b3)} coverage — not a precision target, a coverage one.\n`);

  writeFileSync(outPath(activation), JSON.stringify({
    schema: "elm-operating-point/v1",
    generatedAt: new Date().toISOString(),
    generatedBy: "scripts/elm-operating-point.mjs",
    status: "DEV — gold set #1 has been read. Not a certification. Phase 3 on gold set #2 is what would make any of this real.",
    preRegistered: { committedAt: "f4a06175", designsClosed: ["B", "B+g", "B+su", "g", "cc"] },
    model: { hiddenUnits: hidden, activation, ridgeLambda: lambda, vocabCap: 4000, seeds: repeats },
    bars: { llmVsTruthGlobal: llmGlobal, coverageFor2CallsNdx: b2, coverageFor3CallsNdx: b3 },
    repos: REPOS, batchSize: BATCH,
    designs: order.map((n) => designs[n]),
  }, null, 2) + "\n");
  console.log(`  wrote ${outPath(activation)}`);
}

main();
