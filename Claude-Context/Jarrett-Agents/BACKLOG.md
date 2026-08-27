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
| TJ-A2 | Production-harden the ELM pre-filter: model lifecycle, schema widening, real wiring into `runClassificationsPhase`, config kill-switch, test coverage. **Sole focus per the user's 2026-08-27 instruction** — `TJ-A3` reassigned away from Archer (see that row); Knight's continued involvement here is unconfirmed, may be reassigned too | `ADR-2026-08-11-jarrett-elm-prefilter-classify.md`, `IMPL-2026-08-23-jarrett-classify-elm-production-hardening.md` | IN-PROGRESS — steps 1-9 done (lifecycle, schema, wiring, kill-switch, unit+integration tests, 28 tests total). Shipped with `elmPrefilter.enabled` defaulted to **false**: a "zero-evidence population" gap means 100% of files reaching the pre-filter have all-zero feature vectors, now a *structural* guard in `classifyWithELM` (not just calibration luck) so no threshold override can bypass it. `pnpm build/typecheck/test` clean for `@n-dx/sourcevision`. Remaining: regression fixture (step 10), whole-repo build check (step 11), and — the real blocker — a feature representation that works on zero-evidence files, before `enabled` can flip to `true` | Archer |
| TJ-A3 | Extend/tighten the hand-curated archetype catalog (`BUILTIN_ARCHETYPES`) — see ADR/IMPL for the full evidence and plan | `ADR-2026-08-24-jarrett-archetype-taxonomy-redesign.md`, `IMPL-2026-08-24-jarrett-archetype-taxonomy-redesign.md` | **Reassigned away from Archer, 2026-08-27** — user redirected Archer to work "strictly on the ELM alone" (`TJ-A2`); a different agent covers overall-improvement work going forward. Docs left intact for whoever picks it up next — no worktree/branch was created, no code exists yet | Unassigned |
| TJ-R1 | Strategic pivot: ELM becomes primary classifier for the hard-case population, LLM becomes true last-resort (not a narrow pre-filter) — decision + doc updates only, no new code. Triggered by triple-independent verification (Archer, Knight, Realm's reproduction of both agents' real committed eval scripts) | `ADR-2026-08-24-realm-elm-primary-classifier-pivot.md`, `IMPL-2026-08-24-realm-elm-primary-classifier-pivot.md` | DONE, threshold finding now provisional — see `TJ-A2` row. Decision itself (ELM as primary against whatever catalog exists) still holds; the specific number was measured against the pre-`TJ-A3` catalog | Realm |
