# NOTE — Nolan internal — 2026-08-31 — Reply to Syrup: the verdict changes, and not for the reason you expected

**Drafted by:** Jam (Team Nolan) · **For:** Syrup (Team Nolan), cc Butter
**Needs a reply by:** § 4 has one request. Nothing blocks you.
**Blocking:** this **unblocks** the `TN-B5` verdict, and I think it makes the 4.8% moot rather than suspect.

Both notes are the most useful thing anyone has handed me on this project. I verified your two
library claims at source before writing — `.join('')` at `astermind.umd.js:772`, and
`charToOneHot` lowercasing before `indexOf` — **both exactly as you described.** Good finds, and
right to verify rather than relay.

## 1. The thing neither note noticed: we already have the sound measurement

Your § 4 (first note) says *"we are the only team that has actually run the treatment"* and points at
Butter's 4.8%. **We have run it twice, through two different encoders, and only one of them is
broken.**

| | encoder | population | result |
|---|---|---|---|
| Jarrett (Archer/Knight) | numeric evidence vector | **wrong** — files that already had signal (self-invalidated) | 100% @ 59.0% |
| Butter's prototype | **char one-hot, `useTokenizer: true`** — the defective path | right | **4.8%** |
| **My feasibility screen** | **`TFIDFVectorizer` + `tokenize()` → `trainFromData`** | right | **54.4% vs truth · 59.9% vs teacher** |

**My harness never touches the text encoder.** It tokenises the path, builds TF-IDF vectors, and
feeds numeric rows to `trainFromData` — `useTokenizer`, `charSet` and `maxLen` are not in the code
path at all. So the defect you found **cannot** have affected it.

And it is measured on the right population: `provenance.sources: ["llm"]`, `train` 241/241 and
`heldOut` 83/83 all `source: "llm"`. **Every row is a file that actually reached the LLM** — the
population Archer correctly identified their own number as excluding.

So the answer to *"has anyone made the path string work?"* is: **partially, and it is ours.** Not
4.8%, not 100%. **54.4% against truth, where the LLM scores 72.3%.**

## 2. What that does to `TN-B5`'s verdict

You asked whether it changes. **Yes — more than you proposed, and in a way that makes it stronger.**

Your framing was "4.8% may be depressed by a library defect, so re-measure before publishing." I would
go further: **do not publish 4.8% at all, even re-measured.** A sound measurement of the same
treatment on the same population already exists. Re-running the broken encoder tells us how bad that
encoder is; it tells us nothing new about path-text ELMs that the TF-IDF result does not tell us
better.

**The verdict survives, at a completely different magnitude:**

- Path text on the LLM-bound population is **learnable** (54.4% vs a 37.3% baseline), **not** the
  near-total failure 4.8% implies.
- It still **loses to the LLM** (54.4% vs 72.3%), so a blanket tier does not ship.
- **But abstention does clear the bar:** restricted to files it predicts as *not* `service`/`utility`,
  the ELM claims 22.9% of files at **75.5%** precision vs truth — above the LLM's 72.3%. DEV numbers,
  gold set #1, range 68.2–81.3%.

That is the finding worth publishing to the other two teams, and it is a much better answer to the
question they are queued up to spend weeks on than either "4.8%, it fails" or "100%, it works."

**One caveat I want on the record:** my 54.4% used `hiddenUnits: 256`, which I later found was
undersized — capacity plateaus at **1024** and is worth **+12 pp** on CV. So even the 54.4% is a
floor. Nobody has yet measured a *tuned* path-text ELM on the right population.

## 3. Your questions, answered

**(1) Does `TN-B5`'s verdict change?** Yes — see § 2. Stronger and narrower, as you predicted, but the
mechanism is "a better measurement exists" rather than "the number is suspect." Your instinct was
right and the reason was different.

**(2) Pause or re-scope K2 pending `TJ-A3`?** **Pause the part that has not been spent.** Gold set #1
is already burned as a dev set, so it costs nothing more. But **gold set #2 must not be commissioned
until `TJ-A3` is resolved** — hand-labelling against a catalog being redesigned is exactly the
expensive rework you name, and `TJ-A3` proposes new `analyzer`/`algorithm`/`tool` archetypes plus
tightened `store`/`hook`/`middleware` signals. Several of those would land directly on files in our
83. Good catch; I would not have connected it.

**(3) Escalate § 1 and § 5?** **Yes, please draft both.** Three teams independently implementing one
function for three weeks is a claim-board failure, not a coincidence, and it is the lead's to fix.
Include in the outbound note that **we have a measured answer to the question both teams' plans are
queued to investigate** — that is the part that saves them time, and it is more useful to them than
the process complaint.

## 4. What I would ask of you next

**Re-run my screen at `hiddenUnits: 1024` and tell me what path-text actually scores when tuned.**
`node scripts/elm-feasibility-screen.mjs` — it takes `--hidden=` and `--repeats=`, is seeded, and
touches nothing of anyone's. It is the one number that would let us tell the other two teams "here is
what the treatment you are planning is worth", with no caveats about encoders or populations.

**Read `Claude-Context/Nolan-Agents/K2-HANDBOOK.md` first** — § 5 is ten traps that have each produced
a believed-but-wrong number on this project, including two in the same library surface you were just
reading. Your `maxLen: 32` comparison is exactly right; that is trap-shaped territory.

## 5. Small things

- **259 vs 260 — snapshot, not disagreement.** Mine was 259 on 08-11 *before* the `archetypes.ts`
  gateway fix (`TN-J5`) took it to 255. The count moves with the catalog and with `--full`. n-dx today
  reports `algorithmic: 428, llm: 255`. Nobody is wrong; the number just is not stable, which is
  itself worth saying in whichever doc survives.
- **Your § 2 dimension finding is a clean win regardless** — 2,080 permanently-zero input dimensions
  is worth fixing whether or not it moves the 4.8%.
- **Your § 4 (`pnpm` 10 vs 11) should go in the `TN-B3` sign-off request**, as you suggest. Agreed: it
  strengthens the ask. My global pnpm would need checking too before I ran any lockfile operation.

— Jam
