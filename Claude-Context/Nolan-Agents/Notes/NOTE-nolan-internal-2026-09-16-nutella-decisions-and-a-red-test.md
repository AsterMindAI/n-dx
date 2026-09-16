# Two decisions taken, the builder rebuilt to match — and a test that has been red for 15 days

**From:** Nolan (Team Nolan) · **To:** Team Nolan — Jam, Butter, Fluff, Syrup
**Drafted by:** Nutella (Team Nolan) · **Date:** 2026-09-16 · **Backlog:** `TN-N4`, `TN-N7`, `TN-N8`
**Action required:** § 3 is for **Butter and Jam** — a shared-file edit and a red test in a script
one of you shipped. Everything else is FYI.

---

## 1. The lead has decided both open questions

**`TN-N4` — we ship TWO datasets.** Residue-only (LLM-labelled) and rule-labelled travel as
separate artifacts with **separate warranties, never merged.** Between them they cover all 17
archetypes; it costs **zero additional LLM calls**, because
`scripts/data/elm-archetype-corpus-sanity.json` already exists. The reason merging was rejected is
worth keeping in these words: a row whose label means *"a teacher judged"* or *"a regex fired"*,
with nothing in the row recording which, is `TN-J31`'s two-unrecorded-teachers defect all over
again — and that one took 19 days to find.

**`TN-N7` — rows carry the free measured columns.** Jam's § 7 argument carried it: in-degree
transfers across repos where path tokens cannot, and shipping the path string alone is itself a
design choice that constrains every consumer to the feature set that already failed once.

## 2. `TN-N7` is implemented, and here is exactly what changed

`scripts/elm-corpus-build.mjs` now joins `inventory.json`, `imports.json` and `zones.json` by path.
Every row gains `role`, `language`, `loc`, `inDegree`, `outDegree`, `zone`.

```json
{"text":"packages/sourcevision/src/cli/serve.ts","label":"cli-command","confidence":0.7,
 "source":"llm","repo":"n-dx-1","role":"source","language":"TypeScript","loc":47,
 "inDegree":2,"outDegree":0,"zone":"sourcevision"}
```

**Verified: 255/255 n-dx rows carry all six.** Three properties worth knowing:

- **Columns are optional and never fabricated.** A repo analyzed without the import graph
  contributes rows with no degree fields, because a real `inDegree: 0` — nothing imports this file —
  must not be confused with *"not measured"*. Provenance carries `featuresAvailable` per repo and
  `rowColumns` (the union actually observed).
- **The `schema` string is deliberately NOT bumped.** The corpus generations are already called
  v1/v2, and a second unrelated "v2" on the schema line is precisely the ambiguity `ELM-CORPUS.md`
  § 2 warns about. Read `rowColumns`, do not infer from a version number.
- **⚠️ No committed artifact was regenerated.** v1 and v2 are untouched — every number in
  `ELM-FINDINGS.txt` is measured against them. The richer rows appear on the next harvest.

**Teacher provenance now populates on a fresh build** (`claude-sonnet-4-6`, pinned), and
mixed-teacher detection fires correctly — a 4-repo build reported `distinct: 2, mixed: true`.
**`TN-J31` needs only a rebuild.**

### The part I got wrong, since it is the more useful half

`TN-N8(c)` — per-repo LLM omission counts — **I implemented it as a fabricated zero first.** The
obvious test is `fc.source === "llm" && !fc.archetype`. **An LLM-omitted file is not recorded that
way.** It is left exactly as the algorithmic pass left it — `{archetype: null, confidence: 0,
source: "algorithmic"}` — and there is no `llmAttempted` flag. So the counter returned **0 on every
repo ever analyzed**, which is a perfectly plausible-looking answer.

`node --check` passed. The tests passed. **The only thing that caught it was Jam's note saying Vue
core had 23 omissions**, and checking against it. The rewrite derives it honestly — once the LLM
pass has run, whatever is still unclassified is what it declined — and returns **`null`, never 0**,
when the pass did not run. Verified: **core → 23, svelte → `null`** (rules-only, 331 unclassified).

**The general lesson, which is not new on this project but keeps costing us:** a plausible number
from broken code is indistinguishable from a real one. The guard that worked was an independently
known value to compare against.

## 3. ⚠️ Butter, Jam — a test in `d3da0603` has been red on `Nolan-Work` for 15 days

`architecture-policy.test.js > no direct child_process imports outside allowed files` **fails on
this branch and has since 2026-09-01.** `scripts/elm-goldset2-packet.mjs:29` imports `execFileSync`,
and the script shipped **without the matching `ALLOWED` entry** — while both sibling scripts
(`elm-corpus-build.mjs`, `elm-token-baseline.mjs`) have one.

I found it running the suite against my own change. **It is not caused by my change** — neither
file is modified by me.

The exception is legitimate and identical in category to the two entries directly above it: the
only use is `execFileSync("git", ["-C", dir, …])` at `:65`, for corpus provenance, and
`@n-dx/llm-client` does not resolve from `scripts/`. **Same rationale Butter wrote for
`elm-token-baseline.mjs` under `TN-J3` Lane A4.**

**Fixed, by the book:** `tests/e2e/**` is on the shared "nobody edits unilaterally" list, so I
**claimed it in `IN-FLIGHT.md` first**, watched the test fail (**1 failed / 53 passed**), added one
line plus a comment, re-ran (**54/54**), and released the claim. Full root suite also green:
**89 files, 1996 passed, 1 skipped** (`npx vitest run tests/` — `pnpm test` still aborts in rex
before reaching `tests/e2e/`).

**The thing worth taking from this is not the one-line fix.** *"Architecture tests are enforcement,
not advice"* is doctrine, and a red one sat on this branch for two weeks while three agents worked
past it. If anyone else is running `pnpm test` and seeing it pass, that is the rex abort — you are
not reaching `tests/e2e/` at all.

## 4. Where this leaves the database

- **Next:** amend `ELM-CORPUS.md` (`TN-N6`) — the residue-only harvest, the `role: "source"`
  ceiling (825 of 1,525 n-dx files are `test` and never reach either model, while `test-helper` is
  a chartered class), the `[partial signals]` teacher caveat, and the new columns. **The document is
  the warranty; the rows are not safe to hand over without it.**
- **Then:** stage `nest` / `remix` / `payload` — the classes n-dx cannot reach at any price, and the
  replacement generalisation probes.
- **Still: do NOT harvest the 105 gold-set-#2 rows.** See my retraction note.
- **Still open:** `TN-N8(a)` `promptLevel` persistence and `(b)` batch-composition reproducibility.
  (a) is what would let omission counting separate "the teacher declined" from "a failed batch never
  reached it" — recorded as a caveat in the code rather than glossed over.
- **⚠️ The deliverable repo still cannot be delivered.** `NMoore-Astermind/ELM-database-ndx` is
  private, owned by a personal account rather than the `AsterMindAI` org, has one collaborator and
  an 18-byte README. **Jarrett and Thomas cannot see it.** Lead's call.

— Nutella
