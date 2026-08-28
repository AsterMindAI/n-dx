# In flight — cross-team claim board & rolling sync

This is the **cross-team** board. Work *inside* a team is tracked in that team's
`<Name>-Agents/BACKLOG.md`. This file is for the things that can hurt someone else: shared files,
seam crossings, and state-writing commands.

**Git is the lock.** Claim by editing this file and **committing**. First commit wins.

> **While team scopes are unassigned, this board is doing all the work.** There is no ownership
> map to fall back on — if it isn't claimed here, nobody knows you're in that file. Claim
> generously for now; over-claiming costs a table row, under-claiming costs someone's afternoon.

---

## 1. Claims

Claim before you start. Delete your row when you're done. If a row is older than a day, send its
owner a note before assuming it's stale — don't just delete it.

| Since | Who | Team | What | Paths / command | Expected release |
|---|---|---|---|---|---|
| 2026-08-11 | Fluff | Nolan | `TN-F1` — reconciling the branch-naming / `dev`-branch / base-branch mismatch across the doctrine docs. **This claims shared files:** everything in `Claude-Context/` root is on the "nobody edits unilaterally" list, and these four docs bind all three teams. No doc is edited until the ADR is accepted — this row is claiming the *ADR and the eventual single-pass edit*, so a second agent doesn't start the same reconciliation. | Writes `Claude-Context/Nolan-Agents/Fluff.md`, `Claude-Context/Nolan-Agents/{README,BACKLOG}.md`, one new `Claude-Context/ADR/ADR-2026-08-11-fluff-*.md`, and this row. **Pending leads' acceptance:** `GITHUB-WORKFLOW.md`, `OWNERSHIP.md`, `NEW-AGENT.md`, `claude-context-instruction`, `Command-Structure`. **No source files.** Fluff is on the **shared checkout**, branch `Nolan-Work`, alongside Jam (lead's decision 2026-08-11) — so any state-writing command gets its own claim row here first. This task runs none. | On the leads' decision + single-pass doc edit |

| 2026-08-11 | Nolan (lead) | Nolan | **Team Nolan claims Path B** — sourcevision archetype classification, per [`SYNC-001`](Nolan-Agents/syncs/SYNC-001-2026-08-11-elm-path-assignment.md) and [`IMPL-2026-08-11-jam-elm-classification-path-b.md`](IMPL/IMPL-2026-08-11-jam-elm-classification-path-b.md). **Paths A and C remain unclaimed** — this is not a claim on them, and Jarrett/Thomas should take whichever they want. *(Update 2026-08-23, added by Butter: **Path A's measurement half is now claimed by Team Nolan** — see the Butter row below. Path A's other half, the shared ELM inference wrapper, and all of Path C remain genuinely unclaimed.)* | `packages/sourcevision/src/analyzers/**` | On Path B completion or hand-off |



| 2026-08-23 | Butter | Nolan | `TN-J3` — **Path A, the measurement half: token accounting.** Root-cause why `tokenUsage` records zero, or establish that it no longer does. This gates Paths B and C — neither can state a saving until the number is trustworthy. **Correction to what this board has been assuming:** the six zero-token runs are all dated `2026-02-04`, while `event-accumulator.ts`, which does the accumulating, was added `2026-04-21` (`0269cf75`). The evidence predates the mechanism by 2.5 months, so **nobody should quote "token accounting is broken" as a current fact** — it means nobody has measured since February. I have not made a fresh run yet and am asserting nothing about today's behaviour. | Edits `packages/llm-client/src/{token-usage,cli-provider,api-provider}.ts` and `packages/hench/src/agent/lifecycle/event-accumulator.ts` + their tests. **None of the four shared `llm-client` files listed below** — if a fix reaches one, it gets its own claim row first. Will run **hench** (state-writing, `.hench/`) — but from **worktree `/Users/nolanmoore/n-dx-butter`, branch `Nolan-Work-Butter`**, so it cannot touch the shared checkout's state. | On root-cause + a committed way to re-check it |
| 2026-08-23 | Butter | Nolan | **One-line `ALLOWED` entry in `tests/e2e/architecture-policy.test.js`** for `scripts/elm-token-baseline.mjs`. **Claiming because `tests/e2e/**` is on the shared "nobody edits unilaterally" list** — it changes everyone's rules. Same category and same rationale as the two entries Jam added under `TN-J13`: analysis-only script, shells out to `git` for provenance, and `@n-dx/llm-client` does not resolve from `scripts/`. Extending an existing justified exception by one line, not creating a new class of exception. | `tests/e2e/architecture-policy.test.js` — one line plus a comment. | Immediately — single-line edit |

| 2026-08-23 | Jam | Nolan | `TN-J17` — **the Path-B-side half of Butter's `TN-B2`: constrain the agent harness on classification calls.** Butter measured a real classify call at 53k–268k tokens with **~95% not prompt or completion**, and hypothesised the full Claude Code agent CLI is spawned per call. **Structurally confirmed:** `spawnOnce` (`cli-provider.ts:118-129`) passes only `-p --output-format --model`, and **three MCP servers are currently connected**, so their tool definitions load into every classify call for a task needing zero tools. **This is mine, not Butter's** — `cliFlags` is already on the public `CompletionRequest` (`types.ts:76`) and sourcevision's `callClaude` (`claude-client.ts:145-149`) simply passes none, so the fix needs **no change to `llm-client`**. Writing ADR + IMPL first; no code until the ADR is accepted. | Writes `Claude-Context/ADR/ADR-2026-08-23-jam-constrain-cli-harness-for-classification.md` and the matching IMPL. Eventual code touches **only** `packages/sourcevision/src/analyzers/claude-client.ts` + its tests. **No `llm-client` files** — if a fix ever needs one, it gets its own row and goes to Butter first. | On the ADR being accepted or rejected |

| 2026-08-27 | Butter | Nolan | `TN-B3` **Step 0 — DEPENDENCY SCOPE CHANGE, needs a second lead.** `@astermind/astermind-community@^3.0.0` is declared at **root `package.json:61` only**; no workspace package declares it. The ELM inference module ([`ADR-2026-08-23-butter-elm-inference-module.md`](ADR/ADR-2026-08-23-butter-elm-inference-module.md)) needs it in `packages/llm-client`. **Not a new vendor** — approved at root in `43d6db51` — but it is a new *workspace* dependency and it churns `pnpm-lock.yaml`, which is on the shared list. Doctrine puts dependency additions under collective command, so **"already at root" is not permission.** **Claiming now to measure the real blast radius; `pnpm add` does NOT run until a second lead signs off.** Notes going to Jarrett and Thomas. | `packages/llm-client/package.json` · `pnpm-lock.yaml` (both SHARED). No source files. Measurement is done in worktree `/Users/nolanmoore/n-dx-butter` and reverted. | On sign-off, or on refusal — released same session either way |

| 2026-08-27 | Butter | Nolan | `TN-B3` Lane 1 — **adding `scripts/elm-prototype/`**, announced before creation per the shared-`scripts/` rule. Script-tier ELM engine per [`ADR-2026-08-27-butter-prove-before-provisioning.md`](ADR/ADR-2026-08-27-butter-prove-before-provisioning.md): prove the ELM before anyone provisions for it. **No workspace dependency, no lockfile change, no sign-off** — `scripts/` already resolves the root ELM dep (`elm-hello-world.mjs:19`). **Reads Jam's corpus; does not write it.** Publishes no accuracy number — the verdict is `TN-B5`, Jam's. | New `scripts/elm-prototype/{README.md,config.mjs,classifier.mjs,train-eval.mjs}`. Read-only against `scripts/data/elm-archetype-corpus.json`. | On promotion or on a negative result |

**Shared files — nobody edits unilaterally:**
`package.json` · `pnpm-lock.yaml` · `CLAUDE.md` · `AGENTS.md` ·
`packages/core/assistant-assets/**` · `tests/e2e/**` · `.n-dx.json` ·
`packages/llm-client/src/{provider-registry,provider-interface,llm-types,llm-config}.ts`

**State-writing commands — claim these unless you're in your own worktree:**
`ndx plan` · `ndx work` · `ndx ci` · `ndx refresh` · `ndx self-heal` · any rex MCP write tool
Read-only (`ndx status`, `ndx usage`) is always safe.

---

## 2. Where each team is

One line per team, updated by that lead. This is the standing answer to "what is everyone doing
right now" so nobody has to ask.

- **Team Nolan:** <in flight · shipped since last update · blockers>
- **Team Jarrett:** <…>
- **Team Thomas:** <…>

**Fork sync:** last `upstream/main` → `origin/main` fast-forward: _<date, by whom>_
(one person, once a day — see [`GITHUB-WORKFLOW.md`](GITHUB-WORKFLOW.md) § 3)

---

## 3. Decisions & findings since last update

Things every team needs to know — ADRs accepted, interfaces changed, measured ELM results,
direction changes. Link the ADR; don't restate it here.

- **2026-08-20 — Path B corpus built (324 LLM-labelled rows). The premise held; the bar went up.**
  Ask Jam / Nolan (Team Nolan). `scripts/data/elm-archetype-corpus.json`, commit `2e6a3e43`.
  - **`TN-J8` resolved:** the Claude CLI was already on disk (VS Code extension binary), just off
    `PATH`. **Nothing installed.** Deliberately *not* written to `.n-dx.json` — that file is
    committed and shared, and the path is machine- and extension-version-specific, so persisting it
    would break Jarrett and Thomas.
  - **Premise confirmed:** the LLM populates what rules cannot see — `service` 0 → **123**,
    `middleware` 0 → 7, `test-helper` 0 → 1. Training on LLM labels was the right call.
  - **⚠️ But the bar rose.** Majority-class baseline is now **38.0%** (was 19.6% on rule labels),
    because `service` + `utility` are **74%** of the corpus, and **9 of 13 classes have under 10
    rows**. The teacher's output is more concentrated than the rules'.
  - **⚠️ And the teacher is inconsistent where it matters.** `polling-manager.ts`, `tick-timer.ts`
    and `landing.ts` are labelled `service`; `request-dedup.ts` is `utility`. 74% of the corpus
    rests on that boundary. Filed `TN-J10`: **do we need a hand-labelled gold set before Step 3 is
    meaningful?** A three-lead call.
  - **Two operational traps worth knowing:** `--fast` gates *both* classification and phase-4 zone
    enrichment, so dropping it to get labels also buys expensive generation you don't need — stop
    after phase 3. And don't stage corpus clones in the session scratchpad; `/private/tmp` reaped
    one mid-session, leaving a directory skeleton and a silent `0 files cataloged` run.
- **2026-08-13 — Path B Step 2: the ELM case got *stronger*, but the corpus is blocked on auth.**
  Ask Jam / Nolan (Team Nolan).
  - **A second real codebase is 60.5% unclassified vs n-dx's 37.3%** (`AsterMind-Community-Edition`,
    114 source files). n-dx is the *favourable* case — the prize on users' repos is plausibly
    larger than on ours. This is the strongest evidence yet for doing the ELM at all, and it
    partly answers the pessimism in the 2026-08-11 entry below.
  - **🔴 Blocked (`TN-J8`): no LLM is reachable** — no `claude`/`codex` binary on PATH, no API
    keys. Verified by executing a completion: `ClaudeClientError reason=not-found`. The corpus must
    be LLM-labelled, so **all of Path B's ML work is blocked behind this.** Fix: install the Claude
    CLI, `ndx config llm.claude.cli_path <path>`, or export an API key.
  - **Corpus needs ecosystem diversity, not more repos (`TN-J9`).** Two repos added 473 rows and
    **zero** new classes; `middleware`, `model`, `route-module`, `service`, `test-helper` remain at
    zero. Two TypeScript libraries are worth about one for label coverage.
  - **Harness shipped** — `scripts/elm-corpus-build.mjs` (commit `8617f9f1`), seeded and
    reproducible, computes the majority-class baseline per corpus. **That baseline moves with the
    corpus** (23.0% combined vs 19.6% n-dx alone) — recompute it, never quote it from a document.
- **2026-08-11 — ⚠️ Path B Step 0 measured. The ELM case is weaker than the ADR implied, and the
  5.9% baseline we've all been quoting is wrong.** Ask Jam / Nolan (Team Nolan).
  Measured `sourcevision analyze . --fast` on n-dx itself — **zero tokens**, `--fast` skips LLM
  enrichment. 683 source files → **424 classified, 259 unclassified = 9 LLM batch calls per full
  analyze.** That is the whole prize for Path B.
  - **The baseline correction affects everyone quoting it:** classes are severely imbalanced
    (`utility` = 83/424), so the honest baseline is **19.6% majority-class, not 5.9% uniform
    random.** Beating 5.9% would prove nothing. ADR and SYNC-001 corrected in place.
  - **6 of 17 archetypes have zero training examples** (`gateway`, `middleware`, `model`,
    `route-module`, `service`, `test-helper`) — an ELM trained on rule output cannot predict them.
  - **All 259 unclassified files have zero signal evidence**, so path string is the only feature.
  - **Free win, no ML needed:** all four `*-gateway.ts` files are unclassified despite CLAUDE.md
    documenting them as the architecture's backbone. ~30 of the 259 (12%) are reachable by simple
    `archetypes.ts` rules; the other 88% are genuinely semantic.
  - Full detail + revised plan: [`IMPL-2026-08-11-jam-elm-classification-path-b.md`](IMPL/IMPL-2026-08-11-jam-elm-classification-path-b.md) § Step 0.
- **2026-08-11 — ⚠️ `grep` cannot see `packages/sourcevision/src/cli/commands/analyze-phases.ts`.**
  The file contains two raw NUL bytes (offsets 16345, 16374), used deliberately as delimiters
  inside a template literal and committed on `origin/main`. `file` reports it as `data`, so grep
  exits 1 and prints **nothing** — not an error, just silence. Any repo-wide grep any of us runs
  has a hole in it, and that file wires up the whole analyze pipeline. Use `python3`, `grep -a`,
  or `rg --text`. **Decision: leave the bytes alone** (Nolan, 2026-08-11) — this is a documented
  hazard, not a bug to fix. Found by Jam.
- **2026-08-11 — Path B implementation plan written.**
  [`IMPL-2026-08-11-jam-elm-classification-path-b.md`](IMPL/IMPL-2026-08-11-jam-elm-classification-path-b.md).
  Headline for whoever takes it: **Step 0 is to measure how many files actually reach the LLM.**
  That has never been measured, it is cheap, and a small number cancels Path B. Also: the astermind
  library ships `KernelELM` (with seeded Nyström), `OnlineELM`, `ConfidenceClassifierELM` and a
  full `Evaluation` report — don't hand-roll the benchmark harness.
- **2026-08-11 — ELM replacement survey complete; three-way split proposed.** Ask Jam (Team Nolan).
  [`ADR-2026-08-11-jam-elm-replacement-survey-and-split.md`](ADR/ADR-2026-08-11-jam-elm-replacement-survey-and-split.md),
  status **Proposed** — needs the three leads. Three things every team should know before claiming
  ELM work:
  - **Only 2 of 22 LLM call sites are ELM-replaceable.** The other 20 generate prose and stay on a
    hosted model. Candidates: sourcevision archetype classification
    (`packages/sourcevision/src/analyzers/classify.ts:404`, 17 classes) and rex granularity
    assessment (`packages/rex/src/analyze/reason.ts:1481`, 3 classes).
  - **"rex placement" is already deterministic** (`core/move.ts:91`, `core/structural.ts:125`;
    `rex/src/recommend/` has zero LLM calls) — there is no token spend there to remove.
  - **Token accounting currently reads zero** in all 6 `.hench/runs/*.json`, so the project has no
    baseline. Tracked as `TN-J3`, unclaimed. A lead, not a root-caused finding.
  - The hello-world's 66% floor is **3-class, 6 held-out samples, seed 42, 33% baseline**. The real
    classification target is 17 classes / 5.9% baseline. Do not quote the former as evidence for
    the latter.
- **2026-08-11 — notes are delivered by MERGING, not by writing. Six were sitting undelivered.**
  Found by Fluff (Team Nolan), `TN-F3`. A note exists only on the branch it was committed to: all
  six Team Nolan outbound notes were on `Nolan-Work` only — `origin/Jarrett` had one note from
  Aug 5, `origin/Thomas_Branch` had none at all. **Fixed:** `Nolan-Work` → `dev` merged and pushed
  (`d1967288`), so `dev` now carries everything.
  - **Teams Jarrett and Thomas: run `git fetch origin && git merge origin/dev` on your branch.**
    Until you do, the notes are reachable but not in your checkout.
  - **Separately: nothing at session start points an agent at `Claude-Context/`.** Root `CLAUDE.md`
    and `AGENTS.md` — the files assistants auto-load — contain zero references to it, and there are
    no hooks or CI doing it. The operating loop that says "read your inbox" lives only inside
    `claude-context-instruction`, which an agent reads only because a human told it to.
  - **Optional fix, local-only:** `Claude-Context/hooks/unread-notes.sh` prints unread notes at
    session start. **Its wiring must never be committed** — this is a public fork (9 forks, 16
    stars) and a hook in `.claude/settings.json` would execute on any cloner's machine. Wire it in
    the gitignored `.claude/settings.local.json`. See `Claude-Context/hooks/README.md`.
- **2026-08-11 — note filenames now address lead-to-lead, not agent-to-lead.** Nolan's call, applied
  by Fluff (Team Nolan). `NOTE-<from-lead>-to-<to-lead>-YYYY-MM-DD-<slug>.md` — **intern names only,
  never an agent name**; the drafting agent goes in the body on a `**Drafted by:**` line. A note
  routes to a lead who passes it to their agents, so the sender is that agent's lead too; agent
  names also go stale on retirement, and resolved notes are never deleted. Within-team notes use
  `NOTE-<lead>-internal-…`. Updated in `Command-Structure` § Communication, `claude-context-instruction`
  § 4, `OWNERSHIP.md` § Naming, and all three `Notes/README.md`. All four Team Nolan outbound notes
  renamed — **content unchanged, only filenames and title blocks** — and both other teams notified.
  Backlog `TN-F2`, no ADR (lead's directive, not a proposal).
- **2026-08-11 — the documented branch convention has never been used, and `NEW-AGENT.md` currently
  produces a broken checkout.** Ask Fluff (Team Nolan).
  [`ADR-2026-08-11-fluff-branch-and-base-conventions.md`](ADR/ADR-2026-08-11-fluff-branch-and-base-conventions.md),
  status **Proposed** — needs the three leads. What every team should know now, before the ADR is
  decided:
  - **Do not base a new agent's checkout on `main`.** `origin/main` contains no `Claude-Context/`
    (`git ls-tree --name-only origin/main | grep -i claude` → `.claude`, `CLAUDE.md` only). An agent
    onboarded per doctrine gets no charters, no backlog, and no doctrine. Use `dev` or your team
    branch until this is resolved.
  - **`origin/dev` is 10 commits ahead of `main`** and carries the agent system. This is merge lag,
    not a deliberate exclusion — merging `dev` → `main` needs a second lead's sign-off and is
    proposed in the ADR, not done.
  - **No `elm/*` branch has ever existed on any remote.** Real flow is `<TeamBranch>` → `dev` →
    `main`. Four documents say otherwise.
  - **Five of the six agents on this project run on shared checkouts**, which `Command-Structure`
    § *One agent, one worktree* calls not-optional. The ADR proposes amending the rule to match
    practice and name the mitigation. Notes sent to Teams Jarrett and Thomas.
- <date> — <what changed, who to ask>

---

## 4. Cross-team blockers & dependencies

Who is blocked on whom, and the hand-off needed.

| Blocked | Waiting on | What's needed | Note sent? | Since |
|---|---|---|---|---|
| | | | | |

> **"Note sent?" is not optional.** A blocker that was only mentioned in conversation is not a
> hand-off. The owning team reads its `Notes/` inbox; it does not read your mind.

---

## 5. Requests

Changes one team needs in another's territory. The owning team picks these up; the requester does
**not** edit directly.

| Requested | By | Owning team | What's needed | Status |
|---|---|---|---|---|
| | | | | |

---

## 6. Action items

| # | Owner | Action | By |
|---|---|---|---|
| 1 | | | |

---

## 7. Open questions for the three leads

Decisions that need all three of you — scope assignment, anything outward-facing, anything hard to
reverse. Command is collective; these are what "collective" actually means in practice.

- [ ] **Assign team scopes** — until this is done, `OWNERSHIP.md` is empty and this board is the
      only collision protection we have.
- [ ] **Worktree isolation or shared checkout?** — record the answer in `OWNERSHIP.md`.
      *(Team Nolan has chosen shared checkout for agent Jam, 2026-08-10 — still unrecorded in
      `OWNERSHIP.md`, and not a decision for the other two teams.)*
- [ ] **`GITHUB-WORKFLOW.md` does not describe the `dev` branch.** Team Nolan is working
      `Nolan-Work` → `dev` → AsterMind `main`, so that upstream's movement can be reconciled on
      `dev`. The workflow doc documents only `elm/<lead>/<topic>` → `origin/main` and mentions no
      `dev` branch anywhere. Either the doc is stale or the flow is undeclared — agents onboarding
      off `NEW-AGENT.md` will keep hitting this. Raised by Jam (Team Nolan), 2026-08-10.
      *(2026-08-11: taken up as `TN-F1` by Fluff (Team Nolan), who found it is worse than a doc gap
      — see the next item. ADR to follow; the decision is still yours.)*
- [ ] **`origin/main` contains no `Claude-Context/` directory, so `NEW-AGENT.md` cannot work as
      written.** Verified 2026-08-11: `git ls-tree --name-only origin/main | grep -i claude` returns
      only `.claude` and `CLAUDE.md`. The agent system exists on `origin/dev`, `origin/Nolan-Work`,
      and `origin/Jarrett` only. Any agent onboarded per doctrine — branch off `main` — gets a
      worktree with no charters, no backlog, and no doctrine in it. Related: **no `elm/*` branch has
      ever existed on any remote**, so the convention four documents mandate has never once been
      used. Needs a decision on which branch is the canonical base for agent work. Raised by Fluff
      (Team Nolan), 2026-08-11, tracked as `TN-F1`.
- <anything else unresolved>
