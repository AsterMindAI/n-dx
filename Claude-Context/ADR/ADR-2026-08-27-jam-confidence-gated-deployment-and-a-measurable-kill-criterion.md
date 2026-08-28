# ADR — 2026-08-27 — Confidence-gated deployment, and replacing a kill criterion that cannot be measured

**Status:** **Superseded in sequencing by [`ADR-2026-08-28-jam-implement-the-elm-tier.md`](ADR-2026-08-28-jam-implement-the-elm-tier.md).**
Its *contribution stands* — retiring the circular kill criterion and replacing it with K1/K2 — and K2 was
run (failed, 54.4% vs 72.3%). What changed: the model it judged was untuned, so the ADR's implied
"measure once, then decide" ordering is replaced by retune → re-certify on a **fresh** gold set.
**Author:** Jam (Team Nolan) · **Backlog:** `TN-J19`
**Builds on:** [`ADR-2026-08-13-jam-proceed-with-elm-classification.md`](ADR-2026-08-13-jam-proceed-with-elm-classification.md) ·
[`ADR-2026-08-23-butter-savings-measurement-contract.md`](ADR-2026-08-23-butter-savings-measurement-contract.md)
**Amends:** the kill criterion set in the 2026-08-13 ADR. **Does not supersede it.**

> **The uncomfortable part first:** the kill criterion I wrote on 2026-08-13 — *"≥30% of the residue
> at or above LLM accuracy"* — **cannot be evaluated, and never could have been.** The LLM is the
> teacher that produced our labels, so "at or above LLM accuracy" is measuring the LLM against
> itself. I set a bar that reads as rigorous and is circular. This ADR replaces it with one that can
> actually be checked.

## Context

### What Step 3 established (`TN-J18`)

Bar pre-registered at `f3205143` before any model ran. 83 held-out rows, 7 seeds, path-string TF-IDF
fitted on train only:

```
mean agreement-with-teacher  59.9%   range 51.8 – 67.5%
recomputed majority baseline 37.3%   (+22.5 pp)
0 of 7 runs below the 45% not-viable threshold
```

**The mapping is learnable.** Infeasibility is excluded, not merely unproven.

### What the confidence gate buys (post-hoc, not pre-registered)

Confidence ranks correctly. Projected onto the real n-dx residue (255 files, 9 classify batches):

| Coverage | Precision (agreement) | n-dx calls avoided, of 9 |
|---|---|---|
| 10% | **84.5%** | 1 |
| 20% | 75.9% | 2 |
| **30%** | **75.3%** | **3** |
| 50% | 71.5% | 4 |
| 100% | 59.9% | 9 |

Two properties worth naming:
- **The gate works.** Top-decile precision is 84.5% against 59.9% ungated — the model knows when it
  knows.
- **It must be percentile-based.** Softmax over 13 classes caps top probability near 0.25 (observed
  0.087–0.245). An absolute gate like `>= 0.5` selects nothing, which the first version of my own
  table demonstrated by printing `(none)` for every row.

### Why the old kill criterion fails

At 30% coverage the ELM **agrees with the LLM 75.3% of the time**. That is not "at or above LLM
accuracy" — it is *disagreement with the LLM on one file in four*. The original criterion assumed we
could compare the ELM's correctness to the LLM's. We cannot: every label we own came from the LLM.
This is `TN-J10` in its sharpest form, and Step 3 made it worse, not better — **the ELM inherits the
teacher's fuzziness rather than resolving it** (best run: 16 of 59 `service`/`utility` rows cross
over; those two classes carry 74% of the corpus and score the worst F1 of any well-supported class).

## Decision

**1. Deploy behind a percentile confidence gate, not a class-accuracy threshold.** The ELM answers
only the top-N% most confident of the residue; everything else falls through to the LLM unchanged.
This bounds the blast radius by construction: a wrong ELM label can only occur where the model was
confident, and coverage is a dial we control.

**2. Replace the unmeasurable kill criterion with two that can be checked:**

| | Criterion | Measurable how |
|---|---|---|
| **K1 — value** | The gate must avoid **≥ 3 of 9** classify calls on n-dx at its operating point. | `scripts/elm-calls-avoided.mjs`, already built. Pure arithmetic on coverage. |
| **K2 — quality** | On a **bounded hand-labelled gold set**, gated predictions must be **right at least as often as the LLM is** on the same files. | Requires the gold set — but a *small, scoped* one. See below. |

**3. Scope the gold set to `service` vs `utility` only, not all 13 classes.** That boundary is
**74% of the corpus** and is exactly where both the teacher and the ELM are weakest. A two-class
gold set over ~60 held-out files is a bounded human task, not an open-ended labelling project, and
it converts `agreement` into `accuracy` precisely where the ambiguity lives. The other 11 classes
stay on agreement-only, with that stated.

**This is my proposed answer to `TN-J10`** — not "do we need a gold set" as a yes/no, but "the
smallest gold set that resolves the actual ambiguity."

## Alternatives considered

**A. Accept agreement as the metric and ship.** Rejected. We would be shipping a model that
disagrees with the LLM on 25% of its confident predictions and calling it a saving, with no way to
know whether those disagreements are improvements or regressions. Given the ELM demonstrably
inherits the teacher's weakest boundary, the null hypothesis "it is wrong where the teacher is
wrong" is entirely live.

**B. Hand-label all 13 classes.** Rejected as disproportionate. Nine classes have under 10 training
rows; a gold set for `schema` (n=1) answers nothing. The ambiguity is concentrated, so the labelling
should be too.

**C. Raise coverage to get more calls avoided.** Rejected as the *default*. Coverage and precision
trade directly (100% coverage = 59.9% precision), and calls avoided are lumpy — going from 30% to
40% coverage buys **zero** extra calls (both land on 6 batches). Coverage should be chosen at a
lumpiness boundary, not maximised.

**D. Abandon Path B given the 75.3% figure.** Genuinely on the table, and it is the leads' call.
The argument for continuing: inference is local and free, the gate bounds downside, and K1 is
already met at 30% coverage. The argument against: 25% disagreement on confident predictions may be
unacceptable for a field users see. **I am not neutral here and should say so — I have spent two
weeks on this path, so weigh my recommendation accordingly.**

## Consequences

- **`TN-J10` is no longer a blocker; it is a scoped task.** K2 defines exactly what labelling is
  needed and why. If the leads decline the gold set, K2 is unmeetable and the honest position is to
  publish Path B as *"feasible, value quantified, quality unverified"* — not to ship it.
- **The 2026-08-13 kill criterion is retired**, with the reason recorded rather than quietly
  dropped.
- **Coverage becomes a published parameter.** Any savings claim must state it, alongside the backend
  (CLI vs API) per Butter's finding that the same ELM saves ~20x more on the CLI.
- Path B's calls-avoided figures are unaffected — they count calls, not tokens. That unit has now
  survived four revisions of the surrounding numbers.

## Open questions for the leads

1. **Is a two-class gold set (~60 files, `service` vs `utility`) worth someone's afternoon?** That
   is the entire remaining blocker on a defensible quality claim.
2. **What disagreement rate is acceptable** for an archetype label users see? 24.7% at the proposed
   operating point. If the answer is "much lower", the operating point moves to 10% coverage
   (84.5% precision, 1 call avoided) and Path B's value shrinks to near nothing.
3. **Do we ship at all without K2?** My recommendation is no — publish the negative-adjacent result
   instead. It is a real contribution either way.
