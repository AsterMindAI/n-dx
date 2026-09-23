# IMPL — Split classify.ts into a gate plus classify-ELM.ts / classify-LLM.ts

- **Implements:** `ADR-2026-09-07-realm-classify-gate-split.md`
- **Owner:** Unclaimed — real edits to `classify.ts` shouldn't start until Thomas/Nala have signed
  off on the ADR (it reorganizes code Team Thomas already merged). Realm drafted this at the
  user's direction; execution is `packages/sourcevision` engineering work outside this
  coordination role's scope (see `Realm.md`).
- **Backlog item:** `TJ-R3`
- **Branch:** TBD — likely wants its own (`elm/jarrett/classify-gate-split` or similar) rather than
  either team's existing worktree, since it touches both `TT-N1`'s and `TJ-R2`'s territory
- **Worktree:** TBD
- **Status:** Not started. **Blocked on ADR sign-off from Thomas (Nala), not just Team Jarrett** —
  do not start Step 2 onward before that lands.

## Scope

**In scope:**
- Extract `classify-LLM.ts` from `classify.ts`'s current `enrichClassificationsWithLLM` /
  `classifyBatchWithLLM` / `buildLLMClassifyPrompt` / retry-degrade logic — moved, not rewritten.
- Define `classify-ELM.ts`'s stable public interface (single function: run/training input in,
  confident `FileClassification` or `null` out) — the *interface*, not necessarily which
  implementation (`TT-N1` vs `TJ-R2`) fills it, unless that question has resolved by the time this
  executes.
- Rewrite `classify.ts`'s gate: algorithmic pass (unchanged) → for each `archetype: null` file,
  call `classify-ELM.ts`, then `classify-LLM.ts` only for what ELM didn't resolve.
- Move the ELM enable/disable switch to `.n-dx.json` (`sourcevision.classification.elmPrefilter.enabled`),
  replacing `TT-N1`'s hardcoded `ELM_GATE_ENABLED` constant.
- Update both teams' existing tests to target the new module boundaries rather than the old inline
  shape.

**Out of scope (explicitly):**
- Deciding which ELM representation fills `classify-ELM.ts` — separate, still-open question (see
  ADR's Out of scope).
- Any change to the algorithmic pass, `FileClassification` schema, or downstream consumers
  (web dashboard, rex) — none of those are affected by this reorganization.
- Applying this pattern to other classifier call sites.

## Files touched

| Path | Owning team | New/Edit | Note sent? |
|---|---|---|---|
| `packages/sourcevision/src/analyzers/classify.ts` | **shared** — Team Thomas has merged code here (`TT-N1`) | Edit — becomes the gate; ELM/LLM logic removed | Yes — this ADR itself is the notice; needs explicit sign-off, not just a heads-up |
| `packages/sourcevision/src/analyzers/classify-elm.ts` | shared — both teams have a version | Edit — reshaped to the new stable interface; body (which representation) is a separate decision | Yes — same |
| `packages/sourcevision/src/analyzers/classify-llm.ts` (new) | unassigned — Team Jarrett scoped, but Team Thomas should review since it's extracted from code they also touched | New — LLM logic moved from `classify.ts` | Yes |
| `.n-dx.json` schema / config docs | unassigned | Edit — config-driven kill switch, replacing `TT-N1`'s hardcoded constant | No |
| `packages/sourcevision/tests/unit/analyzers/classify.test.ts`, `classify-elm.test.ts` (both teams have versions) | shared | Edit — retarget at new module boundaries | Yes |
| `packages/sourcevision/tests/unit/analyzers/classify-llm.test.ts` (new) | unassigned | New | No |

## Steps

1. **Get the ADR signed off by Thomas/Nala** — do not proceed past this step first. This is real,
   merged code being reorganized; per `Command-Structure`, that needs a second lead's sign-off, not
   just Team Jarrett's agreement.
2. Once the representation question (`TT-N1` vs `TJ-R2`, or something else) is also settled —
   either before or alongside this IMPL, per the ADR's Out of scope — confirm which body
   `classify-ELM.ts`'s interface wraps. This IMPL can define the interface without that answer, but
   can't finish wiring `classify.ts`'s gate to a real implementation without it.
3. Extract `classify-LLM.ts`: move `enrichClassificationsWithLLM`'s LLM-calling internals
   (`classifyBatchWithLLM`, `buildLLMClassifyPrompt`, `computeLLMClassifyAttempts`,
   `tryParseClassifyResponse`) into the new file. Export one function matching the shape
   `classify.ts`'s gate needs (batch of files in, updated `FileClassification[]` + token usage out
   — same return shape `enrichClassificationsWithLLM` already has, just relocated).
4. Define `classify-ELM.ts`'s stable interface per the ADR's Decision — single function, one file
   in, confident result or `null` out. Wrap whichever implementation step 2 settled on.
5. Rewrite `classify.ts`: after the algorithmic pass, route `archetype: null` files through the new
   gate — call `classify-ELM.ts` per file (or batch, matching whatever shape the chosen
   implementation trains on), collect the `null`s, pass those to `classify-LLM.ts`. Read the
   `.n-dx.json` kill switch before even attempting the ELM call.
6. Move the config surface: add `sourcevision.classification.elmPrefilter.enabled` if it doesn't
   already exist from `TJ-A2`'s work, or confirm it's the same key both teams converge on rather
   than shipping two differently-named switches.
7. Update tests: both teams' existing `classify.ts`/`classify-elm.ts` unit tests need to target the
   new file boundaries. Write `classify-llm.ts`'s own unit tests (extracted logic, same behavior —
   these should be near-identical to whatever tested `enrichClassificationsWithLLM`'s internals
   before, just relocated).
8. Integration test: full gate flow with a fixture where some files resolve via ELM and others fall
   through to LLM — assert ELM-resolved files never reach `classify-LLM.ts`, and LLM-routed files
   behave identically to pre-split behavior.
9. `pnpm build && pnpm typecheck && pnpm test` clean, whole repo — this touches a file both teams
   have tests against, so this bar matters more than usual here.
10. Update both ADRs' (`TT-N1`, `TJ-R2`) Status fields to reflect the new home for their logic, and
    close out the collision notes in both teams' `Notes/` inboxes with a `## Resolved` section.

## Test strategy

- **Unit:** `classify-llm.ts`'s extracted functions against the same fixtures that tested them
  inside `classify.ts` before (behavior must not change, only location). `classify-ELM.ts`'s
  interface contract (returns `null` correctly, never partial/malformed results). `classify.ts`'s
  gate logic itself — given a mock ELM result and a mock LLM result, does it route correctly.
- **Integration:** end-to-end `runClassificationsPhase`-equivalent flow (or wherever this gate is
  invoked from) with both classifiers as real dependencies, fixture project with a mix of
  ELM-resolvable and LLM-only files.
- **Regression:** classification correctness on a fixed corpus must not change output at all
  relative to whichever pre-split behavior is currently live on `Jarrett` — this is a
  reorganization, not a behavior change, and the regression test is what proves that.
- Must stay green: `pnpm typecheck`, `pnpm test`, `tests/e2e/domain-isolation.test.js`,
  `tests/e2e/architecture-policy.test.js`.

## Rollback

Revert the three-file-split commit(s). Since no schema shape changes and no `.sourcevision/` state
shape changes, revert is clean — `classify.ts` goes back to whatever inline shape was live before
(currently `TT-N1`'s). The `.n-dx.json` config key addition, if reverted, needs no data migration
either — it's a new optional key, not a rename of an existing one (unless step 6 finds an existing
`TJ-A2` key to reuse, in which case reverting just removes the new call sites, not the key).

## Open questions

- [ ] **Thomas/Nala's sign-off** — the actual blocking one. Nothing past Step 1 should happen
      without it.
- [ ] **Which representation fills `classify-ELM.ts`** — `TT-N1`'s path-only, `TJ-R2`'s
      path+export, or a decision to A/B both against the zero-evidence population before choosing.
      Not this IMPL's call to make alone.
- [ ] **Does `classify-ELM.ts` receive one file at a time or a batch?** `TT-N1`'s current shape
      trains once per run then predicts per-file; `TJ-R2`'s eval work assumes a similar shape. The
      stable interface in Step 4 should match whichever training/prediction lifecycle the chosen
      representation actually needs — worth confirming against `IMPL-2026-08-23`'s model-lifecycle
      design (hybrid cold-start, option C) rather than assuming a shape.
- [ ] **Does the existing `TJ-A2` `.n-dx.json` key already cover this**, or does step 6 need a new
      one? Check `IMPL-2026-08-23-jarrett-classify-elm-production-hardening.md`'s config surface
      before adding a second key that means the same thing.
