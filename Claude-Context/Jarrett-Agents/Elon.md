# Agent: Elon

- **Team:** Team Jarrett
- **Lead:** Jarrett
- **Backlog prefix:** `TJ-E`
- **Branch:** `elm/jarrett/classify-elm-content`
- **Worktree:** `../n-dx-elon`
- **Inbox:** `Claude-Context/Jarrett-Agents/Notes/`

## Scope

**Owns:** the **body of `classify-ELM.ts`** — the ELM-only classifier behind `runELMGate()`. One
job: given a file, return an archetype it is confident about, or nothing. Specifically:

- The **feature representation** fed to the ELM — including **file content**, which nothing in this
  pipeline has ever used (see Standing context).
- Training-data extraction and the model lifecycle (`getArchetypeELM` and below).
- The **confidence gate's shape and calibration** — the number, and whether it's an absolute
  confidence or a top1/top2 margin, decided from a measured precision/coverage curve.
- The **retrain loop**: folding LLM-returned labels back into the model.
- The seeded, committed eval script that produces every number this agent reports.

**Does not own:**

- `classify.ts`'s gate/routing logic (`runClassificationGate`) — that's `TJ-R3`, already shipped.
  This agent fills the slot the gate calls; it does not change who calls whom.
- `classify-LLM.ts` — the LLM side of the diagram. Not this box.
- `BUILTIN_ARCHETYPES` / the archetype catalog itself — that's `TJ-A3` (Knight, in progress). This
  agent classifies *against* whatever catalog is live; it does not edit the catalog.
- The algorithmic pass (`classifyFile`) and its thresholds.
- Anything in `upstream` (`en-dash-consulting/n-dx`). Code goes to `origin` (`AsterMindAI/n-dx`)
  only, per the user's 2026-09-17 instruction.

## Standing context

Facts not to re-derive. **Delete anything that goes stale.**

**The architecture already exists — this agent fills an empty slot, it does not build the pipeline.**
`TJ-R3` shipped 2026-09-07 (`7ecf69f3`, merged `ae381889`):

```
runClassificationGate()            classify.ts       ← gate, owns routing
   ├─ runELMGate()                 classify-elm.ts   ← THIS AGENT'S BOX
   └─ classifyUnclassifiedWithLLM() classify-llm.ts
```

The interface is stable and already defined:
`runELMGate(classifications, inventory, imports, { confidenceThreshold, seed }) → { updatedFiles }`.
It returns an empty array rather than `undefined` when it has no model, so the gate treats "no
model" and "nothing confident" identically. It has no knowledge that an LLM exists — keep it that
way.

**The slot is inert today, and that is the whole job.** What's behind `runELMGate` is still
`TJ-A2`'s evidence-vector representation, and `classify-elm.ts:350` unconditionally skips any file
whose vector is all zeros. **100% of the population that reaches this stage has an all-zero vector**
(measured across 5 corpora, 2026-08-27, zero exceptions) — so `runELMGate` structurally resolves
**zero files**. The guard is correct and should stay; the representation underneath it is what must
change.

**Why the population is all-zero:** `classifyFile`'s signal weights are 0.4–0.9 per match and
`PRIMARY_THRESHOLD` is 0.4, so a single matched signal usually already resolves a file. There is
almost no "partial signal, still unresolved" middle ground — files reaching the ELM are the ones
with *no* signal at all.

**Every accuracy number in this project's history measured the wrong population.** 100% @ 59.0%
(Archer), 97.0% @ 42.3% (Knight), Realm's reproduction, Nala's 90.6% k-fold — all measured
discrimination among files that already had *some* algorithmic signal. None was drawn from
genuinely zero-signal files. **Do not cite any of them as evidence for this call site.**

**Confidence is diffuse, not peaked — an 80% absolute gate would resolve nothing.** Measured
ranges: text mode ~0.08–0.20 (Archer), ~0.13–0.23 (Knight), numeric ~0.09–0.18. Shipped default
`DEFAULT_ELM_CONFIDENCE_THRESHOLD = 0.11`. The novel-file population sits on a cliff at 0.10/0.11.
Nala's `TT-N1` used a **top1/top2 margin (0.3)** instead, which is the shape that actually works on
a ridge-regression readout. The user has not picked a gate yet (2026-09-16) — **derive it from a
precision/coverage curve, do not pick a number up front.**

**Content is new plumbing.** `inventory.json`/`imports.json` carry paths, roles, and import edges
only — no file text. Every representation tried so far (evidence vector → path text → path+export
text) was metadata-only. The user's 2026-09-16 direction is explicitly "the full file, metadata and
content." Nothing reads file bytes at this call site today.

**`TT-N1` is gone from this branch.** The `dev` merge left `classify.ts` importing
`ELM_GATE_ENABLED`/`trainClassifyPathELM`/`predictWithClassifyPathELM` from `classify-elm.js`,
which never exported them — a broken build (3× TS2305). `TJ-R3` removed the dead inline gate. The
representation slot is **empty and uncontested**; there is no collision left to reconcile.

**Library gotchas (verified in the installed `@astermind/astermind-community` v3.0.0 source, not
from prose):**
- `ELM.train()` does **not** train on supplied labeled examples — it bootstraps from augmented
  variants of the *category name strings*. The supervised path is
  `UniversalEncoder` → `ELM.trainFromData(X, y)`.
- `ELM`'s own `TextConfig` (`useTokenizer: true`) routes through
  `tokenizer.tokenize(text).join('')` — no separator, so tokens smear together. `useTokenizer` is
  typed as the literal `true`, so the broken path cannot be avoided through `ELM`'s config surface.
- `UniversalEncoder` is exported from the package root and supports `mode: "char"`, which never
  constructs the tokenizer. Feed its output through the `NumericConfig` path
  (`trainArchetypeELMNumeric`/`predictArchetypeNumeric` are representation-agnostic).
- `encode(text: string): number[]` takes **one** string — no structured multi-field input.
- Defaults are traps: `charSet` is 26 lowercase letters (every digit, `/`, `.`, `-`, `_` in a path
  silently encodes to zero) and `maxLen` is 15. Widen both.
- `OnlineELM` updates `beta` incrementally via recursive least squares — the right shape for the
  diagram's retrain-from-LLM-labels arrow, no full retrain needed.
- `scripts/elm-hello-world.mjs` and its 83% claim are **not evidence** — it calls `ELM.train()`
  wrongly (see above); three models trained on real/contradictory/no data produced byte-identical
  weights.

**Environment (checked 2026-09-17, differs from Archer's August blocker):** `claude` **is** on PATH
(`/c/Users/jarre/AppData/Roaming/npm/claude`) and `ANTHROPIC_API_KEY` **is** set. Real LLM labels
can be generated through the actual pipeline — no hand-labeling stand-in needed.

**17 archetypes:** `entrypoint · utility · types · route-handler · route-module · component ·
store · middleware · model · gateway · config · hook · service · schema · cli-command · page ·
test-helper`. Knight's `TJ-A3` may change this catalog — classify against whatever is live.

**Known same-word/different-domain collisions** (real, confirmed by inspection): `branch-work-store.ts`
is backend persistence, not a React store; `token-validation-hook.ts` is a generic callback, not a
React hook; Zustand's `middleware.ts` is state middleware, not HTTP; AsterMind's ELM files are ML
models, not data models. A content-reading representation should get these right where a
path-only one cannot — a good qualitative check.

**Corpora already on disk** from `TJ-A1`, reusable for the out-of-domain check:
n-dx, `AsterMind-Community-Edition`, `express`, `indie-stack`, `zustand`.

**Never report an accuracy number without its seed and its baseline** (`Command-Structure`).
Majority-class baseline for 17 classes is ~5.9%.

## Current state

**2026-09-17 — onboarded, nothing built yet.** Set up per `NEW-AGENT.md`: worktree `../n-dx-elon`,
branch `elm/jarrett/classify-elm-content`, claimed `TJ-E1`. Read the full doctrine set, Archer's
and Realm's charters, the `TJ-R3` ADR, and the real current state of
`classify.ts`/`classify-elm.ts`/`classify-llm.ts` on this branch rather than trusting the boards —
which were stale in three places (see session log). Supersedes `TJ-R2` (Archer) per the user's
direction; Archer's Step 4 encoder work is mine to absorb. No ADR or IMPL written yet, no code
written yet.

## Next up

- [ ] Absorb Archer's `TJ-R2` Step 4 work — `extractPathExportExamples`/`pathExportVector` and its
      10 tests, commit `ae9dc463` on `../n-dx-jarrett` — rather than rebuilding it.
- [ ] Write the ADR + IMPL for the content-reading representation before code (project doctrine:
      plan first, and the ADR's Evidence section gates Status).
- [ ] Decide what "content" means concretely by measurement, not assumption: full text vs.
      truncated head vs. extracted structure. Cost and signal both matter.
- [ ] Build the seeded eval against the **genuinely zero-evidence population** — the thing no prior
      eval in this project ever did. Out-of-domain held-out set, not just k-fold.
- [ ] Produce the precision/coverage curve so the user picks a real gate number, and determine
      whether it should be absolute confidence or a top1/top2 margin.
- [ ] Wire the retrain loop (`OnlineELM`) once the representation clears its gate — not before.

## Session log

Newest at the top. **Do not edit past entries** — append corrections as a new entry.

---

### 2026-09-17 — onboarding; found the boards stale and the ELM slot inert

**Did:**
- Read the full doctrine set (`claude-context-instruction`, `Command-Structure`, `NEW-AGENT.md`,
  `GITHUB-WORKFLOW.md`, `OWNERSHIP.md`, `IN-FLIGHT.md`, root `CLAUDE.md`), Team Jarrett's
  `BACKLOG.md` and `Notes/` inbox, and Archer's + Realm's charters in full.
- Read the actual code on this branch rather than trusting the docs — `classify.ts`,
  `classify-elm.ts`, `classify-llm.ts`, `archetypes.ts`, and the `TJ-R3` commit `7ecf69f3`.
- Created worktree `../n-dx-elon` on `elm/jarrett/classify-elm-content`, claimed `TJ-E1`.

**Learned:**
- **`TJ-R3` already shipped** (`7ecf69f3`, merged `ae381889`, 2026-09-07) — the gate split exists.
  The boards said otherwise in three places (see below). The interface this agent fills,
  `runELMGate`, is already stable and correctly shaped.
- **The ELM slot resolves zero files by construction.** `classify-elm.ts:350`'s all-zero-vector
  guard skips 100% of the population that reaches it. The guard is right; the representation is the
  problem.
- **`TT-N1` is not on this branch** — removed by `TJ-R3` as a broken build (3× TS2305). No
  collision remains; the representation slot is uncontested.
- **Archer's August environment blocker is gone** — `claude` is on PATH and `ANTHROPIC_API_KEY` is
  set, so real LLM labels can be generated through the real pipeline.
- No accuracy numbers produced this session — none to report with seed/baseline.

**Broke / still broken:**
- Nothing broken by me. Pre-existing and unfixed: the boards were stale in three places, now
  corrected in this session's commit —
  1. `BACKLOG.md` called `TJ-R3` *"PROPOSED — blocked on Thomas/Nala's sign-off before any code
     changes"* — it had shipped 10 days earlier.
  2. `IN-FLIGHT.md` § 4 listed `TJ-R3` as *"Blocked entirely until Thomas signs off."*
  3. `IN-FLIGHT.md` § 2 described `TT-N1` as *"live code on the `Jarrett` branch now"* — it was
     removed by `TJ-R3`.
- Root `pnpm test` has 4 known pre-existing failures (`cli-stale-check.test.js` ×2,
  `published-assets-bundled.test.js` ×2) per `7ecf69f3`'s commit message — confirmed present on the
  unmodified branch, not mine. **Not independently re-verified by me this session.**

**Left undone and why:**
- No ADR, IMPL, or code — this session was onboarding and establishing real current state. Writing
  a plan against stale board data would have been the more expensive mistake.
- Did not absorb Archer's Step 4 encoder work yet; it's the first task, not an onboarding step.
- Did not re-run the eval or verify any historical number myself.

**Notes sent / received:**
- Received (read, not addressed to me): the three 2026-09-07 collision/gate-split notes in
  `Jarrett-Agents/Notes/` and `Thomas-Agents/Notes/`. Both are now moot on this branch — `TJ-R3`
  shipped and `TT-N1` is gone. **Not closed by me** — Realm and Thomas own that call, flagged in
  `IN-FLIGHT.md` instead.
- Sent: none.

**Handoff:**
- Absorb `ae9dc463` from `../n-dx-jarrett`, then write the ADR + IMPL for the content-reading
  representation before writing classifier code.
