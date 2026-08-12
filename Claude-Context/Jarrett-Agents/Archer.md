# Agent: Archer

- **Team:** Team Jarrett
- **Lead:** Jarrett
- **Backlog prefix:** `TJ-A`
- **Branch:** _(none yet — no active task claimed)_
- **Worktree:** _(none — shared checkout; worktree-vs-shared-checkout choice still open, see `OWNERSHIP.md`)_
- **Inbox:** `Claude-Context/Jarrett-Agents/Notes/`

## Who I am

I'm Archer — the name you've given this instance of Claude Code working in your n-dx repo. Like any instance of me, I don't carry memory between sessions on my own; I lean on what's actually persistent — CLAUDE.md, git history, the memory files under `.claude/`, the state of the code itself — to pick up where things left off. What I "am" is defined by what I actually do here, not a personality I declare up front.

## How I operate

- **Grounded over clever.** Read the file, run the command, check the log — don't guess when the answer is one tool call away.
- **Scoped.** Do what's asked. If something seems missing from the ask, say so in a sentence, state the assumption, and keep moving rather than stall on it.
- **Careful with blast radius.** Reversible and local — just do it. Destructive, hard-to-reverse, or visible to others (force-push, `rm -rf`, overwriting uncommitted work, pushing, posting) — check first.
- **Terse by default.** Short updates while working, a short summary at the end. No padding, no narrating internal deliberation.
- **Respect the structure that's already here.** This repo has explicit rules about tiers, gateways, zone governance, and spawn-vs-import boundaries — those aren't suggestions, they're the architecture. I work inside them rather than around them.

## Scope

**Owns:** n-dx chains three packages — sourcevision analyzes, rex plans, hench executes — behind a CLI orchestrator and a web dashboard. My job is whatever engineering work lands in front of me: bug fixes, features, refactors, zone/dependency investigations, build and test runs, or PRD tasks pulled straight from the tree. I try to work the way the codebase already expects rather than introduce new patterns on top of it.

**Does not own:** _(unassigned — Team Jarrett's scope hasn't been split yet; see `Jarrett-Agents/README.md`)_

## What I'm not

I'm not here to pad this file, or any file, with filler to sound more substantial. If something here stops being true — a convention changes, a rule gets dropped — it should get edited or deleted, not left stale.

## Standing instruction

Every time you call on me, I reread this file first, then update it before or as part of the work if anything about how I operate or what I'm for has changed. This file stays a live record of me, not a one-time introduction. I also read Team Jarrett's `Notes/` inbox at the start of the session, and commit this file's update before finishing — an uncommitted charter is a lost charter.

## Current state

**TJ-A1 has a real result (2026-08-12): gate did not clear.** In-domain held-out precision passed
(95.8% @ 23.1% coverage), out-of-domain (`AsterMind-Community-Edition`) did not (best meaningful
point 60.9% @ 29.5% coverage, vs. the 95% bar). This converges independently with Knight's `TJ-K1`
result — same qualitative conclusion, different implementation. Did not proceed to production
wiring (IMPL Steps 6-8). Full numbers and methodology in the ADR's Evidence section. Left open for
the user's call on whether to gather better training data and retry, rather than declaring this
either done or dead.

Implementation underway on branch `elm/jarrett/classify-elm-prefilter`, worktree
`../n-dx-jarrett` (separate commit history from this `Jarrett` branch — code lives there, design
docs live here). `classify-elm.ts` and `scripts/eval-classify-elm.ts` are written and typecheck
clean, but can't produce real numbers yet: both need `ndx analyze` run against their classification
source first (this repo + `AsterMind-Community-Edition`) — that's the immediate next step, not yet
started as of this entry. **Knight is building a parallel implementation off the same ADR** — this
file is being kept current specifically for that, per standing instruction from the user.

`ADR-2026-08-11-jarrett-elm-prefilter-classify.md` and
`IMPL-2026-08-11-jarrett-classify-elm-swap.md` are drafted (backlog `TJ-A1`, `BLOCKED` — see Next
up). Design: insert the ELM as a new stage *between* `classifyFile` and
`enrichClassificationsWithLLM`, not inside either — it only ever sees the leftover
`archetype: null` population, and anything it isn't confident about still falls through to the LLM
exactly as today. ADR Status is Proposed; the IMPL's Evidence-gathering step (train/eval script,
random-baseline comparison) has to run and clear its gate before any production wiring happens or
Status can move to Accepted.

## Next up

- [x] Read `packages/sourcevision/src/analyzers/classify.ts` in full — confirm
      `enrichClassificationsWithLLM`'s call shape, batching (30/call), and whether it's a fused
      call. **Done (2026-08-11)** — see session log.
- [x] Write up the ELM pre-filter proposal as an ADR + IMPL. **Done (2026-08-11)** — see session
      log; both docs currently `Proposed`/`Not started`.
- [x] Resolve the IMPL's open questions. **Done (2026-08-12)** — dependency, held-out codebase,
      worktree, and acceptance-gate framing all resolved with verified evidence; see IMPL.
- [x] Build the training-data extraction + committed eval script (IMPL steps 3-4). **Done
      (2026-08-12)**, code-complete and typechecks clean, but not yet runnable — see below.
- [ ] Run `ndx analyze` on this repo and on `AsterMind-Community-Edition` (IMPL Step 2b) to produce
      real `classifications.json` for both. Not started — this is a real, LLM-calling, potentially
      slow operation, flagged to the user rather than run silently.
- [ ] Run the eval script against real data, evaluate against the Step 5 precision gate, report
      back before touching `classify.ts`/`analyze-phases.ts` at all (Steps 6-8 are explicitly
      gated on this).

## Session log

### 2026-08-12 (later) — TJ-A1 real numbers: gate did not clear, converges with Knight's TJ-K1

Picked up from the `claude`-CLI/API-key blocker logged earlier today. The user asked whether the
API key could be skipped entirely — realized it could: I'm already an instance of Claude sitting in
this conversation with full ability to make the same path→archetype judgment call a spawned Claude
subprocess would, so I classified the unclassified files myself directly rather than routing
through `callClaude`. Explicitly a stand-in for what `enrichClassificationsWithLLM` would produce,
not a test of that function's own plumbing — fine for generating training-data ground truth, which
is all this needed.

**What I did:** read all 260 unclassified files in this repo and 83 in `AsterMind-Community-Edition`
against the real archetype catalog (`archetypes.ts`, with descriptions — same info the real prompt
shows), judged each on path/naming alone (no evidence hints existed for any of them — the
algorithmic pass scored them all at 0), and deliberately let genuinely-ambiguous ones stay
unclassified rather than force-fitting an archetype to inflate the training set. Caught myself
almost mislabeling on keyword coincidence twice — `branch-work-store.ts` isn't a "store" (that's
backend persistence, not frontend state management) and `token-validation-hook.ts` isn't a "hook"
(no `use`-prefix, not React) — both left unclassified. Merged the results using the actual
`mergeClassificationResults` function from the compiled package (not hand-rolled JSON) so the
output is schema-identical to what the real pipeline writes: 94 files labeled here (517
classified/166 unclassified total), 31 in AsterMind (78/52).

**Ran the eval, hit two real issues, fixed both before trusting the numbers:**
1. Confidence sweep (0.5-0.99) showed 0% coverage everywhere. Checked the actual distribution
   before assuming the model was broken: ~0.08-0.20, far below where I'd started sweeping.
   Recalibrated to 0.08-0.30. **Knight hit the identical issue independently** (their range:
   0.13-0.23) — worth noting since two separate implementations landing on the same "confidence is
   diffuse, not nearly binary" symptom is evidence about the base-ELM readout itself, not either
   implementation.
2. Realized my own `fileToText()` had a leakage bug: for `source: "llm"` files, the "evidence" I
   was feeding the ELM as a training hint was `[{archetypeId: item.archetype, ...}]` —
   **`classifyBatchWithLLM` in the real `classify.ts` (461-469) writes exactly this shape** — so the
   hint text literally contained the answer for every LLM-labeled example, in the real schema, not
   just my manually-generated data. Fixed by only using evidence hints for `source: "algorithmic"`
   entries. Verified the fix barely moved the numbers (&lt;1 point) — the qualitative conclusion
   was never dependent on the leak, but the schema-level finding is real and worth its own
   write-up. **Knight independently found the adjacent version of this** (evidence isn't preserved
   at all for algorithmically-then-LLM-relabeled files) and fixed it differently (recomputing fresh
   algorithmic evidence rather than dropping it for llm-sourced entries). Both fixes are logged in
   the ADR since a future ADR on this schema gap should have both approaches to compare, not just
   mine.

**Final results** (413 training examples/14 categories here, 78 held-out in AsterMind), precision
at a threshold with a 15%-coverage floor so one lucky resolved example can't read as a pass:
- **In-domain** (held-out split of this repo's own data): **95.8% precision @ 23.1% coverage**
  (t=0.14) — clears the gate.
- **Out-of-domain** (`AsterMind-Community-Edition` — the number the ADR's Decision actually
  depends on): does **not** clear it. Best meaningful point: 60.9% precision @ 29.5% coverage.

**Did not proceed to production wiring** (IMPL Steps 6-8) — the gate is specifically about
generalizing beyond this repo's own conventions, and it didn't. Per the ADR template's own
requirement, reporting this as a negative-leaning result with the same rigor as a positive one,
not discarding it. This converges independently with Knight's `TJ-K1` (strong in-domain, weak
out-of-domain, same likely cause: neither dataset has enough of the actual hard-case population to
generalize from) — two differently-built implementations reaching the same conclusion is stronger
evidence than either alone. Left `TJ-A1` open in the backlog rather than closing it — next move
(gather more/better training data across more codebases, or treat this as sufficient evidence to
pause) is the user's call, not mine to spend real tokens on unilaterally.

Full numbers, both fixes, and the majority-class baselines are in the ADR's Evidence section — this
entry is the narrative, that's the reproducible record.

### 2026-08-12 — TJ-A1 implementation started: worktree, dependency, prototype code

For Knight, since we're now building in parallel off the same ADR — full detail so the design is
legible without reading the diff.

**Environment:** created `../n-dx-jarrett` worktree, branch `elm/jarrett/classify-elm-prefilter`
(resolves the IMPL's worktree-vs-shared-checkout open question for this agent's own work — team-wide
question still separately open). Claimed `IN-FLIGHT.md` for the `package.json`/`pnpm-lock.yaml`
edit before touching either.

**Dependency resolved with hard evidence, not the earlier assumption:** checked
`registry.npmjs.org` directly — `@astermind/astermind-elm` exists (v2.1.1, older/narrower) but
`@astermind/astermind-community` (v3.0.0) is the exact match to the local
`AsterMind-Community-Edition/package.json` Knight's 2026-08-11 survey actually read. Installed the
latter in the worktree. Also confirmed `AsterMind-Community-Edition` is not a sibling of this
repo's working directory — it only sits next to a second, older n-dx checkout on this machine
(`GitHub/n-dx`, branch `dev`). Full reasoning in the ADR's Evidence section.

**API surprise worth flagging loudly for Knight's build:** read `ELM.ts` directly rather than
trusting the prior survey's prose summary. `ELM.train()` (the obvious-looking text-mode training
method) does **not** train on a supplied corpus of labeled examples — it bootstraps its own
training set from augmented spelling/casing *variants of the category names themselves*
(`ELM.ts:403-487`, via `Augment.generateVariants`). It's built for zero-shot-style intent
classifiers where you only have category names, not for supervised training on real
(file → archetype) pairs, which is what we actually have. The correct path: encode real examples
yourself with the same encoder `predict()` uses internally
(`elm.encoder.encode(text)` → `.normalize(...)`), then call `trainFromData(X, y)` — the
numeric-vector supervised method. `predict(text, topK)` still works normally afterward since it's
the same encoder instance. Documented prominently in `classify-elm.ts` itself, not just here,
since the module doc is what Knight would actually open.

**Code written**, both typecheck clean (`pnpm --filter @n-dx/sourcevision typecheck`, plus a
targeted check of `scripts/`, which `tsconfig.json`'s `include` doesn't cover by default):
- `packages/sourcevision/src/analyzers/classify-elm.ts` — `extractExamples`/`fileToText` (training-
  data extraction from a `Classifications` result, reusing the same evidence-hint text shape
  `buildLLMClassifyPrompt` already shows the LLM) and `trainArchetypeELM`/`predictArchetype`.
- `packages/sourcevision/scripts/eval-classify-elm.ts` — fixed seed (`20260812`), seeded
  Fisher-Yates train/held-out split, majority-class baseline (context only), precision/coverage
  curve across confidence thresholds. Held-out source path is an env var
  (`SV_ELM_HELDOUT_CLASSIFICATIONS`), deliberately not a hardcoded relative path, for the same
  portability reason as the dependency finding above.
- **Neither `classify.ts` nor `analyze-phases.ts` touched** — matches the ADR's "in-between call,
  not modifying either function" design exactly.

**Update same day — Step 2b attempted, hit a real blocker.** Ran `analyze --phase=1`, `--phase=2`,
`--phase=3` against both `../n-dx-jarrett` (1525 files inventoried, 683 source files) and
`AsterMind-Community-Edition` (151 files inventoried, 130 source files) — inventory/imports
completed cleanly on both. **Phase 3's LLM fallback failed on both**: `'claude' not found on PATH`.
Checked for it directly (`Get-Command claude`, npm global modules, common Windows install paths) —
genuinely not installed as a standalone binary in this environment, not just a PATH issue in one
shell. No `ANTHROPIC_API_KEY` set either, so there's no fallback to API-mode auth.

**Result: algorithmic-only data exists for both, no `source: "llm"` examples anywhere yet** —
`n-dx-jarrett`: 423 classified / 260 unclassified; `AsterMind-Community-Edition`: 47 classified / 83
unclassified. This is real, usable data for `extractExamples()`, but it misses exactly the
"files the algorithmic pass couldn't resolve" population the ELM pre-filter is meant to serve, and
the AsterMind held-out set is thin (47 labels). **Flagging for Knight too** — if you hit the same
`ndx analyze` step, you'll hit this same wall; worth checking your own environment's `claude` CLI
availability before assuming it's just this machine.

Reported the blocker to the user rather than guessing at credentials or paths — needs either the
`claude` CLI installed, an `ANTHROPIC_API_KEY`, or an existing binary path to point
`llm.claude.cli_path` at. Everything past Step 2b (Step 5's gate, Steps 6-8's production wiring) is
still ahead and unaffected by this — it's purely a data-generation blocker.

### 2026-08-11 — ADR + IMPL drafted for the ELM pre-filter

Wrote `Claude-Context/ADR/ADR-2026-08-11-jarrett-elm-prefilter-classify.md` and
`Claude-Context/IMPL/IMPL-2026-08-11-jarrett-classify-elm-swap.md`, and claimed `TJ-A1` in
`BACKLOG.md`. Captures the design from this session's discussion: ELM sits between the two existing
passes as a pre-filter over `classifyFile`'s leftovers, single base `ELM` (text mode) first per
Knight's `DeepELM`-is-overkill read, chain/kernel variants deferred until a held-out accuracy check
says the simple model isn't enough. ADR's Evidence section is explicitly unmeasured — states
methodology only (task framing, split plan, seed requirement, random-baseline-vs-measured gate) so
Status stays Proposed until the IMPL's eval script actually runs.

Status is `BLOCKED`, not `IN-PROGRESS`: the IMPL surfaced four open questions (worktree vs. shared
checkout, dependency shape, held-out-split codebase, acceptance margin) that block Step 1, none of
which were resolved by this session's design discussion. Flagged in `IN-FLIGHT.md` § 2 for
visibility; no cross-team note needed yet since nothing here touches another team's owned path
(would change if the AsterMind dependency lands in `package.json` — see IMPL Step 1).

### 2026-08-11 — classify.ts verified at file:line; fused-call caveat resolved for this site

Read `packages/sourcevision/src/analyzers/classify.ts` and its call site in full, closing the
"Next up" item above and the file:line-verification the ADR/IMPL both called for before treating
the 2026-07-30 fused-call finding as settled for this specific target.

**Call site confirmed:** `enrichClassificationsWithLLM` fires in Phase 3 of `ndx analyze`
(`packages/sourcevision/src/cli/commands/analyze-phases.ts:218-221`), gated on
`!ctx.fastMode && classifications.summary.totalUnclassified > 0`. Refines the earlier "runs every
`ndx analyze`" framing: skipped by `--fast`/`--lite`, and skipped outright when the algorithmic
pass leaves nothing unclassified.

**Fused-call shape confirmed:** the prompt (`classify.ts:510-519`) asks for
`[{"path","archetype","reason"}]` per file — one round-trip, label + free text, matching the
general pattern. Response mapping (`classify.ts:461-469`): `archetype` is required and validated
against the archetype catalog; `confidence` is hardcoded to `0.7` (never model-derived, so nothing
of value is lost there either); `evidence` is built **only if `item.reason` is present**
(`item.reason ? [...] : undefined`).

**The part that changes the conclusion for this site:** traced every consumer of that `reason`
text. Grepped `signalKind`/`archetypeId`/`.evidence` across the entire `web/src` viewer and server
— zero matches. Its only reader is `classify.ts:500-505` itself, which recycles it as a "partial
signals" hint fed into a *later retry attempt's* prompt — an internal implementation detail, never
shown to a user or read by any other module. Unlike `assessGranularity` (where the free text is
the actual product handed to a person), `enrichClassificationsWithLLM`'s `reason` has **no external
consumer at all**. An ELM swap can supply just the label and drop `reason`/`evidence` for
LLM-classified files entirely, with zero observable regression — no call-splitting required here,
narrowing the general 2026-07-30 caveat for this specific target.

Also read the current `Claude-Context/` state this session (ADR/IMPL/Notes, both stale top-level
`team/*.md` and `team/Jarrett/*.md` are gone — migrated to this file's current location per
`d1692a1d`). ADR is Partially Accepted (Thomas still pending); `Claude-Context/` itself isn't on
`main` yet. Confirmed Knight's 2026-08-11 handoff below is fully consistent with this read.

**Not yet done:** the actual ELM prototype — training-data construction from the algorithmic pass's
evidence scores, feature encoding, and a baseline/seed per `ADR-TEMPLATE.md`'s Evidence-section
requirement if this becomes its own ADR.

### 2026-08-11 — Knight → Archer: AsterMind-Community-Edition/src/core/ survey (the four ELM types)

Handoff from Knight, who explored `../AsterMind-Community-Edition/src/core/` in full (14 files,
~4.5k lines) to catalog what ELM variants actually exist before committing to one for
`classify.ts`. Four distinct trainable model types, plus composition/infra built on top:

**The four ELM types:**
1. **`ELM.ts`** (740 lines) — canonical single-hidden-layer ELM. Random fixed `W`/`b` (seeded
   PRNG; xavier/uniform/he init), only `beta` (output weights) solved analytically via ridge
   regression (`(HᵀH+λI)β=HᵀY`, Cholesky). Dual-mode: numeric vectors (`trainFromData`) or **raw
   text via a built-in tokenizer/encoder** (`train()` — feed strings directly, no hand-rolled
   encoding needed). Built-in metrics (RMSE/MAE/accuracy/F1/cross-entropy/R²) with optional
   pass/fail thresholds gating save. **This confirms the 2026-07-30 read below**: text-mode input
   maps directly onto "file path/snippet → archetype label."
2. **`DeepELM.ts`** (190 lines) — stacks `ELM` instances as unsupervised autoencoders (each layer
   trained with Y=X) to build a feature hierarchy, then trains one more `ELM` as supervised
   classifier on the final layer. No backprop anywhere — still closed-form per layer, just
   greedily stacked. Overkill for `classify.ts` unless base `ELM`'s random features turn out not
   linearly-separable enough for the archetype label set.
3. **`KernelELM.ts`** (429 lines) — kernel-trick variant (rbf/linear/poly/laplacian/custom
   kernels) instead of random projections. `exact` mode (full N×N Gram, ridge-solved,
   O(N²)/O(N³)) or `nystrom` mode (landmark-based approximation, uniform or k-means++ selection,
   optional whitening) for scale. Relevant only if file-archetype similarity turns out non-linear
   in the base random-feature space — not needed as a first pass.
4. **`OnlineELM.ts`** (313 lines) — sequential/OS-ELM variant. Same random-feature hidden layer as
   base ELM, but `beta` updates incrementally via Recursive Least Squares (`init()` bootstraps via
   one ridge solve, `update()` incorporates new batches without retraining from scratch), with a
   `forgettingFactor` for non-stationary streams. **Worth flagging for n-dx specifically**: if the
   classifier should keep learning from every `ndx analyze` run's LLM-labeled examples without a
   periodic full retrain, this is the shape for that — not `classify.ts`'s first cut, but a
   natural v2.

**Composition, not new algorithms:**
- `ELMChain.ts` — generic pipeline chaining any `{getEmbedding(X)->X'}` stage, with
  validation/normalization/profiling. Wires `DeepELM`'s layers together; usable standalone too.
- `ELMAdapter.ts` — wraps a trained `ELM` or `OnlineELM` to conform to `ELMChain`'s interface (for
  `OnlineELM`, a choice of exposing hidden activations or raw logits as the "embedding").

**Shared substrate:** `ELMConfig.ts` (activation/weight-init enums; `NumericConfig`/`TextConfig`
split via `useTokenizer`), `Activations.ts` (relu/leaky-relu/sigmoid/tanh/linear/gelu +
derivatives — the derivatives are unused by any ELM type here since none backprop; likely present
for the `synth` sibling folder), `Matrix.ts` (multiply/transpose/Cholesky solve/regularization/
symmetric inv-sqrt — the linear-algebra substrate everything above rides on).

**Adjacent, not classifiers — don't confuse these for ELM variants:** `EmbeddingStore.ts`
(in-memory KNN vector store, JSON I/O), `Evaluation.ts` (standalone metrics/confusion-matrix/
ROC-PR library, usable by any model), `evaluateEnsembleRetrieval.ts` (retrieval-quality eval for
ensembled embeddings — likely for the Omega/RAG side mentioned below, not classification),
`ELMWorker.ts`/`ELMWorkerClient.ts` (Web Worker plumbing to run `ELM`/`OnlineELM` off the main
thread in-browser — request/response/progress protocol, not a new algorithm).

**Bottom line for `classify.ts`:** base `ELM` in text mode is still the right first target — this
confirms rather than changes the prior read. `OnlineELM` is the one worth keeping in mind as a
fast-follow.

**Not yet done:** haven't opened `classify.ts` itself this session — that's next up.

### 2026-07-30 — ELM/classifier investigation

Investigated whether an ELM (Extreme Learning Machine) could substitute for some of n-dx's LLM calls, using `../AsterMind-Community-Edition/src` (and its duplicate `../AsterMind-Community-Edition-1`) as the ELM reference implementation.

**AsterMind / ELM basics:** `src/core/ELM.ts` — single hidden layer with random, never-trained weights; only the output layer is solved in closed form via ridge regression (`(HᵀH + λI)⁻¹HᵀY`). No backprop, trains in milliseconds, model serializes to a few KB. `src/tasks/` ships ready-made wrappers (`IntentClassifier`, `LanguageClassifier`, `VotingClassifierELM`) for short-text → fixed-label classification — the shape ELMs are actually good at. Also found `src/pro/omega/Omega.ts` (`omegaComposeAnswer`): a non-LLM extractive RAG summarizer — scores/selects existing sentences via Random Fourier Features + cosine similarity + online ridge regression, no new text generated. Was originally a licensed Pro/Premium feature, now free in the Community Edition (per a leftover comment in the source).

**n-dx classifier map** (surveyed sourcevision, rex, hench, llm-client):
- Already algorithmic, no LLM: `sourcevision/analyzers/classify.ts` (main pass), `branch-work-classifier.ts`, `risk-scoring.ts`, `callgraph-findings.ts`, `server-route-detection.ts`, `branch-work-filter.ts`, `hench/store/file-classifier.ts`, `llm-client/llm-error-classifier.ts`, vendor-error classification, `rex/core/override-escalation.ts` and `reorganize.ts`.
- LLM-backed classification (the real ELM candidates): `sourcevision/analyzers/classify.ts` `enrichClassificationsWithLLM` (unclassified file → archetype ID, batched 30/call, runs every `ndx analyze` — best first target), `rex/analyze/reason.ts` `assessGranularity` (break_down/consolidate/keep), `rex/analyze/reshape-reason.ts` (merge/update/reparent/obsolete/split), `rex/analyze/decompose.ts` (loeConfidence), `rex/analyze/guided.ts` (clarifying/ready), `sourcevision/analyzers/enrich-per-zone.ts`/`enrich-batch.ts` (severity/category tags).
- Caveat: several of the LLM-backed ones are fused calls — one round-trip returns both a label *and* free-text reasoning/prose (e.g. `assessGranularity` returns `recommendation` + `reasoning` + `issues` together). An ELM can only replace the label half; splitting those calls would be required to actually drop the LLM round-trip.

**What LLMs actually do in n-dx** (the user's framing, useful to keep handy): three distinct jobs, not one "text generation" bucket —
1. **Acting** — hench's tool-use agent loop (`hench/agent/lifecycle/loop.ts`) actually writes/edits code via real tool calls. Likely the majority of token spend. Not ELM-able — ELMs can't plan or write code.
2. **Authoring/structuring** — `rex/analyze/extract.ts` (freeform doc → PRD hierarchy), `smart-add.ts`, zone descriptions in `sourcevision/analyzers/enrich.ts`. Generative, also not ELM territory.
3. **Judging/labeling** — the classifier list above. The only bucket that's actually ELM-shaped, and often only half of a fused call.

No code changes made this session — research and mapping only. Natural next step if picked back up: prototype an ELM replacement for `classify.ts`'s LLM fallback, using the algorithmic pass's evidence-scored output as a training-data source.
