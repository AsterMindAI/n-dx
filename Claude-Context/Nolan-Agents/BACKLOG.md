# Team Nolan — Backlog

Open work only. Shipped/merged work drops off. **This file is the source of truth for status and
claims** — a claim that lives in a chat message or an agent's head does not exist.

**Claim protocol:** set `Claimed by` + `Status → IN-PROGRESS`, then **commit**. First commit wins;
if you collide on rebase, pick another item.

**ID format:** `TN-<AGENT INITIAL><n>` — e.g. `TN-A1`.
**Status:** `PENDING` · `IN-PROGRESS` · `BLOCKED (<blocker id>)` · `ONGOING` · `DONE`

| ID | Item | Related ADR / IMPL | Status | Claimed by |
|---|---|---|---|---|
| TN-J1 | Survey the monorepo for LLM call sites replaceable by ELM/KELM to cut token spend; characterise each as classification-shaped vs open-ended, then propose a three-way split across Teams Nolan / Jarrett / Thomas. **Delivered:** 22 call sites triaged, only 2 replaceable; split proposed. | [`ADR-2026-08-11-jam-elm-replacement-survey-and-split.md`](../ADR/ADR-2026-08-11-jam-elm-replacement-survey-and-split.md) | DONE | Jam (Team Nolan) |
| TN-J2 | Get the split ADR accepted, amended, or rejected by the three leads, then claim whichever stream Team Nolan takes. Blocked on a collective-command decision, not on work. | [`ADR-2026-08-11-jam-elm-replacement-survey-and-split.md`](../ADR/ADR-2026-08-11-jam-elm-replacement-survey-and-split.md) | PENDING | _(unclaimed — needs the three leads)_ |
| TN-J3 | **Token accounting reads zero.** All 6 `.hench/runs/*.json` record `tokenUsage {"input":0,"output":0}` though the parsers exist (`cli-provider.ts:348-385`, `api-provider.ts:184`). Root-cause not chased — outside TN-J1. Until this is fixed the ELM project has no baseline and cannot report a saving. | — | PENDING | _(unclaimed)_ |
