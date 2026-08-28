# Implementation Plan: path-text ELM gate for sourcevision classification

- **Companion to:** [ADR-001-elm-classify-gate.md](ADR-001-elm-classify-gate.md)
- **Date:** 2026-08-20
- **Author:** Nala (head engineer, n-dx)
- **Status:** Proposed — not started, awaiting Thomas's go-ahead

## Why this plan exists

ADR-001 documents that the shipped shadow-mode ELM gate cannot work as designed: the 260 files it needs to resolve (n-dx's own real unclassified population) carry a completely empty evidence vector, so there is no signal for the model to learn from, regardless of threshold tuning. The counter-evidence — `scripts/elm-hello-world.mjs` getting 83% held-out accuracy on raw file-path text through the same library — points at a concrete fix: change the input representation from the evidence vector to path text. This plan sequences that change.

This is a redesign of `classify-elm.ts`'s input layer, not a parameter tweak. The gate stays disabled (`ELM_GATE_ENABLED = false`) for the entire plan until step 6 passes its acceptance bar.

## Goal

Give the ELM gate an input representation that has signal for the actual unclassified population, then re-run the same real-data validation from ADR-001 and only enable the gate if it clears a defined accuracy bar — not on "it typechecks."

## Non-goals

- Does not touch the Tier 2/Tier 3 ELM candidates (`assessGranularity`, `clarify`, etc.) from the 2026-08-06 full candidate survey — out of scope until this v1 path proves out and creates a second consumer.
- Does not add model persistence — the "retrain in-memory each run" decision from ADR-001 stands; nothing here changes that.
- Does not attempt to collect real ELM-vs-Claude agreement data in this environment — the `claude` CLI is confirmed absent here (ADR-001, Consequences). Steps that need live Claude output are marked and deferred to an environment where the CLI is present, or handed to Thomas to run.

## Steps

### 1. Decide the input mode: text-mode vs. `FeatureCombinerELM`

Two candidate designs, both already scoped in the ELM type recommendation history:

- **(a) Text mode only** — drop the evidence vector entirely, feed raw file path (and possibly directory/filename tokens) through `useTokenizer: true`, mirroring `elm-hello-world.mjs` exactly. Simpler, directly matches the one data point we have (83% accuracy).
- **(b) `FeatureCombinerELM`** — combine path-text-derived features with the existing (currently unused-for-unclassified-files) evidence vector, so files that *do* have partial evidence keep using it and path text fills the gap for the all-zero population. Already flagged as "the natural v2 path" in the 2026-08-13 ELM survey.

**Recommendation:** start with (a). It's the smaller change, it's the one path with actual held-out evidence behind it, and (b) is only worth the extra complexity if (a) alone doesn't clear the accuracy bar in step 6 — build the combiner only if the simple version underperforms. Confirm this with Thomas before starting step 2 (this is a design choice, not purely mechanical).

### 2. Build training data extraction

Replace `buildFeatureVector`'s role in `classify-elm.ts`: instead of reconstructing a sparse evidence vector, extract the file path (relative to repo root, matching whatever normalization `elm-hello-world.mjs` uses) for every confidently-classified file (`source: "algorithmic"` or `"llm"`) as the training set, archetype as label.

Files touched: `packages/sourcevision/src/analyzers/classify-elm.ts`.

### 3. Retrain path: `trainClassifyELM` → text mode

Swap the `ELM` construction from numeric mode to `useTokenizer: true`, call `.train()`/`.predict()` (matching the working smoke-test code path) instead of `.trainFromData()`/`.predictFromVector()`. Keep the same top1/top2 margin gate logic and the 20-example minimum from the current implementation — those parts of the design weren't what failed.

### 4. Update schema/gate wiring if needed

Check whether `FileClassification.evidence` is still read anywhere in `classify-elm.ts` after the input swap; if the evidence vector is fully dropped (design choice (a)), remove the now-dead `buildFeatureVector` function rather than leaving unused code. If design (b) is chosen instead, keep it and wire it into `FeatureCombinerELM.combineFeatures`.

### 5. Typecheck and unit-test

Same bar as the original integration (ADR-001, Consequences): `tsc --noEmit` on sourcevision clean, existing `classify.ts` unit tests (66 as of 2026-08-20) still passing, plus new unit tests specifically for the text-mode training/predict path in `classify-elm.ts` (none existed for the numeric-mode path either — this plan should not repeat that gap).

### 6. Re-run the real-data validation — define the acceptance bar first

Repeat the ADR-001 diagnostic: run `ndx analyze` (non-lite) against n-dx itself, extract the real unclassified population, run the new text-mode `predictWithClassifyELM` against it directly (bypassing Claude, same as before — the CLI absence in this environment doesn't block this step since it never needed live Claude output).

**Acceptance bar (define before running, not after — avoid post-hoc threshold picking):** proposed bar is ≥70% of gate-confident predictions (margin ≥0.3) agreeing with a human spot-check of a random sample (n=30) of those predictions, since live Claude agreement can't be collected here. This is a proxy, not the real target metric — flag it as such in the writeup. If Thomas has access to an environment with the `claude` CLI, the real target metric (ELM-vs-Claude agreement across the full 260-file population, shadow-mode logged via `logElmShadowAgreement`) should be collected there instead and would supersede the proxy bar.

Commit the diagnostic script this time (it was scratchpad-only in ADR-001's validation) as a fixture or test under `packages/sourcevision/tests/`, so this validation is repeatable and reviewable rather than a one-off session artifact.

### 7. Decision gate: enable or hold

- **If the bar clears:** flip `ELM_GATE_ENABLED = true`, update ADR-001's status line to reflect the input redesign superseding the original evidence-vector framing (or write ADR-002 if the change is substantial enough to warrant its own record — Thomas's call which).
- **If it doesn't clear:** document the result the same way ADR-001 did — plainly, with numbers — and decide with Thomas whether to try design (b) (`FeatureCombinerELM`) next or shelve the ELM gate for this call site entirely.

### 8. Cleanup regardless of outcome

Address the two stray untracked artifacts flagged in the charter log but never cleaned up (`untitled folder` in `packages/sourcevision/src/analyzers/`, empty `n-dx/` folder at repo root) as part of whichever PR closes this out — small, but they've been sitting flagged since 2026-08-06 and 2026-08-13 respectively.

## Sequencing / dependencies

Steps 1–5 can proceed once Thomas confirms design choice (a) vs (b) in step 1. Step 6's real-repo run has no environment blocker (unlike live-Claude validation). Step 7 is a hard gate — no enabling the flag on typecheck/build passing alone, matching the original hold-before-merge condition from ADR-001 and the 2026-08-06 charter log entry it traces back to.

## Open questions for Thomas

1. Design choice: text-mode only (a) vs. `FeatureCombinerELM` (b) to start — recommendation above is (a).
2. Is the proxy acceptance bar (human spot-check agreement, n=30) acceptable, or should this wait for an environment with the `claude` CLI so real ELM-vs-Claude agreement can be measured directly instead?
3. Should this get its own ADR-002 on completion, or amend ADR-001's status in place?
