# K2 Direction Handbook — building the ELM classification tier

**For:** the agent taking over Path B implementation · **From:** Jam (Team Nolan) · **2026-08-28**

Read this end to end before running anything. It is the distilled version of three weeks of work,
including the parts that went wrong — **those are the valuable half.** Every number here is
measured; where something is an estimate or a dev-only figure it says so.

---

## 1. What you are building, in one paragraph

`sourcevision` labels each source file with an **archetype** (`service`, `utility`, `config`, …).
Rules handle the easy files; the rest go to an LLM in batches of 30, costing a real API call each.
You are building a **local ELM tier** that answers some of those files for free, so fewer LLM calls
are made. **The unit of account is calls avoided, not tokens** — that is fixed by ADR, and it has
protected the project from four separate measurement errors.

## 2. The five numbers that define the problem

Learn these. Almost every mistake below came from someone (usually me) forgetting one.

| Number | Value | What it means |
|---|---|---|
| **Human path-only ceiling** | **85.4%** | A human, given only the file path, reproduces their own content-informed judgement this often. **Paths are informative.** This is the ceiling on any path-only classifier. |
| **LLM vs truth** | **72.3%** | Our teacher is 27.7% wrong. **The bar to beat.** |
| **ELM vs truth (untuned)** | **54.4%** | The K2 result. Measured on a model with `hiddenUnits: 256`, never tuned. |
| **Majority baseline** | **37.3%** | Held-out, recomputed. **Never quote a baseline from a document — recompute it.** |
| **Calls in play** | **9 of 9** | n-dx makes 9 classify batches per full analyze. That is the entire prize. |

**The corpus is 324 rows, 13 classes, and 9 of those classes have under 10 training rows.**
`service` + `utility` alone are **74%** of it.

## 3. Where things stand

**Done and settled — do not redo:**

- **Capacity is solved.** `256 → 52.1% · 512 → 56.4% · 1024 → 64.1% · 2048 → 63.7% · 4096 → 64.1%`.
  **Use `hiddenUnits: 1024`.** Hard plateau. Do not sweep capacity again.
- **Features: rejected.** Naive structural encoding (positional tokens, dir bigrams, basename) scored
  **−20.1 pp**. It fragments a small signal. Plain bag-of-path-tokens TF-IDF wins.
- **More data: rejected as *the* lever.** Learning curve `48 → 46.7%, 97 → 50.6%, 145 → 53.0%,
  193 → 53.8%`. The last 48 rows bought **<1 pp**.
- **`TN-J24` merge: rejected.** Merging `service`/`utility` is worth +26.8 pp but produces a class
  holding 74% of files — a category that size tells you nothing. A hierarchical variant was measured
  and gains nothing (≈63.7% vs 64.1% flat), because the binary specialist only reaches 67.8%.

**The adopted design — abstention:**

> The ELM answers **only when it predicts a class other than `service` or `utility`.** Everything
> else falls through to the LLM untouched.

DEV numbers: claims **22.9%** of files at **75.5%** precision vs truth, against the LLM's 72.3%.
**It beats the bar (S1) but avoids only 2 of 9 calls, failing S2 (≥3).** That gap is the open
engineering problem you are inheriting.

**Why abstention is the right shape:** the model is worst exactly where the taxonomy is weakest, the
teacher is noisiest, and the human rater was least confident. It should decline those. A model does
not have to answer every question.

## 4. The single most important rule: contamination

**Gold set #1 (`scripts/data/k2-goldset-packet.csv`) is SPENT.** Its labels have been read. It is
now a **development set**.

- Iterate against it freely.
- **Never publish a number from it as a result.** Label everything from it `DEV`.
- **Certification requires gold set #2** — fresh files, blind two-pass protocol, labelled once, at
  the end, against a frozen model. If Phase 3 fails, the honest move is a *third* set, not a retune
  against the second.
- **Model selection uses cross-validation on the TRAINING split only** (`scripts/elm-diagnostics.mjs`
  already does this). Held-out and gold are never inputs to selection.

**If the leads will not fund gold set #2, the tier does not ship** — not because the model is bad,
but because there would be no honest way to say whether it is.

## 5. Traps that have already cost real time

Each of these produced a wrong number that was believed for a while.

| Trap | What it looks like | Guard |
|---|---|---|
| **String labels train nothing** | `trainFromData(X, y)` with string `y` raises **no error** and silently trains a model that predicts one class for everything. Produced **2.4% agreement and the words `VERDICT: NOT VIABLE`.** | Pass explicit one-hot. `assertHarnessCanLearn()` must run before any number is reported. |
| **Seed defaults to 1337** | "7 independent models" are byte-identical copies. I reported `range 57.8–57.8%`. | Pass `seed` explicitly per repeat. Real spread is ~16 pp. |
| **Softmax caps confidence ≈0.245** | A 13-class softmax never exceeds ~0.25, so an absolute gate like `>= 0.5` selects **nothing**. | Percentile thresholds only. |
| **Teacher-gating flatters the model** | Confidence gate looked like 84.5% precision against the *teacher*; against **truth** the same gate was non-monotonic (69.0 → 72.4 → 63.2) and never reliably beat 72.3%. | Always calibrate against truth. |
| **Calls avoided are lumpy** | `ceil(n/30)`. A real bug fix reclassified 4 files (259→255) and avoided **zero** calls. 30%→40% coverage also buys zero. | Choose coverage at a batch boundary; verify with `elm-calls-avoided.mjs`. |
| **`grep` cannot see `analyze-phases.ts`** | Two NUL bytes at offsets 16345/16374 make `file` call it binary; **grep exits 1 and prints nothing.** | `python3` / `grep -a` / `rg --text`. **Leave the bytes alone** — lead's decision. |
| **Rule/model changes are invisible** | Incremental cache reuse means re-analysis shows no change. | `--full` when re-measuring classification. |
| **HEAD moves under you** | Shared checkout with other agents; HEAD moved mid-session four times. | Claim in `IN-FLIGHT.md`; re-check `git log` before assuming state. |
| **`pnpm test` never reaches `tests/e2e/`** | It aborts at `packages/rex`'s flaky 200-item perf test (613 ms vs a 500 ms budget; passes in isolation). | Use `npx vitest run tests/` at the root. |
| **Scratchpad reaping** | `/private/tmp` was reaped mid-session, leaving a husk and a silent `0 files cataloged` run that looked like a regression. | Stage corpora under `~`, not the session scratchpad. |

## 6. The methodological discipline that actually mattered

Three habits caught three wrong conclusions. Keep them.

1. **Pre-register the bar.** Write the threshold, commit it, *then* run. The Step 3 bar was committed
   at `f3205143` before any model ran. Without that I would have rationalised whatever came out.
2. **Distinguish "consistent with" from "recorded".** I twice published a figure that *reconciled*
   with the code rather than being *measured* — the 5.9% baseline, and a "3 classify + 6 enrichment"
   split that no artifact actually recorded. **Check whether something carries the number before
   quoting it.**
3. **Sanity-check the harness before believing a negative.** A broken harness and a genuine negative
   look identical in a results table. `assertHarnessCanLearn()` exists because of this.

## 7. What to do next, in order

1. **Phase 1 remainder** — architecture sweep (`KernelELM` with `KELMMode: 'nystrom'`,
   `ConfidenceClassifierELM`, `VotingClassifierELM`) and `ridgeLambda` (defaults to `1e-2`, never
   swept; 1688 features on 241 rows is heavily over-parameterised). **Train-CV only.**
2. **Close the S2 gap.** The adopted design avoids 2 of 9 calls; S2 wants ≥3. Ideas not yet tested:
   layering a confidence gate *on top of* abstention; admitting very-high-confidence
   `service`/`utility` predictions. Either raise coverage or take the number to the leads — **S2 is
   theirs to relax, not yours.**
3. **Phase 3 certification** on gold set #2 (blocked on funding).
4. **Integrate** behind a never-worse gate, `source: "elm"`, tests written red-first.
5. **Dark run** before enabling.

## 8. Things that are *not* your job

- **`packages/llm-client/**` is Butter's.** Do not edit it. `cliFlags` is already public on
  `CompletionRequest`, so anything you need at the call site can be done from `sourcevision`.
- **`TN-J22` — the LLM is 13.1 pp below the human path ceiling.** Improving the classify prompt is
  a **cheaper and larger win than this entire tier** and is still unclaimed. If you find yourself
  with spare capacity, say so out loud rather than quietly optimising the ELM.
- **Token conversion is Path A's.** Quote calls avoided; cite Butter's note for the token range, and
  state the backend — an avoided call is ~53k–268k tokens on the CLI but ~2.7k–13.7k on the API,
  roughly **20x** difference.

## 9. Map

| Thing | Where |
|---|---|
| Corpus (324 rows, seed 42) | `scripts/data/elm-archetype-corpus.json` |
| Gold set #1 — **DEV, spent** | `scripts/data/k2-goldset-packet.csv` |
| Feasibility screen + confidence gate | `scripts/elm-feasibility-screen.mjs` |
| K2 five-comparison analysis | `scripts/elm-k2-analysis.mjs` |
| Capacity / features / data diagnostics | `scripts/elm-diagnostics.mjs` |
| Calls-avoided instrument | `scripts/elm-calls-avoided.mjs` |
| Gold-set packet builder | `scripts/elm-goldset-packet.mjs` |
| Insertion point | `analyze-phases.ts:219` (LLM gate) |
| Batch size (30) | `classify.ts:322` |
| What the teacher sees | `classify.ts:486` — **path only** |
| Current plan | `ADR/IMPL-2026-08-28-jam-*` |
| Everything, with provenance | `Claude-Context/Nolan-Agents/ELM-FINDINGS.txt` |

## 10. If you read nothing else

**The ELM does not have to win. It has to know when to answer.** Every gain in this project came
from narrowing what the model is asked to do — not from making it smarter. And every serious error
came from believing a number whose provenance nobody had checked.
