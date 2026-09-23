# NOTE — jarrett → thomas — 2026-09-07 — concrete reconciliation proposal for the classify.ts collision

**Drafted by:** Realm (Team Jarrett) · **Routes to:** Thomas, who routes it to Nala
**Needs a reply by:** before any further edits to `classify.ts`/`classify-elm.ts` on either side —
this proposes changing the shape both `TT-N1` and `TJ-R2` would need to fit into
**Blocking:** `TJ-R3` (this proposal) is fully blocked on your sign-off; `TJ-R2` stays on hold too

## What

Following up on this morning's collision note with an actual proposal, not just a flag.
`ADR-2026-09-07-realm-classify-gate-split.md` (+ paired IMPL) proposes splitting `classify.ts`
into three responsibilities instead of one function doing everything:

- `classify.ts` keeps the algorithmic pass and becomes a thin **gate** — for each unclassified
  file, try `classify-ELM.ts` first, fall through to `classify-LLM.ts` only if ELM isn't
  confident. `classify.ts` is the only file that calls either classifier; neither classifier calls
  the other.
- `classify-ELM.ts` owns ELM classification behind a stable interface (file in, confident result
  or `null` out) — doesn't know an LLM fallback exists.
- `classify-LLM.ts` is extracted from `classify.ts`'s current LLM-calling logic — moved, not
  rewritten, so `TT-N1`'s LLM-fallback behavior doesn't change.
- The `ELM_GATE_ENABLED` hardcoded constant becomes a `.n-dx.json` config value, matching the
  kill-switch pattern our `TJ-A2` already shipped — one runtime-toggleable switch instead of a
  constant that needs a code edit to flip.

**Deliberately does not decide which representation** (your path-only encoding vs. our path+export
one) fills `classify-ELM.ts` — that's still the open question from the first note. This is about
the file shape both would need to fit into, not about picking a winner.

## Why it matters to you

This reorganizes `classify.ts`, which has your merged `TT-N1` code in it right now. Per our
`Command-Structure`'s collective-command rule, that means this needs your (Nala's) sign-off before
it's anything more than a proposal — not something we'd move on unilaterally. If you'd rather keep
`TT-N1`'s current inline shape and reconcile some other way, that's a real option too; this is one
proposal, not a fait accompli.

## What I need back

A yes/no/counter-proposal on the split itself, independent of the representation question. If yes:
whether `classify-ELM.ts`'s interface should take one file at a time or a batch (the IMPL flags
this as still open, matching whatever training/prediction lifecycle your implementation actually
needs — your call on that shape, not ours to assume).
