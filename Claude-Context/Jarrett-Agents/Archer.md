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

Focus has narrowed to `classify.ts`'s `enrichClassificationsWithLLM` as the first ELM build
target (per the 2026-07-30 survey below). Knight did a follow-up survey of
`AsterMind-Community-Edition/src/core/` on 2026-08-11 (logged below) confirming base `ELM` in text
mode is the right fit for that target, and flagging `OnlineELM` as a plausible v2 if the classifier
should keep learning from live `ndx analyze` runs instead of periodic retraining.

## Next up

- [ ] Read `packages/sourcevision/src/analyzers/classify.ts` in full — confirm
      `enrichClassificationsWithLLM`'s call shape, batching (30/call), and whether it's a fused
      call (label + free-text reasoning together) like `assessGranularity`, per the fused-call
      caveat below.
- [ ] Prototype base `ELM` (text mode) against that call site using the algorithmic pass's
      evidence-scored output as training data, per the 2026-07-30 next-step note.

## Session log

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
