# IMPL — Merge `dev` into `Nolan-Work` and run the three-team proof of concept

- **Implements:** [`ADR-2026-09-04-syrup-merge-elm-corpus-into-jarrett-harness.md`](../ADR/ADR-2026-09-04-syrup-merge-elm-corpus-into-jarrett-harness.md) (revised 2026-09-25), § 4 "For Jam"
- **Owner:** Jam (Team Nolan) · **Backlog:** `TN-S2` (Syrup's row; the run is mine)
- **Status:** **Ready.** The merge is reversible and inbound-only. Nothing here flips a shipped default.
- **Date:** 2026-09-25

---

## 0. What I verified before planning

Independently, not from the ADR's summary:

| claim | verified |
|---|---|
| **Exactly one conflict: `Claude-Context/IN-FLIGHT.md`** | `git merge-tree` against the merge base. `classify.test.ts` and `architecture-policy.test.js` auto-merge. |
| Divergence | `origin/dev` has **62** commits we lack; we have **175** it lacks |
| Content path is live | `analyze-phases.ts:250` — `elm: { …, rootDir: ctx.absDir }` |
| Cold-start floor | `classify-elm.ts:335,336,351` — 30 examples / 3 categories / **20 `llm` examples** |
| Unanimity | `ELM_ENSEMBLE_SIZE = 15` (`:647`), `DEFAULT_ELM_MIN_VOTE_SHARE = 1.0` (`:658`) |
| The seam | `buildFeatureVector` (`classify-elm-features.ts:362`), `FEATURE_VERSION = 2` (`:64`), `MAX_CONTENT_BYTES = 64 KiB` (`:168`) |
| Demo populations | nest **8** unclassified / 836 llm · remix **9** / 204 · core **23** / 212 · svelte **331** / **0** · typeorm 0 · **n-dx 0** |

Syrup's numbers are right, including svelte's zero LLM rows, which is why it will bail.

---

## 1. ⚠️ Two corrections to § 4 of the ADR

### (a) Do **not** set the flag in our `.n-dx.json`

The ADR's step 3 says set `sourcevision.classification.elmPrefilter.enabled: true` in `.n-dx.json`,
while § 1 promises `elmPrefilter.enabled` stays `false`. Both can be true only if the flag goes
somewhere other than our repo's config, and it can:

**`loadLLMConfig(absDir)` resolves config from the analysis target** (`analyze.ts:107`), which is
how Nutella pinned a different teacher per staged repo. So the flag belongs in
`~/Work/n-dx-elm-corpus/nest/.n-dx.json`, **not** ours.

This matters beyond tidiness. Our `.n-dx.json` is **committed and on the shared "nobody edits
unilaterally" list**; flipping it changes behaviour for Jarrett and Thomas and would need a claim.
Putting it in the target keeps the promise in § 1 literally true: our default never moves.

### (b) "Tell Knight before merging" cannot be done with a note on this branch

The ADR asks us to warn Knight that our `archetypes.ts` gateway fix shifts their `TJ-A3` baseline.
Correct and considerate — **and undeliverable the usual way.** Notes travel by merging (`TN-F3`),
and this merge goes **`dev` → us**, not us → `dev`. A note written into
`Claude-Context/Jarrett-Agents/Notes/` on `Nolan-Work` reaches Knight **never**, because nothing of
ours is going anywhere.

So: **I draft it, Nolan delivers it out-of-band** (message, or a push to `dev` as a separate
decision). Step 1 below is not "write a note" but "get the warning in front of Knight, confirmed."

---

## Scope

**Touches:** `Claude-Context/IN-FLIGHT.md` (conflict resolution), the merge commit, one key in
**nest's** `.n-dx.json` (outside this repo, not version-controlled by us), and one new findings
document.

**Does not touch:** any `packages/**` source, our `.n-dx.json`, any corpus, any frozen artifact,
Nutella's scripts, or anything of Jarrett's. **No LLM calls. No pushes.**

---

## Steps

### Phase 0 — Make the merge trivially reversible *(2 min)*

```sh
git rev-parse HEAD                                   # record it
git update-ref refs/backup/2026-09-25-pre-dev-merge HEAD
git status --porcelain                               # MUST be empty
```
A backup ref costs nothing and turns "undo the merge" into one command. The working tree must be
clean first — an unrelated dirty file dragged into a merge commit is how authorship gets muddled.

### Phase 1 — Get the warning to Knight, and confirm it landed *(before the merge)*

Draft the warning: our gateway-regex fix in `archetypes.ts` changes classification output, so
`TJ-A3`'s unclassified-count baseline shifts under them while they are measuring it. It does **not**
conflict textually — Syrup tested that merge separately. **Hand it to Nolan to deliver**, and do not
start Phase 2 until the lead confirms Knight has it. This is the one step with a human dependency.

### Phase 2 — The merge *(5 min)*

```sh
git merge origin/dev            # expect exactly one conflict: Claude-Context/IN-FLIGHT.md
```

**Conflict rule, decided in advance so it is not a judgement call at 2 a.m.: keep both teams' rows.**
`IN-FLIGHT.md` is a claim board; a row deleted in a merge is a claim silently dropped. Union the
claims tables, keep both § 2 team-status lines, and preserve every `⚠️` marker. If anything other
than `IN-FLIGHT.md` conflicts, **stop** — the merge surface has changed since § 0 and the plan needs
re-verifying.

### Phase 3 — Prove the merge is build-neutral *(~10 min)*

Syrup measured `dev` and the merged tree as equivalent. Re-measure rather than inherit:

```sh
pnpm typecheck                                  # expect 27 errors, same breakdown as dev
npx vitest run tests/                           # NOT `pnpm test` — it aborts on rex's flaky perf test
pnpm --filter sourcevision test                 # expect 16 failures, all pre-existing/environmental
pnpm --filter @n-dx/llm-client test             # expect 1219 passing (was 1211 pre-merge)
```

**The bar is "no worse than `dev`", not "green".** This tree has been red for weeks for reasons that
predate us; the merge must not add to it. Record actual counts in the findings doc even where they
match — a number quoted from an ADR is not a number I measured.

### Phase 4 — Run the demo *(~15 min, zero LLM calls)*

> ### ⚠️ CORRECTED 2026-09-25, AFTER IT COST MONEY — do not run `analyze` for this
>
> This step originally said to set the flag and run
> `analyze ~/Work/n-dx-elm-corpus/nest --only=classifications`. **I ran that and it was wrong twice
> over.**
>
> **`--only=classifications` recomputes the phase from scratch.** It discarded nest's existing
> state — the 8-file residue left after Nutella's retry harvest — and restarted from
> *"546 classified, 844 unclassified"*, then began re-labelling all 844 through the LLM. **24 of 29
> batches completed before I killed it: ~175k–460k tokens, roughly $2–5, for nothing.**
>
> **And the gate never ran.** Not one gate line appeared; it went straight to `[classify] batch
> 1/29`. A from-scratch recompute has no `source: "llm"` rows at gate time, so the cold-start floor
> (`classify-elm.ts:351`, ≥20) bailed silently — gotcha #1 of the ADR, firing on the very plan
> written to avoid it.
>
> **The ADR's own evidence table said zero LLM calls**, because Syrup called `runELMGate` directly
> against the existing `.sourcevision/`. I read that line and still planned the expensive path.
>
> nest was restored from a pre-run backup, verified byte-identical (`9dde48aa…`, 8 unclassified,
> 836 llm rows), and the target's flag reverted.

**Correct procedure — direct gate invocation, zero LLM calls:**

```sh
pnpm --filter sourcevision build
# No flag anywhere. The flag only matters to `analyze`, which we are not using.
node <runner>   # imports runELMGate from dist, feeds it nest's EXISTING .sourcevision/
```

The runner loads `classifications.json`, `inventory.json` and `imports.json` as they are on disk and
calls `runELMGate(classifications, inventory, imports, { seed: 20260812, rootDir: <nest> })`
(`classify-elm.ts:549`). With `rootDir` set it takes the content path and defaults to unanimity
(`DEFAULT_ELM_MIN_VOTE_SHARE = 1.0`). **It reads bytes and writes nothing.**

**Back up the target's `.sourcevision/` first anyway.** The IMPL did not say to, I did it by
instinct, and it is the only reason the botched run cost money instead of corpus provenance.

**Use nest.** It is the only target with both a usable population (8 routed) and enough history
(836 LLM rows) to clear the cold-start floor. **Not n-dx** — zero unclassified, so it would show
nothing and look like a failure. **Not svelte** — 0 LLM rows, so it bails in 0.0s and returns an
empty result that looks identical to a crash.

Capture stdout **verbatim**, including the routed and resolved counts. Expect ~7 of 8 at unanimity,
all `test-helper`. **If the numbers differ from Syrup's, report what I got** — do not re-run until
they match.

**Revert the target's flag afterwards** and note it in the findings doc.

### Phase 5 — The honesty paragraph *(~20 min)*

Ships with the output, in the same document, above the numbers. Non-negotiable content, all of it
already measured and none of it softened:

- labels are an **LLM teacher at 72.3%** against human judgement — agreement is not accuracy
- the classifier **does not generalise to fresh repos**; Jarrett measured below-baseline, and
  confidence does not predict correctness (**AUC 0.551**)
- at unanimity it saves **≤1 LLM call in 9**, and only **2 of 22** call sites are ELM-replaceable
- `elmPrefilter.enabled` **remains `false` everywhere it is committed**; this ran with a
  target-local override
- the nest predictions **look** right by eye, and **eye is not a metric** — the blind 250 remain
  unspent

---

## Test strategy

**Before:** clean tree, backup ref recorded, conflict surface re-confirmed by `merge-tree`.
**After the merge:** the four commands in Phase 3, compared against `dev`'s own numbers, not against
zero.
**The demo is not a test.** It produces an observation with no ground truth. Phase 5 is what keeps
that honest.

---

## Rollback

```sh
git reset --hard refs/backup/2026-09-25-pre-dev-merge
```
Nothing is pushed at any point, so the merge is local and reversible until someone decides
otherwise. The target repo's flag is reverted in Phase 4. **The only irreversible act in this plan
is telling Knight**, which is the one we want irreversible.

---

## Risk register

| risk | mitigation |
|---|---|
| Merge surface changed since § 0 | Phase 2 stops if anything but `IN-FLIGHT.md` conflicts |
| A claim row lost in the conflict | Rule fixed in advance: **union, never choose** |
| Flag left `true` in the target | Phase 4 reverts it and the findings doc records that it was reverted |
| Demo mistaken for a product | Phase 5, placed **above** the numbers |
| svelte/n-dx chosen by accident | Named and excluded, with the reason each fails |
| `.sourcevision/` stale in the target | Verified current in § 0; nest's counts match Syrup's |
| Merge read as delivering our work | It does not. 175 of our commits stay put; this is inbound only |

---

## Open questions

- **Does the demo need re-running after the merge?** Syrup ran it on `dev` at `b3c4bd56`. Our merged
  tree is `dev` plus 175 commits of ours, none touching `packages/sourcevision/src/analyzers/**`
  except the `archetypes.ts` gateway fix — **which changes classification output**. So the routed
  population in nest may differ from Syrup's 8. Phase 4 measures it fresh rather than assuming.
- **Who owns the findings document?** It spans three teams' work. I propose Team Nolan's
  `Notes/`, drafted by me, with Elon's result quoted from Jarrett's own findings rather than
  restated.
