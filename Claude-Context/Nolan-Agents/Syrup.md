# Agent: Syrup

- **Team:** Team Nolan
- **Lead:** Nolan
- **Backlog prefix:** `TN-S`
- **Branch:** `nolan-work` — **shared checkout**, alongside Jam and Fluff (lead's decision, 2026-08-31)
- **Worktree:** _(none — shared checkout `/Users/nolanmoore/n-dx-1`)_ See the hazard note under Scope.
- **Inbox:** `Claude-Context/Nolan-Agents/Notes/`

## Scope

I am Team Nolan's **reader of the other two teams**. Jarrett and Thomas work on their own
branches; their findings reach us only when someone goes and looks. That is my whole job.

**Owns:**
- Reading `origin/Jarrett`, `origin/Thomas_Branch`, `origin/Thomas's_Branch` and any future
  Jarrett/Thomas branch — their ADRs, IMPLs, charters, backlogs, notes, and code diffs.
- Writing **within-team notes** (`NOTE-nolan-internal-YYYY-MM-DD-<slug>.md`) into
  `Claude-Context/Nolan-Agents/Notes/` that tell Jam and Butter what the other two teams have
  found, and what it means for their in-flight work.
- My own charter, my own `BACKLOG.md` rows (`TN-S*`), and my own `IN-FLIGHT.md` claim row.

**Does not own — and must not touch:**
- **Anything on `origin/Jarrett`, `origin/Thomas_Branch`, or `origin/Thomas's_Branch`.**
  Read-only, always. No commits, no pushes, no cherry-picks, no "small fixes" onto their
  branches. If I find a defect in their territory I report it to Jam and Butter, and — if it
  warrants it — draft an outbound `NOTE-nolan-to-<lead>-…` for **Nolan to send**. I do not send
  cross-team notes on my own authority.
- `packages/sourcevision/src/analyzers/**` — Jam's (Path B).
- `packages/llm-client/src/{token-usage,cli-provider,api-provider}.ts`,
  `packages/hench/src/agent/lifecycle/event-accumulator.ts`, `scripts/elm-prototype/**` —
  Butter's (Path A measurement half + the prototype).
- `Claude-Context/` root doctrine docs — Fluff's (`TN-F1`).
- **All source code.** I ship analysis and notes, not code.

> **Shared-checkout hazard (I am on one).** `.rex/`, `.sourcevision/`, `.hench/` have no file
> locking; concurrent writers lose data silently. Jam and Fluff share this working directory with
> me. **My work runs no state-writing command** — no `ndx plan|work|ci|refresh|self-heal`, no rex
> MCP write. Reading branches is `git show` / `git diff`, which touches none of it. If that ever
> changes, it gets its own `IN-FLIGHT.md` claim row first.

## Standing context

Facts I should not have to re-derive. **Delete anything that goes stale.**

### The project

n-dx pays a hosted LLM for every inference; the job is to replace what can be replaced with local
ELMs via `@astermind/astermind-community`. Only **2 of 22 LLM call sites** are ELM-shaped
(`TN-J1` survey): sourcevision archetype classification (`analyzers/classify.ts:404`, 17 classes)
and rex granularity assessment (`rex/src/analyze/reason.ts:1481`, 3 classes). The other 20
generate prose and stay hosted.

### ELM library gotchas (from `scripts/elm-hello-world.mjs`)

- `charSet` is interpolated **unescaped** into a RegExp character class — a literal `-` must come
  **last** or it forms an invalid range and throws.
- Text training requires `useTokenizer: true`, or `train()` throws.
- npm's latest is `3.0.0`; repo pins `^3.0.0`. **v4 is tagged on GitHub but unpublished and
  breaking — do not chase it.**
- **There is no `Evaluation` module.** It is the loose functions `evaluateClassification(yTrue,
  yPred, opts)` and `formatClassificationReport(report)`, plus `confusionMatrixFromIndices` and
  `topKAccuracy`. Butter verified this by enumerating all 160 exports, 2026-08-27.
  `IMPL-2026-08-13-jam-elm-classification-build.md` § Step 3 line 310 still says otherwise.
- `maxLen` truncates the **tail**. Butter's `maxLen: 32`, copied from the hello-world, cut 282 of
  324 corpus paths (87%) and discarded the filename — producing a 4.8% score that was a config
  bug, not a result. Real corpus needs `maxLen: 80` and an uppercase charSet.

### The seam

**The ELM is a registered vendor, not a fork.** `ProviderRegistry.register(vendor, factory)` at
`packages/llm-client/src/provider-registry.ts:96`. Bolting ELM into existing provider files
guarantees three-way conflicts — all three teams have reason to touch them.
*(Note: `ADR-2026-08-23-butter-elm-inference-module.md` decided the ELM lands as a **tier at the
call site**, not a registered vendor — closing `SYNC-001` § 5 item 2. The registry is still the
seam for anything that genuinely is a vendor.)*

### Doctrine facts that bind my output

- **Never report an accuracy number without its seed and its baseline.** If it isn't a committed,
  seeded script another team can run, it didn't happen.
- **A subagent's report is a lead, not a finding.** Verify at `file:line` before publishing.
- **Notes are delivered by MERGING, not by writing.** A note exists only on the branch it was
  committed to. My notes to Jam and Butter land on `nolan-work`, which is where they both read —
  so they arrive. Anything outbound to Jarrett or Thomas would need to reach `dev` to be real.
- **Baselines are computed, not quoted.** The 38.0% majority baseline is derived (`service`
  123/324), not stored in `stats.distribution`. It moves with the corpus.

### Repo hazards

- `packages/sourcevision/src/cli/commands/analyze-phases.ts` contains two raw **NUL bytes**
  (offsets 16345, 16374). `file` reports it as `data`, so **grep exits 1 and prints nothing** —
  silence, not an error. Any repo-wide grep has a hole in it. Use `grep -a`, `rg --text`, or
  `python3`.
- **`origin/main` carries no `Claude-Context/`.** The agent system lives on `dev`,
  `nolan-work`/`Nolan-Work`, and `origin/Jarrett`. No `elm/*` branch has ever existed on any
  remote, despite four documents mandating that convention (`TN-F1`, ADR still Proposed).
- **`git fetch upstream` is not enough** — it leaves `origin/*` stale and every comparison you
  then run is against a stale picture. Always `git fetch --all`.

## Current state

> ## ▶ RESUME HERE — reconstructed 2026-09-21 by Nutella, at the lead's request
>
> **Why this block exists.** The lead lost Syrup's cached session history on 2026-09-21 (remote
> access). This charter's log stopped at **2026-08-31**, but Syrup did three weeks of committed work
> after that. Everything below is **reconstructed from committed notes, ADRs and artifacts** — not
> from Syrup's reasoning, which is not recoverable. Commit hashes are given where they exist.
>
> **⚠️ The `Next up` section below is from 2026-08-31 and is stale** — Jarrett has since pushed all
> five `elm/*` branches (including `TJ-A3`), so "re-read both branches after Jam replies" is
> superseded. **Use this block.** The old text stays, per the project's rule on visible corrections.
>
> **Syrup's live commitments:**
> 1. **`SYNC-002` action #5 — commit the capacity-sweep harness, or withdraw that row.** Syrup's
>    own weekly note flags that the "capacity 1024 → 4096: held-out +3.8 pp, fresh −4.5 pp" row came
>    from a **scratchpad simulation on 2026-09-11 with no committed artifact**, since rotated. By
>    this project's standard it is a lead, not a finding, until committed.
> 2. **The CV-vs-deployment anti-correlation — Syrup proposed it deserves its own ADR.** Three
>    instances where a change that helped train-CV/held-out hurt fresh-ecosystem coverage (capacity,
>    structural features; corpus v1→v2 was the exception). **Only two of the three have committed
>    artifacts** — item 1 is the prerequisite.
> 3. **Review Nutella's row schema before any harvest at scale** — Syrup's own request (09-16), which
>    Nutella accepted. Not yet sent.
> 4. **The Elon ↔ Nutella seam** (`SYNC-002` blocker #2) — Jarrett's new agent Elon (`TJ-E1`) is
>    building content features for the ELM while Nutella builds the database they would be computed
>    from. Syrup surfaced it; it is a leads' action now.
>
> **Syrup's standing record, which a revived Syrup should not re-derive:**
> - **The 28.0% v2 coverage figure was right, to the decimal.** Challenged by Nutella (no artifact)
>   and by Jam ("narratively convenient"); Jam then ran it and got 28.0% (`f3a88d39`) and retracted
>   in place (`f95b8cd3`). The only real gap was a number without a committed invocation.
> - **Two of Syrup's claims were corrected and Syrup accepted both:** the "105 free training rows"
>   (repeated from `ELM-CORPUS.md` § 7 — ecosystem-level contamination; retracted at source), and the
>   `ELM.train()` proof (resting on 3-byte `savedModelJSON` byte-identity; the behavioural test is
>   the real proof — the defect itself stands).
> - **⚠️ Syrup's 09-21 weekly note § 1 says `elm-coverage-v3-primary.json` is uncommitted. It was
>   committed at `21d4c083` (11:46), within minutes.** A revived Syrup should not re-chase it. *(The
>   author field is the shared git identity, so which session committed it is not recoverable.)*
>
> **Not reconstructable:** Syrup's reasoning between commits, any uncommitted or scratchpad work —
> including the capacity simulation behind item 1, which is why that row needs re-running.


`TN-S1` delivered 2026-08-31. Surveyed `origin/Jarrett` (41 commits ahead) and both Thomas branches;
two notes written to Jam and Butter. **Headline: all three teams have independently built an ELM
classifier into `packages/sourcevision/src/analyzers/`, and both other teams shipped theirs
disabled** for the same reason Jam identified on 08-11 — the population that reaches the LLM has a
100% empty evidence vector. Open: whether Nolan wants § 1 / § 5 of the Jam note escalated as
outbound cross-team notes (I draft, the lead sends).

## Next up

- [x] `TN-S1` — survey `origin/Jarrett` and both Thomas branches; write the findings notes to Jam
      and Butter. **Done 2026-08-31.**
- [ ] **Nolan's call:** escalate the three-team collision, the missing `TJ-R1` ADR, and Team Thomas
      running outside the doctrine as outbound notes? I draft; the lead sends.
- [ ] Re-read both branches after Jam replies — `TJ-A3` (archetype taxonomy redesign) is currently
      **Unassigned** on Jarrett's board and would move the labels under our corpus if it lands.
- [ ] Thomas's `Thomas's_Branch` is diverged from `Thomas_Branch` and missing the agent-structure
      unification; watch whether that gets reconciled before anyone tries to merge either.

## Session log

Newest at the top. **Do not edit past entries** — append corrections as a new entry.

---

### 2026-09-01 → 2026-09-21 — RECONSTRUCTED 2026-09-21 by Nutella, not contemporaneous

> **Written by Nutella, not Syrup**, at the lead's request after Syrup's cached history was lost.
> Each line is a committed artifact; the reasoning is Syrup's and is not reproduced. **If Syrup is
> revived and remembers differently, Syrup's account wins** and this entry should be corrected in
> place.

**Did (by artifact):**
- **09-04 — two ADRs + IMPLs** (`f3a3e879`):
  `ADR-2026-09-04-syrup-merge-elm-corpus-into-jarrett-harness.md` (`TN-S2`) — the corpus, not the
  frozen model, is the merge unit; four of five integration blockers were artifacts of choosing the
  wrong thing to merge; the coverage check should become a runtime gate — and
  `ADR-2026-09-04-syrup-merge-thomas-path-text-classifier.md`.
- **~09-11 — capacity gate simulation** (1024 → 4096: held-out +3.8 pp, fresh −4.5 pp). **No
  committed artifact**; the scratch output has rotated. Recorded as a lead only.
- **09-16 — groundwork note to Nutella** (`NOTE-…-syrup-to-nutella-corpus-groundwork.md`). Nothing
  built reads file content; the residue selection bias; the archetype catalog is moving under us
  (`TJ-A3`); pick repos by class need, 30-row floor; **the `ELM.train()` defect** (found by Team
  Thomas's Nala first); the 80% confidence bar is unreachable on measured margins; stated the v2
  fresh coverage as **28.0%**.
- **09-21 — weekly update to Jam** (`NOTE-…-syrup-to-jam-weekly-update.md`). Surfaced the v3
  negative; the CV-vs-deployment anti-correlation; Jarrett pushed all five `elm/*` branches and
  onboarded Elon (`TJ-E1`, content-based); Team Thomas silent 11 days; `origin/dev` broken 16 days.
- **Fed `SYNC-002`** — Jam prepared it "from Syrup's 2026-09-21 cross-team survey."

**Handoff:** see ▶ RESUME HERE under Current state.

---

### 2026-08-31 — Agent created; first read of Jarrett and Thomas. Three teams built the same thing.

**Did:**
- Onboarded per `NEW-AGENT.md`: charter, roster row, `TN-S1` backlog row, read-only `IN-FLIGHT.md`
  claim. Commit `8c0b07ff`. Deviated from Step 4.2 deliberately — no worktree (lead chose shared
  checkout) and no `elm/<lead>/<topic>` branch, because that convention has never been used on any
  remote (`TN-F1`). Working on `nolan-work`.
- Surveyed `origin/Jarrett` (41 commits ahead of main), `origin/Thomas_Branch` (11, stale since
  08-06), `origin/Thomas's_Branch` (6, live to 08-28). **Changed nothing on any of them.**
- Wrote two within-team notes: `NOTE-nolan-internal-2026-08-31-jarrett-and-thomas-both-built-path-b.md`
  (Jam) and `NOTE-nolan-internal-2026-08-31-tokenizer-defect-and-dependency-findings.md` (Butter).

**Learned:** (verified myself — not relayed on their say-so)
- **All three teams independently built an ELM classifier into
  `packages/sourcevision/src/analyzers/`.** Jarrett: `classify-elm.ts` 362 lines + 28 tests,
  `classify.ts` deliberately untouched. Thomas: `classify-elm.ts` 133 lines and **+86 lines inside
  `enrichClassificationsWithLLM`**. Both widened `FileClassification.source` with `"elm"` in
  `schema/v1.ts` — the same one-line change twice. **Both shipped disabled by default.** Neither
  team's claim is on `IN-FLIGHT.md`.
- **`astermind.umd.js:771-773` — `useTokenizer: true` calls `tokenize(text).join('')`.** Joins on
  the empty string, so separators are deleted, not tokenized. There are no token embeddings; it is
  char-level one-hot on the joined string, and strictly worse than `useTokenizer: false`. Found by
  Knight (Team Jarrett); I confirmed it in our installed `3.0.0`. Butter's prototype runs through
  this path.
- **`astermind.umd.js:762-768` — `charToOneHot` lowercases before lookup.** So uppercase was never
  being dropped, and Butter's uppercase charSet adds **26 unreachable slots**: input vector 3,200 →
  5,280 at `maxLen` 80, 2,080 dimensions permanently zero. Reproduced the library's index math over
  the full BMP for both charSets.
- **pnpm: the `pnpm.overrides` behaviour change is in pnpm 11, not 10.33.** Clean-room probe in a
  throwaway dir, only `packageManager` changed: 10.33.0 reads the field silently; 11.23.0 warns
  `The "pnpm" field in package.json is no longer read by pnpm` and ignores it. Thomas's fix
  (migrating to `pnpm-workspace.yaml`) is correct; their stated cause is off by a major version.
  `origin/main`'s lockfile still carries the resolved `overrides:` block, so the 14 CVE pins are
  live today — the hazard is that **my own global pnpm is 11.23.0**, so any lockfile regeneration
  outside corepack's pin silently drops them. `TN-B3` Step 0 is exactly that operation.
- **`TJ-R1` is marked DONE citing `ADR-2026-08-24-realm-elm-primary-classifier-pivot.md` and its
  IMPL. Neither exists on any branch** — enumerated `Claude-Context/` across every remote branch.
- **Jam's 08-11 zero-evidence finding is the most reproduced result on this project.** Nala
  (Thomas) 08-20: 0 of 260 resolved, all 260 with empty `evidence`, margins ~0.002. Archer
  (Jarrett) 08-27: 100% zero-evidence across 5 codebases, no exceptions. Archer's mechanism is the
  sharpest statement of it — signal weights are 0.4-0.9 and `PRIMARY_THRESHOLD` is 0.4, so one
  matched signal already resolves a file; there is no partial-signal middle ground by construction.
- **Jarrett's 100% @ 59.0% out-of-domain is real and Archer invalidated it themselves**, in
  writing, unprompted: every held-out set was drawn from files that already had a resolvable label,
  which by construction excludes the population the pre-filter exists to serve. Their number and
  our 4.8% are measured on opposite sides of the same wall.
- **Both other teams independently proposed raw path text as the fix** — which is Butter's
  prototype. We are the only team that has actually run the treatment they are both queued to build.
- **Team Thomas is not on our doctrine.** `Thomas's_Branch` and `Thomas_Branch` have diverged
  (neither contains the other); the live one is missing `4f561097`, the agent-structure
  unification, so it still carries `team/archer.md`, `Claude-Context/Claude-Agents/`, and a
  **numbered** `ADR-001-…` outside `Claude-Context/ADR/`, authored by "Nala (head engineer)" with
  no charter or backlog row. This is `TN-F1`'s consequence, not carelessness: doctrine only exists
  on branches that merged it.

**Broke / still broken:**
- Nothing. I ran no state-writing command and no test suite — this task was read-only against git
  plus two isolated scratchpad scripts outside the repo.

**Left undone and why:**
- **Did not verify Thomas's 83% hello-world citation by running their copy.** Butter's control run
  of the same script, same seed, reports 100%. Flagged to Butter as a discrepancy rather than
  resolved, because the control gate is Butter's and re-running it is theirs to do.
- **Did not commit a seeded script for the charSet/tokenizer findings.** The reproduction is in my
  scratchpad only, so by this project's own standard it does not yet count. Offered to Butter.
- **Did not read Jarrett's `ADR-2026-08-12-knight-elm-prefilter-classify.md` in full** — cited
  repeatedly by Archer but I only read it through Archer's summaries. Knight's TextEncoder finding I
  verified independently at source, so the one load-bearing claim does not rest on it.
- **Did not draft the outbound cross-team notes.** Sending across a seam is the lead's call and I
  am not going to pre-empt it.

**Notes sent / received:**
- Sent: `Nolan-Agents/Notes/NOTE-nolan-internal-2026-08-31-jarrett-and-thomas-both-built-path-b.md` (Jam)
- Sent: `Nolan-Agents/Notes/NOTE-nolan-internal-2026-08-31-tokenizer-defect-and-dependency-findings.md` (Butter)
- Read on arrival: Butter's two 08-27 notes (no `Evaluation` module; prototype ready, verdict is Jam's).

**Handoff:**
- Next session starts by checking whether Jam or Butter replied, and whether Nolan wants the
  outbound notes drafted. If neither has moved, re-read `origin/Jarrett` for new commits — Archer
  was mid-`TJ-A2` with steps 10-11 (regression fixture, whole-repo build) outstanding.

---
