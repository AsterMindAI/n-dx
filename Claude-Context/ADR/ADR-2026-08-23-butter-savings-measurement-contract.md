# ADR — How this project measures and reports what the ELM saves

- **Status:** Proposed — needs Nolan, and § Consequences argues it needs all three leads
- **Date:** 2026-08-23
- **Author:** Butter (Team Nolan)
- **Supersedes:** none
- **Backlog item:** `TN-J3` (measurement), and proposes `TN-B1` (reporting surface)

## Context

This project exists to cut token spend. Its result is therefore **a number**, and right now two
things are true at once: nobody can produce that number, and two agents are about to need it for
different purposes.

**Where the two workstreams actually are.**

- **Path B (Jam, `TN-J4`)** has shipped. Step 1 (`26a191e7`) fixed a real `archetypes.ts` bug —
  424 → 428 files classified. Step 2 (`2e6a3e43`) built a 324-row LLM-labelled corpus across 13
  classes. Step 3 is deliberately paused on `TN-J10`.
- **Path A, measurement half (Butter, `TN-J3`)** has produced no number yet, by design: the only
  token evidence in the repo is six `.hench/runs/*.json` files dated `2026-02-04`, while
  `event-accumulator.ts` — the code that accumulates — landed `2026-04-21` in `0269cf75`. The
  evidence predates the mechanism by two and a half months. It does not show a broken counter; it
  shows **nobody has measured since February.**
- Jam's own summary of the gap, which prompted this ADR: *"Path B can currently demonstrate fewer
  LLM calls but cannot state tokens saved."*

**The finding that forces a decision rather than just a task.** Jam measured a real
`claude -p --output-format json` call on 2026-08-20:

```json
{"total_cost_usd": 0.081633,
 "usage": {"input_tokens": 2, "output_tokens": 4,
           "cache_creation_input_tokens": 7318, "cache_read_input_tokens": 14792}}
```

A trivial call costs **~7.3k cache-creation and ~14.8k cache-read tokens, and ~$0.08, before any
real prompt.** That is fixed overhead per invocation, not per token of prompt.

**Our reporting surface throws almost all of it away.** Verified by reading the code, not inferred:

- `packages/rex/src/cli/commands/usage.ts:43` — `const total = pkg.inputTokens + pkg.outputTokens;`
  Same at `:60` for the per-command breakdown.
- `packages/rex/src/core/item-token-rollup.ts:97-98` — accumulates `input` and `output` only. The
  type declares `cacheCreationInput` and `cacheReadInput` at `:207-208`, and nothing sums them;
  `:214-215` and `:223-224` read only the two.

Applied to Jam's payload, `ndx usage` would report **6 tokens out of 22,116 — 0.027%.** So the
question "what did we save?" cannot be answered correctly by the instrument we have, and the answer
we would get is not slightly wrong but wrong by three orders of magnitude.

**Why this needs a decision and not just a fix.** Two agents are about to publish numbers from
different sides of the same system. This project has already published a wrong baseline twice —
5.9% uniform-random, corrected to 19.6% majority-class, then moved again to 38.0% once the corpus
changed. Each correction had to be chased through several documents. A third incident, this time
on the headline savings figure, is the predictable outcome of two people measuring independently.

## Decision

**The avoided invocation is the unit of account.** We measure and report savings as *LLM calls
avoided*, and derive tokens and dollars from measured per-call cost — never by counting prompt
tokens, because per-spawn overhead dominates prompt size by roughly three orders of magnitude.
**Path A owns the instrument and publishes the number; Path B consumes it and does not derive its
own.** Every published savings figure carries a method block: repo and commit, exact command, seed,
baseline, date, and the committed script that produced it. Until Path A's instrument is verified
end to end, Path B reports **calls avoided** — which is deterministic and available today — and
reports no token or dollar figure at all, rather than an estimated one.

Concretely, the contract is four rules:

1. **One instrument, one owner.** Butter (`TN-J3`, then `TN-B1`) produces token measurements. Jam
   quotes them. If Jam needs a number Path A does not yet produce, that is a request to Path A, not
   a local calculation.
2. **Calls avoided is the primary metric and is publishable now.** It is a count, not an estimate,
   and Path B already has it — `ceil(unclassified / LLM_BATCH_SIZE)` before versus after the ELM
   tier.
3. **Tokens and dollars are derived, and only from measured per-call cost** including
   cache-creation and cache-read. A figure built from prompt tokens alone is not permitted, because
   we now know it understates by ~99.97%.
4. **Measured and extrapolated are labelled as such, in the same sentence as the number.** "3 calls
   avoided per analyze, measured" and "≈66k tokens per analyze, extrapolated from one measured
   call" are different claims, and only the first is a result.

## Alternatives considered

| Option | Why not |
|--------|---------|
| **Count prompt tokens only** (the obvious reading of "tokens saved") | Understates by ~99.97% on the one call we have measured. It would make a genuine win look like nothing and could get the whole project cancelled on a measurement artifact. |
| **Each path measures its own savings** | Produces two numbers that will disagree, on a project that has already had to chase a wrong baseline through multiple documents twice. The cost of reconciliation exceeds the cost of the contract. |
| **Block Path B from reporting anything until Path A lands** | Unnecessary and slow. Calls avoided is deterministic, already available, and honest. Path B should not idle behind a dependency it does not need for its primary claim. |
| **Report dollars as the headline** | Prices change and differ per vendor and per plan, so a dollar figure silently rots. Tokens are the stable unit; dollars are a derived convenience quoted with the price basis attached. |
| **Fix the rollup to sum all four token fields and move on, no ADR** | The summing question is real but secondary. Cache-read is not priced like input, so "total tokens" is a weighted question, not an addition — and *that* is a decision, not a bug fix. |

## Consequences

**Easier.** One number with one method. Path B can state progress today rather than waiting.
Anyone can re-run the instrument and get the same figure, which is the standing requirement in
`Command-Structure` § *The ELM-specific corollary*.

**Harder.** Path A must build a real instrument, not just root-cause a counter. `ndx usage` and
`get_token_usage` need to account for cache tokens, which is a change to a user-facing reporting
surface and its output shape — proposed as `TN-B1`, separate from `TN-J3`.

**We now have to maintain** the method block on every published figure, and a decision about how
cache-read is weighted against input for any "total tokens" claim. This ADR does not settle the
weighting; it settles that the weighting must be stated. See § Open question.

**Breaks nothing today** — no behaviour change is proposed here, only how we count and report.

**Other teams affected — and no, I have not sent the note yet.** This binds Path C (rex
granularity) and Path A's inference-wrapper half if Jarrett or Thomas take them, and it touches
`packages/rex/`, which is Path C's package. **Notes to Teams Jarrett and Thomas go out on
acceptance, not before** — broadcasting an unaccepted ADR as though it were settled is the
mislabelling this ADR exists to prevent. The ADR is on `Nolan-Work` now and visible to anyone who
merges. If the leads prefer it circulated as a proposal first, say so and I will send it same
session.

## Evidence

**This ADR makes no ELM-viability or accuracy claim.** It is a measurement-protocol decision, so
the accuracy-evidence requirements do not apply. The numbers it does rest on, with provenance:

**Measured by Jam, 2026-08-20, not independently reproduced by me.** The
`claude -p --output-format json` usage payload quoted in § Context (2 input / 4 output / 7,318
cache-creation / 14,792 cache-read / $0.081633), recorded in
`Nolan-Agents/Notes/NOTE-nolan-internal-2026-08-23-token-accounting-evidence.md` § 3. I have not
re-run it. It is a single observation of one trivial call and should be treated as establishing the
*shape* of the cost — fixed per-spawn overhead dominating prompt size — not a precise constant.
Re-measuring it across several real calls is step 1 of the IMPL.

**Verified by me, by reading the code at commit `1077c766`:**

- `rex/src/cli/commands/usage.ts:43` and `:60` sum `inputTokens + outputTokens` only.
- `rex/src/core/item-token-rollup.ts:97-98` accumulate `input`/`output` only; `:207-208` declare
  the two cache fields; `:214-215` and `:223-224` read only input/output.
- All six `.hench/runs/*.json` record `{"input":0,"output":0}` and are dated `2026-02-04`;
  `event-accumulator.ts` was added `2026-04-21` in `0269cf75`.
- `sourcevision/src/cli/commands/analyze.ts:201-210` writes `manifest.tokenUsage` only at end of
  run, gated on `ctx.tokenUsage.calls > 0` — confirming Jam's account of why their killed run left
  no manifest figure.

**The 0.027% figure** is arithmetic on Jam's payload: `(2+4) / (2+4+7318+14792)`.

**Not yet measured, and named so nobody quotes this ADR as though it were:** no fresh hench run
exists, no end-to-end observation of `accumulateTokenUsage` producing a non-zero persisted total,
and therefore **no statement in this ADR asserts that token accounting currently works or is
broken.**

## Open question for the leads

**How is a "total tokens" figure weighted?** Cache-read tokens are not priced as input tokens are,
so summing all four fields into one number is a choice with a cost consequence, not an arithmetic
step. Options: report the four components separately and never sum them; sum them with the price
weighting attached; or report cost as primary with tokens as detail. Path A will implement
whichever is chosen, but should not choose it alone — it determines what every savings claim in
this project means.
