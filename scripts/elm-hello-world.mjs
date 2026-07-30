#!/usr/bin/env node
/**
 * Hello-world smoke test for @astermind/astermind-community.
 *
 * Verifies the ELM library trains and predicts correctly under Node before we
 * rely on it to replace LLM calls. The task mirrors the real target use case:
 * classifying source-file paths into archetypes, which is what
 * `enrichClassificationsWithLLM` in packages/sourcevision currently pays an LLM to do.
 *
 * Run: node scripts/elm-hello-world.mjs
 * Exits non-zero if the library fails to load, train, or clear the accuracy floor.
 *
 * Two library gotchas this file encodes, both easy to trip over:
 *   1. `charSet` is interpolated unescaped into a RegExp character class, so a
 *      literal '-' must come LAST or it forms an invalid range and throws.
 *   2. Text training requires `useTokenizer: true` — otherwise train() throws.
 */

import { ELM } from "@astermind/astermind-community";

/** '-' MUST stay last — see gotcha 1 above. */
const CHAR_SET = "abcdefghijklmnopqrstuvwxyz0123456789./_-";
/** Split paths on separators so directory names become tokens. */
const TOKENIZER_DELIMITER = /[/._-]+/;
/** Fixed seed keeps random hidden-weight init reproducible across runs. */
const SEED = 42;
const HIDDEN_UNITS = 512;
/**
 * Floor, not a target: this is a smoke test, not a benchmark. Set to 2x the
 * random baseline (3 categories => 33%), which proves the model genuinely
 * learned without pinning the assertion to one library version's exact output.
 */
const MIN_ACCURACY = 0.66;

const buildPaths = (dir, names, label, ext) =>
  names.map((name) => ({ text: `${dir}/${name}.${ext}`, label }));

const TRAINING_SET = [
  ...buildPaths("src/server", ["routes", "api", "handlers", "mcp", "start", "gateway", "middleware", "auth", "session", "broadcast"], "route", "ts"),
  ...buildPaths("src/components", ["button", "modal", "card", "nav", "sidebar", "header", "footer", "table", "badge", "toggle"], "component", "tsx"),
  ...buildPaths("tests/unit", ["foo", "bar", "baz", "qux", "alpha", "beta", "gamma", "delta", "eps", "zeta"], "test", "test.ts"),
];

/** Held-out paths the model has never seen. */
const HELD_OUT = [
  { path: "src/server/webhooks.ts", expected: "route" },
  { path: "src/server/tokens.ts", expected: "route" },
  { path: "src/components/spinner.tsx", expected: "component" },
  { path: "src/components/list.tsx", expected: "component" },
  { path: "tests/unit/new.test.ts", expected: "test" },
  { path: "tests/unit/omega.test.ts", expected: "test" },
];

const CATEGORIES = [...new Set(TRAINING_SET.map((s) => s.label))];

function main() {
  console.log("ELM hello-world — @astermind/astermind-community\n");

  const elm = new ELM({
    categories: CATEGORIES,
    hiddenUnits: HIDDEN_UNITS,
    maxLen: 32,
    activation: "relu",
    charSet: CHAR_SET,
    useTokenizer: true,
    tokenizerDelimiter: TOKENIZER_DELIMITER,
    seed: SEED,
    log: { modelName: "elm-hello-world", verbose: false },
  });

  const startedAt = process.hrtime.bigint();
  elm.train(TRAINING_SET);
  const trainMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

  console.log(`trained on ${TRAINING_SET.length} paths across ${CATEGORIES.length} categories in ${trainMs.toFixed(1)}ms\n`);

  let correct = 0;
  for (const { path, expected } of HELD_OUT) {
    const [top] = elm.predict(path, 1);
    const hit = top.label === expected;
    if (hit) correct++;
    console.log(`  ${hit ? "PASS" : "FAIL"}  ${path.padEnd(30)} -> ${String(top.label).padEnd(10)} ${Number(top.prob).toFixed(3)}${hit ? "" : `  (expected ${expected})`}`);
  }

  const accuracy = correct / HELD_OUT.length;
  console.log(`\naccuracy on held-out paths: ${correct}/${HELD_OUT.length} (${(accuracy * 100).toFixed(0)}%)`);

  if (accuracy < MIN_ACCURACY) {
    console.error(`\nFAILED: accuracy ${(accuracy * 100).toFixed(0)}% is below the ${(MIN_ACCURACY * 100).toFixed(0)}% floor.`);
    process.exit(1);
  }

  console.log("OK — library loads, trains, and generalizes under Node.");
}

main();
