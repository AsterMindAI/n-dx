# NOTE — knight → archer & realm — 2026-09-03 — claiming TJ-A3, and why TJ-R2 should wait on it

**Needs a reply by:** Archer, before starting `TJ-R2` if you or anyone picks it up in the meantime —
this note asks you to hold off, not just FYI
**Blocking:** `TJ-R2` (soft — see "What I need back"), nothing else

## What

Claiming `TJ-A3` (`ADR-2026-08-24-jarrett-archetype-taxonomy-redesign.md` /
`IMPL-2026-08-24-jarrett-archetype-taxonomy-redesign.md`) — it's been unassigned since the
2026-08-27 reassignment and nobody's picked it up. I'm executing the plan as you wrote it, not
replacing it — it's thorough and the falsification test (before/after unclassified rate across all
5 corpora, gated before any hint/test work) is exactly right. One addition, own IMPL below.

**The reasoning, in case it's not obvious from just "I'm claiming this":** the user asked me
directly whether to prioritize this over `TJ-R2` (Realm's path/export-based ELM representation
fix) or let them run in parallel. My read, which the user agreed with: gate `TJ-R2` on this
landing, don't run them in parallel. Reason — `TJ-A3` changes what population `TJ-R2` would even
be evaluated against. Your own ADR's Consequences section says as much: *"every classification
engine benefits simultaneously... the 'no clear fit' population that made out-of-domain
generalization hard specifically included many of these gap-category files."* If `TJ-A3` lands
first and shrinks/reshapes the zero-evidence population, `TJ-R2`'s eval — which Realm's ADR is
careful to scope specifically to that population — needs to run against the *post-TJ-A3* zero-
evidence set, not today's, or it repeats the exact "measured against the wrong population" mistake
Realm's ADR was written to correct in the first place. Building `TJ-R2` in parallel risks doing
real ELM engineering against a population that's about to change out from under it.

## Why it matters to you

**Archer:** you're not asked to do anything here except hold `TJ-R2` (or anyone else claiming it)
until this lands — `TJ-A2`'s `elmPrefilter.enabled` is already `false` and stays that way regardless,
so there's no time pressure this creates that wasn't already there. If you'd rather claim `TJ-A3`
yourself instead of me, say so and I'll stand down — it's your original ADR and your worktree
(`../n-dx-jarrett-taxonomy`) it was scoped for; I'm claiming it because it's been sitting unowned
for a week, not because I think it should be mine specifically.

**Realm:** `TJ-R2`'s own Evidence section already commits to measuring against the zero-evidence
population "specifically, not any unclassified file" — this note is just making explicit that the
population itself is about to move, so whoever executes `TJ-R2` should treat `TJ-A3`'s completion
as a precondition, not a parallel-track nice-to-have. Worth a line in `TJ-R2`'s IMPL if you agree,
since it currently doesn't mention `TJ-A3` at all (it predates my picking this up).

## What I need back

Not urgent, but: confirm you're OK with the sequencing (`TJ-A3` → re-measure → then `TJ-R2` starts
or resumes), or push back if you see it differently — you have more direct visibility into how much
delay this actually costs `TJ-R2` than I do. If nobody objects, I'll update `BACKLOG.md`'s `TJ-R2`
row to note the dependency once `TJ-A3` is claimed and moving.
