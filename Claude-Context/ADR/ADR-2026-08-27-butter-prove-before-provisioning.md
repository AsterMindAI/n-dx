# ADR — Prove the ELM before provisioning for it: Path A's sequencing under two open gates

- **Status:** Proposed — needs Nolan. **Nothing in it requires a second lead**, which is the point.
- **Date:** 2026-08-27
- **Author:** Butter (Team Nolan)
- **Supersedes:** none. **Amends the sequencing** of [`IMPL-2026-08-23-butter-elm-inference-wrapper.md`](../IMPL/IMPL-2026-08-23-butter-elm-inference-wrapper.md), whose Step 0 was written as gating everything. The placement decision in [`ADR-2026-08-23-butter-elm-inference-module.md`](ADR-2026-08-23-butter-elm-inference-module.md) is **unchanged and still stands**.
- **Backlog items:** `TN-B3` (unblocks), `TN-B6` (claims)

## Context

Path A has two gates and neither is mine to open:

- **`TN-B3` Step 0** — adding `@astermind/astermind-community` to `packages/llm-client` needs a
  second lead's sign-off. Requests are with Jarrett and Thomas as of 2026-08-27.
- **`TN-B1`** — the cache-token weighting question is a three-lead call.

Team Nolan is also running independently of the other two interns right now, so neither answer is
likely to arrive quickly. My lane, as sequenced on 08-23, stalls completely behind the first one.

**The uncomfortable shape of the sign-off request as it currently stands.** I am asking two leads to
approve a dependency for a module whose value is **unproven**. Nobody has trained an ELM on the
324-row corpus. If it cannot clear the bar, we will have spent two leads' attention and taken a
workspace dependency to build something we then delete. That is the wrong order, and I wrote it that
way on 08-23 without noticing.

**And the gate turns out not to bind what I assumed it binds.** Verified today:
`scripts/elm-hello-world.mjs:19` already does `import { ELM } from "@astermind/astermind-community"`
and resolves it from the root `node_modules` — because the package is a **root** dependency
(`package.json:61`). Confirmed by execution: the import resolves and exposes `ELM`,
`KernelELM`, `ConfidenceClassifierELM`, `Evaluation` and the rest.

**So `scripts/` can already do ELM inference today, with no sign-off, no lockfile change, and no
workspace dependency at all.** The sign-off is needed to *ship* the module inside a package. It is
not needed to *answer the question*.

Meanwhile `TN-B6` — `CompletionResult` (`llm-client/src/types.ts:82-87`) being `{text, tokenUsage?}`
with nowhere to put the `total_cost_usd` and `num_turns` the vendor already returns — is blocked by
nothing at all. It sits in files I hold and it is a prerequisite for any cost figure the dashboard
will ever show.

## Decision

**Prove the ELM in `scripts/` before asking anyone to provision for it, and close the telemetry
schema gap while the provisioning question is open.** Concretely:

1. **The ELM engine is built first as a script-tier prototype** (`scripts/elm-prototype/`), importing
   the root dependency exactly as `elm-hello-world.mjs` does. It implements the interface the
   placement ADR specified — `predict`, top-k, `classifyGated`, seeded — so that promoting it into
   `packages/llm-client/src/elm/` later is a **move plus a build config**, not a rewrite.

2. **The workspace dependency is taken only after the accuracy question has an answer.** If the ELM
   clears Path B's bar, the sign-off request is re-sent **with the evidence attached**. If it does
   not, the request is **withdrawn** and no dependency is taken.

3. **`TN-B6` proceeds now.** Extend `CompletionResult` to carry per-call cost and turn count. This is
   **independent of `TN-B1`** — carrying a field is a separate question from deciding how to total
   it, and conflating them is what would keep both parked.

4. **The seam holds: I build the engine, Jam runs the experiment.** I produce a trainable, seeded,
   re-runnable prototype and publish **no accuracy number**. Training it on the corpus, reading the
   confusion matrix, and returning a verdict is `TN-B5`/`TN-J4` Step 3 — Jam's, under the split we
   agreed. **I am building the instrument, not grading the result.**

5. **The outstanding sign-off requests stand, downgraded from blocking to pending.** They are not
   withdrawn — the answer is still wanted, and a lead may reasonably want to decide the packaging
   question on its own merits. A follow-up note tells Jarrett and Thomas the urgency has dropped and
   that evidence is coming, so they are not left thinking Team Nolan is stalled on them.

## Alternatives considered

| Option | Why not |
|--------|---------|
| **Wait for sign-off** (the 08-23 sequencing) | Parks the lane indefinitely on two leads who are working independently, to answer a question that does not need them. It also asks for a dependency decision with no evidence attached, which is a worse ask. |
| **Add the dependency anyway; it is only 3 lines** | I measured that it is 3 additive lines and zero new packages, and that measurement makes the *decision* cheap — it does not make the *rule* optional. I wrote "already at root is not permission" in my own ADR four days ago. Doing this would make that sentence worthless and would be the single most corrosive thing I could do to a doctrine I have been holding others to. |
| **Build it directly in `packages/llm-client` and just not import the library yet** | A wrapper that cannot import what it wraps is not testable, so it proves nothing — the only thing that matters here is whether the ELM classifies well enough. |
| **Skip the prototype; wire the ELM straight into `classify.ts`** | That is Jam's file and Path B's Step 4, and it integrates before the accuracy question is answered — the exact failure the ADR's kill criterion exists to prevent. |
| **Do `TN-B6` after `TN-B1` is decided** | They are independent. Waiting would park an unblocked fix behind a three-lead decision for no reason. |

## Consequences

**Easier.** The lane stops being blocked. The accuracy question — the one that decides whether any of
this ships — gets answered weeks earlier. The leads get to approve a dependency with evidence rather
than a promise, or never get asked again.

**Harder.** A prototype in `scripts/` is plain `.mjs` with no TypeScript build, so the promotion step
is real work: types must be written at promotion time rather than falling out of the prototype. I am
accepting that cost deliberately, and it is bounded — the interface is already specified in the
placement ADR, so promotion is transcription, not design.

**A risk worth naming.** Script-tier prototypes have a way of becoming permanent. **Mitigation: if
the ELM clears the bar, promotion is the immediately next task and the prototype is deleted in the
same PR — not left as a second implementation.** A second copy of inference logic is precisely the
fork the standing doctrine forbids.

**What this does NOT change.** The placement decision stands: if this ships, the module lives in
`packages/llm-client/src/elm/` as a call-site tier, not a registered vendor. This ADR changes
*when* we pay for that, not *what* we build.

**Other teams.** Nothing here touches another team's paths, and no new shared file is edited.
`TN-B6` edits `llm-client/src/types.ts`, which is **not** among the four shared provider files
(`provider-registry`, `provider-interface`, `llm-types`, `llm-config`) — verified against
`OWNERSHIP.md` § Shared. A follow-up note goes to Jarrett and Thomas about the downgraded urgency.

## Evidence

**No ELM-viability or accuracy claim is made here**, so the accuracy-evidence requirement does not
bind this ADR. **That is the whole point: this ADR exists because no such claim can yet be made by
anyone.**

**Verified today by execution, at `b442074e`:**
- `import("@astermind/astermind-community")` resolves from the repo root and exposes `ELM`,
  `KernelELM`, `ConfidenceClassifierELM`, `Evaluation`, `AdaptiveKernelELM` and others.
- `scripts/elm-hello-world.mjs:19` already imports it this way — the precedent is committed, not
  invented for this ADR.
- Jam's corpus at `scripts/data/elm-archetype-corpus.json` carries `schema`, `provenance`, `stats`,
  `train` (241 rows) and `heldOut`, so the experiment has its input already.
- `CompletionResult` is `{text, tokenUsage?}` (`llm-client/src/types.ts:82-87`).

**Measured, and carried in rather than re-derived:**
- A classify call in steady state costs **48,874–54,228 tokens** (n=4, seed 42, pnpm claude 2.1.231),
  with two elevated-`cache_read` outliers at 96,231 and 267,952. **This corrects a 53,553–267,952
  range I published on 08-23**, which was dominated by one outlier.
- `num_turns = 1` on all 6 observations.
- Corpus majority-class baseline **38.0%** (Jam). **Not 19.6%, and never 5.9%.**
- The hello-world's 66% floor is 3 classes / 6 held-out / seed 42 / 33% baseline. **It is not
  evidence about the 17-class task.**

## Open question for the leads

**If the ELM clears the bar, do you want the module promoted into `@n-dx/llm-client`, or extracted to
its own `@n-dx/elm` package?** Carried forward unanswered from the placement ADR. It is now *less*
urgent, not more — but it is also now decidable with a working prototype in front of you, which is a
better position than deciding it in the abstract.
