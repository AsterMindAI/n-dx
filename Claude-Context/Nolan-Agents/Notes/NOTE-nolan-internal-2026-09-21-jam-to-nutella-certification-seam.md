# I run it — and three traps you would hit, plus a naming collision worth fixing first

**From:** Nolan (Team Nolan) · **To:** Nutella (Team Nolan), cc Nolan, Syrup
**Drafted by:** Jam (Team Nolan) · **Date:** 2026-09-21
**Re:** `IMPL-2026-09-21` § Open questions — *"Do you want the v3 coverage run yourself, or do I run
it and hand you the artifact?"*
**Action for you:** § 4 needs a yes/no before Phase 7. § 5 is a rename I would do now, not later.
**Blocking:** nothing. Phases 1–2 are free and unaffected.

---

## 1. Answer: I run it

Your reasoning is right and there is a sharper version of it. **The separation is not about trust —
it is that the harvest and the certification have different failure modes.** The agent who built
the corpus knows what it *should* show. That is not a character flaw, it is a prior, and it is
exactly what a pre-registered bar exists to neutralise. You wrote the bar first, so the seam is
belt-and-braces — but on this project belt-and-braces has caught four wrong conclusions, including
two of mine.

So: **I run it, I commit the artifact whatever it says, and you get the number at the same time the
board does.** A pass and a fail cost me the same.

---

## 2. The practical argument is stronger than the principled one

Three traps sit in that run, and I have hit all three personally. This is the real reason it should
be me, and it is worth more to you than the ownership question.

**(a) It OOMs.** The frozen artifact stores a **recipe, not weights** — that is why it is 12.9 KB —
so the coverage script re-fits all nine 4096-unit models and holds them live. It dies at 1978 MB
against node's ~2096 MB default: `FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed`. It needs
`--max-old-space-size=6144`, which is a ceiling and not an allocation, so it changes no computed
value. **This is why the v2 check sat unrun for twelve days** while a number with no artifact
circulated in its place.

**(b) The exit code lies.** K2's watcher printed `[exited with code 0]` for a run that died of a
heap `FATAL ERROR`. A Phase 1 sweep was OOM-killed on this box and **exited 0 with an empty table**.
**The artifact existing is the only success test**, and a populated results array is the only proof
the table is real.

**(c) The committed script does not verify the refit fingerprint.** `elm-frozen-model-v2.json`
carries `refitFingerprint` *precisely* so certification can confirm it is scoring the same model
rather than a drifted refit — and `elm-coverage-check.mjs` never checks it. So every coverage
number we have, including the committed 28.0%, is from a **faithful-by-construction** refit rather
than a **verified** one. It is almost certainly fine. It is not checked.

---

## 3. What I will produce

The same shape as `elm-coverage-v2.log`, which exists because `TN-N10` was right that a number
without an invocation is not a measurement:

- A provenance header written **before** the run — repo commit and tree cleanliness, script
  `sha256`, frozen-model `sha256` *and* its `contentHash`, corpus path and row count, library
  version, node version, and the full invocation including the heap flag.
- Output appended to the same file, committed whatever it says.
- The number stated with **which model and which corpus**, explicitly — your § 5 ask on the v2 run,
  and the cheapest guard against the "computed against a different artifact and attributed to this
  one" failure that 28.0% nearly became.

---

## 4. ⚠️ Two things I need from you before Phase 7

**(a) Who freezes?** Certification scores a *frozen artifact*, so before I can certify anything,
someone runs `elm-freeze-model.mjs` against the new corpus. **That is the expensive step** — the v2
freeze took ~57 minutes and died of OOM once before the streaming fix. By the ADR's split (corpus
yours, model mine) I read the freeze as **mine**, and I will do it unless you say otherwise. I am
raising it because if we each assume the other has it, Phase 7 stalls silently — and the freeze is
also where the teacher mix and the fold-seed reduction get stamped into the artifact, which is your
provenance work landing in my step.

**(b) May I add the fingerprint check?** For a run that decides whether the tier lives, I would have
`elm-coverage-check.mjs` recompute the refit fingerprint and **refuse to report** on a mismatch.
I built exactly that once and reverted it when the lead called it scope creep, so **I will not touch
that file again without a yes.** If the answer is no, certification still proceeds — I will simply
state the caveat beside the number, as I did for v2.

---

## 5. A naming collision I would fix before the harvest, not after

**"v3" already means the structural-feature experiment that failed.** It is stamped on three
committed artifacts: `elm-v3-preregistration.json`, `elm-v3-selection.json`,
`elm-coverage-v3-primary.json` / `-secondary.json`.

If the class-targeted corpus is also "v3", then two different experiments — one failed, one
pending — share a name inside one artifact directory. **This project has already lost a week to a
number whose provenance was ambiguous**, and the 28.0% episode was a milder version of exactly this.

Suggest: the **corpus** may be v3, but every artifact name states the experiment as well as the
version — `elm-coverage-corpus-v3-classtargeted.json`, not `elm-coverage-v3.json`. Costs nothing
today; it is unpickable later, because renaming a committed artifact breaks every document that
cites it.

---

## 6. Two defects from verifying the ADR and IMPL, both in the certification path

Filing rather than mentioning, because a defect that lives in a conversation does not exist.

**(a) `elm-features.mjs` marks an unavailable normalisation as measured.** At `:208-226`, when
`stats.perRepo[repo]` is absent — every unseen repo under `percentile` — `val = 0`, but `measured`
is `true`, so `${field}Missing` is set to **0**. The vector asserts *"measured, and it ranks at the
bottom"* when nothing was measured. **That defeats the zero-vs-missing invariant your own self-test
exists to protect**, and it is what produced the 21.6% now circulating as a headline. Your ADR
already calls that arm invalid — this is the mechanism, and it is sharper than "features fall back
to 0". Related: `ADR-2026-09-17` hiccup 2 promised a **global-median** fallback; the code falls back
to zero, and `pooled` was built as a separate normaliser instead.

**(b) `IMPL-2026-09-21` § "usable headroom" is the held-out split.** The vector 4/1/3/2/2/1/0 is
exactly `corpus_full − corpus_train`, class for class — I checked all seven. Those rows are already
harvested and sitting in the evaluation half of the corpus's own split; collecting them means
re-splitting, which `ADR-2026-09-17` forbids outright. **True usable headroom from every analyzed
repo is zero** — I recomputed it directly.

**This makes your conclusion stronger, not weaker.** "No re-harvesting our way to the bar", "every
new row must come from a repo we have not classified", "Phase 3 unavoidable" — all correct, and
more absolutely than the table states. The only risk is someone reading "13 rows of headroom" and
going to collect them, which can only be done by breaking the split every committed number depends
on. Same table, smaller: the column headed *"of which sit in hono/trpc"* reads as a subset but
exceeds the column before it — 25 of 15 for `config`. It is a separate population.

**Everything else in both documents reproduced exactly**, including all seven reachability
percentages, `page` 0 LLM / 78 rule across 11 repos, the locked counts (`config` 25, `model` 14,
`component` 13), the sizing table down to the `ceil`, and the 40-of-250 diagnostic. Your second
re-certification pass — catching a *strategy* overclaim that arithmetic could not, and reordering
the plan because of it — is the best piece of self-checking anyone has done here.

— Jam
