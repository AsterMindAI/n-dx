# Team Nolan's scope is now assigned: we build the training database

**From:** Nolan (Team Nolan) · **To:** Team Nolan — Jam, Butter, Fluff, Syrup
**Drafted by:** Nutella (Team Nolan) · **Date:** 2026-09-16 · **Backlog:** `TN-N1`

Read this first if you are being revived. It changes what Team Nolan is for, and it changes what
the corpus is *for*.

---

## 1. There is a new agent, and the team has a scope

**I am Nutella — Team Nolan's lead database builder**, onboarded today per `NEW-AGENT.md`. Charter
at [`Nutella.md`](../Nutella.md). Shared checkout `/Users/nolanmoore/Work/n-dx-1`, branch
`Nolan-Work`, alongside Jam, Fluff and Syrup — the lead's decision, on the grounds that our scopes
differ enough not to collide. Same mitigation as everyone else here: **state-writing commands get
an `IN-FLIGHT.md` claim first**, because `.rex/`, `.sourcevision/` and `.hench/` lose data silently
under concurrent writers.

**The leads have agreed general scopes between them** (Nolan, 2026-09-16). Team Nolan's is:

> **Build the database the ELM trains on.**

I only know *our* assignment. **I do not know what Jarrett's and Thomas's scopes are** and I am not
going to guess at them in a note that will be read as a record — ask Nolan.

## 2. What we are building — and what is deliberately NOT ours

The lead supplied an architecture diagram. **Team Nolan owns the green box only:**

```
  ┌──── GREEN BOX — OURS ───────────────────┐
  │  ~15 public repos                        │
  │        ↓                                 │
  │  label every file with the 17            │        [ELM class]  ← NOT OURS
  │  archetypes, using the n-dash script     │ ─────→ [>80% conf?] ← NOT OURS
  │        ↓                                 │        [LLM fallback + retrain] ← NOT OURS
  │  labelled files = the training data      │
  │                                          │
  │  Lead's steer: narrow to 1 repo first,   │
  │  scale later.                            │
  └──────────────────────────────────────────┘
```

**Everything to the right of the green box is an example of the consumer, not a specification.**
The lead was explicit about this and it is the part most likely to be misread later:

> **Do not let the consumer design influence the training data.**

So: the 80% confidence gate, the LLM-fallback arrow, the retrain loop — we do not build them, and
we do not shape, filter, weight or prune the corpus to suit them. A dataset curated to flatter one
downstream gate is not a dataset, and the whole point of shipping data rather than a model is that
the consumer is free to disagree with us.

**END GOAL:** hand the other two leads **a GitHub repo, or a comparably light database**, that an
ELM can be trained from. **The deliverable is data plus the document that makes it safe to use —
not a model.** That is already the direction `ADR-2026-09-04-syrup-merge-elm-corpus-into-jarrett-harness.md`
argued for on independent grounds: *the corpus is the paid-for asset and the model is roughly an
hour of CPU away from it.* That ADR is still **Proposed** and still **unsent to Jarrett**.

## 3. What this changes for each of you

- **Jam** — you hold `TN-J32` (corpus v2) and absorbed K2's rows. **The corpus-acquisition half is
  now mine**; the modelling, the tier, the sweeps and the certification stay yours. The overlap to
  settle with the lead is `TN-J32` and `TN-J9` — I have not touched either, and I am not claiming
  them behind your back. **The v2 coverage re-check is still unrun and it is on your row**, not
  mine (§ 5).
- **Butter** — nothing here reaches `packages/llm-client/**`. If the deliverable becomes a separate
  repo it involves no workspace dependency and no `pnpm-lock.yaml` churn, so it does not collide
  with `TN-B3` Step 0's pending sign-off.
- **Fluff** — two doctrine docs are now out of date and they are yours, not mine:
  **`OWNERSHIP.md` § Assignments and `Command-Structure` § The teams both still read
  `(unassigned)` for all three teams.** The leads have decided. I have not edited either — they are
  on the shared "nobody edits unilaterally" list.
- **Syrup** — your 09-04 ADR is the closest existing statement of what I am now here to do. I am
  working from it rather than restating it. Its Step 0 is still the gate.

## 4. State of the inheritance — verified against disk, not against the docs

I checked the artifacts rather than quoting their documentation, which turned up three stale
statements. **Corpus v2, read from the JSON:** 624 rows (train 464 / heldOut 160), 16 classes,
7 ecosystems, seed 42, holdout 0.25, **majority baseline 38.3% (`utility`)**. Per repo: `n-dx-1`
255 · Vue `core` 212 · AsterMind-CE 69 · fastify 48 · express 17 · commerce 15 · got 8.

**Coverage gap, and it is my problem:** the catalog is **17 archetypes**
(`packages/sourcevision/src/analyzers/archetypes.ts`, 17 ids). The corpus covers **16** —
**`page` has zero rows** — and eight more classes are under ten rows (`middleware` 8,
`cli-command` 6, `gateway` 6, `store` 3, `schema` 2, `model` 2, `route-module` 2, `hook` 1).

### Three corrections — stop quoting the old versions

1. **The corpus-v2 re-freeze is FINISHED, not running.** `IN-FLIGHT.md` § 2 still says it is
   *"RUNNING (`pid 25842`)"*. `ps -p 25842` returns nothing, and
   `scripts/data/elm-frozen-model-v2.json` exists — 12,933 bytes, mtime 2026-09-04 11:58 — which is
   that job's **own stated success test**. Syrup's ADR recorded the completion on 09-04; the claim
   board was never updated. It has read "running" for twelve days.
2. **`elm-corpus-build.mjs` DOES record the resolved teacher model.** `ELM-CORPUS.md` § 4 states it
   does not, and instructs whoever extends the corpus to fix it first. **That fix already landed.**
   Resolution logic at `scripts/elm-corpus-build.mjs:120-144`, mixed-teacher rollup at `:214-273`,
   added in commit **`b4fde7b2`** — *the same commit that wrote the sentence saying it was missing.*
   The **artifact** genuinely lacks the field, because v2 was built 2026-09-01, before that commit
   (verified: none of the 7 provenance entries has a `teacher` key, and there is no `teacherMix`).
   **So `TN-J31` needs a rebuild, not a code change.** Anyone who budgeted script work for it can
   stop.
3. **The teacher table in `ELM-CORPUS.md` § 4 is recovered, not recorded** — K2 says so itself, and
   it stays true until a rebuild. 255 rows (40.9%) `claude-sonnet-4-6`, 369 (59.1%)
   `claude-sonnet-5`. **The corpus has two teachers and the artifact does not say so.**

## 5. The thing I want the team to look at before anything else

**Corpus v2 has never been coverage-checked, and v1's failure is the reason this team has a
database scope at all.** v1 trained a model that passed on its own repos and collapsed on fresh
ones — coverage 34.9% → 13.2%, `service`/`utility` predicted for 96.4% of files against the
teacher's 48.4%, 5 of 13 labels emitted. **It learned n-dx's archetype prior, not a path→archetype
mapping**, and **held-out CV cannot detect that**, because held-out rows come from the training
repos.

v2 widens 2 → 7 ecosystems, which is the right *shape* of fix. **Nobody has demonstrated it
works.** The check is free — no labels, no LLM spend, predictions alone:

```sh
node scripts/elm-coverage-check.mjs --frozen=scripts/data/elm-frozen-model-v2.json
```

**I have not run it, because `TN-J32` is Jam's claim and the board is the lock.** If the lead moves
it to me, I will run it and publish the number with its seed and baseline either way. **If v2 fails
the way v1 did, that is a finding and it ships as one** — with the corpus, in the same breath, per
Syrup's Step 0.

## 6. What the expansion actually costs — most of it is already paid for

- **105 rows are free right now.** Gold set #2 LLM-labelled **355** candidates; only **250** were
  sampled into the blind packet. The remaining 105 are paid for, and harvesting them leaves the 250
  blind. Cheapest expansion on the table and still unclaimed.
- **Five repos are staged and unharvested** in `/Users/nolanmoore/Work/n-dx-elm-corpus/`:
  `nest`, `payload`, `remix` cloned but never analyzed; **`svelte` (388 files) and `typeorm` (563
  files) analyzed rules-only — zero LLM rows**, because `--fast` gates the classify pass. They are
  exactly the ecosystems `TN-J9` asked for and they only need the classify calls.
- ⚠️ **That staging tree is NOT version-controlled.** 13 repos of paid-for analysis, one `rm -rf`
  from gone. The committed JSON is the only durable copy — which is itself an argument for the
  end-goal repo.

**`sourcevision analyze` writes `.sourcevision/` into the TARGET repo, which no worktree isolates**,
and **`--fast` spends nothing and yields nothing usable** — that is how svelte and typeorm ended up
with 563 analyzed files and zero rows. **Pin the teacher per repo before analyzing**
(`<repo>/.n-dx.json` → `{"llm":{"claude":{"model":"claude-sonnet-5"}}}`) or it silently takes
`NEWEST_MODELS.claude`, which is how we got two teachers in one corpus.

## 7. What has NOT happened

Stating these because the note would read better without them.

- **No cross-team note has been sent.** Jarrett and Thomas do not know Team Nolan's scope, and
  per Syrup's 09-04 ADR they still do not know the corpus exists — K2's outbound notes at
  `c2d1ddb4` were never delivered, because **notes are delivered by merging, not by writing.**
  Drafting that is an agent's job; sending it is Nolan's.
- **I have spent no LLM calls, run no analyze, trained nothing, and changed no source file.**
- **`OWNERSHIP.md` and `Command-Structure` still say every scope is `(unassigned)`.** Flagged to
  Fluff above; not edited by me.
- **The deliverable's shape is undecided** — separate GitHub repo vs. in-tree JSON is the lead's
  call and I have not assumed it.

---

**Reply in this inbox** (`Claude-Context/Nolan-Agents/Notes/`, `NOTE-nolan-internal-…`). The one
thing I actively need is § 3's boundary with Jam: **who owns `TN-J32` and `TN-J9` now that corpus
acquisition is a separate scope.**
