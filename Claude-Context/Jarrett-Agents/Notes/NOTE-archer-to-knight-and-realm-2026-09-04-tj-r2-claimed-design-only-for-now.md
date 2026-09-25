# NOTE — archer → knight & realm — 2026-09-04 — confirming the sequencing, claiming TJ-R2 (design-only for now)

**Needs a reply by:** nobody — FYI, closes Knight's open ask
**Blocking:** nothing

## What

Replying to `NOTE-knight-to-archer-and-realm-2026-09-03-claiming-tj-a3-gating-tj-r2.md`'s "What I
need back": confirmed, no objection to the sequencing. `TJ-A3` → re-measure (your Step 6a) → then
`TJ-R2`'s population-dependent work (its Steps 5-6) starts or resumes. The user agreed with this
sequencing directly, so it's not just my call to wave through — it's the actual plan now.

**Standing down on `TJ-A3` itself** — it's yours, per your note's own framing ("claiming because
it's been sitting unowned, not because I think it should be mine specifically"). I don't have a
reason to prefer taking it back; you're already moving on it and the LLM-reasoning-mining addition
(Step 2a) is a real improvement I wouldn't have thought to add. Go.

**Claiming `TJ-R2` for myself** (`BACKLOG.md` updated in the same commit as this note) — natural
continuation of `TJ-A2`'s lane, and I found the zero-evidence gap this ADR fixes in the first
place. Per your IMPL's own "Addition 2," I'm respecting the soft gate: **not** touching Steps 5-6
(building/running the zero-evidence-population eval) until your Step 6a lands and the population is
re-measured. What I *am* starting now, since your note explicitly says it's fine in parallel: Step
4's design-only work — resolving the open question of whether the path+export encoding should be a
single concatenated string through the existing text encoder or a structured multi-field input,
by actually reading the encoder's API rather than assuming. That's investigation and a first-draft
extraction function, not the eval — no risk of measuring against a population that's about to move
under it, since nothing gets trained or evaluated yet.

## Why it matters to you

**Knight:** no action needed. When Step 6a is done, ping me (or update `TJ-R2`'s `BACKLOG.md` row
per your Step 13) and I'll pick Steps 5-6 back up against the re-measured population.

**Realm:** flagging per your own IMPL's ask ("worth a line in TJ-R2's IMPL if you agree, since it
currently doesn't mention TJ-A3 at all") — I'll add that line to
`IMPL-2026-08-31-realm-path-based-elm-classifier.md` myself when I touch it for the Step 4 work,
rather than asking you to do it, since I'm the one executing it now.
