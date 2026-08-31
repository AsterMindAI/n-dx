# ADR — 2026-08-28 — Replacing K1, and the denominator that made the adopted design look like a pass

**Status:** Proposed — needs the leads
**Author:** K2 (Team Nolan) · **Backlog:** `TN-J25`
**Amends:** [`ADR-2026-08-27-jam-confidence-gated-deployment-and-a-measurable-kill-criterion.md`](ADR-2026-08-27-jam-confidence-gated-deployment-and-a-measurable-kill-criterion.md) § Decision 2 (K1) ·
[`ADR-2026-08-28-jam-implement-the-elm-tier.md`](ADR-2026-08-28-jam-implement-the-elm-tier.md) § 3a (the adoption of abstention) and § 5 (S1/S2)
**Does not supersede either.** Both contributions stand; two numbers in them do not.

> **Instruction and scope.** The lead directed me to modify or replace K1. The handbook
> ([`K2-HANDBOOK.md`](../Nolan-Agents/K2-HANDBOOK.md) § 7.2) had correctly left that to the leads,
> so this is a handed-over decision, not a self-served relaxation. I did the engineering first and
> am proposing the replacement second, because relaxing a bar before trying to meet it is exactly
> what § 6.1 warns against.
>
> **The headline is not the one I expected to write.** K1 does need replacing, and § 2 gives three
> independent arithmetic reasons. But replacing it **does not unblock the tier**, because the
> binding constraint turns out to be quality, not value — and the evidence that the adopted design
> cleared the quality bar rests on a comparison against the wrong denominator (§ 4). Fixing K1
> alone would let a quality regression through a gate that was designed to stop one.

---

## 1. What I was asked to fix, and what I found instead

**K1**, as written: *"The gate must avoid ≥ 3 of 9 classify calls on n-dx at its operating point."*

Three findings, in the order they landed. Each is arithmetic or measurement, not judgement:

| | Finding | Where |
|---|---|---|
| **A** | **K1 is not a property of the tier.** It is a step function of one repo's file count on one day, and it is non-monotone: improving sourcevision's *rules* makes K1 **harder**. | § 2 |
| **B** | **The adopted abstention design cannot satisfy K1 at any precision, with any model.** Its coverage ceiling is the share of non-`service`/`utility` files — **26.2%** corpus-wide — and K1 needs **29.4%**. This is structural, not a tuning gap. | § 3 |
| **C** | **No design beats the LLM on the files it claims.** 0 of 18 measured operating points. 12 of 18 beat the LLM's *global* 72.3%, which is the comparison ADR § 3a used — and which ADR § 5's own S1 does not ask for. | § 4 |

**C is the one that matters.** A and B are why K1 should be rewritten. C is why rewriting it changes
nothing about whether we ship.

## 2. Why K1 is the wrong shape — three arithmetic reasons

Calls avoided on a repo with residue `n` and `B = ceil(n/30)` batches, at coverage `c`, is
`B - ceil(n(1-c)/30)`. Everything below follows from that and the measured residues
(`scripts/data/elm-calls-avoided.json`, commit `f91370f8`): n-dx **255 files / 9 batches**,
AsterMind-CE **69 files / 3 batches**.

**2.1 — K1 gets HARDER when the product gets BETTER.** The "9" is not a constant; it is
`ceil(residue/30)`, and every improvement to `archetypes.ts` shrinks the residue. Jam's own Step 1
gateway fix already moved it 259 → 255.

| residue | batches | coverage K1 then demands for 3 calls |
|---|---|---|
| 255 *(today)* | 9 | **29.4%** |
| 240 | 8 | **37.5%** |
| 210 | 7 | **42.9%** |
| 180 | 6 | **50.0%** |
| 120 | 4 | **75.0%** |

**A criterion whose bar rises as the thing it measures improves is broken.** Ship better rules,
fail K1.

**2.2 — K1 is unreachable on small repos, for reasons that have nothing to do with the tier.** On
AsterMind-CE, "3 calls" is all 3 batches — it requires **100% coverage**. The same tier, same model,
same operating point passes K1 on n-dx and can never pass it on the smaller reference repo.

**2.3 — K1 is blind across a wide band.** Because the step is 30 files, coverage of 20%, 22.9% and
25% all avoid exactly **2** calls on n-dx. Every precision improvement in that band is invisible to
K1, and the tier is credited identically for materially different models. This is the same
lumpiness that made Step 1's four reclassified files worth **zero**.

## 3. Abstention's coverage ceiling sits below K1's threshold — structurally

The adopted design answers only when it predicts a class other than `service` or `utility`. Its
coverage therefore **cannot exceed the share of files that are not `service`/`utility`.**

```
full corpus (324 rows)   service 123 + utility 116 = 239   ->  non-S/U = 26.2%
  train    (241)                                            ->  non-S/U = 25.7%
  held-out ( 83)                                            ->  non-S/U = 27.7%

K1 needs 29.4% coverage on n-dx.        26.2% < 29.4%
```

**A perfect classifier using this abstention rule would still fail K1 on n-dx.** The gap is not
model quality; it is that the design declines three-quarters of the corpus by construction. Any
route to K1 must admit some `service`/`utility` predictions — which is the `B+su` family in § 4,
and it does reach 3 calls.

> This also explains the observed 23.3% coverage without appeal to model weakness. The teacher
> systematically flattens minority classes into the two big ones (§ 5), so the ELM trained on those
> labels under-predicts exactly the classes abstention needs it to predict.

## 4. The denominator — why the adopted design looked like a pass

**ADR § 5, S1, as written:** *"gated ELM precision ≥ LLM-vs-truth **on the same files**."*
**ADR § 3a, the evidence used to adopt abstention:** *"claims 22.9% of files at 75.5% precision vs
truth … **against the LLM's 72.3%**."*

72.3% is the LLM's accuracy over **all 83 held-out files**. The design claims a hand-picked ~19 of
them. Comparing a selected subset against a global average is not the test S1 asks for, and it is
not a close call — it is the difference between a pass and a fail on every single design measured.

`scripts/elm-operating-point.mjs` (new; reproduces the adopted design and searches the rest),
ELM 1024/relu/λ1e-2, 15 seeds, **DEV numbers from gold set #1**:

| design | coverage | ELM precision | **LLM on the same files** | gap | n-dx calls |
|---|---|---|---|---|---|
| `g` gate top 10% | 9.6% | 85.8% | **89.2%** | −3.3 pp | 1 |
| `g` gate top 30% | 30.1% | 77.9% | **81.1%** | −3.2 pp | 3 |
| **`B` abstention (ADOPTED)** | **23.3%** | **74.0%** | **74.3%** | **−0.3 pp** | **2** |
| `B+g` abstention, top 50% | 12.0% | 88.8% | **98.2%** | −9.4 pp | 1 |
| `B+su` abstention + top 10% S/U | 30.8% | 73.6% | **75.1%** | −1.5 pp | **3** |
| `B+su` abstention + top 25% S/U | 42.5% | 72.3% | **73.9%** | −1.7 pp | 4 |
| `cc` learned gate (`ConfidenceClassifierELM`), top 30% | 30.1% | 68.5% | **79.5%** | −10.9 pp | 3 |

**0 of 18 operating points beat the LLM on the files they claim. 12 of 18 beat the global 72.3%.**
The choice of denominator is the entire difference between "twelve designs pass" and "none do".

Two things follow, and they cut in opposite directions:

- **The adopted design's shape is vindicated.** Abstention has the **smallest deficit of anything
  measured** (−0.3 pp, ranges overlapping heavily). Jam's reasoning — the model should decline where
  the taxonomy is weakest — is right, and the ranking of designs supports it.
- **Its headline claim does not survive.** It does not beat the LLM; it very nearly ties it. "Nearly
  ties the teacher while answering a quarter of the questions" is a genuine result, and a much
  smaller one than "beats it".

**And the confidence gate is selecting the wrong thing.** Gating harder raises ELM precision
(85.8% at top-10%) — but it raises the *LLM's* precision on those same files faster (89.2%). The gate
ranks by **file easiness**, and easiness helps the teacher more than the student. The deficit is
*smallest* where coverage is *highest*. That is the opposite of the deployment story everyone
(including me, arriving) assumed, and it is why `TN-J19`'s top-decile 84.5% never translated.

> ⚠️ **All of § 4 is DEV.** Gold set #1's labels have been read. These numbers justify a decision
> about *criteria*; they certify nothing about a model. On ~19–58 files per seed, every range in
> `scripts/data/elm-operating-point.json` straddles its bar.

## 5. A correction to "the LLM's label noise is random"

`IMPL … § Phase 1` records: *"truth utility → LLM said service 5; truth service → LLM said utility
6. No directional bias. That is the signature of random label noise"* — and concludes a regularised
model can average it out. **The `service`/`utility` axis is symmetric and that reading of it is
correct.** But it is the only axis that was examined, and the errors elsewhere are not symmetric:

```
On the 24 held-out files whose truth is NOT service/utility, the LLM makes 7 errors.
  6 of those 7 collapse a minority class INTO service or utility:
    cli-command -> utility     entrypoint -> utility     types -> service
    config      -> utility     gateway    -> utility     types -> utility
Error flow:  utility  into 11 / out 8  (net +3)      service  into 6 / out 8
```

**`utility` is the teacher's sink for anything it is unsure about.** That is a directional,
systematic rule, not random noise — and systematic teacher error is precisely what a student
*cannot* average out. The favourable finding stands on its own axis; it does not generalise to the
axis the adopted design actually operates on.

## 6. Decision — proposed

**6.1 Replace K1 with K1′, stated in coverage.**

> **K1′ (value).** At an operating point that has already passed **K2′**, the tier must claim
> **≥ 33% of the files that would otherwise reach the LLM classifier**, measured as coverage on the
> certification set and reported with its seed range.
>
> **K1′-floor.** Below **13.0%** coverage the tier avoids zero calls on the smaller reference repo
> and must not be described as saving anything.
>
> **Reporting requirement (not a bar).** Every savings claim states coverage, the resulting
> `ceil(n/30)` call count per named reference repo, and the backend — per Butter's measurement
> contract. Calls avoided stays the published unit; it stops being the *threshold*.

**This is a re-expression, not a relaxation.** 33% coverage avoids exactly 3 of 9 on n-dx today —
K1's intent, preserved. What changes is that the bar is now a property of the model: it does not
move when the residue moves (§ 2.1), it is reachable on every repo (§ 2.2), it is sensitive across
the whole range (§ 2.3), and it can be certified on a gold set before any integration exists.

**6.2 Correct K2 to the comparison S1 already specifies.**

> **K2′ (quality).** Gated ELM precision ≥ LLM-vs-truth **computed on the subset the tier claims**,
> on a gold set whose labels have not been read. Never against a global average over files the tier
> does not answer.

This is not a new bar — it is ADR § 5's S1 read literally. It is stated separately because the
adoption evidence in § 3a did not apply it, and nothing in the tooling enforced it until
`elm-operating-point.mjs` existed.

**6.3 Record that K1 was not the binding constraint.** On the dev set no operating point passes
K2′. **The value criterion was never what stood in the way**, and had I relaxed K1 without measuring
K2′ properly, the tier would have shipped through a gate built to prevent exactly that.

## 7. Consequences

- **`TN-J24`'s verdict needs amending, not reversing.** Abstention remains the best-performing
  design measured. The claim that it "beats the bar (S1)" does not survive the same-files
  comparison, and the ADR § 3a row should say so.
- **S2 becomes redundant** and is folded into K1′; there is no longer a separate calls-avoided
  threshold to relax.
- **`B+su` is the only family that reaches 3 calls** (30.8% coverage). It is worth carrying into
  Phase 3 *if* the tier proceeds — its deficit (−1.5 pp) is small and its range is wide.
- **Gold set #2 is now more clearly load-bearing, not less.** Every § 4 number is DEV, and the
  question K2′ asks has never been answered on uncontaminated data.
- **`TN-J22` gets stronger, and I am saying so out loud as the handbook § 8 asks.** The LLM beats
  this tier on every subset measured; it is 13.1 pp below the human path ceiling; and § 5 shows its
  errors have a *nameable, fixable* structure — minority classes collapsing into `utility`. That is
  a prompt defect, and fixing it is cheaper than this tier and helps every user immediately.
  **If there is capacity to spend, it should go there.**
- **A new asymmetry is filed as `TN-J26`** (§ 8) — the teacher sees information the student does not.

## 8. `TN-J26` — the teacher and the student are not shown the same thing

The handbook's map says *"what the teacher sees — `classify.ts:486` — **path only**."* Reading the
prompt builder, that is not quite right:

```ts
// classify.ts:499-503
// Include partial evidence from algorithmic pass if available
if (f.evidence && f.evidence.length > 0) {
  const hints = f.evidence.slice(0, 3).map((e) => `${e.archetypeId}(${e.weight})`).join(", ");
  parts.push(`  [partial signals: ${hints}]`);
}
```

And `evidence` is populated whenever **any** signal matches (`classify.ts:159`), independent of
`PRIMARY_THRESHOLD` — which is what makes a file "unclassified" in the first place. So a residue
file with sub-threshold signals carries `[partial signals: service(0.7), utility(0.4)]` into the
teacher's prompt, while **the ELM is given the path string and nothing else.**

**I cannot yet say how often this bites.** `.sourcevision/classifications.json` overwrites the
algorithmic `evidence` with the LLM's own returned reason, so the pre-LLM state is not recoverable
from any committed artifact — it needs a corpus rebuild that captures it. **Stated as unquantified
rather than estimated**, per the handbook's own rule about numbers whose provenance nobody checked.

This is **not** the rejected feature work. That was naive positional/bigram re-encoding of the same
path (−20.1 pp) — more of the same signal. This is a *different signal*, and the argument for it is
not that it might help: it is that we have been comparing a student against a teacher with a bigger
question paper, and nobody recorded that.

## 9. Open questions for the leads

1. **Accept K1′ and K2′?** K1′ preserves K1's intent; K2′ is S1 read literally. Neither is a
   loosening.
2. **Given § 4 — does Path B continue?** No operating point beats the LLM on its own files. My
   recommendation is that the tier does not ship on this evidence, and that the effort moves to
   `TN-J22`. **I have been on this path for one session and Jam for three weeks, so weigh our
   recommendations differently: mine is cheap to disregard.**
3. **Fund gold set #2 anyway?** If Path B stops, a second gold set still pays for itself — it is
   what would make a `TN-J22` prompt improvement measurable, and it yields the inter-rater number
   `TN-J20` could not produce.
4. **Claim `TN-J26`?** Rebuilding the corpus with the algorithmic evidence attached is a small job
   and it is the one untested lever that is not "more of the same".
