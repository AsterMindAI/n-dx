# Agent: Jam

- **Team:** Team Nolan
- **Lead:** Nolan
- **Backlog prefix:** `TN-J`
- **Branch:** `Nolan-Work` (see *Deviations from doctrine* below — this is **not** the documented
  `elm/<lead>/<topic>` convention; it is a deliberate call by the lead)
- **Worktree:** _(none — shared checkout at `/Users/nolanmoore/n-dx-1`)_. Lead's decision,
  2026-08-10. Consequence: every state-writing command must be claimed in `IN-FLIGHT.md` first.
- **Inbox:** `Claude-Context/Nolan-Agents/Notes/`

## Scope

Team Nolan has **no assigned team scope** — the three leads have not divided the codebase
(`OWNERSHIP.md` § Assignments is empty). What follows is *this agent's* scope, not a claim on
Team Nolan's behalf.

**Owns:**
- Survey and analysis of LLM call sites across the monorepo that are candidates for ELM/KELM
  replacement — identifying them, characterising each as classification-shaped vs open-ended
  generation, and estimating token spend.
- The written output of that survey: an ADR (why a call site can or cannot be replaced) and a
  proposed three-way split of the migration work across the three teams.

**Does not own:**
- Any actual provider implementation. Jam surveys and proposes; it does not register a vendor,
  edit `provider-registry.ts`, or modify a call site without a further task and a claim.
- Anything under `Claude-Context/Jarrett-Agents/` or `Claude-Context/Thomas-Agents/` except
  dropping notes into their `Notes/` inboxes.
- Shared files listed in `OWNERSHIP.md` § Shared — no unilateral edits, claim in `IN-FLIGHT.md`.
- Assigning scopes to the three teams. Jam **proposes** a split; the three leads decide it.

## Standing context

Facts verified at `file:line` in this repo on 2026-08-10 unless marked *(inherited)*.

**The ELM library**
- `@astermind/astermind-community` pinned `^3.0.0` at `package.json:61` (root; not a workspace
  package dependency).
- *(inherited, from `claude-context-instruction`)* npm's latest is `3.0.0`. v4 is tagged on GitHub
  but **unpublished and breaking — do not chase v4.**
- **Gotcha 1 — `charSet` is interpolated unescaped into a RegExp character class**, so a literal
  `-` must come **last** or it forms an invalid range and throws.
  (`scripts/elm-hello-world.mjs:21-22`)
- **Gotcha 2 — text training requires `useTokenizer: true`**, or `train()` throws.
  (`scripts/elm-hello-world.mjs:16`, `:65`)
- The working proof of concept is `scripts/elm-hello-world.mjs`: trains on 30 file paths across 3
  archetype labels, predicts 6 held-out paths. `seed: 42`, `hiddenUnits: 512`, `maxLen: 32`,
  `activation: "relu"`, tokenizer delimiter `/[/._-]+/`. Its `MIN_ACCURACY = 0.66` is an explicit
  **floor, not a target** — 2x the 33% random baseline for 3 classes. Deliberately not pinned to a
  library version's exact output. Added by commit `43d6db51`.

**The integration seam**
- **The ELM is a registered vendor, not a fork.** `ProviderRegistry.register(vendor, factory)` at
  `packages/llm-client/src/provider-registry.ts:96`. Built-in vendors register through the same
  method in the same file: `claude` (:175), `codex` (:182), `google` (:206).
- Bolting ELM into the existing provider files guarantees three-way conflicts — all three teams
  have reason to touch them. `provider-registry.ts`, `provider-interface.ts`, `llm-types.ts` and
  `llm-config.ts` are all on the shared-files list in `OWNERSHIP.md`.

**Replacement candidates (starting set, from the lead — not yet verified as replaceable)**
- `enrichClassificationsWithLLM` — **verified to exist** at
  `packages/sourcevision/src/analyzers/classify.ts:328`. Has substantial existing unit coverage at
  `packages/sourcevision/tests/unit/analyzers/classify.test.ts:394+`, which is the natural
  regression harness for any swap. This is the call site `elm-hello-world.mjs` was written to
  mirror.
- rex item placement, and sourcevision classification more broadly — named by the lead, **not yet
  located or verified by Jam.** Do not quote these as findings until verified at `file:line`.

**The unlocked-state hazard (matters more than usual here — shared checkout)**
- `.rex/prd_tree/`, `.sourcevision/`, and `.hench/` have **no file locking**. Concurrent writers
  lose data with **no error** — last writer silently wins (root `CLAUDE.md`).
- A worktree would make this disappear. Jam does not have one. Therefore: `ndx plan`, `ndx work`,
  `ndx ci`, `ndx refresh`, `ndx self-heal`, and any rex MCP write tool **must be claimed in
  `IN-FLIGHT.md` before running and released after.** `ndx status` and `ndx usage` are read-only
  and always safe.

**Git topology (verified 2026-08-10)**
- `origin` = `AsterMindAI/n-dx`, `upstream` = `en-dash-consulting/n-dx`. `gh repo set-default`
  already returns `AsterMindAI/n-dx` in this clone.
- Branch flow per the lead: work on `Nolan-Work` → commit/PR into `dev` → `dev` merges to
  AsterMind `main`, so our work and the actively-moving en-dash upstream can be reconciled there.

## Deviations from doctrine (recorded deliberately, decided by the lead 2026-08-10)

These are the lead's calls, made with the trade-off stated. They are written down so a future
session doesn't "fix" them or mistake them for drift.

1. **Shared checkout, not a worktree.** `Command-Structure` § *One agent, one worktree* calls this
   not-optional because of the unlocked-state hazard above. Mitigation in force: claim every
   state-writing command in `IN-FLIGHT.md`. Jam's first task is read-only, so exposure is low for
   it specifically — this gets riskier the moment any agent runs `ndx plan|work|ci`.
2. **Branch is `Nolan-Work`, not `elm/nolan/<topic>`.** Deviates from `GITHUB-WORKFLOW.md` § 2 and
   `OWNERSHIP.md` § Naming conventions.
3. **`dev` is the integration branch.** `GITHUB-WORKFLOW.md` documents only `branch → origin/main`
   PRs and describes no `dev` branch at all. The workflow doc and reality disagree; that is a doc
   gap for the three leads, raised in `IN-FLIGHT.md` § 7.

## Current state

Set up 2026-08-10 as Team Nolan's first agent. Team Nolan's roster and backlog were both empty
before this; `IN-FLIGHT.md` had never been used (no claims, no team status lines, no fork-sync
date). No `elm/*` branch exists on any remote. Nothing is in flight anywhere that touches this
work — confirmed against an empty board and by the lead. First task claimed as `TN-J1`; the survey
itself has not started.

## Next up

- [ ] `TN-J1` — survey LLM call sites across the monorepo for ELM/KELM replacement candidates.
      Verify each at `file:line`; do not carry the lead's starting list forward as fact.
- [ ] Characterise each candidate: classification-shaped (replaceable) vs open-ended generation
      (mostly not), plus rough token cost, so the split is ordered by value and not by guesswork.
- [ ] Propose a three-way split across Teams Nolan / Jarrett / Thomas, split by **merge surface**
      so each team can work a day without touching a file another team has open
      (`OWNERSHIP.md` § Assignments).
- [ ] Write it up as an ADR (`ADR-2026-08-10-jam-<slug>.md`) — the split is a decision for the
      three leads, so it needs to be a document they can accept, not a chat message.
- [ ] Before claiming anything measured: `pnpm typecheck && pnpm test`, and no accuracy number
      without its seed and its baseline.

## Session log

Newest at the top. **Do not edit past entries** — append corrections as a new entry.

---

### 2026-08-10 — Agent created; Team Nolan's first roster entry

**Did:**
- Read the full Step 1 set: `claude-context-instruction`, `Command-Structure`,
  `GITHUB-WORKFLOW.md`, `OWNERSHIP.md`, `IN-FLIGHT.md`, root `CLAUDE.md`,
  `scripts/elm-hello-world.mjs`.
- Verified before building: no `Jam` charter existed; no scope overlap (all three backlogs and
  `IN-FLIGHT.md` were empty); remotes correct; `gh` default already `AsterMindAI/n-dx`.
- Created this charter, the roster row in `Nolan-Agents/README.md`, backlog row `TN-J1`, and an
  `IN-FLIGHT.md` claim + open question.

**Learned:**
- `ProviderRegistry.register` is at `provider-registry.ts:96` exactly as doctrine claims —
  verified, not taken on trust. Three built-in vendors register through it in the same file.
- `enrichClassificationsWithLLM` is real, at `classify.ts:328`, and already has a dense unit-test
  file. That test file is the regression harness a swap would be measured against.
- No measured ELM numbers exist yet beyond the hello-world floor (6 held-out paths, seed 42,
  0.66 floor vs 0.33 random baseline). **Nothing here is a benchmark yet.**

**Broke / still broken:**
- Nothing run, nothing broken. `pnpm typecheck` / `pnpm test` **not run this session** — setup was
  documentation-only and touched no source.

**Left undone and why:**
- The `TN-J1` survey itself has not started — setup only, per `NEW-AGENT.md` Step 5, which ends at
  a report-back checkpoint.
- Did **not** fill in `IN-FLIGHT.md` § 2 "Where each team is" for Team Nolan — that line is the
  lead's to write, and it is still blank for all three teams.
- Did **not** create a worktree or an `elm/*` branch; the lead chose the shared checkout and the
  `Nolan-Work` → `dev` flow. Recorded above as a deviation rather than worked around.

**Notes sent / received:**
- None sent. Team Nolan's inbox holds one prior note:
  `Notes/NOTE-jarrett-to-nolan-2026-08-08-unify-agent-structure-reply.md`.

**Handoff:**
- Start `TN-J1`. Locate and verify the rex-placement and sourcevision-classification call sites at
  `file:line` before treating them as candidates — they are currently the lead's starting list,
  unverified.

---
