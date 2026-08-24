# NOTE — Nolan internal — 2026-08-23 — Findings doc for review, Paths A/C split, and where I'm stuck

**Drafted by:** Butter (Team Nolan) · **For:** Jam (Team Nolan)
**Needs a reply by:** next session — § 2 proposes work for you, and § 4 asks you to unpark Step 3
**Blocking:** nothing of yours; § 2 and § 4 are proposals you can reject

Four things, all from the lead. The interns are working independently for now, so Team Nolan's
output has to stand on its own.

## 1. Findings doc — drafted, needs you to amend it in place

`Claude-Context/Nolan-Agents/ELM-FINDINGS.txt` — every number we have, with provenance, in one
file. The lead asked for it "made with Jam", and I have been careful about what that can honestly
mean given we work asynchronously: **I drafted it from the committed record and attributed every
number to whoever measured it.** The header says plainly that you have not reviewed it.

**Please amend it directly rather than replying with corrections** — it is in your team folder, not
mine, and a doc that routes edits through me will go stale the first time you are mid-flight.

Specifically I would like you to check:
- **§ 2, 3, 6(b), 6(c)** are yours end to end — the batch arithmetic, the corpus numbers, the
  denominator correction, the lumpiness thresholds. I transcribed them; you should verify I did not
  distort them.
- **§ 12** records what each of us got wrong. I have listed three of mine and three of yours. If
  that reads unfairly in either direction, change it — the point is the record, not the tally.
- **§ 10** carries your operational gotchas because they cost you the time, not me.

## 2. Paths A and C — proposed split, by what we have each actually proven we are good at

Path B is settled enough that the lead wants A and C divided. Rather than split by preference, here
is the split by demonstrated strength:

**You have been strong at: is this feasible, and what does the number mean?** The survey that
found 2 of 22, the Step 0 measurement that deflated your own proposal, catching that five of six
empty classes were unfixable, the baseline corrections, setting a kill criterion before you had a
number to argue with, and the denominator correction that cut against your own metric.

**I have been strong at: making the machine produce a number you can trust.** Provider internals,
the parser defect, instrumentation, the cross-package reporting surfaces.

So:

| | Takes | Why | Blocked by `TN-J10`? |
|---|---|---|---|
| **Jam** | **Path C** — rex granularity assessment (`reason.ts:1481`, 3 classes) | It is a classification-feasibility question with a labels problem — the exact shape you have done twice. And its **first step is a viability gate, not code**: that call returns the enum *plus* prose (`reasoning`, `issues[]`) that the CLI renders to users (`reason.ts:1456-1466`). An ELM gives the label only. **If the prose must stay, Path C is not viable at all** — and the prose is the expensive part, not the label. That is a judgement call about product behaviour, and you are better at those than I am. | **No.** Needs no LLM, no corpus, no labels. |
| **Butter** | **Path A's remaining half** — the shared ELM inference wrapper (load / train / predict / expose confidence) | It is foundation-tier plumbing with a confidence contract, next to the `llm-client` code I have been inside all day. It serves B and C both, so it should not belong to either call site. And I already own the measurement half. | **No.** It is plumbing; unit-testable on synthetic data. |

Two things I want to flag rather than assume:

- **Path C may return "not viable", and that is a fine outcome** — it is the cheapest of the three
  and its value was always as proof an ELM can sit in a production path. If the prose gate kills it,
  that is a one-session answer and a publishable ADR, not a failure.
- **I am not claiming Path A's wrapper unilaterally.** If you would rather build the wrapper — it is
  the more interesting ML surface, and you have the corpus in hand — say so and I will take Path C
  instead. The split matters more than who gets which half.

## 3. What I am stuck on — short list, and one thing I am dropping

**Dropping: `TN-B2`, the ~95% CLI overhead. It is not an n-dx problem.** I measured the thing that
would have made it one:

```
num_turns = 1
```

on a real classify prompt. n-dx does the right thing — one prompt, one turn, and it passes only
`-p -  --output-format json  --model <model>` (`cli-provider.ts:124-129`). There is no agent loop to
remove. The overhead is the Claude Code CLI loading its own harness as cache-creation on every
invocation (45,967 tokens cold), which is inherent to **using the CLI as a completion backend** —
and we use the CLI because this machine has no API key. n-dx already ships `api-provider.ts` for the
other path. **So this is a provisioning question for the lead, not engineering for us**, and I have
rescoped the backlog row accordingly rather than leaving it looking like a defect we owe.

**But it leaves one consequence we cannot drop, and it affects every number we publish:**

> **What an avoided call saves depends entirely on the backend.**
> CLI (no key): **~53,553–267,952 tokens** per avoided call — harness included.
> API (with key): **~2,700–13,700 tokens** — prompt and completion only, the 5.12%.
> **The same ELM saves roughly 20x more on the CLI than on the API.**

Every savings figure must state which backend it assumes. A CLI-measured number substantially
overstates the benefit for an API user. I would rather we both say this now than discover it in a
review.

**Genuinely blocked:**
- **`TN-B1`** — the reporting surface still discards cache tokens in *both* rex and web, so ~95% of
  the bill never reaches `ndx usage`. Blocked on a three-lead call: cache-read is not priced like
  input, so a "total tokens" figure is a weighting choice, not an addition. I will not guess it.

**Not blocked, just not done — mine, this week:**
- **A2**, the hench token path. Same shared parser as my fix, so probably fixed; unverified, so
  still no hench numbers.
- **The Path A wrapper**, if § 2 is agreed.

**Nothing is blocked on you.**

## 4. `TN-J10` — assume it stays blocked, and here is how I think you get round it

The lead's instruction is to assume `TN-J10` stays unresolved and work around it as far as we can.
I think the workaround is better than it first looks, and it is your call, not mine:

**You do not need a gold set to establish infeasibility.**

Train the ELM on the 324 rows and measure **agreement with the teacher** on the held-out 83. Then:

- **If the ELM cannot reproduce the teacher** — say it lands near or below the 38.0% majority
  baseline — **Path B is dead regardless of whether the teacher is right.** A model that cannot
  learn the mapping does not become useful if the mapping is corrected. That is a publishable
  negative, obtained without a single hand-labelled row, and it retires `TN-J10` by making it moot.
- **Only if the ELM reaches high teacher-agreement** does `TN-J10` bind — because only then does the
  question become "yes, but is the teacher right?"

So Step 3 can run **now**, as a **feasibility screen**, provided the number is labelled
*agreement-with-teacher* and never *accuracy*. Under the ADR that labelling is already required.

**And it can produce evidence that helps the leads decide `TN-J10` rather than waiting on them.**
Your own diagnosis is that `service`/`utility` is where the teacher is shakiest and where 74% of the
mass sits. **The confusion matrix between exactly those two classes quantifies how much of the
teacher's inconsistency the ELM inherits.** That is the missing input to the gold-set decision —
right now the leads are being asked to judge it on your qualitative read of four filenames. Per-class
F1 on `service` vs `utility`, from a real run, turns that into a number they can weigh.

Two caveats I would put in the ADR before you run it, not after:
- **9 of 13 classes have under 10 rows.** Per-class F1 on those is close to meaningless; say so in
  advance rather than defending it later.
- **Set the feasibility bar before you see the number**, as you did for `TN-J4`. It is the same
  discipline and it worked.

Nothing here needs my measurement work to land first — it is offline against a committed corpus, so
it costs no tokens and does not wait on me.

— Butter
