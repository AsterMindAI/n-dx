# ADR — Derive the file-archetype taxonomy from the codebase instead of classifying into a fixed catalog

- **Status:** Proposed — this is a direction change, not yet a measured result. Nothing below has
  been prototyped; this document exists to scope the pivot before code gets written against it.
- **Date:** 2026-08-24
- **Author:** Knight (Team Jarrett)
- **Supersedes:** `ADR-2026-08-11-jarrett-elm-prefilter-classify.md` (Archer),
  `ADR-2026-08-12-knight-elm-prefilter-classify.md` (Knight), and — transitively, since it targets
  the pipeline those propose extending — `IMPL-2026-08-23-jarrett-classify-elm-production-hardening.md`.
  None of those were wrong; they proved the ELM approach works well enough to clear a real
  precision/coverage gate. This document changes *what problem* the ELM work is aimed at.
- **Backlog item:** `TJ-K2` (new — this is a different shape of work from `TJ-K1`/`TJ-A1`/`TJ-A2`,
  not a continuation of them)

## Context

**What the prior work established (not being discarded):** `TJ-A1`/`TJ-K1`/`TJ-A2` proved that a
base ELM, fed a numeric per-archetype evidence vector derived from `classifyFile`'s own signal
scoring, classifies files into the existing 17-archetype catalog (`BUILTIN_ARCHETYPES`) well enough
to clear a 95%-precision gate at meaningful coverage on a genuinely held-out codebase (Archer:
100%@59.0%; Knight, independently: 97.0%@42.3%, later 100%@30.8%). Two independent implementations
converged on the same finding and the same failure modes (text-mode tokenizer breakage, diffuse
softmax confidence, evidence-field schema gaps). That work is real and directly reusable — see
"What carries forward," below.

**Why the target is changing anyway:** the user's direction, given directly, is to stop treating
the ELM as an optimization *inside* the existing two-pass pipeline (algorithmic regex pass → LLM
fallback, with the ELM narrowing what reaches the LLM) and instead use it to **replace the
archetype taxonomy itself** — `BUILTIN_ARCHETYPES`, the 17 hand-written categories in
`archetypes.ts`, is the thing being reconsidered, not just the mechanism that assigns files to it.

**What this means concretely, and what it doesn't:** the prior work answers "can an ELM predict
which of 17 hand-written labels a file belongs to?" (yes, well). It does not answer "are those 17
labels the right ones?" — that catalog was hand-written (`archetypes.ts`'s own docstring: it
"consolidates hard-coded patterns previously scattered across" three other files) and has never
been validated against what categories actually exist in real codebases. The pivot is to derive
categories from data — clustering files by their actual structural/behavioral similarity — rather
than assuming the hand-written list is complete or correctly grained.

**Checked before proposing an approach, not assumed:** surveyed `@astermind/astermind-community`
for clustering primitives (`src/ml/` has `KNN.ts` and `TFIDF.ts` only; `src/elm/`, `src/pro/`,
`src/synth/` are all supervised-ELM-variant or generation/retrieval tooling). **There is no
unsupervised clustering algorithm anywhere in the package.** Every ELM variant (base, Deep, Kernel,
Online, and the ~15 more exotic variants under `src/elm/`) is a supervised learner — it needs
labels to train against. Deriving new labels from unlabeled structure is not something this library
does out of the box; it would need to be built from primitives (ELM's own hidden-layer embeddings,
or `TFIDF.ts`'s vectorization, as clustering *input*) plus a clustering algorithm this repo doesn't
currently have.

**Checked the blast radius before scoping the migration, not assumed:** grepped every consumer of
`BUILTIN_ARCHETYPES`/`analysisHints`/`.archetype` across the monorepo. Good news, found by reading
the actual code: `callgraph-findings.ts` (the main downstream consumer — hub/hotspot/god-function
threshold adjustments) is **already taxonomy-agnostic by design** — it filters
`BUILTIN_ARCHETYPES` at runtime by which archetypes *carry* a given `analysisHints` field
(`hubThresholdMultiplier`, `hotspotThresholdMultiplier`, `godFunctionThresholdMultiplier`,
`deadExports`), rather than hardcoding archetype IDs (its own comment: "no hardcoded archetype
names needed"). Whatever the new taxonomy turns out to be, this consumer adapts automatically *as
long as the new archetype definitions carry equivalent hint metadata*. The remaining consumers
(`schema/v1.ts`, `schema/validate.ts`, `cli/mcp.ts`, and the archetype/classify test suites) are
schema/validation/API surface, not behavioral logic hardcoded to specific IDs. This is a real,
checked finding, not an assumption — the migration is schema-shaped, not a rewrite of every
consumer.

## Decision

**Prototype a clustering pipeline over file-level feature vectors, evaluate whether it produces a
more accurate/complete taxonomy than the hand-written catalog, and only then decide whether it
replaces `BUILTIN_ARCHETYPES` outright or augments it.** Concretely, in order:

1. **Feature representation:** reuse the numeric evidence vector already proven in `TJ-A1`/`TJ-K1`
   (`classifyFile`'s per-archetype score, computed via `analyzeClassifications()`) as one candidate
   input space, and the base ELM's own hidden-layer embedding (`getEmbedding()`/
   `computeHiddenLayer()` — already exposed on the `ELM` class, unused by any prior work here) as a
   second candidate. These answer different questions: the evidence vector clusters files by
   similarity *in terms of the existing hand-written signals*; the ELM embedding clusters by
   whatever structure a model trained on the existing labels actually learned. Comparing the two is
   itself informative about whether the hand-written signals are the right features at all.
2. **Clustering algorithm — has to be built, not imported** (per the Context finding above): a
   from-scratch k-means (simplest, well-understood, cheap on this data scale — hundreds to low
   thousands of files) is the proposed starting point. Not deciding on a fancier algorithm
   (hierarchical, DBSCAN) until k-means is shown to be insufficient — same "start simple, escalate
   on evidence" discipline the original ELM ADR applied to model complexity.
3. **Evaluation is qualitative first, quantitative second** — this is a real methodological
   difference from the prior work, not an oversight. Precision/coverage against a held-out label
   set was the right metric when the task was "predict an existing label." There is no ground truth
   for "is this a good *new* label" — cluster-quality metrics (silhouette score, inertia) measure
   mathematical separability, not whether a human would recognize a cluster as a meaningful
   architectural concept. The plan is: cluster n-dx's own files, hand-inspect what each cluster
   actually contains, and judge whether it reads as a coherent archetype before trusting any
   number. Quantitative cluster-quality metrics are collected alongside, not instead.
4. **Compare against, don't discard, the hand-written catalog.** Cluster the same files against
   `BUILTIN_ARCHETYPES`'s existing 17 labels first as a baseline read (are clusters recovering
   roughly the same groupings, finding subdivisions within existing archetypes, or finding
   structure the catalog misses entirely?). This determines whether the outcome is "replace the
   catalog" or "the catalog was fine, augment it in specific places" — not decided in advance.

**What carries forward from `TJ-A1`/`TJ-K1`/`TJ-A2` unchanged:** the numeric evidence-vector
construction (`extractNumericExamples`/`analyzeClassifications()`-reuse pattern), the
confidence-calibration findings (diffuse softmax, needs empirical threshold discovery rather than
assumed defaults), the `TextEncoder.ts` tokenizer-breakage finding (still true, still means "don't
use text mode for anything"), and the model-lifecycle design work from `IMPL-2026-08-23-jarrett-...`
(training-on-demand vs. bundled-baseline tradeoffs apply just as much to a clustering model as a
classification one). **What does not carry forward as-is:** the precision/coverage gate itself (no
fixed label set to measure precision against once the labels themselves are what's being derived),
and the `runClassificationsPhase` wiring point (a pre-filter narrowing an LLM call is a different
shape of integration than a taxonomy that replaces what `classifyFile` outputs in the first place).

## Alternatives considered

| Option | Why not (yet) |
|---|---|
| Keep the narrow pre-filter (`TJ-A2`'s in-flight plan) | This is explicitly the direction being moved away from, per the user's instruction — not a technical rejection of that work, which was sound for the problem it targeted. |
| Fully unsupervised discovery, discard `BUILTIN_ARCHETYPES` entirely from day one | Throws away real domain knowledge encoded in `analysisHints` (dead-export suppression for entry points, fan-in thresholds for utilities) without evidence the discovered clusters would reproduce it. The Decision's step 4 (compare against the existing catalog) exists specifically to avoid this failure mode. |
| Use an external clustering library instead of hand-rolling k-means | Would introduce a second ML dependency alongside `@astermind/astermind-community` for a well-understood, cheap-to-implement algorithm at this data scale. Revisit only if k-means proves insufficient. |
| Semi-supervised (keep existing labels, let the model propose *new* labels only for files that fit poorly) | A reasonable middle ground, genuinely considered — but requires a "how poorly is poorly" threshold decision that's premature before step 4's comparison exists. Likely where this lands in practice; not assumed as the starting design. |

## Consequences

**Easier than initially feared:** the taxonomy-agnostic design of `callgraph-findings.ts` means the
main behavioral consumer of archetype data doesn't need a rewrite — it needs the new archetype
definitions to carry the same `analysisHints` shape, which is a data-migration concern, not a
logic-rewrite one.

**Harder:** `classifyFile`'s regex/pattern-signal matching (`classify.ts:135-208`) is fundamentally
a "does this file match a known pattern" mechanism — it doesn't have an equivalent for "which
data-derived cluster does this file belong to," which needs a different runtime mechanism (nearest
cluster centroid in feature space, most likely) if a discovered taxonomy is adopted for production
classification, not just as a one-time analysis. This is new design surface, not a variant of
existing code.

**What breaks if this ships without care:** any external consumer (the web dashboard, `.n-dx.json`
`archetypes.overrides`, MCP's `set_file_archetype`) that assumes archetype IDs are stable across
`ndx analyze` runs — a from-scratch re-cluster on every run could relabel/renumber clusters
differently each time even if the underlying groupings are similar, which would be a regression
versus the current deterministic, pattern-based IDs. Cluster-ID stability across runs is an open
question below, not yet solved.

**Which teams are affected:** none outside Team Jarrett as currently scoped, same as prior ELM
work. Archer and Realm notified directly (`Notes/NOTE-knight-to-archer-and-realm-2026-08-24-hard-pivot-away-from-elm-prefilter.md`)
before this document existed, specifically because `TJ-A2` was actively wiring toward the
now-superseded target when the pivot was decided.

## Evidence

**Not yet measured — this is a proposed methodology, same discipline as the original ELM ADR's
first Evidence section.** No clustering-quality claim is being made yet.

- **Task framing:** input = a to-be-decided feature vector per file (evidence-vector or
  ELM-embedding candidate, see Decision step 1); output = a cluster assignment, not a fixed label.
- **Corpus:** n-dx itself first (largest, most-understood codebase available), compared against
  `BUILTIN_ARCHETYPES`'s existing classification of the same files as a baseline read.
- **Seed:** k-means' centroid initialization needs a fixed seed, same discipline as every prior ELM
  measurement in this project — not yet chosen, will be recorded in the committed prototype script.
- **Cluster count (k):** not yet decided — options are fixing k near the existing 17-archetype count
  for a direct comparison, or letting an elbow-method/silhouette sweep suggest k independently and
  seeing how far it lands from 17. Both should be tried; picking one in advance would bias the
  comparison in Decision step 4.
- **Evaluation:** cluster-quality metrics (silhouette score, inertia) reported for context, but the
  actual verdict is qualitative — hand-inspecting representative files per cluster. This asymmetry
  (numbers for context, human judgment for the actual call) is a deliberate departure from the
  precision/coverage-gate discipline of the prior ADRs, justified in the Decision section above.
- **Committed script:** path TBD in the linked IMPL's Files-touched table — not a one-off notebook
  run once and discarded, same standing rule as every prior measurement here.
