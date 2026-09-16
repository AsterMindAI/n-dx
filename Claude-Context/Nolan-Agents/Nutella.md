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

### ⚠️ The 105 gold-set-#2 rows are NOT free — I had this wrong

**Corrected 2026-09-16 after Jam's handover note; verified myself from the artifacts.** My
onboarding note and this charter both called them "the cheapest expansion available." **They are
the most expensive rows in the project**, and the price is not written on them.

`k2-goldset2-llm-labels.json` records `poolSize: 355`, `sampled: 250`, `seed: 20260901`,
`totalClassifyCalls: 12`, and its provenance lists **exactly two repos: hono and trpc.** So the 105
remainder are *files from those same two repos*. Harvesting them leaves the packet's 250 human-blind
— that part I had right — but it puts **hono and trpc paths into the training vocabulary**, and
those two repos are the **only fresh ecosystems we have ever measured generalisation against.**

After that harvest, a coverage check on gold set #2 is no longer a fresh-ecosystem test; it is a
held-out test on a trained-on ecosystem — **precisely the instrument that failed to detect v1's
collapse.**

**Why the existing guard would not catch it:** `elm-goldset2-packet.mjs` asserts 0 of 355 candidates
appear in corpus #1 and refuses to build otherwise — but that assertion is **path-level**, and it
would *pass* on this harvest, since the 105 and the 250 are different files. **The contamination is
at the ecosystem level**, which is the level v1 died at.

**Decision: do not harvest the 105 until replacement probes exist.** Stage and analyze two
genuinely new repos first, then spend the 105 knowing what it buys. 105 rows against 624 is ~17%;
the only generalisation detector we own is worth more.
- **Five repos are staged and unharvested**: `nest`, `payload`, `remix` cloned but never analyzed;
  `svelte` (388 files) and `typeorm` (563 files) analyzed **rules-only — 0 LLM rows**, because a
  `--fast` run spends nothing and yields nothing usable here. These are exactly the ecosystems
  `TN-J9` asked for, and Jam confirms the fit: **`nest` is modules/controllers/services
  (`middleware`, `service`, `model`), `remix` is the only ecosystem that will ever produce
  `route-module`, `payload` is collection/model shaped. `model` and `route-module` have zero files
  in n-dx in either label source** — unreachable from this repo at any price. **This is the
  harvest, and it is also the source of the replacement probes the 105 rows need.**
- **Budget, from Jam's § 9:** calls are `ceil(eligible / 30)`. ~15 repos at ~300 source files each,
  residue-only at roughly a third, is **~150 calls ≈ $12–30 and an afternoon**; labelling *every*
  source file is ~3× that. **Money is not the constraint — time and `.sourcevision/` collisions
  are.**

### ⚠️ The builder harvests the RESIDUE, not the repo — this reframes the whole mission

**From Jam's handover, verified by me 2026-09-16.** The mission as stated is *"label every file with
the 17 archetypes."* **That is not what `elm-corpus-build.mjs` currently does.** It harvests
`source: "llm"` rows, and that population is **the residue left after the rules have run**. A file
the rules classify confidently never reaches the teacher, never gets an LLM label, and never enters
the corpus. `elm-corpus-build.mjs:24-33` documents the trade honestly — it is a deliberate choice —
but its effect on *class coverage* was never written down.

**This is why `page` has zero rows, and why fifteen more repos will not fix it.** n-dx has **37
`page` files, all caught by rules, zero reaching the teacher.** Independently confirmed by the
sanity corpus, which holds exactly 37 `page` rows (§ below). Same mechanism for `component` (71
rule-labelled, 0 LLM), `store`, `hook`, `schema`. **293 n-dx files sit in the thin classes, every
one rule-labelled, none in the corpus** — and every LLM-labelled n-dx file is *already* harvested,
so there is nothing left to pick up cheaply.

Three ways out, and choosing between them is a **lead's decision**, not mine alone:
1. **`--source=algorithmic`** — already supported, free, artifact already exists. But a model trained
   on regex labels learns the regex.
2. **Label everything with the teacher** — bypass the unclassified filter at `classify.ts:337-339`.
   That file is Jam's *and* Team Jarrett's territory, so it is a note, not an edit. **I do not need
   to touch it:** Butter already replicated `buildLLMClassifyPrompt` verbatim at
   `scripts/elm-token-baseline.mjs:112` because the function is module-private. A standalone
   labelling harness is a fork of that script. ⚠️ Cost scales with *all* files, ~3×.
3. **Accept residue-only and say so in `ELM-CORPUS.md`** — defensible, but it must be stated, because
   a consumer who trains on this expecting a whole-repo classifier gets v1's failure and blames the
   model.

Measured on n-dx only. That it holds elsewhere is inference from how the rules work.

### There is a THIRD corpus artifact — the inverse population

**`scripts/data/elm-archetype-corpus-sanity.json`** — committed 2026-08-13, unused since. **Read and
verified by me:** **473 rows, 12 classes, `sources: ["algorithmic"]`**, n-dx 428 + AsterMind-CE 45.
Its distribution is far flatter than v2 and **contains every class v2 starves of**, because it is
the files the *rules* caught:

```
utility 23.0% · component 15.2% · cli-command 13.3% · entrypoint 11.2%
store 11.0% · page 7.8% · hook 5.9% · route-handler 5.3% · types 3.2% · schema 2.7%
```

**Do not merge it into v2.** A corpus where a label means "a teacher's judgement" *or* "a regex
fired" depending on the row, with nothing recording which, is `TN-J31`'s two-unrecorded-teachers
defect again — and that took 19 days to find. **If both ship, they ship as two datasets with two
warranties.**

### Only ~45% of a repo is even eligible

**Verified on n-dx's `.sourcevision/inventory.json`:** 1,525 entries — **test 825 · source 683 ·
build 10 · config 6 · docs 1.** Classification only ever sees `role: "source"`, which is exactly the
683. **825 test files — 54% of the repo — never reach either model, while `test-helper` is one of
the 17 archetypes I am chartered to cover.** v2's 29 `test-helper` rows come from other repos'
helpers that happened to land on the source side of the role split. **This is a structural ceiling
on coverage and it belongs in `ELM-CORPUS.md` before a consumer discovers it.**

### Three per-row variables that vary and are recorded NOWHERE

Same shape as the teacher-model gap I found, still open, all inside my lane:

- **(a) The retry ladder silently swaps the prompt.** `computeLLMClassifyAttempts`
  (`classify.ts:394-396`): `full → compact (archetype descriptions dropped) → compact + batch halved
  to 15`. `promptLevel` is only `console.log`'d at `:418-420` — **never persisted.** An unknown share
  of rows were labelled by a materially weaker prompt and no artifact says which.
- **(b) Batch composition is uncontrolled.** `LLM_BATCH_SIZE = 30` (`:322`); all 30 paths share one
  context. Re-running the build at a different file ordering may not reproduce the same labels.
  Never measured in either direction. **For a dataset, that is a reproducibility property.**
- **(c) Abstention is invited and uncounted.** The prompt ends `"Omit files with no clear fit"`
  (`:509`). Vue core returned **23 of 303 files unclassified**, visible only as a smaller `harvested`
  count. The gold-set script records `omittedByLlm` properly; **the corpus builder throws it away.**

### The teacher is NOT shown the path only

`ELM-CORPUS.md` and `K2-HANDBOOK.md` both describe the prompt as path-based. **It is not** (`TN-J26`,
filed, unquantified). Each file arrives as a path **plus `[partial signals: service(0.7), …]`** from
the algorithmic pass — and `evidence` is populated whenever *any* signal matches (`:159`),
independent of the threshold that made the file unclassified — **plus the full 17-archetype catalog
with prose descriptions, plus 29 sibling paths.**

**Consequence for the dataset:** these labels are **not an independent judgement of archetype.** They
are a strong model agreeing or disagreeing with a weak rule guess it was shown. **A consumer training
on the path string alone learns from a teacher that had more information than they will ever give
their student.** This belongs in `ELM-CORPUS.md`.

### Columns that are already measured and free

`sourcevision` computes `imports.json`, `inventory.json`, `zones.json`, `callgraph.json` *before*
classification. **Verified:** `enrichClassificationsWithLLM(classifications, inventory, imports)`
receives the import graph and the inventory and **references neither in its body** — each identifier
occurs exactly once, in the parameter list. The plumbing has always been there.

**Why it matters for a database:** **in-degree and out-degree transfer across repos in a way path
tokens cannot.** "Imported by 30 files" means the same in hono as in n-dx; the token `rex` means
nothing outside this repo. Jam's mechanical reading of v1's collapse: the TF-IDF vocabulary is fitted
on the training split, so a fresh repo's distinctive tokens have **no slot at all**, the vector goes
sparse, and the model falls back to the class prior — 64% `service`/`utility`, which matches the
observed 96.4%.

**On the lead's "don't let the consumer design influence the training data":** it forbids *curating
rows to flatter a downstream gate*. Recording more of what was **already measured** is a different
thing — `inDegree`, `outDegree`, `role`, `language`, `loc`, `zone` cost nothing, carry no consumer's
opinion, and any consumer may ignore the columns. **Shipping the path string alone is itself a design
choice that constrains every consumer to the feature set that already failed once.** Raised to the
lead; not done unilaterally.

### Ground truth: 83 rows, and it is not spent for MY purpose

`scripts/data/k2-goldset-packet.csv` — **83 files, two-pass human labelling by Nolan**
(`pass1_path_only`, `pass2_after_reading_file`, `confident_yes_no`, `notes`). `pass2` is truth; the
gap between passes is where the 85.4% ceiling comes from. **30 of the 83 are marked not confident**
(`k2-analysis.json`, `uncertainty.notConfident: 30`), so the honest target set is smaller than 83.

It is spent as a **model** dev set, because its labels have been read. **It is not spent as a
label-quality instrument** — and that is a database owner's question, not a modeller's. The 72.3%
teacher figure came from exactly this join. **If I ever change the labelling procedure, that 83-row
join is how I show the change was an improvement rather than a different flavour of wrong.**

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

**Lead's decision, same session:** the deliverable is a **separate GitHub repo**, not in-tree JSON.
**The repo now exists: `NMoore-Astermind/ELM-database-ndx`** (created 2026-09-16). ⚠️ It is
**private, owned by a personal account rather than the `AsterMindAI` org, and has exactly one
collaborator** — so as it stands **Jarrett and Thomas cannot see it**, which is the end goal. It
currently holds an 18-byte `README.md` and nothing else. Access and ownership are the lead's call.

**Second session, same day:** Jam's handover note landed and I verified its five load-bearing claims
myself. **One of them retracts something I published this morning** — the "105 free rows" — and the
rest reframe the mission from a repo-count problem into a harvest-design problem. Nothing has been
harvested; no LLM calls spent.

## Next up

- [ ] `TN-N1` — announce the scope + database mission to the team (first task, in progress)
- [ ] `TN-N2` — the standing mission: a shareable, light training database for the other leads
- [ ] Run the coverage re-check on v2 before offering v2 to anyone. Free, no labels, no LLM spend.
      It is `ADR-2026-09-04-syrup-…` Step 0 and it is still unrun.
- [ ] ~~Harvest the 105 "free" gold-set-#2 rows~~ — **WITHDRAWN. They are not free.** They are
      hono/trpc files, and harvesting them burns the only fresh-ecosystem probe we own. Blocked
      behind replacement probes; see Standing context.
- [ ] **Harvest `nest`, `remix`, `payload` — this is the real first move.** They are already cloned,
      they target the classes n-dx cannot reach at any price (`model`, `route-module`), and they
      double as the replacement generalisation probes the 105 rows are waiting on.
- [x] ~~Decide the deliverable's shape with the lead~~ — **decided 2026-09-16: a separate GitHub repo.**
- [ ] Get a **second lead's sign-off** before the repo is created — creating it is outward-facing.
      Nothing about harvesting waits on this.
- [ ] Rebuild provenance so the teacher model is recorded per repo (closes `TN-J31`; the script
      side is already done at `b4fde7b2`).
- [ ] Per the lead's diagram: consider narrowing to **one repo first, scale later.** `nest` is the
      right first repo — it is the densest source of the classes we are missing.
- [ ] **Lead's decision needed: residue-only, label-everything, or ship two datasets?** The mission
      says "label every file"; the builder labels the residue. See Standing context.
- [ ] **Lead's decision needed: do rows carry the free measured columns** (`inDegree`, `outDegree`,
      `role`, `language`, `loc`, `zone`) or the path string alone?
- [ ] Put the structural caveats into `ELM-CORPUS.md` — residue-only harvest, the `role: "source"`
      ceiling, the `[partial signals]` teacher contamination. **The document is the warranty; these
      are what make the rows safe to use.**
- [ ] ⚠️ **`elm-coverage-check.mjs` OOMs on the v2 model** — the frozen artifact is a *recipe, not
      weights*, so it re-fits nine 4096-unit models and dies at ~1978 MB against node's ~2096 MB
      default. Jam's route through: `node --max-old-space-size=6144 scripts/elm-coverage-check.mjs
      --frozen=…`. **Step 0 is not the free five minutes the ADR implies.** Jam owns the run.

## Session log

Newest at the top. **Do not edit past entries** — append corrections as a new entry.

---

### 2026-09-16 (c) — Both decisions taken; builder rebuilt to match; found a 15-day-red test

**Did:**
- Got the lead's two decisions: **ship two datasets** (`TN-N4`) and **add the free columns**
  (`TN-N7`). Both recorded on the board with the reasoning, not just the verdict.
- **Implemented `TN-N7` in `scripts/elm-corpus-build.mjs`** — joins `inventory.json`,
  `imports.json` and `zones.json` by path; every row now carries `role`, `language`, `loc`,
  `inDegree`, `outDegree`, `zone`. Provenance gains `rowColumns`, `featuresAvailable`, `bySource`.
- **Landed `TN-N8(c)`** — per-repo LLM omission counts.
- **Found and fixed a pre-existing red architecture test** (see below).
- Ran the full root suite green.

**Learned:**
- **Verified, not assumed: 255/255 n-dx rows carry all six new columns.** Teacher provenance also
  now populates on a fresh build (`claude-sonnet-4-6`, pinned) — confirming `TN-J31` needs only a
  rebuild, which is what I claimed this morning from reading the code.
- **Mixed-teacher detection works**: a 4-repo build reported `distinct: 2, mixed: true`
  (`claude-sonnet-5` 281 rows / `claude-sonnet-4-6` 255).
- ⚠️ **I wrote a fabricated zero and caught it only by checking against a known number.** My first
  omission counter tested `fc.source === "llm" && !fc.archetype`. An LLM-omitted file is **not**
  recorded that way — it is left exactly as the algorithmic pass left it, `{archetype: null,
  confidence: 0, source: "algorithmic"}`, and there is no `llmAttempted` flag. So it returned **0 on
  every repo**, and 0 is a plausible-looking answer. Jam's note said Vue core had 23; checking
  against that is the only reason I found it. **The rewrite returns `null`, never 0, when the LLM
  pass did not run** — svelte correctly reports `null` against 331 unclassified, because "not
  measured" and "zero omissions" are different facts.
- **`node --check` and a green test would both have passed the broken version.** The guard that
  worked was an independently-known number to compare against.

**Broke / still broken:**
- **Found red, not caused by me:** `architecture-policy.test.js > no direct child_process imports
  outside allowed files` has failed on `Nolan-Work` since **`d3da0603` (2026-09-01)** — 15 days.
  `scripts/elm-goldset2-packet.mjs:29` imports `execFileSync` and K2 shipped it without the matching
  `ALLOWED` entry, while both sibling scripts have one. Legitimate exception, identical category:
  the only use is `execFileSync("git", ["-C", dir, …])` at `:65` for provenance.
  **Claimed `tests/e2e/**` in `IN-FLIGHT.md` first** (shared file), watched it fail
  (1 failed / 53 passed), added one line, re-ran **54/54**. Claim released.
- **Full root suite green: 89 files, 1996 passed, 1 skipped** (`npx vitest run tests/` — `pnpm test`
  still aborts in rex before reaching `tests/e2e/`, per K2's trap list).
- Still broken, still not mine: `IN-FLIGHT.md` § 2's stale "freeze RUNNING"; `OWNERSHIP.md` and
  `Command-Structure` scopes.

**Left undone and why:**
- **No corpus artifact regenerated and no LLM calls spent.** Existing committed corpora are
  deliberately untouched — v1/v2 reproducibility depends on them, and every number in
  `ELM-FINDINGS.txt` is measured against them. The richer rows appear on the next harvest.
- **`TN-N8(a)` and `(b)` still open** — `promptLevel` persistence and batch-composition
  reproducibility. (a) is what would let omission counting separate "teacher declined" from "batch
  never reached"; the caveat is recorded in the code rather than glossed.
- **`ELM-CORPUS.md` not yet amended** (`TN-N6`). It is the warranty document and it is next.
- **The two-dataset split is decided but not built** — the sanity corpus needs its own document
  before it ships as a dataset rather than a debugging artifact.

**Notes sent / received:**
- Sent: `NOTE-nolan-internal-2026-09-16-nutella-decisions-and-a-red-test.md`.

**Handoff:**
- Next: amend `ELM-CORPUS.md` (`TN-N6`) — residue-only harvest, the `role: "source"` ceiling, the
  `[partial signals]` teacher caveat, and the new columns. Then stage `nest`/`remix`/`payload`.
- **Still do not harvest the 105 gold-set-#2 rows.**
- **The deliverable repo is still private, personal-account, one collaborator.**

---

### 2026-09-16 (b) — Jam's handover. I retract the "105 free rows"; the mission is a harvest-design problem

**Did:**
- Read Jam's `NOTE-nolan-internal-2026-09-16-jam-to-nutella-corpus-acquisition-handover.md` and
  **verified its five load-bearing claims myself** rather than relaying them.
- Corrected my own 105-rows error in all three places it landed: this charter, `TN-N2`, and the
  onboarding note (retracted in place, in § 6, where the reader actually is).
- Recorded the residue-only harvest mechanism, the sanity corpus, the `role` ceiling, the three
  unrecorded per-row variables, the `[partial signals]` finding, the free columns, and the ground
  truth in Standing context.
- Confirmed the deliverable repo exists and found an access problem with it.

**Learned:** (all verified at artifact or `file:line` by me on 2026-09-16)
- **`poolSize: 355`, `sampled: 250`, seed `20260901`, `totalClassifyCalls: 12`, provenance = hono +
  trpc only.** So the 105 unsampled rows are *from our only two fresh-ecosystem probes*. The
  existing contamination assertion is **path-level** and would **pass** on that harvest; the
  contamination is at the **ecosystem** level, which is the level v1 died at.
- **The builder harvests the residue, not the repo.** `page` has 0 corpus rows because n-dx's 37
  `page` files are all caught by rules and never reach the teacher. **Independently confirmed:** the
  sanity corpus holds exactly **37** `page` rows.
- **`elm-archetype-corpus-sanity.json` exists and nobody's plan includes it** — 473 rows, 12 classes,
  `sources: ["algorithmic"]`, n-dx 428 + AsterMind-CE 45, `page` 7.8%, `component` 15.2%. The
  inverse population. **Two datasets, two warranties — never merged.**
- **`inventory.json`: 1,525 entries — test 825 · source 683 · build 10 · config 6 · docs 1.**
  Classification sees only `role: "source"`. **54% of the repo is structurally ineligible while
  `test-helper` is a chartered class.**
- **`enrichClassificationsWithLLM(classifications, inventory, imports)` never references either in
  its body** — one occurrence each, the parameter list. Free transferable columns, plumbing already
  in place.
- ⚠️ **`elm-coverage-check.mjs` OOMs on the v2 model** (~1978 MB vs node's ~2096 MB default) because
  the frozen artifact stores a recipe, not weights. **Step 0 is not free five minutes.**

**Broke / still broken:**
- **I published a wrong recommendation this morning and it stood for about two hours.** My onboarding
  note called the 105 rows "the cheapest expansion on the table" and told the team they were free.
  **They are the most expensive rows in the project.** Retracted in place in the note, in `TN-N2`,
  and here. Nobody acted on it and nothing was harvested — but the note is what a revived agent
  reads, so the correction had to land in the original, not only in the newest document.
- Still broken, not mine: `IN-FLIGHT.md` § 2 still says the freeze is RUNNING (it finished
  2026-09-04); `OWNERSHIP.md` and `Command-Structure` still say all scopes are `(unassigned)`.

**Left undone and why:**
- **Nothing harvested, no LLM calls spent.** Two decisions gate the harvest design and both are the
  lead's: residue-only vs label-everything vs two datasets, and whether rows carry the free measured
  columns. Harvesting before those are answered would produce a dataset I would have to rebuild.
- **The v2 coverage re-check is Jam's**, by Jam's own proposal in § 0 — it is a model evaluation.
  I am not blocked on it.
- **`ELM-CORPUS.md` not yet amended** with the structural caveats. It is next, and it is mine.

**Notes sent / received:**
- Received: Jam's corpus-acquisition handover (`189c5da5`).
- Sent: `NOTE-nolan-internal-2026-09-16-nutella-reply-to-jam-105-rows-retracted.md`.

**Handoff:**
- **Do not harvest the 105 rows.** Stage `nest` / `remix` / `payload` first — they fill the classes
  n-dx cannot reach *and* serve as replacement generalisation probes.
- Get the lead's answer on harvest design and on the free columns before spending any classify calls.
- The deliverable repo is private under a personal account with one collaborator; **the other two
  leads cannot see it.**

---

### 2026-09-16 — Onboarding; Team Nolan's scope is the training database

**Did:**
- Read the full Step 1 list from `NEW-AGENT.md`: `claude-context-instruction`, `Command-Structure`,
  `GITHUB-WORKFLOW.md`, `OWNERSHIP.md`, `IN-FLIGHT.md`, root `CLAUDE.md`,
  `scripts/elm-hello-world.mjs`. Then the corpus material: `ELM-CORPUS.md`, `K2-HANDBOOK.md`,
  `ADR-2026-09-04-syrup-merge-elm-corpus-into-jarrett-harness.md`.
- Verified the corpus against disk instead of against its documentation: row counts, class
  distribution, per-repo counts, provenance block, the 17-archetype catalog, the staging tree.
- Created this charter, the roster row, `TN-N1`/`TN-N2`/`TN-N3`, and the `IN-FLIGHT.md` claim.
- Wrote `NOTE-nolan-internal-2026-09-16-nutella-scope-and-database-mission.md`.
- Committed (`0af16083`) and **pushed to `origin/Nolan-Work`** — 0 ahead / 0 behind after the push.
- **Received the lead's decision on the deliverable mid-session: a separate GitHub repo.** Recorded
  in `TN-N2`, in Current state, and appended to the note, which had said "undecided".

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
