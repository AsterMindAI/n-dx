# classify-elm-eval results

Run: `node scripts/classify-elm-eval.mjs` — 2026-08-31, Nala (Team Thomas), `Thomas_Branch`,
`.sourcevision/classifications.json` regenerated same session via
`node packages/sourcevision/dist/cli/index.js analyze .` (no `claude` CLI in this environment, so
`bySource` is 100% `algorithmic` — 423 classified / 259 unclassified / 682 total files).

```
archetype catalog: 17 ids
labeled examples: 423 (source algorithmic/llm, archetype != null)

train: 338 · held-out: 85
classes kept entirely in training (< 2 examples, not evaluable): config(1)

uniform baseline (1/17): 5.9%
majority-class baseline (always predict "utility"): 19.5%

trained on 338 examples in 1975.1ms

held-out accuracy: 77/85 (90.6%)
  vs uniform baseline:        5.9%
  vs majority-class baseline: 19.5%

misclassified (8):
  packages/rex/src/cli/output.ts                          expected utility         got cli-command (0.089)
  packages/web/src/viewer/components/prd-tree/index.ts    expected entrypoint      got component (0.119)
  packages/rex/src/store/index.ts                         expected entrypoint      got store (0.122)
  packages/web/src/viewer/components/index.ts             expected entrypoint      got component (0.130)
  packages/sourcevision/src/constants.ts                  expected types           got utility (0.074)
  packages/hench/src/quota/types.ts                       expected types           got entrypoint (0.088)
  packages/rex/src/schema/validate.ts                     expected schema          got entrypoint (0.091)
  packages/hench/src/schema/templates.ts                  expected schema          got entrypoint (0.087)

acceptance bar (2x majority-class baseline, 60% floor): 60.0%
RESULT: CLEARS the bar — Phase 2 (shadow-mode implementation) is justified.
```

## What this does and doesn't prove

**Clears the pre-agreed bar** (`IMPL-2026-08-31-nala-classify-elm-rewrite.md` step 4: 2x
majority-class baseline, 60% floor) by a wide margin — 90.6% vs. a 60% bar, on real n-dx paths and
real archetype labels, not synthetic data.

**Does not directly prove generalization to the actual deployment target.** This measures accuracy
on files the algorithmic pass *already classified* (held out from training, but still drawn from
the 423 "easy" population). The real target — the 259 currently-unclassified files — has no ground
truth to test against, by definition. The misclassifications above are informative here: several
are `index.ts`/barrel files or `types.ts`/`validate.ts` files where the *filename* alone is
genuinely ambiguous across archetypes (an `index.ts` could be an entrypoint, a component barrel,
or a store barrel from path text alone) — plausibly the same kind of file that also stumps the
algorithmic pass, which is a reason for cautious optimism about the unclassified population, but
not a measurement of it. This is exactly why the IMPL keeps `ELM_GATE_ENABLED = false` through
Phase 2 rather than treating this number as license to skip the Claude call immediately.

## Correction to a prior assumption (found while building this script)

`scripts/elm-hello-world.mjs`'s `elm.train(TRAINING_SET)` call does not train on `TRAINING_SET`.
`ELM.train()`'s only parameter is `augmentationOptions`; passed an array, every property it reads
(`suffixes`, `prefixes`, `includeNoise`) is `undefined`, so the call is silently equivalent to
`elm.train()` with defaults — training only on character-augmented variants of the category label
strings themselves. Verified empirically: three ELMs trained with a real-looking training set, a
contradictory training set, and no argument at all produced byte-identical model weights and
predictions. That script's 83%-accuracy claim is not evidence the library learns from labeled
examples.

This script uses the API that actually does: `UniversalEncoder.encode()` → `ELM.trainFromData(X, y)`
(numeric mode). Sanity-checked with a shuffled-label control before trusting it on real data: real
labels scored 6/6 on `elm-hello-world.mjs`'s own held-out set, shuffled labels scored 3/6 (chance
for 3 classes) — confirming `trainFromData` genuinely learns from what it's given.

Flagged in `Claude-Context/IN-FLIGHT.md` § Decisions & findings since `elm-hello-world.mjs` and the
root `elm:hello` script predate this session and may be cited elsewhere as working proof.
