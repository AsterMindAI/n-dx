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

Facts verified at `file:line` in this repo on 2026-08-10 unless marked *(inherited)*.

**The ELM library**
- `@astermind/astermind-community` pinned `^3.0.0` at `package.json:61` (root; not a workspace
  package dependency).
- *(inherited, from `claude-context-instruction`)* npm's latest is `3.0.0`. v4 is tagged on GitHub
  but **unpublished and breaking — do not chase v4.**
- **Gotcha 1 — `charSet` is interpolated unescaped into a RegExp character class**, so a literal
  `-` must come **last** or it forms an invalid range and throws.
  (`scripts/elm-hello-world.mjs:21-22`)
- **Gotcha 2 — text training requires `useTokenizer: true`**, or `train()` throws.
  (`scripts/elm-hello-world.mjs:16`, `:65`)
- The working proof of concept is `scripts/elm-hello-world.mjs`: trains on 30 file paths across 3
  archetype labels, predicts 6 held-out paths. `seed: 42`, `hiddenUnits: 512`, `maxLen: 32`,
  `activation: "relu"`, tokenizer delimiter `/[/._-]+/`. Its `MIN_ACCURACY = 0.66` is an explicit
  **floor, not a target** — 2x the 33% random baseline for 3 classes. Deliberately not pinned to a
  library version's exact output. Added by commit `43d6db51`.

**The integration seam**
- **The ELM is a registered vendor, not a fork.** `ProviderRegistry.register(vendor, factory)` at
  `packages/llm-client/src/provider-registry.ts:96`. Built-in vendors register through the same
  method in the same file: `claude` (:175), `codex` (:182), `google` (:206).
- Bolting ELM into the existing provider files guarantees three-way conflicts — all three teams
  have reason to touch them. `provider-registry.ts`, `provider-interface.ts`, `llm-types.ts` and
  `llm-config.ts` are all on the shared-files list in `OWNERSHIP.md`.

**Replacement candidates (starting set, from the lead — not yet verified as replaceable)**
- `enrichClassificationsWithLLM` — **verified to exist** at
  `packages/sourcevision/src/analyzers/classify.ts:328`. Has substantial existing unit coverage at
  `packages/sourcevision/tests/unit/analyzers/classify.test.ts:394+`, which is the natural
  regression harness for any swap. This is the call site `elm-hello-world.mjs` was written to
  mirror.
- rex item placement, and sourcevision classification more broadly — named by the lead, **not yet
  located or verified by Jam.** Do not quote these as findings until verified at `file:line`.

**The unlocked-state hazard (matters more than usual here — shared checkout)**
- `.rex/prd_tree/`, `.sourcevision/`, and `.hench/` have **no file locking**. Concurrent writers
  lose data with **no error** — last writer silently wins (root `CLAUDE.md`).
- A worktree would make this disappear. Jam does not have one. Therefore: `ndx plan`, `ndx work`,
  `ndx ci`, `ndx refresh`, `ndx self-heal`, and any rex MCP write tool **must be claimed in
  `IN-FLIGHT.md` before running and released after.** `ndx status` and `ndx usage` are read-only
  and always safe.

**Git topology (verified 2026-08-10)**
- `origin` = `AsterMindAI/n-dx`, `upstream` = `en-dash-consulting/n-dx`. `gh repo set-default`
  already returns `AsterMindAI/n-dx` in this clone.
- Branch flow per the lead: work on `Nolan-Work` → commit/PR into `dev` → `dev` merges to
  AsterMind `main`, so our work and the actively-moving en-dash upstream can be reconciled there.

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

- [ ] `TN-J1` — survey LLM call sites across the monorepo for ELM/KELM replacement candidates.
      Verify each at `file:line`; do not carry the lead's starting list forward as fact.
- [ ] Characterise each candidate: classification-shaped (replaceable) vs open-ended generation
      (mostly not), plus rough token cost, so the split is ordered by value and not by guesswork.
- [ ] Propose a three-way split across Teams Nolan / Jarrett / Thomas, split by **merge surface**
      so each team can work a day without touching a file another team has open
      (`OWNERSHIP.md` § Assignments).
- [ ] Write it up as an ADR (`ADR-2026-08-10-jam-<slug>.md`) — the split is a decision for the
      three leads, so it needs to be a document they can accept, not a chat message.
- [ ] Before claiming anything measured: `pnpm typecheck && pnpm test`, and no accuracy number
      without its seed and its baseline.

## Session log

Newest at the top. **Do not edit past entries** — append corrections as a new entry.

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
