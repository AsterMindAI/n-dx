# IMPL — Building the ELM archetype classification tier

- **Implements:** [`ADR-2026-08-13-jam-proceed-with-elm-classification.md`](../ADR/ADR-2026-08-13-jam-proceed-with-elm-classification.md)
- **Supersedes:** [`IMPL-2026-08-11-jam-elm-classification-path-b.md`](IMPL-2026-08-11-jam-elm-classification-path-b.md) — its Step 0 is complete and its findings are carried forward here. Treat this file as the live plan.
- **Owner:** Nolan (Team Nolan)
- **Backlog item:** `TN-J4`
- **Branch:** `Nolan-Work` (shared checkout — see § Concurrency)
- **Status:** Not started

> Facts below are verified at `file:line` against commit `e448724f`. Where a number is measured,
> its command is given so anyone can re-run it.

## Scope

**In scope:** an ELM tier between the deterministic classifier and the LLM enrichment call, gated
by confidence with fallthrough to the LLM; the training corpus that feeds it; and the
`archetypes.ts` rule fixes that shrink the problem and populate empty classes.

**Out of scope:** Path C (rex granularity), vendor registration in `llm-client`, replacing the
deterministic pass, and the 20 generation call sites.

## Concurrency — read before you run anything

This is a **shared checkout** with no worktree, and **Fluff is working the same branch**
(`Nolan-Work`). `.sourcevision/` has no file locking and concurrent writers lose data silently.

- **Claim `IN-FLIGHT.md` before every state-writing run** — `ndx analyze`, `sourcevision analyze`,
  `ndx ci`, `ndx refresh`. Release after. Step 0 followed this; so does everything here.
- **Never `git add -A`.** Stage explicit paths — Fluff's uncommitted work lives in this tree.
- `--fast` runs are still state-writing (they rewrite `.sourcevision/*.json`); they are merely
  token-free.

## ⚠️ `analyze-phases.ts` is invisible to grep

Two raw NUL bytes at offsets 16345 and 16374, deliberate delimiters in a template literal,
committed on `origin/main`. **Decision: leave them alone** (Nolan, 2026-08-11). `file` reports the
file as `data`, so `grep` exits 1 and prints **nothing** — not an error, silence. Use `python3`,
`grep -a`, or `rg --text`. Assume every repo-wide grep you run has a hole in exactly the file that
wires this feature in.

## The insertion point

```
analyzeClassifications()          classify.ts:60    deterministic, free, handles 62%
        ↓  archetype === null && source === "algorithmic"        classify.ts:337-339
   ◆ NEW: ELM tier ◆              elm-classify.ts   confidence-gated
        ↓  below threshold → unchanged
enrichClassificationsWithLLM()    classify.ts:328   the recurring cost
        ↓
mergeClassificationResults()      classify.ts:559
```

Wiring in `analyze-phases.ts`: phase at `:183`, deterministic call at `:209`, LLM gate at `:219`
(`!ctx.fastMode && totalUnclassified > 0`), enrich at `:221`, merge at `:223`.

The new tier takes the **same signature** as the LLM one, so this is an insertion:

```ts
(classifications: Classifications, inventory: Inventory, imports: Imports)
  => Promise<{ updatedFiles: FileClassification[]; tokenUsage: AnalyzeTokenUsage }>
```

## Files touched

| Path | Owning team | New/Edit | Note sent? |
|------|-------------|----------|------------|
| `packages/sourcevision/src/analyzers/elm-classify.ts` | Nolan (Path B) | **New** | n/a |
| `packages/sourcevision/src/analyzers/archetypes.ts` | Nolan (Path B) | Edit — signal fixes | n/a |
| `packages/sourcevision/src/analyzers/classify.ts` | Nolan (Path B) | Edit — small | n/a |
| `packages/sourcevision/src/cli/commands/analyze-phases.ts` | Nolan (Path B) | Edit ~6 lines at `:219` | **grep-invisible, see above** |
| `packages/sourcevision/src/schema/v1.ts` | Nolan (Path B) | Edit — `source` union `:606` | n/a |
| `packages/sourcevision/src/schema/validate.ts` | Nolan (Path B) | Edit — zod enum `:139` | n/a |
| `packages/sourcevision/tests/unit/analyzers/classify.test.ts` | Nolan (Path B) | Edit | n/a |
| `packages/sourcevision/tests/unit/analyzers/elm-classify.test.ts` | Nolan (Path B) | **New** | n/a |
| `scripts/elm-archetype-benchmark.mjs` | shared `scripts/` | **New** | announce in `IN-FLIGHT.md` |
| `.n-dx.json` | **SHARED** | Edit only if the threshold is user-configurable | **claim first** |

`@astermind/astermind-community@3.0.0` is already a root dependency (`package.json:61`) and is
installed. **No `pnpm add` is expected — if you need one, that is a second-lead sign-off.**

## Steps

### Step 1 — Rule fixes (do this first; it is free and it improves everything downstream)

Each fix permanently removes files from the LLM's input *and* populates an empty class in the
training corpus.

**Confirmed defect — the gateway signal is over-anchored.** In `archetypes.ts` the `gateway`
archetype's only signal is:

```ts
{ kind: "filename", pattern: "^(?:deps|gateway|barrel)\\.[tj]sx?$", weight: 0.7 }
```

`^` forces the filename to *start* with `gateway`, so `gateway.ts` matches and `rex-gateway.ts`
does not. Verified by executing the regex against all four files in the repo — all four fail.
Weight 0.7 already exceeds `PRIMARY_THRESHOLD` (0.4, `classify.ts:33`), so relaxing the anchor to
allow a `-` prefix classifies all four immediately.

Then work the rest of the ~30 name-evident files (route handlers under `routes-*/`, `*-adapter.ts`,
and the other cases listed by the Step 0 residue analysis). **Target the six empty classes first**
— `gateway`, `middleware`, `model`, `route-module`, `service`, `test-helper` — because those are
the classes the ELM currently cannot learn at all.

**Each fix needs a test that fails before it.** Write the assertion, watch it go red, then fix the
pattern. A green test nobody saw fail is indistinguishable from no test.

**Re-measure after:** `sourcevision analyze . --fast`, then read
`.sourcevision/classifications.json`. The new `totalUnclassified` is the honest ELM target and
replaces the 259 figure everywhere.

### Step 2 — Corpus acquisition (this one costs tokens, deliberately)

The ELM must train on `source: "llm"` rows, not rule output — rule output has six empty classes and
is the wrong distribution (ADR § Decision, commitment 1).

- **Claim `IN-FLIGHT.md`**, then run `sourcevision analyze .` **without** `--fast` so enrichment
  runs and writes `source: "llm"` rows into `classifications.json`.
- Repeat across **more than one repository**. n-dx alone yields ~259 labelled rows across a skewed
  distribution; that is thin for 17 classes. Other repos also exercise archetypes n-dx barely has.
- **Commit the corpus as a data file with provenance** — which repo, which commit, which model,
  which date. A corpus whose origin is unknown cannot be reasoned about later.
- `IO.importCSV` / `IO.exportJSON` from the library handle the format.

**Budget note:** this is the one deliberate token spend in the plan. It is bounded and one-off, and
its purpose is to end the recurring spend.

### Step 3 — Benchmark and tune (the kill-criterion gate)

`scripts/elm-archetype-benchmark.mjs`, modelled on `scripts/elm-hello-world.mjs` — seeded,
committed, re-runnable by another team.

Compare at minimum:
- `ELM` on raw path strings (text-native: `charSet`, `useTokenizer`, `predict(text, topK)`)
- `KernelELM` with an `rbf` kernel over TF-IDF vectors (numeric only — needs `TFIDFVectorizer` or
  `UniversalEncoder` in front; it has no tokenizer)
- `KernelELM` with `mode: 'nystrom'` if N grows

**Use the library's `Evaluation` module — do not hand-roll accuracy.** It returns a
`ClassificationReport` with `confusionMatrix`, per-class precision/recall/F1/support, macro/micro/
weighted averages, `logLoss` and `topKAccuracy`.

**Report against the 19.6% majority-class baseline**, with the seed, whichever way it comes out.
Not 5.9% — that uniform-random figure was wrong and is corrected in the prior ADR and SYNC-001.
Recompute the majority rate against whatever corpus you actually train on.

Read the confusion matrix for the adjacent pairs specifically — `route-handler`/`route-module`,
`service`/`utility`, `model`/`schema`/`types`. Overall accuracy hides these; per-class F1 shows them.

**Gate:** per the ADR, if the tuned model cannot label **≥30% of the residue at or above the LLM's
own accuracy on the same files**, stop and publish the negative result. Do not proceed to
integration to avoid an awkward conversation.

### Step 4 — Integration (only past the gate)

- New `elm-classify.ts` mirroring the enrich signature.
- Insert at `analyze-phases.ts:219`, ahead of the LLM call.
- Add `"elm"` to both `source` unions (`v1.ts:606`, `validate.ts:139`). This is additive and gives
  free telemetry — `computeSummary` already counts `bySource` (`classify.ts:308`).
- **Emit the ELM's real probability as `confidence`.** Note the LLM path hardcodes
  `confidence: 0.7` (`classify.ts:464`), so ELM rows will carry better confidence data than LLM
  rows do.
- Below threshold, leave `archetype: null` so the existing gate at `:219` picks the file up
  unchanged. The threshold lives next to `PRIMARY_THRESHOLD` (`classify.ts:33`) with a comment
  recording how it was tuned. `.n-dx.json` currently has no `sourcevision.archetypes` section
  (only `zones`), so making it user-configurable means adding one — and `.n-dx.json` is a shared
  file needing a claim.

### Step 5 — Model lifecycle

Serialization exists: `ELM.saveModelAsJSONFile()` / `loadModelFromJSON()`, and `KernelELMJSON`.
The policy does not. **Test per-run in-process training first** — the hello-world trains 30 samples
in milliseconds, and `OnlineELM.update()` offers RLS incremental training that maps onto
sourcevision's existing incremental mode (`changedFiles`, `previousClassifications`,
`classify.ts:99-110`). If in-process training is fast enough at corpus scale, the entire
ship-vs-build-vs-retrain question disappears. Only if it is too slow do we need a shipped artifact.

## Improvements available while you are in here

Verified during the survey; none are required, each is worth a ticket.

- **Two dead parameters.** `enrichClassificationsWithLLM` accepts `inventory` (`classify.ts:330`)
  and `imports` (`:331`) and references **neither** in its body (verified: 0 occurrences after the
  signature). Do not delete them — the import graph is the most promising unused feature available.
- **The `"import"` signal branch never fires** (`classify.ts:242-245`) — returns `null` with a
  comment saying it needs the full import graph. Import edges separate `gateway`/`service`/
  `route-handler` far better than paths do, and **neither the rules nor the LLM prompt use them
  today**.
- **`secondaryArchetypes` already exists** (`classify.ts:189-195`) — ELM top-k maps onto it.
- **Perf:** `new RegExp(signal.pattern)` is constructed inside `matchSignal` (`classify.ts:219`),
  recompiling per file × per signal. Hoist to a cache.

## Test strategy

- **Unit:** new `elm-classify.test.ts`. Mirror the existing
  `describe("enrichClassificationsWithLLM")` block (`classify.test.ts:394`, 8 call sites through
  `:531`) — it is the regression harness, and behaviour for already-classified files must not change.
- **Rule fixes (Step 1) are fixes**, so each needs a test that **fails on the old code, watched
  going red**, then passes. The gateway case is the model: assert `rex-gateway.ts` classifies as
  `gateway`, watch it fail, relax the anchor, watch it pass.
- **Integration:** with the ELM tier enabled, the LLM must be called for strictly fewer files; with
  it disabled, output must match today's exactly.
- **Must stay green:** `pnpm typecheck`, `pnpm test`, `tests/e2e/domain-isolation.test.js`,
  `tests/e2e/architecture-policy.test.js`.
- **Any accuracy claim** carries its seed and baseline, in a committed script another team can run.

## Rollback

**Reverting the commit is not sufficient.** The phase writes `.sourcevision/classifications.json`
(`analyze-phases.ts:229-230`), and rows written with `source: "elm"` persist on disk and are read
back as `previousClassifications` for incremental runs (`analyze-phases.ts:196`, consumed at
`classify.ts:99-110`).

To back out cleanly:
1. Revert the commit.
2. Delete `.sourcevision/classifications.json`, **or** run `sourcevision analyze . --full` so the
   incremental path cannot resurrect ELM-sourced rows.
3. Order matters: reverting the `source` union while `"elm"` rows remain on disk fails zod
   validation at `validate.ts:139`. Revert the data before the schema, or ship a migration.

Rule fixes (Step 1) roll back independently and safely — they are pure signal changes.

## Open questions

- **Corpus provenance and its ceiling.** Training on LLM labels caps ELM accuracy at the LLM's and
  inherits its mistakes. Acceptable, or does someone hand-label a gold set to measure *both*
  against? This sets what "accuracy" means here — a three-lead question.
- **How many repos is enough?** n-dx alone is thin and skewed for 17 classes. Nobody has decided
  what corpus breadth is sufficient.
- **Generality.** Step 0 measured one TypeScript-heavy repo at 37.9% unclassified. A large React or
  Go codebase may differ substantially, and n-dx ships to users' repos. Worth measuring a second
  repo early, before tuning to n-dx's idiosyncrasies.
- **Threshold location.** Constant next to `PRIMARY_THRESHOLD`, or user-configurable in
  `.n-dx.json` (shared file, needs a claim)?
- **Token baseline is still missing.** `TN-J3` remains unclaimed and unfixed: all
  `.hench/runs/*.json` record `{"input":0,"output":0}`. Without it this project can demonstrate
  *fewer calls* but cannot report *tokens saved*.
