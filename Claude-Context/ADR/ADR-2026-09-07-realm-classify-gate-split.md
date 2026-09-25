# ADR — Split classify.ts into a gate plus two owned classifier modules (classify-ELM.ts, classify-LLM.ts)

- **Status:** Proposed — this reorganizes a file Team Thomas already has merged code in
  (`classify.ts`'s `TT-N1` wiring). Per `Command-Structure`'s collective-command rule, this needs
  Thomas's (Nala's) sign-off before it moves to Accepted, not just Team Jarrett's. Not to be
  treated as decided until that happens.
- **Date:** 2026-09-07
- **Author:** Realm (Team Jarrett), at the user's direction
- **Supersedes:** none outright. Reorganizes the call-site shape both
  `ADR-2026-08-31-realm-path-based-elm-classifier.md` (`TJ-R2`) and Team Thomas's
  `ADR-2026-08-31-nala-classify-elm-rewrite.md` (`TT-N1`) assumed — see Consequences for what
  changes and what doesn't for each.
- **Backlog item:** `TJ-R3`

## Context

Two teams independently built an ELM-based fix for the same problem — the evidence-vector
representation produces zero signal on `classify.ts`'s real unclassified population — and neither
knew about the other (`Notes/NOTE-jarrett-internal-2026-09-07-classify-elm-collision.md`,
`Thomas-Agents/Notes/NOTE-jarrett-to-thomas-2026-09-07-classify-elm-collision.md`). Part of why
this collision is expensive to untangle: **both designs bake their classifier's own logic directly
into `classify.ts`'s `enrichClassificationsWithLLM`, or into orchestration code that still assumes
a specific pipeline shape.** There's no clean seam to swap one classifier for another, compare them,
or turn either off without touching the function that also holds the LLM-calling logic.

`classify.ts` today holds three responsibilities in one function: the algorithmic pass
(`classifyFile`, unaffected by this ADR), and — inside `enrichClassificationsWithLLM` as currently
merged — both the ELM gate/call (`TT-N1`'s addition) and the original LLM-calling logic
(`callClaude`, batching, retry/degrade, JSON-parse fallback). Whichever classifier "wins" the
`TT-N1`/`TJ-R2` reconciliation, this three-way mixing is itself a real cost: it's why `TT-N1`
landed as an edit to `classify.ts` at all, and it's why comparing `TT-N1` against `TJ-R2` requires
reading two different call shapes rather than swapping one module for another under a shared
interface.

## Decision

Split `classify.ts` into three files by responsibility:

1. **`classify.ts` becomes the gate.** Keeps the algorithmic pass (`classifyFile`, untouched) and
   the routing decision for whatever it leaves at `archetype: null`. For each such file: call
   `classify-ELM.ts`'s classifier first. If it returns a confident result, done. If it returns
   `null` (not confident, or not enough training data — see below), call `classify-LLM.ts` for
   that file next. **`classify.ts` is the only file that ever calls either classifier — neither
   classifier file calls the other.** This is a deliberate choice, not the only option (see
   Alternatives): it keeps the dependency graph a hub-and-spoke (`classify.ts` → each classifier)
   instead of a chain (`classify-ELM.ts` → `classify-LLM.ts`), matching this codebase's existing
   gateway-module convention (`CLAUDE.md`, "Gateway modules") of concentrating a routing decision
   in one place rather than spreading it across the modules being routed between.
2. **`classify-ELM.ts` owns ELM classification, full stop.** Exports one function with a stable
   shape: given the current run's `Classifications` (for training data) and a file needing a
   label, return either a confident `FileClassification` or `null`. It has no knowledge that an
   LLM fallback exists — that's `classify.ts`'s decision to make after seeing `null`, not something
   baked into this module's control flow. **This ADR does not decide which of `TT-N1`'s (path-only)
   or `TJ-R2`'s (path+export) representation becomes the actual body of this function** — that's
   the orthogonal representation question the collision notes already raised, and is out of scope
   here (see Out of scope).
3. **`classify-LLM.ts` owns LLM classification, full stop.** Extracted from `classify.ts`'s current
   `enrichClassificationsWithLLM`/`classifyBatchWithLLM`/`buildLLMClassifyPrompt` and the
   retry/degrade machinery (`computeLLMClassifyAttempts`, `tryParseClassifyResponse`) — moved, not
   rewritten. Same batching, same prompt, same behavior; only the file it lives in changes.
4. **The ELM enable/disable kill switch moves to `classify.ts`'s gate, and becomes config-driven**
   (`.n-dx.json`, matching the pattern `IMPL-2026-08-23-jarrett-classify-elm-production-hardening.md`
   already established for `TJ-A2` — `sourcevision.classification.elmPrefilter.enabled`) rather
   than `TT-N1`'s hardcoded `ELM_GATE_ENABLED` source constant. One kill switch, one place, whichever
   classifier is behind it. This directly answers the gate-improvement gap raised in this session's
   earlier discussion (hardcoded constant vs. runtime config).

**What doesn't move:** the algorithmic pass, its threshold, and its output shape. The
`FileClassification` schema. Both classifiers' actual training/prediction logic — this is a file
reorganization plus a routing-ownership decision, not a rewrite of either classifier's internals.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep `TT-N1`'s shape — ELM and LLM both inline in `classify.ts` | Is the status quo this ADR exists to fix — no seam to compare, swap, or independently test either classifier; every future classifier change is an edit to the function that also does LLM batching. |
| `TJ-R2`'s shape — orchestrate from `analyze-phases.ts`, `classify.ts` untouched | Doesn't resolve the actual collision, since `TT-N1` already changed `classify.ts` and is merged — this option would leave two live call shapes (one in `classify.ts`, one in `analyze-phases.ts`) rather than one. Also doesn't give the LLM-calling logic its own seam the way this ADR's split does. |
| `classify-ELM.ts` calls `classify-LLM.ts` internally as its own fallback, returns one final result to `classify.ts` | Considered and rejected in this session's design discussion before this ADR was written. Couples the two classifier files to each other — a future third engine, or a per-classifier kill switch, has to be wired into whichever file is currently "in charge" of the chain instead of into one gate. |
| Merge both classifiers into one file with an internal branch | Reintroduces the original problem in a different shape — one file, multiple responsibilities, no seam. The whole point is that `classify-ELM.ts` and `classify-LLM.ts` can change independently without touching each other or the gate's routing logic. |

## Consequences

**Easier:** either classifier can be swapped, disabled, or unit-tested in isolation. The
`TT-N1`/`TJ-R2` representation question becomes "which body goes in `classify-ELM.ts`," a much
smaller decision than "which of two different call-site architectures wins." The LLM path gets a
real seam of its own for the first time — useful independent of this specific collision, since
`assessGranularity` and other classifier call sites flagged in the 2026-07-30 survey could
eventually follow the same pattern if this holds up.

**Harder:** this is a real migration for whichever `TT-N1` code is currently merged — Nala's inline
gate logic has to move into `classify.ts`'s new routing shape, and their ELM logic has to conform to
`classify-ELM.ts`'s stable interface rather than whatever shape it's in today. Team Jarrett's
`TJ-R2` work also has to target this interface once representation is settled, rather than whatever
shape it would have shipped as via `analyze-phases.ts`. **This is real work for both teams, not a
free reorganization** — worth being direct about that before either side signs off.

**Which teams affected:** both Jarrett and Thomas, directly — this is exactly why Status stays
Proposed pending Thomas's sign-off, not something Team Jarrett can unilaterally accept per
`Command-Structure`'s collective-command rule for anything hard to reverse or cross-team.

**Migration cost:** contained to `packages/sourcevision/src/analyzers/{classify,classify-elm,classify-llm}.ts`
and their direct tests. No schema change — `FileClassification`'s shape is unaffected, so nothing
downstream (web dashboard, rex) needs to change.

## Out of scope (explicitly)

- **Which ELM representation (`TT-N1`'s path-only vs. `TJ-R2`'s path+export) becomes
  `classify-ELM.ts`'s actual implementation.** Orthogonal question, still open, tracked in the
  collision notes — this ADR only decides the file/routing shape both would need to fit into
  either way.
- **`TJ-A3`'s archetype-catalog work** — unaffected; whichever catalog is live, the gate/router
  shape doesn't change.
- **Applying this split pattern to other classifier call sites** (`assessGranularity`, etc.) —
  mentioned in Consequences as a possible future direction, not part of this IMPL.

## Evidence

**Not an ELM-viability claim — no seed/baseline/accuracy section applies**, per `ADR-TEMPLATE.md`'s
carve-out for non-ELM claims (this is a module-boundary/routing decision, same carve-out
`ADR-2026-08-24-jarrett-archetype-taxonomy-redesign.md` used). The accuracy evidence for either
candidate classifier already exists and isn't re-derived here: `TT-N1`'s 90.6% k-fold number
(`scripts/classify-elm-eval-results.md`) and `TJ-R2`'s in-progress zero-evidence-population eval
(`IMPL-2026-08-31-realm-path-based-elm-classifier.md`, steps 5-6, currently on hold pending this
reconciliation). Whichever representation is chosen for `classify-ELM.ts`, its accuracy claim
stands on its own ADR's evidence — this document is about where the code lives and who calls whom,
not about whether either classifier works.
