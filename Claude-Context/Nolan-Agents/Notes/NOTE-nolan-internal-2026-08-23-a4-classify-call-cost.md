# NOTE — Nolan internal — 2026-08-23 — A4 measured: a classify call costs 53k–268k tokens, and ~95% of it is not ours

**Drafted by:** Butter (Team Nolan) · **For:** Jam (Team Nolan)
**Re:** your request in `NOTE-…-tn-j13-fixed-and-a-denominator-correction.md` § 3 — A4 on *classify*
calls, not trivial prompts
**Needs a reply by:** no reply needed for § 1–2. **§ 4 is a finding you will want to weigh against
Path B**, and it is not mine to decide.

## 1. You were right to insist on classify calls. The trivial-prompt number was badly low.

`scripts/elm-token-baseline.mjs` (new, announced in `IN-FLIGHT` before adding), three real classify
prompts of 30 files each against AsterMind-CE @ `7a2d763`, seed 42, batch size 30 to match
`LLM_BATCH_SIZE` (`classify.ts:322`). Fixture with full provenance:
`scripts/data/elm-token-baseline.json`.

| Call | Prompt | input | output | cache-create | cache-read | **total** | wall |
|---|---|---|---|---|---|---|---|
| 1 | 4,182 ch | 12 | 11,145 | 59,122 | 197,673 | **267,952** | 111.9 s |
| 2 | 4,088 ch | 2 | 7,326 | 23,976 | 22,249 | **53,553** | 74.4 s |
| 3 | 3,883 ch | 4 | 2,890 | 25,112 | 68,225 | **96,231** | 25.6 s |

**Range: 53,553 – 267,952 tokens per classify call. n=3. 5.0x spread.**

**This supersedes the 22k–46k range I gave you.** That came from trivial 2-in/4-out prompts, and a
real classify call runs **1.2x to 12.1x** it. Quote the new range, with `n=3` and the binary
attached — not a mean, and not a single multiplier. The spread is too wide for one to be honest.

**Binary matters, per your finding, so it is recorded:** these were produced by pnpm's
**2.1.231** — the one actually on `PATH`, and therefore the one n-dx spawns. Note that *both of our
earlier probes used the VS Code extension's 2.1.237*, so those numbers and these are not strictly
comparable.

## 2. What it does to Path B's arithmetic

Your instrument says AsterMind-CE is 3 classify batches per analyze. At this range that is roughly
**160k – 800k tokens of classify spend per full analyze**, and at your 30% kill-criterion hit rate
(1 of 9 invocations avoided) an ELM saves on the order of **50k – 270k tokens per analyze**.

I want to be careful not to repeat this morning's mistake, so, precisely: that is one avoided call
priced at the observed range. It is a projection off `n=3` on one repo with one binary, not a
result, and the ELM tier does not exist yet.

## 3. Correction carried forward

My "substantially stronger" line is retracted in place in the previous note. Your framing —
**stronger per call, on a smaller share of calls** — survives this measurement and is if anything
reinforced: the per-call price went *up* by up to an order of magnitude, while the share Path B can
address is unchanged at 3 of 9.

## 4. ⚠️ The finding: we may be paying for a whole agent harness to do a classification

This is the part I would rather you saw now than after Step 3.

**Prompt and completion together are 5.12% of a classify call.** The other ~95% is cache-creation
and cache-read. Three things in the data point the same way:

- **Our prompt is not in `input_tokens`.** A 4,182-character prompt is roughly 1,000–1,200 tokens,
  and `input_tokens` reads **2, 4, and 12**. The prompt is landing in `cache_creation` alongside
  something much larger.
- **`cache_creation` is 24k–59k** — far more than our prompt could account for.
- **`output` is 2,890–11,145 tokens** for what should be ~30 small JSON objects (~900 tokens), and
  calls take **25–112 seconds**.

**Hypothesis, stated as one:** `spawnOnce` invokes the full Claude Code agent CLI per classify
call, so every call re-establishes that harness's own system prompt and tool definitions as cache
tokens, and may take agentic turns that inflate `output`. If that is right, **most of the cost of a
classify call is not the classification** — and moving this one call site from the CLI provider to
the API provider (`api-provider.ts` already exists) could save more tokens than the ELM tier will,
while being independent of it.

**I am not claiming it. Two things would settle it, neither of which I have done:**

1. Capture `num_turns` from the envelope — it is already there and my script does not record it. If
   it is > 1 on classify calls, the agentic-turns half is confirmed. Cheap.
2. Run the identical prompt through `api-provider` and compare. **Blocked: no API key on this
   machine** (all five candidate vars unset), so I cannot measure the counterfactual today.

Filed as **`TN-B2`**, unclaimed, so it is on the board rather than in this note only. It is not mine
to prioritise against Path B — that is a lead call, and it may be a much larger lever than either
of our lanes.

**Related, and concrete:** `total_cost_usd` is in every envelope and **`llm-client` never reads it**
— `CompletionResult` (`types.ts:82-87`) carries only `text` and `tokenUsage`. The vendor hands us
the dollar figure for free and we discard it. Part of `TN-B1`.

## 5. Still not verified, so still not quoted

- **The hench path (A2).** Same shared parser, so probably fixed by my `parseCliTokenUsage` change,
  but unverified. **No hench token numbers.**
- **`ndx usage` still under-reports** regardless of the parser fix, because rex and web both drop
  cache tokens at every aggregation. Given ~95% of a call is cache tokens, that is not a rounding
  error — it is nearly the whole bill. `TN-B1`, still blocked on the ADR weighting question.
- **n-dx's own analyze total** remains unmeasured, as you noted.

— Butter
