#!/usr/bin/env node
/**
 * Structural feature survey — the committed evidence behind
 * Claude-Context/ADR/ADR-2026-09-17-nutella-elm-training-database-construction.md
 *
 * That ADR decides which of sourcevision's structural measurements may be fed to an
 * ELM and which must be withheld. Those decisions rest on four cross-repo findings.
 * This script is how anyone re-checks them without taking my word for it.
 *
 * READ-ONLY. Reads committed `.sourcevision/` artifacts only. Spends no LLM calls,
 * writes nothing into any analyzed repo, and needs no dependencies.
 *
 * Usage:
 *   node scripts/elm-feature-survey.mjs                 # default repo set
 *   node scripts/elm-feature-survey.mjs <repo>...       # explicit paths
 *   node scripts/elm-feature-survey.mjs --json          # machine-readable
 *
 * There is no seed and no sampling here: every number is a deterministic count over
 * committed files, so two runs on the same inputs are byte-identical by construction.
 *
 * ⚠️ Repos analyzed with `--fast` have no LLM rows but DO have inventory/imports, so
 * they still contribute structural rows here. That is intentional — the structural
 * findings are about the graph, not about labels.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve, basename } from "node:path";

const STAGING = "/Users/nolanmoore/Work/n-dx-elm-corpus";
const DEFAULT_REPOS = [
  ".",
  ...["core", "fastify", "express", "got", "commerce",
      "AsterMind-Community-Edition", "hono", "trpc"].map((r) => join(STAGING, r)),
];

/** Packages counted as transferable only if they appear in at least this many repos. */
const TRANSFER_MIN_REPOS = 3;

function loadArtifacts(repoPath) {
  const abs = resolve(repoPath);
  const dir = join(abs, ".sourcevision");
  const read = (name) => {
    const f = join(dir, name);
    if (!existsSync(f)) return null;
    try { return JSON.parse(readFileSync(f, "utf-8")); } catch { return null; }
  };
  const inventory = read("inventory.json");
  if (!inventory?.files) return null;
  return {
    repo: basename(abs) || abs,
    inventory,
    imports: read("imports.json"),
    zones: read("zones.json"),
  };
}

function percentile(sortedAsc, q) {
  if (sortedAsc.length === 0) return 0;
  return sortedAsc[Math.min(sortedAsc.length - 1, Math.floor(sortedAsc.length * q))];
}

function surveyRepo(a) {
  const sourceFiles = a.inventory.files.filter((f) => f.role === "source").map((f) => f.path);
  const source = new Set(sourceFiles);

  const roles = {};
  for (const f of a.inventory.files) roles[f.role ?? "(none)"] = (roles[f.role ?? "(none)"] ?? 0) + 1;

  const categories = new Set(a.inventory.files.map((f) => f.category).filter(Boolean));

  const edges = a.imports?.edges ?? [];
  const inDeg = new Map();
  const outDeg = new Map();
  const edgeTypes = {};
  const touched = new Set();
  for (const e of edges) {
    edgeTypes[e.type ?? "(none)"] = (edgeTypes[e.type ?? "(none)"] ?? 0) + 1;
    if (e.from != null) { outDeg.set(e.from, (outDeg.get(e.from) ?? 0) + 1); touched.add(e.from); }
    if (e.to != null) { inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1); touched.add(e.to); }
  }

  // Degrees are measured over SOURCE files only — the population that is ever classified.
  const inVals = sourceFiles.map((p) => inDeg.get(p) ?? 0).sort((x, y) => x - y);
  const meanIn = inVals.length ? inVals.reduce((s, v) => s + v, 0) / inVals.length : 0;

  const isolated = sourceFiles.filter((p) => !touched.has(p)).length;

  // External deps are stored as an INVERTED index (package -> importedBy), so per-file
  // external imports have to be derived by inverting it.
  const external = a.imports?.external ?? [];
  const packages = new Set(external.map((x) => x.package));
  const filesWithExternal = new Set();
  for (const x of external) {
    for (const f of x.importedBy ?? []) if (source.has(f)) filesWithExternal.add(f);
  }

  const edgeTotal = edges.length || 1;
  return {
    repo: a.repo,
    inventoryTotal: a.inventory.files.length,
    roles,
    sourceFiles: sourceFiles.length,
    distinctCategories: categories.size,
    sampleCategories: [...categories].slice(0, 4),
    edges: edges.length,
    edgeTypes,
    requireShare: (edgeTypes.require ?? 0) / edgeTotal,
    meanInDegree: meanIn,
    p90InDegree: percentile(inVals, 0.9),
    maxInDegree: inVals.length ? inVals[inVals.length - 1] : 0,
    isolatedSource: isolated,
    isolatedShare: isolated / Math.max(sourceFiles.length, 1),
    externalPackages: packages.size,
    sourceWithExternal: filesWithExternal.size,
    externalShare: filesWithExternal.size / Math.max(sourceFiles.length, 1),
    hasZones: Boolean(a.zones?.zones),
    edgesCarryingSymbols: edges.filter((e) => (e.symbols ?? []).length > 0).length,
    packages,
  };
}

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes("--json");
  const paths = argv.filter((x) => !x.startsWith("--"));
  const repos = paths.length ? paths : DEFAULT_REPOS;

  const surveys = [];
  const missing = [];
  for (const p of repos) {
    const a = loadArtifacts(p);
    if (!a) { missing.push(p); continue; }
    surveys.push(surveyRepo(a));
  }
  if (surveys.length === 0) {
    console.error("No analyzed repos found. Run `sourcevision analyze <repo> --full` first.");
    process.exit(1);
  }

  // FINDING 2 — does the external-package vocabulary transfer?
  const repoCount = new Map();
  for (const s of surveys) for (const p of s.packages) repoCount.set(p, (repoCount.get(p) ?? 0) + 1);
  const singleRepo = [...repoCount.values()].filter((c) => c === 1).length;
  const transferable = [...repoCount.entries()]
    .filter(([, c]) => c >= TRANSFER_MIN_REPOS).map(([p]) => p).sort();

  const withZones = surveys.filter((s) => s.hasZones).length;
  const means = surveys.map((s) => s.meanInDegree);
  const spread = Math.max(...means) / Math.max(Math.min(...means), 1e-9);

  if (asJson) {
    console.log(JSON.stringify({
      generatedBy: "scripts/elm-feature-survey.mjs",
      repos: surveys.map(({ packages, ...rest }) => rest),
      findings: {
        degreeSpread: spread,
        externalPackagesTotal: repoCount.size,
        externalPackagesSingleRepo: singleRepo,
        externalPackagesTransferable: transferable,
        transferMinRepos: TRANSFER_MIN_REPOS,
        reposWithZones: withZones,
        reposSurveyed: surveys.length,
      },
      missing,
    }, null, 2));
    return;
  }

  console.log("Structural feature survey — evidence for ADR-2026-09-17-nutella-elm-training-database-construction\n");
  if (missing.length) console.log(`  (skipped, not analyzed: ${missing.join(", ")})\n`);

  console.log("FINDING 1 — degree scale is NOT comparable across repos");
  console.log(`${"repo".padEnd(28)}${"source".padStart(7)}${"edges".padStart(7)}${"meanIn".padStart(8)}${"p90".padStart(5)}${"max".padStart(6)}`);
  for (const s of [...surveys].sort((a, b) => b.meanInDegree - a.meanInDegree)) {
    console.log(`${s.repo.padEnd(28)}${String(s.sourceFiles).padStart(7)}${String(s.edges).padStart(7)}` +
      `${s.meanInDegree.toFixed(2).padStart(8)}${String(s.p90InDegree).padStart(5)}${String(s.maxInDegree).padStart(6)}`);
  }
  console.log(`  -> mean in-degree spans ${Math.min(...means).toFixed(2)} to ${Math.max(...means).toFixed(2)} = ${spread.toFixed(1)}x`);
  console.log("  -> RAW DEGREES MUST NOT BE FED. Normalise within repo.\n");

  console.log("FINDING 2 — external-package identity does NOT transfer");
  console.log(`${"repo".padEnd(28)}${"pkgs".padStart(6)}${"src w/ external".padStart(17)}`);
  for (const s of surveys) {
    console.log(`${s.repo.padEnd(28)}${String(s.externalPackages).padStart(6)}` +
      `${(s.sourceWithExternal + " (" + (s.externalShare * 100).toFixed(1) + "%)").padStart(17)}`);
  }
  console.log(`  -> ${singleRepo} of ${repoCount.size} packages appear in exactly ONE repo`);
  console.log(`  -> only ${transferable.length} appear in >=${TRANSFER_MIN_REPOS} of ${surveys.length}: ${transferable.join(", ")}`);
  console.log("  -> DO NOT one-hot package names. Use a curated family map.\n");

  console.log("FINDING 3 — edge-type mix encodes the MODULE SYSTEM, not the archetype");
  for (const s of surveys) {
    const t = Object.entries(s.edgeTypes).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`).join(", ") || "(none)";
    console.log(`  ${s.repo.padEnd(28)} require ${(s.requireShare * 100).toFixed(1).padStart(5)}%   ${t}`);
  }
  console.log("  -> collapse static+require into one 'value import' ratio; keep 'type' separate.\n");

  console.log("FINDING 4 — zones are usually absent; category is repo-specific");
  console.log(`  zones.json present for ${withZones} of ${surveys.length} repos surveyed`);
  for (const s of surveys.slice(0, 3)) {
    console.log(`  ${s.repo.padEnd(28)} ${s.distinctCategories} categories e.g. ${s.sampleCategories.join(", ")}`);
  }
  console.log("  -> WITHHOLD `zone` and `category` from the model-facing layer.\n");

  console.log("COVERAGE CEILING — only role:\"source\" is ever classified");
  for (const s of surveys.slice(0, 3)) {
    const r = Object.entries(s.roles).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ");
    console.log(`  ${s.repo.padEnd(28)} ${s.inventoryTotal} entries: ${r}`);
  }
  console.log("\nISOLATED SOURCE FILES — the structural half of the vector is simply absent");
  for (const s of [...surveys].sort((a, b) => b.isolatedShare - a.isolatedShare)) {
    console.log(`  ${s.repo.padEnd(28)} ${String(s.isolatedSource).padStart(5)} (${(s.isolatedShare * 100).toFixed(1)}%)`);
  }
  console.log("  -> emit an explicit `isolated` flag; never a silent zero vector.");
}

main();
