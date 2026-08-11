# NOTE — Fluff (Team Nolan) → Team Jarrett, 2026-08-11

**Subject:** Proposed ADR changes the branch convention and the onboarding procedure for all three
teams. Two things I need from you, one of which affects your three agents directly.

**ADR:** [`ADR-2026-08-11-fluff-branch-and-base-conventions.md`](../../ADR/ADR-2026-08-11-fluff-branch-and-base-conventions.md)
— status **Proposed**. Backlog item `TN-F1`.

## The short version

Four documents (`GITHUB-WORKFLOW.md`, `OWNERSHIP.md`, `claude-context-instruction`,
`Command-Structure`) say agents branch as `elm/<lead>/<topic>` off `main`. Neither half is true in
practice:

- **No `elm/*` branch has ever existed on any remote.** The real branches are `Nolan-Work`,
  `Jarrett`, `Thomas_Branch` → `dev` → `main`. The `dev` branch is documented nowhere.
- **`origin/main` contains no `Claude-Context/` directory.** Verified:
  `git ls-tree --name-only origin/main | grep -i claude` returns only `.claude` and `CLAUDE.md`.
  An agent that onboards per doctrine — branch off `main` — gets a checkout with no charters, no
  backlog, and no doctrine in it. It cannot re-read the procedure it is halfway through. I hit this
  during my own setup on 2026-08-11.

This is lag rather than design: `dev` is 10 commits ahead of `main` and carries the whole agent
system; it has simply never been merged down.

## What I need from you

**1. Confirm Team Jarrett's actual branch flow.** I inferred that `Jarrett` → `dev` → `main` from
the branch list and from PR #5 landing on `dev`. **I have not verified it with you**, and the ADR
says so explicitly. If your team does something different, the proposed convention needs your input
before it goes into the shared docs.

**2. A heads-up that concerns your agents more than mine.** Your roster shows Archer, Knight, and
Realm all on shared checkouts. `Command-Structure` § *One agent, one worktree* calls that
not-optional, so as written, doctrine is contradicted by five of the six agents on this project.
The ADR proposes amending that rule to permit shared checkouts at a lead's discretion **with the
`IN-FLIGHT.md` claim on every state-writing command as the required mitigation** — rather than
leaving a rule in place that everyone quietly ignores.

The exposure is real and it is silent: `.rex/prd_tree/`, `.sourcevision/`, and `.hench/` have no
file locking, and concurrent writers lose data with no error (root `CLAUDE.md`). If your three
agents ever run `ndx plan|work|ci|refresh|self-heal` or a rex MCP write from the same checkout,
that is the mechanism. **If you'd rather your team kept the strict worktree rule, say so** — the
amendment should not be written on Team Nolan's preference alone.

## What I am not doing

I am not editing any doctrine file until the leads decide. A rule that binds all three teams is a
collective-command decision; I found the mismatch and drafted the fix, and the call is yours,
Nolan's, and Thomas's. `IN-FLIGHT.md` § 1 carries my claim so nobody duplicates the reconciliation,
and § 7 carries the open question.

— Fluff, Team Nolan (charter: `Claude-Context/Nolan-Agents/Fluff.md`)
