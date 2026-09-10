# Agent: Baymax

- **Team:** Team Thomas
- **Lead:** Thomas
- **Backlog prefix:** `TT-B`
- **Branch:** _(none yet — no branch created for this split; see Next up)_
- **Worktree:** _(none — shared checkout, same as Nala's prior sessions on this workstream;
  `OWNERSHIP.md`'s worktree-vs-shared-checkout question is still open project-wide)_
- **Inbox:** `Claude-Context/Thomas-Agents/Notes/`

## Who I am

I'm Baymax — the name Thomas gave this instance of Claude Code for this assignment. Same
underlying continuity as "Nala" (`HEAD_ENGINEER.md`'s head-engineer role holder) — I don't carry
memory between sessions on my own, I lean on what's actually persistent: this file, git history,
the `Claude-Context/` doctrine, the code itself. This charter is scoped narrower than
`HEAD_ENGINEER.md` on purpose: that document is the whole-repo stewardship charter; this one is a
single-workstream charter, the same kind Archer/Knight/Realm/Jam/Fluff already keep for their own
assignments. What I "am" here is defined by this scope, not a personality declared up front.

## How I operate

- **Grounded over clever.** Read the file, run the command, check the ADR/IMPL/BACKLOG before
  assuming state — this exact workstream has already burned real time on agents building against
  assumptions that turned out stale (see Standing context).
- **Check for collision before building.** Three independent ELM-classifier implementations
  already exist in this repo (Archer's `TJ-A1`/`TJ-A2`, Knight's `TJ-K1`, Realm's `TJ-R1`/`TJ-R2`,
  plus my own prior `TT-N1`). A fourth independent one, built without reading what's already there,
  is the specific failure mode this project's own doctrine keeps calling out. I read before I write.
- **Careful with blast radius.** Reversible and local — just do it. Destructive, hard-to-reverse,
  or visible to other teams — check `IN-FLIGHT.md`/`OWNERSHIP.md` and flag before touching.
- **Terse by default.** Short updates while working, a full session log entry at the end.
- **Respect the structure that's already here** — tier boundaries, gateways, zone governance, and
  this repo's own multi-agent doctrine (`Claude-Context/`) are not suggestions.

## Scope

**The assignment (Thomas, 2026-09-09):** `classify.ts` (or its successor) is being split into
three files — a thin orchestrator that connects to two peer implementations: one LLM-based
(`classify_llm.ts`, functionally close to today's algorithmic+LLM `classify.ts`) and one ELM-based
(`classify_elm.ts`). Two empty placeholder files already exist on disk at
`packages/sourcevision/src/analyzers/classify_llm.ts` and `classify_elm.ts` (created today, 0
bytes — stubs, not yet real code).

**Owns:** `packages/sourcevision/src/analyzers/classify_elm.ts` — the ELM-based classify file.
Building it and keeping it working is my job end to end: model lifecycle/training, feature
representation, confidence gating, tests, and keeping it honest about what it can and can't
resolve (this repo's own doctrine: a negative/limiting result gets written up with the same rigor
as a positive one — see the zero-evidence-population precedent below).

**Does not own:**
- `classify_llm.ts` — **found mid-session (2026-09-09): claimed by a parallel, uncommitted charter,
  `Claude-Context/Thomas-Agents/AuroraUnit313.md`**, apparently another live session on this same
  assignment. Not yet confirmed with Thomas whether that's a separate concurrent agent (peer to
  coordinate with via `Notes/`, same as Team Jarrett's Archer/Knight/Realm) or the same underlying
  continuity as this file under a different session nickname. Treating it as a real peer charter
  until told otherwise — I have not edited it.
- The new orchestrator file (whatever it's named, replacing the current `classify.ts` monolith) —
  owner still not named by either charter. AuroraUnit313's charter flags the same gap.
  I don't edit either file without being told to, or without flagging first if `classify_elm.ts`
  needs something from them (an export, a shared type) that doesn't exist yet.
- `archetypes.ts` (`BUILTIN_ARCHETYPES` catalog) — actively owned by Team Jarrett (`TJ-A3`,
  Knight). I consume it, don't redesign it.
- Anything in `Claude-Context/` shared root, `package.json`/`pnpm-lock.yaml`, or other teams'
  folders — per `OWNERSHIP.md`'s shared-files list.

## Standing context

Facts this workstream has already had to learn the hard way — read this before re-deriving any of
it from scratch.

- **This is not a green field.** Team Jarrett has a real, further-along, currently-wired
  implementation of exactly this idea, already in the repo: `packages/sourcevision/src/analyzers/classify-elm.ts`
  (hyphenated — the *existing* file, distinct from the new `classify_elm.ts` stub). Backlog:
  `TJ-A2` (production hardening — model lifecycle, schema, wiring, tests, done) and `TJ-R2`
  (in-progress, soft-gated on `TJ-A3`). Full history:
  [`ADR-2026-08-11-jarrett-elm-prefilter-classify.md`](../ADR/ADR-2026-08-11-jarrett-elm-prefilter-classify.md),
  [`ADR-2026-08-31-realm-path-based-elm-classifier.md`](../ADR/ADR-2026-08-31-realm-path-based-elm-classifier.md).
  It is currently wired opt-in (`sourcevision.classification.elmPrefilter.enabled`, default
  `false`) into `runClassificationsPhase` via `sourcevision-core.ts`, **not** into `classify.ts`
  itself — Jarrett's team deliberately kept `classify.ts` untouched throughout.
- **The zero-evidence-population finding is the single most important fact for this file.**
  Verified by Archer (2026-08-27) across all 5 gathered corpora, with zero exceptions: 100% of
  files that actually reach the LLM fallback have an **all-zero** per-archetype evidence vector —
  `classifyFile`'s algorithmic pass found no signal at all for them, so a classifier fed that
  vector cannot discriminate between them regardless of confidence threshold. Every accuracy number
  measured before this finding (95.8%, 100%@59%, etc.) was measured on files that already had
  *some* signal — not the true target population. This is why the fix direction became "path text +
  export names," not the evidence vector — see `TJ-R2`.
- **My own prior work (`TT-N1`) independently reinvented a version of this**, without knowing
  Jarrett's team was doing the same thing in parallel. `ADR-2026-08-31-nala-classify-elm-rewrite.md`
  / `IMPL-2026-08-31-nala-classify-elm-rewrite.md` — text-mode ELM trained on file paths, 90.6%
  held-out accuracy on the *already-classifiable* population (explicitly not the zero-evidence
  target population — that caveat is in the IMPL). Phase 1 + Phase 2 code was written and reported
  green, but **never put on a branch or reconciled with Jarrett's team's work**, and a later merge
  from `Jarrett` overwrote my `classify-elm.ts` with theirs while leaving `classify.ts`'s import of
  my functions (`ELM_GATE_ENABLED`, `trainClassifyPathELM`, `predictWithClassifyPathELM`) in place —
  **`@n-dx/sourcevision` does not currently typecheck on `Thomas_Branch` because of this.** Verified
  today via `grep`: `classify.ts:31` imports those three names; `classify-elm.ts`'s actual exports
  are `getArchetypeELM`, `classifyWithELM`, `trainArchetypeELMNumeric`, `predictArchetypeNumeric`,
  `hasEnoughHistoryForFreshTraining`, `canUseBaselineModel`, `loadBaselineArchetypeELM`,
  `extractNumericExamples`. This is a real, reproducible break, not a hypothetical — see Next up.
- **Two calibrated library gotchas already found by other agents, worth not re-discovering:**
  `ELM`'s own `TextConfig` (`useTokenizer: true`) silently breaks word boundaries
  (`tokenize().join('')` with no separator) — confirmed still present in the installed
  `@astermind/astermind-community` v3.0.0. `scripts/elm-hello-world.mjs`'s 83%-accuracy claim is
  **not evidence the library learns from labeled examples** — its `ELM.train()` call only accepts
  `augmentationOptions`, not a training set; the working path is `UniversalEncoder` (or
  `trainFromData` in numeric mode) feeding `ELM`'s ridge-regression readout.
- **Dependency:** `@astermind/astermind-community`, pinned `^3.0.0` (only published version as of
  the last check — confirm before bumping). Added to `packages/sourcevision/package.json` only,
  not root or `llm-client` — single consumer, two-consumer rule not yet met.
- **This directory's name contains a literal `:`**, which breaks `PATH`-based bin resolution for
  every `pnpm run <script>` (`tsc`, `vitest`, etc. all fail "command not found"). Invoke tools via
  their resolved path under `node_modules/.pnpm/` instead. Flagged to Thomas repeatedly, not fixed.
- **`OWNERSHIP.md`'s scope table is still empty project-wide** — `packages/sourcevision` isn't
  formally assigned to any of the three teams, which is exactly how two teams ended up building the
  same file in parallel already. Coordinate through `IN-FLIGHT.md` until that's resolved.

## Current state

**2026-09-09 — charter created, no code written yet.** Thomas assigned this workstream mid-session
(renamed this instance "Baymax" for the conversation, then described the three-file split and
handed me ownership of `classify_elm.ts` specifically). Spent this session establishing ground
truth rather than starting to code: reread `HEAD_ENGINEER.md` and its session log, then read
Team Jarrett's full `TJ-A1`→`TJ-R2` ADR history, `OWNERSHIP.md`, `IN-FLIGHT.md`, and my own prior
`TT-N1` trail, and found the broken-import collision documented above by direct `grep`/`git log`
inspection — not assumed from the docs alone. `classify_elm.ts` itself is still the empty stub
Thomas/the IDE created; nothing has been written into it yet.

## Next up

- [ ] **Confirm with Thomas: is `AuroraUnit313` a separate concurrent session/agent, or this same
      continuity under a different nickname?** Its own charter asks the mirror-image question about
      itself. Answer changes how I coordinate on `classify_llm.ts`'s interface — as a peer via
      `Notes/`, or as work I should just read directly since it'd be "me."
- [ ] **Decide with Thomas, before writing code:** does `classify_elm.ts` adopt/extend Jarrett's
      existing `classify-elm.ts` (further along, already solving the zero-evidence problem via
      `TJ-R2`'s path+export representation) rather than starting a fourth independent
      implementation? Given the standing context above, building fresh without this conversation
      would repeat the exact mistake `TT-N1` already made once.
- [ ] Fix or flag for removal: `classify.ts:31`'s dangling import (`ELM_GATE_ENABLED`,
      `trainClassifyPathELM`, `predictWithClassifyPathELM`) — sourcevision doesn't typecheck as-is.
      Whether this is fixed here or by whoever owns the new orchestrator file depends on how the
      three-file split actually lands; flagging now either way since it blocks any build/test run
      on this branch.
- [ ] Get the actual scope/owner of the orchestrator file and `classify_llm.ts` confirmed with
      Thomas — currently unassigned in this charter.
- [ ] Send a note to Team Jarrett's inbox (`Claude-Context/Jarrett-Agents/Notes/`) flagging this
      new `classify_elm.ts` assignment before writing code that competes with `TJ-R2`, per this
      project's own "note sent is not optional" doctrine (`IN-FLIGHT.md` § 4).
- [ ] Once direction is confirmed: claim `TT-B1` in `Claude-Context/Thomas-Agents/BACKLOG.md`
      (done this session — see below) and update it as work proceeds.

## Session log

### 2026-09-09 — charter created; found the classify.ts/classify-elm.ts import break

**Did:**
- Reread `HEAD_ENGINEER.md` in full (mandate, responsibilities, full session log through
  2026-08-31) per standing instruction, since this session opened as a continuation of that
  context before Thomas narrowed the assignment.
- Read the full `Claude-Context/` picture for this workstream: `OWNERSHIP.md`, `IN-FLIGHT.md`,
  `ADR-2026-08-11-jarrett-elm-prefilter-classify.md` (the long one — TJ-A1 through the
  zero-evidence-population finding), `ADR-2026-08-24-jarrett-archetype-taxonomy-redesign.md`,
  Team Thomas's and Team Jarrett's `BACKLOG.md`, and `Jarrett-Agents/Archer.md`'s session log for
  working-style calibration.
- Inspected the actual files on disk: confirmed `classify_llm.ts` and `classify_elm.ts` are new,
  empty (0-byte) stubs; confirmed the *existing* `classify-elm.ts` (hyphenated) is Team Jarrett's
  TJ-A2 production file by `git log` (last commit `78f295ae`, Archer's test-coverage commit), not
  mine.
- **Found a real, present bug, not a hypothetical one:** `packages/sourcevision/src/analyzers/classify.ts:31`
  imports `ELM_GATE_ENABLED`, `trainClassifyPathELM`, `predictWithClassifyPathELM` from
  `./classify-elm.js` — none of which the current `classify-elm.ts` exports. Traced the cause via
  `git log`: commit `107cd344` ("09/04/26 Changes," my own prior `TT-N1` work) created a small
  `classify-elm.ts` with those three exports and wired the import into `classify.ts`. A later merge
  from the `Jarrett` branch replaced `classify-elm.ts` with the team's much larger TJ-A2 file
  (different exports entirely) but left `classify.ts`'s import untouched — `@n-dx/sourcevision`
  does not currently typecheck on `Thomas_Branch` as a result. Did not fix it yet — flagged in Next
  up, since the right fix depends on the still-open orchestrator/`classify_llm.ts` ownership
  question.
- Wrote this charter (`Claude-Context/Thomas-Agents/Baymax.md`), registering as a new Team Thomas
  agent per `CHARTER-TEMPLATE.md`'s convention, scoped specifically to `classify_elm.ts`.

**Learned:** see Standing context above — the zero-evidence-population finding, the `TextConfig`
tokenizer bug, and the directory-colon `PATH` issue are all load-bearing facts for this file
specifically, not just repo trivia.

**Broke / still broken:** `classify.ts`'s import of `classify-elm.ts` (see above) — pre-existing,
found not caused this session, still broken as of this entry.

**Left undone and why:** no code written into `classify_elm.ts` yet — the collision with Team
Jarrett's parallel, further-along implementation of the same idea needs a decision from Thomas
first (adopt/extend theirs vs. build independently), not a unilateral choice given this exact
"two agents built the same thing without knowing it" mistake already happened once on `TT-N1`.

**Notes sent / received:** none yet this session — sending a heads-up to Team Jarrett's inbox is
in Next up, not yet done.

**Handoff:** next session should get Thomas's answer on the adopt-vs-build-fresh question before
writing any `classify_elm.ts` code, and either fix the `classify.ts` import break or confirm who
owns that fix.

---
