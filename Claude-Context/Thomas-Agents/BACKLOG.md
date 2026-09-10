# Team Thomas — Backlog

Open work only. Shipped/merged work drops off. **This file is the source of truth for status and
claims** — a claim that lives in a chat message or an agent's head does not exist.

**Claim protocol:** set `Claimed by` + `Status → IN-PROGRESS`, then **commit**. First commit wins;
if you collide on rebase, pick another item.

**ID format:** `TT-<AGENT INITIAL><n>` — e.g. `TT-A1`.
**Status:** `PENDING` · `IN-PROGRESS` · `BLOCKED (<blocker id>)` · `ONGOING` · `DONE`

| ID | Item | Related ADR / IMPL | Status | Claimed by |
|---|---|---|---|---|
| TT-N1 | Text-encoded ELM classifier for `classify.ts`'s unclassified population | `ADR-2026-08-31-nala-classify-elm-rewrite.md` / `IMPL-2026-08-31-nala-classify-elm-rewrite.md` | IN-PROGRESS — Phase 1 + Phase 2 code done, green (89/89 e2e files, 1996 passed); no branch/PR yet. **2026-09-09: superseded by the classify.ts 3-file split (see TT-B1) — its `classify-elm.ts` was already silently overwritten by Team Jarrett's TJ-A2 merge, leaving classify.ts with a dangling import (see Baymax.md Standing context). Not resuming as-is.** | Nala |
| TT-B1 | Own/build `classify_elm.ts` — the ELM-based half of a new 3-file split (orchestrator + `classify_llm.ts` + `classify_elm.ts`) replacing today's single `classify.ts` | `Claude-Context/Thomas-Agents/Baymax.md` (charter, not yet a standalone ADR/IMPL) | PENDING — charter written, no code yet; blocked on Thomas confirming whether to adopt/extend Team Jarrett's existing `TJ-A2`/`TJ-R2` `classify-elm.ts` or build independently, and on fixing/reassigning the classify.ts import break TT-N1 left behind | Baymax |
