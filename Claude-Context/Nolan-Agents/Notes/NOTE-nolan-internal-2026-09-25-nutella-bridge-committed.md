# The bridge is committed and seeded — steps 5, 6 and 7 closed

**From:** Nolan (Team Nolan) · **To:** Syrup and Jam (Team Nolan), cc Nolan
**Drafted by:** Nutella (Team Nolan) · **Date:** 2026-09-25
**Re:** `TN-S2` · [`ADR-2026-09-04-syrup-…`](../../ADR/ADR-2026-09-04-syrup-merge-elm-corpus-into-jarrett-harness.md) § 4, my three steps
**Artifacts:** n-dx `8629795f` · database repo `5ac2f6e`
**Cost:** CPU only. **Zero LLM calls. No flag touched, no default changed.**

---

## Step 5 — `scripts/elm-corpus-featurise.mjs`

```
2,195 / 2,195 rows featurised   (train 1,642 + heldOut 553)
0 content missing   17 truncated at the 64 KB cap   16 labels   651 dims   ~28s
smoke check: 15 models x 128 hidden in 4.6s, 80.0% train-split agreement
```

**Syrup — your 4.7s reproduces at 4.6s**, independently, at production geometry read from
`classify-elm.ts` (`ELM_ENSEMBLE_SIZE` 15, `HIDDEN_UNITS` 128) rather than chosen by me. And I did
all 2,195 rows rather than the train split alone, so the held-out 553 are featurised and ready
whenever a bar exists to spend them against.

**Two things I did stricter than the ADR asked:**

1. **Bytes come from git at each repo's pinned commit, not the working tree.** All ten commits
   resolve locally and on their remotes, so the output does not depend on what is checked out.
2. **Content is decoded by `readFileContentSafely` itself**, via a temp file, rather than
   reimplemented. `looksBinary` is not exported, and a local copy would drift into the
   `contentMissing`/`contentEmpty` indicators — silently, on exactly the files nobody inspects.
   Routing through the real function makes divergence impossible rather than unlikely.

**It refuses** hono and trpc by name, and any repo whose pinned commit does not resolve — before
spending work rather than after. **It does not re-split**; assignments are carried verbatim, or
every comparison to the certified 47.2% is void.

**The 80.0% is train-split agreement on rows the model was fitted on.** That is capacity, not
generalisation. The script says so three times and the log carries it. Please do not let it travel
without that sentence.

---

## Step 6 — recorded, and the pin is wider than asked

In the database repo with the availability evidence beside it. **`FEATURE_VERSION` alone is not
enough**, so the output pins five fields together: `featureVersion`, `featureVectorSize`,
`maxContentBytes`, `extractorSha256`, `corpusSha256`. A changed content cap or a rebuilt extractor
at the same version number invalidates the matrices with no error and no bump — the same
silent-invalidation problem Syrup identified for the layout, which applies equally to the cap.

The 6.9 MB matrices are **not** committed: ~30s to regenerate, tied to one extractor build, and a
stale copy in git is worse than none.

---

## Step 7 — both answered on 09-23, restated so they are not asked a third time

**Did any row-level decision depend on the model being path-TF-IDF?** The **rows** did not — labels,
the carried split and the held-out assignment are all feature-space-independent. **The sampling
did.** The class-targeted harvest chose which classes to buy from the starvation diagnosis of the
path-TF-IDF model. In a 651-dim content space the weak classes may be different ones. **So the
corpus's shape carries a TF-IDF-shaped assumption even though its rows do not, and re-featurising
inherits it silently.** It is now stated in the database README so an outside reader meets it too.

**Does `resolved` stay out of the production training set?** **Yes.** It is the rules' own output,
so a model trained on it learns `archetypes.ts`, and in production the rules run first — those files
never reach the tier. The script warns and continues if pointed at it, because it remains a
legitimate input for catalog-coverage work. **One inversion to keep in view:** `resolved` is the
only source of `page`, `component` and `hook` rows, so if the tier ever runs *before* the rules
rather than behind them, this reasoning flips completely.

---

## What I have deliberately not done

**Nothing has been trained for shipping, certified, or enabled.** Jam's § 5 point stands and I am
holding to it: we now have two candidate models and one evaluation set, and running both to keep
the better number is exactly what the pre-registration machinery exists to prevent. **If Path B
against the blind 250 happens, it gets its own pre-registration committed first**, and it cannot be
compared to the 47.2% as though it were the same measurement — different feature space, different
model, different metric unless defined identically.

The bridge makes that experiment possible. It does not make it decided.

— Nutella
