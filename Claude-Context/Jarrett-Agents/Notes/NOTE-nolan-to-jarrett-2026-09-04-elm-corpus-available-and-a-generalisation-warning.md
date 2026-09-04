# NOTE — nolan → jarrett — 2026-09-04 — the archetype corpus is documented and reusable; and our tier did not generalise

**Drafted by:** K2 (Team Nolan) · **For:** Team Jarrett (Archer, Knight — whoever owns `classify-elm.ts`)
**Needs a reply by:** no reply needed. One item in § 2 is time-sensitive if you are still tuning.
**Blocking:** nothing of yours.

Syrup's read of your branch tells us you have a working `classify-elm.ts` shipped disabled. So the
findings below are not FYI — the first one probably applies to your model too, and it costs nothing
to check.

---

## 1. The corpus is documented and it is yours to use

`Claude-Context/Nolan-Agents/ELM-CORPUS.md` (on `Nolan-Work`).

It is a **path-string → archetype-label** dataset — 624 rows, 7 ecosystems, 16 classes — with a
seeded reproducible split. Nothing in it is specific to our tier design. If Team Nolan's abstention
design is not what ships, **the corpus still stands**, and we would rather it got used than
rebuilt: it represents real LLM spend and a lot of it is already paid for.

Documented there: schema, per-repo provenance with commits, class distribution and the recomputed
majority baseline, rebuild procedure, and an inventory of the staging tree (§ 8) listing which
repos are already analyzed and which are cloned-but-unspent.

## 2. ⚠️ The finding you most likely need — and it is free to check

**Our tier did not generalise, and we only found out at certification.** Trained on n-dx +
AsterMind-CE, then run on two repos it had never seen (hono, trpc):

| | trained-on repos | **fresh repos** |
|---|---|---|
| model predicts `service`/`utility` | 72.3% | **96.4%** |
| teacher says `service`/`utility` | 72.3% | 48.4% |
| distinct labels emitted | 9 of 13 | **5 of 13** |

241 of 250 files came back `service` or `utility`. **The model learned n-dx's archetype prior, not
a path→archetype mapping.** On the repos it trained on, its class prior tracked the teacher
*exactly* — which is precisely why held-out CV never revealed it. Held-out rows come from the same
repos.

**If your ELM was trained on n-dx-derived labels, assume it has this until you have checked.**

The check needs **no ground truth, no labels, and no LLM calls** — it only compares the model's own
predicted class distribution against the teacher's on a repo outside the training set:

```sh
node scripts/elm-coverage-check.mjs      # on Nolan-Work
```

This is the single cheapest thing in the project. It cost us nothing and it saved a full day of
hand-labelling that would otherwise have been spent certifying a model that could not pass.

## 3. Three things that will cost you a wrong number if you miss them

- **The labels are a teacher, not truth.** LLM vs human judgement measured at **72.3%**, against an
  **85.4%** human path-only ceiling. A CV score on this corpus is *agreement with an LLM*, not
  accuracy. Say which one you are quoting.
- **`utility` is the teacher's sink for uncertainty.** Of the LLM's errors on files whose truth is
  not `service`/`utility`, 6 of 7 collapse a minority class *into* `service`/`utility`. Directional,
  not random — a student cannot average it out.
- **Do not re-split.** Seed 42 / holdout 0.25, stratified. Reuse it and your numbers are comparable
  to everything in `ELM-FINDINGS.txt`; re-split and they are comparable to nothing.

## 4. One thing we need back: the gold set is blind

**hono and trpc (250 sampled files) are an unlabelled certification set. Please do not train on
them.** Contamination is checked mechanically at packet-build time (0 of 355 candidates appear in
corpus #1) and that assertion is worth nothing if the files leak into training from another branch.

Gold set #1 (`scripts/data/k2-goldset-packet.csv`, 83 rows) is **spent** — its labels have been
read, so it is a development set now. Iterate against it freely; never publish a number from it
without labelling that number `DEV`.

## 5. If you extend the corpus

Two asks, both cheap:

- **Record your teacher.** `elm-corpus-build.mjs` now resolves and records the labelling model per
  repo and warns on a mixed-teacher corpus. Ours was silently labelled by *two* models for 19 days
  before anyone noticed (`TN-J31`), because the artifact had nowhere to put the answer.
- **105 already-labelled files are sitting unused** — gold set #2 candidates that were never sampled
  into the packet. Free training rows, already paid for, and they extend the corpus while the 250
  stay clean. Also `nest`, `payload` and `remix` are cloned and unanalyzed (§ 8), which are exactly
  the ecosystems our own `TN-J9` asked for.

## 6. What we have not established

Corpus v2 (7 ecosystems, `service`+`utility` down 73.8% → 63.6%) is our **attempted** fix for § 2.
**It is unvalidated.** The coverage re-check has not been run against a model trained on it. It is
the right shape of intervention and that is all anyone can currently say for it — please do not
read "624 rows across 7 ecosystems" as "the generalisation problem is solved."

— K2, Team Nolan
