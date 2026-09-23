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
| 2026-08-12 | Archer | Jarrett | Adding `@astermind/astermind-community` dependency for TJ-A1 (ELM pre-filter prototype) | `packages/sourcevision/package.json`, root `pnpm-lock.yaml` | On IMPL Step 4 completion (eval script working) or sooner if the gate fails and the dep is reverted |
| 2026-09-17 | Elon | Jarrett | `TJ-E1` — the ELM classifier body behind `runELMGate()`. Reads full file content, which nothing at this call site does today. **Supersedes `TJ-R2`** (Archer). Does **not** touch the gate's routing, `classify-LLM.ts`, or the archetype catalog (`TJ-A3`, Knight) | Writes `packages/sourcevision/src/analyzers/classify-elm.ts` + its tests, and a new seeded eval script under `packages/sourcevision/scripts/`. Working in worktree `../n-dx-elon` on `elm/jarrett/classify-elm-content`, so `ndx analyze` runs are isolated — **no state-writing-command claim needed**. No dependency additions planned (`@astermind/astermind-community` is already present). **No shared files.** | On a representation that clears its gate against the genuinely zero-evidence population, with a committed seeded eval |

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
- **Team Jarrett:** **correction, 2026-09-07 — the "no classify.ts edits landed yet" line below is
  stale and was wrong as of the `dev` merge.** `classify.ts` *is* touched now, by Team Thomas's
  `TT-N1` (see that team's line and § 3's 2026-09-07 entry). Status as of 2026-08-24, otherwise
  still accurate:
  - `TJ-A2` (Archer, Knight supporting) — production-wiring the ELM pre-filter engine. Numeric
    feature representation cleared the gate, independently confirmed by Knight and Realm's
    from-scratch reproduction. In progress on `elm/jarrett/classify-elm-prefilter` /
    `../n-dx-jarrett`. Shipped opt-in (disabled by default) — real smoke-testing found a
    zero-evidence-population gap in the shipped representation, see `TJ-R2` below.
  - `TJ-A3` (Knight, reassigned from Archer 2026-08-27/claimed 2026-09-03) — extending/tightening
    `BUILTIN_ARCHETYPES` itself (the archetype *catalog*, orthogonal to which engine classifies
    against it), plus LLM-reasoning-mining to shrink the zero-evidence population deterministically.
    New worktree/branch (`../n-dx-jarrett-taxonomy`, `elm/jarrett/archetype-taxonomy-redesign`),
    deliberately separate from `TJ-A2`.
  - `TJ-R1` (Realm) — ELM-as-primary-classifier decision, verified by independently reproducing
    both `TJ-A1`'s and `TJ-K1`'s real committed code. Its threshold-default finding is provisional
    pending re-verification once `TJ-A3`'s catalog changes land.
  - `TJ-R2` (Archer) — fixed `TJ-A2`'s zero-evidence gap with a path+export text representation.
    **SUPERSEDED 2026-09-17 by `TJ-E1`** (user's direction). Its Step 4 encoder work is absorbed,
    not discarded. Its soft-blocks are moot — `TT-N1` is no longer in the tree.
  - `TJ-E1` (Elon, new 2026-09-17) — **the ELM classifier body itself**, filling the empty
    representation slot behind `runELMGate()` that `TJ-R3`'s split left. ELM-only, no LLM
    knowledge inside it. Reads **full file content**, which nothing at this call site has ever
    done. Worktree `../n-dx-elon`, branch `elm/jarrett/classify-elm-content`. **Why this is the
    live item:** `runELMGate` today resolves **zero files by construction** —
    `classify-elm.ts:350`'s all-zero-vector guard skips 100% of the population that reaches it.
    The architecture is built and inert; this fills it.
  - `TJ-R3` (shipped 2026-09-07) — gate split done, see § 4.
- **Team Thomas:** `TT-N1` (Nala) — text-encoded ELM classifier, originally wired directly into
  `classify.ts`'s `enrichClassificationsWithLLM`. **Correction, 2026-09-17 (Elon): the line that
  stood here — "this is live code on the `Jarrett` branch now" — is no longer true.** `TJ-R3`'s
  gate split (`7ecf69f3`, 2026-09-07) **removed it**. What the `dev` merge actually left on
  `Jarrett` was `classify.ts` importing `ELM_GATE_ENABLED`/`trainClassifyPathELM`/
  `predictWithClassifyPathELM` from `classify-elm.js`, which never exported them — a broken build
  (3× TS2305). Nala's actual implementation body was not on this branch. `TT-N1`'s own findings
  stand and are still worth reading (90.6% k-fold on n-dx's own data — **not** checked
  out-of-domain; plus the real `ELM.train()` gotcha). The `TT-N1`/`TJ-R2` collision is **moot**:
  `TJ-R2` is superseded by `TJ-E1` and `TT-N1` is not in the tree. **Team Thomas has not been told
  any of this** — see § 6.

**Fork sync:** last `upstream/main` → `origin/main` fast-forward: _<date, by whom>_
(one person, once a day — see [`GITHUB-WORKFLOW.md`](GITHUB-WORKFLOW.md) § 3)

---

## 3. Decisions & findings since last update

Things every team needs to know — ADRs accepted, interfaces changed, measured ELM results,
direction changes. Link the ADR; don't restate it here.

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
- 2026-08-31 — Team Thomas: new ADR/IMPL for a text-encoded ELM classifier in sourcevision's
  `classify.ts`, replacing an earlier (unmerged, different-branch) evidence-vector design that
  measured zero signal on real unclassified files. Adds `@astermind/astermind-community` to
  `packages/sourcevision/package.json` only (not root). See
  `Claude-Context/ADR/ADR-2026-08-31-nala-classify-elm-rewrite.md`. Ask Nala (Team Thomas) with
  questions.
- 2026-08-31 — Team Thomas: **`scripts/elm-hello-world.mjs` (and the root `elm:hello` script) don't
  test what their names claim.** `ELM.train()`'s only parameter is `augmentationOptions`, not a
  training set — passed `elm-hello-world.mjs`'s `TRAINING_SET` array, every property it reads is
  `undefined`, so the model trains only on character-augmented variants of the category label
  strings, never on the example paths the script provides. Confirmed empirically (three models —
  real/contradictory/no training data — produced byte-identical weights and predictions). The
  script's 83%-accuracy claim isn't evidence the library learns from labeled examples; don't cite
  it as such. The API that does work — `UniversalEncoder` → `ELM.trainFromData(X, y)` — is used
  correctly in the new `scripts/classify-elm-eval.mjs` (90.6% on real n-dx path/archetype data).
  Full write-up: `scripts/classify-elm-eval-results.md` and the ADR above. Not fixed in
  `elm-hello-world.mjs` itself — not this team's file; flagged as an open question in the IMPL for
  whoever owns it.
- **2026-09-07 — `classify.ts` collision discovered: Team Thomas's `TT-N1` and Team Jarrett's
  `TJ-R2` are the same fix, built independently, and `TT-N1` is already merged.** Both teams
  separately found that the original evidence-vector ELM representation produces zero signal on
  the real unclassified population (empty evidence arrays), and both independently chose to encode
  path text instead — on the same day (2026-08-31), with no visibility into each other's work.
  `TT-N1` reached `dev` and merged into `Jarrett` (`107cd344`) before either team noticed the
  overlap; this also means `classify.ts` is no longer untouched, overriding Team Jarrett's standing
  design choice by merge order rather than decision. Ask Realm (drafted, Team Jarrett) or Nala
  (Team Thomas). Notes sent both directions:
  `Jarrett-Agents/Notes/NOTE-jarrett-internal-2026-09-07-classify-elm-collision.md`,
  `Thomas-Agents/Notes/NOTE-jarrett-to-thomas-2026-09-07-classify-elm-collision.md`. **Root cause,
  worth fixing regardless of how this specific collision resolves:** each team's `IN-FLIGHT.md`
  update was only visible on their own branch — nobody sees it until someone fetches and diffs the
  other branch directly, which nobody had done since 2026-08-24. This board can go stale exactly
  when it matters most (long-lived diverged branches) unless someone does that check.
- **2026-09-17 — the boards were stale again, this time on the same branch, for 10 days.** Found by
  Elon (Team Jarrett) while onboarding, by reading the code before trusting the docs. Three
  statements were wrong: `BACKLOG.md` and § 4 here both called `TJ-R3` blocked on Thomas's sign-off
  when it had **shipped** on 2026-09-07 (`7ecf69f3`), and § 2 called `TT-N1` "live code on the
  `Jarrett` branch" when that same commit had **removed** it. All three corrected in this update.
  **The lesson is narrower and worse than 2026-09-07's.** That one was blamed on cross-branch
  invisibility — a real cause, and this isn't it: `7ecf69f3` landed on `Jarrett`, the boards live
  on `Jarrett`, and the commit message itself said which doc updates it was deferring. Nobody
  reconciled them. **A board is only as good as the habit of closing rows when work lands**, and
  "the code shipped but the row still says blocked" is the failure mode that makes a board
  actively misleading rather than merely incomplete — a new agent planning off these rows would
  have built against an architecture that already existed. Ask Elon (Team Jarrett).
- **2026-09-17 — the ELM slot is built and empty; `runELMGate` resolves zero files by
  construction.** `TJ-R3`'s split created the right seam, but what sits behind it is still
  `TJ-A2`'s evidence-vector representation, and `classify-elm.ts:350` unconditionally skips
  all-zero vectors — which is **100% of the population reaching that stage** (measured across 5
  corpora, 2026-08-27). The guard is correct; the representation is the gap. Now `TJ-E1` (Elon),
  which supersedes `TJ-R2` and adds file content as a signal for the first time. **Relevant to
  every team:** no accuracy number anywhere in this project — 100%@59.0%, 97.0%@42.3%, Nala's
  90.6% k-fold — was measured on the genuinely zero-signal population. Don't cite them for this
  call site.

---

## 4. Cross-team blockers & dependencies

Who is blocked on whom, and the hand-off needed.

| Blocked | Waiting on | What's needed | Note sent? | Since |
|---|---|---|---|---|
| ~~`TJ-R2` (Team Jarrett, Archer)~~ | — | **RESOLVED/MOOT 2026-09-17.** `TJ-R2` is superseded by `TJ-E1` (Elon), and the thing it was blocked on no longer exists: `TT-N1` was removed from `classify.ts` by `TJ-R3`. Nothing is waiting on Team Thomas here anymore | — | Closed 2026-09-17 |
| ~~`TJ-R3` (Team Jarrett, Realm)~~ | — | **RESOLVED 2026-09-17 — this row was wrong for 10 days.** `TJ-R3` shipped 2026-09-07 (`7ecf69f3`, merged `ae381889`); it was never blocked in practice. Proceeding without Thomas's sign-off was an explicit user override, recorded in the commit message rather than as a lead decision. **Team Thomas should know this happened** — the split removed `TT-N1`'s inline gate from `classify.ts` (it was a broken build: 3× TS2305 after the `dev` merge) | Original proposal note sent; **the override itself has not been noted to Thomas** — open item below | Closed 2026-09-17 |

> **"Note sent?" is not optional.** A blocker that was only mentioned in conversation is not a
> hand-off. The owning team reads its `Notes/` inbox; it does not read your mind.

---

## 5. Requests

Changes one team needs in another's territory. The owning team picks these up; the requester does
**not** edit directly.

| Requested | By | Owning team | What's needed | Status |
|---|---|---|---|---|
| Sign off on `classify.ts` gate-split proposal (`TJ-R3`) — reorganizes `classify.ts`, which owns `TT-N1` | Team Jarrett (Realm) | Team Thomas | Yes/no/counter-proposal on `ADR-2026-09-07-realm-classify-gate-split.md`; Team Thomas doesn't need to pick an implementation, just the file shape | Pending — 2026-09-07 |

---

## 6. Action items

| # | Owner | Action | By |
|---|---|---|---|
| 1 | Jarrett (lead) | **Tell Team Thomas that `TT-N1` was removed from `classify.ts`.** `TJ-R3` shipped on a user override of the stated Thomas-sign-off gate, and the split deleted Nala's inline gate (it was a broken build after the `dev` merge). Nobody has told them. Raised by Elon 2026-09-17 while onboarding; **not sent by Elon** — this is a lead-to-lead call about a decision made above the agent level, not an agent's note to write | Before Team Thomas does further `classify.ts` work |
| 2 | Realm | `IMPL-2026-09-07-realm-classify-gate-split.md` **step 10 is still open** — update `TT-N1`/`TJ-R2` ADR statuses and close the two 2026-09-07 collision notes. Explicitly deferred by `7ecf69f3` rather than decided unilaterally | Open |

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
