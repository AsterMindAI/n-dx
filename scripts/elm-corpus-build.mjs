#!/usr/bin/env node
/**
 * Build a labelled archetype-classification corpus for ELM/KELM training.
 *
 * Reads `.sourcevision/classifications.json` from one or more analyzed repos and
 * emits a single corpus file with provenance, a seeded stratified train/held-out
 * split, and a class-distribution report.
 *
 * Implements Step 2 of
 * Claude-Context/IMPL/IMPL-2026-08-13-jam-elm-classification-build.md
 *
 * Usage:
 *   node scripts/elm-corpus-build.mjs <repo-path> [<repo-path>...] [options]
 *
 * Options:
 *   --out=<path>       Output corpus file (default: scripts/data/elm-archetype-corpus.json)
 *   --source=<kinds>   Comma-separated label sources to include. Default "llm".
 *                      "algorithmic" = rule-derived. See the WARNING below.
 *   --seed=<n>         Split seed (default 42, matching elm-hello-world.mjs)
 *   --holdout=<f>      Held-out fraction (default 0.25)
 *   --min-class=<n>    Warn for classes with fewer than n rows (default 10)
 *   --dry-run          Report only; write nothing
 *
 * ── WARNING: which source you pick decides whether the corpus is meaningful ──
 *
 * `--source=algorithmic` yields rule-derived labels. Those rows describe files the
 * deterministic pass ALREADY classifies, so a model trained on them learns to imitate
 * rules where the rules already work — and is then deployed on the files the rules
 * FAILED on. That is a covariate shift, and a naive held-out score will look great
 * while field accuracy is worthless. Use it as a sanity set, never as the headline
 * training set.
 *
 * `--source=llm` (the default) yields labels for exactly the population the ELM will
 * serve. This requires an analyze run WITHOUT `--fast`, with a working LLM.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve, basename, dirname } from "node:path";
import { execFileSync } from "node:child_process";

const DEFAULT_OUT = "scripts/data/elm-archetype-corpus.json";
const DEFAULT_SEED = 42;
const DEFAULT_HOLDOUT = 0.25;
const DEFAULT_MIN_CLASS = 10;

// ── Args ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const repos = [];
  const opts = {
    out: DEFAULT_OUT,
    sources: ["llm"],
    seed: DEFAULT_SEED,
    holdout: DEFAULT_HOLDOUT,
    minClass: DEFAULT_MIN_CLASS,
    dryRun: false,
  };
  for (const arg of argv) {
    if (arg.startsWith("--out=")) opts.out = arg.slice(6);
    else if (arg.startsWith("--source=")) opts.sources = arg.slice(9).split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg.startsWith("--seed=")) opts.seed = Number(arg.slice(7));
    else if (arg.startsWith("--holdout=")) opts.holdout = Number(arg.slice(10));
    else if (arg.startsWith("--min-class=")) opts.minClass = Number(arg.slice(12));
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    else repos.push(arg);
  }
  if (repos.length === 0) throw new Error("No repo paths given. Usage: node scripts/elm-corpus-build.mjs <repo-path>...");
  if (!Number.isFinite(opts.seed)) throw new Error("--seed must be a number");
  if (!(opts.holdout > 0 && opts.holdout < 1)) throw new Error("--holdout must be between 0 and 1");
  return { repos, opts };
}

// ── Deterministic RNG (mulberry32) ───────────────────────────────────────────
// Seeded so another team re-running this gets byte-identical splits. A corpus
// whose split cannot be reproduced cannot be used to compare two models.

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(items, rand) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Provenance ───────────────────────────────────────────────────────────────
// A corpus whose origin is unknown cannot be reasoned about later, so every
// source repo records what it was and where it stood.

function gitInfo(repoPath) {
  const run = (args) => {
    try {
      return execFileSync("git", ["-C", repoPath, ...args], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      return null;
    }
  };
  return {
    commit: run(["rev-parse", "HEAD"]),
    branch: run(["rev-parse", "--abbrev-ref", "HEAD"]),
    remote: run(["config", "--get", "remote.origin.url"]),
    dirty: run(["status", "--porcelain"]) ? true : false,
  };
}

// ── Load ─────────────────────────────────────────────────────────────────────

/**
 * Which model actually labelled this repo.
 *
 * TN-J31: corpus #1 was labelled by TWO models and nothing recorded it — n-dx pinned
 * claude-sonnet-4-6 via .n-dx.json while AsterMind-CE had no config and silently took
 * NEWEST_MODELS.claude. It went undetected for 19 days because the corpus artifact had
 * nowhere to put the answer. It does now.
 *
 * The unpinned default is read out of config.ts rather than hard-coded here, so this
 * does not quietly drift the day someone bumps the constant.
 */
function teacherOf(abs) {
  const cfg = join(abs, ".n-dx.json");
  if (existsSync(cfg)) {
    try {
      const model = JSON.parse(readFileSync(cfg, "utf-8"))?.llm?.claude?.model;
      if (model) return { model, pinned: true, via: "<repo>/.n-dx.json → llm.claude.model" };
    } catch { /* fall through to the default path below */ }
  }
  const constants = "packages/llm-client/src/config.ts";
  try {
    const src = readFileSync(constants, "utf-8");
    const m = src.match(/NEWEST_MODELS[^{]*\{[^}]*?claude:\s*"([^"]+)"/s);
    if (m) return { model: m[1], pinned: false, via: `unpinned — default from ${constants} NEWEST_MODELS.claude` };
  } catch { /* not run from the monorepo root */ }
  return { model: null, pinned: false, via: "unpinned and UNRESOLVED — run from the monorepo root to resolve" };
}

function loadRepo(repoPath, sources) {
  const abs = resolve(repoPath);
  const file = join(abs, ".sourcevision", "classifications.json");
  if (!existsSync(file)) {
    throw new Error(
      `No classifications at ${file}\n` +
      `  Run: sourcevision analyze ${repoPath} --full` +
      (sources.includes("llm") ? "   (omit --fast so LLM enrichment runs)" : " --fast"),
    );
  }
  const data = JSON.parse(readFileSync(file, "utf-8"));
  const rows = [];
  for (const fc of data.files) {
    if (!fc.archetype) continue;
    if (!sources.includes(fc.source)) continue;
    rows.push({
      text: fc.path,
      label: fc.archetype,
      confidence: fc.confidence,
      source: fc.source,
      repo: basename(abs),
    });
  }
  return {
    repo: basename(abs),
    path: abs,
    git: gitInfo(abs),
    teacher: teacherOf(abs),
    totalFiles: data.summary.totalClassified + data.summary.totalUnclassified,
    classified: data.summary.totalClassified,
    unclassified: data.summary.totalUnclassified,
    bySource: data.summary.bySource,
    harvested: rows.length,
    rows,
  };
}

// ── Stratified split ─────────────────────────────────────────────────────────
// Stratified so rare classes appear in BOTH splits. A random split over a
// distribution this skewed can leave a class entirely absent from held-out,
// which silently removes it from the accuracy number.

function stratifiedSplit(rows, holdout, rand) {
  const byLabel = new Map();
  for (const r of rows) {
    if (!byLabel.has(r.label)) byLabel.set(r.label, []);
    byLabel.get(r.label).push(r);
  }
  const train = [];
  const held = [];
  for (const [, group] of [...byLabel.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const shuffled = seededShuffle(group, rand);
    // At least one row stays in train for any class that has rows at all.
    const nHeld = Math.min(shuffled.length - 1, Math.round(shuffled.length * holdout));
    held.push(...shuffled.slice(0, Math.max(0, nHeld)));
    train.push(...shuffled.slice(Math.max(0, nHeld)));
  }
  return { train, held };
}

function distribution(rows) {
  const d = {};
  for (const r of rows) d[r.label] = (d[r.label] ?? 0) + 1;
  return Object.fromEntries(Object.entries(d).sort((a, b) => b[1] - a[1]));
}

/**
 * Roll the per-repo teachers up into a row-weighted mix, so "which model labelled this
 * corpus" is answerable from the artifact alone rather than from a laptop's directory tree.
 */
function teacherMix(loaded) {
  const byModel = {};
  let total = 0;
  for (const l of loaded) {
    const key = l.teacher.model ?? "(unresolved)";
    byModel[key] = (byModel[key] ?? 0) + l.harvested;
    total += l.harvested;
  }
  const share = Object.fromEntries(
    Object.entries(byModel)
      .sort((a, b) => b[1] - a[1])
      .map(([m, n]) => [m, { rows: n, share: total ? n / total : 0 }]),
  );
  return { distinct: Object.keys(byModel).length, mixed: Object.keys(byModel).length > 1, byModel: share };
}

/** Majority-class rate — the honest baseline for an imbalanced corpus. */
function majorityBaseline(rows) {
  const d = distribution(rows);
  const counts = Object.values(d);
  if (counts.length === 0) return { label: null, rate: 0 };
  const top = Math.max(...counts);
  return { label: Object.keys(d)[0], rate: top / rows.length };
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const { repos, opts } = parseArgs(process.argv.slice(2));

  console.log("ELM archetype corpus builder");
  console.log(`  sources : ${opts.sources.join(", ")}`);
  console.log(`  seed    : ${opts.seed}   holdout: ${opts.holdout}`);
  console.log("");

  const loaded = repos.map((r) => loadRepo(r, opts.sources));

  for (const l of loaded) {
    const pct = l.totalFiles ? ((l.unclassified / l.totalFiles) * 100).toFixed(1) : "0.0";
    console.log(`  ${l.repo}`);
    console.log(`    ${l.totalFiles} source files | ${l.classified} classified | ${l.unclassified} unclassified (${pct}%)`);
    console.log(`    bySource: ${JSON.stringify(l.bySource)}`);
    console.log(`    harvested ${l.harvested} rows matching [${opts.sources.join(",")}]`);
    console.log(`    teacher  ${l.teacher.model ?? "UNRESOLVED"}  (${l.teacher.via})`);
    if (l.git.dirty) console.log("    WARNING: working tree is dirty — provenance commit is approximate");
    console.log("");
  }

  // TN-J31 went undetected for 19 days because nothing said this out loud at build time.
  const mix = teacherMix(loaded);
  if (mix.mixed) {
    console.log("  WARNING: MIXED TEACHERS — this corpus was labelled by more than one model.");
    for (const [model, { rows, share }] of Object.entries(mix.byModel)) {
      console.log(`    ${model.padEnd(24)} ${String(rows).padStart(4)} rows  (${(share * 100).toFixed(1)}%)`);
    }
    console.log("    Not necessarily wrong, but every 'LLM vs truth' figure from this corpus");
    console.log("    must name its teacher. Pin llm.claude.model per repo to avoid the mix.");
    console.log("");
  }

  const rows = loaded.flatMap((l) => l.rows);

  if (rows.length === 0) {
    console.error(`FAILED: no rows matched sources [${opts.sources.join(",")}].`);
    if (opts.sources.includes("llm")) {
      console.error("");
      console.error("  No `llm`-sourced labels exist in these repos. That means analyze ran with");
      console.error("  --fast (which skips LLM enrichment), or the LLM was unreachable.");
      console.error("  Re-run analyze WITHOUT --fast against a working provider, then retry.");
    }
    process.exit(1);
  }

  const dist = distribution(rows);
  const baseline = majorityBaseline(rows);

  console.log(`  TOTAL ${rows.length} rows across ${Object.keys(dist).length} classes`);
  console.log("");
  for (const [label, n] of Object.entries(dist)) {
    const flag = n < opts.minClass ? `  << thin (<${opts.minClass})` : "";
    console.log(`    ${label.padEnd(16)} ${String(n).padStart(4)}${flag}`);
  }
  console.log("");
  console.log(`  Majority-class baseline: ${(baseline.rate * 100).toFixed(1)}% ("${baseline.label}")`);
  console.log("  Report model accuracy against THIS number, not uniform random.");
  console.log("");

  const thin = Object.entries(dist).filter(([, n]) => n < opts.minClass).map(([l]) => l);
  if (thin.length > 0) {
    console.log(`  WARNING: ${thin.length} class(es) below ${opts.minClass} rows: ${thin.join(", ")}`);
    console.log("  These cannot be learned reliably. Add repos that exercise them.");
    console.log("");
  }

  const rand = mulberry32(opts.seed);
  const { train, held } = stratifiedSplit(rows, opts.holdout, rand);
  console.log(`  split: ${train.length} train / ${held.length} held-out (stratified, seed ${opts.seed})`);

  if (opts.dryRun) {
    console.log("\n--dry-run: nothing written.");
    return;
  }

  const corpus = {
    schema: "elm-archetype-corpus/v1",
    generatedAt: new Date().toISOString(),
    generatedBy: "scripts/elm-corpus-build.mjs",
    provenance: {
      sources: opts.sources,
      seed: opts.seed,
      holdout: opts.holdout,
      repos: loaded.map(({ repo, path, git, teacher, totalFiles, classified, unclassified, harvested }) => ({
        repo, path, git, teacher, totalFiles, classified, unclassified, harvested,
      })),
      teachers: teacherMix(loaded),
    },
    stats: {
      total: rows.length,
      classes: Object.keys(dist).length,
      distribution: dist,
      majorityBaseline: baseline,
      thinClasses: thin,
    },
    train,
    heldOut: held,
  };

  const outPath = resolve(opts.out);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(corpus, null, 2)}\n`);
  console.log(`\n  wrote ${outPath}`);
}

try {
  main();
} catch (err) {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
}
