# IMPL — Merging the ELM corpus into Team Jarrett's harness

- **Implements:** `ADR-2026-09-04-syrup-merge-elm-corpus-into-jarrett-harness.md`
- **Owner:** Syrup (Team Nolan) — **for Phase 1 only.** Phases 2-4 are Team Jarrett's; see
  Ownership split below.
- **Backlog item:** `TN-S2` (Team Nolan half). The Jarrett half belongs under `TJ-R2`/`TJ-A2` and
  is theirs to number.
- **Branch:** `Nolan-Work` — **shared checkout**, no worktree (lead's decision 2026-08-31). The
  template's `elm/<name>/<topic>` convention has never been used on any remote (`TN-F1`), so this
  deviates knowingly rather than minting the first-ever `elm/*` branch for a docs-and-data change.
- **Worktree:** none. Phase 1 runs no state-writing command; Phase 2's coverage run is read-only.
- **Status:** **Not started.** Phase 1 Step 0 is the gate for everything below it.

---

## Ownership split — read this before anything else

This IMPL spans two teams' territory. **Team Nolan cannot execute Phases 2-4** and this document
does not claim otherwise.

| Phase | Steps | Owner | Territory |
|---|---|---|---|
| **1 — Prove and offer** | 0-4 | **Syrup (Nolan)** | `scripts/`, `Claude-Context/Nolan-Agents/`, outbound note |
| **2 — Land the branches** | 5-7 | **The leads** | `dev` — needs a second lead's sign-off |
| **3 — Wire the corpus in** | 8-11 | **Team Jarrett** | `packages/sourcevision/**` |
| **4 — Measure and gate** | 12-14 | **Jarrett, with Nolan supplying method** | `packages/sourcevision/**` + our scripts |

Phase 1 is unilateral and reversible — it publishes data and a draft note. **Nothing in Phases 3-4
happens without Jarrett accepting the ADR.** If they reject it, Phase 1 still stands on its own:
the corpus is documented, the negative result is delivered, and Jarrett has what they need to
decide differently.

---

## Scope

**In scope:**

- Validating corpus v2 generalises (or establishing that it does not) before offering it.
- Merging `scripts/data/elm-archetype-corpus-v2.json` and
  `Claude-Context/Nolan-Agents/ELM-CORPUS.md` into `dev` as a documented, reusable training input.
- A second, corpus-file input path for `packages/sourcevision/scripts/train-baseline-elm.ts`, so
  the shipped baseline is reproducible from committed inputs.
- Making the zero-evidence guard representation-aware.
- Coverage as a runtime gate.

**Out of scope (explicitly):**

- **Shipping our frozen model as the production artifact.** It merges to `scripts/data/` as a
  reproducibility reference and nothing in the product loads it. This is the ADR's central
  decision, restated here so no step drifts into it.
- **Changing the numeric evidence-vector model.** It stays valid for call sites where evidence is
  not uniformly zero. This IMPL adds a path, it does not replace one.
- **Flipping `elmPrefilter.enabled` to `true`.** Out of scope for this IMPL entirely — see Step 14.
- **`TJ-A3`'s taxonomy work.** We sequence behind it; we do not touch it.
- **Gold set #2 labelling.** Its 250 files stay blind. Nothing here reads them as labels.
- **Any lockfile regeneration** beyond what Jarrett's already-committed dependency requires.

---

## Files touched

Per `OWNERSHIP.md` and `IN-FLIGHT.md`'s shared-file list. **No note has been sent to Jarrett or
Thomas.** Step 3 is that note; every row marked "NO — Step 3" is blocked on it.

| Path | Owning team | New/Edit | Note sent? |
|---|---|---|---|
| `scripts/data/elm-archetype-corpus-v2.json` | Nolan | Edit *(already committed; may gain rows at Step 4)* | n/a |
| `Claude-Context/Nolan-Agents/ELM-CORPUS.md` | Nolan | Edit — record the v2 coverage result | n/a |
| `Claude-Context/Nolan-Agents/ELM-FINDINGS.txt` | Nolan | Edit — append the v2 verdict | n/a |
| `Claude-Context/Nolan-Agents/BACKLOG.md` | Nolan | Edit — `TN-S2` row | n/a |
| `Claude-Context/IN-FLIGHT.md` | **SHARED** | Edit — claim row | ⚠️ see Step 1 |
| `Claude-Context/Jarrett-Agents/Notes/NOTE-nolan-to-jarrett-2026-09-04-*.md` | **Jarrett** | New | **this IS the note (Step 3)** |
| `packages/sourcevision/scripts/train-baseline-elm.ts` | **Jarrett** | Edit | **NO — Step 3** |
| `packages/sourcevision/src/analyzers/classify-elm.ts` | **Jarrett** | Edit | **NO — Step 3** |
| `packages/sourcevision/src/cli/commands/analyze-phases.ts` | **Jarrett** *(3 teams edit it)* | Edit | **NO — Step 3** |
| `packages/sourcevision/tests/unit/analyzers/classify-elm.test.ts` | **Jarrett** | Edit | **NO — Step 3** |
| `packages/sourcevision/tests/integration/elm-prefilter-wiring.test.ts` | **Jarrett** | Edit | **NO — Step 3** |

⚠️ **`Claude-Context/IN-FLIGHT.md` is the only file that conflicts in every merge in this plan**
(`dev`+`Jarrett` and `Jarrett`+`Nolan-Work` each conflict on it and nothing else). Adding a claim
row makes that resolution marginally worse. Add it anyway — an unclaimed cross-team plan is how
this project got three `classify-elm.ts` files — but resolve it in Step 5 deliberately, keeping
**both** teams' rows rather than taking either side wholesale.

---

## Steps

### Phase 1 — Prove and offer (Syrup, Team Nolan)

**Step 0 — run the v2 coverage check. This gates everything.**

```sh
node scripts/elm-coverage-check.mjs --frozen=scripts/data/elm-frozen-model-v2.json
```

No ground truth, no labels, no LLM calls, no state written. Corpus v2 is an **unvalidated fix** —
`ELM-CORPUS.md` § 6 says so in its own text — and this is the cheapest possible test of the one
property that matters.

Three outcomes, all of which continue:

| Outcome | What changes |
|---|---|
| **Coverage ≥30% on fresh ecosystems (K1' PASS)** | Full IMPL proceeds. The corpus is offered as a training input that generalises. |
| **Coverage <30% (K1' FAIL)** | **The corpus still merges, with the negative attached.** Steps 8-11 are deferred: nobody trains a shipping model on it. Steps 1-7 and 12-13 proceed unchanged — Jarrett needs this result *more* on this branch, not less, because it is the result that stops them spending `TJ-R2`'s eval budget on a corpus that cannot carry it. |
| **Script errors / ambiguous** | Stop. Do not interpret. Report to Jam — the model is `TN-J32` and the verdict is his to publish, per the `TN-B5` precedent. |

**Do not publish a number from this without its baseline** (corpus v2 majority: `utility`, 38.3%)
and without naming the frozen artifact it used (`contentHash`
`bbf076741c23703c66ac74008c9ffde282cb958d1eb779549bc64fc1ba31a95f`).

**Step 1 — claim `TN-S2`** in `Nolan-Agents/BACKLOG.md` and add the `IN-FLIGHT.md` row. Commit
before starting Step 2 — git is the lock, first commit wins. The claim covers: the corpus and its
docs, the outbound draft, and **read-only** inspection of `origin/Jarrett`. It explicitly does
**not** claim any file under `packages/`.

**Step 2 — record the Step 0 result where it will be read.** `ELM-CORPUS.md` § 6 carries two
sentences that Step 0 makes false: "**Corpus v2 is the attempted fix for exactly this, and it is
UNVALIDATED**" and "**But the coverage re-check has not been run against v2.**" Replace **both**
with the measured outcome, pass or fail, naming the command, the frozen artifact's `contentHash`,
and the baseline. Leave the closing paragraph ("The cheap way to check…") intact — it is advice to
the next reader, not a status claim. Append the same verdict to `ELM-FINDINGS.txt`.

Order matters: **§ 6 must be true before the corpus is offered to anyone.** Offering a corpus
whose own documentation says its central property is untested is how a team inherits a failure
mode without noticing.

**Step 3 — draft the outbound note to Jarrett** at
`Claude-Context/Jarrett-Agents/Notes/NOTE-nolan-to-jarrett-2026-09-04-corpus-available-and-the-generalisation-result.md`.

**Syrup drafts; Nolan sends.** Content, in this order — the useful thing first, the process
complaint last or not at all:

1. A labelled path-text corpus exists: 624 rows, 7 ecosystems, seeded stratified split, committed.
2. The Step 0 result, with baseline and command.
3. `TJ-R2`'s Evidence section can be filled from it rather than harvested from scratch — and
   Archer's Step 4 encoder can be measured against ours rather than instead of it.
4. **Held-out CV will not reveal the generalisation failure.** Held-out rows come from the training
   repos. This is how it passed our own gate. Say it plainly, because it is the part that saves
   them weeks.
5. Their baseline is not reproducible off Archer's machine — offered as a thing the corpus fixes
   for them, not as a criticism.

Also flag, without making it the headline: **K2's earlier notes at `c2d1ddb4` never reached
them.** They are on `Nolan-Work` only. Notes are delivered by merging.

**Step 4 (optional, cheap) — extend the corpus from already-paid-for rows.** `ELM-CORPUS.md` § 7
records that **105 of gold set #2's 355 LLM-labelled candidates were never sampled into the
packet.** Those are free training rows that do not touch the blind 250. If Step 0 failed on
ecosystem diversity, this is the cheapest available intervention and it costs no LLM calls.

**Skip this if Step 0 passed** — do not change the corpus under a result that was just measured
on it. Sequencing: re-run Step 0 against any extended corpus before offering it.

### Phase 2 — Land the branches (the leads)

**Step 5 — `dev` → `Jarrett`.** One conflict, `Claude-Context/IN-FLIGHT.md`. Resolve by keeping
both teams' claim rows.

> ⚠️ **Grep is unreliable in the file you are about to resolve around.**
> `packages/sourcevision/src/cli/commands/analyze-phases.ts` carries two raw NUL bytes, so plain
> `grep` exits 1 and prints **nothing** — silence, not an error — exactly where the ELM wiring
> lives. Use `grep -a`, `rg --text`, or `python3`. Offsets are branch-specific: 16345/16374 on
> `dev`/`main`/`Nolan-Work`, **18588/18617 on `Jarrett`**.

**Step 6 — `dev` → `Nolan-Work`.** Clean as of 2026-09-04 (verified, zero conflicts). This is the
merge that actually delivers the corpus, the docs, and K2's undelivered notes.

**Step 5 must precede Step 6, and not only because Jarrett's delta is smaller.** This IMPL and its
ADR cite four documents that exist **only on `origin/Jarrett`** —
`ADR-2026-08-11-jarrett-elm-prefilter-classify.md`,
`ADR-2026-08-31-realm-path-based-elm-classifier.md`,
`IMPL-2026-09-03-knight-tj-a3-execution-and-tj-r2-gate.md`, and Jarrett's `BACKLOG.md` rows.
Landing Nolan first would put both documents on `dev` with dangling references to files `dev` does
not yet carry. Jarrett first, then Nolan, and the references resolve on arrival.

**Step 7 — Thomas, last and negotiated separately.** `Jarrett`+`Thomas_Branch` conflicts on 5
files including **add/add on `classify-elm.ts` and `classify-elm.test.ts`** — two independent
implementations of one filename. That is a reconciliation, not a merge, and it needs Thomas in the
room. `dev`+`Thomas_Branch` is clean *alone*, so **order determines who pays**: land Jarrett
first and Thomas absorbs the cost, which is the right way round only because Jarrett's
implementation is the one with 28 tests and a lifecycle design.

> **Dependency sign-off, required before Step 5.** Jarrett's branch adds
> `@astermind/astermind-community` to `packages/sourcevision/package.json` and churns
> `pnpm-lock.yaml`. Both are on the shared "nobody edits unilaterally" list; doctrine puts
> dependency additions under collective command. Jarrett having already made the change on their
> own branch is not the sign-off — **landing it in `dev` is what makes it collective.** This is
> the same gate Butter is holding `TN-B3` Step 0 for, and the two should be decided together.
>
> **Before any lockfile operation: confirm `pnpm --version` reports 10.33.0.** It does today —
> `package.json` pins `packageManager: pnpm@10.33.0` and corepack honours it inside the repo. The
> hazard is an operation run **outside** that pin, where a global pnpm 11 takes over silently. `pnpm.overrides` is
> ignored by pnpm 11 (clean-room verified: 10.33.0 reads it silently, 11.23.0 warns and drops it).
> `origin/main`'s lockfile carries the resolved block, so 14 CVE pins are live today and a
> regeneration outside corepack's pin silently drops them.

### Phase 3 — Wire the corpus in (Team Jarrett)

**Step 8 — add a corpus-file input path to `train-baseline-elm.ts`.** The trainer's shape today is
`loadSourcevisionDir()` → `extractNumericExamples()` → `trainArchetypeELMNumeric()`. Add a second
loader that reads the corpus's flat rows —
`{text, label, confidence, source, repo}`, where `text` is the file path — and feeds whatever
extraction function `TJ-R2` settles on.

**The trainer does not change; only where its examples come from.** Keep the existing
`.sourcevision/`-directory path — it is the correct input for the numeric model.

Use the corpus's **own seeded stratified split** (seed 42, holdout 0.25) and **do not re-split**
(`ELM-CORPUS.md` § 2): re-splitting makes the numbers incomparable to everything in
`ELM-FINDINGS.txt`.

**Step 9 — generalise the bundled-artifact contract.** Read `hiddenUnits`, `activation` and
`inputSize` from the artifact rather than the module constants at `classify-elm.ts:34`
(`HIDDEN_UNITS = 128`) and `:279` (`inputSize: artifact.catalogSize`). Add an optional vectorizer
block for text models. **This is needed for Jarrett's own retrained path-text model** — it is not
scaffolding for ours.

**Step 10 — make the zero-evidence guard representation-aware.** `classify-elm.ts:350`:

```ts
if (!vector.some((v) => v > 0)) continue;
```

Correct and load-bearing for the evidence vector. **Exactly inverted for path text**, which is
never empty — and the zero-evidence files are precisely the population a path-text model exists to
serve. It must remain unconditional for the numeric model and not apply to the text one.

⚠️ **This is the most dangerous change in the plan.** Removing it wholesale re-enables a model
that predicts the class prior for every file, which is exactly what it was added to prevent. Step
12's first test exists for this line specifically.

**Step 11 — widen the config surface** so the operating point is expressible: an `abstainOn` list
and an admit-fraction alongside `confidenceThreshold`, under the existing
`sourcevision.classification.elmPrefilter` key. A scalar threshold cannot express
"abstain on `service`/`utility`, admit 10%".

### Phase 4 — Measure and gate (Jarrett, method from Nolan)

**Step 12 — coverage as a runtime gate.** Port `scripts/elm-coverage-check.mjs`'s logic into the
harness so the tier can measure its own coverage on the user's repo and **decline to engage when
it is out of distribution** (`elm-coverage-check.mjs:22-24`). No ground truth needed at runtime.

This is the generalisable answer to the § 6 failure and the one design idea here that should
survive even if every model on both branches is discarded.

**Step 13 — run both encoders against corpus v2, seeded, on the zero-evidence population.**
Archer's char-mode `UniversalEncoder` (`TJ-R2` Step 4, currently unpushed at `ae9dc463`) and our
TF-IDF encoder. Report both with the majority baseline (38.3% `utility`) and the seed. Neither
team discards the other's on argument.

**Gate on `TJ-A3`:** this step waits for Knight's IMPL Step 6a (the zero-evidence-population
re-measurement) and its Step 13 hand-off, per
`IMPL-2026-09-03-knight-tj-a3-execution-and-tj-r2-gate.md`, Addition 2. Their gate and this one
are the same gate.

**Step 14 — `enabled` stays `false`.** It flips only on a coverage pass against a repo the model
was **not** trained on. **Never on held-out CV** — that is the measurement that already fooled
both teams. Flipping it is a separate decision, a separate ADR, and not in this IMPL's scope.

---

## Test strategy

**Phase 1 (Nolan)** has no unit tests — it ships data and documents. Its check is Step 0's script,
which is committed, seeded and re-runnable by another team. That is this project's standard for
whether a result happened.

**Phases 3-4 (Jarrett):**

- **Unit — the guard, first and most important.** A test that a path-text model **does** classify
  a zero-evidence file, and that the numeric model **still does not**. This is a behaviour change
  to a safety guard: **write it, watch it fail on the current code, then make it pass.** If it
  passes before Step 10, it is testing the wrong thing.
- **Unit — artifact contract:** a bundled artifact with non-default `hiddenUnits`/`inputSize`
  loads and predicts; a text artifact missing its vectorizer block fails **loudly**, not silently.
  `loadModelFromJSON` on a weightless artifact is the kind of thing that half-works.
- **Unit — corpus loader:** rows load, the seeded split is not re-split, an unknown label is
  rejected rather than silently dropped.
- **Integration —** extend `tests/integration/elm-prefilter-wiring.test.ts`: with `enabled: false`
  (the default) the pipeline is byte-identical to today; with a text model and `enabled: true`,
  results merge through `mergeClassificationResults` with `source: "elm"`.
- **Integration — the three guards interact.** Confidence, zero-evidence and coverage now compose.
  Test that a low coverage score suppresses the tier **even when** confidence is high — the
  failure mode being defended against is a confidently-wrong out-of-distribution model, which is
  exactly what corpus v1 produced.
- **Must stay green:** `pnpm typecheck`, `pnpm test`, `tests/e2e/domain-isolation.test.js`,
  `tests/e2e/architecture-policy.test.js`.

**If tests fail, say they failed and paste the output.** Do not write "done".

---

## Rollback

**Phase 1:** `git revert` the commits. The corpus and docs are additive and nothing loads them at
runtime. **Not enough on its own:** if Step 4 extended the corpus, re-verify the gold-set-#2
contamination assertion (`elm-goldset2-packet.mjs` refuses to build on overlap) — a reverted corpus
with a non-reverted packet is a contamination hazard. Nothing here writes `.rex/`,
`.sourcevision/` or `.hench/`.

**Phase 2:** revert the merge commits on `dev`. Coordinate — `dev` is shared, and a revert after
Thomas has merged on top is a second reconciliation.

**Phase 3:** revert the commits. `enabled` defaults to `false` throughout, so the blast radius at
runtime is zero for as long as that holds. **The exception is Step 10** — if the guard change
merges and is later reverted while a text model is configured, the tier silently stops resolving
its entire target population rather than erroring. Step 12's test should catch that; say so in the
revert commit either way.

**Phase 4:** the runtime coverage gate is fail-closed by construction — if it cannot compute
coverage it declines to engage, so a broken gate degrades to today's behaviour (LLM handles
everything) rather than to a confidently-wrong tier.

---

## Open questions

1. **Does corpus v2 generalise?** Step 0 answers it and nothing downstream is meaningful until it
   does. *Unanswered as of 2026-09-04.*
2. **Will Jarrett accept the corpus at all?** They have their own 686-example pooled corpus and
   `TJ-R2` is claimed. This ADR argues theirs is not reproducible off one machine and ours covers
   7 ecosystems — but it is their call, and "no" is a legitimate answer that leaves Phase 1
   standing. *Blocked on Step 3, which is blocked on Nolan sending it.*
3. **Whose numbers become the shipped baseline** if both encoders clear the gate at Step 13? Not
   ours by default — we have no wiring and no claim on that decision.
4. **Does `TJ-A3` move enough of the label space to require a corpus relabel before Step 8?**
   Knight's Step 6a produces the answer. If the catalog changes materially, Step 8 waits.
5. **Is the 9-seed ensemble worth keeping?** It is currently **−2.16 pp on train-CV** (single seed
   69.2%, ensemble 67.0%), recorded in the frozen artifact's own `selection.deltaPp`. Measured on
   **one fold seed** and the artifact's `foldSeedsReduced` field says not to quote it as model
   selection — **so it is not a finding.** Resolving it is a 3-fold-seed re-run at 4096 (~2.5 h),
   and it is only worth spending if Step 0 passes. *Jam's, under `TN-J32`.*
6. **Dependency sign-off:** does Jarrett's `packages/sourcevision` dependency land together with
   Butter's `packages/llm-client` one (`TN-B3` Step 0)? Two workspace declarations of the same
   package, decided separately, is how a lockfile gets churned twice. *The leads'.*
