# ADR — Clear K1′ by class-targeted harvest: fix what the model cannot emit, not what it is fed

- **Status:** **ACCEPTED 2026-09-21 by the lead** ("get started with the work"). A new experiment
  with its own pre-registered bar, deliberately **not** an amendment to the failed one — see
  § Why this is a separate ADR. Executed under
  [`IMPL-2026-09-21-nutella-class-targeted-harvest.md`](../IMPL/IMPL-2026-09-21-nutella-class-targeted-harvest.md).
- **Date:** 2026-09-21
- **Author:** Nutella (Team Nolan)
- **Supersedes:** none. **Follows**
  [`ADR-2026-09-17-nutella-elm-training-database-construction.md`](ADR-2026-09-17-nutella-elm-training-database-construction.md),
  whose premise was tested and **failed**. That ADR's schema, warranty and tooling stand; its
  hypothesis about the feature space does not.
- **Backlog item:** `TN-N20`

---

## Context

### What we now know, measured

`ADR-2026-09-17` proposed that structural features (import graph + inventory) would fix
cross-ecosystem transfer. **Tested against a bar registered before any model existed. It failed.**

| configuration | fresh-ecosystem coverage | vs baseline |
|---|---:|---|
| path-only (frozen v2, committed baseline) | **28.0%** | — |
| structural, `pooled` @ 0.25 — *the valid test* | **27.6%** | **−0.4 pp** |
| structural, `percentile` @ 0.25 | 21.6% | −6.4 pp — **invalid, see below** |

The `percentile` arm does not test the hypothesis: its normalisation statistics are per-repo, an
unseen repo has none, so the four normalised scale features fall back to `0`. Verified — hono and
trpc rows are `[0.00, 0.00, 0.00, 0.00 …]` where n-dx rows are `[0.02, 0.00, 0.12, 0.00 …]`. The
model learned to use those columns and met them dead at evaluation.

**On train-CV those same features were worth +1.30 pp** over a path-only control (69.40% vs 68.10%).
They help in-distribution and do nothing out of it — the signature of features encoding the
training repos' structure rather than a general mapping.

### The diagnostic that changes the diagnosis

Run after the negative, free, no labels:

**40 of the 250 fresh-ecosystem files — 16.0% — carry teacher labels in classes the ELM never emits
once.** Every such class is starved in training:

| class | teacher files (of 250) | **training rows** |
|---|---:|---:|
| `config` | 17 | **11** |
| `model` | 9 | **1** |
| `component` | 9 | **8** |
| `gateway` | 3 | 4 |
| `schema` | 1 | 1 |
| `hook` | 1 | 1 |

**The teacher uses 13 classes; the model emits 7.** Those six are not predicted badly — they are
*unreachable*. A model cannot emit a class it has one example of, so all 40 files are absorbed into
`service`/`utility`. **That is the collapse**, and it is a class-representation problem, not a
feature-space problem.

### The arithmetic, reproduced against the committed log

Coverage = `(predictions not in {service,utility} + round(abstained × 0.1)) / n`
(`elm-coverage-check.mjs:98`). Today: `nonSU 49`, `S/U 201` → **27.6%**, matching the artifact.

| files recovered from S/U into their true minority class | coverage |
|---:|---:|
| 6 of 40 | **30.0% — K1′ PASS** |
| 10 | 31.2% |
| 20 | 34.8% |
| 40 | 42.0% |

**Only 6 of the 40 locked files — 15% recovery — clears the bar.** The gap is 2.4 pp; 16.0 pp is
locked behind classes the model cannot emit.

### The one lever that has ever moved transfer

| intervention | effect on fresh-ecosystem coverage |
|---|---|
| **ecosystems 2 → 7 (corpus v1 → v2)** | **13.2% → 28.0%** |
| capacity / activation tuning | train-CV only; no transfer effect |
| structural features | **−0.4 pp** |

Corpus diversity is the only intervention with a demonstrated transfer effect, it was worth
**+14.8 pp**, and it stopped at 7 ecosystems — one bar-width short. `TN-J9` said this on
2026-08-13 and sat unclaimed for 19 days. Both interventions since were attempts to *tune* what the
corpus already contained.

Also: **hono already passes** (30.9% under the structural run, 35.8% path-only). trpc (26.0% /
24.3%) is what drags the pooled figure under. This is not uniformly broken.

---

## Decision

**Harvest for the classes the model cannot emit, retrain on the path-only feature space, and test
against a bar registered before the harvest begins.**

### The pre-registered bar (committed before any new row is harvested)

```
POPULATION   gold set #2 — 250 files, hono + trpc, FRESH ecosystems.
             Human labels remain UNREAD; coverage needs none, so this does not spend them.
FEATURE SPACE  PATH-ONLY.  Structural features measured neutral (-0.4 pp), so including
               them would move two variables at once. They stay in `raw`, re-derivable.
MODEL        frozen v2 spec unchanged: ELM 4096 / tanh / ridge 0.01 / vocabCap 4000,
             9-seed ensemble, operating point B+su.
BASELINE     28.0%  (path-only on corpus v2, scripts/data/elm-coverage-v2.log)

PRIMARY    coverage >= 30.0% on the 250          -> K1' clears
SECONDARY  distinct labels emitted > 7           -> the prior has genuinely widened
TERTIARY   coverage improves on BOTH hono and trpc separately
                                                 -> not an average hiding one repo
GUARD      trained-on held-out coverage >= 31.8% -> not bought by wrecking in-distribution
           ⚠️ REDEFINED pre-build (addendum, 2026-09-21): measured on EXACTLY v2's 160
           held-out files, kept out of training by --carry-split. As first written it
           would have compared a v2 threshold to a re-split population, biased to pass.

HARVEST TARGET  >= 30 training rows for each of config, model, component, middleware,
                gateway, schema, hook -- the seven classes the teacher actually uses
                on the 250.  Floor 30 / target 50, from measured recall:
                entrypoint 59 rows -> 85%; types 34 -> 42%; 1-2 rows -> 0%.
                route-module, store and cli-command are harvested for CATALOG
                COVERAGE only; they appear 0 times in the eval set and cannot
                move PRIMARY.

STOPPING RULE   The corpus is built, frozen and committed BEFORE the coverage run.
                One coverage run per corpus version. No tuning against the 250.
```

### ⚠️ Clearing K1′ is necessary, not sufficient — stated before the result exists

Coverage counts predictions *outside* `service`/`utility` **whether or not they are correct**. So
emitting starved classes at all raises coverage partly mechanically. **Clearing 30% proves the
prior widened; it does not prove the predictions are right.**

Precision against truth needs the blind 250 labelled — the one irreversible spend — and it is
capped regardless by the teacher's **72.3%** agreement with human judgement. **No accuracy claim
will be made from this experiment**, and any report of it must carry this paragraph.

### The harvest

Repos chosen **by class need**, not by count. `nest`, `payload`, `remix` are cloned and never
analyzed; `svelte` and `typeorm` were analyzed rules-only (`--fast` gates the classify pass), so
they cost only calls.

| target class | where it lives | already staged |
|---|---|---|
| `model`, `schema` | ORM / validation-heavy — `typeorm`, `payload` | yes |
| `component`, `hook` | React / Next / Svelte app — `svelte`, plus one Next app | partly |
| `route-module` | Remix — **the only ecosystem that produces it** (catalog coverage only, see below) | yes |
| `config` | every repo; currently under-harvested at 11 rows | — |
| `middleware`, `gateway` | `nest`, express/koa/fastify | yes |

> ⚠️ **Two kinds of target, and only one can clear the bar. Separated on re-certification,
> because the table above reads as though every row serves PRIMARY.** Verified against the
> teacher's labels on the 250:
>
> | contributes to PRIMARY (present in the eval set) | cannot (absent from it) |
> |---|---|
> | `config` 17 · `model` 9 · `component` 9 · `middleware` 5 · `gateway` 3 · `schema` 1 · `hook` 1 | **`route-module` 0 · `store` 0 · `cli-command` 0** |
>
> `route-module`, `store` and `cli-command` are worth harvesting for **catalog coverage** — the
> database's own mission is all 17 archetypes, and `remix` is the only ecosystem that produces
> `route-module` at all. But **no amount of them moves the K1′ number on this evaluation set**, and
> the harvest report must not let their row counts read as progress toward the bar.

**Cost:** residue-only at `ceil(files/30)`; ~30–40 classify calls, **$3–10**. Money is not the
constraint — staging-tree collisions and time are.

### Non-negotiable constraints

- **Do not harvest the 105 unsampled hono/trpc candidates.** Same two repos as the evaluation set;
  the existing contamination assertion is *path-level* and would pass. The builder asserts on
  **repo identity**. *(Corrected 2026-09-21: when this was written the builder did **not** do this — the
  guard existed only in the residue script. Implemented at `436d3307` and verified, including against
  a renamed clone.)*
- **Do not touch the blind 250.** Never sampled, never trained on.
- **Do not re-split.** Seed 42, holdout 0.25 — re-splitting makes every number incomparable.
- **Never `git pull` a staged clone.** Labels are pinned to a tree; moving the tree unpins them.
- **Pin the teacher** in each target repo before analyzing, or it silently takes
  `NEWEST_MODELS.claude`.
- **`trainFromData(X, y)`, never `ELM.train()`.**
- **`--max-old-space-size=6144`** on every coverage run.

---

## Why this is a separate ADR and not an amendment

`ADR-2026-09-17`'s pre-registration says: *if PRIMARY fails, publish the negative and do not
harvest.* That negative is published and Phase 5 of its IMPL stays shut.

This diagnosis was reached **after** seeing that failure, which is precisely when motivated
reasoning is most likely. Folding it into the failed plan would let a new hypothesis inherit a bar
that was written for a different one. **So it gets its own ADR, its own bar, and its own decision
from the lead** — and the failed premise stays recorded as failed rather than quietly reinterpreted.

---

## Alternatives considered

| option | why not |
|---|---|
| **Amend the failed ADR and harvest under its plan** | Its pre-registration forbids exactly that, and it was written to stop this reasoning. |
| **Keep tuning the feature space** (symbols, callgraph, more normalisers) | Two feature spaces have now failed to transfer while the class-starvation mechanism went unaddressed. Callgraph is also deferred by the lead and absent on 7 of 9 repos. |
| **Merge `service`/`utility`** | Measured +26.8 pp — and produces a class holding 74% of files, which tells a consumer nothing. Rejected under `TN-J24` and still rejected. |
| **Lower the K1′ bar to 28%** | The bar was set before the numbers existed. Moving it now is the failure the pre-registration discipline exists to prevent. |
| **Abandon the tier; spend the effort on `TN-J22`** | Genuinely competitive — the teacher is 13.1 pp below the human path-only ceiling and nothing here improves label quality. But `TN-J22` is deferred by the lead, and this experiment is cheap, fast and free to evaluate. **If this fails, that is the recommendation.** |
| **Harvest broadly — "15-ish random repos"** | Random sampling reproduces the class skew; that is how 7 ecosystems still produced one `hook` row. Classes, not counts. |

---

## Consequences

**Easier.** The corpus finally represents the catalog it claims to: six unreachable classes become
emittable. The fix is aimed at a measured mechanism rather than a hypothesis. The test is free and
repeatable, and the blind 250 survive it.

**Harder.** A third corpus generation to document and keep honest. `resolved`/`residue` both need
rebuilding. The teacher-model mix grows another entry unless every new repo is pinned.

**What breaks.** Nothing at runtime — no `packages/**` change. Corpus v1 and v2 are **not**
regenerated; every number in `ELM-FINDINGS.txt` stays reproducible.

**Cost if it fails.** ~$10 and a session. **And the failure would be informative**: if the classes
become emittable and coverage still does not clear 30%, then path-based archetype classification
does not transfer at this corpus size, and `TN-J22` — a better teacher — is the remaining lever.

**Ownership.** Harvest and corpus: **Nutella**. Certification and any model evaluation: **Jam**,
per the `TN-N3` seam — deliberately, because the agent who diagnosed the problem and proposed the
fix should not also be the one grading it.

---

## Evidence

All verified by execution on 2026-09-18/21 against committed artifacts. **This ADR makes no
accuracy claim and no ELM-viability claim** — it proposes an experiment.

| claim | source |
|---|---|
| path-only fresh coverage 28.0%, K1′ FAIL; trained-on 33.8% | `scripts/data/elm-coverage-v2.log` (Jam) |
| structural `pooled` @ 0.25 → 27.6% fresh; hono 30.9%, trpc 26.0% | `scripts/data/elm-coverage-v3-secondary.{log,json}` |
| structural `percentile` @ 0.25 → 21.6%; features all-zero on unseen repos | `scripts/data/elm-coverage-v3-primary.{log,json}`, verified per-row |
| structural +1.30 pp on train-CV vs a path-only control | `scripts/data/elm-v3-selection.json` |
| 40 of 250 files in never-emitted classes; per-class training rows | corpus v2 + `k2-goldset2-llm-labels.json` + the secondary run's ELM mix |
| 6 of 40 recovered clears 30% | coverage formula reproduced exactly against the logged 27.6% |
| v1 → v2 fresh coverage 13.2% → 28.0% | `ADR-2026-09-04-syrup-…` evidence table; `elm-coverage-v2.log` |
| recall by row count: 59 → 85%, 34 → 42%, 1–2 → 0% | Syrup, `TN-S1` — **relayed, not re-measured by me** |
| teacher 72.3% vs truth; human path-only ceiling 85.4% | `ELM-CORPUS.md` § 3 |

### What is explicitly NOT evidence

1. **That the recovered predictions would be *correct*.** Coverage is label-free. Precision needs
   the blind 250 and is capped by the teacher's 72.3%.
2. **That 30 rows per class is sufficient.** It is extrapolated from three points on one corpus
   (Syrup's recall figures), not measured for these classes.
3. **That the new repos will yield the classes they are chosen for.** The builder harvests the
   *residue*; what the rules already catch never reaches the teacher. `page` is the standing
   example — 37 files in n-dx, all rule-caught, zero LLM rows.
4. **That this generalises beyond hono and trpc.** Two fresh ecosystems is what we own. K1′ remains
   a property of (model, repo) — hono passes today, trpc does not.
