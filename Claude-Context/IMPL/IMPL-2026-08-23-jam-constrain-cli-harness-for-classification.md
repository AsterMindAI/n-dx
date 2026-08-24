# IMPL — 2026-08-23 — Constraining the agent harness on classification calls

**Implements:** [`ADR-2026-08-23-jam-constrain-cli-harness-for-classification.md`](../ADR/ADR-2026-08-23-jam-constrain-cli-harness-for-classification.md)
**Owner:** Jam (Team Nolan) · **Backlog:** `TN-J17`
**Status:** Steps 0–1 ready to run. **No code lands until the ADR is accepted.**

## Scope

**Touches:** `packages/sourcevision/src/analyzers/claude-client.ts` and its tests. That is all.

**Does not touch:** any file in `packages/llm-client/**` (Butter's), `cli-provider.ts` in
particular. `cliFlags` is already on the public `CompletionRequest` (`types.ts:76`), so no
foundation change is needed. If that stops being true, stop and hand it to Butter.

## The measurement contract this runs under

Per [`ADR-2026-08-23-butter-savings-measurement-contract.md`](../ADR/ADR-2026-08-23-butter-savings-measurement-contract.md):
**calls are Path B's unit; tokens are Path A's.** This IMPL is unusual for me in that it *is* about
tokens — so every token figure here is either measured by Butter's `A4` harness or explicitly
labelled projected. **I do not derive token numbers independently.**

Baseline to beat (`A4`, n=3, CLI 2.1.231, AsterMind-CE @ `7a2d763`):
**53,553 – 267,952 tokens per classify call; prompt + completion = 5.12% of it.**

---

## Step 0 — Close the agentic-turns question (cheap, do first)

**Why first:** it decides whether flags can solve this at all. `--max-turns` does **not** exist in
2.1.231 print mode, so if classify calls are taking multiple agentic turns, flags cap the harness
but not the turns, and Alternative A (provider swap) becomes the real answer.

- [ ] Record `num_turns` and `total_cost_usd` from the CLI envelope in the baseline fixture. Both
      are present in every envelope today and neither is captured — Butter confirmed `num_turns` is
      absent from `scripts/data/elm-token-baseline.json`, and `CompletionResult` (`types.ts:82-87`)
      carries only `text` and `tokenUsage`.
- [ ] **Ownership check:** the envelope parse lives in `llm-client` — **Butter's**. Ask, don't edit.
      If they'd rather not, capture it in *my* baseline run by invoking the CLI directly rather than
      through the provider.

**Decision gate:** `num_turns > 1` on classify calls → flags alone are insufficient; record it in
the ADR and re-open Alternative A before writing any code.

## Step 1 — Measure the counterfactual (no product code)

- [ ] Take the three `A4` prompts verbatim from `scripts/data/elm-token-baseline.json`.
- [ ] Re-run each **twice**: once as today (`-p --output-format json --model`), once with the
      candidate flag set. Same binary (**2.1.231, the one on `PATH`** — not the VS Code extension's
      2.1.237; the two are not comparable and `A4` used 2.1.231).
- [ ] Candidate flags, all verified present in 2.1.231 `--help`:
      `--strict-mcp-config` (no `--mcp-config` ⇒ no MCP servers loaded) ·
      `--system-prompt <minimal>` · `--exclude-dynamic-system-prompt-sections` ·
      `--disallowedTools <all>` · `--no-session-persistence`
- [ ] **Interleave and repeat.** Cache state moves these numbers by >2x (Butter's three trivial
      probes spanned 22k–46k). Run A/B/A/B, report each pair, and **never report a single ratio.**

**Record:** per-call totals for both arms, `num_turns`, wall time, binary version, and the MCP
servers connected at run time. That last one matters — see ADR open question 3.

**Kill criterion (from the ADR):** flags recover **< 25%** of per-call cost ⇒ stop, publish the
negative, hand back to Alternative A.

## Step 2 — Land the flags (red-first)

Only if Step 1 clears the kill criterion.

- [ ] **Write the test first and watch it fail.** Assert that `callClaude` passes the expected
      `cliFlags` on the completion request. It must go red with a real assertion message before it
      goes green — a green test nobody has seen fail is indistinguishable from no test.
- [ ] Add the flags in `claude-client.ts:145-149`. Keep them a named exported constant with a
      comment pointing at this IMPL and at `A4`, so the next reader knows why they exist.
- [ ] **Scope them to classification only.** `callClaude` is shared with zone enrichment
      (`enrich-batch.ts:70,217`, `enrich-per-zone.ts:159`). Enrichment writes prose and may
      legitimately want more of the harness — so either thread flags through per call site, or
      apply globally *and say so explicitly here*. **Do not silently change enrichment's behaviour.**
- [ ] `pnpm typecheck` + `npx vitest run tests/` at the root. **Not `pnpm test`** — it aborts at
      `packages/rex`'s flaky 200-item perf test before reaching `tests/e2e/`.

## Step 3 — Verify the labels did not move

The risk the ADR names: if the harness was contributing to label quality, stripping it degrades
classification, and we would rather find that here than after an ELM is trained to match it.

- [ ] Re-run classification on **AsterMind-CE** with flags on, against the same commit the
      324-row corpus was built from.
- [ ] Diff the resulting archetypes against `scripts/data/elm-archetype-corpus.json`.
- [ ] **Report agreement, not accuracy.** The corpus teacher is itself inconsistent on the
      `service`/`utility` boundary that covers 74% of rows (`TN-J10`) — so this measures *did the
      labels change*, not *did they get better*. Any disagreement above a few percent is a finding
      that goes to the leads before the flags ship.

## Step 4 — Re-baseline Path B, honestly

- [ ] Re-run `node scripts/elm-calls-avoided.mjs . ~/n-dx-elm-corpus/AsterMind-Community-Edition`.
      **Expect the call counts to be unchanged** — this IMPL changes what a call *costs*, not how
      many there are. If they move, something is wrong.
- [ ] Update the instrument's header citation from `A4`'s 53k–268k to the post-flag range, marked
      with its own `n` and binary.
- [ ] **State the consequence plainly wherever Path B's prize is quoted**: an avoided call is now
      worth materially less. Do not let the old figure survive in a document.
- [ ] Redeploy the `SYNC-001` artifact — it still carries a stat tile reading
      **"0 — Tokens we can currently measure"**, which `955d9c59` already made false. It lives
      outside the repo; no grep will ever find it.

## Step 5 — Hand the general case to Butter

- [ ] Write up whether the flags belong in `cli-provider.ts` as a "completion mode" for every
      caller. **Their file, their call.** Include what this measured, and flag that hench's agent
      loops genuinely need the tools that classification does not — a global default would be the
      wrong shape.

---

## Risks

| Risk | Mitigation |
|---|---|
| **Flags change output quality** | Step 3 diffs against the corpus before shipping. |
| **`--system-prompt` breaks JSON output** | Step 1 measures on real prompts and inspects the response, not just the token count. |
| **Numbers are machine-specific** (MCP servers connected here are personal — Gmail/Drive/Calendar) | Record the connected set with every measurement. Raised as ADR open question 3; may block publishing externally. |
| **Cache state swamps the signal** | Interleaved A/B/A/B, per-pair reporting, no single ratio. |
| **Enrichment regresses silently** | Step 2 forbids changing enrichment behaviour without saying so. |
| **I am measuring my own path's competitor** | The ADR states the consequence up front: this shrinks Path B's prize by ~an order of magnitude, and that outcome is legitimate. |

## What would make me abandon this

- `num_turns > 1` and no way to cap it in 2.1.231 print mode (Step 0).
- Flags recover < 25% of per-call cost (Step 1).
- Label agreement drops materially against the corpus (Step 3).

Any of those, and the answer is Alternative A — swap the call site to `api-provider` — which is
Butter's territory and needs an API key this machine does not have.
