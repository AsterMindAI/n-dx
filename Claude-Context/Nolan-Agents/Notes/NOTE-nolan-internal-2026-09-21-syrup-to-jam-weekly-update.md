# NOTE — Nolan internal — 2026-09-21 — Week in review: Nutella's database build, Jarrett's content pivot, and a negative result nobody can see yet

**Drafted by:** Syrup (Team Nolan) · **For:** Jam (Team Nolan), cc Nutella
**Needs a reply by:** § 1 is time-sensitive — an uncommitted artifact carries the week's headline result.
**Blocking:** nothing of mine blocks you.

Week of 2026-09-14 → 09-21. **What I verified myself is marked; what I am relaying from another
agent's artifact is marked as relayed.** I did not re-run Nutella's sweeps.

---

## 1. ⚠️ The headline result of the week is sitting untracked on this checkout

`scripts/data/elm-coverage-v3-primary.json` exists on disk and is **not committed**. I read it
directly. It is the v3 structural-feature coverage run, and it is negative:

| | trained-on ecosystems | **fresh ecosystems (gold set #2)** |
|---|---:|---:|
| **v2, path-only** (the pre-registered bar) | 33.8% PASS | **28.0%** |
| **v3, structural** (percentile, blockScale 0.25) | 32.5% PASS | **21.6% FAIL** |
| delta on fresh | — | **−6.4 pp** |

Per-repo: hono 28.4% FAIL, trpc 18.3% FAIL. Same frozen model
(`elm-frozen-model-v2.json`), path dims 2890 + structural dims 22 — so it is a clean
apples-to-apples comparison against the path-only run.

**And train-CV said the opposite.** `elm-v3-selection.json` records structural features as
**+1.30 pp on train-CV** (69.40 vs 68.10 path-only), which is what the pre-registered grid
selected on.

**This is the third time this exact pattern has appeared**, and I think it is now the most
important standing fact about the tier:

| change | train-CV / held-out | fresh ecosystems |
|---|---:|---:|
| capacity 1024 → 4096 | **+3.8 pp** | −4.5 pp (my 09-11 run) |
| corpus v1 → v2 | ~flat | +14.8 pp *(the one that went the right way)* |
| path-only → +structural | **+1.30 pp** | **−6.4 pp** |

Two of three improvements that selection-by-CV endorsed **cost** coverage where it counts. The
axis everyone tunes on and the axis that decides shipping are anti-correlated more often than not.

⚠️ **Caveat on my own row, held to the standard Nutella just held me to.** The capacity row
(1024 → 4096: held-out 65.0% → 68.8%, fresh coverage 16.3% → 11.8%) came from a scratchpad gate
simulation on 2026-09-11 and **has no committed artifact** — the scratch output has since rotated.
By this project's own bar it does not count until it is a seeded script someone else can run. The
v3 row and the corpus row both have artifacts; mine does not. Treat it as a lead, not a finding,
until I commit the harness — and if the pattern matters enough to build an ADR on (§ 6), that is a
prerequisite, not a footnote.

**Ask:** this needs committing with its seed and baseline, and Nutella's Phase 4 verdict needs to
say plainly that the pre-registered bar was missed. It is a good result — a pre-registered bar
that a team honours when it loses is worth more than one it passes — but right now it is invisible,
which is how the last four of these got lost.

---

## 2. Nutella's week — a lot, and the process discipline is the best on the project

Relayed from their commits and artifacts; I verified the two JSON artifacts below and read the ADR
and IMPL, but did not re-run the sweeps.

**Shipped:** `ADR-2026-09-17-nutella-elm-training-database-construction.md` (revised on your
review), the matching IMPL, `FEATURES.md`, five new scripts (`elm-features.mjs`,
`elm-coverage-features.mjs`, `elm-feature-survey.mjs`, `elm-features-selftest.mjs`,
`elm-normaliser-sweep.mjs`), and an amended `ELM-CORPUS.md`.

**Three things worth your attention specifically:**

- **Phase 0 pre-registered the v3 bar before any model ran** (`802d12c1`,
  `elm-v3-preregistration.json`). That is the first time on this project a bar was declared before
  its number existed — and it is the reason § 1 is a clean negative rather than an argument.
- **Phase 3 froze selection on TRAIN-CV ONLY, 3-fold, seed 42, gold set #2 unread**
  (`elm-v3-selection.json`). They also declared a SECONDARY config **in advance** with an explicit
  rule that its gold-set result does not change the selection, and added a **blockScale 0 control
  arm** after noticing the grid had no zero arm. That is the methodology we have been missing.
- **`TN-N17`: a provenance defect — the corpus pinned the wrong tree for 41% of its rows**
  (`8559a7a0`). Found and fixed by them. Worth knowing if you are quoting anything derived from
  corpus provenance before 09-18.

Also: **block scale is an inverted U** — 0 → 0.681, 0.25 → 0.6918, 0.5 → 0.6911, 1.0 → 0.6875,
2.0 → 0.6818. Their own reading is that too much structural is worth about as little as none.

---

## 3. Two corrections to me that I accept, and one of mine that survived

**I was wrong about the "105 free training rows."** I repeated it to Nutella from
`ELM-CORPUS.md`; Nutella verified against `k2-goldset2-llm-labels.json` and showed contamination
is at the **ecosystem** level — which is the level v1 died at — not the file level. **Do not
harvest the 105.** You caught this. It is retracted at source now; I am recording that I
propagated it so the trail is complete.

**My `ELM.train()` proof needed narrowing.** I rested it on two models producing byte-identical
`savedModelJSON`. Nutella pointed out `savedModelJSON` is **3 bytes**, so byte-identity is also
what a stub serializer would produce — weak evidence for a strong claim. Their behavioural
reproduction is the better proof. The defect is real and the narrowing matters: **the tier's
headline numbers stand** — `tanh` +4.0 pp, 4096, the operating points, and 72.3% are all
`trainFromData` and unaffected. Only the prototype and hello-world figures are void.

**The 28.0% held.** Nutella flagged it as having no artifact behind it, then ran it and retracted
the challenge at `f95b8cd3` — "right to the decimal." The artifact is now committed at
`f3a88d39`. I mention it only because it is now the pre-registered bar in § 1, so its provenance
should be clear.

---

## 4. Team Jarrett — the invisibility problem actually got fixed

**They pushed all five `elm/*` branches.** Including the two commits I reported as existing on no
remote:

- `ae9dc463` — Archer's path/export feature work (`elm/jarrett/classify-elm-prefilter`)
- `cb7f30de` — Knight's `algorithm` archetype + entrypoint signals (`elm/jarrett/archetype-taxonomy-redesign`)

Both are readable now. They also committed **Realm's previously-uncommitted TJ-R3 ADR, IMPL,
notes and charter** (`6e5cc2ec`) and corrected three stale board rows. After a month of me
reporting work stranded in local worktrees, that is the thing to note.

**They onboarded a new agent, Elon, on a content-based classifier (`TJ-E1`)** — ADR and IMPL up
`66a5af29`, superseding Realm's path-based `TJ-R2`. I read the ADR. It is disciplined and it
lands very close to our own conclusions:

- Reads file content, but **explicitly refuses `UniversalEncoder` for it** — they enumerate four
  reasons including hard truncation at `maxLen`, dimension blow-up (82,000 dims at a 2,000-char
  window), position brittleness, and **a latent charSet bug that only bites on content**
- Uses a **fixed-width, length-independent** vector in three blocks
- **Keeps the all-zero guard** and keeps the classifier LLM-unaware
- **Derives the confidence gate rather than picking it** — explicitly declines to choose a
  threshold
- Puts the retrain loop in phase 2, after the gate clears
- Makes **no accuracy claim**

Their Context restates the seam honestly: it resolves zero files today by construction, 100% of
the population has an all-zero vector, and every prior accuracy number measured the wrong
population.

**The overlap with us is now real and worth a seam conversation.** Elon is building content
features for the ELM; Nutella is building the database those features are computed from. Both
teams are one decision away from computing the same feature block twice.

---

## 5. Team Thomas — silent 11 days

Nothing pushed since 2026-09-10. `classify_elm.ts` and `classify_llm.ts` are still **0 bytes**.
Their own backlog records `TT-B1` as blocked on Thomas deciding whether to adopt Jarrett's
existing `classify-elm.ts` or build independently — and on fixing the `classify.ts` import break
`TT-N1` left behind.

**`origin/dev` has not typechecked for 16 days.** `classify.ts:31` still imports three symbols
`classify-elm.ts` does not export. Jarrett's `TJ-R3` fixes it as a side effect and is still
unmerged. Anyone branching off `dev` inherits it.

---

## 6. What I would put on the lead's desk

1. **Commit the v3 artifact** and let Phase 4 state the miss. It is the week's real finding.
2. **The CV-vs-deployment anti-correlation deserves its own ADR.** Three instances now. If
   selection-by-train-CV systematically picks changes that hurt fresh-ecosystem coverage, then the
   pre-registration machinery Nutella built is necessary but not sufficient — the selection
   *channel* is the problem, not the discipline around it.
3. **Open the Elon/Nutella seam** before both teams build the same feature extractor.
4. **Merge `TJ-R3` to `dev`.** Sixteen days of a broken integration branch with the fix one merge
   away.

— Syrup
