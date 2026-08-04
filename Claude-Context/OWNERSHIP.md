# Ownership map

Rename `Intern-A/B/C` to the real agent names in `Claude-Agents/` before starting work.
If you need to edit a path you don't own, do not edit it — file an entry in
`IN-FLIGHT.md` describing the change you need, and note it in your handoff.

## Why this split

The three workstreams are separated by **merge surface**, not by difficulty. Each intern
should be able to work a full day without touching a file another intern has open.
The `llm-client` foundation is deliberately owned by one person, because everything
imports it and three-way conflicts there are the most expensive kind.

## Assignments

| Owner | Paths | Workstream |
|-------|-------|------------|
| **Intern-A** | `packages/llm-client/**` | The ELM provider itself: a new vendor registered through `ProviderRegistry.register()`, its config schema, model loading, and the adapter that makes an ELM satisfy `LLMProvider`. Owns the shared type surface, so A unblocks B and C. |
| **Intern-B** | `packages/sourcevision/src/analyzers/**`, `scripts/elm-*` | Call-site migration in sourcevision — `classify.ts`, `enrich.ts`, `claude-client.ts`. This is the highest-value target: archetype classification is the exact shape the hello-world proved out. Also owns training-data extraction and eval scripts. |
| **Intern-C** | `packages/hench/src/agent/**`, `packages/hench/src/prd/llm-gateway.ts`, `packages/rex/**` | Call sites in hench and rex. Mostly agentic/generative — expect a lot of "ELM is the wrong tool here" findings, which are legitimate ADR output. Also owns the fallback path: what happens when the ELM declines or scores low-confidence. |

## Shared — nobody edits unilaterally

Claim in `IN-FLIGHT.md`, make the change small, merge it same day.

- `package.json`, `pnpm-lock.yaml` (root and per-package)
- `CLAUDE.md`, `AGENTS.md`, `packages/core/assistant-assets/**`
- `tests/e2e/**` (architecture policy tests — changing these changes everyone's rules)
- `.n-dx.json`

## Untracked-state hazard

`.rex/`, `.sourcevision/`, `.hench/` are mutable on-disk state, and the repo's own
concurrency contract says concurrent writers lose data silently. Two options — pick one
as a team and write it here:

- **Worktree isolation (recommended):** each intern runs
  `git worktree add ../n-dx-<name> -b elm/<name>/<topic>`, giving them their own `.rex/`
  and `.sourcevision/`. No claiming needed for local runs.
- **Shared checkout:** every `ndx plan|work|ci|refresh|self-heal` must be claimed in
  `IN-FLIGHT.md` first, and released after.

Team choice: _<fill in>_

## Reserved numbering ranges

So two people never mint the same ADR number.

| Owner | ADR range | IMPL range |
|-------|-----------|------------|
| Intern-A | 100–199 | 100–199 |
| Intern-B | 200–299 | 200–299 |
| Intern-C | 300–399 | 300–399 |
| Joint / Nolan | 001–099 | 001–099 |
