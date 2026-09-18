#!/usr/bin/env node
/**
 * Self-test for scripts/elm-features.mjs.
 *
 * Read-only, no LLM calls, no dependencies, runs in seconds. Every assertion here
 * exists because the property it checks has already gone wrong somewhere on this
 * project, or because an ADR rests on it.
 *
 * Run: node scripts/elm-features-selftest.mjs
 *
 * ── Why the percentile assertions matter ────────────────────────────────────
 * ADR-2026-09-17 measured, independently of this module, that a file with
 * inDegree 1 sits at the 12.5th percentile in n-dx and the 72.7th in commerce.
 * Requiring this module to reproduce BOTH is what caught the bug this file was
 * written to prevent: buildStats() was computing distributions over the whole
 * inventory (1,525 entries in n-dx, 825 of them tests) rather than over the
 * `role: "source"` population that is actually classified. That gave 58.5th
 * instead of 12.5th — and because the test/source ratio is itself wildly
 * repo-dependent (n-dx 825/683, Vue core 206/303, fastify 226/52), it laundered
 * repo composition straight back into the feature, which is the exact failure the
 * normalisation exists to prevent.
 */

import { collectRaw, buildStats, deriveFeatures, featureNames, PKG_FAMILIES } from "./elm-features.mjs";

const STAGING = "/Users/nolanmoore/Work/n-dx-elm-corpus";
let failed = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failed++; };

const names = featureNames();
const IN = names.indexOf("inDegreeNorm");
const IN_MISS = names.indexOf("inDegreeMissing");
const LOG = { normaliser: "log1p", perRepo: null, pooled: null };
const row = (o = {}) => ({ inDegree: 0, outDegree: 0, loc: 1, size: 1, edgeTypes: {}, isolated: false, inCycle: false, externalPackages: [], role: "source", ...o });
const vec = (o, repo, stats) => deriveFeatures(row(o), repo, stats).vector;

console.log("elm-features self-test\n");

console.log("zero vs missing — a real 0 and an unmeasured value must never collapse");
const realZero = vec({}, "r", LOG);
const unmeasured = vec({ inDegree: null, outDegree: null, loc: null, size: null, edgeTypes: null, isolated: null, inCycle: null, externalPackages: null }, "r", LOG);
ok(realZero[IN] === 0 && realZero[IN_MISS] === 0, "real inDegree 0 -> value 0, missing-flag 0");
ok(unmeasured[IN] === 0 && unmeasured[IN_MISS] === 1, "unmeasured inDegree -> value 0, missing-flag 1");
ok(realZero.join() !== unmeasured.join(), "the two are distinguishable in the vector");

console.log("\nnormalisers");
const ndx = collectRaw(".");
const commerce = collectRaw(`${STAGING}/commerce`);
if (!ndx || !commerce) { console.error("  SKIP — staging tree unavailable; cannot run cross-repo assertions"); process.exit(failed ? 1 : 0); }

const pctNdx = buildStats(new Map([["n-dx-1", ndx]]), "percentile");
const pctCom = buildStats(new Map([["commerce", commerce]]), "percentile");
const at = (d, repo, stats) => vec({ inDegree: d }, repo, stats)[IN];
ok(at(0, "n-dx-1", pctNdx) <= at(1, "n-dx-1", pctNdx) && at(1, "n-dx-1", pctNdx) <= at(200, "n-dx-1", pctNdx), "percentile is monotone in the raw value");
ok(Math.abs(at(1, "n-dx-1", pctNdx) * 100 - 12.5) < 0.5, `n-dx inDegree=1 -> ${(at(1, "n-dx-1", pctNdx) * 100).toFixed(1)}th percentile — ADR measured 12.5`);
ok(Math.abs(at(1, "commerce", pctCom) * 100 - 72.7) < 0.5, `commerce inDegree=1 -> ${(at(1, "commerce", pctCom) * 100).toFixed(1)}th percentile — ADR measured 72.7`);
ok(at(1, "r", LOG) > at(0, "r", LOG) && at(10, "r", LOG) > at(1, "r", LOG), "log1p is monotone in the raw value");

const pooled = buildStats(new Map([["n-dx-1", ndx], ["commerce", commerce]]), "pooled");
const pn = at(1, "n-dx-1", pooled), pc = at(1, "commerce", pooled);
ok(pn === pc, `pooled gives ONE yardstick across repos (${(pn * 100).toFixed(1)}th in both) — percentile gave 12.5 vs 72.7`);

console.log("\nwithheld-by-construction properties");
ok(vec({ externalPackages: ["some-unmapped-package"] }, "r", LOG).join() === vec({}, "r", LOG).join(),
   "an unmapped package yields no family column, never a new family");
ok(names.filter((n) => n.startsWith("pkg_")).length === new Set(Object.values(PKG_FAMILIES)).size,
   `pkgFamily vocabulary is closed at ${new Set(Object.values(PKG_FAMILIES)).size}`);
ok(vec({ outDegree: 4, edgeTypes: { static: 4 } }, "r", LOG).join() === vec({ outDegree: 4, edgeTypes: { require: 4 } }, "r", LOG).join(),
   "an ESM file and a structurally identical CommonJS file are indistinguishable");
for (const banned of ["category", "zone", "role", "language", "depth"]) {
  ok(!names.some((n) => n.toLowerCase().includes(banned)), `no '${banned}' column is emitted (withheld by the ADR)`);
}

console.log(failed === 0 ? `\nall ${"assertions"} pass (${names.length} feature columns)` : `\n${failed} FAILED`);
process.exit(failed ? 1 : 0);
