# ADR — 2026-08-28 — Replacing K1, and the denominator that decides whether the tier passes

**Status:** Proposed — needs the leads
**Author:** K2 (Team Nolan) · **Backlog:** `TN-J25`
**Amends:** [`ADR-2026-08-27-jam-confidence-gated-deployment-and-a-measurable-kill-criterion.md`](ADR-2026-08-27-jam-confidence-gated-deployment-and-a-measurable-kill-criterion.md) § Decision 2 (K1) ·
[`ADR-2026-08-28-jam-implement-the-elm-tier.md`](ADR-2026-08-28-jam-implement-the-elm-tier.md) § 3a (adoption of abstention) and § 5 (S1/S2)
**Does not supersede either.** Both contributions stand; two numbers in them do not.

> **Instruction and scope.** The lead directed me to modify or replace K1. The handbook
> ([`K2-HANDBOOK.md`](../Nolan-Agents/K2-HANDBOOK.md) § 7.2) had correctly left that to the leads,
> so this is a handed-over decision rather than a self-served relaxation. I did the engineering
> first and am proposing the replacement second, because relaxing a bar before trying to meet it is
> what § 6.1 warns against.
>
> **Recommendation, up front:** replace K1 with a coverage criterion (§ 6.1), correct K2 to the
> comparison S1 already specifies in words (§ 6.2), and **fund gold set #2** — because after
> Phase 1, there is now a DEV operating point that clears both, and no honest way to confirm it
> without a set whose labels nobody has read.

---

## 1. Three findings, and one near-miss that matters more than any of them

| | Finding | § |
|---|---|---|
| **A** | **K1 is not a property of the tier.** It is a step function of one repo's file count on one day, and it is **non-monotone: improving sourcevision's rules makes K1 harder.** | 2 |
| **B** | **The adopted abstention design cannot reach K1 at any precision, with any model.** Its ceiling is the non-`service`/`utility` share — **26.2%** corpus-wide — against K1's **29.4%**. Measured coverage came in at **25.6%**, right at that ceiling. | 3 |
| **C** | **Whether *any* design passes depends entirely on two choices that were never recorded as choices** — which activation the model uses, and which denominator the LLM is compared on. Under one pairing, 0 of 18 operating points pass. Under the other, 5 of 18 do, and one of them meets the value bar too. | 4 |

**The near-miss.** I wrote the first draft of this ADR concluding *"0 of 18 designs beat the LLM;
the tier should not ship."* That table was produced with `activation: "relu"` — **a model the
Phase 1 sweep had already rejected.** The pre-registration required Phase 2 to run on the frozen
Phase-1 winner, so I re-ran it, and the conclusion inverted.

**This is the K2 error repeating, one iteration later.** Jam measured `hiddenUnits: 256` — an
arbitrary untuned default — and concluded "not viable"; the correction was that it was a verdict on
that model, not the approach. I nearly published a verdict on `relu`, an equally arbitrary untuned
default, for the same reason. The process caught it. **It is worth noticing that the guard that
caught it was a procedural one — "Phase 2 runs the model Phase 1 adopted" — not anyone's judgement.**

## 2. Why K1 is the wrong shape — three arithmetic reasons

Calls avoided on a repo with residue `n`, `B = ceil(n/30)` batches, at coverage `c`, is
`B − ceil(n(1−c)/30)`. Measured residues (`scripts/data/elm-calls-avoided.json`, `f91370f8`):
n-dx **255 files / 9 batches**, AsterMind-CE **69 files / 3 batches**.

**2.1 — K1 gets HARDER when the product gets BETTER.** The "9" is `ceil(residue/30)`, and every
improvement to `archetypes.ts` shrinks the residue. Jam's own Step 1 gateway fix already moved it
259 → 255.

| residue | batches | coverage K1 then demands for 3 calls |
|---|---|---|
| 255 *(today)* | 9 | **29.4%** |
| 240 | 8 | **37.5%** |
| 210 | 7 | **42.9%** |
| 180 | 6 | **50.0%** |
| 120 | 4 | **75.0%** |

Ship better rules, fail K1. A criterion whose bar rises as the thing it measures improves is broken.

**2.2 — K1 is unreachable on small repos, for reasons unrelated to the tier.** On AsterMind-CE,
"3 calls" is all 3 batches — it requires **100% coverage**. The same model at the same operating
point passes on n-dx and can never pass on the smaller reference repo.

**2.3 — K1 is blind across a wide band.** The step is 30 files, so coverage of 20%, 25.6% and 29%
all avoid exactly **2** calls on n-dx. Every precision improvement inside that band is invisible to
K1. This is the lumpiness that made Step 1's four reclassified files worth **zero**.

## 3. Abstention's ceiling sits below K1's threshold — structurally, not for want of tuning

The adopted design answers only when it predicts a class other than `service` or `utility`, so its
coverage **cannot exceed the share of files that are not `service`/`utility`**:

```
full corpus (324)   service 123 + utility 116 = 239 (73.8%)  ->  non-S/U ceiling = 26.2%
K1 needs                                                                          29.4%
MEASURED coverage of design B (tanh, 15 seeds)                                     25.6%
```

**A perfect classifier using this abstention rule would still fail K1 on n-dx**, and the measured
25.6% sits within half a point of the theoretical ceiling — so the design is already extracting
essentially all the coverage its own rule permits. Any route to K1 must admit some
`service`/`utility` predictions. That is the `B+su` family, and it does reach 3 calls (§ 4).

## 4. The two unrecorded choices

### 4.1 The denominator

**ADR § 5, S1, as written:** *"gated ELM precision ≥ LLM-vs-truth **on the same files**."*
**ADR § 3a, the evidence used to adopt abstention:** *"claims 22.9% of files at 75.5% precision vs
truth … **against the LLM's 72.3%**."*

72.3% is the LLM's accuracy over **all 83** held-out files. The design claims a hand-picked ~21 of
them. Comparing a selected subset against a global average is not the test S1 asks for — and it is
not a close call. Under the relu model, **12 of 18 operating points beat the global figure and 0 of
18 beat the LLM on their own files.**

### 4.2 The activation

`relu` was never swept. It was the default in the feasibility screen and every script inherited it,
exactly as `hiddenUnits: 256` had been. Phase 1 (train-CV only, 9 paired runs, gold untouched):

| config | CV vs teacher | Δ vs relu | paired wins | verdict |
|---|---|---|---|---|
| **`elm-1024 tanh`** | **64.6%** | **+4.0 pp** | **9 of 9** | **ADOPTED** |
| `elm-1024 gelu` | 64.6% | +4.0 pp | 9 of 9 | adopted; loses the tie-break on mean (64.59 vs 64.64) and cost |
| `kelm linear nystrom λ1e-3` | 63.6% | +3.0 pp | 7 of 9 | clears |
| `elm-1024 relu` *(incumbent)* | 60.6% | — | — | superseded |
| `ridgeLambda` 1e-4 … 1e-1 | 60.2–60.8% | ±0.6 pp | 4 of 9 | **not a lever** |
| `voting` 5× stacked | 57.9% | −2.8 pp | 1 of 9 | **loses** |
| `kelm rbf` (best γ) | 60.8% | +0.1 pp | 5 of 9 | not a lever |

Two things worth naming. **`ridgeLambda` was the sweep the plan had the highest prior on** — "1688
features on 241 rows is heavily over-parameterised" — and it is flat across four orders of
magnitude. **And the RBF arms were confounded by their own default**, exactly as the pre-registered
addendum predicted before the run: default `gamma = 1/D = 5.9e-4` gives an all-ones Gram matrix and
scores 33.9%; `gamma = 0.5` on identical data scores 60.8%. **27 pp from one default.**

### 4.3 What the tier actually does, once both choices are made correctly

`scripts/elm-operating-point.mjs`, **ELM 1024 / tanh / λ1e-2**, 15 seeds. **DEV — gold set #1.**

| design | coverage | ELM precision (range) | **LLM, same files** | gap | n-dx calls |
|---|---|---|---|---|---|
| `g` gate top 10% | 9.6% | 91.7% (75.0–100) | 93.3% | −1.7 | 1 |
| `g` gate top 30% | 30.1% | 80.8% (72.0–92.0) | 84.3% | −3.5 | 3 |
| **`B` abstention (ADOPTED)** | 25.6% | **74.7%** (68.2–80.0) | 72.9% | **+1.8** | 2 |
| **`B+su` + top 10% of S/U** | **32.9%** | **75.1%** (71.4–81.5) | 74.1% | **+1.0** | **3** |
| `B+su` + top 15% of S/U | 36.6% | 74.6% (64.5–80.0) | 74.4% | +0.2 | 3 |
| `B+su` + top 50% of S/U | 63.1% | 72.5% (67.9–77.4) | 71.5% | +1.0 | 5 |
| `cc` learned gate, top 30% | 30.1% | 75.2% (60.0–88.0) | 77.6% | −2.4 | 3 |

**5 of 18 designs beat the LLM on the files they claim, and one of them — `B+su` at 32.9% coverage
— also avoids 3 of 9 classify calls.** That is both bars met, in the mean, on DEV.

**Three caveats, all binding:**

1. **Every range straddles.** `B+su` top-10% spans 71.4–81.5% against a 74.1% bar, on ~27 files per
   seed. Per the pre-registered reporting rule, **a straddling range is never a pass.**
2. **The margins are small** (+1.0, +0.2 pp) relative to those ranges.
3. **These are DEV numbers.** Gold set #1's labels have been read. This is a signal worth
   certifying, not a certification.

**And the confidence gate still selects the wrong thing.** Gating harder raises ELM precision
(91.7% at top-10%) but raises the *LLM's* precision on those same files faster (93.3%). The gate
ranks by **file easiness**, and easiness helps the teacher more than the student. `TN-J19`'s
top-decile 84.5% never translated for this reason, and the pattern survives the activation change:
every `g` row is negative, every winning row is an abstention variant.

## 5. A correction to "the LLM's label noise is random"

`IMPL … § Phase 1` records *"truth utility → LLM said service 5; truth service → LLM said utility 6.
No directional bias … the signature of random label noise"*, and concludes a regularised model can
average it out. **On the `service`/`utility` axis that is correct.** It is also the only axis that
was examined, and the errors elsewhere are not symmetric:

```
On the 24 held-out files whose truth is NOT service/utility, the LLM makes 7 errors.
  6 of those 7 collapse a minority class INTO service or utility:
    cli-command -> utility    entrypoint -> utility    types -> service
    config      -> utility    gateway    -> utility    types -> utility
Error flow:  utility  into 11 / out 8  (net +3)      service  into 6 / out 8
```

**`utility` is the teacher's sink for anything it is unsure about** — a directional, systematic
rule, and systematic teacher error is exactly what a student cannot average out. The favourable
finding holds on its own axis; it does not generalise to the axis the adopted design operates on.
It also explains § 3's coverage shortfall without appeal to model weakness: the teacher flattens
minority classes into the two big ones, so the ELM under-predicts precisely the classes abstention
needs.

## 6. Decision — proposed

**6.1 Replace K1 with K1′, stated in coverage.**

> **K1′ (value).** At an operating point that has passed **K2′**, the tier must claim **≥ 30% of the
> files that would otherwise reach the LLM classifier**, certified as a coverage fraction and
> reported with its seed range.
>
> **K1′-floor.** Below **13.0%** coverage the tier avoids zero calls on the smaller reference repo
> and must not be described as saving anything.
>
> **Reporting requirement (not a bar).** Every savings claim states coverage, the resulting
> `ceil(n/30)` call count per named reference repo, and the backend, per Butter's measurement
> contract. Calls avoided stays the published unit; it stops being the threshold.

**30% is chosen as the smallest coverage that reproduces K1's intent on both reference repos** — it
avoids 3 of 9 on n-dx (boundary 29.41%) and 1 of 3 on AsterMind-CE. **This is a re-expression, not
a relaxation.** What changes is that the bar becomes a property of the model: it does not move when
the residue moves (§ 2.1), it is reachable on every repo (§ 2.2), it is sensitive across the whole
range (§ 2.3), and it can be certified on a gold set before any integration exists.

*(Not 33%: the one design meeting both bars sits at 32.9%, and excluding a design that delivers the
exact call saving K1 asked for, by one tenth of a point, would be the lumpiness problem again in a
new costume.)*

**6.2 Correct K2 to the comparison S1 already specifies.**

> **K2′ (quality).** Gated ELM precision ≥ LLM-vs-truth **computed on the subset the tier claims**,
> on a gold set whose labels have not been read. Never against a global average over files the tier
> does not answer.

Not a new bar — ADR § 5's S1 read literally. Stated separately because § 3a's adoption evidence did
not apply it and nothing in the tooling enforced it until `elm-operating-point.mjs` existed.

**6.3 Fold S2 into K1′.** There is no longer a separate calls-avoided threshold to relax.

## 7. Consequences

- **`TN-J24`'s verdict is amended, not reversed.** Abstention was the right shape and remains the
  basis of the winning design. Its *headline* — "beats the bar (S1)" — was against the wrong
  denominator, and under the correct one plain abstention beats by **+1.8 pp** rather than the
  claimed margin over 72.3%. The conclusion survives; the arithmetic behind it changes.
- **`B+su` is now the recommended operating point** to carry into Phase 3: abstention plus the
  top 10% most-confident `service`/`utility` predictions, 32.9% coverage, 3 of 9 calls.
- **Gold set #2 is now the critical path, and better justified than before.** There is something to
  certify. Every number in § 4.3 is DEV with a straddling range, and § 4's near-miss is a live
  demonstration that this project's conclusions move when an untested default is tested.
- **Capacity may need revisiting — but not by me, and not without a new pre-registration.** The
  "plateau at 1024" was measured entirely on `relu`. The capacity × activation interaction is
  untested. The handbook says do not sweep capacity again; I am recording the gap rather than
  quietly reopening it.
- **`TN-J22` still stands, and I am saying so out loud as handbook § 8 asks.** Even at the winning
  operating point the LLM is at 74.1% against an **85.4%** human path ceiling. The prompt leaves
  11 pp on the table across *all* 9 calls, where this tier contests 3 — and § 5 names a concrete,
  fixable defect in it. **If capacity has to be chosen between the two, `TN-J22` is the larger win.**
- **A new asymmetry is filed as `TN-J26`** (§ 8).

## 8. `TN-J26` — the teacher and the student are not shown the same thing

The handbook's map says *"what the teacher sees — `classify.ts:486` — **path only**."* The prompt
builder says otherwise:

```ts
// classify.ts:499-503
// Include partial evidence from algorithmic pass if available
if (f.evidence && f.evidence.length > 0) {
  const hints = f.evidence.slice(0, 3).map((e) => `${e.archetypeId}(${e.weight})`).join(", ");
  parts.push(`  [partial signals: ${hints}]`);
}
```

`evidence` is populated whenever **any** signal matches (`classify.ts:159`), independent of
`PRIMARY_THRESHOLD` — which is what makes a file "unclassified" in the first place. So a residue
file with sub-threshold signals carries `[partial signals: service(0.7), utility(0.4)]` into the
teacher's prompt while **the ELM is given the path string and nothing else.**

**I cannot say how often this bites.** `.sourcevision/classifications.json` overwrites the
algorithmic `evidence` with the LLM's own returned reason, so the pre-LLM state is unrecoverable
from any committed artifact; it needs a corpus rebuild that captures it. **Recorded as unquantified
rather than estimated.**

This is **not** the rejected feature work. That was naive positional/bigram re-encoding of the same
path (−20.1 pp) — more of the same signal. This is a *different* signal, and the argument is not
that it might help: it is that we have been scoring a student against a teacher with a larger
question paper, and nobody recorded that.

## 9. Open questions for the leads

1. **Accept K1′ and K2′?** K1′ preserves K1's intent in a unit that does not move; K2′ is S1 read
   literally. Neither is a loosening.
2. **Fund gold set #2.** This is the ask. There is now a DEV operating point clearing both bars
   (32.9% coverage, +1.0 pp, 3 of 9 calls) and no honest way to confirm it — every range straddles
   and gold set #1 is spent. **If the answer is no, the position is unchanged from Jam's: publish
   the result as promising-but-uncertified and do not ship.**
3. **Where does the next unit of effort go — Phase 3, or `TN-J22`?** I think `TN-J22`, and I would
   rather say so than optimise quietly. **Weigh that against my tenure: I have been on this one
   session, Jam three weeks. My recommendation is cheap to disregard.**
4. **Claim `TN-J26`?** Rebuilding the corpus with algorithmic evidence attached is small, and it is
   the one untested lever that is not "more of the same".
