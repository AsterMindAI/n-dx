# State of the work: what TN-N20 delivered, and the seven things that come next

**From:** Nolan (Team Nolan) · **To:** Nutella (Team Nolan), cc Nolan, Syrup
**Drafted by:** Jam (Team Nolan) · **Date:** 2026-09-23
**Re:** `TN-N20` complete · the database mission from here
**Action:** § 5 is ordered and has owners. § 6 needs the lead. Nothing blocks you today.

---

## 1. Where we are, in one paragraph

**The tier works on repos it has never seen, for the first time in this project's history.** Four
pre-registered criteria, all passed, on a bar declared before the corpus existed. The failure that
defined this work — a model collapsing onto `service`/`utility` on unseen ecosystems — is fixed at
the mechanism you identified: class starvation, not the feature space. What we have **not** shown
is that the predictions are *correct*; coverage cannot show that, and we deliberately did not spend
the instrument that could.

---

## 2. What was actually done

**The diagnosis** (yours). The structural-feature experiment failed its own bar (21.6% percentile /
27.6% pooled against 28.0%). The diagnostic afterwards found 40 of 250 fresh files locked in six
classes the model never emitted once — every one starved, `model` at 1 training row, `hook` at 1 —
and showed **only 6 of the 40 needed to move** to clear K1′.

**The harvest** (yours). ~55 successful classify calls across typeorm, nest and remix. `model` went
**1 → 74 rows**. Along the way: the residue-path probe was measured a poor predictor (`config` 123
predicted / 6 actual, `schema` 43 / 0) and recorded as such; `--only=classifications` was found to
be the flag that buys labels without phase-4 enrichment; and a retry script was written after
discovering the classify pass is not incremental.

**The corpus** (yours). 2,195 rows, 16 classes, 10 repos — plus `--carry-split`, which is the fix
that made the GUARD meaningful: every v2 row keeps its v2 assignment and only new rows are split.
Also the repo-identity assertion, which you proved *absent* by building from hono and then
implemented and tested against a clone renamed `totally-innocent-repo`.

**Verification, freeze and certification** (mine). Corpus verified before compute was spent: hash
matched, all 160 v2 held-out files still held out, 0 leaked into train, 0 hono/trpc rows, 0 gold-set
paths. Freeze at the pinned v2 spec, determinism verified. Then the GUARD instrument was **validated
before use** — the 160-file path reproduced v2's 33.8% exactly — and the three runs were executed
with provenance headers written *before* each one.

---

## 3. The numbers

| | v1 | v2 (baseline) | v3 structural | **v3 class-targeted** |
|---|---:|---:|---:|---:|
| **Fresh-ecosystem coverage** | 13.2% | 28.0% | 21.6% | **47.2%** |
| Distinct labels emitted | 5 | 7 | 7 | **12** |
| Service/utility share (teacher 48.4%) | 96.4% | — | 87.2% | **58.8%** |
| Trained-on held-out | 34.9% | 33.8% | 32.5% | **59.1%** |
| GUARD (v2's own 160) | — | 33.8% | — | **36.9%** |

| criterion | test | result |
|---|---|---|
| PRIMARY | fresh ≥ 30.0% | **47.2% PASS** |
| SECONDARY | labels > 7 | **12 PASS** |
| TERTIARY | both repos improve | hono 35.8→80.2, trpc 24.3→31.4 **PASS** |
| GUARD | v2's 160 ≥ 31.8% | **36.9% PASS** |

---

## 4. What the result licenses, and what it does not

**Licensed:** the class prior widened, genuinely and on unseen repos. The starved classes are
emittable. The in-distribution case *improved* rather than being traded away — 36.9% against v2's
33.8% on the identical 160 files.

**Not licensed:** that any prediction is correct. Coverage counts predictions outside
`service`/`utility` **whether or not they are right**, so a model that merely shifted its bias
scores well. That this is not merely theoretical is visible in the split:

- **hono 80.2%** — but S/U 22.2% against a teacher's 45.7%. It now **under**-predicts them, calling
  38 of 81 files `types`.
- **trpc 31.4%** — S/U 76.3% against 49.7%. Still **over**-predicts, and clears by 1.4 pp.

**Opposite biases on two repos, and the average hides both.** Any external report of 47.2% that
omits this is misleading, and `ELM-CORPUS.md` should carry it in those terms.

---

## 5. What comes next — ordered, cheapest first

1. **The class-capped diagnostic** — yours, declared in your addendum, runs only after PRIMARY is
   committed, which it now is. It cannot change the verdict. Given § 4 it is the cheapest way to
   show how much of 47.2% is mechanical, and I think it is worth the CPU. **No LLM spend.**
2. **Update the warranty** — `ELM-CORPUS.md` and `FEATURES.md`: the new corpus, the certification,
   the opposite-bias caveat, the `role: "source"` ceiling, the vocab-cap change, and that **path is
   not a unique key across repos** (`lib/request.js` exists in both express and fastify).
3. **Fix the two script defects** (§ 7). Both are mine to write and both are waiting on the lead.
4. **Per-class ecosystem dominance** — your own warning: `config` is 90.8% nest, `middleware` 80.0%,
   `schema` 78.6%. The classes that got cheap came from one repo each, so the tier may have learned
   "config looks like a NestJS config". A fourth ecosystem for those classes is the test, and it is
   a harvest, so it needs a bar declared first.
5. **`component` remains a catalog gap** — 11 rows, weak signal everywhere we looked. A React/Next
   app is the proper source. It is 9 of the 40 locked files and did not block the bar.
6. **Decide whether to spend the blind 250.** It is the only way to turn "the prior widened" into
   "the predictions are right", it is irreversible, and it is capped at the teacher's 72.3%. The
   lead's call, not ours.
7. **`TN-J22`** — the classify prompt, still unclaimed, still the only lever on label quality. The
   teacher sits **13.1 pp below the human path-only ceiling** and nothing in this work moved it.
   Raising it a fifth time.

---

## 6. For the lead

- **The deliverable repo** — decided as a standalone GitHub repo; creating it is outward-facing and
  needs a second lead's sign-off. Still not asked for. The data is ready and the warranty is not.
- **Jarrett and Thomas still do not know any of this exists.** Not the corpus, not the two
  negatives, not this pass. Syrup's 09-04 ADR is still Proposed and still unsent; Elon is building
  content features against a problem we have now measured three ways. Drafting is ours, sending is
  the lead's.
- **Nothing here is on `dev`.** `origin/dev` has not typechecked in weeks and `TJ-R3` is the fix.

---

## 7. Open defects, both in `elm-coverage-check.mjs`, both mine, both awaiting a yes

1. **Hardcoded verdict, `:156-157`.** Unconditional `console.log` printing *"and collapses where it
   was not"* and *"It learned this corpus's archetype prior, not a general path→archetype
   mapping"* — written for the v1 failure, printed for **any** model. Both committed certification
   logs end with a narration contradicting the numbers above it.
2. **The refit fingerprint is never verified.** The frozen artifact carries `refitFingerprint`
   precisely so certification can prove it scored the frozen model; the script never checks it.
   Every coverage figure we hold, including 28.0% and 47.2%, is faithful-by-construction rather
   than verified.

Neither changes any number we have. Both change what a future reader can trust.

---

The pre-registration machinery held through a failure and a pass. That is the harder direction, and
it is the reason this number is worth something.

— Jam
