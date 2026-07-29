# PRD: Fix sourcevision test-suite hang under `< /dev/null` (vitest fork-pool zombies)

> **For the implementer.** This is the implementation spec for GitHub issue
> [#129](https://github.com/en-dash-consulting/n-dx/issues/129). Feed it to rex to
> generate the PRD tree, then execute with the n-dx workflow:
>
> ```bash
> ndx add --file=docs/specs/issue-129-test-suite-hang.md .
> ndx work .
> ```
>
> Ensure no other PRD writer (`ndx start` / `work` / `plan`) is running against
> `.rex/prd_tree/` when you import (see the concurrency contract in CLAUDE.md).
> Scope note: the broader test-quality standard is tracked separately in
> [#319](https://github.com/en-dash-consulting/n-dx/issues/319) and is **out of
> scope** here.

Type: Bug / reliability
Priority: High
Source: GitHub issue #129

## Problem

When `pnpm test` runs with stdin redirected from `/dev/null` (the pattern Claude
Code's background-task runner uses), vitest **fork** workers in the sourcevision
package hang at ~100% CPU and never exit. They accumulate as zombie processes
across runs, starving CPU, which makes subsequent test runs appear to hang. That
apparent hang is what drove the hench agent into repeated long-timeout
`TaskOutput` polling / `TaskStop` / re-run cycles, burning tokens and wall-clock
time. The suite must complete RELIABLY under this invocation — the goal is NOT to
skip tests.

## Already fixed in `main` — DO NOT redo

- `packages/sourcevision/tests/e2e/cli-serve.test.ts` already spawns its
  long-running server with `stdio: ["ignore","pipe","pipe"]` + `detached: true`
  (own process group) and tears it down with a `killTree()` helper
  (`process.kill(-pid,"SIGTERM")` → `SIGKILL`) in `afterEach`. This one-line-class
  fix was confirmed INSUFFICIENT on its own — the fork pool itself is the culprit.

## Root cause to address

No package sets a vitest `pool` strategy — all 5 default to `forks`. Forked
workers inherit the closed `/dev/null` stdin and orphan. Hench also lacks a
process-group teardown for the provider it spawns, so background test
grandchildren can survive.

## Tasks

### Task 1 — Configure sourcevision vitest so fork workers cannot orphan under `< /dev/null`

Pick and implement one strategy in `packages/sourcevision/vitest.config.ts`:
`pool: "threads"`, OR `pool: "forks"` with `poolOptions.forks.singleFork: true`,
OR an explicit stdin/handle fix. Document the choice and trade-off in a code
comment. Decide and state whether the strategy should be applied monorepo-wide
(rex/hench/llm-client/web) or sourcevision-only.

Acceptance criteria:
- Running the sourcevision suite with stdin redirected from `/dev/null` completes
  and exits cleanly, leaving no `vitest/dist/workers/forks.js` processes alive.
- No pre-existing sourcevision test is broken by the pool change.

### Task 2 — Regression guard for the `/dev/null` hang

Add a test (or CI script) that invokes the sourcevision suite with stdin from
`/dev/null` and asserts it terminates within a bounded timeout with no surviving
fork workers. Must be deterministic and self-contained.

Acceptance criteria:
- The guard fails if the pool mitigation is reverted.
- The guard leaves no orphaned processes.

### Task 3 — Hench provider process-group teardown (defense-in-depth)

In `packages/hench/src/agent/lifecycle/cli-loop.ts`, spawn the CLI provider in its
own process group (`detached`) and, on abort / plan-mode intercept / close,
tree-kill the group (`process.kill(-pgid, "SIGTERM")` then escalate to `SIGKILL`)
instead of the current single-PID `proc.kill("SIGTERM")`. Preserve existing
plan-mode-intercept and exit-code behavior.

Acceptance criteria:
- Killing a hench provider run terminates its descendant processes; no orphans.
- Existing cli-loop unit tests (plan-mode intercept, close-error formatting) stay
  green.

## Constraints

- TDD: write failing tests first (red → green) for each task where practical.
- Tests must be atomic and isolated — no reliance on outside state or on another
  test/suite having run first; restore any env/process changes in teardown.
- No non-deterministic fixtures — no `Math.random()` or wall-clock values baked
  into assertions; seed any pseudo-random data so deep-equals can be used.
- Respect tier boundaries (orchestration spawns; hench/web use gateways). No new
  cross-package imports outside gateways.
- Do not regress recently landed work; keep `pnpm typecheck` green across
  packages (modulo the pre-existing Windows CRLF/path flakes tracked in #301).
- Out of scope: change-scope test skipping, validation budget, and the broader
  test-quality standard (tracked separately in #319).
