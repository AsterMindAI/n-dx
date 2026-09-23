# ADR — Content-based feature representation for the ELM classifier (fills `classify-ELM.ts`)

- **Status:** Proposed — **no accuracy claim is made here.** Per `ADR-TEMPLATE.md`, the Evidence
  section below states methodology only and is deliberately unmeasured; Status does not move to
  Accepted until `IMPL-2026-09-17-elon-content-based-elm-classifier.md`'s eval runs and clears its
  gate. Team Jarrett-internal — this changes the body of a function Team Jarrett owns, not an
  interface or a shared file, so it needs no cross-team sign-off (contrast `TJ-R3`).
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

**Unmeasured by design. This section states methodology only** — per `ADR-TEMPLATE.md`, Status
stays Proposed until the committed eval script runs and clears the gate. **No accuracy number
appears here, and none of the four historical numbers in Context is inherited.**

**Task framing.** Input: one source file (path + inventory metadata + file content). Output: one of
the 17 `BUILTIN_ARCHETYPES` labels, or abstain. 17 classes.

**Population — the part that has been wrong four times.** The train and held-out sets are drawn
**exclusively from files with an all-zero evidence vector**, i.e. the population that actually
reaches `runELMGate`. A held-out set containing any file the algorithmic pass could already resolve
invalidates the result. The eval asserts this property on its own inputs rather than assuming it.

**Baselines — two, both required.** Majority-class over the labeled zero-evidence population
(17-class floor is ~5.9%, but the realized majority class will be higher and is the honest bar), and
`TJ-R2`'s path+export representation on the identical split. "Beats random" is not the claim;
"beats the best metadata-only representation" is.

**Splits.** In-domain: seeded held-out split of n-dx's own zero-evidence population.
Out-of-domain: a codebase absent from training, `AsterMind-Community-Edition` for continuity with
`TJ-A1`/`TJ-K1`, with `express`/`indie-stack`/`zustand` available. **The out-of-domain number is the
one that decides this** — the in-domain number has passed before while the out-of-domain number
failed, and that is what the bundled baseline model ships against for downstream users.

**Seed.** Fixed and recorded in the script. Every reported number carries its seed and its baseline
(`Command-Structure`'s ELM corollary).

**Gate.** Precision/coverage curves for absolute confidence and for top1/top2 margin, reported
together so the trade-off is visible rather than pre-decided. A coverage floor is applied so a
single lucky resolution cannot read as a pass — `TJ-A1` used 15%.

**The script.** `packages/sourcevision/scripts/eval-classify-elm-content.ts`, committed, seeded,
and runnable by another team against their own corpora. Per `Command-Structure`: if it is not a
committed seeded script someone else can run, it did not happen.

**Labels.** Generated through the real pipeline — `claude` is on PATH and `ANTHROPIC_API_KEY` is
set as of 2026-09-17, so unlike `TJ-A1` (which hand-labeled as a documented stand-in) these are
real `enrichClassificationsWithLLM` outputs. This also means the diagram's retrain arrow and the
training-data source are the same mechanism, which is a property worth keeping.
