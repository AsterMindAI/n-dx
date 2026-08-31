# NOTE — Nolan internal — 2026-08-28 — K1 replaced, and the tier came back

**From:** K2 (Team Nolan), drafted for Nolan · **Re:** `TN-J25`, `TN-J27`, `TN-J28`, and a decision needed
**Reading time:** the first three lines are the whole thing.

---

## The short version

1. **K1 is genuinely broken and I have replaced it** — proposal in
   [`ADR-2026-08-28-k2-replace-k1-with-a-coverage-criterion.md`](../../ADR/ADR-2026-08-28-k2-replace-k1-with-a-coverage-criterion.md).
   Not a relaxation: **K1′ (≥30% coverage) reproduces K1's intent on both reference repos.**
2. **But K1 was never what stood in the way — and the thing that did has now moved.** Phase 1 found
   an untested default worth **+4.0 pp**, and on the retuned model the tier **meets both bars** on
   the dev set for the first time.
3. **The ask is gold set #2.** There is finally something worth certifying, and no honest way to
   certify it.

## What I did, in the order the handbook asked

Pre-registered the bar and committed it (`f4a06175`) before writing the sweep. Ran Phase 1. Ran
Phase 2 on the model Phase 1 adopted. Then, and only then, proposed the K1 replacement — because
relaxing a bar before trying to meet it is the failure mode § 6.1 names.

## The three arithmetic problems with K1

K1 = *"avoid ≥3 of 9 classify calls on n-dx."*

- **It gets harder when the product gets better.** The "9" is `ceil(residue/30)`. If rules
  improvements take the residue 255 → 180, K1 goes from demanding **29.4%** coverage to **50%**.
  Ship better rules, fail K1.
- **It is unreachable on small repos.** On AsterMind-CE, "3 calls" is all 3 batches — **100%
  coverage**. Same model, same operating point, passes on one repo and cannot pass on the other.
- **It is blind across a 30-file band.** 20%, 25.6% and 29% coverage all avoid exactly 2 calls.

**K1′: ≥30% of the files that would otherwise reach the LLM classifier, at certified precision.**
30% is the smallest coverage that gives 3-of-9 on n-dx and 1-of-3 on AsterMind-CE — K1's intent, in
a unit that is a property of the model rather than of one repo's file count on one day.

## The part I did not expect

**`activation` had never been swept.** `relu` was the feasibility screen's default and every later
script inherited it — arbitrary in exactly the way `hiddenUnits: 256` was. `tanh` scores **64.6% vs
60.6%, +4.0 pp on 9 of 9 paired runs.**

Meanwhile the sweep the plan had the *highest* prior on — `ridgeLambda`, "1688 features on 241 rows
is heavily over-parameterised" — is **flat across four orders of magnitude.** Voting loses 2.8 pp.
RBF loses at every γ.

On the retuned model, with the comparison S1 actually specifies (against the LLM **on the files the
tier claims**, not its global average):

| design | coverage | ELM | LLM, same files | n-dx calls |
|---|---|---|---|---|
| abstention (adopted) | 25.6% | 74.7% | 72.9% | 2 |
| **abstention + top 10% of S/U** | **32.9%** | **75.1%** | **74.1%** | **3** |

**Both bars, in the mean, for the first time.** With three caveats I will not soften: every range
straddles, the margins are ~1 pp on ~27 files per seed, and **all of it is DEV** — gold set #1's
labels have been read.

## The thing I got wrong, because you should hear it from me

**My first Phase 2 run used `relu` — after Phase 1 had already adopted `tanh`.** It returned *0 of
18 designs beat the LLM*, and I had written the ADR recommending the tier not ship.

That is the `hiddenUnits: 256` error, repeated by the agent brought in to correct it. What caught it
was not that I noticed — it was the pre-registered rule that Phase 2 runs the model Phase 1 adopted.
Both runs are committed so the difference is inspectable.

The pattern underneath it is worth more than the incident: **two of the three largest effects on
this project were defaults nobody chose.** `256` (+12 pp) and `relu` (+4 pp), both inherited from
the first script written, neither ever named as a decision.

## Two things I found that are not mine to fix

- **`TN-J26` — the teacher sees more than the student.** The classify prompt is not "path only":
  `classify.ts:499-503` appends `[partial signals: service(0.7), …]`, and that evidence is populated
  whenever *any* signal matched, independent of the threshold that made the file unclassified.
  **Unquantified on purpose** — the pre-LLM evidence is overwritten in `classifications.json` and
  needs a corpus rebuild to recover. I would rather file it as unknown than estimate it.
- **`TN-J29` — "the LLM's noise is random" holds only on the axis that was checked.** On the 24
  files whose truth is *not* `service`/`utility`, 6 of the LLM's 7 errors collapse a minority class
  **into** them. `utility` is its sink for uncertainty — directional, systematic, and exactly what a
  student cannot average out.

## What I need from you

1. **Accept K1′ and K2′?** Neither is a loosening; K2′ is S1 read literally.
2. **Fund gold set #2?** This is the real ask. If no, the position is unchanged from Jam's: publish
   as promising-but-uncertified, do not ship.
3. **Phase 3, or `TN-J22`?** I think **`TN-J22`.** Even at the winning operating point the LLM sits
   at 74.1% against an **85.4%** human path ceiling — 11 pp left on the table across *all* 9 calls,
   where this tier contests 3 — and `TN-J29` names a concrete, fixable defect in the prompt.
   **Weigh that against my tenure: one session, against Jam's three weeks. It is cheap to
   disregard.**

I did not touch `packages/**`. Scripts and docs only, so nothing in this pass can break a build.
