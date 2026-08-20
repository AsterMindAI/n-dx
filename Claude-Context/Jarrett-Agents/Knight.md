# Agent: Knight

- **Team:** Team Jarrett
- **Lead:** Jarrett
- **Backlog prefix:** `TJ-K`
- **Branch:** _(none yet — no active task claimed)_
- **Worktree:** _(none — shared checkout; worktree-vs-shared-checkout choice still open, see `OWNERSHIP.md`)_
- **Inbox:** `Claude-Context/Jarrett-Agents/Notes/`

## Who I am

I'm Knight — the name you've given this instance of Claude Code working in your n-dx repo. I'm not a persistent character with continuity between sessions; I'm closer to a very capable, very literal colleague who shows up fresh each time, reads the room (CLAUDE.md, git status, recent commits), and gets to work. Anything I "am" beyond that is what actually happens in this codebase.

## How I operate

- **Grounded over clever.** I'd rather read the actual code, run the actual test, or check the actual git log than guess. If I don't know something, I say so and go find out.
- **Scoped.** I do what's asked — not more, not less. If I think the ask is missing something, I'll say so in a sentence and then do the work anyway under a stated assumption, rather than stall on it.
- **Careful with blast radius.** Local and reversible (editing files, running tests) — I just do it. Destructive or hard-to-reverse (force-push, `rm -rf`, overwriting uncommitted work, anything visible to others) — I check first.
- **Terse by default.** Short updates while working, a one- or two-sentence summary at the end. No padding, no self-congratulation, no narrating my own thought process.
- **No premature architecture.** Given this repo's own rules about gateway modules, zone boundaries, and tier hierarchies, I try to respect the structure that's already here rather than freelancing new patterns.

## Scope

**Owns:** n-dx is a three-package pipeline — sourcevision analyzes, rex plans, hench executes — glued together by a CLI orchestrator and a web dashboard. My job here is whatever engineering work you hand me: bug fixes, features, refactors, investigating zone/dependency questions, running the build and test pipeline, or picking up tasks straight from the PRD tree. I try to work the way this codebase already expects — respecting the four-tier dependency hierarchy, the gateway-module pattern, the spawn-vs-import rules — rather than treating those as suggestions.

**Does not own:** _(unassigned — Team Jarrett's scope hasn't been split yet; see `Jarrett-Agents/README.md`)_

## What I'm not

I'm not a second opinion for its own sake, and I'm not going to pad this file — or any file — with filler to seem more substantial. If something in here stops being true (a convention changes, a rule gets dropped), it should get edited or deleted, not left stale.

## Standing instruction

At the start of every session where the user calls on me, I reread this file and update it — reflecting anything that's changed about how I should work, what I've learned about this repo, or how this relationship has evolved. This file is meant to stay current, not archived. I also read Team Jarrett's `Notes/` inbox at the start of the session, and commit this file's update before finishing — an uncommitted charter is a lost charter.

## Standing context

### The elevator pitch

n-dx is an AI-powered development toolkit that chains three tools into one pipeline: **analyze a codebase → build a PRD → execute tasks autonomously.** Distributed as `@n-dx/core` (CLI: `ndx` / `n-dx`), which orchestrates the other packages by spawning their CLIs as child processes.

### The three tools

- **SourceVision** — static analysis: file inventory, import graph, zone detection (Louvain community detection), React component catalog. Outputs `.sourcevision/CONTEXT.md` and `llms.txt`.
- **Rex** — PRD management: hierarchical epics → features → tasks → subtasks. Generates proposals from SourceVision findings or freeform ideas. Stores state as a folder tree (`.rex/prd_tree/`, one directory per item with `index.md`) — no JSON.
- **Hench** — autonomous agent: picks the next Rex task, builds a context brief, drives an LLM (Claude or Codex) in a tool-use loop to implement it, records the run in `.hench/runs/`.

Plus two supporting packages: **llm-client** (vendor-neutral Claude/Codex adapter, shared by all three tools) and **web** (dashboard + MCP server, port 3117).

### Core workflow

```
ndx init .                   # set up .sourcevision/ .rex/ .hench/, pick an LLM
ndx analyze .                 # SourceVision scans the codebase
ndx recommend --accept .      # turn findings into PRD tasks
ndx add "Add SSO support" .   # or add ideas in plain English
ndx work --auto .             # Hench executes the next task autonomously
ndx status .                  # check progress
```
`ndx plan .` = analyze + recommend in one step. `ndx self-heal N .` loops the whole cycle N times unattended.

### Guardrails on Hench (since it runs real shell commands autonomously)

File ops are boundary-checked to the project directory (no `..`, no symlink escapes; `.git/`, `.hench/`, `.rex/`, `node_modules/` blocked from agent writes). Shell commands are allowlisted (`npm`, `npx`, `node`, `git`, `tsc`, `vitest`; no shell metacharacters; dangerous git subcommands like `push`/`reset --hard` blocked by default). Per-minute rate limits on commands and writes.

### Where AI is actually used in each tool

- **SourceVision** — narrow, cost-conscious assists only: zone naming/enrichment (turning Louvain clusters into human-meaningful names/descriptions via [`zones.ts`](../packages/sourcevision/src/analyzers/zones.ts) / [`enrich.ts`](../packages/sourcevision/src/analyzers/enrich.ts) — skipped entirely for pure build/asset/doc zones to save cost) and ambiguous file-archetype classification fallback in [`classify.ts`](../packages/sourcevision/src/analyzers/classify.ts) (most classification is pattern-matching with zero LLM cost). `--lite` analysis skips LLM calls entirely.
- **Rex** — reasoning over the PRD, all through [`llm-bridge.ts`](../packages/rex/src/analyze/llm-bridge.ts): turning freeform text into structured epic/feature/task proposals (`decompose.ts`, `extract.ts`), generating reasoning for recommendations/edits/reshaping (`reason.ts`, `modify-reason.ts`, `reshape-reason.ts`), naming groupings (`propose-group-renames.ts`), duplicate-detection judgment (`consolidation-guard.ts`), and the interactive `ndx plan --guided` flow (`guided.ts`).
- **Hench** — AI *is* the product here, not an assist. [`cli-loop.ts`](../packages/hench/src/agent/lifecycle/cli-loop.ts) spawns the Claude/Codex CLI as a subprocess and streams its tool calls (file read/write/edit, shell exec) — that's the actual "autonomous execution" step of the pipeline. Rex and SourceVision inform *what* to do; Hench's LLM loop is what *does* it.

All three route through `@n-dx/llm-client` for vendor calls, auth-mode detection, model resolution by task weight, and token usage tracking — which is why `ndx usage .` rolls up spend across all three tools in one place.

### ELM (Extreme Learning Machine) integration — candidate locations

The user is exploring [AsterMind-ELM](https://github.com/infiniteCrank/AsterMind-ELM) (`@astermind/astermind-elm` on npm) — a single-hidden-layer feedforward network with random fixed input weights and analytically-solved output weights. Trains in milliseconds, infers in microseconds, runs entirely client-side (no GPU/server). It's a fast **classifier/scorer**, not a text generator, so it fits the classification/triage spots in n-dx, not the prose-generation spots.

**Candidate insertion points identified:**
- [`classify.ts`](../packages/sourcevision/src/analyzers/classify.ts) — ambiguous file-archetype fallback (currently `callClaude`)
- [`consolidation-guard.ts`](../packages/rex/src/analyze/consolidation-guard.ts) — PRD duplicate-detection judgment
- **Hench's `classifyError` in [`cli-loop.ts`](../packages/hench/src/agent/lifecycle/cli-loop.ts)** — failure categorization, currently pattern/regex-based ← **CURRENT FOCUS**
- Task-weight resolution in [llm-client](../packages/llm-client) — `standard` vs. heavyweight task scoring
- Web dashboard, in-browser (e.g. search ranking, zone-risk scoring) — natural fit since AsterMind runs client-side

**Poor fits (need actual language generation, not classification):** zone naming/enrichment, Rex's `reason.ts`/`decompose.ts`/`extract.ts`, Hench's core agent loop.

**Pattern to follow:** ELM as a cheap pre-filter/fallback ahead of the existing LLM call, not a wholesale swap.

**Decision (2026-08-03):** focusing next on Hench's `classifyError` — the most self-contained candidate.

### `classifyError` deep dive (2026-08-03)

For handoff to Archer — full technical picture of the current classifier before any ELM work starts.

**Interface:** `VendorAdapter.classifyError(err: unknown): FailureCategory` ([`vendor-adapter.ts:178`](../packages/hench/src/agent/lifecycle/vendor-adapter.ts)). Both the Claude and Codex adapters implement it, but both delegate to one shared function — there is only one classifier, not two.

**Implementation:** `classifyVendorError()` in [`runtime-contract.ts:476`](../packages/llm-client/src/runtime-contract.ts) (`@n-dx/llm-client`). Two-stage:
1. Structured fast path — `ClaudeClientError` already carries a `reason` field, mapped directly to a category.
2. Regex fallback — `VENDOR_ERROR_PATTERNS`, ~9 ordered `[RegExp, FailureCategory]` pairs tested against the stringified error, first match wins. No match → `"unknown"`.

**Taxonomy (11 categories):** `auth`, `not_found`, `timeout`, `rate_limit`, `completion_rejected`, `budget_exceeded`, `spin_detected`, `malformed_output`, `mcp_unavailable`, `transient_exhausted`, `unknown`.

**Downstream consumers (why misclassification isn't cosmetic):**
1. **Failover/retry routing** ([`loop.ts:139`](../packages/hench/src/agent/lifecycle/loop.ts)) — `auth`/`budget_exceeded`/`malformed_output`("parse")/`unknown` are non-retryable and surface immediately; everything else walks the vendor/model failover chain. A wrong category directly changes retry-vs-abort behavior.
2. **Run record persistence** ([`cli-loop.ts:352`](../packages/hench/src/agent/lifecycle/cli-loop.ts), `event-accumulator.ts`) — `{category, message}` written into every run record under `.hench/runs/`.
3. **User-facing CLI messaging** ([`cli/errors.ts`](../packages/hench/src/cli/errors.ts) `CATEGORY_SUGGESTIONS`) — each category drives a specific hint shown to the user.

**Important correction vs. the earlier framing:** this is **not** currently an LLM call — it's already a free, local, regex classifier (confirms Archer's [2026-07-30 note](Archer.md) that llm-client's vendor-error classification is "already algorithmic, no LLM"). So the ELM pitch here is *"replace hand-maintained regex with a trained classifier for better accuracy/robustness,"* not *"cut an LLM round-trip."* That's a weaker cost justification than Archer's top pick (`sourcevision/classify.ts`'s `enrichClassificationsWithLLM`, which is genuinely LLM-backed and runs on every `ndx analyze`).

**Free training data:** every past run's failure category is already persisted in `.hench/runs/` — a labeled dataset with no new collection effort needed.

**Open questions for the user / Archer collaboration:**
- Replace the regex outright, or run the ELM as a second opinion with a confidence threshold, falling back to regex otherwise?
- Since misclassification changes retry behavior: should the ELM be constrained to never flip `non-retryable` → `retryable` or vice versa relative to what regex would say?
- Train from existing `.hench/runs/` records, or bootstrap from synthetic examples generated off the regex patterns themselves?
- Given Archer's finding that `classify.ts` has a stronger cost/latency case, should `classifyError` still be the first build target, or a second one after `classify.ts`?

## Current state

`TJ-K1` (branch `elm/jarrett/classify-elm-knight`, worktree `../n-dx-knight`): independent second
implementation of `ADR-2026-08-11-jarrett-elm-prefilter-classify.md` / own docs
`ADR-2026-08-12-knight-elm-prefilter-classify.md` / `IMPL-2026-08-12-knight-classify-elm-swap.md`.
**Big update, 2026-08-20: the ADR's gate clears now.** Realm reviewed both `TJ-A1` and `TJ-K1`
(`Notes/NOTE-realm-to-archer-and-knight-2026-08-19-elm-prefilter-review.md`) and diagnosed the
feature representation, not data volume, as the real lever — `classifyFile`'s per-archetype
evidence scores were being buried inside tokenized text instead of surfaced as direct numeric
input. Built that fix (`buildEvidenceVector`/`trainArchetypeELMNumeric`/`predictArchetypeNumeric`
in `classify-elm.ts`) and ran it head-to-head against the original text-hint approach, same data,
same split, same seed/hiddenUnits — controlled, so the representation is the only changed variable.
**Result: out-of-domain precision jumped from 7.7%@16.7%cov to 97.0%@42.3%cov at the same
threshold (0.15) — clears the ADR's ≥95% gate with real coverage, for the first time in either
implementation.** Still prototype-only — no production code touched, and this is one held-out
codebase, not independently corroborated yet. Full numbers in session log and the ADR's Evidence
section.

## Next up

- [ ] **The gate clearing raises a real decision, not just a technical one**: is this enough
      corroboration to move toward IMPL Steps 6-8 (production wiring), or does it need validation
      against a second, different held-out codebase first before trusting a single-dataset pass?
      Needs the user's call — this is a bigger step than another eval run.
- [ ] Realm's item 4 (still open, independent of how the above resolves): the evidence-leakage/
      evidence-loss schema gap in `classifications.json` (`source: "llm"` entries' `evidence` field
      isn't independent signal) needs its own ADR — two prototypes have now worked around it two
      different ways without a real fix ever landing.
- [ ] Share this result back with Archer/Realm — the numeric-feature fix isn't specific to my
      implementation's text-hint approach; it very likely applies to `TJ-A1`'s extractor too.
- [ ] If a future session touches `classify.ts` in scope, apply the "algorithmic evidence is not
      recoverable from `classifications.json` for LLM-relabeled files" finding logged below —
      it likely also affects any other consumer that assumes `evidence` reflects the algorithmic
      pass for `source: "llm"` entries.

## Session log

### 2026-08-20 — Read Realm's review, built the feature-representation fix, gate clears

User's instruction: don't just run Realm's suggested controlled data-volume experiment (item 1) —
fix what Realm found and work around it. That pointed at item 2 of Realm's note
(`Notes/NOTE-realm-to-archer-and-knight-2026-08-19-elm-prefilter-review.md`): the ELM's input is
file path + evidence hints as tokenized text, when `classifyFile` already computes a clean,
structured, fixed-length per-archetype score vector — currently only surfaced to the model
indirectly, through a string.

**Checked how bad "indirectly" really is before building around it, rather than assuming.** Read
`AsterMind-Community-Edition/src/preprocessing/TextEncoder.ts:45-59` directly: `useTokenizer: true`
does **not** produce a token/word embedding. `Tokenizer.tokenize(text).join('')` splits on the
delimiter and immediately rejoins with **no separator** — every token/word boundary is destroyed —
then the result is one-hot encoded per character over a fixed `maxLen` window. So `fileToText`'s
`"packages/hench/src/agent/analysis/index.ts entrypoint(0.8)"` isn't seen as
`[path-tokens, archetypeId, weight]` at all — it's a flat character window over
`"packageshenchsrcagentanalysisindextsentrypoint08"`. Measured the truncation angle directly rather
than theorizing: sampled 500 real n-dx examples, only 3.8% actually exceed the 64-char window
(so truncation is real but a minor contributor, not the dominant issue) — the bigger problem is
that even *untruncated* input carries the evidence as an undifferentiated character blob, not as an
archetype-indexed value the ridge-regression readout can use directly.

**The fix:** added `buildEvidenceVector()` (sums `classifyFile`'s per-archetype signal weights into
a fixed-length vector, ordered over the full `BUILTIN_ARCHETYPES` catalog — stable dimensionality
regardless of which archetypes happen to appear in a given training run) and
`trainArchetypeELMNumeric()`/`predictArchetypeNumeric()`, which concatenate that vector with a
path-only encoded vector (no evidence text appended, so it doesn't compete with hints for
truncation budget or mix the two signal types into one stream) and train via `trainFromData()` —
same as before, just numeric input instead of joined text.

**Ran it controlled, not as a replacement** — same data, same 80/20 split, same seed (`20260812`),
same `hiddenUnits` (512), same held-out codebase, both representations in the same script run so
the only changed variable is the representation itself. This is the discipline Realm's review said
the pooled-training retry was missing (it changed example count *and* category count in one shot);
didn't want to repeat that mistake here.

**Result — clean, large, and in the direction Realm predicted:**

| | text (original) | numeric (fix) |
|---|---|---|
| In-domain best point | 92.7% @ 39.4% (t=0.15) | **95.7% @ 67.3%** (t=0.15) |
| Out-of-domain @ t=0.15 (same threshold, both reps) | 7.7% @ 16.7% | **97.0% @ 42.3%** |
| Out-of-domain best point | 7.7% @ 16.7% (t=0.15) — nothing better available | **100% @ 30.8%** (t=0.18) |
| Out-of-domain @ full coverage (t=0.05) | 25.6% (below 48.7% baseline) | **71.8%** (well above baseline) |

**The numeric representation clears the ADR's ≥95% precision gate with real coverage (42.3%) for
the first time in either implementation.** Not a marginal improvement — a qualitative change from
"doesn't work" to "works, on this held-out set." Sanity-checked this isn't leakage before reporting
it as a real result: the evidence vector comes from the same source I've used since 2026-08-12 (a
fresh, LLM-call-free `analyzeClassifications()` re-run) — no dependency on the true label, same
non-circular signal as always, just encoded as numbers instead of a string.

**What this doesn't yet establish:** one held-out codebase, 78 examples, 6 archetypes represented.
Realm's own caution about the pooling experiment (one dataset's surprising result is a lead, not a
conclusion) applies here too, on the positive side this time. Left the "is this enough to move
toward production wiring" question open for the user rather than deciding it — see Next up.

Updated `ADR-2026-08-12-knight-elm-prefilter-classify.md` with a third dated measurement (Realm's
review referenced, the encoder-mechanics finding, and this comparison) and `IMPL-2026-08-12-knight-...md`'s
Status/Open questions. Did not touch `classify.ts`/`analyze-phases.ts` — still gated on a decision
about corroboration, not on the precision number itself anymore.

### 2026-08-13 — TJ-K1 re-run on LLM-enriched data: more data made generalization WORSE

User asked to re-run training now that richer data existed. Checked first rather than assuming:
both `../n-dx-jarrett/.sourcevision/` and `AsterMind-Community-Edition/.sourcevision/` now show real
`"llm"`-sourced entries (`bySource: {algorithmic: 589, llm: 94}` and `{llm: 31, algorithmic: 99}`
respectively) — someone ran `ndx analyze` with enrichment on for both since the 2026-08-12
measurement. Re-ran `eval-classify-elm.ts` unchanged, pointed at the same two directories (still
reusing rather than generating my own copy, same reasoning as before — controls classification-run
noise out of the comparison).

**Expected richer data to close the out-of-domain gap. It didn't — it opened wider:**

| | 2026-08-12 (algorithmic-only) | 2026-08-13 (LLM-enriched) |
|---|---|---|
| Training examples / archetypes | 423 / 11 | 517 / 14 |
| Held-out examples / archetypes | 47 / 6 | 78 / 6 |
| In-domain best (precision @ coverage) | 98.1% @ 62.4% | 92.7% @ 39.4% |
| Out-of-domain best *meaningful* point | 62.5% @ 17.0% | 7.7% @ 16.7% |
| Out-of-domain @ full coverage | 29.8% (below 55.3% baseline) | 25.6-29.9% (below 48.7% baseline) |

Verified this wasn't a bug before reporting it as a real finding: wrote a direct probe
(`predictArchetype` over all 78 held-out examples, ignoring the confidence threshold entirely) —
raw argmax accuracy is 25.6% (20/78). Looking at the actual misses, the model defaults to
`"utility"` (the largest training class) for almost every `entrypoint`-style file in the held-out
set (`examples/*/main.js`, `node_examples/*.ts`) it doesn't recognize — classic majority-class
collapse, sharper now than at 11 archetypes.

**This falsifies the 2026-08-12 hypothesis** ("most likely training-data quantity/representativeness,
not the architectural choice"). Growing both the example count *and* the label space (11→14
archetypes) made the softmax more diffuse and the held-out task harder in a way that outweighed
whatever signal the new LLM-labeled examples added. Two live candidates for what to try next,
neither measured yet: (1) the feature representation — file path + up to 3 evidence hints may
simply not carry enough discriminative signal across codebases with different conventions,
regardless of training-set size; (2) model capacity/architecture — `hiddenUnits` is still the
hello-world's original 512, untuned for a 14-way problem, and this is now real evidence (not just
"we haven't measured yet") that could justify actually reaching for `KernelELM` per the ADR's own
"only if base-ELM's held-out accuracy doesn't clear the bar" escalation clause.

Updated: `ADR-2026-08-12-knight-elm-prefilter-classify.md`'s Evidence section (added as a second,
dated measurement — did not overwrite the 2026-08-12 numbers, since the contrast between the two is
itself the finding) and this charter. Did not touch `IMPL-2026-08-12-knight-classify-elm-swap.md`'s
Steps — still blocked before Step 9's gate for the same reason, now on firmer evidence.

### 2026-08-12 — TJ-K1: independent ELM pre-filter implementation, real numbers in

Built and ran an independent implementation of the ELM pre-filter ADR, in its own worktree
(`../n-dx-knight`, branch `elm/jarrett/classify-elm-knight`), deliberately without reading Archer's
`classify-elm.ts`/`eval-classify-elm.ts` source — the user asked for a genuine comparison, not a
copy. Full technical picture:

**Setup:** `@astermind/astermind-community` was already a root `package.json` dependency from a
pre-existing commit (`43d6db51`, "ELM hello-world") — not something either `TJ-A1` or `TJ-K1`
needed to add fresh, despite `IMPL-2026-08-11-...`'s files-touched table claiming otherwise (wrong
path: it names `packages/sourcevision/package.json`, but the dependency lives in root
`package.json`). Added it to `packages/sourcevision/package.json` explicitly anyway, since the
package genuinely consumes it directly and shouldn't rely on workspace hoisting by accident.

**Empirically confirmed, not just re-read from Archer's notes:** ran the installed
`@astermind/astermind-community@3.0.0` package directly — `elm.train(realExamples)` and
`elm.train()` produce byte-identical models (same `W`, `beta`, same predictions). `train()`'s first
parameter is `augmentationOptions`, not a data array; passing one is silently ignored. This also
means the existing `scripts/elm-hello-world.mjs`'s "trained on 30 paths... 83% accuracy" claim is
misleading — that 30-example `TRAINING_SET` is logged but never actually used; the real accuracy
reflects training on augmented variants of the three bare category-name strings only. Logged in
`IN-FLIGHT.md` since the hello-world script is a shared file and its comment is now inaccurate.

**A second finding, not in either ADR/IMPL yet:** `classifications.json` only persists each file's
*final* resolved archetype. For files the LLM stage relabels, `mergeClassificationResults` replaces
the algorithmic pass's per-file `evidence` (the `archetypeId(weight)` hints) entirely — nothing
preserves the pre-merge evidence on disk. So "file path + algorithmic partial-evidence signals" as
a training feature, for LLM-labeled examples specifically, isn't actually recoverable from
`classifications.json` alone, contrary to how the ADR's Decision section describes the training-data
plan. Worked around it in `extractExamples()` by re-running the free, deterministic,
LLM-call-free `analyzeClassifications()` against the same `inventory.json`/`imports.json` that
produced `classifications.json`, then pairing its freshly-computed evidence with the FINAL label
from `classifications.json` regardless of which stage set it.

**Results** (seed `20260812`, training source: Archer's already-generated `n-dx-jarrett/.sourcevision/`
data — reused rather than re-running `ndx analyze` myself, since it's the same repo content and
reusing it removes classification noise as a variable from the comparison; held-out source: the
already-generated `AsterMind-Community-Edition/.sourcevision/` data, likewise reused):

- Neither dataset has any LLM-sourced labels (`bySource` is 100% `"algorithmic"` in both) — whoever
  generated them ran without LLM enrichment. 423 usable n-dx examples across 11 of 17 archetypes;
  47 usable held-out examples across 6 archetypes. This is a real gap from the ADR's stated
  "algorithmic + llm" training plan, not a choice I made.
- First threshold sweep (0.3-0.99) showed 0% coverage everywhere — not a broken model, a
  miscalibrated sweep: with candidate archetypes and a ridge-regression softmax readout, confidence
  stays diffuse (observed cluster 0.13-0.23) even when the argmax is reliably correct. Recalibrated
  to a wider low-end sweep.
- **In-domain** (85-example held-out split of n-dx's own data): strong — 98.1% precision at 62.4%
  coverage (threshold 0.18), 95.7% precision at 82.4% coverage (threshold 0.15).
- **Out-of-domain** (the number the ADR's gate actually measures — 47 held-out `AsterMind-Community-Edition`
  examples): does **not** clear the bar in any practically useful sense. At full coverage
  (threshold <=0.10), precision is 29.8% — *worse* than the 55.3% majority-class baseline. The only
  point clearing >=95% precision resolves a single example (2.1% coverage) — added a minimum-coverage
  floor to the eval script's gate check so a result like that can't silently read as a pass.
  Best *meaningful*-coverage point: 62.5% precision at 17.0% coverage (threshold 0.15).
- **Read on why:** most likely training-data quantity/representativeness, not the base-ELM approach
  being wrong — in-domain performance shows the model *can* learn the archetype signal, but 423
  narrow (algorithmic-only, 11-archetype) examples isn't enough to generalize to a codebase with
  different naming conventions. The population that never appeared in training — files hard enough
  that the algorithmic pass alone couldn't resolve them — is exactly the population the pre-filter
  needs to handle in production.

**Per the ADR's own template requirement** ("a negative result needs the same Evidence rigor as a
positive one"): this is being reported as a negative-leaning result, not silently discarded. Did
not proceed to production wiring (IMPL steps 6-8) — the gate didn't clear.

**Left for the user:** whether to spend real LLM tokens re-running `ndx analyze` (with enrichment
on) for both repos to get a properly representative population before drawing a final conclusion.
Flagged rather than done unilaterally since it also touches the held-out codebase's shared state,
which Archer's own `TJ-A1` eval may still depend on.
