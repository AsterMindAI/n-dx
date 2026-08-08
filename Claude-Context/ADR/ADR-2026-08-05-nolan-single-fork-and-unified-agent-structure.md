# ADR — One shared fork, branch-and-PR workflow, one agent structure

- **Status:** Partially Accepted — Jarrett agreed 2026-08-08 (see [`NOTE-nolan-to-jarrett-2026-08-05-unify-agent-structure.md`](../Jarrett-Agents/Notes/NOTE-nolan-to-jarrett-2026-08-05-unify-agent-structure.md), resolved section); Thomas has not yet responded. Not fully Accepted until Thomas agrees.
- **Date:** 2026-08-05
- **Author:** Nolan (Team Nolan)
- **Supersedes:** none
- **Backlog item:** none yet

## Context

On 2026-08-05 two organisational systems for the same problem existed in this repo at once, built
independently and neither aware of the other:

| | `Claude-Context/` (Nolan, branch `ELM-Implementations`) | `team/` (Jarrett, pushed to `main`) |
|---|---|---|
| Layout | `Claude-Context/{Nolan,Jarrett,Thomas}-Agents/` | `team/{Jarrett,Thomas}/` |
| Agent file | `CHARTER-TEMPLATE.md` → per-agent charter | `archer.md`, `knight.md`, `realm.md` |
| Reclaim mechanism | "read your charter at session start, append a session entry at the end" | "Every time you call on me, I reread this file first, then update it as part of the work" |
| Also has | notes inboxes, backlogs, ADR/IMPL dirs, syncs | — |

**The two designs agree on the important part.** Both concluded independently that an agent needs
a durable per-agent file it reads on wake and writes on exit. Jarrett's `## Standing instruction`
section and this repo's charter session-log contract are the same mechanism described twice.

### How it surfaced

Nolan ran `git fetch upstream`, inspected `upstream/main..origin/main`, saw three familiar commits,
merged, and pushed. The push was **rejected** — `origin/main` had five commits from Jarrett that
the local ref knew nothing about, because `git fetch upstream` refreshes `upstream/*` only and
leaves `origin/*` stale. Every check run against that stale ref looked clean.

Three facts made this invisible until the push:

1. **Jarrett pushed directly to `main`**, so the work never appeared as a branch or a PR.
2. **Jarrett pushed from a second personal fork** (`WaterJAH/n-dx`, visible in merge commit
   `5d3ce7b4`), so the branches never appeared in `git branch -r` on the shared fork either.
3. **The two structures occupy disjoint paths**, so when the merge finally happened, git reported
   **zero conflicts** and produced a repo containing both systems.

Point 3 is the one that matters. **Git cannot detect this class of collision.** A conflict marker
requires two edits to the same lines; two people building parallel org structures in different
directories will merge cleanly forever, and the first real symptom is agents following whichever
convention they happen to read first.

**Nobody violated a rule.** No workflow had been agreed, and the `Claude-Context/` documents
proposing one were sitting unmerged on a branch. This ADR exists because the gap was real before
either of us started writing, not because anyone did anything wrong.

## Decision

**1. One shared fork.** `AsterMindAI/n-dx` is the only fork we work through. `origin` points at it
for all three of us. Personal forks are not used for project work.

**2. Branches, not direct pushes.** All work happens on `elm/<lead>/<topic>` branches pushed to
`origin`, and reaches `main` through a pull request reviewed by a different lead. `main` is what
everyone branches from; it stays reviewed.

**3. One agent structure.** `Claude-Context/` is the single home. `team/<Name>/` is retired, and
its three profiles migrate to `Claude-Context/<Name>-Agents/` as charters. **No content is
dropped** — see the IMPL for the field-by-field mapping.

**4. Always `git fetch --all`.** Never `git fetch <one-remote>` before a comparison. This repo has
two remotes and a one-remote fetch silently produces stale comparisons.

## Alternatives considered

| Option | Why not |
|--------|---------|
| **Personal fork each, cross-fork PRs** | Technically works, and is the normal open-source model — for contributors who do *not* need to coordinate. We do. Every coordination mechanism we have (`git branch -r` as a live map, draft PRs as an "I'm here" signal, git-as-lock on the claim boards) requires a shared remote. On separate forks each person sees only their own branches, and `IN-FLIGHT.md` forks into three divergent copies — the boards become decorative. This is not hypothetical: it is what produced the collision above. |
| **Keep both structures, pick one later** | They merge without conflict, so "later" never arrives on its own — it arrives when two agents have followed different conventions for a week. The cost of deciding rises every day and nothing forces the decision. |
| **Adopt `team/` and drop `Claude-Context/`** | Genuinely considered — `team/` is simpler and shorter. But it has no notes inboxes, backlogs, ADR/IMPL directories, or claim boards, and those are the parts that address the specific failure we just hit. Adopting `team/` means rebuilding them. |
| **Adopt `Claude-Context/` and discard the profiles** | Unacceptable. `archer.md` and `knight.md` contain the best technical work on this project so far (below). Structure is cheap; that research is not. |
| **Allow direct pushes to `main` for docs only** | The five commits that caused this were docs-only. The exemption would have covered them exactly. |

## Consequences

**Easier:** everyone's branches visible in one `git branch -r`. Claim boards actually lock. Real
cross-review becomes available — three humans with three GitHub accounts, so unlike a single-account
setup, GitHub permits genuine peer approval. One place for an agent to look.

**Harder:** pushing to `main` now takes a PR and another person's attention. This is the cost being
bought deliberately — `main` is the base for all three of us, and an unreviewed commit there is on
everyone's next branch.

**Migration cost:** low. Three files move and gain a header; see the IMPL.

**Requires agreement.** Jarrett has agreed (2026-08-08) and his three charter files
(`archer.md`/`knight.md`/`realm.md`) have been migrated to `Claude-Context/Jarrett-Agents/` per
the IMPL. Thomas still has a `team/Thomas/` directory and has not yet agreed — `team/Thomas/.gitkeep`
and the final removal of `team/` are left untouched pending his confirmation, so this migration
does not repeat the original mistake in the opposite direction.

## Evidence

Not an ELM-viability claim, so no seed/baseline applies. The claims above are measurements:

```
$ git rev-list --left-right --count origin/main...main    # after `git fetch origin`
5    1                        # five commits on the fork the local ref had never seen

$ git log --oneline main..origin/main
f9384e9e  WaterJAH01  Delete team/Nolan/.gitkeep
21e692db  WaterJAH    Remove old profile/ path after move to team/Jarrett/
d9895d7f  WaterJAH    Reorganize AI-instance profiles under team/Jarrett
5d3ce7b4  WaterJAH    Merge branch 'main' of https://github.com/WaterJAH/n-dx   ← second fork
fa0ecafe  WaterJAH    new file: profile/archer.md, knight.md, realm.md

$ git merge-tree --write-tree origin/main main
exit 0, zero conflicts      # two org structures, merged silently
```

All five commits landed on `main` without a pull request.

### The content this protects

`team/Jarrett/archer.md`'s session log holds a survey of every classification call site in n-dx,
separating the already-algorithmic ones from the genuinely LLM-backed ones, naming
`enrichClassificationsWithLLM` (`packages/sourcevision/src/analyzers/classify.ts`) as the best
first ELM target, and recording this constraint:

> several of the LLM-backed ones are fused calls — one round-trip returns both a label *and*
> free-text reasoning (e.g. `assessGranularity` returns `recommendation` + `reasoning` + `issues`
> together). An ELM can only replace the label half; splitting those calls would be required to
> actually drop the LLM round-trip.

**That constrains the entire project** and belongs in its own ADR once verified at `file:line`.
`team/Jarrett/knight.md` separately holds a full n-dx orientation — package roles, the AI call
sites in each tool, and hench's autonomy guardrails.

Both were found by reading the code. Neither is reproduced from any document in this repo.
