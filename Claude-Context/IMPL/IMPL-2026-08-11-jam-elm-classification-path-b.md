# IMPL — ELM/KELM archetype classification (Path B)

- **Implements:** [`ADR-2026-08-11-jam-elm-replacement-survey-and-split.md`](../ADR/ADR-2026-08-11-jam-elm-replacement-survey-and-split.md)
- **Owner:** _(unassigned — Path B is not yet allocated to a team)_
- **Author:** Jam (Team Nolan), under `TN-J1`
- **Backlog item:** `TN-J2` gates this; the implementing team opens its own `<TEAM>-<agent>N` rows
- **Branch:** `elm/<lead>/<topic>` — to be created by the implementing team
- **Worktree:** `../n-dx-<agent>`
- **Status:** Not started

> Every `file:line` below was re-verified against the working tree at commit `33365785` on
> 2026-08-11. Two corrections to what I published earlier are recorded in § Corrections.

## Scope

**In scope:** inserting an ELM/KELM tier between the deterministic classifier and the LLM
enrichment call in sourcevision's classification phase, so the LLM is only paid for what the ELM
cannot confidently label.

**Out of scope (explicitly):**
- The rex granularity site (`reason.ts:1481`) — that is Path C.
- Registering ELM as an `llm-client` vendor — see the ADR amendment; the vendor seam is
  text-to-text and a classifier does not fit it. This IMPL uses the call-site tier, option (b).
- Replacing the deterministic pass. It is free and it works; the ELM sits *after* it.
- Any of the 20 generation call sites.

## The insertion point

Classification is already a two-stage pipeline with a gap in the middle. The ELM goes in the gap.

```
analyzeClassifications()            classify.ts:60      deterministic, free
        ↓  files where archetype === null && source === "algorithmic"   (classify.ts:337-339)
   ◆ NEW: ELM/KELM tier ◆
        ↓  whatever the ELM declines (below confidence threshold)
enrichClassificationsWithLLM()      classify.ts:328     the call we are trying to shrink
        ↓
mergeClassificationResults()        classify.ts:559     merges by path
```

Wired in `packages/sourcevision/src/cli/commands/analyze-phases.ts`:

| Line | What |
|---|---|
| `183` | `runClassificationsPhase()` |
| `209` | `analyzeClassifications(...)` — deterministic pass |
| `219` | `if (!ctx.fastMode && classifications.summary.totalUnclassified > 0)` — the LLM gate |
| `221` | `await enrichClassificationsWithLLM(classifications, inventory, importsData)` |
| `223` | `mergeClassificationResults(...)` |

> ⚠️ **`analyze-phases.ts` contains two raw NUL bytes** (offsets 16345 and 16374), used
> deliberately as field delimiters inside a template literal:
> `` `${names}\x00f=${z.findings?.length ?? 0}\x00i=${z.insights?.length ?? 0}` ``.
> They are committed on `origin/main`, not local corruption, and **we are leaving them alone.**
>
> The consequence you must plan around: `file` reports this file as `data`, so **`grep` skips it
> silently** — it returns exit 1, not a match, and prints nothing. I missed the pipeline wiring
> twice this way before catching it. Use `python3`, `rg --text`, or `grep -a` when searching this
> file. Assume any repo-wide grep you run has a hole in exactly the file that wires your feature in.

**The new tier has the same signature as the LLM one**, so it is an insertion, not a rewrite:

```ts
(classifications: Classifications, inventory: Inventory, imports: Imports)
  => Promise<{ updatedFiles: FileClassification[]; tokenUsage: AnalyzeTokenUsage }>
```

## What the library actually gives us

Verified by reading `node_modules/@astermind/astermind-community@3.0.0/dist/*.d.ts`. **Dependencies
are installed** — this was not true earlier today, see § Corrections.

| Export | Why it matters here |
|---|---|
| `ELM` | Text-native: `predict(text, topK)`, `charSet`, `useTokenizer`, `maxLen`, `seed`. Path strings go straight in. This is what `elm-hello-world.mjs` uses. |
| `KernelELM` | Numeric only — `KernelELMConfig` takes `outputDim`, `kernel`, `ridgeLambda`. **No tokenizer.** Needs a vectorizer in front. |
| `KernelType` | `'rbf' \| 'linear' \| 'poly' \| 'laplacian' \| 'custom'` |
| `KELMMode` | `'exact' \| 'nystrom'` — Nyström with `m` landmarks (default ~√N), `strategy`, and a **`seed`**. This removes the N² scaling objection I raised earlier. |
| `Evaluation` | Returns `ClassificationReport`: `confusionMatrix`, per-class precision/recall/F1/support, macro/micro/weighted averages, `logLoss`, `topKAccuracy`. **This is the B1 harness — do not hand-roll accuracy code.** |
| `ConfidenceClassifierELM` | A meta-classifier over `(vector, meta)` returning `predictScore()` — a purpose-built abstain mechanism for "is this prediction trustworthy". Candidate for the fallback gate. |
| `OnlineELM` | `update(X, Y)` — RLS/OS-ELM incremental update with a forgetting factor. Maps onto sourcevision's existing incremental mode (`changedFiles`, `previousClassifications`). |
| `TFIDF` / `TFIDFVectorizer` / `UniversalEncoder` | The vectorizers KELM needs. |
| `Augment` | `addSuffix`, `addPrefix`, `addNoise`, `generateVariants` — relevant because our corpus is small. |
| `ELM.saveModelAsJSONFile()` / `loadModelFromJSON()`, `KernelELMJSON` | **Models serialize.** The "where does a trained model live" open question from the ADR has a mechanical answer; the policy question remains. |

**ELM vs KELM is not a coin flip — they take different inputs.** `ELM` is text-native and works on
raw paths today. `KernelELM` needs features built first. Plan for `ELM` as the baseline and KELM as
the contender that has to earn its extra step.

## The methodological trap — read this before writing any training code

The obvious training set is every file the deterministic pass labeled: free, already computed,
thousands of rows. **It is the wrong distribution.**

The ELM will be deployed on exactly the files the rules *failed* to classify
(`classify.ts:337-339`). Training on rule-classifiable files and inferring on rule-unclassifiable
files means the model learns to imitate rules that already work where it was trained, and adds
nothing where it is actually needed. That is covariate shift, and it will not show up in a naive
held-out split drawn from the training pool — it will look like a great result.

**Mitigation, and it reorders the work:** the real training target is rows with `source: "llm"` —
the leftovers the LLM was paid to label. That is the right distribution, and it caps ELM quality at
LLM quality, which is the honest ceiling for this design. Those rows only exist in accumulated
`.sourcevision/classifications.json` history, which **this checkout does not have**. So Step 1 is
corpus collection, not modelling.

## Files touched

| Path | Owning team | New/Edit | Note sent? |
|------|-------------|----------|------------|
| `packages/sourcevision/src/analyzers/elm-classify.ts` | Path B team | **New** | n/a |
| `packages/sourcevision/src/analyzers/classify.ts` | Path B team | Edit (small) | n/a |
| `packages/sourcevision/src/cli/commands/analyze-phases.ts` | Path B team | Edit (~6 lines at `:219`) | n/a — **binary to grep, see warning above** |
| `packages/sourcevision/src/schema/v1.ts` | Path B team | Edit — add `"elm"` to `source` union (`:606`) | n/a |
| `packages/sourcevision/src/schema/validate.ts` | Path B team | Edit — same, zod enum (`:139`) | n/a |
| `packages/sourcevision/tests/unit/analyzers/classify.test.ts` | Path B team | Edit | n/a |
| `scripts/elm-archetype-benchmark.mjs` | shared `scripts/` | **New** | announce in `IN-FLIGHT.md` |
| `package.json` | **SHARED** | Edit only if a dep is added | **required before `pnpm add`** |

`@astermind/astermind-community` is already a root dependency (`package.json:61`, `^3.0.0`), so no
dependency addition is expected. **If you find you need one, that is a second-lead sign-off, not a
`pnpm add`.**

## Steps

Order matters throughout — each step is a gate on the next.

**Step 0 — measure the prize before building anything.**
Run a real `ndx analyze` and read `classifications.summary.totalUnclassified`. **Nobody has ever
measured how many files actually reach the LLM.** The deterministic pass is thorough; if the answer
is 12 files, Path B is not worth doing and this IMPL should be closed with that finding. If it is
400, proceed. This step is cheap and it can cancel the project — do it first.

**Step 1 — build the corpus.** Harvest `source: "llm"` rows across repeated analyze runs and
across more than one repository. Commit the corpus as a data file with a documented provenance.
Use rule-labeled rows as a *sanity* set only, never as the headline training set (see the trap
above). `IO.importCSV` / `exportJSON` handle the file format.

**Step 2 — the benchmark script (this is the B1 go/no-go).**
`scripts/elm-archetype-benchmark.mjs`, modelled on `scripts/elm-hello-world.mjs`. Seeded, committed,
re-runnable by another team. Compare at minimum: `ELM` on raw paths; `KernelELM` (rbf, `exact`) on
TF-IDF vectors; `KernelELM` with `mode: 'nystrom'` if N gets large. Report via `Evaluation`'s
`ClassificationReport`.
**Report accuracy against the 5.9% random baseline (17 classes), with the seed, whichever way it
comes out.** Read the confusion matrix specifically for the adjacent pairs — `route-handler`/
`route-module`, `service`/`utility`, `model`/`schema`/`types`. That is where this will fail if it
fails, and per-class F1 will show it while overall accuracy hides it.

**Step 3 — stop here if the bar is not met.** Write the finding up as an ADR with the numbers. Per
`Command-Structure`, an ELM that scores badly is a finding, not a failure. Do not proceed to
integration to avoid an awkward conversation.

**Step 4 — integration, only past the bar.** New `elm-classify.ts` mirroring the enrich signature.
Insert at `analyze-phases.ts:219`, ahead of the LLM call. Add `"elm"` to both `source` unions.
Emit the ELM's real probability as `confidence` — note the LLM path hardcodes `confidence: 0.7`
(`classify.ts:464`), so ELM rows will carry *better* confidence data than LLM rows do.

**Step 5 — threshold and fallthrough.** Below the confidence threshold, leave the file
unclassified so the existing LLM gate at `:219` picks it up unchanged. The threshold is a tuned
number and belongs next to `PRIMARY_THRESHOLD` (`classify.ts:33`) with a comment explaining how it
was chosen.

## Improvements available while you are in here

Found during the survey, all verified. None are required for the swap; each is worth a ticket.

- **Two dead parameters.** `enrichClassificationsWithLLM` takes `inventory` (`classify.ts:330`) and
  `imports` (`:331`) and **references neither in its body** (verified: 0 occurrences after the
  signature). Do not delete them — they are exactly the features the ELM wants.
- **The `"import"` signal branch never fires.** `matchSignal` returns `null` for it with a comment
  saying it needs the full import graph (`classify.ts:242-245`). Import edges separate
  `gateway`/`service`/`route-handler` far better than paths do — this is the most promising
  feature available and it is currently unused by *both* the rules and the LLM prompt.
- **`secondaryArchetypes` already exists** (`classify.ts:189-195`) — ELM top-k maps onto it directly.
- **Free telemetry.** `computeSummary` already counts `bySource` (`classify.ts:308`), so adding
  `"elm"` to the union gives per-source counts with no extra instrumentation.
- **The partial-signal vector is a ready feature set.** The prompt builder already passes
  sub-threshold algorithmic scores to the LLM as `[partial signals: ...]`
  (`classify.ts:500-506`). That is a free 17-dimensional soft-score vector per file.
- **Perf, unrelated to ELM:** `new RegExp(signal.pattern)` is compiled inside `matchSignal`
  (`classify.ts:219`), so it recompiles per file × per signal. Hoist to a cache.

## Test strategy

- **Unit:** `packages/sourcevision/tests/unit/analyzers/classify.test.ts` already has a
  `describe("enrichClassificationsWithLLM")` block at `:394` with 8 call sites through `:531`.
  Mirror it for the ELM tier. It is the existing regression harness — the swap must not change
  behaviour for files the deterministic pass already classifies.
- **Integration:** a run of the classification phase proving that with the ELM tier enabled, the
  LLM is called for strictly fewer files, and that disabling it reproduces today's output exactly.
- **Not a fix, so no red-test requirement** — this IMPL adds a capability. If you *do* fix any of
  the § Improvements items, each needs a test that fails on the old code, watched going red.
- **Must stay green:** `pnpm typecheck`, `pnpm test`, `tests/e2e/domain-isolation.test.js`,
  `tests/e2e/architecture-policy.test.js`.
- **Accuracy claims:** seed and baseline, always, in a committed script another team can run.

## Rollback

Reverting the commit is **not sufficient.** The phase writes
`.sourcevision/classifications.json` (`analyze-phases.ts:229-230`), and rows written with
`source: "elm"` will remain on disk and will be read back as `previousClassifications` for
incremental runs (`analyze-phases.ts:196`, consumed at `classify.ts:99-110`).

To back out cleanly: revert the commit, then either delete `.sourcevision/classifications.json` or
re-run `ndx analyze --full` so the incremental path cannot resurrect ELM-sourced rows. Note that
reverting the `source` union while `"elm"` rows are still on disk will fail zod validation at
`schema/validate.ts:139` — revert the data before the schema, or ship a migration.

## Corrections

Two things I published earlier were wrong. Correcting them here and in the session log rather than
only in the newest document.

1. **"`node_modules` is empty — nothing installed."** True when I checked, **false now** — the
   dependencies are installed and `@astermind/astermind-community@3.0.0` is present. That is why
   this IMPL can cite the real API surface rather than npm keywords. The Phase 0 "run `pnpm
   install`" step from my earlier chat summary is therefore already done.
2. **"KELM cost scales N², fine here and bad later."** Incomplete — `KELMMode: 'nystrom'` with `m`
   landmarks exists specifically to avoid that, with a seed for reproducibility. The scaling
   objection should not be used as a reason to skip KELM.

## Open questions

- **Is the prize big enough?** Unmeasured. Step 0 answers it and can cancel this IMPL. No one
  should start Step 1 before Step 0 returns a number.
- **Corpus provenance.** Training on `source: "llm"` rows caps ELM quality at LLM quality and
  inherits its mistakes. Is that acceptable, or does someone hand-label a gold set? A three-lead
  question, because it sets what "accuracy" even means here.
- **Model lifecycle.** Serialization exists (`saveModelAsJSONFile`, `KernelELMJSON`). The policy
  does not: does a trained model ship in the npm package, get built at install, or retrain
  in-process per run? `OnlineELM.update()` makes per-run incremental training plausible and would
  make the whole question moot — worth testing early.
- **Where does the threshold live?** `.n-dx.json` (user-tunable) or a constant next to
  `PRIMARY_THRESHOLD`? `.n-dx.json` is a shared file.
- **Token baseline.** Still `TN-J3`, still unclaimed. Without it Path B cannot report a saving even
  if the model is excellent.
