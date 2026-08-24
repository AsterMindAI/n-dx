# IMPL — Building the shared ELM inference wrapper

- **Implements:** [`ADR-2026-08-23-butter-elm-inference-module.md`](../ADR/ADR-2026-08-23-butter-elm-inference-module.md)
- **Owner:** Butter (Team Nolan)
- **Backlog item:** `TN-B3`
- **Branch:** `Nolan-Work-Butter` · **Worktree:** `/Users/nolanmoore/n-dx-butter`
- **Status:** Not started — **Step 0 gates everything and needs a second lead**

> Line anchors verified at `5e24f80a`. Numbers attributed to Jam are cited, not re-derived.

## Scope

**In scope:** a Foundation-tier ELM inference module in `packages/llm-client/src/elm/` —
train, predict, top-k, confidence gate — with unit tests, a seeded benchmark another team
can run, and no registration with `ProviderRegistry`.

**Out of scope, explicitly:** wiring it into `classify.ts` (Jam's, Path B `TN-J4` Step 4);
Path C's call site (`TN-B4`, and gated on its prose question first); whether the ELM is
*accurate enough* (`TN-B5`/`TN-J10`); the reporting surface (`TN-B1`); and model
serialisation, deferred by ADR § 4 behind a stated threshold.

**This IMPL builds the engine. It does not connect it to anything.** That separation is
deliberate: it keeps me out of the files Jam is live in, and it means a negative accuracy
result costs us a module nobody imported rather than a half-integrated call site.

## Files touched

| Path | Owning team | New/Edit | Note sent? |
|------|-------------|----------|------------|
| `packages/llm-client/src/elm/index.ts` | Butter (Path A) | **New** — barrel | n/a |
| `packages/llm-client/src/elm/classifier.ts` | Butter (Path A) | **New** — wrapper | n/a |
| `packages/llm-client/src/elm/types.ts` | Butter (Path A) | **New** — `ElmPrediction`, `ElmClassifier` | n/a |
| `packages/llm-client/tests/unit/elm-classifier.test.ts` | Butter (Path A) | **New** | n/a |
| `packages/llm-client/package.json` | **SHARED — dependency change** | Edit — add `@astermind/astermind-community` | **Step 0: claim + second lead** |
| `pnpm-lock.yaml` | **SHARED** | Regenerated | **Step 0: claim + second lead** |
| `packages/llm-client/src/public.ts` | llm-client | Edit — export the `elm/` barrel | n/a |
| `scripts/elm-wrapper-benchmark.mjs` | shared `scripts/` | **New** | **announce in `IN-FLIGHT.md`** |
| `tests/e2e/architecture-policy.test.js` | **SHARED** | Edit — `ALLOWED` entry, only if the benchmark shells out | **claim first** |

**Not touched:** `provider-registry.ts`, `provider-interface.ts`, `llm-types.ts`,
`llm-config.ts` — the four shared provider files. The ADR's whole point is that this module
does not go near them. **If an edit to one becomes necessary, that is a signal the design is
wrong — stop and revise the ADR, do not reach in.**

Also not touched: `packages/sourcevision/**` (Jam's, live), `scripts/elm-corpus-build.mjs`,
`scripts/elm-calls-avoided.mjs`, `scripts/data/elm-archetype-corpus.json` (Jam's).

## Steps

### Step 0 — Get the dependency sign-off. **Nothing else starts until this lands.**

`@astermind/astermind-community` is a **root** dependency (`package.json:61`) and no
workspace package declares it. `packages/llm-client` must gain it.

1. Announce in `IN-FLIGHT.md` — claims `packages/llm-client/package.json` and `pnpm-lock.yaml`.
2. Get a **second lead's explicit sign-off**, in writing. It is not a new vendor — it was
   approved at root in `43d6db51` — but it is a new workspace dependency and it churns the
   lockfile, which doctrine puts on the collective-command list. **"Already at root" is not
   permission.**
3. `pnpm add` inside `packages/llm-client` only. Resolve any lockfile conflict by re-running
   `pnpm install` — **never hand-merge `pnpm-lock.yaml`.**
4. Release the claim same session; a lockfile claim left open blocks everyone.

**If sign-off is refused, the ADR's `@n-dx/elm` alternative is not a workaround** — a new
package needs the same dependency and the same sign-off. The real fallback is to keep the
wrapper in `scripts/` as a benchmark-only artifact until a lead decides.

### Step 1 — Types first, so the contract is reviewable before there is code to argue with

`elm/types.ts`: `ElmPrediction`, `ElmClassifier`, `ElmTrainingRow`, `ElmConfig`. No
implementation. This is the surface Paths B and C will both hold, and it is far cheaper to
change now.

**`ElmConfig` must carry `seed` (default 42) and `threshold` explicitly.** An unseeded model
makes every downstream accuracy number unreproducible, which the measurement contract
forbids outright.

### Step 2 — The wrapper, with the library's traps encoded in code, not comments

`elm/classifier.ts` wrapping `ELM` from `@astermind/astermind-community`. Three things the
hello-world learned the hard way, and one of them must be enforced rather than documented:

- **`charSet` is interpolated *unescaped* into a RegExp character class**, so a literal `-`
  must come **last** or it forms an invalid range and throws. **Assert this in the
  constructor** — a config that would throw deep inside the library should fail immediately
  with a message naming the cause. A comment is not enough; the next person will pass a
  charSet from config.
- **Text training requires `useTokenizer: true`**, or `train()` throws. Default it on and
  document why.
- **Pin behaviour to `^3.0.0`.** v4 is tagged on GitHub, **unpublished and breaking — do not
  chase v4.**

`classifyGated(text, threshold)` returns `null` below threshold. That `null` is the
fallthrough contract: the caller leaves its field unset and the existing hosted path runs
unchanged.

### Step 3 — Tests, including the one that matters most

- **Round-trip:** train on a small labelled set, predict held-out, assert labels.
- **Determinism:** same seed ⇒ identical predictions across two instances. Guards the
  reproducibility the measurement contract depends on.
- **Gate:** `classifyGated` returns `null` below threshold and a prediction above it.
- **`charSet` guard:** a charSet with a non-terminal `-` throws **our** error, not the
  library's. **Written first and watched go red** against a wrapper that lacks the check —
  this is the one assertion that would otherwise silently pass for the wrong reason.
- **Top-k ordering:** `predict(text, 3)` returns three, best-first, probabilities descending.

Must stay green: `pnpm typecheck`, `npx vitest run tests/` at the root
(**not** `pnpm test` — it stops at the first failing package and never reaches `tests/e2e/`,
Jam's finding), plus `domain-isolation.test.js` and `architecture-policy.test.js`.

### Step 4 — A seeded benchmark another team can run

`scripts/elm-wrapper-benchmark.mjs`, modelled on `elm-hello-world.mjs`. Announce in
`IN-FLIGHT.md` before adding. **If it shells out to `git` for provenance it will trip the
`child_process` architecture rule** — the same one I re-broke earlier today after reporting
it to Jam. Either avoid `child_process` or claim `tests/e2e/**` and extend `ALLOWED`, as Jam
did under `TN-J13`. **Check this before committing, not after.**

Reports against the **38.0% majority-class baseline** (Jam, on the 324-row corpus) — not
19.6%, and never the 5.9% figure, which was wrong and is retracted. Uses the library's
`Evaluation` module rather than hand-rolled accuracy: it returns `confusionMatrix`, per-class
precision/recall/F1/support, macro/micro/weighted averages, `logLoss` and `topKAccuracy`.

**This benchmark measures the wrapper, not the decision.** Whether the ELM is good enough is
`TN-B5`, and it is Jam's to run and interpret.

## Test strategy

- **Unit:** as Step 3. The `charSet` guard is a fix-shaped test — red first, watched.
- **Integration:** none needed. The module has no call site by design; integration is Step 4
  of Jam's `TN-J4` and is out of scope here.
- **Architecture:** `domain-isolation.test.js` must stay green — the module sits in
  Foundation and imports nothing from Domain. If it ever needs to, the design is wrong.
- **Any accuracy number** carries seed, baseline, corpus commit, and the committed script.

## Rollback

Cleaner than most of this project's work, because nothing imports it:

1. **Steps 1–4 are additive.** No existing file changes behaviour; revert the commits.
2. **Step 0 is the one with a tail.** Reverting `packages/llm-client/package.json` requires
   re-running `pnpm install` to regenerate `pnpm-lock.yaml` — do not hand-edit it back.
3. **No on-disk state is written** — no `.sourcevision/`, no `.rex/`, no `.hench/`. This is
   the first piece of work in my lane where "revert the commit" is genuinely sufficient.

## Open questions

- **`@n-dx/llm-client` or a new `@n-dx/elm`?** ADR § Open question. Cheap to decide now,
  expensive after two call sites import it. **Blocks nothing before Step 1.**
- **Where does the threshold live?** Next to `PRIMARY_THRESHOLD` (`classify.ts:33`) is Path
  B's call, not mine — my module takes it as a parameter and holds no opinion. Flagged so
  the two of us do not each invent one.
- **Does Path C want the same interface?** Path C is 3 classes with a prose viability gate
  unresolved (`TN-B4`). If it turns out non-viable, this module has one consumer and the
  `@n-dx/elm` extraction argument weakens accordingly.
- **Training data for Path C** does not exist and nobody has scoped it. Path B's corpus took
  a blocked LLM, two repos and a bespoke harness. **Not my lane — flagged so it is not
  assumed to be free.**
