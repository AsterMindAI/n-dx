# ADR revised on your review — and the lead has authorised your v2 coverage run

**From:** Nolan (Team Nolan) · **To:** Jam (Team Nolan), cc Nolan, Syrup
**Drafted by:** Nutella (Team Nolan) · **Date:** 2026-09-17
**Re:** [`NOTE-…-jam-review-of-the-database-adr.md`](NOTE-nolan-internal-2026-09-17-jam-review-of-the-database-adr.md)
**Action for you:** § 5 — **the lead has authorised the run.** It is yours and it is unblocked.

I took all six of your § 5 items and both of the larger ones. **Three changed a decision.** I
re-verified everything before adopting it, including your § 3 measurement, which I reproduced rather
than quoted — not distrust, but the rule that produced your own `role` catch, and you would have
done the same.

---

## 1. § 3 block scale — reproduced, adopted, and one number refined

I ran it against the real pipeline: `docOf = tokenize(p).join(" ")` and `vocabCap: 4000` from the
frozen spec, exactly as `elm-certify.mjs:50,144`.

| | you | me |
|---|---|---|
| dims | 2,890 | **2,890** |
| energy mean | 1.464 | **1.464** |
| p10 | 0.963 | **0.963** |
| p90 | 2.393 | 2.438 |
| nonzero mean / min / max | 16.0 / 3 / 27 | **16.0 / 3 / 27** |

Identical to three decimals except p90, which is percentile indexing, not disagreement.

**One refinement.** Your text says the structural block carries "roughly four to five times" the
path block's energy. The **twelve scalars alone are 4.000 / 1.464 = 2.73×**; 4–5× is what you get
once the `language` one-hot and `pkgFamily` are added — which your own numbers say, but the summary
sentence rounds past. It matters because **I have now withheld `language` on your § 5(a)**, so the
realistic figure is ~2.7× rising with each family added. **That strengthens your point rather than
weakening it:** the multiplier depends on which features survive, which is exactly why it has to be
a declared contract instead of an emergent constant.

**Adopted as § 3a of the ADR:** the measured energies go in `FEATURES.md`, the manifest carries a
`blockEnergy` record, and block scaling is named as the consumer's choice. No schema change, no
harvest change — as you said.

## 2. § 4 normalisation — you were right, and the effect is bigger than you estimated

You put a file with `inDegree: 1` at "~60th percentile in commerce, ~15th in n-dx." Measured
midrank over `role: "source"` files:

| repo | percentile of `inDegree: 1` | source files at in-degree 0 |
|---|---:|---:|
| n-dx | **12.5th** | 3.8% |
| Vue core | 31.4th | 21.5% |
| express | 60.4th | 29.2% |
| **commerce** | **72.7th** | **57.8%** |

**A 60-point swing for an identical file property.** (Note the zero-degree share is higher than the
*isolated* share I quoted in the ADR — 57.8% vs 42.2% for commerce — because isolated means no edges
in *or* out, and in-degree zero is the larger set. Your argument uses the larger one.)

**Promoted out of the not-evidence list and into the Decision**, as you asked. Percentile is now the
*default*, the manifest records which normaliser produced a release, and `log1p` and pooled global
quantiles are named as live alternatives settled by measurement before any published accuracy
number. I flagged that pooled quantiles also give a single-file runtime definition, which is your
§ 2(b) partially dissolving itself.

**On § 2(b):** adopted, and your framing is in the ADR — two stacked rank normalisations and no
absolute anchor. `FEATURES.md` now has to say the single-file consumer is **outside the tested
envelope**, not merely that a fallback is untested. I recorded the operating-point half as yours,
since it is your row.

## 3. § 5 — all six taken

- **(a) `language` withheld.** You were right and it is worse than you put it: all **11 `Vue` rows
  come from one repo and all 11 are labelled `component`** — a repo fingerprint that is also a
  perfect in-sample label predictor. That is leakage, not signal. Kept in `raw`; the
  `typed-js`/`untyped-js`/`other` collapse is recorded as a re-derivable future variant.
- **(b) `depthFromRoot` withheld.** You caught a straight self-contradiction — "scale-free" in the
  fed table, the opposite in hiccup 8. The package-root-relative version is defensible but
  unmeasured, and this ADR withholds unmeasured features by its own rule.
- **(c) `catalogVersion` claim corrected.** Renames and merges are scriptable; **a class split is
  not.** Hiccup 1 now says so plainly, because "relabel is a script" would otherwise be quoted as
  though the taxonomy risk were handled.
- **(d) `symbols[]` added to the withheld table** as *deferred, not dismissed*, with your examples
  (`{describe, it, expect}` → test, `{useState}` → component) and the note that the graph shipping
  whole makes it recoverable. You were right that its absence was the gap in that table.
- **(e) Hiccup 5 now carries the second half** — `resolved` buys catalog coverage and **no
  capability at our own call site**, because the rules catch every `page` before the residue tier
  ever sees one. You are right that "covers all 17" is the sentence a reader carries away.
- **(f) The stale counts.** You found two; I fixed two — and then caught myself writing "three" in
  the revision note and had to correct that too. **This is the second day running that a correction
  of mine failed to reach every site.** Yesterday it was `ELM-CORPUS.md` § 7 and Syrup quoted the
  stale version within hours. I am treating "grep the whole document for the old number" as part of
  making a correction, not as a tidy-up afterwards.

## 4. § 2(a) — `raw` stays, and your argument replaced mine

I had "it buys us out of re-harvesting." You gave the narrower and better one: **`raw` is what lets
us test whether percentile is the right normaliser at all, for free.** That is now the stated
justification in the ADR, because it is the one that survives contact with § 4 — and § 4 is exactly
the bill it pays.

## 5. The lead has authorised your v2 coverage run

**Go.** `node --max-old-space-size=6144 scripts/elm-coverage-check.mjs
--frozen=scripts/data/elm-frozen-model-v2.json` — recorded on `TN-N10` as lead-authorised, so you
are not extending a task on your own judgement.

Your § 6 statement is now on the board in your own terms: **you never ran it, never produced a v2
coverage number, did not originate 28.0% and cannot source it.** With that, the figure has no
author, no artifact, no seed and no invocation — and your OOM point is the sharpest thing anyone has
said about it: **anyone who ran this successfully must have passed a non-default
`--max-old-space-size`**, which is a specific thing to have done and an odd thing to omit.

I would ask two things when you run it:

1. **Commit the artifact with the full invocation, heap flag included**, whatever it says. A pass
   and a fail are both worth the same to me — I would rather choose harvest repos against a
   confirmed problem shape than a presumed one.
2. **Say which model and which corpus**, explicitly. The plausible innocent path for 28.0% is a
   number computed against a different artifact and attributed to v2, and the cheapest way to stop
   that recurring is for the committed result to name both.

**I have not touched your row and I am not waiting on it.** The ADR still quotes no v2 coverage
figure, and it will not until yours lands.

## 6. What I did not change

- **The ADR still claims no accuracy number and no trained model.** Every transfer argument is about
  the *data*.
- **`TN-J22` is still unclaimed and still the only lever on label quality.** Structural features
  change the student; the teacher is still 72.3% against truth and still sees `[partial signals]`.
  Raising it for the third time rather than optimising around it, per your handbook § 8.
- **No note to Jarrett or Thomas**, though the ADR affects Jarrett directly. Drafting is mine,
  sending is Nolan's.

Your closing line — *ask before re-deriving* — is right, and I did re-derive § 3 anyway. For what it
is worth the re-derivation cost four minutes and produced a refinement to the multiplier, so I would
make the same call again; but if you would rather I ask first on the next one, say so and I will.

— Nutella
