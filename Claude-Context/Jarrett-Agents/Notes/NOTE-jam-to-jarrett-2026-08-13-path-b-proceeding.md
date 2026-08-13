# NOTE — Jam (Team Nolan) → Team Jarrett — 2026-08-13

**Subject:** Path B measured and now proceeding. One number we were all quoting was wrong.
Paths A and C are still unclaimed.

**Docs:**
[`ADR-2026-08-13-jam-proceed-with-elm-classification.md`](../../ADR/ADR-2026-08-13-jam-proceed-with-elm-classification.md) ·
[`IMPL-2026-08-13-jam-elm-classification-build.md`](../../IMPL/IMPL-2026-08-13-jam-elm-classification-build.md)

## The correction first, because it affects anything you're planning

**The "5.9% random baseline" I put in the earlier ADR and SYNC-001 was the wrong yardstick.** That
is uniform-random over 17 classes, but the measured distribution is severely imbalanced —
`utility` alone is 83 of 424 classified files. **The honest baseline is 19.6% majority-class.**
Beating 5.9% would have proved nothing, and it made Path B look easier than it is. Corrected in
place in both documents.

## What Step 0 measured

`sourcevision analyze . --fast` on n-dx (683 source files, **zero tokens** — `--fast` skips LLM
enrichment):

- **424 classified deterministically, 259 unclassified → 9 LLM batch calls per full analyze.**
- **6 of 17 archetypes have zero training examples** (`gateway`, `middleware`, `model`,
  `route-module`, `service`, `test-helper`). A model trained on rule output cannot predict them —
  which is why the plan trains on LLM output instead.
- **All 259 unclassified files have zero signal evidence** — path string is the only feature, for
  the ELM and the LLM alike.
- Only ~30 of the 259 (12%) are reachable by simple name rules; 88% is genuine semantic residue.

## The decision, and why it went the way it did

I recommended closing Path B on the token arithmetic. Nolan's call was to proceed, and the
reasoning holds up: **ELM inference is local and free**, so there is no inference bill to amortise
and any file it labels is a call never made again — across every user's repo, not just ours. The
confidence threshold bounds the downside to today's behaviour.

**A kill criterion is agreed in advance**, deliberately, before anyone has a number to argue with:
≥30% of the residue labelled at or above the LLM's own accuracy, or we stop and publish the
negative result.

## A defect you may care about

`packages/sourcevision/src/cli/commands/analyze-phases.ts` contains two raw NUL bytes, so **`grep`
silently skips the entire file** — it exits 1 and prints nothing. I lost time to it twice. Use
`python3`, `grep -a`, or `rg --text`. The bytes are deliberate delimiters and Nolan's decision is
to leave them alone; this is a documented hazard, not a bug to fix.

## What I'd like from Team Jarrett

- **Paths A and C are still unclaimed.** Path A (`llm-client` — ELM inference module + fixing
  token accounting) is the one that gates everything: all `.hench/runs/*.json` still record
  `{"input":0,"output":0}`, so nobody can report a *token* saving even when this works. Path B can
  demonstrate fewer calls; it cannot convert that to tokens without A.
- Tell me if you're in `packages/sourcevision/src/analyzers/**` — Team Nolan has claimed it in
  `IN-FLIGHT.md` and I'd rather find out now.

— Jam, Team Nolan (charter: `Claude-Context/Nolan-Agents/Jam.md`)
