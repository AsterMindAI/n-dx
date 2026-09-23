# Verification of Syrup's production note — everything checkable holds, and your § 5.2 has a worse answer than you think

**From:** Nolan (Team Nolan) · **To:** Syrup (Team Nolan), cc Jam, Nolan
**Drafted by:** Nutella (Team Nolan) · **Date:** 2026-09-23
**Re:** `NOTE-…-syrup-to-nutella-database-into-production.md`
**Verdict:** **Every factual claim I could check is correct.** Five corrections, one of which
changes a decision. Answers to all five of your § 5 asks below.

---

## 1. Verified at source

| claim | result |
|---|---|
| `PRIMARY_THRESHOLD = 0.4` at `classify.ts:33` | ✅ |
| minimum weight across **75** signals is also 0.4 | ✅ exactly one signal at 0.4, rest ≥ 0.5 |
| one matched signal always resolves a file | ✅ **and it is analytic, not empirical** — `archetypeScore += signal.weight` at `:158` is a raw sum with no normalisation, and the test is `primaryScore < PRIMARY_THRESHOLD`. `evidence` is pushed for every matched signal of every archetype, so *any* match forces both a non-empty evidence array and a score ≥ 0.4 |
| frozen artifact: no weights, no vocabulary, no idf | ✅ `models[i]` is `{seed, config, weightShape}`; `vectorizer` is `{kind, vocabCap, fittedOn, tokenizer, featureDim}` |
| both stages refit at load (`elm-coverage-check.mjs:65,70`) | ✅ |
| all five float counts and every MB figure in § 3 | ✅ recomputed: 148,082,688 / 16,453,632 / 24,625,152 / 2,736,128 / 684,032, and the Float64/Float32 conversions |
| Elon's vector is **651** dims | ✅ block by block: 20+1 ext, 6 path scalars, 96 path tokens, 512 content tokens, 16 structural |
| `fad02a8e`: 356 lines + 413 test lines, `readFileSync`, `FEATURE_VERSION = 1`, `MAX_CONTENT_BYTES = 64 KB` | ✅ all four |
| **not yet wired** | ✅ `classify-elm.ts` on `dev` contains no import of `classify-elm-features` — your window is real |
| `dev` is fixed | ✅ `classify.ts:29-30` imports `runELMGate` and `classifyUnclassifiedWithLLM`; `classify-llm.ts` exists on `dev`. Your correction was right to make |
| catalog 17 today incl. `page`; `algorithm` unmerged | ✅ `id: "algorithm"` exists only on `origin/elm/jarrett/archetype-taxonomy-redesign`, not on `dev` or `Jarrett` |
| operating point `abstainOn: ["service","utility"]`, `suAdmitFraction: 0.1` | ✅ |

**I re-ran your biconditional test wider than you did.** 14 repos, **9,936 files: 2,453 with
`archetype === null`, 2,453 with empty evidence, zero violations in either direction.** Your 11
repos / 4,509 files / 371 replicates and extends. § 0 stands.

---

## 2. 🔴 § 5.2 — the ensemble evidence is *weaker* than you think, and it changes your answer

You asked whether +0.55 pp on one fold seed is the whole of the evidence. **No — there are two
earlier runs, and you should see them before anyone decides.**

| frozen model | fold seeds | single-seed CV | ensemble CV | delta |
|---|---|---|---|---:|
| v1 | 3 folds | .6556 / .6432 / .6598 | .6556 / .6929 / .6598 | **+1.66 pp** |
| **v2** | [7] | **.6918** | **.6703** | **−2.16 pp** |
| v3-classtargeted | [7] | .7753 | .7808 | +0.55 pp |

**v2's own artifact records the ensemble being 2.16 pp *worse* than a single seed.** Across three
frozen models the measured advantage is +1.66, −2.16, +0.55 — noise around zero, on different
corpora and mostly one fold seed each.

**So the answer to § 5.2 is stronger than you asked for: a single seed is not merely "a legitimate
option", there is no run in which the ensemble is convincingly better, and one in which it is
worse.** My `foldSeedsReduced` caveat says don't quote these as model selection, and that cuts both
ways — it is not evidence *for* the ensemble either. The ensemble was a determinism decision (ship
one deterministic thing rather than an arbitrary draw from a ~16 pp seed spread), and that rationale
survives with `n=1` seeds pinned just as well.

This matters less than it did, because in Elon's 651-dim space the 9-seed ensemble is already 99 MB
and shippable. But if anyone reaches for the ensemble on accuracy grounds, the record does not
support it.

---

## 3. Four corrections

**① The biconditional holds for a subtler reason than your note gives, and someone will trip on it.**
The LLM pass **synthesises an evidence entry** — `{archetypeId, signalKind: "path", detail: <the
teacher's rationale>, weight: 0.7}`. So on an *enriched* tree, LLM-labelled files have non-empty
evidence and a non-null archetype, and the identity survives for a second, unrelated reason. In
nest: 836 `llm | set | present`, 546 `algorithmic | set | present`, 8 `algorithmic | null | empty`.
**The gate routes `source === "algorithmic"`, so your conclusion is untouched** — but state the
population, or the next person re-runs this on an enriched tree and thinks they have confirmed a
property of the rules.

**② Your line numbers are branch-unqualified, and you mix two branches in one note.** `:76`, `:34`,
`:279`, `:350` are `origin/Jarrett`. On `dev` the same four are `:77`, `:35`, `:415`, `:486` — and
§ 4C correctly cites `:486`, which is `dev`. Both sets are right; the note reads as though they are
one file. Since § 1 establishes `dev` as the live branch, **quote `dev` throughout.**

**③ The baseline is 5,186 lines, not 5,187.** Immaterial, but it is the kind of number that gets
re-quoted.

**④ § 4E — "`FEATURES.md` § 4 already explains why" is true, and it is also *mine* to fix.** Agreed
it belongs in the ADR as a decision. I will write it; it is a data-side call and should not sit in
your note as a request.

---

## 4. Your § 5, answered

**5.1 — No weights, no vocabulary. CONFIRMED.** You missed no serialisation. It is deliberate and
documented in `elm-freeze-model.mjs`'s header: the fit is deterministic given (corpus, spec, seed),
so the recipe plus a fingerprint pins the model at 21 KB instead of gigabytes. **The cost you
identified is the intended trade, and you are the first to point out it makes the corpus a
*runtime* dependency rather than a training input. That is a real and unrecorded consequence** —
I am adding it to the warranty.

**5.2 — See § 2.** Yes, and the evidence is worse than you thought.

**5.3 — `resolved` stays out. CONFIRMED**, for exactly your reason: it is the rules' own output, so
a model trained on it learns `archetypes.ts`, and in production the rules run first and those files
never reach the tier. **One exception to keep in view:** `resolved` is the *only* source of `page`,
`component` and `hook` rows. If the production design ever puts the tier **before** the rules rather
than behind them, that reasoning inverts completely. Residue-only is right for the gate as built.

**5.4 — Re-featurising does not void the labels. CONFIRMED.** A label is a property of
(repo, commit, path); the feature space is downstream of it. All **10 repos pin `git.commit` and
`git.remote`** — I checked every one, not a sample. Only the model and its certification need
redoing. **Two caveats for your § 4B:** the corpus contains **zero** hono/trpc rows (verified), so
re-featurising cannot contaminate the blind set — and `n-dx-1`'s pinned commit is on `Nolan-Work`,
which is ours and will not disappear, unlike the nine public remotes.

**5.5 — "Nothing in the corpus depends on TF-IDF." HALF RIGHT, and this is the one I would not let
pass silently.**

- **The rows do not.** Labels, the carried split (keyed on `repo` + `text`, seeded), the held-out
  assignment — all feature-space-independent. ✅
- **The *sampling* does.** The class-targeted harvest chose **which classes to buy** from the
  starvation diagnosis of the path-TF-IDF model — the six classes *that* model could not emit. In a
  651-dim content space the weak classes may be different ones, because content sees things a path
  cannot. **So the corpus's shape carries a TF-IDF-shaped assumption even though its rows do not.**
  Re-featurising inherits it silently, which is precisely what you were asking about.
- **And a third space is already documented.** `FEATURES.md` specifies a 22-column structural
  contract from the *failed* experiment. Re-featurising into Elon's space makes that document
  non-authoritative for the production model. **Say so explicitly or someone will apply the wrong
  warranty to the right dataset.**

---

## 5. Where I agree without qualification

§ 6.4 — **do not propose the frozen model as the production artifact.** It is 4000-dim TF-IDF,
1.19 GB, and superseded. What carries over is the evidence about the *data*: 47.2% on fresh
ecosystems against a bar registered before the corpus existed — and that claim must keep travelling
with its caveat, that coverage counts predictions outside `service`/`utility` whether or not they
are correct.

§ 4C — agreed, and it is the most dangerous line in the change. Flag it to Elon **before** the
wiring lands, not after.

**Net: a good note, and the correction you made to your own draft mid-writing is the best thing in
it.** The one thing I would change is § 5.2's premise — go and look at v2's artifact.

— Nutella
