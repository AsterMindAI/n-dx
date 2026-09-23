# NOTE — jarrett → thomas — 2026-09-07 — classify-elm.ts collision: TT-N1 merged, TJ-R2 still building a second implementation

**Drafted by:** Realm (Team Jarrett) · **Routes to:** Thomas, who routes it to Nala
**Needs a reply by:** before either side does more work on this specific file — real, not
theoretical, since `TT-N1` is already merged and live
**Blocking:** `TJ-R2` (Team Jarrett's parallel effort) — soft-blocked pending this reconciliation

## What

`TT-N1` (Nala's text-encoded ELM classifier, wired directly into
`enrichClassificationsWithLLM` in `classify.ts`) merged into `dev` and from there into the
`Jarrett` branch — confirmed by reading the actual merge commit (`107cd344`) and the current
`classify.ts`/`classify-elm.ts` on this checkout, not assumed from a stale doc. It's real,
running code: `ELM_GATE_ENABLED = false` (shadow mode), a margin-threshold gate
(`predictWithClassifyPathELM`, 0.3 top1/top2 margin), trained on path text via
`UniversalEncoder` + `ELM.trainFromData`.

**The collision:** Team Jarrett has an independent, still-in-progress effort (`TJ-R2`, Archer
executing) building a *different* fix for the same underlying problem — a path+export-text ELM
representation, wired from `analyze-phases.ts` rather than inside `classify.ts` itself. Both
efforts converged on "the evidence-vector representation is broken for the real unclassified
population, encode path text instead" independently, on the same day (2026-08-31), without either
team knowing about the other's work — see
`Notes/NOTE-archer-to-knight-and-realm-2026-08-24-taxonomy-direction-confirmed.md` and
`ADR-2026-08-31-realm-path-based-elm-classifier.md` on our side for how we got there.

`TT-N1` reaching `classify.ts` directly, now merged, has already overridden a standing design
choice on our side (`classify.ts` stays untouched, ELM lives in orchestration only) — not because
anyone decided that, but because of merge order. That's exactly the kind of collision
`IN-FLIGHT.md` exists to prevent, and it happened because neither team's `IN-FLIGHT.md` update was
visible to the other until someone (me, this session) fetched and diffed the other branch
directly.

## Why it matters to you

Two real classifiers for the same call site, built independently, is duplicate work regardless of
which one is better — and right now nobody has compared them on the same terms. Concretely:

- **Validation:** `TT-N1`'s 90.6% is k-fold cross-validation against this repo's own labeled
  data only. Our line of work found that this specific kind of validation missed a real bug once
  already (the tokenizer word-boundary bug, only caught by testing against a genuinely different
  codebase) — worth checking `TT-N1`'s number against an out-of-domain held-out set
  (`AsterMind-Community-Edition` is what we've been using) before trusting it as generalizing
  beyond n-dx's own conventions.
- **Integration point:** `TT-N1` edits `classify.ts` directly; `TJ-R2` doesn't. Whichever approach
  is kept, that's an architecture decision both teams should make together, not one that gets
  decided by whichever branch happened to merge first.
- **Nala's `ELM.train()` finding is real and useful to us too** — confirms a related but distinct
  library gotcha from what Knight found (`useTokenizer: true` degrading to char-level one-hot in
  `TextEncoder`), on the training-method side instead. Worth citing both in whatever final ADR
  reconciles this, since two separate wrong-API findings on the same dependency is worth having in
  one place.

## What I need back

Not asking you to stop — `TT-N1` is already merged and real. What would help: a read from Nala on
whether `TT-N1`'s cross-validation number holds up against an out-of-domain codebase, and a joint
call (all three leads, since `Command-Structure` treats architecture decisions as needing that)
on which integration point — inside `classify.ts` or orchestration-only from `analyze-phases.ts`
— is the one going forward, so both teams aren't maintaining two live classifiers for the same
files.
