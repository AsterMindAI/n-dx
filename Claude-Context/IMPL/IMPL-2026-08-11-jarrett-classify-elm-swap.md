# IMPL — Add ELM pre-filter stage to classify.ts's LLM fallback

- **Implements:** `ADR-2026-08-11-jarrett-elm-prefilter-classify.md`
- **Owner:** Archer (Team Jarrett)
- **Backlog item:** `TJ-A1`
- **Branch:** `elm/jarrett/classify-elm-prefilter`
- **Worktree:** `../n-dx-jarrett` — pending `OWNERSHIP.md`'s unresolved worktree-vs-shared-checkout
  decision (see Open questions)
- **Status:** Not started — ADR is Proposed, not Accepted; Step 5's gate must pass before this goes
  further than the prototype/eval script

## Scope

**In scope:**
- Committed training-data extraction + eval script producing the ADR's Evidence numbers (seed,
  split, random baseline, measured accuracy).
- ELM inference module wrapping AsterMind's base `ELM` (text mode) for archetype classification.
- One new call in `runClassificationsPhase` (`analyze-phases.ts`), between `analyzeClassifications`
  and `enrichClassificationsWithLLM`, shrinking the `unclassified` set passed to the LLM stage.
- Confidence-threshold calibration and a `"elm"` addition to `FileClassification.source`.

**Out of scope (explicitly):**
- Replacing or modifying the LLM fallback itself — it stays the source of truth for whatever the
  ELM isn't confident about.
- `ELMChain`/`DeepELM`/`KernelELM` — only revisited if the base-ELM held-out accuracy doesn't clear
  the ADR's bar (see ADR Alternatives considered).
- `OnlineELM` / continuous retraining from live `ndx analyze` runs — Knight flagged this as a
  plausible v2 in the 2026-08-11 handoff, not part of this IMPL.
- Any change to `classifyError` (Hench) or the other classifier call sites from the 2026-07-30
  survey (`assessGranularity`, `reshape-reason.ts`, etc.) — each of those needs its own
  file:line-verified ADR per the fused-call caveat before an ELM swap is proposed there.

## Files touched

| Path | Owning team | New/Edit | Note sent? |
|---|---|---|---|
| `packages/sourcevision/src/analyzers/classify-elm.ts` (new) | unassigned — Team Jarrett scoped | New | No — not another team's path |
| `packages/sourcevision/src/analyzers/classify.ts` | unassigned — Team Jarrett scoped | Edit — add `"elm"` source, export training-data helper | No |
| `packages/sourcevision/src/cli/commands/analyze-phases.ts` | unassigned — Team Jarrett scoped | Edit — call new stage in `runClassificationsPhase` | No |
| `packages/sourcevision/src/schema/v1.ts`, `validate.ts` | unassigned — Team Jarrett scoped | Edit — widen `FileClassification.source` union | No |
| Eval script (path TBD — likely `packages/sourcevision/scripts/eval-classify-elm.ts`) | unassigned | New | No |
| `package.json` / `pnpm-lock.yaml` (sourcevision, if an AsterMind package is added) | **shared** per `OWNERSHIP.md` | Edit | **Yes — claim `IN-FLIGHT.md` § 1 before touching, regardless of scope** |

## Steps

1. Claim `IN-FLIGHT.md` § 1 for `package.json`/`pnpm-lock.yaml` before adding any new dependency —
   these are shared regardless of how team scopes end up assigned.
2. Create the branch/worktree once `OWNERSHIP.md`'s worktree-vs-shared-checkout question is
   answered (see Open questions) — `git worktree add ../n-dx-jarrett -b elm/jarrett/classify-elm-prefilter`
   if worktree isolation is chosen, plain branch checkout otherwise.
3. Write the training-data extraction: pull `(path, evidence signals) → archetype` pairs from
   existing `.sourcevision/classifications.json` outputs — this repo plus at least one other
   already-analyzed codebase, to avoid overfitting to n-dx's own naming conventions.
4. Write the committed eval script: fixed seed, train/held-out split, random-baseline computation,
   trained-ELM held-out accuracy. This produces the numbers that fill in the ADR's Evidence
   section.
5. **Gate.** Only proceed past this point if measured accuracy clears the random baseline by the
   ADR's stated margin. If it doesn't, stop and report back with the numbers — per
   `ADR-TEMPLATE.md`, a negative result needs the same Evidence rigor as a positive one, and this
   IMPL does not proceed on one.
6. Wrap the trained model as `classify-elm.ts` — load the model, expose a
   `classifyWithELM(files): FileClassification[]` matching the shape
   `enrichClassificationsWithLLM` already returns.
7. Add `"elm"` to the `FileClassification.source` union in schema (`v1.ts`, `validate.ts`).
8. Wire into `runClassificationsPhase` (`analyze-phases.ts`), between `analyzeClassifications` and
   `enrichClassificationsWithLLM`: run the ELM stage first, shrink `unclassified` to the ELM's own
   low-confidence remainder before the LLM stage runs on what's left.
9. Update the ADR's Evidence section with the real numbers from step 4; flip Status to Accepted if
   step 5's gate passed.
10. Open a PR per the org ADR's branch+PR rule — this is substantive work, not the docs-only
    exception the September migration commit used.

Order matters at steps 3-5 specifically: the eval has to run and pass its gate *before* any
production wiring (steps 6-8), so a negative result costs a script, not a half-integrated feature.

## Test strategy

- **Unit:** training-data extraction (feature/label pairing correctness), confidence-threshold
  logic (never silently resolves below threshold), `FileClassification.source` schema validation
  for the new `"elm"` value.
- **Integration:** `runClassificationsPhase` end-to-end with the ELM stage active — assert files it
  resolves never reach `callClaude`; assert everything below threshold still does, unchanged from
  today's behavior.
- **Regression guard:** classification correctness on a fixed corpus must not regress relative to
  the algorithmic+LLM-only baseline. This is the test that would catch the "ELM confidently wrong"
  failure mode — the same class of risk Knight flagged for `classifyError`'s retry-safety question.
- Must stay green: `pnpm typecheck`, `pnpm test`, `tests/e2e/domain-isolation.test.js` (gateway
  rules — the ELM module must not create a new cross-package import path), `tests/e2e/architecture-policy.test.js`
  (sourcevision stays inside its tier).

## Rollback

Revert the `analyze-phases.ts` call-site commit — `enrichClassificationsWithLLM` receives the full
unclassified set again, exactly as before. No data migration needed: `classify-elm.ts` doesn't
write any `.sourcevision/` state shape the LLM path doesn't already own. If a new npm dependency
was added, revert that `package.json`/lockfile change too and re-run `pnpm install`.

## Open questions

- [ ] **Confidence threshold:** what makes an ELM resolution safe to skip the LLM entirely — mirror
      `classifyFile`'s `PRIMARY_THRESHOLD`/`SECONDARY_THRESHOLD` (0.4/0.3), or calibrate separately
      from held-out data? Affects step 6.
- [ ] **Dependency shape:** does this resolve to `@astermind/astermind-elm` (npm, per Knight's ELM
      integration note) or a vendored copy of `AsterMind-Community-Edition/src/core/ELM.ts`?
      Changes the `package.json` Files-touched row and whether step 1's `IN-FLIGHT.md` claim is
      even needed.
- [ ] **Second codebase for the held-out split:** which one, and does it already have
      `.sourcevision/` classifications, or does this IMPL need to run `ndx analyze` on it first as
      a prerequisite to step 3?
- [ ] **Worktree isolation or shared checkout:** blocks step 2 until `OWNERSHIP.md`'s unresolved
      question (§ Untracked-state hazard) is answered by the team.
- [ ] **Acceptance margin over random baseline:** the ADR says "a stated margin," not a number —
      needs a number before step 5's gate is checkable.
