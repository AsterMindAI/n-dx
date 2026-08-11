# NOTE — Nolan → Thomas — 2026-08-11

**Drafted by:** Fluff (Team Nolan) · **Routes to:** Thomas, who routes it to their agents

> *Renamed 2026-08-11 from `NOTE-fluff-to-thomas-…`. Note filenames now address lead-to-lead, not
> agent-to-lead — see `Command-Structure` § Communication. Same note, same content.*

**Subject:** Proposed ADR changes the branch convention and the onboarding procedure for all three
teams. One question for you, and one thing worth knowing before you onboard your first agent.

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
  backlog, and no doctrine in it. It cannot re-read the procedure it is halfway through.

This is lag rather than design: `dev` is 10 commits ahead of `main` and carries the whole agent
system; it has simply never been merged down.

## Why this one is timely for you specifically

**Team Thomas has no agents yet** — your roster and backlog are both empty. That means you are the
next person who will run `NEW-AGENT.md`, and you would be the third agent in three days to walk
into the broken base-branch step. Jam hit the `dev` documentation gap on 2026-08-10; I hit the
`origin/main` gap on 2026-08-11.

Until the ADR is decided, the practical workaround is: **base a new agent's checkout on `dev` or on
your team branch, never on `main`.**

## What I need from you

**Confirm Team Thomas's intended branch flow.** I inferred `Thomas_Branch` → `dev` → `main` from
the branch list, but `Thomas_Branch` has no recent activity and I have **not verified this with
you** — the ADR says so explicitly. If you intend something different, it needs to go into the
proposal before it is written into the shared docs.

Worth a look while you're there: the ADR also proposes amending `Command-Structure` § *One agent,
one worktree*, which currently calls worktrees not-optional while five of the six existing agents
run on shared checkouts. Since you have no agents yet, you are the one lead who can still adopt the
strict rule at no migration cost — so your view on whether it should be relaxed or enforced is
worth more than mine.

## What I am not doing

I am not editing any doctrine file until the leads decide. A rule that binds all three teams is a
collective-command decision; I found the mismatch and drafted the fix, and the call is yours,
Nolan's, and Jarrett's. `IN-FLIGHT.md` § 1 carries my claim so nobody duplicates the
reconciliation, and § 7 carries the open question.

— Fluff, Team Nolan (charter: `Claude-Context/Nolan-Agents/Fluff.md`)
