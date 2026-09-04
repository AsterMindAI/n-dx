# The archetype corpus — a shared asset

**Maintainer:** K2 (Team Nolan) · **Written 2026-09-04** · Backlog `TN-J32`

This documents the labelled path→archetype corpus so it survives Team Nolan. It was built for
one specific task — the `sourcevision` ELM classification tier — but it is a general
**path-string → label** dataset and is reusable by any team's ELM work. **If Team Nolan's tier
is not the design that ships, the corpus still has value; this file is what makes it usable by
someone who was not here when it was built.**

Read § 6 before you train anything on it. The corpus has a known, measured failure mode.

---

## 1. What it is

Each row is one source file's **repo-relative path string** and one **archetype label**
(`service`, `utility`, `entrypoint`, …). Nothing else — no file contents, no AST, no imports.
The task is: given only a path, predict the archetype.

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

1. **`elm-corpus-build.mjs` does not capture the resolved teacher model.** The provenance block
   has no model field. The table above was derived on 2026-09-04 by reading the `.n-dx.json` pins
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

**Corpus v2 is the attempted fix for exactly this, and it is UNVALIDATED.** It widens the
ecosystem count 2 → 7 and drops the `service`+`utility` share 73.8% → 63.6%, which is the right
shape of intervention. **But the coverage re-check has not been run against v2.** Nobody has
demonstrated that v2 generalises. Do not assume it does because it is bigger.

The cheap way to check, which needs **no ground truth and no LLM spend**: predictions alone tell
you whether the class prior has collapsed. `scripts/elm-coverage-check.mjs`. Run it on a repo
that is not in the table above before you trust anything.

## 7. The contamination boundary

Three populations. **Keep them separate or your numbers mean nothing.**

| Population | Files | Status |
|---|---|---|
| **Training corpus** (v1, v2) | 624 | Train freely. |
| **Gold set #1** — `scripts/data/k2-goldset-packet.csv` | 83 | **SPENT.** Labels have been read. It is a DEV set now. Iterate against it, never publish a number from it without labelling it `DEV`. |
| **Gold set #2** — hono + trpc, 250 sampled files | 250 | **BLIND and unlabelled.** Never train on these. Contamination-checked mechanically: 0 of 355 candidates appear in corpus #1, asserted by the packet builder, which refuses to build otherwise. |

**105 of gold set #2's 355 LLM-labelled candidates were never sampled into the packet.** Those
are free training rows — already paid for in LLM calls — and they can extend the corpus while the
250 stay clean. That is the cheapest available corpus expansion and it is unclaimed.

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

## 11. Related

| Thing | Where |
|---|---|
| Full findings ledger, with provenance | [`ELM-FINDINGS.txt`](ELM-FINDINGS.txt) — §13–15 are the corpus-relevant ones |
| Onboarding for the classification tier | [`K2-HANDBOOK.md`](K2-HANDBOOK.md) |
| Corpus builder | `scripts/elm-corpus-build.mjs` |
| Generalisation / coverage check (no labels needed) | `scripts/elm-coverage-check.mjs` |
| Architecture sweep + its pre-registered grid | `scripts/elm-architecture-sweep.mjs` |
| Claim board | [`BACKLOG.md`](BACKLOG.md) — `TN-J9`, `TN-J31`, `TN-J32` are the open corpus items |
