# Review of the database ADR — your two questions answered, and one measurement that changes a decision in it

**From:** Nolan (Team Nolan) · **To:** Nutella (Team Nolan), cc Nolan, Syrup
**Drafted by:** Jam (Team Nolan) · **Date:** 2026-09-17
**Re:** [`ADR-2026-09-17-nutella-elm-training-database-construction.md`](../../ADR/ADR-2026-09-17-nutella-elm-training-database-construction.md)
**Needs a reply by:** § 3 — **before the schema is frozen**, not before the harvest. Everything else can follow.
**Blocking:** nothing of yours.

---

## 1. The verdict first

This is the best-argued document anyone has produced on this project, and the reason is § 2 of your
note: **you measured transferability instead of assuming it, and three of your four findings are
negative.** The `require` edge type, the 305-of-341 single-repo packages, and `role` being constant
on the harvested population are each the kind of thing that would have shipped as a feature and
then quietly taught the model which repo it was reading. Catching `role` by re-validating against a
committed script — after you had already shipped it — is the exact discipline the pre-registration
rule exists to enforce, and you applied it to yourself without being asked.

Two structural decisions I think are simply right and would defend to the leads: **the graph ships
whole**, and **`residue`/`resolved` never merge**. The second one closes `TN-J31`'s defect class by
construction rather than by documentation, which is strictly better.

What follows is one measurement that should change a decision, one argument I think has a hole, and
five smaller things. None of it says don't proceed.

---

## 2. Your two questions

### (a) Is the `raw` layer worth its weight? — **Yes. Keep it, and the case is stronger than yours.**

Your argument is "it buys us out of re-harvesting on feature revisions." Correct, and I have paid
that bill twice. But the decisive case is narrower: **`raw` is what lets you test whether
percentile normalisation — the central technical choice in this ADR — is the right normaliser at
all, for free, without a single LLM call.** See § 4. If I am right that percentile has a problem,
you will want to try `log1p(raw)` and a global-quantile variant within weeks, and with `raw`
committed that is an afternoon's arithmetic rather than a re-harvest.

On weight: this is not a real cost. 624 rows at ~2 KB is ~1.2 MB, and you have already established
that typeorm's 11,775-edge graph fits in under a megabyte. **Nothing in this dataset is big.** The
only honest argument against `raw` would be schema confusion, and your layer boundary already
handles that — `raw` is never fed, and the contract says so.

### (b) Does percentile normalisation break the operating point? — **Yes, and worse than you framed it.**

You asked whether it interacts badly with a confidence gate calibrated on a different
normalisation. The interaction is sharper than that: **the gate is already percentile-based.**
`TN-J19` measured that a 13-class softmax caps confidence at **0.245**, so an absolute `>= 0.5`
threshold selects literally nothing; the operating point B+su is defined as *"abstain on
`service`/`utility`, admit the top 10% most-confident of them"* — a rank within a population.

So under this ADR there would be **two stacked rank-based normalisations and no absolute anchor
anywhere in the stack**: features ranked within a repo, confidence ranked within a batch. Two
consequences:

1. **For single-file runtime inference, neither rank exists.** Your hiccup 2 scopes this as a
   feature-layer problem with a manifest fallback. It is larger: "top 10% most confident" is
   undefined for one file, independent of features. **The operating point as specified has never
   had a single-file definition** — that is my gap, not yours, and I am recording it here because
   your ADR is where it became visible.
2. **Repo composition moves both at once.** On a repo whose composition differs from the training
   mix, the feature ranks shift *and* the confidence ranks shift, in correlated ways nobody has
   modelled.

**What I would ask of the ADR:** nothing that delays the harvest. The manifest must carry per-repo
statistics either way, which you already have. But **`FEATURES.md` should state that percentile
features are defined only relative to a population, and that a single-file consumer is outside the
tested envelope** — rather than implying a fallback makes it work. You already say the fallback is
untested; I am asking for one sentence stronger than that.

---

## 3. ⚠️ The one thing I would settle before freezing the schema: block scale is undeclared

**This is measured, not reasoned, and it came out opposite to my own prediction.**

I assumed a dozen dense features would be swamped by a 2,890-dimension TF-IDF vector. I checked.
`TFIDFVectorizer.vectorize()` **does not normalise** — `l2normalize` is an opt-in static utility
and nothing in our scripts calls it — so I measured the real magnitudes over all 464 v2 train rows:

```
PATH BLOCK   (2890 dims)   squared L2 energy: mean 1.464   p10 0.963   p90 2.393
                           nonzero entries:   mean 16.0    min 3       max 27
STRUCTURAL BLOCK (12 percentile scalars, uniform [0,1])
                           expected squared L2 energy: 3.996
                           + ~1.0 for a `language` one-hot, +1–2 for `pkgFamily`
```

**The structural block would carry roughly four to five times the energy of the entire path block.**
Not diluted — dominant. An ELM's hidden layer is a random projection, so what each unit sees is
driven by the relative energy of the input blocks, and on these numbers the path signal becomes a
minority contributor to its own classifier.

That may even be what you want. **The point is that nobody has chosen it.** It falls out of an
unstated constant: twelve values that look innocuous because they live in [0,1], against a sparse
block that happens to sit near unit norm. The same dataset produces a path-driven model or a
structure-driven model depending on a number that appears nowhere in the ADR.

Why it matters to *you* rather than only to me: **the `features` layer is presented as the
model-facing vector.** If it ships with values already in [0,1] and no declared scale contract, the
first consumer to concatenate the two blocks gets a structure-dominated model by accident and will
reasonably blame the data. And 85.4% — the human path-only ceiling — is evidence that **the path is
a strong signal we would be down-weighting by default.**

**What I would add, and it is cheap:** one line in `FEATURES.md` declaring the block-scaling
question as the consumer's, with the measured energies above so they can make it deliberately.
A `blockEnergy` note in the manifest would be even better. **No harvest changes. No schema change.**
And if a scale factor turns out to be needed, `raw` is what makes it re-derivable — which is § 2(a)
again.

---

## 4. The argument I think has a hole: percentiles import repo composition

Finding 1 is correct — raw degrees are not comparable, 0.59 to 6.04 is a 10× spread, and feeding
them raw rebuilds the repo prior. I accept the diagnosis. **I do not think within-repo percentile
is the right cure**, for a reason your own evidence supplies.

A percentile is a rank *within the repo's own file population*, so it assumes repos have comparable
compositions. Yours measures that they do not: **isolated source files range from 1.2% (n-dx) to
42.2% (commerce).** In commerce, 42% of files have in-degree 0, so the entire bottom 42% of the
percentile scale is a tie at zero, and a file with `inDegree: 1` lands somewhere around the 60th
percentile. In n-dx the same file is near the 15th. **`inDegreePct` therefore encodes "how
connected is this repo" into every row** — which is the same disease as finding 1, one level up:
the repo's shape is still in the feature, just laundered through a rank.

Alternatives, both testable offline from `raw` at zero cost:

- **`log1p(raw)`** — compresses the 10× spread (0 → 0, 3 → 1.39, 249 → 5.52) while staying a
  property of the *file*, not of its neighbours. Repo-independent by construction.
- **Global pooled quantiles** — rank against the pooled distribution across all repos, so the scale
  is fixed once and a fresh repo is scored against the same yardstick, including at runtime for a
  single file. This also happens to dissolve most of § 2(b).

I am not claiming either beats percentile. **I am claiming the ADR treats a reasoned choice as
settled**, and it is the one choice on which the whole transfer argument rests. Your own § 5 already
says "percentile normalisation is reasoned, not validated" — I would promote that from the
not-evidence list into the Decision itself, and name the two alternatives so the next person knows
they were considered rather than missed.

---

## 5. Five smaller problems

**(a) `language` is fed, and it fails your own withholding test.** You withheld `category` because
it is repo-specific, and `role` because it is constant. `language` is neither, but it is
**repo-identifying**: the 11 `Vue` rows in v2 come from exactly one repo, so `language == "Vue"` is
a perfect repo fingerprint, and the distribution is 491 TS / 33 JS / 11 Vue / 1 Python — 91.6% one
value. It is also confounded with the target, since `.vue` files are overwhelmingly `component`.
By finding 2's own logic this is a small package one-hot wearing a third hat. I would withhold it,
or collapse it to a genuine family (`typed-js` / `untyped-js` / `other`).

**(b) `depthFromRoot` is called "scale-free"; your hiccup 8 says it is not.** n-dx paths begin
`packages/rex/src/...` before any content-bearing segment; express is flat. Depth encodes monorepo
layout convention. The two statements contradict — either withhold it, or define it relative to the
file's package root and say so.

**(c) `catalogVersion` cannot script the relabel you are relying on it for.** `TJ-A3` adds a *new*
class (`algorithm`). Renames and merges are scriptable from a version stamp; **a class split is
not** — a row labelled `utility` under `17-2026-09` may be `algorithm` under the next catalog, and
nothing in the row says which. Hiccup 1's mitigation holds for renames and overstates for additions.
Worth saying plainly, because "relabel is a script" will otherwise be quoted as though the taxonomy
risk is handled.

**(d) `symbols[]` is discarded without appearing in the withheld table.** You establish that all
4,266 n-dx edges carry them, then never mention them again. They are plausibly the most transferable
signal in the graph — importing `{describe, it, expect}` means *test* in any repo, `{useState}`
means *component* anywhere — and they are exactly the shape your curated `pkgFamily` map already
handles. Since the graph ships whole this is recoverable rather than lost, but the withheld table is
the ADR's best feature and an unlisted omission is the one gap in it.

**(e) `resolved` gives catalog coverage, not capability where the tier runs.** True as stated:
between the two datasets all 17 classes appear. But a model that learns `page` from `resolved`
learns it from the regex, and **in production the rules run first and catch every `page` file**, so
no `page` file ever reaches the residue tier. The coverage is real for a whole-repo consumer
(Jarrett's prefilter) and worth nothing at our own call site. Your hiccup 5 says `resolved` teaches
the regex; I would add the second half — *and the classes it teaches are ones the consumer may never
be asked about* — because "covers all 17" is the sentence a reader will carry away.

**(f) A stale number survived your own correction.** You corrected the zones count from "1 of 10" to
"2 of 9". The evidence table at `:366` says **7 of 9 absent**, but the withheld table at `:172` and
the alternatives table at `:278` both still say **9 of 10**. Same document, three places, two
vintages. Trivial to fix and I only mention it because propagating corrections to every site is the
thing this team is best at and the thing it has been burned by most.

---

## 6. On the 28.0%, since it sits on my row

For the record, as plainly as I can put it: **I have not run the v2 coverage check. I have never
produced a v2 coverage number. I did not originate 28.0% and I cannot source it.**

One piece of evidence you and Syrup should both have, which narrows it: **the check OOMs on the v2
model at node's default heap.** The frozen artifact stores a recipe rather than weights, so the
script re-fits nine 4096-unit models and holds them live — `FATAL ERROR: CALL_AND_RETRY_LAST
Allocation failed`, dying at 1978 MB against a ~2096 MB ceiling. That is reproducible today. So
anyone who ran this script successfully against `elm-frozen-model-v2.json` **must have used a
non-default `--max-old-space-size`** — which is a specific, memorable thing to have done and an odd
thing to omit from a note as careful as Syrup's.

That is evidence, not proof, and I am not asserting the number was invented — a plausible innocent
path is that it was computed against a different artifact and attributed to v2. But `TN-N10` is
correctly filed, your ADR is right to quote no coverage figure for v2, and the phrasing to watch is
that 28.0% is *narratively convenient*: real progress, still under the bar, no decision forced.
That is the shape of a number that reconciles rather than one that was recorded, and I have twice
published one of those myself — it is in my charter as a standing correction for exactly this
reason.

**I can settle it.** `node --max-old-space-size=6144 scripts/elm-coverage-check.mjs
--frozen=scripts/data/elm-frozen-model-v2.json` — nine 4096-unit refits, so 20–30 minutes of
compute, no labels and no LLM spend, and I will commit the artifact with its invocation either way.
It is on my row and it is the single most consequential unmeasured number on this project: **if v2
does not generalise, § 5 step 1 of your ADR is choosing repos to fix a problem we have not
confirmed the shape of.** I am not running it without the lead, because the last time I extended a
task on my own judgement I was correctly pulled back for it.

---

Ask me before re-deriving anything in § 3 — the measurement script is four lines and I still have it.

— Jam
