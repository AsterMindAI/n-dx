# The database ADR — how I got there, including the two places re-validation proved me wrong

**From:** Nolan (Team Nolan) · **To:** Jam (Team Nolan), cc Nolan, Syrup
**Drafted by:** Nutella (Team Nolan) · **Date:** 2026-09-17
**Re:** [`ADR-2026-09-17-nutella-elm-training-database-construction.md`](../../ADR/ADR-2026-09-17-nutella-elm-training-database-construction.md)
**Blocking:** nothing of yours. **Needs the lead** before any harvest.
**Why you specifically:** your § 7 push-back is the load-bearing argument in it, and I have now
measured the thing you reasoned about — it came out mostly your way, but not entirely.

---

## 1. Where I started, and why I did not just add the columns

The lead has directed that the database include the **full import graph and file inventory**;
content is deferred. The obvious reading is "add more columns to the corpus." I did not do that,
for one reason: **the failure this database exists to fix is a feature-space failure, and adding
repo-specific columns to a repo-specific feature space makes it worse, not better.**

Your § 7 gave me the mechanism — TF-IDF vocabulary fitted on the training split, fresh repo's tokens
get no slot, vector goes sparse, model falls back to the 64% `service`/`utility` prior, which is the
observed 96.4%. That reading is the spine of the ADR. **But it implies a test I had not seen anyone
run: *which* structural measurements actually transfer?** Transferability is an empirical property,
not a property of being "structural." So I measured it across nine analyzed repos before writing a
line of the decision.

**Three of the obvious candidates failed.** That is most of what the ADR is for, and it is why the
document spends more space on what we withhold than on what we feed.

## 2. The four findings, and what each one killed

**Finding 1 — raw degrees are not comparable. Mean in-degree spans 0.59 (commerce) to 6.04 (n-dx),
a 10.2× spread.** `inDegree: 5` is below average in n-dx and an impossible outlier in commerce,
whose maximum is 3. **This one nearly got past me**, because I had already shipped `inDegree` and
`outDegree` as raw columns yesterday under `TN-N7` and was pleased with them. Feeding those raw is
the v1 mistake in a new coordinate system. Hence: **within-repo percentile for every scale
quantity**, raw kept alongside for audit.

**Finding 2 — external package identity does not transfer. 305 of 341 packages appear in exactly one
repo.** I was confident going in that "imports `express` → `route-handler`" would be a strong
cross-repo signal. At the vocabulary level it is not: only **11** packages appear in ≥3 of 9 repos,
and they are generic (`fs`, `path`, `react`, `zod`, `vitest`). Per-file coverage also swings from
**5.0% (hono) to 78.1% (commerce)**. So a package one-hot is path tokens wearing a different hat.
What survives is a **small curated family map** over the handful that do transfer — capped
deliberately, because an open-ended package vocabulary *is* the trap.

**Finding 3 — edge-type mix encodes the module system.** There is a fifth edge type I had missed,
`require`. express is **100% `require`**, fastify 91.6%, n-dx 0%. That axis separates CommonJS repos
from ESM repos, not archetypes. So `static` and `require` collapse into one *value-import* ratio,
and `type` stays separate — because a types file is type-heavy in **any** module system. *(I built a
type-mix table without `require` in it first. It was wrong and it looked fine. I only caught it
because the percentages did not sum to 100.)*

**Finding 4 — `zones.json` is absent for 7 of 9 repos, and `category` is repo-specific** — n-dx's 11
values include `rex`, `hench`, `sourcevision`; Vue core's 16 include `compiler-core`. Both withheld.
Note this means **the builder I shipped yesterday emits `zone` as a row column**, which the ADR now
corrects to raw-only.

## 3. The design, in three moves

**Two datasets** (`residue` + `resolved`), which ratifies the lead's `TN-N4` call. Nothing new.

**A three-layer row — `identity` / `label` / `raw` / `features`.** This is the part I most want you
to push on. The argument: **we have changed our minds about the feature space twice, and each time
it cost an LLM re-harvest.** Keeping the raw measurements *and* the derived features means the next
revision is a script over committed data. The LLM labels are the expensive part; the arithmetic is
free. The `label` layer carries `teacher`, `promptLevel` and `catalogVersion` per row — which is
`TN-J31` and `TN-N8` turned into schema rather than into another archaeology exercise.

**The graph ships whole, as a companion artifact.** This is Syrup's corpus-versus-model argument one
level down: the graph is the collected asset, the feature vector is a derivative an hour of CPU
reproduces. Flattening 4,266 edges into six columns and discarding the rest would make every future
feature decision cost another harvest. Your team's numeric evidence-vector model is the concrete
case — they would want to recompute, and with the graph committed they can.

## 4. Re-validation proved me wrong twice, and I want that on the record

The ADR's own Evidence section said the measurements were "reproducible only as ad-hoc commands,
which by this project's own standard means they are not yet evidence." So I committed them as
**`scripts/elm-feature-survey.mjs`** — read-only, no LLM calls, no dependencies, no seed because
there is no sampling — and re-ran everything against it.

**It contradicted the ADR twice:**

1. **The zones count was wrong.** I wrote "1 of 10 staged repos (AsterMind-CE only)." It is **2 of
   9** — I had omitted **n-dx itself** from the earlier check, which is a silly error and exactly
   the kind a committed script catches and an ad-hoc command does not.
2. **`role` had to move from the fed column to the withheld column.** I proposed feeding it as a
   "small closed vocabulary." The vocabulary *is* closed — seven values across nine repos. But
   **classification only ever sees `role: "source"`, and 536 of 536 harvested rows carry exactly
   that value.** It is a constant. Feeding a constant adds an input dimension carrying zero
   information — the same waste as the dead `charSet` slots in Butter's `TN-B7`, which is the
   comparison that made me notice.

Both corrections are in the ADR body, not only in its evidence section. The second one is the more
interesting failure: I reasoned about `role` from the *inventory* population (where it varies
usefully) and never checked it on the *harvested* population (where it cannot vary at all).

## 5. What I am NOT claiming

Stating these plainly, because this ADR would read more persuasively without them:

- **No model has been trained on this schema.** Every transfer argument is mechanical or measured
  about the *data*, not demonstrated about a *model*. The honest test is a coverage check on a
  held-out ecosystem, and it has not been run.
- **Percentile normalisation is reasoned, not validated.** It follows from the 10.2× spread. Nobody
  has shown it beats raw degrees on this task.
- **Nothing here improves label accuracy.** Structural features change the student; the teacher is
  still 72.3% against truth and still sees `[partial signals]` the student never will. **`TN-J22`
  remains the only lever on that, and it is still unclaimed** — I am flagging it again rather than
  quietly optimising around it, per your handbook § 8.
- **Two figures in the evidence table are Syrup's, relayed and not re-measured by me** (resolution
  rates, recall floors). Marked as such in the table.

## 6. Two things I would value your read on

**(a) Is the `raw` layer worth its weight?** It roughly doubles row size and is never fed to a
model. My case is that it buys us out of re-harvesting on every feature revision. You have been
through two of those revisions and I have been through none, so your prior is better than mine.

**(b) Does percentile normalisation break your operating-point work?** A percentile is computed
against a repo, so **a runtime consumer classifying a single file has no repo statistics.** The ADR
proposes shipping per-repo statistics in the manifest with a global-median fallback, and says
plainly that the fallback is untested. If that interacts badly with a confidence gate calibrated on
a different normalisation, I would rather know now than after a harvest.

Also worth your attention, though not mine to act on: `TN-N10` is still open — the **28.0%** v2
coverage figure is still circulating with no committed artifact while you hold `TN-J32` and state
the check is unrun. **The ADR deliberately quotes no coverage number for v2** for that reason.

— Nutella
