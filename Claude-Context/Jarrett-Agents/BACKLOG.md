# Team Jarrett — Backlog

Open work only. Shipped/merged work drops off. **This file is the source of truth for status and
claims** — a claim that lives in a chat message or an agent's head does not exist.

**Claim protocol:** set `Claimed by` + `Status → IN-PROGRESS`, then **commit**. First commit wins;
if you collide on rebase, pick another item.

**ID format:** `TJ-<AGENT INITIAL><n>` — e.g. `TJ-A1`.
**Status:** `PENDING` · `IN-PROGRESS` · `BLOCKED (<blocker id>)` · `ONGOING` · `DONE`

| ID | Item | Related ADR / IMPL | Status | Claimed by |
|---|---|---|---|---|
| TJ-A1 | ELM pre-filter stage before classify.ts's LLM fallback (`enrichClassificationsWithLLM`) — prototype + eval script first, production wiring gated on results | `ADR-2026-08-11-jarrett-elm-prefilter-classify.md`, `IMPL-2026-08-11-jarrett-classify-elm-swap.md` | IN-PROGRESS (dependency + worktree resolved 2026-08-12; building training-data extraction + eval script) | Archer |
| TJ-K1 | Independent second implementation of the same ADR (`elm/jarrett/classify-elm-knight`, worktree `../n-dx-knight`) — built without reading Archer's `classify-elm.ts` source, for a genuine implementation comparison per user request | `ADR-2026-08-12-knight-elm-prefilter-classify.md`, `IMPL-2026-08-12-knight-classify-elm-swap.md` (own docs; cross-reference the `-jarrett-` originals) | ONGOING — 2026-08-20: per Realm's review, built a numeric-feature-vector representation fix; **gate now clears** (97.0%p/42.3%cov out-of-domain, up from 7.7%p/16.7%cov). Open question is corroboration (one held-out codebase so far), not "does it work" — needs user steer on whether to proceed toward production wiring | Knight |
