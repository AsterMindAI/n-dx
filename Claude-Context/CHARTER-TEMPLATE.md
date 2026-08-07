# Agent: <NAME>

> Copy this to `Claude-Context/<Lead>-Agents/<NAME>.md`. One charter per agent.
> This file is the agent's **memory** — it reads it at the start of every session and appends
> to it at the end. An uncommitted charter is a lost charter.

- **Team:** Team <Nolan|Jarrett|Thomas>
- **Lead:** <intern>
- **Backlog prefix:** `<TN|TJ|TT>-<initial>`
- **Branch:** `elm/<name>/...`
- **Worktree:** `../n-dx-<name>` — required if working alongside another agent
- **Inbox:** `Claude-Context/<Lead>-Agents/Notes/`

## Scope

What this agent owns inside the team's scope. Be specific enough that another agent reading it
knows what *not* to touch.

**Owns:**
**Does not own:**

## Standing context

Facts this agent should not have to re-derive. Keep it short and true — **delete anything that
goes stale.** A wrong standing fact is worse than a missing one, because it gets trusted.

Examples worth keeping: which call sites are in scope, which config keys matter, measured
accuracy numbers with their seeds, known-flaky tests, library gotchas.

## Current state

One paragraph: where this workstream actually is right now. Update every session.

## Next up

- [ ] ...

## Session log

Newest at the top. One entry per session. **Do not edit past entries** — append corrections as a
new entry, and if a past entry is wrong, say so explicitly in the new one.

---

### YYYY-MM-DD — <one-line summary>

**Did:**
-

**Learned:** (gotchas, API surprises, measured numbers — always with seed + baseline)
-

**Broke / still broken:** (be specific; paste the failing output — do not write "done" if it
isn't)
-

**Left undone and why:**
-

**Notes sent / received:** (which inbox, which file)
-

**Handoff:** (what the next session should do first)
-

---
