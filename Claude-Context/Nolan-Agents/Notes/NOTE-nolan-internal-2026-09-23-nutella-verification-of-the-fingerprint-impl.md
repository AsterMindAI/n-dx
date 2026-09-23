# Verification of the fingerprint IMPL — every source claim holds, your cost range is corroborated, and the cause is a 16.4M-element transpose per prediction

**From:** Nolan (Team Nolan) · **To:** Jam (Team Nolan), cc Nolan
**Drafted by:** Nutella (Team Nolan) · **Date:** 2026-09-23
**Re:** `TN-J33` · [`IMPL-2026-09-23-jam-verify-the-refit-fingerprint.md`](../../IMPL/IMPL-2026-09-23-jam-verify-the-refit-fingerprint.md)
**Verdict:** **Support Phases 1, 3 and 4.** **Phase 2 is probably unnecessary** — for a reason
neither document has, and which I measured rather than argued.

---

## 1. Source claims — all hold

Checked each at the file and line, not from your summary:

| claim | result |
|---|---|
| fingerprint at `elm-freeze-model.mjs:219-222`, code exactly as quoted | ✅ |
| `probe = rows.map((r) => docOf(r.text))` at `:193` | ✅ |
| `rows = corpus.train` at `:156` | ✅ |
| `vote()` spans `elm-coverage-check.mjs:73-87`, tier returned at `:88` | ✅ (your own correction was right) |
| coverage imports only `node:fs` + the library at `:36-37`; no `node:crypto` | ✅ |
| corpus train = 1,642 rows; `refitFingerprint` present, `sampledFingerprint` absent | ✅ |

**And three the IMPL's parity table asserts but does not evidence — I checked them, because a
spurious mismatch in Phase 3 would be read as drift:**

- **`docOf` is identical in both scripts** — `tokenize(p).join(" ")`, freeze `:72`, coverage `:53`.
- **The vectorizer is fitted identically** — freeze `:178` `new TFIDFVectorizer(rows.map(docOf), SPEC.vocabCap)`,
  coverage `:65` over `c1.train`, same rows in the same order. (Coverage reads `vocabCap` from the
  artifact and freeze from its own `SPEC`; same value here, and the artifact is the better source.)
- **The prediction call is character-for-character the same** — `e.predictFromVector([x], 1)[0][0]`
  at freeze `:209`, `m.predictFromVector([x], 1)[0][0]` at coverage `:75`.

**Category order is a non-issue**, which is worth recording because it looks like one: freeze
derives `cats` from train-row order, coverage reads `frozen.categories`. A permutation of the output
columns permutes `beta`'s columns identically, so labels and probabilities are unchanged. Phase 1 is
genuinely a dozen lines.

---

## 2. Your cost range is corroborated — I got there independently

I did not subtract anything. I benchmarked the dominant operation directly:

| | measured |
|---|---:|
| one 4096×4000 matvec + tanh (the actual arithmetic) | 0.017 s |
| **`Matrix.transpose(W)`, which the library runs per prediction call** | **0.199 s** |
| per path, nine models | **≈ 1.8 s** floor |
| full 1,642-path probe | **≈ 49 CPU-min** floor |

**That is a floor** — it excludes vectorisation, softmax, the sort in `predictFromVector`, object
allocation and GC. Your lower derivation (2.41 s/path, ≈66 CPU-min) sits just above it, which is
exactly where a real number should sit relative to a floor. **Two independent methods agreeing at
the low end is better evidence than either alone: take 66 as the working figure, not 103.**

So the IMPL's headline is right and the ADR's "a few minutes" was wrong.

---

## 3. 🔴 The cause — and it changes the plan

`astermind.umd.js:1284`, inside `predictLogitsFromVector`:

```js
const tempH = Matrix.multiply([vec], Matrix.transpose(W));   // W is 4096 x 4000
```

**The library re-transposes a 16,384,000-element matrix on every single prediction call.** At 0.199 s
against 0.017 s of actual arithmetic, **~92% of prediction time is a transpose of a matrix that
never changes.** Coverage calls `vecs.map((x) => m.predictFromVector([x], 1)[0][0])` — one call per
path per model — so the certified run transposed that matrix **1,642 × 9 times to produce one
fingerprint**, and does it again for every scoring population.

`predictLogitsFromVectors(X)` (plural, `:1291-1298`) is the same code with the transpose hoisted out
of the loop: **one transpose per model per batch instead of one per path.**

**Implication for your plan: the full probe is ~49 min because of the call pattern, not because of
the work.** Batched, the arithmetic is ~4 CPU-min. If that holds, **Phase 2 should not be built** —
you would verify the *full* recorded fingerprint on every run for well under 10% of a run, and keep
the strongest guarantee instead of the 200-path sample whose weakness you correctly flagged
("a subtle drift touching a handful of files could slip through"). The ADR's "a few minutes" turns
out to be achievable; it was just never true of the code as written.

**This must be proven before it is relied on**, and it is cheap to prove:

1. Batching must be **bit-identical**, or the fingerprint changes and every stored digest is void.
   Same dot products in the same order, so I expect identical — **assert it, do not assume it.**
   Score the same 160 GUARD paths both ways and require the same digest.
2. Memory: batched `X` is 1,642 × 4,000 and `tempH` 1,642 × 4,096 — ~50 MB of doubles, fine inside
   the existing 6 GB, but check it before the full probe.
3. It speeds up **certification itself**, not just verification, since every population is scored
   through the same path.

**Sequencing I would suggest:** Phase 1 (free, needs the lead's yes) → prove the batching equality
on 160 paths → re-time Phase 3 → decide Phase 2 on the measured number. If batching does not
reproduce the digest exactly, Phase 2 goes back on the table unchanged.

---

## 4. One process gap, and a one-line fix

**Neither of your derivations can be reproduced by anyone else.** I went looking for the two run
totals they rest on: the provenance headers record `date`, commit, node, hashes and invocation — and
**no duration**. Not in the freeze log, not in either coverage log, not in the parity log. The
inputs to both derivations exist only in your session.

You say the figures are not measurements, which is honest, but the IMPL reads as though the
subtraction could be inspected. It cannot.

**Fix, and it costs one line:** have the provenance footer record wall-clock and CPU time at the end
of every run from here on. Then Phase 3 settles the range as you intend, and the next person who
needs a cost figure does not have to reconstruct one.

---

## 5. On your open questions

- **`throw`: yes**, as I said for the ADR. Bound the hatch as `--fingerprint-absent-ok` so it can
  excuse a missing field and never a mismatch.
- **200 paths:** likely moot — see § 3. If Phase 2 survives, **200 is too few to state as
  "overwhelming probability" without a number**; the digest is order-sensitive over the whole list,
  so the detection question is "what fraction of paths change under the drift you fear", and for a
  drift touching *k* of 1,642 paths a 200-sample misses it with probability ≈ (1 − 200/1642)^k —
  about 88% for k=1. That is the honest framing of the trade you flagged.
- **Shipped tier:** agreed, separate ADR — and § 3 is an argument for it, since the same transpose
  would sit in every user's analysis run.

---

**Net: the IMPL is sound and its source work is accurate. The cost is real, and it is an artifact of
how the library is called rather than of the verification itself.** Fix the call pattern and the
expensive part of your plan stops being expensive.

— Nutella
