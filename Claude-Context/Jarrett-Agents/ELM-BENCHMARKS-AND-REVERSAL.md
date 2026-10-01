# ELM classifier — benchmarks, and a partial reversal (`TJ-E1`)

**Author:** Elon (Team Jarrett) · **Date:** 2026-10-01 · **Branch:** `elm/jarrett/classify-elm-content`
**Supersedes the recommendation in:** [`ELM-CLASSIFIER-FINDINGS.md`](ELM-CLASSIFIER-FINDINGS.md)
**Related ADR:** `ADR-2026-09-17-elon-content-based-elm-classifier.md`

> ## What changed
>
> The earlier findings report recommended **not shipping the ELM gate**. That recommendation was
> based on an evaluation that measured the wrong thing.
>
> Almost every number on this branch came from **cross-repo** evaluation — train on nine
> repositories, predict a tenth, i.e. a pre-trained model shipped to unfamiliar codebases. But
> `getArchetypeELM` **already trains on each project's own history**. Production is per-project,
> and per-project had never been benchmarked properly.
>
> Measured properly: **96.1% precision at 54.2% coverage** on a project with enough history,
> saving **~55% of tokens and ~55% of wall clock** while changing **5 of 255 labels (2%)**.
>
> **Revised recommendation — three parts:**
> 1. **Do not ship a bundled, pre-trained model.** 41% precision, 25.5 MB artifact. Unchanged.
> 2. **Do build the per-project gate.** It is most of the way there already.
> 3. **Gate it on project maturity.** n-dx today is *not* mature enough — it needs ~400+
>    labelled files and has 191.

---

## 1. Head to head — one methodology, six configurations

Eight scripts on this branch measured different things with different label sets, training scopes,
gate shapes and seed counts, which made them hard to compare and easy to quote wrongly. Everything
below ran through a single methodology: 8 seeds, 5-model ensemble, unanimity gate.

| # | Configuration | Classes | Coverage | Precision | LLM calls |
|---|---|---:|---:|---:|---:|
| 0 | **LLM only** (status quo) | 16 | — | *reference* | 9 |
| 1 | ORIGINAL · bundled | 15 | 13.6% ±2 | 41.7% ±10 | 8 |
| 2 | ORIGINAL · per-project | 10 | 48.9% ±3 | **88.9% ±2** | 5 |
| 3 | TOP-5 · bundled | 6 | 7.4% ±2 | 41.1% ±14 | 8 |
| 4 | TOP-5 · per-project — **n-dx today** | 6 | 15.4% ±4 | 65.7% ±10 | 8 |
| 5 | TOP-5 · per-project — **mature project** | 6 | 54.2% ±3 | **96.1% ±2** | 4 |

**Precision is agreement with an LLM teacher measured at 72.3% against human judgement.** A
disagreement is a *changed* label, not a proven wrong one.

## 2. Economics — per full `ndx analyze` on n-dx

All figures measured, none assumed. One classify call: **105.4 s** (mean of 71.2 / 172.6 / 101.7 /
75.9 s, timed on real calls), **22k–46k tokens** (cache-state dependent, Team Nolan), **$0.021–0.061**
at Sonnet 5 rates. Batch size 30, residue 255 files, 9 calls today.

| # | Configuration | Tokens | Saved | Cost | Wall clock | Labels changed |
|---|---|---:|---:|---:|---:|---:|
| 0 | LLM only | 198–414k | — | $0.19–0.55 | 15.8 min | 0 |
| 1 | ORIGINAL · bundled | 176–368k | 22–46k | $0.17–0.49 | 14.1 min | 20 |
| 2 | ORIGINAL · per-project | 110–230k | 88–184k | $0.11–0.30 | 8.8 min | 14 |
| 3 | TOP-5 · bundled | 176–368k | 22–46k | $0.17–0.49 | 14.1 min | 11 |
| 4 | TOP-5 · n-dx today | 176–368k | 22–46k | $0.17–0.49 | 14.1 min | 13 |
| 5 | **TOP-5 · mature** | **88–184k** | **110–230k** | **$0.08–0.24** | **7.1 min** | **5** |

Wall clock includes the ELM's own runtime (~3 s), which is subtracted. Token and cost columns do
not, because the ELM spends none.

### Beyond tokens

| Configuration | ELM runtime | Artifact to ship |
|---|---:|---|
| Bundled (1, 3) | ~4.7 s | **25.5 MB** — a 15-model ensemble, 187× the 136 KB shipped today, and it must be retrained whenever the archetype catalog changes |
| Per-project (2, 4, 5) | ~3.2 s | **none** — trained each run from history that already exists |

## 3. What actually drives the result

**The lever is per-project training, not the label set.**

Collapsing to the top 5 archetypes does **nothing** for the bundled case: 41.7% → 41.1%. Training
on a project's own history moves 41.7% → **88.9%**. The top-5 collapse is a real refinement on top
of that, not the cause.

There is a tidy reason: **per-project training already collapses the label set by itself.** A single
repository uses only ~10 of the 16 archetypes that appear across the corpus, so configuration 2 is
a 10-class problem without anyone choosing that.

**Configurations 4 and 5 are the clean comparison** — identical code, different project maturity:

| Project | Corpus rows | Training rows | Coverage | Precision | Calls saved |
|---|---:|---:|---:|---:|---:|
| nest | 836 | 627 | 54.7% | **96.4%** | 5 of 9 |
| typeorm | 531 | 398 | 52.6% | **96.5%** | 4 of 9 |
| remix | 204 | 153 | 33.7% | 94.3% | 3 of 9 |
| core | 212 | 159 | 21.1% | 86.7% | 2 of 9 |
| **n-dx** | **255** | **191** | **13.8%** | **64.4%** | **1 of 9** |

Precision tracks **training rows**. n-dx is the worst of the five.

## 4. Archetype usage, since it motivated this

Measured over all 2,195 teacher-labelled rows:

- **16 of 17 archetypes are used.** `page` never appears once — the rule pass catches every one,
  exactly as Team Nolan predicted.
- **The top 5 carry 76.2%**: `utility` (25.5%), `types` (18.3%), `service` (15.6%), `config`
  (10.4%), `route-handler` (6.4%).
- **Six classes have under 20 rows between them**: `cli-command` 15, `gateway` 11, `component` 11,
  `store` 4, `route-module` 2, `hook` 1. You cannot learn a class from one example.

Collapsing the label set measurably helps a cross-repo model (16 classes 37.4% → 3 classes 48.9%,
>2sd), but never enough to clear the majority baseline. Per-project training achieves the same
collapse implicitly and far more.

## 5. The ELM is not the weak link

A reasonable challenge: *"almost anywhere an LLM call is made, an ELM call can be made instead,
with enough training data."* That prior is sound — supervised text classification routinely beats
zero-shot. So a weak classifier is evidence something in **our setup** is wrong, not that the task
is hard.

Every measurement before this compared the ELM against *itself*. Nothing asked whether a different
learner on the **same features** does better. Identical vectors, identical split:

| Learner | Accuracy |
|---|---:|
| Majority class | 44.2% |
| Extension lookup (5 lines of code) | 43.1% |
| **Logistic regression** | **40.4%** |
| ELM 128, 5-model | 41.2% |
| ELM 4096, 5-model | 36.9% |
| Nearest centroid | 30.8% |
| k-NN cosine | 30.0% |

**Nothing beats majority class cross-repo**, and logistic regression — the standard linear baseline
— lands *below* the ELM. So "use a better model" is not the fix, and the limit was never the model
class. It was the evaluation scope.

## 6. Corrections to this branch's own published numbers

Recorded because a wrong number that gets quoted later costs more than the error did.

| Claim | Correction |
|---|---|
| "Don't ship" | Scoped too broadly. Correct for a **bundled** model; wrong for the **per-project** path, which is what production runs. |
| 80.4% in-domain agreement | **In-sample** — trained and evaluated on the same rows. |
| 41.2% cross-repo accuracy | A lucky seed, the **top** of a 31.5–41.2% range. Mean is **35.8%**. |
| Data scaling +12.3 pp per 10× | Two-point extrapolation. Measured over 7 points: **8.4**, and flattening to 6.7. |
| Calibration reachable at ~500,000 rows | Measured over 6 points: **+0.004 AUC per 10×**. Flat. Pooled data does not improve calibration at all — but **per-project rows do**: 191 → 627 rows moves precision 64% → 96%. |
| "~40% token reduction" | Matched no measured row. |
| 4096 hidden units hurts | True at 1,935 rows where it overfits; **does not transfer** to a larger data regime without re-running the sweep. |
| Nolan's `B+su` abstain gate is the cheap idea left | Tested. It lowers coverage without raising precision; plain unanimity dominates it. Closed. |

**Seed variance makes several earlier gaps unquotable.** Single model across 10 seeds: mean 32.5%,
**sd 5.16pp**, range 25.8–42.7%. Any single-seed difference below **~10.3pp is noise**.

## 7. Recommendation

1. **Do not ship a bundled, pre-trained model.** 41% precision regardless of label set, and a
   25.5 MB artifact that must be regenerated on every catalog change.
2. **Build the per-project gate.** Most of it exists: `getArchetypeELM` already trains per-project.
   What is missing is (a) the unanimity gate across a 5-model ensemble, (b) deferring any `other`
   prediction, and (c) the maturity threshold below.
3. **Raise the maturity threshold.** `hasEnoughHistoryForFreshTraining` currently requires **20**
   LLM-labelled examples. The data says **~400+**. At 191 rows n-dx gets 65.7% precision and saves
   one call; at 627 rows a project gets 96.1% and saves five.
4. **Keep `elmPrefilter.enabled` false until (2) and (3) land.** The gate as currently wired has no
   maturity check beyond 20 examples, and would run at n-dx's 65.7%.

## 8. Caveats that bound all of this

- **Configuration 2 pools five repos**, so nest and typeorm carry it. It is not directly comparable
  to the single-repo rows 4 and 5. The defensible claims are the bundled rows and the single-repo
  rows.
- **Per-repo splits are random, not temporal.** Production trains on previously-labelled files and
  predicts newly-added ones. A random 75/25 split within a repo approximates that but may be
  slightly optimistic.
- **Precision is agreement with a 72.3%-correct teacher**, and the teacher's errors are
  directional — `utility` is its sink. A student cannot average that out.
- **The teacher ceiling is unchanged.** Labels come from the LLM, so the ELM converges toward
  agreement with it, never past it. Per-project training does not lift that ceiling; it just gets
  much closer to it.
- **Archetypes are not cosmetic.** They drive `callgraph-findings.ts` severity multipliers and the
  AI-readable summary, so a changed label is quietly miscalibrated analysis.

## 9. Reproducing everything

```sh
# Team Nolan's corpus — deliberately not duplicated into this branch
mkdir -p scripts/data
git show origin/Nolan-Work:scripts/data/elm-archetype-corpus-v3-classtargeted.json \
  > scripts/data/elm-archetype-corpus-v3-classtargeted.json
#   also published at github.com/NMoore-Astermind/ELM-database-ndx under data/

# comparison repos at the commits the corpus pins — see each script's header

node --max-old-space-size=6144 packages/sourcevision/scripts/elm-head-to-head.mjs
node --max-old-space-size=6144 packages/sourcevision/scripts/elm-top5-benchmark.mjs
node --max-old-space-size=6144 packages/sourcevision/scripts/elm-vs-baselines.mjs
node --max-old-space-size=6144 packages/sourcevision/scripts/elm-benchmark-suite.mjs
node --max-old-space-size=6144 packages/sourcevision/scripts/elm-benchmark.mjs
node packages/sourcevision/scripts/elm-benchmark-llm.mjs 3     # COSTS MONEY (~18 cents)
```

**Contamination boundary:** `hono` and `trpc` are Team Nolan's blind certification set. They appear
in no corpus, script or measurement here. Do not train or evaluate on them.
