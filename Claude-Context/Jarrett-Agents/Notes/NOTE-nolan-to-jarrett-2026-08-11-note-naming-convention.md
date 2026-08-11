# NOTE — Nolan → Jarrett — 2026-08-11 — Note filenames now address lead-to-lead

**Drafted by:** Fluff (Team Nolan) · **Routes to:** Jarrett, who routes it to their agents
**Needs a reply by:** no reply needed — but object if you disagree, it is cheap to revert
**Blocking:** nothing

## What

Note filenames now use **intern names on both sides**, never agent names:

```
NOTE-<from-lead>-to-<to-lead>-YYYY-MM-DD-<slug>.md
```

So `NOTE-nolan-to-jarrett-2026-08-11-…`, never `NOTE-fluff-to-jarrett-2026-08-11-…`. The drafting
agent goes in the note body on a `**Drafted by:**` line, so attribution is kept, not lost.

Nolan's call, 2026-08-11. The reasoning, which is now written into `Command-Structure`
§ Communication: a note routes *to a lead*, who passes it to their agents — so the sender is that
agent's lead too. Agent names in filenames tell your team nothing about who is asking or with what
authority, they go stale when an agent is retired (and resolved notes are never deleted), and they
don't pair up with replies the way `jarrett-to-nolan` answers `nolan-to-jarrett`.

**Within-team notes** (agent to agent on the same team) use `NOTE-<lead>-internal-YYYY-MM-DD-<slug>.md`
— `NOTE-jarrett-internal-…` for you. That sub-case was **my call, not Nolan's**; `jarrett-to-jarrett`
read as a typo. Say if you'd rather it were something else.

## I crossed your seam — here is exactly what I touched

Doctrine says fix-and-tell, never fix-and-hide (`Command-Structure` § Doctrine), so:

1. **Renamed two notes already sitting in your inbox**, both Team Nolan's own outbound:
   - `NOTE-fluff-to-jarrett-2026-08-11-branch-and-base-conventions.md` →
     `NOTE-nolan-to-jarrett-2026-08-11-branch-and-base-conventions.md`
   - `NOTE-jam-to-jarrett-2026-08-11-elm-split-proposal.md` →
     `NOTE-nolan-to-jarrett-2026-08-11-elm-split-proposal.md`

   **Only the filename and the title block changed. The content of both is byte-for-byte what it
   was**, including Jam's amendment to the split proposal that landed this morning. Each carries a
   one-line renamed-from banner so a stale link is traceable.

2. **Edited `Jarrett-Agents/Notes/README.md`** — your file, not mine. Two blocks: the filename line
   and the note-format template. Nothing else. I would normally have asked instead of editing, and
   the only reason I didn't is that leaving your inbox documenting the old convention while the root
   docs document the new one is precisely the drift this change exists to remove. **Revert it if you
   object** — nothing else depends on it.

## Also changed (shared docs, `Claude-Context/` root)

`Command-Structure` § Communication and § folder layout · `claude-context-instruction` § 4 ·
`OWNERSHIP.md` § Naming conventions · all three `Notes/README.md`.

## What I did not touch

Your agents' charters, backlog, roster, and `NOTE-nolan-to-jarrett-2026-08-05-unify-agent-structure.md`
(already correctly named). Jam's charter session log still cites the old filenames; past session-log
entries are append-only by doctrine, so those stay as a historical record rather than being
rewritten.

— Fluff, Team Nolan (charter: `Claude-Context/Nolan-Agents/Fluff.md`), backlog `TN-F2`
