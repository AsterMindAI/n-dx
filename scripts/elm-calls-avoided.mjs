#!/usr/bin/env node
/**
 * Calls-avoided instrument — Path B's primary metric.
 *
 * Implements Lane B (B1/B2) of
 * Claude-Context/IMPL/IMPL-2026-08-23-butter-token-measurement-and-path-a-b-seam.md
 * under ADR-2026-08-23-butter-savings-measurement-contract.md, which makes
 * **the avoided LLM invocation the unit of account**.
 *
 * Reports LLM classify batches per analyze, and how many an ELM tier would
 * avoid at a given hit rate. Reads `.sourcevision/classifications.json` only —
 * no analyze run, no LLM, no tokens.
 *
 * Usage:
 *   node scripts/elm-calls-avoided.mjs <repo-path> [<repo-path>...] [--out=<path>]
 *
 * ── Why calls and not tokens ──────────────────────────────────────────────
 * Per-spawn overhead dominates prompt size by ~3 orders of magnitude. A savings
 * figure built from prompt tokens understates by ~99.97%. So Path B publishes
 * calls — a count, not an estimate — and Path A converts to tokens from
 * measured per-call cost. This script deliberately emits NO token or dollar
 * figure.
 *
 * The conversion is Path A's, published in
 * Claude-Context/Nolan-Agents/Notes/NOTE-nolan-internal-2026-08-23-tn-j3-root-caused-and-fixed.md § 3:
 * **22k–46k tokens of fixed overhead per invocation**, measured three times on
 * the same trivial 2-in/4-out prompt. It moves with cache state and varies by
 * better than 2x, so it is a RANGE and must never be quoted as a constant or
 * multiplied out here. Cite that note; do not derive a number from it.
 *
 * (An earlier revision of this header quoted a single observation — 7,318 +
 * 14,792 — as if it were the per-call cost. It is the low end of the range.)
 *
 * ── ⚠ What this number is the denominator OF ──────────────────────────────
 * These are CLASSIFY calls, not all the LLM calls an analyze makes. A non-fast
 * analyze also runs zone enrichment, gated by the same !fastMode flag
 * (analyze-phases.ts:219 classify, :277 enrichment) but calling separate sites
 * (enrich-batch.ts:70,217 and enrich-per-zone.ts:159). Those generate prose and
 * are NOT ELM-replaceable — they are in the "20 of 22 call sites stay hosted"
 * bucket from the survey ADR.
 *
 * The one instrumented full analyze we have (Butter, TN-J3, AsterMind-CE)
 * recorded **9 total calls**. What is and is not established about that 9:
 *
 *   MEASURED   9 total LLM calls; 69 files LLM-labelled; 11 zones; enrichmentPass 4.
 *   DERIVED    classify made AT LEAST ceil(69/30) = 3 calls — more if any batch
 *              retried, and nothing records whether one did.
 *   NOT KNOWN  the exact classify/enrichment split. `manifest.tokenUsage` is a
 *              single aggregate with NO per-phase breakdown, so the 9 cannot be
 *              decomposed from any artifact. An earlier revision of this header
 *              asserted "3 classify + 6 enrichment / 33%" as measured. It is
 *              consistent with the code, but it was inference, not measurement.
 *
 * What survives and is the point: **classify is a STRICT SUBSET of a full
 * analyze's LLM calls.** "9 calls" is not "9 classify calls". So Path B's
 * ceiling is a minority of analyze invocations — stronger per call, on a smaller
 * share of calls — even though the exact percentage is unproven.
 *
 * Why the split cannot simply be computed: enrichment calls are
 * sum over passes of ceil(|changed non-structural zones| / ZONES_PER_BATCH=7),
 * and TWO data-dependent reducers shrink that set — the structural-zone bypass
 * (zones of only build/asset/doc/config files are templated with ZERO LLM
 * calls; enrich.ts:133) and per-zone content-hash filtering (passes 2+ enrich
 * only zones whose content changed; enrich.ts:152). Neither is predictable from
 * zone count, so n-dx's denominator cannot be derived statically — it needs
 * either a paid full analyze or per-phase call attribution in the manifest.
 *
 * n-dx's total is UNMEASURED (manifest tokenUsage is null; every run here has
 * been --fast). n-dx has 26 zones to AsterMind-CE's 11, so its enrichment share
 * is plausibly larger and classify's share correspondingly smaller — but that
 * is an expectation, not a measurement, and must not be quoted as one.
 *
 * ── The lumpiness this exists to make visible ─────────────────────────────
 * Batches are ceil(files / LLM_BATCH_SIZE). Reclassifying files saves a call
 * only when it crosses a multiple of the batch size. Step 1 (the gateway fix)
 * reclassified 4 files on n-dx and avoided ZERO calls: 259 -> 255 files is
 * 9 -> 9 batches. Progress in files is not progress in calls.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve, basename, dirname } from "node:path";
import { execFileSync } from "node:child_process";

/** Must track LLM_BATCH_SIZE in packages/sourcevision/src/analyzers/classify.ts:322. */
const LLM_BATCH_SIZE = 30;

/** classifyBatchWithLLM retries with progressively simpler prompts (classify.ts:392-397). */
const MAX_ATTEMPTS_PER_BATCH = 3;

/** Hit rates to model. The ELM tier does not exist yet; these are labelled projections. */
const HIT_RATES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

const batches = (files) => Math.ceil(files / LLM_BATCH_SIZE);

function gitInfo(repoPath) {
  const run = (args) => {
    try {
      return execFileSync("git", ["-C", repoPath, ...args], {
        encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch { return null; }
  };
  return { commit: run(["rev-parse", "HEAD"]), remote: run(["config", "--get", "remote.origin.url"]) };
}

function loadRepo(repoPath) {
  const abs = resolve(repoPath);
  const file = join(abs, ".sourcevision", "classifications.json");
  if (!existsSync(file)) {
    throw new Error(`No classifications at ${file}\n  Run: sourcevision analyze ${repoPath} --full`);
  }
  const d = JSON.parse(readFileSync(file, "utf-8"));
  const s = d.summary;
  const bySource = s.bySource ?? {};

  // Files that reached the LLM = rows the LLM labelled, plus any still unlabelled.
  // Both are counted because both were sent; unclassified means the LLM was asked and declined.
  const reachedLLM = (bySource.llm ?? 0) + s.totalUnclassified;

  return {
    repo: basename(abs),
    path: abs,
    git: gitInfo(abs),
    totalFiles: s.totalClassified + s.totalUnclassified,
    byRules: bySource.algorithmic ?? 0,
    byLLM: bySource.llm ?? 0,
    stillUnclassified: s.totalUnclassified,
    reachedLLM,
    batches: batches(reachedLLM),
    worstCaseCalls: batches(reachedLLM) * MAX_ATTEMPTS_PER_BATCH,
  };
}

/** Smallest hit rate that avoids at least one call — the lumpiness threshold. */
function firstUsefulHitRate(reachedLLM) {
  const base = batches(reachedLLM);
  for (let handled = 1; handled <= reachedLLM; handled++) {
    if (batches(reachedLLM - handled) < base) {
      return { filesNeeded: handled, rate: handled / reachedLLM };
    }
  }
  return null;
}

function main() {
  const args = process.argv.slice(2);
  const repos = args.filter((a) => !a.startsWith("--"));
  const outArg = args.find((a) => a.startsWith("--out="));
  const out = outArg ? outArg.slice(6) : "scripts/data/elm-calls-avoided.json";
  if (repos.length === 0) throw new Error("Usage: node scripts/elm-calls-avoided.mjs <repo-path>...");

  const loaded = repos.map(loadRepo);

  console.log("Calls-avoided instrument — Path B primary metric");
  console.log(`  batch size ${LLM_BATCH_SIZE} · up to ${MAX_ATTEMPTS_PER_BATCH} attempts per batch`);
  console.log("  MEASURED: current call cost. PROJECTED: what an ELM tier would avoid.");
  console.log("  ⚠ CLASSIFY calls only — a full analyze also makes zone-enrichment calls");
  console.log("    that are prose and NOT ELM-replaceable. Only instrumented full analyze:");
  console.log("    AsterMind-CE = 9 total calls; classify was >=3 of them. The exact");
  console.log("    split is NOT recorded anywhere. n-dx total is unmeasured.");
  console.log("  No token or dollar figure is emitted — that conversion is Path A's.");
  console.log("  Per-call cost is a range (22k-46k tokens, cache-dependent): see Butter's TN-J3 note S3.\n");

  for (const r of loaded) {
    console.log(`  ${r.repo}  (${r.totalFiles} source files)`);
    console.log(`    rules classified      ${r.byRules}`);
    console.log(`    reached the LLM       ${r.reachedLLM}`);
    console.log(`    MEASURED classify calls  ${r.batches} batches  (worst case ${r.worstCaseCalls} with retries)`);
    const t = firstUsefulHitRate(r.reachedLLM);
    if (t) {
      console.log(`    lumpiness threshold   ${t.filesNeeded} file(s) = ${(t.rate * 100).toFixed(1)}% hit rate before the FIRST call is avoided`);
    }
    console.log("");
  }

  const totalBatches = loaded.reduce((n, r) => n + r.batches, 0);
  const totalReached = loaded.reduce((n, r) => n + r.reachedLLM, 0);

  console.log(`  TOTAL across ${loaded.length} repo(s): ${totalBatches} classify batches/analyze, ${totalReached} files reaching the LLM\n`);
  console.log("  PROJECTED classify calls avoided per analyze, by ELM hit rate (projection, tier not built):");
  console.log("    rate   " + loaded.map((r) => r.repo.slice(0, 12).padStart(13)).join("") + "        total");

  const projection = [];
  for (const rate of HIT_RATES) {
    const per = loaded.map((r) => r.batches - batches(Math.ceil(r.reachedLLM * (1 - rate))));
    const tot = per.reduce((a, b) => a + b, 0);
    projection.push({ hitRate: rate, perRepo: Object.fromEntries(loaded.map((r, i) => [r.repo, per[i]])), total: tot });
    console.log(`    ${String(Math.round(rate * 100)).padStart(3)}%   ` + per.map((n) => String(n).padStart(13)).join("") + String(tot).padStart(13));
  }

  const corpus = {
    schema: "elm-calls-avoided/v1",
    generatedAt: new Date().toISOString(),
    generatedBy: "scripts/elm-calls-avoided.mjs",
    method: {
      unitOfAccount: "avoided LLM classify invocation",
      adr: "ADR-2026-08-23-butter-savings-measurement-contract.md",
      batchSize: LLM_BATCH_SIZE,
      maxAttemptsPerBatch: MAX_ATTEMPTS_PER_BATCH,
      command: "node scripts/elm-calls-avoided.mjs <repos...>",
      emitsTokenFigures: false,
      note: "Token/dollar conversion is Path A's (TN-J3/TN-B1). This file deliberately contains no token figure. Per-call overhead is a RANGE (22k-46k tokens, cache-state dependent) — see NOTE-nolan-internal-2026-08-23-tn-j3-root-caused-and-fixed.md section 3. Cite it; do not multiply it out.",
    },
    measured: {
      repos: loaded,
      totalBatchesPerAnalyze: totalBatches,
      totalFilesReachingLLM: totalReached,
    },
    projected: {
      caveat: "The ELM tier does not exist (TN-J4 Step 3 paused on TN-J10). These are projections, not results.",
      byHitRate: projection,
    },
    knownResults: {
      step1GatewayFix: {
        commit: "26a191e7",
        filesReclassified: 4,
        batchesBefore: 9,
        batchesAfter: 9,
        callsAvoided: 0,
        note: "259 -> 255 files did not cross a 30-file boundary. Real fix, zero call saving.",
      },
    },
  };

  const outPath = resolve(out);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(corpus, null, 2)}\n`);
  console.log(`\n  wrote ${outPath}`);
}

try { main(); } catch (err) {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
}
