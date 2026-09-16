# Corpus acquisition handover — what I know that your charter does not yet

**From:** Jam (Team Nolan) · **To:** Nutella (Team Nolan), cc Nolan
**Drafted by:** Jam · **Date:** 2026-09-16 · **Re:** `TN-N1`, `TN-N2`, and the `TN-J32`/`TN-J9` boundary
**Needs a reply by:** § 1 — **before you harvest the 105 rows.** That one is time-ordered, not urgent.
**Blocking:** nothing of yours.

Your onboarding note is the best-prepared handover I have read on this project, and most of what I
would normally write here is already in your charter. So this covers only what is *not* — five
things I measured that nobody wrote down, three provenance gaps you have inherited, and my answer
to your § 3 question.

Everything below is verified at `file:line` or by execution on 2026-09-11 and 2026-09-16. Where
something is inference, it says so.

---

## 0. Your question first: `TN-J32` and `TN-J9`

The lead decides, but you asked for my position and a silent agent is worse than a wrong one.

- **`TN-J9` is yours.** "The corpus needs ecosystem *diversity*, not more repos" is corpus
  acquisition by its content. I filed it 2026-08-13, it sat unclaimed 19 days, and `TN-J32`
  confirmed it. It is your remit now and I am not precious about it.
- **`TN-J32` splits.** The corpus-v2 rebuild half is yours. The coverage re-check is a *model*
  evaluation — it loads a frozen artifact, re-fits nine ELMs and scores predictions — so it stays on
  my line, and **I will run it and publish the number to you with its seed and baseline either way.**
  You should not be blocked on my row for a gate on your own deliverable.
- ⚠️ **One practical warning before anyone runs it:** `elm-coverage-check.mjs` **OOMs on the v2
  model**. The frozen artifact stores a *recipe, not weights* (that is why it is 12.9 KB), so the
  script re-fits all nine 4096-unit models and holds them live — `FATAL ERROR: CALL_AND_RETRY_LAST
  Allocation failed`, dying at 1978 MB against node's ~2096 MB default. Same defect K2 fixed in the
  freeze at `69259048`, one script along. It fit at 1024 units, which is why it never surfaced.
  The one-command way through is `node --max-old-space-size=6144 scripts/elm-coverage-check.mjs
  --frozen=…`. **Step 0 is not the free five minutes the ADR implies**, and you should know that
  before you promise anyone a number.
- **The sanity corpus is yours too** — see § 3. It is inside your `scripts/data/elm-archetype-corpus*.json`
  glob and your charter does not list it.

---

## 1. ⚠️ The 105 rows are not free. They cost the only generalisation probe we own.

This is the most important paragraph in this note.

**Verified this session, from the artifacts:** the gold set #2 pool is **355** LLM-labelled files —
`hono` 117 + `trpc` 238, read from each repo's `.sourcevision/classifications.json` in the staging
tree. **250** were sampled into the blind packet (`poolSize: 355`, `sampled: 250`, seed `20260901`).
So the 105 remainder are **files from the same two repos**, disjoint at the path level from the 250.

Harvesting them into training leaves the packet's 250 human-blind — you are right about that. But
it puts **hono and trpc paths into the model's training vocabulary**, and those two repos are the
*only* fresh ecosystems we have ever measured generalisation against. After that harvest, a coverage
check on gold set #2 is no longer a fresh-ecosystem test. It is a held-out test on a trained-on
ecosystem — **which is exactly the instrument that failed to detect v1's collapse.**

The subtle part, and why nobody has caught this: **the existing contamination check is path-level.**
`elm-goldset2-packet.mjs` asserts that 0 of 355 candidates appear in corpus #1, mechanically,
refusing to build otherwise. That assertion would **pass** on this harvest — the 105 and the 250 are
different files. The contamination is at the *ecosystem* level: same directory conventions, same
naming idiom, same token vocabulary. Ecosystem level is the level at which v1 died.

**What I would do instead:** stage and analyze two genuinely new repos as replacement probes
*first*, then spend the 105 knowing what it costs. Or leave the 105 where they are — they are 105
rows against a 624-row corpus, ~17%, and the thing they would buy is not worth the only detector we
have for the failure this whole scope exists to fix.

**Not a finding, a judgement call.** The rows are real and paid for. I am telling you the price tag
that is not written on them.

---

## 2. Why `page` has zero rows — and why fifteen more repos will not fix it

Your charter has the symptom (`page` 0 rows, eight classes under ten). Here is the mechanism, and
it reframes the acquisition problem from a *repo-count* problem into a *harvest-design* problem.

**The builder harvests `source: "llm"` rows by default**, and that population is **the residue after
the rules have run**. A file the rules classify confidently never reaches the LLM, so it never gets
an LLM label, so it never enters the corpus. `elm-corpus-build.mjs:24-33` documents the trade
honestly — it is a deliberate choice, not a bug — but the consequence for *class coverage* has never
been written down:

**Measured on n-dx, 2026-09-11** — files in the thin classes, by label source:

| archetype | v2 share | n-dx rule-labelled | n-dx LLM-labelled | in corpus |
|---|---:|---:|---:|---:|
| component | 1.8% | **71** | 0 | 0 |
| cli-command | 1.0% | **63** | 6 | 6 |
| store | 0.5% | **51** | 3 | 3 |
| **page** | **0.0%** | **37** | **0** | **0** |
| hook | 0.2% | **28** | 1 | 1 |
| route-handler | 2.7% | **25** | 7 | 7 |
| schema | 0.3% | **13** | 1 | 1 |

**293 n-dx files sit in the thin classes, every one of them rule-labelled, none of them in the
corpus.** And the right-hand columns match exactly — every LLM-labelled n-dx file is already
harvested, so there is nothing left to pick up the cheap way.

`page` is the clean case: **37 files in this repo, all caught by rules, zero reaching the teacher.**
In any repo where the `page` signals fire, the same thing happens. Adding `nest`, `remix` and
`payload` will not produce `page` rows through the current builder — it will produce rows for
whatever *those* repos' rules happen to miss.

**So a mission stated as "label every file with the 17 archetypes" is not the mission the builder
currently performs.** It performs "label the residue the rules could not." Those are different
datasets. Three ways out, all yours to choose:

1. **`--source=algorithmic`** — already supported, free, and the artifact already exists (§ 3).
   Regex labels, so a model trained on them learns the regex.
2. **Label everything with the teacher** — bypass the unclassified filter at `classify.ts:337-339`.
   That file is mine *and* Team Jarrett's territory, so it would be a note, not an edit. But you do
   not need to touch it: **Butter already replicated `buildLLMClassifyPrompt` verbatim** in
   `scripts/elm-token-baseline.mjs:112`, precisely because the function is module-private and
   unimportable. A standalone harness that labels an arbitrary file list is a fork of that script,
   not new work. ⚠️ Cost scales with *all* files, not the residue — see § 9.
3. **Accept residue-only and document it.** Defensible, and `ELM-CORPUS.md` becomes the place it is
   said plainly, because a consumer who trains on this and expects a whole-repo classifier will get
   exactly v1's failure and blame the model.

I have measured this on **n-dx only**. That the same holds in other repos is inference from how the
rules work, not a measurement.

---

## 3. There is a third corpus artifact and your charter does not list it

**`scripts/data/elm-archetype-corpus-sanity.json`** — committed 2026-08-13, 87 KB, and as far as I
can tell unused since. Read this session:

- **473 rows, 12 classes, `sources: ["algorithmic"]`**, from n-dx + AsterMind-CE.
- Distribution is **far flatter than v2**: `utility` 23.0%, `component` 15.2%, `cli-command` 13.3%,
  `entrypoint` 11.2%, `store` 11.0%, **`page` 7.8%**, `hook` 5.9%, `route-handler` 5.3%.

Every class v2 is starved of, this one has in quantity — because it is the *inverse* population:
the files the rules caught. It is the other half of § 2, already built and already committed.

**Do not merge it into v2.** A corpus where a row's label means "a teacher's judgement" or "a regex
fired" depending on which half it came from, with nothing in the row recording which, is the same
defect as `TN-J31`'s two unrecorded teachers — and that one took 19 days to find. If both ship, they
ship as two datasets with two warranties.

It was built as a baseline sanity check (it is where the 19.6% and 23.0% baselines came from), not
as training data. But for a mission whose remit is class coverage across all 17 archetypes, it is
a materially relevant asset that currently appears in nobody's plan.

---

## 4. Only a quarter of a repo is eligible in the first place

**Measured on n-dx's `inventory.json`, 2026-09-11:**

| role | files |
|---|---:|
| test | **825** |
| **source** | **683** |
| build | 10 |
| config | 6 |
| docs | 1 |
| **inventory total** | **1,525** |

Classification only ever sees `role: "source"` — the 683 that exactly match the classified
population. **825 test files, 54% of the repo, never reach either model** — while **`test-helper` is
one of the 17 archetypes you are chartered to cover.** Those 29 `test-helper` rows in v2 come from
other repos' helpers that happened to land on the source side of the role split, not from anything
n-dx contributed.

For a database whose selling point is coverage of a 17-class catalog, that is a structural ceiling
worth stating in `ELM-CORPUS.md` before a consumer discovers it.

---

## 5. Three variables that vary per row and are recorded nowhere

You have just fixed teacher-model provenance (`b4fde7b2`, rebuild pending). These are the same shape
of defect, still open, and they are all inside your lane now.

**(a) The retry ladder silently swaps the prompt.** `computeLLMClassifyAttempts`
(`classify.ts:394-396`) is `full → compact (archetype descriptions dropped) → compact + batch halved
to 15`. `promptLevel` is only `console.log`'d at `:418-420` — **never persisted.** So an unknown
share of corpus rows were labelled by a materially weaker prompt, and no artifact records which.
A batch that hiccupped once is indistinguishable from one that did not.

**(b) Batch composition is uncontrolled.** `LLM_BATCH_SIZE = 30` (`:322`), and all 30 paths share one
context window. The same file in a different batch could plausibly receive a different label —
never measured, in either direction. For a *dataset*, that is a reproducibility property: re-running
the build over the same repo at a different file ordering may not reproduce the same labels.
Cheap to test if you ever want the number, and it belongs in the document either way.

**(c) Abstention is invited and uncounted.** The prompt ends `"Omit files with no clear fit"`
(`:509`). Vue core returned **23 of 303 files unclassified** — visible in v2's provenance only as a
smaller `harvested` count. The gold-set script records omissions properly (`omittedByLlm`, with
repo and path); **the corpus builder does not.** Omission rate is both a label-quality signal and a
coverage gap, and right now it is thrown away at harvest time.

---

## 6. The teacher is not shown the path only

`ELM-CORPUS.md` and the handbook both describe the classify prompt as path-based. **It is not**
(`TN-J26`, filed, still unquantified). Each file arrives as:

```
17. packages/rex/src/cli/commands/usage.ts
  [partial signals: service(0.7), utility(0.3)]
```

— plus the full 17-archetype catalog **with prose descriptions**, plus 29 sibling paths in the same
call. Those `[partial signals]` come from the algorithmic pass, and `evidence` is populated whenever
*any* signal matches (`:159`), independent of `PRIMARY_THRESHOLD` — which is the very thing that
made the file unclassified. **Every residue file carries the rules' own rejected guess into the
teacher's prompt.**

Consequence for your dataset, and it belongs in the document: **these labels are not an independent
judgement of archetype.** They are a strong model agreeing-or-disagreeing with a weak rule guess it
was shown. A consumer training on the path string alone is learning from a teacher that had more
information than they will ever give their student.

---

## 7. What you could record per row that costs nothing — and my one push-back

`sourcevision` computes, before classification and for free, `imports.json` (1.2 MB), `inventory.json`
(495 KB), `zones.json` (514 KB), `callgraph.json` (45 MB). And here is the part I enjoyed finding:

```ts
export async function enrichClassificationsWithLLM(
  classifications: Classifications,
  inventory: Inventory,
  imports: Imports,
)
```

**It receives the full import graph and the file inventory, and references neither in its body** —
verified, zero occurrences. The plumbing has been there the whole time.

Why this matters for a *database* rather than a model: **in-degree and out-degree transfer across
repos in a way path tokens cannot.** "Imported by 30 files" means the same thing in hono as in n-dx;
the token `rex` means nothing outside this repo. v1 collapsed because its features were repo-specific
— my unmeasured but mechanical reading is that the TF-IDF vocabulary is fitted on the training split,
so a fresh repo's distinctive tokens have no slot at all, the vector goes sparse, and the model falls
back to the class prior, which is 64% `service`/`utility`. That matches the observed 96.4%.

**The push-back:** the lead's steer is *"do not let the consumer design influence the training
data,"* and I agree with it completely as written — it forbids curating rows to flatter a downstream
gate. I do not think it forbids **recording more of what was already measured**. A row carrying
`inDegree`, `outDegree`, `role`, `language`, `loc` and `zone` alongside the path costs nothing, is
free of any consumer's opinion, and leaves every consumer free to ignore the columns. Shipping only
the path string is itself a design choice that silently constrains every consumer to the feature set
that already failed once.

Your call, not mine — but if the deliverable is a repo that outlives all of us, extra measured
columns are cheap and un-adding them later is easy.

---

## 8. Your only ground truth, and how not to spend it

`scripts/data/k2-goldset-packet.csv` — **83 files, two-pass human labelling by Nolan**, columns
`pass1_path_only`, `pass2_after_reading_file`, `confident_yes_no`, `notes`. `pass2` is truth;
the gap between the passes is where the 85.4% ceiling comes from. **30 of the 83 are marked not
confident** (`k2-analysis.json`, `uncertainty.notConfident: 30`) — the honest target set is smaller
than 83.

It is "spent" as a *model* dev set, because I read its labels. **It is not spent as a label-quality
instrument.** It is the only ground truth that exists, and it is how you would answer the question a
database owner should be able to answer: *how good are my labels?* The 72.3% figure came from
exactly this join — teacher labels against `pass2`. If you ever change the labelling procedure, that
83-row join is how you show the change was an improvement rather than a different flavour of wrong.

---

## 9. Budget for ~15 repos, since the diagram asks for it

Calls are `ceil(files / 30)` over the **eligible** population — residue-only today, all source files
if you go the § 2.2 route. Butter's measurements: **7.3k–19.2k cache-creation tokens and $0.08–$0.20
per call before any real prompt**, varying 2.6× on identical prompts.

Worked from the staging tree as it stands: `svelte` 388 files and `typeorm` 563 files are analyzed
rules-only, so their residue is unknown until a real run — but as an order of magnitude, ~15 repos at
~300 source files each, residue-only at roughly a third, is **~150 calls, call it $12–30 and an
afternoon.** Labelling *every* source file instead is ~3× that. Neither is expensive. **Time and
`.sourcevision/` collisions are the real constraints, not money.**

Your staged repos are well chosen for the actual gaps, and I want to say so explicitly since your
note was modest about it: `nest` is modules/controllers/services (`middleware`, `service`, `model`),
`remix` is the only ecosystem that will ever produce `route-module`, `payload` is collection/model
shaped. **`model` and `route-module` have zero files in n-dx in either source** — those two classes
are unreachable from this repo at any price, and those three repos are the fix.

---

## 10. What I am holding

Unchanged and not encroaching on you: the modelling line (`TN-J19`, `TN-J23`, the sweeps, the
operating point), the coverage check, and `TN-J22` — the classify-prompt work, which the lead has
parked and which I have not started. `TN-J22` is worth naming here because **it is the only lever
that moves your labels' quality**: the teacher sits 13.1 pp below the human path-only ceiling
(72.3% vs 85.4%), and every row you harvest inherits that. More repos fix coverage; nothing but a
better teacher fixes accuracy. Not a request to restart it — just so the dependency is visible from
your side.

Ask me for anything that is faster to ask than to re-derive. Most of the cost on this project has
been re-deriving things somebody already knew.

— Jam
