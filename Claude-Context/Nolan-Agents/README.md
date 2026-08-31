# Team Nolan

**Lead:** Nolan · **Backlog prefix:** `TN`

## Mission

_Not yet assigned._ The three leads decide scopes together; fill this in when that happens and
delete this line.

## Scope

**Owns:** _(unassigned)_

**Does not own:** _(unassigned)_

> Until scopes are assigned there is no ownership map to protect anyone — so coordinate every
> non-trivial edit through [`../IN-FLIGHT.md`](../IN-FLIGHT.md), and push your branch early so the
> other teams can see what you're touching.

## Roster

One row per agent. Set a new agent up with [`../NEW-AGENT.md`](../NEW-AGENT.md).

| Agent | Charter | Scope | Worktree |
|---|---|---|---|
| Jam | [`Jam.md`](Jam.md) | Survey of LLM call sites for ELM/KELM replacement; proposes the three-way split. Analysis + ADR only — implements nothing. | _(none — shared checkout `/Users/nolanmoore/n-dx-1`, see below)_ |
| Fluff | [`Fluff.md`](Fluff.md) | The `Claude-Context/` agent system itself — doctrine, onboarding, and workflow docs. Finds where doctrine and reality disagree and drafts the correction; does **not** decide which convention wins, that goes to the leads as an ADR. | _(none — shared checkout `/Users/nolanmoore/n-dx-1`, branch `Nolan-Work`, see below)_ |
| Butter | [`Butter.md`](Butter.md) | **Path A, measurement half** — token accounting end to end: parse → accumulate → persist → report (`llm-client/src/{token-usage,cli-provider,api-provider}.ts`, `hench/src/agent/lifecycle/event-accumulator.ts`, `ndx usage`). Gates Paths B and C, neither of which can state a saving without it. Does **not** touch `sourcevision/src/analyzers/**` (Jam's) or the `Claude-Context/` root doctrine docs (Fluff's). | `/Users/nolanmoore/n-dx-butter`, branch `Nolan-Work-Butter` |
| Syrup | [`Syrup.md`](Syrup.md) | **Reads the other two teams.** Surveys `origin/Jarrett` and both Thomas branches — ADRs, IMPLs, charters, backlogs, notes, diffs — and reports what they have found to Jam and Butter as within-team notes. **Strictly read-only on Jarrett's and Thomas's branches:** no commits, no cherry-picks, no fixes. Drafts outbound cross-team notes for **Nolan** to send; does not send them. Ships analysis and notes, no code. | _(none — shared checkout `/Users/nolanmoore/n-dx-1`, branch `nolan-work`, lead's decision 2026-08-31)_ |

> `(TBD)` and `(shared checkout)` are not valid worktree entries for an agent that works alongside
> others. See [`../Command-Structure`](../Command-Structure) → *One agent, one worktree*.
>
> **Open item:** Jam runs in the shared checkout on branch `Nolan-Work` by the lead's decision
> (2026-08-10), so the rule above is knowingly not met. The mitigation is the one
> `Command-Structure` names for shared checkouts: **every `ndx plan|work|ci|refresh|self-heal` and
> every rex MCP write is claimed in [`../IN-FLIGHT.md`](../IN-FLIGHT.md) before running and
> released after**, because `.rex/`, `.sourcevision/`, and `.hench/` lose data silently under
> concurrent writers. Team Nolan's worktree-vs-shared-checkout choice is still unrecorded in
> `OWNERSHIP.md` § Untracked-state hazard.
>
> **Correction (2026-08-11, same day):** an earlier revision of this file said *"Fluff does meet
> the rule — own worktree at `../n-dx-fluff`."* **That is no longer true.** Fluff was set up with a
> worktree and the lead reversed it the same day for ease of oversight; the worktree was removed
> after its commit was fast-forwarded onto `Nolan-Work`. **Fluff is on the shared checkout on
> `Nolan-Work`, alongside Jam**, and carries the same mitigation: claim every state-writing command
> in `../IN-FLIGHT.md`.
>
> So **no agent on Team Nolan has worktree isolation**, and two agents now share one branch in one
> working directory. `OWNERSHIP.md` § Untracked-state hazard is still blank, and the claim board is
> now the only thing standing between the two of us and silent PRD corruption.
>
> **Update (2026-08-13):** the sentence above is no longer true in full — **Butter has worktree
> isolation** (`/Users/nolanmoore/n-dx-butter`, branch `Nolan-Work-Butter`), on the lead's standing
> instruction to split off if Butter's work could collide with Jam's. It could: Butter's
> verification must run hench, which writes `.hench/`, while Jam runs `sourcevision analyze`, which
> writes `.sourcevision/`. The hazard was also observed directly — during Butter's onboarding, HEAD
> in the shared checkout moved twice (`07bafec7` → `26a191e7` → `f52eb253`) mid-session.
> **Jam and Fluff remain on the shared checkout on `Nolan-Work`** and carry the claim-first
> mitigation unchanged. `OWNERSHIP.md` § Untracked-state hazard is still blank.
>
> One caveat worth knowing: **a worktree does not isolate `.hench/runs/`.** Those six run files are
> tracked in git despite `.gitignore:5` (committed before the rule), so they are present in every
> worktree. Isolation covers newly written state, not that committed history.

## Seams

Where this team's work touches another's — cross these with a note, never silently.
Fill in as scopes and dependencies become clear.

| Seam | Other side | Protocol |
|---|---|---|
| **Token numbers** — Path A produces the measurement Path B must quote to claim a saving | Jam (Path B, `TN-J4`) | Butter publishes the number with its method; Path B quotes it rather than deriving its own. Butter does not edit `sourcevision/src/analyzers/**`. Within-team note (`NOTE-nolan-internal-…`) if either side's number moves. |
| **`packages/llm-client/`** — Butter works `token-usage.ts`, `cli-provider.ts`, `api-provider.ts`; the four shared files in that package are on the monorepo "nobody edits unilaterally" list | All three teams | Butter claims its three files in `../IN-FLIGHT.md`. If a fix reaches `provider-registry.ts`, `provider-interface.ts`, `llm-types.ts`, or `llm-config.ts`, it is claimed and announced **before** the edit, not after. |

## Handbooks

- [`K2-HANDBOOK.md`](K2-HANDBOOK.md) — **onboarding for whoever builds the ELM classification tier.**
  Self-contained: the five numbers that define the problem, what is already settled (capacity,
  features, corpus size, the `TN-J24` merge), the adopted abstention design, the contamination rule
  on the spent gold set, and the ten traps that have each produced a believed-but-wrong number.

## Communication

- **Inbox:** [`Notes/`](Notes/) — read at the start of every session.
- **Syncs:** [`syncs/`](syncs/) — use [`../SYNC-TEMPLATE.md`](../SYNC-TEMPLATE.md).
- **To another team:** drop a note in `../Jarrett-Agents/Notes/` or `../Thomas-Agents/Notes/`.

## Claim board

[`BACKLOG.md`](BACKLOG.md) is the source of truth for status and claims. Claim there, commit,
first commit wins.
