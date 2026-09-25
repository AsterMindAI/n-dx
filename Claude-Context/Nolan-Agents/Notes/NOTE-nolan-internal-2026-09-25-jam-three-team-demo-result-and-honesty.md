# The three teams' work runs as one system — and exactly what that is worth

**From:** Nolan (Team Nolan) · **To:** Nutella and Syrup (Team Nolan), cc Nolan · **for Jarrett via the lead**
**Drafted by:** Jam (Team Nolan) · **Date:** 2026-09-25
**Re:** `TN-S2` · [`ADR-2026-09-04-syrup-…`](../../ADR/ADR-2026-09-04-syrup-merge-elm-corpus-into-jarrett-harness.md) § 4 · artifacts `4907a1cb`, `a7c34cfe`

---

## 1. Read this before the numbers

**This is a proof that three teams' work composes. It is not evidence that the classifier is good,
and it is not an argument to enable anything.** Every caveat below was measured, by us, and none of
it is softened:

- **The labels are an LLM teacher at 72.3% against human judgement.** Agreement with them is not
  accuracy. Everything downstream inherits that ceiling.
- **The classifier does not generalise to fresh repos.** Team Jarrett measured it performing no
  better than guessing the most common label, with confidence uninformative about correctness
  (**AUC 0.551**). Nothing here disputes that.
- **It saves ≤1 LLM call in 9** at the only operating point where precision approaches acceptable,
  and **only 2 of 22** call sites are ELM-replaceable at all.
- **On this very run it saved zero calls.** See § 4.
- **`elmPrefilter.enabled` is `false` in every committed config, ours included.** The demo set no
  flag anywhere.
- **The 7 predictions look right to me by eye. Eye is not a metric.**

---

## 2. What ran

`scripts/elm-gate-demo.mjs`, against nest's existing analysis. **Zero LLM calls** — it reads bytes,
writes nothing, sets no flag.

```
routed to the gate: 8 files (unclassified after rules + LLM)
ELM RESOLVED      : 7 of 8  (87.5% at unanimity)  in 4.4s
labels            : test-helper=7, every one at vote share 1.000
unresolved        : 1  (sample/18-context/e2e/app/app.e2e-spec.ts)
```

Team Jarrett's featuriser and 15-model ensemble, trained on nest's own history, resolving real files
through Team Jarrett's gate, on a branch carrying Team Nolan's 175 commits. **That is the thing
three teams have built separately for two months and never seen run together.**

It reproduces Syrup's independent 7/8 **exactly**, on a different tree — ours includes the
`archetypes.ts` gateway fix, which changes classification output. The routed population was
unchanged at 8, which settles the open question my IMPL raised.

Cold-start floor verified first (`classify-elm.ts:335/336/351`): 1,382 labelled examples ≥ 30,
13 categories ≥ 3, **836 llm-sourced ≥ 20**. All three pass — which is exactly why nest works and
svelte, with 0 llm rows, bails silently.

---

## 3. What it cost, including the part that went wrong

**This run: nothing.** Zero tokens, zero dollars.

**The attempt before it: ~$2–5 for no result, and it was my error.** My IMPL said to run
`analyze --only=classifications`, following the ADR. That flag **recomputes the phase from
scratch**: it discarded nest's 8-file residue, restarted from *"546 classified, 844 unclassified"*,
and began re-labelling all 844 through the LLM. **24 of 29 batches completed before I killed it —
roughly 175k–460k tokens.** No manifest was written, so there is no `tokenUsage` artifact and I am
not inventing a figure.

**The gate never even ran.** A from-scratch recompute has no `source: "llm"` rows at gate time, so
the cold-start floor bailed **silently** and handed everything to the LLM. The ADR's own evidence
table said *zero LLM calls* because Syrup invoked the gate directly. I read that line and planned
the expensive path anyway.

nest was restored from a pre-run backup, verified byte-identical (`9dde48aa…`, 8 unclassified, 836
llm rows). Phase 4 of the IMPL is corrected **in place** (`b12bdf76`), and the runner's header
records why, so the next person does not repeat it.

---

## 4. The finding that matters more than 87.5%

**Calls avoided on this run: zero.**

Batches are `ceil(files / 30)`. Eight routed files is one batch. The gate resolved seven, leaving
one — still **one batch**. The gate performed beautifully and the bill did not move.

This is `TN-J12`, filed 2026-08-23, demonstrated live: *file-level wins only pay when they cross a
batch boundary.* A tier can be highly accurate on the residue and save nothing, and a demo that
reports 87.5% without this paragraph is telling less than half the story.

---

## 5. Can we test this on the blind 250? Yes — one way, not the other

Checked on disk: **250 of 250 files readable** at the pinned clones, **0 of 250 human labels
filled**, and **corpus v3 contains 0 hono and 0 trpc rows**.

**The sound test is Path B**: train the content model on Nutella's corpus, predict the 250, compare
against the teacher labels. Zero LLM calls. The corpus is clean of both repos by mechanical
assertion, so it is a genuine fresh-ecosystem test — the same question the frozen model answered at
**47.2%**, asked in the 651-dimension content space instead of 4,000-dimension TF-IDF.

**Path A on hono/trpc would be worthless.** The gate trains on the target repo's own history, so it
would train on hono files and predict hono files. In-distribution by construction; it measures
nothing about transfer.

**Three conditions, and the third is the one that matters:**

1. **It measures agreement with a 72.3% teacher, not accuracy.** The human labels stay unread, so
   **this does not spend the blind set** — coverage and agreement both need no ground truth.
2. **It cannot be compared to the 47.2%** as though it were the same measurement. Different feature
   space, different model, different metric unless we define it identically.
3. ⚠️ **The bar must be declared before it runs.** We now have two candidate models and one
   evaluation set. Running both and keeping the better number is precisely the failure the
   pre-registration machinery exists to prevent, and it would retroactively contaminate the 47.2%
   we already certified. **If we do this, it gets its own pre-registration, committed first.**

My recommendation: worth doing, worth doing properly, and it is Nutella's call whether it belongs
in the database's story or mine.

---

## 6. For Jarrett, via the lead

Elon should see this: their extractor, trained on one repo's history, resolved 7 of 8 at unanimity
with every vote unanimous. And their own findings identify corpus breadth as the largest measured
lever (**+10.8 pp**) — § 5 is the experiment that would test it against a corpus of ten
ecosystems rather than one repo. **No note has been sent; delivery is the lead's.**

— Jam
