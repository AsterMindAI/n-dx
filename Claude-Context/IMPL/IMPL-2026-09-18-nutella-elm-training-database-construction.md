# IMPL — Building the ELM training database: measure the premise first, harvest second

- **Implements:** [`ADR-2026-09-17-nutella-elm-training-database-construction.md`](../ADR/ADR-2026-09-17-nutella-elm-training-database-construction.md)
- **Owner:** Nutella (Team Nolan)
- **Backlog item:** `TN-N2`, `TN-N11`, `TN-N12`, `TN-N13`
- **Branch:** `Nolan-Work` — **deviates from the documented `elm/<lead>/<topic>` convention**, which
  has never been used on any remote (`TN-F1`, ADR still Proposed). Recorded, not silently adopted.
- **Worktree:** none — shared checkout `/Users/nolanmoore/Work/n-dx-1` (lead's decision 2026-09-16),
  so every state-writing command is claimed in `IN-FLIGHT.md` first.
- **Status:** **In progress** (lead: "push forward", 2026-09-18).
  **Phase 0 DONE** — bar committed at `scripts/data/elm-v3-preregistration.json` (`802d12c1`)
  before any model existed. **Phase 1 DONE** — `scripts/elm-features.mjs`, 22 feature columns.
  **Phase 2 in progress** — harness written; parity control running.
  Phases 3–4 build next; **Phase 5's harvest stays gated on Phase 4.**

---

## 0. What changed on 2026-09-18, and why this plan is shaped the way it is

Jam ran the v2 coverage check on the lead's authorisation. **The artifact is committed**
(`scripts/data/elm-coverage-v2.log`, invocation and input hashes included) and it is a stop-the-line
result:

| population | coverage | K1′ (≥30%) | ELM `service`/`utility` | teacher | distinct labels |
|---|---:|---|---:|---:|---|
| held-out, trained-on ecosystems (n=160) | **33.8%** | **PASS** | 73.8% | 62.5% | ELM 10 / teacher 15 |
| **gold set #2, fresh ecosystems (n=250)** | **28.0%** | **FAIL** | **80.0%** | **48.4%** | **ELM 7 / teacher 13** |
| ↳ hono only (n=81) | 35.8% | PASS | 71.6% | 45.7% | ELM 6 / teacher 8 |
| ↳ **trpc only (n=169)** | **24.3%** | **FAIL** | 84.0% | 49.7% | ELM 5 / teacher 12 |

Three things follow, and they set this plan's shape.

**1. The problem the ADR was designed against is confirmed, with a number.** Corpus v2's
ecosystem-diversity fix worked *substantially* — fresh-ecosystem coverage went **13.2% (v1) →
28.0% (v2)**, and the `service`/`utility` collapse eased from **96.4% → 80.0%** against a teacher's
48.4% — and still failed. *(The v1 figure is from the frozen-v1 run recorded in
`ADR-2026-09-04-syrup-merge-elm-corpus-into-jarrett-harness.md`'s evidence table; `ELM-CORPUS.md`
§ 6 carries that run's S/U shares and label counts but not its coverage numbers — a citation I had
wrong until re-evaluation.)* **More ecosystems is a real lever that does not reach the bar on
its own.** That is precisely the ADR's premise: the residual failure is in the feature space.

**2. We now have a committed, reproducible baseline to beat: 28.0%.** Nothing on this project has
had that before. Every claim this IMPL makes is measured against it, on the same 250 files, with the
same operating point.

**3. K1′ is a property of (model, repo), not of the model.** hono passes and trpc fails on the same
model. Any single-number claim about "coverage" must name its repo.

### The sequencing decision this forces

**Verified 2026-09-18: the entire premise can be tested with ZERO LLM spend.** Structural features
join to everything we need:

- All **7 training repos** have `inventory.json` and `imports.json` on disk.
- **100% of gold set #2's 250 evaluation paths join to inventory** — hono 81/81, trpc 169/169 — and
  74.1% (hono) / 91.1% (trpc) are touched by an import edge.
- The coverage check needs **no ground truth and no labels**, so it can be re-run on those 250
  files indefinitely **without spending the blind set.**

So: **measure whether structural features fix transfer before harvesting a single new repo.** The
last time this project harvested first and diagnosed second, it spent a labelling day on a corpus
whose feature space was the actual problem. Harvesting ~15 repos costs ~150 classify calls; finding
out afterwards that the feature space was the blocker costs all of it.

**If Phase 4 shows structural features do not move coverage, that is a publishable negative and the
harvest does not happen.**

---

## Scope

**In scope**
- The layered dataset builder, its two outputs (`residue`, `resolved`), the companion graph and
  inventory artifacts, and the manifest.
- Feature derivation, the three candidate normalisers, and the block-scale contract.
- A feature-space coverage harness, and the parity control that validates it.
- `ELM-CORPUS.md` / `FEATURES.md` as the shipped warranty.
- Corpus expansion by class need, **conditional on Phase 4**.

**Out of scope (explicitly)**
- **The classification tier, the model that ships, the confidence gate, the retrain loop.** Right of
  the green box. Jam's line (`TN-J19`, `TN-J23`).
- **`packages/**` — no production code is touched by this IMPL at all.**
- **File content collection.** Deferred by the lead; the schema leaves a fourth layer for it.
- **Improving label accuracy.** `TN-J22` is the only lever and remains unclaimed.
- **Repo hosting and access.** `NMoore-Astermind/ELM-database-ndx` is private, personal-account,
  one collaborator. Lead's call; publishing anywhere is outward-facing and needs a second lead.
- **Modifying `scripts/elm-coverage-check.mjs`.** It produced the committed baseline. See Step 2.

---

## Files touched

| Path | Owning team / agent | New/Edit | Note sent? |
|---|---|---|---|
| `scripts/elm-corpus-build.mjs` | **Nutella** (`TN-N2`) | Edit | n/a — mine |
| `scripts/elm-feature-survey.mjs` | **Nutella** | Edit | n/a — mine |
| `scripts/elm-dataset-build.mjs` | **Nutella** | **New** | **Claim in `IN-FLIGHT.md` first** (shared-`scripts/` rule) |
| `scripts/elm-features.mjs` | **Nutella** | **New** | same |
| `scripts/elm-coverage-features.mjs` | **Nutella** | **New** | same |
| `scripts/elm-normaliser-sweep.mjs` | **Nutella** | **New** | same |
| `scripts/data/datasets/**` | **Nutella** | **New** | n/a |
| `Claude-Context/Nolan-Agents/ELM-CORPUS.md` | **Nutella** (`TN-N6`) | Edit | n/a — mine |
| `Claude-Context/Nolan-Agents/FEATURES.md` | **Nutella** | **New** | n/a |
| `Claude-Context/IN-FLIGHT.md` | **shared** | Edit (own row) | n/a |
| `Claude-Context/Nolan-Agents/{BACKLOG,Nutella}.md` | **Nutella** | Edit | n/a |
| ⛔ `scripts/elm-coverage-check.mjs` | **Jam** (`TN-J32`) | **NOT MODIFIED** | see Step 2 |
| ⛔ `scripts/data/elm-archetype-corpus{,-v2}.json` | historical | **NOT REGENERATED** | v1/v2 reproducibility |
| ⛔ `packages/**`, `tests/e2e/**`, `package.json`, `pnpm-lock.yaml` | shared / other | untouched | — |

**No file owned by another team is edited by this IMPL.** The one adjacent file, Jam's coverage
check, is deliberately left alone rather than extended.

---

## Steps

### Phase 0 — Pre-register the bar. **Commit this before Phase 3 runs.**

The project's strongest discipline is writing the threshold down before the numbers exist; it has
caught three wrong conclusions. Committed as `scripts/data/elm-v3-preregistration.json`:

```
POPULATION   gold set #2 packet — 250 files, hono + trpc, fresh ecosystems
             (labels NOT read; coverage needs none)
OPERATING PT B+su — abstain on service/utility, admit the top 10% most-confident of them
METRIC       coverage = (non-S/U predictions + admitted S/U) / n     [identical to
             elm-coverage-check.mjs:98, unchanged]
BASELINE     28.0%  — frozen v2, path-only, committed at scripts/data/elm-coverage-v2.log
             (frozen sha256 3a41980d…, model hash bbf07674…)

PRIMARY   structural features BEAT 28.0% on the same 250 files          -> premise supported
SECONDARY coverage >= 30.0% (K1')                                        -> tier is viable
TERTIARY  distinct labels emitted > 7 (today's figure; teacher uses 13)   -> prior has not collapsed

REPORT ALSO, ALWAYS: per-repo (hono, trpc) — K1' is a property of (model, repo)
                     trained-on held-out coverage, so improvement is not bought by
                     degrading the in-distribution case

STOPPING RULE  Model/normaliser/block-scale selection uses TRAIN-CV ONLY (Phase 3).
               Gold set #2 is touched ONCE per candidate, in Phase 4, after selection
               is frozen and committed. No selecting on the evaluation set.
FAILURE        If PRIMARY fails, publish the negative and do NOT harvest. The ADR's
               premise would be measured wrong, and 15 repos would not fix it.
```

### Phase 1 — Feature derivation, as a standalone module (no LLM spend)

`scripts/elm-features.mjs` — pure functions over `.sourcevision/` artifacts, no I/O policy, no
model. Extracted as its own module so the builder, the sweep and the coverage harness all compute
features **through one code path**; three implementations of "in-degree percentile" is how two
numbers silently diverge.

Emits per the ADR's `raw` and `features` layers, and **all three candidate normalisers behind one
flag** (`percentile` | `log1p` | `pooled`), because Phase 3 selects between them:

- degrees, `loc`, `size` → normalised; raw retained
- `typeImportRatio`, `valueImportRatio` (`static` + **`require`** collapsed), `reexportRatio`
- `isolated`, `inCycle` booleans
- `pkgFamily` via the curated map (Phase 1b)
- **withheld and never emitted into `features`:** `category`, `zone`, `role`, `language`,
  `depthFromRoot`, raw degrees, raw edge-type counts, raw package one-hot

**Phase 1b — the `pkgFamily` map.** A hand-written file, ~a dozen entries over the 11 packages
measured to appear in ≥3 of 9 repos (`fs`/`os`/`path`/`url` → `node-builtin`, `react`/`react-dom` →
`ui-view`, `zod` → `schema`, `vitest` → `test`, `vite`/`esbuild` → `build-tool`, `typescript` →
`tooling`). **Capped deliberately** — an open-ended package vocabulary is finding 2's trap. Ships
with the dataset so a consumer can audit or ignore it.

### Phase 2 — The coverage harness, and the parity control that licenses it

`scripts/elm-coverage-features.mjs` — evaluates a model over path ⊕ structural features using the
**identical** coverage definition and K1′ threshold.

> **⛔ `scripts/elm-coverage-check.mjs` is not modified.** It produced the committed baseline; a
> change to it, however careful, would put the 28.0% comparison in doubt. The new harness is a
> sibling.

**The parity control — this step gates everything downstream.** Before the new harness is allowed
to report any number about any new model:

```sh
node --max-old-space-size=6144 scripts/elm-coverage-features.mjs \
  --frozen=scripts/data/elm-frozen-model-v2.json --features=none
```

**It must reproduce 33.8% / 28.0% / 35.8% / 24.3%** — to the same one-decimal rendering the
committed log uses, and on the same four populations. If it does not, the harness is wrong
and no structural number it produces means anything. *A green test nobody has seen go red is
indistinguishable from no test* — this is the inverse and it is cheaper: a new instrument that
cannot reproduce the old instrument's result on the old input is not measuring the same thing.

⚠️ **`--max-old-space-size=6144` is mandatory.** The frozen artifact stores a **recipe, not
weights**, so the harness re-fits nine 4096-unit models and dies at ~1978 MB against node's ~2096 MB
default. Every invocation goes in the artifact.

### Phase 3 — Select the normaliser and block scale on TRAIN-CV ONLY

`scripts/elm-normaliser-sweep.mjs`. **The grid is committed before it runs** (Phase 0's stopping
rule). Nothing here touches gold set #2.

- **Normaliser:** `percentile` · `log1p` · `pooled` — the ADR leaves this open deliberately, and it
  is the choice the whole transfer argument rests on. Percentile imports repo composition (a file
  with `inDegree: 1` is at the **12.5th** percentile in n-dx and the **72.7th** in commerce);
  `pooled` additionally supplies a single-file runtime definition, which percentile lacks.
- **Block scale:** the structural block carries **~2.7×** the path block's energy unscaled
  (path squared-L2 mean **1.464** over 2,890 dims; twelve `[0,1]` scalars ≈ **4.000**). Sweep a
  small declared grid — `0.25×, 0.5×, 1×, 2×` — so the balance is **chosen**, not inherited from an
  unstated constant. **The path is not a weak signal to down-weight by default: the human path-only
  ceiling is 85.4%.**
- **Model config is fixed at the frozen spec** — `ELM 4096 / tanh / ridgeLambda 0.01 /
  vocabCap 4000` — so Phase 4 measures the *feature space*, not a re-tune. Changing two things at
  once is how this project previously produced a result it had to throw away.
- **`trainFromData(X, y)` with explicit one-hot `y`. Never `ELM.train()`** — it does not train on
  what you pass it; the repo's own smoke test scores 83% with no training data
  (`ELM-CORPUS.md` § 10a).
- `assertHarnessCanLearn()` runs before any number is reported.

**Output:** one committed JSON with every cell, and a single selected configuration. Selection is
frozen and committed **before** Phase 4.

### Phase 4 — The measurement that decides the project (still zero LLM spend)

Run the frozen selection against gold set #2. **One shot per candidate, per the stopping rule.**
Report the full table: overall, hono, trpc, and trained-on held-out.

| outcome | action |
|---|---|
| **beats 28.0% and ≥30%** | Premise supported, tier viable. Proceed to Phase 5 and tell Jarrett — their harness consumes numeric vectors and is closer to this than to a path corpus. |
| **beats 28.0%, under 30%** | Premise supported, bar not reached. Harvest (Phase 5) is now justified *on evidence*: ecosystems and features are additive levers. |
| **does not beat 28.0%** | **Publish the negative. Do not harvest.** Write the ADR amendment. Recommend `TN-J22` (the classify prompt) instead — the teacher sits 13.1 pp below the human path-only ceiling and that has been true since 2026-08-11. |

### The economics that decide sequencing generally

Jam's framing, adopted because it settles the ordering question for every future addition rather
than just for callgraph:

| | **expensive · irreversible · one-shot** | **free · repeatable** |
|---|---|---|
| what | LLM labels · the teacher pin · the commit you analyzed at | callgraph · components · every derived feature · every normaliser |
| when | **now, while the schema is boring** | **later, at leisure** |

Labels cost money and **cannot be recovered** if the prompt, the teacher or the taxonomy moves under
us. Structural metadata is arithmetic over files already on disk and can be recomputed any number of
times for nothing. **So the sequencing is forced: spend the LLM while the frame is stable, add the
arithmetic afterwards.** Adding features now inverts it — spending schema churn, which is the scarce
thing, to buy something that will be just as free in a month.

**The test for any proposed addition:** *if we add this in a month, does anything already collected
have to be collected again?* If no, it waits. Callgraph is a clean no.

### What "stable" means, and what is now frozen

The lead's steer is a **rough but stable frame for the database to expand into**. Stable is not
finished — it means **the shape stops moving while the contents keep arriving.**

**Frozen — changing these breaks everything downstream:**
- the layer boundary `identity` / `label` / `raw` / `features`
- `identity.commit` mandatory; `repo@commit` keying
- JSONL, one row per line; the split as an assignment column, seed 42, holdout 0.25
- `manifest.json` as the entry point, with per-file checksums
- **one derivation code path** (`scripts/elm-features.mjs`) and **a self-test pinning measured
  invariants** (`scripts/elm-features-selftest.mjs`)

**Deliberately fluid — the feature list itself.** Which columns land in `features` is a derivation
over `raw`, which is why "should we add callgraph?" can be answered *later* rather than *re-harvest*.

> **A framework is stable when adding a column cannot silently move an existing number.** The
> self-test is what makes that true here: it caught a live normalisation bug by requiring two
> independently measured percentiles to reproduce, and it would catch a column that perturbed them.

### ⚠️ Provenance integrity — the price of deferring, and a defect it exposed

Deferring metadata is safe **only while the metadata collected later still describes the tree the
labels came from**. Nothing enforced that. A `git pull` in the staging tree, and a callgraph
collected in October describes a different tree from September's labels — **and the join still
succeeds, because paths match.** Same path, different file, no error.

Jam asked for an assertion that a clone's `HEAD` equals its recorded commit. **Implemented, but
keyed differently, because checking it surfaced a real defect:**

- `elm-corpus-build.mjs` recorded `git rev-parse HEAD` **at build time**.
- The labels come from `.sourcevision/classifications.json`, written by an **earlier `analyze` run**.
- For the eight staged clones these agree. **For n-dx they never did:** corpus v2 attributes n-dx's
  **255 rows — 41% of the corpus** — to commit `90e5bdb7`, while the analysis that produced those
  labels ran at **`b8770042`**, twelve days earlier.

So the recorded commit identified the tree *at harvest time*, not the tree the labels describe.
Jam's assertion as proposed would have fired on n-dx and blamed "drift" — right alarm, wrong
diagnosis. **The authoritative commit is `.sourcevision/manifest.json`'s `gitSha`.**

**Now implemented:** every repo records **both** commits plus `analyzedAt`, and the builder reports
`ANALYSIS != BUILD`, a missing analysis commit, or a genuinely dirty source tree. *(Dirtiness
ignores `.sourcevision/` and `.n-dx.json` — our own scaffolding, written into every correctly
prepared repo; counting them makes the warning fire always and so be ignored.)*

**Benign in this instance and recorded anyway:** none of the 255 labelled n-dx files changed between
those two commits — verified — so the corpus is sound. The provenance was wrong, not the data.

**Standing rule, the other half of Jam's ask:** **never `git pull` a staged clone.** If one must
move, re-clone to a new directory. The labels are pinned to a tree; moving the tree silently
unpins them.

### Phase 5 — The dataset build, and the harvest (conditional on Phase 4)

`scripts/elm-dataset-build.mjs` — the layered writer, superseding `elm-corpus-build.mjs`'s single
flat JSON. `elm-corpus-build.mjs` stays, unmodified in its output contract, so v1/v2 remain
reproducible.

```
scripts/data/datasets/
  residue/rows.jsonl          identity · label · raw · features   (LLM-labelled)
  resolved/rows.jsonl         same schema                          (rule-labelled)
  graphs/<repo>@<commit>.json      edges, external, summary — as collected
  inventory/<repo>@<commit>.json   files[] — as collected
  pkg-families.json                the curated map
  manifest.json                    schema version · per-file sha256 · row counts · class
                                   distribution · per-repo teacher + commit · normaliser used ·
                                   normalisation statistics · blockEnergy · split seed
  FEATURES.md                      every feature: derivation, why it transfers, what is withheld
```

- **`resolved` costs zero LLM calls** — `elm-archetype-corpus-sanity.json` already holds 473
  algorithmic rows (12 classes, `page` 7.8%, `component` 15.2%).
- **The seeded split ships as a column, not two files.** Seed 42, holdout 0.25, stratified.
  **Do not re-split** — it makes results incomparable to everything in `ELM-FINDINGS.txt`.
- **JSONL, not one array:** streamable, greppable, and a corrupt line costs one row.

**Harvest order — by class need, never by count** (`TN-N12`). Pin the teacher in each target repo
**before** analyzing (`<repo>/.n-dx.json` → `llm.claude.model`) or it silently takes
`NEWEST_MODELS.claude`, which is how the current corpus acquired two teachers and no record of it.

| # | repo | already staged | targets |
|---|---|---|---|
| 1 | `nest` | cloned, never analyzed | `middleware`, `service`, `model` |
| 2 | `remix` | cloned, never analyzed | **`route-module` — no other ecosystem produces it** |
| 3 | `payload` | cloned, never analyzed | `model`, `schema`, `collection`-shaped |
| 4 | `svelte` | analyzed **rules-only, 0 LLM rows** | `component`, `store` |
| 5 | `typeorm` | analyzed **rules-only, 0 LLM rows** | `model`, `schema` |

Floor **30 rows/class**, target **50** — from our own recall data (`entrypoint` 59 rows → 85%
recall; `types` 34 → 42%; 1–2 rows → **0%**). Budget ~150 calls ≈ **$12–30**; money is not the
constraint, collisions are.

### Phase 6 — Publish the warranty with the data

`FEATURES.md` and the `ELM-CORPUS.md` caveats travel with the rows or the rows do not ship. Both
must state, in their own words:

- the teacher is **72.3% against truth**, and is **not shown the path only** — it sees
  `[partial signals]` from the algorithmic pass, so these labels are a strong model agreeing or
  disagreeing with a weak rule guess, **not an independent judgement**;
- `residue` is the rules' **leftovers**, not the repo — and `resolved` buys catalog coverage but
  **no capability at our own call site**, because the rules catch every `page` before the residue
  tier sees one;
- only `role: "source"` is ever classified — **825 of n-dx's 1,525 files never reach either model**;
- **percentile features are defined only relative to a population, and a single-file consumer is
  outside the tested envelope**;
- **block scaling is the consumer's choice**, with the measured energies so they can make it;
- the contamination boundary: gold set #2's 250 **blind**, gold set #1 **spent/DEV**, and the
  **105 unsampled hono/trpc candidates are NOT free** — harvesting them destroys the only
  fresh-ecosystem instrument we own.

---

## Test strategy

**Unit** (`scripts/` are not in the vitest suite, so these are assertions inside the scripts, run on
every invocation — the pattern `assertHarnessCanLearn()` already established):

- `elm-features.mjs`: a real `inDegree: 0` never serialises as missing, and a missing measurement
  never serialises as `0`. This is the defect class that produced a fabricated omission count.
- Percentile of a known fixture reproduces the hand-computed 12.5th (n-dx) / 72.7th (commerce).
- All three normalisers are monotone in the raw value.
- `pkgFamily` is closed: an unmapped package yields `[]`, never a new family.
- **The builder refuses to emit a row from hono or trpc** — asserted on **repo identity**, not path,
  because the existing path-level assertion would *pass* on the 105.

**Integration**
- **Parity control (Phase 2)** — the new harness reproduces 33.8% / 28.0% / 35.8% / 24.3% on the
  frozen v2 model. **Gates every downstream number.**
- `elm-dataset-build.mjs` round-trips: manifest checksums verify, JSONL line count equals manifest
  row count, and the seeded split is byte-reproducible across two runs.
- The committed loader materialises a feature matrix in the declared column order.

**Claimed fixes, red-first** — this IMPL claims no fix to existing behaviour. The one place it
would is `elm-corpus-build.mjs`'s `zone` emission, and that is a *policy* change (zone leaves
`features`), asserted by a test that fails against today's output.

**Must stay green:** `pnpm typecheck`; `npx vitest run tests/` at the root (**not** `pnpm test` —
it aborts in rex's flaky 200-item perf test before ever reaching `tests/e2e/`);
`tests/e2e/architecture-policy.test.js`; `tests/e2e/domain-isolation.test.js`. New scripts shell out
to nothing, so **no `ALLOWED` entry is required** — if that changes, it is claimed in `IN-FLIGHT.md`
first, because `tests/e2e/**` is shared.

---

## Rollback

**Phases 0–4 are additive and reversible by `git revert`.** They create new scripts and new data
files, modify no production code, and regenerate no existing artifact. `v1`, `v2`, the frozen
models and `elm-coverage-v2.log` are never rewritten.

**Phase 5's harvest is NOT fully revertible, and revert is not enough:**

1. **`sourcevision analyze --full` writes `.sourcevision/` into the TARGET repo**, under
   `~/n-dx-elm-corpus/`, which **no git worktree isolates and no revert touches.** Backing out means
   deleting those directories by hand; the staging tree is not version-controlled.
2. **LLM calls are spent and unrecoverable.** This is the phase gated behind Phase 4 for that reason.
3. **If a harvest contaminates the blind set** — a hono/trpc row reaching `residue` — **revert does
   not restore the instrument**, because the contamination is epistemic: the model has seen the
   ecosystem. The mechanical guard (repo-identity assertion) exists because rollback cannot help
   here.

**Concurrency:** the staging tree is shared and unlocked. Any harvest is claimed in `IN-FLIGHT.md`
before it starts and released after. Two agents analyzing at once corrupt each other silently.

---

## Risk register

| # | risk | likelihood | mitigation |
|---|---|---|---|
| 1 | **Structural features do not move coverage** | real — untested | Phase 4 is designed to find this cheaply. Outcome is a published negative, not a sunk harvest. |
| 2 | Parity control fails — new harness ≠ old | moderate | Blocks all downstream numbers by construction. Debug against the committed log's exact invocation and hashes. |
| 3 | **`TJ-A3` lands and moves the taxonomy** | high — it is live and unpushed | `catalogVersion` per row. ⚠️ Scriptable for renames and merges **only**; `algorithm` is a class *split* and needs a human or the teacher. Do not quote "relabel is a script" as though the risk were handled. |
| 4 | Block scale chosen by accident | **was certain before § 3a** | Declared contract, `blockEnergy` in the manifest, swept in Phase 3. |
| 5 | A normaliser laundering the repo prior | real | Three candidates swept; `pooled` is the repo-independent one and also solves the runtime case. |
| 6 | Isolated files carry no graph signal (1.2%–42.2% across repos; **25.9% of hono's and 8.9% of trpc's eval rows are touched by no import edge**) | certain | Explicit `isolated` flag; never a silent zero vector. Report coverage split by isolated/connected. |
| 7 | OOM mistaken for a clean run | **has happened — exited 0 with an empty table** | Every run asserts its output table is populated. Never trust the exit code. |
| 8 | Harvest collides in the shared staging tree | moderate | `IN-FLIGHT.md` claim before, release after. |
| 9 | Contaminating the blind 250 | low, catastrophic | Repo-identity assertion in the builder; path-level checks are insufficient and would pass. |
| 10 | Scope creep into the tier | moderate | Out-of-scope list above. The model is Jam's. |

---

## Open questions

- ~~ADR still Proposed~~ **ACCEPTED 2026-09-18.** Phase 5 is unblocked *procedurally*; it remains
  gated *technically* on Phase 4's result, which is the point of the plan.
- ~~repo access~~ **RESOLVED — the repo is public.** One consequence replaces it, and it is not
  smaller: **public is permanent.** Anything shipped can be trained on by a stranger who will never
  read a note, so `FEATURES.md` and the § 6 warranty stop being courtesy and become the deliverable's
  load-bearing half.
- **For Syrup:** the row schema, before any harvest at scale. **Agreed and owed** — they have
  measured three models against three populations and can say whether a schema survives the coverage
  check, which is far cheaper than discovering it after the spend.
- **For Jam:** does the `pooled` normaliser interact with B+su? The operating point is *also*
  rank-based (a 13-class softmax caps confidence at 0.245), so the stack carries two rank
  normalisations and no absolute anchor. Jam records the single-file gap as theirs.
- **For Jarrett (no note sent — drafting is mine, sending is Nolan's):** their harness consumes a
  numeric evidence vector and its zero-evidence guard (`classify-elm.ts:350`) skips 100% of the
  path-text population. **A structural dataset is closer to what they already consume than our path
  corpus ever was.** As of 2026-09-18 they do not know this ADR or IMPL exists.
- **`TN-J22` — DEFERRED by the lead 2026-09-18** ("we will deal with the teacher problem later if
  it arises"). Recorded rather than dropped, because it is still **the only lever on label quality**
  and the condition under which it *arises* is knowable in advance: **if Phase 4 passes PRIMARY but
  the tier later plateaus below the human path-only ceiling of 85.4%, the teacher's 72.3% is the
  ceiling being hit** — not the feature space, and not the corpus size.
