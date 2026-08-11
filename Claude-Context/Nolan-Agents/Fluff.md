# Agent: Fluff

- **Team:** Team Nolan
- **Lead:** Nolan
- **Backlog prefix:** `TN-F`
- **Branch:** `elm/nolan/agent-system-docs` — see *Open question on my own branch name* below. This
  follows the convention currently written in `GITHUB-WORKFLOW.md`, which is the same convention
  my first task exists to change. It may get renamed by my own work.
- **Worktree:** `/Users/nolanmoore/n-dx-fluff` (`../n-dx-fluff` from the shared checkout)
- **Inbox:** `Claude-Context/Nolan-Agents/Notes/`

## Scope

Team Nolan has **no assigned team scope** — the three leads have not divided the codebase
(`OWNERSHIP.md` § Assignments is empty for all three teams). What follows is *this agent's* scope,
assigned by the lead on 2026-08-11, not a claim on Team Nolan's behalf.

**Owns:**
- The `Claude-Context/` agent system itself — the doctrine, onboarding, and workflow documents that
  the three teams operate from: `claude-context-instruction`, `Command-Structure`, `NEW-AGENT.md`,
  `GITHUB-WORKFLOW.md`, `OWNERSHIP.md`, `CHARTER-TEMPLATE.md`, `SYNC-TEMPLATE.md`, and the team
  folder conventions.
- Keeping those documents true. Where doctrine and observed reality disagree, finding it,
  evidencing it at `file:line` or by git command, and proposing the correction.

**Does not own:**
- **The decision of which convention wins.** Fluff finds and documents the mismatch and drafts the
  fix; changing a rule that binds all three teams is a collective-command decision, so it goes to
  the leads as an ADR. Editing the doctrine file is the *last* step, after they accept it — not the
  first.
- Any source under `packages/**`. No provider implementation, no ELM registration, no call-site
  edits.
- Other teams' charters, backlogs, or rosters under `Claude-Context/Jarrett-Agents/` and
  `Claude-Context/Thomas-Agents/` — except dropping notes into their `Notes/` inboxes.
- Jam's territory: the LLM call-site survey and the proposed three-way migration split
  (`TN-J1`, `ADR-2026-08-11-jam-elm-replacement-survey-and-split.md`).
- Root `CLAUDE.md`, `AGENTS.md`, `packages/core/assistant-assets/**`, `tests/e2e/**`, `.n-dx.json`,
  `package.json`, `pnpm-lock.yaml` — shared files, claim in `IN-FLIGHT.md` first.

> **Note on my own scope:** everything in `Claude-Context/` root is on the `OWNERSHIP.md` § Shared
> list — "nobody edits unilaterally". So my assigned scope *is* a shared surface. Every edit I make
> gets an `IN-FLIGHT.md` claim, and doctrine changes get an ADR. This is not optional for me; it is
> the normal case.

## Standing context

Facts verified in this repo on 2026-08-11 unless marked *(inherited)*. **Delete anything that goes
stale — a wrong standing fact is worse than a missing one.**

### Git topology (verified by command, 2026-08-11)

- `origin` = `AsterMindAI/n-dx`, `upstream` = `en-dash-consulting/n-dx`. `gh repo set-default`
  returns `AsterMindAI/n-dx` in both the shared checkout and this worktree.
- **`origin/main` does not contain `Claude-Context/` at all.** Verified:
  `git ls-tree --name-only origin/main | grep -i claude` returns only `.claude` and `CLAUDE.md`.
  The directory exists on `origin/dev`, `origin/Nolan-Work`, and `origin/Jarrett` only.
  **Consequence:** `NEW-AGENT.md` Step 4's `git worktree add ../n-dx-<name> -b elm/<lead>/<topic>`
  branches off the current HEAD, and doctrine elsewhere says branch off `main` — either would give
  an agent a worktree with no agent system in it. This worktree is based on `origin/Nolan-Work`
  for that reason.
- Real branches on `origin`: `main`, `dev`, `Nolan-Work`, `Jarrett`, `Thomas_Branch`,
  `feat/astermind-elm-hello-world`, plus assorted upstream-mirrored feature branches.
  **No `elm/*` branch existed on any remote before mine** — the documented convention has never
  once been used.
- Team branch flow actually in use (per the lead, and consistent with the branch list):
  `<TeamName>` → `dev` → AsterMind `main`. `GITHUB-WORKFLOW.md` documents only
  `elm/<lead>/<topic>` → `origin/main` and does not mention `dev` anywhere.

### The doc-vs-reality gap (this is `TN-F1`)

Four separate mismatches, all pointing the same way — the docs describe a flow nobody uses:

1. **Branch naming.** `GITHUB-WORKFLOW.md` § 2, `OWNERSHIP.md` § Naming conventions,
   `claude-context-instruction` § 4, and `Command-Structure` § Rules all say `elm/<lead>/<topic>`.
   Reality is `Nolan-Work`, `Jarrett`, `Thomas_Branch`.
2. **The `dev` branch is undocumented.** It exists, it carries `Claude-Context/`, and Team Nolan
   PRs into it. No doc mentions it. Raised by Jam in `IN-FLIGHT.md` § 7 on 2026-08-10.
3. **`main` is not a valid base for agent work.** See above — it has no `Claude-Context/`.
4. **Per-agent vs per-team branches.** The docs assume one branch per agent
   (`elm/<lead>/<topic>`); the observed convention is one branch per *team*, which does not give
   two agents on the same team a place to work independently. A worktree needs its own branch, so
   this gap is load-bearing, not cosmetic.

### The unlocked-state hazard

- `.rex/prd_tree/`, `.sourcevision/`, and `.hench/` have **no file locking**. Concurrent writers
  lose data with **no error** — last writer silently wins (root `CLAUDE.md`; `Command-Structure`
  § One agent, one worktree).
- Fluff has its own worktree, so local `ndx plan|work|ci|refresh|self-heal` runs are safe without
  an `IN-FLIGHT.md` claim. **This is the only agent that currently has that property** — Jam and
  all three of Jarrett's agents are on shared checkouts.
- Observed live on 2026-08-11: the shared checkout's HEAD moved from `9c8dc5b1` to `ef99e4e3`
  (Jam's ADR) *during* my setup session. Nothing was lost because I had written nothing, but that
  is exactly the mechanism — this is why the worktree is not a formality.

### The ELM library *(inherited — I have run none of this)*

- `@astermind/astermind-community`, pinned `^3.0.0` at root `package.json:61`.
- **Gotcha 1:** `charSet` is interpolated unescaped into a RegExp character class, so a literal `-`
  must come **last** or it forms an invalid range and throws. (`scripts/elm-hello-world.mjs:21-22`)
- **Gotcha 2:** text training requires `useTokenizer: true`, or `train()` throws.
  (`scripts/elm-hello-world.mjs:16`, `:65`)
- npm's latest is `3.0.0`. v4 is tagged on GitHub but **unpublished and breaking — do not chase
  v4.**
- The proof of concept is `scripts/elm-hello-world.mjs`: 30 training paths, 3 labels, 6 held-out.
  `seed: 42`, `hiddenUnits: 512`. Its `MIN_ACCURACY = 0.66` is a **floor, not a target** — 2x the
  33% random baseline. **No benchmark exists yet.**

### The integration seam *(inherited)*

- **The ELM is a registered vendor, not a fork.** `ProviderRegistry.register(vendor, factory)` at
  `packages/llm-client/src/provider-registry.ts:96`. Bolting ELM into existing provider files
  guarantees three-way conflicts.
- Jam's survey (`ADR-2026-08-11-jam-elm-replacement-survey-and-split.md`, status **Proposed**)
  found all LLM inference flows through three chokepoints, and that Tier A —
  genuinely classification-shaped — is exactly two call sites: `classifyBatchWithLLM`
  (`classify.ts:404`, 17 labels) and `assessGranularity` (`reason.ts:1481`, 3 labels).
  Not my work; recorded so I don't re-derive it.

## Open question on my own branch name

My first task is to fix the `elm/<lead>/<topic>` convention. I had to pick a branch name *before*
that fix exists, so I used the convention as currently written, on the reasoning that a rule in
force stays in force until the leads change it — I should not pre-empt the outcome of my own task
by unilaterally adopting the replacement. If the accepted fix names something else, this branch
gets renamed. Flagged rather than quietly split.

## Current state

Set up 2026-08-11 as Team Nolan's second agent, and the first agent on any team with a real
worktree. Nothing edited yet beyond my own setup files. `TN-F1` is claimed but not started — the
`NEW-AGENT.md` process ends at a report-back checkpoint, and the fix itself is a doctrine change
that needs the leads, so the next step is an ADR, not a doc edit.

## Next up

- [ ] `TN-F1` — write `ADR-2026-08-11-fluff-<slug>.md` laying out the four mismatches above with
      their evidence, and proposing one coherent convention that covers: per-agent branch naming,
      the `dev` branch's role, and which branch is a valid base for a new agent's worktree.
- [ ] Get it in front of a second lead. A rule binding all three teams is collective command —
      Jam already opened this as a question in `IN-FLIGHT.md` § 7, so the leads are on notice.
- [ ] **Only after acceptance:** edit `GITHUB-WORKFLOW.md`, `OWNERSHIP.md`, `NEW-AGENT.md`,
      `claude-context-instruction`, and `Command-Structure` in one pass, so the four docs cannot
      disagree with each other again. Close Jam's `IN-FLIGHT.md` § 7 item in the same commit.
- [ ] Fix `NEW-AGENT.md`'s worktree step so it names a base branch that actually carries
      `Claude-Context/`. As written it produces a broken worktree for the next agent.
- [ ] Consider proposing that `OWNERSHIP.md` § Untracked-state hazard record Team Nolan's actual
      choice — it is still blank, and Nolan now has one agent on each side of it (Jam shared,
      Fluff worktree).

## Session log

Newest at the top. **Do not edit past entries** — append corrections as a new entry.

---

### 2026-08-11 — Agent created; first worktree-isolated agent on the project

**Did:**
- Read the full `NEW-AGENT.md` Step 1 set in order: `claude-context-instruction`,
  `Command-Structure`, `GITHUB-WORKFLOW.md`, `OWNERSHIP.md`, `IN-FLIGHT.md`, root `CLAUDE.md`,
  `scripts/elm-hello-world.mjs`.
- Step 3 verification: no `Fluff` charter or branch existed anywhere; remotes correct; `gh` default
  correct; working tree clean; no scope overlap with `TN-J1` (Jam surveys call sites, I edit the
  agent system) and both other teams' backlogs are empty.
- Created worktree `../n-dx-fluff` on branch `elm/nolan/agent-system-docs`, based on
  `origin/Nolan-Work`. Ran `pnpm install` (exit 0) and `gh repo set-default AsterMindAI/n-dx`.
- Created this charter, the roster row in `Nolan-Agents/README.md`, backlog row `TN-F1`, and an
  `IN-FLIGHT.md` claim.

**Learned:**
- **`origin/main` has no `Claude-Context/` directory.** Verified by `git ls-tree`. Doctrine says
  branch off `main`; doing so would have produced a worktree with no agent system in it. Based the
  worktree on `origin/Nolan-Work` instead. This is evidence for `TN-F1`, not a workaround to hide.
- **No `elm/*` branch has ever existed on any remote.** The convention four documents state is one
  that has never been used once. Mine is the first, and only because I chose to follow the written
  rule over the observed one.
- The shared checkout's HEAD advanced under me mid-session (`9c8dc5b1` → `ef99e4e3`). Harmless this
  time; it is the exact hazard `Command-Structure` describes.

**Broke / still broken:**
- Nothing run against source, nothing broken. **`pnpm typecheck` and `pnpm test` were NOT run** —
  this session touched only Markdown under `Claude-Context/`. `pnpm install` exited 0.

**Left undone and why:**
- `TN-F1` itself is not started. `NEW-AGENT.md` Step 5 ends at a report-back checkpoint, and the
  fix is a doctrine change that is the three leads' decision, not mine to land unilaterally.
- Did **not** edit any doctrine file. Deliberate — see *Does not own* above.
- Did **not** write `IN-FLIGHT.md` § 2 "Where each team is" for Team Nolan. Still blank for all
  three teams; that line is the lead's to write.
- Did **not** record Team Nolan's worktree-vs-shared-checkout choice in `OWNERSHIP.md` § Untracked
  -state hazard. It is a shared file and a lead's call; carried forward as a proposal instead.

**Notes sent / received:**
- None sent. Team Nolan's inbox holds one prior note,
  `Notes/NOTE-jarrett-to-nolan-2026-08-08-unify-agent-structure-reply.md`, read this session.

**Handoff:**
- Draft the `TN-F1` ADR. Lead with the `origin/main` finding — it is the one mismatch that actively
  breaks the onboarding procedure for the next agent, rather than merely being untidy.

---
