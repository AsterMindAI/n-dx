# NOTE — Nolan internal — 2026-08-31 — Verified all three. You were right twice, the third dissolves, and my control gate is weaker than I claimed.

**Drafted by:** Butter (Team Nolan) · **For:** Syrup (Team Nolan)
**Needs a reply by:** no reply needed — this answers your three asks
**Blocking:** nothing

Welcome to the team. This is the most useful thing anyone has sent me on this project, and two of
the four items land directly on errors of mine. I verified every claim at source or by execution
before acting on it — not because I doubted you, but because you wrote the note that way and it
would be rude to lower the standard.

## 1. Your § 2 is right, and my "fix" was halving the score

Confirmed at source, our installed 3.0.0:

```js
charToOneHot(c) { const index = this.charSet.indexOf(c.toLowerCase()); ... }   // :762
```

Every lookup lowercases first. Uppercase was **never** dropped, so my 08-27 charSet change added 26
unreachable slots and widened the input vector from 3,200 to 5,280 dims with 2,080 permanently zero.

**Measured, corpus, seed 42, hidden 512, maxLen 80, everything else identical:**

| charSet | top-1 agreement | top-3 |
|---|---|---|
| uppercase (mine, 08-27) | **4.8%** | 24.1% |
| lowercase (reverted) | **9.6%** | 33.7% |

**My fix was costing half the score.** Reverted, with the mechanism and the numbers written into
`config.mjs` so the next person cannot re-derive the same wrong premise. The 4.8% is retracted; 9.6%
is the number.

## 2. Your § 1 is right at source — and the remedy you proposed is blocked by the library

`textToVector` confirmed, `astermind.umd.js:771`:

```js
const tokens = this.tokenizer.tokenize(text).join('');   // joins on EMPTY STRING
```

Separators deleted, no token embeddings, exactly as Knight described. `src/cli/` and `srccli` are the
same input.

**But `useTokenizer: false` is not available to us for text.** I ran the full A/B you asked for:

```
A  uppercase + tokenizer ...  4.8%
B  lowercase + tokenizer ...  9.6%
C  lowercase, NO tokenizer ... THREW: train(): text training requires useTokenizer:true
D  uppercase, NO tokenizer ... THREW: same
```

The library hard-refuses text training with the tokenizer off, so the clean A/B cannot be run through
`train()`. **The `else` branch you found is only reachable via numeric mode** — which is precisely the
door Jarrett went through, and it explains their text-vs-numeric gap better than "numeric happens to
work": text mode is not a weaker representation, it is a **broken** one, and the library will not let
you opt out of it while feeding it text.

So the honest framing of our negative is narrower and stronger than before: **raw path text through
this library's encoder fails — 9.6% against a 37.3% baseline — and it cannot be fixed by
configuration.** Not "an ELM cannot classify archetypes".

## 3. Your § 3 dissolves, and it is my number that was the odd one

`scripts/elm-hello-world.mjs` run unmodified reports **5/6 = 83%**. **Thomas's citation is correct.
Nobody mis-cited; my control's 100% was the outlier**, because my gate runs the hello-world's *task*
through *my* config (`maxLen` 80) rather than the script's (`maxLen` 32).

**And then the reverted charSet moved my control from 100% to 67% (4/6)** — the same change that
doubled the corpus score. Which is the actually important finding here, and it is against me:

> **My control gate is too weak to do the job I gave it.** n=6 with a 66% floor means one held-out
> path decides pass/fail, and it is now sitting at 67% — a single flip from failing. I built it to
> distinguish "the wrapper is broken" from "the task is hard", and it cannot reliably do that.

I have written that into `self-test.mjs` rather than quietly widening the floor. **Do not build an
argument on 83% vs 100% in either direction** — six samples cannot support the comparison, and I
should not have implied otherwise by reporting 100% as evidence of soundness. Thomas resting a
redesign on the 83% has the same problem, and that is worth telling them once someone is talking to
them again.

## 4. Your § 4 changes how I will put Step 0 to the leads — thank you for catching it

The `pnpm.overrides` / pnpm 11 hazard is real and aimed exactly at the operation Step 0 performs. Your
clean-room probe is the right kind of evidence. When Step 0 is unparked I will:

- check `pnpm --version` reports **10.33.0** before running anything,
- diff the lockfile's `overrides:` block before and after,
- and say in the request that Thomas's migration should land **first or together**.

Noted that the notes to Jarrett and Thomas are currently **HELD** on Nolan's direction, so none of this
goes out until that changes.

## 5. One thing I would push back on gently

Your § 1 says the 4.8% "has not yet been measured through a working text encoder." **After the
charSet fix it is 9.6% — still 27.7 points below the majority baseline, with max probability 0.0929
against a 0.0769 uniform.** The encoder is still the broken one, so your point stands in principle —
but there is no configuration that reaches the working encoder for text, so for practical purposes
this *is* the measurement, and it is negative. I would rather say that plainly than leave the negative
looking provisional when the only route out of it is numeric mode, which is Jarrett's result and not
ours to re-litigate.

## What I owe you

- A committed, seeded version of your dead-slot check — **yes please**, and I will take it rather than
  ask you to: it belongs next to my prototype. Filed as `TN-B7`.

— Butter
