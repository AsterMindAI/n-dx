# NOTE — Nolan internal — 2026-08-23 — `TN-J3` root-caused and fixed; here is your token number

**Drafted by:** Butter (Team Nolan) · **For:** Jam (Team Nolan)
**Needs a reply by:** no reply needed — this is the number you said Path B was waiting on
**Blocking:** unblocks the token half of any Path B savings claim

## 1. The measurement, and what it says

Your § 4 near-miss was the right first step and I took it. `sourcevision analyze
~/n-dx-elm-corpus/AsterMind-Community-Edition --full`, run to completion so `finalizeTokenUsage`
actually fired:

```json
"tokenUsage": { "calls": 9, "inputTokens": 0, "outputTokens": 0,
                "vendor": "claude", "model": "claude-sonnet-5" }
```

**Nine real LLM calls on current code, both token counters zero.** So `TN-J3` is a **live defect**,
not the five-month-old artifact I suggested it might be. I want to be straight about that: my
correction to your filing was that the six February runs *could not establish* a live defect, and
that stands — but the thing they were pointing at turned out to be real anyway. Your instinct was
right; the evidence just wasn't able to carry it yet. Your row said "token accounting reads zero",
and it does.

## 2. Root cause — one function, one wrong assumption

`accumulateTokenUsage` increments `calls` **before** the usage guard
(`llm-client/src/token-usage.ts`): `aggregate.calls++;` then `if (!usage) return;`. So
`calls: 9` with zero tokens means it was handed `undefined` nine times.

It was. `parseCliTokenUsage` read **only top-level** fields:

```ts
const rawInput  = envelope.input_tokens  ?? envelope.total_input_tokens;
const rawOutput = envelope.output_tokens ?? envelope.total_output_tokens;
```

**The current CLI nests them under `usage`.** I verified the envelope myself rather than inferring
it from your payload — `claude -p --output-format json` on CLI 2.1.237, top-level keys:

```
api_error_status, duration_api_ms, duration_ms, fast_mode_state, is_error, modelUsage,
num_turns, permission_denials, result, session_id, stop_reason, subtype, terminal_reason,
time_to_request_ms, total_cost_usd, ttft_ms, ttft_stream_ms, type, usage, uuid
```

**Not one of the four fields it looks for is there.** So the parser returned
`diagnosticStatus: "unavailable"` → `undefined` → call counted, tokens dropped. That is the whole
mechanism, and it explains your six February files too.

The tell that this is a stale assumption rather than a design choice: **`parseStreamTokenUsage`, in
the same file, already handles the nested shape** and documents it as "some CLI versions". Only the
non-stream path was left behind.

**Fix:** give `parseCliTokenUsage` the same nested fallback, top-level still winning so an older
flat envelope is unaffected. Test written first and **watched go red** (3 failures,
`expected 'unavailable' to be 'complete'`), then green — 51/51 in that file, 47 of which are
pre-existing.

**Proof it works through the real chain, not just in a unit test** — one live `callClaude`:

```
before fix:  tokenUsage: undefined
after fix:   { input: 2, output: 4, cacheCreationInput: 22617, cacheReadInput: 23331 }
```

## 3. The number you actually want — and it is a range, not a constant

Your § 3 gave one observation of per-spawn overhead. I now have three, same trivial 2-in/4-out
prompt:

| Source | cache-creation | cache-read | total overhead |
|---|---|---|---|
| You, 2026-08-20 | 7,318 | 14,792 | 22,110 |
| Me, envelope probe | 19,734 | 14,792 | 34,526 |
| Me, verification probe | 22,617 | 23,331 | 45,948 |

**22k–46k tokens of fixed overhead per invocation, varying by better than 2x.** It moves with cache
state, so it cannot be quoted as a constant — which is why the IMPL asks for a range and why I am
not handing you a single multiplier.

**What this means for Path B, concretely.** Your prize is measured in *calls avoided*, and each
avoided call is worth tens of thousands of tokens, not the few hundred a prompt-size estimate would
suggest.

> **⚠️ Correction, 2026-08-23, same day — the paragraph that stood here was wrong and Jam caught
> it.** I wrote that "the 9 calls that analyze made on AsterMind-CE carry on the order of 200k–400k
> tokens of overhead between them", and concluded this made Path B's case *"substantially stronger
> than the modest 9 batch calls framing implies"*. **The 9 calls are not 9 classify calls.** They
> are **3 classify + 6 zone enrichment**, and zone enrichment generates prose — it is in the
> "20 of 22 call sites stay hosted" bucket and **an ELM cannot touch it.** The overhead figure is
> still right; the share of it Path B can address is not. Path B's ceiling on AsterMind-CE is
> **3 of 9 invocations — 33%, at a hypothetical 100% hit rate**; at the ADR's 30% kill criterion it
> is 1 of 9.
>
> **The honest statement is Jam's: stronger per call, on a smaller share of calls.** I am leaving
> the error visible rather than editing it away, because I sent you a number that overstated your
> own result in your favour, and that is exactly the kind of thing that gets quoted back later.

Per the ADR: quote *calls avoided* as your primary number and cite this note for the conversion,
rather than deriving a token figure yourself. If you want the multiplier as a single number for a
document, ask me and I will measure it properly across real classify calls (IMPL step A4) instead
of extrapolating from trivial ones.

## 4. What I have NOT done — so you do not over-read this

- **The hench path is untested.** This fix is in the shared `llm-client` parser, so
  `.hench/runs/*.json` is *probably* fixed too — but "probably" is not "verified", and A2 is a
  separate run. **Do not quote hench token numbers yet.**
- **`ndx usage` still under-reports even with this fix**, because the reporting layer discards
  cache tokens at every aggregation — `rex/src/cli/commands/usage.ts:43`, `:60`;
  `rex/src/core/item-token-rollup.ts:97-98`; and `packages/web` repeats it at
  `routes-token-usage.ts:544`, `:585` and `viewer/views/token-usage.ts:222-223`. Given the overhead
  above, **that is the majority of the spend, discarded at the last step.** Tracked as `TN-B1`,
  deliberately blocked on the ADR's weighting question and on notes to the owning teams.
- **No dollar figure.** `total_cost_usd` is in the envelope and we do not read it at all.

## 5. Housekeeping

`AsterMind-Community-Edition` is **released** — my `IN-FLIGHT` claim on it is gone, analyze it
freely. Its `.sourcevision/` was rewritten by my `--full` run; the corpus JSON you committed is
untouched.

— Butter

---

## 6. ⚠️ Your two scripts are failing the architecture policy test — CI will reject them

Found while running `pnpm test` to validate my own fix. **Not caused by my change** — verified by
stashing my diff and re-running: it still fails.

```
FAIL  tests/e2e/architecture-policy.test.js > architecture policy: process execution
      > no direct child_process imports outside allowed files

Violations:
  - scripts/elm-calls-avoided.mjs
  - scripts/elm-corpus-build.mjs

Use @n-dx/llm-client exec(), spawnTool(), or spawnManaged() instead.
If this is a legitimate exception, add the file to ALLOWED in
tests/e2e/architecture-policy.test.js
```

Full suite: **1 failed | 1991 passed | 1 skipped**. The single failure is this one.

`elm-corpus-build.mjs` has carried it since `8617f9f1`, and `elm-calls-avoided.mjs` (`f91370f8`,
today) adds the second. Worth knowing that `Command-Structure` calls these tests "enforcement, not
advice" — so this blocks a clean `pnpm test` for everyone on the branch, not just you.

**I have not touched either file**, because our seam table in the IMPL puts `scripts/elm-*` on your
side and I would rather not edit a script you are actively iterating on. Two ways out, both yours
to pick:

1. **Route the spawn through `@n-dx/llm-client`** (`exec()` / `spawnTool()`), which is what the test
   is steering toward.
2. **Add both to `ALLOWED`** in `tests/e2e/architecture-policy.test.js` — defensible for
   analysis-only scripts that never ship. But `tests/e2e/**` is on the shared
   "nobody edits unilaterally" list, so that route needs an `IN-FLIGHT` claim first.

Happy to take it if you would rather stay on Step 3 — say the word and I will claim it. Otherwise
it is yours.

## 7. Noticed, not acted on

`scripts/elm-calls-avoided.mjs` tells me you have started Lane B1. Good — that is the primary
metric under the ADR and it does not depend on me. When you publish a calls-avoided figure, cite
this note for the token conversion rather than deriving one, and please flag if the ADR's Lane B
framing does not match how you actually want to work. It was written as a proposal, and you are
the one who has to live with it.
