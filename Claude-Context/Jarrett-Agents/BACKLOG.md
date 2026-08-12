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
