/**
 * Structural feature derivation — the single code path.
 *
 * Implements the `raw` and `features` layers of
 * Claude-Context/ADR/ADR-2026-09-17-nutella-elm-training-database-construction.md
 *
 * This is a MODULE, not a CLI. The dataset builder, the normaliser sweep and the
 * coverage harness all derive features through here. Three implementations of
 * "in-degree percentile" is how two numbers silently diverge, and this project has
 * already paid that bill on the majority-class baseline.
 *
 * ── What is fed, and what is deliberately withheld ──────────────────────────
 * Withheld, each for a MEASURED reason (scripts/elm-feature-survey.mjs reproduces all four):
 *   category          repo-specific by construction (n-dx: rex/hench/sourcevision)
 *   zone              absent for 7 of 9 repos surveyed, repo-specific where present
 *   role              constant "source" on 536 of 536 harvested rows - a dead dimension
 *   language          91.6% one value; all 11 Vue rows are one repo AND all labelled
 *                     `component` - a repo fingerprint that is also a perfect in-sample
 *                     label predictor, i.e. leakage
 *   depthFromRoot     encodes monorepo layout, not archetype
 *   raw degrees       mean in-degree spans 0.59 to 6.04 across repos - a 10.2x spread
 *   raw edge types    express is 100% `require`, n-dx 0% - that axis is CommonJS vs ESM
 *   package one-hot   305 of 341 packages appear in exactly ONE repo
 *
 * ── The zero/missing distinction ────────────────────────────────────────────
 * A real inDegree of 0 (nothing imports this file) and an unmeasured one are
 * different facts and must never collapse into the same value. Everything here
 * returns null for "not measured" and never fabricates a 0. This is the defect
 * class that produced a fabricated omission count in elm-corpus-build.mjs.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Curated package -> family map.
 *
 * DELIBERATELY SMALL. Finding 2 of the ADR: 305 of 341 external packages appear in
 * exactly one repo, so an open-ended package vocabulary is path tokens wearing a
 * different hat. Only the 11 packages measured to appear in >=3 of 9 repos are
 * mapped. Growing this map carelessly recreates the trap it exists to avoid;
 * additions are a reviewed edit, not a convenience.
 */
export const PKG_FAMILIES = {
  fs: "node-builtin", os: "node-builtin", path: "node-builtin", url: "node-builtin",
  react: "ui-view", "react-dom": "ui-view",
  zod: "schema",
  vitest: "test",
  vite: "build-tool", esbuild: "build-tool",
  typescript: "tooling",
};

export const NORMALISERS = ["percentile", "log1p", "pooled"];

const readJson = (dir, name) => {
  const f = join(dir, ".sourcevision", name);
  if (!existsSync(f)) return null;
  try { return JSON.parse(readFileSync(f, "utf-8")); } catch { return null; }
};

/**
 * Collect per-file RAW measurements for one repo. No normalisation happens here —
 * normalisation needs a population, and which population depends on the normaliser
 * (per-repo for percentile, global for pooled). Keeping them separate is what lets
 * Phase 3 sweep normalisers without re-reading a single artifact.
 */
export function collectRaw(repoDir) {
  const inventory = readJson(repoDir, "inventory.json");
  const imports = readJson(repoDir, "imports.json");
  if (!inventory?.files) return null;

  const rows = new Map();
  const touch = (p) => {
    let e = rows.get(p);
    if (!e) rows.set(p, (e = { path: p }));
    return e;
  };

  for (const f of inventory.files) {
    const e = touch(f.path);
    e.role = f.role ?? null;
    e.language = f.language ?? null;
    e.loc = f.lineCount ?? null;
    e.size = f.size ?? null;
  }

  const haveGraph = Boolean(imports?.edges);
  if (haveGraph) {
    // Every inventoried file gets an explicit 0 — the graph WAS measured, so a file
    // with no edges genuinely has in-degree 0. Files absent from inventory are not
    // invented here.
    for (const e of rows.values()) {
      e.inDegree = 0; e.outDegree = 0;
      e.edgeTypes = {};
      e.isolated = true;
    }
    for (const edge of imports.edges) {
      const t = edge.type ?? "unknown";
      if (edge.from != null && rows.has(edge.from)) {
        const e = rows.get(edge.from);
        e.outDegree++; e.isolated = false;
        e.edgeTypes[t] = (e.edgeTypes[t] ?? 0) + 1;
      }
      if (edge.to != null && rows.has(edge.to)) {
        const e = rows.get(edge.to);
        e.inDegree++; e.isolated = false;
      }
    }
    // Cycle membership, from the summary the analyzer already computed.
    for (const c of imports.summary?.circulars ?? []) {
      for (const p of c.cycle ?? []) if (rows.has(p)) rows.get(p).inCycle = true;
    }
    for (const e of rows.values()) if (e.inCycle === undefined) e.inCycle = false;

    // External deps are an INVERTED index (package -> importedBy), so per-file
    // packages have to be derived by inverting it.
    for (const e of rows.values()) e.externalPackages = [];
    for (const x of imports.external ?? []) {
      for (const f of x.importedBy ?? []) if (rows.has(f)) rows.get(f).externalPackages.push(x.package);
    }
  } else {
    // Graph absent: leave every graph field null. NOT zero.
    for (const e of rows.values()) {
      e.inDegree = null; e.outDegree = null; e.edgeTypes = null;
      e.isolated = null; e.inCycle = null; e.externalPackages = null;
    }
  }

  return {
    rows,
    available: { inventory: true, imports: haveGraph },
  };
}

/** Rank of `v` within a sorted ascending array, as a midrank in [0,1]. */
function midrank(sortedAsc, v) {
  if (sortedAsc.length === 0) return null;
  let below = 0, ties = 0;
  for (const x of sortedAsc) { if (x < v) below++; else if (x === v) ties++; }
  return (below + ties / 2) / sortedAsc.length;
}

/**
 * Build the normalisation statistics a given normaliser needs.
 *
 * `percentile` -> per-repo sorted distributions.
 * `pooled`     -> one sorted distribution across ALL repos, so a fresh repo (or a
 *                 single file at runtime) is scored against a fixed yardstick.
 * `log1p`      -> no statistics at all; it is a property of the file alone.
 *
 * Recorded in the manifest so a consumer can reproduce or replace them.
 */
export function buildStats(byRepo, normaliser) {
  if (normaliser === "log1p") return { normaliser, perRepo: null, pooled: null };
  const FIELDS = ["inDegree", "outDegree", "loc", "size"];
  /**
   * ⚠️ Distributions are built over `role: "source"` files ONLY.
   *
   * This is not a detail. Classification only ever sees source files, so a
   * percentile computed over the whole inventory ranks a file against a population
   * the model never classifies — and the test/source ratio is itself wildly
   * repo-dependent (n-dx 825/683, Vue core 206/303, fastify 226/52). Including
   * tests therefore launders repo composition straight back into the feature, which
   * is the exact failure this normalisation exists to prevent.
   *
   * Caught by the Phase 1 assertion that the ADR's measured "inDegree 1 is the
   * 12.5th percentile in n-dx" must reproduce: over the full inventory it came out
   * at 58.5th, because 825 test files sit at in-degree 0.
   */
  const collect = (rowsIter) => {
    const out = {};
    for (const f of FIELDS) out[f] = [];
    for (const r of rowsIter) {
      if (r.role !== "source") continue;
      for (const f of FIELDS) if (typeof r[f] === "number") out[f].push(r[f]);
    }
    for (const f of FIELDS) out[f].sort((a, b) => a - b);
    return out;
  };
  if (normaliser === "pooled") {
    const all = [];
    for (const raw of byRepo.values()) all.push(...raw.rows.values());
    return { normaliser, perRepo: null, pooled: collect(all) };
  }
  const perRepo = {};
  for (const [repo, raw] of byRepo) perRepo[repo] = collect(raw.rows.values());
  return { normaliser, perRepo, pooled: null };
}

/**
 * Derive the model-facing feature vector for one raw row.
 *
 * Returns { vector, names, meta }. `vector` is fixed-length and ordered — COLUMN
 * ORDER IS PART OF THE CONTRACT, because a silently reordered matrix is a bug
 * nobody sees.
 *
 * Missing measurements contribute 0.0 to the vector but set an explicit
 * `<field>Missing` indicator column, so the model can distinguish "no imports" from
 * "no import graph". That is the whole zero-vs-missing discipline, expressed in the
 * feature space rather than only in the JSON.
 */
export function deriveFeatures(row, repo, stats) {
  const v = [];
  const names = [];
  const push = (name, val) => { names.push(name); v.push(val); };

  const dist = (field) => {
    if (stats.normaliser === "pooled") return stats.pooled?.[field] ?? null;
    return stats.perRepo?.[repo]?.[field] ?? null;
  };

  for (const field of ["inDegree", "outDegree", "loc", "size"]) {
    const raw = row[field];
    const measured = typeof raw === "number";
    let val = 0;
    if (measured) {
      if (stats.normaliser === "log1p") {
        // Compressed but unbounded; divided by a fixed constant so the block stays
        // comparable in scale to the [0,1] normalisers. ln(1+249) ~ 5.52.
        val = Math.log1p(raw) / 6;
      } else {
        const d = dist(field);
        val = d ? (midrank(d, raw) ?? 0) : 0;
      }
    }
    push(`${field}Norm`, val);
    push(`${field}Missing`, measured ? 0 : 1);
  }

  // Edge-type ratios. `static` and `require` are COLLAPSED deliberately: express is
  // 100% require and n-dx 0%, so keeping them apart encodes CommonJS vs ESM rather
  // than anything about the file.
  const et = row.edgeTypes;
  const outTotal = et ? Object.values(et).reduce((s, n) => s + n, 0) : 0;
  const share = (keys) => {
    if (!et || outTotal === 0) return 0;
    return keys.reduce((s, k) => s + (et[k] ?? 0), 0) / outTotal;
  };
  push("valueImportRatio", share(["static", "require"]));
  push("typeImportRatio", share(["type"]));
  push("reexportRatio", share(["reexport"]));
  push("dynamicImportRatio", share(["dynamic"]));
  push("edgeTypesMissing", et ? 0 : 1);

  push("isolated", row.isolated === true ? 1 : 0);
  push("isolatedMissing", row.isolated === null || row.isolated === undefined ? 1 : 0);
  push("inCycle", row.inCycle === true ? 1 : 0);

  // pkgFamily: one column per family, closed vocabulary. An unmapped package
  // contributes nothing rather than creating a family.
  const fams = [...new Set(Object.values(PKG_FAMILIES))].sort();
  const present = new Set((row.externalPackages ?? []).map((p) => PKG_FAMILIES[p]).filter(Boolean));
  for (const f of fams) push(`pkg_${f}`, present.has(f) ? 1 : 0);

  return { vector: v, names };
}

/** Column names for the current feature contract, without needing a row. */
export function featureNames() {
  const probe = { inDegree: 0, outDegree: 0, loc: 0, size: 0, edgeTypes: {}, isolated: false, inCycle: false, externalPackages: [] };
  return deriveFeatures(probe, "_", { normaliser: "log1p", perRepo: null, pooled: null }).names;
}
