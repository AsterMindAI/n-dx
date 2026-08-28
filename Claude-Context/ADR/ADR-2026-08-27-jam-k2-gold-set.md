# ADR — 2026-08-27 — The K2 gold set: design, and why it measures more than the model

**Status:** **Accepted and executed** — labelled by Nolan 2026-08-27 (`585a1221`), analysed in `TN-J20`.
The gold set returned: path ceiling 85.4% · LLM vs truth 72.3% · ELM vs truth 54.4% (**K2 failed**).
Gold set #1 is now **spent as a dev set** — see `ADR-2026-08-28` § 4.
**Author:** Jam (Team Nolan) · **Backlog:** `TN-J20`
**Implements K2 from:** [`ADR-2026-08-27-jam-confidence-gated-deployment-and-a-measurable-kill-criterion.md`](ADR-2026-08-27-jam-confidence-gated-deployment-and-a-measurable-kill-criterion.md)
**Revises:** that ADR's scoping of K2 (~60 `service`/`utility` files → all 83 held-out files). Reason in § 3.

> **This is written to be handed to someone who has not worked on this project.** It assumes no
> familiarity with ELMs, the corpus, or Path B. The labeller needs § 1, § 4, and the IMPL; the rest
> is for the leads.

## 1. What is actually being asked for

**One person labels 83 file paths, twice each, without seeing any machine's answer.**

That is the whole task. It is estimated at one focused session. Everything below explains why it is
worth doing and why the design is shaped the way it is.

The output settles a question the project cannot currently answer: **when our classifier disagrees
with the LLM we have been treating as correct, which one is right?**

## 2. Context — why we cannot answer that today

`sourcevision` labels each source file with an "archetype" (`service`, `utility`, `config`, …).
Rules handle the easy cases; the remainder go to an LLM, which costs money on every analyze. Path B
replaces some of those LLM calls with a local model that is free to run.

The local model works: **59.9% agreement with the LLM, against a 37.3% majority baseline**, rising
to **75.3% on the top 30% most-confident predictions** — enough to remove 3 of 9 LLM calls on this
repo.

**But "agreement with the LLM" is not "correct."** Every label we own came from that LLM. So:

- We have no measure of whether the LLM is right.
- The original kill criterion — *"at or above LLM accuracy"* — was **circular and unmeasurable**,
  and has been retired.
- Worse, the model **inherits the LLM's confusions rather than resolving them**: in the best run,
  **16 of 59** `service`/`utility` files cross over. Those two classes are **74% of all data**.

**A human labelling the same files from scratch is the only way out.** That is K2.

## 3. Design decisions, and the reasoning behind each

### (a) Ground truth comes from reading the file, not from the path

The labeller opens each file and decides what it actually is. This is the definition of ground
truth: it must be true, not merely plausible.

### (b) But the path-only judgement is recorded FIRST, and this is the most valuable part

**Verified 2026-08-27:** the LLM sees *only the file path*. `buildLLMClassifyPrompt`
(`classify.ts:484-518`) sends a bare list of paths under the instruction *"Assign each the best-fit
archetype by path and likely purpose"*, and the files in question carry **zero** additional signal
evidence. The local model sees the same paths. **Both machines are guessing from the path alone.**

So the labeller records two answers per file:

| Pass | Sees | Measures |
|---|---|---|
| **1** | path only | what a careful human can infer from the same input the machines get |
| **2** | the file's contents | what the file actually is |

**The gap between pass 1 and pass 2 is the information content of the file path, and it is a hard
ceiling on every path-only classifier — the LLM included.**

This is the finding I most want and it is why the design is worth more than a straight accuracy
check. If a competent human reading only paths reaches, say, 70%, then:

- the LLM's labels are capped at roughly that too, so **our entire training corpus is noisy by
  construction**;
- the local model's 75.3% on confident predictions is **already at or near the achievable ceiling**,
  and chasing a higher number is chasing noise;
- and the real conclusion is that **path-only classification is the wrong design**, for the LLM as
  much as for us — which would be a far more useful result than a verdict on one model.

Conversely, if the path-only human scores near their content-informed score, paths are informative,
the corpus is sound, and the model's shortfall is genuinely the model's.

**Neither outcome is bad. Both are publishable. That is the point.**

### (c) All 83 held-out files, not the ~60 `service`/`utility` ones

My previous ADR scoped K2 to the two ambiguous classes to bound the cost. **I now think that was a
methodological error and am revising it.** Handing someone only `service` and `utility` files tells
them the answer space is binary. They would never write *"this is actually a config file"* — and a
misfiled class is one of the outcomes most worth catching. The extra 23 files are a small price.

`service` vs `utility` remains the **analysis** focus; it is simply not disclosed as the framing.

### (d) The labeller must not see any machine output

No teacher labels, no model predictions, no confidence values. The packet is generated blind and
shuffled (`scripts/elm-goldset-packet.mjs`). We are testing the teacher; showing them the teacher's
answers would anchor them to it and produce agreement that means nothing.

### (e) "Unclear" is a first-class answer

Forced choice manufactures false precision. If a file genuinely sits between `service` and
`utility`, that must be recordable — **and the rate of "unclear" is itself a headline finding.** A
high rate means the taxonomy is under-specified, and no model, local or hosted, can be held to a
boundary humans cannot draw either.

### (f) Two labellers if we can afford it

With two independent labellers we can compute inter-rater agreement. **If two humans cannot agree
on `service` vs `utility`, the class definitions are broken and that invalidates the taxonomy, not
the model.** That is a bigger and more useful finding than anything about Path B, and it is only
visible with a second rater. One labeller still yields a usable gold set; two yields the diagnosis.

### (g) Not me, and not Butter

I have read these paths for two weeks and cannot claim to be blind to the LLM's choices. Anyone
sufficiently familiar with the corpus is compromised as a rater.

## 4. The two classes that matter (verbatim from `archetypes.ts`)

> **`service`** — *Service layer modules — API clients, data fetching, and business logic
> orchestration.*
>
> **`utility`** — *Shared utility, helper, and infrastructure modules where high fan-in is expected.*

**These definitions overlap, and that is the problem in one sentence.** "Business logic
orchestration" and "shared infrastructure module" describe the same file often enough that 74% of
our data sits on a boundary neither definition draws cleanly. The labeller is not expected to
resolve this — they are asked to apply it honestly and flag what they cannot.

The other 11 classes are listed in the IMPL.

## 5. Decision

Commission the gold set as specified: **83 files, two passes each (path-only, then content), blind,
with "unclear" permitted, ideally two raters.**

Report **five** numbers, not one:

| # | Comparison | Answers |
|---|---|---|
| 1 | human pass-1 vs human pass-2 | **the path-information ceiling** — the key result |
| 2 | LLM vs human pass-2 | is our training corpus actually correct? |
| 3 | ELM vs human pass-2 | is the local model correct? — **this is K2** |
| 4 | ELM vs LLM | agreement, what we have measured until now |
| 5 | rater A vs rater B | is the taxonomy usable at all? |

**K2 passes if (3) ≥ (2)** — the local model is right at least as often as the LLM, on the same
files, judged against truth.

## 6. Consequences

- **`TN-J10` is resolved by this**, in either direction. It has blocked Step 3 since 2026-08-20.
- **If (2) is low, the corpus needs rebuilding**, and that is a finding about the *pipeline*, not
  about Path B. It would also mean every archetype label n-dx has ever written is suspect — which
  matters well beyond this effort.
- **If (1) shows a low ceiling**, the recommendation becomes *"give the classifier more than the
  path"* — file contents, imports, exports — and that applies to the LLM call too, likely improving
  quality *and* reducing the residue.
- This is the last blocker on a defensible quality claim for Path B. Without it we publish
  *"feasible, value quantified, quality unverified"* and do not ship.

## 7. Open questions for the leads

1. **One rater or two?** One is sufficient for K2; two additionally diagnoses the taxonomy.
2. **Who?** Must be someone not steeped in this corpus.
3. **If the ceiling in (1) is low, do we fund giving the classifier file contents?** That is a
   larger change to `classify.ts` and a bigger prize than Path B, but it is not currently anyone's
   scope.
