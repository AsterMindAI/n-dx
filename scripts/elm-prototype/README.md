# elm-prototype — TEMPORARY. Delete on promotion.

**This is a prototype and is meant to be deleted.** It exists to answer one question — *can an ELM
classify source-file archetypes well enough to be worth shipping?* — **before** anyone is asked to
add a workspace dependency for it.

- **Why it lives in `scripts/`:** `scripts/` already resolves `@astermind/astermind-community` from
  the root `node_modules` (see `scripts/elm-hello-world.mjs:19`), so this needs no workspace
  dependency, no lockfile change, and no second-lead sign-off. The sign-off is needed to *ship* the
  module inside a package; it is not needed to *answer the question*.
- **Decision:** [`Claude-Context/ADR/ADR-2026-08-27-butter-prove-before-provisioning.md`](../../Claude-Context/ADR/ADR-2026-08-27-butter-prove-before-provisioning.md)
- **Plan:** [`Claude-Context/IMPL/IMPL-2026-08-27-butter-elm-prototype-and-telemetry.md`](../../Claude-Context/IMPL/IMPL-2026-08-27-butter-elm-prototype-and-telemetry.md)
- **Interface:** fixed by [`ADR-2026-08-23-butter-elm-inference-module.md`](../../Claude-Context/ADR/ADR-2026-08-23-butter-elm-inference-module.md) § Decision 3, so promotion is transcription rather than redesign.

## On promotion

If the ELM clears Path B's bar, this directory is **deleted in the same PR** that promotes the code
into `packages/llm-client/src/elm/`. Two copies of inference logic is the fork the standing doctrine
forbids, and script-tier prototypes have a way of becoming permanent if nobody says otherwise.

If it does **not** clear the bar, this directory is deleted and the dependency is never taken.

## What this does NOT do

**It publishes no accuracy number and returns no verdict.** `train-eval.mjs` prints a report and
stops. Setting the bar, reading the confusion matrix, and deciding whether the ELM is good enough is
`TN-B5` / `TN-J4` Step 3 — Jam's, under the Path A/B split.

Its output is labelled **agreement-with-teacher**, never *accuracy*: the corpus labels come from an
LLM whose consistency is itself under review (`TN-J10`).

## Usage

```sh
node scripts/elm-prototype/train-eval.mjs                 # uses the committed corpus
node scripts/elm-prototype/train-eval.mjs --seed=7        # different seed
node scripts/elm-prototype/train-eval.mjs --hidden=1024   # capacity sweep
```
