# IMPL — Execute TJ-A3 (archetype taxonomy redesign), add LLM-reasoning-mining as a second signal source, gate TJ-R2 on completion

- **Implements:** `ADR-2026-08-24-jarrett-archetype-taxonomy-redesign.md` (Archer's ADR — unchanged,
  not superseded). This document is an execution plan for that ADR plus one addition, not a new
  design.
- **Extends:** `IMPL-2026-08-24-jarrett-archetype-taxonomy-redesign.md` — reuses its Scope/Steps/Test
  strategy/Rollback wholesale (see below for what's unchanged) rather than restating them. Adds
  Step 2a (LLM-reasoning-mining) and an explicit `TJ-R2` gate this document's predecessor didn't
  need to state, since `TJ-R2` didn't exist yet on 2026-08-24.
- **Owner:** Knight (Team Jarrett) — claiming an unowned plan, not proposing a new one. See
  `Notes/NOTE-knight-to-archer-and-realm-2026-09-03-claiming-tj-a3-gating-tj-r2.md` for the
  offer to Archer to reclaim it instead.
- **Backlog item:** `TJ-A3` (existing item, reassigned to Knight)
- **Branch:** `elm/jarrett/archetype-taxonomy-redesign` (as scoped in the original IMPL — new,
  separate from any ELM-engine worktree, since this is pure `archetypes.ts` design)
- **Worktree:** `../n-dx-jarrett-taxonomy` (as scoped in the original IMPL)
- **Status:** Not started — plan only, same discipline as every prior doc in this line of work.

## Why this document exists, specifically

The user's direct recommendation, which I agree with: before sinking more effort into `TJ-R2`
(the ELM's feature representation), measure how much of the zero-evidence population a cheap,
deterministic fix — expanding `archetypes.ts`'s own signal patterns — clears first, since that's
zero runtime cost, fully auditable, and directly shrinks the population any ELM work would have to
solve. Archer's `TJ-A3` ADR/IMPL already *is* that plan, sitting unclaimed since 2026-08-27. This
document claims it, adds one input source the original IMPL didn't have available at the time it
was written, and makes the `TJ-R2` sequencing explicit.

## What's unchanged from `IMPL-2026-08-24-jarrett-archetype-taxonomy-redesign.md`

Its Scope, Files touched, Test strategy, and Rollback sections apply as written — not restated
here. In particular: `analyzer`/`algorithm`/`tool` archetypes plus the `orchestrator` evidence
check, tightening `store`/`hook`/`middleware`/`model`, the before/after unclassified-rate gate
across all 5 corpora, and `analysisHints` for every new/changed archetype are all still the plan.

## What this document adds

### Addition 1: LLM-reasoning-mining as a second signal-discovery input (new Step 2a)

The original IMPL designs signals against directory-clustering of unclassified files (real, but one
evidence source). There's a second one sitting in the same data: **every file the LLM successfully
classified has a `reason` string explaining why** (`classify.ts:461-469`'s `evidence` field, built
from `item.reason` when present). That's the LLM finding real patterns "for free" that the
algorithmic pass's current signals miss — exactly the population `TJ-A3` exists to shrink. Two
concrete examples from files the LLM had already classified: *"standalone runnable demo script"* →
`entrypoint`, *"generic text-encoding helper"* → `utility`. Neither maps cleanly to an existing
signal, and both suggest patterns a regex can catch (`/examples?\//`, `/demos?\//` for entrypoint;
broader generic-utility filename matching) — but two examples, hand-picked, isn't a systematic
survey. This step makes it one.

**Method:** pull every `source: "llm"` `FileClassification` entry with a non-empty `evidence[].detail`
(the LLM's stated reason) across all 5 corpora's `classifications.json`, group by resolved
archetype, and read them as a set looking for recurring phrasing/structure the current signal
patterns don't already catch — the same kind of directory-clustering the original IMPL's Step 3
does, but over LLM justification text instead of file paths. This is real data already sitting in
each corpus's classification output, zero new collection cost — same "free, already-collected"
property Realm's `TJ-R2` plan values in its own path/export choice.

**Where this fits in the original IMPL's step order:** between its Step 2 (checking whether
`import`-kind signals are implemented) and Step 3 (designing `analyzer`/`algorithm`/`tool` signals)
— this step's output feeds Step 3's signal design directly, as a second input alongside the
directory-clustering evidence the ADR already cites. Not a replacement for that evidence, an
addition to it.

**Discipline:** every candidate signal sourced from LLM-reasoning-mining gets verified against the
actual files it would newly match, same as the original IMPL requires for the directory-sourced
ones (its Step 3: "verify each against the actual files in the cluster it's meant to catch"). A
recurring phrase in LLM reasoning is a lead, not evidence on its own — it still has to translate
into a signal that matches the right files and not the wrong ones.

### Addition 2: explicit TJ-R2 gate

`TJ-R2` (`ADR-2026-08-31-realm-path-based-elm-classifier.md`) didn't exist when the original IMPL
was written, so it couldn't state this: **`TJ-R2`'s zero-evidence-population eval should not start
until this IMPL's Step 6 (the re-classification measurement) is done and its Step 7 gate result is
known.** Reasons:

1. `TJ-A3`'s whole point is shrinking/reshaping the zero-evidence population. If `TJ-R2` builds its
   train/held-out split from today's zero-evidence file lists (the 2026-08-27 measurement:
   260/83/17/12/10 across the 5 corpora) and `TJ-A3` then changes which files are in that
   population, `TJ-R2`'s eval was measured against a population that no longer matches production
   reality — the exact "wrong population" failure mode `TJ-R2`'s own ADR exists to correct, just
   recurring one level up.
2. If `TJ-A3` meaningfully shrinks the zero-evidence population, the remaining files may be a
   *harder* residual (whatever's left after the cheap deterministic wins are captured) — a
   different, likely more adversarial, distribution than what `TJ-R2` would otherwise train
   and evaluate against. Worth knowing before, not after, `TJ-R2`'s engineering work happens.
3. This is the same two-variables-at-once trap that's recurred twice already in this line of work
   (the 2026-08-13 pooled-training retry conflating example count and category count; the
   composition-vs-extraction confound between `TJ-A1`'s and `TJ-K1`'s numeric representations) —
   changing the taxonomy and the ELM's input representation in the same uncoordinated window would
   make it impossible to attribute `TJ-R2`'s eventual result to either change cleanly.

**This is a soft gate, not a hard block** — nothing prevents `TJ-R2` from being claimed and its
non-population-dependent design work (Step 4's encoding-shape decision, Step 4's path/export
combination design) starting in parallel. The gate applies specifically to Step 5-6 (building the
eval and running it against the zero-evidence population) — that part should wait for this IMPL's
Step 6 to complete and, if `TJ-A3`'s gate clears, for the population to be re-measured.

## Steps (delta from the original IMPL — full step list is that document's, with this insertion)

- Steps 1 (claim), 2 (check `import`-kind signal support): as original, executed under this
  document's ownership.
- **Step 2a (new): LLM-reasoning-mining**, per Addition 1 above. Output: a candidate signal list,
  cross-referenced against (not replacing) the directory-clustering evidence already in the ADR.
- Steps 3-12: as original IMPL, using the combined (directory + reasoning-mined) evidence at Step 3.
- **Step 6a (new): after the gate gate at Step 7 clears, re-run the zero-evidence-population
  measurement** (same method as the 2026-08-27 measurement this whole line of work has used) across
  all 5 corpora with the new `archetypes.ts`. Publish the before/after zero-evidence file counts and
  — if the population composition shifted in an interesting way (e.g., concentrated in fewer
  archetypes, or shrunk unevenly across corpora) — say so plainly. This is the artifact `TJ-R2`
  needs before its own Step 2 (extracting zero-evidence file lists) can trust its inputs.
- **Step 13 (new): hand off to whoever executes `TJ-R2`** — reply to Realm's
  `Notes/NOTE-realm-to-archer-and-knight-2026-08-31-path-based-classifier-plan.md` and this
  document's own claiming note, pointing at Step 6a's updated population, and update `TJ-R2`'s
  `BACKLOG.md` row to reference it instead of the 2026-08-27 numbers.
- Original IMPL's Steps 10-14 (audit, typecheck, `IN-FLIGHT.md` flag, reply to the stale
  urgent-note/TJ-R1 state, PR): unchanged, executed as written.

## Test strategy

Unchanged from the original IMPL. One addition: a fixture-level check that reasoning-mined signals
don't just match their source cluster but generalize slightly beyond it (spot-check against at
least one file from a *different* corpus than the one the reasoning sample came from) — a signal
derived from one corpus's LLM reasoning that only ever matches that corpus's files is a sign it's
too narrowly fit, not a real pattern.

## Rollback

Unchanged from the original IMPL — revert `archetypes.ts`, no data migration needed.

## Open questions

All of the original IMPL's open questions carry forward unchanged (import-signal support,
`orchestrator`'s inclusion, `model` naming, `algorithm`'s per-project-extension question). One new:

- [ ] **If Step 2a's reasoning-mining surfaces a pattern that contradicts or overlaps a
      directory-sourced signal from the original IMPL's Step 3** — which takes precedence, or do
      both get encoded as separate signals that jointly accumulate weight for the same archetype
      (matching how `classifyFile` already sums multiple matching signals)? Likely the latter, not
      yet confirmed against a real conflicting example.
