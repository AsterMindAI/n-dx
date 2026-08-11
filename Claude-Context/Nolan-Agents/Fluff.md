# Agent: Fluff

- **Team:** Team Nolan
- **Lead:** Nolan
- **Backlog prefix:** `TN-F`
- **Branch:** `Nolan-Work` — the lead's decision, 2026-08-11. Same branch as Jam. This is **not**
  the documented `elm/<lead>/<topic>` convention; see *Deviations from doctrine* below.
- **Worktree:** _(none — shared checkout at `/Users/nolanmoore/n-dx-1`)_. Lead's decision,
  2026-08-11, reversing my initial worktree setup the same day. Consequence: every state-writing
  command must be claimed in `IN-FLIGHT.md` first.
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
  an agent a worktree with no agent system in it. My short-lived worktree was based on
  `origin/Nolan-Work` for exactly that reason; the finding stands regardless of the worktree being
  removed, and it is the sharpest single item in `TN-F1`.
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
- **Fluff runs in the shared checkout** (lead's decision, 2026-08-11 — see *Deviations* below), so
  `ndx plan`, `ndx work`, `ndx ci`, `ndx refresh`, `ndx self-heal`, and any rex MCP write **must be
  claimed in `IN-FLIGHT.md` before running and released after.** `ndx status` and `ndx usage` are
  read-only and always safe.
- **No agent on any team currently has worktree isolation.** Jam, Fluff, and all three of
  Jarrett's agents share checkouts. The claim board is the only thing preventing silent PRD
  corruption, and it only works if every agent actually uses it.
- Observed live on 2026-08-11: the shared checkout's HEAD moved from `9c8dc5b1` to `ef99e4e3`
  (Jam's ADR) *during* my setup session. Nothing was lost because I had written nothing at that
  point — but that is the mechanism, observed once already on day one.

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

## Deviations from doctrine (decided by the lead, 2026-08-11)

Written down so a future session doesn't "fix" them or mistake them for drift. Same two deviations
Jam carries, for the same stated reason.

1. **Shared checkout, not a worktree.** `Command-Structure` § *One agent, one worktree* calls this
   not-optional because of the unlocked-state hazard. I set up a worktree at `../n-dx-fluff` during
   onboarding; the lead reversed it the same day for ease of oversight, and it was removed
   (`git worktree remove`) after its one commit was fast-forwarded onto `Nolan-Work`. Mitigation in
   force: claim every state-writing command in `IN-FLIGHT.md`. My work is documentation-only, so my
   own exposure is low — the risk is real for whoever runs `ndx plan|work|ci` next.
2. **Branch is `Nolan-Work`, shared with Jam** — not `elm/nolan/<topic>`. Deviates from
   `GITHUB-WORKFLOW.md` § 2 and `OWNERSHIP.md` § Naming conventions. Note the irony and do not
   resolve it silently: **`TN-F1` is the task of deciding what that convention should be**, and the
   lead's choice here is now the strongest evidence of what the teams actually do.
3. **`dev` is the integration branch.** `GITHUB-WORKFLOW.md` documents only `branch → origin/main`
   and describes no `dev` branch. Raised by Jam in `IN-FLIGHT.md` § 7; folded into `TN-F1`.

## Current state

Set up 2026-08-11 as Team Nolan's second agent. Briefly had a worktree; now on the shared checkout
on `Nolan-Work` per the lead. Setup commit `ab8fde1d` is on `Nolan-Work` and pushed. `TN-F1` is
claimed and the ADR is in progress — the doctrine edits themselves wait on the leads' decision.

## Next up

- [x] `TN-F1` — ADR written and submitted:
      `ADR-2026-08-11-fluff-branch-and-base-conventions.md`, status **Proposed**.
- [x] Notes sent to Teams Jarrett and Thomas asking them to confirm their own branch flows, which I
      inferred and did not verify.
- [ ] **Waiting on the three leads.** Nothing to do until they accept, amend, or reject. Do not
      start editing doctrine files in the meantime — that is the whole reason this went to an ADR.
- [ ] **Only after acceptance:** edit `GITHUB-WORKFLOW.md`, `OWNERSHIP.md`, `NEW-AGENT.md`,
      `claude-context-instruction`, and `Command-Structure` in **one commit**, so the four docs
      cannot drift apart again. Close Jam's `IN-FLIGHT.md` § 7 item and mine in the same commit.
- [ ] Chase the `dev` → `origin/main` merge separately — it needs a second lead's sign-off and is
      the item that actually unbreaks onboarding. The doc edits are cosmetic next to it.
- [ ] Propose that `OWNERSHIP.md` § Untracked-state hazard record Team Nolan's real choice
      (shared checkout, both agents). Still blank.

## Session log

Newest at the top. **Do not edit past entries** — append corrections as a new entry.

---

### 2026-08-11 (end of day, later) — `TN-F2`: note filenames now address lead-to-lead

**Did:** (lead's directive, so applied directly — not routed through an ADR like `TN-F1`. It is
reversible, inside my scope, and the lead decided it rather than asking me to propose it.)
- Renamed all four Team Nolan outbound notes to `NOTE-<from-lead>-to-<to-lead>-…`. Two were mine,
  two were Jam's. **Content untouched in all four** — only the filename and the title block, each
  with a renamed-from banner. Verified Jam's byte-for-byte after.
- Updated the convention in `Command-Structure` § Communication + § folder layout,
  `claude-context-instruction` § 4, `OWNERSHIP.md` § Naming, and **all three** `Notes/README.md`.
- Notes to Jarrett and Thomas (both listing exactly what I changed in their folders), and a
  within-team note to Jam.

**Learned:**
- **The convention had a hole the instruction didn't cover: within-team notes.** Strict lead-to-lead
  makes an agent-to-agent note `nolan-to-nolan`, which reads as a typo. I chose
  `NOTE-<lead>-internal-…` and flagged it in all three notes as my call, overridable. Decided rather
  than blocked, but it is the one part of this not traceable to the lead.
- **The real argument for the rule is retirement, not tidiness.** `NEW-AGENT.md` § Retiring says
  charters stay and resolved notes are never deleted — so an agent name in a filename outlives the
  agent by design. Worth knowing when someone asks why this mattered.

**Broke / still broken:**
- Nothing run against source. **`pnpm typecheck` / `pnpm test` still NOT run** — Markdown only.
- **`TN-F1` is untouched by this and still unfixed.** `NEW-AGENT.md` still produces a broken
  checkout off `main`; the ADR is still *Proposed*. Renaming notes changed nothing about that.

**Left undone and why:**
- **Did not edit `Jam.md:190-191`**, which still cites the old note paths. Another agent's charter is
  its memory and session-log entries are append-only. Told Jam in the internal note instead.
- **I crossed both other teams' seams** — edited `Jarrett-Agents/Notes/README.md` and
  `Thomas-Agents/Notes/README.md`, which are their files. Doctrine permits it surgically with a
  same-session note (`Command-Structure` § Doctrine, *fix and tell*), and both notes list exactly
  what I touched and invite a revert. Flagged rather than assumed.

**Notes sent / received:**
- Sent: `Jarrett-Agents/Notes/NOTE-nolan-to-jarrett-2026-08-11-note-naming-convention.md`,
  `Thomas-Agents/Notes/NOTE-nolan-to-thomas-2026-08-11-note-naming-convention.md`,
  `Nolan-Agents/Notes/NOTE-nolan-internal-2026-08-11-note-rename.md`.

**Handoff:**
- Nothing pending on `TN-F2`. `TN-F1` still waits on the three leads — check
  `Nolan-Agents/Notes/` for replies from Jarrett or Thomas first.

---

### 2026-08-11 (end of day) — Near-miss with Jam in the shared checkout

**Not a task entry — a hazard entry, recorded because it is evidence.**

While I was working, Jam committed `a135360c` and `33365785` to `Nolan-Work` in this same working
directory. `33365785` modified `NOTE-jam-to-jarrett-2026-08-11-elm-split-proposal.md`; I renamed and
edited that exact file minutes later. **Nothing was lost** — my rename was based on Jam's committed
content and I verified it afterwards — but the ordering was luck. Had I staged my rename first, Jam's
amendment about the vendor seam would have been the loser, silently.

This is the **second** time today HEAD moved under me mid-session (the first was `9c8dc5b1` →
`ef99e4e3` during onboarding), and the first time it touched a file I was actively editing. Both
happened inside 24 hours of Team Nolan putting two agents on one branch in one checkout.

This belongs in the record for `ADR-2026-08-11-fluff-branch-and-base-conventions.md` § Consequences,
which predicted exactly this and called it the accepted cost. It is no longer hypothetical. I have
not amended the ADR — it is *Proposed* and amending it to cite a near-miss that cost nothing would
overstate the evidence. If it happens again with actual loss, that is the amendment.

---

### 2026-08-11 (end of day) — Stale remote branch deleted

**Closes the "Left undone" item in the entry below.** `origin/elm/nolan/agent-system-docs` has been
deleted at the lead's instruction. Verified first that `git branch -r --contains` listed
`origin/Nolan-Work` for its tip `ab8fde1d`, so the branch held nothing unique — the setup commit
lives on `Nolan-Work`.

`origin` is now `main`, `dev`, `Nolan-Work`, `Jarrett`, `Thomas_Branch`,
`feat/astermind-elm-hello-world`, plus upstream-mirrored feature branches. **No `elm/*` branch
exists on any remote, and none ever has for longer than a few hours** — the one I created during
onboarding was the first and last. That is now the whole of the evidence for `TN-F1` § Context 1,
and it is stronger for the branch being gone, not weaker.

**Still true and still not fixed:** `NEW-AGENT.md` produces a broken checkout for anyone who
onboards off `main`. `ADR-2026-08-11-fluff-branch-and-base-conventions.md` remains **Proposed** —
waiting on the three leads. Nothing about deleting a branch changes that.

---

### 2026-08-11 (later same day) — Moved to shared checkout; `TN-F1` ADR submitted

**Correction to the entry below.** That entry says I am "the first agent on any team with a real
worktree" and that the worktree is why the unlocked-state hazard doesn't apply to me. **Both are now
false.** The lead reversed the worktree decision the same day, for ease of oversight. I am on the
shared checkout at `/Users/nolanmoore/n-dx-1`, on `Nolan-Work`, alongside Jam. The mitigation is the
one for shared checkouts: claim every state-writing command in `IN-FLIGHT.md`. The roster block in
`Nolan-Agents/README.md` has been corrected in place too, since the wrong version landed there.

**Did:**
- Fast-forwarded `Nolan-Work` to my setup commit `ab8fde1d` (clean, 1 ahead / 0 behind — nobody had
  moved it), pushed, then `git worktree remove ../n-dx-fluff` and deleted the merged local branch
  `elm/nolan/agent-system-docs`. Nothing was lost; the commit lives on `Nolan-Work`.
- Wrote `ADR-2026-08-11-fluff-branch-and-base-conventions.md` (Proposed) — four documented
  mismatches, a proposed convention, five alternatives with reasons, and the git commands that
  reproduce every claim.
- Sent notes to Teams Jarrett and Thomas. Both ask the same thing: confirm your own branch flow,
  which I inferred from the branch list and PR #5 and did **not** verify with you.
- Updated `IN-FLIGHT.md` § 1 (claim), § 3 (findings), § 7 (open question); `BACKLOG.md` `TN-F1`
  now links the ADR.

**Learned:**
- **The `origin/main` gap is merge lag, not design.** `origin/dev` is 10 ahead of `main` and 3
  behind; `main`'s 3 are a `profile/*.md` add and its revert. My earlier framing implied `main`
  deliberately excludes the agent system — it does not, `dev` has just never been merged down. This
  changed the recommendation materially: the real fix is merging `dev` → `main` (needs a second
  lead), and documenting `dev` as the base is only the stopgap.
- The `elm/*` branch I created during onboarding was the first and only one to ever exist on any
  remote, and it lasted about an hour. That is the cleanest possible evidence for the ADR.

**Broke / still broken:**
- Nothing run against source. **`pnpm typecheck` and `pnpm test` still NOT run** — this session
  touched only Markdown under `Claude-Context/`.
- **Still broken and not fixed by this ADR:** `NEW-AGENT.md` continues to produce a broken checkout
  for anyone who onboards off `main` today. The ADR is *Proposed*; nothing is fixed until the leads
  decide and the doc edits land. Team Thomas has no agents yet and is the next likely victim — the
  note to them says so and gives the workaround.

**Left undone and why:**
- **No doctrine file edited.** Deliberate, and the point of the ADR — a rule binding three teams is
  collective command.
- **`origin/elm/nolan/agent-system-docs` still exists on the remote.** Its only commit is on
  `Nolan-Work`, so it is redundant and now a misleading "Fluff is working here" signal. Deleting a
  remote branch is outward-facing; asked the lead rather than doing it.
- `IN-FLIGHT.md` § 2 "Where each team is" still blank for all three teams — the lead's line.
- `OWNERSHIP.md` § Untracked-state hazard still blank. Shared file, lead's call; carried as a
  proposal in *Next up*.

**Notes sent / received:**
- Sent: `Jarrett-Agents/Notes/NOTE-fluff-to-jarrett-2026-08-11-branch-and-base-conventions.md`,
  `Thomas-Agents/Notes/NOTE-fluff-to-thomas-2026-08-11-branch-and-base-conventions.md`.
- Received: none new.

**Handoff:**
- Do not touch the doctrine docs. Check whether Jarrett or Thomas replied in
  `Nolan-Agents/Notes/`; their answers are a stated dependency of Decision item 1. If the ADR is
  accepted, do all five doc edits in one commit.

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
