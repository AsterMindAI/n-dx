/**
 * TJ-E1 generalisation check — does the content model learn a mapping, or just n-dx's prior?
 *
 * Acting on `NOTE-nolan-to-jarrett-2026-09-04-elm-corpus-available-and-a-generalisation-warning.md`
 * (on `Nolan-Work`; Team Jarrett never read it because it lives on a branch we do not check).
 *
 * WHAT TEAM NOLAN FOUND, AND WHY IT APPLIES HERE
 * ----------------------------------------------
 * Their tier passed held-out cross-validation and then collapsed on repos it had never seen:
 * 241 of 250 fresh-repo files came back `service` or `utility`, and it emitted 5 of 13 labels
 * instead of 9. The model had learned n-dx's archetype PRIOR, not a path->archetype mapping.
 * Held-out CV could never reveal it, because held-out rows come from the same repos.
 *
 * Their note says, in as many words: "If your ELM was trained on n-dx-derived labels, assume it
 * has this until you have checked." TJ-E1's model is trained on n-dx-derived labels.
 *
 * The check needs NO ground truth and NO LLM calls. It compares the model's own predicted class
 * distribution against the teacher's, on repos outside the training set. A model that has learned
 * a real mapping tracks the teacher's distribution; one that has learned a prior does not.
 *
 * CONTAMINATION: hono and trpc are Team Nolan's blind certification set and are deliberately
 * absent from this script and from the corpus. Do not add them.
 *
 * SETUP — the corpus is Team Nolan's and is deliberately NOT duplicated into this branch.
 * Duplicating a dataset across branches is how the two copies silently diverge, which is a
 * failure this project has already had twice. Fetch it from the branch that owns it:
 *
 *   mkdir -p scripts/data
 *   git show origin/Nolan-Work:scripts/data/elm-archetype-corpus-v3-classtargeted.json \
 *     > scripts/data/elm-archetype-corpus-v3-classtargeted.json
 *
 * Then clone the comparison repos at the exact commits the corpus pins (provenance.repos):
 *
 *   mkdir -p ../elm-fresh && cd ../elm-fresh
 *   git init -q fastify && cd fastify && git remote add origin https://github.com/fastify/fastify.git
 *   git fetch --depth 1 origin 4cdb0c5def812f5773c952efdb79f1e99dcfae92 && git checkout FETCH_HEAD
 *   # and vuejs/core at d63616ca17de965ed32dcb449a4c5cd9982f15d2
 *
 * Usage:
 *   node packages/sourcevision/scripts/elm-generalisation-check.mjs
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SEED = 20260922;
const CORPUS = "scripts/data/elm-archetype-corpus-v3-classtargeted.json";

/** repo id in the corpus -> local checkout root holding that repo's files at the pinned commit. */
const REPO_ROOTS = {
  "n-dx-1": ".",
  fastify: "../elm-fresh/fastify",
  core: "../elm-fresh/core",
};
const TRAIN_REPO = "n-dx-1";

const { buildFeatureVector, readFileContentSafely, FEATURE_VERSION } = await import(
  "../dist/analyzers/classify-elm-features.js"
);
const { trainArchetypeELMNumeric } = await import("../dist/analyzers/classify-elm.js");

const corpus = JSON.parse(readFileSync(CORPUS, "utf-8"));
const allRows = [...corpus.train, ...corpus.heldOut];

function vectorFor(repo, path) {
  const root = resolve(REPO_ROOTS[repo]);
  return buildFeatureVector({ path, content: readFileContentSafely(root, path) });
}

/** Share of rows whose label is the teacher's two sink classes. Nolan's headline metric. */
const SINKS = new Set(["service", "utility"]);
const sinkShare = (labels) => labels.filter((l) => SINKS.has(l)).length / labels.length;

// ── Train on n-dx teacher labels ─────────────────────────────────────────────────────────

const trainRows = allRows.filter((r) => r.repo === TRAIN_REPO);
const trainExamples = trainRows.map((r) => ({
  vector: vectorFor(r.repo, r.text),
  archetype: r.label,
}));
const categories = [...new Set(trainExamples.map((e) => e.archetype))].sort();
const model = trainArchetypeELMNumeric(trainExamples, categories, SEED);

console.log("=".repeat(78));
console.log(`TJ-E1 generalisation check   seed=${SEED}   feature layout v${FEATURE_VERSION}`);
console.log("=".repeat(78));
console.log(`corpus               ${CORPUS}`);
console.log(`                     ${corpus.stats.total} rows, ${corpus.stats.classes} classes, teacher-labelled`);
console.log(`trained on           ${TRAIN_REPO}: ${trainRows.length} rows, ${categories.length} classes`);
console.log(`\nAll labels below are an LLM teacher measured at 72.3% against human judgement.`);
console.log(`Agreement with them is NOT accuracy.`);

// ── Evaluate per repo ────────────────────────────────────────────────────────────────────

const report = [];
for (const repo of Object.keys(REPO_ROOTS)) {
  const rows = allRows.filter((r) => r.repo === repo);
  if (rows.length === 0) continue;

  let present = 0;
  let agree = 0;
  const predicted = [];
  const teacher = [];
  for (const r of rows) {
    const v = vectorFor(repo, r.text);
    // contentMissing is the last-but-one column; if content was unreadable the row still
    // counts, it just leans on the path half. Tracked so a low-overlap checkout is visible.
    const content = readFileContentSafely(resolve(REPO_ROOTS[repo]), r.text);
    if (content !== undefined) present++;
    const [top] = model.elm.predictTopKFromVector(v, 1);
    predicted.push(top.label);
    teacher.push(r.label);
    if (top.label === r.label) agree++;
  }
  report.push({
    repo,
    rows: rows.length,
    filesFound: present,
    heldIn: repo === TRAIN_REPO,
    agreement: agree / rows.length,
    predSink: sinkShare(predicted),
    teachSink: sinkShare(teacher),
    predDistinct: new Set(predicted).size,
    teachDistinct: new Set(teacher).size,
    predicted,
  });
}

console.log("\n" + "-".repeat(78));
console.log("DISTRIBUTION COMPARISON — the check that CV cannot do");
console.log("-".repeat(78));
console.log(
  `${"repo".padEnd(12)} ${"rows".padStart(5)} ${"files".padStart(6)} ${"agree".padStart(7)} ${"pred sink".padStart(10)} ${"teach sink".padStart(11)} ${"labels".padStart(8)}`,
);
for (const r of report) {
  // The training repo's row is IN-SAMPLE -- it is evaluated on the same rows it trained on, so
  // its "agree" figure is partly memorisation and is NOT a quality measure. It is printed only
  // as the reference distribution the fresh repos are compared against. For an honest in-domain
  // number use elm-savings-curve.mjs, which holds out Nolan's seed-42 split (~52-67%, not 80%).
  const tag = r.heldIn ? " (IN-SAMPLE, not a quality number)" : " FRESH";
  console.log(
    `${r.repo.padEnd(12)} ${String(r.rows).padStart(5)} ${String(r.filesFound).padStart(6)} ` +
      `${(100 * r.agreement).toFixed(1).padStart(6)}% ${(100 * r.predSink).toFixed(1).padStart(9)}% ` +
      `${(100 * r.teachSink).toFixed(1).padStart(10)}% ${String(r.predDistinct).padStart(3)}/${r.teachDistinct}${tag}`,
  );
}

console.log("\nHOW TO READ THIS:");
console.log("  'pred sink'  = share of the model's predictions that are service/utility");
console.log("  'teach sink' = share of the teacher's labels that are service/utility");
console.log("  A model that learned a MAPPING tracks teach-sink on fresh repos.");
console.log("  A model that learned n-dx's PRIOR shows pred-sink >> teach-sink there.");
console.log("  Nolan's failing tier: 96.4% pred vs 48.4% teach, 5 of 13 labels emitted.");

const fresh = report.filter((r) => !r.heldIn);
if (fresh.length > 0) {
  const worst = fresh.reduce((a, b) => (b.predSink - b.teachSink > a.predSink - a.teachSink ? b : a));
  const gap = worst.predSink - worst.teachSink;
  console.log("\n" + "-".repeat(78));
  console.log(
    `VERDICT: worst fresh-repo sink gap is ${(100 * gap).toFixed(1)} pp on "${worst.repo}" ` +
      `(${(100 * worst.predSink).toFixed(1)}% predicted vs ${(100 * worst.teachSink).toFixed(1)}% teacher).`,
  );
  console.log(
    gap > 0.25
      ? "  => COLLAPSED. Same failure mode Nolan hit. The model is reproducing a prior."
      : gap > 0.1
        ? "  => PARTIAL COLLAPSE. Better than Nolan's tier, still prior-dominated."
        : "  => NO COLLAPSE on this metric. Not a pass on its own -- it says the model is not\n" +
          "     merely echoing a prior. Precision still needs labels for the target population.",
  );
  console.log("-".repeat(78));
}

for (const r of fresh) {
  const counts = new Map();
  for (const p of r.predicted) counts.set(p, (counts.get(p) ?? 0) + 1);
  console.log(`\n${r.repo} — what the model actually emitted:`);
  for (const [a, n] of [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8)) {
    console.log(`  ${(100 * n / r.rows).toFixed(1).padStart(5)}%  ${String(n).padStart(4)}  ${a}`);
  }
}
