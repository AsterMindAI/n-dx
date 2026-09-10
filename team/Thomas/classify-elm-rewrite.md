# Pointer — ELM-based classify.ts rewrite

`team/Thomas/` predates this repo's `Claude-Context/` documentation system (see
[`Claude-Context/ADR/ADR-2026-08-05-nolan-single-fork-and-unified-agent-structure.md`](../../Claude-Context/ADR/ADR-2026-08-05-nolan-single-fork-and-unified-agent-structure.md) —
still Proposed, not yet agreed by all three leads). The canonical docs for this work live there,
not here:

- ADR: [`Claude-Context/ADR/ADR-2026-08-31-nala-classify-elm-rewrite.md`](../../Claude-Context/ADR/ADR-2026-08-31-nala-classify-elm-rewrite.md)
- IMPL: [`Claude-Context/IMPL/IMPL-2026-08-31-nala-classify-elm-rewrite.md`](../../Claude-Context/IMPL/IMPL-2026-08-31-nala-classify-elm-rewrite.md)

**2026-09-09 update:** this line of work is superseded by a new 3-file split of `classify.ts`
(orchestrator + `classify_llm.ts` + `classify_elm.ts`). The ELM half is now a dedicated agent
assignment, not a rewrite-in-place of `classify.ts` — canonical doc:
[`Claude-Context/Thomas-Agents/Baymax.md`](../../Claude-Context/Thomas-Agents/Baymax.md).

This file is a pointer only, kept here at Thomas's request so it's discoverable from both
locations. Edit the canonical copies above, not this one.
