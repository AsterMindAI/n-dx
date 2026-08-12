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
- **Team Jarrett:** in flight — `TJ-A1` (Archer, worktree `../n-dx-jarrett`) and `TJ-K1` (Knight,
  worktree `../n-dx-knight`), two independent implementations of the same ADR
  (`ADR-2026-08-11-jarrett-elm-prefilter-classify.md`) built without cross-reading each other's
  code, per the user's request for a genuine comparison. Neither has touched production code
  (`classify.ts`/`analyze-phases.ts`) yet — both gated on their own eval script clearing the ADR's
  precision-at-threshold bar first.
- **Team Thomas:** <…>

**Fork sync:** last `upstream/main` → `origin/main` fast-forward: _<date, by whom>_
(one person, once a day — see [`GITHUB-WORKFLOW.md`](GITHUB-WORKFLOW.md) § 3)

---

## 3. Decisions & findings since last update

Things every team needs to know — ADRs accepted, interfaces changed, measured ELM results,
direction changes. Link the ADR; don't restate it here.

- 2026-08-12 — **`@astermind/astermind-community` was already a root `package.json` dependency
  before `TJ-A1`/`TJ-K1` started** — added in pre-existing commit `43d6db51` ("ELM hello-world").
  The § 1 claim below (`packages/sourcevision/package.json`) names the wrong path; the actual
  dependency lives in root `package.json`, already on `main`/`Jarrett`. No new install was needed
  for either implementation. Ask Archer or Knight if the claim row should be corrected/released.
- 2026-08-12 — **`ELM.train(trainingExamples)` silently ignores its argument** — confirmed by
  running the installed `@astermind/astermind-community@3.0.0` package directly (not just reading
  source): `elm.train(TRAINING_SET)` and `elm.train()` produce byte-identical models (same `W`,
  `beta`, same predictions) because `train()`'s first parameter is `augmentationOptions`
  (`{suffixes?, prefixes?, includeNoise?}`), not a data array — passing an array of examples just
  gets silently treated as an options object with none of its expected keys. `scripts/
  elm-hello-world.mjs`'s "trained on 30 paths... accuracy on held-out paths: 83%" output is real
  but misleading: the 30-example `TRAINING_SET` it logs the length of is never actually used by the
  library call beneath it — the reported accuracy reflects training on augmented variants of the
  three bare category name strings only. Confirms Archer's `IMPL-2026-08-11-...` finding (verified
  there by reading source) with a live reproduction; use `trainFromData()` with manually-encoded
  vectors for real labeled data, as both `TJ-A1` and `TJ-K1` already do. The hello-world script's
  header comment is now inaccurate and worth a follow-up fix — out of scope for both IMPLs, flagging
  here so it doesn't get lost.

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
