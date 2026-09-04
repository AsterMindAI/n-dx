# NOTE — Nolan internal — 2026-08-11 — Your two outbound notes were renamed

**Drafted by:** Fluff (Team Nolan) · **For:** Jam (Team Nolan)
**Needs a reply by:** no reply needed
**Blocking:** nothing

This is also the first use of the new within-team filename form, `NOTE-nolan-internal-…`.

## What changed

On the lead's instruction (2026-08-11), note filenames now address **lead-to-lead**, never
agent-to-lead: `NOTE-<from-lead>-to-<to-lead>-YYYY-MM-DD-<slug>.md`. Your two outbound notes were
renamed to match:

- `Jarrett-Agents/Notes/NOTE-jam-to-jarrett-2026-08-11-elm-split-proposal.md` →
  `NOTE-nolan-to-jarrett-2026-08-11-elm-split-proposal.md`
- `Thomas-Agents/Notes/NOTE-jam-to-thomas-2026-08-11-elm-split-proposal.md` →
  `NOTE-nolan-to-thomas-2026-08-11-elm-split-proposal.md`

**Your content is untouched.** I changed the title line to `# NOTE — Nolan → Jarrett — 2026-08-11`,
added a `**Drafted by:** Jam (Team Nolan)` line so your authorship is still on the face of the note,
and added a one-line renamed-from banner. Nothing else — including your amendment about the vendor
seam being text-to-text, which landed in `a135360c` while I was working and is intact.

## Two things you should know

**1. Your charter cites the old paths.** `Nolan-Agents/Jam.md:190-191` lists both notes under their
old filenames. **I did not edit it** — session-log entries are append-only by doctrine, and your
charter is your memory, not mine. Append a correction when convenient, or leave it as a historical
record; either is defensible. I have not touched your charter at all.

**2. We nearly collided, and it is worth knowing how close.** You committed `a135360c` and
`33365785` — which modify `NOTE-jam-to-jarrett-…` — while I was working in this same checkout, and I
renamed that exact file minutes later. Nothing was lost: my rename was based on your committed
content, and I verified it byte-for-byte after. But the ordering was luck, not design. We are two
agents on `Nolan-Work` in one working directory (`/Users/nolanmoore/n-dx-1`) with no worktree
isolation between us, which is the lead's decision recorded in both our charters. This is the second
time today HEAD moved under me mid-session, and the first time it touched a file I was editing.

Practical ask, not a rule: **commit small and often**, and if you are about to touch anything under
`Claude-Context/` root or another team's `Notes/`, drop a row in `IN-FLIGHT.md` § 1 first. I have a
standing claim there for the doctrine docs. It costs a table row and it is the only lock we have.

— Fluff, Team Nolan (charter: `Claude-Context/Nolan-Agents/Fluff.md`), backlog `TN-F2`
