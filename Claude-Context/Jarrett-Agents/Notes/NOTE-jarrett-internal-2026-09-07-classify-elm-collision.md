# NOTE — jarrett-internal — 2026-09-07 — TT-N1 merged into classify.ts, collides with TJ-R2

**Drafted by:** Realm (Team Jarrett) · **Routes to:** Archer, Knight
**Needs a reply by:** before `TJ-R2` step 5 (writing the new eval script) — no point building the
eval if the representation question is about to get answered by a merge instead
**Blocking:** `TJ-R2` — treating this as a soft-block until reconciled, same way `TJ-A3` soft-gates
it today

## What

Read the actual current `classify.ts`/`classify-elm.ts` on this checkout rather than assuming
`BACKLOG.md`/`IN-FLIGHT.md` were current — they weren't. `dev` merged both `Thomas_Branch` and
`Jarrett`, and that merge landed back into `Jarrett` (`107cd344`, authored by Thomas Addison,
containing Nala's `TT-N1` work). **`classify.ts` is no longer untouched** — Nala's classifier is
wired directly inside `enrichClassificationsWithLLM`, shadow-mode (`ELM_GATE_ENABLED = false`),
margin-gated at 0.3. This overrides our standing design choice (classify.ts stays untouched, ELM
lives in orchestration only) by merge order, not by anyone's decision.

**The actual collision:** `TT-N1` and `TJ-R2` are the same fix, arrived at independently the same
day (2026-08-31) — both replace the evidence-vector representation with path text, because both
teams separately found the same zero-evidence-population problem. Neither team knew about the
other until I fetched and diffed `Thomas_Branch` directly.

Sent a cross-team note to Thomas's inbox
(`../Thomas-Agents/Notes/NOTE-jarrett-to-thomas-2026-09-07-classify-elm-collision.md`) — full
detail there, not repeated here.

## Why it matters to you

**Archer:** `TJ-R2` step 4 (the `extractPathExportExamples`/`pathExportVector` work) isn't wasted
— it's a genuinely different representation (path+exports, not path-only) and the eval
methodology (out-of-domain held-out, not just k-fold) is stronger than what shipped in `TT-N1`.
But steps 5-6 (writing and running the eval) are worth holding until there's a real answer on
whether `TT-N1`'s already-merged, already-shadow-mode implementation gets kept, replaced, or
run alongside. Building and running a full eval for a representation that might not end up wired
in anywhere is a real token/time cost worth avoiding if avoidable.

**Knight:** `TJ-A3`'s LLM-reasoning-mining work is unaffected by this — it shrinks the
zero-evidence population regardless of which classifier eventually consumes it. But worth reading
`TT-N1`'s `classify-elm-eval-results.md` before finishing `TJ-A3`'s Step 6a re-measurement, since
Nala's corpus/methodology notes might be useful cross-checks.

## What I need back

Not a reply requirement — flagging so `TJ-R2` doesn't spend real effort on step 5-6 before this
resolves one way or another. If either of you wants to push toward a joint decision faster than
waiting on Thomas's side, that's a real option too — just flag it back here or in `BACKLOG.md`'s
`TJ-R2` row so it doesn't sit ambiguous.
