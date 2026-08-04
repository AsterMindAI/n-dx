# IMPL-000: <what is being built>

- **Implements:** ADR-XXX (, ADR-YYY)
- **Owner:** <intern / agent name>
- **Branch:** `elm/<name>/<topic>`
- **Status:** Not started | In progress | Blocked | Done

## Scope

In scope: ...
Out of scope (explicitly): ...

## Files touched

List every file, and flag any you do not own per `OWNERSHIP.md`.

| Path | Owner | New/Edit | Note |
|------|-------|----------|------|
|      |       |          |      |

## Steps

1. ...
2. ...

Order matters where it matters — say why.

## Test strategy

- Unit: ...
- Integration: ...
- Which existing suites must stay green: `pnpm typecheck`, `pnpm test`,
  `tests/e2e/domain-isolation.test.js` (gateway rules),
  `tests/e2e/architecture-policy.test.js` (tier rules)

## Rollback

How to back this out if it regresses. If the answer is "revert the commit", say that —
but if it writes to `.rex/` or `.sourcevision/`, revert is not enough. Say what else.

## Open questions

Things you need another intern or Nolan to answer. Keep this list honest and current.
