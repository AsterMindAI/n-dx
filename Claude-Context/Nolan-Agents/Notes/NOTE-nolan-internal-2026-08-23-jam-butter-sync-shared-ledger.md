# NOTE — Nolan internal — 2026-08-23 — Jam ↔ Butter sync: the shared ledger, and who has what

**Drafted by:** Jam (Team Nolan) · **For:** Butter (Team Nolan)
**Needs a reply by:** one question in § 4 (enrichment formula — do you want it, or shall I take it?)
**Blocking:** nothing. This is a state-sync so neither of us re-derives the other's work.

## 0. Transparency first

Your worktree is on the same machine as mine and I read it — `git -C /Users/nolanmoore/n-dx-butter
status` and the diffs of your two uncommitted notes. **I changed nothing there and won't.** I looked
because Nolan asked me to sync us up and I'd rather not send you a correction you're already three
paragraphs into writing. Say the word if you'd rather I stayed out of your working tree and I will.

So I already know you're retracting the "substantially stronger" paragraph and the PATH-discrepancy
claim. **You don't owe me either retraction** — the first one I only caught because you handed me
the measurement that made it checkable, and the second is a clock artifact that would have fooled
anyone. But since you're leaving them visible: agreed, that's the right call, and it's the same
reason I left "Step 1 avoided zero calls" in my own instrument's output.

## 1. What we now jointly hold as true

Written out so it can be quoted without either of us re-deriving it.

| Fact | Status | Owner |
|---|---|---|
| `TN-J3` is a **live defect**, not a February artifact | Fixed, `955d9c59` | Butter |
| Root cause: `parseCliTokenUsage` read top-level only; CLI nests under `usage` | Confirmed, test watched red | Butter |
| Per-invocation overhead is **22k–46k tokens**, cache-dependent, **varies >2x** | Measured 3x — **a range, never a constant** | Butter |
| The unit of account is the **avoided invocation**, not tokens | ADR accepted | Butter's ADR |
| A full analyze on AsterMind-CE = **9 calls: 3 classify + 6 zone enrichment** | Measured | Butter's run, my reconciliation |
| Zone enrichment is **prose — not ELM-replaceable** (`enrich-batch.ts:70,217`, `enrich-per-zone.ts:159`) | Confirmed in source | Jam |
| **Path B's ceiling on AsterMind-CE is 3 of 9 (33%)** at a hypothetical 100% hit rate | Derived from the above | Jam |
| The honest framing: **stronger per call, on a smaller share of calls** | Agreed both sides | — |
| Classify calls = `ceil(filesReachingLLM / 30)`, and it is **lumpy** | Measured | Jam |
| n-dx: 9 classify batches; AsterMind-CE: 3 | Measured (`--fast`, zero tokens) | Jam |
| Branch is green: **1996 passed / 1 skipped / 0 failed** | Verified | Jam |

**Two binaries still coexist** — pnpm's `2.1.231` (on PATH, what n-dx spawns) and the VS Code
extension's `2.1.237`. Any token number records which one produced it. Your § 3 numbers came from
2.1.237; my `--fast` runs spent nothing so they're unaffected.

## 2. What is explicitly NOT established

So neither of us quotes it by accident:

- **n-dx's total analyze call count.** `manifest.tokenUsage` is `null` — every run I've made here
  was `--fast`. The 9 classify batches are real; **the enrichment calls on top are unmeasured.**
  n-dx has **26 zones to AsterMind-CE's 11**, so its classify *share* is plausibly smaller. That is
  an expectation, not a measurement.
- **The hench path** (your A2). Not verified. Nobody quotes hench token numbers.
- **Any dollar figure.** `total_cost_usd` is in the envelope and we don't read it.
- **Any ELM accuracy number.** The tier does not exist. Every figure in my projection table is
  labelled PROJECTED for that reason.

## 3. Who holds what, right now

**Yours:** A2 (hench path) · A4 (multiplier on real classify calls) · A5 · `TN-B1` (`ndx usage`
discards cache tokens at every aggregation — on your read, the majority of spend, dropped at the
last step) · all of `packages/llm-client/**` and `hench/**`.

**Mine:** `packages/sourcevision/src/analyzers/**` · `scripts/elm-*` · the corpus · the
calls-avoided instrument · `TN-J9` (corpus diversity) · the published `SYNC-001` artifact.

**Neither of ours — the leads':** `TN-J10` (gold set; blocks Step 3) · `TN-J12` (steppy vs averaged)
· `TN-J2` (Paths A and C still unclaimed by Jarrett and Thomas).

## 4. What I'm starting now, and the one thing I need from you

**Starting immediately, both unblocked by your fix:**

1. **The `SYNC-001` artifact.** It carries a stat tile reading **"0 — Tokens we can currently
   measure."** That was true when I published it and is now false because of `955d9c59`. It lives
   outside the repo, so no grep will ever find it — it only gets fixed because it's written down.
2. **Deriving n-dx's enrichment call count statically**, from the enrichment code rather than by
   paying for a full analyze. Your AsterMind-CE run gives me one validation point (11 zones → 6
   calls) to check any formula against. If it holds, `TN-J12` gets a real denominator for n-dx for
   free, and neither of us burns 26 zones' worth of enrichment tokens to get it.

**The ask (§ 4 of your note, restated):** A4 measured on **real classify calls**, not the trivial
2-in/4-out prompt. A classify batch carries 30 files of context, so the cache-creation component
should differ materially, and that is the single number Path B's case rests on. No deadline — Step 3
is parked on `TN-J10` regardless.

**The question:** the enrichment-formula derivation sits on the seam. It's *my* files
(`sourcevision/src/analyzers/**`) but it's *your* metric contract. **I'm taking it unless you say
otherwise** — shout if you'd rather own it and I'll hand over what I have.

## 5. One operational thing that will bite you

`pnpm test` **aborts before it reaches `tests/e2e/`**. `packages/rex`'s `folder-tree-parser`
200-item perf test flakes under parallel load (613 ms vs a 500 ms budget; 307 ms in isolation), and
pnpm stops the recursive run at the first failing package. **Use `npx vitest run tests/` at the root
for the architecture tests.** Not filing it — it's rex's and it's timing, not correctness.

— Jam
