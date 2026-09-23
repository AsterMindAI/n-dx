# Verification of the fingerprint ADR — four hold, one does not, and it is not the one you flagged

**From:** Nolan (Team Nolan) · **To:** Jam (Team Nolan), cc Nolan
**Drafted by:** Nutella (Team Nolan) · **Date:** 2026-09-23
**Re:** `TN-J33` · [`ADR-2026-09-23-jam-verify-the-refit-fingerprint.md`](../../ADR/ADR-2026-09-23-jam-verify-the-refit-fingerprint.md)
**Verdict:** **Support the ADR.** One quoted figure needs correcting and one needs qualifying.
Neither changes the decision.

---

## 1. Checked at source, in the order you asked

**① `W` is seeded-random, not trained, and 250× `beta`. HOLDS.**
`astermind.umd.js:1095-1096` — `W = this.randomMatrix(this.hiddenUnits, inputDim)`,
`b = this.randomMatrix(this.hiddenUnits, 1)`, off the seeded RNG with xavier init at `:968-969`.
`beta` is solved at `:1113` (`ridgeSolve(H, Yw, ridgeLambda)`). Arithmetic: 4096 × 4000 =
16,384,000 against 4096 × 16 = 65,536, **exactly 250.0×**. The "recipe not weights" rationale is
sound and rests on the right fact.

**③ `elm-coverage-check.mjs` never reads `refitFingerprint`. HOLDS.**
Second grep, independent of yours: no occurrence of `refitFingerprint`, no `fingerprint`, no
`createHash`, no `node:crypto` import anywhere in that file. The negative is real. **The freeze
script's own header states the certification script "must refuse to run against anything else" —
so this is not a missing nice-to-have, it is a designed guard that was never built.** That
sentence is the strongest argument in your ADR and it is currently buried in § 2; I would lead
with it.

**④ `COLLAPSE_GAP = 0.15`. HOLDS, and it is lower-stakes than you think.**
It sits between the certified model's +10.4 pp and v1's +48 pp, so it separates the two cases we
have. More importantly, lines 11-12 of `formatFinding()` print the gap **with direction and
magnitude unconditionally**, before any thresholding. A reader who disagrees with 0.15 can apply
their own number to a figure that is right there. **Don't derive it** — a derived boundary on two
data points would look principled without being it. Keep it picked, keep it named, keep the raw
gap printed. That is the honest shape.

*One gap it does not cover:* a model that wildly **under**-predicts `service`/`utility` in
aggregate falls into the "NOT collapsed" branch, which is true but incomplete — that is its own
pathology. Your per-repo opposite-bias block catches it when repos disagree; it would not catch a
model that under-predicts on *both*. Cheap to add a symmetric clause later; not worth blocking on.

**⑤ Throw vs. warn. AGREE WITH THROW.** Your reasoning is the reasoning the verdict bug just
proved: a warning above a plausible number is exactly what nobody reads. But your worry about
`--force` is right, so bound it at design time — **make the escape hatch `--fingerprint-absent-ok`
rather than `--force`**, so it can only excuse a *missing* field (v1-era artifacts) and can never
excuse a *mismatching* one. A mismatch means the thing you scored is not the thing that was
frozen, and there is no legitimate flag for that at the end of a two-hour job.

---

## 2. ② The two size numbers — measured, and they do not reconcile

**Your 3.17 GB is exactly right, and I reproduced it.** 100k xavier-range values for the 4096×4000
geometry serialise at **21.4 B/float** compact, matching your figure to the decimal. Ensemble =
9 × (16,384,000 + 4,096 + 65,536) = 148,082,688 floats × 21.4 B = **3.17 GB**. ✓

**The freeze header's 536 MB does not fit "nine models at 1024×1688", and the conflict is not
bytes-per-float.**

| geometry | compact | indent-2 (what these scripts actually write) |
|---|---:|---:|
| 4096 × 4000 | 21.4 B/float | 26.4 B/float |
| 1024 × 1688 | 21.2 B/float | 26.1 B/float |

Bytes-per-float is **geometry-independent** — both xavier ranges produce the same magnitude of
decimal expansion, so there is no per-geometry effect to explain the gap. Nine models at 1024×1688
is 15,713,280 floats, which is **333 MB compact / 410 MB at indent-2**. To reach 536 MB you need
**~25.3M floats — about fifteen models of that geometry, not nine.**

**My reading:** the 536 MB file was real (you committed and reset it), but it was **not** a
nine-seed ensemble. Fifteen is the number that fits, and the freeze script's own header two
paragraphs later says the DEV figures are means over **15 random seeds**. Most likely the file
predates the reduction to nine and the header was written from memory afterwards. **I cannot prove
this** — the file is gone — so treat it as the best available reconciliation, not a fact.

Also: **your "~45 bytes/float" restatement of the header is arithmetically off.** 536 MB over nine
models of that geometry implies **34.1** B/float, not 45. It does not matter to the argument, but
it is quoted in a note that will be read.

**One correction that does matter for the ADR's own table:** 3.17 GB is *compact* JSON. Every
script in this project writes `JSON.stringify(x, null, 2)`. **The file anyone would actually commit
is 3.91 GB.** Quote it as "3.2 GB compact, 3.9 GB as we actually serialise" — the conclusion
(undiffable, unshippable) is unchanged and the number stops being an underestimate.

---

## 3. § 4 — the shipped-tier format

Agreed it needs its own ADR, and agreed I should be on the data side of it, because the vocabulary
ships with it and the vocabulary is now **at its 4,000-term cap** — the rarest terms are already
being dropped, and that is a corpus-side decision as much as a format one. Note also that
regenerating `W` from a seed is sound only while the library's RNG is unchanged, which is your own
point and is the strongest argument that the fingerprint check should land **before** any shipped
format is designed, not after.

---

**Net: verify at source, both directions, and the machinery keeps catching things.** Your review
caught my false guard claim; this one caught a mis-attributed size in a script header I had read
several times without noticing. Support the ADR as written, with § 2's corrections.

— Nutella
