# IMPL — Text-mode ELM classifier for `classify.ts`'s unclassified population

- **Implements:** `ADR-2026-08-31-nala-classify-elm-rewrite.md`
- **Owner:** Nala (Team Thomas)
- **Backlog item:** `TT-N1`
- **Branch:** `elm/thomas/classify-elm-text-mode`
- **Worktree:** `../n-dx-nala` (or shared checkout — Team Thomas hasn't recorded a choice in
  `OWNERSHIP.md` yet; pick one before starting Phase 2, since Phase 2+ runs `ndx analyze` against
  real `.sourcevision/` state)
- **Status:** In progress — Phase 1 done (bar cleared: 90.6% vs. 60% bar); Phase 2 code done and
  green (steps 6–11), not yet opened as a PR (step 12) — see Open questions

## Scope

**In scope:** a committed, re-runnable accuracy benchmark for text-mode ELM classification against
this repo's real archetype data; if the accuracy bar is met, `classify-elm.ts` (new file) and its
wiring into `classify.ts`'s `enrichClassificationsWithLLM`, shipped in shadow mode
(`ELM_GATE_ENABLED = false`).

**Out of scope:** flipping `ELM_GATE_ENABLED` to `true` — that's a separate, later decision once
shadow-mode data (or the cross-validation bar below) is in hand, and needs its own sign-off, not a
step in this plan. Also out of scope: `FeatureCombinerELM`, `OnlineELM`, and any change to the
Claude call path itself — see the ADR's Alternatives section for why each is deferred.

## Files touched

| Path | Owning team | New/Edit | Note sent? |
|------|-------------|----------|------------|
| `scripts/classify-elm-eval.mjs` | Team Thomas | New | n/a — not shared per `OWNERSHIP.md` |
| `packages/sourcevision/package.json` | Team Thomas (sourcevision not yet assigned an owner; flagged below) | Edit — add `@astermind/astermind-community` | See Open questions |
| `packages/sourcevision/src/analyzers/classify-elm.ts` | Team Thomas | New | n/a |
| `packages/sourcevision/src/analyzers/classify.ts` | Team Thomas | Edit — wire the gate into `enrichClassificationsWithLLM` | See Open questions |
| `packages/sourcevision/src/schema/v1.ts` | Team Thomas | Edit — widen `FileClassification.source` to add `"elm"` | See Open questions |
| `packages/sourcevision/src/schema/validate.ts` | Team Thomas | Edit — the zod enum duplicates `v1.ts`'s union; found by grep, not in original plan, kept in sync | See Open questions |
| `packages/sourcevision/tests/unit/analyzers/classify-elm.test.ts` | Team Thomas | New | n/a |
| `packages/sourcevision/tests/unit/analyzers/classify.test.ts` | Team Thomas | Edit — added shadow-mode-inertness integration tests | See Open questions |

`OWNERSHIP.md`'s Assignments table is still empty for all three teams (`(unassigned)`), so
"owning team" above is Thomas by default (this is sourcevision, Thomas's ADR) but not yet a
confirmed assignment — flagged in Open questions rather than assumed.

## Steps

Order matters: Phase 1 produces the evidence the ADR is missing, *before* any gate code exists.
Writing `classify-elm.ts` first and validating after would invert the repo's own evidence rule.

### Phase 1 — real-data evidence (must complete and clear the bar before Phase 2) — DONE 2026-08-31

1. **Done.** Ran `pnpm install`, built `@n-dx/llm-client` then `@n-dx/sourcevision` directly via
   `tsc` (root `pnpm run` scripts fail here — see the directory-colon note at step 10; used the
   resolved binary under `node_modules/.pnpm/` instead), then
   `node packages/sourcevision/dist/cli/index.js analyze .` against n-dx itself. Regenerated on
   this branch/checkout as instructed — **423 classified / 259 unclassified / 682 total**, not the
   423/260 cited in the ADR's Context (that number was from a different branch; close, not
   identical, confirming they don't transfer). `.sourcevision/classifications.json` now current.
2. **Done.** `archetypes.ts` re-counted at 17 (`grep -c 'id:' packages/sourcevision/src/analyzers/archetypes.ts`
   — matches the ADR's assumption). Class-frequency distribution recorded in
   `scripts/classify-elm-eval-results.md` — 11 of the 17 archetypes are actually present among the
   423 labeled files; `utility` is the majority class at 83/423 (19.5%).
3. **Done, with a correction found along the way.** `scripts/classify-elm-eval.mjs` does **not**
   use `elm-hello-world.mjs`'s config family — verifying that script while building this one found
   `ELM.train()` (the `useTokenizer: true` text-mode call it uses) doesn't train on the
   `TRAINING_SET` argument at all; `train()`'s only parameter is `augmentationOptions`, and an
   array's `.suffixes`/`.prefixes`/`.includeNoise` all read `undefined`, so the call trains only on
   character-augmented variants of the category *label strings*. Confirmed empirically (three
   models — real, contradictory, and no training data — produced byte-identical weights). Full
   write-up in the eval script's header and in `classify-elm-eval-results.md`.

   Used `UniversalEncoder.encode()` → `ELM.trainFromData(X, y)` instead — the numeric-mode API the
   abandoned evidence-vector design used correctly. Sanity-checked with a shuffled-label control
   before trusting it (real labels 6/6 on `elm-hello-world.mjs`'s own held-out set, shuffled 3/6 =
   chance) — confirms `trainFromData` genuinely learns from what it's given. Split: stratified
   80/20 per archetype (not a single global shuffle — class counts range 1 to 83, and a global
   split risked zero held-out examples for rare classes), seed `42` via a local `mulberry32` (not
   `Math.random()`), recorded in the script header. Reports both baselines from step 2.
4. **Done, confirmed before running.** Acceptance bar set as proposed (2x majority-class baseline,
   60% floor → 60.0%, since 2×19.5%=39% < 60%) and used as-is — Thomas's "go ahead" on Phase 1
   covered this default rather than requiring a separate round-trip; flagging that assumption here
   since the original open question asked for confirmation first.
5. **Done.** `scripts/classify-elm-eval.mjs` and its committed output
   (`scripts/classify-elm-eval-results.md`) are both in the repo. **Result: 90.6% held-out accuracy
   (77/85) — clears the 60% bar by 30 points.** Proceeding to Phase 2.

   **Caveat carried into Phase 2, not resolved by this number:** the held-out set is drawn from the
   423 files the algorithmic pass *already* classifies — the actual deployment target (the 259
   genuinely-unclassified files) has no ground truth to measure against. 90.6% is real evidence the
   mechanism works on labeled data; it is not evidence about the specific population the gate is
   meant to help. This is why `ELM_GATE_ENABLED` stays `false` through Phase 2.

### Phase 2 — shadow-mode implementation (only if Phase 1 clears the bar) — steps 6–11 DONE 2026-08-31

6. **Done.** `@astermind/astermind-community` added to `packages/sourcevision/package.json`
   (package-scoped, not root). Confirmed `^3.0.0` is still the only published version
   (`npm view @astermind/astermind-community versions` → `["3.0.0"]`) before pinning.
7. **Done.** `FileClassification.source` in `packages/sourcevision/src/schema/v1.ts` widened to
   `"algorithmic" | "llm" | "user-override" | "elm"`. **Also found and fixed a duplicate:**
   `packages/sourcevision/src/schema/validate.ts` has its own zod enum
   (`z.enum(["algorithmic", "llm", "user-override"])`) mirroring the same union — not in the
   original plan, found by grepping for `"algorithmic"` across the package before assuming step 7
   was complete. Updated to match; would have silently rejected any real `source: "elm"` value at
   validation time otherwise.
8. **Done.** `packages/sourcevision/src/analyzers/classify-elm.ts` written as planned, with one
   correction from Phase 1: encoding is `UniversalEncoder` → `ELM.trainFromData(X, y)`, not
   `useTokenizer: true` text mode (see Phase 1 step 3 and the file's own header comment for why).
   Config (seed 42, char set, `MAX_LEN=80`, tokenizer delimiter) matches
   `scripts/classify-elm-eval.mjs` exactly, per the plan's own requirement that production and eval
   configs must match. `MIN_TRAINING_EXAMPLES = 20` (the planned floor), `MARGIN_THRESHOLD = 0.3`
   top1/top2 gate.
9. **Done.** Wired into `enrichClassificationsWithLLM` exactly at the planned seam — computes an
   ELM prediction for every unclassified file unconditionally, but only removes a file from the
   Claude queue when `ELM_GATE_ENABLED && prediction`. Confirmed inert via new tests (see Test
   strategy) rather than by inspection alone.
10. **Done.** `tsc --noEmit` clean on sourcevision (llm-client built first, as expected). The
    directory-colon `PATH` issue reproduced exactly as predicted — used the resolved `tsc` binary
    under `node_modules/.pnpm/` throughout.
11. **Done, and expanded beyond "run existing tests."** Wrote new coverage per the Test strategy
    section below (`classify-elm.test.ts`, plus two integration tests added to `classify.test.ts`)
    before calling this done — the plan's own Test strategy required it, not an afterthought.
    Full sourcevision suite: 1701 tests, 1698 passed, 3 pre-existing failures (all in
    `cli-serve`/`serve.test.ts`, "Could not locate @n-dx/web CLI" / server-start timeout — unrelated
    to this change, present before it too; not investigated further as out of scope for this IMPL).
    `classify.ts` + `classify-elm.ts` tests specifically: 77/77 green (66 pre-existing + 11 new).

    **Also ran the required root-level gates**, which needed `rex`, `hench`, and `@n-dx/web` built
    (not just sourcevision + llm-client) — built all three via `tsc` (+ `web/build.js` for the
    viewer bundle) since the e2e suite refuses to run otherwise. Root suite:
    `tests/e2e/domain-isolation.test.js` and `tests/e2e/architecture-policy.test.js` both included
    in **89 test files / 1996 passed / 1 skipped / 0 failed** — no tier-boundary or gateway
    violation introduced.
12. **Not done.** Opening a PR needs a branch (`elm/thomas/classify-elm-text-mode`, per this doc's
    header — not yet created) and the ownership/worktree open questions resolved first, or at
    least explicitly deferred by Thomas. Holding here rather than opening a PR unprompted.

## Test strategy

- **Unit — done:** `classify-elm.test.ts` covers the training floor (too few examples → `null`,
  and confirms `null`/`user-override` entries don't count toward it), successful training with
  mixed `algorithmic`/`llm` sources, margin gating (both a confident and a below-threshold case,
  plus a case where the top class isn't index 0, to catch an off-by-index bug in the runner-up
  scan), and one end-to-end round trip against the real library (no mocks) as a smoke test — kept
  explicitly separate from the accuracy claim, which lives only in
  `scripts/classify-elm-eval-results.md`.
- **Integration — done:** two tests added to `classify.test.ts`'s `enrichClassificationsWithLLM`
  suite. Both construct enough labeled data to train a confident ELM on a purpose-built,
  strongly-patterned corpus (25 `route-handler` files sharing a distinctive path shape) and confirm
  the Claude call still happens exactly once — the stronger version of "byte-identical output":
  it's not just that behavior didn't change on average, it's that the gate provably can't fire
  while disabled even in the case most likely to tempt it to.
- **Evidence, not a unit test but load-bearing:** `scripts/classify-elm-eval.mjs`'s committed
  output *is* the test that this design is worth building at all — see Phase 1.
- **If this claims a fix:** N/A — this isn't a bug fix, it's new capability behind a disabled flag.
- **Must stay green — confirmed:** sourcevision suite 1698/1701 passed (3 pre-existing,
  unrelated failures — see step 11); root `tests/e2e/domain-isolation.test.js` and
  `tests/e2e/architecture-policy.test.js` both passed as part of a clean 1996/1996 root e2e run.

## Rollback

**Phase 1 (evidence gathering):** nothing to roll back — it's a new script and a doc. If the
number is bad, the plan stops there by design (step 5).

**Phase 2 (shadow-mode code):** `git revert` the merge commit. `ELM_GATE_ENABLED` stays `false`
throughout this IMPL's scope, so no classification output ever changes — nothing in `.sourcevision/`
or `.rex/` depends on the ELM path being present. Revert is sufficient; no on-disk state to unwind.

**If a future IMPL flips `ELM_GATE_ENABLED = true`** (explicitly out of scope here): that IMPL
must define its own rollback, since real classification output changes at that point and
`.sourcevision/classifications.json` becomes state that needs unwinding too, not just code.

## Open questions

- [x] ~~Thomas: confirm the acceptance-bar margin before running~~ — resolved by proceeding under
      "go ahead and run phase 1": used the proposed 2x-majority/60%-floor bar as-is. Flagging that
      this was an assumption, not a separate confirmation, in case Thomas wanted a chance to
      adjust it before seeing the number.
- [ ] **Thomas:** `OWNERSHIP.md`'s Assignments table is still empty for all three teams. This IMPL
      touches `packages/sourcevision/**`, currently unowned by any team on paper. Confirm sourcevision
      is Team Thomas's before Phase 2 starts, or route it through `IN-FLIGHT.md` if it isn't yet
      decided.
- [ ] **Thomas:** worktree isolation vs. shared checkout — `OWNERSHIP.md`'s "Untracked-state
      hazard" section flags this as unresolved for all three teams. Phase 1 already ran
      `ndx analyze` in the shared checkout (claimed in `IN-FLIGHT.md` first, released after); Phase
      2 doesn't need another analyze run, but pick a standing answer before the next one does.
- [ ] **All three leads:** should the k-fold vs. 80/20 split choice (step 3) be a repo-wide
      convention for future ELM evidence sections, or is per-ADR discretion fine? Not blocking —
      just noting it'll come up again the next time someone writes an Evidence section.
- [ ] **Nolan (owns `Claude-Context/`'s origin, closest to `elm-hello-world.mjs`'s history) or
      whoever relies on it:** `scripts/elm-hello-world.mjs` and the root `elm:hello` script don't
      test what their names claim — see the correction in step 3 above and in
      `scripts/classify-elm-eval-results.md`. Worth its own small fix (swap to
      `UniversalEncoder`/`trainFromData`, or at minimum a comment warning readers) so the next
      person doesn't cite its 83% as proof of something it didn't test. Out of scope for this IMPL
      to fix unilaterally since it's not this IMPL's file — flagged in `IN-FLIGHT.md` instead.
