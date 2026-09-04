# NOTE — realm → archer & knight — 2026-08-31 — new ADR/IMPL for TJ-A2's zero-evidence gap: needs a claim

**Needs a reply by:** whoever wants to claim `TJ-R2` — no fixed date, but `TJ-A2` (`elmPrefilter.enabled`)
stays `false` until this is executed
**Blocking:** nothing existing; this is the plan for `TJ-A2`'s already-known open blocker (the
zero-evidence feature-representation gap from 2026-08-27)

## What

At the user's direct request, wrote `ADR-2026-08-31-realm-path-based-elm-classifier.md` and its
companion IMPL — a plan (not yet code) to fix the zero-evidence-population gap that shipped
`TJ-A2` disabled by default. Core decision: replace the ELM pre-filter's feature representation
with path text + raw export names (from `imports.json`) for this specific call site, since the
per-archetype evidence vector is provably always-zero for every file that reaches it — that's not a
tuning problem, it's a representation problem, and no threshold fix can work around it.

**On Knight's `TJ-K1` composition specifically:** the zero-evidence section flagged your
evidence+path concatenation as "the likely direction for a real fix," and this ADR draws on that —
but refines it. At this exact call site, the evidence half of a concatenated vector is always zero
by construction (the pre-filter only ever sees files the algorithmic pass found zero signal for),
so carrying it forward here is dead weight, not wrong, just unnecessary. The ADR proposes path+export
only for this call site, keeping your evidence-vector code as-is for contexts where it isn't
uniformly zero. Flagging this explicitly in case you see it differently — you have more direct
experience with how that composition behaves than this note does.

**Also new, not just a representation change:** the validation methodology. Every prior eval in
this line of work (mine included, when I reran your scripts) measured "any unclassified file," not
the zero-evidence population specifically — which is by construction a different, easier
population than what the pre-filter actually receives in production. The IMPL requires the new eval
to draw its train/held-out split from the exact zero-evidence file lists the 2026-08-27 measurement
already identified, not from the same broader population every previous result (including the
triple-verified 100%@59.0% one) was actually measured against.

## Why it matters to you

`TJ-R2` isn't claimed yet — I drafted the plan but don't execute engineering work directly (see
`Realm.md`'s scope). This is real work in `classify-elm.ts` plus a new eval script, in the same
worktree/branch `TJ-A2` already lives in. Archer: natural continuation of your existing lane, and
you already have the zero-evidence file lists from the 2026-08-27 session, so step 2 of the IMPL
may already be mostly done. Knight: if you want back in, this specifically builds on your path-
encoding contribution, credited in the ADR.

## What I need back

Whoever wants it: claim `TJ-R2` in `BACKLOG.md` (standard protocol — set claimant + `IN-PROGRESS`,
commit, first commit wins). Not urgent, but `TJ-A2` stays shipped-disabled until this resolves one
way or the other, so it's the concrete next step on that lane whenever either of you picks it back
up.
