# IMPL — Take the classify.ts ELM pre-filter from proven prototype to shipped, working state

- **Implements:** `ADR-2026-08-11-jarrett-elm-prefilter-classify.md` (Archer) and
  `ADR-2026-08-12-knight-elm-prefilter-classify.md` (Knight) — both now have a measured,
  gate-clearing result; this IMPL is the plan for converging them into one production change,
  not a third competing prototype.
- **Owner:** Knight (Team Jarrett)
- **Backlog item:** `TJ-K1` (existing; this is `TJ-K1`'s next phase, not a new item)
- **Branch:** TBD — see Step 0. Current prototype work sits on `elm/jarrett/classify-elm-knight`
  (`../n-dx-knight`), diverged from both the shared `Jarrett` branch and Archer's
  `elm/jarrett/classify-elm-prefilter`.
- **Status:** Not started — this document is the plan, written before execution, per the user's
  explicit request. Nothing below has been done yet except the research it's based on.

## Why this document exists

The user's ask: get this into a working state "much like how the original n-dx does" — i.e., not
another eval run, but a real, tested, wired-in feature that meets the same bar as the rest of this
codebase. That's a materially bigger step than anything either prototype has done so far, so it
gets its own plan before any code changes, per the user's instruction.

## Where things actually stand right now (checked fresh, not assumed)

Both independent implementations now have a result that clears the ADR's gate:

| | Knight (`TJ-K1`, 2026-08-20) | Archer (`TJ-A1`, 2026-08-20) |
|---|---|---|
| Feature representation | Evidence vector (17-dim) **concatenated with** a path-only encoded vector | **Pure** evidence vector (17-dim), `NumericConfig`, no path text at all |
| Evidence source | Calls the real `analyzeClassifications()` — no duplicated logic | **Reimplements** `classifyFile`'s signal-matching independently (self-flagged tradeoff: "duplicated logic that can drift... would need reconciling for production") |
| Out-of-domain best point | 100% @ 30.8% coverage (t=0.18) | **100% @ 59.0% coverage** (t=0.11-0.17) — meaningfully higher coverage |
| Sanity-checked against a degenerate majority-class artifact? | Not explicitly (implied by per-threshold breakdown) | Yes, explicitly — 5 distinct predicted labels, zero wrong |

**This IMPL's starting premise, not yet executed:** Archer's coverage is better, but her extraction
duplicates `classify.ts` logic — something both of us and the ADR's own "Harder" consequences
section already flagged as a real maintenance risk (drifts silently if `classifyFile`'s regexes
change). My extraction avoids that by calling the real function, but hasn't been tested with her
*pure*-numeric composition (mine still concatenates path text). Neither of us has isolated
*composition* (pure evidence vs evidence+path) from *extraction method* (reimplemented vs reused) —
they've been changed together across the two builds. That's exactly the kind of confound Realm's
review called out in the 2026-08-13 pooling retry, just in a different pair of variables. Step 2
below fixes that before anything gets called "final."

**Also unresolved, from Realm's 2026-08-19 review, item 4:** the `classifications.json`
evidence-for-`source:"llm"`-files schema gap. Both production-candidate designs sidestep it (both
recompute evidence fresh rather than trusting the persisted field), so it's not a blocker for this
IMPL — but it's still a real defect for any *other* future consumer of that field. Deferred to its
own ADR, tracked as an open question below, not silently dropped.

## Scope

**In scope:**
1. Report the independent-verification result back to Archer/Realm (Realm's outstanding ask —
   already satisfied by the 2026-08-20 work, just not yet communicated).
2. One more controlled experiment to settle feature composition (pure evidence vs evidence+path),
   holding extraction method fixed at "reuse `analyzeClassifications`" — isolates the one variable
   neither prototype isolated.
3. A single production-track branch, reconciling (not literally git-merging) the two prototype
   branches into one canonical implementation.
4. Model training/versioning strategy — neither prototype addressed this, and it's a real gap: a
   CLI tool can't retrain an ELM inside every `ndx analyze` call against a live corpus. Needs a
   decision on where a trained model lives and how it gets refreshed.
5. Actual production wiring: `"elm"` added to `FileClassification.source`, a
   `classifyWithELM()` module matching `enrichClassificationsWithLLM`'s return shape, wired into
   `runClassificationsPhase` between the algorithmic and LLM stages — exactly as both ADRs'
   Decision sections already specify.
6. Tests: unit, integration, regression guard, per both IMPLs' existing (not yet executed) Test
   strategy sections.
7. Full green run of this repo's required suites before calling it done.

**Explicitly out of scope for this IMPL:**
- The evidence-for-LLM-files schema-gap ADR (Realm's item 4) — real, but separable; tracked as an
  open question, not blocking.
- `ELMChain`/`DeepELM`/`KernelELM`/`OnlineELM` — no evidence yet that base ELM's linear
  separability is the bottleneck; if anything, the numeric-representation result argues *against*
  needing them right now.
- Reconciling `OWNERSHIP.md`'s team-wide worktree-vs-shared-checkout question — orthogonal to this
  work.
- Deciding `TJ-A1` vs `TJ-K1` as "the" implementation in some competitive sense — the point of
  Step 2 is to converge on one production design informed by both, not to pick a winner.

## Files touched (planned — none edited yet)

| Path | Owning team | New/Edit | Note sent? |
|---|---|---|---|
| `packages/sourcevision/src/analyzers/classify-elm.ts` | unassigned — Team Jarrett scoped | **Edit** — converge on final feature representation per Step 2's result | No |
| `packages/sourcevision/src/analyzers/classify.ts` | unassigned — Team Jarrett scoped | **Edit** — add `classifyWithELM()` or a sibling module; `"elm"` becomes a valid `source` value consumers of this file need to know about | No |
| `packages/sourcevision/src/cli/commands/analyze-phases.ts` | unassigned — Team Jarrett scoped | **Edit** — insert the ELM stage in `runClassificationsPhase`, per both ADRs' Decision sections | No |
| `packages/sourcevision/src/schema/v1.ts`, `validate.ts` | unassigned — Team Jarrett scoped | **Edit** — widen `FileClassification.source` union | No |
| A trained-model artifact (path TBD — see Step 3) | unassigned | **New** | No |
| A model-(re)training script (path TBD — see Step 3) | unassigned | **New** | No |
| `packages/sourcevision/tests/**` | unassigned | **New** — unit + integration tests | No |
| `Claude-Context/Jarrett-Agents/{Archer,Knight,Realm}.md`, `BACKLOG.md`, `IN-FLIGHT.md` | Team Jarrett / shared | **Edit** — report verification, log convergence decision | Yes — this is exactly the kind of cross-agent-affecting change `IN-FLIGHT.md` exists for |

## Steps

**Step 0 — Branch reconciliation (do first, before any code).** Three branches currently hold
relevant, uncommitted-to-`main` work: `Jarrett` (shared docs, has Realm's and Archer's latest
commits my branch doesn't), `elm/jarrett/classify-elm-prefilter` (Archer's code),
`elm/jarrett/classify-elm-knight` (mine). Plan: sync my branch to current `Jarrett` HEAD first
(bringing in Realm's review, Archer's latest ADR updates, and — per `GITHUB-WORKFLOW.md` — `git
fetch --all` before comparing anything, not a single-remote fetch). Do **not** attempt a code merge
of Archer's branch — her extraction method is being deliberately not carried forward (see Scope);
pulling her commits in would import the duplication she already flagged as a tradeoff. Production
work happens on my branch post-sync, informed by reading her code, not by merging it.

**Step 1 — Report the verification back.** Reply to
`Notes/NOTE-realm-to-archer-and-knight-2026-08-20-management-role.md`: my 2026-08-20 run already
satisfies Realm's ask (same original 2-codebase data, independent build, clears the gate:
100%@30.8%cov best point). State this plainly rather than re-running something already done. Update
`BACKLOG.md`'s `TJ-K1` row and `Knight.md` to reflect it.

**Step 2 — Isolate feature composition from extraction method.** Using my extraction (reused
`analyzeClassifications`, no duplicated logic), run both compositions — pure evidence vector, and
evidence+path concatenated — controlled, same data/split/seed. This is the one remaining unisolated
variable between the two prototypes. Whichever wins (or if they're statistically indistinguishable
at this sample size, which is itself worth stating plainly) becomes the production representation.

**Step 3 — Decide model training/versioning strategy.** Not addressed by either prototype. Options
to evaluate, not yet decided:
- **Train-once, ship a serialized artifact** (`ELM.saveModelAsJSONFile`/`loadModelFromJSON` already
  exist on the base class) — checked into the repo, loaded at runtime, retrained via an explicit
  script when `archetypes.ts` changes or accuracy drifts. Simple, fast at runtime, but needs a
  retraining trigger/discipline so it doesn't silently go stale.
  - **Model provenance for a checked-in artifact — the specific risk to resolve before choosing
    this:** a serialized model trained on this repo's own file paths is training data that ships
    inside the tool every user runs `ndx analyze` with. Needs an explicit answer on what the
    training corpus actually is before this path is taken — n-dx's own repo (raises the "the tool
    ships biased toward its own conventions" question the ADR's held-out testing was designed to
    catch), a synthetic/anonymized corpus, or something else.
- **Train on first use per-project**, cached in `.sourcevision/`. Adapts to the actual project but
  needs its own labeled corpus per project — most projects won't have one until *after*
  `enrichClassificationsWithLLM` has already run, which is circular for a pre-filter meant to run
  *before* that stage.
- **Ship a pre-trained artifact, allow opt-in per-project fine-tuning** — most complete, most
  scope. Likely too much for this IMPL; flagged as a possible v2 rather than blocking v1.

This needs a decision before Step 4 can start for real — flagged as the first open question below
rather than picked unilaterally here.

**Step 4 — Production wiring**, per both ADRs' Decision sections (neither existing function
modified; the new stage reads `analyzeClassifications`'s output and narrows
`enrichClassificationsWithLLM`'s input):
1. Add `"elm"` to `FileClassification.source` in `schema/v1.ts` and `validate.ts`.
2. Build the production inference module — `classifyWithELM(files): FileClassification[]`, same
   return shape `enrichClassificationsWithLLM` already produces, confidence threshold from Step 2's
   measured curve (not a guess — pick the point where precision is comfortably above the 95% bar
   with the best coverage tradeoff, e.g. around the 0.15-0.18 range both prototypes independently
   converged on, pending Step 2's exact number).
3. Wire the new call into `runClassificationsPhase` (`analyze-phases.ts`), between
   `analyzeClassifications` and `enrichClassificationsWithLLM`: ELM resolves what it can above
   threshold, shrinks `unclassified` to its own low-confidence remainder before the LLM stage runs.

**Step 5 — Tests**, per both IMPLs' Test strategy sections (neither executed yet):
- Unit: extraction/feature-vector correctness, confidence-threshold logic (never silently resolves
  below threshold), schema validation for `"elm"`.
- Integration: `runClassificationsPhase` end-to-end with the ELM stage active — assert
  ELM-resolved files never reach `callClaude`; assert below-threshold files still do, unchanged.
- Regression guard: classification correctness on a fixed corpus doesn't regress vs. the
  algorithmic+LLM-only baseline.
- The specific test both IMPLs flagged as worth adding regardless of outcome: evidence-vector
  construction produces real (non-zero-vector) signal for `source: "llm"` files specifically, not
  just `source: "algorithmic"` ones — the case that silently degrades if the `analyzeClassifications`
  re-run is ever "optimized away" later.

**Step 6 — Full-suite validation.** `pnpm typecheck`, `pnpm test`,
`tests/e2e/domain-isolation.test.js` (confirm the ELM module doesn't create a new cross-package
import — `@astermind/astermind-community` is sourcevision's own direct dependency now, not routed
through a gateway, which should be fine since sourcevision doesn't import *from* another n-dx
package here, but worth the explicit check), `tests/e2e/architecture-policy.test.js` (sourcevision
stays inside its tier). All must be green before Step 7.

**Step 7 — PR.** Per the org ADR (`ADR-2026-08-05-nolan-...`), substantive work goes through a
branch + PR reviewed by a different lead — not the docs-only exception. Requires the user's
go-ahead on base branch and reviewer before opening it; not assumed here.

## Test strategy

Covered inline in Step 5 above — not restated separately, per this template's own guidance to avoid
restating an ADR section verbatim elsewhere in a doc.

## Rollback

Revert the `analyze-phases.ts` call-site commit — `enrichClassificationsWithLLM` receives the full
unclassified set again, exactly as before. If a model artifact was added, it's inert without the
call site wired in; remove it in the same revert. No `.sourcevision/` state shape changes beyond
the new `"elm"` source value, which is additive to the schema, not a breaking change to existing
data.

## Open questions

- [ ] **Model training/versioning strategy (Step 3) — needs a decision before Step 4 can start.**
      See the three options sketched there. This is the one part of "get it working" that neither
      prototype touched at all.
- [ ] **Branch strategy for Step 0** — sync-then-build-alone (this document's assumption), or
      something more collaborative with Archer/Realm given this is now a convergence, not a solo
      build? Affects who reviews the eventual PR.
- [ ] **The evidence-for-LLM-files schema gap** (Realm's item 4) — still needs its own ADR
      independent of this work. Not blocking, but shouldn't get lost a third time.
- [ ] Confidence-threshold calibration: single global threshold across all archetypes, or
      per-archetype? Flagged in both prior IMPLs, still not measured — the held-out sets so far
      are too small to break down per-archetype meaningfully. Worth a real answer before Step 4.2
      picks a production number, or an explicit "global threshold, revisit if per-archetype
      evidence shows up later" decision.
