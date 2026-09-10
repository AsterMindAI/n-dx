# Agent: AuroraUnit313

- **Team:** Team Thomas
- **Lead:** Thomas
- **Backlog prefix:** `TT-A`
- **Branch:** `elm/thomas/classify-llm-split` — proposed, not yet created (see Open questions)
- **Worktree:** undecided — see Open questions. Command-Structure's "one agent, one worktree" rule
  applies as soon as I'm editing a file Team Jarrett is concurrently active in (I am — see Standing
  context), so this isn't optional to skip, just not yet answered.
- **Inbox:** `Claude-Context/Thomas-Agents/Notes/`

This charter follows `Claude-Context/CHARTER-TEMPLATE.md` — the repo's own convention for a single
agent's memory and session log, same shape as `Jarrett-Agents/Archer.md` or `Knight.md`. It exists
alongside, not instead of, the root `HEAD_ENGINEER.md` charter (Nala) — that document is the
head-engineer role for the whole `n-dx` monorepo and predates this system; this one is scoped to a
single new file inside a single package, per Thomas's 2026-09-09 assignment.

## Scope

**Owns:**
- `packages/sourcevision/src/analyzers/classify_llm.ts` (new, currently 0 bytes, untracked) — the
  LLM-calling half of file archetype classification. This is the direct extraction target of what
  `classify.ts` does today for its LLM path: batching unclassified files, sending the Claude prompt,
  parsing/validating the response, and the retry/degradation policy across attempts. Concretely,
  the functions I'm extracting/rebuilding from are already named and located:
  - `enrichClassificationsWithLLM` — [classify.ts:329](../../packages/sourcevision/src/analyzers/classify.ts#L329)
  - `computeLLMClassifyAttempts` — [classify.ts:422](../../packages/sourcevision/src/analyzers/classify.ts#L422)
  - `buildLLMClassifyPrompt` — [classify.ts:516](../../packages/sourcevision/src/analyzers/classify.ts#L516)
  - `tryParseClassifyResponse` — [classify.ts:555](../../packages/sourcevision/src/analyzers/classify.ts#L555)
  - calling into `callClaude` — [claude-client.ts:145](../../packages/sourcevision/src/analyzers/claude-client.ts#L145)

**Does not own:**
- The algorithmic pass — `analyzeClassifications`, `classifyFile`, `matchSignal`
  ([classify.ts:61-256](../../packages/sourcevision/src/analyzers/classify.ts#L61)) — stays in the
  hub file.
- The ELM engine — `classify_elm.ts` (new, underscore-named, also 0 bytes) and/or the existing
  `classify-elm.ts` (hyphenated, 17KB, Team Jarrett's in-flight production file under `TJ-A2`/`TJ-R2`
  — see Standing context). Not mine to write or resolve the naming collision on.
- The hub/orchestrator itself — whatever decides the algorithmic → ELM → LLM sequencing and merges
  all three sources' output (`mergeClassificationResults` /
  [classify.ts:589](../../packages/sourcevision/src/analyzers/classify.ts#L589), `computeSummary` —
  [classify.ts:296](../../packages/sourcevision/src/analyzers/classify.ts#L296)). I need its call
  contract (what it hands me, what it expects back) before I can finalize `classify_llm.ts`'s
  exported surface, so this is a real interface dependency, not just an FYI.

## Standing context

- **Starting point:** `classify.ts` (19KB) currently contains all three concerns — algorithmic
  classify, LLM enrichment, merge/summary — in one file. That monolith is "the original classify
  file" this assignment's plan refers to. `classify_llm.ts` and `classify_elm.ts` exist as empty,
  untracked files as of 2026-09-09 on branch `Thomas_Branch` (confirmed via `git status`) — no code
  has been written into either yet.
- **A same-named-but-different file already exists and is not mine:** `classify-elm.ts` (hyphenated)
  is Team Jarrett's real, in-flight production ELM work — `TJ-A2` (production hardening, shipped
  disabled behind `elmPrefilter.enabled`, per Jarrett's zero-evidence-population finding) and `TJ-R2`
  (Realm's path/export-text feature-representation fix, in progress, soft-gated on `TJ-A3`). See
  `Jarrett-Agents/BACKLOG.md`. Whether the new underscore `classify_elm.ts` supersedes, coexists
  with, or is meant to consolidate with that file is **unresolved** — flagged in Open questions, not
  assumed either way.
- **Team Thomas already has ELM work in this exact area:** `TT-N1` (Nala) —
  `ADR-2026-08-31-nala-classify-elm-rewrite.md` / `IMPL-2026-08-31-nala-classify-elm-rewrite.md`, a
  text-encoded ELM classifier with Phase 1+2 code done and green, but **never pushed to a branch or
  opened as a PR**. That work currently lives inside `classify.ts` + the hyphenated `classify-elm.ts`
  per that IMPL's files-touched table. This three-file split is not that IMPL as written — it's a
  further restructuring on top of (or possibly instead of) it. Not yet reconciled with Nala's charter
  or session log.
- **Governance state:** `OWNERSHIP.md` scopes are still unassigned repo-wide; `IN-FLIGHT.md` is the
  only collision protection that exists right now. Team Jarrett is actively mid-flight on
  `classify.ts`/`classify-elm.ts` on separate worktrees (`../n-dx-jarrett`,
  `../n-dx-jarrett-taxonomy`). Any real edit I make to `classify.ts` (even just extraction) touches a
  file Jarrett is concurrently editing — that needs an `IN-FLIGHT.md` claim *before* code, not after.
- **Inherited gotcha, not mine to fix but relevant to how I report results:** this project's honesty
  doctrine (`claude-context-instruction` §8) — never write "done" if tests failed, never report an
  accuracy number without seed + baseline. `scripts/elm-hello-world.mjs`'s `train()` doesn't test
  what its name claims (see `IN-FLIGHT.md`, 2026-08-31 entry) — a caution about trusting this
  library's API surface at face value, even though it's not my call site.

## Current state

Charter just created, at Thomas's request, from a verbal description of the three-file split (hub /
`classify_elm.ts` / `classify_llm.ts`) — not yet written up as an ADR. No code exists in
`classify_llm.ts` yet. Nothing has been claimed in `IN-FLIGHT.md`, no roster row added to
`Thomas-Agents/README.md`, no backlog row added to `Thomas-Agents/BACKLOG.md` — deliberately, pending
the open questions below, per `NEW-AGENT.md`'s "verify before you build."

## Next up

- [ ] Get Thomas's answers on the open questions below before writing any code into `classify_llm.ts`
- [ ] Write an ADR for the three-file split — it's a real architecture decision (why split, why now,
      how it relates to `TT-N1` and Jarrett's `classify-elm.ts`), not just an implementation detail
- [ ] Claim `classify.ts` / `classify_llm.ts` in `IN-FLIGHT.md` given Team Jarrett's concurrent work
      in the same directory
- [ ] Once the hub file's call contract is settled, extract `enrichClassificationsWithLLM` and its
      three helpers into `classify_llm.ts`, wire it back into the hub, and get `pnpm typecheck`/
      `pnpm test` green on `@n-dx/sourcevision`
- [ ] Register this agent in `Thomas-Agents/README.md`'s roster and `BACKLOG.md` once identity/scope
      (Open question 4) is confirmed

## Open questions

- [ ] **Relationship to existing work.** Does this three-file split replace `TT-N1` (Nala's
      evidence-vector ELM rewrite), run parallel to it, or supersede/consolidate with Team Jarrett's
      `classify-elm.ts` (`TJ-A2`/`TJ-R2`)? I can't finalize `classify_llm.ts`'s exports without
      knowing what the ELM side actually looks like.
- [ ] **Who builds the other two files?** The hub (new `classify.ts` shape) and `classify_elm.ts` —
      other agents I coordinate with via `Notes/`, or is this one session building all three in
      sequence? Changes whether I need a note in `Jarrett-Agents/Notes/` now or later.
- [ ] **Worktree or shared checkout?** Command-Structure mandates a worktree for any agent working
      alongside another agent in the same file, and Team Jarrett is concurrently active in
      `classify.ts`/`classify-elm.ts` right now. `OWNERSHIP.md`'s untracked-state hazard section is
      still unfilled for Team Thomas.
- [ ] **Is "AuroraUnit313" a new Team Thomas agent** (own roster row, own backlog prefix `TT-A`,
      as this charter currently assumes), **or is this Nala working under a session nickname?** If
      the latter, this content should fold into `HEAD_ENGINEER.md`'s session log instead of living as
      a separate charter — I don't want to fork Nala's continuity by accident.

## Session log

Newest at the top.

---

### 2026-09-09 — Charter created

**Did:** Read the full onboarding chain per `Claude-Context/claude-context-instruction` →
`Command-Structure` → `OWNERSHIP.md` → `IN-FLIGHT.md`, plus `HEAD_ENGINEER.md`'s session log,
`Thomas-Agents/`, `Jarrett-Agents/BACKLOG.md`, and the two most recent Jarrett IMPL/ADR docs
(`IMPL-2026-09-03-knight-tj-a3-execution-and-tj-r2-gate.md`,
`ADR-2026-08-31-realm-path-based-elm-classifier.md`) to understand what's actually in flight in this
directory before writing anything. Confirmed via `git status`/`ls` that `classify_elm.ts` and
`classify_llm.ts` are real, empty, untracked files on `Thomas_Branch`, and that a same-concept but
differently-named `classify-elm.ts` already exists as Jarrett's production file. Wrote this charter
per Thomas's request, scoped to `classify_llm.ts` only.

**Learned:** This directory has more concurrent activity than the assignment description implied —
Team Jarrett has three active threads (`TJ-A2`, `TJ-A3`, `TJ-R2`) touching `classify.ts`/
`classify-elm.ts` right now, on separate branches/worktrees. Team Thomas's own prior ELM work
(`TT-N1`) was never pushed to a branch. Neither fact was mentioned in the assignment; surfacing both
rather than proceeding as if this were greenfield.

**Broke / still broken:** N/A — no code written yet.

**Left undone and why:** No ADR, no `IN-FLIGHT.md` claim, no roster/backlog registration, no code in
`classify_llm.ts` — all deliberately deferred until the Open questions above are answered, per
`NEW-AGENT.md`'s "verify before you build, don't guess."

**Notes sent / received:** None yet.

**Handoff:** Next session should get Thomas's answers to the four open questions above before
touching `classify.ts` or writing into `classify_llm.ts`.

---
