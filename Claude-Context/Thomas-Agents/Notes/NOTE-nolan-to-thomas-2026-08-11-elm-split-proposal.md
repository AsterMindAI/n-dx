# NOTE — Nolan → Thomas — 2026-08-11

**Drafted by:** Jam (Team Nolan) · **Routes to:** Thomas, who routes it to their agents

> *Renamed 2026-08-11 from `NOTE-jam-to-thomas-…` by Fluff (Team Nolan), on the lead's
> instruction. Note filenames now address lead-to-lead, not agent-to-lead — see `Command-Structure`
> § Communication. **Only the filename and this header changed; Jam's content is untouched.***

**Subject:** A proposed three-way split of the ELM migration touches your team's scope. Please read
before claiming ELM work.

**Doc:** [`../../ADR/ADR-2026-08-11-jam-elm-replacement-survey-and-split.md`](../../ADR/ADR-2026-08-11-jam-elm-replacement-survey-and-split.md)
(Status: **Proposed** — this is not an assignment, scope is a three-lead decision)

## Why you're getting this

I surveyed every LLM call site in the monorepo under `TN-J1` and proposed splitting the work three
ways by merge surface. The proposal assigns one of three streams to each team, so it concerns you
whether or not you end up taking the one I sketched.

## The three headlines

1. **Only 2 of 22 LLM call sites are actually ELM-replaceable.** The other 20 generate prose (PRD
   trees, zone descriptions, findings) and stay on a hosted model. The two candidates are
   sourcevision archetype classification (`packages/sourcevision/src/analyzers/classify.ts:404`,
   17 classes) and rex granularity assessment (`packages/rex/src/analyze/reason.ts:1481`, 3
   classes).

2. **We cannot currently measure token usage.** All 6 stored runs in `.hench/runs/*.json` record
   `{"input": 0, "output": 0}`, and this checkout has no `.sourcevision` analysis artifacts. A
   project to minimize token spend has no baseline today. Recorded as a lead, not a root-caused
   finding — I did not chase it, it was outside my task.

3. **The hello-world proof does not transfer as-is.** It proved 3 classes against a 33% random
   baseline with 6 held-out samples. The real classification target is **17 classes, 5.9%
   baseline**. Please don't let anyone quote the 66% floor as evidence for the production task —
   it was written as a smoke test and says so.

## What I'd like from Team Thomas

- **A reaction to the split itself**, particularly whether the boundaries match how you want to
  work. It splits by package: `llm-client` / `sourcevision/analyzers` / `rex/analyze`, chosen so no
  two teams share a file.
- **Tell me if you're already in any of those paths.** `IN-FLIGHT.md` was completely unused when I
  started, so "the board is empty" is weak evidence that nothing is in flight.
- If your team takes the **`llm-client` / provider** stream, be aware it's the highest-leverage and
  least visible of the three: it owns registering ELM as a vendor at
  `packages/llm-client/src/provider-registry.ts:96`, and it owns fixing token accounting. If the
  counters stay at zero, none of us can report a result at the end of this project — only a vibe.
  It also owns the only shared file in the split, so the other two streams stay out of it.

## What I'm not asking for

Nothing is blocked on you. I'm not claiming any scope on your behalf, and I've claimed nothing
beyond `Claude-Context/Nolan-Agents/*` and the one ADR file
(see `IN-FLIGHT.md` § 1). I touched no source files.

## Follow-up, same day — read this instead if you only read one thing

The three-lead decision document is now written up as a cross-team sync:
[`../../Nolan-Agents/syncs/SYNC-001-2026-08-11-elm-path-assignment.md`](../../Nolan-Agents/syncs/SYNC-001-2026-08-11-elm-path-assignment.md)

It describes the three paths, asks whether Path B should be split, and lists the decisions the
three of you owe. It also carries an amendment to the ADR: **the provider seam is text-in/text-out**
(`types.ts:68-87`), so registering an ELM as a vendor would cost us the confidence score a fallback
threshold needs. There are two integration options and the choice touches standing doctrine — it is
in § 4 of the sync.

— Jam, Team Nolan (charter: `Claude-Context/Nolan-Agents/Jam.md`)
