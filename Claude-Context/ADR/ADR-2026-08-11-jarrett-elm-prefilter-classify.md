# ADR — Add an ELM pre-filter stage before classify.ts's LLM fallback

- **Status:** Proposed — real numbers now in (2026-08-12), gate did **not** clear on held-out
  generalization. Not moving to Accepted; see Evidence for the measured results and Consequences
  for what's next.
- **Date:** 2026-08-11
- **Author:** Archer (Team Jarrett)
- **Supersedes:** none
- **Backlog item:** `TJ-A1`

## Context

`packages/sourcevision/src/analyzers/classify.ts` classifies every source file into one of ~17
built-in archetypes (`archetypes.ts`, `BUILTIN_ARCHETYPES`) in two passes:

1. **Algorithmic** (`classifyFile`, `classify.ts:135-208`) — weighted regex/path/filename/export
   signal matching against the archetype catalog, zero cost, runs on every file. Anything scoring
   ≥ `PRIMARY_THRESHOLD` (0.4) is resolved here for free.
2. **LLM fallback** (`enrichClassificationsWithLLM` → `classifyBatchWithLLM`, `classify.ts:328-481`)
   — files the algorithmic pass leaves at `archetype: null` are sent to `callClaude` in batches of
   30, one round-trip per batch. Gated on `!ctx.fastMode && totalUnclassified > 0`
   (`packages/sourcevision/src/cli/commands/analyze-phases.ts:218-221`) — runs on every non-`--fast`
   `ndx analyze` that has leftover unclassified files after pass 1.

**Verified 2026-08-11** (Archer's session log in this charter): the LLM call's free-text `reason`
field has no consumer outside `classify.ts` itself — it's only recycled into a later retry
attempt's prompt as a hint (`classify.ts:500-505`), never surfaced to a user or read by any other
module (`web/src` viewer and server grepped, zero matches on `signalKind`/`archetypeId`/`.evidence`).
So a classifier that emits only a label, with no reasoning text, loses nothing any real consumer
needs.

**Knight's 2026-08-11 survey** of `../AsterMind-Community-Edition/src/core/` (logged in this same
charter) confirms base `ELM` (text mode) is architecturally the right shape for this: fixed random
hidden layer, output layer solved analytically via ridge regression, trains in milliseconds, and
accepts raw text directly via a built-in tokenizer — "file path/snippet → archetype label" maps
onto it with no hand-rolled feature encoding required.

This ADR proposes the next step: don't replace the LLM fallback, narrow how often it's reached.

## Decision

Insert a new stage **between** the two existing passes, not inside either one: after
`analyzeClassifications` produces its `archetype: null` files, run a base `ELM` classifier (text
mode, via `@astermind/astermind-community` — see Evidence) over just that leftover set, before
`enrichClassificationsWithLLM` is called. Neither existing function is modified — the new stage is
a pure in-between call reading one function's output and narrowing the other's input. Files the ELM
resolves above a calibrated confidence threshold are done. Everything else — the ELM's own
low-confidence remainder — still goes to the LLM exactly as it does today. The LLM remains the
source of truth for anything the ELM isn't sure about; this is a pre-filter, not a replacement.

Training data comes from files already classified — both `source: "algorithmic"` and prior
`source: "llm"` — using file path plus the algorithmic pass's partial evidence signals
(`archetypeId(weight)` pairs, present even on `null`-archetype files per `classify.ts:159-165`) as
input, and the resolved `archetype` as the label.

**Start with a single base `ELM`, not a chain.** Knight's read on `DeepELM` (stacking `ELM`
instances as autoencoders) is "overkill... unless base ELM's random features turn out not
linearly-separable enough." Reach for `ELMChain`/`DeepELM`/`KernelELM` only if the single-model
held-out accuracy (see Evidence) doesn't clear the acceptance bar.

## Alternatives considered

| Option | Why not |
|---|---|
| ELM inside `classifyFile` itself | `classifyFile` already resolves confident cases for free; there's no unclassified population there left to improve on. Same effective target as inserting between passes, but more invasive to a working, deterministic, zero-cost function. |
| Replace the LLM call outright | Removes the only fallback with actual reasoning ability for genuinely novel files (e.g. archetypes the training data never saw). The 2026-07-30 n-dx-wide classifier survey treats ELM as a pre-filter/cost-cutter throughout, not a wholesale swap — same pattern applies here. |
| `ELMChain`/`DeepELM` from the start | No evidence yet that a single base ELM's linear-separability is insufficient for ~17 archetype labels. Chaining adds complexity and a second failure surface before the simpler option has been measured. |
| `KernelELM` | Only relevant if archetype similarity turns out non-linear in the base random-feature space — no evidence of that yet, and `exact` mode is O(N²)/O(N³) without the `nystrom` approximation. |

## Consequences

**Status note (2026-08-12):** none of the below has happened — the gate in Evidence didn't clear,
so `classify.ts`/`analyze-phases.ts` are untouched and no ELM runs in production. This section
describes what the Decision *would* cost/save if a future retry (see Evidence, "Read on why")
clears the gate, kept here so that evaluation doesn't have to be re-derived from scratch.

**Easier:** fewer files reach `callClaude` per `ndx analyze`, directly cutting the token/latency
cost the LLM fallback already incurs on every non-fast run with leftover unclassified files. The
retry-and-degrade machinery (`computeLLMClassifyAttempts`, JSON-parse fallback in
`tryParseClassifyResponse`) sees fewer batches, shrinking its failure surface proportionally.

**Harder:** a new model artifact to train, version, and keep in sync with `archetypes.ts` — if
custom archetypes are added via `.n-dx.json` overrides, the ELM needs retraining or it silently
under-serves those labels (falls through to the LLM correctly, but doesn't help until retrained).
A miscalibrated confidence threshold silently misclassifies instead of correctly falling through
to the LLM — the same caution Knight raised about `classifyError`'s retry-safety question applies
here to classification correctness.

**Which teams are affected:** none outside Team Jarrett as currently scoped —
`packages/sourcevision` isn't on `OWNERSHIP.md`'s shared-files list, and no other team's `Notes/`
inbox references `classify.ts`. Flagged in `IN-FLIGHT.md` § 2 for visibility per the "claim
generously while scopes are unassigned" rule. If a new npm dependency is added for the ELM
implementation, `package.json`/`pnpm-lock.yaml` **are** shared — see the IMPL's Step 1.

**Migration cost:** contained to `packages/sourcevision` — new module(s) plus one new call in
`runClassificationsPhase`, plus a widened `FileClassification.source` union (`"elm"`). No change to
the `FileClassification` shape otherwise.

## Evidence

**Measured 2026-08-12 — see "Measured results" below for the numbers.** This section first
records the planned methodology (kept intact so the run is reproducible by another team), then the
actual results. Per `ADR-TEMPLATE.md`, an ELM-viability claim — positive or negative — needs both;
this ADR is making a negative-leaning one, not an unmeasured proposal anymore.

- **Task framing:** input = file path + partial evidence signals (`archetypeId(weight)` pairs from
  `classifyFile`'s scoring, available even on `null`-archetype files); output = one of
  `BUILTIN_ARCHETYPES.length` (~17) archetype IDs.
- **Dependency (resolved 2026-08-12):** `@astermind/astermind-community` (npm, v3.0.0) — **not**
  `@astermind/astermind-elm` (npm, v2.1.1, older/narrower — confirmed via `registry.npmjs.org`
  for both). `astermind-community`'s name/version/description are an exact match to the local
  `AsterMind-Community-Edition/package.json` Knight actually read file-by-file for the
  2026-08-11 survey (`ELM.ts`/`DeepELM.ts`/`KernelELM.ts`/`OnlineELM.ts`/`ELMChain.ts`/
  `ELMAdapter.ts`); `astermind-elm` predates that consolidation and isn't guaranteed to have the
  same API shape. The local `AsterMind-Community-Edition` checkout is also **not** a sibling of
  this repo's working directory (`Final n-dx/n-dx`) — it only sits at `../AsterMind-Community-Edition`
  relative to a second, older n-dx checkout on this machine (`GitHub/n-dx`, branch `dev`). The
  npm dependency is the portable path; no script should hardcode a relative sibling path to the
  source checkout.
- **Training / held-out split:** neither this repo nor either held-out candidate has
  `classifications.json` yet — confirmed by checking `.sourcevision/` in both this repo (only
  `.gitignore`/`hints.md` present, `ndx analyze` never run here) and `AsterMind-Community-Edition`
  (no `.sourcevision/` at all). Training source: this repo's own classification history, generated
  by running `ndx analyze` here first. Held-out set: `AsterMind-Community-Edition` (129 `.ts`/`.tsx`
  files, genuinely different domain — ML library, not a dev-tooling monorepo — so it actually tests
  generalization rather than memorization of n-dx's own naming conventions), also requires
  `ndx analyze` run on it first. Considered the other `GitHub/n-dx` checkout as a zero-prerequisite
  alternative (it already has `.sourcevision/` output) but rejected it for the held-out role — same
  codebase, different branch, so it would mostly measure overfitting to n-dx's own conventions
  rather than true generalization. Exact split ratio still TBD in the IMPL.
- **Seed:** a fixed seed for the ELM's random `W`/`b` initialization, recorded in the committed
  script — not left to a default.
- **Acceptance gate — reframed as precision-at-threshold, not flat accuracy-over-baseline
  (2026-08-12):** production use only ever trusts an ELM prediction above a chosen confidence
  threshold — everything below it still falls through to the LLM exactly as today. A flat
  "beat the majority-class baseline by N points" accuracy number doesn't measure the thing that
  matters, because a wrong *resolved* prediction has no safety net the way falling through to the
  LLM does. The eval script should instead produce a precision/coverage curve across confidence
  thresholds (precision = fraction correct among predictions at-or-above a threshold; coverage =
  fraction of the held-out set resolved at that threshold), and the production threshold — see the
  IMPL's confidence-threshold open question — should be picked where precision clears a high bar
  (proposed: ≥95%), not from a single accuracy-vs-baseline comparison. Majority-class baseline
  (from `computeSummary`'s `byArchetype`) is still reported for context, just not used as the sole
  gate.
- **Committed script:** `packages/sourcevision/scripts/eval-classify-elm.ts`, committed on
  `elm/jarrett/classify-elm-prefilter` — not a one-off snippet run once and discarded. Training
  logic lives alongside it in `packages/sourcevision/src/analyzers/classify-elm.ts`.

### Measured results (2026-08-12)

**Data:** the `claude` CLI wasn't available in this environment and no `ANTHROPIC_API_KEY` was
initially set (see IMPL session log); rather than block on that, real Claude-quality labels were
generated directly — reasoning over each unclassified file's path against the same archetype
catalog and instructions `buildLLMClassifyPrompt` uses, then merged via the actual
`mergeClassificationResults` function so the output is schema-identical to what the production
pipeline would have written. 94 files labeled this way in this repo (413 training examples total
after merge, 14 categories), 31 in `AsterMind-Community-Edition` (78 held-out examples total).

**Confidence calibration finding:** the trained ELM's softmax confidence is diffuse — observed
range ~0.08-0.19 on training data, not the near-0/near-1 spread a threshold sweep starting at 0.5
assumes. A sweep anchored there shows 0% coverage everywhere and looks like a broken model rather
than a miscalibrated sweep. **Independently found by Knight too** (`TJ-K1`, observed range
0.13-0.23 on their build) — two separately-built implementations hitting the same calibration
issue is itself evidence this is inherent to the base-ELM ridge-regression readout on this task,
not an implementation bug in either version.

**Evidence-leakage finding, fixed before these numbers:** `classifyBatchWithLLM`
(`classify.ts:461-469`) writes `evidence: [{archetypeId: item.archetype, ...}]` for LLM-resolved
files — the evidence *is* the resolved label restated, not independent signal. The training-data
extraction was initially feeding this into the ELM's input text for every LLM-labeled example,
leaking the answer. Fixed by only using evidence hints for `source: "algorithmic"` entries (see
`classify-elm.ts`). Verified the fix doesn't change the qualitative conclusion (numbers moved
&lt;1 point). **This is a property of the real production schema**, not an artifact of the
manually-generated labels — any real `classifications.json` with LLM-sourced entries has it.
Knight independently hit the adjacent form of this same schema gap (evidence for
algorithmically-then-LLM-relabeled files isn't preserved at all) and worked around it differently
(recomputing fresh algorithmic evidence rather than dropping it) — both are legitimate fixes to the
same underlying issue, logged separately so a future ADR on this schema gap has both approaches to
compare.

**Results**, precision/coverage at a threshold, with a coverage floor (15%) so one lucky resolved
example can't read as a pass:

| | Best point clearing 95% precision at ≥15% coverage | Verdict |
|---|---|---|
| In-domain (this repo, held-out split) | 95.8% precision @ 23.1% coverage (t=0.14) | **Clears the gate** |
| Out-of-domain (`AsterMind-Community-Edition`) | None — best meaningful-coverage point is 60.9% precision @ 29.5% coverage (t=0.12) | **Does not clear the gate** |

The out-of-domain number is the one this ADR's Decision actually depends on — the pre-filter has to
work on the population it's meant to help with, which by definition isn't limited to files that
look like this repo's own conventions. Majority-class baseline (context only): 21.2% in-domain,
48.7% out-of-domain — the model clearly beats chance, just not by enough at useful coverage.

**Read on why, converging independently with Knight's `TJ-K1`:** most likely training-data
quantity/representativeness, not the base-ELM approach itself — in-domain results show the model
*can* learn the signal. 413-494 examples across 11-14 archetypes, generated from two codebases,
isn't enough to generalize across naming-convention differences. Two independently-built
implementations reaching the same conclusion from different feature-encoding choices is stronger
evidence than either alone.

**Per the ADR template's requirement that a negative result gets the same rigor as a positive
one:** this is being reported as such, not discarded. **Did not proceed to IMPL Steps 6-8**
(production wiring) — the gate didn't clear.

### Follow-up: pooled-training experiment (2026-08-13) — did not confirm the "needs more data" read

The read above was "training-data quantity/representativeness," so the direct test is: add more,
more-diverse training data and see if generalization improves. Cloned three small, well-known,
genuinely different codebases chosen specifically to fill archetype labels neither existing
dataset had any examples of — `expressjs/express` (route-handler/service), `remix-run/indie-stack`
(the official Remix starter — sole source of `route-module` examples, zero before), `pmndrs/zustand`
(literal state-management library — `store` examples, near-zero before). Same `ndx analyze`
phase 1/2 + manual-classification-for-the-LLM-fallback method as the original run (see
`packages/sourcevision/scripts/eval-classify-elm.ts`'s new `SV_ELM_EXTRA_TRAINING_CLASSIFICATIONS`
env var for the pooling mechanism). Full detail in `Archer.md`'s 2026-08-13 session log; shared
with Knight via `Notes/NOTE-archer-to-knight-2026-08-13-expanded-training-corpora.md` for an
independent rerun on `TJ-K1`.

**Pooled training (this repo + all three new corpora, 486 examples/16 categories, up from
413/14) against the same untouched AsterMind held-out set:**

| | Original (2 codebases) | Pooled (5 codebases) |
|---|---|---|
| In-domain best point | 95.8% @ 23.1% (t=0.14) — clears gate | 87.3% @ 45.1% (t=0.10) — does **not** clear gate |
| Out-of-domain best meaningful point | 60.9% @ 29.5% (t=0.12) | ~48% @ 32.1% (t=0.10) |

**Result: pooling more/diverse codebases into training did not improve generalization, and the
in-domain result — which previously cleared the gate — no longer does either.** Likely mechanism:
adding categories (14→16) and cross-codebase naming diversity increases the classification task's
difficulty faster than the added examples increase per-category density; the softmax confidence
spread compresses further with more categories, same direction as the original calibration finding
but more pronounced. This does not confirm the "just needs more data" hypothesis in the simple
pooling form tested here — it may need far more examples per category than three small repos
provide, or a fundamentally different feature representation, or the base-ELM approach may not be
the right tool for cross-codebase generalization on this task regardless of data volume. Flagged to
Knight for independent verification before treating this as settled either way — one pipeline's
surprising result is a lead, not a conclusion.

### Review (Realm, 2026-08-19) — the pooling experiment confounded two variables

Realm reviewed both `TJ-A1` and Knight's `TJ-K1` at the user's request (full text:
`Notes/NOTE-realm-to-archer-and-knight-2026-08-19-elm-prefilter-review.md`), independently
re-checked `classify.ts:461-469` (still confirms the evidence-leakage finding, unchanged), and
identified a real methodological gap in the 2026-08-13 pooling experiment: **it changed two
variables in the same run** — added ~73 examples *and* introduced 2 brand-new categories
(`route-module`, `store`, previously zero/near-zero examples) simultaneously. That means the
in-domain regression (95.8%→87.3%) can't be attributed to either cause specifically from that data
alone. My own "categories diluted the softmax" explanation at the time was a stated guess, not a
measured conclusion — Realm called this out directly.

Realm's recommended sequence, in order of what actually isolates the cause rather than repeating a
confounded retry:

1. **Controlled data-volume experiment** — add examples only to categories the original two
   datasets already had (no new categories), rerun against the same untouched held-out set. Not yet
   run.
2. **Fix the feature representation before reaching for a bigger/different model.** `classifyFile`
   already computes a per-archetype weighted numeric score for every file
   (`classify.ts:135-208`/`159-165`) — right now that reaches the ELM only as a tokenized text hint
   (`archetypeId(weight)` embedded in a string via `fileToText`), not as a direct numeric feature
   vector. A ridge-regression readout should work better on structured numeric input than on the
   same information indirectly encoded as text. Worth trying before `KernelELM`/`DeepELM` — no
   evidence yet the problem is non-linear separability rather than a weak input encoding.
3. Only after 1 and 2: revisit `ELMChain`/`KernelELM`/`DeepELM`, per this ADR's own escalation
   clause.
4. The evidence-leakage schema gap (see 2026-08-12 Evidence above) still needs its own dedicated
   ADR, independent of whether this work continues — flagged, still unwritten.
5. Worktree isolation validated itself independently for both `TJ-A1` and `TJ-K1` — keep doing it.

**Picking up item 2 next** (2026-08-20, this session) — see below for the numeric-feature-vector
implementation and result, run as a controlled A/B against the *original* two-codebase data (not
the pooled 5-codebase set) so the feature-representation variable is isolated exactly the way
Realm's review asks for.
