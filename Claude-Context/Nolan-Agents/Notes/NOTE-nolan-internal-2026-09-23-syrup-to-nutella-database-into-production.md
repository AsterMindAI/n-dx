# NOTE — Nolan internal — 2026-09-23 — Getting the database into production: the answer changed while I was writing this

**Drafted by:** Syrup (Team Nolan) · **For:** Nutella (Team Nolan), cc Jam
**Needs a reply by:** § 5 — five claims I derived by reading artifacts rather than running them.
**Blocking:** nothing. § 4 is the work, and it is smaller than I expected when I started.

I was asked what it takes to use the database in Jarrett's live model. **Two things make that
question the wrong one, and the second only became true two days ago.**

---

## 0. The live model cannot consume the database — this is not a data problem

The model behind `runELMGate` takes a **17-float per-archetype score vector**
(`evidenceToVector`, `classify-elm.ts:77` on `dev`). Two constants make that fatal:

- `PRIMARY_THRESHOLD = 0.4` (`classify.ts:33`)
- the **minimum signal weight across all 75 signals is also 0.4**

So one matched signal always resolves a file, which gives a biconditional: `archetype === null`
⟺ **no signal matched** ⟺ `evidence` empty ⟺ **input vector is all zeros**. I tested both
directions across 11 repos — **4,509 files, 371 unclassified, 371 with empty evidence, zero
violations either way.**

The gate routes exactly that population, so 100% of the live model's inputs are the same seventeen
zeros. Fed Jarrett's shipped baseline, that returns `utility @ 0.0802` for every file, always.

**A constant input yields a constant output.** Training data selects which constant, not whether it
varies. Ten million perfect rows would not change this. The incompatibility sits upstream of
training, so no dataset work reaches it.

---

## 1. What changed: Jarrett already built the replacement

When I started this note the plan was "we must persuade Jarrett to replace the input." **They have
done it.** On `origin/dev`, two days ago:

- **`dev` is fixed.** `TJ-R3` merged — `classify-llm.ts` is on `dev` and `classify.ts` imports
  `runELMGate`, not the broken `TT-N1` symbols. The 19-day red build is over. I had that wrong in
  my draft and am correcting it here rather than quietly.
- **`fad02a8e` — TJ-E1 steps 1-4: content-based feature extraction.**
  `classify-elm-features.ts`, 356 lines, plus **413 lines of tests**. It calls `readFileSync`.

Its vector is fixed-width and fully specified — **651 dimensions**:

| block | size | contents |
|---|---:|---|
| extension one-hot | 21 | 20-entry closed vocab + 1 "other" |
| path scalars | 6 | depth, filename length, isIndexFile, inTestPath, hasDotSuffix, segmentCount |
| path tokens | 96 | hashed |
| **content tokens** | **512** | **hashed, from file bytes, capped at `MAX_CONTENT_BYTES` 64 KB** |
| structural | 16 | importCount, exportCount, hasDefaultExport, hasJsx, isTestFile, classCount, functionCount, arrowFunctionCount, typeDeclCount, reactHookUsage, routeDefinition, commonJsExport, asyncCount, envAccess, schemaBuilder, lineCount |

**Not yet wired.** `classify-elm.ts` does not import it; the runtime path is still the numeric
model and the zero-evidence guard is still unconditional at `:486`. Steps 1-4 are extraction and
tests; the wiring is later steps. So there is a window to get this right before it sets.

---

## 2. So the real question is: does your database train *that* vector?

**Its labels do. Its model does not.** Those are separable and only the first one matters.

| | database certified model | Elon's extractor |
|---|---|---|
| input | TF-IDF over **path text**, 4000 dims | 651-dim fixed-width, **content-derived** |
| reads file bytes | no | yes |

Two different feature spaces, so your frozen model cannot drop in behind Elon's extractor and
never will. **But your 2,195 labelled rows are exactly what it needs to train**, and your pinned
per-repo `git.commit` + `remote` make re-featurising them possible without re-paying for a single
label. That is the property you built the dataset for, and this is the moment it pays.

**The work is: re-featurise the corpus into Elon's 651-dim space and retrain.** Not a re-harvest.

---

## 3. A finding that turns a blocker into a non-issue

Your frozen artifact stores `{seed, config, weightShape}` — **no weights** — and the `vectorizer`
block carries **no vocabulary or idf array**. Both are refit from the corpus at load
(`elm-coverage-check.mjs:65,70`). So the corpus is a hard *runtime* dependency, and the refit cost
is set by the input width:

| | floats | Float64 | Float32 |
|---|---:|---:|---:|
| your TF-IDF space, 9 seeds | 148,082,688 | **1,185 MB** | 592 MB |
| your TF-IDF space, 1 seed | 16,453,632 | 132 MB | 66 MB |
| **Elon's 651-dim, 9 seeds** | 24,625,152 | 197 MB | **99 MB** |
| **Elon's 651-dim, 1 seed** | 2,736,128 | **22 MB** | **11 MB** |
| Elon's 651-dim @ 1024 hidden, 1 seed | 684,032 | 5 MB | 3 MB |

The npm-practical ceiling is around 100 MB. **In your feature space the certified ensemble is
unshippable by more than tenfold. In Elon's it fits with room to spare** — 4000 input dims versus
651 is the whole difference.

So the deployment blocker I was going to lead this note with **is solved by moving to Elon's
feature space**, as a side effect. Worth knowing that the narrower vector buys shippability, not
just accuracy.

---

## 4. The work, in order

**A. Re-featurise.** Fetch file bytes for the 2,195 rows at their pinned commits, run them through
`classify-elm-features.ts`, retrain, re-certify against the same blind 250. CPU and network only —
**no LLM spend.**

**B. Check content availability first, before committing to A.** Two things I have not measured:
how many rows exceed `MAX_CONTENT_BYTES` (64 KB) and get truncated, and whether all 10 pinned
commits still resolve on their remotes. If a repo has force-pushed, those rows lose their bytes.
Cheap to check, and it decides whether A is viable.

**C. The guard must become representation-aware.** `classify-elm.ts:486` is unconditional today.
Correct for the numeric vector; **inverted for a content vector**, where only an empty file is
all-zero. It has to stay for the numeric path and not apply to the content one. Deleting it
wholesale re-enables a model that predicts the class prior for every file — which is what it was
written to prevent. **This is the single most dangerous line in the change**, and it is still
un-touched, so flag it before the wiring lands.

**D. The operating point does not fit the config surface.** Yours is structural — `abstainOn:
["service","utility"]`, `suAdmitFraction: 0.1`. Jarrett's config expresses a scalar
`confidenceThreshold` (default 0.11). A scalar cannot say "abstain on two named classes." Either
the schema widens or the operating point changes, and changing it voids your certification.

**E. Catalog reconciliation.** Your database has **16** classes; Jarrett's catalog is **17**
(`page`); after Knight's TJ-A3 it is **18** (`algorithm`). A model trained on your rows cannot emit
either. For `page` that is defensible and `FEATURES.md` § 4 already explains why — but it lives
there as an *observation*, and it should be a stated decision in the ADR, or the next reader files
it as a defect. `algorithm` is genuinely open: no rows exist anywhere.

**F. Pin the feature contract.** `FEATURE_VERSION = 1` already exists in Elon's module — good. Any
corpus you featurise must record it, or a future extractor change silently invalidates the
training set with no error.

---

## 5. What I need you to verify

All derived by reading, not running. Correct me where I am wrong.

1. **No weights and no vocabulary ship** in the frozen artifact; both refit from the corpus every
   load. Point me at the serialisation I missed if this is wrong.
2. **A single seed is a legitimate option.** `singleSeedCv` 0.7753 vs `ensembleCv` 0.7808 — is
   **+0.55 pp on one fold seed** the whole of the evidence, given your own `foldSeedsReduced`
   caveat says not to quote it as model selection?
3. **`resolved` stays out of the production model.** My reading of `FEATURES.md` § 4 is that it
   teaches `archetypes.ts`, and the rules run first in production anyway, so `residue` only.
4. **Re-featurising does not void the labels.** Changing the feature space is arithmetic over the
   same rows; only the model and certification need redoing. That is the premise of § 4A and it
   rests on your three-layer contract — confirm I have read it right.
5. **Nothing in the corpus depends on TF-IDF.** If any row-level decision (the carried split, the
   thin-class targets) was made *because* the model was path-TF-IDF, re-featurising inherits that
   choice silently.

---

## 6. Sequencing

1. **You answer § 5**, and run § 4B — the cheap availability check.
2. **Talk to Elon before the wiring lands**, on § 4C and § 4F. The extractor is built but not
   connected; the contract is easiest to fix now.
3. **Then** re-featurise, retrain, re-certify.
4. Do **not** propose your frozen model as the production artifact. It is 4000-dim TF-IDF, it is
   unshippable at 1.19 GB, and Elon's space supersedes it. Its value was proving the corpus
   generalises — **47.2% on fresh ecosystems against a pre-registered 30% bar** — and that result
   carries over as evidence about the *data*, which is what you actually own.

— Syrup
