# IMPL — Production-harden the classify.ts ELM pre-filter

- **Implements:** `ADR-2026-08-11-jarrett-elm-prefilter-classify.md`
- **Owner:** Archer (Team Jarrett)
- **Backlog item:** `TJ-A2` (builds on `TJ-A1`'s prototype/eval result — separate item because the
  scope is genuinely different: proving the approach works vs. shipping it)
- **Branch:** `elm/jarrett/classify-elm-prefilter` (continuing the existing worktree —
  `../n-dx-jarrett` — rather than cutting a new one; this is the same effort, now unblocked)
- **Worktree:** `../n-dx-jarrett`
- **Status:** Not started — this document is the plan, written before any production code changes
  per the user's explicit instruction to plan first.

## Why now, and what changed since `TJ-A1` stopped at the gate

`TJ-A1`'s original text-mode representation didn't clear the out-of-domain gate (60.9% precision
@ 29.5% coverage). Realm's 2026-08-19 review found the 2026-08-13 pooled-data retry had confounded
two variables and couldn't isolate a cause; recommended fixing the feature representation before
reaching for more data or a bigger model. On 2026-08-20 I implemented that fix — feeding
`classifyFile`'s per-archetype numeric score directly instead of as tokenized text — and it cleared
the gate for the first time (100% precision @ 59.0% coverage on `AsterMind-Community-Edition`).

**Since then, independently: Knight built the same fix in `TJ-K1` without reading my code, per
Realm's explicit ask that a striking positive result get the same scrutiny a negative one did.**
Knight's build confirms it — 97.0% precision @ 42.3% coverage on the same held-out set at the same
threshold, up from 7.7% on their text-mode baseline — and went one step further: read
`TextEncoder.ts` directly and found `useTokenizer: true` doesn't produce real token embeddings at
all (`tokenize().join('')` with no separator destroys word boundaries; it silently degrades to
char-level one-hot on the joined string). That's a sharper explanation than "text encoding is
indirect" — the text-mode path was measurably broken, not just suboptimal.

**Both `TJ-A1` and `TJ-K1` independently flagged the same residual gap before either proceeded
further:** one held-out codebase (`AsterMind-Community-Edition`) isn't full corroboration that this
generalizes broadly, just that it isn't an implementation-specific artifact — two different
codebases confirming the same result on the same held-out set rules out "bug in one build," not
"AsterMind happens to be an easy case." Both IMPLs left "is this enough to wire in" as an open
question for the user rather than deciding it themselves. The user's instruction this session
("get your project in a working state... start by writing an implementation plan") reads as that
call being made. This document proceeds on that basis, but builds in the safety margins that
residual uncertainty calls for — a feature that can be silently wrong needs an easy kill switch and
a conservative default, not just a passing eval.

## Scope

**In scope:**
- A model-lifecycle decision (see below) and its implementation — nothing in either prototype
  addressed how a trained model actually gets produced/used at real `ndx analyze` runtime, as
  opposed to a one-off script invocation.
- Widening `FileClassification.source` to include `"elm"` (schema only — `classify.ts` itself does
  not need to change; see "Why `classify.ts` stays untouched" below).
- Wiring the ELM stage into `runClassificationsPhase` (`analyze-phases.ts`), between
  `analyzeClassifications` and `enrichClassificationsWithLLM`.
- Retiring `classify-elm.ts`'s text-mode path (`fileToText`/`trainArchetypeELM`/`predictArchetype`)
  — measurably inferior and, per Knight's finding, built on a broken tokenizer assumption. Kept in
  git history, not carried into the module going forward.
- A config surface for disabling the ELM stage or overriding its confidence threshold, so this can
  be turned off in production without a code revert if the residual generalization risk shows up on
  a real project.
- Real test coverage: unit tests for the scoring/training/prediction functions, an integration test
  for the wired pipeline, and a regression check that classification correctness doesn't silently
  regress on a fixed corpus.
- Getting `pnpm build`/`pnpm typecheck`/`pnpm test` clean across the whole repo with this wired in
  — "working state" means this stops being a script run by hand with `--experimental-strip-types`
  and becomes a real part of the package's build.

**Out of scope (explicitly):**
- `OnlineELM` / continuous retraining from live `ndx analyze` runs — flagged as a plausible v2 in
  Knight's original 2026-08-11 handoff, not needed for a first working version.
- `ELMChain`/`DeepELM`/`KernelELM` — no evidence either implementation's gap is non-linear
  separability rather than the (now-fixed) input encoding.
- Testing against additional held-out codebases beyond `AsterMind-Community-Edition` before
  wiring — this is the accepted residual risk above, explicitly not closed by this IMPL. Mitigated
  by the config kill-switch and conservative default threshold instead of by more eval data.
- Applying this pattern to other classifier call sites (`assessGranularity`, `reshape-reason.ts`,
  etc.) from the original 2026-07-30 survey — each needs its own file:line-verified ADR first.
- The evidence-leakage schema-gap ADR that Realm's review flagged as still unwritten — real, but a
  separate piece of work from wiring this in.

## Design decision: how does a trained model actually exist at runtime?

Neither prototype answered this — `eval-classify-elm*.ts` trains a fresh model inside a one-off
script invocation and discards it. Production needs an actual answer. Three options:

| Option | Pros | Cons |
|---|---|---|
| **A. Train fresh every `ndx analyze` run**, using whichever classified files already exist for *this* project (from `previousClassifications` / the current run's algorithmic pass) | No model artifact to version, ship, or go stale; naturally adapts to a project's own conventions and any custom archetypes from `.n-dx.json` overrides; ELM training is millisecond-scale, so per-run cost is negligible | **Cold start**: a brand-new project's first `ndx analyze` has zero classified-file history to train on — the ELM stage has nothing to learn from until enough accumulates over successive runs |
| **B. Ship a pre-trained baseline model** bundled with the npm package, trained offline from a curated multi-codebase corpus | Works immediately, even on a project's very first run | Needs a training/release pipeline; doesn't adapt to project-specific archetype overrides without a fallback; a static bundled model can go stale relative to `archetypes.ts` changes if not retrained on release |
| **C. Hybrid** — ship a small baseline model (B) used only until a project's own history clears a minimum size (e.g. ≥30 classified files spanning ≥3 archetypes), then switch to training fresh per-run on the project's own data (A) | Works on first run *and* improves to project-specific accuracy over time; no persisted/versioned per-project model to manage — still stateless/recomputed each run past the cold-start phase | More logic than either alone; the baseline model still needs an occasional retrain as part of package releases |

**Proposing C.** It matches this codebase's existing philosophy elsewhere (zones, classifications
themselves — recomputed deterministically each run from cached inputs, not a persisted trained
artifact) once past the cold-start phase, while actually solving the cold-start gap that would
otherwise make this useless for any project's first run — which is exactly the scenario `ndx init`
users hit immediately. The baseline model's training corpus should be the multi-codebase set
already on disk from `TJ-A1`'s 2026-08-13 experiment (this repo + `AsterMind-Community-Edition` +
`express` + `indie-stack` + `zustand`) — **but retested under the numeric representation first**
(open question below): pooling was only ever measured to hurt under the *text* representation,
which we now know was separately broken by the tokenizer bug. That result may not transfer.

**Flagging for the user's confirmation before I build C**, since it's the one decision in this plan
that isn't just an engineering detail — it determines whether this ships a bundled model artifact
at all. If preferred, the simpler fallback is **A alone**: skip the cold-start case entirely (the
ELM stage no-ops — falls through everything to the LLM, exactly like today — until a project
accumulates enough history on its own). Slower to become useful, nothing to bundle or retrain.

## Why `classify.ts` stays untouched

Re-confirming this explicitly because it's easy to assume production wiring requires editing the
function being wired around: `enrichClassificationsWithLLM` and `analyzeClassifications` are both
already exported and already produce/consume the standard `Classifications`/`FileClassification`
shape. The new ELM stage is orchestrated entirely from `analyze-phases.ts`'s
`runClassificationsPhase` — it reads `analyzeClassifications`'s output, produces its own
`FileClassification[]` (`source: "elm"`), and narrows what's left before calling
`enrichClassificationsWithLLM`. No new export is needed from `classify.ts` itself. This holds for
production exactly as it held for the prototype — `classify.ts` is not in the Files-touched table
below.

## Files touched

| Path | Owning team | New/Edit | Note sent? |
|---|---|---|---|
| `packages/sourcevision/src/analyzers/classify-elm.ts` | unassigned — Team Jarrett scoped | Edit — retire text-mode functions, add model-lifecycle logic (cold-start check, baseline-model loading for option C) | No |
| `packages/sourcevision/src/analyzers/classify.ts` | unassigned — Team Jarrett scoped | **Untouched**, same as the prototype phase — see above | No |
| `packages/sourcevision/src/cli/commands/analyze-phases.ts` | unassigned — Team Jarrett scoped | Edit — call the ELM stage in `runClassificationsPhase`, between `analyzeClassifications` and `enrichClassificationsWithLLM` | No |
| `packages/sourcevision/src/schema/v1.ts`, `validate.ts` | unassigned — Team Jarrett scoped | Edit — widen `FileClassification.source` to include `"elm"` | No |
| `packages/sourcevision/src/analyzers/classify-elm-baseline-model.json` (new, only if option C) | unassigned | New — bundled pretrained baseline, generated by a training script, not hand-written | No |
| `packages/sourcevision/scripts/train-baseline-elm.ts` (new, only if option C) | unassigned | New — regenerates the bundled baseline from the multi-codebase corpus; run at release time, not at user runtime | No |
| `.n-dx.json` schema / config docs | unassigned | Edit — add `sourcevision.classification.elmPrefilter: { enabled, confidenceThreshold }` or similar | No |
| `packages/sourcevision/tests/unit/analyzers/classify-elm.test.ts` (new) | unassigned | New | No |
| `packages/sourcevision/tests/integration/*` (extend existing classification pipeline test, or new file) | unassigned | New/Edit | No |
| `tests/e2e/domain-isolation.test.js`, `architecture-policy.test.js` | **shared** per `OWNERSHIP.md` | Not edited — must stay green, not modified to accommodate this | N/A |

## Steps

1. Claim `TJ-A2` in `BACKLOG.md`; note the scope split from `TJ-A1` there.
2. **Get the user's confirmation on the model-lifecycle design** (hybrid C vs. simpler A) before
   writing code that depends on the answer — this changes the Files-touched table (whether a
   bundled-model file and training script exist at all).
3. If C is chosen: retest the 2026-08-13 multi-codebase pooling **under the numeric
   representation** before finalizing what the baseline model trains on — that pooling result was
   only ever measured under the since-discredited text representation (Knight's tokenizer finding),
   so it needs re-checking, not reuse, before it backs a shipped artifact.
4. Retire `classify-elm.ts`'s text-mode functions; keep the numeric path as the only production
   code path. Add the cold-start check (and baseline-model loading, if C).
5. Widen `FileClassification.source` in `schema/v1.ts` and `validate.ts` to include `"elm"`.
6. Wire into `runClassificationsPhase`: run the ELM stage on `analyzeClassifications`'s
   `archetype: null` output; anything at-or-above the confidence threshold is resolved
   (`source: "elm"`); shrink the set passed to `enrichClassificationsWithLLM` to the remainder,
   exactly as today for everything below threshold.
7. Add the `.n-dx.json` config surface (enable/disable, threshold override) and read it in step 6's
   wiring — this is the kill switch the residual-risk acceptance above depends on.
8. Write unit tests: score-vector computation against known archetype patterns, threshold gating
   (never resolves below the configured threshold), cold-start behavior (no-ops correctly with
   insufficient history when option A / baseline-model path when option C), schema validation for
   the new `"elm"` source value.
9. Write an integration test: run `runClassificationsPhase` end-to-end with the ELM stage active on
   a fixture project; assert files it resolves never reach `callClaude`; assert everything below
   threshold still does, byte-identical to today's behavior for that population.
10. Regression check: classification correctness on a fixed corpus (this repo's own `.sourcevision/`
    data is a reasonable fixture) must not regress relative to algorithmic+LLM-only — this is the
    test that would catch a silently-wrong high-confidence ELM resolution, the actual failure mode
    the residual-risk acceptance is exposed to.
11. `pnpm build && pnpm typecheck && pnpm test` clean across the whole repo, not just sourcevision.
12. Update the ADR's Status to Accepted, referencing this IMPL. Reply to Knight/Realm acknowledging
    the cross-verification (Knight's `TJ-K1` confirmation is what unblocks this IMPL existing at
    all) and pointing at this document.
13. Open a PR per the org ADR's branch+PR rule — this is real production code, not the docs-only
    exception used earlier.

## Test strategy

- **Unit:** `scoreArchetypeVector` against known signal patterns (deterministic, easy to fixture);
  confidence-threshold gating never resolves below the configured value; cold-start / baseline-model
  branch logic; `"elm"` source value schema validation.
- **Integration:** full `runClassificationsPhase` run with the ELM stage active — resolved files
  never reach `callClaude`; below-threshold files behave identically to the pre-ELM pipeline.
- **Regression:** fixed-corpus classification correctness must not regress — this is the test that
  actually stands in for the "only one held-out codebase" risk being accepted above; it won't catch
  a codebase this specific corpus doesn't resemble, but it will catch drift on this one.
- Must stay green, unmodified: `pnpm typecheck`, `pnpm test`, `tests/e2e/domain-isolation.test.js`
  (gateway rules — this module must not create a new cross-package import), `
  tests/e2e/architecture-policy.test.js` (tier rules).

## Rollback

Two levels, because this is now real production code, not a side script:
- **Fast, no revert needed:** the `.n-dx.json` config kill switch (step 7) disables the ELM stage;
  `enrichClassificationsWithLLM` receives the full unclassified set again, exactly as before this
  IMPL. This is the mechanism the residual-risk acceptance above actually depends on — it must ship
  in the same PR as the wiring, not as a follow-up.
- **Full revert:** revert the `analyze-phases.ts` wiring commit and the schema widening commit. No
  data migration needed — nothing here writes a `.sourcevision/` shape the pre-ELM pipeline doesn't
  already own, and `source: "elm"` entries are just `FileClassification` objects like any other.

## Open questions

- [ ] **Model lifecycle: hybrid (C) or train-fresh-only (A)?** Blocks step 3 onward — see Design
      decision section. Needs the user's call before more code gets written against one assumption.
- [ ] **If C: does multi-codebase pooling actually help under the numeric representation?** Not
      measured — the only pooling data point we have (2026-08-13) was under the text representation
      Knight has since shown was separately broken. Needs its own controlled re-run before backing
      a shipped baseline model with it.
- [ ] **Confidence threshold default:** both `TJ-A1` (t≈0.11-0.17) and `TJ-K1` (t=0.15) cleared the
      gate in a similar range on the same held-out set, but this was tuned by eyeballing a
      precision/coverage curve on one dataset, not a principled default. Ship a conservative
      (higher) default than the eval-optimal point, given the residual generalization risk?
- [ ] **Per-archetype vs. global threshold** — flagged in both prototypes' IMPLs, still unmeasured;
      the held-out sets are too small (47-78 examples across 6 archetypes) to break down reliably.
      Worth revisiting once real production usage accumulates a larger sample.
- [ ] **The evidence-leakage schema-gap ADR** (Realm's review, still unwritten) — independent of
      this IMPL, but touches the same `classifications.json` shape. Should it land before or after
      this ships?
