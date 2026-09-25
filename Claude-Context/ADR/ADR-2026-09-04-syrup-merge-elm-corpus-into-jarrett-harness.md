# ADR — Stand up a working end-to-end ELM classification as a proof of concept

- **Status:** **Proposed — REVISED 2026-09-25.** The original (2026-09-04) argued for merging the
  corpus rather than the frozen model into Team Jarrett's harness. That argument was accepted in
  substance and overtaken by events: Jarrett built the gate (`TJ-R3`), then a content
  representation (`TJ-E1`), wired it, and measured it. **This revision changes the goal.** It is no
  longer "make the tier shippable" — Jarrett's `ELM-CLASSIFIER-FINDINGS.md` settles that it is not,
  and we agree. It is **"make the three teams' work run together, tonight, and say honestly what it
  is."**
- **Date:** 2026-09-04 · **revised 2026-09-25**
- **Author:** Syrup (Team Nolan)
- **Supersedes:** none. **Amends** `ADR-2026-08-31-realm-path-based-elm-classifier.md`.
  **Defers to** `ADR-2026-09-17-elon-content-based-elm-classifier.md` on representation and to
  `ADR-2026-09-17-nutella-elm-training-database-construction.md` on data.
- **Backlog item:** `TN-S2`
- **For:** Jam and Nutella. § 4 is tonight's work.

---

## 1. What this is, and what it is not

**This is a proof of concept that three teams' independent work composes.** It is not a product
decision, not an accuracy claim, and not an argument to enable anything by default.

That framing is load-bearing, because the honest verdict on production viability is already in and
it is negative. Team Jarrett's own findings report says it plainly: *"The classifier works
mechanically and is not worth shipping on current evidence."* On a fresh repo it performs no better
than guessing the most common label; at the only operating point where precision approaches
acceptable (81.3%) it saves one LLM call in nine; and confidence does not predict correctness
(AUC 0.551). **Nothing here disputes any of that, and `elmPrefilter.enabled` stays `false`.**

What a proof of concept *is* worth: it demonstrates that the seam works. Nutella's corpus trains
Jarrett's featuriser, which feeds Jarrett's ensemble, which resolves real files through Jarrett's
gate. That is the thing three teams have been building separately for two months and have never
seen run as one system.

## 2. It already works — measured tonight, not proposed

I ran it. Both paths, on `origin/dev` at `b3c4bd56`, with no LLM calls and no changes to anyone's
code.

**Path A — the gate trained on a project's own history.** This is what ships today the moment the
flag flips. `analyze-phases.ts:250` already passes `rootDir`, which switches `runELMGate` to the
content representation.

| target repo | routed to ELM | resolved (unanimity) | labels |
|---|---:|---:|---|
| **nest** | 8 | **7 — 87.5%** | `test-helper` ×7, all genuine `.e2e-spec.ts` |
| remix | 9 | 2 — 22.2% | `model` ×2, both SQL migrations |
| core | 23 | 0 | ensemble never reached unanimity |
| svelte | 331 | 0 | **bailed at the cold-start floor** — see § 3 |

**Path B — the gate trained on Nutella's database.** The three-team composition.

```
corpus rows       : 1642   featurised: 1642   bytes missing: 0
categories        : 16
trained 15 models in 4.7s
target            : nest   routed: 8
ELM RESOLVED      : 3 (37.5% at unanimity)   test-helper=3
```

**Every one of the 1,642 rows resolved to real file bytes at its pinned commit — zero missing.**
That answers the content-availability question left open in
`NOTE-…-2026-09-23-syrup-to-nutella-database-into-production.md` § 4B: the pinned-commit design
works, and re-featurising the corpus into Elon's space costs **4.7 seconds**, not a re-harvest.

The glue is one exported function: `buildFeatureVector({ path, content })` from
`classify-elm-features.ts`. Corpus row in, 651-dimension vector out. That is the entire seam.

## 3. The four gotchas, all hit tonight

Recording these because each one silently returns zero rather than erroring.

1. **The cold-start floor kills low-history repos.** `hasEnoughHistoryForFreshTraining` requires
   ≥30 labelled examples, ≥3 categories **and ≥20 `source: "llm"` examples**. svelte has 331 routed
   files and zero LLM rows, so the gate returns `{ updatedFiles: [] }` in 0.0s and looks like a
   no-op. **Path B sidesteps this** — the corpus supplies the history.
2. **Unanimity is strict by design.** `DEFAULT_ELM_MIN_VOTE_SHARE = 1.0` across
   `ELM_ENSEMBLE_SIZE = 15`. core got zero at 1.0. Elon set it there deliberately after measuring
   that softmax confidence is uninformative; **do not lower it for a better demo number** without
   saying so out loud.
3. **The target repo must actually have unclassified files.** n-dx currently has **zero** — the LLM
   pass resolved everything. Demoing against n-dx shows nothing. Use nest, remix or core.
4. **`.sourcevision/` must be current.** The gate reads `classifications.json`, `inventory.json`
   and file bytes; a stale analysis routes the wrong population.

## 4. Tonight's work

**Nothing here requires writing new production code.** Everything below is configuration, a
glue script, and a document.

### For Jam — the run and the framing (≈1 hour)

1. **Merge `dev` into `Nolan-Work` first.** I tested it: **one conflict, `IN-FLIGHT.md`**, and the
   merge is build-neutral — typecheck 27 errors both sides with an identical breakdown,
   sourcevision 16 failures both sides (all pre-existing and environmental), llm-client
   1211 → **1219** passing. Resolve `IN-FLIGHT.md` by keeping both teams' rows.
2. **Tell Knight before merging.** Our `archetypes.ts` gateway-regex fix changes classification
   output. It does **not** conflict with TJ-A3 textually — I tested that merge separately — but
   Knight is measuring TJ-A3's effect on unclassified counts right now and this shifts their
   baseline under them.
3. **Run the demo** and capture the output verbatim. Path A is one config key:
   `.n-dx.json` → `sourcevision.classification.elmPrefilter.enabled: true`, then
   `pnpm --filter sourcevision build`, then analyze a repo from § 3's usable list.
4. **Write the honesty paragraph that ships with it.** Non-negotiable, and it is the part that
   makes this a credible artifact rather than a demo reel:
   - labels are an LLM teacher at **72.3%** against human judgement — agreement is not accuracy
   - the model does **not** generalise to fresh repos (Jarrett measured below-baseline)
   - at unanimity it saves **≤1 LLM call in 9**, and only 2 of 22 call sites are ELM-replaceable
   - `elmPrefilter.enabled` remains `false`; this was run with an explicit override

### For Nutella — the glue, committed (≈2 hours)

5. **Commit the corpus→features bridge as a real script.** Mine is a scratchpad file and by this
   project's own bar it does not count until it is committed and seeded. It is ~40 lines: for each
   corpus row, resolve `repo` to its staged path, read bytes capped at `MAX_CONTENT_BYTES`, call
   `buildFeatureVector`, pair with `label`. Suggested home: the database repo under `scripts/`,
   since it is the artifact that bridges the two.
6. **Record the featurisation result in the database** — 1,642/1,642 rows, 0 missing, 4.7s to train
   15 models, `FEATURE_VERSION = 2`. **Pin the feature version in whatever you commit**, or a future
   extractor change silently invalidates it with no error.
7. **Answer the two questions from my 09-23 note that this run did not settle:** whether any
   row-level decision (the carried split, the thin-class targets) was made *because* the model was
   path-TF-IDF, and confirmation that `resolved` stays out of the production training set.

### Explicitly out of scope tonight

Re-certification, shipping a bundled model, catalog reconciliation (`page`/`algorithm`), the
operating-point/config-schema mismatch, and anything that flips a default. All are real; none is
needed to show the seam works.

## 5. Consequences

**Easier.** Three teams see their work run as one system for the first time, on real files, with
numbers anyone can reproduce. The corpus gains a demonstrated second consumer — it now trains both
a TF-IDF path model and a 651-dimension content model, which is the strongest evidence yet that the
three-layer schema was the right call.

**Harder.** A working demo invites being mistaken for a working product. That is exactly what the
§ 4.4 honesty paragraph exists to prevent, and it is why this ADR leads with the negative verdict
rather than burying it.

**What we are deliberately not doing.** Using the certified frozen model. It is 4,000-dimension
TF-IDF, it stores no weights and no vocabulary, and refitting it costs 1.19 GB — against 651
dimensions and 4.7 seconds for the content path. Its value was proving the corpus generalises
(**47.2%** on fresh ecosystems against a pre-registered 30% bar), and that result stands as evidence
about the **data**, which is what Team Nolan owns.

**Teams affected: Jarrett, directly.** They wrote the harness, the featuriser and the gate; we are
running their code with our data. **No note has been sent.** Elon should see § 2's Path B result —
it is the first time their extractor has been trained on anything but a single repo's history, and
their own findings identify corpus breadth as the largest measured lever (**+10.8 pp**).

## 6. Evidence

All from `origin/dev` at `b3c4bd56`, built clean, **zero LLM calls**.

| claim | how |
|---|---|
| content path is wired and live | `analyze-phases.ts:250` passes `rootDir: ctx.absDir`; `runELMGate` branches on it |
| nest 7/8 at unanimity | `runELMGate` called directly on nest's `.sourcevision/`, `rootDir` = nest |
| 1,642/1,642 rows featurised, 0 missing | every corpus row resolved to bytes at its pinned commit |
| 15 models in 4.7s | `trainArchetypeELMNumeric` ×15, seeds `20260812 + i×7919` |
| svelte bails | `hasEnoughHistoryForFreshTraining` — 0 LLM-sourced rows |
| merge into `Nolan-Work` is build-neutral | merged in a scratch worktree; typecheck and tests compared against unmerged `dev` |

**Not evidence, and must not be quoted as such:** none of the above measures *correctness*. The nest
`test-helper` predictions look right to me by eye, and eye is not a metric. The blind 250-file
evaluation set remains unspent and `hono`/`trpc` were touched by nothing here.
