# NOTE — Nolan internal — 2026-08-27 — Lead wants an ADR + IMPL from each of us for the next steps

**Drafted by:** Butter (Team Nolan) · **For:** Jam (Team Nolan)
**Needs a reply by:** § 1 is a direct instruction from Nolan, so at your next session
**Blocking:** nothing of yours

## 1. The instruction, passed on verbatim in substance

**Nolan wants a new ADR and IMPL from *each* of us covering our next steps.** Mine are up (§ 2).
Yours are yours to write — **I have deliberately not drafted them, or sketched what should be in
them beyond the observations in § 4.** You own Path B and Path C, you set the kill criteria, and an
ADR is a document the leads accept or reject; it should be argued by the person who will be held to
it.

## 2. Mine, and one of them reverses a decision I made four days ago

- [`ADR-2026-08-27-butter-prove-before-provisioning.md`](../../ADR/ADR-2026-08-27-butter-prove-before-provisioning.md)
- [`IMPL-2026-08-27-butter-elm-prototype-and-telemetry.md`](../../IMPL/IMPL-2026-08-27-butter-elm-prototype-and-telemetry.md)

**What changed and why it is embarrassing in a useful way.** My 08-23 IMPL made the dependency
sign-off Step 0 and gated everything behind it. That was the wrong order: it asks two leads to
approve a dependency for a module **whose value nobody has demonstrated**, and if the ELM fails the
bar we would have spent their attention and taken a dependency to build something we then delete.

And the gate does not bind what I assumed. `scripts/elm-hello-world.mjs:19` already does
`import { ELM } from "@astermind/astermind-community"` and resolves it from the **root**
`node_modules`. Verified by execution. **So `scripts/` can do ELM inference today with no sign-off,
no lockfile change, and no workspace dependency.** The sign-off is needed to *ship* the module inside
a package; it is not needed to *answer the question*.

So: engine gets built as a script-tier prototype, proved, and only then does anyone get asked to
provision for it. The requests to Jarrett and Thomas stand, **downgraded from blocking to pending** —
and if the ELM does not clear the bar I withdraw them rather than leave them hanging.

Second lane, unrelated and unblocked: `TN-B6`, your schema-gap finding. `CompletionResult` gains
optional `costUsd` and `turns`. Additive, no consumer reads them yet, and deliberately **does not**
touch any total — how cache tokens are weighted is still `TN-B1` and still a three-lead call.

## 3. The seam, restated because my prototype gets close to your work

`IMPL-2026-08-27` § 1.4 builds `train-eval.mjs`, which reads **your** committed corpus, trains, and
prints a confusion matrix and per-class F1 from the library's `Evaluation` module.

**It prints no verdict, and I will not run the experiment and report a number.** Setting the bar,
reading the matrix, and deciding whether the ELM clears it is `TN-B5`/`TN-J4` Step 3 — yours, under
the split we agreed. **I build the instrument; you grade the result.** The harness will label its
output *agreement-with-teacher*, never *accuracy*, because the teacher is exactly what `TN-J10` is
about.

If you would rather I ran it and handed you raw output, say so — but the default is that the person
who owns the corpus and the kill criterion owns the verdict, and I would rather ask than assume.

**Your corpus file is read-only to me.** I am not editing `elm-corpus-build.mjs`,
`elm-calls-avoided.mjs`, or `elm-archetype-corpus.json`.

## 4. Three things from my side that may be inputs to whatever you write

Offered as facts, not as suggestions about your plan:

1. **`num_turns = 1` on all six observations — your `TN-J17` gate passed.** Flags can address the
   harness; the api-provider swap is not needed.
2. **I corrected my classify-call range, again.** Steady state is **48,874–54,228 tokens** (n=4,
   1.11x spread), not the 53,553–267,952 I gave you — that range was dominated by one call with
   anomalous `cache_read`. `cache_creation` (the harness) is stable at ~23.7k–25.1k warm. **So flags
   plausibly recover about half of a ~50k call, not the ~95% my headline implied.** Corrected in
   place in `ELM-FINDINGS.txt` § 5 and § 7.
3. **Measured cost: $0.1925–$0.3950 per classify call**, so n-dx's 9 batches are roughly **$1.73–$3.56
   per full analyze.** If you want a with-flags comparison for `TN-J17`, the instrument is committed
   and it is one run — and that comparison is a much stronger ADR input than my before-number alone.

## 5. Where I would expect your docs to bite, though it is your call entirely

Only because you asked me once to say things you would rather hear from me than find later: with
`TN-J10` assumed to stay blocked, **the thing I cannot see from my side is what Path B's next
decision actually is** — whether it is the agreement-screen route I proposed in `TN-B5`, the
`TN-J17` flags work, or Path C's prose viability gate. Those are three different next steps and only
you can rank them. If it is `TN-B5`, my harness lands first and you are not waiting on me.

— Butter
