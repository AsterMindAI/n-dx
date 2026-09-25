# ADR — Content-based feature representation for the ELM classifier (fills `classify-ELM.ts`)

- **Status:** **Accepted for the representation decision; the gate it serves is NOT recommended
  for production.** Updated 2026-09-23 once the Evidence section below was measured. The encoding
  decisions (points 1-3, 5-8) held up and shipped. Point 4's ablation was NOT run and is recorded
  as an open gap. The approach does not clear a usability bar: see Evidence and
  `Jarrett-Agents/ELM-CLASSIFIER-FINDINGS.md`. `elmPrefilter.enabled` stays `false`.
- **Date:** 2026-09-17
- **Author:** Elon (Team Jarrett)
- **Supersedes:** `ADR-2026-08-31-realm-path-based-elm-classifier.md` (`TJ-R2`) — supersedes its
  *representation* decision, and **keeps** its encoder work as one of the candidates measured here
  (see Decision point 4). Per the user's 2026-09-17 direction.
- **Backlog item:** `TJ-E1`

## Context

`TJ-R3`'s gate split (`7ecf69f3`, merged `ae381889`) built the right seam and left it empty:

```
runClassificationGate()             classify.ts       ← gate, owns routing
   ├─ runELMGate()                  classify-elm.ts   ← this ADR
   └─ classifyUnclassifiedWithLLM() classify-llm.ts
```

**The seam resolves zero files today, by construction.** What sits behind `runELMGate` is still
`TJ-A2`'s evidence-vector representation, and
`packages/sourcevision/src/analyzers/classify-elm.ts:350` unconditionally skips any file whose
vector is all zeros:

```ts
if (!vector.some((v) => v > 0)) continue;
```

**100% of the population reaching this stage has an all-zero vector** — measured across 5 corpora
(n-dx, `AsterMind-Community-Edition`, `express`, `indie-stack`, `zustand`) on 2026-08-27, zero
exceptions. The mechanism is not subtle: `classifyFile`'s signal weights are 0.4–0.9 per match and
`PRIMARY_THRESHOLD` is 0.4, so one matched signal usually already resolves a file. There is
essentially no "partial signal, still unresolved" middle ground — the files that reach the ELM are
the ones with *no* signal at all.

The guard is correct and stays. The representation underneath it is the defect.

**What this costs today:** every unclassified file goes to the LLM. On n-dx that is 166 files per
full `ndx analyze`, batched 30 per call at `classify.ts`'s batching — roughly 6 Claude round-trips
per analysis, on a call site that runs on every non-`--fast` analyze. The ELM exists to remove most
of that; at present it removes none of it.

**The trap this ADR must avoid.** Every accuracy number this project has produced measured the
wrong population:

| Result | Who | What it actually measured |
|---|---|---|
| 100% @ 59.0% coverage | Archer (`TJ-A1`/`TJ-A2`) | Files that already had *some* algorithmic signal |
| 97.0% @ 42.3% coverage | Knight (`TJ-K1`) | Same |
| Independent reproduction | Realm (`TJ-R1`) | Same — faithfully reproduced, same wrong population |
| 90.6% k-fold | Nala (`TT-N1`, Team Thomas) | n-dx's own labeled data, k-fold, no out-of-domain set |

None was drawn from genuinely zero-signal files. **No number above is evidence for this call site**,
and this ADR does not inherit any of them.

## Decision

**1. Read file content.** The classifier reads each candidate file's actual bytes, in addition to
its path and inventory metadata. Nothing at this call site has ever done this — `inventory.json`
and `imports.json` carry paths, roles, and import edges only. This is the substantive change, and
it is the user's explicit 2026-09-17 direction ("the full file, including the metadata and the
content"). It is also the only untried axis: three representations have now been tried
(evidence vector → path text → path+export text) and all three are metadata-only.

**2. Do *not* encode content with `UniversalEncoder`.** Verified by reading the installed
`@astermind/astermind-community` v3.0.0 bundle (`dist/astermind.esm.js`), not its docs:

```js
textToVector(text) {
  cleaned = text.toLowerCase().replace(new RegExp(`[^${this.charSet}]`,'g'),'')
               .padEnd(this.maxLen,' ').slice(0, this.maxLen);
  const vec = [];
  for (let i = 0; i < cleaned.length; i++) vec.push(...this.charToOneHot(cleaned[i]));
  return vec;
}
```

It is a **fixed-position one-hot per character**, vector size `maxLen × charSize`. Four
disqualifying properties for content:

- **Hard truncation at `maxLen`.** Archer's config (`maxLen: 80`) sees the first 80 characters. For
  a file that is a license header or a single import line.
- **Dimension blow-up if `maxLen` is raised.** A 2,000-character window at `charSize` 41 is 82,000
  input dimensions feeding a 128-unit hidden layer — a 10.5M-weight random projection fitted from
  ~500 training examples.
- **Position brittleness.** One-hot at fixed offsets means inserting one directory level shifts
  every subsequent character into different dimensions; `src/foo.ts` and `lib/src/foo.ts` share
  almost no active features.
- **A latent charSet bug that only bites on content.** The strip regex is built by interpolating
  `charSet` into a character class, so Archer's `"...9/.-_ "` makes `.-_` a **range** (0x2E–0x5F),
  not three literals. Characters such as `: ; < = > ? @` survive the strip and then encode to an
  all-zero one-hot (index `-1`), silently consuming a position slot. Paths rarely contain those;
  source code is full of them.

**3. Use a fixed-width, length-independent feature vector**, built in three blocks and
concatenated, then L2-normalized:

| Block | Contents | Why |
|---|---|---|
| **Name/extension** | Extension one-hot, path depth, directory-segment tokens, filename tokens (split on `/`, `.`, `-`, `_`, camelCase) | Directly encodes the diagram's "look at extension" and "look at name" |
| **Content tokens** | Identifiers and keywords hashed into a fixed number of buckets (feature hashing), log-TF weighted | Length-independent and position-independent — the two properties `UniversalEncoder` lacks |
| **Structural counts** | Import count, export count, presence of JSX, default export, `describe(`/`it(`, route/handler shapes, class vs. function declarations | Cheap, high-signal, and interpretable when a prediction has to be explained |

Feature hashing is what makes "the full file" tractable: a 10-line file and a 3,000-line file
produce the same vector width, so no truncation decision is needed and no file is too big.

**4. Measure candidates against each other, and keep Archer's encoder as one of them.** `TJ-R2`'s
`extractPathExportExamples`/`pathExportVector` (commit `ae9dc463`, `../n-dx-jarrett`) is real,
tested, and is the current best metadata-only representation. It is absorbed, not discarded — it
becomes the **path-only baseline** the content representation must beat. An ablation over the three
blocks above says which part is actually carrying signal, rather than asserting that content helps.

**5. Reuse the existing numeric training path unchanged.**
`trainArchetypeELMNumeric`/`predictArchetypeNumeric` consume `{vector, archetype}` pairs and are
representation-agnostic. No change to the model lifecycle (`getArchetypeELM`, cold-start gate,
bundled baseline) and no change to `runELMGate`'s signature — this ADR changes what goes into the
vector, nothing about who calls whom.

**6. Keep the all-zero guard, and keep the classifier LLM-unaware.** `classify-elm.ts` continues to
return "confident result or nothing" and holds no knowledge of a fallback. That is `classify.ts`'s
decision, per `ADR-2026-09-07-realm-classify-gate-split.md`.

**7. Derive the confidence gate; do not pick it.** The user has explicitly not chosen a threshold
(2026-09-16). The eval reports a precision/coverage curve for **both** candidate gate shapes —
absolute confidence, and top1/top2 margin — and the number is chosen from that curve afterward.
Relevant measured context: this project's ELM confidences are diffuse, not peaked (~0.08–0.20
Archer, ~0.13–0.23 Knight, ~0.09–0.18 numeric; shipped default 0.11), so the diagram's illustrative
">80%" is far outside anything observed and would resolve nothing as a raw softmax threshold.
Nala's `TT-N1` used a 0.3 top1/top2 margin, which is the shape that actually works on a
ridge-regression readout.

**8. The retrain loop is phase 2, explicitly after the gate clears.** The diagram's
"take the labeled file name from the LLM and retrain" arrow maps onto `OnlineELM` (incremental
`beta` update via recursive least squares, no full retrain). It is not built until a representation
clears its gate — an online loop on a representation that cannot discriminate would compound a
known-bad signal, and would make the eval non-reproducible while the representation is still moving.

## Alternatives considered

| Option | Why not |
|---|---|
| Raise `UniversalEncoder`'s `maxLen` to fit content | 82,000+ input dimensions for a 2k window against 128 hidden units and ~500 examples; still positionally brittle; still hits the charSet range bug. Decision point 2. |
| Keep metadata-only (ship `TJ-R2`'s path+export as-is) | May well work — so it is kept as the measured **baseline** rather than rejected. But it leaves the one untried axis untried, and the user's direction is explicitly to use content. |
| Embeddings from a hosted model as ELM input | Reintroduces the per-file LLM round-trip this call site exists to remove. Self-defeating. |
| TF-IDF with a learned vocabulary | Needs a fitted vocabulary persisted alongside the model and rebuilt when the corpus changes; feature hashing needs neither and is stable across corpora — which matters because the bundled baseline model ships to downstream projects whose vocabulary we have never seen. |
| Full AST parse per file | Real signal, but a parser per language across a multi-language inventory (TS/JS/Go/Swift already present) is a much larger surface than this task needs. Structural counts (block 3) capture the cheap fraction; revisit if the ablation says structure is where the signal is. |
| Train on all files rather than the zero-evidence population | This is precisely the mistake made four times already (see Context). The held-out set is drawn from genuinely zero-signal files or the result means nothing. |

## Consequences

**Easier.** The ELM stage can finally resolve files at all. The ablation gives the first real answer
to "which signal actually classifies a source file," useful beyond this call site. Structural counts
are interpretable, so a wrong prediction can be explained rather than shrugged at.

**Harder — and these are real costs, not disclaimers:**

- **New file I/O at analysis time.** The classifier reads candidate files from disk. Bounded by a
  per-file read cap and by the fact that only the unclassified population is read (166 files on
  n-dx, not 683). Must be measured, not assumed — it lands in the IMPL's Step 8.
- **A wider input vector** than the 17-dimension evidence vector, so the bundled baseline model
  artifact grows (currently 130KB). Bucket count is a tunable in the ablation.
- **Content is not always available.** Deleted-but-still-inventoried files, unreadable files, and
  binary files must degrade to metadata-only rather than throw. The all-zero guard remains the
  backstop.
- **A second thing to keep in sync.** The feature extractor and the bundled baseline model must be
  versioned together — a model trained on block layout A is meaningless against block layout B.
  The IMPL adds a representation-version field to the artifact for exactly this.

**Which teams affected:** Team Jarrett only. This changes the body of `classify-elm.ts`, which
`TJ-R3` made a Team-Jarrett-owned module with a stable interface. No interface change, no shared
file, no dependency addition (`@astermind/astermind-community` is already declared in
`packages/sourcevision/package.json`). **No cross-team note required** — and deliberately so: the
`TJ-R3` split exists precisely so this kind of change stops being a cross-team event.

**Superseded work:** `TJ-R2` (Archer). Its Step 4 encoder is absorbed as the baseline (Decision
point 4), not thrown away.

## Evidence

**MEASURED 2026-09-17 → 2026-09-23.** This section replaces the methodology-only placeholder the
ADR shipped with. Every number has a committed seeded script; full write-up with caveats in
`Jarrett-Agents/ELM-CLASSIFIER-FINDINGS.md`.

**Task framing.** One source file (path + inventory metadata + file content) → one of 17
`BUILTIN_ARCHETYPES`, or abstain. Labels are Team Nolan's certified corpus v3-classtargeted
(2,195 rows, 10 repos, `source: "llm"`), an **LLM teacher measured at 72.3% against human
judgement**. Agreement with it is not accuracy, and every figure below is agreement.

**Seeds.** 20260922 throughout; Nolan's seed-42 stratified split reused, not re-split.

**Baselines.** Per-repo majority class (39.6–45.3% depending on repo), *not* the 5.9% uniform
floor. "Beats random" was never the claim.

### What the decision got right

| Decision | Outcome |
|---|---|
| 1. Read file content | **Confirmed necessary.** All-zero vectors on the real 263-file residue: 263/263 under the evidence representation, **0/263** under content. Distinct classes predicted: 1 → 10 of 11. |
| 2. Do not use `UniversalEncoder` | **Confirmed.** Verified in the installed bundle: one-hot per character position, `maxLen × charSize`, hard-truncated. Plus a charSet-as-regex-range defect that only bites on source text. |
| 3. Fixed-width feature hashing | **Works.** 651 dims, length-independent, 56 unit tests including red-verified degradation paths. |
| 5. Reuse the numeric training path | **Held.** No change to `runELMGate`'s signature. |
| 7. Derive the gate, do not pick it | **Vindicated, and load-bearing.** Absolute confidence is unusable: distribution 0.1013–0.2208, so the shipped 0.11 default sat *below the entire distribution* and would have accepted everything at ~52% precision. Fixed to gate on ensemble agreement, defaulting to unanimity. |
| 8. Retrain loop is phase 2 | **Held.** Not built. |

### What it got wrong or left open

- **Decision 4's ablation was never run.** `TJ-R2`'s path+export encoder was ported and is present,
  but content-vs-path-only was not measured head-to-head. The gate this ADR set itself — "beats the
  best metadata-only representation out-of-domain" — is therefore **unmet, not failed**. Honest gap.
- **Block-energy choice is unvalidated.** Per-block L2 gives the 21-dim extension block the same
  energy as the 512-dim content block. Never swept.

### The results that decide it

**Gate calibration** — the measurement the whole architecture rests on. A single model's confidence
does not predict its own correctness: margin **AUC 0.595**, confidence **AUC 0.551**, and incorrect
predictions were marginally *more* confident. Ensembling 15 seeds raises precision 52.5% → 57.6% and
makes the curve monotonic (57.6% at majority → **81.3% at unanimity**), but AUC gains only +0.026,
inside the standard error.

**Cross-repo transfer fails.** Trained on n-dx, evaluated on unseen ecosystems: 31.3% (fastify,
majority 39.6%) and 29.7% (core, majority 45.3%) — **below a constant predictor**.

**The starved-corpus confound was tested and eliminated.** Team Nolan reversed their own conclusion
to "starved class distribution, not the feature space". Retested with all 9 corpus repos cloned at
pinned commits, 2,195/2,195 rows with content, identical held-out set:

| corpus | hidden | rows | precision | vs majority |
|---|---:|---:|---:|---:|
| n-dx only | 128 | 255 | 30.4% | −13.8 |
| **all repos** | **128** | **1,935** | **41.2%** | **−3.1** |
| all repos | 4096 | 1,935 | 36.9% | −7.3 |

Corpus **+10.8 pp** (their diagnosis holds here too, and is understated — the larger corpus adds two
classes). Capacity **−6.2 pp** and ~100× slower: their certified 4096 is matched to a 4,000-dim
TF-IDF input and overfits a 651-dim one. **Still at or below the majority baseline** (SE ≈ 3.0 pp),
so the model is statistically indistinguishable from guessing the most common label.

**Economics.** Per-call cost 22k–46k tokens; the reconstructed prompt is ~924 tokens, so **96–98% of
a classify call is fixed spawn overhead**. Batching at 30 makes savings step-wise (~11.8% coverage
per call saved). At unanimity the gate saves **1 of 9 calls**; the settings that save more change a
third of the labels. Raising `LLM_BATCH_SIZE` 30 → 255 would save **8 of 9 with no quality cost**.
The classify pass is 1 of 22 LLM call sites and its share of total spend has never been measured.

### Corrections to numbers this branch previously reported

An 80.4% in-domain figure was **in-sample** (trained and evaluated on the same rows); the honest
held-out figure is 52–67%. A "~40% token reduction" claim matched no measured row. A first
"best operating point" heuristic optimised calls-saved only and recommended never calling the LLM.
All three are corrected in the findings report rather than quietly dropped.

### Scripts

`elm-content-diagnostic.mjs` · `elm-generalisation-check.mjs` · `elm-savings-curve.mjs` ·
`elm-gate-separability.mjs` · `elm-ensemble-uncertainty.mjs` · `elm-capacity-corpus-sweep.mjs`
— all under `packages/sourcevision/scripts/`, seeded and runnable by another team.

**Contamination:** `hono` and `trpc` are Team Nolan's blind certification set — absent from every
corpus, script and measurement here.
