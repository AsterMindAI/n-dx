# IMPL — Verifying the refit fingerprint, at a cost the ADR under-stated by 25×

- **Implements:** [`ADR-2026-09-23-jam-verify-the-refit-fingerprint.md`](../ADR/ADR-2026-09-23-jam-verify-the-refit-fingerprint.md)
- **Owner:** Jam (Team Nolan) · **Backlog:** `TN-J33`
- **Status:** **Proposed.** Phase 1 is free and needs only the lead's yes to touch the script.
- **Date:** 2026-09-23

---

## 0. ⚠️ The measurement that reshaped this plan

The ADR says verification costs "a few minutes". **That is wrong, and I found it writing this.**

Prediction is the expensive operation here, not fitting. One path scored through nine models is nine
4000→4096 matrix products in plain JavaScript. Derived from two runs that were actually timed, by
subtracting the nine-fit cost (~90 CPU-min) from each total:

| run | paths scored | implied cost per path |
|---|---:|---:|
| GUARD (160 files) | 160 | **3.75 s** |
| PRIMARY (553 + 250 + 81 + 169) | 1,053 | **4.33 s** |

**The probe set is the full 1,642-row train split.** At ~3.7 s/path that is **≈ 101 CPU-minutes** —
against a certification run of 100–160 CPU-minutes today. **Verification as the ADR describes it
adds ~78% to every run.**

That does not kill the decision; it kills "verify on every run, always, by default", which is what
the ADR implies. The plan below keeps the guarantee and makes the routine case cheap.

---

## Scope

**Touches:** `scripts/elm-coverage-check.mjs` (mine), `scripts/elm-freeze-model.mjs` (mine).
**Does not touch:** any corpus, any committed artifact, `packages/**`, anything of Nutella's.
**No LLM spend at any phase. No committed number changes.**

---

## The mechanism, verified at source

The freeze computes the fingerprint at `elm-freeze-model.mjs:219-222`:

```js
const votedProbe = voteLabels(perSeedProbe, cats);
const fingerprint = createHash("sha256")
  .update(votedProbe.map((p) => `${p.label}:${p.prob.toFixed(6)}`).join("|"))
  .digest("hex");
```

where `probe = rows.map((r) => docOf(r.text))` (`:193`) and `rows = corpus.train` (`:156`).

**The coverage script can already reproduce this exactly, and that is the whole reason Phase 1 is
small.** `loadFrozenTier()` returns `vote(paths)` (`elm-coverage-check.mjs:73-88`), and its
semantics match `voteLabels` line for line:

| | freeze `voteLabels` | coverage `vote` |
|---|---|---|
| vectorisation | `v.vectorize(docOf(text))` | `v.vectorize(docOf(p))` |
| tie-break | `n >` then `p >` | `n >` then `p >` |
| `prob` | `best.v.n / perSeedTop.length` | `best.t.n / models.length` |
| vectorizer fitted on | `corpus.train` docs, `vocabCap` | `c1.train` docs, `vocabCap` |

So the check is a hash over `tier.vote(c1.train.map(r => r.text))` — **order matters**, since the
digest joins on `"|"`, and `c1.train` order is the same on both sides.

---

## Steps

### Phase 1 — Verification against whatever the artifact carries *(free; needs the lead's yes)*

Add to `elm-coverage-check.mjs`:

- `import { createHash } from "node:crypto"` — currently absent (`:36-37` import only `node:fs`
  and the library).
- `verifyFingerprint(tier, mode)` returning `{ status, expected, actual, paths, seconds }` with
  `status` in `verified | mismatch | absent | skipped`.
- `--verify-fingerprint=full|sample|off`, **default `sample`** (see Phase 2), `full` for the
  authoritative check.
- **On `mismatch`: throw before any coverage line is printed.** Message names the four things that
  actually drift: library version, corpus sha256, node version, vocabCap/featureDim.
- On `absent`: print `fingerprint ABSENT — not verified` and continue, so v1-era artifacts stay
  runnable and the gap stays visible.
- Print the cost it just paid, so nobody is surprised by the 101 minutes.

**Test:** extend the existing `--selftest` (no model work) with a pure-function test of the digest
builder: same inputs → same digest; one flipped label → different digest; one `prob` changed in the
6th decimal → different digest. Watch each fail before the guard exists.

### Phase 2 — A cheap fingerprint worth checking every run *(free; changes future artifacts only)*

The 101-minute cost is inherent to the *recorded* fingerprint covering all 1,642 paths. So record a
second one over a fixed subset:

- In `elm-freeze-model.mjs`, alongside `refitFingerprint`, write
  `sampledFingerprint: { sha256, n: 200, selection: "seeded mulberry32(42) over the train split", paths: [...] }`.
- **The sampled path list is stored in the artifact**, so verification does not depend on
  reproducing a sampling rule.
- Cost at freeze: **~12 CPU-min**, and the freeze already pays ~101 min for the full probe.
- Cost at certification: **~12 CPU-min**, ~8% of a run rather than 78%.

⚠️ **200 paths is a judgement, not a derivation.** Drift from an RNG or library change would alter
nearly every prediction, so a 200-path sample detects it with overwhelming probability; a *subtle*
drift touching a handful of files could slip through. The full check remains the authority, and this
trade is stated rather than buried.

### Phase 3 — One authoritative verification of the current frozen model *(~101 CPU-min, no spend)*

`node --max-old-space-size=6144 scripts/elm-coverage-check.mjs --frozen=…-v3-classtargeted.json --verify-fingerprint=full --no-report`

Run once, commit the output. This converts the certified **47.2%** from
faithful-by-construction to **verified**, retroactively and permanently, without re-running
certification itself.

### Phase 4 — Make `sample` the default and say so in the warranty

Once artifacts carry `sampledFingerprint`, every certification verifies by default. `FEATURES.md`
and `ELM-CORPUS.md` state which mode produced each published number.

---

## Test strategy

**Before:** `--selftest` green, including the three new digest assertions, each watched red first.
**During Phase 3:** the run either prints `verified` with the matching hash, or throws. There is no
third outcome and no number is printed on failure.
**Regression:** the digest builder is a pure function over `{label, prob}[]`, so it is testable
without fitting anything — which is the only reason this has a real test at all.

---

## Rollback

Phase 1 and 2 are additive; revert the commit. **Phase 3 cannot be rolled back and does not need to
be** — it produces a log, changes no artifact. **If Phase 3 reports a mismatch, nothing is rolled
back either: that is a finding**, and it would mean every coverage number on this project needs
re-running against a re-frozen model. I consider that unlikely — determinism was verified at freeze
time and nothing changed in between — but it is the outcome the whole ADR exists to make visible,
and pretending otherwise would defeat it.

---

## Risk register

| risk | mitigation |
|---|---|
| **The 101-minute cost makes people pass `--verify-fingerprint=off`** | Phase 2 exists precisely for this. `off` must print a loud unverified banner. |
| A sampled fingerprint misses subtle drift | Stated above; `full` stays the authority and Phase 3 runs it once. |
| Mismatch fires at the end of a 2-hour job | Verification runs **before** scoring, not after — it is the first thing after the fits. |
| Existing artifacts lack `sampledFingerprint` | `absent` is a first-class status, not an error. |
| `--no-report` is a new flag on a script others run | It only suppresses output; the default path is unchanged. |

---

## Open questions

- **Is `throw` right?** If it fires after a 2-hour job, the pressure to add `--force` will be real.
  My view: throwing is correct and `--force` should not exist here, because the failure means the
  number is about a different model. Flagged for Nutella in the verification request.
- **200 paths**: keep, derive, or raise?
- **Should the shipped tier verify too?** Out of scope here; it is the case where a silent RNG
  change reaches users, and it needs the product ADR.
