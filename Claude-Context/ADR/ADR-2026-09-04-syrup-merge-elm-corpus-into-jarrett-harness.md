# ADR — Merge the ELM corpus, not the frozen model, into Team Jarrett's harness

- **Status:** **Proposed.** This decides work inside `packages/sourcevision/src/analyzers/`, which
  is Team Jarrett's territory (`TJ-A1`/`TJ-A2`/`TJ-R2`). It is a **draft for Nolan to send**, not a
  decision Team Nolan can take alone. It needs Jarrett's acceptance and a second lead's sign-off
  (`dev` merges and a workspace dependency are both collective-command items).
- **Date:** 2026-09-04
- **Author:** Syrup (Team Nolan)
- **Supersedes:** none. **Amends** `ADR-2026-08-31-realm-path-based-elm-classifier.md` — that ADR
  proposes building a path-text representation and its Evidence section is still a plan. This ADR
  supplies the data that plan needs, and the negative result it has not yet had a chance to find.
- **Backlog item:** `TN-S2`

---

## Context

### The merge unit is the corpus, not the model

An earlier draft of this ADR proposed merging `scripts/data/elm-frozen-model-v2.json` into
Jarrett's bundled-baseline slot. That was wrong, and the way it was wrong is instructive: it
produced a list of five integration blockers, and **four of them were artifacts of choosing the
wrong thing to merge.**

| Blocker under "merge the model" | Under "merge the corpus" |
|---|---|
| Our artifact stores `weightShape` + a fingerprint, no `W`/`b`/`B` — `loadBaselineArchetypeELM():273-282` cannot load it | **Dissolves.** Jarrett trains their own model and `train-baseline-elm.ts` already emits their format |
| `inputSize` hardcoded to `catalogSize` (17) vs our TF-IDF `featureDim` 2,890; `HIDDEN_UNITS = 128` vs our 4,096 | **Dissolves.** They choose their own hyperparameters; ours become a measured recommendation, not a constraint |
| Their artifact format has no slot for a fitted `TFIDFVectorizer` | **Dissolves.** They fit their own encoder during their own training run |
| A scalar `confidenceThreshold` cannot express our abstain-on-`service`/`utility` operating point | **Mostly dissolves.** They derive their own operating point from their own model; the config surface still needs widening, but it is no longer a blocker on loading anything |
| The zero-evidence guard at `classify-elm.ts:350` skips 100% of the path-text target population | **Survives unchanged.** This one is representation-level, not artifact-level |

Four of five were self-inflicted. The corpus is the correct merge unit, and the reasons are
stronger than "it fits better."

### The corpus is the paid-for asset; the model is a derivative

`scripts/data/elm-archetype-corpus-v2.json` is 624 rows across 7 ecosystems, labelled by an LLM
teacher at real cost — 13 classify calls in the last extension alone, on top of the original
harvest. **The frozen model is roughly an hour of CPU away from that corpus.** Merging the
derivative and not the source gets the value backwards: a model can be regenerated from the
corpus, and the corpus cannot be recovered from a model.

It is also the *only durable copy*. `ELM-CORPUS.md` § 8 inventories the staging tree at
`/Users/nolanmoore/Work/n-dx-elm-corpus/` and states plainly that it is **not version-controlled**.
The committed JSON is what stops 624 paid-for rows from being one `rm -rf` from gone.

### Merging the corpus fixes a reproducibility hole in Jarrett's own build

This is the argument that decides it, and it has nothing to do with our model.

`packages/sourcevision/scripts/train-baseline-elm.ts` regenerates the artifact that **ships to npm
users**. It reads five `.sourcevision/` directories supplied through
`SV_ELM_BASELINE_TRAINING_DIRS`. The shipped artifact records what those were:

```
"trainingSources": ["this-repo",
  "C:/Users/jarre/Documents/GitHub/AsterMind-Community-Edition/.sourcevision",
  "C:/Users/jarre/Documents/GitHub/elm-training-corpora/express/.sourcevision",
  "C:/Users/jarre/Documents/GitHub/elm-training-corpora/indie-stack/.sourcevision",
  "C:/Users/jarre/Documents/GitHub/elm-training-corpora/zustand/.sourcevision"]
```

**Those paths exist on one laptop.** `classify-elm-baseline-model.json` is 5,187 committed lines
that nobody except Archer can regenerate, and no reviewer can audit — you cannot check what the
shipped model was trained on, only what it claims it was trained on. That is the same class of
problem as an accuracy number without a committed script, which this project already refuses to
accept.

A committed corpus in the repo makes the baseline reproducible by anyone, on any platform, from
inputs a reviewer can read. **Jarrett should want this independently of whether they ever use our
labels.**

### What Jarrett is doing right now, and cannot see

`TJ-R2` (Archer) is building the path-text representation. Step 4 is done —
`extractPathExportExamples`/`pathExportVector` via a char-mode `UniversalEncoder`, committed
`ae9dc463` in their local worktree `../n-dx-jarrett`. **That commit is on no remote**: `git
cat-file -t ae9dc463` fails here and `origin/Jarrett` contains neither symbol. Steps 5-6 — the
eval — are soft-gated on Knight's `TJ-A3`.

So Archer is about to need training data for a path-text model. We have it, split, documented, and
seeded. Nobody has told them.

### The warning has to travel with the data

Corpus v1 produced a model that **passed** on the repos it was trained on and **failed** on fresh
ones: coverage 34.9% → 13.2%, `service`/`utility` predicted for 96.4% of files against the
teacher's 48.4%, 5 distinct labels emitted against 13. It learned n-dx's archetype prior, not a
path→archetype mapping (`ELM-CORPUS.md` § 6).

**Held-out CV cannot reveal this** — held-out rows come from the same repos as training, which is
exactly how it reached our certification gate. Every eval in Jarrett's line of work has that same
shape: Archer's 100% @ 59.0%, Knight's 97.0% @ 42.3%, Realm's reproduction of both. If `TJ-R2`'s
eval is built the same way against our corpus, **it will pass and be wrong.**

This is why the merge unit is `ELM-CORPUS.md` and not just the JSON. § 6 is the failure mode, § 7
is the contamination boundary (gold set #1 spent as DEV; gold set #2's 250 files blind, 0 of 355
overlapping corpus #1, mechanically asserted), § 9 is how to extend it without repeating our
mistakes. **The document is the warning label on the data, and data merged without it is a
loaded gun.**

### The topology is the easy part

Simulated read-only with `git merge-tree --write-tree`, git 2.39.5 — no worktree, nothing written:

| Merge | Conflicts |
|---|---|
| `dev` + `Nolan-Work` | **none** |
| `dev` + `Jarrett` | 1 — `Claude-Context/IN-FLIGHT.md` |
| `Jarrett` + `Nolan-Work` | 1 — `Claude-Context/IN-FLIGHT.md` |
| `dev` + `Thomas_Branch` | none |
| **`Jarrett` + `Thomas_Branch`** | **5** — incl. add/add on `classify-elm.ts` and `classify-elm.test.ts` |

**Zero source-code conflicts between Jarrett and Nolan.** The only file both teams touch is the
claim board. `Jarrett` is 34 ahead / 10 behind `dev`; `Nolan-Work` is 118 ahead / 2 behind.

The 5-conflict row is the cost of the three-team collision, and it is **order-dependent** —
Thomas merges into `dev` cleanly alone, so whoever lands second pays.

---

## Decision

**Merge Team Nolan's labelled corpus and its documentation into `dev` as a training input for Team
Jarrett's harness. The frozen model travels as a reproducibility reference, not as the production
artifact.** Jarrett's wiring, lifecycle, config surface and tests stay as built. `TJ-R2` gets the
data its Evidence section is waiting for instead of harvesting a corpus from scratch.

Executed in this order. **Steps 0-2 are prerequisites and none of them is a merge.**

**Step 0 — run the coverage check on corpus v2 before offering it to anyone.** `node
scripts/elm-coverage-check.mjs --frozen=scripts/data/elm-frozen-model-v2.json`. Costs no labels and
no LLM calls. Corpus v2 is an **unvalidated fix** — nobody has demonstrated it generalises, and
`ELM-CORPUS.md` § 6 says so in its own text. **If v2 fails K1' the way v1 did, we merge the corpus
and the negative result anyway** — the data and the failure are both worth having — but we say so
in the same breath, and no one trains a shipping model on it.

**Step 1 — send Jarrett the two things they cannot see:** that a labelled path-text corpus exists,
and that corpus v1's model did not generalise. K2 wrote outbound notes at `c2d1ddb4`, but they are
on `Nolan-Work` only — `Claude-Context/Jarrett-Agents/Notes/` on `origin/Jarrett` does not contain
them, and Thomas has no `Notes/` tree at all. **Those notes were never delivered.** Delivery
happens by merging to `dev`, not by writing. Until this lands, Archer builds Step 4 blind.

**Step 2 — resolve `TJ-A3` first.** Knight is actively redesigning `BUILTIN_ARCHETYPES`. Our
corpus labels are keyed to today's 17-archetype catalog, so a relabel is coming either way — but
relabelling a corpus is cheap and mechanical, where a model keyed to a dead taxonomy is scrap.
This is a smaller risk under the corpus framing than it was under the model framing, and it is
still worth sequencing: `TJ-A3` → Knight's Step 6a re-measurement → this ADR's Steps 3+.

**Step 3 — land the branches:** `dev` → `Jarrett` (resolve the one `IN-FLIGHT.md` conflict), then
`dev` → `Nolan-Work` (clean today), then Thomas. Jarrett first because it is the smaller, older
delta and carries the shared-file changes. Thomas last and explicitly negotiated — their overlap
with Jarrett is two implementations of one filename, which is a reconciliation, not a merge.

**Step 4 — add a corpus-file training path to `train-baseline-elm.ts`.** Small and well-bounded:
the trainer's `loadSourcevisionDir` → `extractNumericExamples` chain is replaced, for this input,
by a reader for the corpus's flat `{text, label, confidence, source, repo}` rows feeding whatever
extraction function `TJ-R2` settles on. **The trainer itself does not change** — only where its
examples come from. This is what makes the shipped baseline reproducible from committed inputs.

Keep the existing `.sourcevision/`-directory path as well: it is the right input for the numeric
evidence-vector model, which stays valid for call sites where evidence is not uniformly zero.

**Step 5 — make the zero-evidence guard representation-aware.** `classify-elm.ts:350` —
`if (!vector.some((v) => v > 0)) continue;` — is correct and load-bearing for the evidence vector,
and exactly inverted for path text, which is never empty. It must stay unconditional for the
former and not apply to the latter. **This is the most dangerous line in the merge:** removing it
wholesale re-enables a model that predicts the class prior for every file, which is precisely what
it was added to prevent.

**Step 6 — adopt coverage as a runtime gate.** `scripts/elm-coverage-check.mjs:22-24` makes the
argument and Jarrett's harness has nowhere to put it: a tier that can measure its own coverage on
the user's repo can decline to engage when it is out of distribution. It needs no ground truth at
runtime, and it is the direct answer to the § 6 failure. **This is the one design idea here that
should survive even if every model on both branches is eventually thrown away.**

**Step 7 — let the merged eval choose the encoder.** Archer's char-mode `UniversalEncoder` and our
TF-IDF encoder are two answers to one question, both now real. Run both against corpus v2 on the
zero-evidence population, seeded, with the majority baseline stated, using the corpus's own
**seeded stratified split — do not re-split** (`ELM-CORPUS.md` § 2; re-splitting makes the numbers
incomparable to everything in `ELM-FINDINGS.txt`). Neither team discards the other's on argument.

**`elmPrefilter.enabled` stays `false` throughout.** It flips only on a coverage pass against a
repo the model was not trained on — never on held-out CV, which is the measurement that already
fooled us.

### What happens to the frozen model

It merges, but into `scripts/data/` where it already lives, as a **reproducibility anchor** and
nothing else. Its own `status` field says what it is for: *"FROZEN. Phase 3 evaluates this and only
this. Any change voids the certification."* It was built to be evaluated, not shipped. It carries a
`contentHash` and a `refitFingerprint` so that anyone retraining from the corpus can check whether
they reproduced our run. **It does not go into `loadBaselineArchetypeELM`, and nothing in the
product loads it.**

---

## Alternatives considered

| Option | Why not |
|---|---|
| **Merge the frozen model into the bundled-baseline slot** (the earlier draft of this ADR) | Four of its five integration blockers exist only because the model is the wrong merge unit — see the Context table. It also ships a derivative instead of the source, hands Jarrett a model they cannot retrain, and would put an unvalidated artifact on the product path. |
| **Jarrett harvests their own path-text corpus for `TJ-R2`** | Duplicates the single most expensive asset on the project — 7 ecosystems of LLM-labelled rows, already paid for — and does it with the same held-out-from-training-repos methodology that already produced a false pass here. The likely outcome is a second confident number failing on the same hidden axis. |
| **Merge the corpus JSON without `ELM-CORPUS.md`** | The data's failure mode is not inferable from the data. § 6 (generalisation failure), § 7 (contamination boundary — gold set #2 must stay blind) and § 9 (how to extend without covariate-shift traps) are what make the rows safe to use. Shipping rows without them invites exactly the mistake we already made. |
| **Team Nolan builds its own wiring into `analyze-phases.ts`** | A fourth ELM integration into a file three teams already edit, against a harness that is finished and tested. Outside Team Nolan's scope and a head-on collision with `TJ-A2`. |
| **Ship Jarrett's numeric model enabled today** | Provably resolves zero files — the evidence vector is all-zero for 100% of the population reaching the call site across 5 corpora, and the guard at `:350` correctly skips every one. Enabling it changes nothing except risk. |
| **Abandon the ELM tier; spend the effort on `TN-J22` (classify-prompt improvement)** | Genuinely competitive and should stay on the table — the LLM sits 13.1 pp below the human path-only ceiling, true since 2026-08-11. But it is a different decision, it is unclaimed, and it does not require discarding a finished harness or a paid-for corpus to pursue. Revisit if Step 0 fails. |

---

## Consequences

**Easier.** The shipped baseline becomes reproducible from committed inputs by anyone, on any
platform — today it cannot be regenerated off Archer's laptop. `TJ-R2` gets 624 labelled rows and a
seeded split instead of a harvesting project. The corpus stops being one un-backed-up directory
away from loss. Both teams get the coverage gate. And one ELM tier replaces three.

**Harder.** `train-baseline-elm.ts` grows a second input path. The corpus needs relabelling
whenever `BUILTIN_ARCHETYPES` moves, which `TJ-A3` is about to do. The merged system gains a third
guard (confidence, zero-evidence, coverage) whose interaction needs its own test.

**What we give up by not merging the model — stated plainly, because it is a real cost.** We lose
the guarantee that what ships is what we measured. Our architecture sweep result — `elm-4096 tanh`,
+2.06 pp, 7 of 9 paired wins on corpus v2 — becomes a *recommendation to Jarrett* rather than a
property of the shipped artifact. If they train at different hyperparameters, someone has to
re-measure, and our sweep is evidence for a configuration nobody is running. That is an acceptable
trade for reproducibility and for not putting an unvalidated model on the product path, but it is
a trade and it should be recorded as one.

**What breaks.** Nothing at runtime while `enabled` stays `false`. Two build-time items are real:
`packages/sourcevision/package.json` gains `@astermind/astermind-community` and `pnpm-lock.yaml`
churns — **both are on the shared "nobody edits unilaterally" list and need a second lead**, the
same sign-off Butter is holding `TN-B3` Step 0 for. Jarrett has already made this change on their
branch; landing it in `dev` is what makes it collective. Related hazard, ours: **`pnpm.overrides`
is ignored by pnpm 11, not 10** — clean-room verified, 10.33.0 reads it silently, 11.23.0 warns and
drops it. `origin/main`'s lockfile carries the resolved block, so 14 CVE pins are live today and
any lockfile regeneration outside corepack's pin drops them. Check `pnpm --version` reports
10.33.0 before touching the lockfile in this merge.

**Repo hazard for whoever resolves the conflicts.**
`packages/sourcevision/src/cli/commands/analyze-phases.ts` contains two raw NUL bytes. `file`
reports it as `data`, so **`grep` exits 1 and prints nothing** — silence, not an error. Any
repo-wide grep run while resolving this merge has a hole in it exactly where the ELM wiring lives.
Use `grep -a`, `rg --text`, or `python3`.

**The offsets move per branch** — 16345/16374 on `dev`, `main` and `Nolan-Work`, but **18588/18617
on `Jarrett`**, shifted by their 37 inserted lines. Cite the ref with the offset or the number
sends the next reader to the wrong place in the exact file they are resolving. This was found by
the hazard firing during this ADR's own validation: a plain `grep` for `elmPrefilter` on Jarrett's
copy returned nothing and exited 1, and `grep -a` returned 4 hits.

**Teams affected: Jarrett (directly), Thomas (by the merge order in Step 3).**
**No note has been sent to either.** Per Team Nolan's roster, Syrup drafts outbound cross-team
notes and Nolan sends them; this ADR is that draft. Stating it plainly because the template asks
for confirmation a note went out and it has not: **as of 2026-09-04 Jarrett does not know this ADR
exists, and K2's earlier notes at `c2d1ddb4` never reached them either.**

---

## Evidence

### Verified in this session, at source

Every claim below was checked against the artifact or branch named, not relayed.

- **Merge topology** — `git merge-tree --write-tree --messages <a> <b>`, read-only, git 2.39.5.
  Results in the Context table. `dev`+`Nolan-Work` clean; `dev`+`Jarrett` and
  `Jarrett`+`Nolan-Work` conflict only on `Claude-Context/IN-FLIGHT.md`;
  `Jarrett`+`Thomas_Branch` conflicts on 5 files including add/add on `classify-elm.ts`.
- **Jarrett's baseline is not reproducible off their machine** — `train-baseline-elm.ts` reads
  `.sourcevision/` dirs from `SV_ELM_BASELINE_TRAINING_DIRS`; the shipped
  `classify-elm-baseline-model.json` records four `C:/Users/jarre/...` paths plus `this-repo`,
  with `trainingExampleCount: 686`, `seed: 20260812`.
- **Corpus row format is flat and platform-neutral** — `{schema, generatedAt, generatedBy,
  provenance, stats, train, heldOut}`, rows `{text, label, confidence, source, repo}` where `text`
  is the file path. v2: `train` 464 / `heldOut` 160, seed 42, holdout 0.25, stratified,
  reproducible byte-for-byte.
- **The two harnesses' category sets differ** — Jarrett's baseline has 16 categories including
  `page` and excluding `route-module`; our frozen model has 16 including `route-module` and
  excluding `page`. `BUILTIN_ARCHETYPES` is 17 ids on `dev`, `Jarrett` and `Nolan-Work` alike, so
  neither covers the full catalog.
- **`ae9dc463` is on no remote** — `git cat-file -t` fails; `origin/Jarrett` contains neither
  `extractPathExportExamples` nor `pathExportVector`.
- **K2's outbound notes are undelivered** — `Claude-Context/Jarrett-Agents/Notes/` on
  `origin/Jarrett` lists 8 files, none of them K2's; `origin/Thomas_Branch` has no
  `Claude-Context/*/Notes/` tree.
- **The corpus staging tree is not version-controlled** — `ELM-CORPUS.md` § 8, inventorying
  `/Users/nolanmoore/Work/n-dx-elm-corpus/`. The committed JSON is the only durable copy.
- **The freeze completed** — `scripts/data/elm-frozen-model-v2.json`, 12,933 bytes,
  `frozenAt 2026-09-04T15:58:09Z`, corpus v2, `trainedOn.rows 464`, 9 models. The artifact
  existing is the only success test (`elm-freeze-model.mjs` exit codes have lied on this job).

### Measurements this ADR rests on (with seeds and baselines)

| Result | Population | Seed | Baseline | Script |
|---|---|---|---|---|
| Corpus v1 coverage 34.9% **PASS** | gold set #1 held-out, trained-on ecosystems | frozen v1 | K1' ≥30% | `scripts/elm-coverage-check.mjs` |
| Corpus v1 coverage 13.2% **FAIL**; ELM S/U 96.4% vs teacher 48.4%; 5 of 13 labels | gold set #2, hono + trpc, **unseen repos** | frozen v1 | K1' ≥30% | same |
| Path text 54.4% vs truth / 59.9% vs teacher | LLM-bound population, 241 train / 83 held-out, all `source: "llm"` | Jam's screen | 37.3% majority | `scripts/elm-feasibility-screen.mjs` |
| Abstention 22.9% of files at 75.5% precision (range 68.2–81.3%) | gold set #1, **DEV** | as above | LLM 72.3% vs truth | as above |
| `elm-4096 tanh` 68.80%, **+2.06 pp, 7 of 9 paired wins** | corpus v2 train, 5-fold CV | grid pre-registered at `1a5403c6` | 9-config grid | `scripts/elm-architecture-sweep.mjs --phase1b` |
| Jarrett 100% @ 59.0%; Knight 97.0% @ 42.3% | **self-invalidated** — held-out drawn from files that already had a resolvable label | 20260812 | — | `packages/sourcevision/scripts/eval-classify-elm-numeric.ts` |
| Zero evidence for 100% of the target population | 5 corpora, no exceptions (Jarrett); 0/260 resolved, margins ~0.002 (Thomas) | — | — | Jarrett `ADR-2026-08-11`, "Zero-evidence population" |

### What is explicitly NOT evidence yet

Naming these because this ADR would be easiest to accept if they were quietly omitted.

1. **Corpus v2 has never been coverage-checked.** It is an unvalidated fix, and `ELM-CORPUS.md`
   § 6 says so itself. Step 0 exists because this ADR offers Jarrett a corpus whose central
   property — that it generalises — is untested at the time of writing.
2. **The 9-seed ensemble is currently *worse* on train-CV** — single seed 69.2%, ensemble 67.0%,
   **−2.16 pp** — recorded inside the frozen artifact itself (`selection.deltaPp: -2.155`). It was
   measured on **one fold seed** (reduced from `[7,13,29]` for cost) and the artifact's own
   `foldSeedsReduced` field says not to quote it as model selection. **It is not a finding.**
   Resolving it is a 3-fold-seed re-run at 4096, ~2.5 h.
3. **Phase 1c (8192 units) is pre-registered and unrun** (`c913acf0`). 4096 won at the top edge of
   the grid, which is evidence the grid stopped too early, not evidence of a plateau. The stopping
   rule is fixed in advance: a non-winning 8192 closes capacity at 4096 and 16384 is not run.
4. **No path-text model has been measured on Jarrett's zero-evidence file lists specifically** —
   the 260/83/17/12/10 sets named in Realm's ADR. Our population is `source: "llm"` files, which
   overlaps but is not identical.
5. **Archer's Step 4 encoder has never been run against anything.** Comparing it to ours (Step 7)
   is proposed, not done.
6. **The stale-path caveat on the corpus artifact:** `corpusProvenance` records
   `~/n-dx-elm-corpus`, but the staging tree is `/Users/nolanmoore/Work/n-dx-elm-corpus`. The
   `path` field is wrong; the teacher pins are correct.

### Re-running any of this

Everything cited is a committed, seeded script on `Nolan-Work`. The two that matter most:

```sh
node scripts/elm-coverage-check.mjs --frozen=scripts/data/elm-frozen-model-v2.json
node scripts/elm-architecture-sweep.mjs --phase1c --corpus=scripts/data/elm-archetype-corpus-v2.json
```

Run the second alone — at 8192, W is ~158 MB per model, and the Phase 1 sweep was OOM-killed on
this hardware **while exiting 0 with an empty results table**. Verify the table is populated before
believing the run.
