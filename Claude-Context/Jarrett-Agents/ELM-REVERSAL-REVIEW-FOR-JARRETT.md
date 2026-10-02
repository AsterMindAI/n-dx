# ELM gate reversal — plain-English explanation and review

**Prepared for:** Jarrett · **Date:** 2026-10-02
**Reviews:** `ELM-BENCHMARKS-AND-REVERSAL.md` (TJ-E1, Elon) and the top-5 gate result that preceded it
**Companion to:** `ELM-CLASSIFIER-FINDINGS.md` · `ELM-BRIEFING-SPEAKER-NOTES.md`

This document does two things: explains the reversal in plain terms, and lists what I would amend
before the correction lands in the report and the ADR. It is a review, not a measurement — every
number here is Elon's, checked for internal consistency but not independently reproduced.

**Summary of the review:** the core finding is sound and the correction should go through. Three
claims attached to it are not supported by the data presented, and one finding is being undersold.

---

## Part 1 — The top-5 per-project result

### What changed

Three things moved at once, and they do not contribute equally:

1. **The top-5 collapse.** The ELM answers only when it confidently predicts one of the five most
   common labels. Anything else — including "I think this might be one of the rare ones" — defers to
   the LLM. In plain terms: *stick to what you see constantly, don't guess at the exotic stuff.*
2. **Per-project training instead of a shipped model.** The question changed from "can we train one
   model and ship it everywhere?" to "can a project train a model on its own labelled history?"
   Different question, different answer.
3. **The ensemble shrank from 15 models to 5.** Changes the runtime figures; worth noting when
   quoting timings.

### The conceptual unlock

**Precision here means agreement with Claude, not correctness.** This matters more than any single
number, because it retires an argument the earlier report leaned on heavily.

The original analysis argued the ELM could never beat its teacher: every label came from Claude,
Claude is 72.3% correct against human judgement, so the student converges on a 72.3%-correct
imitation and stops. True — but it answers a question the gate never asked.

| Goal | Does the teacher ceiling bind? |
|---|---|
| Be a better classifier than the LLM | **Yes** — you cannot out-learn your answer key |
| Reproduce the LLM's output for free | **No** — agreement can go to 100% |

The gate was always the second one. Its job is to impersonate the LLM cheaply, not to outperform it.
For that job, agreement with the teacher is precisely the right metric and the 72.3% ceiling is
irrelevant.

**State this explicitly in the correction.** Without it the reversal reads as a change of mood rather
than a corrected frame.

One consequence to say plainly: 94% agreement with a 72.3%-correct teacher still means roughly
68–70% correct against human judgement. The gate faithfully reproduces Claude's mistakes too. That is
acceptable for a cost-saving gate, and it should be written down rather than left for a reader to
derive.

### The arithmetic checks out

42.9% of 255 files = 109 answered, 146 remaining, 5 batches instead of 9 — saves 4. The other rows
reconcile the same way. The call-savings column is correct.

### Review point 1.1 — "precision tracks training rows" is contradicted by its own table

Sorted by training rows:

| Train rows | Repo | Precision |
|---:|---|---:|
| 153 | **remix** | **94.3%** |
| 159 | core | 86.7% |
| **191** | **n-dx** | **64.4%** |
| 398 | typeorm | 96.5% |
| 627 | nest | 96.4% |

n-dx has **more** training data than remix and core and scores 30 points below remix. The
relationship is not monotonic, and the outlier is the repo the project actually needs to serve.

### Review point 1.2 — the likely real driver, and the test that settles it

A hypothesis that fits the ordering better than row count: **precision tracks how repetitive a
codebase is.**

nest and typeorm are frameworks built from hundreds of near-identical files — `*.controller.ts`,
`*.service.ts`, `*.entity.ts`, the same shape repeatedly. n-dx is a six-package monorepo where almost
every file is structurally distinct. remix and core sit in between, and they score in between.

That ordering matches the results; row count does not. It also points at a methodological risk: **if
the train/test split was random across files within a repo, the result leaks.** The feature vector is
79% hashed file contents plus path tokens, both nearly identical across sibling files. Putting 40 of
nest's controllers in training and 10 in test does not measure generalisation — it measures whether
the model recognises a file it has effectively already seen.

Production is not a random split. Labels accumulate from past runs and the gate classifies **new**
files, which are the ones least like what is already held.

**Test:** re-run the per-project evaluation splitting by directory rather than by file. If nest and
typeorm hold, the finding is stronger than it looks. If they collapse toward n-dx, the pooled figure
was leakage. Cheap, and it determines whether the correction is right.

### Review point 1.3 — on n-dx the new gate is not better than the old one

| | Coverage | Precision | Calls saved |
|---|---:|---:|---:|
| Old 15/15 unanimity | 6.3% | **81.3%** | 1 of 9 |
| New top-5 unanimity | 13.8% | **64.4%** | 1 of 9 |

Double the coverage, 17 points worse precision, identical savings. For the repo this ships to, the
new configuration is arguably a downgrade. The report's existing "don't ship on n-dx" conclusion
survives the new evidence intact, and the correction should say so rather than reading as a blanket
reversal.

### Review point 1.4 — the per-repo "calls saved" column is mislabeled

It reads as each repo's own savings. It is not — it is normalised to a 255-file, nine-call reference.
Verified: nest's 54.7% coverage applied to 255 files saves exactly 5 of 9, and every other row
matches the same way.

nest's actual residue is 836 files — about 28 calls today — and at 54.7% coverage it would save
roughly 15, not 5. The column needs a footnote or someone will quote it wrong by a factor of three.

---

## Part 2 — The six-configuration matrix

### What the design does

Two knobs, tested separately:

- **Bundled vs per-project** — ship one pre-trained model everywhere, or train on each project's own
  labelled history
- **ORIGINAL vs TOP-5** — answer with any archetype, or only the five most common

| | Bundled | Per-project |
|---|---:|---:|
| **ORIGINAL** | 41.7% | 88.9% |
| **TOP-5** | 41.1% | 65.7% (n-dx) → 96.1% (mature) |

Read the rows and the answer is immediate. **Changing the label set moves nothing: 41.7% → 41.1%.
Changing where the training data comes from moves everything: 41.7% → 88.9%.**

The headline is right, and it is now demonstrated rather than asserted.

### The best part of the analysis

A single repo only ever uses about 10 of the 16 archetypes, so the moment you train per-project
**the label set collapses on its own.** Nobody chose it; the data did. Config 2 is a 10-class problem
without anyone configuring a 10-class problem.

This dissolves an apparent conflict rather than merely resolving it: the intuition that fewer
archetypes would help was correct, but it describes *what per-project training already does* rather
than a separate lever. Two competing explanations turn out to be one mechanism seen from two angles.

### The economics table is internally sound

Every row reconciles — labels-changed, tokens, calls, cost, wall clock all follow from the coverage
and precision figures. Nothing to fix. Worth saying out loud, because the earlier deck had four
numbers that did not reconcile.

### n-dx today, stated as a trade

| | LLM only | n-dx with the gate |
|---|---:|---:|
| Calls | 9 | 8 |
| Cost | $0.19–0.55 | $0.17–0.49 |
| Wall clock | 15.8 min | 14.1 min |
| **Wrong labels** | **0** | **13** |

Three cents and 1.7 minutes, for thirteen files labelled differently than Claude would have labelled
them. "Bad trade" is correct and the table makes it undeniable.

Against a mature repo: 5 of 255 labels changed (2%), half the tokens, half the wall clock. That is a
product.

### Review point 2.1 — "top-5 is a real refinement" is not supported

Lay the six configs on the grid and there is a hole:

| | bundled | per-project (pooled) | per-project (single repo) |
|---|---|---|---|
| **ORIGINAL** | config 1 ✓ | config 2 ✓ | **missing** |
| **TOP-5** | config 3 ✓ | missing | configs 4, 5 ✓ |

The only place the two label sets are compared **under identical conditions** is the bundled column,
and there top-5 does nothing.

The comparison that appears to support a refinement is config 2 (88.9%) against config 5 (96.1%). But
those differ in two ways at once — label set **and** pooled-versus-single-repo. The pooling caveat
bites exactly here: config 2 includes n-dx dragging the average down, so the gap could be pure
composition with no label-set contribution at all.

**The missing cell is one mature repo under the ORIGINAL label set.** Run nest both ways and it is
settled in a single run. Until then the defensible claim is *"top-5 has no detectable effect;
per-project is the whole lever"* — cleaner and more striking than the current wording.

Note also that the bundled pair carries wide error bars (±10 and ±14), so the honest phrasing is **no
detectable effect**, not no effect.

### Review point 2.2 — the ~400-row threshold has a counterexample in the data

Raising `hasEnoughHistoryForFreshTraining` from 20 is obviously right; 20 is absurd when n-dx sits at
191 and scores 65.7%. But **remix clears 94.3% on 153 rows**, well under the proposed 400, while n-dx
fails at 191. A 400-row threshold would wrongly block remix, and no threshold below 191 would have
blocked n-dx. Row count is not the variable doing the work (see review point 1.2).

**A measured threshold beats a tuned constant.** Per-project training means every project already
holds its own labelled history — so hold out a portion, measure the gate's actual precision on that
project, and enable it only if it clears a bar (say 90%). No proxy, no magic number, self-calibrating,
and it handles the repetitive-versus-heterogeneous difference automatically instead of guessing at
it. It also yields a number to show the user: *"gate enabled for this repo at 94% measured precision."*

Caveat carried forward from 1.2: the hold-out must split by **directory**, not by file, or it will
flatter itself.

### Review point 2.3 — the no-artifact finding is undersold

The "Beyond tokens" table contains the strongest practical argument in the analysis, and it is one
word: **none.**

| | Artifact to ship |
|---|---|
| Bundled | **25.5 MB**, retrain on every catalog change |
| Per-project | **none** |

The 25.5 MB artifact was a hard shipping blocker in the original report. The per-project path does not
shrink that problem — it **deletes** it. No model in the package, no retraining pipeline when the
archetype catalog changes, no version skew between a bundled model and the catalog it was trained
against. It trains in roughly 3 seconds from data the project already has.

For anyone who has to maintain this, that is probably the most persuasive row in the document. It
belongs in the recommendation, not in a side table.

### Review point 2.4 — reconcile the class counts

The class count has drifted across documents: 17 archetypes in `CLAUDE.md`, "10 of 11" in the original
findings, and 16 / 15 / 10 / 6 across this matrix. Each is probably correct in its own context, but
someone will ask. One sentence defining each would settle it.

---

## Part 3 — What to amend before the correction lands

**Push the correction.** The core finding is solid and the report is actively misleading without it —
"don't ship" currently reads as a verdict on an approach that was never properly tested.

Five amendments:

1. **Lead with the frame change.** Agreement-with-the-teacher is the right metric for a gate; the
   72.3% ceiling never bound it. This is the intellectual content of the reversal and it makes the
   earlier pessimism explicable rather than merely wrong.
2. **Drop "top-5 is a real refinement."** Say per-project is the lever and top-5 has no detectable
   effect, then name the missing cell as the test that would settle it.
3. **Replace the ~400-row threshold with a measured per-project hold-out.** remix at 153 rows is a
   counterexample sitting in the data.
4. **Verify the split is by directory, not by file**, before any precision figure above 90% goes into
   the report.
5. **Promote the no-artifact finding** into the recommendation. It retires the 25.5 MB blocker the
   original report called fatal.

Keep **"do not ship a bundled model"** and **"do not enable on n-dx today"** — both survive the new
evidence unchanged, and saying so prevents the correction from reading as a blanket reversal.

One last note on tone. This is the second time the investigation has overturned its own published
conclusion on new evidence, and both were self-caught. Write the correction with the same confidence
as the original call. A report that revises itself twice on measurement is more trustworthy than one
that never moves, and it should read that way rather than apologetically.
