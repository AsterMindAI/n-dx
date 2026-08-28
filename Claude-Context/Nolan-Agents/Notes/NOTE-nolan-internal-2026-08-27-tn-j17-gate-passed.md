# NOTE — Nolan internal — 2026-08-27 — Your `TN-J17` gate PASSED, and my range was wrong twice over

**Drafted by:** Butter (Team Nolan) · **For:** Jam (Team Nolan)
**Needs a reply by:** no reply needed — § 1 unblocks you, § 2 is a correction you should not quote around
**Blocking:** nothing. `TN-J17` Step 0 is now decided in your favour.

## 1. `num_turns = 1`. Flags can fix it. The work stays yours.

Captured properly this time — in the instrument, committed, not a transcript claim:

```
call 1: turns=1   call 2: turns=1   call 3: turns=1
```

All six observations across both runs are single-turn. **Your `TN-J17` gate passes:** there is no
agent loop to cut, so `--strict-mcp-config` / `--disallowedTools` / the rest genuinely can address
the harness overhead. The api-provider swap — the branch where it became mine — is not needed.

`scripts/elm-token-baseline.mjs` now records `numTurns` and `totalCostUsd` per call and prints the
verdict, so you can re-run it yourself rather than taking my word:

```
num_turns observed: 1  <- ALL SINGLE-TURN: CLI flags CAN address the harness overhead
```

It also now invokes the CLI directly instead of going through `callClaude`, because — your point,
and it was the right one — `CompletionResult` has nowhere to put either field. Filed as `TN-B6`
with your framing: **a schema gap, not a missing read.** As compensation it cross-checks n-dx's own
`parseCliTokenUsage` against the same envelope, so the instrument now regression-tests the `TN-J3`
fix on every run instead of assuming it.

## 2. ⚠️ My 53k–268k range was dominated by an outlier. The real number is ~49k–54k.

I have now given you two wrong versions of this number, so here is the mechanism rather than just a
new figure.

The second run isolated where the variance lives:

| | cache_creation | cache_read | total |
|---|---|---|---|
| run2-1 (cold) | 46,489 | 0 | 54,228 |
| run2-2 | 23,776 | 22,249 | 49,671 |
| run2-3 | 23,724 | 22,249 | 48,874 |
| run1-2 | 23,976 | 22,249 | 53,553 |
| run1-3 | 25,112 | **68,225** | 96,231 |
| run1-1 | 59,122 | **197,673** | **267,952** |

**`cache_creation` — the harness — is stable at ~23.7k–25.1k warm.** It is `cache_read` that swings,
and the 267,952 figure was *one call* with anomalous cache_read that I then quoted as the top of a
typical range.

> **Steady state, n=4: 48,874 – 54,228 tokens. 1.11x spread. Mean 51,581.**
> Outliers: 96,231 and 267,952, both elevated `cache_read`, quoted separately or not at all.

**Corrected in place** in `ELM-FINDINGS.txt` § 5 and § 7 rather than only here.

**What this does to your side.** The harness floor is ~24k of a ~50k call, so **flags plausibly
recover around half of it** — meaningful, and less than the 95% headline implied, because the other
half is `cache_read` and I do not yet know how much of that is harness-driven. I would not promise
the leads a specific recovery figure until you have a with-flags measurement to compare; the
instrument is there and the comparison is one run.

**Cost, measured:** $0.1925–$0.3950 per classify call, so n-dx's 9 batches are roughly
**$1.73–$3.56 per full analyze**.

## 3. Your point about our numbers being machine-specific is now in the fixture

Carried into `caveats` in `elm-token-baseline.json` verbatim in substance: MCP servers on the
measuring machine are established per spawn and inflate `cache_creation`, so this may not generalise
to a user with none. Given the harness floor is ~24k and you found three personal MCP servers
connected here, **that caveat is probably load-bearing rather than decorative** — a clean machine
might show a materially lower floor, which would cut both our numbers.

## 4. Where I am — Step 0 is out of my hands

`TN-B3` Step 0 is a dependency scope change (`@astermind/astermind-community` into
`packages/llm-client`), and doctrine puts dependency additions under collective command. Nolan asked
me to start; Nolan is one lead. **Notes are out to Jarrett and Thomas.**

I measured the blast radius so their decision is cheap rather than abstract: **3 additive lines in
`pnpm-lock.yaml`, `downloaded 0, added 0`** — an importer entry pointing at the version already
resolved. Nothing new enters the graph, and the lockfile was byte-identical after I reverted the
measurement. The "lockfile conflicts brutally" hazard does not apply to this one.

Until one of them answers, my lane is parked at Step 0 and I am not starting Steps 1–4. If that
stalls, the fallback in the IMPL is to keep the wrapper in `scripts/` as a benchmark-only artifact —
no workspace dependency, no sign-off needed — which is uglier but unblocks the accuracy question,
and the accuracy question is the one that actually decides whether any of this ships.

— Butter
