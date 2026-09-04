# Ownership map

## Status: scopes not yet assigned

**The three leads have not divided the codebase yet.** The structure below is in place and ready
to fill in.

Until it is filled in, there is no ownership map protecting anyone, so the substitute is
visibility:

- **Coordinate every non-trivial edit through [`IN-FLIGHT.md`](IN-FLIGHT.md)** — it is currently
  the *only* thing standing between three people and the same file.
- **Push your branch the day you create it**, before it's any good. `git branch -r` is how the
  other teams see what you're touching. See [`GITHUB-WORKFLOW.md`](GITHUB-WORKFLOW.md) § 5.
- **When you discover you want a file someone else is in**, whoever pushed first keeps going.

Once scopes are assigned, the rule becomes the normal one: **if you need to edit a path you don't
own, don't.** Drop a note in the owning team's `Notes/` inbox and add a row to `IN-FLIGHT.md`
§ Requests.

## Assignments

Fill in when the three leads decide. Split by **merge surface**, not by difficulty — each team
should be able to work a full day without touching a file another team has open.

| Team | Lead | Paths owned | Workstream |
|---|---|---|---|
| **TN** | Nolan | _(unassigned)_ | _(unassigned)_ |
| **TJ** | Jarrett | _(unassigned)_ | _(unassigned)_ |
| **TT** | Thomas | _(unassigned)_ | _(unassigned)_ |

## Shared — nobody edits unilaterally

These are shared regardless of how scopes get assigned. Claim in `IN-FLIGHT.md`, make the change
small, merge it same day.

- `package.json`, `pnpm-lock.yaml` (root and per-package)
- `CLAUDE.md`, `AGENTS.md`, `packages/core/assistant-assets/**`
- `tests/e2e/**` — architecture policy tests; changing these changes everyone's rules
- `.n-dx.json`
- `packages/llm-client/src/provider-registry.ts`, `provider-interface.ts`, `llm-types.ts`,
  `llm-config.ts` — whoever ends up owning `llm-client`, changes here affect every call site, so
  they get announced either way
- Everything in `Claude-Context/` root (this file, `Command-Structure`, `IN-FLIGHT.md`, templates)

## Untracked-state hazard

`.rex/`, `.sourcevision/`, and `.hench/` are mutable on-disk state with **no file locking**. The
root `CLAUDE.md` documents the consequence: concurrent writers lose data with no error — the last
writer silently wins. Pick one of these as a team and record the choice here:

- **Worktree isolation (recommended):** each agent runs
  `git worktree add ../n-dx-<name> -b elm/<lead>/<topic>`, getting its own `.rex/` and
  `.sourcevision/`. No claiming needed for local runs. Run `pnpm install` in each new worktree.
- **Shared checkout:** every `ndx plan|work|ci|refresh|self-heal` and every rex MCP write must be
  claimed in `IN-FLIGHT.md` first, and released after.

**Team choice:** _<fill in>_

## Naming conventions

No numbered sequences anywhere. Numbers require coordination we don't have, and two people minting
`ADR-004` on separate branches is a merge conflict that git cannot help with.

| Artifact | Convention | Example |
|---|---|---|
| ADR | `ADR-YYYY-MM-DD-<author>-<slug>.md` | `ADR-2026-08-05-nolan-elm-as-registered-vendor.md` |
| IMPL | `IMPL-YYYY-MM-DD-<author>-<slug>.md` | `IMPL-2026-08-05-jarrett-classify-elm-swap.md` |
| Note | `NOTE-<from-lead>-to-<to-lead>-YYYY-MM-DD-<slug>.md` — intern names only, **never** an agent name; name the drafting agent in the body | `NOTE-jarrett-to-nolan-2026-08-05-provider-config-shape.md` |
| Note (within a team) | `NOTE-<lead>-internal-YYYY-MM-DD-<slug>.md` | `NOTE-nolan-internal-2026-08-11-note-rename.md` |
| Sync | `SYNC-<NNN>-YYYY-MM-DD-<slug>.md` (per-team, so `<NNN>` is safe) | `SYNC-001-2026-08-05-kickoff.md` |
| Charter | `<AGENT>.md` in the team folder | `Nolan-Agents/Atlas.md` |
| Branch | `elm/<lead>/<short-topic>` — lead's name, not the agent's | `elm/nolan/provider-registry` |
| Backlog ID | `<TN\|TJ\|TT>-<agent initial><n>` | `TN-A1` |

Date first so directories sort chronologically. Author second so two people can never produce the
same filename. **Reference an ADR or IMPL by its full filename, never by a number** — there are no
numbers to refer to.
