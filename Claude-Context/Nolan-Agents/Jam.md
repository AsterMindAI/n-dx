# Agent: Jam

- **Team:** Team Nolan
- **Lead:** Nolan
- **Backlog prefix:** `TN-J`
- **Branch:** `Nolan-Work` (see *Deviations from doctrine* below — this is **not** the documented
  `elm/<lead>/<topic>` convention; it is a deliberate call by the lead)
- **Worktree:** _(none — shared checkout at `/Users/nolanmoore/n-dx-1`)_. Lead's decision,
  2026-08-10. Consequence: every state-writing command must be claimed in `IN-FLIGHT.md` first.
- **Inbox:** `Claude-Context/Nolan-Agents/Notes/`

## Scope

Team Nolan has **no assigned team scope** — the three leads have not divided the codebase
(`OWNERSHIP.md` § Assignments is empty). What follows is *this agent's* scope, not a claim on
Team Nolan's behalf.

**Owns:**
- Survey and analysis of LLM call sites across the monorepo that are candidates for ELM/KELM
  replacement — identifying them, characterising each as classification-shaped vs open-ended
  generation, and estimating token spend.
- The written output of that survey: an ADR (why a call site can or cannot be replaced) and a
  proposed three-way split of the migration work across the three teams.

**Does not own:**
- Any actual provider implementation. Jam surveys and proposes; it does not register a vendor,
  edit `provider-registry.ts`, or modify a call site without a further task and a claim.
- Anything under `Claude-Context/Jarrett-Agents/` or `Claude-Context/Thomas-Agents/` except
  dropping notes into their `Notes/` inboxes.
- Shared files listed in `OWNERSHIP.md` § Shared — no unilateral edits, claim in `IN-FLIGHT.md`.
- Assigning scopes to the three teams. Jam **proposes** a split; the three leads decide it.

## Standing context

**Rewritten 2026-08-23.** Everything below is verified at `file:line` or by execution. The
2026-08-10 version listed unverified candidates as if they were facts; that is deleted, not kept.

### Who is where (shared checkout — this matters)

- **Jam (me):** branch `Nolan-Work`, **shared checkout** `/Users/nolanmoore/n-dx-1`, no worktree.
- **Fluff:** same checkout, same branch. Owns `Claude-Context/` root doctrine docs (`TN-F1`).
- **Butter:** own worktree `/Users/nolanmoore/n-dx-butter`, branch `Nolan-Work-Butter`. Owns Path A
  measurement (`TN-J3`, `TN-B1`).
- **Consequence:** `.rex/`, `.sourcevision/`, `.hench/` have no locking. **Claim `IN-FLIGHT.md`
  before every state-writing command and release after.** Never `git add -A` — stage explicit paths.
- **Notes are delivered by merging, not by writing** (`TN-F3`). A note on my branch is invisible to
  Butter until branches merge.

### ⚠️ `analyze-phases.ts` is invisible to grep

Two raw NUL bytes at offsets **16345 and 16374**, deliberate delimiters in a template literal,
committed on `origin/main`. `file` reports the file as `data`, so **`grep` exits 1 and prints
nothing — silence, not an error.** I lost time to this twice. Use `python3`, `grep -a`, or
`rg --text`. **Nolan's decision: leave the bytes alone.**

### The LLM call-site map (the `TN-J1` survey result)

All inference flows through two chokepoints plus hench's CLI agent loop:

| Chokepoint | File | Sites |
|---|---|---|
| `callClaude` / `callLLM` | `sourcevision/src/analyzers/claude-client.ts:145` | 4 |
| `spawnClaude` | `rex/src/analyze/llm-bridge.ts:135` | 18 |

**Only 2 of 22 are ELM-replaceable** (closed label set): `classifyBatchWithLLM`
(`classify.ts:404`, 17 archetypes) and `assessGranularity` (`reason.ts:1481`,
`z.enum(["break_down","consolidate","keep"])` at `:1327`). The other 20 generate prose.

**Two corrections to the original premise, both verified:** rex placement is *already
deterministic* (`core/move.ts:91`, `core/structural.ts:125`; `rex/src/recommend/` has **zero** LLM
calls), and `enrichClassificationsWithLLM` is the *classification* path despite its name — the
`enrich*.ts` files are generation and not replaceable.

### `classify.ts` anchors (verified, re-verified 2026-08-13)

`PRIMARY_THRESHOLD` 0.4 `:33` · `SECONDARY_THRESHOLD` 0.3 `:36` · `analyzeClassifications` `:60` ·
`secondaryArchetypes` `:189-195` · `new RegExp` per-call `:219` · **dead `"import"` branch
`:242-245`** · `computeSummary`/`bySource` `:308` · `enrichClassificationsWithLLM` `:328` ·
**unused params `inventory` `:330`, `imports` `:331`** (0 references in body) ·
unclassified filter `:337-339` · `LLM_BATCH_SIZE = 30` `:322` · retry ladder `:392-397` (3 attempts) ·
**hardcoded `confidence: 0.7` `:464`** · `mergeClassificationResults` `:559` ·
incremental cache reuse `:99-110`.

**Pipeline wiring** (`analyze-phases.ts`, read with python): phase `:183` · `previousClassifications`
`:196` · deterministic call `:209` · **`--full` cache bypass `:210`** · **LLM gate `:219`** ·
enrich `:221` · merge `:223` · write `:229-230`.

**Schema:** `source` union at `schema/v1.ts:606` and `schema/validate.ts:139` (zod). Adding `"elm"`
needs both.

### The integration decision (ADR amendment)

`CompletionRequest {prompt: string}` / `CompletionResult {text: string}` (`types.ts:68-87`) — the
vendor seam is **text-in, text-out**, and `LLMVendor` is a closed union. An ELM registered as a
vendor would parse a rendered prompt and re-serialise JSON, **losing the confidence score**.
**Decision: option (b) — an ELM tier at the call site (`analyze-phases.ts:219`), touching no
provider file.** That does not violate "registered vendor, not a fork", which exists to stop ELM
being bolted *into* the provider files.

### Measurements — all reproducible

| | value | source |
|---|---|---|
| n-dx source files | 683 | `analyze --fast --full` |
| n-dx before Step 1 | 424 classified / 259 unclassified | |
| n-dx after Step 1 | **428 / 255**, `gateway` 0→4 | commit `26a191e7` |
| AsterMind-CE | 114 files, 45 / **69 (60.5% unclassified)** | n-dx is the *favourable* case |
| Corpus | **324 LLM rows, 13 classes**, seed 42, 241/83 | `2e6a3e43` |
| Calls per analyze | n-dx **9**, AsterMind **3**, total **12** (36 worst case) | `f91370f8` |

**⚠️ Baselines are corpus-dependent — recompute, never quote:** 5.9% (wrong, uniform-random,
published then corrected) → **19.6%** (n-dx rule labels) → 23.0% (sanity combined) → **38.0%**
(the real LLM corpus). I published the wrong one once; the builder now recomputes it every run.

**⚠️ Calls-avoided is lumpy.** `ceil(files/30)`, so **Step 1 avoided ZERO calls** despite being a
real fix (259→255 is 9→9). Thresholds before the *first* call is avoided: n-dx **15 files (5.9%)**,
AsterMind **9 files (13.0%)**. The ADR's 30% kill criterion = **4 of 12 calls**.

### Corpus facts

- Train on **`source: "llm"` rows, never rule labels** — rule labels describe files the rules
  already handle (covariate shift); a naive held-out split hides it.
- LLM populates what rules cannot: `service` 0→123, `middleware` 0→7, `test-helper` 0→1.
- **But `service` + `utility` = 74%** and **9 of 13 classes have <10 rows**.
- **The teacher is inconsistent where the mass is:** `polling-manager.ts`, `tick-timer.ts`,
  `landing.ts` → `service`; `request-dedup.ts` → `utility`. This is `TN-J10`.
- 5 archetypes are unreachable from n-dx (`middleware`, `model`, `service`, `route-module`,
  `test-helper` signals target Rails/Angular/Remix conventions this repo doesn't use). **Repo
  *diversity* is the lever, not repo count** — two TS libraries added 473 rows and zero new classes.

### Environment (hard-won)

- **Two `claude` binaries:** pnpm `2.1.231` at `/Users/nolanmoore/Library/pnpm/claude` (**on PATH —
  what n-dx actually spawns**) and VS Code `2.1.237` at
  `~/.vscode/extensions/anthropic.claude-code-2.1.237-darwin-arm64/resources/native-binary/`.
  Record which produced any number.
- **NEVER `ndx config llm.claude.cli_path`.** `.n-dx.json` is committed and shared; the path is
  machine- and version-specific and would break Jarrett and Thomas. `export PATH` per run.
- **`--fast` gates TWO things** — classify enrichment *and* phase-4 zone enrichment. Dropping it to
  get labels also buys expensive generation. Stop after phase 3 if that's all you need.
- **Per-spawn overhead: 7.3k–19.2k cache-creation tokens, $0.08–$0.20 before any real prompt**, and
  it varies 2.6× on identical prompts. Any "tokens saved" counting only prompt tokens understates
  by ~99.97%.
- **Never stage anything in the session scratchpad.** `/private/tmp` reaped a corpus clone
  mid-session — every file deleted, directory husk and empty `.git` left, producing a silent
  `0 files cataloged` run that looked exactly like a regression. Durable clones: `~/n-dx-elm-corpus/`.
- **Rule changes are invisible without `--full`** (`analyze-phases.ts:210`). Users upgrading for
  better archetype rules see nothing until a full re-analysis (`TN-J6`).
- Vitest prints `fatal: not a git repository` and `Switched to a new branch feature/*` — temp repos,
  **not** my checkout. Verified. Don't panic.

### `TN-J3` root cause — found by me, **Butter's to fix, do not touch**

`complete()` succeeds but returns `tokenUsage: undefined`. The CLI envelope nests counts under
`usage`; `parseCliTokenUsage` reads only top-level `input_tokens`/`total_input_tokens`
(`token-usage.ts:135-136`) → `classifyPresence` → `"unavailable"` → `:123` → `undefined`. Proven:

```
parseCliTokenUsage(modern nested) = undefined
parseCliTokenUsage(legacy flat)   = {input:2, output:4}
parseStreamTokenUsage(modern)     = {input:2,output:4,cacheCreationInput:19205,cacheReadInput:13672}
```

**The correct parser already exists in the same file**; only the single-envelope branch of
`parseJsonOutput` calls the wrong one.

### The Path A ↔ Path B contract (Butter's ADR, agreed)

**The avoided invocation is the unit of account.** Path A publishes token numbers; **Path B quotes
them and never derives its own** — two independent numbers is how the baseline moved three times.
Path B's primary metric is **calls avoided**, deterministic and publishable today. Every figure
carries repo, commit, command, seed, baseline, date.

**Seam:** I own `sourcevision/src/analyzers/**`, `elm-corpus-build.mjs`, `elm-calls-avoided.mjs`.
Butter owns `llm-client/src/{token-usage,cli-provider,api-provider}.ts`,
`hench/.../event-accumulator.ts`, `elm-token-baseline.mjs`. Both write to `scripts/` — announce in
`IN-FLIGHT.md` first.

### Artifacts I own

`ADR-2026-08-11-jam-elm-replacement-survey-and-split.md` (+ amendment) ·
`ADR-2026-08-13-jam-proceed-with-elm-classification.md` ·
`IMPL-2026-08-13-jam-elm-classification-build.md` (live; the 08-11 one is superseded) ·
`Nolan-Agents/syncs/SYNC-001-2026-08-11-elm-path-assignment.md` ·
`scripts/elm-corpus-build.mjs` + `scripts/data/elm-archetype-corpus{,-sanity}.json` ·
`scripts/elm-calls-avoided.mjs` + data.

**Outside the repo, no grep will find it:** the published SYNC-001 artifact at
`https://claude.ai/code/artifact/57194d8b-3459-4ca7-8a5d-95e38ffb4183` still shows a stat tile
reading **"0 — Tokens we can currently measure"**. Redeploy it once Butter lands a number.

## Current state

Path B Steps 0–2 are done; **Step 3 (the benchmark) is deliberately paused on `TN-J10`** — whether
a hand-labelled gold set is needed, because measuring "at or above LLM accuracy" against a teacher
that calls `landing.ts` a `service` measures agreement, not correctness. Lane B of Butter's IMPL is
accepted and its instrument shipped (`f91370f8`). No source file is dirty; I hold no open
`IN-FLIGHT` claim. Nothing is blocked on me — the open items need the leads or Butter.

## Deviations from doctrine (recorded deliberately, decided by the lead 2026-08-10)

These are the lead's calls, made with the trade-off stated. They are written down so a future
session doesn't "fix" them or mistake them for drift.

1. **Shared checkout, not a worktree.** `Command-Structure` § *One agent, one worktree* calls this
   not-optional because of the unlocked-state hazard above. Mitigation in force: claim every
   state-writing command in `IN-FLIGHT.md`. Jam's first task is read-only, so exposure is low for
   it specifically — this gets riskier the moment any agent runs `ndx plan|work|ci`.
2. **Branch is `Nolan-Work`, not `elm/nolan/<topic>`.** Deviates from `GITHUB-WORKFLOW.md` § 2 and
   `OWNERSHIP.md` § Naming conventions.
3. **`dev` is the integration branch.** `GITHUB-WORKFLOW.md` documents only `branch → origin/main`
   PRs and describes no `dev` branch at all. The workflow doc and reality disagree; that is a doc
   gap for the three leads, raised in `IN-FLIGHT.md` § 7.

## Current state

`TN-J1` delivered 2026-08-11 as
[`ADR-2026-08-11-jam-elm-replacement-survey-and-split.md`](../ADR/ADR-2026-08-11-jam-elm-replacement-survey-and-split.md)
(status **Proposed**). The survey's headline: **only 2 of 22 LLM call sites are ELM-replaceable**,
and the project currently has **no way to measure token usage**, which is the more urgent problem.
Nothing is blocked on work — `TN-J2` waits on a three-lead decision about the split, and `TN-J3`
(zero token counters) is unclaimed. No source files have been touched.

Prior state, retained: set up 2026-08-10 as Team Nolan's first agent. Team Nolan's roster and backlog were both empty
before this; `IN-FLIGHT.md` had never been used (no claims, no team status lines, no fork-sync
date). No `elm/*` branch exists on any remote. Nothing is in flight anywhere that touches this
work — confirmed against an empty board and by the lead. First task claimed as `TN-J1`; the survey
itself has not started.

## Next up

*(Corrected 2026-08-23 — this section previously still listed the `TN-J1` survey bullets, all
delivered 2026-08-11. Butter flagged that a revived session reads `Next up` as its instructions.)*

- [ ] **Blocked on Butter's ADR + IMPL** for the Jam/Butter collaboration. Do not start work in
      `packages/llm-client/**` or `hench/**` before it lands — that is Butter's claim.
- [ ] `TN-J10` — needs the three leads: does Step 3 require a hand-labelled gold set? The corpus
      teacher labels `landing.ts` as `service`, and `service`+`utility` are 74% of rows, so
      "at or above LLM accuracy" may measure agreement with a fuzzy teacher rather than correctness.
- [ ] `TN-J4` Step 3 (benchmark) — **hold until `TN-J10` is answered.** When it runs: use the
      library's `Evaluation` module, report against the **majority-class baseline recomputed from
      the corpus actually used** (38.0% for the current one), never a figure quoted from a document.
- [ ] `TN-J9` — corpus still lacks ecosystem diversity; `model` and `route-module` have zero rows.
      Needs repos from other ecosystems, not more TypeScript libraries.
- [ ] Update the published `SYNC-001` artifact once Butter lands the token fix — it carries a stat
      tile reading "0 — Tokens we can currently measure" and lives outside the repo, so no grep
      will find it.

## Session log

Newest at the top. **Do not edit past entries** — append corrections as a new entry.

---

### 2026-08-23 (b) — Unblocked the branch's test suite; found the denominator error in my own metric

**Butter's note arrived** (`NOTE-nolan-internal-2026-08-23-tn-j3-root-caused-and-fixed.md`) with
two things: the `TN-J3` fix and a bug report against me.

**`TN-J13` — my scripts were making `pnpm test` red for everyone.** Both ELM scripts import
`node:child_process` for git provenance and failed `architecture-policy.test.js`. Reproduced,
confirmed pre-existing, fixed via `ALLOWED` (`855dac54`).

- **Route 1 was closed, and this is worth not re-deriving:** `node -e "import('@n-dx/llm-client')"`
  → `ERR_MODULE_NOT_FOUND`. It is not a root dependency and does not resolve from `scripts/`.
  Using `exec()` means adding a package tier to the repo root or importing built `dist/` by path.
- Precedent settled it: both existing `scripts/*.mjs` entries in `ALLOWED` are there for the same
  reason; `run-vitest-bind-aware.mjs` imports `spawnSync` directly.
- **Root suite: `1996 passed | 1 skipped | 0 failed`.**

**Trap found:** `pnpm test` **never reached `tests/e2e/` at all.** `packages/rex`'s
`folder-tree-parser` 200-item perf test flaked under parallel load (613 ms vs a 500 ms budget;
passes in isolation at 307 ms), and pnpm stops the recursive run at the first failing package
(`ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`). **To actually run the architecture tests, use
`npx vitest run tests/` at the root.** Not rex's fault to fix here; not mine to file.

**`TN-J14` — the correction that matters, and it is against my own number.**
Butter measured **9 calls** on AsterMind-CE; my instrument said **3 batches**. I assumed one of us
was wrong. Neither was — their run's own output shows 69 LLM-labelled files = `ceil(69/30)` = 3
classify calls, and **the other 6 are zone enrichment**.

- Enrichment rides the *same* `!fastMode` gate as classify (`analyze-phases.ts:219` vs `:277`) but
  calls separate sites: `enrich-batch.ts:70,217`, `enrich-per-zone.ts:159`. **Prose — not
  ELM-replaceable**, i.e. the "20 of 22 stay hosted" bucket from my own survey ADR.
- **So Path B's ceiling on AsterMind-CE is 3 of 9 invocations (33%) at a hypothetical 100% hit
  rate** — 1 of 9 at the ADR's 30% kill criterion. My projection table was labelled
  "calls avoided per analyze", which invites reading it as a share of analyze spend. It is not.
  Relabelled to "classify calls" throughout (`bcdfd9c9`).
- **n-dx's total is unmeasured** — `manifest.tokenUsage` is `null`, every run here was `--fast`.
  26 zones vs AsterMind-CE's 11, so its classify share is plausibly *smaller*. Written into the
  script as an expectation, explicitly not a measurement.
- **This pulls against Butter's "substantially stronger" framing, and both are true:** their 22k–46k
  per-call overhead makes each avoided call worth much more; this makes avoidable calls a minority
  of the analyze. Told them so directly.

**Also corrected in the instrument:** its header had been quoting my single observation
(7,318 + 14,792) as *the* per-call cost. Butter's three samples span 22k–46k, varying by better
than 2x with cache state. It is a range; the header now cites their note and forbids multiplying
it out.

**Requested of Butter:** IMPL step A4 measured on **real classify calls**, not the trivial
2-in/4-out prompt — a classify batch carries 30 files of context, so cache-creation likely differs,
and that is the number Path B's case rests on.

**Housekeeping:** `git status -sb` reports the branch as `nolan-work` but the ref on disk is
`Nolan-Work` (macOS case-insensitive FS — same ref). There is **no upstream configured**, so a
plain `git push -u origin HEAD` would create a *second*, separate `origin/nolan-work` on GitHub,
which IS case-sensitive. **Always push as `git push origin HEAD:Nolan-Work`.**

**Verified:** NUL bytes intact — 2 at [16345, 16374].

---

### 2026-08-23 — Read Butter's ADR/IMPL; accepted Lane B and shipped its instrument

**Did:**
- Read Butter's two notes, `ADR-2026-08-23-butter-savings-measurement-contract.md`, and
  `IMPL-2026-08-23-butter-token-measurement-and-path-a-b-seam.md`. Accepted Lane B as written.
- Shipped `scripts/elm-calls-avoided.mjs` + data (`f91370f8`) — Lane B B1/B2. Claimed the new
  `scripts/` file in `IN-FLIGHT.md` first, per Butter's seam rule.
- Sent two notes: the `TN-J3` root cause, and Lane B acceptance with the multiplicand.

**Learned:**
- **`TN-J3` root cause, proven by execution and handed to Butter unfixed** (their claimed files).
  `complete()` succeeds but returns `tokenUsage: undefined`. The CLI's JSON envelope nests counts
  under `usage`, while `parseCliTokenUsage` reads only top-level `input_tokens` /
  `total_input_tokens` (`token-usage.ts:135-136`), so `classifyPresence` → `"unavailable"` → `:123`
  → `undefined`. Ran the real parsers to confirm: modern → `undefined`, legacy flat →
  `{input:2,output:4}`, and **`parseStreamTokenUsage` handles the modern shape correctly and
  recovers the cache fields**. The right parser already exists in the same file; only the
  single-envelope branch of `parseJsonOutput` is wrong.
- **`TN-J8`'s PATH mystery was timing, not environment.** The pnpm launcher's mtime is 13:53; my
  probe ran ~13:01, 52 minutes before it existed. Same shell, same PATH, different clocks. Butter's
  `resolveCliPath` analysis was sound but there is no live bug to chase.
- **⚠️ Calls-avoided is lumpy, and it makes my own Step 1 worth zero.** Batches are
  `ceil(files/30)`, so the gateway fix — a real bug fix, `gateway` 0 → 4 — avoided **zero calls**:
  259 → 255 is 9 → 9 batches. Recorded in the script's `knownResults` so nobody reads
  "424 → 428 classified" as a saving later. Thresholds before the *first* call is avoided: n-dx
  **15 files (5.9%)**, AsterMind-CE **9 files (13.0%)**.
- **The ADR's 30% kill criterion maps to 4 of 12 calls avoided.** Useful for the leads judging
  `TN-J10` — coherent as a bar, neither trivial nor unreachable.
- Two CLI binaries coexist: pnpm's **2.1.231** (on PATH, what n-dx actually spawns) and the VS Code
  extension's **2.1.237**. Any token figure should record which produced it.

**Broke / still broken:**
- Nothing. **I did not touch `token-usage.ts` or `cli-provider.ts`** despite having the fix in hand
  — Butter's claim, reported instead. NUL bytes untouched.
- New script is read-only against existing `classifications.json`; no analyze run, no tokens.

**Left undone and why:**
- **Did not fix `TN-J3`.** Crossing a live claim to land a one-line fix is exactly what the claim
  protocol prevents; the proven root cause plus the already-correct parser is more useful to Butter
  than a surprise commit in their files.
- **`TN-J4` Step 3 still paused on `TN-J10`** — Butter's B4 confirms nothing in their IMPL changes
  that.
- The published `SYNC-001` artifact still reads *"0 — Tokens we can currently measure"*. It is
  outside the repo so no grep finds it; I will redeploy once Butter lands a number.

**Notes sent / received:**
- Received: `NOTE-nolan-internal-2026-08-23-tn-j8-may-be-unblocked.md` (Butter).
- Sent: `NOTE-nolan-internal-2026-08-23-tn-j3-root-cause.md`,
  `NOTE-nolan-internal-2026-08-23-lane-b-accepted.md`.

**Handoff:**
- Butter runs A1–A4; I quote their number rather than deriving one. `TN-J12` (steppy vs averaged
  reporting) and `TN-J10` (gold set) both need the leads.

---

### 2026-08-23 — Read Butter's work; sent them the token-accounting evidence

**Did:**
- Read `Butter.md` on `origin/Nolan-Work-Butter` (commit `5d895d41`) — Team Nolan's third agent,
  holding `TN-J3`, in its own worktree at `/Users/nolanmoore/n-dx-butter`.
- Sent `Notes/NOTE-nolan-internal-2026-08-23-token-accounting-evidence.md`.

**Learned:**
- **Butter corrected my `TN-J3` filing and they are right.** I filed it off six
  `.hench/runs/*.json` reading zero. Butter checked the dates: all six are `2026-02-04`, while
  `event-accumulator.ts` landed `2026-04-21` (`0269cf75`). **The evidence predates the mechanism it
  indicts.** The row should read "nobody has measured this since February", not "token accounting
  is broken". I did not rewrite the row — Butter holds it — but I acknowledged it in the note and
  offered to correct it where it landed.
- **`.hench/runs/` is gitignored (`.gitignore:5`) yet those six files are tracked** — committed
  before the rule. So they show up in every worktree, and any *new* run will not commit. Butter's
  point that fresh evidence needs a deliberate fixture is well made.
- Butter also flagged board drift: `TN-J7` was claimed on the backlog and in a commit message with
  no `IN-FLIGHT.md` row. Accurate — I released the row when the work blocked, reading "blocked" as
  "done for this session". Their reading is better: a `BLOCKED` item with no row looks abandoned.

**What I gave them:**
- **The CLI location.** Their literal next step ("produce one hench run") would have failed exactly
  as my corpus run did — no `claude` on `PATH`. The binary is the VS Code extension's bundled one;
  nothing needs installing. Plus the warning not to persist it to `.n-dx.json` (shared, committed,
  and the path carries `2.1.237`).
- **Evidence the CLI emits usage on current code** — a real `claude -p --output-format json`
  payload with `cache_creation_input_tokens: 7318` and `total_cost_usd: 0.081633`. So if a fresh
  hench run still reads zero, the break is downstream of the provider.
- **~7.3k tokens / ~$0.08 fixed overhead per CLI spawn** — so "tokens saved" that counts only
  prompt tokens will understate the benefit. Relevant to their reporting surface.
- **A near-miss, stated as a near-miss.** My 12 real classify batches did exercise
  `accumulateTokenUsage` on current code, but `analyze.ts:201-210` persists `manifest.tokenUsage`
  only at end-of-run and I killed both runs after phase 3 — so the absent token fields are **my
  early kill, not a zero counter**. Gave them the cheap way to finish it (AsterMind-CE, 3 batches,
  run to completion).

**Broke / still broken:**
- Nothing. No source touched this session. NUL bytes untouched.

**Left undone and why:**
- **Did not edit `TN-J3`'s wording.** Butter holds the row; rewriting a claimed row unilaterally is
  the collision the claim protocol exists to prevent. Offered instead.
- **Did not run the cheap end-to-end token measurement myself.** It is Butter's task under `TN-J3`,
  and spending more of the lead's tokens inside someone else's claim was not mine to do.

**Notes sent / received:**
- Sent: `Notes/NOTE-nolan-internal-2026-08-23-token-accounting-evidence.md` (within-team form per
  Fluff's `TN-F2` rename).
- ⚠️ **It will not reach Butter until their branch merges `nolan-work`** — they are on
  `Nolan-Work-Butter`. This is precisely the delivery gap Fluff raised as `TN-F3`; flagged in the
  note itself.

**Handoff:**
- Path B Step 3 still waits on `TN-J10` (gold set?). Path B's "tokens saved" still waits on Butter.

---

### 2026-08-20 — Corpus built with Nolan's CLI. Premise confirmed; the bar went up.

**Did:**
- Found the Claude CLI already on disk — the VS Code extension's bundled binary, just not on
  `PATH`. **Installed nothing.** Verified it completes headlessly and is authenticated before using it.
- Ran `analyze --full` (no `--fast`) on n-dx and AsterMind-CE, stopping each **immediately after
  phase 3**. Built `scripts/data/elm-archetype-corpus.json` — 324 LLM-labelled rows, 13 classes,
  seed 42, 241/83 split (commit `2e6a3e43`).

**Learned:**
- **The ADR's central bet paid off:** LLM labels populate what rules cannot see. `service` 0 →
  **123**, `middleware` 0 → 7, `test-helper` 0 → 1. Training on rule output would have been useless.
- **But the bar rose, not fell.** Majority baseline **38.0%** (vs 19.6% on rule labels), because
  `service` + `utility` are **74%** of rows and 9 of 13 classes have under 10. The teacher's output
  is *more* concentrated than the rules'. An ELM now has to beat 38% while 9 classes are unlearnable.
- **The teacher is inconsistent exactly where the mass is.** `polling-manager.ts`, `tick-timer.ts`,
  `tick-visibility-gate.ts` and `landing.ts` → `service`; `request-dedup.ts`, `budget-preflight.ts`
  → `utility`. A landing page is not a service. The LLM is using `service` as a catch-all for
  "module with behaviour", and 74% of the corpus rests on that boundary. Filed `TN-J10` — this is
  the "inherits the teacher's mistakes" risk from the ADR, now **observed** rather than predicted.
- **`--fast` gates two things, not one.** Dropping it to get classification labels also switches on
  phase-4 zone enrichment — the expensive Tier C generation path, useless for the corpus. Killed
  both runs the moment phase 3 wrote. Anyone repeating this must do the same.
- **A CLI spawn costs ~7.3k cache-creation tokens / ~$0.08 before any real prompt.** So an avoided
  classify batch saves more than its prompt size implies — this *helps* the ELM's case and is a
  useful input for `TN-J3`.
- **`.n-dx.json` was the wrong place for `cli_path`** even though the error message suggests it:
  the file is committed and shared, and the path contains `2.1.237`, so it would break Jarrett and
  Thomas immediately and Nolan on the next extension update. Used `PATH` for the run instead.

**Broke / still broken:**
- **I lost the first AsterMind clone.** Staged it in the session scratchpad under `/private/tmp`;
  it was reaped mid-session — every file deleted, directory tree and an empty `.git` husk left, so
  the analyze reported `0 files cataloged` and silently overwrote good results with empty ones. Cost
  **zero tokens** (0 files → 0 batches) and re-cloning fixed it, but it looked exactly like a real
  regression and I nearly reported it as one. Clones now live in `~/n-dx-elm-corpus/`.
- Nothing else broken. No source changed this session. NUL bytes verified untouched.

**Left undone and why:**
- **Step 3 (benchmark) not started**, and I would not start it before `TN-J10` is answered:
  measuring "at or above LLM accuracy" against labels this fuzzy measures *agreement with a noisy
  teacher*, not correctness.
- `TN-J9` still open — the corpus is still two TypeScript repos. `model` and `route-module` remain
  at zero rows.

**Notes sent / received:** findings posted to `IN-FLIGHT.md` § 3 for all teams.

**Handoff:**
- Get `TN-J10` decided (gold set or not). Then Step 3, using the library's `Evaluation` module and
  reporting against **38.0%** — recomputed from whatever corpus is actually used, never quoted.

---

### 2026-08-13 (c) — Step 2: harness shipped, corpus blocked on auth, ELM case got stronger

**Did:**
- Verified the LLM gate **before** spending effort — executed a real `complete()` call rather than
  reading config. Result: `ClaudeClientError reason=not-found`, `'claude' not found on PATH`.
  No API keys either. Claimed `TN-J7` recording the blocker up front.
- Cloned `AsterMindAI/AsterMind-Community-Edition` (read-only, into the session scratchpad, not the
  repo) and analyzed it with `--fast --full`.
- Shipped `scripts/elm-corpus-build.mjs` + the sanity corpus (commit `8617f9f1`).

**Learned:**
- **The ELM case is stronger than Step 0 suggested.** AsterMind-CE is **60.5% unclassified** vs
  n-dx's 37.3%. n-dx is the *favourable* case; users' repos plausibly have a bigger prize. This
  partly answers my own 08-11 pessimism — worth saying out loud since I argued the other way.
- **Repo count is not the lever; ecosystem diversity is.** AsterMind-CE added 473 rows and **zero**
  new classes — only `utility`/`entrypoint`/`types`/`config`/`store`/`component`, all of which
  n-dx already had. Both repos are the same *kind* of thing (a TS library), so two are worth about
  one for label coverage. `middleware`, `model`, `route-module`, `service`, `test-helper` are still
  at zero. Filed `TN-J9` with the specific repo types needed.
- **The majority-class baseline is corpus-dependent** — 19.6% for n-dx alone, **23.0%** combined.
  So it cannot be quoted from a document; the builder recomputes and prints it every run. Good
  thing, given I already published one wrong baseline.
- Local disk had no useful corpus candidates (checked before cloning anything) — only n-dx clones
  and a 1-file demo repo.

**Broke / still broken:**
- **🔴 `TN-J8`: no LLM reachable.** This blocks the real corpus and therefore every ML step of
  Path B. Not something I can fix — it needs the CLI installed, a `cli_path` configured, or an API
  key.
- Nothing else broken. No source files touched this session beyond the new script. NUL bytes
  untouched.

**Left undone and why:**
- **The actual LLM-labelled corpus** — blocked, see above. The harness refuses to build one and
  prints the fix, rather than silently emitting a rule-derived set that would look fine and be
  worthless.
- **Did not clone more repos speculatively.** Having learned that two similar repos add no class
  diversity, pulling more TypeScript libraries would have burned time for nothing. Documented the
  five repo *types* that would actually help instead — that seemed the honest reading of "use your
  discretion".
- Step 3 (benchmark) not started: it needs the corpus.

**Notes sent / received:** Step 2 findings posted to `IN-FLIGHT.md` § 3 for all teams, including
that the ELM case improved.

**Handoff:**
- **Unblock `TN-J8` first** — nothing else in Path B can move. Then re-run analyze without
  `--fast` on both repos and `node scripts/elm-corpus-build.mjs <repos...>` (defaults to
  `--source=llm`) to produce the real corpus.

---

### 2026-08-13 (b) — Re-verified the docs; shipped TN-J5, the first code of this project

**Did:**
- Re-verified the 08-13 ADR and IMPL end to end: all measured numbers reproduce from
  `classifications.json`, all 18 cited line anchors resolve (including the ones inside the
  grep-invisible `analyze-phases.ts`, checked via python), and all 9 cited library exports exist.
- Shipped the gateway fix, test-first, commit `26a191e7`.

**Learned:**
- **Only 1 of the 6 zero-example archetypes was fixable.** I tested each of the other five signal
  sets against the real unclassified paths: `middleware`, `model`, `service`, `route-module`,
  `test-helper` all return **zero** candidates. Their signals are correct — n-dx just isn't a
  Rails/Angular/Remix codebase. **Those five classes cannot be populated from this repo at any
  effort**, which turns Step 2's "use more than one repository" from advice into a requirement.
- **Rule fixes are invisible without `--full`.** My first re-measure returned 424/259 unchanged and
  I nearly recorded the fix as ineffective. The fix was fine; incremental mode was reusing the
  cached `archetype: null` (`classify.ts:99-110`; only `--full` bypasses it,
  `analyze-phases.ts:210`). **This has user impact beyond our measurements** — anyone upgrading
  n-dx for better rules sees nothing until a full re-analysis. Filed as `TN-J6`.
- Vitest's git-related tests print `fatal: not a git repository` and `Switched to a new branch
  feature/*`. Alarming, but they operate in temp repos — verified my branch and branch list were
  untouched. Known noise; don't panic next time.

**Corrections to my own claims:**
- The IMPL's "target the six empty classes first" was **wrong** and is corrected in place — only
  `gateway` was a bug; the other five are conventions this repo doesn't use.
- The ADR's "~30 of 259 reachable by simple name rules" is now flagged as an *estimate* from an
  ad-hoc regex list, not a measurement. Step 1 landed 4, not 30 — the remaining candidates are
  mostly n-dx-specific paths (`routes-rex/`) that would be overfitting in a tool that ships to
  other people's repos.

**Broke / still broken:**
- Nothing broken. `pnpm typecheck` clean across all 6 packages; 1192 sourcevision analyzer tests
  pass; 108 architecture-policy + domain-isolation e2e tests pass.
- NUL bytes in `analyze-phases.ts` untouched — verified again after the source edits.

**Measured (commit `26a191e7`, `analyze --fast --full`):** classified 424→428, unclassified
259→255, `gateway` 0→4, classes present 11→12. Still 9 LLM batches (`ceil(255/30)`), so no batch
reduction yet — the win here is a populated class for training, not a token saving.

**Left undone and why:**
- Did not chase the remaining ~250 unclassified with more rules. The honest candidates left are
  n-dx-specific paths, and `archetypes.ts` ships to users — overfitting it to this repo would make
  the tool worse elsewhere. The residue is genuinely the ELM's job.
- Step 2 (corpus) not started: it spends tokens and needs its own claim.

**Notes sent / received:** none new; `TN-J6` raised on the team backlog.

**Handoff:**
- Next is IMPL Step 2, corpus acquisition, and it **must** span more than one repository — five
  archetypes are unreachable from n-dx alone. Claim `IN-FLIGHT` first; that run costs tokens.

---

### 2026-08-13 — Nolan decided to proceed with the ELM; ADR + IMPL written

**Did:**
- Wrote [`ADR-2026-08-13-jam-proceed-with-elm-classification.md`](../ADR/ADR-2026-08-13-jam-proceed-with-elm-classification.md)
  and [`IMPL-2026-08-13-jam-elm-classification-build.md`](../IMPL/IMPL-2026-08-13-jam-elm-classification-build.md).
  Marked the 08-11 IMPL superseded (kept for its Step 0 record).
- Opened `TN-J4` (build) and `TN-J5` (rule fixes); notes sent to both other teams.

**Learned:**
- **Root-caused the gateway miss.** The `gateway` archetype's *only* signal is
  `^(?:deps|gateway|barrel)\.[tj]sx?$` in `archetypes.ts` — anchored at `^`, so it matches
  `gateway.ts` but not `rex-gateway.ts`. Verified by executing the regex against all four
  `*-gateway.ts` files: all four fail. Weight 0.7 already clears `PRIMARY_THRESHOLD` (0.4), so
  relaxing the anchor fixes all four instantly. This is `TN-J5`.
- `.n-dx.json` has only a `sourcevision.zones` section — no `archetypes` section exists, so making
  the confidence threshold user-configurable means adding one, and that file is shared.

**On the decision itself:** I recommended closing Path B as a measured negative. Nolan's call was
to proceed and I think the reasoning is sound — **free local inference removes the cost side of
the trade entirely**, so the question stops being "is 9 calls worth it" and becomes "is any hit
rate worth a bounded one-off effort", across every user's repo rather than just ours. I put a
**kill criterion in the ADR** (≥30% of residue at or above LLM accuracy) so the project can still
end honestly if the model underperforms. Recorded here because a future session reading the Step 0
numbers might otherwise think the decision ignored them — it didn't.

**Broke / still broken:**
- Nothing. No source touched. NUL bytes untouched (verified again this session).
- `pnpm typecheck` / `pnpm test` not run — documentation only.

**Left undone and why:**
- **No code written.** `TN-J5` (the gateway fix) is the obvious first move and is fully specified,
  but the user asked for the ADR and IMPL this session, not the implementation.
- Corpus acquisition (IMPL Step 2) not started — it costs tokens and needs an `IN-FLIGHT` claim.

**Notes sent / received:**
- Sent: `Jarrett-Agents/Notes/NOTE-jam-to-jarrett-2026-08-13-path-b-proceeding.md`
- Sent: `Thomas-Agents/Notes/NOTE-jam-to-thomas-2026-08-13-path-b-proceeding.md`
  Both carry the 19.6% baseline correction and push Path A (token accounting) as still-unclaimed.

**Handoff:**
- Start at IMPL Step 1 (`TN-J5`): fix the gateway anchor, test-first, then the other name-evident
  cases, targeting the six zero-example classes. Re-measure before touching any ML.

---

### 2026-08-11 (c) — Step 0 measured. Path B is weaker than I sold it, and my baseline was wrong.

**Did:**
- Nolan claimed Path B for Team Nolan. Claimed it and the run in `IN-FLIGHT.md` **before**
  executing, per the shared-checkout rule — Fluff is working this same checkout.
- Ran `sourcevision analyze . --fast` (commit `b5ecfd5c`). `--fast` skips LLM enrichment
  (`analyze-phases.ts:219`), so the measurement **cost zero tokens**. Released the claim after.

**Learned (the numbers, all from `.sourcevision/classifications.json`):**
- **683 source files → 424 classified (62.1%), 259 unclassified (37.9%) = 9 LLM batch calls per
  full analyze** (`ceil(259/30)`), up to 27 with retries. That is the entire Path B prize, and it
  shrinks further in incremental mode.
- **6 of 17 archetypes have ZERO examples**: `gateway`, `middleware`, `model`, `route-module`,
  `service`, `test-helper`. Only 11 classes present; `config` has exactly 1. An ELM trained on
  rule output cannot ever predict the missing six.
- **All 259 unclassified files have zero `evidence`** — no sub-threshold signals, none. Path
  string is the only feature, for the ELM *and* for the LLM doing it today.
- **Only ~30 of the 259 (12%) are reachable by simple name rules; 88% is semantic residue** like
  `agent/analysis/stuck.ts`. My "it's mostly missing rules" hunch was **wrong** — it is a modest
  win, not the explanation.
- **All four `*-gateway.ts` files are unclassified** despite CLAUDE.md calling gateways the
  architecture's backbone and `gateway` existing in the catalog. Free deterministic fix, no ML.

**Corrections to my own published claims** (fixed in place in ADR, SYNC-001 and the IMPL, not just
here):
- **"5.9% random baseline" was the wrong yardstick** — quoted in the ADR, SYNC-001, the IMPL and
  the shared artifact. Classes are severely imbalanced (`utility` 83/424), so the honest baseline
  is **19.6% majority-class**. Beating 5.9% would have proved nothing. This is the correction most
  likely to have misled the other two leads, since it made Path B look easier than it is.
- **"The partial-signal vector is a free 17-dimensional feature set"** (IMPL § Improvements) —
  **false for the population that matters.** Zero evidence on 100% of unclassified files. Retracted
  in place.

**Broke / still broken:**
- Nothing broken. No source files touched; the 2 NUL bytes still untouched (verified again).
- `.sourcevision/` is now populated where it previously held only `hints.md` — that is a working
  artifact of the measurement, not a code change, and it is gitignored.

**Left undone and why:**
- Did **not** write the `archetypes.ts` gateway/route rules. It is the obvious next move and it is
  free, but it edits source in Path B's territory and Nolan had not asked for code yet.
- Still no ELM trained, no accuracy number. Step 0's job was to decide whether to bother, and its
  honest answer is "probably not, as an ML project."
- Measured **one repo**. n-dx is TypeScript-heavy and idiosyncratic; if the ELM is meant to ship to
  users' repos, one data point does not close the question.

**Notes sent / received:** Step 0 result posted to `IN-FLIGHT.md` § 3 (all teams), including the
baseline correction.

**Handoff:**
- Decision for Nolan: do the free `archetypes.ts` rules, re-measure, and only then decide on the
  ELM against a prize smaller than 9 calls. Or close Path B as a measured negative — which is a
  publishable finding, not a failure.

---

### 2026-08-11 (b) — Path B IMPL written; two of my own claims corrected

**Did:**
- Re-verified every `file:line` in the classify.ts analysis at the lead's request, then wrote
  [`IMPL-2026-08-11-jam-elm-classification-path-b.md`](../IMPL/IMPL-2026-08-11-jam-elm-classification-path-b.md).
- Traced the real pipeline wiring: `runClassificationsPhase` (`analyze-phases.ts:183`), LLM gate at
  `:219`, enrich call at `:221`. The ELM insertion point is `:219`, ahead of the LLM.

**Learned:**
- **`analyze-phases.ts` is invisible to `grep`.** Two raw NUL bytes at offsets 16345/16374, used
  deliberately as delimiters in a template literal, make `file` report it as `data`; grep exits 1
  and prints nothing. I missed the pipeline wiring twice because of it. Committed on
  `origin/main`. **The lead instructed me to leave the bytes alone** — so this is a documented
  hazard, not a fix. Use `python3`, `grep -a`, or `rg --text` on that file.
- **The library is far richer than the hello-world suggests.** Verified from the installed
  `.d.ts`: `KernelELM` (kernels rbf/linear/poly/laplacian; `mode: 'exact'|'nystrom'` with seeded
  landmarks), `OnlineELM.update()` (RLS incremental — maps onto sourcevision's incremental mode),
  `ConfidenceClassifierELM` (purpose-built abstain mechanism), and `Evaluation` returning a full
  `ClassificationReport` with confusion matrix and per-class F1. **Do not hand-roll the benchmark
  harness — it ships.**
- **`ELM` and `KernelELM` take different inputs.** `ELM` is text-native (`charSet`,
  `useTokenizer`, `predict(text)`); `KernelELM` is numeric-only and needs TF-IDF or
  `UniversalEncoder` in front. They are not interchangeable.
- **The covariate-shift trap is the real risk for Path B** — training on rule-labeled files and
  inferring on rule-*un*labeled files teaches the model to imitate rules where they already work.
  A naive held-out split hides it. Written up in the IMPL.

**Corrections to my own earlier claims** (both published in chat; corrected in the IMPL too):
- I said **"`node_modules` is empty, nothing installed"**. True when checked, **false now** —
  deps are installed and `@astermind/astermind-community@3.0.0` is present. That is what let me
  verify the real API instead of citing npm keywords.
- I said **KELM's N² cost is "fine here and bad later"**. Incomplete — `mode: 'nystrom'` exists
  precisely to avoid that. The scaling objection is not a reason to skip KELM.

**Broke / still broken:**
- Nothing touched in source. **The 2 NUL bytes were left exactly as found, per instruction.**
- `pnpm typecheck` / `pnpm test` still not run — no source changes to validate.

**Left undone and why:**
- **Step 0 of the IMPL is unmeasured**: nobody knows how many files actually reach the LLM. It is
  cheap, it gates everything, and it can cancel Path B outright. Did not run it — `ndx analyze` is
  a state-writing command and this is a shared checkout.
- No ELM trained, no accuracy measured. Still no viability claim anywhere.

**Notes sent / received:** none this session; the grep hazard posted to `IN-FLIGHT.md` § 3.

**Handoff:**
- Run IMPL Step 0 before anything else. If `totalUnclassified` is small, close Path B and say so.

---

### 2026-08-11 — TN-J1: surveyed all 22 LLM call sites; split proposed; measurement gap found

**Did:**
- Triaged every LLM call site in the monorepo by output shape. Two chokepoints:
  `callClaude` (`sourcevision/analyzers/claude-client.ts:145`, 4 sites) and `spawnClaude`
  (`rex/analyze/llm-bridge.ts:135`, 18 sites); hench drives CLI agent sessions separately.
- Wrote `ADR-2026-08-11-jam-elm-replacement-survey-and-split.md` and sent notes to both other
  teams' inboxes. Marked `TN-J1` DONE; opened `TN-J2` (leads' decision) and `TN-J3` (token
  counters). Released my `IN-FLIGHT.md` claim and posted the findings to § 3.

**Learned:**
- **Only 2 of 22 sites are classification-shaped.** `classifyBatchWithLLM`
  (`classify.ts:404`, 17 archetype IDs validated against `validIds`) and `assessGranularity`
  (`reason.ts:1481`, `z.enum(["break_down","consolidate","keep"])` at `:1327`). The other 20 emit
  PRD trees, zone names, descriptions and findings — generation, not classification.
- **The 17-class problem is the real technical risk.** hello-world proved 3 classes / 33% baseline
  / 6 held-out samples. Random baseline at 17 classes is 5.9%. The 66% floor must not be quoted as
  evidence for the production task; a 6-sample set cannot separate 66% from 83%.
- **A tiering seam already exists** — `resolveVendorModel(vendor, config, weight)` with
  `TaskWeight` `"light" | "standard"`; enrichment pass 1 already routes to a cheap model
  (`enrich-batch.ts:215`). ELM slots in as a third tier rather than a parallel path.
- **Free labelled training data exists** for the classification task: the deterministic
  `BUILTIN_ARCHETYPES` pass labels files at zero cost, and `classify.test.ts:394+` is a ready
  regression harness.
- **Correction to the task's premise: "rex placement" is already deterministic.**
  `LEVEL_HIERARCHY` at `core/move.ts:91` and `core/structural.ts:125`, validated in
  `recommend/create-from-recommendations.ts:373-386`; `rex/src/recommend/` contains zero LLM calls.
  There is no token spend to remove there, and replacing rules with a model would be a regression.
- **`enrichClassificationsWithLLM` is a misleading name** — it is the *classification* path
  (replaceable), not the *enrichment* path (not replaceable). Cost me a wrong assumption early.
- **Correction to my 2026-08-10 entry's handoff:** I recorded that `Nolan-Work` was *missing*
  Jarrett's merged work from `origin/dev`. That was backwards. `git diff HEAD origin/dev` shows
  **zero source difference** — all 15 differing files are docs, and `dev` is *behind* the charter
  migration, still carrying the old `team/*.md` layout that `d1692a1d` removed. Merging `dev` into
  `Nolan-Work` would resurrect those deleted files. Flagged for whoever does the `dev` integration.

**Broke / still broken:**
- Nothing broken by me — this session touched no source files.
- **Found broken (not fixed):** token accounting reads `{"input":0,"output":0}` in all 6
  `.hench/runs/*.json` despite parsers existing at `cli-provider.ts:348-385` and
  `api-provider.ts:184`. Filed as `TN-J3`. **Not root-caused — this is a lead, not a finding.**
- `pnpm typecheck` / `pnpm test` **not run again this session.** Documentation-only, no source
  touched, so I have no claim to make about the tree's state.

**Left undone and why:**
- Did not chase the zero-token root cause — outside `TN-J1`, and per doctrine the default mid-task
  is to file the report and keep going. Filed as `TN-J3`.
- **No ELM was trained or measured.** The ADR deliberately makes no viability claim; proving the
  17-class task is Team B's first deliverable under the proposed split.
- Could not measure real classification volume — this checkout has no `.sourcevision/*.json`
  artifacts, so the ~44-calls-per-analyze figure is a structural upper bound from
  `LLM_BATCH_SIZE = 30` and a 1,319-file count, **not** a measurement.
- Did not resolve the Tier B product question (granularity returns an enum *and* prose the CLI
  renders); flagged for whoever takes that stream.

**Notes sent / received:**
- Sent: `Jarrett-Agents/Notes/NOTE-jam-to-jarrett-2026-08-11-elm-split-proposal.md`
- Sent: `Thomas-Agents/Notes/NOTE-jam-to-thomas-2026-08-11-elm-split-proposal.md`
- Received: none new.

**Handoff:**
- The split is **Proposed, not accepted** — it needs the three leads (`TN-J2`). Do not start a
  stream on the strength of this ADR alone.
- If Team Nolan wants momentum before that decision, `TN-J3` (token counters) is unclaimed,
  independent of the split, and is the thing that makes every later saving provable.

---

### 2026-08-10 — Agent created; Team Nolan's first roster entry

**Did:**
- Read the full Step 1 set: `claude-context-instruction`, `Command-Structure`,
  `GITHUB-WORKFLOW.md`, `OWNERSHIP.md`, `IN-FLIGHT.md`, root `CLAUDE.md`,
  `scripts/elm-hello-world.mjs`.
- Verified before building: no `Jam` charter existed; no scope overlap (all three backlogs and
  `IN-FLIGHT.md` were empty); remotes correct; `gh` default already `AsterMindAI/n-dx`.
- Created this charter, the roster row in `Nolan-Agents/README.md`, backlog row `TN-J1`, and an
  `IN-FLIGHT.md` claim + open question.

**Learned:**
- `ProviderRegistry.register` is at `provider-registry.ts:96` exactly as doctrine claims —
  verified, not taken on trust. Three built-in vendors register through it in the same file.
- `enrichClassificationsWithLLM` is real, at `classify.ts:328`, and already has a dense unit-test
  file. That test file is the regression harness a swap would be measured against.
- No measured ELM numbers exist yet beyond the hello-world floor (6 held-out paths, seed 42,
  0.66 floor vs 0.33 random baseline). **Nothing here is a benchmark yet.**

**Broke / still broken:**
- Nothing run, nothing broken. `pnpm typecheck` / `pnpm test` **not run this session** — setup was
  documentation-only and touched no source.

**Left undone and why:**
- The `TN-J1` survey itself has not started — setup only, per `NEW-AGENT.md` Step 5, which ends at
  a report-back checkpoint.
- Did **not** fill in `IN-FLIGHT.md` § 2 "Where each team is" for Team Nolan — that line is the
  lead's to write, and it is still blank for all three teams.
- Did **not** create a worktree or an `elm/*` branch; the lead chose the shared checkout and the
  `Nolan-Work` → `dev` flow. Recorded above as a deviation rather than worked around.

**Notes sent / received:**
- None sent. Team Nolan's inbox holds one prior note:
  `Notes/NOTE-jarrett-to-nolan-2026-08-08-unify-agent-structure-reply.md`.

**Handoff:**
- Start `TN-J1`. Locate and verify the rex-placement and sourcevision-classification call sites at
  `file:line` before treating them as candidates — they are currently the lead's starting list,
  unverified.

---
