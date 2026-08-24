# IMPL — Prototype and evaluate a data-derived archetype taxonomy

- **Implements:** `ADR-2026-08-24-knight-elm-driven-archetype-taxonomy.md`
- **Owner:** Knight (Team Jarrett)
- **Backlog item:** `TJ-K2`
- **Branch:** `elm/jarrett/classify-elm-knight` (continuing the existing worktree,
  `../n-dx-knight` — this is a new investigation, not new isolation needs; the prior branch's
  `.sourcevision/` state and tooling are still relevant)
- **Worktree:** `../n-dx-knight`
- **Status:** Not started — this is the plan, written before any prototype code, per this session's
  established discipline (plan first, execute after).

## Scope

**In scope:**
- A committed clustering prototype script: extract feature vectors (both evidence-vector and
  ELM-embedding candidates) for n-dx's own files, cluster them, report cluster-quality metrics.
- Hand-inspection writeup comparing discovered clusters against `BUILTIN_ARCHETYPES`'s existing
  classification of the same files.
- A recommendation (not yet a decision) on whether the outcome supports "replace the catalog,"
  "augment specific archetypes," or "the hand-written catalog holds up, no change warranted" — all
  three are legitimate outcomes of this investigation, and the IMPL doesn't presuppose which.
- If the recommendation favors replacing or augmenting: a design sketch for the runtime mechanism
  (nearest-cluster-centroid assignment) `classifyFile` would need, and the cluster-ID-stability
  question flagged in the ADR's Consequences — sketch only, not implementation, in this IMPL.

**Explicitly out of scope for this IMPL:**
- Actually wiring a new taxonomy into `classify.ts`/`analyze-phases.ts` — gated on this
  investigation's outcome, same "measure before wiring" discipline as every prior ELM IMPL here.
- Re-litigating `TJ-A1`/`TJ-K1`/`TJ-A2`'s pre-filter work — superseded, not being revisited.
- Running this against every codebase the prior held-out testing used — n-dx alone first (it's the
  one with the richest existing classification data and the most-scrutinized hand-written
  taxonomy); a second codebase is a follow-up once the n-dx result says whether this is worth
  pursuing further at all.
- Solving cluster-ID stability across repeated `ndx analyze` runs — flagged as an open question,
  not solved here; matters only if this investigation recommends shipping something, which isn't
  known yet.

## Files touched

| Path | Owning team | New/Edit | Note sent? |
|---|---|---|---|
| `packages/sourcevision/scripts/cluster-archetypes.ts` (new) | unassigned — Team Jarrett scoped | New — clustering prototype (k-means over both feature-vector candidates) | No |
| A hand-inspection writeup (likely `Knight.md`'s session log, not a separate file — this is analysis, not code) | Team Jarrett | New | No |
| `classify.ts`, `analyze-phases.ts`, `archetypes.ts`, schema files | unassigned — Team Jarrett scoped | **Not touched** — gated on this investigation's outcome | No |

## Steps

1. **Reuse, don't rebuild, the feature extraction.** `extractNumericExamples()`-equivalent logic
   (from `TJ-A1`/`TJ-K1`) already computes the evidence vector per file via
   `analyzeClassifications()`. For the ELM-embedding candidate: train a base ELM on the *existing*
   17-archetype labels first (fast, already proven to work), then use `getEmbedding()` on the
   trained model to get each file's hidden-layer representation as the second feature space.
2. **Implement k-means from scratch** (no primitive exists in `@astermind/astermind-community`,
   confirmed in the ADR's Context) — standard Lloyd's-algorithm k-means: random or k-means++
   centroid init (seeded), assign-to-nearest-centroid, recompute centroids, repeat to convergence
   or a max-iteration cap. Small, well-understood, testable in isolation.
3. **Run against n-dx's own files, both feature spaces, a small sweep of k** (e.g., k=10, 17, 25 —
   bracketing the existing catalog's size) rather than committing to one k in advance, per the
   ADR's Evidence section.
4. **Compute cluster-quality metrics** (silhouette score at minimum — inertia alone doesn't
   penalize degenerate solutions) for each (feature space, k) combination, to narrow down which
   combination is worth hand-inspecting in depth rather than inspecting all of them equally.
5. **Hand-inspect the most promising combination's clusters.** For each cluster: list representative
   file paths, note what (if anything) unifies them structurally, and explicitly compare against
   what `BUILTIN_ARCHETYPES` currently calls those same files. Write this up plainly — this is the
   step the ADR's Decision section calls "qualitative first," and it's where the real verdict comes
   from, not from step 4's numbers alone.
6. **Write the recommendation** (replace / augment / no change) with the reasoning from step 5, and
   — only if replace or augment — sketch (not build) the nearest-centroid runtime mechanism and
   flag the cluster-ID-stability question explicitly rather than silently deciding it.
7. Report back and update `ADR-2026-08-24-knight-...`'s Evidence section with the real numbers and
   the qualitative writeup, regardless of which of the three outcomes it turns out to be — a
   "the hand-written catalog holds up" result gets the same rigor as a positive replacement result,
   per this project's own standing doctrine on negative results.

## Test strategy

Prototype/investigation phase — no production code changes, so no unit/integration tests against
production surfaces yet. The one thing worth testing directly: the k-means implementation itself
(deterministic given a fixed seed; converges on a small synthetic fixture with obviously-separable
clusters, as a sanity check that the algorithm is correct before trusting it on real file data).

## Rollback

N/A — no production code touched. The prototype script is inert (not imported by any production
path).

## Open questions

- [ ] **Cluster-ID stability across `ndx analyze` runs** — flagged in the ADR's Consequences,
      not solved here. Matters only if this investigation recommends shipping a data-derived
      taxonomy; deferred until that recommendation exists.
- [ ] **If the recommendation is "augment," which specific archetypes** — a full-catalog replacement
      and a few targeted additions are very different scopes of follow-up work. Not knowable before
      step 5's hand-inspection.
- [ ] **Does the model-lifecycle design from `IMPL-2026-08-23-jarrett-...`** (train-fresh vs.
      bundled-baseline vs. hybrid) apply the same way to a clustering model as it did to the
      classification model it was designed for? Likely yes in shape, not yet confirmed.
- [ ] **Should this run against a second codebase before the recommendation is trusted** — the ADR
      scopes this investigation to n-dx alone first; whether that's sufficient evidence for a
      recommendation or needs the same held-out-codebase discipline the classification work used is
      an open call, probably answered once step 5's results are in hand rather than decided now.
