# ADR — Replace `classify.ts`'s LLM enrichment pass with a text-mode ELM

- **Status:** Proposed — Thomas has signed off on the direction; this ADR records the design so
  the rest of Team Thomas (and Nolan/Jarrett's teams, since this touches a shared dependency
  pattern) can see it before code lands.
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

**The working counter-example, which is committed:** `scripts/elm-hello-world.mjs` (present on
this branch, current HEAD) feeds raw file-path *text* — not a precomputed evidence vector — through
a text-mode ELM (`useTokenizer: true`, character-tokenized on path separators) and gets 83%
accuracy on held-out synthetic paths across 3 categories. Path text carries signal
(directory names, filenames, extensions) even for files whose algorithmic pass produced zero
evidence — exactly the population the evidence-vector design couldn't touch.

Thomas's call: the process validated well enough to proceed, with the plan changed to match what
actually worked — a text-mode ELM on path strings, not the evidence vector.

## Decision

Build `packages/sourcevision/src/analyzers/classify-elm.ts` (new file, no naming collision on this
branch — it doesn't exist here) implementing a **text-mode** ELM classifier:

- Base `core/ELM.ts` from `@astermind/astermind-community`, configured `useTokenizer: true`,
  mirroring the proven config in `scripts/elm-hello-world.mjs` (character set, tokenizer
  delimiter on path separators, fixed seed).
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

- **Task framing:** input = file path string; label = one of 17 archetype IDs
  (`archetypes.ts`, re-count at implementation time); multi-class, single-label.
- **What's already committed and reproducible:** `scripts/elm-hello-world.mjs` — 3-category
  synthetic path classification, seed `42`, 30 training / 6 held-out, **83% accuracy vs. a 33%
  random baseline** (3 categories). Proves the library trains and generalizes on path text under
  Node in this exact environment. **Does not** prove accuracy on the real 17-archetype task —
  different label count, different (real, not synthetic) path distribution.
- **What is not yet committed or reproducible:** the earlier 0/260 evidence-vector figure
  (directional only, per Context above) and any text-mode number on this project's real
  classification data — neither exists as a committed script on this branch. **Producing that
  script and that number is Phase 1 of the paired implementation plan, before any gate logic is
  written**, per this repo's own rule that an ELM-works claim needs a committed, re-runnable
  script and a stated random baseline.
- **Seed:** carry forward `42` (elm-hello-world's seed) for the real-data eval, for continuity;
  record whatever seed is actually used in the eval script's own header.
- **Random baseline for the real task:** 1/17 ≈ 5.9% (uniform) — report the *actual* class-frequency
  baseline too, since archetype distribution is not uniform in practice, and a frequency baseline
  is the harder bar to beat.

An ADR that says "ELM works for this" without this section is not accepted, and this one
explicitly doesn't say that yet for the real task — it says the prior approach is falsified, the
mechanism a validated smoke test proves out, and the real number is the next committed step.
