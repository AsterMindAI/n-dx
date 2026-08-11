# Team Nolan

**Lead:** Nolan · **Backlog prefix:** `TN`

## Mission

_Not yet assigned._ The three leads decide scopes together; fill this in when that happens and
delete this line.

## Scope

**Owns:** _(unassigned)_

**Does not own:** _(unassigned)_

> Until scopes are assigned there is no ownership map to protect anyone — so coordinate every
> non-trivial edit through [`../IN-FLIGHT.md`](../IN-FLIGHT.md), and push your branch early so the
> other teams can see what you're touching.

## Roster

One row per agent. Set a new agent up with [`../NEW-AGENT.md`](../NEW-AGENT.md).

| Agent | Charter | Scope | Worktree |
|---|---|---|---|
| Jam | [`Jam.md`](Jam.md) | Survey of LLM call sites for ELM/KELM replacement; proposes the three-way split. Analysis + ADR only — implements nothing. | _(none — shared checkout `/Users/nolanmoore/n-dx-1`, see below)_ |
| Fluff | [`Fluff.md`](Fluff.md) | The `Claude-Context/` agent system itself — doctrine, onboarding, and workflow docs. Finds where doctrine and reality disagree and drafts the correction; does **not** decide which convention wins, that goes to the leads as an ADR. | `../n-dx-fluff` (`/Users/nolanmoore/n-dx-fluff`), branch `elm/nolan/agent-system-docs` |

> `(TBD)` and `(shared checkout)` are not valid worktree entries for an agent that works alongside
> others. See [`../Command-Structure`](../Command-Structure) → *One agent, one worktree*.
>
> **Open item:** Jam runs in the shared checkout on branch `Nolan-Work` by the lead's decision
> (2026-08-10), so the rule above is knowingly not met. The mitigation is the one
> `Command-Structure` names for shared checkouts: **every `ndx plan|work|ci|refresh|self-heal` and
> every rex MCP write is claimed in [`../IN-FLIGHT.md`](../IN-FLIGHT.md) before running and
> released after**, because `.rex/`, `.sourcevision/`, and `.hench/` lose data silently under
> concurrent writers. Team Nolan's worktree-vs-shared-checkout choice is still unrecorded in
> `OWNERSHIP.md` § Untracked-state hazard.
>
> **Fluff (2026-08-11) does meet the rule** — own worktree at `../n-dx-fluff`, own `.rex/` and
> `.sourcevision/`, so its local state-writing commands need no claim. Team Nolan now has one agent
> on each side of the question, which makes recording the choice in `OWNERSHIP.md` more urgent, not
> less.

## Seams

Where this team's work touches another's — cross these with a note, never silently.
Fill in as scopes and dependencies become clear.

| Seam | Other side | Protocol |
|---|---|---|
| | | |

## Communication

- **Inbox:** [`Notes/`](Notes/) — read at the start of every session.
- **Syncs:** [`syncs/`](syncs/) — use [`../SYNC-TEMPLATE.md`](../SYNC-TEMPLATE.md).
- **To another team:** drop a note in `../Jarrett-Agents/Notes/` or `../Thomas-Agents/Notes/`.

## Claim board

[`BACKLOG.md`](BACKLOG.md) is the source of truth for status and claims. Claim there, commit,
first commit wins.
