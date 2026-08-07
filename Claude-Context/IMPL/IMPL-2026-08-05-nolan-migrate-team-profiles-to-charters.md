# IMPL — Migrate `team/` profiles into `Claude-Context/` charters

- **Implements:** `ADR-2026-08-05-nolan-single-fork-and-unified-agent-structure.md`
- **Owner:** Nolan (Team Nolan) — **execution requires Jarrett's agreement first**
- **Backlog item:** none yet
- **Branch:** `elm/nolan/unify-agent-structure`
- **Status:** Blocked — the ADR is Proposed, not Accepted

## Scope

**In scope:** moving `team/Jarrett/{archer,knight,realm}.md` into
`Claude-Context/Jarrett-Agents/` as charters; adding the charter header fields they lack;
retiring `team/`; recording the workflow decision in the docs.

**Out of scope:** rewriting any profile's prose. The voice, the operating principles, and the
accumulated research stay exactly as written. This migration is **additive** — it adds a header
and relocates the file. Nothing is condensed, summarised, or dropped.

Also out of scope: the fused-call finding. It deserves its own ADR with `file:line` verification,
not a paragraph inside this one.

## Precondition

**Do not start until the ADR is Accepted by Jarrett and Thomas.** Two of the three files are
Jarrett's work and `team/Thomas/` is Thomas's directory. Executing a unification unilaterally
would repeat the exact failure the ADR documents, with the roles reversed.

## The mapping — what goes where

The two formats are near-identical in intent. Every profile section has a charter home:

| `team/Jarrett/*.md` section | Charter destination | Change |
|---|---|---|
| `# <Name>` | `# Agent: <Name>` | Title only |
| `## Who I am` | `## Who I am` | **Verbatim.** Charter template has no equivalent; keep it — it does real work. |
| `## How I operate` | `## How I operate` | **Verbatim.** Better than anything in the template. Consider promoting to the template itself. |
| `## What I'm for, in this repo specifically` | `## Scope` → **Owns** | Verbatim, plus an explicit **Does not own** line once scopes are assigned |
| `## What I'm not` | `## What I'm not` | **Verbatim** |
| `## Standing instruction` | *(reconciled)* | Already the charter contract. Keep the wording; add "read your team's `Notes/` inbox" and "commit the update". |
| `## Session log` (archer) | `## Session log` | **Verbatim, every word.** This is the project's most valuable artifact. |
| `## What I've learned about n-dx` (knight) | `## Standing context` | **Verbatim.** Exactly what that section is for. |
| — | `## Current state`, `## Next up` | New empty sections |
| — | Header block: Team, Lead, backlog prefix, branch, worktree, inbox | New — the only genuinely missing metadata |

**Nothing in the "Change" column removes content.** The migration adds a ~6-line header and two
empty sections to each file.

### Per-file

| Source | Destination | Notes |
|---|---|---|
| `team/Jarrett/archer.md` | `Claude-Context/Jarrett-Agents/Archer.md` | Carries the ELM classifier survey. Highest-value file; migrate first and verify by diff. |
| `team/Jarrett/knight.md` | `Claude-Context/Jarrett-Agents/Knight.md` | n-dx orientation → Standing context |
| `team/Jarrett/realm.md` | `Claude-Context/Jarrett-Agents/Realm.md` | Template baseline, no accumulated content |
| `team/Thomas/.gitkeep` | — | Delete; `Thomas-Agents/` already exists. **Thomas's call.** |
| `team/` | — | Remove once empty |

## Steps

1. **Get agreement.** Jarrett and Thomas read the ADR and say yes, no, or amend. Nothing below
   happens first.
2. `git checkout -b elm/nolan/unify-agent-structure` off current `main`.
3. `git mv team/Jarrett/archer.md Claude-Context/Jarrett-Agents/Archer.md` — **`git mv`, not
   copy-then-delete**, so history follows the file and `git log --follow` still reaches the
   original research.
4. Add the charter header to `Archer.md`. Touch nothing below it.
5. **Verify:** `git show HEAD:team/Jarrett/archer.md | diff - <(sed '1,<header>d' …)` — confirm the
   body is byte-identical. If the diff shows anything but the header, stop.
6. Repeat 3–5 for `knight.md` → `Knight.md`, `realm.md` → `Realm.md`.
7. Add roster rows to `Claude-Context/Jarrett-Agents/README.md` — one per agent, with worktree
   paths. `(TBD)` is not valid.
8. Delete `team/Thomas/.gitkeep` and `team/` **only after Thomas confirms**.
9. Update `Claude-Context/GITHUB-WORKFLOW.md`: `git fetch --all --prune`, never single-remote
   (this is the bug that produced the collision — it is currently still wrong in the doc).
10. Open a PR. **Jarrett reviews it**, since it is his content being moved.

## Test strategy

No code changes, so no unit or integration tests. Verification is:

- **Byte-identical bodies.** Step 5's diff is the real test. Run it per file.
- **History preserved.** `git log --follow Claude-Context/Jarrett-Agents/Archer.md` must reach
  `fa0ecafe`. If it doesn't, the move was recorded as delete+add and the provenance of the
  research is lost.
- **No orphan references.** `grep -rn "team/" --include="*.md" .` returns nothing pointing at the
  retired tree.
- **Repo suites unaffected but still run:** `pnpm typecheck && pnpm test`.

## Rollback

`git revert` the merge commit. Everything is docs; nothing touches `.rex/`, `.sourcevision/`, or
`.hench/`, so revert is sufficient — no on-disk state to unwind.

If the moves are already merged and Jarrett wants the old layout back, `git mv` them back; history
survives either direction, which is the point of step 3.

## Open questions

- [ ] **Jarrett:** does the migration read as lossless to you? You wrote these — if any section
      loses meaning by being relocated, that's yours to call, and the mapping table changes.
- [ ] **Jarrett:** keep `WaterJAH/n-dx` for personal experiments, or retire it? Either is fine as
      long as project work goes through `AsterMindAI/n-dx`.
- [ ] **Thomas:** `team/Thomas/.gitkeep` is yours. Delete, or were you mid-setup there?
- [ ] **All three:** `## How I operate` is better than what `CHARTER-TEMPLATE.md` has. Promote it
      into the template so future agents inherit it?
- [ ] **Nolan:** the fused-call finding needs its own ADR, verified at `file:line`. Archer found it
      by reading code; per doctrine, a report is a lead until confirmed independently.
