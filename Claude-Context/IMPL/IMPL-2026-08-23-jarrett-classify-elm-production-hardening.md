# IMPL — Production-harden the classify.ts ELM pre-filter

- **Implements:** `ADR-2026-08-11-jarrett-elm-prefilter-classify.md`
- **Owner:** Archer (Team Jarrett)
- **Backlog item:** `TJ-A2` (builds on `TJ-A1`'s prototype/eval result — separate item because the
  scope is genuinely different: proving the approach works vs. shipping it)
- **Branch:** `elm/jarrett/classify-elm-prefilter` (continuing the existing worktree —
  `../n-dx-jarrett` — rather than cutting a new one; this is the same effort, now unblocked)
- **Worktree:** `../n-dx-jarrett`
- **Status:** Steps 1-7 done, wired and real, but shipped **opt-in, not opt-out** — Step 4's
  smoke test (2026-08-27, not another eval-script run — the actual `runClassificationsPhase` code
  path against this repo's real `ndx analyze`) found that 100% of unclassified files across every
  gathered corpus have zero evidence signal, meaning the numeric feature vector is identically
  all-zero for the exact population this stage exists to help, and the ELM cannot discriminate
  between them regardless of threshold. See ADR Evidence, "Zero-evidence population." Steps 8-10
  (test coverage, full validation, ADR→Accepted) continue, but Accepted no longer means "ship
  enabled by default" until a representation fix is validated — see Open questions.

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

**Decision: C, confirmed by the user 2026-08-24.** It matches this codebase's existing philosophy
elsewhere (zones, classifications themselves — recomputed deterministically each run from cached
inputs, not a persisted trained artifact) once past the cold-start phase, while actually solving
the cold-start gap that would otherwise make this useless for any project's first run — which is
exactly the scenario `ndx init` users hit immediately.

**Baseline model corpus, resolved 2026-08-24:** the multi-codebase set from `TJ-A1`'s 2026-08-13
experiment (this repo + `AsterMind-Community-Edition` + `express` + `indie-stack` + `zustand`) —
retested under the numeric representation first, as planned. Result: pooling is neutral on the
measured out-of-domain metric (identical 100%@59.0% with or without it) but adds 2 archetype
categories (`middleware`, `model`) otherwise absent — net positive for a shipped baseline meant to
cover a cold-start project's *first* run, where broader coverage matters more than optimizing one
held-out number. Ships trained on the pooled 5-codebase corpus. See ADR Evidence,
"Reconciling `TJ-A1`/`TJ-K1`'s divergent extraction methods," for the numbers.

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

1. **Done.** Claimed `TJ-A2` in `BACKLOG.md`.
2. **Done, 2026-08-24.** User confirmed hybrid model lifecycle (option C).
3. **Done, 2026-08-24/27.** Retested pooling under the numeric representation — neutral, not
   harmful (see ADR Evidence). Baseline model trained on the pooled 5-codebase corpus, real
   artifact generated (`classify-elm-baseline-model.json`, 686 examples, 16 categories).
4. **Done, 2026-08-27.** Retired text-mode functions; added `hasEnoughHistoryForFreshTraining`
   (cold-start gate) and `loadBaselineArchetypeELM`/`getArchetypeELM` (baseline loading + unified
   entry point). **Extended beyond the original plan**: found via smoke-testing that the cold-start
   gate needed a minimum count of `source: "llm"` examples specifically, not just any-source
   volume — a purely-algorithmic training set calibrates confidence differently (see ADR Evidence,
   "Zero-evidence population").
5. **Done, 2026-08-27.** Widened `FileClassification.source` to include `"elm"` in `schema/v1.ts`
   and `validate.ts`.
6. **Done, 2026-08-27.** Wired `getArchetypeELM`/`classifyWithELM` into `runClassificationsPhase`,
   between `analyzeClassifications` and `enrichClassificationsWithLLM`, via `sourcevision-core.ts`
   (this package's internal gateway pattern) — `classify.ts` itself untouched.
7. **Done, 2026-08-27, but with a change from the original plan.** Added
   `sourcevision.classification.elmPrefilter.{enabled,confidenceThreshold}` to `.n-dx.json`.
   **`enabled` defaults to `false` (opt-in), not `true`** — the residual-risk kill switch this step
   was meant to provide turned out to be necessary immediately, not just as a hedge: see ADR
   Evidence, "Zero-evidence population," found via real smoke-testing at this exact step, not a
   separate eval run.
8. Write unit tests: score-vector computation against known archetype patterns, threshold gating
   (never resolves below the configured threshold), cold-start behavior including the new
   LLM-example-count gate, schema validation for the new `"elm"` source value, **and a fixture
   covering the zero-evidence case specifically** (a file with no matched signals must never
   resolve, regardless of threshold — this is now a required regression guard, not an edge case).
9. Write an integration test: run `runClassificationsPhase` end-to-end with the ELM stage active on
   a fixture project; assert files it resolves never reach `callClaude`; assert everything below
   threshold still does, byte-identical to today's behavior for that population; **assert the
   stage no-ops entirely when `elmPrefilter.enabled` is unset (the new default)**.
10. Regression check: classification correctness on a fixed corpus (this repo's own `.sourcevision/`
    data is a reasonable fixture) must not regress relative to algorithmic+LLM-only.
11. `pnpm build && pnpm typecheck && pnpm test` clean across the whole repo, not just sourcevision.
12. Update the ADR's Status once a representation fix for the zero-evidence population is validated
    — not before. Reply to Knight/Realm with the finding, since it likely affects `TJ-K1`'s
    composition-vs-extraction open question directly (see Open questions).
13. Open a PR per the org ADR's branch+PR rule once the above lands — this is real production code,
    landing opt-in, not the docs-only exception used earlier.

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

- [x] **Model lifecycle: hybrid (C) or train-fresh-only (A)? — resolved 2026-08-24, user confirmed
      hybrid (C).** Unblocks step 3 onward.
- [x] **If C: does multi-codebase pooling actually help under the numeric representation? —
      resolved 2026-08-24.** Re-ran the pooling experiment under the numeric representation
      (Knight's contribution to the eval script, `SV_ELM_EXTRA_TRAINING_DIRS`): out-of-domain result
      is identical with or without pooling (100% @ 59.0% coverage either way) — **neutral, not
      harmful**, unlike the sharp regression pooling caused under the (since-shown-broken) text
      representation. Doesn't move this specific metric, but adds 2 archetype categories
      (`middleware`, `model`) the 2-codebase set has zero examples of. **Decision: the bundled
      cold-start baseline model (option C) should train on the pooled 5-codebase corpus** — costs
      nothing on the measured metric and buys broader archetype coverage for projects whose first
      run needs the baseline. See ADR Evidence, "Reconciling `TJ-A1`/`TJ-K1`'s divergent extraction
      methods."
- [x] **Confidence threshold default — resolved 2026-08-24 by
      `ADR-2026-08-24-realm-elm-primary-classifier-pivot.md`.** Ship the coverage-favoring end of
      the verified range (t≈0.11–0.15), not the conservative/high end this question was leaning
      toward — the ELM is now the primary resolver for the hard-case population, not a narrow
      pre-filter, and Realm's independent reproduction of both `TJ-A1` and `TJ-K1`'s actual
      committed eval scripts (2026-08-24, third independent confirmation) is treated as sufficient
      to lean on the result rather than hedge against it further. The `.n-dx.json` kill switch
      (step 7) is what the residual single-held-out-codebase risk now depends on operationally —
      see that ADR's Consequences section. Step 7 should wire this default in when implemented.
- [ ] **Per-archetype vs. global threshold** — now secondary to the zero-evidence finding below; no
      threshold, global or per-archetype, helps a population with no per-file signal to threshold
      on. Revisit only after a representation fix is validated.
- [ ] **The evidence-leakage schema-gap ADR** (Realm's review, still unwritten) — independent of
      this IMPL, but touches the same `classifications.json` shape. Should it land before or after
      this ships?
- [ ] **New, 2026-08-27 — the actual blocker now: what feature representation works on
      zero-evidence files?** See ADR Evidence, "Zero-evidence population" — 100% of the real target
      population has an all-zero numeric vector under the current representation. Candidates, none
      measured yet: (a) Knight's `TJ-K1` composition (evidence vector concatenated with a
      path-only encoded vector) — path text is never empty, worth trying first since it already
      exists in a validated form, just not validated *for this specific population*; (b) some other
      numeric encoding of the path/filename itself, avoiding a return to the measurably-worse
      tokenized-text approach wholesale; (c) accept that this population is fundamentally
      LLM-only territory and scope the ELM pre-filter to a narrower, honestly-described role
      (resolving files with *weak-but-nonzero* signal, not all algorithmic-pass failures). Needs a
      real measurement against zero-evidence files specifically before any of these gets chosen —
      not another measurement against the same easier held-out population every prior eval used.
- [ ] **`elmPrefilter.enabled` defaults to `false` now — when, if ever, does that flip?** Not
      before a fix from the question above is validated against the zero-evidence population
      specifically. Flagging so a future session doesn't flip the default back to `true` on the
      strength of the pre-2026-08-27 numbers alone.
