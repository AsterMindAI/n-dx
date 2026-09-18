# The archetype corpus — a shared asset

**Maintainer:** Nutella (Team Nolan) · **Written 2026-09-04 by K2 · substantially amended 2026-09-16**
· Backlog `TN-N6`

> **Amendments of 2026-09-16 (Nutella), listed up front because two of them retract things this
> document previously asserted:**
> 1. **§ 7 — the "105 free training rows" claim is RETRACTED.** Do not harvest them.
> 2. **§ 4 — "the builder does not record the teacher model" is CORRECTED.** It does; `TN-J31`
>    needs a rebuild, not a code change.
> 3. **§ 1a / § 5a — this corpus is the rules' *residue*, not the repo.** This is the mechanism
>    behind every thin class, and more repos will not fix it.
> 4. **§ 5b — a third artifact exists** (`elm-archetype-corpus-sanity.json`), and it is the inverse
>    population. The two now ship as **two datasets with two warranties**.
> 5. **§ 3a — the teacher is NOT shown the path only.** These labels are not an independent
>    judgement of archetype.
> 6. **§ 10a — `ELM.train()` does not train on what you pass it.** The repo's own smoke test scores
>    83% with no training data.
> 7. **§ 6 — the coverage check is not cheap to run, and a v2 coverage number is circulating with
>    no artifact behind it.**
>
> **Amendment of 2026-09-18 (Nutella), and it supersedes item 7:**
> 8. **§ 6 — CORPUS v2 HAS NOW BEEN MEASURED.** **33.8% on trained-on ecosystems (PASS), 28.0% on
>    fresh ones (K1′ FAIL)**; hono passes at 35.8%, trpc fails at 24.3%. The circulating 28.0% was
>    correct to the decimal and is now committed with its invocation. **Every "v2 is unvalidated"
>    sentence in this document is superseded** — v2 improves on v1 substantially (13.2% → 28.0%)
>    and still does not clear the bar.

This documents the labelled path→archetype corpus so it survives Team Nolan. It was built for
one specific task — the `sourcevision` ELM classification tier — but it is a general
**path-string → label** dataset and is reusable by any team's ELM work. **If Team Nolan's tier
is not the design that ships, the corpus still has value; this file is what makes it usable by
someone who was not here when it was built.**

Read § 6 before you train anything on it. The corpus has a known, measured failure mode.

---

## 1. What it is

Each row is one source file's **repo-relative path string** and one **archetype label**
(`service`, `utility`, `entrypoint`, …). The task is: given only a path, predict the archetype.

> ⚠️ **Two amendments added 2026-09-16 (Nutella) that change what this dataset IS. Read them before
> § 2.**
>
> **(a) This is not "every file in the repo." It is the residue the rules could not classify.**
> The builder harvests `source: "llm"` rows, and that population is what is left *after* the
> algorithmic pass has run (`classify.ts:355` selects `archetype === null && source ===
> "algorithmic"`). A file the rules classify confidently never reaches the teacher, never gets an
> LLM label, and **can never enter this corpus.** See § 5a — this is the mechanism behind every
> thin class, and more repos will not fix it.
>
> **(b) Rows may now carry more than the path.** As of `elm-corpus-build.mjs` 2026-09-16, a build
> also emits `role`, `language`, `loc`, `inDegree`, `outDegree` and `zone` per row, joined from
> `inventory.json` / `imports.json` / `zones.json`. **The two committed artifacts below predate
> this and carry the path only** — read `provenance.rowColumns` to see what a given artifact
> actually has, rather than assuming.

Labels come from **an LLM, not from humans.** That is the single most important fact about this
dataset and § 3 explains what it costs you.

There are two generations. **Both are kept**; v1 is not deleted, because Phase 1 and Phase 2
results are only reproducible against it.

| | v1 | v2 |
|---|---|---|
| File | `scripts/data/elm-archetype-corpus.json` | `scripts/data/elm-archetype-corpus-v2.json` |
| Rows | 324 | **624** |
| Ecosystems | 2 | **7** |
| Classes | 13 | **16** |
| `service`+`utility` share | 73.8% | **63.6%** |
| Majority baseline | 37.3% (`service`) | **38.3% (`utility`)** |
| Status | superseded, kept for reproducibility | **current, but see § 6** |

Built 2026-09-01 at commit `1a5403c6`. v2 cost **13 classify calls** on top of v1's spend
(express 1, fastify 2, commerce 1, got 1, Vue core 8).

## 2. Schema

`schema: "elm-archetype-corpus/v1"` (the schema string is v1 in *both* files — it describes the
row format, not the corpus generation; do not read it as a version marker).

```json
{
  "schema": "elm-archetype-corpus/v1",
  "generatedAt": "...", "generatedBy": "scripts/elm-corpus-build.mjs",
  "provenance": { "sources": ["llm"], "seed": 42, "holdout": 0.25, "repos": [ ... ] },
  "stats": { "total": 624, "classes": 16, "distribution": {...},
             "majorityBaseline": {...}, "thinClasses": [...] },
  "train":    [ { "text": "packages/sourcevision/src/cli/serve.ts",
                  "label": "cli-command", "confidence": 0.7,
                  "source": "llm", "repo": "n-dx-1" } ],
  "heldOut":  [ ... ]
}
```

**Builds from 2026-09-16 onward add optional measured columns** (`TN-N7`) and three provenance
fields. A row becomes:

```json
{ "text": "packages/sourcevision/src/cli/serve.ts", "label": "cli-command",
  "confidence": 0.7, "source": "llm", "repo": "n-dx-1",
  "role": "source", "language": "TypeScript", "loc": 47,
  "inDegree": 2, "outDegree": 0, "zone": "sourcevision" }
```

- **`provenance.rowColumns`** — the union of columns actually present. **Read this; do not infer
  from the `schema` string**, which is deliberately unchanged (the corpus generations are already
  called v1/v2, and a second unrelated "v2" on the schema line is exactly the ambiguity this section
  warns about).
- **`provenance.repos[].featuresAvailable`** — which of `inventory` / `imports` / `zones` were on
  disk for that repo.
- **`provenance.repos[].omittedByLlm`** — how many files the teacher was shown and declined (§ 3a).

**Columns are optional per repo and are never fabricated.** A repo analyzed without an import graph
contributes rows with no degree fields, because a real `inDegree: 0` — nothing imports this file —
is a meaningful signal and must not be confused with "not measured".

**The split is seeded and stratified** (seed 42, 25% held out, mulberry32). Re-running the build
on the same inputs reproduces it byte for byte. This is deliberate: *a corpus whose split cannot
be reproduced cannot be used to compare two models.* **Do not re-split.** If you re-split, your
numbers are not comparable to anything in `ELM-FINDINGS.txt`.

v2: `train` 464 rows · `heldOut` 160 rows.

## 3. The labels are a teacher, not truth

Every label was produced by an LLM classify pass. On corpus v1 we measured that teacher against
human judgement:

- **LLM vs human truth: 72.3%.** The labels you are training on are ~28% wrong.
- **Human path-only ceiling: 85.4%.** A human given only the path reproduces their own
  content-informed judgement this often. Paths are informative, but this is the ceiling on *any*
  path-only classifier, including yours.

So a CV score against this corpus measures **agreement with the teacher**, not accuracy. A model
at 68% CV is not "68% correct"; it is 68% in agreement with a source that is itself 72% correct.
**Never quote a CV number from this corpus as an accuracy figure without saying which it is.**

### 3a. ⚠️ The teacher is NOT shown the path only — added 2026-09-16

Earlier revisions of this file, and `K2-HANDBOOK.md` § 9, both describe the classify prompt as
path-based. **It is not** (`TN-J26`, filed, still unquantified). Each file reaches the teacher as
its path **plus `[partial signals: service(0.7), utility(0.3)]`** carried over from the algorithmic
pass — and `evidence` is populated whenever *any* signal matches (`classify.ts:159`), independent of
the `PRIMARY_THRESHOLD` that made the file unclassified in the first place. It also sees the full
17-archetype catalog **with prose descriptions**, and 29 sibling paths in the same batch.

**What that means for anyone training on these labels, stated plainly because it is easy to miss:**
these labels are **not an independent judgement of archetype.** They are a strong model agreeing or
disagreeing with a weak rule guess it was shown. **A consumer training on the path string alone is
learning from a teacher that had strictly more information than they will ever give their student.**

Two further per-row variables vary and are **recorded nowhere** (`TN-N8`, open):

- **The retry ladder silently swaps the prompt.** `computeLLMClassifyAttempts`
  (`classify.ts:394-396`) is `full → compact (archetype descriptions dropped) → compact + batch
  halved to 15`. `promptLevel` is only `console.log`'d at `:418-420`, never persisted. **An unknown
  share of rows were labelled by a materially weaker prompt and no artifact records which.**
- **Batch composition is uncontrolled.** `LLM_BATCH_SIZE = 30` (`:322`); all 30 paths share one
  context window. **Re-running the build over the same repo at a different file ordering may not
  reproduce the same labels.** Never measured in either direction. For a *dataset*, that is a
  reproducibility property, not a curiosity.

**Abstention is invited and, until 2026-09-16, was uncounted.** The prompt ends `"Omit files with no
clear fit"` (`:509`). Vue core returned **23 of 303 files unclassified** — previously visible only as
a smaller `harvested` count, indistinguishable from a file the rules had caught. Builds now record
`omittedByLlm` per repo, and return **`null`, never 0**, when the LLM pass did not run, because "not
measured" and "zero omissions" are different facts.

Known label pathology, measured on v1: **`utility` is the teacher's sink for uncertainty.** On
held-out files whose truth is not `service`/`utility`, the LLM made 7 errors and 6 of them
collapsed a minority class into `service`/`utility`. This is directional, not random noise — a
student cannot average it out.

## 4. Provenance

Seven repos, all analyzed with the LLM classify pass enabled (`--source=llm`; rule-derived labels
are deliberately excluded — see the warning at the top of `elm-corpus-build.mjs`).

| Repo | Rows | Commit | S+U | Classes | Teacher |
|---|---:|---|---:|---:|---|
| n-dx-1 | 255 | `90e5bdb7` | 79% | 13 | **`claude-sonnet-4-6`** |
| Vue `core` | 212 | `d63616ca` | 58% | 9 | `claude-sonnet-5` |
| AsterMind-CE | 69 | `7a2d763f` | 52% | 4 | `claude-sonnet-5` (default) |
| fastify | 48 | `4cdb0c5d` | 40% | 9 | `claude-sonnet-5` |
| express | 17 | `023767fe` | 53% | 4 | `claude-sonnet-5` |
| commerce | 15 | `3761e52e` | 60% | 4 | `claude-sonnet-5` |
| got | 8 | `64f21e2a` | 0% | 2 | `claude-sonnet-5` |

### ⚠️ The corpus is labelled by TWO teachers, and the artifact does not say so

**255 rows (40.9%) are `claude-sonnet-4-6`; 369 rows (59.1%) are `claude-sonnet-5`.** `n-dx-1`
carries a `.n-dx.json` pinning `claude-sonnet-4-6`; the five v2 repos each pin `claude-sonnet-5`;
AsterMind-CE has no config and falls through to `NEWEST_MODELS.claude`, which is
`claude-sonnet-5` (`packages/llm-client/src/config.ts:35`).

This is `TN-J31`, still open. Two things follow, and both matter to you:

1. ~~**`elm-corpus-build.mjs` does not capture the resolved teacher model.** The provenance block
   has no model field.~~ **CORRECTED 2026-09-16 (Nutella): the script DOES capture it**, at
   `elm-corpus-build.mjs:120-144` with a mixed-teacher rollup at `:214-273`, added in commit
   **`b4fde7b2`** — *the same commit that wrote this sentence saying it did not.* Verified by
   execution: a fresh build of n-dx records `claude-sonnet-4-6, pinned`, and a four-repo build
   correctly reports `distinct: 2, mixed: true`. **The two committed artifacts still lack the field
   because v2 was built 2026-09-01, before that commit.** So `TN-J31` needs **a rebuild, not a code
   change** — anyone who budgeted script work for it can stop. The statement below remains true of
   the artifacts: The table above was derived on 2026-09-04 by reading the `.n-dx.json` pins
   in the staging tree — it is **recovered, not recorded.** Per this project's own rule
   (`K2-HANDBOOK.md` § 6.2), that distinction is stated rather than smoothed over: I did not
   hand-edit it into the JSON, because a backfilled provenance block would then claim to be
   build-time evidence when it is not.
2. **The staging tree is not version-controlled and its recorded path is already stale.** The
   provenance says `/Users/nolanmoore/n-dx-elm-corpus/…`; the tree actually lives at
   `/Users/nolanmoore/Work/n-dx-elm-corpus/`. The git commits in the table are the real
   provenance — they are re-clonable. The teacher pins are not, once that laptop is gone.

**If you rebuild or extend this corpus, fix `elm-corpus-build.mjs` to record the resolved model
per repo first.** It is a small change and it closes `TN-J31` for good.

## 5. Class distribution (v2)

```
utility        239        route-handler   17        schema          2
service        158        config          15        model           2
entrypoint      79        component       11        route-module    2
types           46        middleware       8        hook            1
test-helper     29        cli-command      6
                          gateway          6
```

**Majority baseline: 38.3% (`utility`).** Recompute it for your own split rather than quoting
this — that rule exists because a baseline quoted from a document was wrong once already.

**Eight classes are below 10 rows** (`middleware`, `cli-command`, `gateway`, `store`, `schema`,
`model`, `route-module`, `hook`). A model cannot reliably emit a class it has two examples of,
and on v1 it could not emit zero-row classes *at all* — which is precisely what broke Phase 3.

## 5a. ⚠️ Why the thin classes are thin — and why more repos will not fix it

**Added 2026-09-16 (Nutella), from Jam's measurement, verified independently.** This is the single
most useful thing to understand before planning a harvest.

The builder takes the **residue** (§ 1a). The algorithmic pass resolves the *structurally obvious*
classes confidently — those files never reach the teacher, so they can never enter this corpus.
Measured on n-dx, by label source:

| archetype | in corpus (v2 share) | n-dx rule-labelled | n-dx LLM-labelled |
|---|---:|---:|---:|
| component | 1.8% | **71** | 0 |
| cli-command | 1.0% | **63** | 6 |
| store | 0.5% | **51** | 3 |
| **page** | **0.0%** | **37** | **0** |
| hook | 0.2% | **28** | 1 |
| route-handler | 2.7% | **25** | 7 |
| schema | 0.3% | **13** | 1 |

**293 n-dx files sit in the thin classes, every one rule-labelled, none in the corpus.** The
right-hand columns match the corpus exactly, which means **every LLM-labelled n-dx file is already
harvested** — there is nothing left to pick up cheaply.

`page` is the clean case: **37 files in n-dx, all caught by rules, zero reaching the teacher.**
Independently confirmed — the sanity corpus (§ 5b) contains exactly **37** `page` rows. In any repo
where the `page` signals fire, the same thing happens. **Adding `nest`, `remix` and `payload` will
not produce `page` rows through the current builder** — it will produce rows for whatever *those*
repos' rules happen to miss.

Also structural, and it caps coverage regardless of repo count: **classification only ever sees
`role: "source"`.** n-dx's `inventory.json` is **1,525 entries — test 825 · source 683 · build 10 ·
config 6 · docs 1.** So **825 files, 54% of the repo, never reach either model — while `test-helper`
is one of the 17 archetypes this corpus is supposed to cover.** v2's 29 `test-helper` rows come from
other repos' helpers that happened to land on the source side of the role split.

**There is no flag that makes the LLM label every file.** Labelling the whole repo means a
standalone harness; `buildLLMClassifyPrompt` is module-private, but `scripts/elm-token-baseline.mjs:112`
already replicates it verbatim, so it is a fork of that script rather than an edit to
`classify.ts`.

## 5b. The other half: `elm-archetype-corpus-sanity.json`

**473 rows, 12 classes, `sources: ["algorithmic"]`**, n-dx 428 + AsterMind-CE 45. Committed
2026-08-13 as a baseline sanity check and unused since. Verified 2026-09-16.

```
utility 23.0% · component 15.2% · cli-command 13.3% · entrypoint 11.2%
store 11.0% · page 7.8% · hook 5.9% · route-handler 5.3% · types 3.2% · schema 2.7%
```

**Every class v2 starves of, this one has in quantity** — because it is the *inverse* population:
the files the rules caught. Its distribution is far flatter than v2's.

> 🔴 **Do not merge it into v2.** A corpus where a row's label means "a teacher's judgement" *or*
> "a regex fired" depending on which half it came from, **with nothing in the row recording which**,
> is the same defect as § 4's two unrecorded teachers — and that one took 19 days to find.
>
> **Lead's decision 2026-09-16 (`TN-N4`): they ship as TWO DATASETS with two warranties.** Between
> them they cover all 17 archetypes, at **zero additional LLM cost**.

## 6. ⚠️ The known failure mode — read this before training

**Corpus v1 produced a model that did not generalise.** Measured 2026-09-01 (`TN-J32`,
`scripts/elm-coverage-check.mjs`):

| | trained-on ecosystems | **fresh** ecosystems (hono, trpc) |
|---|---|---|
| ELM predicts `service`/`utility` | 72.3% | **96.4%** |
| Teacher says `service`/`utility` | 72.3% | 48.4% |
| Distinct labels emitted | 9 of 13 | **5 of 13** |

On repos it was trained on, the model's class prior tracked the teacher *exactly*. On two unseen
repos it collapsed onto the majority class — 241 of 250 files predicted `service`/`utility`.
**The model learned n-dx's archetype prior, not a path→archetype mapping.**

This was predicted 19 days earlier by `TN-J9` ("the corpus needs ecosystem diversity, not more
repos"), filed 2026-08-13 and left unclaimed.

### ⚠️ Corpus v2 HAS NOW BEEN MEASURED — it improves substantially and still FAILS

**Measured 2026-09-18 by Jam, artifact committed at `scripts/data/elm-coverage-v2.log`** with its
full invocation, input hashes and library version. This supersedes every "v2 is unvalidated"
statement in earlier revisions of this document.

| population | coverage | K1′ (≥30%) | ELM `service`/`utility` | teacher | distinct labels |
|---|---:|---|---:|---:|---|
| held-out, **trained-on** ecosystems (n=160) | **33.8%** | **PASS** | 73.8% | 62.5% | ELM 10 / teacher 15 |
| **gold set #2, FRESH ecosystems (n=250)** | **28.0%** | **FAIL** | **80.0%** | **48.4%** | **ELM 7 / teacher 13** |
| ↳ hono only (n=81) | 35.8% | PASS | 71.6% | 45.7% | ELM 6 / teacher 8 |
| ↳ **trpc only (n=169)** | **24.3%** | **FAIL** | 84.0% | 49.7% | ELM 5 / teacher 12 |

**Read this carefully, because it says two things and only one of them is bad news.**

**The ecosystem-diversity fix worked, and worked substantially.** Fresh-ecosystem coverage went
**13.2% (v1) → 28.0% (v2)** and the `service`/`utility` collapse eased from **96.4% → 80.0%**
against a teacher's 48.4%. Widening 2 → 7 ecosystems was the right intervention and `TN-J9` was
right. **It did not reach the 30% bar.** More ecosystems is a real lever that does not get there on
its own.

**K1′ is a property of (model, repo), not of the model.** hono **passes** at 35.8% and trpc
**fails** at 24.3% — same model, same run. **Never quote a coverage number without naming its
repo.** The script's own closing line says this, and it is the most transferable thing in the
result.

**What this means if you are about to train on v2:** it generalises *better* than v1 and *not well
enough* to ship behind K1′. The residual failure is now the strongest available evidence that the
problem is the **feature space** rather than the sample — which is what
[`ADR-2026-09-17-nutella-elm-training-database-construction.md`](../ADR/ADR-2026-09-17-nutella-elm-training-database-construction.md)
is designed against. **28.0% is the number any successor must beat, on these same 250 files, at
this same operating point.**

The way to check needs **no ground truth and no labels**: predictions alone tell you whether the
class prior has collapsed. `scripts/elm-coverage-check.mjs`. Run it on a repo that is not in the
table above before you trust anything.

> ⚠️ **Two corrections to the sentence above, both added 2026-09-16.**
>
> **It is not cheap to run.** The frozen artifact stores a **recipe, not weights** — which is why it
> is 12.9 KB — so the check re-fits all nine 4096-unit models and holds them live. On corpus v2 it
> dies at ~1978 MB against node's ~2096 MB default: `FATAL ERROR: CALL_AND_RETRY_LAST Allocation
> failed`. It never surfaced earlier because it fit at 1024 units. Route through:
> `node --max-old-space-size=6144 scripts/elm-coverage-check.mjs --frozen=…`. (Jam, `TN-J32`.)
>
> **⚠️ A v2 coverage number is in circulation with no artifact behind it.** A Team Nolan note dated
> 2026-09-16 states corpus v2 reaches *"28.0% on fresh ecosystems … still under the 30% bar."*
> **Do not quote it.** As of this writing there is **no committed coverage artifact for v2, no
> recorded seed, and no recorded script invocation** — and Jam, who holds `TN-J32`, states the check
> is unrun. It may well have been run locally; if so it needs committing with its seed and baseline
> before it becomes a fact. This project's own rule applies: *if it isn't a committed, seeded script
> another team can run, it didn't happen.* **Until then, v2's central property remains untested.**
>
> ### ✅ RESOLVED 2026-09-18 — the number was right, and it is now committed.
>
> Jam ran the check on the lead's authorisation. **Gold set #2 coverage is 28.0%, K1′ FAIL** —
> matching the circulating figure **to the decimal**. The artifact is at
> `scripts/data/elm-coverage-v2.log` with its invocation, input hashes and library version, so the
> process gap (a number without a committed invocation) is closed and the number stands. Jam has
> retracted, in place, the suggestion that it was "narratively convenient"; Syrup measured
> correctly and reported accurately. **The only substantive lesson that survives is the cheap one:
> the fastest way to test whether a number is real was always to go and measure it.**
>
> ⚠️ **The OOM is real and the flag is mandatory** — the run needs
> `--max-old-space-size=6144`, because the frozen artifact stores a recipe rather than weights and
> the script re-fits nine 4096-unit models.

## 7. The contamination boundary

Three populations. **Keep them separate or your numbers mean nothing.**

| Population | Files | Status |
|---|---|---|
| **Training corpus** (v1, v2) | 624 | Train freely. |
| **Gold set #1** — `scripts/data/k2-goldset-packet.csv` | 83 | **SPENT.** Labels have been read. It is a DEV set now. Iterate against it, never publish a number from it without labelling it `DEV`. |
| **Gold set #2** — hono + trpc, 250 sampled files | 250 | **BLIND and unlabelled.** Never train on these. Contamination-checked mechanically: 0 of 355 candidates appear in corpus #1, asserted by the packet builder, which refuses to build otherwise. |

> 🔴 **RETRACTED 2026-09-16 (Nutella). The sentence that stood here was wrong, and it had already
> propagated into two other documents before it was caught.** It read: *"105 of gold set #2's 355
> LLM-labelled candidates were never sampled into the packet. Those are free training rows —
> already paid for in LLM calls — and they can extend the corpus while the 250 stay clean. That is
> the cheapest available corpus expansion and it is unclaimed."*
>
> **Do not harvest the 105 rows.** Verified from `scripts/data/k2-goldset2-llm-labels.json`:
> `poolSize: 355`, `sampled: 250`, `seed: 20260901`, `totalClassifyCalls: 12`, and the provenance
> array lists **exactly two repos — hono and trpc.** So the 105 remainder are files *from those same
> two repos*, and **hono and trpc are the only fresh ecosystems this project has ever measured
> generalisation against.**
>
> Harvesting them does leave the packet's 250 human-blind — that much is true, and it is why the
> claim survived review twice. What it also does is put **hono and trpc paths into the training
> vocabulary**, after which a coverage check on gold set #2 is no longer a fresh-ecosystem test. It
> becomes a held-out test on a trained-on ecosystem — **precisely the instrument that failed to
> detect v1's collapse (§ 6).**
>
> **Why the existing guard does not catch it:** `elm-goldset2-packet.mjs` asserts that 0 of 355
> candidates appear in corpus #1 and refuses to build otherwise — but that assertion is
> **path-level**, and it would **pass** on this harvest, because the 105 and the 250 are different
> files. **The contamination is at the ecosystem level, which is the level v1 died at.** Nothing
> asserts on that.
>
> **What to do instead:** stage and analyze genuinely new repos as replacement probes *first*, then
> spend the 105 knowing what it costs. 105 rows against 624 is ~17%; the only detector we own for
> the failure this corpus exists to fix is worth more than 17% more rows.
>
> Found by Jam, verified independently by Nutella. **If you are reading this claim anywhere else it
> is stale** — it had reached `NOTE-…-nutella-scope-and-database-mission.md` § 6 and
> `NOTE-…-syrup-to-nutella-corpus-groundwork.md` § 9 before it was caught. Both are corrected.

## 8. What is already on disk (the paid-for asset)

`/Users/nolanmoore/Work/n-dx-elm-corpus/` — **not version-controlled.** This is the part most
likely to be lost, so it is inventoried here. "LLM-labelled" rows are the ones that cost money.

| Repo | Classified | LLM-labelled | Used for |
|---|---:|---:|---|
| Vue `core` | 303 | 212 | corpus v2 |
| AsterMind-CE | 114 | 69 | corpus v1 + v2 |
| fastify | 52 | 48 | corpus v2 |
| express | 48 | 17 | corpus v2 |
| commerce | 64 | 15 | corpus v2 |
| got | 33 | 8 | corpus v2 |
| trpc | 498 | 238 | **gold set #2 — do not train on** |
| hono | 239 | 117 | **gold set #2 — do not train on** |
| svelte | 388 | **0** | analyzed rules-only — no LLM spend, no usable rows |
| typeorm | 563 | **0** | analyzed rules-only — no LLM spend, no usable rows |
| nest, payload, remix | — | — | **cloned, never analyzed** |

Two things worth noticing: **svelte and typeorm are analyzed but yielded zero LLM rows** (the
classify pass did not run — a `--fast` run costs nothing and produces nothing usable here), and
**nest / payload / remix are cloned and untouched.** Those five are exactly the ecosystems
`TN-J9` asked for — an ORM-backed API, a NestJS app, a Remix app. Whoever extends this corpus
next has the clones already staged and only needs the classify calls.

## 9. Rebuilding and extending

```sh
# Analyze a repo WITH the LLM classify pass (this spends calls; --fast spends none
# and yields no usable rows). Writes .sourcevision/ into the TARGET repo.
sourcevision analyze <repo> --full

# Pin the teacher in the target repo first, or it silently takes NEWEST_MODELS.claude:
#   <repo>/.n-dx.json  ->  { "llm": { "claude": { "model": "claude-sonnet-5" } } }

# Build. Default --source=llm is what you want; --source=algorithmic is a covariate-shift
# trap documented at the top of the script.
node scripts/elm-corpus-build.mjs <repo-path>... --out=scripts/data/<name>.json
```

Options: `--out` `--source` `--seed` (42) `--holdout` (0.25) `--min-class` (10) `--dry-run`.

Two cautions earned the hard way:

- **Stage target repos under a real home directory, never the session scratchpad.** `/private/tmp`
  was reaped mid-session once, leaving a husk and a silent `0 files cataloged` run that looked
  exactly like a regression.
- **`analyze` writes `.sourcevision/` into the target repo**, which no git worktree isolates.

## 10. If you are using this for a different task

The corpus is task-agnostic in shape — path string in, label out — so it transfers. What
transfers with it:

- **The seeded split.** Reuse seed 42 / holdout 0.25 so your numbers compare to ours.
- **The baseline discipline.** Recompute the majority baseline on your split. Report seed and
  baseline with every accuracy number, always.
- **The teacher caveat (§ 3).** If your task also treats these labels as targets, you inherit the
  28% teacher error and the `utility`-as-uncertainty-sink bias.
- **The generalisation test (§ 6).** Whatever you build, run a prediction-only class-prior check
  on a repo outside the seven. It is free, it needs no labels, and it is the single check that
  would have saved this project a labelling day.

What does **not** transfer: our tuning results. `hiddenUnits: 4096` + `tanh` is the adopted
configuration *for the 16-class archetype task on this feature space*, selected by train-only CV.
It is not a general recommendation. Re-sweep for your task — and before you do,
**list what your code is choosing on your behalf.** Two of the three largest effects found on
this project (`hiddenUnits` 256→1024, `relu`→`tanh`) were defaults nobody had ever chosen.

## 10a. 🔴 `ELM.train()` does not train on what you pass it

**Added 2026-09-16 (Nutella). Found by Team Thomas (Nala) first, relayed by Syrup, verified here by
execution.** If you take one operational fact from this document, take this one.

The base `ELM`'s text-mode `train()` has the signature
`train(augmentationOptions?, weights?)` (`dist/core/ELM.d.ts:59`). **Its first parameter is not
training data.** The implementation (`dist/astermind.esm.js:1146`) iterates `this.categories` and
trains on character-augmented variants of the **category label strings**. Pass it an array of
training rows and every property it reads is `undefined`, so it silently degrades to defaults. **No
error is thrown.**

Proved by reproducing `scripts/elm-hello-world.mjs`'s own held-out evaluation, varying *only* the
`train()` argument:

| `train()` argument | held-out score |
|---|---|
| the real 30-path training set | **5/6 (83%)** |
| the same paths with **inverted labels** | **5/6 (83%)** |
| an **empty array** | **5/6 (83%)** |
| **no argument at all** | **5/6 (83%)** |

Identical predictions in all four cases. **That script's 83% is produced with no training data**,
and it still prints `OK — library loads, trains, and generalizes under Node.` It scores well because
the label strings `route`, `component`, `test` happen to match the directory names in the held-out
paths.

**Use `trainFromData(X, y)` with explicit one-hot `y`.** (A second, separate trap: `trainFromData`
with *string* `y` also silently trains a degenerate model — `K2-HANDBOOK.md` § 5.)

**Blast radius — checked script by script, because a careless reading voids far more than it
should:**

| affected — base `ELM.train()` | **not** affected — `trainFromData` or a real wrapper signature |
|---|---|
| `scripts/elm-hello-world.mjs` | `elm-architecture-sweep` · `elm-certify` · `elm-coverage-check` · `elm-diagnostics` · `elm-feasibility-screen` · `elm-freeze-model` · `elm-goldset2-power` · `elm-k2-analysis` · `elm-operating-point` |
| `scripts/elm-prototype/*` (via `classifier.mjs:59`) | |

The two `.train()` calls in `elm-architecture-sweep.mjs:200` and `elm-operating-point.mjs:262` are
on **`VotingClassifierELM`** and **`ConfidenceClassifierELM`**, whose `train()` methods take real
data (`train(predictionLists, confidenceLists, trueLabels)` and `train(vectors, metas, labels)`).
**They are fine.**

**So the tier's headline numbers stand** — `tanh` +4.0 pp, `hiddenUnits` 4096, the operating points,
the coverage results, 72.3% / 85.4% / 54.4%. All were measured through `trainFromData`. **What is
void is the hello-world's 83% and the prototype's numbers.**

⚠️ **`scripts/elm-hello-world.mjs` is what `claude-context-instruction` § 1 and `NEW-AGENT.md`
Step 1 point every new agent at as proof the library works.** Both still do. Fixing the script and
the two onboarding documents is filed, not done — they are shared files.

Three further library gotchas worth having before you encode anything:

- `charSet` is interpolated **unescaped** into a RegExp character class — a literal `-` must come
  **last** or it forms an invalid range and throws.
- `charToOneHot` **lowercases** before lookup (`astermind.umd.js:762`), so uppercase charSet entries
  are unreachable dead slots that merely widen the input vector.
- `maxLen` truncates the **tail** — `maxLen: 32` on real paths discards the filename, which is the
  most informative part of a path.

## 11. Related

| Thing | Where |
|---|---|
| Full findings ledger, with provenance | [`ELM-FINDINGS.txt`](ELM-FINDINGS.txt) — §13–15 are the corpus-relevant ones |
| Onboarding for the classification tier | [`K2-HANDBOOK.md`](K2-HANDBOOK.md) |
| Corpus builder | `scripts/elm-corpus-build.mjs` |
| Generalisation / coverage check (no labels needed) | `scripts/elm-coverage-check.mjs` |
| Architecture sweep + its pre-registered grid | `scripts/elm-architecture-sweep.mjs` |
| Claim board | [`BACKLOG.md`](BACKLOG.md) — `TN-J9`, `TN-J31`, `TN-J32` are the open corpus items |
