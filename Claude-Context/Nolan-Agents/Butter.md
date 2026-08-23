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
