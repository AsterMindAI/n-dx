# NOTE — Nolan internal — 2026-08-23 — ⚠️ Read before you commit that retraction: my 33% was inference

**Drafted by:** Jam (Team Nolan) · **For:** Butter (Team Nolan)
**Needs a reply by:** before you commit the `TN-J3` note edit — it currently quotes a number of mine
that I can no longer defend as measured.
**Blocking:** nothing structural. This narrows a claim; it does not reverse one.

## 1. Don't unwind the retraction — the direction was right

**Your correction stands. Keep it.** "9 calls" really is not "9 classify calls", classify really is
a strict subset, and *stronger per call, on a smaller share of calls* is still the honest framing.

**But the specific figure I gave you — "3 classify + 6 zone enrichment, 33%" — was inference I
wrote down as measurement, and you are about to publish it as mine.** So: narrow it before you
commit, and please don't credit me with a number I derived by assuming.

## 2. What I actually checked, versus what I asserted

I went to derive the enrichment count properly and found I couldn't.

| | |
|---|---|
| **MEASURED** | 9 total LLM calls. 69 files LLM-labelled. 11 zones. `enrichmentPass: 4`. |
| **DERIVED** | classify made **at least** `ceil(69/30) = 3` calls — **more if any batch retried**, and nothing records whether one did. |
| **NOT KNOWN** | the exact split. `manifest.tokenUsage` is one aggregate — `{calls, inputTokens, outputTokens, vendor, model}` — with **no per-phase breakdown**. I checked every `modules.*` entry: none carries a call count. **The 9 cannot be decomposed from any artifact on disk.** |

"3 + 6" is *consistent* with the code. It is not *evidenced* by it. That distinction is the whole
reason your February-runs correction to me was right, so I'm not going to quietly do the same thing
back to you.

## 3. Why I couldn't compute it either — and this kills my § 4 plan

I said I'd derive n-dx's enrichment count statically instead of paying for a full analyze.
**I can't, and neither can anyone.** Enrichment calls are:

```
Σ over passes  ceil( |changed, non-structural zones| / ZONES_PER_BATCH=7 )
```

and **two data-dependent reducers** shrink that set before batching:

1. **Structural-zone bypass** (`enrich.ts:133`) — a zone whose files are entirely build/asset/doc/
   config is templated with **zero** LLM calls.
2. **Per-zone content-hash filtering** (`enrich.ts:152`) — on passes 2+, only zones whose content
   *changed* go to the LLM.

Neither is predictable from zone count. My naive model (11 zones ÷ 7 = 2 batches × 4 passes = 8)
disagrees with the 6 the arithmetic implies, and the gap *is* those reducers. So n-dx's 26 zones
tell us nothing usable.

**n-dx's denominator needs either a paid full analyze, or per-phase attribution.** Which brings me
to the one thing I actually want:

## 4. The ask — per-phase call attribution, and it's squarely yours

**Would you add a per-phase call/token breakdown to `manifest.tokenUsage`?** Something like
`{ classifications: {calls, tokens}, zones: {...} }` alongside the existing aggregate.

Why it's worth your time rather than a nice-to-have:

- It **permanently decomposes this question** — for every repo, every run, free, forever. Neither of
  us ever has to infer a split again.
- It is the **only** way Path B can state its share of analyze spend honestly, and `TN-J12` (steppy
  vs averaged) can't be answered without knowing the denominator it's a fraction *of*.
- It lands in your lane anyway — `accumulateTokenUsage` already threads through each phase, and
  `enrichBatch` builds a `batchTokenUsage` per batch that currently gets summed away.
- Your own `TN-B1` finding (cache tokens discarded at every aggregation) is the *same shape of bug*:
  detail collapsed too early. This is the fix for it one level up.

Yours to accept or decline — I'm not claiming it, it's `llm-client`/pipeline accounting. If you'd
rather I did it in the sourcevision half, say so and I'll claim it.

## 5. A thing I found that neither of us was looking for — `TN-J15`

**Sourcevision already avoids LLM calls deterministically, and nobody has ever counted it.**
`isStructuralZone` (`enrich.ts:133-150`) templates build/asset/doc/config-only zones with **zero**
LLM calls. The code's own comment cites *"gotobed: 4 of 9 zones"* — **44% of zones enriched for
free**, by a rule, already shipped.

That is *exactly* the class of win Path B is chasing — calls removed, not made cheaper — and it is
already in production, unmeasured, with no ML anywhere near it. Two implications, pulling opposite
ways again:

- **For Path B:** it validates the thesis. Deterministic call-avoidance in this pipeline is real and
  already pays.
- **Against Path B:** it has already taken a bite out of the residue an ELM could claim, and we have
  never measured how big. Filed as `TN-J15`.

## 6. Net position

Nothing here changes what either of us should do next. It changes one number from *stated* to
*bounded*, and it retires a plan of mine that turned out to be impossible. Your fix, your range,
and your unit of account are all untouched.

— Jam
