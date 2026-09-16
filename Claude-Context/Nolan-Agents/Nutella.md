# Agent: Nutella

- **Team:** Team Nolan
- **Lead:** Nolan
- **Backlog prefix:** `TN-N`
- **Branch:** `Nolan-Work` (shared checkout — see Worktree)
- **Worktree:** _(none — shared checkout `/Users/nolanmoore/Work/n-dx-1`, lead's decision 2026-09-16)_
- **Inbox:** `Claude-Context/Nolan-Agents/Notes/`

## Scope

**Lead database builder.** Team Nolan's assigned scope is the **training database for the ELM** —
the green box of the lead's architecture diagram (2026-09-16): take public repos, label every
source file with the 17-archetype catalog using the n-dash (`sourcevision`) classify pass, and
produce a corpus another team can train on.

**End goal:** hand the other two leads a **GitHub repo or comparably light database** that an ELM
can be trained from. The deliverable is *data plus the document that makes it safe to use*, not a
model.

**Owns:**
- `scripts/data/elm-archetype-corpus*.json` and any successor corpus artifact
- `scripts/elm-corpus-build.mjs` — the builder, including its provenance recording
- `Claude-Context/Nolan-Agents/ELM-CORPUS.md` — the corpus's documentation, inherited from K2
- Corpus acquisition: staging repos, running the LLM classify pass, harvesting rows, the seeded
  split, class coverage, teacher provenance
- The staging tree `/Users/nolanmoore/Work/n-dx-elm-corpus/` (13 repos, **not version-controlled**)

**Does not own:**
- **The model, the tier, and everything right of the green box.** ELM training, the confidence
  gate, the LLM-fallback loop and the retrain arrow on the diagram are *examples of the consumer*,
  not my work, and explicitly **must not shape the training data**. Modelling is Jam's line
  (`TN-J*`).
- `packages/sourcevision/src/analyzers/**` — Jam's, and by `ADR-2026-09-04-syrup-…` also Team
  Jarrett's territory (`TJ-A1`/`TJ-A2`/`TJ-R2`).
- `packages/llm-client/**` — Butter's.
- `Claude-Context/` root doctrine docs (`OWNERSHIP.md`, `Command-Structure`,
  `claude-context-instruction`, `GITHUB-WORKFLOW.md`, `NEW-AGENT.md`) — Fluff's, and on the shared
  "nobody edits unilaterally" list.
- Gold set #2 (`scripts/data/k2-goldset2-packet.csv`, 250 files from hono + trpc). **Blind and
  unlabelled. Never train on it, never sample it into a corpus.**

## Standing context

Facts I should not have to re-derive. Every one verified at source on 2026-09-16 unless marked.

### The corpus as it actually stands

- **Current artifact: `scripts/data/elm-archetype-corpus-v2.json`** — verified by reading the JSON,
  not the docs: **624 rows** (train 464 / heldOut 160), **16 classes**, seed 42, holdout 0.25,
  stratified, `generatedAt 2026-09-01T16:57:25Z`. Majority baseline **38.3% (`utility`)**.
- **Rows per repo** (counted from the artifact): `n-dx-1` 255 · Vue `core` 212 · AsterMind-CE 69 ·
  fastify 48 · express 17 · commerce 15 · got 8. **7 ecosystems.**
- **v1 (`elm-archetype-corpus.json`, 324 rows) is kept, not deleted** — Phase 1/2 results are only
  reproducible against it.
- **The split is reproducible byte-for-byte. Do not re-split.** Re-splitting makes every number in
  `ELM-FINDINGS.txt` incomparable.

### The two numbers that bound this whole problem

- **LLM teacher vs human truth: 72.3%.** The labels are ~28% wrong. A CV score against this corpus
  measures **agreement with the teacher**, not accuracy. Never quote one as the other.
- **Human path-only ceiling: 85.4%.** The ceiling on *any* path-only classifier.
- **`utility` is the teacher's sink for uncertainty** — directional bias, not noise. A student
  cannot average it out.

### The failure this database exists to fix

Corpus v1 trained a model that **passed on the repos it was trained on and collapsed on fresh
ones**: coverage 34.9% → 13.2%, `service`/`utility` predicted for 96.4% of files against the
teacher's 48.4%, 5 of 13 labels emitted. **It learned n-dx's archetype prior, not a path→archetype
mapping.** Held-out CV cannot reveal this, because held-out rows come from the training repos.
**Ecosystem diversity is the lever; row count is not** (`TN-J9`, filed 2026-08-13, confirmed
2026-09-01 by `TN-J32`).

> **v2 is the attempted fix and it is UNVALIDATED.** Nobody has run the coverage re-check against
> it. `node scripts/elm-coverage-check.mjs --frozen=scripts/data/elm-frozen-model-v2.json` costs no
> labels and no LLM calls. Do not claim v2 generalises because it is bigger.

### Class coverage gaps — my direct remit

- The catalog is **17 archetypes** (`packages/sourcevision/src/analyzers/archetypes.ts`, 17 ids
  verified). The corpus covers **16**.
- **`page` has ZERO rows** — the corpus cannot teach a class it has never seen.
- **Eight classes are under 10 rows**: `middleware` 8, `cli-command` 6, `gateway` 6, `store` 3,
  `schema` 2, `model` 2, `route-module` 2, `hook` 1.

### Free and near-free expansion already paid for

- **105 rows are sitting unused.** Gold set #2 LLM-labelled 355 candidates; only 250 were sampled
  into the blind packet. The other 105 are already paid for and can extend the corpus while the
  250 stay clean. Cheapest expansion available.
- **Five repos are staged and unharvested**: `nest`, `payload`, `remix` cloned but never analyzed;
  `svelte` (388 files) and `typeorm` (563 files) analyzed **rules-only — 0 LLM rows**, because a
  `--fast` run spends nothing and yields nothing usable here. These are exactly the ecosystems
  `TN-J9` asked for.

### Corrections I verified on 2026-09-16 — do not quote the old versions

1. **The corpus-v2 re-freeze is DONE, not running.** `IN-FLIGHT.md` § 2 still says
   *"the corpus-v2 re-freeze is RUNNING (`pid 25842`)"*. `ps -p 25842` returns nothing and
   `scripts/data/elm-frozen-model-v2.json` exists (12,933 bytes, mtime 2026-09-04 11:58) — which is
   that job's own stated success test. Syrup's ADR recorded the completion; the board was never
   updated.
2. **`elm-corpus-build.mjs` DOES record the resolved teacher model.** `ELM-CORPUS.md` § 4 says it
   does not. The resolution logic is at `scripts/elm-corpus-build.mjs:120-144` with a mixed-teacher
   rollup at `:214-273`, added in commit **`b4fde7b2`** — *the same commit that wrote the sentence
   saying it was missing.* The **artifact** lacks the field because v2 was built 2026-09-01, before
   that commit. So `TN-J31`'s script-side fix has already landed; **a rebuild populates it.**
   Confirmed: all 7 provenance entries in v2 have no `teacher` key, and no `teacherMix`.
3. **The corpus is labelled by TWO teachers and the artifact does not say so.** 255 rows (40.9%)
   `claude-sonnet-4-6` (n-dx pins it in `.n-dx.json`); 369 rows (59.1%) `claude-sonnet-5`. That
   table in `ELM-CORPUS.md` § 4 is **recovered, not recorded** — treat it as such until a rebuild.

### Operational traps that have each cost real time

- **`--fast` spends nothing and yields nothing.** It gates the classify pass. A rules-only analyze
  looks like a successful run and produces zero usable rows — this is what happened to svelte and
  typeorm.
- **`analyze` writes `.sourcevision/` into the TARGET repo**, which no git worktree isolates.
- **Never stage target repos in the session scratchpad.** `/private/tmp` was reaped mid-session
  once, leaving a husk and a silent `0 files cataloged` run that looked exactly like a regression.
  Stage under a real home directory.
- **Pin the teacher per repo before analyzing**: `<repo>/.n-dx.json` →
  `{ "llm": { "claude": { "model": "claude-sonnet-5" } } }`. Unpinned silently takes
  `NEWEST_MODELS.claude`.
- **`grep` cannot see `packages/sourcevision/src/cli/commands/analyze-phases.ts`** — two raw NUL
  bytes make `file` call it binary, so grep exits 1 and prints **nothing**. Not an error, silence.
  Use `grep -a`, `rg --text`, or `python3`. Offsets are branch-dependent (16345/16374 on
  `Nolan-Work`/`dev`/`main`; 18588/18617 on `Jarrett`). **Leave the bytes alone** — lead's decision.
- **`pnpm test` never reaches `tests/e2e/`** — it aborts on rex's flaky 200-item perf test. Use
  `npx vitest run tests/` at the root.
- **Shared checkout: HEAD moves under you.** It moved four times mid-session on K2. Re-check
  `git log` before assuming state; claim in `IN-FLIGHT.md`.

### ELM library gotchas (from `scripts/elm-hello-world.mjs`)

- `charSet` is interpolated **unescaped** into a RegExp character class — a literal `-` must come
  **last** or it forms an invalid range and throws.
- Text training requires `useTokenizer: true`, or `train()` throws.
- `charToOneHot` **lowercases before lookup** (`astermind.umd.js:762`), so uppercase `charSet`
  entries are unreachable and merely widen the input vector — Butter's 08-27 "fix" added 2,080 dead
  dimensions (`TN-B7`).
- npm latest is `3.0.0`; the repo pins `^3.0.0` at **root `package.json:61` only** — no workspace
  package declares it. **v4 is tagged on GitHub but unpublished and breaking. Do not chase v4.**

### Seams and hazards outside my lane

- **The ELM is a registered vendor, not a fork** — `ProviderRegistry.register(vendor, factory)` at
  `packages/llm-client/src/provider-registry.ts:96` is the extension seam. Not my file; recorded so
  I never reach for it.
- **`.rex/`, `.sourcevision/`, `.hench/` have no file locking.** Concurrent writers lose data with
  **no error** — last writer silently wins. I am on the shared checkout with other agents, so every
  `ndx plan|work|ci|refresh|self-heal` and every rex MCP write gets an `IN-FLIGHT.md` claim first.
- **Adding a workspace dependency or touching `pnpm-lock.yaml` needs a second lead's sign-off.**
  So does anything reaching `upstream` or merging to `origin/main`.
- **Team scopes are still recorded as `(unassigned)`** in `OWNERSHIP.md` and `Command-Structure`
  despite the leads' 2026-09-16 decision. Those are shared/Fluff-owned files — flagged, not edited
  by me.

## Current state

Onboarded 2026-09-16. Charter, roster row, backlog rows and claim board entry created; the
within-team note announcing Team Nolan's database scope is written and committed. I have read the
inherited corpus material end to end (`ELM-CORPUS.md`, `K2-HANDBOOK.md`,
`ADR-2026-09-04-syrup-merge-elm-corpus-into-jarrett-harness.md`) and verified the corpus artifact,
the staging tree and the archetype catalog against disk rather than against the documents — which
turned up three stale statements, recorded above. **No corpus work has been done yet and no LLM
calls have been spent by me.**

## Next up

- [ ] `TN-N1` — announce the scope + database mission to the team (first task, in progress)
- [ ] `TN-N2` — the standing mission: a shareable, light training database for the other leads
- [ ] Run the coverage re-check on v2 before offering v2 to anyone. Free, no labels, no LLM spend.
      It is `ADR-2026-09-04-syrup-…` Step 0 and it is still unrun.
- [ ] Harvest the **105 free gold-set-#2 rows** — already paid for, contamination boundary intact.
- [ ] Decide the shape of the deliverable with the lead: separate GitHub repo vs. in-tree JSON.
- [ ] Rebuild provenance so the teacher model is recorded per repo (closes `TN-J31`; the script
      side is already done at `b4fde7b2`).
- [ ] Per the lead's diagram: consider narrowing to **one repo first, scale later.**

## Session log

Newest at the top. **Do not edit past entries** — append corrections as a new entry.

---

### 2026-09-16 — Onboarding; Team Nolan's scope is the training database

**Did:**
- Read the full Step 1 list from `NEW-AGENT.md`: `claude-context-instruction`, `Command-Structure`,
  `GITHUB-WORKFLOW.md`, `OWNERSHIP.md`, `IN-FLIGHT.md`, root `CLAUDE.md`,
  `scripts/elm-hello-world.mjs`. Then the corpus material: `ELM-CORPUS.md`, `K2-HANDBOOK.md`,
  `ADR-2026-09-04-syrup-merge-elm-corpus-into-jarrett-harness.md`.
- Verified the corpus against disk instead of against its documentation: row counts, class
  distribution, per-repo counts, provenance block, the 17-archetype catalog, the staging tree.
- Created this charter, the roster row, `TN-N1`/`TN-N2`, and the `IN-FLIGHT.md` claim.
- Wrote `NOTE-nolan-internal-2026-09-16-nutella-scope-and-database-mission.md`.

**Learned:** (always with seed + baseline where it is a number)
- Corpus v2: **624 rows / 16 classes / 7 ecosystems, seed 42, holdout 0.25, majority baseline
  38.3% `utility`** — read from the artifact, not quoted from a doc.
- **`page` has zero rows.** 16 of the 17 catalog archetypes are represented; 8 more are under 10
  rows, one (`hook`) at a single row.
- **Three stale statements found and corrected in Standing context above** — the "running" freeze
  job (finished 2026-09-04), the "builder does not record the teacher" claim (it does, as of
  `b4fde7b2`), and the recovered-not-recorded teacher table.
- The published numbers I am inheriting are **agreement with a 72.3%-correct teacher**, not
  accuracy. The corpus's central property — that it generalises — is **untested for v2**.

**Broke / still broken:**
- Nothing run, nothing broken. **I have executed no training, no analyze, and no LLM calls.**
- Still broken and not mine: `OWNERSHIP.md` and `Command-Structure` both still say every team's
  scope is `(unassigned)` after the leads' decision. Flagged to the lead; those are shared files.

**Left undone and why:**
- **The v2 coverage re-check was not run.** It is free and it is the first thing that should
  happen, but it is `TN-J32`/Jam's claim on the board and my first task was the note. Raised in the
  note rather than silently taking it.
- **No cross-team note sent.** Announcing the scope split to Jarrett and Thomas is a lead-to-lead
  action; per Team Nolan's convention an agent drafts and Nolan sends. Flagged, not done.

**Notes sent / received:**
- Sent: `Claude-Context/Nolan-Agents/Notes/NOTE-nolan-internal-2026-09-16-nutella-scope-and-database-mission.md`
  (within-team inbox — Jam, Butter, Fluff, Syrup).
- Received: read the full inbox. The operative one is
  `NOTE-nolan-internal-2026-09-04-k2-handover-to-jam.md`.

**Handoff:**
- Next session: run `node scripts/elm-coverage-check.mjs --frozen=scripts/data/elm-frozen-model-v2.json`
  **if the lead reassigns it from Jam**, since it gates whether v2 can be offered to anyone. Then
  harvest the 105 free gold-set-#2 rows. Then settle the deliverable's shape with the lead.

---
