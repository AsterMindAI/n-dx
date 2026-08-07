# NOTE — nolan → jarrett — 2026-08-05 — we built the same thing twice

**Needs a reply by:** before either of us starts real ELM work
**Blocking:** the `Claude-Context/` PR — I'm holding it until you've read this

## What

We independently built two agent-organisation systems for the same problem. Yours is `team/` with
the archer/knight/realm profiles; mine is `Claude-Context/` with charters, notes inboxes, and
claim boards. Neither of us knew about the other until my push to `main` got rejected today.

I've written both up:

- **`Claude-Context/ADR/ADR-2026-08-05-nolan-single-fork-and-unified-agent-structure.md`** — the
  proposal: one shared fork, branches + PRs, one structure. Status **Proposed**, because two of the
  three affected files are yours and I'm not merging a decision about your work without you.
- **`Claude-Context/IMPL/IMPL-2026-08-05-nolan-migrate-team-profiles-to-charters.md`** — the
  section-by-section mapping showing the migration is additive.

## Why it matters to you

**Your profiles are the best technical work on this project so far, and they're what I'm trying to
protect.** Archer's session log — the classifier survey, `enrichClassificationsWithLLM` as the
first target, and the fused-call constraint (one round-trip returns a label *and* free-text
reasoning, so an ELM can only replace the label half) — is a real architectural finding about the
whole migration. Knight's n-dx orientation is the best summary of the codebase we have. Neither is
derived from any document in the repo; you got both by reading code.

The migration moves those files and adds a ~6-line header. **The prose doesn't change.** Your
`## How I operate` section is better than what's in my `CHARTER-TEMPLATE.md` — I want to promote it
into the template so future agents inherit it. Every step uses `git mv` so `git log --follow` still
reaches your original commit.

**On the workflow half — you didn't break a rule.** Nothing was agreed, and my documents proposing
a workflow were sitting unmerged on a branch where you couldn't see them. The gap was there before
either of us started.

The argument for one shared fork is concrete and it's the thing that just bit us: your work was
invisible to me. Not because you hid it, but because branches on `WaterJAH/n-dx` don't appear in
`git branch -r` on `AsterMindAI/n-dx`, and direct pushes to `main` never surface as a PR. And
because our two structures live in different directories, **git merged them with zero conflicts** —
it will never warn us about this. I nearly built a week on top of a structure you'd already
replaced.

## What I need back

1. **Does the migration read as lossless to you?** You wrote these files — if any section loses
   meaning by being relocated, the mapping table changes. Your call.
2. **Yes / no / amend on the ADR.** Specifically: one shared fork (`AsterMindAI/n-dx`), work on
   `elm/<lead>/<topic>` branches, `main` via reviewed PR only.
3. **`WaterJAH/n-dx`** — keep it for personal experiments or retire it? Either's fine as long as
   project work goes through the shared fork.
4. **Would you review the `Claude-Context/` PR?** It's your content being moved, and a second
   lead's review is how the ADR says anything reaches `main`. If we're adopting the rule, this is
   the first place to use it.

Push back on any of it. The structure is the cheap part — I'd rather change it than have two.
