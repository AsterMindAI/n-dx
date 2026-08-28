# IMPL — 2026-08-28 — Building the ELM classification tier

**Implements:** [`ADR-2026-08-28-jam-implement-the-elm-tier.md`](../ADR/ADR-2026-08-28-jam-implement-the-elm-tier.md)
**Owner:** Jam (Team Nolan) · **Backlog:** `TN-J23`
**Status:** Phase 1 runnable now. **Phase 3 blocked on the leads funding gold set #2.**

## Scope

**Touches:** `scripts/elm-*.mjs`, then `packages/sourcevision/src/analyzers/{classify,claude-client}.ts`
and `cli/commands/analyze-phases.ts` — all mine.

**Does not touch:** `packages/llm-client/**` (Butter's) · `pnpm-lock.yaml` or any workspace
`package.json`. Everything here runs on the **root-resolvable** `@astermind/astermind-community`
that already exists (`43d6db51`). Only a shipped wrapper needs the workspace declaration, so
**Butter's lockfile blocker does not gate any of this.**

**Migrates to Butter's wrapper (`TN-B3`) when it lands** — asked, awaiting their answer. Until then,
library-direct with a note.

---

## Phase 0 — Contamination rules (read before touching anything)

The single biggest risk to this work is not the model; it is producing a number nobody can trust.

- **Gold set #1 (`k2-goldset-packet.csv`) is the DEV set. Its labels are known to me.** Iterate
  against it freely; **never publish a figure from it as a result.**
- **Gold set #2 does not exist yet and must not be looked at until Phase 3**, once, after the model
  is frozen. If Phase 3 fails, the honest move is a *third* set, not a retune against the second.
- **Model selection uses cross-validation on the TRAINING split only**, against LLM labels
  (`scripts/elm-diagnostics.mjs` already does this). Held-out and gold sets are not inputs to
  selection.
- **Every reported figure is multi-seed mean + range.** The observed spread is ~16 pp; single runs
  are noise. `cfg.seed` **defaults to 1337**, so unseeded repeats are identical copies — pass it.
- **`assertHarnessCanLearn()` runs before any number is reported.** It exists because string labels
  silently trained nothing and produced `VERDICT: NOT VIABLE` at 2.4%.

## Phase 1 — Find the model (train-CV only, no gold)

The K2 model used `hiddenUnits: 256`, arbitrary and never tuned. Capacity is worth **+12 pp** from
256→1024 and had not plateaued.

- [ ] **Capacity sweep to plateau** — 256 / 512 / 1024 / 2048 / 4096. Note the ELM solve is roughly
      cubic in hidden units; 4096 is minutes, not seconds. Record wall time, because a tier that
      takes longer than the LLM call it replaces has no purpose.
- [ ] **Architecture sweep** — the library ships ~40 variants. Test at minimum `KernelELM`
      (with `KELMMode: 'nystrom'` and seeded landmarks, so cost stays sub-quadratic),
      `ConfidenceClassifierELM` (native confidence + `evaluate`), and `VotingClassifierELM`.
- [ ] **Regularisation** — `ridgeLambda` defaults to `1e-2` and is untouched. With 1688 features and
      241 rows this is a heavily over-parameterised fit; sweep it.
- [ ] **Do NOT re-litigate features or corpus size.** Both were measured and rejected in
      `elm-diagnostics.mjs`: naive structural encoding **−20.1 pp**, and the learning curve is flat
      (last 48 rows bought **<1 pp**). Revisit only with a genuinely different idea, not more of the
      same.

**Gate:** if CV plateaus below the LLM's level with nothing left to tune, stop and report. That is
the "nothing further to tune" abandon condition from the ADR.

## Phase 2 — Evaluate on the dev gold set

- [ ] Run the frozen Phase-1 model against gold set #1 (`pass2_after_reading_file`).
- [ ] Recompute the confidence-gate table **against truth**, not against the teacher. The teacher-based
      table (84.5% top-decile) flattered the model; against truth the same gate was non-monotonic
      (69.0 → 72.4 → 63.2) and never reliably beat 72.3%.
- [ ] Choose a provisional operating point at a **lumpiness boundary** — coverage that actually
      crosses a multiple of 30, since 30%→40% buys zero extra calls.
- [ ] **Label every one of these numbers DEV.** They justify proceeding to Phase 3; they are not
      results.

## Phase 3 — Certify (BLOCKED on the leads)

- [ ] Commission gold set #2: fresh files not in the corpus, same blind two-pass protocol,
      `scripts/elm-goldset-packet.mjs` regenerated against a new sample. **A different labeller from
      #1 if possible** — that also yields the inter-rater number `TN-J20` could not produce.
- [ ] Evaluate the **frozen** model once. No tuning after this point.
- [ ] **S1:** gated ELM precision ≥ LLM-vs-truth on the same files. **S2:** ≥3 of 9 calls avoided.
- [ ] Carry forward the labeller's correction: judge taxonomy health on `confident_yes_no`, **not**
      the `unclear` column — `unclear` was 0/83 while not-confident was 30/83.

## Phase 4 — Integrate behind a never-worse gate

- [ ] Insert the tier in `analyze-phases.ts` **before** the LLM gate at `:219`. Confident predictions
      are taken; everything else flows to `enrichClassificationsWithLLM` untouched.
- [ ] **The gate threshold is a certified constant, not a tunable.** It comes from Phase 3 and
      changing it requires re-certification. Encode that in a comment at the definition.
- [ ] Mark rows `source: "elm"` alongside `"algorithmic"` / `"llm"` so `bySource` stays honest and
      `elm-calls-avoided.mjs` keeps working.
- [ ] **Write the tests first and watch them fail.** At minimum: low-confidence files still reach the
      LLM; batch count drops by the predicted amount; `--fast` still spends zero tokens.
- [ ] **Decide and document what `--fast` means now.** The ELM is local and free, so it *may* run
      under `--fast` — but that changes a user-visible contract and must be a stated choice.
- [ ] `pnpm typecheck` + `npx vitest run tests/` at the root. **Not `pnpm test`** — it aborts at
      `packages/rex`'s flaky perf test before reaching `tests/e2e/`.

## Phase 5 — Dark run

- [ ] Compute ELM predictions and log them **without acting on them**. Record agreement with the LLM
      on real analyses.
- [ ] **S3:** live agreement must fall within the range Phase 3 predicted. If it does not, the
      certification was wrong and the tier does not enable.

## Phase 6 — Enable, measure, and be able to undo it

- [ ] Enable behind a config flag defaulting **off**, with a one-line rollback.
- [ ] Re-run `elm-calls-avoided.mjs`. **Call counts must match the Phase-2 projection**; if not, the
      projection was wrong and that discrepancy is the story.
- [ ] Publish with coverage, backend, and the agreement-vs-accuracy distinction stated.
- [ ] Redeploy the `SYNC-001` artifact — it still reads **"0 — Tokens we can currently measure"**,
      false since `955d9c59`, and lives outside the repo where no grep will find it.
- [ ] Amend `TN-J21` (currently "do not ship") with the outcome, in either direction.

---

## Known traps

| Trap | Guard |
|---|---|
| `trainFromData` accepts **string labels**, trains nothing, errors not at all | Explicit one-hot; `assertHarnessCanLearn()` first. |
| `cfg.seed` **defaults to 1337** → repeats are identical copies | Pass `seed` explicitly per repeat. |
| 13-class softmax caps confidence ≈ **0.245** | Percentile gates only; absolute thresholds select nothing. |
| Calls avoided are **lumpy** (`ceil(n/30)`) | Pick coverage at a boundary; verify with the instrument. |
| Teacher-based precision **flatters** the model | Calibrate against truth. Teacher-gate said 84.5%; truth-gate never beat 72.3%. |
| `grep` cannot see `analyze-phases.ts` (2 NUL bytes at 16345, 16374) | `python3` / `grep -a` / `rg --text`. **Leave the bytes alone.** |
| Rule/model changes invisible without `--full` (incremental cache) | `--full` when re-measuring. |
| HEAD moves under you (shared checkout) | Claim in `IN-FLIGHT.md`; re-check `git log` before assuming state. |

## Abandon conditions

- Phase 1 CV plateaus below LLM-vs-truth with nothing left to tune.
- Phase 3 S1 fails on gold set #2.
- Leads decline gold set #2 → **cannot certify → do not ship** (ADR § 4).
