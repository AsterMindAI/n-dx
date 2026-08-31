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

### Addendum to the Phase 1 pre-registration — committed before the sweep ran

Two harness diagnostics, run before the full sweep and **without reference to any accuracy number**.
Both are properties of the feature space, not of a result, which is why adding an arm here is not
fishing. Recorded in this order deliberately.

**1. The vocabulary-cap concern above is inert, and I am striking it rather than quietly dropping
it.** The train split's TF-IDF vocabulary is **1688 terms**, so caps of 2000 and 4000 produce an
identical 1688-dimensional space. `elm-diagnostics.mjs` (4000) and `elm-feasibility-screen.mjs`
(2000) were never actually measuring different feature spaces. Only `vocabCap: 1000` binds, and it
stays in the sweep as the one arm that tests whether truncation helps.

**2. `KernelELM`'s default RBF gamma is degenerate on this feature space, and the pre-registered
RBF arm would have measured that rather than the architecture.** `KernelSpec.gamma` defaults to
`1/D`. Here:

```
D = 1688                     ->  default gamma = 5.92e-4
mean ||x - z||^2  = 1.862        (TF-IDF rows, train split)
max  ||x - z||^2  = 3.697
K(x,z) = exp(-gamma * 1.862)  =  0.9989
```

**Every pair of points has kernel similarity ~0.999.** The Gram matrix is all-ones to three decimal
places and carries no discriminative structure. A bad score from that arm is a statement about a
default, not about kernel methods — and "a broken configuration and a genuine negative look
identical in a results table" is the § 6.3 trap this project already has a guard for.

`KernelELM` itself is fine: on a separable 2-class problem it returns the correct labels in all six
(kernel × mode) combinations. So the harness works; the default does not. A
`assertKernelHarnessCanLearn()` check is added alongside `assertHarnessCanLearn()` so a future
kernel negative carries the same guarantee the ELM ones do.

**Declared addition — a gamma arm, on the same adoption rule.** `gamma` ∈ `{0.5, 1, 2, 4}` at
`m=128`, `λ` ∈ `{1e-2, 1e-1}`. These bracket the median-heuristic scale (`1/median ||x-z||^2 ≈ 0.54`)
and an order of magnitude above it. **The default-gamma arms stay in the sweep and get reported**,
labelled confounded, because deleting them would hide why the arm was added.

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
- [x] **Architecture sweep — DONE 2026-08-28. See Phase 1 RESULT below.**
      `KernelELM` (nyström, seeded landmarks) and `VotingClassifierELM` both tested as asked;
      `ConfidenceClassifierELM` moved to Phase 2 as a gate, per the pre-registration. **The winner
      was none of them — it was `activation: tanh`, +4.0 pp on 9 of 9 paired runs.** Linear
      `KernelELM` also clears (+3.0 pp, 7 of 9); RBF and voting lose.
- [x] **Regularisation — DONE 2026-08-28. `ridgeLambda` is NOT a lever.**
      Flat from `1e-4` to `1e-1` (±0.6 pp, 4 of 9 wins), collapsing only at `1e0`. The prior behind
      this sweep — "1688 features on 241 rows is heavily over-parameterised, so ridge should
      matter" — was reasonable and wrong. The over-parameterisation is real; ridge is not the fix.
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

## Phase 1 RESULT — 2026-08-28, K2. Activation was the lever. Phase 1 is closed.

Run: `node scripts/elm-architecture-sweep.mjs` → `scripts/data/elm-architecture-sweep.json`.
Adoption rule as pre-registered at `f4a06175`: mean ≥ incumbent + 1.5 pp **and** ≥ 7 of 9 paired wins.

| config | CV vs teacher | Δ | paired wins | verdict |
|---|---|---|---|---|
| **`elm-1024 tanh`** | **64.64%** | **+4.01 pp** | **9 of 9** | **ADOPTED — frozen for Phase 2** |
| `elm-1024 gelu` | 64.59% | +3.96 pp | 9 of 9 | clears; loses tie-break on mean and cost (155s vs 140s) |
| `kelm linear nystrom m128 λ1e-3` | 63.62% | +3.00 pp | 7 of 9 | clears |
| `kelm linear nystrom m128 λ1e-2` | 63.49% | +2.86 pp | 7 of 9 | clears |
| `kelm linear nystrom m128 λ1e-1` | 62.43% | +1.80 pp | 7 of 9 | clears |
| `elm-1024 vocab1000` | 61.73% | +1.11 pp | 7 of 9 | **near-miss — fails the margin leg only** |
| `elm-1024 relu` (incumbent) | 60.63% | — | — | superseded |
| `ridgeLambda` 1e-4 / 1e-3 / 1e-1 | 60.7 / 60.8 / 60.2% | +0.1 / +0.1 / −0.4 | 4 of 9 | **not a lever** |
| `ridgeLambda` 1e0 | 52.4% | −8.2 pp | 0 of 9 | over-regularised |
| `elm-1024 vocab2000` | 60.63% | +0.00 pp | 0 of 9 | identical to 4000, as the addendum predicted |
| `voting` 5× stacked OOF | 57.9% | −2.8 pp | 1 of 9 | **loses** |
| `kelm rbf` γ0.5 (best) | 60.8% | +0.1 pp | 5 of 9 | not a lever |
| `kelm rbf` default γ | 33.3–34.9% | ≈ −27 pp | 0 of 9 | **confounded — see below** |

**Tie-break, stated because it was not pre-registered.** `tanh` and `gelu` both clear on 9 of 9 and
are separated by 0.05 pp — a tie in everything but arithmetic. The rule fixed the adoption
threshold, not what to do with two winners. `tanh` is taken on the higher mean and the lower cost;
**treat them as equivalent**, and if `tanh` disappoints on gold set #2, `gelu` is not a retune.

**Three things worth carrying forward:**

1. **`ridgeLambda` was the sweep with the best prior and it is flat.** The plan argued 1688 features
   on 241 rows is heavily over-parameterised and regularisation should therefore matter. It does
   not — 1e-4 through 1e-1 sit inside ±0.6 pp. The over-parameterisation is real; the fix is not
   ridge.
2. **The declared gamma arm was justified, and the prediction held.** Default-γ RBF scores 33.9%;
   `γ=0.5` on identical data scores 60.8%. **27 pp from one default.** The pre-registered RBF arms
   were measuring an all-ones Gram matrix, which the addendum said before the run.
3. **`relu` was arbitrary in exactly the way `hiddenUnits: 256` was.** Nobody chose it; the
   feasibility screen defaulted to it and every later script inherited it. That is now two of two
   untested defaults that turned out to be worth ≥ 4 pp.

**⚠️ Capacity × activation is untested and I am not testing it.** The 1024 plateau was measured
entirely on `relu`. The handbook says do not sweep capacity again, so this is recorded as a known
gap needing its own pre-registration — not quietly reopened.

**Phase 1 is closed.** Architecture *is* a lever, contrary to the close-condition's expectation.
Features, corpus size, `ridgeLambda`, ensembling and RBF kernels are not.

## Phase 2 RESULT — 2026-08-28, K2. DEV only.

Run: `node scripts/elm-operating-point.mjs --activation=tanh` → `elm-operating-point-tanh.json`.
The relu run is kept at `elm-operating-point.json` as the evidence for § "the near-miss" below.

| design | coverage | ELM precision (range) | LLM, same files | gap | n-dx calls |
|---|---|---|---|---|---|
| `B` abstention (adopted) | 25.6% | 74.7% (68.2–80.0) | 72.9% | **+1.8** | 2 |
| **`B+su` + top 10% of S/U** | **32.9%** | **75.1%** (71.4–81.5) | 74.1% | **+1.0** | **3** |
| `B+su` + top 15% of S/U | 36.6% | 74.6% (64.5–80.0) | 74.4% | +0.2 | 3 |
| `B+su` + top 50% of S/U | 63.1% | 72.5% (67.9–77.4) | 71.5% | +1.0 | 5 |
| `g` gate top 10% / 30% | 9.6% / 30.1% | 91.7% / 80.8% | 93.3% / 84.3% | −1.7 / −3.5 | 1 / 3 |
| `cc` learned gate top 30% | 30.1% | 75.2% (60.0–88.0) | 77.6% | −2.4 | 3 |

**5 of 18 designs beat the LLM on the files they claim; `B+su` at 32.9% also avoids 3 of 9 calls.**
Both bars met in the mean. **Every range straddles**, margins are ~1 pp on ~27 files per seed, and
all of it is DEV. This justifies Phase 3; it is not Phase 3.

**⚠️ The near-miss, recorded because it is the most useful thing in this section.** The first
Phase 2 run used `relu` and produced **0 of 18 beating the LLM**, and a draft ADR recommending the
tier not ship. That was a verdict on a model Phase 1 had already rejected — **the same error K2
made with `hiddenUnits: 256`, one iteration later.** What caught it was not judgement but the
pre-registered rule that Phase 2 runs the model Phase 1 adopted.

**Also settled:** the confidence gate ranks by **file easiness**, and easiness helps the teacher
more than the student — every `g` row is negative under both activations, while every winning row
is an abstention variant. That is why `TN-J19`'s top-decile 84.5% never translated.

**Operational trap found the hard way.** The first full sweep was **OOM-killed** on the voting
config (8 GB box, 9 GB swap in use, a second job running) and exited **0 with an empty results
table** — indistinguishable from a clean early exit. The vectorizer cache is now bounded to one
`vocabCap` (it had been accumulating 3 fold-seeds × 5 folds × 3 caps = 45 dense matrices) and base
models are freed as predictions are taken. **Do not run two of these concurrently on this machine.**

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
