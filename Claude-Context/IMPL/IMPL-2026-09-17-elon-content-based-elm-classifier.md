# IMPL — Content-based feature representation for `classify-ELM.ts`

- **Implements:** `ADR-2026-09-17-elon-content-based-elm-classifier.md`
- **Owner:** Elon (Team Jarrett)
- **Backlog item:** `TJ-E1`
- **Branch:** `elm/jarrett/classify-elm-content`
- **Worktree:** `../n-dx-elon`
- **Status:** Not started (plan written 2026-09-17, no code yet)

## Scope

**In scope:** the body of `classify-elm.ts` behind `runELMGate()` — feature extraction (name,
extension, content), training-example extraction, the seeded eval, the confidence-gate
calibration, and tests. Absorbing `TJ-R2`'s encoder as the measured baseline.

**Out of scope (explicitly):**

- `classify.ts`'s gate/routing (`runClassificationGate`) — `TJ-R3`, shipped. `runELMGate`'s
  signature does not change.
- `classify-llm.ts` — not this box.
- `BUILTIN_ARCHETYPES` — `TJ-A3` (Knight). This classifies against whatever catalog is live.
- The algorithmic pass (`classifyFile`) and `PRIMARY_THRESHOLD`.
- **The `OnlineELM` retrain loop** — phase 2, gated on the representation clearing first (ADR
  Decision point 8). Deliberately not in this plan's steps.
- Flipping `elmPrefilter.enabled` to `true` by default — that needs a cleared gate *and* the
  user's call, and is Step 13, not an assumption baked into earlier steps.

## Files touched

| Path | Owning team | New/Edit | Note sent? |
|---|---|---|---|
| `packages/sourcevision/src/analyzers/classify-elm.ts` | Jarrett (this agent, per `TJ-R3`) | Edit | n/a — own module |
| `packages/sourcevision/src/analyzers/classify-elm-features.ts` | Jarrett | **New** — feature extraction, kept separate so the eval and tests can import it without dragging in the model lifecycle | n/a |
| `packages/sourcevision/scripts/eval-classify-elm-content.ts` | Jarrett | **New** — the committed seeded eval | n/a |
| `packages/sourcevision/tests/unit/analyzers/classify-elm-features.test.ts` | Jarrett | **New** | n/a |
| `packages/sourcevision/tests/unit/analyzers/classify-elm.test.ts` | Jarrett | Edit — extend, do not rewrite | n/a |
| `packages/sourcevision/src/analyzers/classify-elm-baseline-model.json` | Jarrett | Edit — retrained once representation is settled | n/a |

**No shared files.** No `package.json`/`pnpm-lock.yaml` change —
`@astermind/astermind-community` is already declared. No `.n-dx.json` schema change: the existing
`sourcevision.classification.elmPrefilter.{enabled,confidenceThreshold}` keys are reused. **No
cross-team note required** — the `TJ-R3` split is exactly what makes this a Team-Jarrett-internal
change; see ADR Consequences.

## Steps

Order matters throughout: **every step before 8 is deliberately measurement-free.** The one failure
mode this project has repeated four times is measuring the wrong population, so the population is
constructed and asserted (Step 5) before any model is trained against it.

1. **Absorb `TJ-R2`'s Step 4 work.** Port `extractPathExportExamples`/`pathExportVector`,
   `PATH_EXPORT_CHARSET`/`PATH_EXPORT_MAX_LEN`, and their 10 unit tests from `ae9dc463`
   (`../n-dx-jarrett`) onto this branch, unchanged. This is the baseline the content representation
   must beat — it is not dead code and is not to be "cleaned up" later without a replacement
   baseline. Record the provenance commit in a code comment.

2. **Write `classify-elm-features.ts` — name/extension block.** Extension one-hot over extensions
   actually present in the inventory, path depth, directory-segment tokens, filename tokens (split
   on `/`, `.`, `-`, `_`, and camelCase boundaries). Pure function of a path string: trivially
   testable, no I/O.

3. **Add the content-token block (feature hashing).** Tokenize to identifiers and keywords, hash
   each into a fixed bucket count, log-TF weight, L2-normalize. Bucket count is a named constant
   and an ablation parameter, not a magic number. **Length-independent by construction** — this is
   the property that makes "the full file" tractable (ADR Decision point 3).

4. **Add the structural-counts block.** Import count, export count, JSX presence, default export,
   `describe(`/`it(` presence, class vs. function declarations, route/handler shapes. Cheap
   regex/substring work, no parser. Each count gets its own test — these are the interpretable
   features, so a wrong one is worth catching individually.

   **File reading lands here**, with the failure modes handled up front rather than discovered in
   the eval: per-file read cap, unreadable/missing file → metadata-only degradation (never throw),
   binary detection → skip the content blocks. Only the unclassified population is read (166 files
   on n-dx, not 683).

5. **Build the zero-evidence corpus — and assert it.** Extract, per corpus, the files with an
   all-zero evidence vector; label whatever is unlabeled through the real pipeline (`claude` is on
   PATH, `ANTHROPIC_API_KEY` is set — no hand-labeling stand-in needed). **The eval asserts every
   input file has an all-zero evidence vector and fails loudly otherwise.** This assertion is the
   single most important line in the plan: it is the check whose absence invalidated four prior
   results.

6. **Write `eval-classify-elm-content.ts`.** Fixed recorded seed, seeded Fisher-Yates split,
   in-domain (n-dx) and out-of-domain (`AsterMind-Community-Edition`) runs, **both** baselines from
   the ADR (majority-class and `TJ-R2` path+export on the identical split), precision/coverage
   curves for **both** gate shapes (absolute confidence and top1/top2 margin), and a coverage floor
   so one lucky resolution cannot read as a pass.

7. **Calibrate the sweep range before trusting a zero.** Print the actual confidence distribution
   first. Three separate agents on this project have swept a threshold range that was entirely
   above the observed distribution and read the resulting 0% coverage as "the model is broken."
   Cheap insurance against doing it a fourth time.

8. **Run the ablation.** Name/extension only · +content · +structural · content only ·
   `TJ-R2` path+export baseline. This is what distinguishes "content helps" from "content is
   assumed to help." Report every number with its seed and both baselines.

9. **Decide the gate shape and number from the curve** — then take it to the user, who has
   explicitly not picked one. Report what each candidate costs in coverage rather than presenting a
   single number.

10. **Wire the chosen representation into `runELMGate`.** Signature unchanged. Keep the all-zero
    guard. Add a representation-version field to the model artifact so a model trained on one block
    layout can never be silently loaded against another (ADR Consequences).

11. **Retrain the bundled baseline model** on the pooled corpora under the chosen representation,
    and record its training set and seed alongside it.

12. **Tests** — see strategy below.

13. **Update ADR Status, this IMPL, the charter, and `BACKLOG.md`.** Only after Step 8 produces
    real numbers. Whether `elmPrefilter.enabled` flips to `true` is a separate decision for the
    user at this point, not an automatic consequence of a cleared gate.

## Test strategy

- **Unit (`classify-elm-features.test.ts`):** each block independently. Tokenization on real awkward
  paths. Feature hashing determinism (same input → identical vector, across process restarts —
  otherwise a persisted model is worthless). Length independence asserted directly: a 10-line and a
  3,000-line file produce equal-width vectors. Each structural count individually. Degradation
  paths: missing file, unreadable file, binary file, empty file — each returns a usable vector and
  does not throw.
- **Unit (`classify-elm.test.ts`, extended):** the existing 22 tests must stay green — the model
  lifecycle is unchanged by this work, so a failure there means I broke something out of scope.
  Add: the all-zero guard still holds for a file with genuinely no extractable signal.
- **The test that must fail on the old code, per doctrine:** the direct contrast test — a real
  zero-evidence file produces an all-zero vector under `extractNumericExamples` and a **non-zero**
  vector under the content representation. Archer wrote this shape for `TJ-R2`; it carries over and
  gets extended to content. **I will revert the feature extractor and watch it go red before
  claiming it passes.** A green test nobody has seen fail is indistinguishable from no test.
- **Integration:** `elm-prefilter-wiring.test.ts` stays green unchanged — `runELMGate`'s signature
  does not move, and if that file needs editing, I have exceeded this plan's scope.
- **Must stay green:** `pnpm typecheck`, `pnpm test`, `tests/e2e/domain-isolation.test.js`,
  `tests/e2e/architecture-policy.test.js`. Note `architecture-policy.test.js` has a
  `KNOWN_VIOLATIONS` entry pointing at `classify-llm.ts` — untouched here.
- **Known pre-existing failures, not mine:** root `pnpm test` has 4 (`cli-stale-check.test.js` ×2,
  `published-assets-bundled.test.js` ×2) per `7ecf69f3`. **I have not independently re-verified
  these yet** — to be confirmed on the unmodified branch before any of my own results are reported,
  so I never attribute someone else's red to my change or hide my own behind theirs.

## Rollback

Revert the commit. `classify-elm.ts` is a leaf module behind a stable interface — `runELMGate`'s
signature does not change, so nothing upstream needs coordinated reverting.

**Revert is not sufficient for two things:**

1. **The bundled baseline model artifact** (`classify-elm-baseline-model.json`) is a build output
   committed to the repo. Reverting the code without reverting the artifact leaves a model trained
   on the new representation being loaded by code expecting the old one. The representation-version
   field (Step 10) turns that into a loud failure instead of silent garbage — **but the artifact
   must be reverted in the same commit.**
2. **`.sourcevision/` output written during eval runs** is not covered by a code revert. It lives in
   my worktree, so blast radius is contained, but any classification data generated under an
   abandoned representation should be regenerated rather than reused as training input.

Kill switch meanwhile: `sourcevision.classification.elmPrefilter.enabled` is already `false` by
default and stays that way until Step 13.

## Open questions

- **What is the right bucket count for the content block?** An ablation parameter (Step 8), not a
  guess. Too few collides unrelated identifiers; too many makes the vector sparse against ~500
  training examples.
- **Does content actually beat path+export on the zero-evidence population?** The whole point of
  Step 8. It is a real possibility that it does not — that is a publishable finding under this
  project's "a negative result gets the same rigor" doctrine, not a failure to bury.
- **Is `AsterMind-Community-Edition` still the right out-of-domain set?** It has the highest
  unclassified rate (40.0%) and continuity with `TJ-A1`/`TJ-K1`, but it is an ML library and n-dx
  is dev-tooling — the two may be jointly unrepresentative. `express`/`indie-stack`/`zustand` are
  on disk as alternates.
- **Interaction with `TJ-A3` (Knight).** Knight is actively changing `BUILTIN_ARCHETYPES`, which
  changes both the label set and the zero-evidence population. **This does not block Step 1-4**
  (the extractor is catalog-independent), but any number from Steps 6-8 is measured against the
  catalog live at that moment and must be re-verified if the catalog moves. Flag to Knight before
  Step 6 rather than after — the same soft-gate arrangement Archer and Knight already ran for
  `TJ-R2`, and it worked.
- **For the user, at Step 9:** absolute confidence or top1/top2 margin, and at what number? Not
  answerable before the curve exists. The diagram's ">80%" is illustrative — see ADR Decision
  point 7 for why it cannot be a raw softmax threshold here.
