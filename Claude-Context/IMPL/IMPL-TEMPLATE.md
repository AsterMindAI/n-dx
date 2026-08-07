# IMPL — <what is being built>

> **Filename convention:** `IMPL-YYYY-MM-DD-<author>-<slug>.md`
> e.g. `IMPL-2026-08-05-jarrett-classify-elm-swap.md`
>
> Date first so the directory sorts chronologically; author second so two people can never
> produce the same filename. **No numbers.** Reference an IMPL by its full filename.

- **Implements:** `ADR-YYYY-MM-DD-<author>-<slug>.md` (one or more)
- **Owner:** <intern or agent name> (Team <Nolan|Jarrett|Thomas>)
- **Backlog item:** `<TN|TJ|TT>-<X><n>`
- **Branch:** `elm/<name>/<topic>`
- **Worktree:** `../n-dx-<name>`
- **Status:** Not started | In progress | Blocked | Done

## Scope

In scope: ...
Out of scope (explicitly): ...

## Files touched

List every file. Flag any you do not own per `OWNERSHIP.md` — those need a note to the owning
team **before** you start, not after.

| Path | Owning team | New/Edit | Note sent? |
|------|-------------|----------|------------|
|      |             |          |            |

## Steps

1. ...
2. ...

Order matters where it matters — say why.

## Test strategy

- Unit: ...
- Integration: ...
- **If this claims a fix:** the test that fails on the old code, and confirmation you watched it
  go red.
- Must stay green: `pnpm typecheck`, `pnpm test`,
  `tests/e2e/domain-isolation.test.js` (gateway rules),
  `tests/e2e/architecture-policy.test.js` (tier rules)

## Rollback

How to back this out if it regresses. If the answer is "revert the commit", say that — but if it
writes to `.rex/` or `.sourcevision/`, revert is **not** enough. Say what else has to be undone.

## Open questions

Things you need another team, or all three leads together, to answer. Keep this list honest and
current — a
stale open question reads as answered.
