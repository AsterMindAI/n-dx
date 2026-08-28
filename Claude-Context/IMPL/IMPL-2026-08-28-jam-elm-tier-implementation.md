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

## Phase 1 pre-registration — fixed 2026-08-28 by K2, BEFORE any sweep ran

> Handbook § 6.1: *write the threshold, commit it, then run.* This section was committed in its
> own commit before `scripts/elm-architecture-sweep.mjs` existed. **It is a record, not a knob** —
> the same status as the `f3205143` bar in `elm-feasibility-screen.mjs`. If a number below is
> edited after a run, the run is void.

**Incumbent (the thing to beat).** `ELM { hiddenUnits: 1024, activation: "relu", ridgeLambda: 1e-2 }`
over bag-of-path-token TF-IDF, vocabulary cap **4000**, explicit one-hot `Y`.

> ⚠️ **Vocabulary cap is an uncontrolled difference in the existing scripts and is being pinned
> here.** `elm-diagnostics.mjs` fits TF-IDF at **4000** and is the source of the 64.1% capacity
> figure; `elm-feasibility-screen.mjs` and `elm-k2-analysis.mjs` fit at **2000**. Nothing recorded
> that they differ. The incumbent is pinned to **4000** so it reproduces the number it inherits,
> and the cap is swept as a declared configuration rather than left to drift.

**Metric.** 5-fold CV accuracy against **LLM labels on the 241-row TRAIN split only**. The 83-row
held-out split and gold set #1 are **not inputs to selection** and are not read by the sweep.

**Sampling.** 9 paired runs per configuration: 3 fold-seeds `{7, 13, 29}` × 3 model seeds
`{101, 202, 303}`. Every configuration sees the **identical** 9 pairs and identical fold
assignments, so comparisons are paired rather than independent. `seed` is passed explicitly on
every model (it defaults to `1337`, which is how "7 independent models" once turned out to be one
model seven times).

> This also fixes a real defect in `elm-diagnostics.mjs`: its `seed` argument shuffles the **folds**
> but the ELM is constructed with a hard-coded `seed: 42` on every call, so the weight draw was
> never varied at all. Every capacity number in that script is a 1-sample estimate of model
> randomness. That does not invalidate the capacity conclusion — a 12 pp effect survives it — but
> it is why the margin below is set where it is.

**Adoption rule.** A challenger replaces the incumbent only if **both** hold:

- **(a)** mean CV ≥ incumbent mean **+ 1.5 pp**, and
- **(b)** the challenger wins on **≥ 7 of the 9** paired runs.

Ties, near-misses and one-legged wins keep the incumbent. Rationale for the margin: the incumbent is
already characterised, seed-to-seed spread on held-out is ~16 pp, and at n=9 a sub-1.5 pp mean
difference is not distinguishable from noise. **(b) is a sign test** — it exists so a single lucky
fold cannot carry a mean.

**Configuration set — fixed now, and closed.** Nothing may be added to this list after the first
run; a config that occurs to me later goes in a follow-up with its own pre-registration.

1. **Incumbent** — `ELM` 1024 / relu / `ridgeLambda` 1e-2 / vocab 4000.
2. **`ridgeLambda`** ∈ `{1e-4, 1e-3, 1e-2, 1e-1, 1e0}` at 1024 units. *(Never swept. 1688 features
   on 241 rows is heavily over-parameterised, so this is the sweep with the best prior.)*
3. **Activation** ∈ `{relu, tanh, gelu}` at 1024 units. *(Declared here rather than added later.)*
4. **Vocabulary cap** ∈ `{1000, 2000, 4000}`. *(Pinning the drift noted above.)*
5. **`KernelELM`** — `kernel` ∈ `{rbf, linear}`, `mode: "nystrom"` with seeded landmarks
   (`strategy: "kmeans++"`, `m` ∈ `{64, 128}`), `ridgeLambda` ∈ `{1e-3, 1e-2, 1e-1}`.
   Also one `mode: "exact"` rbf run — N=193 per fold makes the exact solve affordable, and it
   bounds what the Nyström approximation costs.
6. **`VotingClassifierELM`** over 5 seeded `ELM` 1024 base models.

**`ConfidenceClassifierELM` is deliberately NOT in this list, and that is a finding, not an
omission.** It is not an archetype classifier — it is a binary `low`/`high` head over
`(embedding, meta)` that predicts *whether an upstream model's prediction is trustworthy*
(`ConfidenceClassifierELM.d.ts`). Sweeping it here would measure a 2-class problem and compare it
to a 13-class one. It belongs in Phase 2 as a **learned gate** on top of whatever wins here, and it
is carried forward there rather than dropped.

**Phase-1 close condition.** If no challenger clears (a)+(b), Phase 1 closes with the finding
*"architecture and regularisation are not levers either"* — joining features and corpus size — and
the incumbent is frozen for Phase 2. That is a result and gets published as one.

## Phase 2 pre-registration — operating point (DEV only)

Fixed at the same commit, for the same reason: the operating-point search is where a bar gets
rationalised if it is chosen after seeing the table.

**Everything in Phase 2 is DEV.** Gold set #1's labels are known. No figure from it is a result.

**Candidate designs — fixed now, and closed:**

| | Design |
|---|---|
| **B** | **Abstention, as adopted.** Answer only when the predicted class ∉ {`service`, `utility`}. |
| **B+g** | Abstention **and** a percentile confidence gate on top of it. |
| **B+su** | Abstention **plus** the top-`q` most confident `service`/`utility` predictions. *(The handbook's own suggestion for closing the gap — it is the only candidate that can raise coverage.)* |
| **g** | Percentile confidence gate alone, no abstention. *(The `TN-J19` design, re-measured against truth rather than against the teacher.)* |

**Reporting rule.** Every cell reports multi-seed **mean and full range**. A cell whose range
straddles the LLM-vs-truth bar is reported as **straddling** and is never called a pass — that is
the error the adopted design's own 68.2–81.3% range already contains.

**Selection rule.** A candidate operating point must satisfy both:

- precision-vs-truth **mean** ≥ LLM-vs-truth on the same files, and
- coverage at or above the smallest coverage that **crosses a batch boundary** on n-dx
  (`ceil(n/30)`, 255 files, 9 batches — so the first boundary above the adopted design's 22.9% is
  **29.41%**, which is what "3 of 9" actually costs).

Anything meeting the first and missing the second is exactly the K1 problem and goes to `TN-J25`.

## Phase 1 — Find the model (train-CV only, no gold)

The K2 model used `hiddenUnits: 256`, arbitrary and never tuned. Capacity is worth **+12 pp** from
256→1024 and had not plateaued.

- [x] **Capacity sweep — DONE 2026-08-28. It plateaus at 1024.**
      `256 → 52.1% · 512 → 56.4% · 1024 → 64.1% · 2048 → 63.7% · 4096 → 64.1%`
      **Use `hiddenUnits: 1024`.** Worth **+12 pp** over the arbitrary 256 the K2 model used, and
      nothing beyond it — 4096 costs minutes of CPU for zero gain. **Do not sweep capacity again.**
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

### ⚠️ The structural ceiling nobody has named yet

**The ELM is trained on the LLM's labels, and the LLM is 72.3% correct.** A model that perfectly
imitated its teacher would score exactly 72.3% against truth — so **S1 ("beat the LLM") asks the
model to be better than the only thing it has ever been shown.**

That is not impossible: the human path-ceiling is **85.4%**, so there is real signal the LLM is
failing to capture, and a regularised model *can* exceed a noisy teacher by averaging out **random**
label noise. But it cannot beat **systematic** teacher error — if the LLM consistently mislabels a
pattern, the ELM learns that mislabelling as the truth.

**Are the LLM's errors random or systematic? — ANSWERED 2026-08-28, and the answer is favourable.**
Against the dev gold set the LLM makes **23/83 errors (27.7%)**, and on the boundary that matters
they are **almost perfectly symmetric**:

```
truth utility -> LLM said service    5
truth service -> LLM said utility    6      (the rest are scattered singletons)
```

**No directional bias.** That is the signature of *random* label noise rather than a systematic
mislabelling rule — and random noise is exactly what a regularised model can average out. **So S1
is reachable in principle**: the ELM can exceed a noisy teacher when the teacher's errors do not
point one way, and the 85.4% human ceiling says there is real signal left to capture.

This is the main reason I now think the tier is worth building rather than merely worth trying.
**It is also fragile evidence — n=11 on the boundary** — so treat it as encouraging, not settled,
and re-check it on gold set #2.

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
