# NOTE — knight → archer & realm — 2026-08-24 — URGENT: hard pivot away from the ELM pre-filter

**Needs a reply by:** Archer — before doing any more `TJ-A2` wiring work; this is time-sensitive
**Blocking:** `TJ-A2` — the user's direction below changes what "done" means for this whole
initiative, not just a detail of the current plan

## What

The user just gave a direct instruction: **stop building the ELM pre-filter as a narrow addition
to `classify.ts`'s existing two-pass pipeline.** This is a hard pivot, not a refinement —
`ADR-2026-08-11-jarrett-elm-prefilter-classify.md`/`ADR-2026-08-12-knight-elm-prefilter-classify.md`
and `IMPL-2026-08-23-jarrett-classify-elm-production-hardening.md` are all being superseded, not
amended.

**The new direction, per the user's explicit clarification:** this isn't about making the ELM a
bigger part of the existing classification mechanism — it's about **replacing the archetype
taxonomy itself**. `BUILTIN_ARCHETYPES` (the 17 hand-written categories in `archetypes.ts`) is the
thing being reconsidered, not just how files get sorted into it. The direction is to use the ELM's
learned structure (or a clustering approach over its embeddings) to derive categories from the
actual codebase, rather than classifying files into a fixed, hand-curated catalog.

I'm writing my own new ADR/IMPL for this now (superseding my 2026-08-12 docs) and will share it
here once drafted. This note exists so you don't spend more time on `TJ-A2`'s wiring before seeing
it — the user was explicit that this redirects the whole initiative, not just my track.

## Why it matters to you

**You are actively mid-flight on exactly the work this pivot abandons.** As of your last commits
(`ab9a4aa4`, `5f8d540d`), you'd just resolved the pooling question and reconciled with my
production-wiring plan — real, good work, done fast and well. None of the *research* is wasted
(the numeric-feature-vector finding, the evidence-vector construction, the confidence-calibration
data, the fresh-`analyzeClassifications()`-reuse pattern — all of that is almost certainly still
relevant input to whatever the new taxonomy-discovery approach needs). What's being abandoned is
the specific target shape: a pre-filter stage narrowing `enrichClassificationsWithLLM`'s input
inside the existing two-pass pipeline, wired via `runClassificationsPhase`, gated on clearing a
precision/coverage bar against the *existing* 17-archetype labels.

If the new taxonomy is genuinely different from `BUILTIN_ARCHETYPES`, the labels you've been
training and evaluating against change too — held-out precision measured against the old catalog
doesn't directly transfer to a decision about a new one.

## What I need back

1. **Stop before wiring anything into `runClassificationsPhase`** under the current plan — that
   step (`TJ-A2` step 6) targets the pipeline this pivot is replacing.
2. Once my new ADR/IMPL lands here, a read from you on whether the reusable pieces (numeric
   feature vectors, `analyzeClassifications()`-reuse, the model-lifecycle options table from your
   `IMPL-2026-08-23-...`) carry forward as-is, or need rethinking for a taxonomy-discovery target
   rather than a fixed-catalog classification target.
3. Realm: given the coordination role, flagging so `BACKLOG.md`'s `TJ-A1`/`TJ-A2` rows and
   `IN-FLIGHT.md` reflect this before the next session picks either up assuming the old target.
