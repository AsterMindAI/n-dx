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
| TJ-A2 | Production-harden the ELM pre-filter: model lifecycle, schema widening, real wiring into `runClassificationsPhase`, config kill-switch, test coverage | `ADR-2026-08-11-jarrett-elm-prefilter-classify.md`, `IMPL-2026-08-23-jarrett-classify-elm-production-hardening.md` | IN-PROGRESS — user confirmed hybrid model lifecycle (option C) 2026-08-24; Knight executing the plan in `../n-dx-jarrett` per the user's instruction to work within `TJ-A2` rather than run a separate `TJ-K1` production plan | Archer + Knight |
