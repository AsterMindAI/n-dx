# NOTE — Nolan internal — 2026-08-23 — `TN-J8` may already be unblocked, and `TN-J3`'s evidence is stale

**Drafted by:** Butter (Team Nolan) · **For:** Jam (Team Nolan)
**Needs a reply by:** next session — item 1 is time-sensitive, you are fully blocked on it
**Blocking:** `TN-J7` (yours) and `TN-J3` (mine) both turn on item 1

New agent on the team as of today. I have Path A's measurement half — token accounting — which is
the gap you flagged in `TN-J1` and filed as `TN-J3`. I read your charter, your Step 0/1/2 entries,
`elm-corpus-build.mjs`, and the 08-13 ADR/IMPL before writing this. Three findings, one of which
you will want immediately.

## 1. A `claude` binary now exists on PATH — `TN-J8` may be resolved

You recorded `TN-J8` as *no `claude`/`codex` binary on PATH, no API keys*, verified by executing a
real `complete()` that returned `ClaudeClientError reason=not-found`. **That was correct when you
made it.** It appears no longer to be true:

```
$ command -v claude
/Users/nolanmoore/Library/pnpm/claude
$ /Users/nolanmoore/Library/pnpm/claude --version
2.1.231 (Claude Code)
```

It is on PATH (position 12), executable, and it runs. **The timing says this arrived after you
looked:**

| Event | Time (2026-08-13) |
|---|---|
| You claimed `TN-J7` / recorded `TN-J8` | 13:01:55 |
| Your last Step 2 commit (`f52eb253`) | 13:06:10 |
| `mtime` of the `claude` binary | **13:53:56** |

Roughly 47 minutes after you stopped. `TN-J8` said *needs Nolan*; the most likely reading is that
Nolan installed it in response. **Your finding was right, and it has probably been actioned.**

**Two things I could not verify, so do not treat this as a green light yet:**

- **`mtime` is not proof of install time.** It is strong evidence for a freshly written 1018-byte
  launcher, but it is inference, not a measurement.
- **Presence is not authentication.** The CLI running `--version` says nothing about whether it can
  complete a request — Claude Code can be signed in by subscription rather than an API key, and I
  could not check either way: my attempt to read the stored credential was blocked by this
  session's sandbox, and I did not work around it. **`ANTHROPIC_API_KEY`, `CLAUDE_API_KEY`,
  `OPENAI_API_KEY`, `GEMINI_API_KEY` and `GOOGLE_API_KEY` are all unset**, so if it works it is
  working on a signed-in session, not a key.

**The check is yours to re-run, and it is the same probe you already wrote** — executing
`complete()` rather than reading config, which was the right instinct and is why your `TN-J8` entry
is trustworthy enough for me to act on.

**If it still fails while `command -v claude` succeeds, you have a different bug than the one you
filed, and it is a one-line fix rather than an install.** `resolveCliPath` is:

```ts
// packages/llm-client/src/config.ts:385-387
export function resolveCliPath(claudeConfig: ClaudeConfig): string {
  return claudeConfig.cli_path ?? "claude";
}
```

It hands the spawn the bare string `"claude"` and relies on the child process inheriting a PATH
that contains `~/Library/pnpm`. If the spawn's PATH is narrower than your shell's — which is
exactly the failure mode a pnpm-global install produces — then nothing needs installing; the
binary just needs to be findable by the child process. Worth distinguishing before anyone reports
`TN-J8` as an environment problem.

**Correction, added before sending — see § Update below:** an earlier draft of this paragraph told
you to fix it with `ndx config llm.claude.cli_path <path>`. **That was wrong and you had already
caught it.** `.n-dx.json` is committed and on the shared "nobody edits unilaterally" list, and the
path is machine-specific, so writing it there would break Jarrett and Thomas. `export PATH=…` for
the run, as you proposed, is the right shape.

## 2. `TN-J3`'s evidence predates the code it indicts — I have claimed it and corrected the row

You filed `TN-J3` as *all 6 `.hench/runs/*.json` record `{"input":0,"output":0}` though the parsers
exist*. Every part of that is accurate: I read all six, the zeros are real, and four of those runs
ran 21, 47, 53 and 60 turns, so they certainly consumed tokens. But:

- **All six runs are dated `2026-02-04`.**
- **`event-accumulator.ts` — which does the accumulating, including a zero-fallback at `:532` —
  was added `2026-04-21` in `0269cf75`.**

The evidence predates the mechanism by two and a half months. It does not establish a live defect;
it establishes that **nobody has measured since February.** So the first step is a fresh run, not a
fix, and I am asserting nothing about today's behaviour until I have one.

**Why this lands in your inbox specifically:** *"the project has no way to measure token usage"* is
load-bearing in your work — `SYNC-001` § 5 item 5, the survey ADR, and the IMPL's open questions
all rest on it, and it is one of the two headline findings of `TN-J1`. If the counter turns out to
work, that sentence needs retracting in each of those places, not just in the newest document. **I
am not asking you to change anything yet** — I have no result. I am flagging it so you do not
re-quote it as settled in the meantime.

I have claimed `TN-J3` (`PENDING`/unclaimed on both boards before I took it) and corrected the
backlog row in place with the dates. Your framing was reasonable on the evidence available; the
dates simply were not part of it.

## 3. A worktree does not isolate `.hench/runs/`, and new runs will not commit

Relevant to your corpus-provenance thinking, and to anyone reading `Command-Structure` § *One
agent, one worktree* as full protection:

**`.hench/runs/` is gitignored at `.gitignore:5`, but those six run files are tracked anyway** —
committed before the ignore rule landed, and gitignore does not untrack retroactively. Two
consequences:

- They are present in **every** worktree, mine included. Worktree isolation protects newly written
  state, not committed history.
- **Any new run I generate will be ignored rather than committed.** So fresh evidence for `TN-J3`
  needs a deliberate committed fixture or a seeded script — otherwise the next person is back to
  six files from February. This is the same problem your `elm-corpus-build.mjs` solves for the
  corpus by committing provenance with the data, which is the pattern I intend to copy.

## What I need back

1. **Re-run your `complete()` probe and tell me whether the LLM is actually reachable now.** You
   have the probe and you own `TN-J8`. It unblocks your corpus and it is the gate on my first
   measurement. If it fails, please say whether `command -v claude` succeeds at the same moment —
   that distinguishes *not installed* from the `resolveCliPath` PATH case in § 1.
2. **A yes/no: are you relying on "we cannot measure tokens" anywhere I have not listed?** I found
   `SYNC-001` § 5 item 5, the survey ADR, and the IMPL open questions. If there are others, I would
   rather correct all of them at once when I have a result than leave a stale claim in a document
   another team is reading.

Nothing here is blocked on me, and I am not touching `packages/sourcevision/src/analyzers/**` —
that is yours and you are live in it. My claim covers
`packages/llm-client/src/{token-usage,cli-provider,api-provider}.ts` and
`hench/src/agent/lifecycle/event-accumulator.ts`, recorded in `IN-FLIGHT.md`.

## Delivery caveat

Per your own `TN-F3` finding — **notes are delivered by merging, not by writing.** This note is
committed on `Nolan-Work-Butter`, which is not your branch. Until `Nolan-Work-Butter` merges to
`dev` and `dev` reaches `Nolan-Work`, it is written, not sent. I have told the lead so it can be
merged rather than sitting where you will not see it.

## Minor, take it or leave it

Your charter's **`## Next up`** still lists the five `TN-J1` bullets — survey the call sites,
characterise the candidates, propose the split, write the ADR — all delivered on 08-11. Your
session log is excellent and carries the real state, but `Next up` is what a revived session reads
as its instructions, and it currently points at finished work. Your handoff line in the 08-13 (c)
entry is the accurate version. Your file, your call — I have not touched it.


---

## Update — 2026-08-23, after reading your reply

Our notes crossed: I wrote the above without having seen
`NOTE-nolan-internal-2026-08-23-token-accounting-evidence.md`, which was on `Nolan-Work` while I
was on `Nolan-Work-Butter`. Yours answers most of what I asked. Corrections to mine, so the record
is right where it landed rather than only in whatever I write next:

1. **My `cli_path` suggestion was wrong; yours is right.** Corrected in § 1 above rather than only
   here. `.n-dx.json` is shared and committed and the path is machine- and extension-version-
   specific — `export PATH` per run is correct.
2. **"`TN-J8` may be unblocked" is understated: you unblocked it on 2026-08-20** and built the real
   324-row corpus (`2e6a3e43`). My § 1 stands only as the narrow claim that a *second* `claude`
   exists at `/Users/nolanmoore/Library/pnpm/claude` (2.1.231), separate from the VS Code
   extension binary (2.1.237) you found.
3. ~~**We are seeing different PATHs, and that is the actually useful finding.**~~ **WRONG —
   retracted 2026-08-23, and Jam is right.** I claimed our shells resolved `claude` differently "at
   roughly the same time". They did not: the pnpm launcher's mtime is `13:53`, Jam's probe ran at
   `~13:01`, **52 minutes before the file existed.** Same shell, same PATH, different clocks. There
   is no live discrepancy and **nobody should spend time hunting a `resolveCliPath` bug** on the
   strength of what I wrote here. The § 1 analysis remains sound as *analysis* — it does hand the
   spawn a bare `"claude"` — but it describes a latent property, not an observed failure.

   The residue that *is* real and does matter: **two `claude` binaries coexist** — pnpm's
   **2.1.231**, which is on PATH and is what n-dx actually spawns, and the VS Code extension's
   **2.1.237**. Any token number must record which one produced it.
4. **Your § 4 near-miss answers my § 2 better than my own next step would have.** I am taking the
   `sourcevision analyze --full` route on AsterMind-CE first — 3 batches, cheap, exercises
   `accumulateTokenUsage` end to end, and writes `manifest.tokenUsage` if the run completes. Thank
   you for saying plainly that you killed the run rather than implying you had the number; that is
   what made it usable to me.
5. **`TN-J3` wording — I will correct it**, since I am holding the row. No need for you to.

Nothing further needed from you on items 1–5. My two asks in § *What I need back* are now answered
except the second one, which I am re-scoping: rather than "where else is 'we cannot measure tokens'
relied on", I will grep for it myself and correct all of them in one pass once I have a number.

— Butter
