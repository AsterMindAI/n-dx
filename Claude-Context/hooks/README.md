# Claude-Context/hooks

Scripts here are **artifacts, not wiring.** Nothing in this repository executes them.

## The rule: never commit the wiring

Wire a hook up in **`.claude/settings.local.json`**, which is gitignored
(`.gitignore` lines 28 and 36). **Never** in `.claude/settings.json`, which is committed.

`AsterMindAI/n-dx` is a **public** fork of a **public** repo — 9 forks and 16 stars as of
2026-08-11 — and n-dx is a published npm package, so this repository is the product's home. A hook
in the committed `settings.json` executes on the machine of **anyone** who clones the repo and
opens it in Claude Code. Someone fixing a typo in a README would silently run our script.

Note what the risk is and is not:

- **Not disclosure.** `Claude-Context/` is already committed to a public repo. Every charter, ADR,
  note, and backlog in it is world-readable right now. A hook reveals nothing new.
- **It is execution.** Arbitrary shell running on a stranger's machine because they cloned a
  repo is a different and much worse category, and it is the one thing that must not happen here.

Decided by Nolan, 2026-08-11. The cost of the rule is that each intern wires hooks up once per
machine, and a new machine does not inherit them. That is the intended trade.

## Scripts

| Script | What it does |
|---|---|
| [`unread-notes.sh`](unread-notes.sh) | Prints unread notes from your team's `Notes/` inbox into session context at session start, then marks them read. |

### `unread-notes.sh`

```bash
bash Claude-Context/hooks/unread-notes.sh              # print unread, mark read
bash Claude-Context/hooks/unread-notes.sh --list       # print unread, do NOT mark read
bash Claude-Context/hooks/unread-notes.sh --mark-read  # mark all read, print nothing
```

Team defaults to Nolan; override with `NDX_TEAM=Jarrett` or `NDX_TEAM=Thomas`.

To wire it up, add this to your **`.claude/settings.local.json`** (create the file if it doesn't
exist — it is already gitignored), replacing the path with your own absolute path:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash /ABSOLUTE/PATH/TO/n-dx/Claude-Context/hooks/unread-notes.sh",
            "timeout": 10,
            "statusMessage": "Checking team inbox…"
          }
        ]
      }
    ]
  }
}
```

An absolute path is correct here precisely *because* the file is machine-local.

After creating the file, open `/hooks` once or restart Claude Code — the settings watcher only
watches directories that already had a settings file when the session started, so a newly created
`settings.local.json` is not picked up mid-session.

**What it deliberately does not do:**

- **No network.** It never runs `git fetch`. A note is visible only if it is on the branch you have
  checked out, so **the merge discipline is what delivers a note** — `<TeamBranch>` → `dev` → your
  branch. This script reports what has arrived; it does not make anything arrive. A hook without
  that discipline prints nothing, because there is nothing on your branch to print.
- **No noise.** Silent when there is nothing unread, which is the normal case.
- **No failure modes that cost you a session.** It always exits 0. Verified against a missing team
  directory, a non-existent team name, and being run from outside the repository.

Read state lives in the git directory (`git rev-parse --git-common-dir`), which is never tracked
and never shipped — so it needs no `.gitignore` entry and cannot be committed by accident.
