# NOTE — archer → knight — 2026-08-13 — expanded training corpora for TJ-A1/TJ-K1 rerun

**Needs a reply by:** no reply needed, but the user wants you to rerun `TJ-K1` against this same
data — see "Why it matters to you"
**Blocking:** nothing

## What

Gathered three new local codebases specifically to test the "training data isn't diverse enough to
generalize" read both `TJ-A1` and `TJ-K1` landed on independently. Picked for genuine domain
diversity from both n-dx and AsterMind, and specifically to fill two archetype labels neither
existing dataset has *any* examples of:

- **`../elm-training-corpora/express`** (expressjs/express, shallow clone) — route-handler/service
  coverage.
- **`../elm-training-corpora/indie-stack`** (remix-run/indie-stack, shallow clone) — the official
  Remix starter. Only source of `route-module` (loader/action exports) examples we have; n-dx
  doesn't use Remix and AsterMind isn't a web app, so this label had zero training examples before.
- **`../elm-training-corpora/zustand`** (pmndrs/zustand, shallow clone) — literal state-management
  library, `store` coverage (also near-zero before).

Each has `.sourcevision/inventory.json` + `imports.json` + `classifications.json` already
generated. Same method as `TJ-A1`'s original data: `ndx analyze --phase=1/2` (free), then
`--phase=3`'s algorithmic pass, then the leftover unclassified files labeled directly by me
(reasoning over path + archetype catalog, same info a real Claude call would have — no `claude`
CLI or API key needed, same blocker as before) and merged via the real `mergeClassificationResults`
function for schema fidelity. Counts: express 43 classified (12 manual), indie-stack 26 (10
manual), zustand 22 (4 manual).

## Why it matters to you

The user's ask was "gather more training data and share it with Knight, I'm going to have him
rerun his test again" — this is that data. They want an apples-to-apples second opinion: does
pooling these into your own extraction/training pipeline change your `TJ-K1` result the way it
changed (or didn't) mine.

**My own rerun result, so you're not duplicating the finding blind:** pooled all three new corpora
into `TJ-A1`'s training set (this repo + express + indie-stack + zustand = 486 examples, 16
categories, up from 413/14), kept AsterMind as the untouched held-out set for a controlled
comparison. **Result: generalization did not improve — if anything, in-domain also dropped below
the gate this time** (best real point 87.3% precision @ 45.1% coverage, vs. the original run's
95.8% @ 23.1%; out-of-domain best point ~48% @ 32%, similar-to-slightly-worse than before). Two
more categories from the pooled data likely diluted the softmax further (confidence range compressed
again) and increased the classification task's difficulty faster than it added per-category
density. Not what I expected going in — worth you verifying independently rather than taking my
read on why.

## What I need back

Not a reply — just: run your own `TJ-K1` pipeline against these same three corpora (pooled into
training the same way, AsterMind held constant as held-out) and log whatever you get in your own
session log, positive or negative. Two independently-built pipelines agreeing (or disagreeing) on
whether more/diverse data actually helps is more informative than either alone — same reasoning
that made the original convergence on "gate doesn't clear" meaningful.

Full detail, the pooling mechanism (`SV_ELM_EXTRA_TRAINING_CLASSIFICATIONS` env var), and the raw
numbers are in `Archer.md`'s 2026-08-13 session log and the ADR's Evidence section if you want the
exact reproduction steps rather than re-deriving them.
