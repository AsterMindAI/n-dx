# NOTE — jarrett → nolan — 2026-08-08 — reply: agent-structure unification

**Needs a reply by:** no reply needed, unless you disagree with something below
**Blocking:** nothing — `IMPL-2026-08-05-nolan-migrate-team-profiles-to-charters.md` (Jarrett's
portion)

## What

Replying to your 2026-08-05 note. Short answer: agreed, and I've already executed my portion of
the migration. `archer.md`, `knight.md`, and `realm.md` are now
`Claude-Context/Jarrett-Agents/{Archer,Knight,Realm}.md`, with the charter header added and
nothing else changed below it — verified by diff, not just eyeballed.

One correction to the shared picture first, since it changes what "accepting the ADR" actually
means: **`Claude-Context/` isn't on `main`.** I checked before branching — it only exists on the
`Jarrett` branch (it arrived there via PR #4 merging `Nolan-Work` into `Jarrett`, not into `main`).
`main` currently has none of `Claude-Context/` — no ADR, no IMPL, no charters. So the ADR's own
"main is the shared base, everything reaches it via reviewed PR" rule hasn't actually applied to
the ADR itself yet. Worth fixing, but I'm flagging it rather than fixing it unilaterally — that's
exactly the kind of unmerged-parallel-structure situation the ADR was written about.

## Why it matters to you

You held the PR on my agreement specifically because it's my content. Here it is. I also found and
cleaned up something your survey wouldn't have seen: `team/archer.md`, `team/knight.md`, and
`team/realm.md` (top-level, no `Jarrett/` subdirectory) were exact byte-for-byte duplicates of the
three files you mapped — leftover from an earlier reorg that moved content into `team/Jarrett/`
without deleting the originals. I removed those three as part of retiring `team/`. Doesn't change
your mapping table, just closes out cruft it didn't know about.

## What I need back

Answers to your four questions, in order:

1. **Lossless?** Yes. Diffed each file's body against the pre-migration version: identical except
   the intentional changes — `## What I'm for, in this repo specifically` → `## Scope` (with
   **Owns**/**Does not own**), Knight's `## What I've learned about n-dx` → `## Standing context`,
   two sentences appended to `## Standing instruction` (read the team inbox, commit the update),
   one corrected internal link (`archer.md` → `Archer.md`, since the filename changed), and the two
   new empty sections (`## Current state`, `## Next up`). Nothing dropped, nothing rewritten.
2. **ADR: yes**, as proposed — one shared fork, `elm/<lead>/<topic>` branches, `main` via reviewed
   PR. This checkout already has `origin` = `AsterMindAI/n-dx`, so that part already holds here.
   One deviation worth flagging: I did this specific migration as a direct commit on the `Jarrett`
   branch, not a fresh `elm/jarrett/...` branch — it's a docs-only, low-risk, single-person move on
   my own files, and `Jarrett` was already the working branch. New substantive work goes through
   the branch+PR flow as the ADR describes.
3. **`WaterJAH/n-dx`:** keeping it for now. Retiring is one-way-ish (re-adding history back if I
   change my mind is more work than just leaving it); keeping it costs nothing as long as project
   work stays on `AsterMindAI/n-dx`, which it does. Can revisit any time.
4. **Review the PR:** this one turned out to be moot, in a useful way — there's no separate
   "`Claude-Context/` PR" to review because that content already landed (on `Jarrett`, via PR #4,
   before this note). What's still genuinely open: **should `Claude-Context/` get its own PR into
   `main`**, now that we know it isn't there? That's a real question and I'd want your and Thomas's
   read on it before opening one — it's shared history, not mine to merge unilaterally.

**Still open on my end:** `team/Thomas/.gitkeep` and the final removal of `team/` are untouched —
that's Thomas's call per the IMPL, not mine to make for him.
