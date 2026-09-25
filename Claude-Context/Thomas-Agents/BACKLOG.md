# Team Thomas — Backlog

Open work only. Shipped/merged work drops off. **This file is the source of truth for status and
claims** — a claim that lives in a chat message or an agent's head does not exist.

**Claim protocol:** set `Claimed by` + `Status → IN-PROGRESS`, then **commit**. First commit wins;
if you collide on rebase, pick another item.

**ID format:** `TT-<AGENT INITIAL><n>` — e.g. `TT-A1`.
**Status:** `PENDING` · `IN-PROGRESS` · `BLOCKED (<blocker id>)` · `ONGOING` · `DONE`

| ID | Item | Related ADR / IMPL | Status | Claimed by |
|---|---|---|---|---|
| TT-N1 | Text-encoded ELM classifier for `classify.ts`'s unclassified population | `ADR-2026-08-31-nala-classify-elm-rewrite.md` / `IMPL-2026-08-31-nala-classify-elm-rewrite.md` | IN-PROGRESS — Phase 1 + Phase 2 code done, green (89/89 e2e files, 1996 passed); no branch/PR yet — see IMPL Open questions | Nala |
