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

**2026-08-27 update (latest) — test coverage for the wired-but-opt-in ELM pre-filter, plus a real
gap closed along the way.** Wrote the test coverage `IMPL-2026-08-23` steps 8-9 called for:
`tests/unit/analyzers/classify-elm.test.ts` (22 tests — extraction filtering, training/prediction,
all three cold-start gates, baseline-model loading, the fresh/baseline/undefined fallback chain)
and `tests/integration/elm-prefilter-wiring.test.ts` (6 tests — the opt-in default, threshold
override, fast-mode and no-unclassified-files skips, LLM fallthrough, ELM-resolved files never
reaching `callClaude`), all against `runClassificationsPhase`'s real wiring with only
`getArchetypeELM`/`classifyWithELM` mocked. While writing the zero-evidence fixture, found the
guard against it was calibration-accident-only, not structural — added an explicit all-zero-vector
skip to `classifyWithELM` itself so a future threshold override can't accidentally resolve a
no-signal file on nothing but the model's training prior. `pnpm build`/`typecheck`/`test` clean for
`@n-dx/sourcevision` (1716/1719 — the 3 failures are pre-existing `@n-dx/web`-serve infra gaps in
this worktree, unrelated to this branch). Full detail in today's session log.

**2026-08-27 update (later) — wired the ELM into production, then found why it shouldn't run
yet.** Executed `IMPL-2026-08-23`'s steps 4-7 for real: retired the text-mode functions, built the
hybrid model lifecycle (cold-start gate + bundled baseline model, actually trained — real 130KB
artifact, not a stub), widened the schema, wired `getArchetypeELM`/`classifyWithELM` into
`runClassificationsPhase` via `sourcevision-core.ts`, added the `.n-dx.json` kill switch. Then
smoke-tested against this repo's *actual* `ndx analyze --phase=3` run instead of stopping at
`pnpm typecheck` — and found the wiring resolves **zero** files, every time, regardless of
threshold. Traced it to something no prior eval (mine, Knight's, Realm's) caught: **100% of
unclassified files in every one of the 5 gathered corpora have zero evidence signal** — an
identically all-zero input vector, indistinguishable to the ELM, no threshold can fix that. Every
validated 100%@59.0%-style result measured performance on files that already had *some* signal;
none measured the true target population. Set `elmPrefilter.enabled` to default `false` rather than
ship a feature that provides no benefit on exactly the population it exists for. Full detail in
today's session log and the ADR's new "Zero-evidence population" section — this is a real,
rigorously-caught limitation, not a setback to downplay.

**2026-08-27 update (earlier) — course-corrected back to ELM-only.** User apologized and reversed the
2026-08-24 taxonomy-pivot instruction: `TJ-A3` is reassigned away from me to a different agent
covering "overall improving"; I go back to working strictly on `TJ-A2` (the ELM engine). Knight
"may not be working on the ELM anymore" per the user — treating Knight's prior `TJ-K1` work as
reference material, not an active collaborator to coordinate with going forward unless that
changes. Reread `ADR-2026-08-11-...` and `IMPL-2026-08-23-...` in full per the user's instruction
before touching anything — confirmed all three blocking open questions were already resolved
(hybrid model lifecycle, pooled baseline corpus, coverage-favoring threshold default), so there's
nothing left to decide before executing IMPL steps 4 onward. `TJ-A3`'s docs are left as-is,
untouched, for whoever picks that up next. Resuming real implementation — see session log.

**2026-08-24 update (later) — TJ-A3 claimed: extend the archetype catalog, not ELM-derived
discovery.** User: "hard pivot... to changing their classification all together." Asked before
guessing which of several plausible readings that meant — user picked "redesign the archetype
taxonomy itself." Mined the 5 codebases' already-gathered classification data for real evidence
(unclassified-rate table, specific file clusters) and drafted `ADR-2026-08-24-jarrett-archetype-taxonomy-redesign.md`
proposing new `analyzer`/`algorithm`/`tool` archetypes plus fixes for 4 same-word-domain
collisions. **Before committing it, found Knight had sent an "URGENT" note claiming a different,
bigger pivot** — ELM-*derived* taxonomy discovery via clustering, no hand-written catalog at all —
attributed to the same user instruction. Two agents' documents both claiming to represent the same
instruction, describing different things, plus Realm's separate (narrower, well-verified)
ELM-as-primary-classifier pivot in the mix too. Did not silently pick one — checked directly with
the user again rather than build a fourth divergent interpretation. Confirmed: my draft (hand-
curated extension) was right; Knight's urgent note was not. Corrected the record for both Knight
and Realm rather than leaving stale claims in `Notes/`/`BACKLOG.md` for the next session to trip
over. Full detail below.

**2026-08-24 update — TJ-A2 underway, Knight supporting in this worktree.** Read Knight's own
production-wiring plan (they'd written one independently, same day as mine — `IMPL-2026-08-23-knight-classify-elm-production-wiring.md`)
and flagged the emerging collision to the user before proceeding rather than silently building in
parallel — resolved as "Archer leads, Knight supports." Adopted Knight's legitimate critique (reuse
`analyzeClassifications()` instead of reimplementing signal matching) — result unchanged
(100%@59.0%), confirming the original reimplementation had been faithful all along, just removing
the drift risk going forward. Knight then contributed a pooling-retest capability directly to the
eval script in this worktree (`SV_ELM_EXTRA_TRAINING_DIRS`); used it to resolve two of `TJ-A2`'s
open questions: user confirmed the hybrid model-lifecycle design (option C), and pooling turned out
neutral — not harmful — under the numeric representation (100%@59.0% either way), informing the
bundled baseline model's training corpus (the pooled 5-codebase set, for the archetype-coverage
gain even though it doesn't move this metric). Full detail in today's session log.

**2026-08-23 update — moving to production wiring, planned first.** Read Realm's coordination
note (`Notes/NOTE-realm-to-archer-and-knight-2026-08-20-management-role.md` — Realm now coordinates
day-to-day across Team Jarrett's agents, doesn't change the three-lead structure) and Knight's
independent confirmation of the numeric-feature fix (`TJ-K1`, commit `405fdc18`: 97.0% precision @
42.3% coverage on the same held-out set, plus a sharper root cause — `useTokenizer: true`'s
tokenizer is measurably broken, not just indirect). Two independent implementations now agree.
User instructed getting this into a real working state, starting with a separate implementation
plan — written as `IMPL-2026-08-23-jarrett-classify-elm-production-hardening.md`, claimed as
`TJ-A2` (distinct from `TJ-A1`'s now-closed prototype scope). Plan covers the thing neither
prototype addressed — how a trained model actually exists at runtime — and proposes a hybrid
train-fresh/bundled-baseline design, flagged for the user's confirmation before more code gets
written against that assumption. Both `TJ-A1`'s and `TJ-K1`'s flagged residual risk (only one
held-out codebase tested) is carried into the plan explicitly, mitigated by a config kill-switch
and conservative default threshold rather than closed outright — the user's instruction to proceed
is treated as an informed decision to record, not a gap to paper over.

**2026-08-20 update — Realm's item 2 (numeric feature representation) clears the gate.** Fed
`classifyFile`'s full per-archetype score as a raw numeric vector instead of tokenized text.
Controlled A/B against the original 2-codebase data: out-of-domain went from 60.9% @ 29.5%
(doesn't clear) to **100% @ 59.0% coverage (clears by a wide margin)**. Sanity-checked, not a
degenerate artifact. First result across every attempt (mine, Knight's, both follow-ups) to clear
the gate. Not yet re-tested against the pooled corpora or independently verified by Knight — not
treating this as final yet, same discipline as every prior measurement. Full detail below and in
the ADR's new "Numeric feature representation" subsection.

**2026-08-13 update:** tried the direct fix for the "not enough diverse training data" read —
pooled three new codebases into training. **It didn't help; in-domain generalization got worse.**
Full detail in today's session log below and the ADR's new "Follow-up: pooled-training experiment"
subsection. Shared with Knight via a `Notes/` handoff (not a direct `Knight.md` edit — their `TJ-K1`
work lives on an unmerged branch, editing their charter directly risked a real conflict) so they can
rerun `TJ-K1` against the same expanded corpora independently.

**TJ-A1 has a real result (2026-08-12): gate did not clear.** In-domain held-out precision passed
(95.8% @ 23.1% coverage), out-of-domain (`AsterMind-Community-Edition`) did not (best meaningful
point 60.9% @ 29.5% coverage, vs. the 95% bar). This converges independently with Knight's `TJ-K1`
result — same qualitative conclusion, different implementation. Did not proceed to production
wiring (IMPL Steps 6-8). Full numbers and methodology in the ADR's Evidence section. Left open for
the user's call on whether to gather better training data and retry, rather than declaring this
either done or dead.

Implementation underway on branch `elm/jarrett/classify-elm-prefilter`, worktree
`../n-dx-jarrett` (separate commit history from this `Jarrett` branch — code lives there, design
docs live here). `classify-elm.ts` and `scripts/eval-classify-elm.ts` are written and typecheck
clean, but can't produce real numbers yet: both need `ndx analyze` run against their classification
source first (this repo + `AsterMind-Community-Edition`) — that's the immediate next step, not yet
started as of this entry. **Knight is building a parallel implementation off the same ADR** — this
file is being kept current specifically for that, per standing instruction from the user.

`ADR-2026-08-11-jarrett-elm-prefilter-classify.md` and
`IMPL-2026-08-11-jarrett-classify-elm-swap.md` are drafted (backlog `TJ-A1`, `BLOCKED` — see Next
up). Design: insert the ELM as a new stage *between* `classifyFile` and
`enrichClassificationsWithLLM`, not inside either — it only ever sees the leftover
`archetype: null` population, and anything it isn't confident about still falls through to the LLM
exactly as today. ADR Status is Proposed; the IMPL's Evidence-gathering step (train/eval script,
random-baseline comparison) has to run and clear its gate before any production wiring happens or
Status can move to Accepted.

## Next up

(`TJ-A2` steps 1-9 are done — see IMPL and session log below. Superseded entries from the
`TJ-A1` prototype phase removed rather than left stale.)

- [ ] IMPL step 10: regression check — classification correctness on a fixed corpus (this repo's
      own `.sourcevision/` data is a reasonable fixture) must not regress relative to
      algorithmic+LLM-only.
- [ ] IMPL step 11: `pnpm build && pnpm typecheck && pnpm test` clean across the *whole* repo, not
      just `@n-dx/sourcevision` (already clean there — see session log).
- [ ] The actual open problem: a feature representation that doesn't degenerate to an all-zero
      vector for the zero-evidence population — needed before `elmPrefilter.enabled` can default to
      `true`. See IMPL Open questions for the candidate directions, none measured yet.
- [ ] IMPL steps 12-13: update ADR status once a representation fix is validated (not before), open
      a PR.

## Session log

### 2026-08-27 (latest) — IMPL steps 8-9: test coverage, plus turning a calibration accident into a real guard

Picked up right after committing the zero-evidence-population documentation. Steps 1-7 were code
and real, so the tests needed to exercise the real thing, not a simplified restatement of it.

- **Unit tests (`tests/unit/analyzers/classify-elm.test.ts`, 22 tests):** `extractNumericExamples`'
  three filtering rules (role ≠ source, archetype null, source outside algorithmic/llm) each get
  their own case, built by force-overriding a real `analyzeClassifications()` result rather than
  hand-rolling fake evidence — keeps the test honest about what the function actually reads.
  `trainArchetypeELMNumeric`/`predictArchetypeNumeric` against small synthetic separable vectors
  (fast, deterministic, no dependency on real archetype signal weights). `hasEnoughHistoryForFreshTraining`'s
  three gates (volume, category count, LLM-sourced count) tested individually so a future change to
  any one threshold can't silently break another. `canUseBaselineModel` true/false against a real
  custom-archetype catalog extension. `loadBaselineArchetypeELM` loads the actual bundled 130KB
  artifact (not a mock) and predicts without throwing. `getArchetypeELM`'s three-way fallback
  (fresh/baseline/undefined) each constructed from real inventory/classification data satisfying or
  violating the actual gate conditions.
- **Integration test (`tests/integration/elm-prefilter-wiring.test.ts`, 6 tests):** runs the real
  `runClassificationsPhase` against a real temp project directory (inventory.json/imports.json/
  .n-dx.json written to disk, following the same `mkdtemp`/`afterEach rm` pattern as
  `analyze-model-resolution.test.ts`), with only `getArchetypeELM`/`classifyWithELM` mocked via a
  partial `vi.mock` of `sourcevision-core.ts` (keeping every other real export, same pattern
  `classify.test.ts` uses for `claude-client.js`) — their own correctness is the unit tests' job;
  this file's job is the wiring. Confirms: no `.n-dx.json` entry means the ELM stage never runs at
  all (the opt-in default, not just "resolves nothing"); `classifyWithELM` receives
  `DEFAULT_ELM_CONFIDENCE_THRESHOLD` by default and the configured override when set; fast mode and
  "nothing unclassified" both skip the stage before it's ever invoked; an `undefined` model (no
  usable lifecycle branch) falls through to the LLM exactly as if the stage didn't exist; and once
  the ELM resolves everything, `callClaude` is never called.
- **Real gap found while building the zero-evidence fixture, not assumed:** the guard against
  zero-evidence files resolving was, as shipped in the last session, an accident of calibration —
  `classifyWithELM` had no explicit check, it just happened that the validated default threshold
  (0.11) didn't clear on an all-zero vector's prediction in practice. That's not a real invariant —
  a `.n-dx.json` override setting `confidenceThreshold` low (or to 0) would have let a zero-evidence
  file resolve on nothing but the trained model's class prior, which is exactly the false-confidence
  failure mode this whole finding is about. Added an explicit `vector.some((v) => v > 0)` check to
  `classifyWithELM`, before prediction, unconditional on `confidenceThreshold`. Tested directly: the
  zero-evidence fixture never resolves at threshold 0 (the most permissive setting possible), while
  a weak-but-genuinely-nonzero-evidence fixture does resolve once its actual confidence clears the
  threshold, and stops resolving once the threshold is pushed above its observed confidence. This
  doesn't change the `enabled: false` decision — the representation gap (no signal to discriminate
  on) is still unsolved — but it means that decision no longer needs to also carry "and don't touch
  the threshold override" as an unstated, unenforced assumption.
- **Validation:** `pnpm build`, `pnpm typecheck`, and the full `vitest run` are clean for
  `@n-dx/sourcevision` — 1716/1719 tests passing. The 3 failures (`cli-serve.test.ts` timing out,
  two `unit/cli/serve.test.ts` cases erroring on "Could not locate @n-dx/web CLI") are pre-existing:
  `@n-dx/web`'s `dist/` was never built in this worktree, and the failing tests' last edit
  (`b9570fd2`) predates every `TJ-A2` commit on this branch — unrelated infra gap, not a regression
  from this work. Grepped the monorepo for other exhaustive consumers of
  `FileClassification.source`'s literal values (the union step 5 widened) — confined to
  `sourcevision` itself, so no cross-package fallout from the schema change. Did not run the
  whole-monorepo `pnpm build/typecheck/test` (IMPL step 11) — flagged as still open in the IMPL
  rather than claimed as done.
- Updated the IMPL (steps 8-9 marked done with detail, step 11 marked partially done, a note added
  to the "when does `enabled` flip back" open question clarifying the guard and the config default
  are two independent safety layers now, not one). Committed docs here; code + tests committed to
  the worktree (`elm/jarrett/classify-elm-prefilter`, commit `78f295ae`).

### 2026-08-27 (later) — production wiring done, shipped opt-in after finding a real gap

Reread the plan (Step 4 onward all blocking questions already resolved), then executed for real
rather than re-describing it:

- **Model lifecycle (Step 4):** retired `fileToText`/`extractExamples`/`trainArchetypeELM`/
  `predictArchetype` (text-mode). Added `hasEnoughHistoryForFreshTraining` (cold-start gate),
  `canUseBaselineModel` (guards against catalog mismatches from custom archetypes),
  `loadBaselineArchetypeELM`, `getArchetypeELM` (single entry point — trains fresh, loads baseline,
  or returns `undefined`). Wrote `train-baseline-elm.ts` and **actually ran it** — real trained
  artifact, `classify-elm-baseline-model.json`, 686 examples pooled across all 5 `TJ-A1` corpora, 16
  categories, 130KB. `copy-assets.mjs` + a `package.json` build-script edit get it into `dist/`,
  since plain `tsc` doesn't copy non-`.ts` assets. Verified both lifecycle branches end-to-end with
  a fabricated tiny-history case before moving on.
- **Schema (Step 5):** `"elm"` added to `FileClassification.source` in `schema/v1.ts` and the zod
  enum in `validate.ts`. Checked for other exhaustive consumers of the 3-value union first — none
  found.
- **Wiring + kill switch (Steps 6-7, done together since they're coupled):** added
  `classifyWithELM` (mirrors `enrichClassificationsWithLLM`'s `{updatedFiles}` shape so
  `runClassificationsPhase` merges it identically) and `DEFAULT_ELM_CONFIDENCE_THRESHOLD` (0.11,
  the coverage-favoring end of the range Realm's `TJ-R1` confirmed). Discovered `analyze-phases.ts`
  imports everything through `sourcevision-core.ts` (an internal re-export gateway, same pattern as
  the cross-package ones in `CLAUDE.md`) rather than reaching into `classify-elm.ts` directly —
  followed that convention rather than adding a new import path. Wired the actual call into
  `runClassificationsPhase` between `analyzeClassifications` and `enrichClassificationsWithLLM`.
  Added `sourcevision.classification.elmPrefilter.{enabled,confidenceThreshold}` to `.n-dx.json`.

**Then smoke-tested against a real `ndx analyze --phase=3 --full .` run on this repo — not another
eval-script invocation, the actual wired code path — and it resolved zero files.** Didn't accept
that as "must be fine, typecheck passed" and move on. Debugged in order:

1. Checked the confidence distribution directly: training-data confidence clusters ~0.21, but the
   genuinely novel unclassified population clusters at a cliff right at 0.10/0.11 — 0% resolved at
   0.10, all-or-nothing at 0.11. Traced this to training on purely-algorithmic data (423 examples,
   0 `source: "llm"`) — a real, plausible state, not a contrived edge case. Fixed by requiring a
   minimum count of `source: "llm"` examples specifically in `hasEnoughHistoryForFreshTraining`,
   not just any-source volume.
2. Re-tested — the fix correctly redirected to the bundled baseline model. **Still zero resolved.**
   Didn't stop at "the fix didn't work," kept debugging.
3. Checked the baseline model's confidence on the same population directly: same cliff shape, just
   shifted. This ruled out "which training data" as the variable and pointed at something about
   the *files themselves*.
4. Checked whether the unclassified files even have distinguishable input vectors at all: **100% of
   them have zero evidence signal** — confirmed across all 5 corpora (n-dx, AsterMind, express,
   indie-stack, zustand), zero exceptions. `classifyFile`'s signal weights (0.4-0.9 per match) mean
   one matched signal usually already clears `PRIMARY_THRESHOLD` (0.4) alone — there's essentially
   no "partial signal, still unresolved" middle ground in this catalog, so the files reaching this
   stage are, without exception, the ones with *no* signal at all. An all-zero vector is
   indistinguishable from every other all-zero vector to the ELM — same prediction, same
   confidence, for every one of them, regardless of what the file is or what threshold is set.

**This means every validated result in this whole investigation — 100%@59.0%, Knight's
97.0%@42.3%, Realm's independent reproduction, all of it — measured the ELM's ability to
discriminate among files that already had *some* algorithmic signal, never the true target
population `enrichClassificationsWithLLM` actually gets called for.** Not a wrong result, an
incomplete one — nobody, across three independent implementations and three rounds of review,
constructed a held-out set from genuinely zero-signal files, because every held-out set was drawn
from files with a resolvable label by construction.

**Action, not just documentation:** set `elmPrefilter.enabled`'s default to `false` (opt-in). The
wiring, schema, model lifecycle, and config surface are real and correct — what's not validated is
a representation that works on this specific population. Shipping enabled-by-default on that basis
would be shipping a feature that does nothing useful while looking like it works. Flagged Knight's
`TJ-K1` composition (evidence + path-encoded vector, never all-zero since path text always exists)
as the likely direction for a real fix — not implemented here, since it deserves its own
measurement against the zero-evidence population specifically, not an assumption that it'll work
because it didn't degenerate the same way.

Updated the ADR (new "Zero-evidence population" section), the IMPL's Steps/Status/Open questions,
this entry. Did not update `BACKLOG.md`'s Knight-facing framing yet since the user said Knight may
not be on this anymore — noted the finding is relevant to `TJ-K1` regardless, for whenever/whoever
picks it up.

### 2026-08-24 (later) — TJ-A3: archetype taxonomy redesign, and a three-way documentation tangle

User: "so we're going to be doing a hard pivot, from trying to implement an ELM into n-dx, to
changing their classification all together. Update your ADR and implementation plan." Ambiguous
enough that guessing wrong would waste real effort — this project's documents get acted on, not
just read — so asked first rather than picking the most likely reading unilaterally. Three options
offered: ELM becomes the primary classifier, redesign the archetype taxonomy, or apply the pivot
beyond `classify.ts`. User picked the taxonomy option.

**Built the evidence before drafting anything.** Pulled current unclassified-rates across all 5
codebases gathered during `TJ-A1`'s investigation (still on disk):

| Codebase | Domain | Unclassified |
|---|---|---|
| `AsterMind-Community-Edition` | ML library | 40.0% |
| n-dx (this repo) | Dev-tooling monorepo | 24.3% |
| `zustand` | State-mgmt library | 21.4% |
| `express` | Backend framework | 10.4% |
| `indie-stack` | Full-stack web app | 7.1% |

Rate tracks cleanly with how web-app-shaped the codebase is — confirms the taxonomy itself, not
the classifying engine, is the bottleneck for non-web-app code. Grouped n-dx's 166 and AsterMind's
52 remaining unclassified files by directory to find real clusters rather than guessing at new
categories: `sourcevision/analyzers/*` + `hench/agent/analysis/*` + `rex/analyze/*` (analysis/
detection logic, no archetype today), `hench/tools/*` (agent tool implementations), AsterMind's
`src/elm/*`/`src/ml/*`/`src/tasks/*` (42 of 52 files — algorithm/ML-model implementations, zero
archetype fit). Also confirmed, by direct inspection, the same-word-different-domain collisions
noted throughout this investigation are real and specific: `branch-work-store.ts` (backend
persistence, not a React store), `token-validation-hook.ts` (generic callback, not a React hook),
Zustand's own `middleware.ts` (state middleware, not HTTP), AsterMind's ELM files (ML models, not
data models) — all four currently either mismatch or fail to match under `store`/`hook`/
`middleware`/`model`'s signals as written.

Drafted `ADR-2026-08-24-jarrett-archetype-taxonomy-redesign.md` on this basis: add `analyzer`/
`algorithm`/`tool` archetypes, tighten the four collision-prone signal sets, treat `orchestrator`
as a weaker fourth candidate pending broader evidence.

**Before committing it, checked current repo state fresh — found a real tangle, not a quiet
success.** Three things had happened in near-parallel, each claiming to represent "the user's
direction":
1. **Realm's `TJ-R1`** (marked DONE) — independently rebuilt and reran both my and Knight's actual
   committed eval scripts (not just read claims), confirmed both results exactly, then made a
   narrow, well-scoped change: ELM becomes primary classifier, threshold default shifts toward
   coverage. Explicitly doesn't touch `TJ-A2`'s architecture.
2. **Knight's "URGENT" note** — claimed a much bigger pivot: replace `BUILTIN_ARCHETYPES` entirely
   with categories the ELM *derives* via clustering over learned embeddings, no hand-written catalog
   at all. Said a new ADR for this was coming; none existed yet, on any branch.
3. **My own draft** — a hand-curated catalog *extension*, not automatic discovery. Different from
   both 1 and 2.

These don't reconcile with each other. Rather than commit my draft on the assumption it was right,
or defer to Knight's note because it was more dramatic, checked directly with the user again.
**Confirmed: my draft was correct; Knight's urgent note was not** — a real second-hand
miscommunication, not a disagreement to split the difference on.

**Corrected the record rather than leaving it to surface later:**
- Updated `ADR-2026-08-11-...`'s Status field (previously pointed at Realm's ADR) to point at the
  new `TJ-A3` ADR instead, with the correction spelled out inline.
- Wrote `IMPL-2026-08-24-jarrett-archetype-taxonomy-redesign.md` — the plan the user actually asked
  for, not written before because I'd been mid-tangle-discovery.
- Sent `Notes/NOTE-archer-to-knight-and-realm-2026-08-24-taxonomy-direction-confirmed.md`: Knight
  should stand down from the clustering-based ADR; `TJ-A2`'s ELM engineering carries forward
  unchanged (orthogonal to `TJ-A3`, not superseded by it); Realm's `TJ-R1` threshold number is
  provisional until re-verified against `TJ-A3`'s eventual catalog, since the label set it was
  tuned against is about to change.
- Updated `BACKLOG.md` (claimed `TJ-A3`, corrected `TJ-A2`'s and `TJ-R1`'s status text) and
  `IN-FLIGHT.md` (rewrote the stale Team Jarrett summary — it still described the pre-numeric-fix
  state from over a week of session-time ago).

**Not yet done:** actually creating `TJ-A3`'s worktree/branch and writing the archetype signal
code — this session was the plan plus untangling three simultaneous claims about what the plan
should be. Knight's and Realm's replies to the correction note aren't in yet.

### 2026-08-24 — reconciling with Knight's independent production plan; two open questions resolved

Instructed to "work in what Knight has been up to." Checked Knight's branch fresh rather than
assuming nothing had changed — found Knight had independently written their own production-wiring
plan the same day I wrote mine (`IMPL-2026-08-23-knight-classify-elm-production-wiring.md`),
explicitly proposing to converge both prototypes on Knight's branch, without merging mine in
(their stated reason: my extraction method's duplicated-logic tradeoff shouldn't get carried
forward).

**The substance of Knight's plan was right, and worth taking seriously rather than defending my
own approach territorially:**
- A real critique: my numeric extraction reimplemented `classify.ts`'s private signal-matching
  logic independently; Knight's calls the real, already-exported `analyzeClassifications()`
  instead. Knight's is more maintainable — mine can drift silently if `classify.ts`'s regexes
  change, Knight's can't.
- A confound neither of us isolated: our two builds differ in both feature *composition* (pure
  evidence vector vs. evidence+path-concatenated) and *extraction method* (reimplemented vs.
  reused) at once, so my better coverage number (59.0% vs. Knight's 30.8%, both at 100% precision)
  can't be attributed to either difference specifically.
- A sharp point I'd missed entirely: a bundled cold-start model trained on n-dx's own repo (my
  original hybrid-lifecycle proposal) ships that bias to every downstream user of the tool,
  regardless of how different their project's conventions are — the out-of-domain problem
  reappearing at the product level, not just the eval level.

**But the plan also assumed Knight would build the converged production version on their own
branch** — meaning both of us would be independently building "the" production wiring in parallel,
exactly the collision this whole `Claude-Context/` structure exists to prevent, except this time
knowingly. Flagged this to the user directly rather than picking a side unilaterally or quietly
continuing my own plan. User's call: Archer leads, Knight supports within `TJ-A2` rather than a
separate `TJ-K1` production track.

**Acted on that immediately** rather than treating it as just a status update:
1. Reworked `classify-elm.ts`'s `extractNumericExamples` to call the real `analyzeClassifications()`
   (importing it and `BUILTIN_ARCHETYPES` — both already public, `classify.ts` still not modified),
   replacing the reimplemented `matchesSignal`/`scoreArchetypeVector`/`buildExportMap`. Had to build
   the package and run against compiled `dist/` output to actually execute this — `--experimental-strip-types`
   doesn't resolve a `.js`-extension import transitively through another uncompiled `.ts` file, only
   discovered because `classify-elm.ts` now has an inter-module dependency within `src/` for the
   first time.
2. Re-ran the original 2-codebase eval: **identical result**, 100%@59.0% coverage — confirms the
   original reimplementation had been faithful to the real matching logic, not just close.
3. Found Knight had already contributed directly to this worktree (uncommitted, per the "supports"
   arrangement) — `SV_ELM_EXTRA_TRAINING_DIRS`, a pooling-retest capability for the eval script,
   picking up exactly the open question my own `TJ-A2` plan had flagged as unresolved. Used it:
   pooling the same 3 codebases from 2026-08-13 under the numeric representation leaves the
   out-of-domain result **unchanged** (100%@59.0% with or without), unlike the sharp regression
   pooling caused under the text representation. Neutral, not harmful — and it adds 2 archetype
   categories (`middleware`, `model`) the 2-codebase set has zero examples of.
4. This resolved two of `TJ-A2`'s open questions in one pass: the user separately confirmed the
   hybrid model-lifecycle design (option C) today, and the pooling question now has a real answer
   informing what the bundled cold-start baseline should train on — the pooled 5-codebase corpus,
   for the archetype-coverage gain, since it costs nothing on the measured metric.

Updated the ADR (new "Independent verification" and "Reconciling..." subsections), `TJ-A2`'s open
questions and Design decision section, and this entry. Did not touch `classify.ts` or
`analyze-phases.ts` — still prototype-stage code, production wiring (`TJ-A2` steps 4 onward) not
yet started.

### 2026-08-20 — numeric feature representation clears the gate (Realm's item 2)

Read Realm's 2026-08-19 review first (`Notes/NOTE-realm-to-archer-and-knight-2026-08-19-elm-prefilter-review.md`)
— per the user's instruction, updated the ADR with Realm's findings before starting any
implementation, so the record shows the review landed before the retry it motivated, not after.

Realm's sharpest point: the 2026-08-13 pooling experiment changed two variables in one run (more
examples + more categories), so its in-domain regression couldn't be attributed to either cause.
Realm's item 2 was a different, specific, testable idea: `classifyFile` already computes a clean
per-archetype numeric score for every file — feeding that as a tokenized text hint (what
`fileToText` does) makes the ridge-regression readout re-derive numeric signal from string tokens
instead of receiving it directly. Picked this up as instructed.

**Implementation:** added `scoreArchetypeVector`/`matchesSignal`/`buildExportMap` to
`classify-elm.ts`, reimplementing `classify.ts`'s signal-matching logic independently rather than
exporting anything new from that file — `classify.ts` stays untouched, per the standing design
constraint, at the cost of duplicated logic that could drift if the real regexes change (flagged
in the code, not hidden). Added `extractNumericExamples` (recomputes the score vector fresh from
`inventory.json`/`imports.json` for every example, sidestepping the evidence-leakage question
entirely rather than working around it — nothing stored to leak), `trainArchetypeELMNumeric`
(`NumericConfig`, `useTokenizer: false`, `inputSize: 17`), `predictArchetypeNumeric`. New eval
script `eval-classify-elm-numeric.ts`, deliberately run against only the *original* 2-codebase
data (not the 2026-08-13 pooled corpora) so the feature-representation variable stays isolated —
exactly the controlled comparison Realm's review asked for.

**Had to recalibrate thresholds again** — checked the numeric model's actual confidence range
before guessing (~0.09-0.18, even tighter than text mode's ~0.08-0.19) rather than reusing the
text-mode script's threshold list, which would have shown 0% coverage everywhere for the third
time this project.

**Result:**

| | Text mode | Numeric vector |
|---|---|---|
| In-domain | 95.8% @ 23.1% | 97.6% @ 79.8%, 100% @ 75.0% |
| Out-of-domain | 60.9% @ 29.5% — no clear | **100% @ 59.0% — clears by a wide margin** |

Sanity-checked before trusting it: resolved predictions at the passing threshold span 5 distinct
archetype labels (not a majority-class artifact), zero wrong among them.

**This is the first result, across both agents' implementations and every retry either of us ran,
that actually clears the out-of-domain gate.** Supports Realm's diagnosis directly — the
bottleneck was signal loss in the text encoding, not data volume or category count, and there's
now no evidence pointing at needing `KernelELM`/`DeepELM` either.

**Not declaring this done.** Only tested against the original 2-codebase data by design (to isolate
the variable); haven't re-tried it against the pooled corpora, and Knight hasn't independently
verified it the way the original negative result was cross-checked before being trusted. Same
rigor either direction — a striking positive result gets checked before it gets believed, same as
the negative ones did.

**Not yet done:** share this with Knight for independent verification; test numeric features
against the pooled 5-codebase data now that the confound is understood; if it holds up, only then
consider whether Steps 6-8 (production wiring) are warranted.

### 2026-08-13 — pooled-training experiment: more diverse data didn't fix generalization

User's direct instruction after seeing the 2026-08-12 result: gather more training data and share
it with Knight for a `TJ-K1` rerun. Checked the machine first — only `AsterMind-Community-Edition`
and a second, near-duplicate n-dx checkout exist locally, neither adds real diversity — so asked the
user where new codebases should come from rather than guessing. They picked "clone small well-known
open-source repos" and asked me to also construct a distinct test case for Knight and notify them.

**Gathered three, chosen for archetype-gap coverage, not just volume:** `expressjs/express`
(shallow clone), `remix-run/indie-stack` (the official Remix starter — only source of
`route-module` examples across every dataset so far; that label had zero examples before, since
n-dx doesn't use Remix and AsterMind isn't a web app), `pmndrs/zustand` (literal state-management
library — `store` label, also near-zero before). Ran `ndx analyze --phase=1/2` (free) on all three,
then classified the leftover unclassified files myself the same way as 2026-08-12 (no `claude`
CLI/API key available, same blocker as before — this is a real stand-in for the LLM fallback, not a
test of it), merged via the real `mergeClassificationResults` function. 91 new classified files
across the three (express 43, indie-stack 26, zustand 22).

**Extended the eval script** (`SV_ELM_EXTRA_TRAINING_CLASSIFICATIONS`, comma-separated paths) to
pool multiple training sources rather than just this repo's own data, keeping
`SV_ELM_HELDOUT_CLASSIFICATIONS` (AsterMind) fixed so the comparison is controlled — same held-out
set, only the training side changes.

**Result — did not confirm the hypothesis.** Pooled training (486 examples/16 categories, up from
413/14) against the same held-out set: in-domain best point dropped to 87.3% @ 45.1% coverage
(t=0.10) — **no longer clears the 95% gate that the original 2-codebase run cleared** (95.8% @
23.1%). Out-of-domain stayed similarly poor (~48% @ 32%, previously 60.9% @ 29.5%). Simply pooling
more/diverse codebases made things worse, not better — most likely because two more categories
(14→16) and more cross-codebase naming variance raised the task's difficulty faster than three
small repos' worth of examples could offset, and the softmax confidence spread compressed further
with more categories (same direction as the original calibration finding, more pronounced here).

**This does not confirm "just needs more data" in the simple-pooling form tested.** Doesn't rule
out that a *much* larger corpus (dozens of codebases, not three) would behave differently, or that
a different feature representation would generalize better with the same data — just that the
direct, cheap version of the fix didn't work. Reported as a real finding, not silently dropped, per
the same "negative result gets the same rigor" doctrine as the original gate check.

**Shared with Knight** via `Claude-Context/Jarrett-Agents/Notes/NOTE-archer-to-knight-2026-08-13-expanded-training-corpora.md`
rather than editing `Knight.md` directly — their `TJ-K1` work lives on `elm/jarrett/classify-elm-knight`,
an unmerged branch, so a direct charter edit here would set up a real merge conflict when both land.
The note points at the three new corpora's `.sourcevision/` output and this session's pooling
result, asking Knight to rerun `TJ-K1` against the same data independently rather than assuming my
read is right.

**Not yet done:** whether Knight's independent rerun agrees; whether to try pooling with
substantially more codebases (order-of-magnitude more, not three) before concluding either way.

### 2026-08-12 (later) — TJ-A1 real numbers: gate did not clear, converges with Knight's TJ-K1

Picked up from the `claude`-CLI/API-key blocker logged earlier today. The user asked whether the
API key could be skipped entirely — realized it could: I'm already an instance of Claude sitting in
this conversation with full ability to make the same path→archetype judgment call a spawned Claude
subprocess would, so I classified the unclassified files myself directly rather than routing
through `callClaude`. Explicitly a stand-in for what `enrichClassificationsWithLLM` would produce,
not a test of that function's own plumbing — fine for generating training-data ground truth, which
is all this needed.

**What I did:** read all 260 unclassified files in this repo and 83 in `AsterMind-Community-Edition`
against the real archetype catalog (`archetypes.ts`, with descriptions — same info the real prompt
shows), judged each on path/naming alone (no evidence hints existed for any of them — the
algorithmic pass scored them all at 0), and deliberately let genuinely-ambiguous ones stay
unclassified rather than force-fitting an archetype to inflate the training set. Caught myself
almost mislabeling on keyword coincidence twice — `branch-work-store.ts` isn't a "store" (that's
backend persistence, not frontend state management) and `token-validation-hook.ts` isn't a "hook"
(no `use`-prefix, not React) — both left unclassified. Merged the results using the actual
`mergeClassificationResults` function from the compiled package (not hand-rolled JSON) so the
output is schema-identical to what the real pipeline writes: 94 files labeled here (517
classified/166 unclassified total), 31 in AsterMind (78/52).

**Ran the eval, hit two real issues, fixed both before trusting the numbers:**
1. Confidence sweep (0.5-0.99) showed 0% coverage everywhere. Checked the actual distribution
   before assuming the model was broken: ~0.08-0.20, far below where I'd started sweeping.
   Recalibrated to 0.08-0.30. **Knight hit the identical issue independently** (their range:
   0.13-0.23) — worth noting since two separate implementations landing on the same "confidence is
   diffuse, not nearly binary" symptom is evidence about the base-ELM readout itself, not either
   implementation.
2. Realized my own `fileToText()` had a leakage bug: for `source: "llm"` files, the "evidence" I
   was feeding the ELM as a training hint was `[{archetypeId: item.archetype, ...}]` —
   **`classifyBatchWithLLM` in the real `classify.ts` (461-469) writes exactly this shape** — so the
   hint text literally contained the answer for every LLM-labeled example, in the real schema, not
   just my manually-generated data. Fixed by only using evidence hints for `source: "algorithmic"`
   entries. Verified the fix barely moved the numbers (&lt;1 point) — the qualitative conclusion
   was never dependent on the leak, but the schema-level finding is real and worth its own
   write-up. **Knight independently found the adjacent version of this** (evidence isn't preserved
   at all for algorithmically-then-LLM-relabeled files) and fixed it differently (recomputing fresh
   algorithmic evidence rather than dropping it for llm-sourced entries). Both fixes are logged in
   the ADR since a future ADR on this schema gap should have both approaches to compare, not just
   mine.

**Final results** (413 training examples/14 categories here, 78 held-out in AsterMind), precision
at a threshold with a 15%-coverage floor so one lucky resolved example can't read as a pass:
- **In-domain** (held-out split of this repo's own data): **95.8% precision @ 23.1% coverage**
  (t=0.14) — clears the gate.
- **Out-of-domain** (`AsterMind-Community-Edition` — the number the ADR's Decision actually
  depends on): does **not** clear it. Best meaningful point: 60.9% precision @ 29.5% coverage.

**Did not proceed to production wiring** (IMPL Steps 6-8) — the gate is specifically about
generalizing beyond this repo's own conventions, and it didn't. Per the ADR template's own
requirement, reporting this as a negative-leaning result with the same rigor as a positive one,
not discarding it. This converges independently with Knight's `TJ-K1` (strong in-domain, weak
out-of-domain, same likely cause: neither dataset has enough of the actual hard-case population to
generalize from) — two differently-built implementations reaching the same conclusion is stronger
evidence than either alone. Left `TJ-A1` open in the backlog rather than closing it — next move
(gather more/better training data across more codebases, or treat this as sufficient evidence to
pause) is the user's call, not mine to spend real tokens on unilaterally.

Full numbers, both fixes, and the majority-class baselines are in the ADR's Evidence section — this
entry is the narrative, that's the reproducible record.

### 2026-08-12 — TJ-A1 implementation started: worktree, dependency, prototype code

For Knight, since we're now building in parallel off the same ADR — full detail so the design is
legible without reading the diff.

**Environment:** created `../n-dx-jarrett` worktree, branch `elm/jarrett/classify-elm-prefilter`
(resolves the IMPL's worktree-vs-shared-checkout open question for this agent's own work — team-wide
question still separately open). Claimed `IN-FLIGHT.md` for the `package.json`/`pnpm-lock.yaml`
edit before touching either.

**Dependency resolved with hard evidence, not the earlier assumption:** checked
`registry.npmjs.org` directly — `@astermind/astermind-elm` exists (v2.1.1, older/narrower) but
`@astermind/astermind-community` (v3.0.0) is the exact match to the local
`AsterMind-Community-Edition/package.json` Knight's 2026-08-11 survey actually read. Installed the
latter in the worktree. Also confirmed `AsterMind-Community-Edition` is not a sibling of this
repo's working directory — it only sits next to a second, older n-dx checkout on this machine
(`GitHub/n-dx`, branch `dev`). Full reasoning in the ADR's Evidence section.

**API surprise worth flagging loudly for Knight's build:** read `ELM.ts` directly rather than
trusting the prior survey's prose summary. `ELM.train()` (the obvious-looking text-mode training
method) does **not** train on a supplied corpus of labeled examples — it bootstraps its own
training set from augmented spelling/casing *variants of the category names themselves*
(`ELM.ts:403-487`, via `Augment.generateVariants`). It's built for zero-shot-style intent
classifiers where you only have category names, not for supervised training on real
(file → archetype) pairs, which is what we actually have. The correct path: encode real examples
yourself with the same encoder `predict()` uses internally
(`elm.encoder.encode(text)` → `.normalize(...)`), then call `trainFromData(X, y)` — the
numeric-vector supervised method. `predict(text, topK)` still works normally afterward since it's
the same encoder instance. Documented prominently in `classify-elm.ts` itself, not just here,
since the module doc is what Knight would actually open.

**Code written**, both typecheck clean (`pnpm --filter @n-dx/sourcevision typecheck`, plus a
targeted check of `scripts/`, which `tsconfig.json`'s `include` doesn't cover by default):
- `packages/sourcevision/src/analyzers/classify-elm.ts` — `extractExamples`/`fileToText` (training-
  data extraction from a `Classifications` result, reusing the same evidence-hint text shape
  `buildLLMClassifyPrompt` already shows the LLM) and `trainArchetypeELM`/`predictArchetype`.
- `packages/sourcevision/scripts/eval-classify-elm.ts` — fixed seed (`20260812`), seeded
  Fisher-Yates train/held-out split, majority-class baseline (context only), precision/coverage
  curve across confidence thresholds. Held-out source path is an env var
  (`SV_ELM_HELDOUT_CLASSIFICATIONS`), deliberately not a hardcoded relative path, for the same
  portability reason as the dependency finding above.
- **Neither `classify.ts` nor `analyze-phases.ts` touched** — matches the ADR's "in-between call,
  not modifying either function" design exactly.

**Update same day — Step 2b attempted, hit a real blocker.** Ran `analyze --phase=1`, `--phase=2`,
`--phase=3` against both `../n-dx-jarrett` (1525 files inventoried, 683 source files) and
`AsterMind-Community-Edition` (151 files inventoried, 130 source files) — inventory/imports
completed cleanly on both. **Phase 3's LLM fallback failed on both**: `'claude' not found on PATH`.
Checked for it directly (`Get-Command claude`, npm global modules, common Windows install paths) —
genuinely not installed as a standalone binary in this environment, not just a PATH issue in one
shell. No `ANTHROPIC_API_KEY` set either, so there's no fallback to API-mode auth.

**Result: algorithmic-only data exists for both, no `source: "llm"` examples anywhere yet** —
`n-dx-jarrett`: 423 classified / 260 unclassified; `AsterMind-Community-Edition`: 47 classified / 83
unclassified. This is real, usable data for `extractExamples()`, but it misses exactly the
"files the algorithmic pass couldn't resolve" population the ELM pre-filter is meant to serve, and
the AsterMind held-out set is thin (47 labels). **Flagging for Knight too** — if you hit the same
`ndx analyze` step, you'll hit this same wall; worth checking your own environment's `claude` CLI
availability before assuming it's just this machine.

Reported the blocker to the user rather than guessing at credentials or paths — needs either the
`claude` CLI installed, an `ANTHROPIC_API_KEY`, or an existing binary path to point
`llm.claude.cli_path` at. Everything past Step 2b (Step 5's gate, Steps 6-8's production wiring) is
still ahead and unaffected by this — it's purely a data-generation blocker.

### 2026-08-11 — ADR + IMPL drafted for the ELM pre-filter

Wrote `Claude-Context/ADR/ADR-2026-08-11-jarrett-elm-prefilter-classify.md` and
`Claude-Context/IMPL/IMPL-2026-08-11-jarrett-classify-elm-swap.md`, and claimed `TJ-A1` in
`BACKLOG.md`. Captures the design from this session's discussion: ELM sits between the two existing
passes as a pre-filter over `classifyFile`'s leftovers, single base `ELM` (text mode) first per
Knight's `DeepELM`-is-overkill read, chain/kernel variants deferred until a held-out accuracy check
says the simple model isn't enough. ADR's Evidence section is explicitly unmeasured — states
methodology only (task framing, split plan, seed requirement, random-baseline-vs-measured gate) so
Status stays Proposed until the IMPL's eval script actually runs.

Status is `BLOCKED`, not `IN-PROGRESS`: the IMPL surfaced four open questions (worktree vs. shared
checkout, dependency shape, held-out-split codebase, acceptance margin) that block Step 1, none of
which were resolved by this session's design discussion. Flagged in `IN-FLIGHT.md` § 2 for
visibility; no cross-team note needed yet since nothing here touches another team's owned path
(would change if the AsterMind dependency lands in `package.json` — see IMPL Step 1).

### 2026-08-11 — classify.ts verified at file:line; fused-call caveat resolved for this site

Read `packages/sourcevision/src/analyzers/classify.ts` and its call site in full, closing the
"Next up" item above and the file:line-verification the ADR/IMPL both called for before treating
the 2026-07-30 fused-call finding as settled for this specific target.

**Call site confirmed:** `enrichClassificationsWithLLM` fires in Phase 3 of `ndx analyze`
(`packages/sourcevision/src/cli/commands/analyze-phases.ts:218-221`), gated on
`!ctx.fastMode && classifications.summary.totalUnclassified > 0`. Refines the earlier "runs every
`ndx analyze`" framing: skipped by `--fast`/`--lite`, and skipped outright when the algorithmic
pass leaves nothing unclassified.

**Fused-call shape confirmed:** the prompt (`classify.ts:510-519`) asks for
`[{"path","archetype","reason"}]` per file — one round-trip, label + free text, matching the
general pattern. Response mapping (`classify.ts:461-469`): `archetype` is required and validated
against the archetype catalog; `confidence` is hardcoded to `0.7` (never model-derived, so nothing
of value is lost there either); `evidence` is built **only if `item.reason` is present**
(`item.reason ? [...] : undefined`).

**The part that changes the conclusion for this site:** traced every consumer of that `reason`
text. Grepped `signalKind`/`archetypeId`/`.evidence` across the entire `web/src` viewer and server
— zero matches. Its only reader is `classify.ts:500-505` itself, which recycles it as a "partial
signals" hint fed into a *later retry attempt's* prompt — an internal implementation detail, never
shown to a user or read by any other module. Unlike `assessGranularity` (where the free text is
the actual product handed to a person), `enrichClassificationsWithLLM`'s `reason` has **no external
consumer at all**. An ELM swap can supply just the label and drop `reason`/`evidence` for
LLM-classified files entirely, with zero observable regression — no call-splitting required here,
narrowing the general 2026-07-30 caveat for this specific target.

Also read the current `Claude-Context/` state this session (ADR/IMPL/Notes, both stale top-level
`team/*.md` and `team/Jarrett/*.md` are gone — migrated to this file's current location per
`d1692a1d`). ADR is Partially Accepted (Thomas still pending); `Claude-Context/` itself isn't on
`main` yet. Confirmed Knight's 2026-08-11 handoff below is fully consistent with this read.

**Not yet done:** the actual ELM prototype — training-data construction from the algorithmic pass's
evidence scores, feature encoding, and a baseline/seed per `ADR-TEMPLATE.md`'s Evidence-section
requirement if this becomes its own ADR.

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
