#!/usr/bin/env node
/**
 * Build the K2 gold-set labelling packet.
 *
 * Implements ADR-2026-08-27-jam-k2-gold-set.md. Produces a BLIND packet: the
 * labeller sees file paths and nothing else — no teacher label, no ELM
 * prediction, no confidence. Anchoring on either would destroy the value of the
 * exercise, because what we are testing IS the teacher.
 *
 * Order is shuffled with a fixed seed so the packet is reproducible but carries
 * no ordering signal (the corpus is grouped by repo and roughly by directory).
 *
 * Usage: node scripts/elm-goldset-packet.mjs [--out=<path>]
 */

import { readFileSync, writeFileSync } from "node:fs";

const CORPUS = "scripts/data/elm-archetype-corpus.json";
const DEFAULT_OUT = "scripts/data/k2-goldset-packet.csv";
const SEED = 42;

/** mulberry32 — same generator the corpus builder uses, for consistency. */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function main() {
  const outArg = process.argv.find((a) => a.startsWith("--out="));
  const out = outArg ? outArg.slice(6) : DEFAULT_OUT;
  const corpus = JSON.parse(readFileSync(CORPUS, "utf-8"));

  // The full held-out split, NOT just service/utility. Restricting the packet to
  // two classes would tell the labeller the answer space is binary, and they
  // would never record "this is actually a config file" — which is one of the
  // findings we most want. service/utility remains the ANALYSIS focus.
  // Rows carry `repo`, and provenance carries each repo's absolute root. BOTH are
  // required in the packet: the corpus spans two repositories, so 18 of the 83
  // paths do not exist under n-dx at all. Emitting bare paths made the labeller
  // silently mark 22% of the sample "missing" — caught before handover.
  const rootByRepo = Object.fromEntries((corpus.provenance?.repos ?? []).map((r) => [r.repo, r.path]));
  const rows = corpus.heldOut.map((r) => ({
    repo: r.repo,
    path: r.text,
    fullPath: rootByRepo[r.repo] ? `${rootByRepo[r.repo]}/${r.text}` : r.text,
  }));

  const rand = mulberry32(SEED);
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }

  const header = "id,repo,path,full_path_to_open,pass1_path_only,pass2_after_reading_file,confident_yes_no,notes";
  const body = rows.map((r, i) => `${i + 1},"${r.repo}","${r.path}","${r.fullPath}",,,,`).join("\n");
  writeFileSync(out, `${header}\n${body}\n`);

  const byRepo = {};
  for (const r of rows) byRepo[r.repo] = (byRepo[r.repo] ?? 0) + 1;
  console.log(`K2 gold-set packet — ${rows.length} files (full held-out split, shuffled seed ${SEED})`);
  console.log(`  spans ${Object.keys(byRepo).length} repos: ${Object.entries(byRepo).map(([k, v]) => `${k} (${v})`).join(", ")}`);
  console.log("  IMPORTANT: pass 1 must be judged on the `path` column (what the machines see),");
  console.log("  but pass 2 is opened via `full_path_to_open`.");
  console.log(`  wrote ${out}`);
  console.log("\n  The packet deliberately contains NO teacher label, NO ELM prediction,");
  console.log("  and NO confidence value. Do not add them before handing it over.");
  console.log("\n  Two passes per file, in order, both recorded:");
  console.log("    pass1 — label from the PATH ALONE (what both models see)");
  console.log("    pass2 — open the file, then label again (ground truth)");
  console.log("  The gap between the two passes is the information content of the path,");
  console.log("  and it upper-bounds what ANY path-only classifier can achieve.");
}

main();
