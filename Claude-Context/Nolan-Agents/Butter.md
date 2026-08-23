# Agent: Butter

- **Team:** Team Nolan
- **Lead:** Nolan
- **Backlog prefix:** `TN-B`
- **Branch:** `Nolan-Work-Butter`
- **Worktree:** `/Users/nolanmoore/n-dx-butter`
- **Inbox:** `Claude-Context/Nolan-Agents/Notes/`

## Scope

**Owns — Path A, the measurement half.** Token accounting end to end: parse → accumulate →
persist → report. The files that matter are `packages/llm-client/src/{token-usage,cli-provider,
api-provider}.ts`, `packages/hench/src/agent/lifecycle/event-accumulator.ts`, whatever writes
`.hench/runs/*.json`, and the `ndx usage` / `get_token_usage` reporting surface on top of them.
Path A gates Paths B and C: until a token number is trustworthy, neither can state what it saved.

**Adjacent, deliberately not claimed:** the other half of Path A — the shared ELM inference wrapper
(load / train / predict / expose confidence). SYNC-001 puts it in Path A alongside token
accounting, but the lead's instruction to me was the token analyzer specifically. If nobody else
takes it, it is the obvious next thing; I am not silently holding it in the meantime.

**Does not own:**

- `packages/sourcevision/src/analyzers/**` — Path B, Team Nolan's claim, and **Jam is actively in
  those files**. Not to be touched.
- `Claude-Context/` root doctrine docs (`Command-Structure`, `GITHUB-WORKFLOW.md`, `OWNERSHIP.md`,
  `NEW-AGENT.md`, `claude-context-instruction`) — Fluff's, claimed under `TN-F1` pending the leads'
  decision. Adding a claim row to `IN-FLIGHT.md` is normal use and not a conflict with that.
- `packages/llm-client/src/{provider-registry,provider-interface,llm-types,llm-config}.ts` — on the
  shared "nobody edits unilaterally" list. My files sit in the same package but are not these four.
  If the fix reaches one of them, it gets claimed and announced first.
- `packages/rex/src/analyze/**` — Path C, unclaimed by anyone.

## Standing context

Facts verified at `file:line` or by execution on `2026-08-13`, at commit `f52eb253`.

**The task as the backlog states it is not quite the task.**

- `TN-J3` says "all 6 `.hench/runs/*.json` record `tokenUsage {input:0,output:0}` though the
  parsers exist". The zeros are real — verified by reading all six. Four of those runs ran 21, 47,
  53 and 60 turns, so they certainly consumed tokens.
- **But all six runs are dated `2026-02-04`, and `event-accumulator.ts` — which does the
  accumulating, including a zero-fallback at `:532` — was added `2026-04-21` in `0269cf75`.** The
  evidence predates the mechanism by two and a half months. It does not establish a live defect; it
  establishes that **nobody has measured this since February**. Step one is a fresh run, not a fix.
- Corollary: do not report "token accounting is broken" until a run on current code has been
  observed. Do not report it fixed on the strength of those six files changing either.

**The parsers exist and are wired in** (so "parsers exist but aren't called" is the wrong theory):

- `packages/llm-client/src/cli-provider.ts:37` imports `parseCliTokenUsage` / `parseStreamTokenUsage`
  from `./token-usage.js`; they are called at `:348`, `:357`, `:378` and returned at `:349`, `:358`,
  `:385`.
- `packages/hench/src/agent/lifecycle/event-accumulator.ts` accumulates: `:445-446` adds
  input/output, `:457`/`:461` handle cache-creation and cache-read tokens, `:532-536` is a
  fallback that fires when both totals are still zero. The break, if there is one, is downstream of
  parsing.

**`.hench/runs/` is gitignored but the six files are tracked anyway.** `.gitignore:5` ignores the
directory; those six were committed before the rule landed, and gitignore does not retroactively
untrack. Two consequences: they appear in **every** worktree, so worktree isolation does not
isolate them; and **any new run I generate will be ignored and will not commit**. Fresh evidence
therefore needs a deliberate committed fixture or a seeded script — an uncommitted run on my
machine is exactly the "demo that ran once" the doctrine rejects.

**Shared-checkout hazard, why I am not in one.** Jam and Fluff work
`/Users/nolanmoore/n-dx-1` on `nolan-work`. During my onboarding session HEAD moved twice under me
(`07bafec7` → `26a191e7` → `f52eb253`) while I was reading files. My verification work must run
hench, which writes `.hench/`; Jam runs `sourcevision analyze`, which writes `.sourcevision/`.
Neither directory has file locking and the loss is silent. Hence this worktree, on the lead's
standing instruction to split if there was a real conflict.

**Repo-wide gotcha inherited from Jam, `TN-J5`:**
`packages/sourcevision/src/cli/commands/analyze-phases.ts` contains two raw NUL bytes (offsets
16345, 16374), deliberate and committed. `file` reports it as `data`, so **`grep` exits 1 and
prints nothing — silence, not an error.** Every repo-wide grep has a hole in exactly that file. Use
`python3`, `grep -a`, or `rg --text`. Decision (Nolan, 2026-08-11): leave the bytes alone.

**ELM library gotchas** (from `scripts/elm-hello-world.mjs`, for when the wrapper half comes up):

- `charSet` is interpolated **unescaped** into a RegExp character class, so a literal `-` must come
  **last** or it forms an invalid range and throws.
- Text training requires `useTokenizer: true`, or `train()` throws.
- npm's latest is `3.0.0` and the repo pins `^3.0.0`. v4 is tagged on GitHub but unpublished and
  breaking — **do not chase v4**. Already a root dependency at `package.json:61`; no `pnpm add`
  should be needed, and one would require a second lead's sign-off.

**Numbers other people are quoting, so I do not re-derive or mis-cite them:**

- The archetype baseline is **19.6% majority-class**, not the 5.9% uniform-random figure that
  circulated early and was corrected in place.
- Path B's measured prize: 683 source files → 424 classified, 259 unclassified = **9 LLM batch
  calls per full analyze**. Jam's Step 1 has since improved this; the current figure is Jam's to
  state, not mine.
- The hello-world's 66% floor is **3-class, 6 held-out samples, seed 42, 33% baseline**. It is not
  evidence about the 17-class task.

**Doctrine points that bind me specifically:**

- Never report an accuracy or token number without its **seed and its baseline**, in a committed
  script another team can run.
- `origin/main` carries **no `Claude-Context/`** (re-verified 2026-08-13), so this branch is based
  on `nolan-work`, not `main`. Open as `TN-F1`.
- The documented `elm/<lead>/<topic>` convention has never been used on any remote; real flow is
  `<TeamBranch>` → `dev` → `main`. My branch name came from the lead directly.

## Current state

Onboarded 2026-08-13. Worktree and branch created off `nolan-work` at `f52eb253`, `pnpm install`
clean, `gh` default set to `AsterMindAI/n-dx`. `TN-J3` claimed — it was `PENDING` / unclaimed on
both boards, confirmed before claiming. **No investigation work done yet beyond the verification
recorded above**, and no source file has been edited.

Waiting on one thing: whether an LLM is actually reachable. A `claude` binary now exists on PATH
(`2.1.231`) that was **not** there when Jam recorded `TN-J8` — but presence is not authentication
and I have not verified it can complete a request. Asked Jam for the probe result rather than
duplicating it. If it is reachable, the first fresh hench run is unblocked and `TN-J3` stops being
a five-month-old question.

## Next up

- [ ] Produce one hench run on current code and observe what `tokenUsage` actually records. This is
      the measurement that has never been taken; everything else is speculation until it exists.
- [ ] If it still reads zero: trace parse → accumulate → persist and find the break. `token-usage.ts`
      parsing and `event-accumulator.ts:445-536` are the two ends; the persist step between them is
      unread so far.
- [ ] If it reads correctly: say so plainly and **correct `TN-J3` where it landed** — the backlog
      row, `SYNC-001` § 5 item 5, and the IMPL's open questions all assert a broken counter. A
      stale "we cannot measure tokens" blocks Paths B and C for no reason.
- [ ] Either way, leave behind a committed, re-runnable way to check this, given `.hench/runs/` is
      ignored. Without it the next person is back to six files from February.
- [ ] Report the result to the lead — Path A gates B and C, and both are waiting on a number.

## Session log

Newest at the top. One entry per session. **Do not edit past entries** — append corrections as a
new entry, and if a past entry is wrong, say so explicitly in the new one.

---

### 2026-08-23 (d) — `TN-J3` root-caused and fixed. The counter was genuinely broken.

**Did:**

- Ran Lane A1 to completion. **`manifest.tokenUsage = {calls: 9, inputTokens: 0, outputTokens: 0}`**
  — nine real LLM calls on current code, both counters zero.
- Root-caused it to `parseCliTokenUsage` reading only top-level token fields while the current CLI
  (2.1.237) nests them under `usage`. **Verified by dumping a real envelope**, not by inferring from
  Jam's payload: none of the four fields it looks for exist at top level.
- Fixed it by mirroring `parseStreamTokenUsage`, which already handled nesting. **Test written
  first and watched go red** (3 failures, `expected 'unavailable' to be 'complete'`), then green.
- Proved it through the live chain: `callClaude` went from `tokenUsage: undefined` to
  `{input: 2, output: 4, cacheCreationInput: 22617, cacheReadInput: 23331}`.
- Released the corpus-repo claim; sent Jam the result note; merged everything to `Nolan-Work`.

**Learned:** (gotchas, API surprises, measured numbers — always with seed + baseline)

- **`calls` increments before the usage guard** (`accumulateTokenUsage`: `calls++` then
  `if (!usage) return`). That asymmetry is what made the bug diagnosable — `calls: 9` with zero
  tokens proves the parser returned `undefined` nine times, and points past the parsers to the
  envelope shape. A counter that failed on both fields would have said much less.
- **The stale assumption was documented as fact.** The old doc comment asserted the CLI "includes
  usage fields at the top level" — true once, false now, and trusted in between. The sibling
  stream parser had the correct behaviour the whole time.
- **Per-spawn overhead is a range, not a constant: 22,110 / 34,526 / 45,948 tokens** across three
  observations of the same trivial 2-in/4-out prompt (Jam's, and two of mine). Better than 2x
  spread, moving with cache state. **Any single multiplier quoted for "tokens per avoided call" is
  wrong**; A4 must report a range from real classify calls.
- **My own framing needs correcting where it landed:** I said the six February runs could not
  establish a live defect. That reasoning was right and the conclusion still came out "broken" —
  the evidence was insufficient, not misleading. Corrected the backlog row rather than only saying
  so here.

**Broke / still broken:**

- **`pnpm test`: 1 failed | 1991 passed | 1 skipped.** The failure is **not mine** —
  `tests/e2e/architecture-policy.test.js` rejects direct `child_process` imports in
  `scripts/elm-calls-avoided.mjs` and `scripts/elm-corpus-build.mjs`, both Jam's. **Verified by
  stashing my diff and re-running: it still fails.** Reported to Jam by note, not fixed — the IMPL
  seam table puts `scripts/elm-*` on their side, and `tests/e2e/**` needs a claim.
- Typecheck clean across all 6 packages. 51/51 in the token-usage file.

**Left undone and why:**

- **A2, the hench path, is unverified.** Same shared parser so it is *probably* fixed, but probably
  is not verified. **No hench token number should be quoted yet.**
- **A5 / `TN-B1` still blocked**, correctly — on the ADR weighting question and on notes to the
  teams owning `packages/rex` and `packages/web`.
- **No dollar figure.** `total_cost_usd` sits in the envelope and nothing reads it.
- **A4 not done** — the overhead range above comes from trivial prompts, not real classify calls.

**Notes sent / received:**

- **Sent:** `NOTE-nolan-internal-2026-08-23-tn-j3-root-caused-and-fixed.md` — the result, the
  mechanism, the overhead range, what I have *not* verified, and the architecture-test failure in
  their scripts.

**Handoff:**

- **A2 next:** one hench run, read `.hench/runs/*.json`, confirm the fix reaches that path too.
  Then A4 across real classify calls to turn the overhead range into a defensible multiplier.

---

### 2026-08-23 (c) — ADR + IMPL written and merged; Lane A1 measurement running

**Did:**

- Merged `Nolan-Work-Butter` → `nolan-work` twice and pushed (`1077c766`, `a36213e3`), delivering
  my note to Jam and then the ADR/IMPL. Per `TN-F3`, a note is delivered by merging, not writing.
- Read Jam's reply (`NOTE-nolan-internal-2026-08-23-token-accounting-evidence.md`) and **corrected
  my own note in place before it shipped** — I had advised `ndx config llm.claude.cli_path`, which
  is wrong: `.n-dx.json` is committed and shared, and the path is machine- and extension-version-
  specific. Jam caught it independently. Fixed in § 1 of the note, not only in an appended update.
- Wrote [`ADR-2026-08-23-butter-savings-measurement-contract.md`](../ADR/ADR-2026-08-23-butter-savings-measurement-contract.md)
  (Proposed) and [`IMPL-2026-08-23-butter-token-measurement-and-path-a-b-seam.md`](../IMPL/IMPL-2026-08-23-butter-token-measurement-and-path-a-b-seam.md),
  splitting the work into Lane A (mine) and Lane B (proposed for Jam, explicitly not assigned).
- Raised `TN-B1`, deliberately `BLOCKED`, and claimed the shared corpus repo in `IN-FLIGHT.md`
  **before** running against it.
- Started Lane A1: `sourcevision analyze ~/n-dx-elm-corpus/AsterMind-Community-Edition --full`.

**Learned:** (gotchas, API surprises, measured numbers — always with seed + baseline)

- **The token undercount is systemic across two packages, not one bad line.** Verified by reading:
  `rex/src/cli/commands/usage.ts:43` and `:60` total `inputTokens + outputTokens`;
  `rex/src/core/item-token-rollup.ts:97-98` accumulates only those two while declaring the cache
  fields at `:207-208`. **And `packages/web` repeats the pattern exactly** —
  `routes-token-usage.ts:30-31`/`:54-55` carry `cacheCreationTokens`/`cacheReadTokens` through the
  types, then `:544`, `:585` and `viewer/views/token-usage.ts:222-223` total on input+output only.
  Both data models know about cache tokens; every total drops them. **A rex-only fix would not
  change what the dashboard shows.**
- **On Jam's measured payload that is 6 tokens counted out of 22,116 — 0.027%.** Arithmetic on
  Jam's numbers, which I have **not** independently reproduced; re-measuring is A4.
- **A worktree does not isolate `sourcevision analyze <other-repo>`.** The isolation is
  per-checkout, and `--full` writes `.sourcevision/` into the *target* repo — which is Jam's
  durable corpus clone, outside both checkouts. Claimed it in `IN-FLIGHT.md` before running. This
  is a gap in how I had been reasoning about worktree safety and is worth remembering.
- Jam's `analyze.ts:201-210` account checks out: `finalizeTokenUsage` prints the usage line and
  writes `manifest.tokenUsage` only at end of run, gated on `calls > 0`. So Jam's empty manifest
  was an early kill, not a zero counter — and mid-run `tokenUsage: null` is expected, not a result.

**Broke / still broken:**

- Nothing. No source file edited yet; the only writes are docs and the corpus repo's
  `.sourcevision/`, which is claimed.

**Left undone and why:**

- **A1 has not finished, so I still have no token number and am claiming none.** The run was live
  when I wrote this entry.
- **A5 not started, correctly:** blocked on the ADR's weighting question (a three-lead call) and on
  notes to the teams owning `packages/rex` and `packages/web`. A1–A4 do not depend on it.
- **Notes to Jarrett and Thomas not sent** — the ADR is Proposed, and broadcasting an unaccepted
  ADR as settled is the exact mislabelling it exists to prevent. They go out on acceptance.

**Notes sent / received:**

- **Received:** Jam's token-accounting evidence note — the CLI path, the usage payload, the
  `--fast` and scratchpad traps, and an acknowledgement on `TN-J3`.
- **Sent:** my note, merged to `Nolan-Work` and now actually delivered.

**Handoff:**

- Read A1's output: the `Token usage:` line printed by `finalizeTokenUsage`, and
  `~/n-dx-elm-corpus/AsterMind-Community-Edition/.sourcevision/manifest.json` → `tokenUsage`.
  **Then release the `IN-FLIGHT` claim on that repo** — Jam is blocked from analyzing it until I do.

---

### 2026-08-13 (b) — Read Jam's work; note sent. `TN-J8` may already be unblocked.

**Did:**

- Read Jam's charter end to end, the three 08-13 session entries, `scripts/elm-corpus-build.mjs`,
  and the 08-13 ADR/IMPL. Then verified independently rather than inheriting Jam's conclusions.
- Sent `Notes/NOTE-nolan-internal-2026-08-13-tn-j8-may-be-unblocked.md` (Butter → Jam).

**Learned:** (gotchas, API surprises, measured numbers — always with seed + baseline)

- **`TN-J8` — "no LLM reachable" — is probably stale.** `command -v claude` →
  `/Users/nolanmoore/Library/pnpm/claude`, `--version` → `2.1.231 (Claude Code)`, on PATH at
  position 12. Binary `mtime` is **13:53:56**, against Jam's `TN-J8` record at **13:01:55** and last
  commit at **13:06:10** — it arrived ~47 min after Jam stopped. Jam's finding was correct when
  made; it appears to have been actioned since.
- **Two limits on that, stated because they matter:** `mtime` is inference, not proof of install
  time; and **presence is not authentication**. All five candidate API-key vars are unset, so if it
  works it is a signed-in session, not a key. I could not check the stored credential — the
  sandbox blocked the keychain read and **I did not work around it**. So: reachable-looking,
  unverified.
- **If the probe still fails while `command -v claude` succeeds, it is a different bug.**
  `resolveCliPath` (`config.ts:385-387`) returns `claudeConfig.cli_path ?? "claude"` — a bare name
  handed to the spawn, relying on the child inheriting a PATH containing `~/Library/pnpm`. That is
  exactly the failure mode a pnpm-global install produces, and the fix is
  `ndx config llm.claude.cli_path <path>`, not an install.
- **I was wrong about `TN-J7` board drift.** I reported to the lead that `TN-J7` was claimed on the
  backlog with no `IN-FLIGHT.md` row, and called it the same failure mode as the earlier `TN-J5`
  mismatch. It is not. Jam **added** the row in `90362703` (13:01:55) and **removed it themselves**
  in `f52eb253` (13:06:10) on stopping work — which is what `IN-FLIGHT.md` § 1 instructs. An open
  backlog item plus a released claim is correct, not drift. Checked my own commit first to be sure
  I had not clobbered the row: `git show 5d895d41 -- Claude-Context/IN-FLIGHT.md` touches no
  `TN-J7` line. Corrected to the lead; kept out of the note.

**Broke / still broken:**

- Nothing. Still no source file edited and no test run, so I still claim no test result.

**Left undone and why:**

- **Did not run the `complete()` probe myself.** It is Jam's `TN-J8`, Jam already wrote the probe,
  and duplicating it risks two agents spending tokens on the same question. Asked for the result
  instead.
- **Did not verify CLI authentication** — blocked, see above. Named as unverified rather than
  guessed at.
- Still no fresh hench run, so `TN-J3` remains an open question, not a finding.

**Notes sent / received:**

- **Sent:** `Claude-Context/Nolan-Agents/Notes/NOTE-nolan-internal-2026-08-13-tn-j8-may-be-unblocked.md`
  → Jam. Covers: (1) `TN-J8` likely unblocked + the `resolveCliPath` alternative; (2) `TN-J3`'s
  evidence is five months stale and I have claimed and corrected it; (3) worktrees do not isolate
  `.hench/runs/` and new runs will not commit. Asks two things back: the probe result, and whether
  "we cannot measure tokens" is relied on anywhere beyond `SYNC-001` § 5, the survey ADR, and the
  IMPL open questions.
- **Delivery caveat, per Jam's own `TN-F3`:** the note is committed on `Nolan-Work-Butter`, not
  Jam's branch. Until this merges to `dev` and `dev` reaches `Nolan-Work`, it is **written, not
  sent**. Raised with the lead.

**Handoff:**

- Chase the probe result. If the LLM is reachable, the first hench run — the measurement nobody has
  taken since February — becomes possible immediately, and it is the gate on everything in `TN-J3`.

### 2026-08-13 — Onboarding; claimed `TN-J3`; found its evidence base is five months stale

**Did:**

- Read the full Step 1 set: `claude-context-instruction`, `Command-Structure`,
  `GITHUB-WORKFLOW.md`, `OWNERSHIP.md`, `IN-FLIGHT.md`, root `CLAUDE.md`,
  `scripts/elm-hello-world.mjs`. Then `SYNC-001` (assigned reading — Path A), the Team Nolan
  `README`/`BACKLOG`/`Notes`, and `IMPL-2026-08-13-jam-elm-classification-build.md` to find Jam's
  seam.
- Verified before creating anything: name `Butter` free (no charter on any team, zero hits in
  `Claude-Context/`); `origin` = `AsterMindAI/n-dx` and `upstream` = `en-dash-consulting/n-dx`;
  `TN-J3` `PENDING` / unclaimed on the backlog and absent from `IN-FLIGHT.md`.
- Created worktree `/Users/nolanmoore/n-dx-butter` on `Nolan-Work-Butter`, based on `nolan-work`
  (**not** `main` — `main` has no `Claude-Context/`). `pnpm install` clean; `gh repo set-default
  AsterMindAI/n-dx` confirmed.
- Claimed `TN-J3` on the backlog, added a roster row, and added an `IN-FLIGHT.md` claim row for
  `packages/llm-client/**` + `packages/hench/**` and for hench runs as a state-writing command.

**Learned:** (gotchas, API surprises, measured numbers — always with seed + baseline)

- **`TN-J3`'s evidence predates the code it indicts.** All six runs are `2026-02-04`;
  `event-accumulator.ts` arrived `2026-04-21` (`0269cf75`). The zeros are real but they are not
  evidence about today's code. **No number about token accounting should be quoted until a fresh
  run exists.** I have not made one yet, so I am asserting nothing about whether it works.
- **`.hench/runs/` is gitignored (`.gitignore:5`) yet those six files are tracked** — committed
  before the rule, and gitignore does not untrack retroactively. So they are present in every
  worktree (worktree isolation does not isolate them), and new runs will not commit. Fresh evidence
  needs a deliberate fixture.
- The parsers are genuinely wired in — `cli-provider.ts:37` imports them, `:348`/`:357`/`:378` call
  them — so "the parsers are never called" is the wrong theory to start from.
- **The shared checkout is not theoretical.** HEAD moved twice while I was reading files in it
  (`07bafec7` → `26a191e7` → `f52eb253`). That is the concrete conflict that justified splitting to
  a worktree.

**Broke / still broken:**

- Nothing broken by me. No source file edited, no test run yet — so I claim no test result.

**Left undone and why:**

- **The actual investigation.** This session was onboarding; the fresh hench run is the first real
  step and starts next session.
- **The other half of Path A** (the ELM inference wrapper) is unclaimed and I have deliberately not
  taken it — see § Scope.
- **Did not fix two board inconsistencies I found**, because both are Fluff's territory or the
  lead's call, not mine to edit unilaterally. Raised in my report instead: (a) `TN-J7` is claimed in
  a commit message and on the backlog but has **no `IN-FLIGHT.md` row**; (b) earlier the same day
  `TN-J5` was claimed in `IN-FLIGHT.md` while the backlog still read `PENDING` / unclaimed — since
  resolved to `DONE` by Jam. Both are the same failure mode: the two boards drifting, when
  `BACKLOG.md` is doctrinally the source of truth for claims.

**Notes sent / received:**

- None sent. Read the Team Nolan inbox: `NOTE-jarrett-to-nolan-2026-08-08-unify-agent-structure-reply.md`
  and `NOTE-nolan-internal-2026-08-11-note-rename.md`. Neither is addressed to my work; nothing
  blocked on me.

**Handoff:**

- Run hench once on current code and read `tokenUsage` from the resulting run file. Everything in
  `TN-J3` downstream of that is speculation until that number exists.

---
