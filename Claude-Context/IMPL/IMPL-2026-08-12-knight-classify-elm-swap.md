# IMPL — Add ELM pre-filter stage to classify.ts's LLM fallback (Knight's independent build)

- **Implements:** `ADR-2026-08-12-knight-elm-prefilter-classify.md` (this session's own ADR),
  and transitively the same architectural decision as
  `ADR-2026-08-11-jarrett-elm-prefilter-classify.md` (Archer)
- **Owner:** Knight (Team Jarrett)
- **Backlog item:** `TJ-K1`
- **Branch:** `elm/jarrett/classify-elm-knight`
- **Worktree:** `../n-dx-knight` — adopted for the same reason as Archer's `../n-dx-jarrett`: two
  agents building independent implementations of the same ADR need isolated `.sourcevision/` state,
  per `OWNERSHIP.md`'s untracked-state hazard. The cross-team worktree-vs-shared-checkout decision
  is still formally open; this is a per-agent choice, not a resolution of that question.
- **Status:** Gate clears (2026-08-20) — numeric feature representation clears the ADR's ≥95%
  precision bar at 42.3% held-out coverage (see ADR Evidence, "Third measurement"). Not proceeding
  to production wiring (Archer's IMPL steps 6-8 equivalent) yet regardless — one held-out codebase,
  not independently corroborated. The open question is no longer "does it work" but "is this
  corroborated enough to wire in" (see Open questions).

## Scope

**In scope:**
- Committed training-data extraction + eval script producing measured Evidence numbers.
- ELM inference module wrapping AsterMind's base `ELM` (text mode) for archetype classification.

**Not yet in scope (gated on the eval gate passing, same order-of-operations as Archer's IMPL):**
- Wiring into `runClassificationsPhase`.
- `"elm"` addition to `FileClassification.source`.
- Any edit to `classify.ts` or `analyze-phases.ts` itself.

**Out of scope (explicitly, same as Archer's IMPL):**
- Replacing or modifying the LLM fallback — it stays the source of truth for whatever the ELM isn't
  confident about.
- `ELMChain`/`DeepELM`/`KernelELM`/`OnlineELM` — only revisited if base-ELM's held-out accuracy
  clears the bar first, which it hasn't yet.
- Any change to `classifyError` or the other classifier call sites from the 2026-07-30 survey.
- **Reconciling with `TJ-A1`** — once Archer's own numbers exist, how the two independent results
  get reconciled (pick one, merge parts of each, treat agreement/disagreement as evidence about
  robustness) is a follow-up decision for the user, not something this document resolves.

## Files touched

| Path | Owning team | New/Edit | Note sent? |
|---|---|---|---|
| `packages/sourcevision/src/analyzers/classify-elm.ts` | unassigned — Team Jarrett scoped | **Created 2026-08-12**; **extended 2026-08-20** with `buildEvidenceVector`/`trainArchetypeELMNumeric`/`predictArchetypeNumeric` (Realm's feature-representation fix). Typechecks clean. | No |
| `packages/sourcevision/scripts/eval-classify-elm.ts` | unassigned | **Created 2026-08-12**; **extended 2026-08-20** to run both representations ("text"/"numeric") controlled, same data/split/seed, in one script run. Typechecks clean, run successfully. | No |
| `packages/sourcevision/package.json` / root `pnpm-lock.yaml` | **shared** per `OWNERSHIP.md` | **Edited 2026-08-12** — added explicit `@astermind/astermind-community` dependency. Was already present at the *root* `package.json` level from pre-existing commit `43d6db51` ("ELM hello-world"); added explicitly to sourcevision's own `package.json` since it's a direct consumer and shouldn't rely on workspace hoisting by accident. | Logged as an `IN-FLIGHT.md` § 3 finding, not a new § 1 claim — see note below |
| `Claude-Context/Jarrett-Agents/BACKLOG.md` | Team Jarrett | Claimed `TJ-K1`, 2026-08-12 | N/A |
| `Claude-Context/IN-FLIGHT.md` | shared | Added a § 2 status line + two § 3 findings (dependency-claim path correction, `train()` empirical proof), 2026-08-12 | N/A |
| `classify.ts`, `analyze-phases.ts`, `schema/v1.ts`, `validate.ts` | unassigned — Team Jarrett scoped | **Not touched** — gated on the eval gate, which didn't pass | No |

**Note on the dependency claim:** `IN-FLIGHT.md` § 1 already carries Archer's claim naming
`packages/sourcevision/package.json` for the same dependency (that path is actually wrong — the
pre-existing instance is at root `package.json`, per this ADR's Evidence). Rather than add a second
overlapping § 1 row for the same shared file, the correction is logged as a § 3 finding instead.
Both worktrees' `package.json` edits live on separate, unmerged branches, so there's no real-time
collision risk despite the shared-file status — the risk surfaces only at merge time, same as any
two-branch dependency edit.

## Steps

Written up after the fact, at the user's explicit request to formalize what had already happened —
order below reflects what actually occurred, 2026-08-12, not a plan written in advance:

1. Set up `../n-dx-knight` worktree on `elm/jarrett/classify-elm-knight`, branched off `Jarrett`
   HEAD. `pnpm install` — confirmed `@astermind/astermind-community` already resolves (pre-existing
   root-level dependency).
2. Claimed `TJ-K1` in `BACKLOG.md`; logged the dependency-claim path correction in `IN-FLIGHT.md`.
3. Read `packages/sourcevision/src/analyzers/classify.ts` directly — independent verification, not
   trusting Archer's notes alone. Confirmed batch size, fused-call shape, confidence hardcoding, and
   evidence-hint construction all match Archer's 2026-08-11 findings exactly.
4. Noticed `scripts/elm-hello-world.mjs` reports "83% accuracy" from a call
   (`elm.train(TRAINING_SET)`) that, per the installed package's own type declarations, cannot
   accept a data array as its first argument. Wrote a controlled probe (two `ELM` instances, same
   seed, one called with real examples, one with none) — confirmed byte-identical models,
   empirically proving the argument is silently ignored. Logged in `IN-FLIGHT.md` since the
   hello-world script is a shared file and its header comment is now inaccurate.
5. Wrote `classify-elm.ts`: `extractExamples()` (re-runs `analyzeClassifications` to recover
   evidence for LLM-relabeled files rather than trusting `classifications.json` directly — see this
   ADR's Decision section for why that's necessary), `trainArchetypeELM()` (`trainFromData()` +
   manual encoding via `elm.getEncoder()`), `predictArchetype()`. Typechecks clean.
6. Wrote `eval-classify-elm.ts`: in-domain seeded 80/20 split + out-of-domain generalization eval
   via a `SV_ELM_HELDOUT_DIR` env var. Discovered both `.sourcevision/` datasets needed (n-dx and
   `AsterMind-Community-Edition`) already existed from Archer's own prior work — reused them rather
   than regenerating, both for token cost and to remove classification-run noise as a variable in
   the comparison.
7. First run: 0% coverage at every threshold in the initial 0.3-0.99 sweep. Diagnosed via a direct
   confidence-distribution probe rather than assuming a bug — recalibrated to a 0.05-0.9 sweep once
   the actual confidence scale (0.13-0.23 cluster) was visible.
8. Real run: in-domain strong (98.1% precision @ 62.4% coverage); out-of-domain does not clear the
   gate (best meaningful point 62.5% @ 17.0% coverage; full-coverage precision below majority
   baseline). Fixed a flaw in the gate-check logic itself, which initially would have reported a
   1-example, 2.1%-coverage result as a "pass" — added a minimum-coverage floor (10%).
9. **Gate: did not pass.** Stopped — did not proceed to production wiring (Archer's IMPL's
   equivalent steps 6-8). Logged the full result in `Knight.md`'s session log and reported to the
   user.
10. This document, plus `ADR-2026-08-12-knight-elm-prefilter-classify.md`, written at the user's
    explicit follow-up request to formalize what had already happened.
11. **2026-08-13.** Re-ran against newly-appeared LLM-enriched data (someone ran `ndx analyze`
    with enrichment on for both repos). Result: out-of-domain generalization got *worse*, not
    better — falsified the "just needs more data" hypothesis. Logged in the ADR's Evidence section,
    "Second measurement."
12. **2026-08-19.** User had Realm (Team Jarrett) review both `TJ-A1` and `TJ-K1`
    (`Notes/NOTE-realm-to-archer-and-knight-2026-08-19-elm-prefilter-review.md`). Findings: the
    confidence-calibration false alarm was hit independently by both implementations (not a bug);
    the evidence-for-LLM-files problem needs its own schema-gap ADR; Archer's pooling retry
    conflated two variables and couldn't isolate its result; proposed next steps in priority order
    (controlled data-volume experiment, then feature-representation fix, then bigger models).
13. **2026-08-20.** User's instruction: skip the controlled data-volume experiment, go straight at
    fixing the feature representation. Read `TextEncoder.ts` directly rather than assuming Realm's
    framing was complete — found `useTokenizer: true` doesn't produce token embeddings at all (join
    with no separator destroys word boundaries; still char-level one-hot on the result). Built
    `buildEvidenceVector()`/`trainArchetypeELMNumeric()`/`predictArchetypeNumeric()`: `classifyFile`'s
    per-archetype scores as a direct fixed-length numeric vector, concatenated with a path-only
    encoded vector.
14. **2026-08-20.** Ran the numeric representation controlled against the original text
    representation — identical data, split, seed, `hiddenUnits`. **Gate clears**: out-of-domain
    97.0% precision @ 42.3% coverage (t=0.15), vs. the text baseline's 7.7% @ 16.7% at the same
    threshold. Updated the ADR's Evidence section ("Third measurement") and this document. Did not
    proceed to Steps 6-8 — clearing the gate on one held-out codebase isn't the same decision as
    being ready to wire into production; left that call for the user.

## Test strategy

Not yet applicable — no production code touched. If/when the gate clears on richer data, the test
strategy is the same production surface as Archer's IMPL describes: unit tests on
extraction/threshold logic, an integration test on `runClassificationsPhase` asserting ELM-resolved
files never reach `callClaude`, a regression guard on classification correctness, and the same
required-green suite (`pnpm typecheck`, `pnpm test`, `tests/e2e/domain-isolation.test.js`,
`tests/e2e/architecture-policy.test.js`).

One test worth adding regardless of the gate outcome, surfaced by this session: a unit test
asserting `extractExamples()` produces non-empty evidence-derived hints for `source: "llm"` files
specifically — the exact case that silently degrades to path-only text if the
`analyzeClassifications` re-run is ever removed later as a "redundant-looking" optimization.

## Rollback

N/A — no production code touched. `classify-elm.ts` and `eval-classify-elm.ts` are inert (not
imported by any production path) until wired in. If this branch's `package.json` addition needs
reverting on its own, revert that commit and re-run `pnpm install`.

## Open questions

- [x] **Re-run `ndx analyze` with LLM enrichment on — resolved 2026-08-13.** Result was the opposite
      of the hypothesis this question was gating on: out-of-domain generalization got *worse*, not
      better. Training-data quantity was not the leading explanation.
- [x] **Feature representation vs. model capacity — resolved 2026-08-20, feature representation was
      it.** Realm's review pointed at the representation; built the fix
      (`trainArchetypeELMNumeric`); ran it controlled against the text baseline. Out-of-domain
      precision at the same threshold: 7.7% → 97.0%. See ADR "Third measurement." Model
      capacity/architecture (`hiddenUnits`, `KernelELM`) is no longer the leading open question.
- [ ] **The one that actually blocks a conclusion now: is one held-out codebase enough
      corroboration to move toward production wiring?** 78 examples, 6 archetypes, single dataset.
      Options: (a) treat it as sufficient and proceed to Steps 6-8, (b) find/generate a second,
      genuinely different held-out codebase and require the gate to clear there too before
      proceeding, (c) something else. Needs the user's call — this is a bigger decision than another
      eval run.
- [ ] **Reconciliation with `TJ-A1`:** Archer's extractor uses the same text-hint approach this
      fix replaces for `TJ-K1` — the numeric-feature fix very likely applies there too, not measured
      yet. Should this finding be shared back to Archer/Realm before either side proceeds further?
      Not resolved here — see Scope.
- [x] Why do both original `.sourcevision/` datasets had zero LLM-sourced classifications —
      **still not root-caused**, but moot for next steps now that both have been re-run with
      enrichment on.
- [ ] Same confidence-threshold question Archer's IMPL leaves open, now sharpened by measurement:
      given the observed diffuse-confidence cluster, is a single global threshold viable across all
      17 archetypes, or does calibration need to be per-archetype? Still not measured — the held-out
      set (78 examples across 6 archetypes) is too small to break down per-archetype meaningfully.
- [ ] **New, from Realm's review — independent of how the above resolves:** the
      `classifications.json` evidence-for-`source:"llm"`-files schema gap needs its own ADR. Two
      prototypes (`TJ-A1`, `TJ-K1`) have worked around it two different ways; neither is a real fix
      for future consumers of that field.
