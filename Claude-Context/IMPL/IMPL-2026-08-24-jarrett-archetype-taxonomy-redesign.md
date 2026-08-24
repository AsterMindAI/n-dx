# IMPL — Redesign the archetype taxonomy (analyzer/algorithm/tool archetypes + collision fixes)

- **Implements:** `ADR-2026-08-24-jarrett-archetype-taxonomy-redesign.md`
- **Owner:** Archer (Team Jarrett)
- **Backlog item:** `TJ-A3`
- **Branch:** `elm/jarrett/archetype-taxonomy-redesign` (new — this is pure `archetypes.ts`/signal
  design, doesn't touch or depend on `TJ-A1`/`TJ-A2`'s ELM code; keeping it separate avoids coupling
  an in-flight ELM-wiring effort to a taxonomy change that affects it)
- **Worktree:** `../n-dx-jarrett-taxonomy` (new, for the same reason — `../n-dx-jarrett` has
  `TJ-A2` work mid-flight; this shouldn't collide with it)
- **Status:** Not started — plan only, per the user's request to plan before coding.

## Scope

**In scope:**
- Add `analyzer`, `algorithm`, `tool` archetypes to `BUILTIN_ARCHETYPES`, each with real signal
  definitions informed by the exact file clusters cited in the ADR — not placeholder categories.
- Evaluate `orchestrator` as a fourth candidate — cross-check against a broader sample before
  committing to it (the ADR calls this the weakest-evidenced of the four).
- Tighten `store`/`hook`/`middleware`/`model` signals to require corroborating context, not just a
  lexical match — concrete pattern design, not just the stated intent from the ADR's Decision.
- Re-run classification across all 5 gathered codebases (n-dx, `AsterMind-Community-Edition`,
  `express`, `indie-stack`, `zustand`) with the new taxonomy; measure the unclassified-rate
  before/after per codebase — this is the ADR's own falsification test, run for real.
- Fill in real `analysisHints` values (dead-export policy, hub/hotspot threshold multipliers) for
  every new/changed archetype.
- Audit sourcevision/web/rex for hardcoded references to affected archetype IDs.

**Out of scope (explicitly):**
- Any change to the ELM pre-filter engine work (`TJ-A1`/`TJ-A2`/`TJ-K1`) — orthogonal. Whichever
  engine eventually ships benefits from a better taxonomy regardless; this IMPL doesn't touch
  `classify-elm.ts` or `analyze-phases.ts`'s ELM wiring.
- Knight's ELM-derived-taxonomy-discovery idea (clustering over learned embeddings) — confirmed
  with the user 2026-08-24 as **not** the direction; not built here, not left half-started either.
- Migrating other projects' `.n-dx.json` `customArchetypes`/`overrides` — not ours to touch.
- Implementing `import`-kind signal matching in `classify.ts` if Step 2 finds it's needed — that
  would be a `classify.ts` change, flagged as an open question, not assumed in scope here.

## Files touched

| Path | Owning team | New/Edit | Note sent? |
|---|---|---|---|
| `packages/sourcevision/src/analyzers/archetypes.ts` | unassigned — Team Jarrett scoped | Edit — add 3-4 archetypes, tighten 4 existing signal sets | No |
| `packages/sourcevision/src/analyzers/classify.ts` | unassigned — Team Jarrett scoped | **Untouched, unless Step 2's import-signal check says otherwise** — flagged, not assumed | Conditional |
| `packages/sourcevision/tests/unit/analyzers/classify.test.ts` | unassigned | Edit — fixtures for new/tightened archetypes | No |
| `.sourcevision/classifications.json` in each of the 5 corpora | n/a — local eval data | Regenerated locally for measurement, not committed to those external repos | No |
| `Claude-Context/Jarrett-Agents/{Archer.md,BACKLOG.md}`, `IN-FLIGHT.md` | Team Jarrett / shared | Edit — claim, log, flag the widely-read-file change | Yes — `IN-FLIGHT.md`, per the ADR's Consequences |

## Steps

1. Claim `TJ-A3` in `BACKLOG.md`. Create the new worktree/branch (`../n-dx-jarrett-taxonomy`,
   `elm/jarrett/archetype-taxonomy-redesign`) — deliberately separate from `TJ-A2`'s in-flight work.
2. Check whether `import`-kind signals are actually implemented in `classify.ts`'s `matchSignal` —
   recalled from earlier reading that it unconditionally returns `null` for that case. This decides
   whether context-aware disambiguation (e.g., "`store` requires a React import") is achievable with
   the *current* signal schema or needs a `classify.ts` change first. Resolve before designing
   signals that assume it works.
3. Design signal definitions for `analyzer`, `algorithm`, `tool` against the specific clusters cited
   in the ADR — write real patterns, verify each against the actual files in the cluster it's meant
   to catch.
4. Design tightened signals for `store`/`hook`/`middleware`/`model` — concrete patterns per the
   ADR's Decision, verified against both the files that should now match and the four collision
   cases that should now correctly *not* match (`branch-work-store.ts`, `token-validation-hook.ts`,
   Zustand's `middleware.ts`, AsterMind's ELM files vs. `model`).
5. Decide `orchestrator`'s fate based on real cross-codebase evidence — check whether
   `indie-stack`/`express`/`zustand` have anything loop/lifecycle-shaped before committing to it;
   n-dx alone was flagged as weak evidence in the ADR's Alternatives table.
6. Re-run `analyzeClassifications` against all 5 corpora's existing `inventory.json`/`imports.json`
   with the new `archetypes.ts` — no new `ndx analyze` needed, same inputs, new taxonomy. Measure
   the before/after unclassified rate per codebase.
7. **Gate.** If the rate doesn't meaningfully improve across the codebases it's meant to help
   (`AsterMind-Community-Edition`, n-dx itself): stop, report the negative result with the same
   rigor as every prior measurement in this project — don't proceed to hint/test work on a taxonomy
   change that didn't move the needle.
8. If it does: fill in `analysisHints` for each new/changed archetype with considered values.
9. Add test fixtures: positive cases for each new archetype, negative cases for the four
   collision fixes (files that should now correctly stay unmatched).
10. Audit for hardcoded archetype-ID references outside `archetypes.ts` (web dashboard's zone
    risk-scoring, rex).
11. `pnpm typecheck && pnpm test` clean.
12. Flag the change in `IN-FLIGHT.md` per the ADR's Consequences (widely-read file); update
    `BACKLOG.md`.
13. Reply to Knight's urgent note and Realm's pivot note (see today's correction), so `TJ-K1`'s
    charter and `TJ-R1`'s status reflect the confirmed direction, not the pre-correction state.
14. PR per the org ADR's branch+PR rule.

Order matters at steps 3-7 specifically, same discipline as every prior measurement in this
project: the before/after re-classification has to run and clear its own bar *before* the
`analysisHints`/test/audit work, so a negative result costs a signal-design pass, not a
half-finished schema change.

## Test strategy

- **Unit:** signal-matching fixtures for each new/tightened archetype, both positive (should match)
  and negative (should *not* match under the tightened signals — the four collision cases
  specifically).
- **Regression:** existing archetype fixtures (indie-stack/express-shaped files) must keep matching
  their current archetypes — this change must not regress what already works well.
- **The actual acceptance test, per the ADR:** unclassified-rate delta across all 5 corpora,
  reported whichever direction it goes — this is Step 6/7 above, not a separate exercise.
- Must stay green: `pnpm typecheck`, `pnpm test`, `tests/e2e/domain-isolation.test.js`,
  `tests/e2e/architecture-policy.test.js`.

## Rollback

Revert `archetypes.ts` to the prior `BUILTIN_ARCHETYPES` array. No data migration — classification
output is recomputed fresh each `ndx analyze`, never diffed/migrated against a prior archetype set.
No `.n-dx.json` overrides in this repo reference any archetype ID that would be renamed.

## Open questions

- [ ] **Is `import`-kind signal matching actually implemented in `classify.ts`?** Blocks whether
  context-aware disambiguation (ADR Decision § 2) is achievable without a `classify.ts` change.
  Resolve at Step 2, before designing signals around an unverified assumption.
- [ ] **`orchestrator`: add now or defer?** Weakest-evidenced of the four candidates — Step 5
  decides based on real cross-codebase evidence, not default inclusion.
- [ ] **`model`: rename to `data-model`, or leave as-is and let `algorithm` absorb ML models
  entirely?** ADR leans toward the latter; confirm before Step 4.
- [ ] **`algorithm`'s signal design** — the ADR itself flags this as likely needing per-project
  custom-archetype extension rather than a one-size-fits-all built-in signal set, since algorithm
  file-naming varies more than other archetypes. Needs a concrete answer at Step 3, not just the
  caveat.
- [ ] **Cross-agent state to reconcile, not a design question:** Knight's urgent note and Realm's
  `TJ-R1` both need a reply reflecting today's confirmed direction (see ADR header and Step 13) —
  tracked here so it doesn't get lost as "just a note," since both docs currently assert things the
  user has since corrected or narrowed.
