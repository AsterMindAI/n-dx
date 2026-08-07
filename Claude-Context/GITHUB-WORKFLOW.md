# GitHub workflow

How this repo, this fork, and three people working at once fit together.

## 1. The topology

```
en-dash-consulting/n-dx        the parent repo.  remote name: upstream
        │  (fork)
        ▼
AsterMindAI/n-dx               our fork. THIS is where our work lands.  remote name: origin
        │  (clone + worktrees)
        ▼
../n-dx-<agent>                one worktree per agent, one branch each
```

Verify yours matches:

```bash
git remote -v
# origin    https://github.com/AsterMindAI/n-dx.git    (fetch/push)
# upstream  https://github.com/en-dash-consulting/n-dx.git (fetch/push)
```

If `upstream` is missing:

```bash
git remote add upstream https://github.com/en-dash-consulting/n-dx.git
```

### ⚠️ Set the default repo before you touch `gh`

`gh` currently has **no default repository configured** in this clone. That matters because when a
clone has two remotes, `gh pr create` will ask — or guess — and **the wrong answer opens a pull
request against `en-dash-consulting/n-dx`**, the parent repo, in public, from a work-in-progress
branch.

Run this once per clone and once per worktree:

```bash
gh repo set-default AsterMindAI/n-dx
```

Then confirm: `gh repo set-default --view` → `AsterMindAI/n-dx`.

**Our PRs target `AsterMindAI/n-dx`.** A PR to `upstream` is an outward-facing action and needs a
second lead's sign-off first — it is not something you do by reflex at the end of a task.

## 2. Where you work

**Always on a branch, always in your own worktree. Never on `main`, never in a shared checkout.**

```bash
# once per agent
git worktree add ../n-dx-<agent> -b elm/<name>/<topic>
cd ../n-dx-<agent>
pnpm install                      # a fresh worktree has no node_modules
gh repo set-default AsterMindAI/n-dx
```

Branch naming: `elm/<name>/<short-topic>` — e.g. `elm/nolan/provider-registry`.
`<name>` is the **intern**, not the agent, so branch ownership is readable at a glance.

**`main` is read-only to you.** You never commit to it, and you never need to — you pull it, you
branch off it, you PR into it. If you find yourself with commits on local `main`, stop and move
them:

```bash
git branch elm/<name>/<topic>     # mark where you are
git reset --hard origin/main      # put main back
git checkout elm/<name>/<topic>   # your commits are here
```

## 3. Sync cadence

Three different syncs, three different rhythms. They are not the same operation and conflating
them is how people end up rebasing onto the wrong thing.

| # | What | When | Command |
|---|---|---|---|
| 1 | **Fork's `main` ← `upstream/main`** | Start of each working day, and before starting any new branch | see below |
| 2 | **Your branch ← `origin/main`** | Daily, and always before opening a PR | see below |
| 3 | **Your worktree ← remote (just looking)** | Start of every session, and before claiming anything | `git fetch --all --prune` |

### 1. Pull the parent's changes into our fork

The parent repo moves independently of us. Let it drift for a week and you will be resolving a
week of other people's changes inside your feature branch.

**Our fork has already diverged from the parent, and that is correct.** As of 2026-08-05,
`origin/main` is 3 commits ahead of `upstream/main` (the ELM hello-world work, `43d6db51` and its
merges) and 1 behind. A fork that carries our work is the whole point; expect this number to grow.

**Look before you merge.** This tells you what you're about to combine:

```bash
git fetch --all --prune          # BOTH remotes — see the warning
git rev-list --left-right --count upstream/main...origin/main
#            ^ behind          ^ ahead
git log --oneline upstream/main..origin/main    # exactly what we have that they don't
```

> ⚠️ **`git fetch upstream` is not enough, and the failure is silent.** It refreshes `upstream/*`
> only, leaving your `origin/main` ref wherever it was the last time you fetched `origin`. Every
> comparison you then run — including the "do I recognise these commits?" check below — is made
> against a stale picture of the fork. It looks clean while another lead's commits sit unseen on
> the remote, and you find out at `git push`, after you have already merged.
>
> This is not hypothetical: it happened on 2026-08-05 and is documented in
> [`ADR-2026-08-05-nolan-single-fork-and-unified-agent-structure.md`](ADR/ADR-2026-08-05-nolan-single-fork-and-unified-agent-structure.md).
> **Always `git fetch --all`.**

Then merge — a merge commit here is correct, not a failure to keep history clean:

```bash
git checkout main
git merge upstream/main
git push origin main
```

**Read the "ahead" list before merging, every time.** It should contain only work we intended to
put on `main` — merged PRs, in other words. If you see a commit nobody recognises, or a direct
commit to `main` that never went through a PR, *that* is the signal worth stopping for. Someone
committed to `main` instead of a branch, and it is far easier to sort out now than after it is
buried under a merge.

> **Do not use `git merge --ff-only` here.** A fast-forward only works when our side has added
> nothing, which stopped being true at `43d6db51`. It will simply refuse. `--ff-only` is the right
> tool for a fork that is a pure mirror of its parent; ours is not one.

**Never rebase `main` onto `upstream/main`.** It would rewrite commits that are already published
in our fork and that everyone's branches are based on. Merge is the only correct operation on a
shared branch.

Do this **once, by one person, per day**, and say so in `IN-FLIGHT.md` § 2. Three people merging
the same thing is harmless but confusing.

Do this **once, by one person, per day**, and say so in `IN-FLIGHT.md` § 3. Three people
fast-forwarding the same branch is harmless but confusing.

### 2. Bring `main` into your branch

```bash
git fetch origin
git rebase origin/main            # if your branch is NOT pushed yet, or is yours alone
# — or —
git merge origin/main             # if others have pulled your branch
```

**Which one:** rebase keeps history linear and is right for private, unpushed work. The moment
another person has your branch, rebasing rewrites commits they already have — merge instead.

**Never force-push a branch someone else is working on.** For your own branch after a rebase, use
`git push --force-with-lease`, never bare `--force` — `--force-with-lease` refuses if someone
pushed something you haven't seen, which is exactly the accident you are trying to avoid.

### 3. Just look

```bash
git fetch --all --prune
git branch -r --sort=-committerdate | head -20     # what everyone is on
```

Run this at the start of every session, before you claim anything. It costs a second and it is the
cheapest possible way to discover that someone is already on your task.

## 4. The PR flow

```bash
# on your branch, from your worktree
pnpm typecheck && pnpm test          # before, not after
git push -u origin elm/<name>/<topic>
gh pr create --base main --title "..." --body "..."
```

Then:

1. **A second lead reviews.** We have three real GitHub accounts, so real cross-review works — see
   `Command-Structure` → *"Approve the PR" means validate it, then MERGE it*. Their review is the
   sign-off the collective-command rule requires.
2. **The reviewer merges.** There is no separate approve step, and no *approved, awaiting merge*
   state.
3. **Small and often beats big and late.** The architecture tests in `tests/e2e/` will reject a
   boundary violation — you want to learn that in hours, not at the end of a week-long branch.

```bash
gh pr merge <NUM> --squash --delete-branch
```

## 5. Two people working at once

Notes are async and the backlog is a lock, but neither tells you what someone is doing *right
now*. Layered, cheapest first:

**1. Push your branch on day one, before it's any good.** A branch that exists only on your laptop
is invisible. `git push -u origin elm/<name>/<topic>` immediately after creating it, then push WIP
commits freely. This is the single highest-value habit here — `git branch -r` becomes a live map
of who is working on what.

**2. Open a draft PR as soon as there's a diff worth seeing.**

```bash
gh pr create --draft --base main --title "WIP: <topic>" --body "Claiming <BACKLOG-ID>. Not ready."
```

A draft PR is the most visible "I am here" signal GitHub has: it shows the diff, it shows the
files, and it will tell you the moment someone else's PR touches the same lines.

**3. Claim in the backlog, and commit the claim.** `BACKLOG.md` for team work, `IN-FLIGHT.md` for
shared files and state-writing commands. **Git is the lock — first commit wins.** A claim you
haven't committed and pushed does not exist.

**4. Send the note before you start, not after you finish.** If you need something another team
owns, their `Notes/` inbox is the channel. A blocker raised after you're already blocked has
already cost you the day.

**5. When you collide anyway** — two people on the same file, discovered late:

- **Whoever pushed first keeps going.** The other rebases onto their work or picks up something
  else. This is arbitrary on purpose; arguing about it costs more than the rule does.
- **Say it in `IN-FLIGHT.md` § 4** so it's visible, then get on with it.
- **If both changes must land, the smaller one goes first** and the larger rebases. Merging a big
  refactor and then rebasing a one-liner onto it is strictly easier than the reverse.

### Two hazards specific to this repo

**`pnpm-lock.yaml`.** Conflicts brutally and is unmergeable by hand. Announce dependency additions
in `IN-FLIGHT.md` before running `pnpm add`. To resolve a conflict:

```bash
git checkout --theirs pnpm-lock.yaml   # or --ours; either, it gets regenerated
pnpm install                            # regenerates it correctly
git add pnpm-lock.yaml
```

**Untracked state.** `.rex/`, `.sourcevision/`, `.hench/` are not concurrency-safe and lose data
silently (root `CLAUDE.md`). Separate worktrees give each agent its own copy, which is the whole
fix. On a shared checkout, claim `ndx plan|work|ci|refresh|self-heal` and rex MCP writes in
`IN-FLIGHT.md` first. `ndx status` and `ndx usage` are read-only and always safe.

## 6. Daily rhythm

**Start of session:**
```bash
git fetch --all --prune
git branch -r --sort=-committerdate | head -20     # who's on what
git branch --show-current                          # where am I standing
git status
```
Then read your team's `Notes/`, your `BACKLOG.md`, and `IN-FLIGHT.md`.

**During:** commit early and in small steps, including WIP safety commits. Push them.

**End of session:**
```bash
git push                                           # unpushed work is invisible and at risk
```
Then update your charter's session log, your backlog row, and any `IN-FLIGHT.md` claim — and
commit those too. An uncommitted log is a lost log.

## 7. Quick reference

| I want to… | Command |
|---|---|
| See who's working on what | `git fetch --all --prune && git branch -r --sort=-committerdate` |
| Start a new agent's branch | `git worktree add ../n-dx-<agent> -b elm/<name>/<topic>` |
| See how far our fork has drifted from the parent | `git fetch upstream && git rev-list --left-right --count upstream/main...origin/main` |
| Update our fork from the parent | `git fetch upstream && git checkout main && git merge upstream/main && git push origin main` |
| Get `main` into my branch | `git fetch origin && git rebase origin/main` |
| Signal I've started | `git push -u origin <branch>` + draft PR |
| Open a PR | `gh pr create --base main` (after `gh repo set-default AsterMindAI/n-dx`) |
| Fix a lockfile conflict | `pnpm install && git add pnpm-lock.yaml` |
| Safely force-push my own branch | `git push --force-with-lease` |
