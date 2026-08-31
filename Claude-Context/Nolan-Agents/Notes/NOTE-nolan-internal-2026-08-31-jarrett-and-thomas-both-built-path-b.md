# NOTE — Nolan internal — 2026-08-31 — Both other teams built Path B. Both hit your zero-evidence wall. One of them proved it across five codebases.

**Drafted by:** Syrup (Team Nolan) · **For:** Jam (Team Nolan)
**Needs a reply by:** **before `TN-B5`'s verdict is written** — this changes what that verdict is about
**Blocking:** nothing of mine. This is the first read of Jarrett's and Thomas's branches anyone on our team has done.

I am Team Nolan's new agent. My whole job is reading the other two teams and telling you what they
found. This is the first pass. **I changed nothing on their branches and I am not proposing that we
do.**

---

## 1. The headline: three teams have been building the same thing

`packages/sourcevision/src/analyzers/` — the path Nolan claimed for Path B on 2026-08-11 in
`IN-FLIGHT.md` — has **two other independent implementations sitting on other branches right now.**

| Team | File | Touches `classify.ts`? | State |
|---|---|---|---|
| **Nolan** (you) | *(corpus + prototype only, no analyzer code yet)* | no | `TN-J4` PENDING |
| **Jarrett** (Archer/Knight) | `classify-elm.ts`, **362 lines** + 2 test files, **28 tests** | **No — deliberately untouched** | wired, shipped **disabled** |
| **Thomas** (Nala) | `classify-elm.ts`, **133 lines** | **Yes — +86 lines into `enrichClassificationsWithLLM`** | wired, shipped **disabled** |

Both are on the same function you are targeting. Both landed a `source: "elm"` widening of
`FileClassification` in `packages/sourcevision/src/schema/v1.ts` — **the same one-line change, twice,
independently.** These two branches will conflict with each other on merge regardless of what we do.

**Neither team's claim appears in `IN-FLIGHT.md`.** The board carries Nolan's Path B claim from
08-11 and nothing from Jarrett or Thomas. This is not them ignoring the board — Jarrett keeps a real
claim board in their own `Jarrett-Agents/BACKLOG.md`, and Thomas's branch **predates the agent-structure
unification entirely** (see § 5). It means the board did not do the one job it exists to do.

**I am not suggesting you race them.** I am telling you that "Team Nolan owns Path B" has not been
true in practice for about three weeks, and `TN-J4` should not be planned as if it were.

---

## 2. Your 2026-08-11 zero-evidence finding is now confirmed by two independent teams

You wrote on 08-11: *"All 259 unclassified files have zero signal evidence, so path string is the
only feature."* That has since been independently re-derived twice, by people who were not reading
your notes.

**Thomas / Nala, 2026-08-20** (`team/Thomas's Agent Work/ADR-001-elm-classify-gate.md`) — ran real
`ndx analyze` against n-dx: 423 classified, **260 unclassified, all 260 carrying a completely empty
`evidence` array.** ELM resolved **0 of 260**. Softmax margins **~0.002**, which they correctly read
as noise rather than a threshold to tune.

**Jarrett / Archer, 2026-08-27** (`ADR-2026-08-11-jarrett-elm-prefilter-classify.md`, final section)
— same finding, **across five codebases, with zero exceptions:**

| Codebase | Unclassified | Zero-evidence |
|---|---|---|
| n-dx | 260 | 260 (100%) |
| `AsterMind-Community-Edition` | 83 | 83 (100%) |
| `express` | 17 | 17 (100%) |
| `indie-stack` | 12 | 12 (100%) |
| `zustand` | 10 | 10 (100%) |

Archer's explanation of *why* it is exactly 100% and not, say, 60% is the sharpest statement of this
I have read anywhere, and it is worth lifting into our own docs: `classifyFile`'s signal weights are
0.4–0.9 per match, and `PRIMARY_THRESHOLD` is 0.4, so **a single matched signal already resolves the
file.** There is no "partial signal, still unresolved" middle ground in this catalog's design. The
residue is all-or-nothing by construction.

**You found this first, on 2026-08-11, and it is the single most reproduced result on this project.**
Three teams, three independent measurements, five codebases. Whatever `TN-B5` concludes, this part is
not in doubt.

*(Minor discrepancy, flagged not resolved: you counted 259, both of them count 260. Worth one line in
whichever doc survives.)*

---

## 3. Jarrett's positive numbers are real — and they measured a different population than ours

This is the part I would most want in front of you before you write a verdict.

Archer got a genuinely strong result with a **numeric feature representation** — feeding
`classifyFile`'s per-archetype weighted score vector (17 dims) straight into the ELM in numeric mode
(`useTokenizer: false`) instead of encoding paths as text:

| | Text mode (08-12) | Numeric vector (08-20) |
|---|---|---|
| In-domain | 95.8% @ 23.1% coverage | **97.6% @ 79.8%** |
| Out-of-domain | 60.9% @ 29.5% — fails gate | **100% @ 59.0%** — clears by a wide margin |

Knight reproduced it independently with a different composition (evidence vector concatenated with a
path-encoded vector): **97.0% precision @ 42.3% coverage**, same held-out set. Archer also
sanity-checked the 100% against degeneracy — 46 of 78 resolved, 5 distinct predicted labels, not a
single-class artifact. Pooling across 5 codebases was **neutral** under numeric mode (identical
100% @ 59.0%), which retires the "we need more data" read that both our teams entertained.

**And then Archer invalidated their own headline number, in writing, unprompted:**

> *"every held-out set used so far … was drawn from files that already carried a resolvable label,
> which by construction excludes the true zero-signal population. The 100%@59.0% coverage result is
> real, but it measures 'can the ELM predict labels for files that have *some* archetype signal,'
> not 'can it help with the files `enrichClassificationsWithLLM` is actually called for.'"*

They shipped the pre-filter with `elmPrefilter.enabled` defaulting to **false**, and put a
*structural* guard in `classifyWithELM` so no threshold override can bypass it. Their stated reason:
shipping it enabled *"would be shipping a false sense of safety."*

**Why this matters for `TN-B5`:** their 100% and our 4.8% are not in tension — **they are measured on
opposite sides of the same wall.** Their number describes the files that never needed the LLM. Our
number describes the files that do. A verdict that reads our 4.8% as "the ELM can't classify
archetypes" would be wrong, and a verdict that reads their 100% as "it can" would be equally wrong.
The honest framing both bodies of evidence support is narrower and more useful: **on the population
that actually reaches the LLM, the only surviving feature is the path string, and nobody has yet made
the path string work.**

---

## 4. Both teams independently arrived at *your and Butter's* approach as the fix

Nala's companion plan (`ELM-Classify-Gate-Implementation-Plan.md`, Status: Proposed, not started)
concludes the fix is to **drop the evidence vector and feed raw path text** — with
`FeatureCombinerELM` (path features + evidence) named as the v2 if plain text mode underperforms.
Archer independently landed in the same place, naming Knight's concatenated composition as *"the
likely direction for a real fix"* because *"path text is never empty."*

**That is Butter's prototype.** Butter has already built the thing both other teams have written plans
to build, and has a number for it: **4.8% agreement, −32.5 points against a 37.3% baseline, seed 42.**

So the state of the project is: three teams agree on the diagnosis, three teams agree on the proposed
treatment, and **we are the only team that has actually run the treatment.** Our negative result is
therefore worth considerably more than it looked like when Butter handed it to you — it is not one
team's dead end, it is the answer to an open question two other teams are queued up to spend weeks on.

**But do not publish it as-is yet.** See my separate note to Butter, same date: I verified a defect in
the library's text encoder that plausibly explains a large part of that 4.8%, and it is fixable
before the number gets published. Publishing 4.8% as the verdict on path-text ELMs, and then finding
it was a library bug, would be the `maxLen: 32` incident repeated in public and across three teams.

---

## 5. Things I verified that nobody on their side has flagged

Reported per doctrine. **All are in their territory — I did not touch any of it.**

**(a) `TJ-R1` cites two documents that do not exist.** `Jarrett-Agents/BACKLOG.md` marks `TJ-R1`
**DONE** — the strategic pivot making ELM the primary classifier and the LLM a last resort — citing
`ADR-2026-08-24-realm-elm-primary-classifier-pivot.md` and its matching IMPL. I enumerated
`Claude-Context/` on **every branch in the repo**: neither file exists anywhere. The decision is
recorded as made and its reasoning was never committed. *(Their own ADR text discusses Realm's ADR as
though it exists, so this is most likely an uncommitted file, not a fabrication — but it is currently
unrecoverable from git.)*

**(b) The two teams contradict each other on whether `classify.ts` may be edited.** Archer treats
leaving it untouched as a hard constraint and reimplemented signal matching to avoid it. Nala added
86 lines directly inside `enrichClassificationsWithLLM`. Both are defensible; they cannot both merge.

**(c) Team Thomas has two diverged branches and the live one predates our doctrine.**
`origin/Thomas_Branch` (last commit 2026-08-06) and `origin/Thomas's_Branch` (2026-08-28) have
**diverged** — neither contains the other. The live branch is missing `4f561097`, the agent-structure
unification, which is why it still carries the pre-migration `team/archer.md`-style layout,
`Claude-Context/Claude-Agents/`, `ADR-000-template.md`, and a **numbered** `ADR-001-elm-classify-gate.md`
filed outside `Claude-Context/ADR/`. Their ADR is authored by *"Nala (head engineer, n-dx)"* — no
charter, no backlog row, no team folder. **Team Thomas is not on the system the rest of us are on**,
and `NEW-AGENT.md`/`Fluff`'s `TN-F1` is the reason: the doctrine only exists on branches that merged it.

**(d) It bears on your `TN-J10`.** Jarrett's `TJ-A3`
(`ADR-2026-08-24-jarrett-archetype-taxonomy-redesign.md`) is a plan to **extend and tighten
`BUILTIN_ARCHETYPES` itself** — new `analyzer`/`algorithm`/`tool` archetypes, and tightened
`store`/`hook`/`middleware`/`model` signals to fix same-word-different-domain collisions
(`branch-work-store.ts` is not a React store; Zustand's `middleware.ts` is not HTTP middleware).
**That is your teacher-inconsistency problem approached from the catalog end instead of the label
end.** Your K2 gold set and their taxonomy redesign are two answers to one question, and if the
catalog changes underneath us, every label in our 324-row corpus is measured against a moving target.
Realm already flagged internally that `TJ-R1`'s threshold number goes stale the moment `TJ-A3` lands.
`TJ-A3` is currently **Unassigned** — reassigned away from Archer on 08-27 when the user redirected
them to the ELM alone.

---

## 6. What I need back

1. **Does `TN-B5`'s verdict change** now that (a) the negative is measured on a population two other
   teams have independently characterised, and (b) Butter's number may be depressed by a library
   defect? My read is that the verdict gets *stronger and narrower*, not weaker — but it is yours.
2. **Should our K2 gold set be paused or re-scoped** until we know whether `TJ-A3` changes the
   archetype catalog? Hand-labelling 60 files against a catalog that is being redesigned is the
   expensive kind of rework.
3. **Do you want § 1 and § 5 escalated to Nolan as an outbound cross-team note?** Three teams
   independently building one function, an ADR cited as DONE that does not exist, and a team running
   outside the doctrine are all lead-level items. **I draft; I do not send.** Say the word and I will
   write `NOTE-nolan-to-jarrett-…` and `NOTE-nolan-to-thomas-…` for Nolan to review and send.

— Syrup
