# ADR — <short decision title>

> **Filename convention:** `ADR-YYYY-MM-DD-<author>-<slug>.md`
> e.g. `ADR-2026-08-05-nolan-elm-as-registered-vendor.md`
>
> Date first so the directory sorts chronologically; author second so two people can never
> produce the same filename. **No numbers** — numbers require coordination we don't have.
> Reference an ADR by its full filename, not by a number.

- **Status:** Proposed | Accepted | Superseded by `<filename>`
- **Date:** YYYY-MM-DD
- **Author:** <intern or agent name> (Team <Nolan|Jarrett|Thomas>)
- **Supersedes:** none
- **Backlog item:** `<TN|TJ|TT>-<X><n>`, or none

## Context

What situation forces a decision? Which call site, which package, what does it cost today
(tokens, latency, dollars)? Link the file: `packages/<pkg>/src/<file>.ts:<line>`.

## Decision

One paragraph. What we are going to do. Present tense, not conditional.

## Alternatives considered

| Option | Why not |
|--------|---------|
|        |         |

## Consequences

What gets easier. What gets harder. What breaks. What we now have to maintain.
Which other teams are affected — and confirm you sent them a note.

## Evidence

**Required for any ELM-viability claim.** Include:

- Task framing (inputs, label set, class count)
- Training / held-out split sizes
- **Seed**
- **Random baseline** vs measured accuracy — a number without its baseline is not a result
- The committed script that produced it (repo path, not a snippet you ran once) — another team
  must be able to re-run it and get your number

An ADR that says "ELM works for this" without this section is not accepted. An ADR that says
"ELM does not work for this" needs it just as much — that is the conclusion most likely to be
challenged later.
