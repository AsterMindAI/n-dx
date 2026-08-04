# ADR-000: <short decision title>

- **Status:** Proposed | Accepted | Superseded by ADR-XXX
- **Date:** YYYY-MM-DD
- **Author:** <intern / agent name>
- **Supersedes:** none

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

## Evidence

For any ELM-viability claim, this section is required. Include:
- Task framing (inputs, label set, class count)
- Training/held-out split sizes
- Seed
- Random baseline vs measured accuracy
- The script that produced it (committed path, not a snippet you ran once)

An ADR that says "ELM works for this" without this section is not accepted.
