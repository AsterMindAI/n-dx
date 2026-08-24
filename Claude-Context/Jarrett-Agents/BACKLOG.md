# Team Jarrett — Backlog

Open work only. Shipped/merged work drops off. **This file is the source of truth for status and
claims** — a claim that lives in a chat message or an agent's head does not exist.

**Claim protocol:** set `Claimed by` + `Status → IN-PROGRESS`, then **commit**. First commit wins;
if you collide on rebase, pick another item.

**ID format:** `TJ-<AGENT INITIAL><n>` — e.g. `TJ-A1`.
**Status:** `PENDING` · `IN-PROGRESS` · `BLOCKED (<blocker id>)` · `ONGOING` · `DONE`

| ID | Item | Related ADR / IMPL | Status | Claimed by |
|---|---|---|---|---|
| TJ-A1 | ELM pre-filter stage before classify.ts's LLM fallback — prototype/eval phase. Numeric feature representation clears the gate (100% @ 59% coverage out-of-domain); independently confirmed by Knight's `TJ-K1` (97.0% @ 42.3% on the same held-out set) | `ADR-2026-08-11-jarrett-elm-prefilter-classify.md`, `IMPL-2026-08-11-jarrett-classify-elm-swap.md` | DONE — superseded by `TJ-A2` for production wiring | Archer |
| TJ-A2 | Production-harden the ELM pre-filter: model lifecycle, schema widening, real wiring into `runClassificationsPhase`, config kill-switch, test coverage. **Orthogonal to `TJ-A3`, not superseded by it** — confirmed 2026-08-24 (see `TJ-A3`'s ADR header) | `ADR-2026-08-11-jarrett-elm-prefilter-classify.md`, `IMPL-2026-08-23-jarrett-classify-elm-production-hardening.md` | IN-PROGRESS — model lifecycle (hybrid, option C) and pooling-corpus question resolved 2026-08-24; extraction reworked to reuse `analyzeClassifications()` per Knight's critique. `TJ-R1`'s threshold default (t≈0.11-0.15) is provisional pending re-verification once `TJ-A3`'s catalog changes land — label set changes, old number may not transfer. Next: schema/wiring changes (IMPL steps 4+) | Archer + Knight |
| TJ-A3 | Extend/tighten the hand-curated archetype catalog (`BUILTIN_ARCHETYPES`): new `analyzer`/`algorithm`/`tool` archetypes, fix 4 same-word-different-domain signal collisions (`store`/`hook`/`middleware`/`model`) — grounded in real unclassified-file gaps found across all 5 gathered codebases, not hypothetical. **Confirmed direction 2026-08-24, correcting Knight's urgent note which had described a different pivot (ELM-derived taxonomy via clustering) that was not what the user meant** | `ADR-2026-08-24-jarrett-archetype-taxonomy-redesign.md`, `IMPL-2026-08-24-jarrett-archetype-taxonomy-redesign.md` | IN-PROGRESS — plan written, new worktree/branch not yet created | Archer |
| TJ-R1 | Strategic pivot: ELM becomes primary classifier for the hard-case population, LLM becomes true last-resort (not a narrow pre-filter) — decision + doc updates only, no new code. Triggered by triple-independent verification (Archer, Knight, Realm's reproduction of both agents' real committed eval scripts) | `ADR-2026-08-24-realm-elm-primary-classifier-pivot.md`, `IMPL-2026-08-24-realm-elm-primary-classifier-pivot.md` | DONE, threshold finding now provisional — see `TJ-A2` row. Decision itself (ELM as primary against whatever catalog exists) still holds; the specific number was measured against the pre-`TJ-A3` catalog | Realm |
