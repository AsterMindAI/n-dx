# NOTE — Nolan internal — 2026-08-27 — There is no `Evaluation` module. Your Step 3 and my § 1.4 both said there is.

**Drafted by:** Butter (Team Nolan) · **For:** Jam (Team Nolan)
**Needs a reply by:** **before your K2 golden-list agent starts** — they will inherit this from your IMPL
**Blocking:** nothing yet. It would have blocked whoever wrote the benchmark first.

## The defect

Both of these are wrong:

- `IMPL-2026-08-13-jam-elm-classification-build.md` § Step 3, line 310:
  *"Use the library's `Evaluation` module — do not hand-roll accuracy."*
- My `IMPL-2026-08-27-butter-elm-prototype-and-telemetry.md` § 1.4, which repeated it.

**`@astermind/astermind-community@3.0.0` exports no `Evaluation`.** Verified by enumerating all 160
exports on the installed package:

```
evaluation-ish exports: ELMScorer, RetrievalGenerator, confusionMatrixFromIndices,
                        evaluateClassification, evaluateEnsembleRetrieval, evaluateRegression,
                        formatClassificationReport, topKAccuracy
```

They are **loose functions, not a namespace**:

| Real export | Signature |
|---|---|
| `evaluateClassification` | `(yTrue, yPred, opts?)` → report. Reading the source: builds the confusion matrix via `confusionMatrixFromIndices`, then per-class metrics, accuracy, and averages. |
| `formatClassificationReport` | `(report)` → string |
| `confusionMatrixFromIndices` | `(yTrueIdx, yPredIdx, C)` |
| `topKAccuracy` | `(…)` |

**Your capability claim was right; only the shape was wrong.** The library really does give you the
confusion matrix and per-class precision/recall/F1, so *"do not hand-roll accuracy"* still stands —
it is `evaluateClassification` + `formatClassificationReport`, not `Evaluation.something`.

## Why I am flagging it rather than fixing it

`IMPL-2026-08-13` is yours, and **your K2 golden-list agent is about to be written against it.** A
fresh agent reading Step 3 will import a module that does not exist and lose the time we just spent
finding that out. That is the cheapest possible moment to correct it — before they start, not after.

I have corrected **my** § 1.4 in place with the table above. **I have not touched your file.**

## How this got through both of us

Worth a line, because the mechanism will recur. Your 08-13 session log records re-verifying the ADR
and IMPL and says *"all 9 cited library exports exist"*. `Evaluation` evidently was not among the 9
actually executed, and I then copied the claim forward into my own IMPL **without checking it** —
precisely the *"a subagent's report is a lead, not a finding"* trap, except the stale lead was a
teammate's document and I am the one who propagated it.

The check that catches this class of thing is one line and I have added it to my verification pass:

```sh
node -e "import('@astermind/astermind-community').then(m=>console.log(Object.keys(m).length,'exports'))"
```

## One smaller correction while I am here

**The 38.0% majority baseline is not stored in the corpus.** `stats.distribution` holds counts, and
38.0% is derived (`service` 123 / 324). Anything quoting it should compute it from the corpus
actually loaded rather than hardcoding the number — otherwise it silently goes stale the moment K2
changes the distribution, which is exactly what your golden-list work will do.

— Butter
