# K2 Direction Handbook — building the ELM classification tier

**For:** the agent taking over Path B implementation · **From:** Jam (Team Nolan) · **2026-08-28**
**Revised 2026-08-28 by K2** after running Phase 1 and Phase 2. Changed lines are marked **[K2]**.
Jam's text is otherwise untouched — where I contradict it, both versions are visible on purpose.

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
| **[K2] LLM vs truth, on the files the tier claims** | **~74%** | **The bar that actually applies.** S1 says "on the same files"; the global 72.3% is a different, easier test. Use this one. |
| **Majority baseline** | **37.3%** | Held-out, recomputed. **Never quote a baseline from a document — recompute it.** |
| **Calls in play** | **9 of 9** | n-dx makes 9 classify batches per full analyze. That is the entire prize. |

**The corpus is 324 rows, 13 classes, and 9 of those classes have under 10 training rows.**
`service` + `utility` alone are **74%** of it.

## 3. Where things stand

**Done and settled — do not redo:**

- **Capacity is solved.** `256 → 52.1% · 512 → 56.4% · 1024 → 64.1% · 2048 → 63.7% · 4096 → 64.1%`.
  **Use `hiddenUnits: 1024`.** Hard plateau. Do not sweep capacity again.
  **[K2] ⚠️ measured entirely on `relu`. The capacity × activation interaction is untested.**
- **[K2] Activation is solved, and it was the lever nobody had swept.** `tanh` **64.6%** vs `relu`
  **60.6%** — **+4.0 pp on 9 of 9 paired runs**, train-CV only. `gelu` ties and is an equivalent
  fallback. **Use `activation: "tanh"`.** `relu` was arbitrary in exactly the way `256` was: the
  feasibility screen defaulted to it and every later script inherited it.
- **[K2] `ridgeLambda`: rejected.** Flat from `1e-4` to `1e-1` (±0.6 pp), collapsing only at `1e0`.
  This was the sweep the plan had the highest prior on. The over-parameterisation is real; ridge is
  not the fix.
- **[K2] Ensembling and RBF kernels: rejected.** Stacked voting over 5 seeded ELMs **loses 2.8 pp**.
  RBF loses at every γ tested. Linear `KernelELM` clears the bar (+3.0 pp) but is beaten by `tanh`.
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

> **[K2] Both halves of that paragraph have moved. Read `ADR-2026-08-28-k2-replace-k1-…` before
> acting on it.**
>
> - **The comparison was against the wrong denominator.** 72.3% is the LLM over *all* held-out
>   files; the design claims a hand-picked fifth of them. On the same files, and on the `tanh`
>   model, abstention beats the LLM by **+1.8 pp** (74.7% vs 72.9%). Real, but different arithmetic.
> - **The S2 gap is closed, by `B+su`.** Abstention **plus the top 10% most-confident
>   `service`/`utility` predictions** reaches **32.9% coverage at 75.1% vs 74.1% — 3 of 9 calls.**
> - **Plain abstention can never close it.** Its ceiling is the non-`service`/`utility` share,
>   **26.2%** of the corpus, against the 29.4% that 3-of-9 requires. Structural, not a tuning gap.
> - **K1/S2 itself is being replaced** — see § 7.

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
| **[K2] Comparing against a global average** | The LLM's 72.3% is over *all* files. A gate that picks its own files must be compared on *those* files. Under the wrong denominator 12 of 18 designs "passed"; under the right one, 0. | Use `elm-operating-point.mjs`, which reports both and makes same-files primary. |
| **[K2] Measuring a model your own sweep rejected** | My first Phase 2 run used `relu` after Phase 1 had adopted `tanh`, and returned "0 of 18 beat the LLM" plus a draft ADR saying don't ship. **This is the `hiddenUnits: 256` error repeating.** | Phase 2 runs the model Phase 1 adopted. Pass `--activation`. The rule caught it; judgement did not. |
| **[K2] OOM looks exactly like a clean run** | The full sweep was OOM-killed on the voting config (8 GB box) and **exited 0 with an empty table**. | Don't run two of these at once. The vectorizer cache is now bounded to one `vocabCap` — it had been holding 45 dense matrices. |
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

1. ~~**Phase 1 remainder**~~ — **[K2] DONE 2026-08-28. `tanh` adopted (+4.0 pp, 9 of 9).**
   `ridgeLambda`, voting and RBF are all rejected. `ConfidenceClassifierELM` was moved to Phase 2 as
   a gate — it is a binary `low`/`high` head over an upstream prediction, not a 13-class classifier,
   so sweeping it here would have compared a 2-class problem to a 13-class one. As a gate it loses
   (−2.4 pp at 30% coverage).
2. ~~**Close the S2 gap.**~~ — **[K2] DONE, and K1/S2 is being replaced rather than relaxed.**
   `B+su` reaches **32.9% coverage, 3 of 9 calls, +1.0 pp vs the LLM on its own files.** The lead
   handed over K1; the proposal is **K1′ ≥30% coverage** and **K2′ same-files comparison** — see
   `ADR-2026-08-28-k2-replace-k1-with-a-coverage-criterion.md`. **Awaiting the leads.**
3. **Phase 3 certification** on gold set #2 — **[K2] now the critical path, and better justified
   than before: there is finally something to certify.** Every Phase 2 number is DEV with a
   straddling range. Still blocked on funding.
4. **Integrate** behind a never-worse gate, `source: "elm"`, tests written red-first.
5. **Dark run** before enabling.

## 8. Things that are *not* your job

- **`packages/llm-client/**` is Butter's.** Do not edit it. `cliFlags` is already public on
  `CompletionRequest`, so anything you need at the call site can be done from `sourcevision`.
- **`TN-J22` — the LLM is 13.1 pp below the human path ceiling.** Improving the classify prompt is
  a **cheaper and larger win than this entire tier** and is still unclaimed. If you find yourself
  with spare capacity, say so out loud rather than quietly optimising the ELM.
- **[K2] `TN-J26` — the classify prompt is NOT "path only", and that is now filed rather than
  assumed.** `classify.ts:499-503` appends `[partial signals: service(0.7), …]`, and `evidence` is
  populated whenever *any* signal matches — independent of the threshold that made the file
  unclassified. **The teacher sees hints the ELM does not.** Unquantified on purpose: the pre-LLM
  evidence is overwritten in `classifications.json` and needs a corpus rebuild to recover.
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
| **[K2]** Phase 1 architecture + regularisation sweep | `scripts/elm-architecture-sweep.mjs` → `scripts/data/elm-architecture-sweep.json` |
| **[K2]** Phase 2 operating-point search (reproduces abstention) | `scripts/elm-operating-point.mjs` → `…-operating-point{,-tanh}.json` |
| **[K2]** K1 replacement | `ADR/ADR-2026-08-28-k2-replace-k1-with-a-coverage-criterion.md` |
| Everything, with provenance | `Claude-Context/Nolan-Agents/ELM-FINDINGS.txt` |

## 10. If you read nothing else

**The ELM does not have to win. It has to know when to answer.** Every gain in this project came
from narrowing what the model is asked to do — not from making it smarter. And every serious error
came from believing a number whose provenance nobody had checked.

**[K2] One line to add, from running it.** Two of the three biggest effects found on this project —
`hiddenUnits: 256 → 1024` and `relu → tanh` — were **defaults nobody chose**, inherited from the
first script written and carried forward untested. Neither was a hard problem; both were invisible
because they had never been named as decisions. **Before tuning anything, list what the code is
choosing on your behalf.**
