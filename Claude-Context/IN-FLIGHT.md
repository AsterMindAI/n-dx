# In flight — cross-team claim board & rolling sync

This is the **cross-team** board. Work *inside* a team is tracked in that team's
`<Name>-Agents/BACKLOG.md`. This file is for the things that can hurt someone else: shared files,
seam crossings, and state-writing commands.

**Git is the lock.** Claim by editing this file and **committing**. First commit wins.

> **While team scopes are unassigned, this board is doing all the work.** There is no ownership
> map to fall back on — if it isn't claimed here, nobody knows you're in that file. Claim
> generously for now; over-claiming costs a table row, under-claiming costs someone's afternoon.

---

## 1. Claims

Claim before you start. Delete your row when you're done. If a row is older than a day, send its
owner a note before assuming it's stale — don't just delete it.

| Since | Who | Team | What | Paths / command | Expected release |
|---|---|---|---|---|---|
| 2026-08-12 | Archer | Jarrett | Adding `@astermind/astermind-community` dependency for TJ-A1 (ELM pre-filter prototype) | `packages/sourcevision/package.json`, root `pnpm-lock.yaml` | On IMPL Step 4 completion (eval script working) or sooner if the gate fails and the dep is reverted |

**Shared files — nobody edits unilaterally:**
`package.json` · `pnpm-lock.yaml` · `CLAUDE.md` · `AGENTS.md` ·
`packages/core/assistant-assets/**` · `tests/e2e/**` · `.n-dx.json` ·
`packages/llm-client/src/{provider-registry,provider-interface,llm-types,llm-config}.ts`

**State-writing commands — claim these unless you're in your own worktree:**
`ndx plan` · `ndx work` · `ndx ci` · `ndx refresh` · `ndx self-heal` · any rex MCP write tool
Read-only (`ndx status`, `ndx usage`) is always safe.

---

## 2. Where each team is

One line per team, updated by that lead. This is the standing answer to "what is everyone doing
right now" so nobody has to ask.

- **Team Nolan:** <in flight · shipped since last update · blockers>
- **Team Jarrett:** three active threads as of 2026-08-24, all under `classify.ts`'s classification
  system, all still pre-production (no `classify.ts`/`analyze-phases.ts` edits landed yet):
  - `TJ-A2` (Archer, Knight supporting) — production-wiring the ELM pre-filter engine. Numeric
    feature representation cleared the gate, independently confirmed by Knight and Realm's
    from-scratch reproduction. In progress on `elm/jarrett/classify-elm-prefilter` /
    `../n-dx-jarrett`.
  - `TJ-A3` (Archer, new today) — extending/tightening `BUILTIN_ARCHETYPES` itself (the archetype
    *catalog*, orthogonal to which engine classifies against it). Corrects a same-day mix-up where
    Knight's urgent note described a different pivot (ELM-derived taxonomy discovery) that turned
    out not to be the confirmed direction — see
    `Notes/NOTE-archer-to-knight-and-realm-2026-08-24-taxonomy-direction-confirmed.md`. New
    worktree/branch (`../n-dx-jarrett-taxonomy`, `elm/jarrett/archetype-taxonomy-redesign`),
    deliberately separate from `TJ-A2`.
  - `TJ-R1` (Realm) — ELM-as-primary-classifier decision, verified by independently reproducing
    both `TJ-A1`'s and `TJ-K1`'s real committed code. Its threshold-default finding is provisional
    pending re-verification once `TJ-A3`'s catalog changes land.
- **Team Thomas:** <…>

**Fork sync:** last `upstream/main` → `origin/main` fast-forward: _<date, by whom>_
(one person, once a day — see [`GITHUB-WORKFLOW.md`](GITHUB-WORKFLOW.md) § 3)

---

## 3. Decisions & findings since last update

Things every team needs to know — ADRs accepted, interfaces changed, measured ELM results,
direction changes. Link the ADR; don't restate it here.

- <date> — <what changed, who to ask>

---

## 4. Cross-team blockers & dependencies

Who is blocked on whom, and the hand-off needed.

| Blocked | Waiting on | What's needed | Note sent? | Since |
|---|---|---|---|---|
| | | | | |

> **"Note sent?" is not optional.** A blocker that was only mentioned in conversation is not a
> hand-off. The owning team reads its `Notes/` inbox; it does not read your mind.

---

## 5. Requests

Changes one team needs in another's territory. The owning team picks these up; the requester does
**not** edit directly.

| Requested | By | Owning team | What's needed | Status |
|---|---|---|---|---|
| | | | | |

---

## 6. Action items

| # | Owner | Action | By |
|---|---|---|---|
| 1 | | | |

---

## 7. Open questions for the three leads

Decisions that need all three of you — scope assignment, anything outward-facing, anything hard to
reverse. Command is collective; these are what "collective" actually means in practice.

- [ ] **Assign team scopes** — until this is done, `OWNERSHIP.md` is empty and this board is the
      only collision protection we have.
- [ ] **Worktree isolation or shared checkout?** — record the answer in `OWNERSHIP.md`.
- <anything else unresolved>
