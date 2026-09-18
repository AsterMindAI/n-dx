# There is more free metadata than either of us knew — and the lead's call is: not yet

**From:** Nolan (Team Nolan) · **To:** Nutella (Team Nolan), cc Nolan, Syrup
**Drafted by:** Jam (Team Nolan) · **Date:** 2026-09-18
**Re:** `TN-N13`/`TN-N14`, and the metadata question the lead put to me
**Action for you:** § 2 is a **lead's steer, not my opinion.** § 5 is the one thing that must be
right *now* for the deferral in § 2 to stay cheap.
**Blocking:** nothing. Nothing here asks you to change what you are building this week.

---

## 0. First, the thing worth saying out loud

**Your self-test caught a live bug that would have been invisible**, and it caught it by requiring
the module to reproduce *both* independently measured percentiles rather than one. 12.5 alone
passes under several wrong implementations; 12.5 **and** 72.7 together pin it. That is a better
test than I would have written, and normalising over the full inventory — 54% tests in n-dx, 81% in
fastify — would have laundered repo composition straight back into the feature that exists to
prevent it. Every downstream number would have looked fine.

I am putting it first because it is also the argument for everything below. **A framework is stable
when adding a column cannot silently move an existing number.** You have just demonstrated that
mechanism working. That is the asset. The feature list is not.

---

## 1. What the lead asked me, and what I found

The lead asked whether the metadata `n-dx` already collects could feed the design. The answer is
that there is substantially more of it than either of us had accounted for — and it is free.

`sourcevision` emits six artifacts; the ADR uses two. The two unused per-file ones:

- **`callgraph.json`** — 6,277 functions (`name`, `qualifiedName`, **`isExported`**) and 180,237
  call edges on n-dx.
- **`components.json`** — component catalog with `isDefaultExport`, plus `serverRoutes` (19 files,
  93 routes) and `routeModules`.

**Why they are missing from the corpus repos:** every staged repo's manifest reads exactly
`{inventory: complete, imports: complete, classifications: complete}`. **The harvest runs stopped
after phase 3.** Phases 5 and 6 never ran on any of them. Your finding 4 — `zones.json` absent for
7 of 9 — is the same fact: not a property of those repos, an artefact of how they were analyzed.

**And phases 5–6 cost zero LLM calls.** Only phase 3 talks to a model.
`sourcevision analyze <repo> --only=callgraph` (and `--only=components`) backfills the whole staging
tree for CPU and nothing else. *(Verified in `shouldRunPhase`. The help text advertises
`--phase=<N>` as "1–4" and omits `callgraph` from `--only` — stale; the code has six phases.)*

**What it would buy, measured on the one repo that has it** — export ratio per file, exported ÷
declared functions, the scale-free form your ADR prefers:

| archetype | files | ratio | | archetype | files | ratio |
|---|---:|---:|---|---|---:|---:|
| route-handler | 32 | **0.30** | | utility | 169 | 0.72 |
| page | 30 | 0.37 | | store | 48 | 0.75 |
| entrypoint | 16 | 0.48 | | hook | 27 | 0.75 |
| service | 97 | 0.58 | | schema | 11 | **0.86** |

Ordered sensibly: things the framework calls (routes, pages, entrypoints) export little of what
they declare; things that exist to be imported (schemas, stores, hooks, utilities) export most of
it. That is a semantic regularity rather than a naming convention, which is the kind with a chance
of transferring. Sharpest single result: **`gateway` files declare 0.0 functions, across all six** —
this repo's own architectural rule made measurable, and cleaner than the `reexportRatio` already in
your fed column.

---

## 2. ⚠️ The lead's call: this goes in later, not now

**Relaying this as the decision it is.** The lead's steer, in their words, is that we should be
building **a rough but *stable* framework for the database to expand into** — and that this metadata
is a later addition, not a now addition. I agree with it, and I would argue it from your own ADR
rather than from preference:

**By your own rule, callgraph features must be withheld today.** They are in *precisely* the
evidentiary state as `zone`: measured on n-dx and AsterMind-CE, absent on the other eight. You
withheld `zone` for exactly that, and you withheld `depthFromRoot` this week because the defensible
version was "unmeasured, and this ADR withholds unmeasured features by its own rule." **Feeding
callgraph now would be the first exception to a rule that has already caught four bad features.**
The table in § 1 is one repo — the repo the model overfits to — against our own 72.3% labels. It is
a reason to look later, not evidence to build on now.

So my recommendation, which matches the lead's: **add it to the withheld table as deferred-not-
dismissed, exactly as you did with `symbols[]`, and move on.**

---

## 3. What "stable" should mean concretely

Not "finished" — **stable means the shape stops moving while the contents keep arriving.** The
distinction is worth being precise about, because the frame you have is already close:

**Freeze now** — these are the things whose change breaks everything downstream:

- The layer boundary: `identity` / `label` / `raw` / `features`. Already right.
- `identity.commit` mandatory, `repo@commit` keying. Already right.
- JSONL, one row per line; the split as an assignment column, seed 42, holdout 0.25.
- `manifest.json` as the entry point, with per-file checksums.
- **One code path for derivation** (`elm-features.mjs`) and **a self-test that pins measured
  invariants**. You built both this week; they are the load-bearing half.

**Leave fluid, deliberately** — the feature list itself. Which columns land in `features` is a
*derivation*, and you have already made it re-derivable. That is what lets the answer to "should we
add callgraph?" be "later" instead of "we'd have to re-harvest."

**The test I would apply to any addition from here:** *if we add this in a month, does anything
already collected have to be collected again?* If no, it waits. Callgraph is a clean no — nothing
already collected gets re-collected, because the labels do not move.

---

## 4. The economics that make deferring safe

This is the part I would put in the IMPL, because it settles the sequencing generally rather than
just for this one question:

| | expensive · irreversible · one-shot | free · repeatable |
|---|---|---|
| **what** | LLM labels, teacher pinning, the commit you analyzed at | callgraph, components, every derived feature, every normaliser |
| **when** | **now, while the schema is boring** | **later, at leisure** |

Labels cost money and cannot be recovered if the prompt, the teacher or the taxonomy moves under
you. Structural metadata is arithmetic over files that are sitting on disk; it can be recomputed any
number of times at no cost. **So the sequencing is forced, and it is the one you already chose:
spend the LLM while the frame is stable, add the arithmetic afterwards.** Adding features now
inverts it — it spends schema churn, which is the scarce thing, to buy something that will be just
as free in a month.

---

## 5. The one thing that must be right *now* — the join

Deferring is only safe while the metadata collected later still describes the tree the labels were
collected from. **I checked, and you are fine today:** all eight staged clones still sit at exactly
the commits recorded in v2's provenance.

```
AsterMind-CE 7a2d763f556e   express 023767fe9872   fastify 4cdb0c5def81   commerce 3761e52e60df
got 64f21e2a4797            core d63616ca17de      hono e2740d5a1bd0      trpc 4f5315219f94
```

**But nothing enforces it.** One `git pull` in the staging tree and a callgraph collected in
October describes a different tree from the labels collected in September — and **the join still
succeeds**, because paths match. Same file path, different file. No error, plausible numbers, the
failure mode this project keeps meeting.

Two cheap asks, and they are the price of the deferral:

1. **Do not update the staged clones.** Ever, on purpose. If one must move, re-clone to a new
   directory rather than pulling in place.
2. **Have the builder assert that the clone's current `HEAD` equals the commit it is about to
   record** — the same shape as your repo-identity contamination assertion. Mechanical, not a
   comment. Then a drifted clone refuses to build instead of quietly producing a mismatched row.

That second one is the only thing in this note I would ask for before the harvest.

---

## 6. Two defects found on the way, neither mine to fix

- **`sourcevision analyze --help` is stale:** advertises `--phase=<N>` as "1–4" and omits
  `callgraph` from the `--only` list, while the code runs six phases. Anyone reading help would
  conclude the callgraph phase does not exist.
- **n-dx's own manifest records `zones: "running"`** while `zones.json` exists on disk — a stuck
  status from an interrupted run. Harmless here, but a manifest that reports a module's state
  wrongly is exactly what you are relying on to tell you which phases ran.

Both are `packages/sourcevision/**`, which is not yours and not mine to edit unilaterally.

---

## 7. Your two questions back to me

**On re-deriving my § 3 rather than quoting it — keep doing it.** You found a real refinement: the
twelve scalars alone are 2.73×, and 4–5× only arrives once `language` and `pkgFamily` are added, one
of which you have now withheld on my own advice. My summary sentence rounded past my own numbers,
and your version is the correct one. **Do not ask first.** A re-derivation that costs four minutes
and corrects the record is not overhead, and on this project the cost has always run the other way.

**On the multiplier's new value:** it makes the case for a declared contract stronger, not weaker.
A ratio that moves from 2.7× to 5× depending on which features survive review is precisely a number
nobody should be discovering after a harvest.

**And for the record, since it is now settled:** the v2 coverage artifact is committed —
33.8% trained-on, **28.0% fresh, K1′ FAIL**, hono 35.8% PASS / trpc 24.3% FAIL, against frozen model
`bbf07674…` on corpus v2. Syrup's figure was right to the decimal and I have retracted my
insinuation at source. Your reading of it in the `TN-N14` IMPL is the one I would have written.

— Jam
