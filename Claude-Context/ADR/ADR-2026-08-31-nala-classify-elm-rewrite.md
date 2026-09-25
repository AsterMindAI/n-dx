# ADR — Replace `classify.ts`'s LLM enrichment pass with a text-mode ELM

- **Status:** Proposed — Thomas has signed off on the direction and on building Phase 1 + Phase 2
  (see `IMPL-2026-08-31-nala-classify-elm-rewrite.md`, both done, shadow-mode code green). Status
  stays Proposed rather than Accepted: the shadow-mode code shipping doesn't itself decide
  anything irreversible (`ELM_GATE_ENABLED` is still `false`), and this repo's ADRs read Accepted
  as a real sign-off checkpoint, not a rubber stamp once code exists.
- **Date:** 2026-08-31
- **Author:** Nala (Team Thomas)
- **Supersedes:** none. An earlier ELM-gate design for this same call site was built and evaluated
  on a different branch (`Thomas's_Branch`) that was never merged and does not exist in this
  fork's history — nothing here to formally supersede, but its findings are load-bearing evidence
  below, so they're cited as such rather than presented as fresh.
- **Backlog item:** `TT-N1`

## Context

`packages/sourcevision/src/analyzers/classify.ts` classifies every source file against a
17-archetype catalog (`archetypes.ts`) with a weighted algorithmic pass first
(`classifyFile`, [classify.ts:135](../../packages/sourcevision/src/analyzers/classify.ts#L135)).
Files that don't clear `PRIMARY_THRESHOLD = 0.4` are handed to Claude in batches of 30
(`enrichClassificationsWithLLM` →
[classify.ts:328](../../packages/sourcevision/src/analyzers/classify.ts#L328)), on every non-`--lite`
`ndx analyze`. That's a real, recurring token cost with no caching between runs beyond incremental
mode's unchanged-file reuse.

**Prior attempt, evidence carried forward.** Before this branch existed, I (Nala) built a
numeric-mode ELM gate ahead of that Claude call — trained on the same per-archetype evidence-score
vector `classifyFile` already computes, on the theory that unclassified files sit *just under*
the threshold and a classifier could learn to interpret that residual signal. Shipped in shadow
mode, typechecked, unit-tested clean. Run against n-dx's own real classification output
(423 classified / 260 unclassified at that time), it resolved **0 of 260** unclassified files —
every one of them carried a completely empty evidence array, not a weak one. An all-zero input
vector gives any classifier nothing to discriminate on (margins ~0.002, indistinguishable from
noise). This falsified the design assumption; the gate was never enabled. **That diagnostic script
was a scratchpad run, never committed** — so the 0/260 number is directional context for why this
ADR does not repeat the evidence-vector approach, not a reproducible figure per this repo's own
evidence bar (see Evidence, below). Nobody should treat "0/260" as re-verifiable without rerunning
the underlying analysis on that data.

**The working counter-example — corrected during this ADR's own writing.**
`scripts/elm-hello-world.mjs` was believed to show raw file-path *text* (not a precomputed
evidence vector) getting 83% accuracy through a text-mode ELM. Verifying it while building the
Evidence for this ADR found that belief is wrong: `ELM.train()`'s only parameter is
`augmentationOptions`, not a training set — passed the script's `TRAINING_SET` array, every
property it reads comes back `undefined`, so the call trains only on character-augmented variants
of the three category *label strings*, never on any path the script provides. Confirmed
empirically (three models — real training set, contradictory training set, no argument at all —
produced byte-identical weights and predictions). That script's 83% is not evidence the library
learns from labeled path examples.

The library does have an API that genuinely does this: `UniversalEncoder.encode()` feeding
`ELM.trainFromData(X, y)` (the same numeric-mode call the abandoned evidence-vector design used
correctly). Sanity-checked with a shuffled-label control (real labels 6/6, shuffled 3/6 = chance)
before trusting it, then run against n-dx's own real classification data — see Evidence below for
the actual number this produced, which is what this ADR's Decision now rests on, not the
`elm-hello-world.mjs` figure.

Thomas's call: the process validated well enough to proceed, with the plan changed to match what
actually worked — a text-mode-encoded ELM on path strings, not the evidence vector. That
direction held up once verified on real data with the corrected method (see Evidence).

## Decision

Build `packages/sourcevision/src/analyzers/classify-elm.ts` (new file, no naming collision on this
branch — it doesn't exist here) implementing a text-encoded ELM classifier:

- `UniversalEncoder` from `@astermind/astermind-community` (char set with `-` last, tokenizer
  delimiter on path separators, `maxLen` sized to the longest real path seen — 80 covers this
  run's 70-char max with headroom) encodes each path to a fixed-length numeric vector, fed to
  `core/ELM.ts`'s `trainFromData(X, y)` / `predictProbaFromVector`. **Not** `ELM.train()` /
  `useTokenizer: true` text mode — that call doesn't train on supplied examples at all (see
  Context and Evidence below); `scripts/classify-elm-eval.mjs` is the reference implementation.
- **Training data:** file paths already labeled by this run's algorithmic pass or by a past LLM
  pass (`FileClassification.source === "algorithmic" | "llm"`) — `path` → `archetype`. No new
  labeling work; this data already sits in `Classifications.files` on every run.
- **Prediction target:** the currently-unclassified population (`archetype === null`), which is
  exactly where the evidence-vector approach produced nothing.
- **Wiring:** same seam as before — inside `enrichClassificationsWithLLM`
  ([classify.ts:328](../../packages/sourcevision/src/analyzers/classify.ts#L328)), ahead of
  batching. Files the ELM labels with a confident top1/top2 margin skip the Claude batch entirely;
  everything else still goes to Claude exactly as today.
- **Shadow-mode-first, gated by a flag** (`ELM_GATE_ENABLED`, default `false`), same discipline as
  the earlier attempt: a wrong ELM label is silent (no LLM in the loop to catch it), so nothing
  skips the Claude call until an accuracy bar is met and documented.

**Validation method — resolving an open question from the earlier attempt.** The earlier design
assumed shadow-mode validation meant running `ndx analyze` against a live Claude and logging
agreement. That's not available in this environment (`claude` CLI absent, confirmed by that
same effort — `[classify] LLM CLI not found` on the first live batch attempted). Rather than
block on an unavailable dependency again, this ADR settles that open question: validate with
**k-fold cross-validation against the existing algorithmic/LLM-labeled data already in
`Classifications.files`**, using a committed script (see Evidence and the paired IMPL) that
reports accuracy against a real, repo-specific 17-way label distribution and a random baseline.
This needs no live Claude call and produces a stronger number than agreement-logging would anyway
— agreement-with-Claude only tells you the ELM matches Claude's (possibly also wrong) judgment,
not ground truth.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Numeric evidence-vector ELM (the earlier design) | Zero signal on the real unclassified population — every one of those files has an empty evidence array by construction (the algorithmic pass found *nothing*, not *something weak*). Confirmed directionally on n-dx's own output; not repeated here. |
| `FeatureCombinerELM` (evidence vector + hashed path tokens combined) | Adds a second input source and its combination surface before establishing whether path-text *alone* is sufficient. Real v2 path if text-only falls short of the accuracy bar — not worth the complexity up front. |
| Full replacement — delete the `callClaude` path in `classify.ts` immediately | No repo-scale accuracy number exists yet for text-mode ELM on this project's real 17-archetype label set (only a 3-category synthetic smoke test does). Removing the LLM safety net before that number exists risks silent misclassification with nothing to catch it — same reasoning that kept the earlier design in shadow mode. |
| `OnlineELM` (OS-ELM, incremental retraining) | Premature. Batch retrain via `trainFromData` is closed-form and cheap at this data scale (hundreds of files). Revisit only if retrain cost is shown to matter at much larger repo scale. |
| Live-Claude shadow agreement as the validation method | Not available in this dev environment (no `claude` CLI). Cross-validation against existing labels needs no live LLM and is methodologically stronger — see Decision. |

## Consequences

**Easier:** files with *zero* algorithmic evidence — the exact population the previous design
couldn't help — become classifiable without a Claude round trip, once the accuracy bar is met.
Training data requires no new work; it's the classification output the pipeline already produces.

**Harder:** a second data-dependent component enters the classification pipeline. It needs a
documented, reproducible accuracy bar (committed script, not a one-off run) before anyone trusts
it, and periodic re-validation whenever `archetypes.ts`'s catalog changes (17 archetypes today —
re-verify this count before implementation; it has changed before between checkouts).

**Breaks:** nothing while `ELM_GATE_ENABLED` stays `false` — shadow mode changes no output.
Flipping it on is the actual behavior change and needs explicit sign-off, not a quiet default flip.

**Now maintained:** the eval script becomes a standing gate check, in the same spirit as this
repo's existing gateway-admission rule (no gateway module merges without an integration test) —
no ELM gate flips on without a committed, re-runnable accuracy number backing it.

**Other teams affected:** none directly — `@astermind/astermind-community` is added to
`packages/sourcevision/package.json` only (not the root `package.json`, which is on
`OWNERSHIP.md`'s shared list; the sourcevision-level manifest is not). Per the two-consumer rule
this repo already applies to shared infrastructure, it stays package-scoped since sourcevision
is still the only consumer. Logged in `IN-FLIGHT.md` § Decisions & findings so Nolan's and
Jarrett's teams see it regardless.

## Evidence

**Required for any ELM-viability claim.**

- **Task framing:** input = file path string; label = one of 17 archetype IDs (`archetypes.ts`,
  re-counted on this branch: 17); multi-class, single-label.
- **What's committed and reproducible, on the real task, not a synthetic one:**
  `scripts/classify-elm-eval.mjs` — stratified 80/20 split of this run's 423 algorithmically- or
  LLM-labeled files (338 train / 85 held-out; the lone `config`-archetype example stays in
  training and isn't evaluable), text-encoded via `UniversalEncoder` and trained via
  `ELM.trainFromData`. **90.6% held-out accuracy (77/85)** vs. a 5.9% uniform baseline and a
  19.5% majority-class baseline (always predicting `utility`, the most common label). Full output
  committed at `scripts/classify-elm-eval-results.md`.
- **What this does not prove:** generalization to the actual deployment target — the 259 files
  the algorithmic pass currently leaves unclassified, which have no ground-truth label to test
  against by construction. The held-out set here is drawn from the *already-classifiable*
  population; several of its 8 misclassifications (barrel `index.ts` files, `types.ts`/`validate.ts`
  files) are plausibly the same kind of file that also stumps the algorithmic pass, which is
  reason for cautious optimism, not a measurement. This is exactly why the Decision keeps
  `ELM_GATE_ENABLED = false` through Phase 2 rather than treating 90.6% as license to skip Claude
  immediately.
- **`scripts/elm-hello-world.mjs`'s 83% figure is retracted as evidence** — see Context above.
  The earlier evidence-vector design's 0/260 figure remains directional-only (never a committed
  script) and isn't relied on here beyond motivating why that approach isn't repeated.
- **Seed:** `42`, a local `mulberry32` PRNG (not `Math.random()`) for the stratified shuffle —
  reproducible exactly, recorded in the eval script's header.
- **Random baselines for the real task:** both reported per the template's requirement — 5.9%
  uniform (1/17) and 19.5% majority-class (the harder, more honest bar). Acceptance bar was set
  *before* running the eval (IMPL step 4: 2x majority-class baseline, 60% floor = 60.0%, since
  2×19.5% < 60%) — 90.6% clears it by 30 points.

This ADR says "ELM works for this task, on the population it was measured against" — and is
explicit that the population it matters most for (currently-unclassified files) is still
unmeasured, which is a Phase 2/shadow-mode question, not a Phase 1 one.
