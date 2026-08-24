# ADR — Add an ELM pre-filter stage before classify.ts's LLM fallback (Knight's independent verification)

- **Status:** **Superseded 2026-08-24 by `ADR-2026-08-24-knight-elm-driven-archetype-taxonomy.md`.**
  Per the user's explicit hard-pivot instruction: the ELM pre-filter approach documented here (and
  in `ADR-2026-08-11-jarrett-...`) worked — the gate cleared, twice, independently — but the target
  changed. The new direction uses the ELM to derive the archetype taxonomy itself, not to classify
  files into the existing hand-written one this document's gate was measured against. The
  precision/coverage results below remain true and are cited as reusable evidence in the superseding
  document; they no longer represent a plan anyone is executing toward.
- **Date:** 2026-08-12
- **Author:** Knight (Team Jarrett)
- **Supersedes:** none. Same architectural decision as
  [`ADR-2026-08-11-jarrett-elm-prefilter-classify.md`](ADR-2026-08-11-jarrett-elm-prefilter-classify.md)
  (Archer) — built independently, without reading Archer's `classify-elm.ts`/`eval-classify-elm.ts`
  source, per the user's explicit request for a genuine comparison rather than a single unverified
  attempt. This document does not restate Archer's Context/Decision reasoning; it cross-references
  that ADR and focuses on what changed between "planned methodology" and "measured reality."
- **Backlog item:** `TJ-K1`

## Context

Same call site, same cost problem as Archer's ADR: `enrichClassificationsWithLLM`
(`classify.ts:328-481`), gated on `!ctx.fastMode && totalUnclassified > 0`
(`analyze-phases.ts:218-221`). See `ADR-2026-08-11-jarrett-elm-prefilter-classify.md` for the full
site analysis — independently re-verified by reading `classify.ts` directly on 2026-08-12; findings
match Archer's exactly (batch size 30, fused label+reason call, confidence hardcoded to `0.7`,
`reason`-derived evidence only present when the LLM supplies one).

This document exists specifically to capture what an independent build found, separate from what
was planned. It is a companion to, not a replacement for, Archer's ADR.

## Decision

Same as Archer's: insert a base `ELM` (text mode) classifier between `analyzeClassifications` and
`enrichClassificationsWithLLM`, resolving only files above a calibrated confidence threshold,
falling through to the LLM otherwise. Not re-litigated here — see the linked ADR's Decision section.

**Two corrections to the stated training-data plan, found during implementation, not during
design:**

1. Training data cannot actually include `source: "llm"` files' *algorithmic* evidence the way the
   plan described — `classifications.json` only persists each file's FINAL resolved archetype, and
   `mergeClassificationResults` overwrites the pre-LLM evidence signals for any file the LLM stage
   relabels. Worked around by re-running the free, deterministic `analyzeClassifications` against
   the same `inventory.json`/`imports.json` that produced `classifications.json`, then pairing its
   freshly-computed evidence with the FINAL label — see the linked IMPL for the code
   (`extractExamples()` in `classify-elm.ts`).
2. `ELM.train()` cannot be used for this at all — confirmed **empirically**, not just by reading
   source: `elm.train(realExamples)` and `elm.train()` produce byte-identical models (same `W`,
   `beta`, same predictions), because `train()`'s first parameter is `augmentationOptions`, not a
   data array. `trainFromData()` with manually-encoded vectors is the only path that actually trains
   on supplied examples.

## Alternatives considered

Same table as Archer's ADR — not re-litigated. See
`ADR-2026-08-11-jarrett-elm-prefilter-classify.md` § Alternatives considered.

## Consequences

Unchanged from Archer's ADR in kind, with one addition surfaced by measurement:

**Harder, newly evidenced:** the training-data population available today (algorithmic-only
classifications — no LLM-labeled examples exist in either the training or held-out dataset, see
Evidence) is not representative of the population the pre-filter needs to handle in production. The
"easy" files an algorithmic pass already resolves for free are, definitionally, not the files
costing LLM tokens today. This shows up directly below as a measured generalization gap, not a
theoretical concern.

## Evidence

**Measured, not planned, across two dated runs — kept both rather than overwriting the first,
because the contrast between them is itself the finding.** Training source: n-dx's own
`.sourcevision/` classification data (reused from Archer's `../n-dx-jarrett` worktree rather than
regenerated — same repo content, and reuse removes classification-run noise as a variable between
the two independent attempts). Held-out source: `AsterMind-Community-Edition`'s `.sourcevision/`
data (likewise reused, same reasoning).

### First measurement (2026-08-12, algorithmic-only data)

- **Task framing:** file path + up to 3 algorithmic evidence hints
  (`archetypeId(weight)`) as encoder input text, one of the observed archetype labels as output.
- **Data quality caveat, found 2026-08-12:** both datasets were generated by `ndx analyze` runs that
  never reached the LLM stage — `bySource` is 100% `"algorithmic"` in both (423/683 n-dx files
  usable, spanning 11 of 17 archetypes; 47/130 `AsterMind-Community-Edition` files usable, spanning
  6 archetypes). Whether this was `--fast`/`--lite` mode or an early LLM-auth break wasn't
  determined — worth checking before any re-run.
- **Seed:** `20260812`, fixed, in the committed script.
- **Committed script:** `packages/sourcevision/scripts/eval-classify-elm.ts` on branch
  `elm/jarrett/classify-elm-knight` (Knight's independent implementation — not Archer's script of
  the same purpose, which lives at the same relative path on a different, unmerged branch,
  `elm/jarrett/classify-elm-prefilter`).
- **In-domain result** (85-example seeded held-out split of n-dx's own data, Fisher-Yates, seed
  `20260812`): **98.1% precision at 62.4% coverage** (threshold 0.18); 95.7% precision at 82.4%
  coverage (threshold 0.15). Majority-class baseline: 23.5% ("utility").
- **Out-of-domain result — the number that actually matters for the acceptance gate** (47-example
  `AsterMind-Community-Edition` held-out set, model trained on all 423 n-dx examples): **does not
  clear the ≥95% precision bar in any practically useful sense.** Best point with meaningful
  coverage: 62.5% precision at 17.0% coverage (threshold 0.15). At full coverage (threshold ≤0.10):
  29.8% precision — *below* the 55.3% majority-class baseline ("utility"). One threshold (0.18)
  technically clears ≥95% precision but resolves only 1 of 47 examples (2.1% coverage) — excluded
  from "passing" by a minimum-coverage floor added to the eval script specifically because a
  single-example result isn't a meaningful measurement.
- **Threshold-scale finding:** softmax confidence over 11-17 candidate archetypes stays diffuse
  (observed cluster 0.13-0.23) even when the argmax is reliably correct — a naive high-threshold
  sweep (0.5+, matching the scale of e.g. `classifyFile`'s 0.4 primary threshold) silently produces
  zero coverage everywhere and reads as a broken model rather than a miscalibrated sweep. Worth
  checking whether Archer's own eval script's threshold range assumes a similar scale.
- **Read on the gap, as of 2026-08-12 (superseded below):** hypothesized most likely
  training-data quantity/representativeness, not the base-ELM architectural choice — in-domain
  performance showed the model could learn the archetype signal from path + evidence-hint text, and
  the out-of-domain gap coincided with the "hard" (LLM-requiring) population being entirely absent
  from training. Re-running `ndx analyze` with LLM enrichment on, for both repos, was proposed as
  the natural next experiment. **This hypothesis did not survive the second measurement below.**

### Second measurement (2026-08-13, LLM-enriched data)

The user asked for a re-run once richer data existed — someone (Archer's session or the user) had
run `ndx analyze` with LLM enrichment on for both repos in the interim. Same committed script, same
seed, same two data sources, now richer: training grew from 423→517 examples and 11→14 archetypes
(94 now `source: "llm"`); held-out grew from 47→78 examples, still 6 archetypes.

**The data-quantity hypothesis did not hold — out-of-domain generalization got measurably worse,
not better:**

| | 2026-08-12 (algorithmic-only) | 2026-08-13 (LLM-enriched) |
|---|---|---|
| Training examples / archetypes | 423 / 11 | 517 / 14 |
| Held-out examples / archetypes | 47 / 6 | 78 / 6 |
| In-domain best (precision @ coverage) | 98.1% @ 62.4% | 92.7% @ 39.4% |
| Out-of-domain best *meaningful* point | 62.5% @ 17.0% | 7.7% @ 16.7% |
| Out-of-domain @ full coverage | 29.8% (below 55.3% baseline) | 25.6-29.9% (below 48.7% baseline) |

Verified this wasn't a measurement bug before reporting it: a direct probe of raw argmax accuracy
(ignoring the confidence threshold entirely) over all 78 held-out examples gives 25.6% (20/78) —
consistent with the threshold-swept numbers, not an artifact of the sweep. Inspecting the actual
misses: the model defaults to `"utility"` (the largest training class) for nearly every
`entrypoint`-style held-out file it doesn't recognize (`examples/*/main.js`, `node_examples/*.ts`)
— majority-class collapse, sharper now than at 11 archetypes.

**Revised read:** growing both the example count *and* the label space (11→14 archetypes) diluted
an already-diffuse softmax further, and outweighed whatever signal the new LLM-labeled examples
added. Two live candidates for what to try next, neither measured yet:
1. **Feature representation** — file path + up to 3 evidence hints may not carry enough
   discriminative signal across codebases with different naming conventions, regardless of
   training-set size.
2. **Model capacity/architecture** — `hiddenUnits` is still 512 (the hello-world script's original
   value), untuned for a 14-way problem. This is now real evidence, not just an unmeasured gap, that
   could justify actually reaching for `KernelELM` per this ADR's own "only if base-ELM's held-out
   accuracy doesn't clear the bar" escalation clause — that clause was written to gate on
   evidence like this.

**Status as of 2026-08-13:** Proposed, not Accepted, not Rejected. Two dated measurements pointed
the same direction (does not clear the gate) via two different, uncorrelated mechanisms of failure
(insufficient data, then confirmed-not-insufficient-data) — read as a structural gap, not a final
verdict. **Superseded by the third measurement below**, which changed the outcome.

### Third measurement (2026-08-20) — Realm's review, and the fix it pointed at

**Context: Realm's independent review.** The user asked Realm (Team Jarrett) to review both
`TJ-A1` and `TJ-K1` before either continued —
[`Notes/NOTE-realm-to-archer-and-knight-2026-08-19-elm-prefilter-review.md`](../Jarrett-Agents/Notes/NOTE-realm-to-archer-and-knight-2026-08-19-elm-prefilter-review.md).
Findings relevant here, condensed:

1. Both implementations independently hit the same confidence-calibration false alarm (threshold
   sweeps anchored at 0.5 showing 0% coverage) before recalibrating — inherent to base-ELM's
   ridge-regression readout on this task, not a bug in either build.
2. The evidence-for-`source:"llm"`-files problem (this ADR's "Decision" section, point 1) is a real
   `classifications.json` schema gap needing its own ADR, independent of whether this work
   continues — flagged, not yet written.
3. **Archer's 2026-08-13 pooled-training retry conflated two variables** (added ~73 examples *and*
   2 new archetype categories in the same experiment), so its negative result couldn't isolate
   *why* performance dropped — category-count dilution, per-category signal dilution, or both.
4. **Realm's proposed next step, in priority order:** (1) a controlled data-volume experiment
   holding category count fixed, (2) fix the feature representation — `classifyFile` already
   computes a clean, fixed-length per-archetype score for every file, currently surfaced to the ELM
   only as a string hint inside tokenized text rather than as direct numeric input — before
   reaching for a bigger/different model, (3) only then revisit `KernelELM`/`DeepELM`.

**The user's instruction: skip item 1, go straight at item 2 — fix the representation, don't just
re-run a bigger version of the same experiment.**

**Checked how bad "indirectly" really was before building around it, rather than assuming Realm's
framing was the whole story.** Read `AsterMind-Community-Edition/src/preprocessing/TextEncoder.ts:45-59`
directly: `useTokenizer: true` does **not** produce a token/word embedding — `Tokenizer.tokenize(text)
.join('')` splits on the delimiter and immediately rejoins with no separator, destroying every
token/word boundary, then the result is one-hot encoded per character over a fixed `maxLen` window.
So the encoder never saw `[path-tokens, archetypeId, weight]` structure at all — it saw a flat
character window over a boundary-free blob. Measured the truncation angle directly: only 3.8% of
500 sampled real examples actually exceed the 64-char window, so truncation is real but minor; the
dominant issue is that even *untruncated* input carries the evidence as an undifferentiated
character stream, not as an archetype-indexed numeric value.

**The fix:** `buildEvidenceVector()` sums `classifyFile`'s per-archetype signal weights into a
fixed-length vector (ordered over the full `BUILTIN_ARCHETYPES` catalog, stable dimensionality
regardless of which archetypes a given training run happens to contain), concatenated with a
path-only encoded vector (no evidence text appended — doesn't compete with hints for truncation
budget, doesn't mix the two signal types into one stream). Trained via `trainFromData()` exactly as
before, numeric input instead of joined text. Implementation: `trainArchetypeELMNumeric()`/
`predictArchetypeNumeric()` in `classify-elm.ts`.

**Ran it controlled, not as a replacement for the baseline** — identical data, identical 80/20
split, identical seed (`20260812`) and `hiddenUnits` (512), identical held-out codebase; both
representations evaluated in the same script run so representation is the only changed variable.
This is the exact discipline Realm's review said the pooled-training retry was missing — applied
here instead of skipped:

| | text (original) | numeric (fix) |
|---|---|---|
| In-domain best point | 92.7% @ 39.4% (t=0.15) | **95.7% @ 67.3%** (t=0.15) |
| Out-of-domain @ t=0.15 (same threshold, both reps) | 7.7% @ 16.7% | **97.0% @ 42.3%** |
| Out-of-domain best point | 7.7% @ 16.7% — nothing better available | **100% @ 30.8%** (t=0.18) |
| Out-of-domain @ full coverage (t=0.05) | 25.6% (below 48.7% baseline) | **71.8%** (well above baseline) |

**The numeric representation clears the ADR's ≥95% precision gate with real coverage (42.3%) — the
first time either implementation has cleared it.** Not a marginal change: out-of-domain precision
at the same threshold went from 7.7% to 97.0%. Checked this wasn't leakage before reporting it:
the evidence vector is built from the same source used since the first measurement (a fresh,
LLM-call-free `analyzeClassifications()` re-run) — no dependency on the true label, same
non-circular signal as always, only the encoding changed.

**What this does and doesn't establish.** Confirms Realm's diagnosis: the feature representation,
not data volume, was the dominant lever — the two falsified data-volume hypotheses (second
measurement, and Archer's pooling retry) were chasing the wrong variable. Does **not** yet establish
production-readiness: one held-out codebase, 78 examples, 6 archetypes represented, no independent
corroboration on a second held-out set. Per `ADR-TEMPLATE.md`'s symmetry requirement (positive
claims need the same rigor as negative ones), this is reported as a real but singular result, not a
final verdict — see the linked IMPL's open questions for what corroboration would look like before
treating the gate-clear as sufficient to move to production wiring.

**Status as of 2026-08-20:** Proposed. The gate clears on measured evidence for the first time —
this is a materially different position than "does not clear," but promotion to Accepted is a
production-wiring decision (IMPL Steps 6-8), not an evidence-section update, and is left open for
the user rather than decided here.
