/**
 * Control experiment: prove the wrapper can learn a task we KNOW is learnable,
 * before it is allowed to report a number on a task we are unsure about.
 *
 * Without this, a low corpus score is ambiguous between "the ELM cannot do this"
 * and "Butter's wrapper is broken" — and the first of those is a publishable
 * finding while the second is an embarrassment. During development this harness
 * scored 4.8% on the corpus because of a maxLen truncation bug in MY config, and
 * it looked exactly like an ELM failure. Hence this gate.
 *
 * The task is the hello-world's, verbatim: 3 classes, 30 training rows, 6 held-out,
 * seed 42, random baseline 33%, documented floor 66%.
 */

import { ElmClassifier } from "./classifier.mjs";

const buildPaths = (dir, names, label, ext) =>
  names.map((name) => ({ text: `${dir}/${name}.${ext}`, label }));

const TRAINING_SET = [
  ...buildPaths("src/server", ["routes", "api", "handlers", "mcp", "start", "gateway", "middleware", "auth", "session", "broadcast"], "route", "ts"),
  ...buildPaths("src/components", ["button", "modal", "card", "nav", "sidebar", "header", "footer", "table", "badge", "toggle"], "component", "tsx"),
  ...buildPaths("tests/unit", ["foo", "bar", "baz", "qux", "alpha", "beta", "gamma", "delta", "eps", "zeta"], "test", "test.ts"),
];

const HELD_OUT = [
  { path: "src/server/webhooks.ts", expected: "route" },
  { path: "src/server/tokens.ts", expected: "route" },
  { path: "src/components/spinner.tsx", expected: "component" },
  { path: "src/components/list.tsx", expected: "component" },
  { path: "tests/unit/new.test.ts", expected: "test" },
  { path: "tests/unit/omega.test.ts", expected: "test" },
];

/** Same floor the hello-world asserts: 2x the 33% random baseline for 3 classes. */
export const CONTROL_FLOOR = 0.66;

/** @returns {{ passed: boolean, accuracy: number, maxProb: number, detail: string[] }} */
export function runControl({ seed = 42 } = {}) {
  const categories = [...new Set(TRAINING_SET.map((r) => r.label))];
  const clf = new ElmClassifier({ categories, seed });
  clf.train(TRAINING_SET);

  const detail = [];
  let correct = 0;
  let maxProb = 0;
  for (const { path, expected } of HELD_OUT) {
    const [top] = clf.predict(path, 1);
    const hit = top?.label === expected;
    if (hit) correct++;
    maxProb = Math.max(maxProb, top?.prob ?? 0);
    detail.push(`${hit ? "PASS" : "FAIL"}  ${path.padEnd(28)} -> ${String(top?.label).padEnd(10)} ${Number(top?.prob).toFixed(3)}`);
  }
  const accuracy = correct / HELD_OUT.length;
  return { passed: accuracy >= CONTROL_FLOOR, accuracy, maxProb, detail };
}
