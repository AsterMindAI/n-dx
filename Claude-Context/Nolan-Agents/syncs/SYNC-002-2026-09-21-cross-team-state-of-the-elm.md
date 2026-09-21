# Team Sync 002 — 2026-09-21 — Cross-team state of the ELM migration

> **Cross-team sync.** Filed in Team Nolan's `syncs/`; link it from
> `Jarrett-Agents/Notes/` and `Thomas-Agents/Notes/`.

**Team:** Team Nolan · **Present:** Nolan (lead) · **Other leads:** Jarrett, Thomas — in the room
**Prepared by:** Jam, from Syrup's 2026-09-21 cross-team survey and the committed artifacts
**Last sync:** [`SYNC-001-2026-08-11`](SYNC-001-2026-08-11-elm-path-assignment.md) (six weeks)

---

## 0. The one-paragraph version

**Path-only ELM classification does not transfer across ecosystems, and adding structural features
made it worse.** Both results are measured against bars declared in advance, on a blind set that is
still blind. Team Nolan has a **finished, documented data asset** — 624 labelled rows across 7
ecosystems, two gold sets, a warranty document, and a reproducible builder — that any team can train
from today. What we do **not** have is evidence that anybody should. The most valuable thing we can
give the other two teams this week is the negative result, because both are walking toward it.

---

## 1. Where each agent is

- **Nutella** (database, `TN-N*`) — built the whole v3 apparatus in four days: pre-registration,
  feature module, self-test, normaliser sweep, coverage harness, `FEATURES.md`. Ran Phase 4. **The
  pre-registered bar was missed; by its own rule the harvest does not run.**
- **Jam** (modelling, `TN-J*`) — ran the v2 coverage check on the lead's authorisation. **28.0% on
  fresh ecosystems, K1′ FAIL**, committed with its invocation. Reviewed the database ADR.
- **Syrup** (cross-team reader, `TN-S*`) — surveyed both other teams; found the week's headline
  artifact sitting untracked and flagged the CV-vs-deployment pattern.
- **Butter** (measurement, `TN-B*`) — `TN-B3` Step 0 still awaiting a second lead's dependency
  sign-off. Not blocking anyone.
- **Fluff** (doctrine, `TN-F*`) — `OWNERSHIP.md` § Assignments and `Command-Structure` § The teams
  **still read `(unassigned)` for all three teams**, six weeks after scopes were agreed.

---

## 2. Findings since last sync — all measured, all with committed artifacts

### 2a. The tier does not transfer, and we now know it twice

| change | train-CV / held-out | fresh ecosystems (gold set #2, n=250) |
|---|---:|---:|
| corpus v1 → v2 (2 → 7 ecosystems) | ~flat | **+14.8 pp** (13.2% → 28.0%) |
| path-only → **+ structural features** | **+1.30 pp** | **−6.4 pp** (28.0% → **21.6%**) |

**v2, path-only:** 33.8% trained-on / **28.0% fresh** — K1′ (≥30%) FAIL. `f3a88d39`.
**v3, structural:** 32.5% trained-on / **21.6% fresh** — every pre-registered criterion missed.
`21d4c083`.

The v3 bar was committed **before any structural model ran** (`802d12c1`):

| criterion | test | result | |
|---|---|---:|---|
| PRIMARY | fresh > 28.0% | 21.6% | **FAIL** |
| SECONDARY | fresh ≥ 30.0% | 21.6% | **FAIL** |
| TERTIARY | distinct labels > 7 | 7 | **FAIL** |
| GUARD | trained-on ≥ 31.8% | 32.5% | PASS |

**The GUARD passing is what makes this clean.** The loss was not bought by degrading the
in-distribution case; structural features genuinely made cross-ecosystem transfer worse.

**Pre-registered consequence, being honoured: Phase 5 does not run. No harvest.** The ADR gets an
amendment instead of 15 repos getting analyzed.

### 2b. ⚠️ The finding that belongs to all three teams

**Selection-by-train-CV has now picked against deployment coverage twice out of three times.**

Everyone here tunes on cross-validation. On this problem, CV and fresh-ecosystem coverage are
anti-correlated more often than not — so a change that looks like an improvement in the channel we
all select on is roughly a coin flip in the channel that decides whether anything ships.

If that holds, **pre-registration is necessary but not sufficient**: the discipline around the
selection channel is sound, and the channel itself is the problem. Syrup proposes an ADR. One of
the three data points (capacity 1024→4096) currently has **no committed artifact** and is flagged
as a lead, not a finding, until its harness is committed.

### 2c. Corpus provenance defect, found and fixed

`TN-N17` — the corpus pinned the **wrong tree for 41% of its rows** (`8559a7a0`). Anything derived
from corpus provenance **before 2026-09-18** should be re-checked.

---

## 3. What Team Nolan can hand over today

Ready now, with honest warranties attached:

| asset | what it is | caveat that ships with it |
|---|---|---|
| `elm-archetype-corpus-v2.json` | **624 rows, 7 ecosystems, 16 of 17 classes**, seeded 241/83-style split | teacher is **72.3% vs human truth**; residue population only; `page` has zero rows |
| `elm-archetype-corpus-sanity.json` | 473 rows, rule-labelled, flat distribution — covers `page`, `component`, `store`, `hook` | labels are a **regex**, not a judgement. **Never merge with the above** |
| gold set #1 | 83 files, two-pass human truth | **SPENT** as a model dev set |
| **gold set #2** | **250 files, hono + trpc, still blind** | **the only clean evaluation instrument anyone has left** |
| `FEATURES.md` + `ELM-CORPUS.md` | the warranty: what the labels mean, what they cannot support | rows shipped without these repeat our own mistake |
| `elm-corpus-build.mjs` + coverage harness | reproducible build and a no-labels-needed coverage check | costs **zero LLM calls** to re-measure |

**The deliverable shape is decided** (separate GitHub repo) and **creating it needs a second lead's
sign-off.** Not asked for yet; that is an agenda item.

---

## 4. Cross-team blockers & dependencies

| # | Issue | Owner | Note sent? |
|---|---|---|---|
| 1 | **`origin/dev` has not typechecked for 16 days.** `classify.ts:31` imports three symbols `classify-elm.ts` does not export. **`TJ-R3` fixes it and is unmerged.** Anyone branching off `dev` inherits it. | Jarrett | raised here |
| 2 | **Seam: Elon (`TJ-E1`, content features) and Nutella (the database those features come from) are one decision from building the same extractor twice.** Three teams already built the same classifier once. | Jarrett + Nolan | **not yet — this sync is the ask** |
| 3 | **Team Thomas silent 11 days**; `classify_elm.ts` and `classify_llm.ts` are **0 bytes**; `TT-B1` blocked on a decision only Thomas can make. | Thomas | raised here |
| 4 | Scopes agreed 09-16 are **still unrecorded** in `OWNERSHIP.md` and `Command-Structure`. | Fluff / all leads | raised here |

**Credit where due:** Jarrett **pushed all five `elm/*` branches** this week, including two commits
that had existed on no remote, plus Realm's previously-uncommitted ADR/IMPL/charter. After a month
of work stranded in local worktrees, that is the single biggest process improvement of the week.

---

## 5. Action items

| # | Owner | Action | By |
|---|---|---|---|
| 1 | Nutella | Phase 4 verdict stating plainly that the pre-registered bar was missed; ADR amendment | this week |
| 2 | Jarrett | Merge `TJ-R3` to `dev` — 16 days of a broken integration branch, fix one merge away | today |
| 3 | Nolan + Jarrett | Open the Elon ↔ Nutella seam before either builds the feature extractor | today |
| 4 | Thomas | State whether `TT-B1` adopts Jarrett's `classify-elm.ts` or builds independently | this week |
| 5 | Syrup | Commit the capacity-sweep harness, or withdraw that row from the pattern | before any ADR rests on it |
| 6 | Three leads | Second-lead sign-off for the dataset repo | when asked |
| 7 | Fluff | Record the agreed scopes in `OWNERSHIP.md` and `Command-Structure` | this week |

---

## 6. Open questions for the three leads

1. **If neither path-only nor structural features transfer, what is the tier's remaining case?**
   The honest options are: ship the *data* and let each team pick its own model; pursue
   `TN-J22` (the classify prompt, still unclaimed — the LLM teacher sits **13.1 pp below the human
   path-only ceiling**, and it is the only lever on label quality); or stop.
2. **Is the selection channel itself the problem** (§ 2b)? That question is bigger than one team.
3. **Do we ship a negative result to the other teams as a first-class deliverable?** Jarrett's Elon
   and Thomas's `TT-B1` are both heading at this wall. Our failures are worth more to them than our
   corpus.
