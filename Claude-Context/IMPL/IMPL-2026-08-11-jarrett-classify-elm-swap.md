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
- **Status:** Real numbers in (2026-08-12) — Step 5's gate did **not** clear on held-out
  generalization (in-domain passed, out-of-domain didn't). Stopped here per the gate; did not
  proceed to Steps 6-8. See ADR Evidence for full numbers. Not closing TJ-A1 — leaving open pending
  the user's call on whether to gather more/better training data and retry.

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
| `packages/sourcevision/src/analyzers/classify-elm.ts` | unassigned — Team Jarrett scoped | **Created and fixed 2026-08-12** (evidence-leakage bug), typechecks clean | No — not another team's path |
| `packages/sourcevision/src/analyzers/classify.ts` | unassigned — Team Jarrett scoped | **Untouched — gate didn't clear, Step 7 not reached.** Prototype/eval phase only ever read its exported types. Stays untouched unless the user asks for a retry with better data and that retry clears the gate. | No |
| `packages/sourcevision/src/cli/commands/analyze-phases.ts` | unassigned — Team Jarrett scoped | **Untouched — gate didn't clear, Step 8 not reached.** See ADR "Decision": the planned in-between call would read `analyzeClassifications`'s output and narrow `enrichClassificationsWithLLM`'s input without modifying either — still just a plan. | No |
| `packages/sourcevision/src/schema/v1.ts`, `validate.ts` | unassigned — Team Jarrett scoped | **Untouched — gate didn't clear, Step 7 not reached.** | No |
| `packages/sourcevision/scripts/eval-classify-elm.ts` | unassigned | **Created, fixed, and run 2026-08-12** — produced the ADR's Measured results | No |
| `packages/sourcevision/package.json` / root `pnpm-lock.yaml` — adds `@astermind/astermind-community` | **shared** per `OWNERSHIP.md` | **Done 2026-08-12** — installed and verified in `../n-dx-jarrett` worktree | **Claimed `IN-FLIGHT.md` § 1 2026-08-12** |

## Steps

1. **Done (2026-08-12).** Claimed `IN-FLIGHT.md` § 1 for `packages/sourcevision/package.json` /
   root `pnpm-lock.yaml` before adding `@astermind/astermind-community`.
2. **Done (2026-08-12).** `git worktree add ../n-dx-jarrett -b elm/jarrett/classify-elm-prefilter`
   — adopted worktree isolation for this agent's own work given the concrete Knight-parallel-work
   scenario (see Worktree field above); team-wide decision still separately open.
2b. **Done 2026-08-12, but not as originally planned.** `ndx analyze --phase=1` and `--phase=2` ran
   cleanly on both this repo and `AsterMind-Community-Edition`; `--phase=3` (the actual
   `callClaude`-driven LLM fallback) failed on both — `claude` CLI not on PATH, confirmed genuinely
   absent (not a shell-PATH quirk) via `Get-Command`, npm global modules, and common install paths,
   and no `ANTHROPIC_API_KEY` was set. Rather than block on installing the CLI or provisioning a
   key, Archer classified the unclassified files directly — a legitimate stand-in for what
   `enrichClassificationsWithLLM` would have produced (same judgment call, same information: path +
   archetype catalog, no file contents), not a test of `classify.ts`'s own LLM-calling code — and
   merged the results via the real `mergeClassificationResults` function for schema fidelity. **Gap
   this leaves:** the actual `callClaude` code path itself was never exercised end-to-end in this
   IMPL; if that matters later (e.g. for a Step 10 PR reviewer who wants to see the real pipeline
   run), it still needs a working `claude` CLI or API key.
3. **Done (2026-08-12).** Training-data extraction written:
   `packages/sourcevision/src/analyzers/classify-elm.ts` (`extractExamples`/`fileToText`) pulls
   `(path, evidence signals) → archetype` pairs from a `Classifications` result. Also contains
   `trainArchetypeELM`/`predictArchetype`. **Important API finding, not obvious from the package
   surface:** `ELM.train()` does *not* train on a supplied corpus — it bootstraps its own training
   set from augmented variants of the category names themselves (verified by reading
   `AsterMind-Community-Edition/src/core/ELM.ts:403-487` directly). Wrong method for training on
   real labeled examples. Used `trainFromData()` with manually-encoded vectors
   (`elm.encoder.encode`/`.normalize`) instead — documented prominently in the module so Knight's
   parallel build doesn't reach for `train()` first.
4. **Done and run 2026-08-12.** Eval script written and executed:
   `packages/sourcevision/scripts/eval-classify-elm.ts` — fixed seed (`20260812`), seeded
   Fisher-Yates train/held-out split, majority-class baseline (reported for context only), and a
   precision/coverage curve across confidence thresholds. Held-out source path is an env var
   (`SV_ELM_HELDOUT_CLASSIFICATIONS`), not a hardcoded relative path — see ADR Evidence on why
   `../AsterMind-Community-Edition` isn't portable. Two fixes applied after the first run before
   trusting the output: threshold sweep recalibrated (model's real confidence range is ~0.08-0.19,
   a sweep starting at 0.5 showed 0% coverage everywhere and looked broken rather than
   miscalibrated), and an evidence-leakage bug in `classify-elm.ts`'s feature extraction fixed
   (LLM-sourced entries' `evidence` field is the resolved label restated, not independent signal —
   see ADR Evidence for detail, this is a real production-schema property, not prototype-specific).
   Both files typecheck clean (`pnpm --filter @n-dx/sourcevision typecheck`, plus a targeted check
   of `scripts/`, which isn't in `tsconfig.json`'s `include`).
5. **Gate — evaluated 2026-08-12, did not clear.** In-domain held-out precision cleared the bar
   (95.8% @ 23.1% coverage), but out-of-domain (`AsterMind-Community-Edition`, the number that
   actually matters for this ADR's Decision) did not — best meaningful-coverage point 60.9%
   precision @ 29.5% coverage, well short of 95%. Full numbers, methodology, and the two findings
   that had to be fixed/calibrated along the way (confidence-threshold miscalibration,
   evidence-leakage in the training-data extraction) are in the ADR's Evidence section. **Stopped
   here — Steps 6-8 not started.**
6. Wrap the trained model as `classify-elm.ts` — load the model, expose a
   `classifyWithELM(files): FileClassification[]` matching the shape
   `enrichClassificationsWithLLM` already returns.
7. Add `"elm"` to the `FileClassification.source` union in schema (`v1.ts`, `validate.ts`).
8. Wire into `runClassificationsPhase` (`analyze-phases.ts`), between `analyzeClassifications` and
   `enrichClassificationsWithLLM`: run the ELM stage first, shrink `unclassified` to the ELM's own
   low-confidence remainder before the LLM stage runs on what's left.
9. **Done 2026-08-12.** Updated the ADR's Evidence section with the real numbers from step 4.
   Status stays Proposed, not Accepted — step 5's gate didn't pass.
10. **Not started — no reason to yet.** A PR is for landing production wiring (steps 6-8), which
    didn't happen. Revisit if a future retry clears the gate.

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
- [x] **Confidence threshold — answered empirically, 2026-08-12, moot for now.** t=0.14 is where
      in-domain precision clears 95% at usable coverage; but since the out-of-domain gate didn't
      clear at any threshold, there's no threshold to actually ship yet. Revisit once/if retrained
      on better data.
- [ ] **New, 2026-08-12 — does the user want to gather more/better training data and retry, or is
      this a "not yet, needs more data" conclusion to sit on?** Both `TJ-A1` and Knight's `TJ-K1`
      converge on the same read: the approach works in-domain, but neither codebase's available
      data includes enough of the actual target population (files hard enough that the algorithmic
      pass alone can't resolve them) to generalize. More codebases analyzed with LLM enrichment on
      would directly address this, but costs real tokens/time — the user's call, not either agent's
      to spend unilaterally.
- [ ] **New, 2026-08-13 — pooled-training experiment result:** tried the direct fix (pooled 3 new,
      diverse codebases into training — `express`/`indie-stack`/`zustand`, chosen to fill the
      `route-module`/`store` label gaps). Did not help — in-domain generalization dropped below the
      gate it previously cleared, out-of-domain stayed similarly poor. Shared with Knight for
      independent verification (`Notes/NOTE-archer-to-knight-2026-08-13-expanded-training-corpora.md`).
      Open: does a much larger pool (dozens of codebases) behave differently, or is simple pooling
      the wrong lever entirely?
- [ ] **New, 2026-08-12 — worth its own ADR:** the evidence-leakage finding (LLM-sourced
      `classifications.json` entries have their own label restated as "evidence") is a real gap in
      the production schema, not specific to this prototype. `TJ-A1` and `TJ-K1` each worked around
      it differently. Someone should write this up properly, verified at file:line, per the same
      doctrine that produced the original fused-call ADR requirement.
