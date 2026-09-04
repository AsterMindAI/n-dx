# ADR — Adopt Team Thomas's path-text representation, and retract two Team Nolan numbers it invalidates

- **Status:** **Proposed.** Two of its three parts are Team Nolan's own to accept — the retraction
  and the `elm-hello-world.mjs` fix. The third decides work in
  `packages/sourcevision/src/analyzers/`, shared by Teams Jarrett and Thomas, and needs their
  acceptance plus a second lead's sign-off. **Drafted for Nolan to send.**
- **Date:** 2026-09-04
- **Author:** Syrup (Team Nolan)
- **Supersedes:** none. **Corrects** every document quoting the prototype's 4.8%/9.6% — four of
  them, listed in § Retraction, **including one of my own**.
- **Related:** `ADR-2026-09-04-syrup-merge-elm-corpus-into-jarrett-harness.md` (the corpus half;
  this ADR is the representation half, and the two are meant to land together).
- **Backlog item:** `TN-S3`

---

## Context

### Team Thomas found a library defect that invalidates two of our published numbers

`packages/sourcevision/src/analyzers/classify-elm.ts` on `origin/Thomas_Branch` carries this, from
Nala:

> `ELM.train()` … doesn't train on supplied examples at all (its only parameter is
> `augmentationOptions`, not a training set).

**Verified at source, and then proved empirically rather than taken on the comment's word.**

`node_modules/@astermind/astermind-community/dist/core/ELM.d.ts:59` declares
`train(augmentationOptions?: { suffixes?, prefixes?, includeNoise? }, weights?)`. There is no
training-set parameter and no `loadTrainingData` setter anywhere in the type surface. The
implementation at `dist/astermind.esm.js:1146` shows what it trains on instead:

```js
train(augmentationOptions, weights) {
    if (!this.useTokenizer) throw new Error('train(): text training requires useTokenizer:true');
    const enc = this.assertEncoder();
    const X = []; let Y = [];
    this.categories.forEach((cat, i) => {
        const variants = Augment.generateVariants(cat, this.charSet, augmentationOptions);
        ...
```

**It trains on the category label strings**, augmented into variants. Anything you pass as the
first argument is read as an options bag; an array yields `undefined` for every property it looks
for, so the call silently degrades to `train()` with defaults.

Proof, seeded and decisive — two models, identical config and seed, trained on **deliberately
inverted** data:

```
models identical despite opposite training data: true
A predicts (path): [{"label":"service","prob":0.3916086735163929}]
B predicts (path): [{"label":"service","prob":0.3916086735163929}]
  predict("service")   -> [{"label":"service","prob":0.457}]
  predict("utility")   -> [{"label":"utility","prob":0.454}]
  predict("component") -> [{"label":"component","prob":0.469}]
```

Byte-identical `savedModelJSON`. The model knows the *label strings* and has never seen a path.
Nala reported the same three-way result independently on 2026-08-31; this is a second,
separately-constructed reproduction, not a relay.

### Which of our scripts this hits, and which it does not

Audited every ELM script on `Nolan-Work` for `.train(` versus `.trainFromData(`:

| Script | Call | Affected? |
|---|---|---|
| `scripts/elm-prototype/{classifier,train-eval,self-test}.mjs` | base `ELM.train(rows)` | **YES — numbers void** |
| `scripts/elm-hello-world.mjs` | base `ELM.train(TRAINING_SET)` | **YES — the repo's own proof of concept** |
| `elm-feasibility-screen.mjs` (Jam's 54.4%) | `trainFromData` | No |
| `elm-freeze-model.mjs` (the frozen model) | `trainFromData` | No |
| `elm-coverage-check.mjs` (the K1' gate) | `trainFromData` | No |
| `elm-certify` · `elm-diagnostics` · `elm-goldset2-power` · `elm-k2-analysis` | `trainFromData` | No |
| `elm-architecture-sweep.mjs:200` | `VotingClassifierELM.train(predictionLists, confidenceLists, trueLabels)` | No — real 3-arg signature |
| `elm-operating-point.mjs:262` | `ConfidenceClassifierELM.train(vectors, metas, labels)` | No — real 3-arg signature |

**The entire measurement chain the corpus ADR rests on is `trainFromData` and survives intact.**
The damage is contained to the prototype and the hello-world.

### The retraction

`scripts/elm-prototype/classifier.mjs:59` is `this.#elm.train(rows)` on a base `ELM`. Therefore:

- **Butter's 4.8% is void.** Not "depressed by a defective encoder" — measured on a model that
  never saw the corpus.
- **Butter's corrected 9.6% is void for the same reason.** The charSet fix was real and the
  reasoning was sound; it moved a number that was never a measurement of path-text classification.
- **The uppercase-vs-lowercase A/B (4.8% → 9.6%) does not survive either.** It compared two models
  that had both trained on label strings.
- **`elm-hello-world.mjs`'s 83% is not evidence the library learns from labelled examples** — the
  claim `claude-context-instruction` § 1 points every new agent at, and the control gate Butter
  built `self-test.mjs` around. The 83%/100%/67% confusion that cost Butter and me a round trip on
  2026-08-31 was this defect the whole time.

What survives unchanged: **the dead-slot finding** (`charToOneHot` lowercases, so an uppercase
charSet adds 26 unreachable slots) and **the tokenizer defect** (`tokenize(text).join('')` at
`astermind.umd.js:771-773`). Both are properties of the library, verified independently of any
training call. They were right; the numbers attached to them were not.

### Doctrine was followed and the finding still did not arrive

Thomas filed this correctly. It is in **`Claude-Context/IN-FLIGHT.md` § 3, "Decisions & findings"**
on `Thomas_Branch`, dated 2026-08-31, with the mechanism and the empirical confirmation, and it
explicitly says *"don't cite it as such."* That is exactly what the cross-team board is for.

**It has sat there for four days and no one on Team Nolan read it**, while Butter reasoned about
the 9.6% and I built an ADR chain on a measurement stack I had not audited. The board only works
if someone merges it. This is the third instance of the same failure in one week — K2's outbound
notes stranded on `Nolan-Work`, Archer's `ae9dc463` stranded in a local worktree, and now Thomas's
correction stranded on `Thomas_Branch`. **The problem is not that people are failing to write
things down. It is that writing is not delivery.**

### What Thomas built

`classify-elm.ts`, 133 lines, wired **inside** `enrichClassificationsWithLLM`
(`classify.ts:346-371`, +36 lines) ahead of the Claude batch.

- **Path text**, encoded by `UniversalEncoder` in `mode: "char"` with
  `tokenizerDelimiter: /[/._-]+/`, then `ELM.trainFromData(X, y)` — deliberately not ELM text mode.
- **All three known library gotchas absorbed correctly**: `-` last in the charSet, lowercase-only
  charSet, `maxLen: 80`. They arrived at our conclusions independently.
- **Margin-based abstention** — `top1 − top2 ≥ 0.3`, returning `null` rather than a low-confidence
  label. Structurally closer to our operating point than a scalar threshold.
- **Shadow mode**: trains and predicts on every run, but `ELM_GATE_ENABLED = false` means no file
  ever skips the Claude batch.
- **Evidence**: `scripts/classify-elm-eval.mjs`, seeded (42, local `mulberry32`), 338 train / 85
  held-out, **90.6% (77/85)** against a 5.9% uniform and 19.5% majority-class baseline, with the
  acceptance bar pre-registered in the IMPL *before* the run.

Their ADR retracts the hello-world 83% in its own Context, marks the earlier 0/260 figure
"directional-only — never a committed script," and states plainly that 90.6% is measured on the
already-classifiable population and **does not prove generalisation to the unclassified target**.
That is the same caveat Realm reached on Jarrett's side and the same one our coverage check
measured. Three teams, independently, now.

### Where each team actually stands

| | Representation | Harness | Corpus | Generalisation evidence |
|---|---|---|---|---|
| **Jarrett** | evidence vector — **provably all-zero** on the target population | **strong** — standalone module, `.n-dx.json` kill switch, hybrid lifecycle, 28 tests | 5 repos, **only reproducible on one laptop** | none — held-out drawn from training repos |
| **Thomas** | **path text — correct** | weak — invasive, trains every run, no config surface | this repo only, retrained per run | none — 90.6% on the easy population |
| **Nolan** | path text (TF-IDF) | **none** | **624 rows / 7 ecosystems, committed** | **measured — v1 failed, v2 unvalidated** |

Nobody has all three. **Thomas has the representation that is right and the harness that is
wrong; Jarrett has the reverse.**

### Merge topology

Simulated read-only with `git merge-tree --write-tree`, git 2.39.5:

| Merge | Conflicts |
|---|---|
| `dev` + `Thomas_Branch` | **none** |
| `Nolan-Work` + `Thomas_Branch` | **none** |
| `Jarrett` + `Thomas_Branch` | 5 |

**Thomas collides with nobody except Jarrett.** And two of those five are cosmetic — both teams
widened the same union and merely ordered it differently:

```
Thomas : source: "algorithmic" | "llm" | "user-override" | "elm";
Jarrett: source: "algorithmic" | "llm" | "elm" | "user-override";
```

Semantically identical types. Same in `validate.ts`. Both also add the byte-identical dependency
line to `packages/sourcevision/package.json`, which git auto-merges.

**The real collision is two files:** `classify-elm.ts` (Jarrett 362 lines, Thomas 133 — add/add)
and `classify-elm.test.ts` (382 vs 144 — add/add). One filename, two unrelated implementations.

Also worth recording: `Thomas_Branch` is now the **live** branch (2026-09-04, 3 ahead of `dev`) and
`Thomas's_Branch` is stale (2026-08-28, 24 behind). That is the reverse of what `TN-S1` reported on
2026-08-31, and Thomas has since migrated onto our doctrine — dated-and-attributed ADR/IMPL
filenames in `Claude-Context/`, and the numbered `ADR-001` and `Claude-Context/Claude-Agents/` are
gone from the live branch. **`TN-S1`'s "Team Thomas is not on our doctrine" is out of date and this
ADR corrects it.**

---

## Decision

**Three things, separable — take them in this order.**

**1. Retract the prototype numbers, at the documents where they landed.** 4.8%, 9.6%, and the
uppercase/lowercase A/B are withdrawn as measurements of path-text classification, with the
mechanism recorded. This is Team Nolan's own housekeeping and blocks on nobody. Per
`claude-context-instruction` § 8, the correction goes **in the originals**, not only in this ADR.

**The four carriers, located by grep rather than assumed:**

| Document | What it carries |
|---|---|
| `Notes/NOTE-…-2026-08-27-prototype-ready-verdict-is-yours.md:37` | Butter's original 4.8% table |
| `Notes/NOTE-…-2026-08-31-syrup-verified-you-were-right.md` | Butter's 4.8% → 9.6% charSet A/B |
| **`Notes/NOTE-…-2026-08-31-jarrett-and-thomas-both-built-path-b.md:124`** | **mine** — "4.8% agreement, −32.5 points against a 37.3% baseline, seed 42" |
| `Nolan-Agents/Jam.md:549` | Jam's charter, relaying it |

**One of those is my own `TN-S1` note**, where I published the number with a seed and a baseline
attached, in the format this project reserves for real measurements. I did not audit the training
call before repeating it. Correcting that one is not optional.

**`ADR-2026-08-27-butter-prove-before-provisioning.md` is not among them.** It is **Proposed —
needs Nolan**, not Accepted, and it explicitly instructs the prototype to "publish **no accuracy
number**" (line 60). Butter's design discipline is the reason the void figures never reached an
ADR at all — worth saying, because the lane is being retired and that part of it worked.

**2. Fix `scripts/elm-hello-world.mjs`, or label it.** It is the repo's front-door proof of
concept, `claude-context-instruction` § 1 sends every new agent to read it, and it does not do what
its name says. Port it to `UniversalEncoder` → `trainFromData` — Thomas's `classify-elm-eval.mjs`
is the reference implementation and Nala verified the port with a shuffled-label control (real
labels 6/6, shuffled 3/6 = chance for 3 classes). Thomas explicitly left this file alone as not
theirs to touch and flagged it as an open question for whoever owns it. **It is in root `scripts/`,
Team Nolan has built on it, and we should take it.**

**3. Adopt Thomas's representation onto Jarrett's harness, trained on Nolan's corpus.** Each team
contributes the part it has evidence for:

- **From Thomas:** the path-text `UniversalEncoder` char-mode encoding and the **margin-based
  abstention** (`top1 − top2`), which is a better decision rule than a scalar confidence threshold
  and closer to what our operating-point work already concluded.
- **From Jarrett:** the harness — standalone module (not surgery inside
  `enrichClassificationsWithLLM`), the `.n-dx.json` kill switch, the model lifecycle, and the test
  suite.
- **From Nolan:** the corpus, so the model is not retrained per run on a single repo's prior — the
  exact failure our coverage check caught.

**Resolve the `classify-elm.ts` add/add by architecture, not by seniority.** Jarrett's file is the
surviving container because it is the one with a lifecycle, a config surface and 28 tests; Thomas's
encoder and margin rule move into it as the text-representation path. Their unit tests port
alongside — 144 lines that test a representation Jarrett's suite does not cover.

**Drop the shadow-mode always-train.** Training a 512-unit ELM inside every `ndx analyze` run and
discarding the result while `ELM_GATE_ENABLED` is `false` is a cost users pay for nothing. Jarrett's
config gate already expresses this correctly: do not train unless enabled.

**`enabled` stays `false`** until coverage passes on a repo the model was not trained on. Thomas's
90.6%, Jarrett's 100% @ 59.0%, and Knight's 97.0% @ 42.3% are all measured on populations that
exclude the files the tier exists for. **None of the three is a reason to flip it.**

---

## Alternatives considered

| Option | Why not |
|---|---|
| **Keep the prototype numbers, add a caveat** | They are not depressed measurements, they are non-measurements — the model never saw the data. A caveat implies a signal that is not there. `ADR-2026-08-27-butter-prove-before-provisioning.md` is Accepted and cites them; leaving them standing means the next person builds on a number with nothing behind it. |
| **Take Thomas's `classify-elm.ts` as the surviving file** | The representation is right, but it has no config surface, no lifecycle, no cold-start path, and it edits `enrichClassificationsWithLLM` directly — the file three teams already touch. Adopting it wholesale throws away 28 tests and the kill switch to keep 133 lines that are easier to port than to replace. |
| **Take Jarrett's file unchanged and have Thomas re-implement inside it** | Duplicates work Nala has already done, tested and evidenced — and Archer independently reached the same `UniversalEncoder` char-mode design for `TJ-R2` Step 4. Three implementations of one encoder is how this project got three `classify-elm.ts` files. |
| **Let Thomas merge to `dev` first — they conflict with nobody** | True today, and it is exactly the trap. `dev`+`Thomas` is clean only because Jarrett is not there yet; landing Thomas first hands the entire 5-conflict reconciliation to Jarrett, who has the larger and better-tested implementation. Order determines who pays, so it should be decided rather than raced. |
| **Fix `elm-hello-world.mjs` quietly without an ADR** | It is cited in `claude-context-instruction` § 1 as the thing every new agent reads first, and its 83% has been quoted across three teams. A silent fix leaves every prior citation standing. |
| **Do nothing until `TJ-A3` lands** | Reasonable for the code (and the corpus ADR sequences behind it), but not for the retraction. A void number does not become less void by waiting, and Butter is the person most likely to act on it next. |

---

## Consequences

**Easier.** The one representation with a real chance on the zero-evidence population gets the one
harness built to ship it, backed by the one corpus measured across ecosystems. Three teams stop
maintaining three encoders. And the project's front-door example starts demonstrating the API it
recommends.

**Harder.** A retraction touching an Accepted ADR and two notes. Porting Thomas's tests into
Jarrett's suite. And a genuine loss: **Butter's prototype lane produced no usable measurement.** The
engineering — config discipline, the self-test gate, the A/B rigour — was sound; it was aimed
through a call that ignored its input.

**What breaks.** Nothing at runtime — Thomas ships behind `ELM_GATE_ENABLED = false` and Jarrett
behind `elmPrefilter.enabled = false`. Two build-time items: `packages/sourcevision/package.json`
gains `@astermind/astermind-community` (**both teams add the identical line**) and `pnpm-lock.yaml`
churns. Both are on the shared "nobody edits unilaterally" list and need a second lead — the same
gate Butter holds `TN-B3` Step 0 for. Thomas argues in their ADR that the package-level manifest is
not on the shared list and so needs no sign-off; **that reading is worth settling explicitly by the
leads rather than by whoever merges first**, because `pnpm-lock.yaml` churns either way and the
lockfile is unambiguously shared.

**Before any lockfile operation, confirm `pnpm --version` reports 10.33.0.** `pnpm.overrides` is
ignored by pnpm 11, not 10 (clean-room verified). `dev`'s root `package.json` still carries the
resolved `overrides` block, so 14 CVE pins are live; a regeneration outside corepack's pin drops
them silently. `pnpm-workspace.yaml` with `minimumReleaseAgeStrict` is **already on `dev` and byte-identical on
`Thomas_Branch`** — so it is not a pending Thomas contribution, and nothing here needs to land it.
What is still open is that `dev`'s **root `package.json` retains the `overrides` block**, which
`pnpm-workspace.yaml` does not carry. The CVE pins therefore still depend on the corepack pin
holding.

**What we now maintain.** One classifier module with two representation paths, a corpus that
relabels when `BUILTIN_ARCHETYPES` moves, and a fixed hello-world that must stay honest.

**Teams affected: Thomas and Jarrett, both directly. No note has been sent to either.** Syrup
drafts, Nolan sends; this ADR is that draft. As of 2026-09-04, **neither team knows this exists**,
and K2's earlier notes at `c2d1ddb4` never reached them.

---

## Evidence

### Verified in this session, at source or by execution

- **`ELM.train()` takes no training set** — `dist/core/ELM.d.ts:59`; implementation at
  `dist/astermind.esm.js:1146` trains on `Augment.generateVariants(cat, …)` over
  `this.categories`. No `loadTrainingData` or equivalent exists in the type surface.
- **Empirical proof** — two base `ELM`s, identical config and `seed: 42`, trained on deliberately
  inverted row sets, produced **identical `savedModelJSON`** and identical predictions, while
  `predict("<label>")` returned that label at ~0.46. Independently reproduces Nala's
  three-way result of 2026-08-31.
- **Call-site audit** — every ELM script on `Nolan-Work` classified `.train(` vs `.trainFromData(`;
  table in Context. Both surviving `.train(` calls are on `VotingClassifierELM` and
  `ConfidenceClassifierELM`, whose declared signatures (`VotingClassifierELM.d.ts:13`,
  `ConfidenceClassifierELM.d.ts:31`) genuinely take data.
- **`scripts/elm-prototype/classifier.mjs:59`** — `this.#elm.train(rows)` on a base `ELM`. This is
  the line that voids 4.8% and 9.6%.
- **Merge topology** — `dev`+`Thomas_Branch` and `Nolan-Work`+`Thomas_Branch` both **clean**;
  `Jarrett`+`Thomas_Branch` conflicts on 5 files, of which `schema/v1.ts` and `schema/validate.ts`
  are ordering-only and `classify-elm{,.test}.ts` are add/add.
- **Thomas filed the finding on the cross-team board** — `IN-FLIGHT.md` § 3 on `Thomas_Branch`,
  dated 2026-08-31, undelivered because nothing merges.
- **Thomas migrated onto our doctrine** — `Claude-Context/ADR/ADR-2026-08-31-nala-classify-elm-rewrite.md`
  and the paired IMPL, correctly named. Still **no charter and no roster row for Nala**
  (`Thomas-Agents/README.md` roster reads `_(none yet)_`), and their IMPL names branch
  `elm/thomas/classify-elm-text-mode`, **which exists on no remote** — the same `TN-F1` gap.

### Measurements referenced (with seeds and baselines)

| Result | Population | Seed | Baseline | Script |
|---|---|---|---|---|
| **90.6% (77/85)** | n-dx's **already-classified** files, 338 train / 85 held-out | 42 (`mulberry32`) | 5.9% uniform · **19.5% majority** | `scripts/classify-elm-eval.mjs` (Thomas) |
| 54.4% vs truth / 59.9% vs teacher | **LLM-bound** files, 241 / 83 | Jam's screen | 37.3% majority | `scripts/elm-feasibility-screen.mjs` |
| Coverage 34.9% PASS → **13.2% FAIL** on unseen repos | gold #1 vs gold #2 | frozen v1 | K1' ≥30% | `scripts/elm-coverage-check.mjs` |
| 100% @ 59.0% (Archer) · 97.0% @ 42.3% (Knight) | **self-invalidated** — held-out had resolvable labels | 20260812 | — | `eval-classify-elm-numeric.ts` |
| ~~4.8%~~ · ~~9.6%~~ | — | — | — | **RETRACTED — `ELM.train()` ignored the corpus** |
| ~~83% hello-world~~ | — | — | — | **RETRACTED — same defect** |

**The three live numbers are not comparable.** 90.6% is the easy population, 54.4% is the hard one,
13.2% is coverage on unseen repos. They measure three different questions, and the only one aimed at
the deployment target is the one that failed.

### What is explicitly NOT evidence

1. **Nobody has measured path text on the zero-evidence population.** Thomas's 90.6% is the easy
   population and they say so; ours is `source: "llm"` files, which overlaps but is not identical;
   Jarrett's `TJ-R2` eval is gated on `TJ-A3` and unrun.
2. **Corpus v2 has never been coverage-checked.** Unchanged from the corpus ADR; still the gate.
3. **Thomas's 0/260 is directional only** — a scratchpad run, never committed. They label it that
   way themselves. It agrees with Jarrett's independent 5-corpora result, which is committed.
4. **The margin rule is untested at scale.** `MARGIN_THRESHOLD = 0.3` against margins Nala measured
   at ~0.002 on the zero-evidence population suggests it may abstain on essentially everything
   there — **which would be correct behaviour**, but it has not been measured.
5. **I have not re-run Thomas's eval.** 90.6% is read from their committed script and results file,
   not reproduced. It is a committed seeded script, which is this project's bar, but it is their
   number until someone runs it.

### Re-running the retraction proof

The probe used for the empirical result above is not yet a committed script, so **by this project's
own standard it does not count until it is.** Committing it is Step 1 of the paired IMPL; until
then, the reproducible route is the declaration at `dist/core/ELM.d.ts:59` and the implementation at
`dist/astermind.esm.js:1146`, both of which anyone can read in an installed `3.0.0`.
