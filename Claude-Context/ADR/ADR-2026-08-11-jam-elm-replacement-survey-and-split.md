# ADR — LLM→ELM replacement candidates, and how to split the work three ways

- **Status:** Proposed
- **Date:** 2026-08-11
- **Author:** Jam (Team Nolan)
- **Supersedes:** none
- **Backlog item:** `TN-J1`

> **This ADR does not claim ELM viability for anything.** It is a survey of where the money
> actually goes and a proposed division of labour. Every viability claim belongs in a later ADR
> with the Evidence section filled in properly. See § Evidence for what is and is not proven.

## Context

n-dx pays a hosted LLM for every inference. The goal is to replace what can be replaced with a
local ELM via `@astermind/astermind-community` (pinned `^3.0.0`, `package.json:61`).

### All LLM inference in this repo flows through exactly three places

Verified by exhaustive grep across `packages/*/src`:

| Package | Chokepoint | Call sites |
|---|---|---|
| sourcevision | `callClaude` / `callLLM` — `packages/sourcevision/src/analyzers/claude-client.ts:145` | 4 |
| rex | `spawnClaude` — `packages/rex/src/analyze/llm-bridge.ts:135` | 18 |
| hench | CLI adapters — `packages/hench/src/agent/lifecycle/adapters/` | agent loop |

Both library chokepoints bottom out in the same call, `client.complete({ prompt, model })`
(`claude-client.ts:147`, `llm-bridge.ts:148`). **That is a good position to be in** — a vendor
swap does not have to touch 22 call sites, only the client the two chokepoints resolve.

### The 22 call sites, triaged by output shape

The question that decides replaceability is not "is this call expensive" but **"is the output a
member of a closed set, or is it prose?"** An ELM can emit a label. It cannot write a PRD.

**Tier A — closed label set. Genuinely classification-shaped.**

| Call site | Label set | Evidence |
|---|---|---|
| `classifyBatchWithLLM` — `packages/sourcevision/src/analyzers/classify.ts:404` | **17** archetype IDs | Output validated against `validIds: Set<string>`; catalog is `BUILTIN_ARCHETYPES` (`archetypes.ts`, 17 entries: `entrypoint`, `utility`, `types`, `route-handler`, `route-module`, `component`, `store`, `middleware`, `model`, `gateway`, `config`, `hook`, `service`, `schema`, `cli-command`, `page`, `test-helper`) |
| `assessGranularity` — `packages/rex/src/analyze/reason.ts:1481` | **3** — `break_down` / `consolidate` / `keep` | `z.enum(["break_down", "consolidate", "keep"])` at `reason.ts:1327` |

These two are the entire Tier A. Everything else in the repo generates text.

**Tier B — hybrid. A label *and* a justification.**

`assessGranularity` also returns `reasoning` (prose) and `issues[]` (prose) alongside its enum
(`reason.ts:1309-1310`), and the CLI renders that prose to the user (`reason.ts:1456-1466`). An
ELM can produce the enum. It cannot produce the sentence explaining it. **Replacing this call site
is therefore a product decision, not only a technical one** — either the justification becomes
templated from the label, or it disappears. Whoever takes this must get that decision made before
writing code, not after.

**Tier C — open-ended generation. Not replaceable, and we should say so once, clearly.**

All 8 `reasonFrom*` functions (`reason.ts:814, 1001, 1113, 1215, 1656, 1755`), `adjustGranularity`
(`:1295`), `decomposeTask`, `modifyProposals`, `reasonForReshape`, `reasonForBodyMerge`, `clarify`,
`generateSpecFromContext`, `disambiguateWithLLM`, `applyConsolidationGuard`, `proposeGroupRenames`,
`proposeSiblingRenames`, plus all three sourcevision enrichment sites (`enrichBatch`,
`enrichSingleZone`, `runMetaEvaluation`) and the whole of hench. These emit PRD trees, zone names,
descriptions, insights and findings. They stay on a hosted model.

### Two corrections to the starting candidate list

The starting list was rex placement, SV classification, `enrichClassification`. Two of those three
need adjusting, and both adjustments matter:

1. **"rex placement" is already deterministic — there is no token spend to remove.** Item placement
   is enforced by `LEVEL_HIERARCHY` rules in `packages/rex/src/core/move.ts:91` and
   `packages/rex/src/core/structural.ts:125`, and validated in
   `packages/rex/src/recommend/create-from-recommendations.ts:373-386`. `packages/rex/src/recommend/`
   contains **zero** LLM calls (grep for `spawnClaude|callLLM|createLLMClient` returns nothing).
   Placement is rule-based today. Migrating it would replace working deterministic logic with a
   statistical model — strictly worse.

2. **"SV classification" and "enrichClassification" are two different things with opposite verdicts.**
   *Classification* (`classify.ts`) picks from 17 fixed IDs → Tier A, the best candidate we have.
   *Enrichment* (`enrich-batch.ts`, `enrich-per-zone.ts`) writes zone names, one-sentence
   descriptions, insights, and findings (`enrich-per-zone.ts:126`) → Tier C, not replaceable. The
   function named `enrichClassificationsWithLLM` (`classify.ts:328`) is the *classification* path
   despite the "enrich" in its name. The naming invites exactly this confusion; the split below
   keeps them in separate hands deliberately.

### The measurement problem — this is the finding that should change the plan

**We cannot currently measure the thing we are trying to minimize.**

- All 6 stored runs in `.hench/runs/*.json` record `tokenUsage {"input": 0, "output": 0}`.
- This checkout has **no `.sourcevision/*.json` artifacts at all** (only `hints.md`), so there is
  no recorded analysis cost either.
- The parsers exist and look wired — `parseCliTokenUsage` / `parseStreamTokenUsage`
  (`packages/llm-client/src/cli-provider.ts:348-385`) and `parseApiTokenUsage`
  (`api-provider.ts:184`). So zeros are **not** obviously "CLI mode can't report tokens". Either
  those runs predate the parser, or the parse is silently failing.

I did not chase this to root cause — it is outside `TN-J1` and I would have been guessing. **It is
recorded here as a lead, not a finding.** But the consequence for planning is concrete: a
"minimize token usage" project with no baseline cannot prove it succeeded, and per the honesty
rule, no accuracy or savings number any of us reports will be meaningful without one.

### Scale (structural estimate, not measured)

1,319 `.ts`/`.tsx` files under `packages/` excluding `node_modules` and `dist` (652 excluding
`tests/`). `LLM_BATCH_SIZE = 30` (`classify.ts:322`), so classification is an **upper bound of ~44
calls** per full analyze — fewer in practice, because only files the deterministic pass leaves
unclassified reach the LLM, and each batch may retry up to 3 times with progressively simpler
prompts (`computeLLMClassifyAttempts`, `classify.ts:392-397`).

### The seams we build on

- **Vendor seam:** `ProviderRegistry.register(vendor, factory)` —
  `packages/llm-client/src/provider-registry.ts:96`. Built-ins register through the same method in
  the same file: `claude` (`:175`), `codex` (`:182`), `google` (`:206`). The ELM is a **registered
  vendor, not a fork**.
- **Tiering seam already exists.** `resolveVendorModel(vendor, config, weight)` takes a
  `TaskWeight` of `"light" | "standard"`, and enrichment already routes naming-dominant pass 1 to a
  cheaper model (`enrich-batch.ts:215`, `claude-client.ts:50-52`).

### ⚠️ Amendment 2026-08-11 — the vendor seam is text-to-text, and that is a problem

*Added the same day, before acceptance, on further reading of the provider contract. It revises the
integration recommendation below; the survey and the split are unchanged.*

The provider contract is **string in, string out**:

```ts
interface CompletionRequest  { prompt: string; model: string; /* … */ }   // types.ts:68
interface CompletionResult   { text: string; tokenUsage?: TokenUsage; }   // types.ts:82
```

An ELM's native signature is `predict(text) -> [{ label, prob }]`. Registered as a vendor behind
`complete()`, an ELM would have to (1) receive a fully rendered prompt string — for classification
that is the 17 archetype descriptions plus the file list plus JSON formatting instructions,
built by `buildLLMClassifyPrompt` — (2) *reverse-engineer the structured input back out of that
string*, and (3) re-serialize its labels as JSON text for `parseClassifyResponse` to parse again.

**Two layers of parsing in each direction, to move a label.** That is brittle in exactly the place
we cannot afford brittleness, and it throws away the ELM's confidence score, which is the thing a
fallback threshold needs.

There is a second friction: `LLMVendor` is a **closed union** — `"claude" | "codex" | "google"`
(`provider-interface.ts`) — while `ProviderRegistry.register(vendor: string, …)` takes an open
string. Adding an ELM vendor properly means editing `provider-interface.ts`, which is on the
`OWNERSHIP.md` shared-file list.

**So there are two candidate integrations, and the leads should pick one deliberately:**

| | **(a) ELM as a registered vendor** | **(b) ELM as a pre-LLM tier at the call site** |
|---|---|---|
| Seam | `provider-registry.ts:96` | inside `classify.ts` / `reason.ts`, before `callClaude`/`spawnClaude` |
| Flow | prompt string → parse → predict → serialize JSON | features → predict → label + confidence |
| Confidence score | lost (must be re-encoded as text) | available natively, so a fallback threshold is trivial |
| Shared files touched | `provider-registry.ts`, `provider-interface.ts` | none |
| Fits the generation sites (Tier C) | yes | n/a — they stay on a hosted model |
| Fits the two Tier A sites | poorly | well |

**(b) does not violate the standing rule.** "The ELM is a registered vendor, not a fork" exists to
stop ELM being bolted *into the existing provider files*, where all three teams collide. Option (b)
touches no provider file at all — it adds a tier in front of the call, in the package that owns
that call, and falls through to the untouched hosted path below a confidence threshold. It is
strictly less invasive than (a), not more.

My reading is that **(b) is right for the two Tier A call sites and (a) is right for nothing we
currently have** — (a) would only pay off if we later wanted an ELM to serve *generation* sites,
which the survey says it cannot. But this is a call for the three leads, because it touches the
standing doctrine, so it is presented as an option rather than decided here.

## Decision

We treat ELM replacement as **two candidate call sites, not a migration**, and we split the work by
**merge surface** into three streams that touch disjoint packages: Team A owns the ELM provider and
measurement inside `llm-client`; Team B owns sourcevision archetype classification; Team C owns rex
granularity assessment. Each of B and C proves or disproves viability with a committed, seeded
benchmark **before** any call site is switched, and publishes the number with its baseline either
way. Team A's measurement work lands first, because without it neither B nor C can state what they
saved.

### The split

| | **Team A — provider & measurement** | **Team B — classification** | **Team C — granularity** |
|---|---|---|---|
| **Owns** | `packages/llm-client/src/` | `packages/sourcevision/src/analyzers/` | `packages/rex/src/analyze/` |
| **Deliver** | The shared ELM inference module (load/train/predict + confidence), the integration-shape decision (a) vs (b) above, and **token accounting that records non-zero** | ELM for the 17-class archetype task at `classify.ts:404`, behind a confidence threshold with LLM fallback | ELM for the 3-class enum at `reason.ts:1481`; resolve the Tier B prose question first |
| **Class count** | n/a | **17** (random baseline 5.9%) | **3** (random baseline 33%) |
| **First artifact** | Non-zero token numbers from a real `ndx analyze` | Seeded benchmark script + accuracy vs baseline | Product decision on `reasoning`, then seeded benchmark |
| **Free training data** | n/a | `BUILTIN_ARCHETYPES` deterministic pass labels files at zero cost; `classify.test.ts:394+` is an existing regression harness | Existing proposals + recorded assessments |

**Why this split holds:** the three streams touch three different packages with no shared files.
The only shared surface is `provider-registry.ts`, which is on the `OWNERSHIP.md` shared list and
is **owned exclusively by Team A** — B and C never edit it. That satisfies the "each team can work
a full day without touching a file another team has open" test in `OWNERSHIP.md` § Assignments.

**Sequencing, and the one real dependency:** B and C both eventually need A's provider to exist.
They are *not* blocked by it, because the honest first step for both is an **offline seeded
benchmark script** (the `scripts/elm-hello-world.mjs` pattern) that answers "does an ELM do this at
all" without touching the call site. If the answer is no, no provider wiring was wasted. If the
answer is yes, A's provider is ready by then.

**Team A's work is the highest-value and least glamorous.** If the token counters stay at zero,
this project cannot report a result at the end — only a vibe.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Split by call site count (rex 18 / sourcevision 4 / hench) | Optimizes for even *volume*, but 20 of the 22 sites are Tier C and cannot be replaced at all. It would put two teams on work that has no ELM in it. |
| Everyone works `llm-client` together | `provider-registry.ts`, `provider-interface.ts`, `llm-types.ts`, `llm-config.ts` are all on the shared-file list precisely because concurrent edits there hurt. Three teams in one file is the conflict the doctrine exists to prevent. |
| Replace `applyConsolidationGuard` (looks like a yes/no decision) | Its *trigger* is already deterministic — `originalTaskCount > ceiling` (`consolidation-guard.ts:120-131`). The LLM call does the restructuring, which is generation. Nothing to classify. |
| Migrate rex placement, as originally proposed | Already deterministic rule logic. Replacing rules with a statistical model is a regression. See § Context correction 1. |
| Switch call sites first, measure later | Violates the honesty rule directly: with token counters at zero we could not tell a saving from a regression, and an ELM that quietly degrades archetype quality would surface as bad zone detection weeks later. |
| Fork the providers to add ELM inline | `ProviderRegistry.register` exists for exactly this. Bolting ELM into provider files guarantees three-way conflicts (`Command-Structure`). |

## Consequences

**Easier:** one vendor registration serves every call site behind both chokepoints — the swap is
one factory, not 22 edits. The existing `TaskWeight` light/standard tiering gives ELM a natural
home. Classification has free labeled training data and an existing test file to regress against.

**Harder:** the 17-class task is *not* the task the hello-world proved (see § Evidence). Tier B's
prose problem needs a product call. And we now maintain a trained model artifact — where it lives,
whether it ships in the package, and when it retrains are all open questions this ADR does not
answer.

**Breaks:** nothing yet. This ADR changes no code.

**Affected teams:** all three, since it proposes their scopes. Scope assignment is a
collective-command decision — **this is a proposal for the three leads, not an assignment.** Notes
sent to `Claude-Context/Jarrett-Agents/Notes/` and `Claude-Context/Thomas-Agents/Notes/` on
2026-08-11.

## Evidence

**No ELM viability claim is made in this ADR, so there is no accuracy number to report.** Stating
that plainly is the point of this section.

What exists today is the pre-existing proof of concept, `scripts/elm-hello-world.mjs` (committed,
re-runnable via `node scripts/elm-hello-world.mjs`):

- **Task framing:** file-path → archetype label, text input via tokenizer
- **Label set / class count:** **3** (`route`, `component`, `test`)
- **Training / held-out split:** 30 training paths / 6 held-out paths
- **Seed:** `42` (`hiddenUnits: 512`, `maxLen: 32`, `activation: "relu"`, delimiter `/[/._-]+/`)
- **Random baseline:** 33.3% — **floor asserted:** 66% (`MIN_ACCURACY`, deliberately 2× baseline
  and explicitly *a floor, not a benchmark*)

> ### ⚠️ Correction 2026-08-11 (post Step 0) — the 5.9% baseline below is the wrong yardstick
>
> This ADR repeatedly quotes a **5.9% random baseline** for the 17-class task. That is the
> *uniform-random* rate and it is misleading, because the measured class distribution is severely
> imbalanced. Measured on this repo (`sourcevision analyze . --fast`, 683 source files):
> `utility` accounts for **83 of 424** classified files, so **a model that always answers
> "utility" scores 19.6%.**
>
> **Use 19.6% — the majority-class rate — as the baseline, not 5.9%.** Beating 5.9% would prove
> nothing. Everywhere below that says 5.9%, read 19.6%.
>
> Step 0 also found that **6 of the 17 archetypes have zero examples** in the rule-derived corpus
> (`gateway`, `middleware`, `model`, `route-module`, `service`, `test-helper`), so the effective
> label space is 11 classes, not 17. Full detail:
> [`IMPL-2026-08-11-jam-elm-classification-path-b.md`](../IMPL/IMPL-2026-08-11-jam-elm-classification-path-b.md)
> § Step 0 results.

**Why this does not transfer to the real target, and must not be quoted as if it does:**

| | hello-world | real target (`classify.ts:404`) |
|---|---|---|
| Classes | 3 | **17** |
| Random baseline | 33.3% | **5.9%** |
| Held-out samples | 6 | unmeasured |
| Input | path only | path + optional description (`includeDescriptions`) |

A 6-sample held-out set cannot distinguish 66% from 83% — that is a one-file difference. It is
adequate as a smoke test, which is all it claims to be, and inadequate as evidence for a
17-class production swap. **Team B's first deliverable is the benchmark that replaces this table's
right-hand column with measured numbers**, reporting accuracy against the 5.9% baseline whichever
way it comes out. Per `Command-Structure`, an ELM that scores badly here is a finding worth
publishing, not a failure to bury.

**Verified for this ADR** (read at `file:line` on the working tree, commit `9c8dc5b1`; no subagent
reports were relied on): the two chokepoints, all 22 call sites and their enclosing functions, the
17-entry archetype catalog, the 3-value zod enum, the absence of LLM calls in `rex/src/recommend/`,
the zero token counters in all 6 `.hench/runs/*.json`, and `ProviderRegistry.register` at
`provider-registry.ts:96`.

**Not verified:** why the token counters read zero (root cause not chased — see § Context), and the
real-world unclassified-file count that sets actual classification volume (this checkout has no
`.sourcevision` analysis artifacts to measure it from).
