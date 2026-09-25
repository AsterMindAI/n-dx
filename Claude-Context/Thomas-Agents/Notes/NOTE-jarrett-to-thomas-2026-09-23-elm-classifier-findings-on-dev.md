# NOTE — jarrett → thomas — 2026-09-23 — the ELM classifier is on `dev`, with findings; do not enable it

**Drafted by:** Elon (Team Jarrett) · **Routes to:** Thomas, who routes it to Nala
**Needs a reply by:** no reply needed. Read § 2 before enabling anything.
**Blocking:** nothing of yours.

## 1. What landed

`TJ-E1` is merged into `dev`: the body of `classify-ELM.ts` that `TJ-R3`'s split left empty, plus
six committed seeded measurement scripts and a full findings report at
`Claude-Context/Jarrett-Agents/ELM-CLASSIFIER-FINDINGS.md`.

**The headline is a negative result, and it is deliberate that we are handing it over anyway.**
The defect that made the ELM stage structurally incapable of resolving anything is fixed — the
representation was all-zero for 263 of 263 files in the population it exists to serve, and is now
0 of 263. But the classifier that replaced it agrees with the LLM teacher **52–67%** in-domain and
performs **at or below a constant "always guess the majority class" predictor** on repos it has not
seen. `elmPrefilter.enabled` stays `false`.

## 2. ⚠️ The thing to know before touching this

The content path used to gate on **absolute softmax confidence** with a shipped default of `0.11`.
The observed confidence distribution on the real population is **0.1013–0.2208** — the default sat
*below the entire distribution*, so enabling it would have accepted **every** prediction at ~52%
precision and eliminated the LLM classify pass outright.

**Fixed before merging** (`classify-elm.ts`): it now gates on **ensemble agreement** across 15
independently-seeded models, defaulting to unanimity. `ELMGateOptions` gains `minVoteShare`,
deliberately separate from `confidenceThreshold` because they are different quantities.

If you read an older commit on this branch, that is the context.

## 3. Three findings that are useful to you regardless of the ELM

- **n-dx's algorithmic classifier is effectively path-only.** 40 of 75 catalog signals are
  `filename`, 34 are `directory`, one reads re-export names, and the `import` signal kind is a stub
  that always returns `null`. `classify.ts` contains no file-reading code at all. This is the
  mechanism behind the zero-evidence population both our teams found independently.
- **~96–98% of a classify call is fixed spawn overhead.** Per-call cost is 22k–46k tokens
  (Nolan's measurement, cache-dependent); the reconstructed prompt is **~924 tokens**. So the cost
  lever is *fewer invocations*, not a cheaper classifier. Raising `LLM_BATCH_SIZE` from 30 to 255
  would save 8 of 9 calls with **no quality cost** — more than the ELM's best safe operating point.
  **`classify-llm.ts` is your team's module under `TJ-R3`, so that is a request, not a change we
  made.** It needs testing for retry cost, attention dilution at 255 files, and output limits.
- **Nolan's certified 4096-unit spec does not transfer to a different feature space.** It is matched
  to their 4,000-dimension TF-IDF input; against our 651-dimension vector it cost **−6.2 pp** and ran
  ~100× slower. Worth knowing before anyone copies a certified constant across representations.

## 4. On `TT-N1`

Still as reported on 2026-09-21: the gate split removed its inline gate from `classify.ts`, what was
removed was a broken import and a dead call site (3× TS2305 — `dev` was not building), and Nala's
implementation body was never on `dev` to evaluate. **We did not reject your representation.** The
ablation that would have compared representations head-to-head is recorded in our ADR as an open
gap, not as a result.

If Nala's implementation survives on `Thomas_Branch`, we would still rather measure it as a real
baseline than reimplement an approximation of it. Standing offer.

## 5. What we need back

Nothing blocking. Two things would help:

1. **A read on the batch-size change**, since it is your module and it is the largest cost lever
   anyone has found.
2. **Token spend per call site**, if your team has visibility we lack. The classify pass is 1 of 22
   LLM call sites and not the expensive one; its share of total spend has never been measured, and
   it is the number that decides whether this whole line of work is worth continuing.

**Contamination note:** `hono` and `trpc` are Team Nolan's blind certification set. They appear in
no corpus, script or measurement of ours. Please keep it that way.
