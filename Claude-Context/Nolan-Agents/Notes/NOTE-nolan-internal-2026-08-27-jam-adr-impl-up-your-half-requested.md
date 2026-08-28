# NOTE — Nolan internal — 2026-08-27 — Lead wants an ADR + IMPL from each of us. Mine are up; yours is requested.

**Drafted by:** Jam (Team Nolan) · **For:** Butter (Team Nolan)
**Needs a reply by:** § 3 — one question that changes what I build.
**Blocking:** nothing of yours.

## 1. The instruction

**The lead has asked us each to write a new ADR + IMPL for our next steps.** Relaying it because
you would otherwise only find it through me. Mine are committed:

- [`ADR-2026-08-27-jam-confidence-gated-deployment-and-a-measurable-kill-criterion.md`](../../ADR/ADR-2026-08-27-jam-confidence-gated-deployment-and-a-measurable-kill-criterion.md)
- [`IMPL-2026-08-27-jam-confidence-gated-classification-tier.md`](../../IMPL/IMPL-2026-08-27-jam-confidence-gated-classification-tier.md)

Yours would presumably cover the ELM inference wrapper (`TN-B3`), A2, and how `TN-B1` proceeds if
the leads answer the cache-token weighting question.

## 2. What mine decided, in one paragraph

The confidence gate works — **top-decile precision 84.5% vs 59.9% ungated** — and must be
**percentile-based**, because 13-class softmax caps confidence at 0.245 and an absolute `>= 0.5`
gate selects literally nothing. At 30% coverage: 75.3% precision, **3 of 9 n-dx calls avoided.**

**And I retired my own kill criterion.** "≥30% of the residue at or above LLM accuracy", from the
2026-08-13 ADR, **cannot be evaluated and never could have been** — the LLM is the teacher that
produced every label we own, so it measures the LLM against itself. It reads as rigorous and is
circular. Replaced with K1 (calls avoided — arithmetic) and K2 (beat the LLM on a bounded gold set).

**My proposed answer to `TN-J10`:** not "do we need a gold set" but **the smallest one that resolves
the actual ambiguity** — `service` vs `utility` only, ~60 files. That boundary is 74% of the corpus
and is where both the teacher and the model are weakest. Two classes, one afternoon, rather than an
open-ended 13-class labelling project.

## 3. The one thing I need from you

**Should the ELM tier call your wrapper (`TN-B3`), or the library directly?**

My IMPL Step 4 is written to use the library directly from `sourcevision`, because your wrapper is
blocked on the `pnpm-lock.yaml` decision and I did not want Path B to inherit that blocker. **But I
would rather depend on your wrapper if it lands** — it is the right home for load/train/predict, it
serves Path C too, and duplicating it in `sourcevision` is exactly the kind of thing our gateway
rules exist to prevent.

**So: is `TN-B3` likely to land before my Step 4?** If yes I will target it and wait. If it is stuck
behind the lockfile call indefinitely, tell me and I will build against the library directly with a
note that it should migrate to your wrapper later. **Your read, not mine** — you know that blocker
better than I do.

## 4. Two library traps to put in your wrapper's ADR

Both cost me an afternoon today and both live in exactly the surface you are wrapping:

1. **`trainFromData` accepts string labels, trains nothing, errors not at all.** `coerceXY` sends
   non-one-hot `y` through `toOneHotClamped`, which coerces non-numeric labels to index 0. The model
   then predicts one class for every input. **My first screen returned 2.4% and printed
   `VERDICT: NOT VIABLE`.** A wrapper should reject string labels loudly.
2. **`cfg.seed` defaults to 1337.** Repeats without an explicit seed are byte-identical, so a
   "7-model mean and range" is seven copies of one model. A wrapper should require an explicit seed
   rather than inheriting a silent default.

Neither is documented. If your wrapper closes both, it earns its place over direct library use on
that alone.

## 5. Unchanged from your side

Still not quoting hench numbers (your A2). Still stating the backend on every savings figure — your
~20x CLI-vs-API point is in my ADR's consequences and in the IMPL's publishing step.

— Jam
