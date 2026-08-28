# NOTE — Nolan → Jarrett — 2026-08-27 — Sign-off request: one dependency line in `packages/llm-client`

> **⚠️ HELD — NOT SENT. Nolan's direction, 2026-08-27: Team Nolan is working independently for now and is not circulating notes to the other leads. This sits on `Nolan-Work` undelivered by intent, not by the `TN-F3` merge-lag problem. Do not treat it as an outstanding request.**

**Drafted by:** Butter (Team Nolan) · **Routes to:** Jarrett, who routes it to their agents
**Needs a reply by:** whenever you next read your inbox — Team Nolan's `TN-B3` is parked until one of you or Thomas/Jarrett answers
**Blocking:** `TN-B3` Step 0. Nothing of yours.

## What

Team Nolan is asking for **a second lead's sign-off on a dependency scope change**:

```
packages/llm-client/package.json  +  "@astermind/astermind-community": "^3.0.0"
```

That is the whole request. **Yes or no is a complete reply.**

## Why it needs you at all

`Command-Structure` puts **dependency additions** under collective command — a second lead's
explicit sign-off before it happens. Nolan asked us to proceed; Nolan is one lead. So this goes to
the two of you rather than being waved through on our own lead's say-so.

I want to be straight that this is the *weak* form of the rule, not the strong one:

- **It is not a new vendor.** `@astermind/astermind-community@^3.0.0` is **already a root
  dependency** (`package.json:61`), approved in `43d6db51` along with
  `scripts/elm-hello-world.mjs`. This moves it into the workspace package that needs it.
- **Nothing new enters the dependency graph.** Measured, not assumed — I ran the change in an
  isolated worktree, captured the diff, and reverted it:

  ```
  pnpm --filter @n-dx/llm-client add @astermind/astermind-community@^3.0.0
    -> Progress: resolved 562, reused 0, downloaded 0, added 0
    -> pnpm-lock.yaml | 3 +++      (3 insertions, 0 deletions)

  +      '@astermind/astermind-community':
  +        specifier: ^3.0.0
  +        version: 3.0.0
  ```

  Three additive lines: an importer entry pointing at the version already resolved. **No new
  packages, no version changes, no transitive additions.** The lockfile is byte-identical after
  revert.

So the "`pnpm-lock.yaml` conflicts brutally" hazard our docs warn about does **not** apply to this
particular change. I am telling you that because it should make your decision cheap — not to argue
the rule away. The rule is what sent this to you, and I would rather over-ask than assume.

## Why we want it

Both ELM-replaceable call sites — sourcevision archetype classification (Team Nolan, Path B) and
rex granularity assessment (Path C) — need ELM inference. `packages/rex` and
`packages/sourcevision` both already depend on `@n-dx/llm-client`, and the tier rules forbid
domain-to-domain imports, so Foundation is the only legal shared home short of creating a new
package. Full reasoning, including the alternatives we rejected:
`Claude-Context/ADR/ADR-2026-08-23-butter-elm-inference-module.md`.

**One thing you may want to push back on**, and it is a fair objection: this widens
`@n-dx/llm-client`'s charter from "vendor-neutral LLM foundation" to "…and local inference". The
ADR offers the alternative — a separate `@n-dx/elm` package — and recommends against it only on
cost. If you would rather we pay for the package, say so; the module is namespaced under
`src/elm/` specifically so that stays a move rather than a rewrite, and it is far cheaper to
decide now than after two call sites import it.

## What I need back

**One of:**

1. **"Approved"** — we run `pnpm add` in `packages/llm-client` and get on with it.
2. **"Use a separate package instead"** — also fine; our IMPL changes by one step.
3. **"No"** — also fine. Say why if you can; we will keep the wrapper out of the workspace and
   confined to `scripts/` as a benchmark artifact until a lead decides otherwise.

## Context you may not have

Team Nolan has been running this independently for a few days. Short version: only **2 of 22** LLM
call sites are ELM-replaceable; we fixed a defect that had left the project unable to measure its
own objective; and a full findings write-up with every number is at
`Claude-Context/Nolan-Agents/ELM-FINDINGS.txt` if it is useful to you. **Paths A and C were
offered to your teams and are still open** — nothing here claims them; Team Nolan has only picked
up Path C's analysis because nobody else had.

**Delivery note:** per Fluff's `TN-F3` finding, a note reaches you only when branches merge. This
sits on `Nolan-Work`. If you are not seeing Team Nolan's notes, `git fetch origin && git merge
origin/dev` on your branch.

— Butter (Team Nolan), for Nolan
