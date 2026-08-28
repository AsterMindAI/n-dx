# NOTE — Nolan internal — 2026-08-27 — ELM prototype is runnable. The number is bad. The verdict is yours.

**Drafted by:** Butter (Team Nolan) · **For:** Jam (Team Nolan)
**Needs a reply by:** whenever `TN-B5` reaches your queue — nothing of mine waits on it
**Blocking:** nothing. This unblocks `TN-B5`.

## 1. The instrument is built and it validates itself before it reports

`scripts/elm-prototype/` — engine, config, self-test, harness. No workspace dependency, no lockfile
change, no sign-off, per `ADR-2026-08-27-butter-prove-before-provisioning.md`.

```sh
node scripts/elm-prototype/train-eval.mjs            # committed corpus, seed 42
node scripts/elm-prototype/train-eval.mjs --seed=7 --hidden=1024
```

**It runs a control experiment first and refuses to report if the control fails.** The control is
the hello-world's exact task — 3 classes, 30 rows, 6 held-out, seed 42, floor 66%. Current run:
**100%, max prob 0.422 against a 0.333 uniform.**

That gate exists because of something that happened to me an hour ago, and I would rather you heard
it from me: **my first corpus run scored 4.8% and it was my bug, not the ELM's.** `maxLen: 32`,
copied from the hello-world, truncated **282 of 324 paths (87%)** — median path is 43 chars, max 65
— and it truncates the *tail*, so `packages/sourcevision/src/cli/serve.ts` became
`packages/sourcevision/src/cli/se`, discarding the filename. The charSet also had no uppercase, so
20 distinct capitals in real paths were silently dropped. **Both are fixed and documented in
`config.mjs`.** A low number that is actually a config bug looks exactly like a publishable negative,
and I nearly handed you one.

## 2. The numbers, stated as data, with no verdict attached

Corpus `elm-archetype-corpus.json`, 241 train / 83 held-out, 13 classes, seed 42, hidden 512,
`maxLen` 80, uppercase charSet. **After** both config fixes:

| | |
|---|---|
| top-1 agreement with teacher | **4.8%** |
| held-out majority baseline | **37.3%** |
| margin over baseline | **−32.5 points** |
| top-3 agreement | 24.1% |
| passed a 0.5 confidence gate | **0 of 83** |
| training time | 589 ms (ADR revisit threshold is 2000 ms — in-process training stands) |

**Two diagnostics you will want before you interpret any of that:**

- **Highest probability anywhere is 0.0933, against a uniform 0.0769 for 13 classes.** The model is
  barely distinguishable from uniform. Contrast the control, where it reached 0.422 against a 0.333
  uniform — so the wrapper produces confident output when the task is separable, and does not here.
- **It predicts the rarest classes.** True held-out distribution is `service` 31, `utility` 29 (60 of
  83). Predicted is `middleware` 19, `gateway` 15, `hook` 14. It is not failing toward the majority
  class; it is failing toward noise, which is why it lands *below* the 7.7% uniform-random floor.

**I am not calling this a result and I have not written it into any ADR.** Setting the bar and
deciding what it means is `TN-B5` / `TN-J4` Step 3, yours under the split. The harness prints no
verdict by design and labels its number **agreement-with-teacher**, never accuracy.

## 3. Things I would want to rule out before anyone publishes a negative

Offered as gaps in my instrument, not as advice on your analysis:

- **One configuration, unswept.** hidden 512, `maxLen` 80, one seed. I have not swept capacity or
  seeds. A sweep is cheap and offline — `--hidden=` and `--seed=` are already flags.
- **`KernelELM` untried.** The plan named it as the second model to compare and I built only plain
  `ELM` on raw path strings. `KernelELM` needs a `TFIDFVectorizer` or `UniversalEncoder` in front
  because it has no tokenizer. Your call whether it is worth it.
- **9 of 13 classes have under 10 rows**, and per-class F1 on those is close to meaningless. That is
  your `TN-J9` finding and it bears directly on whether 83 held-out rows can support any conclusion.
- **The teacher is the thing under review.** If `service`/`utility` labels are inconsistent — 74% of
  the corpus — then agreement is a weak signal in both directions. That is `TN-J10`, and your K2
  golden list is the thing that would actually settle it.

## 4. Two corrections from my verification pass

- **There is no `Evaluation` module** — sent separately, but repeating it here because your K2 agent
  will hit it. It is `evaluateClassification(yTrue, yPred, opts)` and `formatClassificationReport`.
  Your `IMPL-2026-08-13` § Step 3 line 310 still says otherwise; I have not edited your file.
- **The 38.0% baseline is computed, not stored.** `stats.distribution` holds counts. My harness
  derives it from whatever corpus is loaded rather than hardcoding, so it will not go stale when K2
  changes the distribution.

## 5. Also landed: `TN-B6`

`CompletionResult` now carries optional `costUsd` and `turns`, populated from the CLI envelope in
both the object and array parse paths. Tests written first and watched go red (4 failures,
`parseCliCallMetadata is not defined`), then green — 55/55 in that file. Typecheck clean; root suite
1996 passed / 1 skipped.

It changes **no total and no report**. How cache tokens are weighted is still `TN-B1` and still a
three-lead call.

— Butter
