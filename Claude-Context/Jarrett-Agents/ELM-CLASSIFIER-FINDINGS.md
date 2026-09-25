# ELM classifier — findings report (`TJ-E1`)

**Author:** Elon (Team Jarrett) · **Date:** 2026-09-23 · **Branch:** `elm/jarrett/classify-elm-content`
**Implements:** `ADR-2026-09-17-elon-content-based-elm-classifier.md`

> ## The short version
>
> **The classifier works mechanically and is not worth shipping on current evidence.**
>
> The defect that made the ELM stage structurally incapable of resolving anything is fixed. What
> replaced it is a classifier that, on a repo it has already learned, agrees with the LLM it would
> replace **52–67%** of the time, and on a repo it has never seen performs **no better than
> guessing the single most common label**.
>
> At the only operating point where precision approaches acceptable (81.3%), it saves **one LLM
> call in nine** on the classify pass — which is itself one of 22 LLM call sites, and not the
> expensive one.
>
> **Everything here is reproducible.** Every number has a committed, seeded script.
> **`elmPrefilter.enabled` remains `false`.** Nothing in this report recommends changing that.

---

## 1. What the job was

`ndx analyze` labels every source file with one of 17 archetypes. A rule pass handles most files;
the remainder go to an LLM. On n-dx that remainder — the **residue** — is **255 of 683 source
files**, costing **9 Claude invocations** per full analyze.

`TJ-R3` split that into a gate plus two owned modules. `TJ-E1`'s job was one of them:
`classify-ELM.ts` — file in, confident archetype or nothing out, no knowledge an LLM exists.

## 2. What was actually broken when I started

The seam existed and was **inert by construction**. The representation behind it fed
`classifyFile`'s evidence vector to the model, and that vector is identically **all-zero** for the
entire population the gate is invoked for — measured across 5 corpora, zero exceptions. A guard
correctly skipped all-zero vectors, so the stage resolved **0 files, always**.

The mechanism is not subtle: signal weights are 0.4–0.9 and `PRIMARY_THRESHOLD` is 0.4, so one
matched signal usually resolves a file outright. Files reaching the ELM are the ones with *no*
signal. **The gate is handed an adversarially-selected population** — precisely the files where the
cheapest signal already failed.

**n-dx's classifier is effectively path-only.** Of 75 catalog signals, 40 are `filename` and 34 are
`directory` string matches; one reads re-export names; the `import` kind is a stub that always
returns `null`. `classify.ts` contains no file-reading code at all.

## 3. What was built

`classify-elm-features.ts` — a fixed-width vector in six blocks, each L2-normalised independently
so a 512-dimension block cannot swamp a 4-dimension one by magnitude:

```
[ extension ][ path scalars ][ path tokens ][ content tokens ][ structural ][ indicators ]
      21             4              96             512             16            2
```

**Reading file content is the substantive change** — nothing at this call site had ever done it.

**`UniversalEncoder` cannot encode content**, verified by reading the installed v3.0.0 bundle
rather than its docs. `textToVector` emits a **one-hot per character position**, sized
`maxLen × charSize`, hard-truncated at `maxLen`. `TJ-R2`'s config sees the first 80 characters of a
file. Raising `maxLen` to fit content gives ~82,000 input dimensions against a 128-unit hidden
layer. Feature hashing replaces it: fixed width regardless of file length, no vocabulary to persist.

Also found in that function and routed around rather than relied upon: interpolating `charSet` into
the strip regex turns `.-_` into a character **range** (0x2E–0x5F), so `: ; < = > ? @` survive the
strip and then encode as all-zero while still consuming a position slot. Harmless for paths, not
for source code.

## 4. The measurements

All seeded, all reproducible. Labels throughout are an **LLM teacher measured at 72.3% against
human judgement** — agreement with it is *not* accuracy.

### 4.1 The mechanism is fixed

| | evidence representation | content representation |
|---|---:|---:|
| all-zero vectors on the 263-file residue | **263 / 263** | **0 / 263** |
| distinct classes predicted | 1 (by construction) | **10 of 11** |

### 4.2 Confidence does not predict correctness — the finding the architecture rests on

The gate design — *answer what you're sure of, defer the rest* — only works if confidence predicts
correctness. It does not:

| signal | AUC | mean when correct | mean when incorrect |
|---|---:|---:|---:|
| margin | 0.595 | 0.0656 | 0.0591 |
| confidence | 0.551 | 0.1693 | **0.1706** |

0.50 is a coin flip, and incorrect predictions were marginally *more* confident. This explains why
precision stayed flat (54.4% at 83% coverage, 66.7% at 17%) across the whole threshold sweep:
the quantity being thresholded was near-noise.

*Caveat: 69 held-out rows, AUC SE ≈ ±0.06. This cannot separate 0.50 from 0.65. It does rule out
the steep curve a working gate needs.*

### 4.3 Ensembling fixes the gate curve but not the economics

Fifteen independently-seeded models, majority vote. Precision rose **52.5% → 57.6%**, and the gate
curve became monotonic where a single model's was noise:

| agree | coverage | precision | labels changed | calls saved | tokens |
|---|---:|---:|---:|---:|---:|
| 9/15 | 72.2% | 63.6% | 67 | 6 of 9 | 132k–276k |
| 10/15 | 57.6% | 65.3% | 51 | 5 of 9 | 110k–230k |
| 12/15 | 32.5% | 69.9% | 25 | 3 of 9 | 66k–138k |
| **15/15** | **6.3%** | **81.3%** | **3** | **1 of 9** | 22k–46k |

AUC gain was only **+0.026** (0.644 vs 0.618) and is inside the standard error. A larger apparent
gain on the 69-row protocol did **not** survive the higher-powered one; both are reported.

**The structural tension:** `classify-llm.ts` batches 30 files per call, so savings are *step-wise*
— resolving 5% of the residue saves **zero** calls. Roughly every 11.8% of coverage saves one. So
bulk coverage is required to save money, and precision is only defensible at low coverage.
Unanimity is the strictest gate that exists; there is nothing above it to reach for.

### 4.4 It does not generalise — and the obvious confound has been eliminated

Acting on `NOTE-nolan-to-jarrett-2026-09-04-…` (which Team Jarrett never read, because it lives on
`Nolan-Work`):

| repo | rows | precision | majority baseline | vs majority |
|---|---:|---:|---:|---:|
| n-dx *(trained on)* | 255 | 80.4% ⚠️ | 40.0% | +40.4 |
| fastify **fresh** | 48 | 31.3% | 39.6% | **−8.3** |
| core **fresh** | 212 | 29.7% | 45.3% | **−15.6** |

⚠️ *The 80.4% is **in-sample** — that run trained and evaluated on the same rows. The honest
held-out in-domain figure is 52–67%. Recorded here because it was reported before it was caught.*

Team Nolan then certified their corpus and reversed their own conclusion: *"the failure was a
starved class distribution, not the feature space."* That was a live alternative explanation here —
my model trained on n-dx alone, 186 rows, with `utility` and `service` holding ~200 of 255.

So it was tested directly. All 9 corpus repos cloned at pinned commits, 2,195/2,195 rows with
content available, same held-out set in every cell:

| corpus | hidden | rows | precision | vs majority | AUC | predicts sink | time |
|---|---:|---:|---:|---:|---:|---:|---:|
| n-dx only | 128 | 255 | 30.4% | −13.8 | 0.585 | 97.3% | 3s |
| n-dx only | 4096 | 255 | 24.2% | −20.0 | 0.559 | 90.4% | 273s |
| **all repos** | **128** | **1,935** | **41.2%** | **−3.1** | **0.629** | 75.4% | 4s |
| all repos | 4096 | 1,935 | 36.9% | −7.3 | 0.595 | 71.5% | 469s |

- **Corpus: +10.8 pp.** Nolan's diagnosis holds here too, and is *understated* — the larger corpus
  adds two classes, making the task harder, and precision rose anyway. Sink over-prediction fell
  97.3% → 75.4% against a teacher share of 54.6%.
- **Capacity: −6.2 pp**, worse in both conditions and ~100× slower. Their 4096 is matched to a
  4,000-dimension TF-IDF input; against this 651-dimension vector it overfits. **Their certified
  constant is right for their features and wrong for ours** — worth recording, because copying it
  looked like an obvious win.
- **Still not beating a constant predictor.** 41.2% against a 44.2% majority baseline. At 260
  held-out rows (SE ≈ 3.0 pp) the model is now *statistically indistinguishable from* always
  guessing the majority class — no longer clearly below it, but not above it.

**The negative result survived its most likely alternative explanation.** That makes it stronger
than it was, not weaker.

## 5. The economics, which is the actual objective

Per-call cost is **22k–46k tokens, cache-dependent** (Nolan, measured with a *trivial* prompt —
cite as a range, do not multiply out).

**The reconstructed classify prompt is ~924 tokens**: 379 for the archetype catalog, 445 for 30
file paths, ~100 scaffolding. So **roughly 96–98% of every classify call is fixed spawn overhead,
not the question being asked.**

That reframes the objective. If cost is per-invocation and nearly independent of payload, the lever
is *fewer invocations*:

| approach | calls | tokens saved | quality cost |
|---|---:|---:|---|
| today | 9 | — | — |
| ELM at 81.3% precision | 8 | 22k–46k | 3 of 255 labels change |
| ELM at 63.6% precision | 3 | 132k–276k | 67 of 255 labels change |
| **`LLM_BATCH_SIZE` 30 → 255** | **1** | **176k–368k** | **none** |

**Nesting, which is where the "1/9" figure gets its real size:**

1. 1 of 9 = ~11% of the **classify pass**.
2. One `ndx analyze` is ~11 calls (**9 classify + 2 zone enrichment**). Zone enrichment writes
   prose — an ELM cannot do it at all.
3. `ndx analyze` is one command. `ndx work` (the agent that writes code) was named in the
   2026-08-11 survey as *"likely the majority of token spend"*, and the ELM touches none of it.
   **Only 2 of 22 LLM call sites are ELM-replaceable.**

**The share of total spend that the classify pass represents has never been measured. It is the
number that decides whether any of this is worth doing, and it is cheap to get.**

## 6. Why the labels matter (the cost side of the trade)

Archetypes are not cosmetic. `callgraph-findings.ts` reads `analysisHints` to **multiply severity
thresholds** — a `component` gets `godFunctionThresholdMultiplier: 2` — and findings are explicitly
*"downgraded to info"* based on archetype. Archetypes also feed `.sourcevision/CONTEXT.md` and
`llms.txt`, the summaries an AI reads when working in the repo, plus `zones.ts` and the MCP tools.

A wrong label is not a wrong string in a JSON file. It is **quietly miscalibrated analysis**, plus a
codebase summary that describes those files wrong to the next agent that reads it.

## 7. Structural reasons this is hard (partly inference, marked as such)

1. **Adversarial population** *(measured)* — the gate only sees files where the strongest cheap
   signal already failed.
2. **Teacher ceiling and directional noise** *(measured, Nolan's)* — teacher 72.3% vs humans against
   an **85.4%** human path-only ceiling, and it saw *more* than the student does. Its errors are not
   random: `utility` is its sink, and 6 of 7 errors collapse a minority class into `service`/
   `utility`. Random noise averages out; directional noise trains the student to amplify it — which
   is exactly what the 75.4%-vs-54.6% sink over-prediction shows.
3. **Archetype may be partly repo-relative** *(inference)* — if the label is not purely a function of
   the file, cross-repo transfer is partly ill-posed.
4. **The gate starves its own teacher** *(inference)* — files the ELM resolves never reach the LLM,
   so the training corpus only ever grows from the ELM's failures. The better the gate performs, the
   more biased its future training data becomes.
5. **The ELM does no feature learning** *(structural)* — random hidden layer, ridge readout. The
   representation does all the work.

## 8. Corrections made to this branch's own reported numbers

Recorded because a wrong number that gets quoted later costs more than the error did.

| claim | correction |
|---|---|
| 80.4% in-domain agreement | **In-sample** — trained and evaluated on the same rows. Honest figure: 52–67%. |
| "~40% token reduction" | Matched no measured row. The real pairing is 55.6% of calls / 24.7% of labels changed. |
| "best operating point: margin 0.000" | A savings metric with no quality term recommends switching the LLM off entirely. Logic replaced; the script now names no recommendation. |
| Nolan's published log verdicts | Their logs end with an unconditional "it collapsed" line that printed for every model. They fixed it and published the correction. **Do not read those closing blocks.** |

## 9. What is safe to use, and what is not

**Safe and useful regardless of whether the gate ships:**
- `classify-elm-features.ts` — 56 unit tests, degradation paths, missing indicators, red-verified
- The five measurement scripts — seeded, committed, runnable by any team
- The findings in §4, §5 and §7

**Not safe:**
- Enabling `elmPrefilter.enabled` on current evidence
- Any pre-trained/bundled model — the cross-repo path scores at or below a constant predictor
- Quoting any in-domain number as evidence the classifier generalises

**Fixed before this reached a shared branch:** the content path gated on absolute confidence with a
default of 0.11, which sits *below the entire observed distribution* — it would have accepted every
prediction at ~52% precision and eliminated the LLM pass. It now gates on ensemble agreement,
defaulting to unanimity.

## 10. Recommendation

1. **Do not ship the gate.** Leave `enabled: false`.
2. **Measure where the tokens actually go**, per call site. Cheapest and highest-value next step.
3. **Test the batch-size change** — one constant, saves more than the ELM's best case, no quality
   cost. Needs testing for retry cost, attention dilution at 255 files, and output limits.
   `classify-llm.ts` is not Team Jarrett's module; this is a request, not a change.
4. **One cheap idea remains** — Nolan's `B+su` operating point (`abstainOn: ["service","utility"]`,
   admit 10%) targets the largest visible defect, the 75.4%-vs-54.6% sink over-prediction. Hours,
   not days.
5. **Do not spend more on representation tuning** until 2 and 4 are answered.

## 11. Reproducing everything here

```sh
# corpus (Team Nolan's; deliberately not duplicated into this branch)
mkdir -p scripts/data
git show origin/Nolan-Work:scripts/data/elm-archetype-corpus-v3-classtargeted.json \
  > scripts/data/elm-archetype-corpus-v3-classtargeted.json
#   also published at github.com/NMoore-Astermind/ELM-database-ndx under data/

# comparison repos, at the commits the corpus pins (provenance.repos)
# see each script's header for the exact clone commands

node packages/sourcevision/scripts/elm-content-diagnostic.mjs .      # mechanism + calibration
node packages/sourcevision/scripts/elm-generalisation-check.mjs      # cross-repo transfer
node packages/sourcevision/scripts/elm-savings-curve.mjs             # cost vs changed labels
node packages/sourcevision/scripts/elm-gate-separability.mjs         # does confidence predict correctness
node packages/sourcevision/scripts/elm-ensemble-uncertainty.mjs 15   # ensemble + priced gate
node --max-old-space-size=6144 \
  packages/sourcevision/scripts/elm-capacity-corpus-sweep.mjs        # capacity x corpus
```

**Contamination boundary:** `hono` and `trpc` are Team Nolan's blind certification set. They appear
in no corpus, no script and no measurement here. Do not train or evaluate on them.
