# ADR — Verify the refit fingerprint before reporting any coverage number

- **Status:** **Proposed.** Needs the lead. **Nothing in here changes a number we already hold.**
- **Date:** 2026-09-23
- **Author:** Jam (Team Nolan)
- **Supersedes:** none. **Completes** the guard designed into
  [`ADR-2026-08-28-jam-implement-the-elm-tier.md`](ADR-2026-08-28-jam-implement-the-elm-tier.md)
  and built into `scripts/elm-freeze-model.mjs`, which has never been checked by anything.
- **Backlog item:** `TN-J33` (new)

---

## Context

### The frozen artifact is a recipe, not a model

`elm-frozen-model-v3-classtargeted.json` is **21.6 KB**. It holds the corpus path and hash, the
spec, nine seeds, the operating point and a fingerprint. It holds **no weights at all**. Every
certification run therefore *rebuilds* nine models from that recipe and scores what it built.

That is a deliberate and good design, and the reason it works is the shape of an ELM:

| | what it is | how obtained | size |
|---|---|---|---:|
| `W`, `b` | 4096 × 4000 random projection | **generated from the seed** — never trained | 16,384,000 numbers |
| `beta` | 4096 × 16 output layer | **solved for** — the expensive half | 65,536 numbers |

`W` is **250×** larger than `beta` and is pure seeded randomness (`randomMatrix`, xavier init off
the seeded RNG). Serialising the ensemble would cost **3.17 GB of JSON** — measured, at 21.4 bytes
per float — against 21.6 KB for the recipe. Storing the recipe is the right call.

### The cost of that choice is that reproducibility becomes load-bearing

If anything drifts between freeze and run — a library upgrade touching the RNG, a changed corpus
file, a different tokenizer — the rebuild produces **a different model**, scores it, and prints a
perfectly normal-looking number. No error, no warning, no way to tell from the output.

The freeze already anticipated this. It records a `refitFingerprint`: the ensemble's predictions
over all 1,642 training paths, hashed. Its own note says so:

> `"Certification must re-fit and match this before scoring anything."`

**Nothing checks it.** `scripts/elm-coverage-check.mjs` never reads the field. So every coverage
figure this project holds — the committed 28.0% baseline and the certified 47.2% alike — is
**faithful by construction rather than verified.** I believe they are right, because nothing changed
between freeze and run. Belief is not the standard this project has held itself to anywhere else.

### Why it matters more than it sounds

1. **This project's characteristic failure is a plausible number with no provenance.** `TN-J31`: two
   teachers, unrecorded, 19 days. `TN-N10`: a 28.0% figure with no artifact. The 5.9%→19.6%→38.0%
   baseline chase. A silently-different model is the same defect one level deeper, and it is the one
   remaining place where a wrong number would look exactly like a right one.
2. **Re-running is expensive.** Reproducing the nine frozen models costs **~1.5–2 hours of CPU**;
   the full freeze took **6.5 hours** (11 hours of wall clock). Detecting drift late means paying
   that twice, plus discarding whatever was published in between.
3. **It gets worse when the tier ships.** A product artifact cannot make users refit for two hours,
   so the shipping form is `beta` + seeds + vocabulary (**~2 MB as Float32**) with `W` regenerated
   from the seed on load. That is only sound **while the library's RNG is unchanged** — a
   dependency bump silently yields a different model on the user's machine. The fingerprint is the
   only mechanism that would catch it, and it would need to run there too.

---

## Decision

**`elm-coverage-check.mjs` recomputes the refit fingerprint and refuses to report any number on a
mismatch.**

```
1. Rebuild the ensemble from the frozen recipe, as today.
2. Score the frozen artifact's own probe set — the training paths — and hash the
   ensemble vote exactly as elm-freeze-model.mjs:220-222 does.
3. Compare with frozen.refitFingerprint.sha256.
     match    -> print "refit fingerprint verified: <hash>" and continue.
     mismatch -> THROW. Print both hashes and what to check. Report nothing.
4. Absent field (v1-era artifacts) -> print "fingerprint ABSENT - not verified"
   and continue, so old artifacts stay runnable and the gap stays visible.
```

**A mismatch is a hard stop, not a warning.** A warning above a number gets skimmed past; that is
the lesson of the hardcoded verdict fixed at `6d844bd3`, where correct arithmetic sat under a false
sentence and the sentence is what a reader took away.

**Cost:** the probe predictions are 1,642 rows through nine models — the same work the freeze
already does once, a few minutes, and it is arithmetic over models that have just been built
anyway. **No new LLM spend. No change to any committed number.**

---

## Alternatives considered

| option | why not |
|---|---|
| **Leave it unchecked** | Every future number keeps resting on "nothing changed", and the one check designed to prove it stays unused. The artifact's own text instructs otherwise. |
| **Warn instead of throwing** | A warning printed above a plausible number is exactly what the hardcoded verdict taught us not to rely on. |
| **Ship the weights and skip refitting** | 3.17 GB of JSON for the ensemble. Undiffable, unshippable, and it does not remove the need to know the weights are the right ones. |
| **Verify only in the certification script, not the shipped tier** | Acceptable *now* — the tier does not ship — but the shipped case is where a silent RNG change hurts users rather than us. Recorded so it is not forgotten. |
| **Verify by re-hashing the artifact file** | Detects edits to the file, not drift in what rebuilding it produces. It is precisely the rebuild that can differ. |

---

## Consequences

**Easier.** Every future coverage number carries a machine-checked statement that it scored the
frozen model. A library bump, a corpus edit or a tokenizer change becomes a loud failure instead of
a quiet number. The caveat currently attached by hand to every figure I publish disappears.

**Harder.** One more way for a run to fail, and it will fail loudly at the end of a two-hour job.
That is the right trade, but it means a mismatch must say *what to check* — library version, corpus
hash, node version — not merely that two hashes differ.

**What breaks.** Nothing committed. v1-era artifacts without the field keep running, with the gap
stated.

**Not in scope, deliberately:** the shipped-tier artifact format (`beta` + seeds + vocabulary) is a
product decision that needs its own ADR. This one covers certification only.

---

## Evidence

| claim | how measured |
|---|---|
| Frozen artifact is 21.6 KB and stores no weights | `models[]` holds `seed`, `config`, `weightShape` only |
| `W` is 4096 × 4000 = 16.38M numbers; `beta` is 65,536; ratio 250× | read from `weightShape` |
| Full ensemble as JSON = **3.17 GB**; `beta` only = 13 MB JSON / **2 MB Float32** | measured at 21.4 bytes per float over 100k xavier-range values |
| `W` is generated from the seed, not trained | `randomMatrix` / xavier init off the seeded RNG in `astermind.umd.js` |
| The freeze records the fingerprint and instructs certification to check it | `elm-freeze-model.mjs:220-222`, `:266` |
| `elm-coverage-check.mjs` never reads `refitFingerprint` | `grep` — no occurrence, and `node:crypto` is not imported |
| Reproducing the nine models ≈ 1.5–2 h CPU; full freeze 6.5 h CPU / 11 h wall | `elm-freeze-v3-classtargeted.log` and the certification run timings |
| Determinism itself holds today | the freeze refits seed 42 and requires identical weights; it passed |

**What this ADR does NOT claim:** that any existing number is wrong. Determinism was verified at
freeze time and nothing changed between freeze and certification. The claim is narrower and
sufficient: **we cannot presently prove it from the artifacts, and the mechanism to do so was built
and left unused.**
