# ADR — Redesign the archetype taxonomy instead of optimizing which engine classifies against it

- **Status:** Proposed
- **Date:** 2026-08-24
- **Author:** Archer (Team Jarrett)
- **Supersedes:** `ADR-2026-08-11-jarrett-elm-prefilter-classify.md` — not obsoleted. The ELM-as-
  pre-filter engineering result (`TJ-A1`/`TJ-A2`/`TJ-K1`) stays real and reusable; "superseded" in
  the sense that ADR assumed the current archetype taxonomy is fixed and only the classification
  *engine* was in question. This ADR revisits that assumption — see Consequences.
- **Backlog item:** `TJ-A3`

**Direction confirmed directly with the user, 2026-08-24, after a same-day cross-agent mix-up:**
Knight's urgent note (`Notes/NOTE-knight-to-archer-and-realm-2026-08-24-hard-pivot-away-from-elm-prefilter.md`)
described the pivot as *ELM-derived* taxonomy discovery — clustering over learned embeddings,
no hand-written catalog at all. Checked directly rather than building on a second-hand account:
that is **not** the direction. This ADR — extending/tightening the existing hand-curated
`BUILTIN_ARCHETYPES` catalog using evidence gathered across the investigation — is confirmed
correct. Flagged back to Knight so that note doesn't get acted on as written.

## Context

Across the entire `TJ-A1`/`TJ-A2`/`TJ-K1` investigation (2026-08-11 through 2026-08-24),
`classify.ts`'s archetype taxonomy (`archetypes.ts`, `BUILTIN_ARCHETYPES`, 17 categories) was held
constant while the *engine* classifying against it was varied — algorithmic regex, then LLM, then
ELM (text-mode, then numeric-mode). Even the best-performing configuration found (numeric-feature
ELM, 100% precision @ 59-77% coverage) still leaves a large fraction of files with no confident
label — not because the classifier is weak, but because a real fraction of files don't fit any of
the 17 categories, regardless of which engine is asked to place them there.

**Measured, not estimated** — the unclassified rate after the best available classification effort
(manual labeling to the same standard a real LLM call would produce, per `TJ-A1`'s methodology)
across all 5 codebases gathered during this investigation:

| Codebase | Domain | Unclassified rate |
|---|---|---|
| `AsterMind-Community-Edition` | ML/algorithm library | **40.0%** (52/130) |
| n-dx (this repo) | Dev-tooling monorepo, heavy on internal orchestration/analysis logic | **24.3%** (166/683) |
| `zustand` | Frontend state-management library | **21.4%** (6/28) |
| `express` | Backend web framework | **10.4%** (5/48) |
| `indie-stack` | Full-stack web app (Remix) | **7.1%** (2/28) |

This isn't noise — it tracks cleanly with how "web-application-shaped" a codebase is.
`archetypes.ts`'s 17 categories are heavily weighted toward web-app concepts (`component`,
`route-handler`, `route-module`, `page`, `hook`, `store`, `middleware` — 7 of 17) and serve web
apps well (`indie-stack`, `express`), while non-web-app codebases — a pure ML library, a
dev-tooling CLI, even a state-management *library* as opposed to a state-management *consumer* —
are left with large unclassifiable populations no matter which engine does the classifying.

**Two distinct, specific gaps, found by directly inspecting the unclassified files, not by
guessing:**

**1. Missing categories for coherent, common file kinds.** Grouping n-dx's 166 still-unclassified
files by directory shows large, coherent clusters with no home in the current taxonomy:
- `packages/sourcevision/src/analyzers/*` (31 files) + `packages/hench/src/agent/analysis/*` (9) +
  `packages/rex/src/analyze/*` (13) — analysis/detection/classification logic (`classify.ts`
  itself, `callgraph-findings.ts`, `risk-scoring.ts`, `spin.ts`, `stuck.ts`, `decompose.ts`,
  `reason.ts`). A real, common category ("analyzer") this taxonomy has no bucket for.
- `packages/hench/src/tools/*` (12 files) — agent-callable tool implementations (`files.ts`,
  `git.ts`, `shell.ts`, `dispatch.ts`). Distinct from `service` (external API client) and
  `cli-command` (user-facing subcommand).
- `packages/hench/src/agent/lifecycle/*` (11) + `packages/hench/src/process/*` (6) — loop/lifecycle
  orchestration (`loop.ts`, `cli-loop.ts`, `heartbeat.ts`).

`AsterMind-Community-Edition`'s gap is sharper and narrower: **42 of its 52 unclassified files are
algorithm/model implementations** — `src/elm/*` (21), `src/pro/elm/*` (5), `src/ml/*` (2),
`src/synth/generators/*` (5), `src/tasks/*` (9). Zero archetype fits any of this today.

**2. Same-word, different-domain collisions** — signal patterns that fire (or should fire, but on
the wrong sense of a word):
- `store`: matches React/Redux-style state stores correctly, but the same word means backend
  persistence (`branch-work-store.ts` in sourcevision) or a session store
  (`examples/session/redis.js` in express) — different domains, same lexical signal.
- `hook`: matches React hooks correctly, but `token-validation-hook.ts` (hench) uses "hook" in the
  generic callback sense — no `useX` naming, no `/hooks/` directory, just a confusable word.
- `middleware`: matches HTTP middleware correctly, but Zustand's own `src/middleware.ts` is
  *state-store* middleware — a different framework concept wearing the same name.
- `model`: matches data/ORM models correctly, but AsterMind's ELM implementations are ML models —
  same word, unrelated meaning, zero disambiguation today.

This ADR proposes fixing the taxonomy itself — the shared bottleneck under every engine tested —
rather than continuing to optimize which engine classifies against a taxonomy with structural gaps.

## Decision

Redesign `BUILTIN_ARCHETYPES` (`packages/sourcevision/src/analyzers/archetypes.ts`) in two parts:

**1. Add archetypes for the gaps found above**, each backed by a real, named cluster of files from
this investigation's own data, not a hypothetical:
- **`analyzer`** — analysis/detection/scoring/classification logic. Signals: directory patterns
  (`/analyzers/`, `/analysis/`), filename patterns (`*-classifier.ts`, `*-scoring.ts`,
  `*-detection.ts`, `*-findings.ts`).
- **`algorithm`** — self-contained computational/ML algorithm implementations. Signals: directory
  patterns (`/elm/`, `/ml/`) — acknowledged as narrower and more domain-specific than other
  archetypes; may need per-project extension via `.n-dx.json` custom archetypes rather than a
  one-size-fits-all built-in signal set, since "algorithm" file-naming conventions vary far more
  across the ecosystem than "component" or "route-handler" do. See IMPL open questions.
- **`tool`** (or `agent-tool`) — callable tool implementations in an agent/plugin system, distinct
  from `cli-command` (user-facing) and `service` (external API). Signal: `/tools/` directory
  pattern.
- **`orchestrator`** (tentative — weakest evidence of the four, see Alternatives) — loop/lifecycle
  coordination logic.

**2. Tighten signal precision for the four collision-prone archetypes** so they require
corroborating context, not just a lexical match:
- `store`: require either a React/Redux/Zustand import, or the `/store(s)/` directory pattern *and*
  absence of backend-only signals — concrete pattern design deferred to the IMPL, not just intent.
- `hook`: keep the `use[A-Z]` filename requirement; make directory-only matches (no naming
  convention) score lower — directory alone is weaker evidence than the naming convention.
- `middleware`: disambiguate HTTP middleware (Express/Koa/Fastify import present) from
  state-management middleware (Zustand/Redux import present) — possibly two archetypes rather than
  one ambiguous `middleware`, pending broader-corpus evidence.
- `model`: leaning toward leaving `model` as data/ORM-only and letting `algorithm` absorb ML models
  entirely, rather than renaming `model` — simpler, no downstream rename required. Confirm in IMPL.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Keep optimizing the classification engine (continue `TJ-A2`'s ELM production wiring) | Already tried three engines against the same taxonomy; the unclassified rate's correlation with "how web-app-shaped is this codebase" doesn't change with the engine — that's evidence the bottleneck is the categories, not the classifier. Doesn't waste `TJ-A2`'s work (see Consequences) — it means the engine question and the taxonomy question are separable, and the taxonomy one has been unaddressed the whole time. |
| Let each project define custom archetypes via `.n-dx.json` and leave `BUILTIN_ARCHETYPES` alone | Already possible today (`customArchetypes` in `ClassifyOptions`) and doesn't need this ADR — but it puts the burden on every project to independently rediscover the same gaps (`analyzer`, `algorithm`, `tool`) this investigation already found repeatedly across unrelated codebases. Common patterns belong in the built-in set; project-specific ones stay custom. |
| Add `orchestrator` alongside the other three now | Weakest evidence of the four — `loop.ts`/`cli-loop.ts`/`heartbeat.ts` are a real cluster (17 files) but smaller and more n-dx/hench-specific than `analyzer` (evidenced across n-dx *and* rex) or `algorithm` (evidenced strongly in AsterMind). Flagged tentative, not committed, pending the IMPL's cross-codebase check. |
| Redesign the taxonomy from scratch | The existing 17 categories work well for their target case — `indie-stack` and `express` both classify at 90%+ *before* this change. No reason to discard what's working; extend and tighten what isn't. |

## Consequences

**Easier:** every classification engine benefits simultaneously — the ELM work from
`TJ-A1`/`TJ-A2`/`TJ-K1` isn't wasted, it gets *better* once there's more for it to learn (the "no
clear fit" population that made out-of-domain generalization hard specifically included many of
these gap-category files). A wider, more precise taxonomy is also a direct win for the purely
algorithmic first pass — more files resolve for free, before any engine needs to run at all.

**Harder:** every new archetype needs real `analysisHints` values (dead-export policy,
hub-threshold multipliers), not placeholders. Existing `.n-dx.json` projects with `overrides`
referencing old archetype IDs would need a migration path if any renames land — though this repo
has no such overrides today.

**Which teams are affected:** none outside Team Jarrett as scoped — same territory
(`packages/sourcevision`) as `TJ-A1`/`TJ-A2`. `archetypes.ts` is read by the web dashboard (zone
risk-scoring, `get_classifications` MCP tool) and rex (via sourcevision's exported types) — additive
(new/renamed IDs), not a breaking schema change, but worth an `IN-FLIGHT.md` flag since it's a
widely-read file.

**Migration cost:** contained to `archetypes.ts` plus auditing for hardcoded archetype-ID
references elsewhere in sourcevision (see IMPL). Re-running classification is non-destructive —
classification is always recomputed fresh, never diffed against old archetype IDs.

## Evidence

**Not an ELM-viability claim — no seed/baseline/accuracy section applies**, per
`ADR-TEMPLATE.md`'s own carve-out for non-ELM claims. The evidence here is direct inspection of
unclassified-file clusters across 5 real codebases already gathered and merged during `TJ-A1`:
n-dx's own `.sourcevision/`, `AsterMind-Community-Edition/.sourcevision/`, and the three corpora
under `elm-training-corpora/` (`express`, `indie-stack`, `zustand`). Every cluster and count cited
in Context is reproducible by re-running the same directory grouping against those files — the
underlying `classifications.json` files are on disk, not sampled or estimated.

**What would falsify this ADR's premise:** if, after adding the proposed archetypes and tightening
the four collision-prone signals, the unclassified rate on these same 5 codebases doesn't
meaningfully drop, that's evidence the gaps were smaller than they looked or mis-diagnosed. The
IMPL's before/after re-classification is the actual test — not this section's cluster-counting
alone.
