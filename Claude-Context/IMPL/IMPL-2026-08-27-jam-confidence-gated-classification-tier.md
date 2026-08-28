# IMPL — 2026-08-27 — Building the confidence-gated classification tier

**Implements:** [`ADR-2026-08-27-jam-confidence-gated-deployment-and-a-measurable-kill-criterion.md`](../ADR/ADR-2026-08-27-jam-confidence-gated-deployment-and-a-measurable-kill-criterion.md)
**Owner:** Jam (Team Nolan) · **Backlog:** `TN-J19`
**Status:** Steps 1–2 runnable now. **Step 4 (integration) does not start until the ADR is accepted.**

## Scope

**Touches:** `scripts/elm-*.mjs` (mine), and eventually
`packages/sourcevision/src/analyzers/classify.ts` + `claude-client.ts` (mine).

**Does not touch:** `packages/llm-client/**` (Butter's) · `pnpm-lock.yaml` or any workspace
`package.json` — **the whole of this IMPL runs on the root-resolvable `@astermind/astermind-community`
dependency that already exists (`43d6db51`).** Only Butter's shipped wrapper needs the workspace
declaration; feasibility and calibration work here does not, and must not wait on it.

**Depends on Butter for:** nothing until Step 4. The shared inference wrapper (`TN-B3`) is the right
home for load/train/predict *when it lands*; until then this uses the library directly from
`scripts/` and does not fork it.

---

## Step 1 — Choose the operating point at a lumpiness boundary

Coverage must be picked where it actually buys a call, not on a round number.

- [ ] From `scripts/data/elm-feasibility-screen.json`, find every coverage at which
      `ceil((255 - gated)/30)` drops. **30% → 40% buys zero extra calls** (both land on 6 batches);
      the real boundaries are the only candidates worth proposing.
- [ ] Report the candidate points as `(coverage, precision, calls avoided)` triples and recommend
      one. **Do not maximise coverage** — precision falls monotonically and the leads' answer to
      open question 2 sets the ceiling.
- [ ] Repeat for AsterMind-CE (69 files, 3 batches) — its boundaries differ and a single operating
      point must work for both, or be per-repo and say so.

**Gate:** if no coverage clears **K1 (≥3 of 9 calls on n-dx)** at a precision the leads accept,
stop and report that before building anything.

## Step 2 — Harden the estimate before trusting it

The screen is 7 seeds on one 241/83 split. That is thin for a deployment decision.

- [ ] **k-fold cross-validation** over the full 324 rows rather than a single held-out split, so the
      operating point is not an artifact of which 83 rows landed in held-out.
- [ ] Keep the seed spread — the observed range was **16 pp** (51.8–67.5%), which is wide enough that
      any single number is close to meaningless. Report mean and range for every figure.
- [ ] **Do not tune the model against held-out.** If any hyperparameter changes after seeing a
      held-out number, the run is contaminated and must be re-declared as such. The pre-registered
      bar at `f3205143` stays the record for Step 3 regardless of what this step finds.
- [ ] Re-run `assertHarnessCanLearn()` — it exists because a silent training failure produced 2.4%
      agreement and the words `VERDICT: NOT VIABLE`. **Never report a number from a run where it did
      not execute.**

## Step 3 — The bounded gold set (K2), *if the leads approve it*

**Blocked on ADR open question 1.** Do not start without it.

- [ ] Extract the held-out files labelled `service` or `utility` (~60 files).
- [ ] Have **someone other than me** label them — I have read these paths for two weeks and cannot
      claim to be blind to the teacher's choices.
- [ ] Report three numbers, not one: **ELM vs gold**, **LLM vs gold**, and **ELM vs LLM**. K2 is
      met only if ELM-vs-gold ≥ LLM-vs-gold on the same files.
- [ ] **If the LLM scores badly against gold**, that is a finding about the corpus, not about the
      ELM, and it invalidates the training labels rather than the model. Say so plainly; it would
      mean the corpus needs rebuilding, not the tier abandoning.

## Step 4 — Integration (ADR-accepted only)

- [ ] Insert the tier at `analyze-phases.ts:219`, **before** the LLM gate — the ELM answers the
      confident subset, the remainder flows to `enrichClassificationsWithLLM` untouched.
- [ ] Write the test first and **watch it fail**. Assert that (a) low-confidence files still reach
      the LLM and (b) the batch count drops by the predicted amount. A green test nobody has seen
      go red is indistinguishable from no test.
- [ ] Mark ELM-sourced rows with a distinct `source` (`"elm"`, alongside `"algorithmic"` and
      `"llm"`) so `bySource` stays honest and `elm-calls-avoided.mjs` keeps working.
- [ ] **Preserve the `--fast` contract**: `--fast` must remain zero-token, and the ELM tier is local
      so it may run under `--fast`. Decide and document which, because it changes what `--fast`
      means to users.
- [ ] `pnpm typecheck` + `npx vitest run tests/` at the root. **Not `pnpm test`** — it aborts at
      `packages/rex`'s flaky perf test before reaching `tests/e2e/`.

## Step 5 — Re-measure and publish honestly

- [ ] Re-run `elm-calls-avoided.mjs`. **Calls avoided must match the Step 1 projection.** If it does
      not, the projection was wrong and the discrepancy is the story.
- [ ] Every published figure states **coverage**, **backend** (CLI ~53k–268k vs API ~2.7k–13.7k per
      avoided call — Butter's A4; the same ELM saves ~20x more on CLI), and **agreement vs accuracy**.
- [ ] Redeploy the `SYNC-001` artifact. It still shows **"0 — Tokens we can currently measure"**,
      false since `955d9c59`, and it lives outside the repo where no grep will find it.

---

## Known traps (all cost me time already)

| Trap | Guard |
|---|---|
| `ELM.trainFromData` accepts **string labels**, trains nothing, reports no error → predicts one class for everything | Always pass explicit one-hot. `assertHarnessCanLearn()` runs first. |
| `cfg.seed` **defaults to 1337** → unseeded repeats are identical copies masquerading as independent runs | Pass `seed` explicitly per repeat. |
| 13-class softmax caps confidence near **0.25** → absolute gates select nothing | Percentile thresholds only. |
| Calls avoided are **lumpy** (`ceil(n/30)`) → coverage gains often buy zero calls | Choose coverage at a boundary; verify with the instrument. |
| `grep` cannot see `analyze-phases.ts` (2 NUL bytes) | `python3` / `grep -a` / `rg --text`. **Leave the bytes alone** — lead's decision. |
| Rule changes are invisible without `--full` (incremental cache) | `--full` when re-measuring classification. |

## What would stop this

- **Step 1:** no coverage clears K1 at an acceptable precision.
- **Step 2:** cross-validation puts the mean materially below the Step 3 screen.
- **Step 3:** ELM-vs-gold falls below LLM-vs-gold.
- **Leads:** decline the gold set → K2 unmeetable → publish *"feasible, value quantified, quality
  unverified"* and do not ship.
