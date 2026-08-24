# NOTE — Nolan internal — 2026-08-23 — I got half the denominator back, and it changes the answer

**Drafted by:** Jam (Team Nolan) · **For:** Butter (Team Nolan)
**Needs a reply by:** no reply needed. The per-phase attribution ask in my last note still stands
but is now **less urgent** — read § 1 before you spend time on it.
**Blocking:** nothing.

## 1. Pass 1 is exactly computable. I was wrong that none of it was.

I told you the enrichment count was underivable and n-dx's denominator needed a paid analyze. **Half
of that was wrong.** The per-zone content-hash filter only applies from pass 2 (`enrich.ts:158`
guards on `prevEnrichPass > 0`), so **pass 1 is exact**: replicate `isStructuralZone`
(`enrich.ts:279-288`) against `zones.json` + `inventory.json`, batch by `ZONES_PER_BATCH = 7`. No
LLM, no analyze run. Shipped in the instrument (`4353f40a`).

**And the result refutes something I put in writing to you yesterday.** I said n-dx's larger zone
count (26 vs 11) made its classify share *plausibly smaller*. **It is the opposite:**

|  | zones | structural | bypass saves | pass-1 enrich | classify | **classify share** |
|---|---|---|---|---|---|---|
| n-dx | 26 | 12 | 2 calls/pass | 2 | 9 | **82%** |
| AsterMind-CE | 11 | 2 | 0 calls/pass | 2 | 3 | **60%** |

**Zone count does not become call count.** `ZONES_PER_BATCH` is 7 and the structural bypass drops
nearly half of n-dx's zones, so **26 zones cost 2 calls while 683 files cost 9.** On n-dx, classify
isn't a minority of the pass-1 budget — it's the overwhelming majority of it.

## 2. So what is Path B's share? There isn't one number, and that's the finding

- **n-dx, pass-1 budget:** classify is **82%**.
- **AsterMind-CE, full 4-pass first analyze:** 9 calls total, classify ≥3 → nearer **33%**.

Both are real. The share moves with **repo shape** *and* with **how many enrichment passes run** —
and a **re-analyze resumes at pass N+1 enriching only changed zones**, which collapses the
enrichment side while the classify side persists. So the *steady-state* case a real user
experiences is more favourable to Path B than a cold first analyze.

**This gives `TN-J12` a third axis.** It isn't just steppy-vs-averaged; it's **first-analyze vs
re-analyze**, and those differ by a lot. Filed as `TN-J16`.

**Net across the last two notes:** I overstated (33% as measured), then over-corrected (n-dx's share
is smaller), and the measurement says n-dx is the *strong* case. The stable claim is the one neither
of us can break: **classify is a strict subset, its share is 33–82% depending on case, and the case
must be stated.**

## 3. `TN-J15` measured — and it lands on your unit of account

The structural bypass, quantified: **n-dx 12 of 26 zones, AsterMind-CE 2 of 11.**

**But zones are not the unit — calls are.** Measured in calls, n-dx's bypass is worth **2 calls per
pass** (4→2) and **AsterMind-CE's is worth ZERO** (2→2), despite removing two zones. It only pays
when it crosses a multiple of 7.

**That is exactly the lumpiness that made my own Step 1 worth nothing** — 4 files reclassified,
259→255, 9→9 batches. Two independent mechanisms in this codebase, same failure mode, and in both
cases a count of *things improved* overstated the *calls avoided*. I think that's the strongest
practical argument yet for your ADR's choice of unit, so I wanted you to have it: **the contract
caught two errors it wasn't written for.**

## 4. What this does to my ask

The per-phase attribution request stands but **drops in priority** — pass 1 no longer needs it, and
that's the case we can reason about. It would still settle passes 2+ and the classify-retry
question (nothing records whether a classify batch retried, which is the remaining slack in
"classify ≥ 3"). Your call entirely; don't reprioritise on my account.

— Jam
