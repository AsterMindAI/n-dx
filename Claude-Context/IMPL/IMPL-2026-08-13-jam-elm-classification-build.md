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

**✅ DONE 2026-08-13** — commit `26a191e7`. Relaxed the anchor to `(?:^|[-.])`, covering
`gateway.ts`, `rex-gateway.ts` and `api.gateway.ts` while still rejecting `mygateway.ts`. Test
written first and watched fail on the old code (`AssertionError: expected null to be 'gateway'`).

Measured with `analyze --fast --full`:

| | before | after |
|---|---|---|
| classified | 424 | **428** |
| unclassified | 259 | **255** |
| `gateway` | 0 | **4** |
| classes present | 11 | **12** |

Gates green: `pnpm typecheck` across all 6 packages, 1192 sourcevision analyzer tests, 108
architecture-policy + domain-isolation e2e tests.

### ⚠️ Correction — "target the six empty classes first" was wrong

This IMPL previously said to fix rules for all six zero-example archetypes. **Only `gateway` was
fixable.** I tested each of the other five signal sets against the real unclassified paths, and all
five returned **zero** candidate hits:

| Archetype | Signals | Why it never fires here |
|---|---|---|
| `middleware` | `/middleware/`, `/middlewares/`, `*.middleware.ts` | n-dx has no such directory or filename |
| `model` | `/models/`, `*.model.ts`, `*.schema.ts` | Rails/Django-style convention, unused here |
| `service` | `/services/`, `/service/`, `*.service.ts`, `/clients/` | Angular/NestJS-style convention, unused here |
| `route-module` | export-based (`loader`/`action`/`meta`/…) | Remix convention, unused here |
| `test-helper` | `/fixtures/`, `/mocks/`, `__mocks__`, `test-utils.ts` | this repo uses none of these |

**Their signals are correct — the repo just isn't one of those ecosystems.** Adding rules for
conventions n-dx doesn't use would be overfitting to nothing. **The consequence for the ELM is
real: those five classes cannot be populated from this repository at any effort.** Their training
examples have to come from other codebases, which makes Step 2's "repeat across more than one
repository" a hard requirement rather than a nice-to-have.

### ⚠️ Gotcha with user impact — rule fixes are invisible without `--full`

The first re-measure after the fix returned **424/259, unchanged**. The fix was working; the
measurement was not. `analyze` reuses `previousClassifications` for unchanged files
(`classify.ts:99-110`), and the gateway files had not changed, so the cached `archetype: null` was
reused. Only `--full` bypasses the cache (`analyze-phases.ts:210`,
`previousClassifications: !ctx.fullMode ? previousClassifications : undefined`).

**Always re-measure with `--fast --full`.** More importantly, this generalises beyond our
measurements: **a user who upgrades n-dx and receives improved archetype rules will not see any
benefit until they run a full re-analysis.** Worth deciding whether shipping rule changes should
force a classification-phase invalidation — filed as an open question below.

**Each further fix needs a test that fails before it.** Write the assertion, watch it go red, then
fix the pattern. A green test nobody saw fail is indistinguishable from no test.

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

### ✅ UNBLOCKED + DONE 2026-08-20 — corpus built (324 rows), and it changed the picture

Nolan authorised using their Claude CLI. **Nothing was installed** — it was already on disk as the
VS Code extension's bundled binary (`.../anthropic.claude-code-2.1.237-darwin-arm64/resources/native-binary/claude`),
just not on `PATH`. Reached via `PATH` for the run, deliberately **not** written to `.n-dx.json`:
that file is committed and shared, and the path is machine- *and* extension-version-specific, so
persisting it would break Jarrett, Thomas, and Nolan on the next extension update.

**Corpus: `scripts/data/elm-archetype-corpus.json`** (commit `2e6a3e43`) — 324 LLM-labelled rows
from n-dx (255) + AsterMind-CE (69), seed 42, 241 train / 83 held-out.

**The premise is confirmed.** The LLM populates classes the rules cannot see:
`service` 0 → **123**, `middleware` 0 → 7, `test-helper` 0 → 1, `gateway` → 2. Choosing LLM labels
over rule labels was the right call.

**But two things got worse, and both matter more than the win.**

**1. The bar went UP.** The teacher's output is *more* concentrated than the rules':

| | n-dx rule labels | LLM labels (this corpus) |
|---|---|---|
| Majority-class baseline | 19.6% | **38.0%** |
| Top-2 share | 36% | **74%** (`service` 123 + `utility` 116) |
| Classes under 10 rows | 2 of 12 | **9 of 13** |

An ELM must now beat **38%**, not 19.6% — and with 9 classes too thin to learn, it is effectively
being asked to learn one binary distinction and guess the rest.

**2. That binary distinction is one the teacher draws inconsistently.** Spot-checking labels:

| Labelled `service` | Labelled `utility` |
|---|---|
| `viewer/polling/polling-manager.ts` | `viewer/messaging/request-dedup.ts` |
| `viewer/polling/tick-timer.ts` | `llm-client/budget-preflight.ts` |
| `viewer/polling/tick-visibility-gate.ts` | `hench/agent/lifecycle/commit-msg-watcher.ts` |
| `web/landing/landing.ts` | `hench/agent/analysis/change-magnitude.ts` |

A landing page is not a service, and the polling internals are not obviously services while
`request-dedup` is a utility. The LLM appears to be using `service` as a catch-all for
"module with behaviour". **74% of the corpus rests on that boundary.** This is the "ELM inherits
the teacher's mistakes" risk the ADR named — now observed, not predicted.

**Consequence for the kill criterion:** the ADR's bar was "≥30% of the residue at or above the
LLM's own accuracy". Two things now need saying out loud before Step 3 runs: the ELM cannot exceed
a teacher this noisy, and "at or above LLM accuracy" is measured against labels we have reason to
distrust. **Recommend the leads decide whether a hand-labelled gold set is required before Step 3
is meaningful** — otherwise Step 3 measures agreement with a fuzzy teacher, not correctness.

### Operational notes from the run

- **`--fast` gates *both* enrichment paths.** Dropping it to get classification labels also enables
  phase-4 zone enrichment, which is the expensive Tier C *generation* path and is useless for the
  corpus. Both runs were **stopped immediately after phase 3 wrote `classifications.json`**, which
  is all the corpus needs. Anyone repeating this should do the same, or add a flag that enriches
  classification only.
- **Each CLI spawn carries fixed overhead.** A trivial `claude -p` call reported ~7.3k
  cache-creation tokens and $0.08. So an avoided classify batch saves considerably more than its
  prompt size suggests — which *helps* the ELM's case, and is a useful input for `TN-J3`.
- **Do not stage corpus repos in the session scratchpad.** The first AsterMind clone under
  `/private/tmp/...` was reaped mid-session: every file deleted, directory tree and an empty `.git`
  husk left behind, causing a silent `0 files cataloged` run. Clones now live in
  `~/n-dx-elm-corpus/`. Cost nothing (0 files → 0 batches) but it looks exactly like a real
  regression, so it is recorded here.

### 🔴 Previously BLOCKED 2026-08-13 — no LLM was reachable (resolved above)

Verified by executing a completion, not by inspecting config:

```
ClaudeClientError | reason = not-found
'claude' not found on PATH. Install 'claude' or set
  `n-dx config llm.claude.cli_path /path/to/claude`.
```

`.n-dx.json` sets `llm.vendor = "claude"`, model `claude-sonnet-4-6`, but there is no `claude` or
`codex` binary on `PATH` and no `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_API_KEY` in the
environment. `classifyBatchWithLLM` treats this as `"auth-error"` and aborts every batch
(`classify.ts:431-435`), so **zero `source: "llm"` rows can be produced here.**

**To unblock:** install the Claude CLI, or `ndx config llm.claude.cli_path <path>`, or export an
API key. Then re-run analyze **without** `--fast`.

### ✅ DONE anyway — the harness and the measurements that did not need an LLM

**`scripts/elm-corpus-build.mjs`** (commit `8617f9f1`) — reads
`.sourcevision/classifications.json` from any number of analyzed repos and emits a corpus with
provenance (repo, remote, commit, branch, dirty flag), a **seeded stratified** train/held-out
split, and a class-distribution report. It defaults to `--source=llm` and refuses to run when no
such rows exist, printing the fix. Verified: two runs produce byte-identical splits; every class
appears in both splits; train and held-out are disjoint.

It computes and prints the **majority-class baseline per corpus** — 23.0% for the combined set vs
19.6% for n-dx alone. The baseline moves with the corpus, so it must be recomputed, never quoted
from a previous document.

**Second repo measured** — `AsterMindAI/AsterMind-Community-Edition` (cloned read-only into the
session scratchpad, analyzed with `--fast --full`):

| Repo | Source files | Classified | Unclassified | LLM batches |
|---|---|---|---|---|
| n-dx | 683 | 428 (62.7%) | **255 (37.3%)** | 9 |
| AsterMind-CE | 114 | 45 (39.5%) | **69 (60.5%)** | 3 |

**This substantially strengthens the case for the ELM.** The generality caveat was right, and it
cuts in our favour: n-dx is the *favourable* case at 37.3% unclassified, while a second real
codebase sits at 60.5%. The prize on users' repos is plausibly larger than on ours.

### ⚠️ Finding that changes the corpus strategy: repo *count* is not the lever, repo *diversity* is

Adding AsterMind-CE added **473 rows but no new classes**. It contributed only `utility`,
`entrypoint`, `types`, `config`, `store`, `component` — all classes n-dx already had in quantity.
The same five archetypes remain at zero across **both** repos:

**Still zero after two repos:** `middleware`, `model`, `route-module`, `service`, `test-helper`.

Both repos are the same *kind* of codebase — a TypeScript library/tool. Two similar repos are
worth about one for label coverage. **Step 2 needs repos from different ecosystems, chosen
deliberately against the missing labels:**

| Missing class | Repo type that would populate it |
|---|---|
| `service` | NestJS or Angular app (`/services/`, `*.service.ts`) |
| `middleware` | Express/Koa server (`/middleware/`, `*.middleware.ts`) |
| `model` | An ORM-backed API (`/models/`, `*.model.ts`) |
| `route-module` | A Remix app (exports `loader`/`action`/`meta`) |
| `test-helper` | Any repo using `__mocks__/`, `/fixtures/`, `test-utils.ts` |

The combined sanity corpus is also **badly skewed** — top 3 classes are 244 of 473 (52%), while
`gateway` has 4 rows and `config` has 2. The builder flags both as thin. Those two cannot be
learned from this corpus at any hyperparameter setting.

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
- **Should shipping rule changes invalidate the classification cache?** Discovered during Step 1:
  users who upgrade and get better archetype rules see no benefit until they run `--full`
  (`analyze-phases.ts:210`). Options are a schema/ruleset version stamp in `classifications.json`
  that forces re-classification when it changes, release notes telling users to run `--full`, or
  accepting the staleness. Affects every future `archetypes.ts` change, not just this project.


---

## Step 3 — PRE-REGISTERED feasibility bar (written 2026-08-27, BEFORE any model was run)

Recorded before seeing a single number, per the discipline that worked for `TN-J4`. Butter's
argument in `NOTE-…-paths-a-c-split-and-findings-doc.md` § 4 is accepted: **infeasibility can be
established without a gold set**, because a model that cannot reproduce the teacher does not become
useful if the teacher is later corrected.

**Primary metric: agreement-with-teacher** on the 83 held-out rows. It is *never* to be called
accuracy — the teacher is known inconsistent on the `service`/`utility` boundary (`TN-J10`).

**Baselines, recomputed from the corpus actually used (never quoted from a document):**
- Held-out majority-class (`service`, 31/83) = **37.3%**
- Whole-corpus majority = 38.0%

**Thresholds, fixed in advance:**

| Held-out agreement | Verdict |
|---|---|
| **≥ 55%** | The mapping is learnable. Path B proceeds and **`TN-J10` now binds** — "is the teacher right?" becomes the live question. |
| **45 – 55%** | Inconclusive. Do not spin; report as inconclusive and take it to the leads with the confusion matrix. |
| **< 45%** | **Path B is not viable.** Publish the negative. `TN-J10` becomes moot — no gold set can rescue a mapping the model cannot learn. |

**Secondary, reported regardless of verdict:**
- `service` ↔ `utility` confusion — those two are **74%** of the corpus and are exactly where the
  teacher is shakiest. This is the number the leads need to decide `TN-J10`, and it replaces my
  qualitative read of four filenames with a measurement.
- Per-class F1 — **with the caveat stated in advance, not afterwards: 9 of 13 classes have under 10
  training rows** (`store` 2, `gateway` 1, `hook` 1, `schema` 1, `test-helper` 1). Per-class F1 on
  those is close to meaningless and will not be argued from.

**Method constraints:** seed 42; the 83 held-out rows are not touched during training or tuning; the
feature is the path string only (established in Step 0 — all unclassified files have zero signal
evidence, so the path is the only thing available); confidence is captured per prediction so the
gate that bounds Path B's downside can be evaluated separately from raw agreement.

**If I tune anything after seeing the held-out number, the run is contaminated and must be
re-declared as such.**
