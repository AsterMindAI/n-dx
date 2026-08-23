# IMPL — Token measurement, the reporting surface, and the Path A ↔ Path B seam

- **Implements:** [`ADR-2026-08-23-butter-savings-measurement-contract.md`](../ADR/ADR-2026-08-23-butter-savings-measurement-contract.md)
- **Owner:** Butter (Team Nolan) — Lane A. **Lane B is proposed for Jam, not assigned to them.**
- **Backlog items:** `TN-J3` (measurement, claimed by Butter) · `TN-B1` (reporting surface, proposed)
- **Branch:** `Nolan-Work-Butter` · **Worktree:** `/Users/nolanmoore/n-dx-butter`
- **Status:** In progress — Lane A step 1 starting

> Facts below are verified at `file:line` against `1077c766` unless attributed to Jam, which is
> marked inline. Jam's figures are cited, not re-derived — re-measuring them is step A1.

## Scope

**In scope:** getting one trustworthy end-to-end token observation; root-causing the chain if it
reads zero; making the reporting surface account for cache tokens; a committed, re-runnable
measurement script; and the working agreement that keeps two agents out of each other's files.

**Out of scope (explicitly):** the ELM tier itself (`TN-J4`, Jam's); the gold-set question
(`TN-J10`, three leads); Path C; Path A's other half, the shared ELM inference wrapper; and any
change to how classification behaves. **Nothing in this IMPL changes what the tool does — only
what it counts and what we report.**

## Files touched

| Path | Owning team | New/Edit | Note sent? |
|------|-------------|----------|------------|
| `packages/llm-client/src/token-usage.ts` | Butter (Path A) | Edit — only if A3 finds a break | n/a |
| `packages/hench/src/agent/lifecycle/event-accumulator.ts` | Butter (Path A) | Edit — only if A3 finds a break | n/a |
| `packages/rex/src/cli/commands/usage.ts` | **rex — Path C's package, unclaimed** | Edit `:43`, `:60` — cache-aware totals | **Required before A5** |
| `packages/rex/src/core/item-token-rollup.ts` | **rex — Path C's package, unclaimed** | Edit `:97-98` — accumulate cache fields | **Required before A5** |
| `packages/rex/tests/**` (rollup + usage) | rex | Edit — red-first tests for A5 | with the above |
| `scripts/elm-token-baseline.mjs` | shared `scripts/` | **New** | **announce in `IN-FLIGHT.md`** |
| `scripts/data/elm-token-baseline.json` | shared `scripts/` | **New** — fixture with provenance | with the above |
| `Claude-Context/**` (this IMPL, charter, boards) | Butter | Edit | n/a |

**Not touched by Butter, at all:** `packages/sourcevision/src/analyzers/**`,
`scripts/elm-corpus-build.mjs`, `scripts/data/elm-archetype-corpus.json` — Jam's, live.
**`.n-dx.json` is not touched** — see the `PATH` rule in A1.

## Lane A — Butter (`TN-J3`, then `TN-B1`)

### A1. The cheapest end-to-end observation, first

Jam's near-miss (their note § 4) is a better first step than my own plan, and I am taking it: it is
~3 classify batches on 114 files, it exercises `accumulateTokenUsage` for real, and
`sourcevision/src/cli/commands/analyze.ts:201-210` writes `manifest.tokenUsage` at end of run —
**gated on `ctx.tokenUsage.calls > 0`, and only if the run completes.** Jam killed theirs early,
which is why their manifest had no token fields; that is an early kill, not a zero counter.

```sh
export PATH="/Users/nolanmoore/.vscode/extensions/anthropic.claude-code-2.1.237-darwin-arm64/resources/native-binary:$PATH"
node packages/sourcevision/dist/cli/index.js analyze ~/n-dx-elm-corpus/AsterMind-Community-Edition --full
```

**Rules for this step, all of them Jam's findings and all of them load-bearing:**

- **`PATH` per run. Never `ndx config llm.claude.cli_path`.** `.n-dx.json` is committed and on the
  shared "nobody edits unilaterally" list, and that path is machine- *and* extension-version-
  specific (`2.1.237`) — persisting it breaks Jarrett and Thomas immediately and Nolan on the next
  extension update.
- **Let it run to completion**, or the manifest is never written and the run is wasted.
- **Do not stage anything in the session scratchpad.** `/private/tmp` reaped Jam's corpus clone
  mid-session, leaving a directory husk and a silent `0 files cataloged` run that looked exactly
  like a regression. Durable clones live in `~/n-dx-elm-corpus/`.
- Run from **my worktree**, so `.sourcevision/` writes cannot collide with Jam's.

**Exit condition:** `manifest.tokenUsage` either holds a non-zero total — in which case the
five-month-old "token accounting reads zero" premise is dead and gets retracted everywhere it
landed — or it holds zeros, and A3 has a narrowed search.

### A2. The hench path, separately

`TN-J3` is about `.hench/runs/*.json`, and A1 exercises **sourcevision's** accumulator, not
hench's. They are different code paths and one passing does not clear the other. One hench run in
my worktree, then read the resulting run file.

**`.hench/runs/` is gitignored (`.gitignore:5`)** — the six existing files are tracked only because
they predate the rule. **Any run I produce will not commit**, which is why A6 exists.

### A3. Root-cause, only if A1 or A2 reads zero

The chain is `parse → accumulate → persist`. Known-good ends:

- **Parse is wired in:** `llm-client/src/cli-provider.ts:37` imports `parseCliTokenUsage` /
  `parseStreamTokenUsage`; called at `:348`, `:357`, `:378`.
- **Accumulate exists:** `hench/src/agent/lifecycle/event-accumulator.ts:445-446` sums
  input/output, `:457`/`:461` handle the cache fields, `:532-536` is a zero-fallback.
- **The source is healthy** — Jam's 2026-08-20 payload proves the CLI emits usage on current code,
  so "the provider returns nothing" is ruled out before I start.

So the unread middle is **persist**. Start there, not at the parsers.

### A4. Re-measure the per-call overhead

Jam's payload is **one observation of one trivial call**. It establishes the *shape* — fixed
per-spawn overhead dominating prompt size — not a constant. Measure ≥3 real classify calls and
report a range, not a point. This number is what converts Lane B's calls-avoided into tokens.

### A5. `TN-B1` — make the reporting surface count what is actually spent

Verified defect, and the reason the ADR exists:

- `rex/src/cli/commands/usage.ts:43` — `const total = pkg.inputTokens + pkg.outputTokens;`, same at
  `:60`.
- `rex/src/core/item-token-rollup.ts:97-98` — accumulates `input`/`output` only. The cache fields
  are **declared** at `:207-208` and summed nowhere; `:214-215`, `:223-224` read only the two.

On Jam's payload that reports **6 of 22,116 tokens — 0.027%**.

**Blocked on the ADR's open question** (how a total is weighted, since cache-read is not priced
like input) **and on a note to Jarrett/Thomas**, because `packages/rex/` is Path C's package.
Do not start A5 before both. A1–A4 do not depend on it.

### A6. A committed way to re-check this

`.hench/runs/` is ignored, so an observation on my machine vanishes. `scripts/elm-token-baseline.mjs`
plus a provenance-carrying fixture, modelled on `scripts/elm-corpus-build.mjs` — which already does
exactly this for the corpus and is the pattern to copy rather than reinvent. Without it the next
person is back to six files from February.

### A7. Publish, and retract the stale claim where it landed

Publish with the method block the ADR requires. Then correct *"the project has no way to measure
token usage"* everywhere it landed — `SYNC-001` § 5 item 5, `ADR-2026-08-11-jam-elm-replacement-survey-and-split.md`,
and `IMPL-2026-08-13-jam-elm-classification-build.md` § Open questions. **I hold `TN-J3`, so this
is mine to correct, not Jam's** — Jam offered and does not need to.

## Lane B — proposed for Jam (`TN-J4`), not assigned

Jam owns Path B and their own sequencing. This lane is what the ADR's contract asks of Path B, put
plainly so it can be agreed or pushed back on rather than assumed:

- **B1. Publish "calls avoided" now.** It is `ceil(unclassified / LLM_BATCH_SIZE)` before versus
  after the ELM tier — a count, not an estimate, and available today. Under the ADR this is Path
  B's *primary* claim and does not wait on me.
- **B2. Hand Path A the before/after call counts** as a committed number with the repo and commit
  they came from. That is the input that converts to tokens; without it, my per-call figure has
  nothing to multiply.
- **B3. Do not derive token or dollar figures locally** — route them to Path A. Not a competence
  question: it is that two independently-derived numbers is exactly how the 5.9% → 19.6% → 38.0%
  baseline confusion happened, three times, on this project.
- **B4. `TN-J4` Step 3 is unaffected** by any of this and stays paused on `TN-J10` — the gold-set
  question is a three-lead call and nothing here touches it.

## The seam — how two agents stay out of one repo's way

| Rule | Butter | Jam |
|---|---|---|
| `packages/sourcevision/src/analyzers/**` | never | owns |
| `packages/llm-client/src/{token-usage,cli-provider,api-provider}.ts` | owns | never |
| `packages/rex/**` (usage, rollup) | edits at A5, after a note | never |
| `scripts/elm-corpus-build.mjs`, `scripts/data/elm-archetype-corpus.json` | never | owns |
| `scripts/elm-token-baseline.mjs`, its fixture | owns | never |
| `Claude-Context/IN-FLIGHT.md`, `BACKLOG.md` | claim rows only | claim rows only |

- **Both of us write to `scripts/`.** Different files, but announce in `IN-FLIGHT.md` before adding
  one, per the shared-directory rule.
- **Numbers flow one way.** Path A publishes; Path B quotes by filename. If Jam needs a figure I do
  not produce, that is a request to me, not a local calculation.
- **Notes, not edits, across the seam** — and per `TN-F3`, a note is delivered by **merging**, not
  by writing. Both lanes merge to `Nolan-Work` promptly, or the other lane cannot see it.
- **Worktrees:** Butter is isolated at `/Users/nolanmoore/n-dx-butter`; Jam and Fluff share
  `/Users/nolanmoore/n-dx-1` on `Nolan-Work`. `.sourcevision/` and `.hench/` writes therefore
  cannot collide between Butter and Jam. They still can between Jam and Fluff.

## Test strategy

- **Unit (A5):** the rollup must account for `cacheCreationInput` / `cacheReadInput`. **This is a
  fix, so the test is written first and watched go red** against `item-token-rollup.ts:97-98` — a
  green test nobody has seen fail is indistinguishable from no test.
- **Unit (A3, if a break is found):** same rule — red first, at the specific broken step.
- **Integration:** `ndx usage --format=json` output shape, since the dashboard may consume it —
  see § Open questions.
- **Must stay green:** `pnpm typecheck`, `pnpm test`, `tests/e2e/domain-isolation.test.js`,
  `tests/e2e/architecture-policy.test.js`.
- **Every figure** carries seed, baseline, command, repo and commit, in a committed script another
  team can run.

## Rollback

**A5 (code):** revert the commit. It changes reporting only, so nothing downstream of behaviour
changes — but if the JSON shape changed, anything reading it must be checked first.

**A1/A2 (state) — revert is not sufficient**, the same trap `IMPL-2026-08-13-jam-…` documents:

1. `.sourcevision/manifest.json` and `classifications.json` in my worktree are rewritten by A1.
   They are worktree-local, so the shared checkout is untouched — but re-run `analyze --full` or
   delete them rather than assuming a git revert cleaned up.
2. `.hench/runs/*.json` written by A2 are **gitignored and therefore untracked** — `git checkout`
   will not remove them. Delete by hand.
3. Never `git add -A`: the six tracked February run files must not be overwritten or deleted, since
   they are the only historical record and `TN-J3`'s original evidence.

## Open questions

- **How is a "total tokens" figure weighted?** Cache-read is not priced as input, so summing the
  four fields is a decision, not arithmetic. **Three-lead call; blocks A5, not A1–A4.** Carried from
  the ADR.
- **Does anything consume `ndx usage --format=json` today?** If the web dashboard reads the current
  shape, A5 is a breaking change and needs a compatible shape or a coordinated update. **Unverified
   — I have not checked, and A5 does not start until I have.**
- **Is Lane B agreed?** It is proposed. Jam may reasonably want B2 scoped differently, and their
  sequencing is theirs.
- **`TN-J10`** (hand-labelled gold set) is unresolved and unrelated to this IMPL. Flagged so it is
  not mistaken for something this work unblocks — it is not.
