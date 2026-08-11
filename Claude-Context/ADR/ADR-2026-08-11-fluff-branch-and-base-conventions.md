# ADR — Branch naming, the `dev` branch, and which branch a new agent starts from

- **Status:** Proposed
- **Date:** 2026-08-11
- **Author:** Fluff (Team Nolan)
- **Supersedes:** none — extends `ADR-2026-08-05-nolan-single-fork-and-unified-agent-structure.md`
- **Backlog item:** `TN-F1`

> **No ELM claim is made in this ADR.** It is entirely about repository conventions. The § Evidence
> section gives the git commands that produced every fact below, so any team can re-run them.

## Context

Four documents tell an agent how to name its branch and where to start from. All four are wrong in
the same direction: they describe a workflow no one has ever used.

### 1. The documented branch convention has never once been used

`GITHUB-WORKFLOW.md` § 2, `OWNERSHIP.md` § Naming conventions, `claude-context-instruction` § 4,
and `Command-Structure` § Rules all specify `elm/<lead>/<short-topic>`.

The branches that actually exist on `origin` are `main`, `dev`, `Nolan-Work`, `Jarrett`,
`Thomas_Branch`, and `feat/astermind-elm-hello-world`. **No `elm/*` branch has ever existed on any
remote.** The first one was created on 2026-08-11 during my own onboarding — because I followed the
written rule — and removed the same day when the lead confirmed Team Nolan works on `Nolan-Work`.

A convention with a zero percent adoption rate across three teams and two weeks is not a convention
that is being ignored. It is a convention that was never adopted.

### 2. `dev` exists, carries the agent system, and is documented nowhere

`origin/dev` is **10 commits ahead of `origin/main`** and holds the entire `Claude-Context/` tree.
Team Nolan's actual flow, per the lead, is `Nolan-Work` → `dev` → AsterMind `main`, so upstream's
movement can be reconciled on `dev` rather than inside a feature branch.

`GITHUB-WORKFLOW.md` describes only `elm/<lead>/<topic>` → `origin/main` and does not mention `dev`
anywhere — not in § 1 The topology, not in § 3 Sync cadence, not in § 4 The PR flow, not in § 7
Quick reference. Jam raised this in `IN-FLIGHT.md` § 7 on 2026-08-10.

### 3. `origin/main` carries no `Claude-Context/`, so `NEW-AGENT.md` produces a broken worktree

```
$ git ls-tree --name-only origin/main | grep -i claude
.claude
CLAUDE.md
```

The agent system exists on `origin/dev`, `origin/Nolan-Work`, and `origin/Jarrett` only.

`GITHUB-WORKFLOW.md` § 2 tells an agent that `main` is what you branch off. An agent that does that
gets a worktree with **no charters, no backlog, no doctrine, and no `NEW-AGENT.md`** — it cannot
even re-read the procedure it is halfway through. I hit this during my own setup and based my
worktree on `origin/Nolan-Work` instead.

**This is lag, not design.** `dev` is 10 ahead of `main`, and `main` is 3 ahead of `dev` (a
`profile/{archer,knight,realm}.md` add and its revert). Nobody decided to keep the agent system off
`main`; `dev` has simply never been merged down. That matters, because it means the cheap fix and
the correct fix are different fixes, and we should do both.

### 4. Per-team branches do not give per-agent isolation — and we are now relying on that

The docs assume one branch per agent. Reality is one branch per *team*. As of 2026-08-11, Team
Nolan has **two agents, Jam and Fluff, on `Nolan-Work` in a single shared working directory**
(`/Users/nolanmoore/n-dx-1`), by the lead's decision for ease of oversight. Team Jarrett has three
agents similarly sharing.

`Command-Structure` says "git is the lock" and "first commit wins." **Between two agents on the
same branch in the same checkout, there is no lock at all** — no separate index, no separate
`.rex/`, no separate `.sourcevision/`, and the root `CLAUDE.md` documents that those directories
lose data silently under concurrent writers. This is a real exposure, not a theoretical one: the
shared checkout's HEAD moved from `9c8dc5b1` to `ef99e4e3` under me mid-session during my own
onboarding.

The doctrine's answer to this is worktrees. The leads have chosen otherwise, for a stated reason.
Doctrine should say what we do and name the mitigation — not keep prescribing something we have
now declined twice.

## Decision

We document what the teams actually do, and we fix the one thing that is genuinely broken rather
than merely undocumented.

1. **The branch convention becomes `<TeamBranch>` → `dev` → `origin/main`.** `<TeamBranch>` is
   `Nolan-Work`, `Jarrett`, or `Thomas_Branch`. The `elm/<lead>/<topic>` form is retired from all
   four documents that carry it.
2. **When two agents on one team need to work independently, they cut `<TeamBranch>/<topic>` off
   their team branch** and PR back into it. This is the documented escape hatch, not a new default.
   It costs nothing when unused and means the next agent who needs isolation has a named way to get
   it instead of inventing one.
3. **`dev` is documented as the integration branch** in `GITHUB-WORKFLOW.md` § 1, § 3, § 4, and
   § 7 — its purpose (reconciling upstream movement outside feature branches), what merges into it,
   and what it merges into.
4. **`dev` is merged down to `origin/main`.** This is a merge to `main`, so it needs a second lead's
   sign-off under collective command; it is proposed here, not done. Until it happens, **`dev` is
   the base branch for new agent setups** and `NEW-AGENT.md` says so explicitly. After it happens,
   `main` is a valid base again and the special case can be deleted.
5. **`NEW-AGENT.md` Step 4 names its base branch explicitly** rather than relying on whatever the
   session's HEAD happens to be.
6. **`Command-Structure` § One agent, one worktree is amended to state the actual policy** —
   shared checkout is permitted at a lead's discretion, with the `IN-FLIGHT.md` claim on every
   state-writing command as the required mitigation, and with the cost stated plainly. The rule as
   written is contradicted by five of the six agents on the project; leaving it unamended teaches
   every new agent that doctrine is decorative.

All six land in a single commit, so the four documents cannot drift apart from each other again.

## Alternatives considered

| Option | Why not |
|--------|---------|
| **Make reality match the docs** — rename the three team branches to `elm/<lead>/<topic>`, drop `dev` | The three team branches carry merged PR history (#3, #4, #5) and are what all three leads have checked out. Renaming shared branches breaks every existing checkout to buy conformance with a rule nobody chose. `dev` also exists for a stated reason — reconciling upstream movement — that the docs never captured and that renaming would discard. |
| **Leave the docs alone; treat the real convention as folklore** | `NEW-AGENT.md` does not merely misdescribe — it actively produces a worktree with no agent system in it. Two agents hit this in two days. Folklore is what we already have, and it is costing an onboarding session each time. |
| **Mandate per-agent branches and worktrees; enforce the existing rule** | The leads have now declined worktrees twice, with a reason (oversight). Doctrine that loses a third time is worse than doctrine that describes practice and names the risk. The `<TeamBranch>/<topic>` escape hatch keeps isolation available for whoever wants it. |
| **Only merge `dev` → `main` and change nothing else** | Fixes the broken base branch but leaves three documents specifying a branch convention with zero adoption, and leaves `dev` undocumented. The next agent still onboards off a false map. |
| **Fix each document as it is next touched** | Guarantees they drift apart. They already disagree with reality in four places and with each other in two; the whole value of one pass is that they end up consistent. |

## Consequences

**Easier**
- A new agent can follow `NEW-AGENT.md` end to end and get a working checkout with the agent system
  in it. That is currently not possible.
- `git branch -r` becomes readable as a map of who is working where, which is what
  `GITHUB-WORKFLOW.md` § 5 depends on.
- The four documents agree with each other and with the repository.

**Harder — and this is the accepted cost, stated plainly**
- **Team-shared branches mean git is not a lock between two agents on the same team.** Jam and I
  are on `Nolan-Work` in one directory right now. The mitigations are the claim boards
  (`BACKLOG.md` for work, `IN-FLIGHT.md` for shared files and state-writing commands), small
  frequent commits, and never `git add -A`. These are habits, not enforcement. **If we lose PRD
  state to a concurrent write, this is the decision that allowed it**, and it should be revisited
  rather than blamed on whoever ran the command.
- Someone must merge `dev` → `main` on a cadence. If that lapses, `main` goes stale again and the
  base-branch problem returns silently.

**What we now maintain**
- A documented `dev` branch with a stated merge cadence, and a `<TeamBranch>/<topic>` form that
  will be unused until someone needs it.

**Other teams affected:** all three. This changes the branch rule and the onboarding procedure for
everyone, and Team Jarrett has three agents sharing a checkout under the same unamended rule.
Notes sent to `Claude-Context/Jarrett-Agents/Notes/` and `Claude-Context/Thomas-Agents/Notes/` on
2026-08-11, at the same time as this ADR.

## Evidence

No ELM-viability claim is made here, so the template's accuracy/seed/baseline requirements do not
apply. The equivalent standard for a repository claim is that another team can re-run the command
and see the same thing. Every factual claim above comes from one of these, run on 2026-08-11 in
`/Users/nolanmoore/n-dx-1` after `git fetch --all --prune`:

```bash
# 1. Which branches actually exist, and no elm/* among them
git branch -r --sort=-committerdate

# 2. origin/main does not contain Claude-Context/
git ls-tree --name-only origin/main | grep -i claude     # -> .claude, CLAUDE.md only
git ls-tree --name-only origin/dev  | grep -i claude     # -> .claude, CLAUDE.md, Claude-Context

# 3. dev is ahead of main by 10, behind by 3 — lag, not exclusion
git rev-list --left-right --count origin/main...origin/dev
git log --oneline origin/main..origin/dev
git log --oneline origin/dev..origin/main

# 4. Two agents on one branch in one working directory
git worktree list
```

**What I did not verify:** I have not confirmed with Teams Jarrett or Thomas that `Jarrett` and
`Thomas_Branch` follow the same `→ dev → main` flow that Nolan does. I inferred it from the branch
list and from PR #5 (`Merge pull request #5 from AsterMindAI/Jarrett`) landing on `dev`. If either
team is doing something different, item 1 of the Decision needs their input before it is written
into the shared docs — which is what the notes ask for.
