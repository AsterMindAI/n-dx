# The GUARD is not comparable across corpus versions — needed before Phase 4, not Phase 3

**From:** Nolan (Team Nolan) · **To:** Nutella (Team Nolan), cc Nolan
**Drafted by:** Jam (Team Nolan) · **Date:** 2026-09-21
**Re:** your living run log, entry 2026-09-21 (a) · `TN-N20` Phases 4–6
**Timing:** **Your current spend is safe. Keep going.** This bites at Phase 4, when the corpus is
split — not at Phase 3.
**Blocking:** nothing right now. One decision needed before you run `elm-corpus-build.mjs`.

---

## 0. Your § 3 crossed with my answer

I answered it an hour before your note landed —
[`NOTE-…-jam-to-nutella-certification-seam.md`](NOTE-nolan-internal-2026-09-21-jam-to-nutella-certification-seam.md),
commit `16f32443`. Short version: **I run it.** Also in there: the freeze question (your IMPL
Phase 5 has you doing it, which is fine, but it stamps teacher mix and fold-seed reduction into the
artifact I certify against, so let us have it be explicit rather than inferred), and **one question
still open — may I add the refit-fingerprint check to `elm-coverage-check.mjs`?** I built it once
and reverted it as scope creep, so I will not touch that file again without a yes.

---

## 1. ⚠️ The GUARD compares two different populations

`GUARD: coverage_trained_on >= 0.318` is derived from v2's **33.8%, measured on v2's 160 held-out
rows**. Phase 4 builds corpus v3 with a fresh `stratifiedSplit`, and I read the implementation
(`elm-corpus-build.mjs:359-373`): it takes `rows` and splits them. **There is no parameter for
prior assignments — it cannot preserve them.** Adding rows to a label group changes that group's
length, so both the shuffle order and the `Math.round(len × 0.25)` boundary move.

So the IMPL says **"Do not re-split"** at `:197` while the command directly beneath it does exactly
that. Three consequences, in order of how much they matter:

**(a) The GUARD's threshold does not belong to the population it will be applied to.** v3's
held-out is a different set of files, of a different size, with a different class mix.

**(b) The bias runs toward passing.** The harvest adds *only* minority-class rows, by construction.
Stratification puts a quarter of them in held-out. Coverage counts predictions **outside**
`service`/`utility` — so a held-out set with proportionally more minority-class files scores higher
**mechanically**, whether or not the model improved. A guard that gets easier as the experiment
proceeds is not a guard.

**(c) Rows held-out in v2 become training rows in v3.** That is precisely what "do not re-split"
exists to prevent, and it makes every held-out figure in `ELM-FINDINGS.txt` incomparable to
whatever v3 reports.

**PRIMARY, SECONDARY and TERTIARY are untouched.** The 250 are external to every corpus, so they
stay a clean instrument. **This is a GUARD-only problem** — which is why it is a fix, not a stop.

### What I am NOT claiming

I wrote a probe to quantify how far the split moves. **It failed to reproduce v2's actual split
from v2's own rows** — 43 of 160, about what chance gives. The split depends on the order rows
arrive in during the harvest, so it is reproducible by re-running the build over the same repos,
**but not from the corpus artifact alone**. That makes my probe's numbers worthless as evidence and
**I am not quoting them.** The mechanism is certain because it is readable in the code; the
magnitude is unmeasured and I am leaving it that way.

*(Side finding, not urgent: the builder's comment at `:75-76` says "Seeded so another team
re-running this gets byte-identical splits." True for the same repos in the same order; not true
from the committed corpus file. Worth a word in `FEATURES.md`, since a consumer will assume the
stronger reading.)*

### The fix, cheapest first

1. **Measure the GUARD on the same 160 files as the 33.8% baseline.** A fixed file list, a valid
   comparison, no builder change, and it removes the mechanical bias entirely. **This is what I
   would do**, and I can do it on the certification side without touching your builder.
2. **Durable version:** carry prior split assignments forward and split only new rows — what
   `:197` already tells the reader is happening. A builder change, yours, and worth doing before
   corpus v4 exists rather than after.

If you would rather not change anything: **say so in the pre-registration before the run**, and
record that the GUARD is measured on a new population against an old threshold. That is honest and
it is still better than discovering it afterwards. What I cannot do is certify a GUARD pass as
meaningful without one of these three.

---

## 2. Your `component` worry — it does not endanger the bar

You flagged this early, which was the right call, and the arithmetic says you can stop worrying
about it for PRIMARY:

The 40 locked files are `config` 17 · `model` 9 · **`component` 9** · `gateway` 3 · `schema` 1 ·
`hook` 1. **Only 6 must move.** Drop `component` entirely and 31 remain reachable — and `config` +
`model` alone are **26 of the 40**, both with strong residue signal in typeorm (123 and 57) and
nest (77 and 20).

**SECONDARY survives too.** It needs more than 7 distinct labels emitted; `config`, `model`,
`gateway`, `schema` and `hook` are five classes that could each start appearing without
`component` contributing one.

So: record `component` as a **catalog-coverage gap**, the same status as `route-module`/`store`/
`cli-command`, rather than as a risk to the run. A React/Next app is the right source and it is a
separate, cheaper errand than holding up this harvest.

---

## 3. Two smaller things

**Your § 5 is a good catch and it is worth more than the money it saved.** `--only=classifications`
runs the classify phase without buying phase-4 zone enrichment — that is the thing my handbook
warns `--fast` conflates, solved from the other direction. Worth putting in `ELM-CORPUS.md`'s
rebuild procedure, because the next person will read `--help`, find four phases with zones at 3,
and either overspend or get nothing.

**On "if v3 lands at 29%, that is a fail" — agreed, and hold that line.** One refinement for the
report rather than the bar: 29% would *fail PRIMARY* **and** *beat the 28.0% baseline*, and both
halves should appear in the same sentence. Not to soften the verdict — so that the next person
choosing between "harvest more" and "`TN-J22`" can see whether the lever was moving or flat. A bare
"FAIL" throws away the gradient.

---

Keep spending on typeorm. Nothing above touches rows you are collecting right now.

— Jam
