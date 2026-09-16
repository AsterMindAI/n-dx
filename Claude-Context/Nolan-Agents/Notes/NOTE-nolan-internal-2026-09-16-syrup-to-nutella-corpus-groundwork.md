# NOTE — Nolan internal — 2026-09-16 — Groundwork for the ELM training database: what the other two teams have built, and the traps their work will hand you

**Drafted by:** Syrup (Team Nolan) · **For:** Nutella (Team Nolan), cc Jam
**Needs a reply by:** nothing blocks you. § 12 has one request.
**Blocking:** nothing. This is context so you do not re-derive five weeks of it.

Welcome. You own the green box — the labelled corpus that trains the ELM. This note is
everything I know that bears on that box, gathered from reading Teams Jarrett and Thomas
end to end and from measuring our own corpus inside their architecture. **Every number here
I verified myself at `file:line` or by execution.** Where I am relaying something unverified
I say so.

---

## 1. The single most important thing: your design changes the feature space

The diagram has the ELM looking at **extension, content, and name**.

**Nothing built so far looks at content.** Not one of the three classifiers:

| component | what it actually sees | where |
|---|---|---|
| the algorithmic pass | filename + directory strings | 74 of 75 signals in `archetypes.ts` |
| the LLM half | the path, nothing else | `classify-llm.ts:192` — `` `${i+1}. ${f.path}` `` |
| our corpus | the path, nothing else | `elm-corpus-build.mjs:273` — `text: fc.path` |

Our entire corpus is 624 rows whose only feature is a path string — max 68 characters, zero
newlines, zero spaces. Every accuracy number anyone on this project has published is a
path-only number, including the LLM's own 72.3% against truth.

**So the corpus you build is not an extension of ours. It is a different artifact**, and you
should not assume our schema, our builder, or our results carry over. They were all built for
a feature the new design has outgrown.

Two things to know while you design the row format:

- **Content is free and already on disk.** `.sourcevision/inventory.json` gives you `lineCount`,
  `size`, `language`, `role`, `category` per file. `.sourcevision/imports.json` gives you
  `edges` with a `symbols` array — the actual imported/exported symbol names. I measured
  availability on the population that matters: **95–100% of files have export symbols, 98–99%
  have some symbol, 100% have `lineCount`.** With real discriminators in them — `listTransforms`,
  `parseArgs`, `create_test`, `inferRuntimeType`.
- **Raw file text is not collected anywhere.** If the ELM is to read content, something must
  read it. That is new collection, and it is yours to design. Budget for it.

---

## 2. What already exists — reuse, do not rebuild

All on `origin/Nolan-Work`, all fetchable without a merge:

| artifact | what it is |
|---|---|
| `scripts/data/elm-archetype-corpus-v2.json` | 624 rows, 7 ecosystems, seeded stratified split (seed 42, holdout 0.25) |
| `Claude-Context/Nolan-Agents/ELM-CORPUS.md` | the corpus's documentation — schema, provenance, **failure mode (§ 6)**, **contamination boundary (§ 7)**, what is on disk (§ 8) |
| `scripts/elm-corpus-build.mjs` | the builder. Reads `.sourcevision/` dirs, emits corpus JSON |
| **`scripts/elm-coverage-check.mjs`** | **the most valuable thing we have.** See § 3 |
| `Claude-Context/Nolan-Agents/ELM-FINDINGS.txt` | the findings ledger |
| `/Users/nolanmoore/Work/n-dx-elm-corpus/` | **10 repos already analyzed** — and **not version-controlled** |

**Read `ELM-CORPUS.md` before you write a line of code.** It is short and every section is
something that cost us a week.

Already staged and never analyzed: **nest, payload, remix**. Already analyzed but yielding zero
LLM rows: svelte, typeorm.

---

## 3. The coverage check is the instrument, and it will outlive every corpus

`scripts/elm-coverage-check.mjs` answers "will this model generalise?" using **only the model's
own predictions** — no ground truth, no labels, no LLM spend. It works by asking whether the
predicted class distribution has collapsed onto the majority class.

That property is why it caught a stop-the-line result before a single file was hand-labelled.
**Build your corpus so this check can run against it.** If you change the row schema, port the
check first. A corpus you cannot cheaply test for collapse is a corpus that will fail in
production instead of in development.

Its own closing line is worth internalising: **"K1' is a property of (model, repo), not of the
model alone."**

---

## 4. The trap that shaped our corpus — and why your design avoids it

This is the finding I would most want in your hands.

Our builder takes only rows with `source: "llm"` — files the algorithmic pass **failed** to
resolve. That filter has a selection bias built into it. Measured on n-dx:

| | rows | service + utility share |
|---|---:|---:|
| LLM-sourced (what our corpus takes) | 255 | **78.8%** |
| algorithmic (what our corpus excludes) | 428 | **19.4%** |

Class by class the exclusion is total: `component` 71 algorithmic / **0 LLM**. `page` 37 / **0**.
`hook` 28 / 1. `store` 51 / 3. The algorithmic pass resolves the structurally obvious classes
confidently, so they never reach the LLM, so they can never enter the corpus.

**Consequences we then paid for:**

- 11 of 16 classes have <20 training rows; five have 1–2 (`hook` 1, `model` 1, `route-module` 1,
  `schema` 1, `store` 2)
- `page` is absent from our label set entirely — 37 page files on n-dx, all algorithmic
- The trained model **emitted only 9 of 16 classes** across an entire held-out set
- On unseen repos it predicts service/utility for 80–100% of files against a teacher's 48.4%

And critically: **widening ecosystems does not fix it.** We went 2 → 7 ecosystems and the skew
survived, because every repo has the same property.

**Your diagram says "label each of the files."** If you mean that literally — every file, not
just the residue — **this trap disappears by construction.** That is a real improvement over
what we built, and it is worth protecting deliberately rather than by accident. See § 5 for the
catch.

---

## 5. What the "n-dash script" actually does, versus what the diagram implies

The labelling tool is `sourcevision analyze <repo> --full`. Know these before you plan a run:

- **It is two-stage, and the LLM only ever sees the leftovers.** The LLM population is selected
  as `archetype === null && source === "algorithmic"` (`classify.ts:355`). **There is no flag
  that makes the LLM label every file.** I looked.
- So "label each of the files" gives you a **mixed-provenance corpus**: algorithmic labels for
  files that matched a signal, LLM labels for the rest. That is fine — arguably better than ours
  — but **tag every row with its `source`** so any future result can be split by provenance.
  Without that tag you cannot tell a model failure from a labelling artifact.
- **`analyze` writes `.sourcevision/` into the TARGET repo**, which no git worktree isolates.
- **Stage target repos under a real home directory, never the session scratchpad.** `/private/tmp`
  was reaped mid-run once, leaving a husk and a silent `0 files cataloged` result that looked
  exactly like a regression.
- **Pin the teacher model in the target repo first** or it silently takes the newest Claude:
  `<repo>/.n-dx.json` → `{ "llm": { "claude": { "model": "claude-sonnet-5" } } }`.
- `--full` spends real LLM calls. `--fast` spends none and yields no LLM rows.

---

## 6. The archetype catalog is moving under you right now

`BUILTIN_ARCHETYPES` is **17 archetypes on every branch today**. Do not hard-code that number.

Knight (Team Jarrett) is actively redesigning it under `TJ-A3`: a new `algorithm` archetype plus
three new `entrypoint` signals. Their reported result is a real measured win — **AsterMind
unclassified 63.8% → 31.5%**, with **no movement on n-dx yet**. They also caught and fixed their
own measurement bug along the way (comparing new algorithmic-only output against old
LLM-assisted output), which is a good sign about the care behind the number.

**That work is on no remote.** Commit `cb7f30de` lives in their local worktree
`../n-dx-jarrett-taxonomy`; I checked and `origin/Jarrett` still has 17 archetypes with no
`algorithm` entry. So you cannot read it yet, and it will land under you at some point.

**Why it matters to you specifically:** TJ-A3 improves the *algorithmic pass*, which is the thing
that decides which files reach the LLM at all. If it lands, it shrinks the labelling population
and makes the remainder harder. Any corpus keyed to today's 17 labels needs remapping when it
does. Design the schema so a relabel is a script, not a re-harvest.

---

## 7. Ecosystem choice decides your class coverage

The algorithmic pass is a filename-and-directory convention matcher, so it fires hard on repos
that follow familiar conventions and barely at all on those that do not. Measured resolution
rates:

| commerce | got | express | n-dx | core | svelte | fastify | typeorm |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 76.6% | 75.8% | 64.6% | 62.7% | 22.4% | 14.7% | 7.7% | **5.7%** |

"15-ish random public repos" will give you breadth, but **random sampling reproduces the class
skew** — that is exactly how we ended up with one `hook` row across seven ecosystems. The thin
classes live in specific places:

| class you will be short of | where it lives |
|---|---|
| hook, component, page, route-module | a React / Remix / Next app — **nest, payload, remix are already cloned** |
| store | a state-management library or app |
| model, schema | an ORM or validation-heavy repo — **typeorm is already staged** |
| middleware, route-handler | express / koa / fastify |
| cli-command | any CLI tool |

Pick repos **by the classes you need**, not by count. A useful floor from our data: `entrypoint`
at 59 training rows gave 85% recall; `types` at 34 gave 42%; anything at 1–2 rows gave 0%. Treat
**30 rows per class as a floor and 50 as a target.**

---

## 8. On "narrow it to 1 repo for now, scale later"

Good instinct for getting the pipeline working. **Do not let a single-repo number become a
result.** A one-repo corpus is precisely what produced our v1 failure: the model learned n-dx's
archetype prior rather than a path→archetype mapping, scored well on held-out, and collapsed on
fresh repos — 34.9% coverage on trained-on ecosystems against 13.2% on unseen ones.

**Held-out cross-validation cannot detect this**, because held-out rows come from the same repos
as training. That is exactly how it got past our own certification gate. Our corpus v2 improved
it to 28.0% on fresh ecosystems, which is real progress and still under the 30% bar.

So: one repo to prove the pipeline, and **the first accuracy claim needs at least one repo the
model has never seen.**

---

## 9. Contamination boundary — do not cross these

From `ELM-CORPUS.md` § 7:

| population | status |
|---|---|
| training corpus (v1, v2) | train freely |
| **gold set #2 — 250 files from hono + trpc** | **BLIND. Never train on these.** The only clean evaluation instrument anyone has left |
| gold set #1 — 83 files | **SPENT.** Labels have been read; it is a DEV set now. Never publish a number from it without labelling it DEV |

Also from § 7: **105 of gold set #2's 355 LLM-labelled candidates were never sampled into the
packet.** Those are free training rows, already paid for, and they do not touch the blind 250.
That is the cheapest corpus expansion available and it is still unclaimed.

---

## 10. A library defect that has already voided two published numbers

**`ELM.train()` does not train on what you pass it.** Its only parameter is
`augmentationOptions` (`dist/core/ELM.d.ts:59`); the implementation
(`dist/astermind.esm.js:1146`) trains on character-augmented variants of the **category label
strings**. Pass it an array of training rows and every property it reads is `undefined`, so it
silently degrades to defaults.

I proved it: two models, identical config and seed, trained on **deliberately inverted** data,
produced byte-identical `savedModelJSON`. Team Thomas found this independently first — credit
to Nala.

**Use `trainFromData(X, y)`.** Anything measured through `train()` is not a measurement. This
voided our prototype's 4.8% and 9.6%, and the repo's own `scripts/elm-hello-world.mjs` 83% —
which `claude-context-instruction` § 1 still points every new agent at.

Three more library gotchas worth having up front:

- `charSet` is interpolated **unescaped** into a RegExp character class — a literal `-` must
  come **last** or it throws
- `charToOneHot` **lowercases** before lookup, so uppercase charset entries are dead slots
- `maxLen` truncates the **tail** — a `maxLen` of 32 on real paths discards the filename, which
  is the most informative part

---

## 11. Two things in the diagram that the measured data argues with

Raising these now because they are cheaper to design around than to discover later.

**The 80% confidence bar.** Nothing measured on this project gets near it on the real
population. Jarrett's shipped default confidence threshold is **0.11**. Thomas's margin-based
rule abstains at 0.3, and I measured actual margins on 885 real routed files: **maximum 0.1177,
median ~0.03.** An 80% bar against those distributions means the ELM resolves nothing and every
file goes to the LLM. That may be the correct safe default — but it means **the corpus has to be
good enough to make 80% reachable**, which no corpus has been yet. Worth knowing what bar you
are building toward.

**The retrain loop.** Feeding the LLM's labels back to retrain the ELM makes the ELM a student of
a teacher that is itself **72.3% against truth, not ground truth**. That is workable, but it
compounds: errors get learned and re-emitted with rising confidence. Two mitigations to build in
from the start — **per-row provenance** (which teacher, which model version, which date) and a
**held-out set that never enters the retrain loop**. Retrofitting provenance onto a corpus that
has already been through several retrain cycles is not really possible.

---

## 12. State of the other two teams' code, as of today

So you know what you are integrating against.

**Team Jarrett** shipped the gate split (`TJ-R3`) on 2026-09-09: `classify.ts` is now a router
calling `classify-elm.ts` then `classify-llm.ts`, neither half aware of the other. It is good,
tested work. **It is on `origin/Jarrett` and not on `dev`.** Their ELM half is a *numeric
evidence-vector* model, not a text model — its input is a 17-dimension archetype score vector,
so our path-text corpus cannot feed it as built.

**Team Thomas** has chartered two agents (Baymax, AuroraUnit313) to build `classify_elm.ts` and
`classify_llm.ts` — **underscore-named**, duplicating Jarrett's already-merged hyphen-named
files. Both are **0 bytes** and have been for six days. Their own backlog records them as
blocked on a decision from Thomas.

**`origin/dev` does not typecheck** and has not for 12 days — `classify.ts:31` imports three
symbols `classify-elm.ts` does not export, a leftover from the Jarrett/Thomas merge. Jarrett's
TJ-R3 fixes it as a side effect but is unmerged. **Do not branch off `dev` expecting a green
build.**

Neither team has pushed anything in a week.

**One request:** when you settle the row schema, send it to me before you harvest at scale. I
have measured three different models against three different populations and I can tell you
quickly whether a schema will survive the coverage check — which is much cheaper than finding
out after the LLM spend.

— Syrup
