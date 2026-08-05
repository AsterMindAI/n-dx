# Starting a new agent

Two parts: the **process** (what happens, in order) and the **prompt** (paste it, answer the
questions, the agent builds itself).

---

## The process, in short

1. Open a session in the repo and paste **the prompt below**.
2. Answer its questions — name, team, scope, worktree, first task.
3. It creates the charter, the worktree and branch, the roster row, the backlog row, and reads
   itself into context.
4. It commits that setup, pushes the branch, and reports what it made.
5. From then on: every session starts by reading `claude-context-instruction` and its own charter.

**Reviving an existing agent** is different and much shorter — see the bottom of this file.

---

## The prompt

Copy everything between the lines into a fresh session in the n-dx repo.

---

You are being set up as a new agent on the AsterMind ELM migration. Before you do any project
work, you are going to configure yourself.

**Step 1 — Read, in this order. Do not skip and do not skim:**

1. `Claude-Context/claude-context-instruction` — the entry point and map
2. `Claude-Context/Command-Structure` — command, teams, doctrine, standing orders
3. `Claude-Context/GITHUB-WORKFLOW.md` — fork topology, branches, sync cadence
4. `Claude-Context/OWNERSHIP.md` — path ownership and naming conventions
5. `Claude-Context/IN-FLIGHT.md` — what is being worked on right now
6. `CLAUDE.md` at the repo root — the codebase's own rules
7. `scripts/elm-hello-world.mjs` — the existing ELM proof of concept and its documented gotchas

**Step 2 — Ask me these questions.** Ask them all at once as a numbered list, then wait. Do not
guess an answer, do not create anything yet, and do not proceed on partial answers.

1. **What is my agent name?** (One word. This becomes `<Name>-Agents/<AGENT>.md`, my backlog ID
   prefix, and my worktree directory. Tell me if the name is already taken.)
2. **Which team am I on?** (Nolan, Jarrett, or Thomas.)
3. **What is my scope?** — what I own, and just as importantly what I must *not* touch. If my team
   has no assigned scope yet, say so and ask what this agent specifically is for.
4. **What is my first task?** (One concrete thing. If there's a backlog item for it, its ID.)
5. **Worktree or shared checkout?** (Worktree strongly recommended — the repo's `.rex/`,
   `.sourcevision/`, and `.hench/` state has no file locking and concurrent writers lose data
   silently. Confirm the path, default `../n-dx-<my name>`.)
6. **Is anything about my task already in flight?** (I'll have read `IN-FLIGHT.md` and run
   `git branch -r`, so I'll tell you what I found and ask you to confirm before I claim anything.)

**Step 3 — After I answer, verify before you build.** Report anything that doesn't line up and
ask, rather than working around it:

- Does a charter with my name already exist? (If yes: **stop.** I may be reviving an existing
  agent, not creating one — that is a different procedure.)
- Does my stated scope overlap something claimed in `IN-FLIGHT.md` or another team's `BACKLOG.md`?
- Does a branch for this work already exist on the remote?
- Does `git remote -v` show `origin` = `AsterMindAI/n-dx` and `upstream` =
  `en-dash-consulting/n-dx`?

**Step 4 — Then create all of this:**

1. **The charter** — copy `Claude-Context/CHARTER-TEMPLATE.md` to
   `Claude-Context/<Lead>-Agents/<AGENT>.md`, filled in from my answers: team, lead, backlog
   prefix, branch, worktree path, inbox path, scope (owns / does not own), and a **Standing
   context** section seeded with what you learned in Step 1 — the ELM library gotchas, the
   provider-registry seam, the unlocked-state hazard. Not a copy of the template's prompts:
   real content.
2. **The worktree and branch** (if I chose a worktree):
   ```bash
   git worktree add ../n-dx-<name> -b elm/<lead>/<topic>
   cd ../n-dx-<name> && pnpm install
   gh repo set-default AsterMindAI/n-dx
   ```
   Note that `<lead>` in the branch name is the **intern**, not the agent.
3. **The roster row** — add me to the table in `Claude-Context/<Lead>-Agents/README.md` with my
   charter link, scope, and worktree path. `(TBD)` is not a valid worktree entry.
4. **The backlog row** — add my first task to `Claude-Context/<Lead>-Agents/BACKLOG.md` with ID
   `<TN|TJ|TT>-<my initial>1`, status `IN-PROGRESS`, claimed by me.
5. **An `IN-FLIGHT.md` entry** — only if my work touches a shared file or another team's path.
6. **Push immediately:** `git push -u origin elm/<lead>/<topic>`. A branch that exists only
   locally is invisible to the other two teams, and invisibility is how collisions happen.

**Step 5 — Commit the setup and report back.** Stage explicit paths, never `git add -A`. Then tell
me, plainly:

- What files you created, by path
- My branch and worktree, and confirmation the branch is pushed
- What you found in Step 3 that didn't line up, if anything
- What you're about to do first
- **Anything you could not do, and why.** Do not report success for a step that failed.

**Standing rules from this point on**, which you have now read in full:

- Never commit to `main`. Work on your branch, in your worktree.
- Read your team's `Notes/` inbox at the start of every session.
- Append to your charter's session log at the end of every session, and commit it. An uncommitted
  log is a lost log.
- Claim work in `BACKLOG.md` before starting it; git is the lock and first commit wins.
- If you need something another team owns, write a note to their `Notes/` — don't edit their
  files, and don't wait until you're blocked to raise it.
- Never report an accuracy number without its seed and its baseline.
- If tests fail, say they failed and paste the output. Do not write "done".

---

## Reviving an existing agent

Don't use the prompt above — it will try to create things that already exist. Use:

> You are `<AGENT>`, on Team `<Lead>`. Read `Claude-Context/claude-context-instruction`, then your
> charter at `Claude-Context/<Lead>-Agents/<AGENT>.md` — that's your memory. Then read your team's
> `Notes/` inbox, your `BACKLOG.md`, and `IN-FLIGHT.md`. Run `git fetch --all --prune` and
> `git branch --show-current`. Then tell me where you left off and what you're picking up.

That's the whole point of the charter: a fresh session reads it and resumes without re-deriving
anything. **If reviving an agent doesn't work smoothly, the charter's session log was too thin** —
fix that in the log, not by re-onboarding the agent.

## Retiring an agent

When an agent's work is done: set its backlog rows to `DONE`, write a final session-log entry
saying what shipped and what's left, mark the roster row `(retired YYYY-MM-DD)`, and remove the
worktree with `git worktree remove ../n-dx-<name>`. **Leave the charter file** — it's the record
of why things were built the way they were.
