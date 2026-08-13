# ADR — Proceed with a local ELM for archetype classification

- **Status:** Proposed
- **Date:** 2026-08-13
- **Author:** Jam (Team Nolan), on Nolan's decision
- **Supersedes:** none — extends
  [`ADR-2026-08-11-jam-elm-replacement-survey-and-split.md`](ADR-2026-08-11-jam-elm-replacement-survey-and-split.md)
  (that ADR surveyed and split; this one decides Path B)
- **Backlog item:** `TN-J4`

## Context

Path B is claimed by Team Nolan. Step 0 has been measured and the survey is done; this ADR records
the decision to build, and the constraints the build has to satisfy.

### What Step 0 measured

`sourcevision analyze . --fast` on n-dx itself (683 source files, zero tokens — `--fast` skips LLM
enrichment at `analyze-phases.ts:219`):

| | |
|---|---|
| Classified deterministically | 424 (62.1%) |
| Unclassified → sent to the LLM | **259 (37.9%)** |
| LLM calls per full analyze | **9 batches** (`ceil(259/30)`), up to 27 with retries |

Three constraints came out of it, and they shape the design rather than block it:

1. **6 of 17 archetypes have zero examples in rule output** — `gateway`, `middleware`, `model`,
   `route-module`, `service`, `test-helper`. A model trained on rule output cannot predict them.
2. **All 259 unclassified files have zero signal evidence.** The path string is the only feature —
   for the ELM *and* for the LLM doing the job today.
3. **Roughly 30 of the 259 (~12%) look reachable by simple name rules; the rest is genuine
   semantic residue.** ⚠️ **Method caveat:** that split is an *estimate*, produced by running an
   ad-hoc list of a dozen filename regexes over the unclassified paths — not a measurement, and
   not a bound. The real number is whatever Step 1 actually lands. Treat "most of the residue is
   semantic" as the finding; treat "30" as an order of magnitude.

**Baseline correction, carried forward:** the honest baseline is **19.6%** (majority class
`utility`, 83/424), not the 5.9% uniform-random figure quoted in the earlier ADR and SYNC-001.
Both have been corrected in place.

### Why the modest prize does not settle it

The earlier ADR framed this as "9 calls — is that worth an ML project?" That framing understates
the case, for three reasons:

- **ELM inference is local and free.** There is no per-call cost to amortise, so the usual
  "is the model worth its inference bill" question does not arise. Any file the ELM labels is a
  call not made, permanently.
- **n-dx is shipped software.** 9 calls is *this* repo, once. The real denominator is every
  `ndx analyze` in every user's repo, forever. A larger or less conventionally-structured codebase
  will have a higher unclassified share than n-dx's 37.9%.
- **The downside is bounded by construction.** Behind a confidence threshold with LLM fallback,
  the worst case is today's behaviour plus negligible local compute. There is no scenario where
  this costs more tokens than the status quo.

The risk that remains is not cost, it is **futility**: if accuracy on the residue is low enough
that the threshold rejects nearly everything, we ship complexity for no saving. That is what the
kill criterion below is for.

## Decision

**We build a local ELM tier for archetype classification, inserted between the deterministic pass
and the LLM call, gated by a confidence threshold with fallthrough to the existing LLM path.**

Four commitments that follow directly from Step 0:

1. **Train on LLM output, not rule output.** Rule output has six empty classes and is drawn from
   the wrong distribution — files the rules already handle. LLM-labelled rows (`source: "llm"`)
   cover all 17 archetypes and are drawn from exactly the population the ELM will serve. This
   makes corpus acquisition a real, funded step rather than an afterthought.

2. **Pay the LLM once to stop paying it repeatedly.** The corpus requires running analyze *with*
   enrichment enabled to generate `source: "llm"` rows. That is a deliberate, bounded token spend
   whose entire purpose is to end the recurring one.

3. **Fix the free rule gaps in parallel, not instead.** They are complementary: every rule fix
   both removes a file from the LLM's input permanently and populates an empty class in the
   training corpus. Confirmed defect — the `gateway` archetype's only signal is
   `^(?:deps|gateway|barrel)\.[tj]sx?$` (`archetypes.ts`), anchored at `^`, so it matches
   `gateway.ts` but not `rex-gateway.ts`. Verified by execution: all four `*-gateway.ts` files in
   the repo fail this pattern, while its weight (0.7) would clear `PRIMARY_THRESHOLD` (0.4)
   immediately if it matched.

4. **Never regress classification quality to save a call.** Below the confidence threshold the
   file falls through to the LLM exactly as today. The threshold is tuned against measured
   per-class accuracy, not chosen by feel.

### Kill criterion — agreed before the numbers exist

**If the tuned ELM cannot label at least 30% of the residue at or above the accuracy the LLM
achieves on the same files, we stop and publish the negative result.** 30% of 259 is ~78 files,
roughly 3 of 9 batches. Below that, the complexity is not worth the saving even at zero inference
cost.

This number is set now, deliberately, while nobody has a result to argue with.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Close Path B as a measured negative | Defensible on the token arithmetic alone, and it was my recommendation. Overtaken by the point that free local inference changes the calculus, and that the shipped-product denominator is much larger than this repo. |
| Rule fixes only, no ML | Captures ~12% of the 259 and nothing else. Worth doing regardless — but as *part* of this, not instead of it. |
| Train on rule output (the free corpus) | Six classes have zero examples and the distribution is wrong: it teaches the model to imitate rules where they already work. Would produce a good-looking held-out score and no field value. |
| Replace the deterministic pass with the ELM | The rules are free, exact, and already handle 62%. Replacing certainty with a probability is a regression. |
| Register the ELM as an `llm-client` vendor | The vendor seam is text-to-text (`CompletionResult {text: string}`); a classifier would have to parse a rendered prompt and re-serialise JSON, losing the confidence score the threshold needs. See the amendment in the prior ADR. |
| Ship a pre-trained model in the package | Not decided here — deferred to the IMPL as an open question, since `OnlineELM.update()` may make per-run training viable and moot the question entirely. |

## Consequences

**Easier:** every classified file is a call not made, permanently and for every user. The insertion
point already exists, so this adds a tier rather than rewriting one. Rule fixes compound with it.

**Harder:** we now own a training corpus and its provenance, plus a threshold that needs
re-tuning as the archetype catalog evolves. Corpus acquisition costs tokens up front. And ELM
labels inherit the LLM's mistakes — accuracy is capped at the teacher's.

**Breaks:** nothing at decision time. The schema change (`source: "elm"`) is additive but touches
persisted data — see the IMPL's rollback section, where revert alone is insufficient.

**Affected teams:** Path B is Team Nolan's. Paths A and C remain unclaimed, and Team A's token
accounting (`TN-J3`) still gates this project's ability to *report* a saving. Notes to Jarrett and
Thomas on 2026-08-13.

## Evidence

**No ELM viability claim is made here.** This ADR decides to build and sets the bar the build must
clear; the viability number comes from the IMPL's benchmark step.

**Measured, reproducible** — `sourcevision analyze . --fast`, n-dx repo at commit `b5ecfd5c`,
output in `.sourcevision/classifications.json`:

- 683 source files; 424 classified, 259 unclassified
- Class distribution: `utility` 83, `component` 71, `cli-command` 63, `store` 51, `entrypoint` 39,
  `page` 37, `hook` 28, `route-handler` 25, `types` 13, `schema` 13, `config` 1
- **11 of 17 classes present; majority-class baseline 19.6%**
- 259/259 unclassified files carry zero `evidence` entries

**Verified by execution:** the `gateway` signal pattern fails to match `rex-gateway.ts`,
`llm-gateway.ts`, `domain-gateway.ts`, `rex-gateway.ts` — tested directly against the regex from
`archetypes.ts`.

**Prior art, and its limits:** `scripts/elm-hello-world.mjs` — 3 classes, 30 train / 6 held-out,
seed 42, 66% floor vs 33.3% uniform baseline. Explicitly a smoke test. **It is not evidence for
the 17-class task** and must not be cited as such; a 6-sample held-out set cannot separate 66% from
83%.

**Not verified:** whether ELM accuracy on the semantic residue clears the 30% kill criterion — that
is the whole question the IMPL exists to answer, and it is genuinely open. A result below the bar
is a publishable finding, per `Command-Structure`.
