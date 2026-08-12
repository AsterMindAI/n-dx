# ADR — Add an ELM pre-filter stage before classify.ts's LLM fallback

- **Status:** Proposed — Evidence section below is a planned methodology, not measured results;
  see the linked IMPL's Step 5 gate before this can move to Accepted.
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

**Not yet measured — this is what keeps Status at Proposed.** No ELM-viability claim is being made
yet. Per `ADR-TEMPLATE.md`, this section states the planned methodology so the eventual numbers are
reproducible by another team; the IMPL's prototype/eval step is where real numbers get filled in.
Methodology below was tightened 2026-08-12 after checking the actual dependency and data
prerequisites rather than assuming them.

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
- **Committed script:** path to be named in the IMPL's Files-touched table — not a one-off snippet
  run once and discarded.
