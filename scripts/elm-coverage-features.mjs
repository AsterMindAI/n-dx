#!/usr/bin/env node
/**
 * Coverage check over path ⊕ structural features.
 *
 * Phase 2 + 4 of IMPL-2026-09-18-nutella-elm-training-database-construction.md
 *
 * ⛔ scripts/elm-coverage-check.mjs IS NOT MODIFIED. It produced the committed
 * baseline (scripts/data/elm-coverage-v2.log, 28.0% on fresh ecosystems). Changing
 * it, however carefully, would put that comparison in doubt. This is a SIBLING, and
 * it earns the right to report anything by first reproducing that script's numbers.
 *
 * ── THE PARITY CONTROL ──────────────────────────────────────────────────────
 *   node --max-old-space-size=6144 scripts/elm-coverage-features.mjs --features=none
 * must print 33.8 / 28.0 / 35.8 / 24.3. A new instrument that cannot reproduce the
 * old instrument's result on the old input is not measuring the same thing, and any
 * structural number it prints would be meaningless.
 *
 * Usage:
 *   --features=none|structural   (default structural)
 *   --normaliser=percentile|log1p|pooled
 *   --block-scale=1.0            multiplier on the structural block
 *   --json=<path>                write the result table
 *
 * ⚠️ --max-old-space-size=6144 is MANDATORY. The frozen artifact stores a recipe,
 * not weights, so this re-fits nine 4096-unit models and OOMs at node's ~2096 MB
 * default. An OOM here exits 0 with an empty table, so the run asserts its own
 * output is populated rather than trusting the exit code.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ELM, TFIDFVectorizer, tokenize } from "@astermind/astermind-community";
import { collectRaw, buildStats, deriveFeatures, featureNames } from "./elm-features.mjs";

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const FROZEN = arg("frozen", "scripts/data/elm-frozen-model-v2.json");
const MODE = arg("features", "structural");
const NORMALISER = arg("normaliser", "percentile");
const BLOCK_SCALE = Number(arg("block-scale", "1.0"));
const JSON_OUT = arg("json", null);
const GOLD2 = "scripts/data/k2-goldset2-llm-labels.json";
const STAGING = "/Users/nolanmoore/Work/n-dx-elm-corpus";

/** Identical to elm-coverage-check.mjs:53,54,55 — not re-derived, deliberately copied. */
const docOf = (p) => tokenize(p).join(" ");
const oneHot = (l, cs) => cs.map((c) => (c === l ? 1 : 0));
const pct = (x) => `${(x * 100).toFixed(1)}%`;

const repoDir = (repo) => (repo === "n-dx-1" ? "." : `${STAGING}/${repo}`);

/** Raw structural rows for every repo we will need, keyed repo -> path -> row. */
function loadAllRaw(repos) {
  const byRepo = new Map();
  for (const r of repos) {
    const raw = collectRaw(repoDir(r));
    if (raw) byRepo.set(r, raw);
    else console.log(`  ⚠️  ${r}: no .sourcevision/inventory.json — structural features unavailable`);
  }
  return byRepo;
}

function buildTier() {
  const frozen = JSON.parse(readFileSync(FROZEN, "utf-8"));
  const corpusPath = frozen.trainedOn?.corpus;
  if (!corpusPath || !existsSync(corpusPath)) throw new Error(`${FROZEN} trainedOn.corpus missing: ${corpusPath}`);
  const corpus = JSON.parse(readFileSync(corpusPath, "utf-8"));
  const { hiddenUnits, activation, ridgeLambda, vocabCap, ensembleSeeds, operatingPoint } = frozen.spec;
  const cats = frozen.categories;

  // Path block — fitted on exactly the rows the model saw. Not a knob.
  const vec = new TFIDFVectorizer(corpus.train.map((r) => docOf(r.text)), vocabCap);
  const Xpath = vec.vectorizeAll();

  let stats = null;
  let byRepo = null;
  let structuralNames = [];
  if (MODE === "structural") {
    const trainRepos = [...new Set(corpus.train.map((r) => r.repo))];
    const evalRepos = ["hono", "trpc"];
    byRepo = loadAllRaw([...new Set([...trainRepos, ...evalRepos])]);
    // Statistics are built from TRAINING repos only. Including the evaluation repos
    // would let the eval set influence its own normalisation — a quiet form of
    // selecting on the test set.
    const trainOnly = new Map([...byRepo].filter(([r]) => trainRepos.includes(r)));
    stats = buildStats(trainOnly, NORMALISER);
    structuralNames = featureNames();
  }

  const structuralFor = (repo, path) => {
    if (MODE !== "structural") return [];
    const raw = byRepo.get(repo)?.rows.get(path);
    if (!raw) {
      // File not in that repo's inventory: emit an all-missing vector rather than
      // dropping the row, so n stays identical to the baseline run.
      const probe = { inDegree: null, outDegree: null, loc: null, size: null, edgeTypes: null, isolated: null, inCycle: null, externalPackages: null };
      return deriveFeatures(probe, repo, stats).vector.map((x) => x * BLOCK_SCALE);
    }
    return deriveFeatures(raw, repo, stats).vector.map((x) => x * BLOCK_SCALE);
  };

  const X = Xpath.map((x, i) => {
    const r = corpus.train[i];
    return [...x, ...structuralFor(r.repo, r.text)];
  });
  const Y = corpus.train.map((r) => oneHot(r.label, cats));

  const models = ensembleSeeds.map((seed) => {
    const e = new ELM({ categories: cats, hiddenUnits, activation, ridgeLambda, seed, log: { modelName: "covf", verbose: false } });
    // trainFromData with explicit one-hot. NEVER ELM.train() — it does not train on
    // what you pass it (ELM-CORPUS.md § 10a).
    e.trainFromData(X, Y);
    return e;
  });

  const vote = (items) => {
    const vecs = items.map((it) => [...vec.vectorize(docOf(it.path)), ...structuralFor(it.repo, it.path)]);
    const per = models.map((m) => vecs.map((x) => m.predictFromVector([x], 1)[0][0]));
    return vecs.map((_, i) => {
      const tally = new Map();
      for (const p of per) {
        const { label, prob } = p[i];
        const cur = tally.get(label) ?? { n: 0, p: 0 };
        tally.set(label, { n: cur.n + 1, p: cur.p + prob });
      }
      let best = null;
      for (const [label, t] of tally) if (!best || t.n > best.t.n || (t.n === best.t.n && t.p > best.t.p)) best = { label, t };
      return { label: best.label, prob: best.t.n / models.length };
    });
  };

  return { frozen, operatingPoint, vote, corpus, corpusPath, dims: X[0].length, pathDims: Xpath[0].length, structuralNames, byRepo };
}

/** Coverage definition IDENTICAL to elm-coverage-check.mjs:98. Must not change. */
function report(name, items, tier, extra = {}) {
  const { operatingPoint, vote } = tier;
  const SU = new Set(operatingPoint.abstainOn);
  const preds = vote(items);
  const nonSU = preds.filter((p) => !SU.has(p.label)).length;
  const suCount = preds.length - nonSU;
  const admitted = Math.round(suCount * operatingPoint.suAdmitFraction);
  const coverage = (nonSU + admitted) / items.length;

  const dist = {};
  for (const p of preds) dist[p.label] = (dist[p.label] ?? 0) + 1;
  const withTeacher = items.filter((i) => i.llmLabel);
  const teacherSU = withTeacher.length ? withTeacher.filter((i) => SU.has(i.llmLabel)).length / withTeacher.length : null;
  const teacherClasses = new Set(withTeacher.map((i) => i.llmLabel)).size;

  console.log(`\n  ${name}  (n=${items.length})`);
  console.log(`    ELM predicts service/utility   ${pct(suCount / preds.length)}` +
    (teacherSU === null ? "" : `      teacher says ${pct(teacherSU)}`));
  console.log(`    distinct labels used: ELM ${Object.keys(dist).length}` +
    (teacherClasses ? ` vs teacher ${teacherClasses}` : ""));
  console.log(`    COVERAGE ${pct(coverage).padStart(6)}   K1' (>=30%): ${coverage >= 0.30 ? "PASS" : "FAIL"}`);
  console.log(`    ELM mix: ${Object.entries(dist).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ")}`);
  return { name, n: items.length, coverage, rendered: pct(coverage), elmSuShare: suCount / preds.length,
           teacherSuShare: teacherSU, elmDistinctLabels: Object.keys(dist).length,
           teacherDistinctLabels: teacherClasses || null, pass: coverage >= 0.30, ...extra };
}

function main() {
  const tier = buildTier();
  console.log("Coverage check — path ⊕ structural features");
  console.log(`  mode        ${MODE}${MODE === "structural" ? `  normaliser=${NORMALISER}  blockScale=${BLOCK_SCALE}` : "  (PARITY CONTROL — must reproduce elm-coverage-check.mjs)"}`);
  console.log(`  model       ${tier.frozen.contentHash.slice(0, 16)}…  operating point ${tier.operatingPoint.design}`);
  console.log(`  spec        ELM ${tier.frozen.spec.hiddenUnits} / ${tier.frozen.spec.activation}`);
  console.log(`  dims        ${tier.pathDims} path + ${tier.dims - tier.pathDims} structural = ${tier.dims}`);
  console.log(`  trained on  ${tier.corpusPath}  (${tier.corpus.train.length} rows)`);

  const results = [];
  const repos = (tier.corpus.provenance?.repos ?? []).map((r) => r.repo);
  const held = tier.corpus.heldOut.map((h) => ({ path: h.text, repo: h.repo, llmLabel: h.label }));
  results.push(report(`held-out split — ${repos.join(" + ")}  [DEV, trained-on ecosystems]`, held, tier));

  const g2 = JSON.parse(readFileSync(GOLD2, "utf-8"));
  results.push(report("gold set #2 packet — hono + trpc  [FRESH ecosystems]", g2.labels, tier));
  for (const repo of [...new Set(g2.labels.map((l) => l.repo))]) {
    results.push(report(`  ${repo} only`, g2.labels.filter((l) => l.repo === repo), tier));
  }

  // An OOM on this job exits 0 with an empty table. Assert rather than trust.
  if (results.length !== 4 || results.some((r) => !Number.isFinite(r.coverage))) {
    console.error("\nFATAL: incomplete results table — treat this run as failed regardless of exit code.");
    process.exit(1);
  }

  const fresh = results[1];
  console.log("\n  ── Against the pre-registered bar ─────────────────────────────────");
  console.log(`  baseline (frozen v2, path-only, committed)   28.0%`);
  console.log(`  this run (fresh ecosystems)                  ${fresh.rendered}`);
  if (MODE === "none") {
    const ok = results.map((r) => r.rendered).join(" / ") === "33.8% / 28.0% / 35.8% / 24.3%";
    console.log(`\n  PARITY CONTROL: ${ok ? "PASS — reproduces the committed baseline exactly" : "FAIL"}`);
    console.log(`    expected  33.8% / 28.0% / 35.8% / 24.3%`);
    console.log(`    got       ${results.map((r) => r.rendered).join(" / ")}`);
    if (!ok) { console.error("\n  Harness is not measuring the same thing. No structural number it prints would mean anything."); process.exit(1); }
  } else {
    const d = (fresh.coverage - 0.280) * 100;
    console.log(`  PRIMARY   beat 28.0%    ${fresh.coverage > 0.280 ? "PASS" : "FAIL"}   (${d >= 0 ? "+" : ""}${d.toFixed(1)} pp)`);
    console.log(`  SECONDARY >= 30.0%      ${fresh.coverage >= 0.300 ? "PASS" : "FAIL"}`);
    console.log(`  TERTIARY  >7 labels     ${fresh.elmDistinctLabels > 7 ? "PASS" : "FAIL"}   (${fresh.elmDistinctLabels} vs teacher ${fresh.teacherDistinctLabels})`);
    console.log(`  GUARD     trained-on >= 31.8%   ${results[0].coverage >= 0.318 ? "PASS" : "FAIL"}   (${results[0].rendered})`);
  }

  if (JSON_OUT) {
    writeFileSync(JSON_OUT, JSON.stringify({
      generatedBy: "scripts/elm-coverage-features.mjs",
      mode: MODE, normaliser: MODE === "structural" ? NORMALISER : null,
      blockScale: MODE === "structural" ? BLOCK_SCALE : null,
      frozen: FROZEN, dims: { path: tier.pathDims, structural: tier.dims - tier.pathDims },
      baseline: 0.280, results,
    }, null, 2));
    console.log(`\n  wrote ${JSON_OUT}`);
  }
}

main();
