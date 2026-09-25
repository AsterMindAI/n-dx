#!/usr/bin/env node
/**
 * Run Team Jarrett's ELM gate directly against a repo's EXISTING .sourcevision/.
 *
 * ── Why this exists rather than `analyze --only=classifications` ─────────────
 * `analyze` RECOMPUTES the classification phase from scratch: it discards the
 * residue left by earlier work and re-labels the whole repo through the LLM. On
 * nest that meant 844 files in 29 batches (~$2-5 of spend) and the gate never ran
 * at all, because a from-scratch recompute has no `source: "llm"` rows at gate
 * time and the cold-start floor (classify-elm.ts:351, >= 20) bails SILENTLY.
 *
 * This reads the analysis already on disk and calls the gate directly.
 * ZERO LLM calls. Reads bytes, writes nothing, sets no flag.
 *
 * Usage: node scripts/elm-gate-demo.mjs [repo-path]
 *
 * Result on nest @ 39fbdda, 2026-09-25: 7 of 8 at unanimity (87.5%), all
 * test-helper, 4.4s -- reproducing ADR-2026-09-04-syrup-... section 2 Path A.
 *
 * ⚠️ Coverage of the routed set is not correctness. These 7 look right by eye and
 * eye is not a metric; the labels they are judged against are an LLM teacher at
 * 72.3% vs human judgement.
 */
import { readFileSync } from "node:fs";
import { runELMGate } from "../packages/sourcevision/dist/analyzers/classify-elm.js";
const NEST = process.argv[2] ?? "/Users/nolanmoore/Work/n-dx-elm-corpus/nest";
const j = (f) => JSON.parse(readFileSync(`${NEST}/.sourcevision/${f}`, "utf-8"));
const classifications = j("classifications.json"), inventory = j("inventory.json"), imports = j("imports.json");
const routed = classifications.files.filter((f) => !f.archetype);
console.log(`target            : ${NEST}`);
console.log(`routed to the gate: ${routed.length} files (unclassified after rules + LLM)`);
const t0 = Date.now();
const res = runELMGate(classifications, inventory, imports, { seed: 20260812, rootDir: NEST });
const ms = Date.now() - t0;
const u = res.updatedFiles ?? [];
console.log(`ELM RESOLVED      : ${u.length} of ${routed.length}` +
  (routed.length ? `  (${(u.length / routed.length * 100).toFixed(1)}% at unanimity)` : "") +
  `   in ${(ms / 1000).toFixed(1)}s`);
const by = {};
for (const f of u) by[f.archetype] = (by[f.archetype] ?? 0) + 1;
console.log(`labels            : ${Object.entries(by).map(([k, v]) => `${k}=${v}`).join(", ") || "(none)"}`);
for (const f of u) console.log(`   ${f.archetype.padEnd(12)} conf=${(f.confidence ?? 0).toFixed(3)}  ${f.path}`);
const unresolved = routed.filter((r) => !u.some((x) => x.path === r.path));
if (unresolved.length) { console.log(`unresolved        : ${unresolved.length}`); for (const f of unresolved) console.log(`   ${f.path}`); }
