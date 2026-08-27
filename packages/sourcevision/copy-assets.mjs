// Copies non-TS build assets that `tsc` doesn't handle on its own — currently just the
// bundled cold-start ELM baseline model (TJ-A2). Run as part of `pnpm build`, after `tsc`.
import { copyFileSync } from "node:fs";

copyFileSync(
  "src/analyzers/classify-elm-baseline-model.json",
  "dist/analyzers/classify-elm-baseline-model.json",
);
