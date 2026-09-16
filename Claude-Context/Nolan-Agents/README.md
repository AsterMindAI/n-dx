# Team Nolan

**Lead:** Nolan · **Backlog prefix:** `TN`

## Mission

**Build the database the ELM trains on.** Assigned by the leads 2026-09-16. Stage public repos,
label every source file with the 17-archetype catalog using the `sourcevision` classify pass, and
produce a corpus another team can train from.

**End goal: hand the other two leads a GitHub repo — or a comparably light database — that an ELM
can be trained from.** The deliverable is *data plus the document that makes it safe to use*, not a
model. This is the direction
[`ADR-2026-09-04-syrup-merge-elm-corpus-into-jarrett-harness.md`](../ADR/ADR-2026-09-04-syrup-merge-elm-corpus-into-jarrett-harness.md)
already argued on independent grounds: the corpus is the paid-for asset, and the model is about an
hour of CPU away from it.

> **The consumer design is not a specification.** The lead's architecture diagram shows an ELM, an
> 80%-confidence gate and an LLM-fallback retrain loop downstream of us. Those are **examples of a
> consumer** and were explicitly flagged as such: **they must not shape the training data.** A
> corpus curated to flatter one downstream gate stops being a corpus, and shipping data rather
> than a model exists precisely so the consumer is free to disagree with us.

## Scope

**Owns:** the training corpus and its acquisition — `scripts/data/elm-archetype-corpus*.json`,
`scripts/elm-corpus-build.mjs`, [`ELM-CORPUS.md`](ELM-CORPUS.md), repo staging, the LLM classify
pass that produces labels, the seeded split, class coverage, and teacher provenance.

**Does not own:** the model and everything downstream of the data — ELM training, the classification
tier, the confidence gate, the fallback loop (Jam, `TN-J*`); `packages/sourcevision/src/analyzers/**`
(Jam's, and Team Jarrett's territory per `TJ-A1`/`TJ-A2`/`TJ-R2`); `packages/llm-client/**`
(Butter's); the `Claude-Context/` root doctrine docs (Fluff's, and on the shared "nobody edits
unilaterally" list).

> ⚠️ **`OWNERSHIP.md` § Assignments and `Command-Structure` § The teams still read `(unassigned)`
> for all three teams.** This section records Team Nolan's half of the leads' decision; the shared
> docs are Fluff's and have not been updated. **Jarrett's and Thomas's scopes are not recorded
> anywhere — ask Nolan rather than inferring them from this file.**
>
> Until those land there is still no ownership map protecting anyone, so coordinate every
> non-trivial edit through [`../IN-FLIGHT.md`](../IN-FLIGHT.md), and push your branch early so the
> other teams can see what you're touching.

## Roster

One row per agent. Set a new agent up with [`../NEW-AGENT.md`](../NEW-AGENT.md).

| Agent | Charter | Scope | Worktree |
|---|---|---|---|
| Jam | [`Jam.md`](Jam.md) | Survey of LLM call sites for ELM/KELM replacement; proposes the three-way split. Analysis + ADR only — implements nothing. | _(none — shared checkout `/Users/nolanmoore/Work/n-dx-1`, see below)_ |
| Fluff | [`Fluff.md`](Fluff.md) | The `Claude-Context/` agent system itself — doctrine, onboarding, and workflow docs. Finds where doctrine and reality disagree and drafts the correction; does **not** decide which convention wins, that goes to the leads as an ADR. | _(none — shared checkout `/Users/nolanmoore/Work/n-dx-1`, branch `Nolan-Work`, see below)_ |
| Butter | [`Butter.md`](Butter.md) | **Path A, measurement half** — token accounting end to end: parse → accumulate → persist → report (`llm-client/src/{token-usage,cli-provider,api-provider}.ts`, `hench/src/agent/lifecycle/event-accumulator.ts`, `ndx usage`). Gates Paths B and C, neither of which can state a saving without it. Does **not** touch `sourcevision/src/analyzers/**` (Jam's) or the `Claude-Context/` root doctrine docs (Fluff's). | ⚠️ `/Users/nolanmoore/n-dx-butter` **no longer exists on disk** (`git worktree list` reports it `prunable`, verified 2026-09-04). Branch `Nolan-Work-Butter` is intact locally and on `origin` at `7a9a5d37`, so the work is safe — only the working directory is gone. Not pruned; that is Butter's or the lead's call. |
| Syrup | [`Syrup.md`](Syrup.md) | **Reads the other two teams.** Surveys `origin/Jarrett` and both Thomas branches — ADRs, IMPLs, charters, backlogs, notes, diffs — and reports what they have found to Jam and Butter as within-team notes. **Strictly read-only on Jarrett's and Thomas's branches:** no commits, no cherry-picks, no fixes. Drafts outbound cross-team notes for **Nolan** to send; does not send them. Ships analysis and notes, no code. | _(none — shared checkout `/Users/nolanmoore/Work/n-dx-1`, branch `nolan-work`, lead's decision 2026-08-31)_ |
| K2 | _(none — **never had a charter**; see below)_ | **RETIRED 2026-09-04** (lead's decision). Built the ELM classification tier through Phases 1–3 off [`K2-HANDBOOK.md`](K2-HANDBOOK.md): the `tanh` adoption, the `ridgeLambda`/RBF/stacking rejections, the K1→K1′ replacement, the model freeze, gold set #2, and the Phase 3 generalisation failure. **Open rows (`TN-J25`, `TN-J30`, `TN-J31`, `TN-J32`) absorbed by Jam; completed rows (`TN-J27`, `TN-J28`, `TN-J29`, the `TN-J24` amendment) keep K2's name** — retiring an agent does not rewrite who measured what. | _(shared checkout `/Users/nolanmoore/Work/n-dx-1`)_ |
| Nutella | [`Nutella.md`](Nutella.md) | **Lead database builder — the training database itself.** Team Nolan's assigned scope (leads' decision 2026-09-16): the green box of the lead's architecture diagram — stage public repos, label every file with the 17-archetype catalog via the `sourcevision` classify pass, and produce a corpus another team can train from. Owns `scripts/data/elm-archetype-corpus*.json`, `scripts/elm-corpus-build.mjs`, [`ELM-CORPUS.md`](ELM-CORPUS.md), and the staging tree. **End goal: a GitHub repo or comparably light database handed to the other two leads — data plus its warning label, not a model.** Does **not** own the model, the tier, the confidence gate or anything else right of the green box (Jam's); `packages/llm-client/**` (Butter's); the `Claude-Context/` root doctrine docs (Fluff's). **Gold set #2's 250 files stay blind — never trained on.** | _(none — shared checkout `/Users/nolanmoore/Work/n-dx-1`, branch `Nolan-Work`, lead's decision 2026-09-16)_ |

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

> **⚠️ Doctrine gap found on Jam's 2026-09-04 revive — K2 ran with no charter and no roster row.**
> K2 worked for a week, spent real LLM budget, froze a model, commissioned a gold set and authored
> an ADR, and until today appeared in no roster. Its reasoning was never logged anywhere:
> `NEW-AGENT.md` § *Retiring an agent* says to "leave the charter — it's the record of why things
> were built the way they were", and this one has no charter to leave. Absorbing its rows therefore
> means inheriting artifacts without the thinking behind them. The row above is added so the record
> is at least complete; the question of how an agent got created without going through
> `NEW-AGENT.md` is for the lead.

## Seams

Where this team's work touches another's — cross these with a note, never silently.
Fill in as scopes and dependencies become clear.

| Seam | Other side | Protocol |
|---|---|---|
| **Token numbers** — Path A produces the measurement Path B must quote to claim a saving | Jam (Path B, `TN-J4`) | Butter publishes the number with its method; Path B quotes it rather than deriving its own. Butter does not edit `sourcevision/src/analyzers/**`. Within-team note (`NOTE-nolan-internal-…`) if either side's number moves. |
| **`packages/llm-client/`** — Butter works `token-usage.ts`, `cli-provider.ts`, `api-provider.ts`; the four shared files in that package are on the monorepo "nobody edits unilaterally" list | All three teams | Butter claims its three files in `../IN-FLIGHT.md`. If a fix reaches `provider-registry.ts`, `provider-interface.ts`, `llm-types.ts`, or `llm-config.ts`, it is claimed and announced **before** the edit, not after. |

## Handbooks

- [`ELM-CORPUS.md`](ELM-CORPUS.md) — **the labelled archetype corpus, documented as a shared
  asset.** Written for the other teams, not just this one: it is a general path-string → label
  dataset, so it is reusable by any ELM work whether or not Team Nolan's tier is the design that
  ships. Schema, the seeded split, per-repo provenance and teacher composition, the contamination
  boundary between training rows and the two gold sets, the rebuild procedure, and an inventory of
  the un-versioned staging tree. **Read § 6 before training on it — v1 has a measured
  generalisation failure and v2's fix is unvalidated.**
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
