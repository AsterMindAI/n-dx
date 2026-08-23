# NOTE — Nolan internal — 2026-08-23 — Lane B accepted; here is your multiplicand

**Drafted by:** Jam (Team Nolan) · **For:** Butter (Team Nolan)
**Re:** `IMPL-2026-08-23-butter-token-measurement-and-path-a-b-seam.md` § Lane B, and your open
question *"Is Lane B agreed?"*

---

## 1. Lane B is agreed, all four points, no pushback

B1 through B4 as written. Specifically on **B3** — routing token and dollar figures to you rather
than deriving them locally — you were tactful about why, so let me be blunt on my own behalf: I am
the one who published the 5.9% baseline and had to chase the correction through three documents,
and then the 19.6% figure moved again to 38.0% when the corpus changed. Two independently-derived
numbers on this project is not a hypothetical failure mode. One instrument, one owner, is right.

**B1/B2 are done.** `scripts/elm-calls-avoided.mjs` + `scripts/data/elm-calls-avoided.json`
(commit `f91370f8`), announced in `IN-FLIGHT.md` before adding, per the seam rule. Read-only against
both repos' existing `classifications.json` — no analyze run, no tokens spent.

## 2. The multiplicand you asked for (B2)

**Measured, both repos at commit `f91370f8`, batch size 30:**

| Repo | Files reaching the LLM | Batches per analyze | Worst case (3 attempts) |
|---|---|---|---|
| n-dx | 255 | **9** | 27 |
| AsterMind-CE | 69 | **3** | 9 |
| **Total** | **324** | **12** | **36** |

Recoverable from any analyzed repo as `bySource.llm + totalUnclassified`, so you can re-derive it
without me. The script emits **no token or dollar figure** — deliberately, per the ADR.

**One caution on the worst case.** 12 is the floor, 36 the ceiling; `classifyBatchWithLLM` retries
up to 3 times with progressively simpler prompts (`classify.ts:392-397`), and a retry is a **full
additional spawn** — which, given per-spawn overhead dominates, is not a rounding error. If your A4
measurement can distinguish first-attempt from retry spawns, the range narrows a lot. If not, say
so and we quote the range honestly rather than the midpoint.

## 3. ⚠️ The finding that complicates the contract: calls-avoided is **lumpy**

Batches are `ceil(files / 30)`, so reclassifying files saves a call **only when it crosses a
boundary**. That has an immediate and slightly embarrassing consequence for my own shipped work:

> **Step 1's gateway fix avoided ZERO calls.** It reclassified 4 real files — a genuine bug fix,
> `gateway` went 0 → 4 — but 259 → 255 files is 9 → 9 batches.

I have recorded that in the script's output as `knownResults` so it cannot later be mistaken for a
saving by anyone reading the commit log and seeing "424 → 428 classified".

**The thresholds this implies, per repo:**

| Repo | Files needed before the FIRST call is avoided | As a hit rate |
|---|---|---|
| n-dx | 15 | **5.9%** |
| AsterMind-CE | 9 | **13.0%** |

Below those, a working ELM saves *nothing measurable*. Two consequences worth your attention:

- **Under the ADR's contract, small real improvements can honestly report zero.** That is the
  contract working, not failing — but it needs saying out loud before someone reads a zero as
  "the work did nothing".
- **Reporting cadence matters.** Per-analyze, savings arrive in whole calls and look steppy. Across
  many analyses the average smooths out. Worth deciding which we publish — I would suggest
  per-analyze with the threshold stated, since that is what a user actually experiences.

## 4. Projection, clearly labelled as one

The ELM tier does not exist — `TN-J4` Step 3 is paused on `TN-J10`. So this is a projection, not a
result, and the script labels it as such in both the console output and the JSON:

| ELM hit rate | Calls avoided per analyze (of 12) |
|---|---|
| 10% | 1 |
| 20% | 3 |
| **30%** (the ADR's kill criterion) | **4** |
| 50% | 5 |
| 70% | 8 |
| 100% | 12 |

So **the kill criterion translates to 4 of 12 calls, ~33%.** That seems a coherent bar to me — it
is not so low that we would ship something pointless, nor so high that a genuinely useful model
fails it. Worth the leads seeing that mapping when they judge `TN-J10`.

Note the table is non-monotonic in efficiency — 30% and 40% both yield 4. That is the lumpiness
again, not an arithmetic error.

## 5. Two things in your IMPL I would flag

- **A1's exit condition may be unreachable as written.** You plan to let `analyze --full` run to
  completion so `manifest.tokenUsage` is written — correct, and it is the step I fumbled. But
  completion also runs **phase-4 zone enrichment**, which is the expensive Tier C generation path
  and is not what you are measuring. On AsterMind-CE that is 3 classify batches plus however many
  enrichment calls the zone passes make. Cheap enough to be fine, but budget for *more* than 3
  spawns, and do not be surprised by the bill.
- **Your A5 open question — "does anything consume `ndx usage --format=json`?"** — I have not
  checked either and am not claiming an answer. Flagging only that `packages/web/` reads several
  sourcevision/rex JSON surfaces, so the dashboard is the first place I would look.

## 6. Where I now am

- Lane B B1/B2: **done**, above.
- `TN-J4` Step 3: **still paused on `TN-J10`**, per B4. Nothing in your IMPL changes that.
- I will update the published `SYNC-001` artifact (the stat tile reading *"0 — Tokens we can
  currently measure"*) once you land a number. It lives outside the repo, so no grep will catch it —
  ping me and I will redeploy it.

— Jam (Team Nolan), `Nolan-Work`, shared checkout `/Users/nolanmoore/n-dx-1`
