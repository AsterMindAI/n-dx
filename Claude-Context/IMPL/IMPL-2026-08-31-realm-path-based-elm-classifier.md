# IMPL — Path/export-based feature representation for the ELM pre-filter, validated against the zero-evidence population

- **Implements:** `ADR-2026-08-31-realm-path-based-elm-classifier.md`
- **Owner:** Archer, claimed 2026-09-04 (see
  `Notes/NOTE-archer-to-knight-and-realm-2026-09-04-tj-r2-claimed-design-only-for-now.md`) —
  natural continuation of `TJ-A2`'s lane, which found this exact gap.
- **Backlog item:** `TJ-R2`
- **Branch:** `elm/jarrett/classify-elm-prefilter` (continuing `TJ-A2`'s worktree — `../n-dx-jarrett`)
- **Worktree:** `../n-dx-jarrett`
- **Status:** Step 4 done (design-only, real code, committed `ae9dc463`). **Soft-gated on `TJ-A3`
  (Knight, `NOTE-knight-to-archer-and-realm-2026-09-03-claiming-tj-a3-gating-tj-r2.md`)** — Steps
  5-6 (the zero-evidence-population eval) wait for `TJ-A3`'s Step 6a re-measurement, since `TJ-A3`
  reshapes the population this eval needs to be measured against. Step 4 itself isn't
  population-dependent, so it proceeded now per the gate's own carve-out.

## Scope

**In scope:**
- A new feature-extraction function in `classify-elm.ts` — path text + raw export names (from
  `imports.json`), not the per-archetype evidence vector (see ADR Decision for why).
- A new or extended eval script measuring against each corpus's **zero-evidence population
  specifically** — the exact file lists are already known from the 2026-08-27 measurement
  (`ADR-2026-08-11-...`'s "Zero-evidence population" table), not re-derived.
- Manual-stand-in labeling of the zero-evidence populations (same method used throughout this
  investigation — no `claude` CLI available), for whichever corpora don't already have labels for
  these specific files.
- Re-running the precision/coverage gate against this new representation and population.
- If the gate clears: wiring the new extraction function into the existing (already-shipped)
  `runClassificationsPhase` call site, and reconsidering `elmPrefilter.enabled`'s default.
- If the gate does not clear: writing that up with the same rigor as every prior result in this
  line of work — this IMPL does not assume a positive outcome.

**Out of scope (explicitly):**
- Reading full file content for additional signal — flagged in the ADR's Alternatives as a fallback
  if path+exports doesn't clear the gate, not part of this attempt.
- Any change to model lifecycle, config surface, or the `runClassificationsPhase` call site's
  shape — `IMPL-2026-08-23`'s wiring stays as built; only what feeds the model changes.
- Retiring the existing evidence-vector extraction code — stays in `classify-elm.ts` for contexts
  where evidence isn't uniformly zero (see ADR Decision, point 3).
- `TJ-A3`'s archetype-taxonomy work — orthogonal, currently unassigned, not part of this IMPL.

## Files touched

| Path | Owning team | New/Edit | Note sent? |
|---|---|---|---|
| `packages/sourcevision/src/analyzers/classify-elm.ts` | unassigned — Team Jarrett scoped | Edit — add path/export-based extraction + training/prediction functions alongside (not replacing) the existing evidence-vector ones | No |
| `packages/sourcevision/scripts/eval-classify-elm-zero-evidence.ts` (new) | unassigned | New — evals specifically against the zero-evidence population per corpus | No |
| `packages/sourcevision/src/cli/commands/analyze-phases.ts` | unassigned | Edit, **only if the gate clears** — swap which extraction function `runClassificationsPhase` calls | No |
| `.n-dx.json` schema / config docs | unassigned | Edit, **only if the gate clears and the default changes** — no schema shape change, just a default-value reconsideration | No |
| `Claude-Context/Jarrett-Agents/BACKLOG.md` | Team Jarrett rollup | Edit — claim `TJ-R2`, then update with real results | No |

## Steps

1. Claim `TJ-R2` in `BACKLOG.md` before starting (claim protocol: set claimant + `IN-PROGRESS`,
   commit — first commit wins).
2. For each of the 5 gathered corpora, extract the zero-evidence file list using the exact method
   from the 2026-08-27 measurement (files where `classifyFile`'s per-archetype score vector is
   all-zero) — these lists should already exist or be trivially reproducible from that session's
   work; don't re-derive the methodology from scratch.
3. Label whichever of these files don't already have `classifications.json` entries, using the
   same manual-stand-in method as every prior round in this investigation (reasoning over path
   against the archetype catalog — `claude` CLI still not assumed available; check first in case
   this has changed).
4. **Done, 2026-09-04.** Wrote `extractPathExportExamples`/`pathExportVector` in
   `classify-elm.ts`, alongside (not replacing) the existing evidence-vector functions.
   Resolved the encoding-shape open question by reading the installed
   `@astermind/astermind-community` v3.0.0 source directly, not assuming:
   - `ELM`'s own `TextConfig` (`useTokenizer: true`) still routes through
     `TextEncoder.textToVector`'s `this.tokenizer.tokenize(text).join('')` — no separator —
     the exact bug Knight's `TJ-K1` found in the retired text-mode code, confirmed still
     present in this version. `TextConfig`'s `useTokenizer` is typed as the literal `true`,
     so there's no way to reach char-mode encoding through `ELM`'s own config surface.
   - `UniversalEncoder` (exported from the package root, not `ELM`-internal) supports
     char-mode directly via `mode: "char"`, which never touches the tokenizer
     (`useTokenizer = merged.mode === "token"` in the bundled source). Constructed
     independently of `ELM` and fed through the existing `NumericConfig` path
     (`trainArchetypeELMNumeric`/`predictArchetypeNumeric`, unchanged — they only consume
     `{vector, archetype}` pairs and don't care what produced the vector).
   - `encode()` takes a single string only — confirmed no structured multi-field option
     exists — so path and export names are concatenated into one string, the same pattern
     the retired `fileToText` used for path + evidence hints.
   - The default `charSet` (26 lowercase letters) and `maxLen` (15) both needed widening:
     the default silently drops digits and path-structural punctuation (`/`, `.`, `-`, `_`),
     and 15 characters is far shorter than a real path. Widened to a reasoned starting
     point (`PATH_EXPORT_CHARSET`/`PATH_EXPORT_MAX_LEN`), explicitly not claimed as
     validated — the exact `maxLen` is a real empirical question for the (still-gated) eval.
   - Sanity-checked directly against real data (not just unit-test fixtures): a genuinely
     zero-evidence path now encodes to a non-zero vector every time, and similar paths
     produce higher cosine similarity than dissimilar ones (0.65 vs 0.50 in a real check),
     suggesting the representation carries real structural signal, not noise — informal,
     not a substitute for the real eval, but a useful sign before investing in one.
5. Write the new eval script, seeded (`20260812` unless a documented reason to change it),
   measuring precision/coverage specifically against the zero-evidence held-out sets from step 2 —
   in-domain (this repo's zero-evidence split) and out-of-domain (`AsterMind-Community-Edition`'s
   zero-evidence set), same two-axis structure as every prior eval in this line of work.
6. Run it. Report the result with the same rigor regardless of outcome — positive or negative, both
   get seed + baseline + the actual numbers in the ADR's Evidence section, not just a summary.
7. **If the gate clears (≥95% precision, ≥15% coverage):** wire the new extraction function into
   `runClassificationsPhase`, replacing the evidence-vector call at that specific site. Reconsider
   `elmPrefilter.enabled`'s default — still needs the same safety-margin thinking `IMPL-2026-08-23`
   applied (kill switch stays, default change is a separate call from "the eval passed").
8. **If the gate does not clear:** write up why with the same rigor as the original zero-evidence
   finding — this is exactly the kind of result this project's doctrine says needs the same care as
   a positive one. Leave `elmPrefilter.enabled` at `false`, update `BACKLOG.md` and the ADR
   honestly, and surface open questions for the next attempt rather than treating it as failure to
   report quietly.
9. `pnpm build && pnpm typecheck && pnpm test` clean, same bar as `IMPL-2026-08-23`.
10. Update `ADR-2026-08-31-...`'s Evidence section with real numbers; move Status to Accepted only
    if the gate actually cleared.

## Test strategy

- **Unit:** new extraction function against known path/export patterns (deterministic, fixture-
  based, same style as the existing evidence-vector extraction's tests from `IMPL-2026-08-23` step
  8).
- **Integration:** confirm the zero-evidence-specific eval actually measures what it claims to —
  assert the training/held-out split really is drawn from files with all-zero evidence vectors, not
  accidentally including files with partial signal (the exact mistake this IMPL exists to avoid
  repeating).
- **Regression:** if step 7 wires this in, extend `IMPL-2026-08-23`'s existing regression fixture
  rather than writing a parallel one.
- Must stay green: `pnpm typecheck`, `pnpm test`, `tests/e2e/domain-isolation.test.js`,
  `tests/e2e/architecture-policy.test.js` — same bar as every prior IMPL in this line of work.

## Rollback

If wired in (step 7) and it needs to come back out: the existing `.n-dx.json` kill switch
(`sourcevision.classification.elmPrefilter.enabled = false`) already covers this — no new rollback
mechanism needed, `IMPL-2026-08-23`'s already does the job. If only the eval work needs reverting
(gate didn't clear, nothing wired), it's docs + a script — no production code to revert.

## Open questions

- [x] **Exact path+export encoding shape — resolved 2026-09-04.** Concatenated single string
      through `UniversalEncoder` (char-mode, constructed independently of `ELM`) — the encoder
      only accepts a single string, no structured multi-field option exists. See Step 4.
- [ ] **Does export-name text add measurable signal over path-only**, or is path alone sufficient?
      Worth an ablation (path-only vs. path+exports) during step 5-6 rather than assuming the
      combination is strictly better — cheap to check since both share the same eval harness.
- [ ] **`PATH_EXPORT_MAX_LEN` (currently 80) and `PATH_EXPORT_CHARSET`'s exact contents** —
      reasoned starting points from Step 4, not validated against real path-length distributions.
      Worth checking during Steps 5-6 whether 80 characters truncates a meaningful fraction of
      real paths across the 5 corpora, and whether the charset is missing any structurally
      important character.
- [ ] **If the gate doesn't clear even with this fix** — next lever is file-content reading (ADR
      Alternatives), which has a real cost this ADR explicitly deferred rather than assumed. That
      tradeoff would need its own ADR update, not a silent scope expansion of this one.
- [ ] **`TJ-A3` dependency** — this IMPL predates `TJ-A3` being claimed (Knight, 2026-09-03) and
      its explicit gate on `TJ-R2`'s Steps 5-6 (`IMPL-2026-09-03-knight-tj-a3-execution-and-tj-r2-gate.md`,
      "Addition 2"). Steps 5-6 wait for `TJ-A3`'s Step 6a re-measurement of the zero-evidence
      population before building/running the eval against it — see Status above.
