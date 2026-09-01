#!/usr/bin/env node
/**
 * Phase 3 certification. Run ONCE, after gold set #2 comes back labelled.
 *
 * ⚠️ THIS FILE WAS WRITTEN AND COMMITTED BEFORE THE LABELS EXISTED.
 * That is deliberate and it is the strongest form of pre-registration
 * available: the analysis cannot be shaped by the data if it predates it. The
 * margin, the test, the analysis set and the stopping rules all come from
 * Claude-Context/IMPL/IMPL-2026-08-28-jam-elm-tier-implementation.md
 * § "Phase 3 pre-registration" (55236e3c / b028b589, teacher amendment d2ea812c).
 *
 * If you are editing this file after seeing gold set #2's labels, stop. The
 * certification is void and the honest move is a third gold set.
 *
 * ── The claim being tested ────────────────────────────────────────────────
 * NON-INFERIORITY at delta = 5 pp, one-sided alpha = 0.05.
 *   d = P(ELM correct) - P(LLM correct), paired, on the files the tier claims.
 *   Certified iff the one-sided 95% LOWER bound on d exceeds -0.05,
 *   by BOTH Tango's score interval AND a 20k bootstrap.
 *
 * Superiority is NOT tested. At this operating point the two labellers agree on
 * ~89% of claimed files, so a superiority test has ~5% power at n=250
 * (scripts/elm-goldset2-power.mjs). A "significant" superiority result here
 * would be a false positive far more often than a real effect.
 *
 * Usage: node scripts/elm-certify.mjs [--packet=<path>]
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { ELM, TFIDFVectorizer, tokenize } from "@astermind/astermind-community";

const CORPUS1 = "scripts/data/elm-archetype-corpus.json";
const FROZEN = "scripts/data/elm-frozen-model.json";
const LLM_LABELS = "scripts/data/k2-goldset2-llm-labels.json";
const DEFAULT_PACKET = "scripts/data/k2-goldset2-packet.csv";
const OUT = "scripts/data/k2-certification.json";

/** Pre-registered. A record, not a knob. */
const DELTA = 0.05;
const ALPHA = 0.05;
const Z = 1.6448536269514722; // one-sided 95%
const BOOTSTRAP = 20000;
const NON_LABELS = new Set(["unclear", "missing", ""]);

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const docOf = (p) => tokenize(p).join(" ");
const oneHot = (l, cs) => cs.map((c) => (c === l ? 1 : 0));
const pct = (x) => `${(x * 100).toFixed(1)}%`;

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
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Tango's asymptotic score lower confidence limit for the paired risk
 * difference. Solves the score equation on a grid — the closed form is fiddly
 * and a grid is transparent enough to audit.
 *
 * n01 = ELM right & LLM wrong, n10 = ELM wrong & LLM right, n = claimed files.
 */
function tangoLower(n01, n10, n, z = Z) {
  const score = (delta) => {
    // Constrained MLE of the discordant probability under H: d = delta.
    const a = 2 * n;
    const b = -n01 + 2 * n10 + delta * (2 * n + n01 - n10);
    const c = -n10 * delta * (1 + delta);
    const disc = Math.max(0, b * b - 4 * a * c * -1 * -1);
    const q = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    const p21 = Math.max(1e-12, q);
    const p12 = Math.max(1e-12, p21 + delta);
    const varr = n * (p12 + p21 - delta * delta);
    if (varr <= 0) return NaN;
    return ((n01 - n10) - n * delta) / Math.sqrt(varr);
    void disc;
  };
  // Walk delta down from the point estimate until the score exceeds z.
  const point = (n01 - n10) / n;
  let lo = -1;
  for (let d = point; d >= -1; d -= 0.0005) {
    const s = score(d);
    if (!Number.isFinite(s)) continue;
    if (s >= z) { lo = d; break; }
  }
  return lo;
}

/** Bootstrap percentile lower bound on the paired difference, resampling FILES. */
function bootstrapLower(pairs, alpha = ALPHA, reps = BOOTSTRAP, seed = 20260901) {
  const rnd = mulberry32(seed);
  const n = pairs.length;
  const diffs = new Float64Array(reps);
  for (let r = 0; r < reps; r++) {
    let e = 0, l = 0;
    for (let i = 0; i < n; i++) {
      const p = pairs[(rnd() * n) | 0];
      if (p.elmCorrect) e++;
      if (p.llmCorrect) l++;
    }
    diffs[r] = (e - l) / n;
  }
  diffs.sort();
  return diffs[Math.floor(alpha * reps)];
}

function main() {
  const packetPath = arg("packet", DEFAULT_PACKET);
  const frozen = JSON.parse(readFileSync(FROZEN, "utf-8"));
  const corpus = JSON.parse(readFileSync(CORPUS1, "utf-8"));
  const teacher = JSON.parse(readFileSync(LLM_LABELS, "utf-8"));
  const packet = parseCsv(readFileSync(packetPath, "utf-8"));

  // ── Refuse to certify anything but the frozen model. ────────────────────
  const { hiddenUnits, activation, ridgeLambda, vocabCap, ensembleSeeds, operatingPoint } = frozen.spec;
  const cats = frozen.categories;
  const rows = corpus.train;
  const v = new TFIDFVectorizer(rows.map((r) => docOf(r.text)), vocabCap);
  const Xtr = v.vectorizeAll();
  const Ytr = rows.map((r) => oneHot(r.label, cats));
  const models = ensembleSeeds.map((seed) => {
    const e = new ELM({ categories: cats, hiddenUnits, activation, ridgeLambda, seed, log: { modelName: "cert", verbose: false } });
    e.trainFromData(Xtr, Ytr);
    return e;
  });
  const vote = (vecs) => {
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
  const probeFp = createHash("sha256")
    .update(vote(rows.map((r) => v.vectorize(docOf(r.text)))).map((p) => `${p.label}:${p.prob.toFixed(6)}`).join("|"))
    .digest("hex");
  if (probeFp !== frozen.refitFingerprint.sha256) {
    throw new Error(
      `FROZEN MODEL MISMATCH.\n  expected ${frozen.refitFingerprint.sha256}\n  got      ${probeFp}\n` +
      "  The model being scored is not the model that was frozen. Certification refused.",
    );
  }

  // ── Join packet -> truth, teacher labels, ELM predictions. ──────────────
  const teacherBy = new Map(teacher.labels.map((l) => [`${l.repo}::${l.path}`, l.llmLabel]));
  const joined = packet.map((r) => {
    const key = `${r.repo}::${r.path}`;
    if (!teacherBy.has(key)) throw new Error(`Packet row ${r.id} (${key}) has no teacher label — join is unsound.`);
    return { id: Number(r.id), repo: r.repo, path: r.path, truth: r.pass2_after_reading_file, pass1: r.pass1_path_only, confident: r.confident_yes_no, llm: teacherBy.get(key) };
  });
  const unlabelled = joined.filter((j) => !j.truth);
  if (unlabelled.length === joined.length) {
    console.error(`The packet at ${packetPath} has no pass2 labels yet. Nothing to certify.`);
    console.error("This script runs ONCE, after the labelled packet comes back.");
    process.exit(2);
  }
  const preds = vote(joined.map((j) => v.vectorize(docOf(j.path))));
  joined.forEach((j, i) => { j.elm = preds[i].label; j.elmConf = preds[i].prob; });

  // ── The claimed subset, per the FROZEN operating point. ─────────────────
  const abstain = new Set(operatingPoint.abstainOn);
  const nonSU = joined.filter((j) => !abstain.has(j.elm));
  const su = joined.filter((j) => abstain.has(j.elm)).sort((a, b) => b.elmConf - a.elmConf);
  const claimed = nonSU.concat(su.slice(0, Math.round(su.length * operatingPoint.suAdmitFraction)));

  const analysis = claimed.filter((j) => !NON_LABELS.has(j.truth));
  const excluded = claimed.length - analysis.length;
  const pairs = analysis.map((j) => ({ elmCorrect: j.elm === j.truth, llmCorrect: j.llm === j.truth, repo: j.repo }));

  const n = pairs.length;
  const n01 = pairs.filter((p) => p.elmCorrect && !p.llmCorrect).length;
  const n10 = pairs.filter((p) => !p.elmCorrect && p.llmCorrect).length;
  const elmAcc = pairs.filter((p) => p.elmCorrect).length / n;
  const llmAcc = pairs.filter((p) => p.llmCorrect).length / n;
  const d = elmAcc - llmAcc;
  const tango = tangoLower(n01, n10, n);
  const boot = bootstrapLower(pairs);
  const pass = tango > -DELTA && boot > -DELTA;

  const coverage = claimed.length / joined.length;
  const usableAll = joined.filter((j) => !NON_LABELS.has(j.truth));
  const llmGlobal = usableAll.filter((j) => j.llm === j.truth).length / usableAll.length;
  const pathCeil = (() => {
    const u = joined.filter((j) => !NON_LABELS.has(j.truth) && !NON_LABELS.has(j.pass1));
    return u.length ? u.filter((j) => j.pass1 === j.truth).length / u.length : null;
  })();

  console.log("PHASE 3 CERTIFICATION — gold set #2\n");
  console.log(`  frozen model ${frozen.contentHash.slice(0, 16)}…  fingerprint VERIFIED`);
  console.log(`  packet ${packetPath} · ${joined.length} files · teacher ${teacher.teacher.model}\n`);
  console.log(`  coverage (K1'):        ${pct(coverage)}   ${coverage >= 0.30 ? "PASS (>=30%)" : "FAIL (<30%)"}`);
  console.log(`  claimed files scored:  ${n}${excluded ? `  (${excluded} excluded: unclear/missing truth)` : ""}`);
  console.log(`  ELM accuracy:          ${pct(elmAcc)}`);
  console.log(`  LLM accuracy (same):   ${pct(llmAcc)}`);
  console.log(`  paired difference d:   ${d >= 0 ? "+" : ""}${(d * 100).toFixed(1)} pp   (n01=${n01} ELM-only-right, n10=${n10} LLM-only-right)\n`);
  console.log(`  NON-INFERIORITY at delta=${DELTA * 100} pp, one-sided ${(1 - ALPHA) * 100}%:`);
  console.log(`    Tango score lower bound      ${(tango * 100).toFixed(1)} pp   ${tango > -DELTA ? "PASS" : "FAIL"}`);
  console.log(`    bootstrap lower bound        ${(boot * 100).toFixed(1)} pp   ${boot > -DELTA ? "PASS" : "FAIL"}`);
  console.log(`\n  VERDICT: ${pass ? "NON-INFERIOR" : "NOT CERTIFIED"}\n`);
  if (pass) {
    console.log("  This licenses exactly one sentence:");
    console.log(`    \"On these repos the tier is not worse than ${teacher.teacher.model} by more than`);
    console.log("     5 pp on the files it claims, at 95% confidence.\"");
    console.log("  It does NOT license \"as good as\", \"better than\", or any claim about other repos.");
  } else {
    console.log("  The tier does not ship. Per the pre-registration, the honest move is a THIRD");
    console.log("  gold set, not a retune against this one.");
  }

  // Secondary — descriptive, never bars.
  const byRepo = {};
  for (const p of pairs) {
    byRepo[p.repo] ??= { n: 0, elm: 0, llm: 0 };
    byRepo[p.repo].n++; if (p.elmCorrect) byRepo[p.repo].elm++; if (p.llmCorrect) byRepo[p.repo].llm++;
  }
  console.log("\n  Secondary (descriptive, NOT bars):");
  for (const [repo, s] of Object.entries(byRepo)) {
    console.log(`    ${repo.padEnd(8)} n=${String(s.n).padStart(3)}  ELM ${pct(s.elm / s.n)}  LLM ${pct(s.llm / s.n)}  d ${((s.elm - s.llm) / s.n * 100).toFixed(1)} pp`);
  }
  console.log(`    LLM vs truth, ALL ${usableAll.length} files: ${pct(llmGlobal)}`);
  if (pathCeil !== null) console.log(`    path-information ceiling (pass1 vs pass2): ${pct(pathCeil)}`);
  const notConf = joined.filter((j) => j.confident === "no").length;
  console.log(`    rater not-confident: ${notConf}/${joined.length} (${pct(notConf / joined.length)})`);
  if (Object.keys(byRepo).length > 1) {
    const ds = Object.values(byRepo).map((s) => (s.elm - s.llm) / s.n);
    if (Math.max(...ds) - Math.min(...ds) > 0.10) {
      console.log("    ⚠️  per-repo differences span >10 pp — heterogeneity IS the finding.");
      console.log("        Do not quote the pooled number without it.");
    }
  }

  writeFileSync(OUT, JSON.stringify({
    schema: "k2-certification/v1", generatedAt: new Date().toISOString(),
    preRegistered: { impl: "IMPL-2026-08-28 § Phase 3", delta: DELTA, alpha: ALPHA, scriptCommittedBeforeLabels: true },
    frozenModel: { contentHash: frozen.contentHash, fingerprintVerified: true, spec: frozen.spec },
    teacher: teacher.teacher,
    primary: { n, elmAccuracy: elmAcc, llmAccuracy: llmAcc, difference: d, n01, n10, tangoLower: tango, bootstrapLower: boot, nonInferior: pass },
    k1prime: { coverage, threshold: 0.30, pass: coverage >= 0.30 },
    secondary: { byRepo, llmVsTruthAllFiles: llmGlobal, pathCeiling: pathCeil, raterNotConfident: notConf, excludedUnclearOrMissing: excluded },
    verdict: pass ? "NON-INFERIOR" : "NOT CERTIFIED",
  }, null, 2) + "\n");
  console.log(`\n  wrote ${OUT}`);
}

main();
