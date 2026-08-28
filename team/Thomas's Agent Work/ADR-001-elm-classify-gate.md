# ADR-001: ELM confidence gate ahead of Claude batch classification in sourcevision

- **Status:** Accepted (shadow-mode infrastructure) — core efficacy hypothesis falsified by real-data validation; gate remains disabled pending redesign (see companion implementation plan)
- **Date:** 2026-08-20
- **Author:** Nala (head engineer, n-dx)
- **Supersedes:** none

## Context

`sourcevision`'s file-archetype classifier (`packages/sourcevision/src/analyzers/classify.ts`) runs an algorithmic pass first, scoring every file against 18 fixed archetypes (`archetypes.ts:16`). Files whose top score doesn't clear `PRIMARY_THRESHOLD = 0.4` (`classify.ts:33`) fall through to `enrichClassificationsWithLLM` → `classifyBatchWithLLM`, which batches them 30-at-a-time to the Claude CLI. This fires on every non-`--lite` `ndx analyze` and is the highest-frequency single-shot LLM call site in the repo (22 call sites surveyed across sourcevision and rex; this is the cleanest fit — fixed closed label set, single-label output, no fused free-text reasoning to preserve).

The stated goal was to cut those token costs by inserting a small, cheap classifier (an AsterMind-Community-Edition ELM) between the algorithmic pass and the Claude batch queue, resolving high-confidence files locally at zero token cost and sending only the genuinely ambiguous residual to Claude.

The original design assumption (logged 2026-08-06): unclassified files carry a *weak-but-present* per-archetype evidence vector — signal that scored under 0.4 but still has shape an ELM could learn to interpret — because the algorithmic pass already computes this vector for every file as part of scoring, at zero extra feature-extraction cost.

## Decision

Build and ship the ELM gate in **shadow mode**: train and predict on every real `ndx analyze` run, log ELM-vs-Claude agreement, but never actually skip the Claude call (`ELM_GATE_ENABLED = false`) until a false-positive rate is established. This followed directly from the 2026-08-06 hold-before-merge condition: a wrong ELM label is silent (no LLM in the loop to catch it), so nothing gates real behavior until agreement data justifies it.

Implementation landed across four files:

- `packages/sourcevision/package.json` — added `@astermind/astermind-community@^3.0.0` (pinned to the published registry version, not the ahead-of-registry `4.0.0` checked into this monorepo at `AsterMind-Community-Edition/`; confirmed via `npm view` that only 3.0.0 is published, and confirmed the 4.0.0 changelog only removes unused variant classes the integration doesn't touch).
- `packages/sourcevision/src/schema/v1.ts` — widened `FileClassification.source` to `"algorithmic" | "llm" | "user-override" | "elm"`.
- `packages/sourcevision/src/analyzers/classify-elm.ts` (new) — `trainClassifyELM` (numeric-mode `ELM`, `trainFromData`, evidence vector → archetype label), `predictWithClassifyELM` (top1/top2 margin gate at threshold 0.3, minimum 20 training examples), `buildFeatureVector` (reconstructs the dense per-archetype vector from `FileClassification.evidence`'s sparse signal list).
- `packages/sourcevision/src/analyzers/classify.ts` — wired the gate into `enrichClassificationsWithLLM` ahead of batch construction (not inside the retry loop — the token-saving cut has to happen before a batch exists, not after).

Model type: plain `core/ELM.ts` in numeric mode (`useTokenizer: false`), not any of the text-mode, ensemble, or meta-classifier wrappers in the library — the input is already a dense structured vector, not raw text, so tokenizer-based and stacking components are the wrong shape. Placement: alongside `classify.ts` as a satellite file (matching the existing `enrich*.ts` sibling pattern), dependency scoped to `sourcevision` only (not promoted to `@n-dx/llm-client` — single consumer, two-consumer rule not yet met). No model persistence — retrained in-memory each analyze run; training is closed-form and millisecond-cheap at this data scale, and skipping persistence avoids a stale-model-vs-changed-archetype-catalog bug class for free.

## Alternatives considered

| Option | Why not |
|--------|---------|
| `KernelELM` | Kernel tuning surface unjustified by an already low-dimensional, already-informative input vector |
| `DeepELM` | Autoencoder pretraining targets unstructured/high-dim raw input; the evidence vector is already a final structured feature set |
| `IntentClassifier` / `LanguageClassifier` (text-mode) | Wrong input mode — these tokenize raw text; `classify.ts` produces a numeric vector, not text, at the point the gate needs to run |
| `VotingClassifierELM` | Stacking meta-classifier over multiple *already-trained* upstream models' prediction lists — only one model is in play here, nothing to stack |
| `ConfidenceClassifierELM` | Separate binary low/high trust meta-classifier — redundant, since the base `ELM`'s own softmax `prob`/margin already serves as the confidence signal |
| `OnlineELM` (OS-ELM, incremental) | Real fit for sourcevision's incremental-analyze mode long-term, but batch `trainFromData` retrain is cheap enough at current scale — deferred, not needed for v1 |
| Persist trained model to `.sourcevision/` | Adds a staleness failure mode (model silently mismatching a changed `archetypes.ts` catalog) for a retrain cost that isn't a problem yet |
| Promote ELM dependency to `@n-dx/llm-client` | Would violate the repo's own two-consumer rule for shared/foundation-tier additions — only one consumer (`classify.ts`) exists today |

## Consequences

**What got easier:** the shadow-mode scaffolding (schema support for an `"elm"` source, the gate call site, the training/predict split) is in place and typechecked/tested clean, so a future redesign of the *input representation* doesn't require re-plumbing the integration point.

**What got harder / what broke:** the core premise did not survive contact with real data (see Evidence). The gate cannot be enabled as designed — `ELM_GATE_ENABLED` stays `false` indefinitely under the current evidence-vector input, not as a temporary caution but because the input carries no signal for the population it would need to resolve.

**What we now maintain:** an inert-but-present code path (`classify-elm.ts`, the schema field, the gate call site) that trains and logs on every real analyze run but changes no behavior. This is a real maintenance surface (typechecked, tested, a real dependency) for zero current benefit, and should not be left in this state indefinitely — either fixed per the companion implementation plan or removed if the redesign doesn't pan out.

**Environment finding, not a consequence of the decision itself:** the `claude` CLI is absent from this development environment, so ELM-vs-Claude agreement data (the actual shadow-mode validation this ADR's decision depends on) cannot be collected here at all. Validation to date used the algorithmic evidence vectors directly, bypassing the LLM call — sufficient to falsify the input-representation hypothesis, not sufficient to ever produce the agreement statistic the shadow-mode design was built to collect.

## Evidence

- **Task framing:** input = per-archetype evidence-score vector (18-dim, reconstructed by `buildFeatureVector` from `FileClassification.evidence`) for files the algorithmic pass left unclassified (top score < `PRIMARY_THRESHOLD = 0.4`). Label set = 18 fixed archetypes (`archetypes.ts:16`). Gate logic: top1/top2 softmax margin ≥ 0.3, minimum 20 confidently-labeled training examples required before the gate is live for a given run.
- **Training/held-out split:** none applicable to the validation run described below — this was a direct diagnostic against real production data, not a held-out accuracy measurement (see script below).
- **Real-data run (2026-08-20):** `ndx analyze` (non-lite) against the n-dx monorepo itself. 423 files classified algorithmically (confident, source = `"algorithmic"`), 260 files left unclassified.
- **Result: 0/260 unclassified files resolved by the ELM.** Root cause confirmed directly against raw `.sourcevision/classifications.json` entries, not a diagnostic bug: **all 260 unclassified files carry a completely empty `evidence` array.** This is not "weak signal below threshold" — it's no signal at all. Example: `packages/hench/src/agent/analysis/adaptive.ts`, whose path/directory/filename/export signals matched none of the 18 archetype detectors.
- **Margins:** ~0.002 across the board on the all-zero input vectors — indistinguishable from noise. Not a threshold-tuning problem; lowering the 0.3 margin gate would only convert noise into false positives, not real resolutions.
- **Counter-evidence the input representation itself works, when given real signal:** the pre-existing `scripts/elm-hello-world.mjs` smoke test (committed since `43d6db51`, predates this integration) feeds raw file-path text through the same library in **text mode** (`useTokenizer: true`, `.train()`/`.predict()` — a different code path from `classify-elm.ts`'s numeric mode) and gets **83% accuracy on held-out paths.** This confirms the library and the underlying signal (file paths carry classification-relevant information) both work; it confirms the *evidence-vector* framing specifically is the part that fails for this file population, not ELMs in general.
- **Random baseline:** with 18 classes, random guessing ≈ 5.6% accuracy. The evidence-vector approach measured **0% resolution rate** on the target population (not comparable to a random-guess accuracy figure, since it never produced a confident prediction to score — the gate correctly declined to guess given all-zero input, which is the gate behaving correctly, not the model failing gracefully).
- **Script:** diagnostic run as a standalone scratchpad script during the 2026-08-20 session, not committed to the repo. Not yet promoted to a permanent test/fixture — flagged as a to-do in the companion implementation plan.
