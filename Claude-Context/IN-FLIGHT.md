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
| | | | | | |

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
- **Team Thomas:** TT-N1 (text-encoded ELM classifier for sourcevision) — Phase 1 + Phase 2 code
  done, shadow-mode (`ELM_GATE_ENABLED = false`), full test suite green including root
  domain-isolation/architecture-policy e2e. Not yet a branch/PR. See `Thomas-Agents/BACKLOG.md`.

**Fork sync:** last `upstream/main` → `origin/main` fast-forward: _<date, by whom>_
(one person, once a day — see [`GITHUB-WORKFLOW.md`](GITHUB-WORKFLOW.md) § 3)

---

## 3. Decisions & findings since last update

Things every team needs to know — ADRs accepted, interfaces changed, measured ELM results,
direction changes. Link the ADR; don't restate it here.

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
- <anything else unresolved>
