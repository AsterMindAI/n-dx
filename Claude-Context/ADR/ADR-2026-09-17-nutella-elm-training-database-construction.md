# ADR — Constructing the ELM training database: two datasets, a three-layer row, and the import graph as a first-class artifact

- **Status:** **ACCEPTED 2026-09-18 by the lead** ("push forward with this project"). The two
  outward-facing items are resolved: **the deliverable repo is now public**, and **Jarrett and
  Thomas have been informed** — so § Consequences' "no note has been sent" is superseded.
  Implementation proceeds under
  [`IMPL-2026-09-18-nutella-elm-training-database-construction.md`](../IMPL/IMPL-2026-09-18-nutella-elm-training-database-construction.md).
  **Nothing has been harvested or spent at time of acceptance.**
- **Date:** 2026-09-17
- **Author:** Nutella (Team Nolan)
- **Supersedes:** none. **Amends** `ADR-2026-09-04-syrup-merge-elm-corpus-into-jarrett-harness.md`
  — that ADR decided the corpus is the merge unit; this one decides what the corpus *is* once it
  stops being path-only.
- **Backlog item:** `TN-N2`, `TN-N11`, `TN-N12`, `TN-N13`
- **Revised 2026-09-18:** corpus v2's coverage is **measured, not pending** — 28.0% on fresh
  ecosystems, **K1′ FAIL** (`scripts/data/elm-coverage-v2.log`). Hiccup 12 is resolved, the evidence
  table carries the result, and **28.0% is now this ADR's committed baseline.** The result
  *confirms* the premise rather than undermining it: widening ecosystems alone moved fresh coverage
  13.2% → 28.0% and still missed the bar.
- **Revised 2026-09-17** after Jam's review
  ([`NOTE-…-jam-review-of-the-database-adr.md`](../Nolan-Agents/Notes/NOTE-nolan-internal-2026-09-17-jam-review-of-the-database-adr.md)).
  Every claim below that the review touched was re-verified before adoption. **Six changes, three
  of which alter a decision:**
  1. **§ 3a is new — block scale is now a declared contract.** The structural block carries ~2.7×
     the energy of the entire path block; without a declaration the first consumer gets a
     structure-dominated model by accident.
  2. **The normaliser is no longer presented as settled.** Percentile imports repo composition —
     `inDegree: 1` is the 12.5th percentile in n-dx and the **72.7th** in commerce. `log1p` and
     pooled global quantiles are named as live alternatives, decided by measurement.
  3. **`language` and `depthFromRoot` moved to withheld.** `language` fails this ADR's own test
     twice; `depthFromRoot` was called "scale-free" in one section and the opposite in another.
  4. **`symbols[]` added to the withheld table** as explicitly deferred — its absence was the one
     gap in that table.
  5. **Hiccups 1, 2 and 5 corrected** — `catalogVersion` cannot script a class *split*; the
     rank problem is two stacked ranks, not one; `resolved` buys catalog coverage but no
     capability at our own call site.
  6. **Two stale "9 of 10" zone counts fixed** — the withheld table and the alternatives table had
     both survived my own correction of that number elsewhere in the same document. Caught by Jam,
     and it is the same propagation failure that bit me the day before.

---

## Context

Team Nolan's assigned scope (leads, 2026-09-16) is the database an ELM trains on. The existing
corpus is **624 rows whose only feature is a path string**, and it has a measured failure: a model
trained on it **collapsed to the majority class on unseen repos** — 96.4% `service`/`utility`
against a teacher's 48.4%, 5 of 13 labels emitted, coverage 34.9% → 13.2%
(`ELM-CORPUS.md` § 6). It learned n-dx's archetype prior, not a path→archetype mapping.

The lead has directed that the database now include **the full import graph and the file inventory**
that `sourcevision` already collects. File *content* is explicitly deferred.

This is the right lever, and the reason is mechanical rather than aspirational. A TF-IDF vocabulary
is fitted on the training split, so a fresh repo's distinctive path tokens have **no slot at all**;
the vector goes sparse and the model falls back to the class prior, which is ~64% `service`/
`utility` — matching the observed 96.4%. **Structural measurements do not have that failure mode,
because "imported by many files" means the same thing in hono as in n-dx.**

But *which* structural measurements transfer is an empirical question, and I measured it across
nine analyzed repos before writing this. **Three of the obvious candidates do not transfer**, and
that is most of what this ADR is for.

### What is actually on disk

Verified 2026-09-16/17 across `/Users/nolanmoore/Work/n-dx-elm-corpus/` and this repo.

`inventory.json` — `{path, size, language, lineCount, hash, role, category, lastModified}`.
`imports.json` — `{edges[{from,to,type,symbols[],weight}], external[{package,importedBy[]}], summary{totalEdges,totalExternal,circularCount,circulars[{cycle[]}]}}`.
`zones.json` — `{zones[{id,name,files[],cohesion,coupling,…}], crossings, …}`.

All edges are **internal**; both endpoints are repo-relative paths. External dependencies live in a
separate **inverted index** (package → importedBy), so per-file external imports must be derived by
inverting it. **All 4,266 n-dx edges carry a `symbols` array.**

### ⚠️ Four measured findings that constrain the design

**1. Raw degrees are not comparable across repos — a 10× spread.**

| repo | source files | edges | mean in-degree | p90 | max |
|---|---:|---:|---:|---:|---:|
| n-dx-1 | 683 | 4,266 | **6.04** | 11 | 249 |
| Vue core | 303 | 1,662 | 5.32 | 13 | 94 |
| fastify | 52 | 344 | 5.48 | 10 | 83 |
| hono | 239 | 1,008 | 4.18 | 9 | 77 |
| trpc | 498 | 2,324 | 3.37 | 6 | 239 |
| AsterMind-CE | 114 | 259 | 2.27 | 6 | 20 |
| express | 48 | 57 | 0.94 | 1 | 7 |
| **commerce** | 64 | 38 | **0.59** | 2 | **3** |

`inDegree: 5` is *below average* in n-dx and an *impossible outlier* in commerce, whose maximum is
3. **Feeding degrees raw rebuilds the repo-prior that killed v1**, in a new coordinate system.

**2. External-package identity does not transfer. 305 of 341 packages appear in exactly ONE repo.**
Only **11** appear in ≥3 of 9 repos: `fs`, `os`, `path`, `url`, `typescript`, `vitest`, `vite`,
`esbuild`, `react`, `react-dom`, `zod`. Per-file coverage is also wildly uneven — files with any
external import range from **5.0% (hono) to 78.1% (commerce)**. A one-hot over package names is
path tokens again, wearing a different hat.

**3. Edge-type mix encodes the module system, not the file's role.** There are five types —
`static`, `type`, `reexport`, `dynamic`, **`require`**. express is **100% `require`**, fastify
91.6%; n-dx is 55.3% `static` / 30.8% `type`. That axis separates CommonJS repos from ESM repos.
*(I had a table without `require` in it first; it is in this ADR only because I checked my own
numbers before publishing them.)*

**4. `zones.json` is absent for 7 of the 9 repos surveyed** — only n-dx and AsterMind-CE have it —
and `category` is repo-specific by construction: n-dx's 11 values include `rex`, `hench`,
`sourcevision`; Vue core's 16 include `compiler-core`, `compiler-dom`. **Neither is usable as a
general feature**, and `zone` is currently emitted by the builder, which this ADR corrects.

**5. `role` is a constant on the population we classify, so feeding it is dead weight.** The
vocabulary is closed and small across repos — `source`, `test`, `config`, `build`, `generated`,
`asset`, `docs` — but **classification only ever sees `role: "source"`, and 536 of 536 harvested
rows carry exactly that value.** A constant column adds an input dimension carrying zero
information, which is the same waste as the dead `charSet` slots in `TN-B7`. It is withheld from
`features` and retained in `raw`, where it becomes informative the moment the population widens
beyond source files. *(I proposed feeding `role` in the first draft of this ADR and removed it on
re-validation.)*

Also structural, and it caps everything: **classification only ever sees `role: "source"`.** n-dx's
inventory is 1,525 entries — **test 825 · source 683** · build 10 · config 6 · docs 1. 54% of the
repo never reaches either model while `test-helper` is one of the 17 archetypes we must cover.
And **isolated source files** — zero edges in or out — range from **1.2% (n-dx) to 42.2%
(commerce)**, so graph features are genuinely absent for a large minority of rows in some repos.

---

## Decision

**We build the database as two labelled datasets over a shared three-layer row schema, ship the
import graph and inventory as first-class companion artifacts rather than flattening them away, and
derive every model-facing feature as a within-repo–normalised quantity.**

### 1. Two datasets, two warranties (ratifies `TN-N4`)

| dataset | population | labels | why it exists |
|---|---|---|---|
| **`residue`** | files the rules could not classify | LLM teacher | what the ELM must actually answer at the call site |
| **`resolved`** | files the rules classified confidently | algorithmic (regex) | the only source of `page`, `component`, `store`, `hook` in quantity |

They are **never merged into one file**. A row whose label means *"a teacher judged"* or *"a regex
fired"* — with nothing recording which — is the two-unrecorded-teachers defect (`TN-J31`) again.
Between them they cover all 17 archetypes; `resolved` costs **zero LLM calls** because
`elm-archetype-corpus-sanity.json` already exists (473 rows, `page` 7.8%, `component` 15.2%).

### 2. The three-layer row

Every row carries three layers, and **the layer boundary is the contract**:

```json
{
  "identity":  { "repo": "hono", "commit": "e2740d5a", "path": "src/middleware/cors/index.ts" },
  "label":     { "archetype": "middleware", "source": "llm", "confidence": 0.7,
                 "teacher": "claude-sonnet-5", "promptLevel": "full", "catalogVersion": "17-2026-09" },
  "raw":       { "role": "source", "language": "TypeScript", "loc": 47, "size": 1620,
                 "inDegree": 2, "outDegree": 5, "edgeTypes": {"static": 4, "type": 1},
                 "externalPackages": ["hono/utils"], "isolated": false, "inCycle": false },
  "features":  { "inDegreeNorm": 0.61, "outDegreeNorm": 0.74, "locNorm": 0.33,
                 "typeImportRatio": 0.2, "reexportRatio": 0.0, "valueImportRatio": 0.8,
                 "isolated": 0, "inCycle": 0, "pkgFamily": ["runtime-http"] }
}
```

- **`identity`** — what this row is about. `commit` is mandatory: a path without a commit is not
  reproducible.
- **`label`** — the target *and its provenance*. `teacher`, `promptLevel` and `catalogVersion` are
  what let a future reader split any result by how the label was made. **This is the layer that
  `TN-J31` and `TN-N8` exist because we did not have.**
- **`raw`** — measurements exactly as `sourcevision` reported them. **Auditable, never fed to a
  model.** This is what makes a re-derivation possible when we change our minds about features.
- **`features`** — the model-facing vector. **Every scale quantity is normalised so that finding 1
  cannot reappear.** Within-repo percentile is the *default*, **not a settled choice** — see below,
  which is a correction made on review.

#### ⚠️ The normaliser is an open question, and it is the one the whole transfer argument rests on

The first draft of this ADR treated within-repo percentile as decided. **Jam's review showed it has
the same disease as finding 1, one level up**, and re-measuring made the case stronger than theirs:

| a file with `inDegree: 1` sits at… | percentile | source files at in-degree 0 |
|---|---:|---:|
| n-dx | **12.5th** | 3.8% |
| Vue core | 31.4th | 21.5% |
| express | 60.4th | 29.2% |
| **commerce** | **72.7th** | **57.8%** |

**A 60-point swing for an identical file property.** A percentile is a rank within the repo's own
population, so it assumes repos have comparable composition — and this ADR's own finding (isolated
files 1.2% → 42.2%) measures that they do not. **The repo's shape is still in the feature, merely
laundered through a rank.**

Two alternatives, **both testable offline from `raw` at zero cost and zero LLM spend**:

- **`log1p(raw)`** — compresses the 10.2× spread (0 → 0, 3 → 1.39, 249 → 5.52) while remaining a
  property of the *file* rather than of its neighbours. Repo-independent by construction.
- **Global pooled quantiles** — rank against the pooled distribution across all repos, so the scale
  is fixed once and a fresh repo is scored against the same yardstick. **This also supplies a
  single-file runtime definition, which percentile does not have.**

**Decision: percentile is the default, the manifest records which normaliser produced a given
release, and the choice is settled by measurement before the first published accuracy number — not
by this ADR.** `raw` is what makes that an afternoon's arithmetic rather than a re-harvest, which is
the strongest single argument for keeping the layer.

**Why `raw` and `features` are both present, when one is derived from the other:** we have already
changed our minds about the feature space twice, and each time the corpus had to be re-harvested at
LLM cost. Keeping raw measurements means the next change is a script over committed data, not a
re-harvest. The LLM labels are the expensive part; the arithmetic is free.

### 3. What is fed, and what is deliberately withheld

**Fed (transferable by construction or by measurement):**

| feature | form | rationale |
|---|---|---|
| `inDegree` / `outDegree` | **normalised** — percentile by default; `log1p` and pooled quantile are live alternatives | a raw count does not transfer (finding 1); *which* normaliser is open, see above |
| `loc`, `size` | same normaliser as degrees | same reason |
| `typeImportRatio` | ratio of `type` edges to all out-edges | a types file is type-heavy in **any** module system |
| `valueImportRatio` | `static` + **`require`** collapsed | deliberately collapsed so CJS/ESM does not leak (finding 3) |
| `reexportRatio` | reexports / out-edges | the barrel/gateway signature; language-level |
| `isolated`, `inCycle` | boolean | structural, scale-free |

| `pkgFamily` | **curated** package→family map | see below |

**Withheld, with the reason recorded so nobody re-adds them by reflex:**

| withheld | why |
|---|---|
| `category` | repo-specific — n-dx's values are its own package names (finding 4) |
| `zone` id | repo-specific **and** absent for 7 of the 9 repos surveyed (finding 4). **The builder currently emits this; this ADR removes it from `features`.** It stays in `raw` when present. |
| raw external package one-hot | 305 of 341 packages are single-repo (finding 2) |
| raw `inDegree`/`outDegree`/`loc` as model input | 10× cross-repo scale spread (finding 1). Retained in `raw`. |
| raw edge-type counts | CommonJS/ESM confound (finding 3). Retained in `raw`. |
| `role` | **constant (`source`) on 536 of 536 harvested rows** — a dead input dimension. Retained in `raw`; becomes informative only if the population widens beyond source. |
| `language` | **Withheld on review (Jam, 2026-09-17), and it fails this table's own test twice.** It is **91.6% one value** (TypeScript 491 · JavaScript 33 · Vue 11 · Python 1), and its minority values are repo fingerprints: **all 11 `Vue` rows come from one repo, and all 11 are labelled `component`** — simultaneously a perfect repo identifier and a perfect in-sample label predictor, which is leakage, not signal. Retained in `raw`. A collapsed `typed-js` / `untyped-js` / `other` family is a defensible future variant and is re-derivable from `raw` without a harvest. |
| `depthFromRoot` | **Withheld on review.** The first draft called it "scale-free" while hiccup 8 said the opposite; both cannot be true. n-dx paths begin `packages/rex/src/…` before any content-bearing segment and express is flat, so raw depth encodes monorepo layout. A depth measured relative to the file's **package root** would be defensible, but it is unmeasured, and this ADR withholds unmeasured features by its own rule. Re-derivable from `raw`. |
| `symbols[]` on every edge | **Deferred, not dismissed — and its omission from this table was the gap in the first draft (Jam, 2026-09-17).** All 4,266 n-dx edges carry them, and they are plausibly the *most* transferable signal in the graph: importing `{describe, it, expect}` means *test* in any repo, `{useState}` means *component* anywhere — exactly the shape the curated `pkgFamily` map already handles. Not fed now because no symbol→family map exists and none has been measured. **Nothing is lost: the graph ships whole, so this is recoverable from committed data without a re-harvest.** It is the first feature to add after the schema settles. |
| **`callgraph.json` / `components.json`** | **Deferred by the lead 2026-09-18, and withheld by this ADR's own rule.** `sourcevision` emits six artifacts and this design uses two; the unused per-file ones are real — 6,277 functions with `isExported` and 180,237 call edges on n-dx, plus a component catalog. Jam measured an export ratio that orders sensibly by archetype (route-handler 0.30 → schema 0.86; **`gateway` files declare 0.0 functions**), which is a semantic regularity rather than a naming convention. **But they are in precisely the evidentiary state as `zone`: present on n-dx and AsterMind-CE, absent on the other eight** — because every harvest run stopped after phase 3, so phases 5–6 never ran. Feeding them now would be the first exception to a rule that has already caught four bad features, on one repo's worth of evidence, against our own 72.3% labels. **Backfilling costs zero LLM calls** (`analyze <repo> --only=callgraph`), so this waits without costing anything. |
| `hash`, `lastModified` | no archetype signal; `lastModified` actively invites leakage by harvest order |

**`pkgFamily` is a small hand-written map, not a learned vocabulary** — roughly a dozen entries over
the 11 packages measured to transfer, e.g. `react`/`react-dom` → `ui-view`, `zod` → `schema`,
`vitest` → `test`, `fs`/`path`/`os`/`url` → `node-builtin`. It is capped deliberately: **an
open-ended package vocabulary is the trap finding 2 identifies.** Adding a family is a reviewed
edit, and the map ships with the dataset so a consumer can audit or ignore it.

### 3a. ⚠️ Block scale is a declared contract, not an emergent constant

**Added on review (Jam, 2026-09-17). Measured by Jam, reproduced independently by me against the
real pipeline before adopting it.**

The `features` layer is presented as the model-facing vector, so the first consumer will concatenate
it with the path block. **On measured magnitudes that concatenation silently decides which signal
dominates**, and nobody has chosen it.

`TFIDFVectorizer.vectorize()` **does not normalise** — `l2normalize` is an opt-in static utility
(`dist/ml/TFIDF.d.ts:35`, documented "Optional L2 normalization utility") and **nothing in our
scripts calls it.** Measured over all 464 corpus-v2 train rows, using the frozen spec's own
`vocabCap: 4000` and `docOf = tokenize(p).join(" ")` exactly as `elm-certify.mjs:50,144` does:

| block | dims | squared L2 energy |
|---|---:|---|
| **path (TF-IDF)** | 2,890 | **mean 1.464** · p10 0.963 · p90 2.44 · nonzero entries mean 16.0 (min 3, max 27) |
| **structural** (12 scalars ~ U[0,1]) | 12 | **expected 4.000** — each additional one-hot family adds ~1.0 |

**The twelve-scalar structural block alone carries ~2.7× the energy of the entire 2,890-dimension
path block**, and each one-hot family pushes it toward 4–5×. An ELM's hidden layer is a random
projection, so what each unit sees is driven by the relative energy of the input blocks: **the path
signal becomes a minority contributor to its own classifier.**

That may be the right outcome. **The point is that it would happen by accident**, falling out of an
unstated constant — twelve values that look innocuous because they live in `[0,1]`, against a sparse
block that happens to sit near unit norm. **And the path is not a weak signal to down-weight by
default: the human path-only ceiling is 85.4%.**

**Decision:** block scaling is the **consumer's** choice and the dataset states it rather than
implying one.

- `FEATURES.md` carries the measured energies above and names the decision explicitly.
- **`manifest.json` carries a `blockEnergy` record** — the measured path-block energy for that
  release and the structural block's dimension count — so a consumer can compute a scale factor
  without re-deriving anything.
- **No schema change and no harvest change**, and if a scale factor is later needed, `raw` is what
  makes it re-derivable.

*Reproduction note: my figures match Jam's to three decimals on mean and p10 (1.464 / 0.963) and on
nonzero counts (16.0 / 3 / 27); p90 differs trivially at 2.44 vs 2.393, which is percentile
indexing, not disagreement.*

### 4. The import graph ships whole, not only as features

**The per-repo graph and inventory are committed as companion artifacts**, keyed by
`repo@commit`, alongside the row files:

```
datasets/
  residue/rows.jsonl              one row per line
  resolved/rows.jsonl
  graphs/<repo>@<commit>.json     { edges[], external[], summary{} }  — as collected
  inventory/<repo>@<commit>.json  { files[] }                          — as collected
  manifest.json                   schema version, checksums, per-repo provenance, teacher mix
  FEATURES.md                     every feature: how derived, why it transfers, what it withholds
```

This is the same argument Syrup's ADR made about the corpus versus the model, one level down:
**the graph is the collected asset and the feature vector is a derivative.** A consumer who
disagrees with our feature choices — Team Jarrett's numeric evidence-vector model is a real example
— can recompute from the graph without re-analyzing anything. Flattening the graph into six columns
and discarding it would make every future feature decision cost another harvest.

Size is not an obstacle: n-dx's is the largest at 4,266 edges, and typeorm's 11,775-edge graph is
well under a megabyte as JSON.

### 5. How it gets made

Seven steps. **Steps 1–3 spend nothing.**

1. **Pick repos by class need, not by count** (`TN-N12`). Measured resolution rates run from
   commerce 76.6% to typeorm 5.7%, so the residue that becomes rows varies ~13× by ecosystem;
   random sampling reproduces the class skew — which is how seven ecosystems produced one `hook`
   row. `nest`/`remix`/`payload` are already cloned and target `model`, `route-module`, `page`,
   `component`, `hook` — classes **n-dx cannot produce at any price**.
2. **Pin the teacher** in each target repo (`<repo>/.n-dx.json` → `llm.claude.model`) before
   analyzing, or it silently takes `NEWEST_MODELS.claude`. This is how the current corpus ended up
   with two teachers and no record of it.
3. **Send the row schema to Syrup for review before any harvest at scale** — they have measured
   three models against three populations and can say whether a schema survives the coverage check.
   That review is free; discovering it afterwards costs the LLM spend.
4. **Analyze** — `sourcevision analyze <repo> --full`. ⚠️ Writes `.sourcevision/` into the **target**
   repo, which no git worktree isolates. Stage under `~`, never the session scratchpad.
5. **Harvest both populations in one pass.** One `--source=llm` build and one `--source=algorithmic`
   build over the same `.sourcevision/`, so `residue` and `resolved` are guaranteed to describe the
   same commit.
6. **Derive `features` from `raw`** in a separate, re-runnable step. Normalisation statistics are
   computed **per repo** and recorded in the manifest, so a consumer can reproduce or replace them.
7. **Run the coverage check on a repo outside the set** before publishing any number. It needs no
   labels. This is the one check that would have caught v1.

### 6. Making it usable — the access problem, set aside from the hosting problem

The hosting question (private repo, personal account) is the lead's and is explicitly **not** what
this section is about. **Accessibility here means: can a stranger with the bytes use them
correctly?** Six commitments:

1. **JSONL, not one big JSON array.** Streamable, greppable, diffable line-by-line, and a corrupt
   line costs one row instead of the file.
2. **`manifest.json` is the entry point** — schema version, per-file SHA-256, row counts, class
   distribution, **per-repo teacher and commit**, and the normalisation statistics. A consumer
   checks integrity and provenance without parsing a row.
3. **The seeded split ships as an assignment column, not as two files.** Seed 42, holdout 0.25,
   stratified. **Do not re-split** — re-splitting makes results incomparable to everything in
   `ELM-FINDINGS.txt`.
4. **A ~50-line dependency-free loader** in the repo — read JSONL, select a layer, materialise a
   feature matrix in declared column order. **Column order is part of the contract**, because a
   silently reordered matrix is a bug nobody sees.
5. **`FEATURES.md` states the envelope, not just the caveats.** Two sentences are required rather
   than implied: **percentile features are defined only relative to a population, and a single-file
   consumer is outside the tested envelope** — the manifest fallback is a convenience, not a
   demonstration that it works. This is stronger than "the fallback is untested", and deliberately
   so: `TN-J19`'s operating point is *also* rank-based (a 13-class softmax caps confidence at 0.245,
   so B+su admits "the top 10% most confident" — a rank within a batch). **Under this ADR there
   would be two stacked rank-based normalisations and no absolute anchor anywhere in the stack, and
   for one file at runtime neither rank exists.** Jam records the single-file gap as theirs, on the
   operating-point side; it is named here because this is where it became visible.
6. **`FEATURES.md` and the warranty travel with the data.** Every caveat in `ELM-CORPUS.md` §§ 3a,
   5a, 6, 7 — the teacher is 72.3% against truth and is **not shown the path only**; the residue
   population; the `role: "source"` ceiling; the contamination boundary. **Rows shipped without
   these invite exactly the mistake we already made.**
7. **Nothing is required from `n-dx` to consume it.** No workspace dependency, no `sourcevision`
   install, no `@n-dx/*` import. The dataset is plain data plus one loader.

### 7. The blind set stays blind

Gold set #2's **250 files (hono + trpc)** are never sampled, never trained on, never featurised into
either dataset. **And neither are the 105 unsampled candidates from the same two repos** — they are
files from our only fresh-ecosystem probes, and the existing contamination assertion is *path-level*
and would pass on that harvest (`ELM-CORPUS.md` § 7). The builder asserts on **repo identity**, not
just path, and refuses to build otherwise.

---

## Alternatives considered

| Option | Why not |
|---|---|
| **Keep path-only; fix generalisation with more repos** | Directly measured against: 2 → 7 ecosystems left the skew intact, and the v1 collapse was a *feature-space* failure, not a sample-size one. `TN-J9` predicted it 19 days before it happened. |
| **Feed raw degrees, `loc`, edge-type counts** | The 10× cross-repo degree spread (finding 1) and the CJS/ESM confound (finding 3) mean this teaches the repo, not the file. It is the v1 mistake in new coordinates. |
| **One-hot every external package** | 305 of 341 packages are single-repo (finding 2). This is path tokens again. The curated family map keeps the transferable ~11 and discards the vocabulary. |
| **Ship only `features`; drop `raw` and the graph** | Smaller, and wrong. Every feature revision would cost another LLM harvest. The graph is the collected asset; the vector is a derivative that an hour of CPU reproduces. |
| **Merge `residue` and `resolved` into one corpus** | A label that means "teacher judged" *or* "regex fired", unrecorded, is `TN-J31` again. Rejected by the lead 2026-09-16 and re-confirmed here. |
| **Include file content now** | The lead has deferred it, and it is genuinely separate work: raw text is collected **nowhere** today, so it is new collection with its own storage, licensing and cost profile. The three-layer schema leaves room for a `content` layer without a re-harvest. |
| **Emit `zone` as a feature (status quo in the builder)** | Absent for 7 of the 9 repos surveyed, and repo-specific where present. This ADR removes it from `features` and keeps it in `raw`. |

---

## Consequences

**Easier.** Feature revisions stop costing LLM calls — `raw` plus the committed graph means the
next change is a script. `page`, `component`, `store` and `hook` become reachable at all, through
`resolved`. Provenance questions (`TN-J31`, `TN-N8`) become answerable per row rather than
per corpus. And a consumer who rejects our feature choices can still use the data.

**Harder.** Two datasets, two documents, two warranties to keep honest. Within-repo normalisation
means **a single file cannot be featurised in isolation** — it needs its repo's statistics, which
the manifest must carry and a runtime consumer must apply. The curated `pkgFamily` map is a
maintained artifact, and a map that grows carelessly becomes the vocabulary it was meant to avoid.

**What breaks.** `elm-corpus-build.mjs` gains a layered writer and loses `zone` from the model-facing
columns. **Existing artifacts are not regenerated** — v1 and v2 stay exactly as they are, because
every number in `ELM-FINDINGS.txt` is measured against them.

~~**Needs a second lead (outward-facing):** publishing the dataset anywhere outside this repo, and
any access change to the deliverable repo.~~ **RESOLVED 2026-09-18 — the deliverable repo is
public.** The distribution question is settled; what remains is that **anything published is public
permanently**, so the warranty (§ 6) is no longer a courtesy to two known teams but the only thing
standing between a stranger and the mistakes this corpus has already made once.

**Teams affected: Jarrett directly.** Their harness is a *numeric evidence-vector* model
(`classify-elm.ts`), and its zero-evidence guard at `:350` skips 100% of the path-text population —
so a structural-feature dataset is closer to what their model already consumes than our path corpus
ever was. **`TJ-A3` is redesigning `BUILTIN_ARCHETYPES`** (adding `algorithm`, plus three
`entrypoint` signals) on a commit that is **on no remote**, so a relabel is coming. `catalogVersion`
in the `label` layer exists for exactly that, and it makes the relabel a script.
~~**No note has been sent to Jarrett or Thomas.**~~ **RESOLVED 2026-09-18 — both teams have been
informed by the lead.** What still has no owner is the *technical* hand-off: `TJ-A3` is moving
`BUILTIN_ARCHETYPES` under us, and `catalogVersion` scripts a rename but **not** a class split.

---

## Hiccups we should expect

Named now because each is cheaper to design around than to discover.

1. **The taxonomy moves under us.** `TJ-A3` is live and unpushed. Any corpus keyed to today's 17
   labels needs remapping. *Mitigation:* `catalogVersion` per row — **and that mitigation is
   weaker than the first draft claimed (Jam, 2026-09-17).** Renames and merges are scriptable from
   a version stamp. **A class split is not.** `TJ-A3` adds a *new* class (`algorithm`), so a row
   labelled `utility` under `17-2026-09` may be `algorithm` under the next catalog and **nothing in
   the row says which** — resolving it needs a human or the teacher, i.e. spend. Stated plainly
   because "relabel is a script" will otherwise be quoted as though the taxonomy risk were handled.
   It is handled for renames and merges only.
2. **Rank-based features need a population, and at runtime there is not one.** A consumer
   classifying a single file has no repo statistics. **Sharper than the first draft framed it:**
   `TN-J19`'s operating point is *also* rank-based, so the stack would carry **two rank
   normalisations and no absolute anchor**, and for one file neither rank is defined — independent
   of features. *Mitigation:* per-repo statistics in the manifest, a documented global-median
   fallback stated as **outside the tested envelope**, and **pooled global quantiles as the live
   alternative that would dissolve most of this** (see § 3's normaliser subsection).
3. **Isolated files: 1.2% → 42.2% of source files by repo.** In commerce, 42% of files have no
   graph signal at all, so the whole structural half of the vector is absent. *Mitigation:* an
   explicit `isolated` flag rather than a silent zero vector — **the same distinction as `null` vs
   `0` in omission counting**, and for the same reason.
4. **Zero-vs-missing, everywhere.** A real `inDegree: 0` and an unmeasured one must never collapse.
   Already enforced in the builder: `featuresAvailable` per repo, and omission counts that return
   `null` rather than 0 when the LLM pass did not run.
5. **`resolved` teaches the regex — and buys coverage, not capability at our own call site.** Its
   labels *are* the rules' output, so a model trained on it learns `archetypes.ts`: legitimate for
   covering classes the teacher never sees, **illegitimate as evidence the model is good.** The
   second half matters as much (Jam, 2026-09-17): **in production the rules run first and catch
   every `page` file, so no `page` file ever reaches the residue tier.** The coverage is real for a
   whole-repo consumer (Jarrett's prefilter) and **worth nothing at our own call site.** "Between
   them they cover all 17 archetypes" is the sentence a reader carries away, so it never travels
   without this qualification.
6. **Class imbalance is not fixed by any of this.** Eight classes are under 10 rows today. Recall
   floor from our own data: `entrypoint` 59 rows → 85%, `types` 34 → 42%, 1–2 rows → **0%**.
   Target **30 rows/class floor, 50 ideal**.
7. **The teacher is 72.3% against truth and is not shown the path only.** Structural features change
   the student; they do not change the teacher. **Nothing in this ADR improves label accuracy** —
   `TN-J22` (the classify prompt) remains the only lever on that, and it is unclaimed.
8. **Monorepo vs single-package skew.** n-dx and trpc are monorepos; express is one package. Depth
   and degree distributions differ structurally, and percentile normalisation only partly absorbs it.
   Untested, and stated as untested.
9. **`svelte` and `typeorm` have 0 LLM rows** despite 951 analyzed files — `--fast` gates the
   classify pass. They contribute to `resolved` for free and need real calls for `residue`.
10. **Cost is not the constraint; collisions are.** ~15 repos, residue-only, is ~150 calls ≈ $12–30.
    But `analyze` writes into the target repo and the staging tree is shared and un-versioned — **two
    agents harvesting at once will corrupt each other silently.**
11. **⚠️ `ELM.train()` does not train on what you pass it.** Anything measured through it is void —
    the repo's own smoke test scores 83% with no training data. Use `trainFromData(X, y)` with
    explicit one-hot `y`. `ELM-CORPUS.md` § 10a.
12. ~~**Corpus v2's generalisation is still untested**, and a 28.0% coverage figure is circulating
    with no committed artifact…~~ **RESOLVED 2026-09-18 — measured, and it FAILS.** Jam ran the
    check (`scripts/data/elm-coverage-v2.log`, invocation and hashes committed): **33.8% on
    trained-on ecosystems (PASS), 28.0% on fresh (K1′ FAIL)**; hono 35.8% PASS, trpc 24.3% FAIL.
    The circulating figure was **correct to the decimal**. **This does not weaken this ADR — it is
    the confirmation it was written against:** v2 improved fresh-ecosystem coverage **13.2% → 28.0%**
    by widening ecosystems alone, and still missed the bar, which is the strongest available
    evidence that the residual failure is in the **feature space**. **28.0% is now the committed
    baseline any successor must beat, on the same 250 files at the same operating point.**

---

## Evidence

**Nothing here is an ELM-viability claim — this ADR proposes no accuracy number, and that is
deliberate.** No model has been trained on this schema. What follows is the measured basis for the
*design*, all verified by execution against committed artifacts and the staging tree on
2026-09-16/17.

| claim | how measured | where |
|---|---|---|
| degree scale varies ~10× across repos (0.59 → 6.04 mean in-degree) | counted `imports.json` edges against `role: "source"` files, 9 repos | staging tree + this repo |
| 305 of 341 external packages are single-repo; 11 appear in ≥3 of 9 | inverted `external[].importedBy`, 9 repos | same |
| five edge types incl. `require`; express 100% `require`, fastify 91.6% | `Counter` over `edges[].type`, 9 repos | same |
| `zones.json` absent for 7 of 9 repos surveyed (only n-dx, AsterMind-CE have it) | file existence check | `scripts/elm-feature-survey.mjs` |
| `category` is repo-specific | 11 distinct on n-dx (`rex`, `hench`, `sourcevision`), 16 on Vue core (`compiler-core`, `compiler-dom`) | `scripts/elm-feature-survey.mjs` |
| `role` is constant (`source`) on 536 of 536 harvested rows | `Counter` over `role` on a 4-repo build | `scripts/elm-corpus-build.mjs` output |
| inventory 1,525 = test 825 / source 683 / build 10 / config 6 / docs 1 | `Counter` over `role` | same |
| isolated source files 1.2% → 42.2% | source files absent from every edge endpoint, 9 repos | staging tree |
| path block 2,890 dims, squared L2 energy mean 1.464 / p10 0.963 / nonzero 16.0; structural 12 scalars → expected 4.000, ~2.7× | measured by Jam; **reproduced independently by me** using the frozen spec's `vocabCap: 4000` and `docOf` exactly as `elm-certify.mjs:50,144` | `scripts/data/elm-archetype-corpus-v2.json` + `elm-frozen-model-v2.json` |
| `TFIDFVectorizer.vectorize()` does not normalise; `l2normalize` is opt-in and never called | `dist/ml/TFIDF.d.ts:35` + grep over `scripts/` | library + repo |
| `inDegree: 1` sits at the 12.5th percentile in n-dx and the 72.7th in commerce | midrank percentile over `role: "source"` files, 4 repos | `.sourcevision/` artifacts |
| all 11 `Vue` rows come from one repo and are all labelled `component` | `Counter` over language × repo × label on a 4-repo build | `scripts/elm-corpus-build.mjs` output |
| all 4,266 n-dx edges carry `symbols` | count of edges with non-empty `symbols` | `.sourcevision/imports.json` |
| resolution rates 76.6% (commerce) → 5.7% (typeorm) | Syrup, `TN-S1` — **relayed, not re-measured by me** | Syrup's groundwork note § 7 |
| recall floor: `entrypoint` 59 rows → 85%, `types` 34 → 42%, 1–2 rows → 0% | Syrup — **relayed, not re-measured by me** | same, § 7 |
| v1 collapse: 96.4% vs teacher 48.4%, coverage 34.9% → 13.2% | `scripts/elm-coverage-check.mjs`, frozen v1 | `ADR-2026-09-04-syrup-…` Evidence table; `ELM-CORPUS.md` § 6 carries the S/U and label counts but not the coverage figures |
| **v2: 33.8% trained-on (PASS) → 28.0% fresh (K1′ FAIL); hono 35.8% PASS, trpc 24.3% FAIL** | `elm-coverage-check.mjs` under `--max-old-space-size=6144`, frozen v2 (sha256 `3a41980d…`) | **`scripts/data/elm-coverage-v2.log`** — committed artifact, Jam, 2026-09-18 |
| teacher 72.3% vs truth; human path-only ceiling 85.4% | 83-row two-pass human gold set | `ELM-CORPUS.md` § 3 |

### Re-running the measurements

```sh
node scripts/elm-feature-survey.mjs            # the four findings, as a table
node scripts/elm-feature-survey.mjs --json     # machine-readable
```

**Committed with this ADR** (`scripts/elm-feature-survey.mjs`) rather than left as the ad-hoc
commands I first ran — by this project's own standard those were not yet evidence anyone could
check. It is read-only over committed `.sourcevision/` artifacts, spends no LLM calls, writes
nothing into any analyzed repo, and needs no dependencies. There is no seed because there is no
sampling: every number is a deterministic count, so two runs on the same inputs are byte-identical
by construction.

**Re-validating against it changed this ADR twice** — the `zones.json` count was wrong (I had said
1 of 10; it is 2 of 9, because I had omitted n-dx itself from the earlier check), and `role` moved
from the fed column to the withheld column once the survey showed it constant. Both corrections are
in the text above rather than only here.

### What is explicitly NOT evidence

1. **No model has been trained on this schema.** Every transfer argument above is mechanical or
   measured about the *data*, not demonstrated about a *model*. The coverage check on a held-out
   ecosystem is what would demonstrate it, and **it has not been run on a structural-feature
   model.** *(It has now been run on the path-only v2 model — 28.0%, K1′ FAIL — which supplies the
   baseline but proves nothing about this schema.)*
2. **The normaliser is unresolved, and this is now stated in the Decision rather than buried here.**
   Percentile follows from the 10.2× spread but imports repo composition; `log1p` and pooled
   quantiles are untested alternatives. **No accuracy number is published before this is settled by
   measurement** — which `raw` makes free.
3. **The `pkgFamily` map does not exist yet**, and its 11 transferable packages are a thin base.
4. **The single-file runtime fallback is untested** (hiccup 2).
5. **Two cited figures are Syrup's, relayed and not independently re-measured by me** — marked as
   such in the table above.
