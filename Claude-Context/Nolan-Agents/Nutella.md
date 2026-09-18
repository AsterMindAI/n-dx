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
rest reframe the mission from a repo-count problem into a harvest-design problem.

**Third:** both lead decisions taken — **two datasets** (`TN-N4`) and **free columns** (`TN-N7`,
implemented and verified 255/255). Found and fixed a 15-day-red architecture test.

**Fourth:** Syrup's groundwork note. **`ELM.train()` does not train on what you pass it** — the
repo's own smoke test scores 83% with no training data — though the blast radius is narrower than it
looks and the tier's headline numbers stand. **`ELM-CORPUS.md` is now substantially amended
(`TN-N6` done)**, including retracting the 105-row claim *at source*, which is where Syrup had read
it. **Still nothing harvested and no LLM calls spent by me.** The next gate is the row schema
(`TN-N11`) — the diagram wants content, and nothing on this project collects content.

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

### 2026-09-18 — IMPL written; v2 measured and FAILED; three documents were stale within hours

**Did:**
- Read Jam's committed v2 coverage artifact and wrote
  [`IMPL-2026-09-18-nutella-elm-training-database-construction.md`](../IMPL/IMPL-2026-09-18-nutella-elm-training-database-construction.md)
  — six phases, a pre-registered bar, a parity control, a risk register and a rollback that is
  honest about what cannot be rolled back.
- **Re-evaluated it against sources rather than memory**, which found two errors in the IMPL and
  **six stale sites across two other documents**.
- Updated `ELM-CORPUS.md` § 6 and the ADR with the measured result; resolved `TN-N10`.

**Learned:** (from `scripts/data/elm-coverage-v2.log` — committed with invocation and input hashes)
- **Corpus v2: 33.8% trained-on (PASS) → 28.0% fresh (K1′ FAIL).** hono **35.8% PASS**, trpc
  **24.3% FAIL** — same model, same run. **K1′ is a property of (model, repo).**
- **The ecosystem fix worked and still missed:** fresh coverage **13.2% (v1) → 28.0% (v2)**, S/U
  collapse **96.4% → 80.0%** against a teacher's 48.4%. **More ecosystems is a real lever that does
  not reach the bar alone** — which is the strongest evidence yet that the residue is *feature
  space*, i.e. exactly what the ADR is designed against.
- **Syrup's 28.0% was right to the decimal.** Jam retracted the "narratively convenient"
  insinuation in place. The real gap was only ever a number without a committed invocation.
- **The whole premise is testable for ZERO LLM spend** — all 7 training repos have
  `inventory.json`/`imports.json`, and **100% of gold set #2's 250 eval paths join to inventory**
  (hono 81/81, trpc 169/169). Coverage needs no labels, so the blind set can be re-measured
  indefinitely without being spent. **That is the spine of the IMPL: measure before harvesting.**

**Broke / still broken:**
- **Re-evaluation caught two errors in my own IMPL.** (1) I wrote "~21% of hono's eval rows" have no
  graph signal; it is **25.9%** (74.1% are edge-touched). (2) I cited `ELM-CORPUS.md` § 6 for the v1
  **13.2%** coverage figure — § 6 carries that run's S/U shares and label counts but **not** its
  coverage numbers; the real source is Syrup's 09-04 ADR evidence table. Both fixed.
- **⚠️ Three documents went stale the moment Jam's result landed, and I nearly shipped an IMPL on
  top of them.** `ELM-CORPUS.md` § 6 still told every reader *"corpus v2 is UNVALIDATED… the
  coverage re-check has not been run"* — in the warranty document other teams read first. The ADR
  still listed it as hiccup 12 and in its not-evidence list. **Six sites, all now corrected.** This
  is the third consecutive day a correction has had to be chased across documents; the difference
  is that this time I swept for it as part of the work instead of being told.

**Left undone and why:**
- **Nothing harvested, no LLM calls spent, no model trained, no accuracy claimed by me.** The only
  measured result here is Jam's, on the path-only model.
- **Phase 0 is not yet committed** — the pre-registration must land *before* Phase 3 runs, and the
  ADR is still Proposed. Phases 0–2 are safe to build under it; **Phase 5 spends money and waits on
  the lead.**
- **Schema still not sent to Syrup** (owed, agreed). **No note to Jarrett or Thomas** — and the
  result strengthens the case for telling them, since their harness consumes numeric vectors.
- **`TN-J22` still unclaimed** — fourth time recorded. Nothing in this IMPL improves label quality.

**Notes sent / received:**
- Received: Jam's v2 coverage artifact (`f3a88d39`) and their retraction (`f95b8cd3`).
- Sent: none this session — the reply to Jam is owed and is the first thing next session.

**Handoff:**
- **The IMPL and ADR both need the lead.** Phase 2's parity control is the first buildable thing and
  costs nothing.
- **28.0% is the number to beat**, on the same 250 files, at operating point B+su.
- **Still: do not harvest the 105. Use `trainFromData`, never `train()`. Always pass
  `--max-old-space-size=6144` to the coverage check.**

---

### 2026-09-17 (b) — Jam's review: six corrections taken, three changed a decision

**Did:**
- Read Jam's review of the ADR and **re-verified every claim it made before adopting any of them**,
  including reproducing their block-energy measurement against the real pipeline.
- Revised the ADR — six changes, indexed in a revision block at the top.
- Recorded the lead's authorisation for Jam's v2 coverage run on `TN-N10`.

**Learned:** (reproduced by me unless marked)
- **Block scale was undeclared and it decides which signal dominates.** Reproduced Jam's numbers
  exactly (`docOf`/`vocabCap: 4000` per `elm-certify.mjs:50,144`): path block **2,890 dims, squared
  L2 energy mean 1.464, p10 0.963, nonzero 16.0/3/27**. Twelve structural scalars in `[0,1]` have
  expected energy **4.000** — **2.73× the entire path block.** `TFIDFVectorizer.vectorize()` does
  **not** normalise; `l2normalize` is opt-in (`dist/ml/TFIDF.d.ts:35`) and never called by us.
  *Refinement to Jam's summary:* the "4–5×" figure includes the one-hots; the scalars alone are
  2.73×, and since `language` is now withheld the realistic figure is ~2.7× rising per family.
- **Percentile normalisation imports repo composition — larger than Jam estimated.** A file with
  `inDegree: 1` is at the **12.5th percentile in n-dx** and the **72.7th in commerce**: a 60-point
  swing for an identical property. 57.8% of commerce source files are at in-degree 0.
- **`language` is leakage, not signal.** All **11 `Vue` rows are from one repo and all 11 are
  labelled `component`** — a perfect repo fingerprint *and* a perfect in-sample label predictor.
- `symbols[]` is plausibly the most transferable signal in the graph and I had dropped it without
  listing it — the one gap in the ADR's best table.

**Broke / still broken:**
- **A correction of mine failed to reach every site for the second day running.** Jam found two
  stale "9 of 10" zone counts in the same document where I had already corrected that number
  elsewhere. Yesterday the same failure let Syrup quote the retracted 105-row claim. **Fixed, and I
  am now treating "grep the document for the old value" as part of making a correction**, not as
  tidying afterwards. I then wrote "three stale counts" in the revision note when it was two, and
  had to correct that as well.
- **I contradicted myself inside the ADR**: `depthFromRoot` was "scale-free" in the fed table and
  the opposite in hiccup 8. Withheld.
- `pnpm test` untouched here; no code changed this session beyond documents.

**Left undone and why:**
- **Nothing harvested, no LLM calls spent, no model trained, no accuracy claimed.** The ADR still
  quotes **no v2 coverage figure** and will not until Jam's artifact lands.
- **The normaliser is deliberately left open** — promoted from the not-evidence list into the
  Decision, to be settled by measurement (`log1p`, pooled global quantiles) before any published
  number. `raw` is what makes that free.
- **Schema still not sent to Syrup**; **no note to Jarrett or Thomas** though the ADR affects
  Jarrett directly.
- **`TN-J22` raised for the third time and still unclaimed** — the only lever on label quality.

**Notes sent / received:**
- Received: Jam's ADR review.
- Sent: `NOTE-nolan-internal-2026-09-17-nutella-to-jam-adr-revised-and-coverage-authorised.md`.

**Handoff:**
- **Jam's v2 coverage run is lead-authorised and unblocked** — it decides whether § 5 step 1 of the
  ADR is choosing repos against a confirmed problem shape or a presumed one.
- Then: ADR to the lead, schema to Syrup, then harvest `nest`/`remix`/`payload` by class need.
- **Still: do not harvest the 105. Do not quote 28.0%. Use `trainFromData`, never `train()`.**

---

### 2026-09-17 — The construction ADR; re-validation contradicted me twice

**Did:**
- Wrote [`ADR-2026-09-17-nutella-elm-training-database-construction.md`](../ADR/ADR-2026-09-17-nutella-elm-training-database-construction.md)
  — how the database is made, its contents, how it is made usable, how the import graph and
  inventory get in, and the hiccups to expect.
- **Measured transferability across nine repos before deciding anything**, then committed the
  measurements as `scripts/elm-feature-survey.mjs` (claimed in `IN-FLIGHT.md` first, per the
  shared-`scripts/` rule).
- Re-ran everything against the committed script and **corrected the ADR twice**.
- Annotated `elm-corpus-build.mjs` so `zone` is explicitly raw-only, not model-facing.
- Note to Jam explaining the reasoning.

**Learned:** (all via `scripts/elm-feature-survey.mjs`, deterministic — no seed, no sampling)
- **Mean in-degree spans 0.59 (commerce) → 6.04 (n-dx): a 10.2× spread.** `inDegree: 5` is
  below-average in n-dx and impossible in commerce, whose max is 3. **The raw degree columns I
  shipped yesterday would have rebuilt the v1 repo-prior in new coordinates.**
- **305 of 341 external packages appear in exactly one repo**; only 11 appear in ≥3 of 9, all
  generic. Per-file external coverage swings 5.0% (hono) → 78.1% (commerce). **My prior that
  "imports express → route-handler" would transfer was wrong at the vocabulary level.**
- **A fifth edge type exists — `require`.** express 100%, fastify 91.6%, n-dx 0%. Edge-type mix
  separates CommonJS from ESM, not archetypes. I built a table without it first; **the only reason
  I caught it is that the percentages did not sum to 100.**
- **`zones.json` absent for 7 of 9 repos**; `category` repo-specific (n-dx 11 values, Vue core 16).
- **Isolated source files: 1.2% (n-dx) → 42.2% (commerce).** In commerce nearly half the files have
  no graph signal at all.

**Broke / still broken:**
- **Re-validation contradicted the ADR twice, and both were mine.** (1) I wrote "`zones.json`
  present for 1 of 10 repos (AsterMind-CE only)" — it is **2 of 9**; I had omitted **n-dx itself**
  from the check. (2) I proposed **feeding `role`** as a small closed vocabulary; the survey showed
  it **constant `source` on 536 of 536 harvested rows**, so it is a dead input dimension — the same
  waste as `TN-B7`'s dead `charSet` slots. Moved to withheld. **I reasoned about `role` from the
  inventory population, where it varies, and never checked it on the harvested population, where it
  cannot.**
- Full root suite green: **89 files, 1996 passed, 1 skipped**; architecture policy **54/54**. The
  new script needs no `ALLOWED` entry — it shells out to nothing.

**Left undone and why:**
- **Nothing harvested, no LLM calls spent, no model trained, no accuracy claimed.** The ADR
  deliberately contains no coverage number for v2 — `TN-N10` is still open.
- **Schema not yet sent to Syrup**, which I agreed would precede any harvest at scale.
- **No note to Jarrett or Thomas.** The ADR affects Jarrett directly — their numeric
  evidence-vector model is closer to a structural dataset than our path corpus ever was, and
  `TJ-A3` is moving the taxonomy under us. Drafting is mine; sending is Nolan's.
- **`pkgFamily` map does not exist yet**; percentile normalisation is reasoned, not validated; the
  single-file runtime fallback is untested. All three are named in the ADR as not-evidence.

**Notes sent / received:**
- Sent: `NOTE-nolan-internal-2026-09-17-nutella-to-jam-database-adr-reasoning.md`.

**Handoff:**
- **The ADR needs the lead.** Then: send the schema to Syrup, then harvest `nest`/`remix`/`payload`
  by class need (`TN-N12`), pinning the teacher per repo first.
- **Still: do not harvest the 105. Do not quote 28.0%. Use `trainFromData`, never `train()`.**

---

### 2026-09-16 (d) — Syrup's groundwork. A library defect voids the onboarding proof; my own retraction had already gone stale

**Did:**
- Read Syrup's groundwork note and verified its load-bearing claims at source.
- **Proved the `ELM.train()` defect by execution** and scoped its blast radius script by script.
- **Amended `ELM-CORPUS.md` substantially (`TN-N6` DONE)** — seven changes, indexed at the top.
- Replied to Syrup on three points, one of which is a correction to their note.

**Learned:**
- 🔴 **`ELM.train()` does not train on what you pass it.** Signature is
  `train(augmentationOptions?, weights?)` (`dist/core/ELM.d.ts:59`); the implementation
  (`astermind.esm.js:1146`) iterates `this.categories` and trains on character variants of the
  **label strings**. **Reproduced `elm-hello-world.mjs`'s own eval varying only the argument: real
  set 5/6, inverted labels 5/6, empty array 5/6, no argument 5/6 — identical predictions.** Its 83%
  is produced with no training data, and it still prints "trains, and generalizes".
- **Blast radius is narrower than it first looks, and saying so matters.** Void: `elm-hello-world`
  and `elm-prototype/*`. **Not** void: the nine scripts using `trainFromData`, and the two
  `.train()` calls on `VotingClassifierELM`/`ConfidenceClassifierELM`, whose signatures take real
  data. **The tier's headline numbers stand.**
- **Syrup's byte-identity proof was weaker than their conclusion** — `saveModelAsJSON()` returns
  3 bytes for every model, so identity is also what a no-op serializer gives. The conclusion is
  right; the behavioural test is what establishes it.
- **A v2 coverage number (28.0%) is circulating with no artifact.** Nothing in `scripts/data/`,
  `ELM-FINDINGS.txt`, or git history; the only other `28.0` in the repo is `undici-types: ^6.28.0`.
  Jam says the check is unrun. **Two teammates disagree about whether the gate measurement exists.**
- **Syrup's resolution-rate spread is the most useful harvest input I have:** commerce 76.6% →
  typeorm 5.7%, so the residue that becomes rows varies ~13× by ecosystem. Recall floor:
  `entrypoint` 59 rows → 85%, `types` 34 → 42%, 1–2 rows → 0%.
- **The diagram wants content; nothing on this project reads content.** Raw file text is collected
  nowhere. That is new collection and it is mine to design.

**Broke / still broken:**
- **My own retraction had already gone stale where it mattered.** I retracted the 105-row claim this
  morning in my note and in `TN-N2` — **but not in `ELM-CORPUS.md`, which is the canonical
  document.** Syrup read it there and repeated it, correctly quoting the source, hours later.
  **Retracting in the newest artifact instead of the original is precisely the failure mode
  `Command-Structure` names, and it took under a day to bite me.** Now fixed at source, with the
  propagation path named.
- **`claude-context-instruction` § 1 and `NEW-AGENT.md` Step 1 still point every new agent at a
  smoke test that proves nothing.** Filed as `TN-N9`, not edited — shared/Fluff-owned.

**Left undone and why:**
- **Nothing harvested; no LLM calls spent.** `TN-N11` (row schema, including whether to collect
  content) must settle first, and Syrup reviews the schema before any harvest at scale — accepted,
  because a schema that cannot survive the coverage check is far cheaper to fix now.
- **`TN-N9` and `TN-N10` both need someone other than me** — shared files, and Syrup's number.
- **`TN-N8(a)`/(b)** still open.

**Notes sent / received:**
- Received: Syrup's groundwork note.
- Sent: `NOTE-nolan-internal-2026-09-16-nutella-reply-to-syrup-three-corrections.md`.

**Handoff:**
- **Settle the row schema (`TN-N11`) and send it to Syrup before harvesting.** Then `nest` /
  `remix` / `payload`, chosen by class need per `TN-N12`.
- **Do not quote 28.0% for v2 coverage.** **Do not harvest the 105.**

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
