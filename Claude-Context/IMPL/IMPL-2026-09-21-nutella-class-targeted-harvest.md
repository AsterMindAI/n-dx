# IMPL — Class-targeted harvest: buy the classes the model cannot emit

- **Implements:** [`ADR-2026-09-21-nutella-class-targeted-harvest.md`](../ADR/ADR-2026-09-21-nutella-class-targeted-harvest.md)
- **Owner:** Nutella (Team Nolan) · **Certification:** Jam (Team Nolan), per the `TN-N3` seam
- **Backlog item:** `TN-N20`
- **Branch:** `Nolan-Work` (shared checkout — deviation recorded under `TN-F1`)
- **Worktree:** none — shared checkout `/Users/nolanmoore/Work/n-dx-1`
- **Status:** **In progress** (lead: "get started with the work", 2026-09-21). ADR accepted, so
  Phase 3 is procedurally unblocked — it still spends incrementally with a free audit between repos.

---

## 0. What the pre-harvest audit already establishes

Run before writing this plan, free, no LLM calls. **Two findings, one reassuring and one that
changes the plan's shape.**

### ✅ The target classes ARE reachable through the residue

The builder harvests only what the rules fail to classify, so a class the rules catch confidently
can never enter the corpus — that is how `page` ended up with **0 LLM rows across all 11 analyzed
repos** despite 78 rule-labelled files. **This was the dominant risk to the whole plan.** Measured
across every analyzed repo:

| class | rule-labelled | LLM-labelled | LLM share | reachable? |
|---|---:|---:|---:|---|
| `config` | 4 | **40** | 90.9% | **yes** |
| `model` | 2 | **16** | 88.9% | **yes** |
| `component` | 208 | **24** | 10.3% | **yes** |
| `middleware` | 9 | **19** | 67.9% | **yes** |
| `gateway` | 4 | **10** | 71.4% | **yes** |
| `schema` | 17 | 3 | 15.0% | marginal |
| `hook` | 39 | 2 | 4.9% | marginal |
| *(`page`)* | *78* | ***0*** | *0.0%* | ***no — the known failure*** |

**38 of the 40 locked files sit in the four clearly-reachable classes** (`config` 17, `model` 9,
`component` 9, `gateway` 3). Only 2 (`schema` 1, `hook` 1) are in marginal ones. **We need 6 to
move.**

### ⚠️ But the repos we already have are exhausted

| class | rows in corpus v2 | LLM rows available in **trainable** repos | of which sit in **hono/trpc** (untouchable) | **usable headroom** |
|---|---:|---:|---:|---:|
| `config` | 11 | 15 | 25 | **4** |
| `model` | 1 | 2 | 14 | **1** |
| `component` | 8 | 11 | 13 | **3** |
| `middleware` | 6 | 8 | 11 | **2** |
| `gateway` | 4 | 6 | 4 | **2** |
| `schema` | 1 | 2 | 1 | **1** |
| `hook` | 1 | 1 | 1 | **0** |

**There is no re-harvesting our way to the bar.** The corpus has already taken nearly everything
available, and a large share of what exists for these classes sits in hono and trpc — the
evaluation set, which must stay untouched. **Every new row must come from a repo we have not
classified.** That is what makes Phase 3 unavoidable and why it costs money.

### Sizing what is on disk

| repo | inventory | source | unclassified (= residue) | LLM rows today | classify calls if `--full` |
|---|---:|---:|---:|---:|---:|
| `svelte` | 8,060 | 388 | **331** | 0 | **12** |
| `typeorm` | 3,600 | 563 | **531** | 0 | **18** |
| `nest` | — | — | cloned, **never analyzed** | 0 | unknown until Phase 1 |
| `payload` | — | — | cloned, **never analyzed** | 0 | unknown until Phase 1 |
| `remix` | — | — | cloned, **never analyzed** | 0 | unknown until Phase 1 |

`svelte` and `typeorm` were analyzed with `--fast`, which gates the classify pass — **that is why
they hold 951 analyzed files and zero usable rows.** Converting their existing residue costs **30
calls** and no re-analysis of anything else.

### ⚠️ Which repo yields which class was an ASSUMPTION. Re-certification tested it.

An earlier draft of this plan asserted "`svelte` targets `component`/`hook`, `typeorm` targets
`model`/`schema`" as though established. **It was inference from what those projects are.** Both are
already analyzed rules-only, so it was free to check — and the check reordered the plan.

Their *rule* labels contain **none** of the target classes (`svelte`: entrypoint 26, utility 21,
types 3, schema 3, store 3; `typeorm`: cli-command 15, entrypoint 11, utility 5, config 1). That is
**weak evidence either way**: the rules barely fire on either repo (85% and 94% residue), so it says
the rules do not work there, not what the repos contain. The residue is what reaches the teacher, so
the residue is what matters. Matching residue **paths** against class-indicative patterns:

| repo | residue | `model`/entity | `schema`/migration | `config` | `component` | `hook` |
|---|---:|---:|---:|---:|---:|---:|
| **`typeorm`** | 531 | **58** | **41** | **123** | — | 2 |
| `svelte` | 331 | — | — | 2 | **11** | 2 |

**`typeorm` is the highest-value target on the board.** Its residue carries strong signal for
`config`, `model` and `schema` — and `config` (17) + `model` (9) are **26 of the 40 locked files**.
18 calls.

**`svelte` is demoted.** Eleven `component` candidates and two `hook` do not justify 12 calls, and
its residue sample is largely benchmark scaffolding (`benchmarking/benchmarks/...`). A dedicated
React/Next application is the better source for `component`/`hook`, and Phase 1 sizes one.

> ⚠️ **Path-substring matching is a heuristic, not the teacher's judgement.** A file under
> `src/entity/` may still come back `utility`. This is suggestive evidence that reorders spending
> priority; it is not a prediction of yield, and no row count is claimed from it.

---

## Scope

**In scope:** sizing the unanalyzed clones; pinning teachers; running the classify pass on five
repos; building corpus v3 as two datasets; re-freezing; one coverage run against the bar; the
report.

**Out of scope:** the model, the tier, the confidence gate (Jam's). `packages/**` — untouched.
Structural features — measured neutral, deliberately not carried into this experiment. Any
accuracy or precision claim — that needs the blind 250, which this plan does not spend. `TN-J22`.

---

## Files touched

| path | owner | new/edit |
|---|---|---|
| `scripts/data/elm-harvest-preregistration.json` | Nutella | **new** — the bar, committed first |
| `scripts/data/elm-class-audit.json` | Nutella | **new** — yield audit, re-runnable |
| `scripts/elm-class-audit.mjs` | Nutella | **new** — claim in `IN-FLIGHT.md` first |
| `scripts/data/elm-archetype-corpus-v3.json` · `-resolved-v3.json` | Nutella | **new** |
| `scripts/data/elm-frozen-model-v3.json` | Nutella | **new** |
| `scripts/data/elm-coverage-v3-harvest.log` / `.json` | Nutella | **new** |
| `Claude-Context/Nolan-Agents/{ELM-CORPUS,FEATURES}.md` | Nutella | edit |
| `<staging>/{svelte,typeorm,nest,payload,remix}/.n-dx.json` | — | **new** (teacher pins) |
| ⛔ `scripts/elm-coverage-check.mjs` · `elm-coverage-v2.log` · corpus v1/v2 | Jam / historical | **not touched** |

---

## Steps

### Phase 0 — Commit the bar. Before any repo is analyzed.

`scripts/data/elm-harvest-preregistration.json`, carrying the ADR's criteria verbatim: population
(the 250, labels unread), **path-only** feature space, frozen-v2 model spec, baseline **28.0%**,
PRIMARY ≥30.0%, SECONDARY >7 labels, TERTIARY both repos improve, GUARD trained-on ≥31.8%, and the
harvest target of ≥30 rows for the seven bar-relevant classes.

### Phase 1 — Size the unanalyzed clones. **FREE.**

```sh
sourcevision analyze <repo> --fast      # rules only: no LLM calls, no spend
```
on `nest`, `payload`, `remix`. Produces inventory + classifications, which gives residue size
(→ call count → cost) and the repo's rule-label shape.

Then **probe the residue paths** for class-indicative patterns, as done for `svelte`/`typeorm`
above. Free, and it is what demoted `svelte`.

**Gate:** a repo is dropped **before it costs anything** if its residue is tiny, or if the probe
shows no signal for the classes it was chosen for. `--fast` is free and yields no usable rows —
which is what we want here; the trap is mistaking it for a harvest.

### Phase 2 — Pin the teacher in every target repo. **FREE, and load-bearing.**

```jsonc
// <repo>/.n-dx.json
{ "llm": { "claude": { "model": "claude-sonnet-5" } } }
```
Unpinned, `analyze` silently takes `NEWEST_MODELS.claude`. **That is how the current corpus
acquired two teachers with nothing recording it** (`TN-J31`). One pin per repo, before any `--full`
run, and the builder records the resolved model per repo.

### Phase 3 — Spend, **incrementally, cheapest-and-highest-yield first**

```sh
sourcevision analyze <repo> --full      # SPENDS. omit --fast so the classify pass runs
node scripts/elm-class-audit.mjs        # free: per-class row counts vs the 30-row target
```

Order, and why — **revised by the residue probe above:**

1. **`typeorm` — 18 calls.** Highest measured signal: 123 `config`-shaped, 58 `model`-shaped and 41
   `schema`-shaped residue paths, covering three of the four biggest gaps. Already staged and sized.
2. **`nest`, `payload`, `remix`** — in whatever order Phase 1's free sizing and residue probe
   favour. `nest` for `middleware`/`gateway`/`service`, `payload` for `model`/`schema`, `remix` for
   `route-module` *(catalog coverage only — 0 files in the eval set, so it cannot move K1′)*.
3. **A React/Next app** for `component`/`hook`, if Phase 1 finds one with a component-rich residue.
4. **`svelte` — only if still short.** Demoted on evidence: 11 `component` candidates, 2 `hook`.

**After every repo, re-run the audit and stop as soon as the seven classes reach the target.**
The audit is free and instant; there is no reason to spend the whole budget up front.

**Budget:** 18 calls for `typeorm`, plus Phase 1's estimate for the rest. Expect **~50–70 calls
total, $4–14**. Money is not the constraint — collisions and time are. **Stop when the seven classes
hit target, not when the budget is spent.**

> ⚠️ `analyze` writes `.sourcevision/` into the **target** repo, which no worktree isolates, and
> the staging tree is shared. **Claim it in `IN-FLIGHT.md` before starting and release after.**

### Phase 4 — Build corpus v3 as two datasets

```sh
node scripts/elm-corpus-build.mjs <repos…> --out=scripts/data/elm-archetype-corpus-v3.json
node scripts/elm-corpus-build.mjs <repos…> --source=algorithmic --out=…-resolved-v3.json
```
Seed 42, holdout 0.25, stratified. **Do not re-split.** The builder now records both the analysis
and build commits and warns on mismatch (`TN-N17`), and asserts on **repo identity** so a hono or
trpc row cannot enter.

### Phase 5 — Re-freeze on corpus v3

```sh
node scripts/elm-freeze-model.mjs --corpus=…-v3.json --out=…elm-frozen-model-v3.json
```
Spec pinned to v2's: ELM 4096 / tanh / ridge 0.01 / vocabCap 4000, 9 seeds. **The artifact
existing is the only success test** — this job's exit code has lied before.

### Phase 6 — One coverage run. The bar.

```sh
node --max-old-space-size=6144 scripts/elm-coverage-check.mjs \
  --frozen=scripts/data/elm-frozen-model-v3.json
```
**One run per corpus version.** No tuning against the 250. Report overall, **hono and trpc
separately**, trained-on held-out, and distinct labels emitted.

### Phase 7 — Report, and hand certification to Jam

Commit the artifact with its invocation and input hashes. Update `ELM-CORPUS.md` § 6 and
`FEATURES.md` § 12 **in the same commit** — that section is the warranty, the repo is public, and
it has gone stale within hours before now.

**Then it goes to Jam.** I harvest; Jam judges whether the model improved. Deliberate: the agent
who diagnosed the problem and proposed the fix should not grade it.

---

## Test strategy

**Before any spend**
- `scripts/elm-features-selftest.mjs` green (22 columns, measured invariants pinned).
- `elm-class-audit.mjs` reproduces the § 0 tables from committed artifacts — if it cannot
  reproduce numbers I have already published, it is not measuring what I think.

**During**
- The builder's **repo-identity assertion** refuses any hono/trpc row. Path-level checks are
  insufficient and would pass.
- Provenance gate (`TN-N17`) reports `ANALYSIS != BUILD` or a dirty source tree per repo.
- Teacher mix reported per build; a second unrecorded teacher is the `TN-J31` defect returning.

**After**
- Coverage run asserts its results table is populated — **an OOM on this job exits 0 with an empty
  table.**
- Corpus v1 and v2 unchanged: `git status` clean for both, so every number in `ELM-FINDINGS.txt`
  stays reproducible.

**Must stay green:** `npx vitest run tests/` at the root (**not** `pnpm test`, which aborts in
rex's flaky perf test before reaching `tests/e2e/`), plus `architecture-policy` and
`domain-isolation`. New scripts shell out to nothing, so no `ALLOWED` entry — if that changes it is
claimed first, `tests/e2e/**` being shared.

---

## Rollback

**Phases 0–2 and 4–7 are revertible by `git revert`.** They add files and regenerate nothing.

**Phase 3 is not, and revert does not cover it:**

1. **LLM calls are spent and unrecoverable.** This is why Phase 1 is free and Phase 3 is
   incremental with a free audit between repos.
2. **`analyze` writes `.sourcevision/` into the target repo**, outside git. Backing out means
   deleting those directories by hand.
3. **If a harvest contaminates the blind 250, revert cannot restore the instrument** — the
   contamination is epistemic, the model has seen the ecosystem. Hence a mechanical assertion, not
   a review step.

**Corpus v1, v2 and `elm-coverage-v2.log` are never rewritten**, so the baseline this experiment is
measured against survives any rollback.

---

## Risks

| # | risk | mitigation |
|---|---|---|
| 1 | **New repos yield the classes the rules already catch** — the `page` failure repeating | § 0 measures the four biggest target classes at 71–91% LLM share. `schema`/`hook` are marginal and may not move; **they are only 2 of the 40 locked files.** |
| 1b | **A repo does not contain the classes it was chosen for** | The residue probe (§ 0) tests this for free before spending, and already demoted `svelte`. It is a heuristic, so the mitigation is incremental spending with a free audit between repos — not confidence in the probe. |
| 2 | Classes reach 30 rows and coverage still misses 30% | Then path-based classification does not transfer at this corpus size, and `TN-J22` is the remaining lever. **A publishable negative, and cheap.** |
| 3 | **Coverage clears the bar mechanically without being correct** | Stated in the ADR before any result: coverage counts non-S/U predictions right or wrong. **No accuracy claim.** Precision needs the blind 250. |
| 4 | A repo silently analyzed with `--fast` | `--fast` yields 0 LLM rows; the audit shows it immediately as a flat zero. |
| 5 | Unpinned teacher → third model in the mix | Phase 2 pins before any `--full`; builder reports the mix. |
| 6 | Staging-tree collision with another agent | `IN-FLIGHT.md` claim before, release after. |
| 7 | OOM read as a clean run | Results-table assertion; never trust the exit code. |
| 8 | Clone drift unpinning the labels | Never `git pull` a staged clone; provenance gate reports `ANALYSIS != BUILD`. |

---

## Open questions

- **For the lead:** the ADR (`TN-N20`) is **Proposed**. Phases 1–2 are free and can start under it;
  **Phase 3 spends and waits on acceptance.**
- **For Jam:** you own certification. Do you want the v3 coverage run yourself, or do I run it and
  hand you the artifact? Either works; the seam matters more than who types it.
- **For the lead, if this succeeds:** clearing K1′ makes the tier *viable*, not *validated*.
  Deciding whether to spend the blind 250 on precision is a separate, irreversible call.
- **Still deferred:** `TN-J22`. Nothing here improves label quality, and the teacher's 72.3% caps
  whatever this achieves.
