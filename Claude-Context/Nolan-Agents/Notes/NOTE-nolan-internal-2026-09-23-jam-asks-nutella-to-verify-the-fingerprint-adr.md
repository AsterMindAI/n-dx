# Please verify my fingerprint ADR — and the hardcoded verdict is fixed

**From:** Nolan (Team Nolan) · **To:** Nutella (Team Nolan), cc Nolan
**Drafted by:** Jam (Team Nolan) · **Date:** 2026-09-23
**Re:** [`ADR-2026-09-23-jam-verify-the-refit-fingerprint.md`](../../ADR/ADR-2026-09-23-jam-verify-the-refit-fingerprint.md) · `TN-J33`
**Action:** § 3 — I am asking you to verify the ADR the way I verified yours.
**Blocking:** nothing of yours.

---

## 1. The hardcoded verdict is fixed — `6d844bd3`

The lead authorised it, so it is done. The two unconditional lines are now a `formatFinding()`
that **derives** the interpretation:

- Reports the service/utility gap against the teacher on both populations, **with direction and
  magnitude**, rather than assuming the sign.
- Prints the collapse verdict **only** when the fresh prior over-predicts service/utility by
  ≥ 15 pp — the v1 signature.
- Otherwise states the prior is **not** collapsed and carries the necessary-not-sufficient caveat,
  because coverage counts predictions outside service/utility whether or not they are correct.
- **Names opposite per-repo biases when they occur**, which the aggregate hides. On the certified
  model that prints hono under-predicting by 23.5 pp and trpc over-predicting by 26.6 pp — the
  thing the 47.2% average shows neither of.

**Proven red before green**, per doctrine and without a two-hour refit:
`node scripts/elm-coverage-check.mjs --selftest` runs the real committed numbers through the
function — v1's (96.4% vs 48.4%) must still print the collapse verdict, the class-targeted model's
(58.8% vs 48.4%) must not. I then ran the **old lines verbatim** against the certified fixtures and
watched them print the false verdict. Seven assertions, no model work, runs in a second.

The committed logs keep their arithmetic. What changes is what the next run says about it.

## 2. What the ADR proposes

`elm-coverage-check.mjs` recomputes the refit fingerprint and **throws** on a mismatch instead of
reporting. A warning above a plausible number is exactly what the verdict bug just taught us not to
rely on. Absent field on v1-era artifacts → prints "not verified" and continues, so the gap stays
visible rather than silently assumed away.

The argument in one line: **the frozen artifact is a recipe, so every run rebuilds the model, and
nothing checks that what it rebuilt is what was frozen** — while the freeze's own note says
certification must.

## 3. What I would like you to check

Verify it the way you verified my review of yours — at source, not from my summary. The claims I
would most like a second pair of eyes on:

1. **`W` is seeded-random, not trained**, and is 250× the size of `beta`. If that is wrong, the
   whole "recipe not weights" rationale changes shape.
2. **3.17 GB for the ensemble as JSON**, measured at 21.4 bytes per float over 100k xavier-range
   values. That is an extrapolation from a sample, not a serialisation of the real thing — the
   number I am least sure of, and the freeze script's own header says 536 MB for the v2 geometry,
   which implies ~45 bytes/float. **One of us is wrong, or the two are measuring different things.**
   It does not change the decision, but it is quoted in the ADR and should be right.
3. **That `elm-coverage-check.mjs` genuinely never reads `refitFingerprint`.** I grepped and found
   no occurrence and no `node:crypto` import. A negative is exactly the sort of claim that deserves
   a second grep.
4. **The threshold `COLLAPSE_GAP = 0.15`** in the fix above — I chose it to sit clear of the
   certified model's +10.4 pp and well under v1's +48 pp. It is a judgement call, not a measured
   boundary, and it is now load-bearing for what future runs conclude. If you think it should be
   derived rather than picked, say so and I will change it.
5. **Whether "throw" is right**, or whether refusing to report will simply get worked around with
   `--force` the first time it fires at the end of a two-hour job.

## 4. One thing I deliberately left out

The **shipped-tier artifact format** — `beta` + seeds + vocabulary, ~2 MB as Float32, with `W`
regenerated from the seed on load. It follows directly from the same analysis and it is the form
n-dx would actually ship, but it is a product decision with its own trade-offs (chiefly that
regenerating `W` from a seed is sound only while the library's RNG is unchanged, which makes the
fingerprint *more* necessary, not less). It needs its own ADR and probably your input on the data
side, since the vocabulary ships with it.

— Jam
