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
| TN-F1 | **The documented branch convention has never been used.** Four docs (`GITHUB-WORKFLOW.md` § 2, `OWNERSHIP.md` § Naming, `claude-context-instruction` § 4, `Command-Structure` § Rules) specify `elm/<lead>/<topic>` → `origin/main`; reality is `<TeamName>` → `dev` → `main`, and no `elm/*` branch has ever existed on any remote. Worse, **`origin/main` carries no `Claude-Context/` at all**, so `NEW-AGENT.md`'s worktree step produces a worktree with no agent system in it. Reconcile all four docs in one pass. Needs the three leads — a rule binding every team is a collective decision, so ADR first, edit after. **ADR submitted; the doc edits wait on the leads.** | [`ADR-2026-08-11-fluff-branch-and-base-conventions.md`](../ADR/ADR-2026-08-11-fluff-branch-and-base-conventions.md) | IN-PROGRESS | Fluff (Team Nolan) |
| TN-F2 | **Note filenames addressed agent-to-lead instead of lead-to-lead.** Lead's call, 2026-08-11: `NOTE-<from-lead>-to-<to-lead>-…`, intern names only, drafting agent named in the body. Renamed all four Team Nolan outbound notes, updated the convention in `Command-Structure`, `claude-context-instruction`, `OWNERSHIP.md`, and all three `Notes/README.md`, and notified Teams Jarrett and Thomas. Within-team form `NOTE-<lead>-internal-…` was my call, flagged for override. | — (lead's directive, no ADR) | DONE | Fluff (Team Nolan) |
| TN-F3 | **Notes were written but never delivered, and nothing at startup looked for them.** Six Team Nolan notes existed only on `Nolan-Work` — `origin/Jarrett` had one from Aug 5, `Thomas_Branch` had none. Separately, neither auto-loaded file (`CLAUDE.md`, `AGENTS.md`) references `Claude-Context` at all, so an agent only reads its inbox if a human pastes the prompt telling it to. Fixed the delivery half by merging `Nolan-Work` → `dev` (`d1967288`); added `Claude-Context/hooks/unread-notes.sh` as a **local-only, never-committed-wiring** inbox reader. Jarrett and Thomas must still merge `dev` into their branches. | — (lead's directive) | DONE | Fluff (Team Nolan) |
| TN-J3 | **Token accounting reads zero.** All 6 `.hench/runs/*.json` record `tokenUsage {"input":0,"output":0}` though the parsers exist (`cli-provider.ts:348-385`, `api-provider.ts:184`). Root-cause not chased — outside TN-J1. Until this is fixed the ELM project has no baseline and cannot report a saving. | — | PENDING | _(unclaimed)_ |
