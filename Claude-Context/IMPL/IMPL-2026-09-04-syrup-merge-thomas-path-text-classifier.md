# IMPL — Retracting the prototype numbers and adopting Thomas's path-text representation

- **Implements:** `ADR-2026-09-04-syrup-merge-thomas-path-text-classifier.md`
- **Pairs with:** `IMPL-2026-09-04-syrup-merge-elm-corpus-into-jarrett-harness.md` — Phase 3 of
  this document and Phase 3 of that one edit the same file and **must not run concurrently.**
- **Owner:** Syrup (Team Nolan) — **Phases 1-2 only.** Phase 3 is Jarrett's and Thomas's; Phase 4
  is the leads'.
- **Backlog item:** `TN-S3` (Team Nolan half). The cross-team half belongs under `TT-N1`/`TJ-A2`
  and is theirs to number.
- **Branch:** `Nolan-Work` — shared checkout, no worktree (lead's decision 2026-08-31). No
  `elm/*` branch; that convention exists on no remote (`TN-F1`), which this IMPL re-confirmed
  while auditing Thomas's own IMPL for the same gap.
- **Status:** **Not started.**

---

## Ownership split

| Phase | Steps | Owner | Blocks on |
|---|---|---|---|
| **1 — Retract** | 0-3 | **Syrup (Nolan)** | nothing |
| **2 — Fix the hello-world** | 4-6 | **Syrup (Nolan)**, Butter reviews | Phase 1 |
| **3 — Merge the classifiers** | 7-11 | **Jarrett + Thomas** | their acceptance |
| **4 — Sign-offs** | 12-13 | **The leads** | Phase 3 |

**Phase 1 depends on nobody, so do it first.** Four documents carry void numbers, one of them
mine. No ADR carries them — Butter's `prove-before-provisioning` is **Proposed** and deliberately
published none — so this is less urgent than it first looked, but it is still the item most likely
to mislead the next reader, because three of the four carriers are notes people actually read.

---

## Scope

**In scope:**

- Retracting 4.8%, 9.6%, the uppercase/lowercase A/B, and the 83% hello-world figure **at the
  documents where they landed**, not only in the new ADR.
- A committed, seeded script proving `ELM.train()` ignores its argument.
- Porting `scripts/elm-hello-world.mjs` to the API that actually trains.
- Folding Thomas's path-text encoder and margin abstention into Jarrett's harness.

**Out of scope (explicitly):**

- **Re-running the prototype "correctly."** It is superseded by Jam's feasibility screen and the
  frozen model, both of which already use `trainFromData` on the harder population. Rebuilding it
  would produce a third path-text number nobody needs. Step 3 retires the lane instead.
- **Flipping `ELM_GATE_ENABLED` or `elmPrefilter.enabled`.** Neither flips in this IMPL.
- **Deleting Thomas's or Jarrett's work.** Step 9 merges implementations; it does not pick a winner
  between teams.
- **The corpus.** That is the paired IMPL. This one is representation only.
- **`TJ-A3`.** We sequence behind it; we do not touch it.
- **Re-running Thomas's 90.6% eval.** Their committed script, their number.

---

## Files touched

**No note has been sent to Jarrett or Thomas.** Step 6 is that note; every row marked
"NO — Step 6" is blocked on it.

| Path | Owning team | New/Edit | Note sent? |
|---|---|---|---|
| `scripts/elm-train-argument-probe.mjs` | Nolan | **New** — the retraction proof | n/a |
| `Claude-Context/Nolan-Agents/Notes/NOTE-nolan-internal-2026-08-27-prototype-ready-verdict-is-yours.md` | Nolan (Butter) | Edit — correction pointer | n/a, but **tell Butter** |
| `Claude-Context/Nolan-Agents/Notes/NOTE-nolan-internal-2026-08-31-syrup-verified-you-were-right.md` | Nolan (Butter) | Edit — correction pointer | n/a |
| `Claude-Context/Nolan-Agents/Notes/NOTE-nolan-internal-2026-08-31-jarrett-and-thomas-both-built-path-b.md` | **Nolan (Syrup — mine)** | Edit — correct my own published number | n/a |
| `Claude-Context/Nolan-Agents/Jam.md` | Nolan (Jam) | Edit — charter relay | **Jam's — ask** |
| `Claude-Context/Nolan-Agents/ELM-FINDINGS.txt` | Nolan | Edit — record the retraction | n/a |
| `Claude-Context/Nolan-Agents/BACKLOG.md` | Nolan | Edit — `TN-S3`; retire `TN-B7` | n/a |
| `Claude-Context/IN-FLIGHT.md` | **SHARED** | Edit — claim + finding | ⚠️ conflict file |
| `scripts/elm-hello-world.mjs` | Nolan *(root `scripts/`)* | Edit — port to `trainFromData` | announce in `IN-FLIGHT` |
| `scripts/elm-prototype/**` | Nolan (Butter) | Edit — header retraction | **Butter's — ask first** |
| `Claude-Context/{Jarrett,Thomas}-Agents/Notes/NOTE-nolan-to-*-2026-09-04-*.md` | Jarrett / Thomas | **New** | **these ARE the notes (Step 6)** |
| `packages/sourcevision/src/analyzers/classify-elm.ts` | **Jarrett + Thomas** | Edit — add/add resolution | **NO — Step 6** |
| `packages/sourcevision/src/analyzers/classify.ts` | **Thomas** | Edit — unwind the inline gate | **NO — Step 6** |
| `packages/sourcevision/tests/unit/analyzers/classify-elm.test.ts` | **Jarrett + Thomas** | Edit — add/add resolution | **NO — Step 6** |
| `packages/sourcevision/src/schema/{v1,validate}.ts` | **SHARED, 3 teams** | Edit — pick one union order | **NO — Step 6** |

⚠️ **`scripts/elm-prototype/**` is Butter's** per `IN-FLIGHT.md`. Step 3 edits it. **Ask Butter
before touching it** — the retraction is about their work and they should have the chance to write
it themselves. Offer; do not assume.

---

## Steps

### Phase 1 — Retract (Syrup, Nolan) — do this first, it blocks on nothing

**Step 0 — commit the probe as a seeded script.** `scripts/elm-train-argument-probe.mjs`: construct
two base `ELM`s with identical config and `seed: 42`, train one on real rows and one on
deliberately inverted rows, assert `savedModelJSON` is identical, and assert
`predict("<category>")` returns that category. Exit non-zero if the library ever starts honouring
the argument.

**This step exists because the finding does not count until it is committed.** The ADR says so
about itself. A retraction resting on an uncommitted scratchpad probe would repeat exactly the
error it is retracting — and it is the same gap Thomas flagged in their own 0/260 figure.

Add the `ALLOWED` entry in `tests/e2e/architecture-policy.test.js` if the script needs one —
`tests/e2e/**` is shared, so that is a one-line claim in `IN-FLIGHT.md`, same category as the two
Jam added under `TN-J13`.

**Step 1 — claim `TN-S3`** in `Nolan-Agents/BACKLOG.md` + the `IN-FLIGHT.md` row, and commit before
Step 2. Git is the lock.

**Step 2 — retract at the four documents that carry the numbers.** Located by grep, not assumed.
Per `claude-context-instruction` § 8, corrections go in the original, not only in the newest
document:

1. **`NOTE-...-2026-08-31-jarrett-and-thomas-both-built-path-b.md:124` — mine.** I published
   "4.8% agreement, −32.5 points against a 37.3% baseline, seed 42" in the format this project
   reserves for real measurements, without auditing the training call. **Correct this one first**;
   it is the one I have standing to fix without asking anyone.
2. `NOTE-...-2026-08-27-prototype-ready-verdict-is-yours.md:37` — Butter's original 4.8% table.
3. `NOTE-...-2026-08-31-syrup-verified-you-were-right.md` — Butter's 4.8% → 9.6% charSet A/B.
4. `Nolan-Agents/Jam.md:549` — Jam's charter relays it. **Charters are append-only**: do not edit
   the entry, ask Jam to append a correction.

Then `ELM-FINDINGS.txt` (record the mechanism) and `scripts/elm-prototype/{README.md,config.mjs}`
(header note) — **Butter's files; ask first.**

**No ADR needs amending.** `ADR-2026-08-27-butter-prove-before-provisioning.md` is **Proposed**, not
Accepted, and instructs the prototype to publish **no accuracy number** (line 60) — which is why
none of the void figures ever reached an ADR. Verify that yourself before acting on it; I asserted
the opposite in a first draft of this document and it was wrong.

**Step 3 — retire the prototype lane, do not rebuild it.** Mark `TN-B3`'s prototype route and
`TN-B7` accordingly, recording *why*: the lane's measurements went through a call that ignored its
input, and the questions it was built to answer have since been answered on the harder population
by `elm-feasibility-screen.mjs` and the frozen model. **This is a retirement, not a failure** —
the engineering was sound and the config discipline is reusable. Say that plainly in the row, and
tell Butter directly rather than leaving it to a backlog diff.

### Phase 2 — Fix the front door (Syrup, Nolan; Butter reviews)

**Step 4 — port `scripts/elm-hello-world.mjs`** to `UniversalEncoder.encode()` →
`ELM.trainFromData(X, y)`. Reference implementation: Thomas's `scripts/classify-elm-eval.mjs`.
Keep the script's seed, its task and its documented gotchas — **only the training call changes.**

**Step 5 — verify the port with a shuffled-label control before believing it.** Real labels should
beat shuffled labels; shuffled should sit at chance. Nala measured 6/6 real vs 3/6 shuffled for 3
classes. **A port that scores well on shuffled labels is still not training.** Commit the control
alongside the script.

This is the step that distinguishes "the port works" from "the port produces a number," and the
whole reason this IMPL exists is that nobody ran it the first time.

**Step 6 — write the outbound notes** to Thomas and Jarrett. **Syrup drafts, Nolan sends.**

*To Thomas* — lead with the credit, because it is owed: their `train()` finding corrected two
published Team Nolan numbers and the repo's front-door example. Then: their 90.6% is measured on
the already-classified population (their own caveat, restated so they know it was read); our
coverage check found a v1 model that collapsed onto the majority class on unseen repos; and their
per-run retrain on a single repo's labels is the shape of thing that produced it. Offer the corpus.
Ask them not to train on hono or trpc.

*To Jarrett* — Thomas independently reached the same `UniversalEncoder` char-mode design Archer
built for `TJ-R2` Step 4, and has a committed eval. Two implementations exist of the encoder Archer
is mid-way through; Archer's is unpushed at `ae9dc463`.

Flag in both: **`Claude-Context/IN-FLIGHT.md` § 3 works only if someone merges it.** Thomas filed
the `train()` defect there correctly on 2026-08-31 and it reached nobody for four days.

### Phase 3 — Merge the classifiers (Jarrett + Thomas)

> **Do not run concurrently with the corpus IMPL's Phase 3.** Both edit `classify-elm.ts`. Land
> this one first — it settles which file survives; the corpus IMPL then changes what feeds it.

**Step 7 — settle the schema union.** Ordering-only difference; pick either, delete the conflict.
`schema/v1.ts` and `schema/validate.ts` are shared across three teams, so this is a lead-level
one-token decision, not a merge-time coin flip. **Recommend Jarrett's order**
(`"algorithmic" | "llm" | "elm" | "user-override"`) — it groups the machine sources and leaves
`user-override` last, which reads as the precedence order it actually has.

**Step 8 — resolve `classify-elm.ts` (add/add) by architecture.** Jarrett's 362-line module is the
surviving container: it has the lifecycle, the `.n-dx.json` kill switch and 28 tests. Thomas's
133 lines move in as the **text-representation path**, keeping:

- `UniversalEncoder` char mode, `tokenizerDelimiter: /[/._-]+/`, `maxLen: 80`, lowercase charSet
  with `-` last;
- **the margin rule** (`top1 − top2 ≥ MARGIN_THRESHOLD`), which is a better decision rule than the
  scalar `DEFAULT_ELM_CONFIDENCE_THRESHOLD` and should be available to both representations;
- `MIN_TRAINING_EXAMPLES` as a floor alongside Jarrett's cold-start thresholds.

**Step 9 — unwind the inline gate in `classify.ts`.** Thomas's +36 lines inside
`enrichClassificationsWithLLM` become a call to the standalone module at Jarrett's existing seam in
`analyze-phases.ts`. This is what stops `classify.ts` — a file all three teams edit — from carrying
ELM logic at all.

**Also drop the always-train.** Thomas's shadow mode trains a 512-unit ELM on **every**
`ndx analyze` run and discards it while the gate is off. Behind Jarrett's config gate the correct
behaviour is: do not train unless enabled.

**Step 10 — port Thomas's tests** (144 lines) into Jarrett's suite (382). They cover the training
floor, the margin rule and the null-return contract — behaviour Jarrett's suite does not have,
because Jarrett's model has no margin rule.

**Step 11 — merge order: Jarrett to `dev` first, then Thomas.** `dev`+`Thomas` is clean **only
because Jarrett is not there yet**; landing Thomas first hands the whole 5-conflict reconciliation
to the team with the larger, better-tested implementation. Decide the order rather than racing it.

### Phase 4 — Sign-offs (the leads)

**Step 12 — the dependency question, settled once.** Both teams add the identical
`@astermind/astermind-community` line to `packages/sourcevision/package.json`. Thomas argues in
their ADR that a package-level manifest is not on `OWNERSHIP.md`'s shared list and so needs no
sign-off. **That reading needs a ruling** — `pnpm-lock.yaml` churns either way and is unambiguously
shared. Decide it together with Butter's `TN-B3` Step 0, which is the same question one package
over.

**Before any lockfile operation, confirm `pnpm --version` reports 10.33.0.** It does today —
`package.json` pins `packageManager: pnpm@10.33.0` and corepack honours it inside the repo. The
hazard is an operation run outside that pin, where a global pnpm 11 silently drops the resolved
`overrides` block and its 14 CVE pins.

**Step 13 — close out the `pnpm.overrides` question; there is nothing to take from Thomas.**
`pnpm-workspace.yaml` with `minimumReleaseAgeStrict` is **already on `dev`** and byte-identical on
`Thomas_Branch` — verified with `diff`. I asserted in a first draft that this was a pending Thomas
migration to adopt; it is not, and the step is smaller than it looked.

What remains open is real: **`dev`'s root `package.json` still carries the `overrides` block**, and
`pnpm-workspace.yaml` does not carry it, so the 14 CVE pins hold only while the corepack pin does.
Decide with Step 12 whether the block moves.

For the record when someone reopens this: Thomas's **stated cause was off by a major version** —
the `pnpm.overrides` behaviour change is pnpm 11, not 10 (clean-room verified: 10.33.0 reads the
field silently, 11.23.0 warns and ignores it). The remedy was right; the diagnosis was not. Worth
saying to them plainly, and not as a headline.

---

## Test strategy

- **Unit — the retraction probe (Step 0).** Asserts two models trained on inverted data are
  identical. **This test passing means the library is still broken**, which is the point: it is a
  tripwire, and it should be commented as one so nobody "fixes" it later.
- **Unit — the hello-world control (Step 5).** Real labels beat shuffled; shuffled sits at chance.
  **Watch it fail on the current code first** — on today's `elm-hello-world.mjs` the shuffled and
  real runs should score identically, because neither trains. If they differ before the port, the
  control is measuring something else and the port is not yet justified.
- **Unit — the margin rule (Step 10):** below `MARGIN_THRESHOLD` returns `null`, not a
  low-confidence label. Ported from Thomas.
- **Unit — the text path (Step 8):** a zero-evidence path encodes to a non-zero vector and yields a
  prediction, while the numeric model still refuses it. Same test the corpus IMPL needs for its
  guard change — **write it once, in whichever IMPL lands first.**
- **Integration:** with both gates `false` (the default) the pipeline is byte-identical to today.
  Assert **no ELM is trained at all** when disabled — that is the Step 9 always-train regression.
- **Must stay green:** `pnpm typecheck`, `pnpm test`, `tests/e2e/domain-isolation.test.js`,
  `tests/e2e/architecture-policy.test.js`. Thomas reports the sourcevision suite at 1698/1701 with
  3 pre-existing failures; **confirm those 3 are the same 3 after the merge**, and name them.

**If tests fail, say they failed and paste the output.**

---

## Rollback

**Phase 1:** `git revert`. **But a retraction is not really revertible** — once another team has
read that 4.8% is void, reverting the document does not restore the number's credibility, nor
should it. If the retraction is itself wrong, the correct move is a **new** correction saying so,
not a revert that makes the record look untouched.

**Phase 2:** revert `elm-hello-world.mjs`. Note that reverting restores a script that does not
train on its examples — so a revert must **also** restore a warning comment, or the front-door
example silently goes back to lying. Do not revert this one cleanly.

**Phase 3:** revert the merge commits. Both gates default `false`, so runtime blast radius is zero
while that holds. **Exception:** if Step 9 lands and is reverted, `classify.ts` regains the inline
ELM call — verify by inspection that the revert removed it, because that file is edited by three
teams and a partial revert there is how the collision restarts.

**Phase 4:** lockfile changes revert with `git checkout` of `pnpm-lock.yaml` **plus** a
`pnpm install` under the pinned pnpm — never a hand-merge.

Nothing in this IMPL writes `.rex/`, `.sourcevision/` or `.hench/`.

---

## Open questions

1. **Does Butter want to write the retraction themselves?** It is their lane and their numbers.
   **Ask before Step 2 touches `scripts/elm-prototype/**`.** My recommendation is that they do —
   they wrote the correction that caught the charSet error and it was better for coming from them.
2. **Does `elm-hello-world.mjs` belong to Team Nolan?** It is in root `scripts/`, predates the team
   structure, and Thomas explicitly declined to touch it as not theirs. Nobody has claimed it. It
   needs an owner more than it needs a fix.
3. **Which team's `classify-elm.ts` survives?** Step 8 recommends Jarrett's container with Thomas's
   representation, on architectural grounds. **Both teams have to agree**, and neither has been
   asked.
4. **Is the margin rule the right decision rule for both representations**, or only for path text?
   Untested — and `MARGIN_THRESHOLD = 0.3` against margins Nala measured at ~0.002 on the
   zero-evidence population may abstain on everything there. That would be *correct* behaviour, but
   it is unmeasured either way.
5. **Does Nala get a charter?** They author ADRs, IMPLs and shipping code with no charter and no
   roster row (`Thomas-Agents/README.md` reads `_(none yet)_`). K2 had the same gap on our side and
   it cost us a week of session log. **Thomas's call — but we have already paid for this once.**
6. **Do the three teams keep three `IN-FLIGHT.md` files?** Thomas filed a correct, load-bearing
   finding on their copy and it reached nobody for four days. A cross-team board that lives on
   three unmerged branches is three private boards. *All three leads.*
