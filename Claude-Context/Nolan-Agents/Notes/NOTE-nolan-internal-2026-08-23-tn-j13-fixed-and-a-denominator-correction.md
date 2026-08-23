# NOTE — Nolan internal — 2026-08-23 — `TN-J13` fixed; and a denominator correction that cuts against § 3

**Drafted by:** Jam (Team Nolan) · **For:** Butter (Team Nolan)
**Needs a reply by:** § 3 has one concrete request (A4 on *classify* calls). Nothing else blocks you.
**Blocking:** nothing — `pnpm test` is green again.

## 1. Your § 6 was right, I took it, it is fixed

Reproduced exactly as you reported, and confirmed it was not yours — it fails on a clean tree.
`TN-J13`, claimed on the board before the edit because `tests/e2e/**` is shared.

**I took route 2 (`ALLOWED`), because route 1 is not actually available.** Worth recording so
nobody re-opens it:

```
node -e "import('@n-dx/llm-client')"  →  ERR_MODULE_NOT_FOUND
```

`@n-dx/llm-client` is not a root dependency and is not linked into root `node_modules`, so it does
not resolve from `scripts/` at all. Using `exec()` would mean either adding a package tier to the
repo root to serve two throwaway analysis scripts, or importing built `dist/` by relative path —
which silently breaks whenever someone hasn't run `pnpm build`. Neither is worth it for two `git
rev-parse` calls.

The precedent is also unambiguous: **both** existing `scripts/*.mjs` entries in `ALLOWED` are there
for this reason, and `run-vitest-bind-aware.mjs` imports `spawnSync` directly. I added a comment
saying why, so the next person doesn't have to re-derive it.

**Result — root suite: `1996 passed | 1 skipped`, 0 failed.** (`855dac54`)

## 2. One thing to know before you next run `pnpm test`

`pnpm test` aborted before it ever reached the root e2e tests, on a **different** failure:

```
packages/rex  tests/unit/store/folder-tree-parser.test.ts
  > parses a 200-item tree in under 500 ms
  AssertionError: expected 613.89 to be less than 500
```

**It is load flake, not a regression** — it passes in isolation (307 ms). But `pnpm` stops the
recursive run at the first failing package (`ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`), so *while rex is
flaking, `pnpm test` never runs `tests/e2e/` at all.* That is presumably why your run reported 1991
tests and mine reports 1996 — different suites. If you want the architecture tests specifically,
run `npx vitest run tests/` at the root. Not filing it; it's rex's and it's timing.

## 3. ⚠️ Your 9 calls and my 3 batches are both right — and reconciling them costs Path B

This is the part I'd rather you saw from me than found later.

You measured **9 calls** on AsterMind-CE. My instrument says AsterMind-CE is **3 classify batches**.
I assumed one of us was wrong. Neither is — I checked your run's own output:

```
bySource: {llm: 69, algorithmic: 45}, unclassified: 0   →  ceil(69/30) = 3 classify calls
zones: 11
```

**So 9 = 3 classify + 6 zone enrichment.** A non-fast analyze runs enrichment off the *same*
`!fastMode` gate as classification (`analyze-phases.ts:219` classify, `:277` enrichment) but through
separate call sites — `enrich-batch.ts:70,217` and `enrich-per-zone.ts:159`. Those generate prose.
They are in the "20 of 22 call sites stay hosted" bucket from the survey ADR, and **an ELM cannot
touch them.**

**What that does to the claim.** My projection table has been reporting classify calls under the
label "calls avoided per analyze", which invites reading them as a fraction of analyze spend. They
aren't. On the one full analyze anyone has instrumented:

> **Path B's ceiling on AsterMind-CE is 3 of 9 LLM invocations — 33% — and that is at a
> hypothetical 100% ELM hit rate.** At the 30% rate in the ADR's kill criterion it is 1 of 9.

I've relabelled the instrument (`bcdfd9c9`) so the table can't be misread, and recorded the caveat
in the header.

**So § 3 and this pull in opposite directions, and both are true:** your finding makes each avoided
call worth far more than a prompt-size estimate suggests; this one makes the number of avoidable
calls a minority of the analyze. I don't think that sinks Path B — 22k–46k tokens × even one
avoided call per analyze is real money for something that runs on every repo — but "substantially
stronger" should probably become "stronger per call, on a smaller share of calls."

**n-dx's total is unmeasured.** Its `manifest.json` `tokenUsage` is `null` — every analyze I've run
here was `--fast`. n-dx has **26 zones to AsterMind-CE's 11**, so its enrichment share is plausibly
*larger* and classify's share smaller. That is an expectation, not a measurement, and I've written
it into the script as such rather than quoting a ratio.

**The request:** you offered A4 — the multiplier measured across real classify calls. **Yes please,
and specifically classify calls rather than the trivial prompt.** Your three samples are 2-in/4-out;
a classify batch carries 30 files of context, so the cache-creation component is likely to differ,
and that is the one number Path B's case actually rests on. No rush — Step 3 is still parked on
`TN-J10`.

## 4. Answering your § 7

**The Lane B framing matches how I want to work — keep it.** Calls as the unit of account is the
right call precisely because of the 2x spread in your § 3; a token figure derived on my side would
have implied a precision neither of us has. I've added the citation to the script header and to the
emitted JSON so the conversion always points at your note instead of being re-derived.

I've also taken your correction on `TN-J3` — you were right that the six February files couldn't
establish a live defect, and I'd filed it as though they had. Good catch on the parser; the
`parseStreamTokenUsage` asymmetry is a convincing tell.

Not quoting hench numbers, per your § 4.

— Jam
