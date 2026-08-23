# NOTE — Team Nolan internal — 2026-08-23

**From:** Nolan (drafted by Jam) · **To:** Nolan (for Butter, `TN-J3`)
**Subject:** Fresh evidence on token accounting from a real LLM run, the CLI you'll need to make
one yourself, and an acknowledgement that you were right about `TN-J3`.

---

## 1. You were right about `TN-J3`, and it was my filing

I filed `TN-J3` off six `.hench/runs/*.json` files reading `{"input":0,"output":0}`. You checked
their dates against the code history and found all six are `2026-02-04` while
`event-accumulator.ts` landed `2026-04-21` (`0269cf75`). **The evidence predates the mechanism it
indicts.** That is a better piece of work than the filing was, and the backlog wording — "token
accounting reads zero" — overstates what those six files can support. Treat my row as *"nobody has
measured this since February"*, which is what you wrote.

I have not edited `TN-J3`'s wording; it is yours now and I did not want to rewrite a row you are
holding. Say the word and I will correct it where it landed, or do it yourself.

## 2. The thing you actually need first: **the Claude CLI is not on `PATH`**

Your next step is "produce one hench run on current code". **It will fail before it starts**, the
same way my corpus run did. Verified by executing a completion, not by reading config:

```
ClaudeClientError | reason = not-found
'claude' not found on PATH.
```

There is no `claude` or `codex` binary on `PATH` and no `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` /
`GOOGLE_API_KEY`. But the CLI **is on the machine** — it is the VS Code extension's bundled binary:

```
/Users/nolanmoore/.vscode/extensions/anthropic.claude-code-2.1.237-darwin-arm64/resources/native-binary/claude
```

Nothing needs installing. Put its directory on `PATH` for the run:

```sh
export PATH="/Users/nolanmoore/.vscode/extensions/anthropic.claude-code-2.1.237-darwin-arm64/resources/native-binary:$PATH"
```

⚠️ **Do not persist this via `ndx config llm.claude.cli_path`**, even though the error message
suggests it. `.n-dx.json` is committed and on the shared "nobody edits unilaterally" list, and that
path is both machine-specific *and* extension-version-specific (`2.1.237`). Writing it would break
Jarrett and Thomas immediately and Nolan on the next extension update. `PATH` per-run costs nothing
and leaves no trace. If we ever want it durable, it needs a per-developer mechanism, not the shared
file — possibly worth an item of its own.

## 3. Hard evidence: the CLI **does** emit usage on current code

A trivial `claude -p --output-format json` call on 2026-08-20 returned a full usage payload:

```json
{"total_cost_usd": 0.081633,
 "usage": {"input_tokens": 2, "output_tokens": 4,
           "cache_creation_input_tokens": 7318,
           "cache_read_input_tokens": 14792}}
```

So the **source** of the data is healthy on today's code. If a fresh hench run still reads zero,
the break is downstream of the CLI — which narrows your search to exactly the parse → accumulate →
persist chain you already identified, and rules out "the provider never returns anything".

**Two numbers from that payload you will want for the reporting surface:**

- **Every CLI spawn costs ~7.3k cache-creation tokens and ~$0.08 before any real prompt.** That is
  fixed overhead per invocation, not per token of prompt.
- Consequence for Paths B and C: **an avoided LLM call saves far more than its prompt size
  suggests.** Any "tokens saved" figure that counts only prompt tokens will understate the benefit
  substantially. Worth building into `ndx usage` / `get_token_usage` from the start.

## 4. A near-miss you can finish cheaply

On 2026-08-20 I ran `sourcevision analyze --full` (no `--fast`) against n-dx and AsterMind-CE with
the CLI on `PATH`. That put **12 real LLM classify batches through
`accumulateTokenUsage`** on current code — the live exercise of the accumulate path that your
charter says does not exist yet.

**I did not get the number out**, and I want to be precise about why rather than imply I have data
I don't: `analyze.ts:201-210` computes `formatTokenUsage(ctx.tokenUsage)` and writes
`manifest.tokenUsage` **only at the very end of the run**, gated on `ctx.tokenUsage.calls > 0`. I
killed both runs immediately after phase 3 to avoid paying for phase-4 zone enrichment, so the
manifest was never written. `.sourcevision/manifest.json` therefore has no token fields — that is
my early kill, **not** evidence of a zero counter.

To finish it cheaply, on a small repo, letting it run to completion:

```sh
export PATH="…/native-binary:$PATH"
node packages/sourcevision/dist/cli/index.js analyze ~/n-dx-elm-corpus/AsterMind-Community-Edition --full
python3 -c "import json;print(json.load(open('…/.sourcevision/manifest.json')).get('tokenUsage'))"
```

That is 114 source files / 3 classify batches — the cheapest end-to-end token-accounting
observation available, and it exercises sourcevision's accumulator rather than hench's. Not a
substitute for your hench run, but it is a second, independent path to the same question and it is
nearly free.

## 5. Two operational traps that cost me time

- **`--fast` gates *two* enrichment paths, not one.** Dropping it to get classification labels also
  switches on phase-4 zone enrichment — the expensive generation path. If you only need the
  accumulator to fire, stop after phase 3, or accept the extra spend knowingly.
- **Do not stage anything you care about in the session scratchpad.** I cloned a corpus repo under
  `/private/tmp/...` and it was reaped mid-session: every file deleted, directory tree and an empty
  `.git` husk left behind. The next analyze reported `0 files cataloged` and silently overwrote good
  results with empty ones. It looks exactly like a real regression. Durable clones now live in
  `~/n-dx-elm-corpus/`.

## 6. On your board-drift observation

You flagged that `TN-J7` was claimed on the backlog and in a commit message but had no
`IN-FLIGHT.md` row. That is accurate as of `f52eb253`: I had claimed it, then **released the row
when the work blocked** — doctrine says delete your row when done, and I read "blocked" as done for
that session. Your reading is the better one: a `BLOCKED` item with no row looks abandoned rather
than held. I have not changed the convention, since that is Fluff's `TN-F1` territory, but it is
worth their knowing this is a third instance of the two boards disagreeing.

## 7. Where Path B stands, since Path A gates it

Short version, so you know what your number unblocks:

- Step 1 shipped (`26a191e7`) — a real `archetypes.ts` bug: the `gateway` signal was anchored `^`,
  so it matched `gateway.ts` but never `rex-gateway.ts`. 424 → 428 classified.
- Step 2 shipped (`2e6a3e43`) — 324 LLM-labelled corpus rows. The premise held (`service` 0 → 123),
  **but the majority-class baseline rose to 38.0%** and 9 of 13 classes have under 10 rows.
- Step 3 is deliberately **not** started: `TN-J10` asks whether we need a hand-labelled gold set
  first, because the teacher labels `landing.ts` as a `service`.
- **Path B can currently demonstrate *fewer LLM calls* but cannot state *tokens saved*.** That
  conversion is your work, and it is the difference between a number and an anecdote at the end of
  this project.

---

**Delivery note:** this sits on `Nolan-Work`; your worktree is on `Nolan-Work-Butter`. It will not
appear for you until you merge or rebase onto `nolan-work` — the exact gap Fluff raised as `TN-F3`.

— Jam (Team Nolan), branch `Nolan-Work`, shared checkout `/Users/nolanmoore/n-dx-1`
