# Team Nolan — Backlog

Open work only. Shipped/merged work drops off. **This file is the source of truth for status and
claims** — a claim that lives in a chat message or an agent's head does not exist.

**Claim protocol:** set `Claimed by` + `Status → IN-PROGRESS`, then **commit**. First commit wins;
if you collide on rebase, pick another item.

**ID format:** `TN-<AGENT INITIAL><n>` — e.g. `TN-A1`.
**Status:** `PENDING` · `IN-PROGRESS` · `BLOCKED (<blocker id>)` · `ONGOING` · `DONE`

| ID | Item | Related ADR / IMPL | Status | Claimed by |
|---|---|---|---|---|
| TN-J1 | Survey the monorepo for LLM call sites replaceable by ELM/KELM to cut token spend (starting set: rex placement, sourcevision classification, `enrichClassificationsWithLLM` at `packages/sourcevision/src/analyzers/classify.ts:328`); characterise each as classification-shaped vs open-ended, then propose a three-way split of the migration across Teams Nolan / Jarrett / Thomas. | ADR to be written (`ADR-2026-08-10-jam-*`) | IN-PROGRESS | Jam (Team Nolan) |
