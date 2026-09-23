#!/usr/bin/env node
/**
 * What fraction of a repo's LLM residue would the frozen tier actually claim?
 *
 * Coverage needs NO ground truth — it depends only on the model's predictions —
 * so this runs before any labelling and answers K1' on its own. That turned out
 * to matter: it found a stop-the-line result on gold set #2 before a single file
 * was hand-labelled.
 *
 * ── What it found, 2026-09-01 ─────────────────────────────────────────────
 *   gold set #1 held-out (n-dx + AsterMind-CE):  ELM says S/U 72.3%, teacher 72.3%
 *                                                 coverage 34.9%  -> K1' PASS
 *   gold set #2 (hono + trpc, fresh repos):      ELM says S/U 96.4%, teacher 48.4%
 *                                                 coverage 13.2%  -> K1' FAIL
 *
 * On the repos it was trained on, the model's class prior matches the teacher's
 * almost exactly. On unseen repos it collapses onto the majority class: 241 of
 * 250 files predicted `service`/`utility`, and only five distinct labels used in
 * total against the teacher's thirteen. **The tier has learned n-dx's archetype
 * prior, not a general path->archetype mapping.**
 *
 * This is also the argument for making coverage a RUNTIME gate, not just a
 * certification bar: a tier that can measure its own coverage on the user's repo
 * can decline to engage when it is out of distribution.
 *
 * Usage:
 *   node scripts/elm-coverage-check.mjs                 # gold sets #1 and #2
 *   node scripts/elm-coverage-check.mjs <repo-path>...  # any analyzed repo
 *   node scripts/elm-coverage-check.mjs --frozen=scripts/data/elm-frozen-model-v2.json
 *
 * `--frozen` selects which frozen model to measure. The training corpus is NOT a
 * separate flag — it is read from that artifact's `trainedOn.corpus`, because the
 * vectorizer has to be fitted on the rows the model actually saw.
 */

import { existsSync, readFileSync } from "node:fs";
import { ELM, TFIDFVectorizer, tokenize } from "@astermind/astermind-community";

const argStr = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const FROZEN = argStr("frozen", "scripts/data/elm-frozen-model.json");
const GOLD2_LABELS = "scripts/data/k2-goldset2-llm-labels.json";

/**
 * The corpus is DERIVED from the frozen artifact's `trainedOn.corpus`, never passed
 * separately. The vectorizer must be fitted on the same rows the model was trained
 * on; pairing a v2 model with a v1 vectorizer would silently score a different
 * feature space and still print a plausible number. Not a knob.
 */

const docOf = (p) => tokenize(p).join(" ");
const oneHot = (l, cs) => cs.map((c) => (c === l ? 1 : 0));
const pct = (x) => `${(x * 100).toFixed(1)}%`;

function loadFrozenTier() {
  const frozen = JSON.parse(readFileSync(FROZEN, "utf-8"));
  const corpusPath = frozen.trainedOn?.corpus;
  if (!corpusPath) throw new Error(`${FROZEN} has no trainedOn.corpus — cannot fit the vectorizer on the rows the model saw.`);
  if (!existsSync(corpusPath)) throw new Error(`${FROZEN} was trained on ${corpusPath}, which is missing. Coverage cannot be measured without it.`);
  const c1 = JSON.parse(readFileSync(corpusPath, "utf-8"));
  const { hiddenUnits, activation, ridgeLambda, vocabCap, ensembleSeeds, operatingPoint } = frozen.spec;
  const cats = frozen.categories;
  const v = new TFIDFVectorizer(c1.train.map((r) => docOf(r.text)), vocabCap);
  const X = v.vectorizeAll();
  const Y = c1.train.map((r) => oneHot(r.label, cats));
  const models = ensembleSeeds.map((seed) => {
    const e = new ELM({ categories: cats, hiddenUnits, activation, ridgeLambda, seed, log: { modelName: "cov", verbose: false } });
    e.trainFromData(X, Y);
    return e;
  });
  const vote = (paths) => {
    const vecs = paths.map((p) => v.vectorize(docOf(p)));
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
  return { frozen, operatingPoint, vote, c1, corpusPath };
}

function report(name, items, tier) {
  const { operatingPoint, vote } = tier;
  const SU = new Set(operatingPoint.abstainOn);
  const preds = vote(items.map((i) => i.path));
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
  return { name, n: items.length, coverage, elmSuShare: suCount / preds.length, teacherSuShare: teacherSU, elmDistinctLabels: Object.keys(dist).length, teacherDistinctLabels: teacherClasses || null, pass: coverage >= 0.30 };
}

function main() {
  const repoArgs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const tier = loadFrozenTier();
  console.log("Frozen-tier coverage check — no ground truth required");
  console.log(`  model ${tier.frozen.contentHash.slice(0, 16)}…  operating point ${tier.operatingPoint.design}`);
  console.log(`  spec  ELM ${tier.frozen.spec.hiddenUnits} / ${tier.frozen.spec.activation}`);
  console.log(`  trained on ${tier.corpusPath}  (${tier.c1.train.length} rows)`);

  const results = [];
  if (repoArgs.length) {
    for (const p of repoArgs) {
      const f = `${p}/.sourcevision/classifications.json`;
      if (!existsSync(f)) { console.log(`\n  ${p}: no .sourcevision/classifications.json — skipped`); continue; }
      const cls = JSON.parse(readFileSync(f, "utf-8"));
      const items = cls.files.filter((x) => x.source === "llm" && x.archetype).map((x) => ({ path: x.path, llmLabel: x.archetype }));
      results.push(report(p, items, tier));
    }
  } else {
    const held = tier.c1.heldOut.map((h) => ({ path: h.text, llmLabel: h.label }));
    // Name the ecosystems from the corpus rather than hard-coding "n-dx + AsterMind-CE",
    // which is only true of corpus v1. The comparison this script exists to make is
    // trained-on vs fresh, so the trained-on side has to say which repos it actually is.
    const repos = (tier.c1.provenance?.repos ?? []).map((r) => r.repo);
    const ecosystems = repos.length ? repos.join(" + ") : "(repos not recorded in corpus provenance)";
    results.push(report(`held-out split — ${ecosystems}  [DEV, trained-on ecosystems]`, held, tier));
    if (existsSync(GOLD2_LABELS)) {
      const g2 = JSON.parse(readFileSync(GOLD2_LABELS, "utf-8"));
      results.push(report("gold set #2 packet — hono + trpc  [FRESH ecosystems]", g2.labels, tier));
      for (const repo of [...new Set(g2.labels.map((l) => l.repo))]) {
        results.push(report(`  ${repo} only`, g2.labels.filter((l) => l.repo === repo), tier));
      }
    }
  }

  const trained = results.find((r) => r.name.startsWith("held-out split"));
  const fresh = results.find((r) => r.name.includes("gold set #2"));
  const perRepo = results.filter((r) => r.name.trim().endsWith("only"));
  if (trained && fresh) for (const line of formatFinding(trained, fresh, perRepo)) console.log(line);
}

/**
 * The closing interpretation, DERIVED from the numbers rather than asserted.
 *
 * ── Why this function exists ────────────────────────────────────────────────
 * Until 2026-09-23 the two verdict lines here were unconditional `console.log`s
 * reading "and collapses where it was not" and "It learned this corpus's
 * archetype prior, not a general path->archetype mapping". They were written
 * when v1 had in fact collapsed, and they were true of v1. They then printed for
 * EVERY model regardless of its numbers, so the committed certification logs of
 * the class-targeted model (`elm-coverage-v3-classtargeted.log`, fresh coverage
 * 47.2%, 12 labels emitted, collapse gone) end with a sentence announcing the
 * exact failure the run had just disproved.
 *
 * A reader skims the block headed "The finding". That is the whole danger: the
 * arithmetic above it was always right, and only the narration was wrong.
 *
 * Verify with `node scripts/elm-coverage-check.mjs --selftest` (no model work).
 */
export function formatFinding(trained, fresh, perRepo = []) {
  /** Over-predicting service/utility by this much on FRESH repos is the v1 signature. */
  const COLLAPSE_GAP = 0.15;
  const pp = (x) => `${(x * 100).toFixed(1)} pp`;
  const gapT = trained.elmSuShare - trained.teacherSuShare;
  const gapF = fresh.elmSuShare - fresh.teacherSuShare;
  const dir = (g) => (g >= 0 ? "over" : "under");
  const out = [];
  out.push("\n  ── The finding ────────────────────────────────────────────────────");
  out.push(`  coverage  ${pct(trained.coverage)} on trained-on ecosystems  ->  ${pct(fresh.coverage)} on fresh ones`);
  out.push(`  service/utility vs teacher — trained-on ${pct(trained.elmSuShare)} vs ${pct(trained.teacherSuShare)} (${dir(gapT)} by ${pp(Math.abs(gapT))})`);
  out.push(`                                    fresh ${pct(fresh.elmSuShare)} vs ${pct(fresh.teacherSuShare)} (${dir(gapF)} by ${pp(Math.abs(gapF))})`);

  if (gapF >= COLLAPSE_GAP) {
    out.push(`  The fresh-ecosystem prior IS collapsed onto service/utility (+${pp(gapF)} over the teacher).`);
    out.push("  It learned this corpus's archetype prior, not a general path->archetype mapping.");
  } else {
    out.push("  The fresh-ecosystem prior is NOT collapsed onto service/utility.");
    out.push("  ⚠️ Coverage counts predictions outside service/utility WHETHER OR NOT THEY ARE CORRECT,");
    out.push("     so this shows the prior widened — NOT that the predictions are right. Precision");
    out.push("     needs labelled ground truth and is capped by the teacher's own agreement with it.");
  }

  // Opposite biases across the fresh repos are invisible in the aggregate, and the
  // aggregate is the number people quote. Say so when it happens.
  const signs = perRepo.filter((r) => r.teacherSuShare !== null && r.teacherSuShare !== undefined)
    .map((r) => ({ name: r.name.trim().replace(/ only$/, ""), gap: r.elmSuShare - r.teacherSuShare }));
  if (signs.length > 1 && signs.some((s) => s.gap > 0) && signs.some((s) => s.gap < 0)) {
    out.push("  ⚠️ The fresh repos carry OPPOSITE biases, which the aggregate above hides:");
    for (const s of signs) out.push(`       ${s.name}: ${dir(s.gap)}-predicts service/utility by ${pp(Math.abs(s.gap))}`);
  }

  out.push("\n  Consequence: K1' is a property of (model, repo), not of the model alone.");
  out.push("  That is a limitation of K1' as proposed, and it is recorded rather than buried.");
  return out;
}

/** Fixtures are REAL committed runs, so the test fails on the old code by construction. */
function selftest() {
  const V1 = { coverage: 0.349, elmSuShare: 0.723, teacherSuShare: 0.723 };
  const V1F = { coverage: 0.132, elmSuShare: 0.964, teacherSuShare: 0.484 };
  const V3 = { coverage: 0.591, elmSuShare: 0.454, teacherSuShare: 0.409 };
  const V3F = { coverage: 0.472, elmSuShare: 0.588, teacherSuShare: 0.484 };
  const REPOS = [
    { name: "  hono only", elmSuShare: 0.222, teacherSuShare: 0.457 },
    { name: "  trpc only", elmSuShare: 0.763, teacherSuShare: 0.497 },
  ];
  const COLLAPSED = "It learned this corpus's archetype prior";
  let fail = 0;
  const check = (label, cond) => { console.log(`  ${cond ? "ok  " : "FAIL"}  ${label}`); if (!cond) fail++; };

  const v1 = formatFinding(V1, V1F, []).join("\n");
  check("v1 (fresh S/U 96.4% vs teacher 48.4%) DOES print the collapse verdict", v1.includes(COLLAPSED));

  const v3 = formatFinding(V3, V3F, REPOS).join("\n");
  check("v3-classtargeted (fresh 58.8% vs 48.4%) does NOT print the collapse verdict", !v3.includes(COLLAPSED));
  check("v3-classtargeted states the prior is NOT collapsed", v3.includes("NOT collapsed"));
  check("v3-classtargeted carries the necessary-not-sufficient caveat", v3.includes("WHETHER OR NOT THEY ARE CORRECT"));
  check("opposite per-repo biases are named", v3.includes("OPPOSITE biases") && v3.includes("hono") && v3.includes("trpc"));
  check("hono is reported as UNDER-predicting", /hono: under-predicts/.test(v3));
  check("trpc is reported as OVER-predicting", /trpc: over-predicts/.test(v3));

  console.log(fail === 0 ? "\nselftest: PASS" : `\nselftest: ${fail} FAILED`);
  process.exit(fail === 0 ? 0 : 1);
}

if (process.argv.includes("--selftest")) selftest();
else main();

