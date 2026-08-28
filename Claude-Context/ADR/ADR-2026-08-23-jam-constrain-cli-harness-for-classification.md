# ADR — 2026-08-23 — Constrain the agent harness on classification calls, before building the ELM

**Status:** **Closed — not pursued.** Butter measured `num_turns = 1` on a real classify call, so
there is no agent loop to remove; the overhead is the CLI loading its own harness per invocation,
inherent to using the CLI as a completion backend. Rescoped as a **provisioning** question (use an
API key), not engineering. The one consequence that survives and still binds every published figure:
**an avoided call is worth ~53k–268k tokens on the CLI but only ~2.7k–13.7k on the API — ~20x.**
**Author:** Jam (Team Nolan) · **Backlog:** `TN-J17` (Path B side of Butter's `TN-B2`)
**Supersedes:** nothing. **Amends:** the sequencing assumed by
[`ADR-2026-08-13-jam-proceed-with-elm-classification.md`](ADR-2026-08-13-jam-proceed-with-elm-classification.md).

> **Read this first if you are short on time:** I am proposing something that **reduces the measured
> value of my own path.** If this lands, Path B's prize shrinks by roughly an order of magnitude,
> because most of what an avoided classify call currently costs is not classification. I think it
> should land anyway, and I think it should land *first*.

## Context

### What Butter measured

Three real classify prompts (30 files each, AsterMind-CE, seed 42, CLI 2.1.231) — `A4`, recorded in
[`NOTE-…-a4-classify-call-cost.md`](../Nolan-Agents/Notes/NOTE-nolan-internal-2026-08-23-a4-classify-call-cost.md):

| | input | output | cache-create | cache-read | **total** | wall |
|---|---|---|---|---|---|---|
| Call 1 | 12 | 11,145 | 59,122 | 197,673 | **267,952** | 111.9 s |
| Call 2 | 2 | 7,326 | 23,976 | 22,249 | **53,553** | 74.4 s |
| Call 3 | 4 | 2,890 | 25,112 | 68,225 | **96,231** | 25.6 s |

**Prompt and completion together are 5.12% of a classify call.** A ~1,000-token prompt is reported
as `input_tokens` of 2, 4, and 12. The rest is cache-creation and cache-read.

### What I verified structurally

Butter offered this as a hypothesis and was explicit that they had not confirmed it. Reading the
code confirms the mechanism, and it is worse than the hypothesis stated:

1. **`spawnOnce` (`packages/llm-client/src/cli-provider.ts:118-129`) invokes the full Claude Code
   agent CLI with no constraints:**
   ```
   claude -p - --output-format json --model <model> [request.cliFlags]
   ```
   There is no system-prompt override, no tool restriction, and no MCP restriction.
2. **`request.cliFlags` is plumbed but nothing sets it.** It exists on the public
   `CompletionRequest` (`types.ts:76`); a repo-wide search finds only the two provider
   implementations reading it and no call site writing it.
3. **Three MCP servers are currently connected** on this machine (Google Drive, Calendar, Gmail).
   Their tool definitions are established per spawn — **for a task that needs zero tools.**
4. The CLI's own timeout comment (`cli-provider.ts:150-161`) records "time-to-first-token alone can
   be 30–120s", consistent with a large context being established before generation begins.

**So each of the 9 classify calls in an n-dx analyze pays to stand up an agent harness — system
prompt, tool definitions, MCP tool schemas, project instructions — in order to label 30 filenames.**

### What is still unverified

- **Agentic turns.** `num_turns` is in the envelope and neither Butter's baseline script nor
  `llm-client` records it. Outputs of 2,890–11,145 tokens for ~900 tokens of expected JSON are
  suggestive, not conclusive.
- **The counterfactual.** Nobody has run the identical prompt with constraining flags, so the
  saving is projected, not measured. That is Step 1 of the IMPL, not a claim of this ADR.

## Decision

**Pass constraining `cliFlags` on sourcevision's classification calls, and re-baseline Path B
against the result before building the ELM tier.**

Concretely: `callClaude` (`packages/sourcevision/src/analyzers/claude-client.ts:145-149`) passes a
flag set that strips the harness down to a single-shot completion — no MCP servers, no tools, a
minimal system prompt. **The exact flag set is an IMPL question and must be verified per CLI
version**, but 2.1.231 offers `--strict-mcp-config`, `--system-prompt`,
`--exclude-dynamic-system-prompt-sections`, `--disallowedTools`, and `--no-session-persistence`.
(Note `--max-turns` is *not* available in 2.1.231 print mode, so the agentic-turns half may not be
fully closable by flags alone.)

**This changes no file outside `packages/sourcevision/src/analyzers/`.**

## Why this ordering, given it hurts Path B

Path B's value is `calls avoided × cost per call`. `TN-B2` attacks the second factor; Path B attacks
the first. **They are substitutive, and whichever lands first collects the benefit.** Three reasons
to take the harness first anyway:

1. **It is unconditional.** It helps every classify call, and also every *zone enrichment* call —
   which Path B can never touch, because those generate prose. The enrichment side is 2 calls per
   pass on n-dx and was 6 of the 9 on AsterMind-CE. An ELM reaches none of them; this reaches all
   of them.
2. **It is small and reversible.** One call site, one array of flags, no new dependency, no model,
   no training data, no accuracy risk to reason about beyond "did the labels change".
3. **Building the ELM first would bake in a false baseline.** If we measure the ELM's saving against
   today's 53k–268k per call and *then* fix the harness, the published figure is retroactively wrong
   by an order of magnitude. We have already had to retract two numbers this week; this one is
   foreseeable.

**Honest statement of the consequence:** if the harness is ~95% of a classify call and constraining
it recovers most of that, then an avoided call becomes worth roughly 3k–13k tokens instead of
53k–268k. Path B's kill criterion (`≥30% of the residue at or above LLM accuracy`) does not change,
but the **prize it is competing for shrinks by about an order of magnitude**, and the leads may
reasonably conclude Path B is no longer worth building. **That is a legitimate outcome and this ADR
does not try to prevent it.**

## Alternatives considered

**A. Swap the classify call site to `api-provider`.** Butter's original suggestion. Rejected as the
*first* move: it needs an API key (none on this machine, so it cannot even be measured today), it
introduces a second billing path and auth story, and it is a larger blast radius in *Butter's*
files. It remains the right answer if flags prove insufficient — in particular if `num_turns > 1`
and 2.1.231 offers no way to cap turns in print mode.

**B. Build the ELM first, fix the harness later.** Rejected: see reason 3 above. It also spends the
expensive work before the cheap work.

**C. Do nothing; treat the overhead as fixed cost.** Rejected. It is not fixed — it is a default we
never overrode. Leaving it means every user of `ndx analyze` pays for a Gmail tool schema to
classify their source files.

**D. Fix it inside `cli-provider.ts` so every caller benefits.** Tempting and probably correct
*eventually*, but it is Butter's claimed file, it changes behaviour for every call site including
hench's agent loops (which genuinely need tools), and a global default is the wrong shape for a
per-call-site concern. Raise it with Butter after the per-call-site version is measured.

## Consequences

- Path B's published prize must be **re-baselined** after this lands. `TN-J11`'s calls-avoided
  figures are unaffected (they count calls, not tokens — which is exactly why Butter's ADR chose
  that unit, and this is the second time that choice has protected us).
- `TN-J12` (what we publish) gains yet another axis: pre- or post-harness-fix.
- If flags materially change classification output, that is a **finding, not a failure** — it would
  mean the harness was contributing to label quality, which we should know before an ELM tries to
  match it. The IMPL verifies labels against the existing 324-row corpus for exactly this reason.

## Kill criterion

If constraining the harness recovers **less than 25%** of the per-call token cost measured by `A4`,
this is not the lever it appears to be: revert the flags, publish the negative, and hand `TN-B2`
back to the provider-swap route (Alternative A).

## Open questions for the leads

1. **Does this outrank Path B?** If constraining the harness captures most of the available saving,
   Step 3 of `TN-J4` may not be worth building at all. That is your call, and I would rather raise
   it than discover it after the ELM exists.
2. **Should the flags eventually move into `cli-provider.ts` as a "completion mode"?** That crosses
   into Butter's files and affects hench, so it needs a decision, not a patch.
3. **Is the connected-MCP-server surface a per-developer accident or a shipped default?** The three
   servers here are personal (Gmail, Drive, Calendar). If a user has none, their overhead differs —
   which would make our measurements machine-specific and not publishable as-is.
