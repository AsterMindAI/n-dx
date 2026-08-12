# IMPL — Add ELM pre-filter stage to classify.ts's LLM fallback

- **Implements:** `ADR-2026-08-11-jarrett-elm-prefilter-classify.md`
- **Owner:** Archer (Team Jarrett)
- **Backlog item:** `TJ-A1`
- **Branch:** `elm/jarrett/classify-elm-prefilter`
- **Worktree:** `../n-dx-jarrett` — adopted 2026-08-12 for this agent's own work (Knight is
  starting a parallel implementation per the same ADR; isolating `.sourcevision/` state removes the
  exact collision class `OWNERSHIP.md` warns about). The cross-team-wide worktree-vs-shared-checkout
  decision is still formally open — this is a per-agent choice made under that section's "claim
  generously" guidance, not a resolution of the team-wide question.
- **Status:** In progress — prototype/eval step underway. ADR is Proposed, not Accepted; Step 5's
  gate must pass before this goes further than the eval script.

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
| `packages/sourcevision/src/analyzers/classify.ts` | unassigned — Team Jarrett scoped | **Not yet edited.** Prototype/eval phase reads its exported types only; the `"elm"` source value and any export addition happen at Step 7, after the Step 5 gate passes. | No |
| `packages/sourcevision/src/cli/commands/analyze-phases.ts` | unassigned — Team Jarrett scoped | **Not yet edited.** The in-between call is wired at Step 8, gated — see ADR "Decision": neither existing function is modified, the new stage only reads `analyzeClassifications`'s output and narrows `enrichClassificationsWithLLM`'s input. | No |
| `packages/sourcevision/src/schema/v1.ts`, `validate.ts` | unassigned — Team Jarrett scoped | **Not yet edited.** Step 7, gated. | No |
| `packages/sourcevision/scripts/eval-classify-elm.ts` (new — path finalized 2026-08-12) | unassigned | New | No |
| `packages/sourcevision/package.json` / root `pnpm-lock.yaml` — adds `@astermind/astermind-community` (resolved 2026-08-12, see ADR Evidence) | **shared** per `OWNERSHIP.md` | Edit | **Claimed `IN-FLIGHT.md` § 1 2026-08-12** |

## Steps

1. **Done (2026-08-12).** Claimed `IN-FLIGHT.md` § 1 for `packages/sourcevision/package.json` /
   root `pnpm-lock.yaml` before adding `@astermind/astermind-community`.
2. **Done (2026-08-12).** `git worktree add ../n-dx-jarrett -b elm/jarrett/classify-elm-prefilter`
   — adopted worktree isolation for this agent's own work given the concrete Knight-parallel-work
   scenario (see Worktree field above); team-wide decision still separately open.
2b. **Prerequisite, not yet run:** neither this repo nor the chosen held-out codebase
   (`AsterMind-Community-Edition`) has `.sourcevision/classifications.json` yet (confirmed
   2026-08-12). Both need `ndx analyze` run before step 3 can pull real data — this is a real,
   LLM-calling, potentially slow operation, not scaffolding; flagged separately rather than folded
   silently into step 3.
3. Write the training-data extraction: pull `(path, evidence signals) → archetype` pairs from
   `.sourcevision/classifications.json` — this repo (training source) plus
   `AsterMind-Community-Edition` (held-out set, chosen over the other `GitHub/n-dx` checkout — see
   ADR Evidence for why same-codebase-different-branch is a weak generalization test).
4. Write the committed eval script (`packages/sourcevision/scripts/eval-classify-elm.ts`): fixed
   seed, train/held-out split, majority-class baseline (reported for context), and a
   precision/coverage curve across confidence thresholds on the trained ELM — see ADR Evidence for
   why this replaced a flat accuracy-vs-baseline number.
5. **Gate.** Only proceed past this point if precision at the chosen confidence threshold clears
   the ADR's proposed ≥95% bar on held-out data. If it doesn't, stop and report back with the
   numbers — per `ADR-TEMPLATE.md`, a negative result needs the same Evidence rigor as a positive
   one, and this IMPL does not proceed on one.
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

- [x] **Dependency shape — resolved 2026-08-12.** `@astermind/astermind-community` (npm v3.0.0),
      not `@astermind/astermind-elm` (npm v2.1.1, older/narrower) — confirmed against the npm
      registry and matched to the local `AsterMind-Community-Edition/package.json` Knight's survey
      actually read. See ADR Evidence for full reasoning, including why the local checkout's
      relative path isn't portable and the npm dependency is used instead.
- [x] **Second codebase for the held-out split — resolved 2026-08-12.**
      `AsterMind-Community-Edition` (129 `.ts`/`.tsx` files, genuinely different domain) over the
      other `GitHub/n-dx` checkout (same codebase, weak generalization test). Neither this repo nor
      that codebase has classification data yet — both need `ndx analyze` run first (Step 2b).
- [x] **Worktree isolation or shared checkout — resolved for this agent's own work, 2026-08-12.**
      Adopted worktree isolation (`../n-dx-jarrett`) given the concrete Knight-parallel-work
      scenario. The team-wide decision in `OWNERSHIP.md` is unchanged/still open — this doesn't
      answer it for Nolan or Thomas, only unblocks this IMPL's own Step 2.
- [x] **Acceptance margin over random baseline — reframed 2026-08-12, not a flat margin anymore.**
      Replaced with a precision-at-threshold gate (proposed ≥95% precision on held-out data at the
      production confidence threshold) — see ADR Evidence for why a flat accuracy-vs-baseline
      number was the wrong metric given threshold-gated production use.
- [ ] **Confidence threshold:** what makes an ELM resolution safe to skip the LLM entirely — mirror
      `classifyFile`'s `PRIMARY_THRESHOLD`/`SECONDARY_THRESHOLD` (0.4/0.3), or calibrate separately
      from the eval script's precision/coverage curve (step 4)? This is now the same calibration
      exercise as the precision-at-threshold gate above, viewed from the production side rather
      than the acceptance side — likely resolved together once step 4's curve exists, not before.
