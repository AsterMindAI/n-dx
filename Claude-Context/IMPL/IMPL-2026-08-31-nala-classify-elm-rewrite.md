# IMPL — Text-mode ELM classifier for `classify.ts`'s unclassified population

- **Implements:** `ADR-2026-08-31-nala-classify-elm-rewrite.md`
- **Owner:** Nala (Team Thomas)
- **Backlog item:** `TT-N1`
- **Branch:** `elm/thomas/classify-elm-text-mode`
- **Worktree:** `../n-dx-nala` (or shared checkout — Team Thomas hasn't recorded a choice in
  `OWNERSHIP.md` yet; pick one before starting Phase 2, since Phase 2+ runs `ndx analyze` against
  real `.sourcevision/` state)
- **Status:** Not started

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

`OWNERSHIP.md`'s Assignments table is still empty for all three teams (`(unassigned)`), so
"owning team" above is Thomas by default (this is sourcevision, Thomas's ADR) but not yet a
confirmed assignment — flagged in Open questions rather than assumed.

## Steps

Order matters: Phase 1 produces the evidence the ADR is missing, *before* any gate code exists.
Writing `classify-elm.ts` first and validating after would invert the repo's own evidence rule.

### Phase 1 — real-data evidence (must complete and clear the bar before Phase 2)

1. On this branch/checkout, run a real (non-`--lite`) `ndx analyze` (or `sourcevision analyze .`)
   against n-dx itself to produce current `.sourcevision/classifications.json`. **Do not reuse
   the 423/260 split cited in the ADR's Context** — that came from a different branch's checkout
   and is not this branch's number; regenerate it here.
2. Re-count `archetypes.ts`'s catalog (`grep -c 'id:' packages/sourcevision/src/analyzers/archetypes.ts`
   — 17 at ADR-authoring time, verify it hasn't moved) and record the actual class-frequency
   distribution from step 1's output — this is the "harder" baseline the ADR's Evidence section
   requires, not just the uniform 1/N one.
3. Write `scripts/classify-elm-eval.mjs`: loads `classifications.json`, takes all
   `source: "algorithmic" | "llm"` entries as labeled data, does an 80/20 (or k-fold, pick one and
   record it in the script's header) train/held-out split on `path → archetype`, trains a
   text-mode ELM (same config family as `elm-hello-world.mjs`: `useTokenizer: true`, character set
   with `-` last, path-separator tokenizer, fixed seed — record the seed in the script header, not
   just in this doc), and reports held-out accuracy vs. both baselines from step 2.
4. **Acceptance bar, set now so nobody moves the goalposts after seeing the number:** held-out
   accuracy must clear the class-frequency baseline by a stated margin — propose **2x the
   frequency baseline, floor 60%**, matching the spirit of `elm-hello-world.mjs`'s own
   "2x random baseline" floor. Confirm this margin with Thomas before running the eval, not after —
   see Open questions.
5. Run the eval, commit the script and the raw output (as a comment block or a
   `classify-elm-eval-results.md` alongside it — pick one, don't leave the only copy of the number
   in a chat transcript). **If it doesn't clear the bar, stop here.** Report the number plainly,
   update the ADR's Status to reflect the negative result (mirroring how the evidence-vector
   attempt's ADR would have read), and do not proceed to Phase 2.

### Phase 2 — shadow-mode implementation (only if Phase 1 clears the bar)

6. Add `@astermind/astermind-community` to `packages/sourcevision/package.json` (package-scoped,
   not root — per the ADR's two-consumer-rule reasoning). Pin to the same published version used
   by the root `package.json`'s existing `elm:hello` script (`^3.0.0` at last check — verify via
   `npm view @astermind/astermind-community versions` before pinning; don't assume the number is
   still current).
7. Widen `FileClassification.source` in `packages/sourcevision/src/schema/v1.ts` to
   `"algorithmic" | "llm" | "user-override" | "elm"`.
8. Write `packages/sourcevision/src/analyzers/classify-elm.ts`:
   - `trainClassifyPathELM(classifications)` — text-mode ELM, trains on this run's
     `algorithmic`/`llm`-sourced `path → archetype` pairs. Use the eval script's chosen config
     verbatim (same seed, same char set, same tokenizer delimiter) so shadow-mode behavior matches
     what Phase 1 measured — a different config in production than in the eval invalidates the
     accuracy number.
   - `predictWithClassifyPathELM(path, model)` — returns `{archetype, confidence}` via
     top1/top2 margin, same gating shape as the earlier evidence-vector attempt (reuse that logic,
     not the evidence-vector feature-building — only the margin-threshold mechanics apply here).
   - Minimum training-example floor before predicting at all (carry forward the earlier design's
     "min 20 examples" guard, adjust if Phase 1's split sizes suggest a different floor).
9. Wire into `classify.ts`: inside `enrichClassificationsWithLLM`
   ([classify.ts:328](../../packages/sourcevision/src/analyzers/classify.ts#L328)), ahead of the
   batching loop (~[classify.ts:352](../../packages/sourcevision/src/analyzers/classify.ts#L352)).
   For each unclassified file, try the ELM first; only files it doesn't confidently resolve enter
   the Claude batch. Gate the skip behind `ELM_GATE_ENABLED = false` — always train and predict
   (so the code path is exercised and any future shadow-agreement logging has something to log),
   never skip Claude while the flag is off.
10. `tsc --noEmit` on sourcevision (build `@n-dx/llm-client` first — workspace build-order
    requirement, not new). **Note the directory-colon `PATH` issue** (this checkout's parent folder
    name contains `:`, breaking `pnpm run <script>` bin resolution) — invoke `tsc`/`vitest`
    directly via their resolved path under `.pnpm/` if `pnpm run` fails with "command not found".
    This is a pre-existing environment issue, not something this IMPL fixes.
11. Run sourcevision's existing `classify.ts` unit tests — must stay green, zero regressions.
12. Open a PR. Since `packages/sourcevision/package.json` and `classify.ts`/`v1.ts` ownership is
    unconfirmed (see Open questions), get explicit review even if `OWNERSHIP.md` doesn't yet force
    it.

## Test strategy

- **Unit:** new tests for `classify-elm.ts` — training with too few examples (floor guard), margin
  gating (confident vs. ambiguous predictions), and that `ELM_GATE_ENABLED = false` never causes a
  file to skip the Claude batch regardless of ELM confidence.
- **Integration:** `enrichClassificationsWithLLM` with the gate wired in but disabled — confirm
  output is byte-identical to pre-change behavior (shadow mode must be provably inert).
- **Evidence, not a unit test but load-bearing:** `scripts/classify-elm-eval.mjs`'s committed
  output *is* the test that this design is worth building at all — see Phase 1.
- **If this claims a fix:** N/A — this isn't a bug fix, it's new capability behind a disabled flag.
- **Must stay green:** `pnpm typecheck`, `pnpm test`, `tests/e2e/domain-isolation.test.js`
  (gateway rules — this doesn't add a gateway, but confirm it doesn't accidentally cross one),
  `tests/e2e/architecture-policy.test.js` (tier rules — sourcevision stays domain-tier, no new
  cross-package import).

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

- [ ] **Thomas:** confirm the acceptance-bar margin proposed in step 4 (2x frequency baseline,
      60% floor) before Phase 1's eval is run — cheap to agree now, expensive to relitigate after
      seeing a number that only clears one version of the bar.
- [ ] **Thomas:** `OWNERSHIP.md`'s Assignments table is empty for all three teams. This IMPL
      touches `packages/sourcevision/**`, currently unowned by any team on paper. Confirm sourcevision
      is Team Thomas's before Phase 2 starts, or route it through `IN-FLIGHT.md` if it isn't yet
      decided.
- [ ] **Thomas:** worktree isolation vs. shared checkout — `OWNERSHIP.md`'s "Untracked-state
      hazard" section flags this as unresolved for all three teams. Phase 1+ runs `ndx analyze`,
      which writes `.sourcevision/`; pick one before running it so this doesn't collide with
      anyone else's in-flight state.
- [ ] **All three leads:** should the k-fold vs. 80/20 split choice (step 3) be a repo-wide
      convention for future ELM evidence sections, or is per-ADR discretion fine? Not blocking —
      just noting it'll come up again the next time someone writes an Evidence section.
