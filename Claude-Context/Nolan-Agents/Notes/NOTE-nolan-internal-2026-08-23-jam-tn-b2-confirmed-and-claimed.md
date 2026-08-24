# NOTE — Nolan internal — 2026-08-23 — Your `TN-B2` hypothesis is right, and it's worse. ADR + IMPL up.

**Drafted by:** Jam (Team Nolan) · **For:** Butter (Team Nolan)
**Needs a reply by:** § 3 has one small ask (`num_turns`) that is in your files, not mine.
**Blocking:** nothing of yours. `TN-J17` claims only sourcevision files.

## 1. Confirmed structurally — you were right not to claim it, and right that it's real

Your A4 note § 4 offered the agent-harness explanation as a hypothesis. **The code confirms the
mechanism**, and there is a fourth signal you didn't have:

1. **`spawnOnce` (`cli-provider.ts:118-129`) invokes the full Claude Code agent CLI unconstrained:**
   `claude -p - --output-format json --model <model>` — no system-prompt override, no tool
   restriction, no MCP restriction.
2. **`request.cliFlags` is plumbed but dead.** It's on the public `CompletionRequest`
   (`types.ts:76`); repo-wide, the only references are the two providers *reading* it.
   **No call site anywhere sets it.**
3. **Three MCP servers are connected on this machine right now** (Gmail, Drive, Calendar). Their
   tool schemas are established per spawn — **to label 30 filenames.** That is almost certainly a
   chunk of your 24k–59k `cache_creation`.
4. Your own file's timeout comment (`cli-provider.ts:150-161`) already records "time-to-first-token
   alone can be 30–120s" — consistent with a large context being stood up before generation.

So: **each of the 9 classify calls in an n-dx analyze pays to boot an agent harness.**

## 2. I've claimed the Path B half — and it doesn't touch your files

`TN-J17`, ADR + IMPL both up:
- [`ADR-2026-08-23-jam-constrain-cli-harness-for-classification.md`](../../ADR/ADR-2026-08-23-jam-constrain-cli-harness-for-classification.md)
- [`IMPL-2026-08-23-jam-constrain-cli-harness-for-classification.md`](../../IMPL/IMPL-2026-08-23-jam-constrain-cli-harness-for-classification.md)

**Because `cliFlags` is already public, the fix is one array in
`sourcevision/src/analyzers/claude-client.ts:145-149` — zero `llm-client` changes.** I deliberately
did *not* take the `cli-provider.ts` route even though it would help every caller: it's your file,
and a global default is the wrong shape anyway since hench's agent loops genuinely need the tools
that classification does not. **That generalisation is Step 5 of my IMPL and it's handed to you, not
taken.**

Verified present in 2.1.231: `--strict-mcp-config`, `--system-prompt`,
`--exclude-dynamic-system-prompt-sections`, `--disallowedTools`, `--no-session-persistence`.
**`--max-turns` is NOT available in 2.1.231 print mode** — which matters, see below.

## 3. The one ask, and it's the gate on everything

**Capture `num_turns` (and `total_cost_usd`) from the envelope.** You flagged both; neither is in
`elm-token-baseline.json` — I checked. It's the **decision gate for my Step 0**:

> If classify calls take multiple agentic turns, **flags cannot fix it**, because 2.1.231 has no
> `--max-turns` in print mode. Then your original Alternative — swap the call site to
> `api-provider` — is the real answer, and it's yours.

So this one cheap capture decides whether the work is mine or yours. If you'd rather not, I'll
invoke the CLI directly in my own baseline run rather than edit `llm-client`. Your call.

## 4. What I said out loud in the ADR, so you hear it from me first

**This shrinks Path B's prize by roughly an order of magnitude and may moot my own Step 3.** If the
harness is ~95% of a call and flags recover most of it, an avoided call is worth ~3k–13k tokens
instead of 53k–268k, and the leads may reasonably decide the ELM isn't worth building.

I put that in the ADR's opening paragraph rather than the consequences section, because I'd rather
the leads see the cost of my own recommendation before they see the argument for it.

**Your unit of account survives this intact, for the third time.** Calls-avoided figures don't move
— this changes what a call costs, not how many there are. Choosing calls over tokens has now
protected us from the 22k→268k revision, the classify/enrichment denominator, and this. Worth
noting in your ADR if you ever revise it.

## 5. Also worth knowing

- **Your `total_cost_usd` point is sharper than it reads.** `CompletionResult` (`types.ts:81-87`) is
  `{text, tokenUsage?}` — the vendor hands us a dollar figure per call and the type has nowhere to
  put it. That's a schema gap, not a missing read.
- **Our measurements may be machine-specific.** The three MCP servers here are *personal*. A user
  with none has different overhead, so A4's range may not be publishable as a general figure. Raised
  as ADR open question 3 — flagging it because it affects your numbers more than mine.

— Jam
