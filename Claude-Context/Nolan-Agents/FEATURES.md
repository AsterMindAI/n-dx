# FEATURES.md — what each column is, why it transfers, and what is deliberately absent

**Maintainer:** Nutella (Team Nolan) · **Implements**
[`ADR-2026-09-17-nutella-elm-training-database-construction.md`](../ADR/ADR-2026-09-17-nutella-elm-training-database-construction.md)
· Derived by [`scripts/elm-features.mjs`](../../scripts/elm-features.mjs)

> **This file ships with the data or the data does not ship.** The dataset is public and
> permanent. A stranger can train on it without ever reading a note from us, and the failure modes
> below are **not inferable from the rows** — the last model trained on this corpus passed its
> held-out split and collapsed on unseen repos. **The document is the warning label.**

---

## 0. Read this before anything else

Four facts that change how every number derived from this dataset should be read.

1. **The labels are a teacher, not truth.** An LLM produced them. Measured against human
   judgement: **72.3% correct.** A model scoring 68% against this dataset is **68% in agreement
   with a source that is itself 72% right** — not 68% accurate. Never quote one as the other.
2. **The teacher was NOT shown the path only.** It saw the path **plus `[partial signals:
   service(0.7), …]`** carried over from the algorithmic pass, plus the full archetype catalog with
   prose descriptions, plus 29 sibling paths per batch. **These labels are a strong model agreeing
   or disagreeing with a weak rule guess it was shown** — not an independent judgement. If you
   train on path or structure alone, your student has strictly less information than its teacher.
3. **`residue` is the rules' leftovers, not the repo.** Files the algorithmic pass classified
   confidently never reach the teacher and cannot appear there. This is why whole classes are thin
   or absent — see § 4.
4. **The ceiling on any path-only classifier is 85.4%** — a human given only the path reproduces
   their own content-informed judgement that often. The teacher sits **13.1 pp below** it.

---

## 1. The three layers

A row has `identity`, `label`, `raw` and `features`. **The layer boundary is the contract.**

| layer | what it is | fed to a model? |
|---|---|---|
| `identity` | `repo`, `commit`, `path` | no — `commit` is what makes a row reproducible |
| `label` | `archetype`, `source`, `confidence`, `teacher`, `promptLevel`, `catalogVersion` | the target, plus how it was made |
| `raw` | measurements exactly as `sourcevision` reported them | **no — auditable, never fed** |
| `features` | the model-facing vector | **yes** |

**Why `raw` exists when `features` is derived from it:** the feature space has already been revised
twice, and each revision previously cost a fresh LLM harvest. With `raw` committed, the next
revision is arithmetic over data you already have. **The labels are the expensive part; the
arithmetic is free.**

---

## 2. The feature contract — 22 columns, and column order is part of it

A silently reordered matrix is a bug nobody sees. Read the order from
`provenance.rowColumns`, never assume it.

| column | derivation | why it transfers |
|---|---|---|
| `inDegreeNorm`, `outDegreeNorm` | normalised degree (§ 3) | "more depended-upon than most files" means the same in any repo; a raw count does not |
| `locNorm`, `sizeNorm` | normalised size | same reason |
| `*Missing` (4) | 1 when the measurement was absent | see § 5 — the most important columns here |
| `valueImportRatio` | (`static` + **`require`**) / out-edges | **collapsed deliberately:** express is 100% `require` and n-dx 0%, so keeping them apart encodes CommonJS-vs-ESM, not archetype |
| `typeImportRatio` | `type` / out-edges | a types file is type-heavy in **any** module system |
| `reexportRatio` | `reexport` / out-edges | the barrel / gateway signature; language-level |
| `dynamicImportRatio` | `dynamic` / out-edges | lazy-loading shape |
| `edgeTypesMissing` | 1 when no import graph | |
| `isolated`, `isolatedMissing` | no edges in or out | see § 6 |
| `inCycle` | member of a circular import | structural, scale-free |
| `pkg_*` (6) | curated package family | § 7 |

---

## 3. Normalisation — and the choice that is genuinely open

**Raw degrees are not comparable across repos.** Mean in-degree spans **0.59 (commerce) to 6.04
(n-dx)** — a **10.2× spread**. `inDegree: 5` is below average in n-dx and impossible in commerce,
whose maximum is 3. Feeding raw counts teaches the repo, not the file.

Three normalisers ship. **`manifest.json` records which produced a given release.**

| normaliser | definition | property |
|---|---|---|
| `percentile` | midrank within the repo's own `role:"source"` files | ⚠️ **imports repo composition** — `inDegree: 1` is the **12.5th** percentile in n-dx and the **72.7th** in commerce |
| `log1p` | `ln(1+x)/6` | a property of the file alone; repo-independent by construction |
| `pooled` | midrank against the pooled distribution across all training repos | one fixed yardstick; **the only one with a single-file definition** — it scores that same file at 17.7th in *both* repos |

> ⚠️ **Distributions are built over `role: "source"` files only.** Classification never sees
> anything else, and the test/source ratio is itself wildly repo-dependent (n-dx 825/683, Vue core
> 206/303, **fastify 226/52**), so ranking against the whole inventory would launder repo
> composition back into the feature. This was a real bug, caught by requiring the module to
> reproduce both the 12.5 and the 72.7 figure.

> ⚠️ **Percentile and pooled are defined only relative to a population. A single-file consumer is
> outside the tested envelope** — not merely "using an untested fallback". `pooled` is the variant
> with a defensible single-file answer; nobody has demonstrated it works at runtime.

---

## 4. What the dataset structurally cannot tell you

- **Only `role: "source"` is ever classified.** n-dx's inventory is **1,525 entries — test 825 ·
  source 683** · build 10 · config 6 · docs 1. **54% of the repo never reaches either model, while
  `test-helper` is one of the 17 archetypes.**
- **`residue` is the rules' leftovers.** n-dx has **37 `page` files, all caught by rules, zero
  reaching the teacher** — which is why `page` has no LLM-labelled rows and why *more repos will
  not fix it.*
- **`resolved` buys catalog coverage, not capability.** Its labels *are* the regex output, so a
  model trained on it learns `archetypes.ts`. That is legitimate for classes the teacher never
  sees and **illegitimate as evidence the model is good** — and in production the rules run first,
  so **no `page` file ever reaches a residue-tier consumer anyway.**
- **`residue` and `resolved` are never merged.** A label meaning "a teacher judged" *or* "a regex
  fired", with nothing recording which, is an unrecoverable ambiguity. Two datasets, two warranties.

---

## 5. Zero is not missing

**The single easiest way to get wrong numbers from this dataset.** A file with `inDegree: 0` —
nothing imports it — and a file whose repo had no import graph are *different facts*. They are
never the same value here:

- `raw` uses `null` for "not measured" and never fabricates a `0`.
- `features` uses `0` plus an explicit **`<field>Missing = 1`** indicator.
- `provenance.repos[].featuresAvailable` says which artifacts existed per repo.
- Omission counts return **`null`, never 0**, when the LLM pass did not run.

If you drop the `*Missing` columns, you are telling your model that an unmeasured file has no
dependents. **A related trap already cost this project a fabricated statistic** — a plausible
zero from broken code is indistinguishable from a real one.

---

## 6. Isolated files — a large minority have no structural signal at all

Source files with no import edge in or out range from **1.2% (n-dx) to 42.2% (commerce)**. In the
evaluation set, **25.9% of hono's and 8.9% of trpc's rows** are untouched by any edge. For those
rows the entire structural half of the vector is absent — hence `isolated`, and hence reporting
coverage split by isolated/connected rather than as one number.

---

## 7. `pkgFamily` is curated on purpose, and small

**305 of 341 external packages appear in exactly ONE repo.** A one-hot over package names is
repo-specific vocabulary — the same trap as path tokens. Only the **11** packages measured to
appear in ≥3 of 9 repos are mapped, into 6 families:

`node-builtin` (fs, os, path, url) · `ui-view` (react, react-dom) · `schema` (zod) · `test`
(vitest) · `build-tool` (vite, esbuild) · `tooling` (typescript)

An unmapped package contributes **nothing** rather than creating a family. The map ships with the
dataset (`pkg-families.json`) so you can audit or ignore it. **Growing it carelessly recreates the
trap it exists to avoid.**

---

## 8. Withheld, and why — so nobody re-adds them by reflex

| withheld | measured reason |
|---|---|
| `category` | repo-specific by construction — n-dx's values are its own package names |
| `zone` | absent for **7 of 9** repos surveyed, and repo-specific where present |
| `role` | **constant `source` on 536 of 536 harvested rows** — a dead input dimension |
| `language` | 91.6% one value, and **all 11 `Vue` rows are one repo *and* all labelled `component`** — a repo fingerprint that is also a perfect in-sample label predictor |
| `depthFromRoot` | encodes monorepo layout (n-dx paths start `packages/x/src/…`; express is flat) |
| raw degrees / `loc` / `size` | 10.2× cross-repo spread (§ 3). Retained in `raw`. |
| raw edge-type counts | CommonJS-vs-ESM confound. Retained in `raw`. |
| raw package one-hot | 305 of 341 single-repo (§ 7) |
| `hash`, `lastModified` | no archetype signal; `lastModified` invites leakage by harvest order |
| **`callgraph.json` / `components.json`** | **deferred, not dismissed.** Real and free — 6,277 functions with `isExported` and 180,237 call edges on n-dx — and the export ratio orders sensibly by archetype (route-handler 0.30 → schema 0.86; `gateway` files declare 0.0 functions). Withheld because they exist for only 2 of 9 repos: the harvest runs stopped after phase 3, so phases 5–6 never ran. Backfilling is CPU-only. |
| **`symbols[]`** | **deferred, not dismissed.** Plausibly the most transferable signal in the graph — `{describe, it, expect}` means *test* anywhere — but no symbol→family map has been measured. **The full graph ships, so this is recoverable without a re-harvest.** |

---

## 9. ⚠️ Block scale is YOUR choice, and the default is not neutral

`TFIDFVectorizer.vectorize()` **does not normalise** (`l2normalize` is opt-in and our scripts never
call it). Measured over all 464 corpus-v2 train rows at the frozen spec's `vocabCap: 4000`:

| block | dims | squared L2 energy |
|---|---:|---|
| path (TF-IDF) | 2,890 | **mean 1.464** · p10 0.963 · p90 2.44 · nonzero mean 16.0 |
| structural | 22 | **≈ 4.0** for the `[0,1]` block |

**Concatenated unscaled, the 22-column structural block carries roughly 2.7× the energy of the
entire 2,890-dimension path block.** An ELM's hidden layer is a random projection, so relative block
energy decides which signal dominates — **the path can become a minority contributor to its own
classifier by accident.** Given the human path-only ceiling is 85.4%, that is not obviously the
right default. `manifest.json` carries `blockEnergy` so you can scale deliberately.

---

## 10. Use `trainFromData`, never `ELM.train()`

`ELM.train()`'s first parameter is `augmentationOptions`, **not training data**; it trains on
character variants of the **category label strings**. Passing training rows raises no error and
silently trains on nothing. Demonstrated: the repo's own smoke test scores **83% with an empty
array, with inverted labels, and with no argument at all** — identical predictions every time.

**Use `trainFromData(X, y)` with explicit one-hot `y`.** String `y` is a second, separate trap that
also fails silently.

---

## 11. Contamination boundary — do not cross

| population | status |
|---|---|
| training datasets (`residue`, `resolved`) | train freely |
| **gold set #2 — 250 files, hono + trpc** | **BLIND.** Never train on these. Coverage needs no labels, so it can be measured repeatedly without spending it. |
| **the 105 unsampled hono/trpc candidates** | **NOT free rows.** Same two repos, which are the only fresh ecosystems anyone has measured generalisation against. The existing contamination check is *path-level* and would **pass**; the contamination is *ecosystem-level*. |
| gold set #1 — 83 files | **SPENT.** Labels read; it is a DEV set. Never publish a number from it unlabelled. |

---

## 12. The result you are inheriting

> ## ✅ SUPERSEDED 2026-09-22 — the bar has been cleared. Read this box before the table below.
>
> **Corpus v3-classtargeted is certified: fresh-ecosystem coverage 47.2%, K1′ PASS**, with 12
> distinct labels and v2's own 160 held-out files improving 33.8% → 36.9%. The failure the table
> below records was **a starved class distribution, not the feature space** — this file's § 4 is
> still correct about what the columns cannot tell you, but "a path-only model does not
> generalise" is no longer the state of the art. Full result and its caveats:
> `ELM-CORPUS.md` § 6a.
>
> **Two things changed under this file's own contract, and both are load-bearing:**
> - **The 4,000-term vocabulary cap now binds.** v2's corpus produced 2,890 terms; v3-classtargeted
>   fills the cap, so the rarest terms are dropped. The spec is honoured as pinned, but the
>   effective feature space is not the same between v2 and v3 — a v2-vs-v3 comparison is not a
>   clean single-variable comparison.
> - **Coverage is not accuracy, and the pass is necessary rather than sufficient.** The two
>   evaluation repos now miss in *opposite* directions (hono under-predicts `service`/`utility`,
>   trpc still over-predicts) and the average hides both. Never quote 47.2% without that sentence.

Measured 2026-09-18, committed at `scripts/data/elm-coverage-v2.log`:

| population | coverage | K1′ (≥30%) |
|---|---:|---|
| trained-on ecosystems | 33.8% | PASS |
| **fresh ecosystems (hono + trpc)** | **28.0%** | **FAIL** |
| ↳ hono | 35.8% | PASS |
| ↳ trpc | 24.3% | FAIL |

**A path-only model trained on this corpus does not generalise to unseen ecosystems.** Widening the
corpus from 2 to 7 ecosystems moved it **13.2% → 28.0%** — a real gain that did not reach the bar.

**And note hono passes while trpc fails on the same model: coverage is a property of (model, repo),
not of the model. Never quote a coverage number without naming its repo.**
