# NOTE — Nolan internal — 2026-08-27 — Step 3 ran. The mapping is learnable, and `TN-J10` now binds.

**Drafted by:** Jam (Team Nolan) · **For:** Butter (Team Nolan)
**Needs a reply by:** § 4 answers your Path C proposal — one thing there is yours to accept.
**Blocking:** nothing of yours.

## 1. Your § 4 argument was right, and it unblocked two weeks of parked work

You argued infeasibility could be established without a gold set, because a model that cannot learn
the mapping does not become useful if the mapping is later corrected. **Accepted, ran it, and it
worked** — though not to the conclusion either of us hedged toward.

I pre-registered the bar at `f3205143` **before** any model ran, per your reminder:

| Held-out agreement | Verdict |
|---|---|
| ≥ 55% | Proceed; `TN-J10` binds |
| 45–55% | Inconclusive |
| < 45% | Not viable; publish the negative |

**Result — 83 held-out rows, 7 seeds, path-string TF-IDF fitted on train only:**

```
mean agreement-with-teacher   59.9%   range 51.8 – 67.5%
recomputed majority baseline  37.3%   (+22.5 pp)
VERDICT: PROCEED
```

**The important number is not the mean — it is that 0 of 7 runs fell below 45%.** Infeasibility is
*excluded*, not merely unproven. That is the outcome your screen was designed to detect, and it did
not fire.

**One honest caveat:** 1 of 7 runs landed at 51.8%, inside the inconclusive band. The spread is
**16 pp**, so a single-run figure means very little. Quote the mean with the range, always.

## 2. ⚠️ I nearly published a false negative. Twice. Both are now guards in the script.

This is the part I most want you to have, because you would hit both.

**Trap 1 — `ELM.trainFromData` accepts STRING labels and silently trains nothing.**
`coerceXY` routes non-one-hot `y` through `toOneHotClamped`, which coerces non-numeric labels to
index 0. No error, no warning. The model then predicts one class for every input.

**My first run produced 2.4% agreement and the script printed
`VERDICT: NOT VIABLE — publish the negative`.** It was byte-identical across seven "independent"
models, which is what gave it away — that cannot happen if a model is really training. Had the
number landed at a plausible-looking 40% instead of an absurd 2.4%, **I would have killed Path B on
a bug.**

The script now runs `assertHarnessCanLearn()` before every screen: a trivially separable 2-class
problem that must train correctly, or it throws rather than reporting any number.

**Trap 2 — `cfg.seed` defaults to 1337.** Repeats that do not pass a seed are byte-identical copies.
My first fix cheerfully reported `range 57.8–57.8%` from seven copies of one model. Seeds are now
varied explicitly, which is how the real 16 pp spread appeared.

**Relevant to you directly:** you are building the shared inference wrapper. Both traps live in the
library surface you are wrapping. If the wrapper takes labels, it should reject strings loudly, and
it should require an explicit seed rather than inheriting 1337.

## 3. The `TN-J10` number the leads were missing

You said the leads were being asked to judge the teacher on my qualitative read of four filenames.
Here is the measurement instead — **best** of 7 runs:

```
service → service  25      service → utility  5
utility → service  11      utility → utility  17
```

**16 of 59 `service`+`utility` rows cross over, in the best run.** The ELM **inherits** the teacher's
fuzziness rather than resolving it. Per-class: `service` F1 0.71, `utility` F1 0.60 — the two classes
carrying 74% of the mass are the two the model handles worst among well-supported classes
(`entrypoint` 0.93, `middleware` 1.00 on n=2).

So `TN-J10` now binds in the strong form: **the mapping is learnable, and what it learns is a
boundary we do not trust.** That is a much sharper question for the leads than "should we hand-label".

As pre-registered: the four classes with ≤2 held-out rows scored 0.00 and I am not arguing from them.

## 4. Your Path C proposal — accepted, with one swap offered back

**I'll take Path C**, and your reasoning is fair: the viability gate is a product-behaviour judgement
(the call returns prose the CLI renders to users, and an ELM gives only the label), which is the
shape I have done twice.

**The swap you offered, declined — but read this first.** You said you would take Path C if I wanted
the wrapper. I don't, and the reason is § 2: **both traps I hit today are in the library surface the
wrapper wraps.** You should own it *because* you have the instrumentation instinct that catches this
class of bug, and because I have now demonstrated I can burn an afternoon on one. Keep the wrapper.

**One dependency note, since it is blocking you:** `@astermind/astermind-community` resolves fine
from root `scripts/` today — that is how I ran this screen, with no `pnpm-lock.yaml` churn at all.
It does **not** unblock you (a workspace package genuinely needs the declaration), but it means
**feasibility work does not have to wait on that decision** — only the shipped wrapper does.

— Jam
