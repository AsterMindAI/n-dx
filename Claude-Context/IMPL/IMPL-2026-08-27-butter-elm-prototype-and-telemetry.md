# IMPL — Script-tier ELM prototype, and closing the telemetry schema gap

- **Implements:** [`ADR-2026-08-27-butter-prove-before-provisioning.md`](../ADR/ADR-2026-08-27-butter-prove-before-provisioning.md)
- **Interface comes from:** [`ADR-2026-08-23-butter-elm-inference-module.md`](../ADR/ADR-2026-08-23-butter-elm-inference-module.md) § Decision 3 — unchanged
- **Owner:** Butter (Team Nolan)
- **Backlog items:** `TN-B3` (Lane 1, unblocked route) · `TN-B6` (Lane 2)
- **Branch:** `Nolan-Work-Butter` · **Worktree:** `/Users/nolanmoore/n-dx-butter`
- **Status:** Not started — **and, unlike the 08-23 IMPL, nothing here is gated on another lead**

> Anchors verified at `b442074e`. Numbers attributed to Jam are cited, not re-derived.

## Scope

**In scope:** a seeded, runnable ELM classifier prototype in `scripts/elm-prototype/` implementing
the interface the placement ADR already specified; and extending `CompletionResult` to carry the
per-call cost and turn count the vendor already returns.

**Out of scope, and this one matters:** **training the model on the corpus, reading the confusion
matrix, and deciding whether it is good enough.** That is `TN-B5`/`TN-J4` Step 3 and it is **Jam's**,
under the split agreed on 08-23. **I build the instrument; I do not grade the result, and I publish
no accuracy number.**

Also out of scope: promotion into `packages/llm-client` (blocked, and correctly — see ADR); wiring
into `classify.ts` (Jam's Path B Step 4); Path C (`TN-B4`); the `TN-B1` weighting decision.

## Files touched

| Path | Owning team | New/Edit | Note sent? |
|------|-------------|----------|------------|
| `scripts/elm-prototype/classifier.mjs` | Butter (Path A) | **New** — the wrapper | **announce in `IN-FLIGHT.md`** |
| `scripts/elm-prototype/config.mjs` | Butter (Path A) | **New** — charSet guard, seed, defaults | with the above |
| `scripts/elm-prototype/train-eval.mjs` | Butter (Path A) | **New** — harness Jam runs; prints, decides nothing | with the above |
| `scripts/elm-prototype/README.md` | Butter (Path A) | **New** — states it is temporary and why | with the above |
| `packages/llm-client/src/types.ts` | llm-client — **NOT one of the four shared provider files** | Edit — `CompletionResult` gains optional cost/turns | n/a |
| `packages/llm-client/src/cli-provider.ts` | Butter (claimed) | Edit — populate the new fields | n/a |
| `packages/llm-client/tests/unit/token-usage.test.ts` | Butter (claimed) | Edit — red-first tests | n/a |

**Not touched:** the four shared provider files; `packages/sourcevision/**` (Jam's, live);
`scripts/elm-corpus-build.mjs`, `scripts/elm-calls-avoided.mjs`,
`scripts/data/elm-archetype-corpus.json` (Jam's — **read only**); `pnpm-lock.yaml` and
`packages/llm-client/package.json` (the gated pair — **untouched until sign-off**).

## Lane 1 — the prototype (`TN-B3`, unblocked route)

### 1.1 Announce, then scaffold

`scripts/` is shared, so announce in `IN-FLIGHT.md` before adding files. A directory rather than one
file, so promotion is a move.

**`README.md` states in its first line that this is a temporary prototype, names the ADR, and says it
is deleted on promotion.** The ADR flags that script-tier prototypes become permanent; a file that
does not say what it is becomes permanent faster.

### 1.2 `config.mjs` — encode the traps as code, not comments

- **`charSet` is interpolated *unescaped* into a RegExp character class**, so a literal `-` must come
  **last** or it forms an invalid range and throws. **Assert it, and throw our own error naming the
  cause.** This is the one that will otherwise bite whoever passes a charSet from config later.
- **`useTokenizer: true` by default**, or `train()` throws on text.
- **Seed defaults to 42**, matching `elm-hello-world.mjs`, and is injectable. Unseeded means
  unreproducible, which the measurement contract forbids outright.
- Pin behaviour to `^3.0.0`. **v4 is tagged on GitHub, unpublished and breaking — do not chase v4.**

### 1.3 `classifier.mjs` — the interface from the placement ADR, exactly

```js
predict(text, topK)          // ordered best-first; maps onto secondaryArchetypes
classifyGated(text, threshold) // null below threshold — the fallthrough contract
train(rows)                  // [{ text, label }]
```

Written against the interface the placement ADR already fixed, so promotion is transcription. **The
probability is returned as a number and never rendered to a string** — the whole reason the ADR
rejected the registered-vendor route.

### 1.4 `train-eval.mjs` — the harness, which reports and decides nothing

Reads Jam's committed corpus (`train` 241 / `heldOut`), trains, predicts, and prints. Uses the
library's **`Evaluation` module rather than hand-rolled accuracy** — it returns `confusionMatrix`,
per-class precision/recall/F1/support, macro/micro/weighted averages, `logLoss` and `topKAccuracy`.

It **must print the 38.0% majority-class baseline next to any accuracy it prints**, and label the
figure **agreement-with-teacher**, never *accuracy* — the teacher is what `TN-J10` is about.

**It prints no verdict.** No pass/fail, no "clears the bar". Jam sets the bar and reads the matrix.

**If it shells out to `git` for provenance it will trip the `child_process` architecture rule** — the
one I re-broke on 08-23 after reporting it to Jam. **Check before committing, not after:**
`npx vitest run tests/e2e/architecture-policy.test.js`.

### 1.5 Hand it to Jam and stop

Note to Jam: the harness is runnable, here is the command, `TN-B5` is theirs. **Do not run the
experiment and report a number.** If Jam would rather I ran it, they will say so — but the default is
that the person who owns the corpus and the kill criterion owns the verdict.

## Lane 2 — `TN-B6`, the telemetry schema gap

Independent of Lane 1 and of `TN-B1`. Carrying a field is a separate question from deciding how to
total it.

### 2.1 The change

`CompletionResult` (`types.ts:82-87`) is `{text, tokenUsage?}`. The CLI envelope carries
`total_cost_usd` and `num_turns` on **every** call and the type has nowhere to put them — Jam's
framing, and sharper than my original "we never read it".

Add **optional** fields so no existing caller breaks:

```ts
export interface CompletionResult {
  text: string;
  tokenUsage?: TokenUsage;
  /** Vendor-reported cost for this call, when the provider supplies one. */
  costUsd?: number;
  /** Turns the provider took. 1 for a plain completion; >1 means an agent loop. */
  turns?: number;
}
```

Populate in `cli-provider.ts` where the envelope is already parsed (`parseJsonOutput`, alongside
`parseCliTokenUsage`). **Leave `api-provider.ts` alone this pass** — the API response has no
equivalent `num_turns`, and inventing one would be worse than leaving the field undefined.

### 2.2 Tests, red first

- Envelope with `total_cost_usd` and `num_turns` ⇒ both surface on `CompletionResult`.
- Envelope **without** them ⇒ both `undefined`, `tokenUsage` unaffected. Guards the optionality.
- **Watched go red** against the current type before the change. A green test nobody saw fail is
  indistinguishable from no test.

### 2.3 What this deliberately does NOT do

**It does not change any total, any report, or any dashboard number.** It makes the data reachable.
How cost and cache tokens are *weighted and displayed* is `TN-B1`, still blocked on a three-lead
call, and this IMPL does not pre-empt it.

## Test strategy

- **Unit (Lane 2):** as 2.2, red first.
- **Prototype (Lane 1):** the `charSet` guard is fix-shaped — assert our error fires, watched red.
  Determinism: same seed ⇒ identical predictions. Gate: `classifyGated` returns `null` below
  threshold.
- **Must stay green:** `pnpm typecheck`, and **`npx vitest run tests/` at the root** — *not*
  `pnpm test`, which stops at the first failing package and never reaches `tests/e2e/` (Jam's
  finding; it is why two runs reported 1991 and 1996 tests).
- **No accuracy number leaves this IMPL.** Any that ever does carries seed, baseline, corpus commit
  and the committed script.

## Rollback

- **Lane 1** is additive and imported by nothing: revert the commits. No on-disk state written.
- **Lane 2** is additive and optional: revert the commits. No consumer reads the new fields yet, by
  design — nothing downstream can break.
- **Neither lane touches `pnpm-lock.yaml`, `package.json`, `.sourcevision/`, `.rex/` or `.hench/`.**
  For the first time in this lane, "revert the commit" is genuinely sufficient for everything.

## Open questions

- **Promotion target** — `@n-dx/llm-client` or a new `@n-dx/elm`? Carried from the placement ADR,
  now decidable with a working prototype in front of the leads. **Blocks nothing until the ELM
  clears the bar.**
- **Does the prototype need `KernelELM` as well as `ELM`?** The plan is `ELM` on raw path strings
  (text-native). `KernelELM` needs a `TFIDFVectorizer` or `UniversalEncoder` in front because it has
  no tokenizer. **Jam's call**, since it is a modelling question and Jam owns the experiment.
- **If sign-off never arrives**, does the prototype stay in `scripts/` indefinitely? The ADR says
  delete-on-promotion, which assumes promotion happens. **If the leads go quiet and the ELM clears
  the bar, that is a decision to force, not to drift into.**
