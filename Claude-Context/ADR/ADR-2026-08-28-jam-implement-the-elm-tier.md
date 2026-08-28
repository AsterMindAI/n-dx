# ADR — 2026-08-28 — Implementing the ELM tier: K2 tested an untuned model

**Status:** Accepted (lead's decision, 2026-08-28) — implementation plan proposed
**Author:** Jam (Team Nolan) · **Backlog:** `TN-J23`
**Follows:** [`ADR-2026-08-27-jam-k2-gold-set.md`](ADR-2026-08-27-jam-k2-gold-set.md) ·
[`ADR-2026-08-27-jam-confidence-gated-deployment-and-a-measurable-kill-criterion.md`](ADR-2026-08-27-jam-confidence-gated-deployment-and-a-measurable-kill-criterion.md)

> **The decision to continue is Nolan's**, taken after I recommended publishing the negative and not
> shipping. I am recording it as theirs. **But diagnostics run after that decision materially
> support it, and against my own prior recommendation** — so this ADR is not me implementing under
> protest. The K2 result is weaker evidence than I presented it as, and § 2 is why.

## 1. Where we stood

K2 failed and it was not close:

```
human path-only vs after-reading   85.4%   ← paths ARE informative
LLM  vs truth                      72.3%
ELM  vs truth                      54.4%   ← 17.9 pp worse than the LLM
```

I recommended not shipping. That recommendation was correct **for the model that was measured.**

## 2. What I did not check before recommending closure

The measured model used **`hiddenUnits: 256`** — a value I picked arbitrarily when writing the
feasibility screen and **never tuned**. Diagnostics (`scripts/elm-diagnostics.mjs`, 5-fold CV on the
training split against LLM labels, **gold set untouched**):

| Lever | Result | Read |
|---|---|---|
| **Capacity** | 64 → **46.7%** · 256 → **52.1%** · 512 → **56.4%** · 1024 → **64.1%** | **+12 pp from 256→1024, still climbing.** The single parameter nobody tuned. |
| **Merging `service`/`utility`** | 13 classes **53.8%** → merged **80.6%** | **+26.8 pp.** Almost all remaining error is that one boundary. |
| Feature engineering | bag-of-tokens **53.8%** → structure-aware **33.7%** | **−20.1 pp.** Naive positional/bigram encoding fragments a small signal. Not the lever. |
| More data | 48 → 46.7%, 97 → 50.6%, 145 → 53.0%, 193 → **53.8%** | Flattening; last 48 rows bought **<1 pp**. Not the lever either. |

**So K2 measured a model at roughly half the capacity it wanted, on a taxonomy whose dominant class
boundary accounts for most of its errors.** That does not make K2 wrong — it makes it a verdict on
*that model*, not on the approach. I over-generalised, and the honest correction is that
**"the ELM is just worse" was not established.**

The two things that *are* established and unchanged: paths carry enough signal (85.4% human
ceiling), and the LLM leaves 13.1 pp of that on the table.

## 3. Decision

**Implement the tier, in this order, with certification before integration.**

1. **Retune before re-measuring.** Capacity sweep to plateau, then architecture (`KernelELM` and the
   other variants the library ships), selected by **cross-validation on the training split only**.
2. **Re-certify on a fresh gold set.** See § 4 — this is non-negotiable and is the main cost.
3. **Integrate behind a never-worse gate.** The tier answers only where its *certified* precision is
   at least the LLM's on comparable files; everything else falls through unchanged. A quality
   regression should be structurally impossible, not merely unlikely.
4. **Ship dark first** — compute ELM predictions and log agreement without acting on them, so the
   first production data costs nothing and risks nothing.

**Explicitly deferred, not rejected:** merging `service`/`utility`. It is worth 26.8 pp and is the
single largest lever, but it changes the *product's* taxonomy for every consumer of
`classifications.json`, not just this tier. That is a lead decision (`TN-J24`), and the tier must
work without it.

## 4. The methodology constraint that costs money

**Gold set #1 is spent.** I have read its labels. Any model I now tune and then evaluate against it
is being tuned toward its test set, and the resulting number would be meaningless — the exact error
this project has already corrected twice.

So:

- **Gold set #1 becomes the development set.** Free to iterate against, and its numbers may never be
  published as a result.
- **A second, independent gold set is required for certification** — fresh files, same blind
  two-pass protocol, labelled once, at the end. Roughly one further session.

**If the leads will not fund a second gold set, the tier does not ship.** Not because the model is
bad, but because we would have no honest way to say whether it is. That is the same position as
before, and I would rather state it now than discover it at integration.

## 5. Ship criteria (measurable, fixed in advance)

| | Criterion |
|---|---|
| **S1** | On **gold set #2**, gated ELM precision ≥ LLM-vs-truth on the same files. (K2, retried on an uncontaminated set.) |
| **S2** | ≥ **3 of 9** n-dx classify calls avoided at that operating point. |
| **S3** | Dark-run agreement in production within the range predicted by S1. If live data disagrees with the certification, the certification was wrong. |

**Abandon if:** the capacity sweep plateaus below LLM-vs-truth on the dev set (nothing further to
tune), or S1 fails on gold set #2, or the leads decline the second gold set.

## 6. Consequences

- **The published record needs care.** `TN-J21` currently recommends not shipping, on evidence I now
  consider incomplete. It is amended, not deleted — the sequence matters, and someone reading only
  the conclusion would miss that the first measurement was of an untuned model.
- **`TN-J22` stands and grows in importance:** the LLM is 13.1 pp below the human path ceiling.
  Improving the classify prompt remains a cheaper, larger win than this tier and is still unclaimed.
- Savings figures still state coverage and backend (CLI ≈ 53k–268k vs API ≈ 2.7k–13.7k per avoided
  call — Butter's A4).

## 7. Open questions for the leads

1. **Fund a second gold set?** Without it, § 4 says we cannot certify and should not ship.
2. **May `service`/`utility` be merged in the product taxonomy?** Worth 26.8 pp, affects every
   consumer of `classifications.json`. Deferred as `TN-J24`.
3. **Is a dark run acceptable before a gated run?** It costs nothing and de-risks S3, but it does
   mean shipping code that computes and discards a prediction.
