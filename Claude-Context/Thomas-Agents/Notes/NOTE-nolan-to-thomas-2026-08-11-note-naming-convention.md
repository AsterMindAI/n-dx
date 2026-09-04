# NOTE — Nolan → Thomas — 2026-08-11 — Note filenames now address lead-to-lead

**Drafted by:** Fluff (Team Nolan) · **Routes to:** Thomas, who routes it to their agents
**Needs a reply by:** no reply needed — but object if you disagree, it is cheap to revert
**Blocking:** nothing

## What

Note filenames now use **intern names on both sides**, never agent names:

```
NOTE-<from-lead>-to-<to-lead>-YYYY-MM-DD-<slug>.md
```

So `NOTE-nolan-to-thomas-2026-08-11-…`, never `NOTE-fluff-to-thomas-2026-08-11-…`. The drafting
agent goes in the note body on a `**Drafted by:**` line, so attribution is kept, not lost.

Nolan's call, 2026-08-11. The reasoning, now written into `Command-Structure` § Communication: a
note routes *to a lead*, who passes it to their agents — so the sender is that agent's lead too.
Agent names in filenames tell your team nothing about who is asking or with what authority, they go
stale when an agent is retired (and resolved notes are never deleted), and they don't pair up with
replies the way `thomas-to-nolan` answers `nolan-to-thomas`.

**Within-team notes** (agent to agent on the same team) use `NOTE-<lead>-internal-YYYY-MM-DD-<slug>.md`
— `NOTE-thomas-internal-…` for you. That sub-case was **my call, not Nolan's**; `thomas-to-thomas`
read as a typo. Say if you'd rather it were something else.

## Why this one is worth thirty seconds of your time

**Team Thomas still has no agents.** You are the only lead who gets this convention before writing
a single note, rather than after. Everything below is cleanup for Nolan and Jarrett; for you it is
just the rule.

## I crossed your seam — here is exactly what I touched

Doctrine says fix-and-tell, never fix-and-hide (`Command-Structure` § Doctrine), so:

1. **Renamed two notes already sitting in your inbox**, both Team Nolan's own outbound:
   - `NOTE-fluff-to-thomas-2026-08-11-branch-and-base-conventions.md` →
     `NOTE-nolan-to-thomas-2026-08-11-branch-and-base-conventions.md`
   - `NOTE-jam-to-thomas-2026-08-11-elm-split-proposal.md` →
     `NOTE-nolan-to-thomas-2026-08-11-elm-split-proposal.md`

   **Only the filename and the title block changed; the content of both is byte-for-byte what it
   was.** Each carries a one-line renamed-from banner so a stale link is traceable.

2. **Edited `Thomas-Agents/Notes/README.md`** — your file, not mine. Two blocks: the filename line
   and the note-format template. Nothing else. **Revert it if you object.**

## Also changed (shared docs, `Claude-Context/` root)

`Command-Structure` § Communication and § folder layout · `claude-context-instruction` § 4 ·
`OWNERSHIP.md` § Naming conventions · all three `Notes/README.md`.

## Still open from my earlier note

`NOTE-nolan-to-thomas-2026-08-11-branch-and-base-conventions.md` (the renamed one) still needs your
answer on Team Thomas's intended branch flow, and reminds you: **do not base a new agent's checkout
on `main`** — `origin/main` carries no `Claude-Context/`, so onboarding off it produces a checkout
with no doctrine in it. That is unfixed and still waiting on the three of you.

— Fluff, Team Nolan (charter: `Claude-Context/Nolan-Agents/Fluff.md`), backlog `TN-F2`
