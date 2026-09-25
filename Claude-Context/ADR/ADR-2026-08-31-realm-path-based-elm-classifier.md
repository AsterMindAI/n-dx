# ADR — Replace the ELM pre-filter's feature representation with path/export text, validated against the zero-evidence population specifically

- **Status:** Proposed — no measured evidence yet; this ADR sets methodology and design, the linked
  IMPL is what produces the numbers before this can move to Accepted.
- **Date:** 2026-08-31
- **Author:** Realm (Team Jarrett)
- **Supersedes:** none. Amends `ADR-2026-08-11-jarrett-elm-prefilter-classify.md`'s "Zero-evidence
  population" section (2026-08-27) — that section diagnosed the gap and shipped the pre-filter
  disabled by default; this ADR is the fix it left open, not a re-litigation of the diagnosis.
- **Backlog item:** `TJ-R2`

## Context

`IMPL-2026-08-23-jarrett-classify-elm-production-hardening.md` shipped the ELM pre-filter wired
into `runClassificationsPhase`, but **disabled by default** — real smoke-testing against actual
`ndx analyze` runs (not another eval-script invocation) found that its feature representation
(`classifyFile`'s per-archetype evidence-score vector) is **identically all-zero for 100% of the
files that ever actually reach this call site**, across all 5 gathered corpora, zero exceptions
(`ADR-2026-08-11-...`, "Zero-evidence population," 2026-08-27). This isn't a calibration problem —
an all-zero vector carries no per-file information, so no confidence threshold can make the ELM
discriminate between files it has literally identical input for.

**Why every prior positive result (Archer's 100%@59.0%, Knight's 97.0%@42.3%, my own independent
reproduction of both) didn't catch this:** every held-out set used so far — including my own
verification — was built from files that already carried a resolvable label, which by construction
excludes the true zero-evidence population this pre-filter exists to serve. Those results are real
and reproducible, but they measured "can the ELM predict labels for files with *some* signal," not
"can it help with the files it's actually invoked for." I want to be direct about this since I'm the
one who signed off on `TJ-R1`'s threshold recommendation on the strength of those numbers: the
recommendation itself (lean toward coverage-favoring thresholds) is still sound advice for whatever
representation actually carries signal — but it was evaluated on the wrong population, same as
everyone else's numbers were, and this ADR is what corrects that going forward, not a claim that
`TJ-R1` was wrong to trust the evidence it had at the time.

**Knight's `TJ-K1` composition (evidence vector concatenated with a separately-encoded path-only
vector) is flagged in the zero-evidence section as "the likely direction for a real fix"** — path
text is never empty, so it wouldn't degenerate to all-zero. But Knight's own eval also drew its
held-out set from files with resolvable labels, so this hasn't actually been validated against the
zero-evidence population either. It's a well-reasoned lead, not yet evidence.

**A refinement worth stating plainly, not just inherited from Knight's design as-is:** at the actual
production call site (the pre-filter runs only on `analyzeClassifications`'s `archetype: null`
output), the evidence half of a concatenated vector is **provably always zero** — not usually zero,
always, by construction of where this stage sits in the pipeline. Carrying it forward as half the
input vector isn't wrong, but it's dead weight at this specific call site: extra dimensions that
contribute nothing to every real production input. This ADR proposes a path-only (plus one cheap
addition, see Decision) representation for this call site specifically, not the full concatenation.

## Decision

Replace the ELM pre-filter's feature-extraction function with one built from data that is **never
empty for the files this stage actually receives**:

1. **Primary signal: path/filename/directory text**, encoded via the same text encoder path
   `classify-elm.ts`'s original (now-retired) text-mode used — but fed *only* the file's own path,
   not path-plus-evidence-hint text. This is the direct fix for the zero-evidence gap: path is never
   empty, so it always carries some signal, unlike the evidence vector.
2. **Secondary signal, cheap and already-collected: raw export names from `imports.json`**, not
   `classifyFile`'s *matched* signals (which are what's zero) but the file's actual exported symbol
   names regardless of whether any archetype regex happened to match them. This is free data already
   read for every file — no new collection cost — and adds real signal beyond path alone (e.g. a
   file named ambiguously but exporting `useSomething` is a strong hook signal path text alone
   wouldn't carry).
3. **Explicitly not carrying forward the per-archetype evidence-score vector for this call site** —
   per Context above, it's provably always-zero here. `classify-elm.ts`'s existing
   `extractNumericExamples`/evidence-vector code isn't deleted (it's real, validated, working
   infrastructure for contexts where evidence isn't uniformly zero — e.g. if this pattern is ever
   applied to a different call site with partial-signal populations), just not used as this call
   site's production input.

**The validation methodology changes, not just the representation.** Training and held-out data must
be drawn specifically from each corpus's zero-evidence population — the exact file lists are already
known from the 2026-08-27 measurement (260 in this repo, 83 in `AsterMind-Community-Edition`, 17/12/10
in `express`/`indie-stack`/`zustand`) — labeled the same manual-stand-in method used throughout this
investigation (no `claude` CLI available in this environment), split train/held-out with a fixed
seed, same precision-at-threshold/coverage-floor gate (≥95% precision, ≥15% coverage) as every prior
eval in this line of work. **A result measured against "any unclassified file" does not count as
evidence for this ADR** — it has to be measured against the zero-evidence population specifically,
or it repeats the exact mistake this ADR exists to correct.

**Model lifecycle, config surface, and wiring are unchanged** — `IMPL-2026-08-23`'s hybrid
cold-start design, `.n-dx.json` kill switch, and `runClassificationsPhase` call site all stay as
built. This ADR changes what feeds the model, not how the model gets trained/shipped/toggled.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep the evidence-vector representation, tune thresholds harder | Can't work by construction — the input is provably identical (all-zero) for every real file at this call site regardless of threshold. This isn't a tuning problem. |
| Adopt Knight's exact concatenated (evidence + path) vector unchanged | The evidence half is dead weight at this specific call site (always zero here, per Context) — not wrong, just unnecessary complexity carried forward without benefit for this call site's actual input population. |
| Read full file content for richer signal instead of just path + exports | Real cost increase (file I/O for every zero-evidence file, every `ndx analyze` run) for unproven benefit — no evidence path+exports is insufficient yet. Path+exports is free (already-collected data); content reading isn't. Revisit only if path+exports doesn't clear the gate. |
| Abandon the ELM pre-filter entirely for this call site, rely on LLM fallback only | Reverts to pre-`TJ-A1` behavior, discarding real infrastructure (`IMPL-2026-08-23`'s model lifecycle, config surface, tests) that isn't the part that's broken — the representation is fixable without discarding the shipped wiring. |

## Consequences

**Easier:** if this clears the gate, the pre-filter finally helps the population it was built for,
not just an easier population every prior eval accidentally substituted for it. `elmPrefilter.enabled`
can move toward a validated default instead of staying opt-in indefinitely.

**Harder:** a genuinely new eval methodology (zero-evidence-specific held-out construction) has to be
built and trusted before this can ship — not a threshold retune, real new measurement work.
`classify-elm.ts` gains a second feature-extraction path (path/export-based) alongside the existing
evidence-vector one, which stays for non-zero-evidence contexts — two code paths to maintain instead
of one, though the existing one already has its own valid use.

**Which teams affected:** none outside Team Jarrett — same territory as `TJ-A1`/`TJ-A2`.

**Migration cost:** contained to `packages/sourcevision/src/analyzers/classify-elm.ts` (new
extraction function) and a new/extended eval script. `runClassificationsPhase`'s wiring doesn't
change shape — it still calls a function that returns `FileClassification[]` with `source: "elm"`,
just backed by different input construction.

## Evidence

**No measured results yet — methodology only, per this ADR's own Status.** Per `ADR-TEMPLATE.md`,
an ELM-viability claim needs task framing, split sizes, seed, and a random baseline before it can be
accepted; none of that exists yet for this representation. Planned:

- **Task framing:** input = path text + raw export-name text (not evidence — see Decision); output =
  one of `BUILTIN_ARCHETYPES.length` archetype IDs; population = each corpus's zero-evidence file set
  specifically (not "any unclassified file").
- **Training/held-out split:** zero-evidence files from this repo (260) as the primary source, seeded
  Fisher-Yates split matching every prior eval's methodology in this line of work; `AsterMind-Community-Edition`'s
  83 zero-evidence files as the external held-out set, same role it's played throughout.
- **Seed:** reuse `20260812` for direct comparability with every prior measurement in this
  investigation, unless a reason to change it turns up during implementation.
- **Random baseline:** majority-class baseline over the zero-evidence population specifically (not
  the whole-corpus majority class used before — the zero-evidence population's label distribution
  may differ from the whole corpus's).
- **Gate:** same as every prior eval — ≥95% precision at ≥15% coverage floor.
- **Committed script:** new or extended eval script in `packages/sourcevision/scripts/`, checked in
  on whatever branch executes this IMPL — not a one-off run.

This section gets filled in with real numbers as the linked IMPL executes, same discipline as every
prior ADR in this line of work — a positive or negative result both need this section, not just a
positive one.
