# ELM classifier briefing — speaker notes

**Prepared for:** Jarrett · **Date:** 2026-10-01
**Covers:** the three dark slides of `N-Dx ELM Implementation` — labelled *Compact section 1, 2, 3*
(Findings 1–3 · Findings 4–6 · Economics, scope, and what to do next)
**Source of record:** `ELM-CLASSIFIER-FINDINGS.md` (TJ-E1, Elon, branch `elm/jarrett/classify-elm-content`)

> **Read §4 before presenting.** Four numbers in the deck do not reconcile with each other. They are
> all fixable in a few minutes, but an audience with a calculator will find them.

---

## 1. The arc across the three slides

If you remember nothing else, the three slides are three beats of one story:

1. **"The thing was broken, we fixed it, and it's still weak."**
2. **"It can't tell when it's wrong, which is what actually kills it."**
3. **"And the money was never where we were looking anyway."**

That is the whole presentation. Everything else is evidence.

---

## 2. Slide by slide

### 2.1 Findings 1–3 — from a broken experiment to a working-but-weak model

#### The four tiles

**263 / 263 blank inputs.** Every file the ELM was asked to judge arrived as a vector of all zeros.
Say it plainly: *we were handing it 263 blank sheets of paper and asking it to grade the essays.*

**0 files resolved.** The consequence, and the sentence that lands — the feature wasn't
underperforming, it was **inert**. It had never once, in any run, resolved a single file. It could
not have.

Worth explaining *why*, because it is a genuinely interesting trap: the rules pass resolves any file
that matches a signal. So the files that reach the ELM are, by definition, the files where every
cheap signal already failed — and the only information the ELM was handed was those same failed
signals.

**10 / 11 labels after reading contents.** The fix was to open the file and read it. Nothing at that
point in the pipeline had ever done that. Afterwards the model distinguishes 10 of the 11 possible
categories. The mechanism works.

**41.2% cross-codebase accuracy.** The honest number once it works.

#### The table

| | ELM | Sticky note |
|---|---|---|
| Trained codebase | 52–67% | 40.0% |
| Fastify | 31.3% | 39.6% |
| Vue core | 29.7% | 45.3% |

**Define the sticky note before showing the table.** It is a baseline that ignores the file entirely
and always writes down the single most common label. Literally a sticky note on the wall. It is the
floor — a model that cannot beat it is worse than not having a model.

Then the punchline: on the codebase it trained on, the ELM beats the sticky note. **On codebases it
has never seen, it loses to it.** Both times.

#### Two side notes to mention

**The retraction.** Earlier results of "100% at 59% coverage" and "97% at 42%" were real
measurements — of the wrong population. They scored files that already had rule-pass signals, i.e.
the easy ones that never needed the ELM. Saying this out loud buys credibility: the team caught its
own error before shipping on it.

**The teacher.** Every label the ELM learned from was written by Claude, and Claude was measured at
only **72.3%** agreement with human judgement. Plant this here; it pays off in Q&A and it is
arguably the biggest finding in the project.

> **One sentence for this slide:** *"We fixed a feature that had never worked, and discovered that
> when it works, it loses to a sticky note on code it hasn't seen."*

---

### 2.2 Findings 4–6 — the gate fails, and the economics are weak

This is the pivotal slide. Spend the most time here.

#### Set up the idea first

Before any numbers, explain what the gate was *supposed* to do, or the audience will assume the goal
was "be as smart as Claude." It wasn't:

> The ELM never needed to be as good as Claude. It needed to **answer the questions it was sure
> about and hand the rest over.** A model that is right 60% of the time but *knows which 60%* would
> be a perfectly good gate.

Everything on the slide is about whether the model has that self-knowledge.

#### The four tiles

**0.595 margin AUC.** One line of explanation: *this measures whether the model's confidence
predicts whether it is actually right. 0.5 is a coin flip, 1.0 is perfect.* At 0.595 it is barely
above chance.

Then the detail that gets a reaction: **wrong answers were marginally _more_ confident than right
ones.** The signal does not merely fail to help; it very slightly points the wrong way.

The doctor analogy lands every time: *a doctor who is right 60% of the time and knows which 60%
refers the rest and is useful. A doctor who is right 60% of the time and equally sure about all of
it is dangerous, because you cannot tell the good calls from the bad.*

**81.3% at 15/15 agreement.** The workaround: train 15 separate models, answer only when **all
fifteen** agree. Unanimity as a substitute for confidence, because measured confidence was useless.

**6% of files answered.** The catch. All fifteen agree only 6% of the time.

**$0.02–0.06 saved per scan.** So the setting accurate enough to trust saves pennies.

#### The table — the trade-off made concrete

| Setting | Accuracy | Files | Calls saved | Labels changed |
|---|---|---|---|---|
| Unanimity | 81.3% | 16 | 1 of 9 | 3 |
| 12/15 | 69.9% | 83 | 3 of 9 | 25 |
| 9/15 | 63.6% | 184 | 6 of 9 | 67 |

Read left to right and the shape is obvious: **loosen the gate and you save more calls, but accuracy
falls and relabelled files explode.** You can have savings or accuracy. Not both.

At the only setting that saves meaningful money (9/15), **67 of 255 files get a different label than
Claude would have given.** Have the "so what" ready — archetypes are not cosmetic. They feed severity
thresholds in the analysis (a file labelled `component` gets its warning thresholds doubled) and they
feed the codebase summary the *next* AI reads. A wrong label is quietly miscalibrated analysis plus a
summary that describes the code wrongly.

**One mechanical detail worth explaining**, because it makes the numbers make sense: calls are
batched 30 files at a time, so savings arrive only in whole steps of 30. Resolving 16 files saves
exactly one call. Resolving 5% of the files saves **zero**. That is why the accurate setting is
nearly worthless economically — it cannot clear the step.

> **One sentence for this slide:** *"The gate only works if the model knows which of its answers to
> trust, and we measured that directly: it doesn't."*

---

### 2.3 Economics, scope, and what to do next

The relief slide. After two slides of bad news, this one says the project found something better than
what it was looking for.

#### The reframe

**96–98% of call cost is fixed overhead.** The actual question — the file paths, the list of
categories — is tiny. Almost the entire bill is the cost of *starting the conversation*, not the
conversation itself.

Once that is said, the audience usually reaches the conclusion before you do: **if cost is
per-conversation and barely depends on what you ask, the lever is not asking less. It is having fewer
conversations.**

**255 → 1.** Instead of nine conversations of thirty files each, have one conversation about all 255.

#### The table

| Batch | Calls | Savings |
|---|---|---|
| 30 (today) | 9 | — |
| 60 | 5 | 44% |
| 120 | 3 | 67% |
| 255 | 1 | **89%** |

This table is **internally airtight** — every row checks out against the batching arithmetic. A good
slide to be confident on.

The comparison to make explicit, because it is the deck's strongest single line:

> **The best honest version of the ELM saves one call out of nine. Changing one number in a config
> file saves eight — with no accuracy cost at all, because Claude is still answering every question.**

#### The scope deflater

**The ELM touches only 2 of 22 AI call sites.** And the classify pass's share of the total bill **has
never been measured.** Say that slowly. The project optimised a slice of spend whose size nobody has
established. Measuring it is cheap, and it decides whether any of this was worth doing.

#### The recommendation

Do not ship the current ELM. Measure where the tokens actually go. Test bigger batches against
existing labels first — check accuracy at 255 files in one prompt, output limits, and what a retry
costs when a big batch fails.

> **One sentence for this slide:** *"We spent the project trying to ask Claude fewer questions, and
> the measurement says we should have been having fewer conversations."*

---

## 3. How to open and close

**Open:** *"We built a small local model to replace some AI calls. It doesn't work well enough to
ship — and finding out why led us to a change that saves eight times more than the model ever
could."*

**Close:** *"Three recommendations. Don't ship the gate. Measure where the tokens actually go —
nobody has. And test the batch size, because it's one constant and it saves more than our best case
with no accuracy cost at all."*

---

## 4. Before you present: four things that will get you caught

These are in the deck itself, and an audience with a calculator will find them.

### 4.1 Three different numbers for "overhead"

| Where | Figure |
|---|---|
| Slides 1 & 2 (~36,200 of ~50,900) | **71%** |
| Slide 3 (comparison) | **~70%** |
| Slide 6 (dark economics slide) | **96–98%** |
| Slide 7 | **at least 90.6%** |

Three different claims presented as one. The 71% figure compares *startup* against *everything else*.
The 96–98% figure compares against only the **~924-token classify question itself**, treating system
prompt and tooling as overhead too. Both are defensible; they are not interchangeable.

**Pick one definition, state it, use it everywhere.** If someone divides 36,200 by 50,900 mid-talk and
gets 71%, the 96–98% headline looks wrong.

### 4.2 Two different per-call token costs, and a range multiplied out against instruction

Slides 1, 2, 3 and 7 say **~50,900 tokens per call.** The economics table implies **22k–46k per call**
(198k–414k ÷ 9). Both cannot be right. The 22k–46k figure came from a measurement using a *trivial*
prompt, and the source report explicitly says **"cite as a range, do not multiply out"** — which the
table then does.

**The good news:** the percentages survive either way. 89% is a ratio of call counts (8 of 9), so it
holds whether a call is 23k or 51k tokens. **Lead with percentages and call counts; treat absolute
token totals as approximate.** If challenged, *"the ratio is solid, the absolute figure depends on
cache state"* is a completely honest answer.

### 4.3 The dark slides say 6% coverage; slides 8–10 say 45% of calls avoided

**This is the big one.** Slide 5 says the trustworthy setting answers 6% of files and saves 1 call in
9. Slides 8 and 9 say the tier avoided **39 of 87 calls — 45%** — across seven repositories it had
never seen, and slide 10 cites **47.2% coverage on unseen repositories.**

An audience that sees both will think the deck contradicts itself.

They are probably not contradictory — they look like **two different configurations**. The 6% figure
is unanimity with a model trained on a small, n-dx-heavy corpus. The 47.2% figure is a frozen model
pretrained on the full 2,195-row, 10-ecosystem database, which slide 3 flags as the thing that makes
the gate work on a fresh repo at all. More and better-distributed training data means the 15 models
agree far more often, so coverage rises.

**Add one explicit bridging sentence** when moving from the dark slides to the light ones:

> *"Everything so far is the gate trained per-repo. What changes it is pretraining on the 2,195-row
> database — same mechanism, very different coverage."*

Without that line the deck reads as self-contradicting.

**The question to be ready for:** *what was the accuracy at that 47.2% coverage?* Slides 8–10 report
coverage and calls avoided but no accuracy figure. Slide 5 has just finished proving that coverage and
accuracy trade directly against each other — so presenting 45% calls avoided without the accuracy at
that operating point is exactly the error the dark slides warn about. If the number exists, put it on
the slide. If it does not, say so.

### 4.4 Small stuff, quick to fix

- **Slide 3 copy-paste error:** the ELM column reads *"Yes — up to 64 KiB of it (no code read)"*. That
  parenthetical belongs to the other column and currently contradicts itself.
- **9 repos vs 10 ecosystems.** The findings report says 9 corpus repos; the deck says 10 ecosystems.
  Probably 9 plus n-dx itself — just know the answer.
- **Slide 7 says "~45% accuracy," slide 4 says 41.2%.** Pick one.

---

## 5. Questions you will get

**"Isn't 41% close enough to 44%?"**
That is the point, not a defence. 44.2% is what you get by ignoring the file entirely. Statistically
the model is indistinguishable from not reading the code at all.

**"Why not run it loose and accept a few errors?"**
At the loose setting it is 67 of 255 files relabelled, about one in four. Those labels drive severity
thresholds in the analysis and the summary the next AI reads. Not a cosmetic field.

**"If Claude is only 72.3% right, why does matching it matter?"**
Two answers. First, the ELM is at 41% and Claude is at 72% — that gap is real regardless. Second, and
better: **the teacher-quality finding may be the biggest thing here.** 72.3% against a measured human
ceiling of 85.4% means improving the labelling prompt improves output for every user on every file,
with no new infrastructure. A bigger lever than the ELM ever was.

**"Did you try a bigger model?"**
Yes — 4096 hidden units, and it was worse. **Caveat it properly:** that was measured at 1,935 training
rows, where a model that large overfits. Capacity and data interact; at much larger data a bigger
model might win. Do not let it stand as a general claim.

**"So was this wasted?"**
Flatly no, and have the list ready: a reusable 2,195-row labelled dataset across 10 ecosystems that
already feeds two unrelated designs; a feature that had never worked now works; committed, seeded,
reproducible measurement scripts; the teacher-quality finding; and the per-call overhead finding,
which is bigger than the ELM and composes with it.

**The project failed at its stated goal and succeeded at finding the thing worth doing instead.**
That is a good outcome, and it should be presented as one.
