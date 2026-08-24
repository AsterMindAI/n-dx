# ADR — Where ELM inference lives, what it exposes, and when it trains

- **Status:** Proposed — needs Nolan. Sections 2 and 4 need a **second lead's sign-off** (dependency scope change).
- **Date:** 2026-08-23
- **Author:** Butter (Team Nolan)
- **Supersedes:** none. **Closes an open action item** from [`SYNC-001`](../Nolan-Agents/syncs/SYNC-001-2026-08-11-elm-path-assignment.md) § 5 item 2, open since 2026-08-11.
- **Backlog item:** `TN-B3` (Path A, remaining half)

## Context

Two call sites need ELM inference and neither has it: sourcevision archetype
classification (Path B, `classify.ts:404`, 17 classes) and rex granularity assessment
(Path C, `reason.ts:1481`, 3 classes). Both are Team Nolan's now — Path B is Jam's,
Path C is proposed to Jam, and this module serves both, so it must belong to neither.

**`SYNC-001` § 5 item 2 has been open since 2026-08-11:** *"Decide (a) vs (b) — unblocks
A, B and C alike."* Nobody decided it. Jam flagged it as doctrine-touching and declined
to take it unilaterally, which was correct. It is now blocking my lane, so it goes here.

**The seam that forces the question.** Standing doctrine says the ELM is a registered
vendor, not a fork — `ProviderRegistry.register(vendor, factory)`
(`llm-client/src/provider-registry.ts:96`). But the provider contract is **text-in,
text-out**: `CompletionRequest { prompt: string }` → `CompletionResult { text: string }`
(`types.ts:82-87`, verified). An ELM's native shape is `predict(text) → [{label, prob}]`.

Registered as a vendor, an ELM would have to reverse-engineer structured features out of
a rendered prompt string and re-serialise labels as JSON text — two parsing layers each
way to move one label — and **the probability is destroyed in transit.** That probability
is the entire mechanism of the confidence gate both paths depend on. Worth noting the
existing LLM path already suffers a version of this: it hardcodes `confidence: 0.7`
(`classify.ts:464`), so ELM rows will carry better confidence data than LLM rows do —
but only if the number survives.

**Tier constraints, verified.** `packages/rex` and `packages/sourcevision` both already
declare `"@n-dx/llm-client": "workspace:*"`. The four-tier hierarchy has Domain importing
only from Foundation, enforced by `tests/e2e/architecture-policy.test.js` and
`domain-isolation.test.js`. So a module both domains import must sit in Foundation, or be
duplicated — and duplication is the fork the doctrine forbids.

**One awkward fact:** `@astermind/astermind-community@^3.0.0` is a **root dependency only**
(`package.json:61`). No workspace package declares it. Wherever the module lands, that
package must gain the dependency — see § 4.

## Decision

**1. An ELM tier at the call site, not a registered vendor.** This closes `SYNC-001` § 5
item 2. The standing rule exists to stop ELM being bolted *into the provider files*, where
all three teams collide; a separate module touches none of them. It preserves the
probability, which the vendor path cannot.

**2. The module lives in `@n-dx/llm-client`, in its own namespace, importing nothing from
the four shared provider files.** It is the only existing Foundation-tier package both
domains already depend on. It ships as `src/elm/` with its own barrel, and is **not**
registered with `ProviderRegistry`.

**3. It exposes probability as a first-class return value, not a rendered string.** The
minimum contract:

```ts
export interface ElmPrediction<L extends string = string> { label: L; prob: number; }

export interface ElmClassifier<L extends string = string> {
  /** Ordered best-first. `topK` maps onto sourcevision's existing secondaryArchetypes. */
  predict(text: string, topK?: number): ElmPrediction<L>[];
  /** Returns null below `threshold`, so callers fall through to the hosted path unchanged. */
  classifyGated(text: string, threshold: number): ElmPrediction<L> | null;
}
```

`classifyGated` returning `null` is the fallthrough contract: a call site that gets `null`
leaves its field unset and the existing hosted path handles the item exactly as it does
today. **Disabling the ELM must produce byte-identical output to today.**

**4. Train in-process, per run. Ship no model artifact until measured too slow.** The
hello-world trains 30 samples in milliseconds; the corpus is 324 rows. Serialisation
exists (`ELM.saveModelAsJSONFile()` / `loadModelFromJSON()`) and we are deliberately not
using it yet. **Revisit threshold, set now so it is not argued later: if training exceeds
2 seconds at corpus scale, the ship-vs-retrain question reopens as its own ADR.**

**5. Seeded by default (42, matching `elm-hello-world.mjs`), seed injectable.** An
unseeded model makes every accuracy number unreproducible, which the measurement contract
forbids.

## Alternatives considered

| Option | Why not |
|--------|---------|
| **Register ELM as a `ProviderRegistry` vendor** (the standing doctrine, read literally) | The probability is lost crossing a text-in/text-out seam, and the confidence gate is the whole design. Also forces edits to `provider-registry.ts` / `provider-interface.ts` — the shared files all three teams have reason to touch. Jam's § 4 analysis in `SYNC-001` reached the same conclusion independently. |
| **A new Foundation package, `@n-dx/elm`** | Semantically the cleanest — an ELM is not an LLM, and putting it in `llm-client` broadens that package's charter beyond what `CLAUDE.md` describes. Rejected **for now** only on cost: a new package means build/test/export wiring and a tier entry in the architecture docs, to serve two call sites that do not exist yet. **This is the option to revisit if a third consumer appears** — the module is namespaced under `src/elm/` precisely so extracting it later is a move, not a rewrite. |
| **Put it in sourcevision, let rex import it** | Domain-to-domain import. Banned by the tier rules and caught by `domain-isolation.test.js`. Non-starter. |
| **Duplicate a small wrapper in each domain package** | Two copies of inference logic drifting apart is exactly the fork the standing doctrine exists to prevent. |
| **Ship a pre-trained model artifact from day one** | Solves a performance problem nobody has measured, and adds a retraining/versioning policy we would then have to maintain. Deferred behind a stated threshold instead. |

## Consequences

**Easier.** Both call sites get inference with a real probability. Neither path forks the
library. Path C can start against the same module. Extraction to `@n-dx/elm` stays cheap.

**Harder.** `@n-dx/llm-client`'s charter widens from "vendor-neutral LLM foundation" to
"…and local inference". `CLAUDE.md` describes the Foundation tier and would need a line —
and `CLAUDE.md` is on the shared "nobody edits unilaterally" list, so that is a claim and a
separate small PR, not a drive-by edit.

**Needs a second lead's sign-off — dependency scope change.**
`@astermind/astermind-community` must be added to `packages/llm-client/package.json`. It is
**not a new vendor** — it is already a root dependency, approved in `43d6db51` — but it is a
new *workspace* dependency and it churns `pnpm-lock.yaml`, which is on the shared list.
Doctrine: announce in `IN-FLIGHT.md` **before** `pnpm add`, resolve any lockfile conflict by
re-running `pnpm install`, never by hand-merging. **I am flagging this rather than treating
"already at root" as permission.**

**Breaks nothing.** No existing behaviour changes. Nothing is registered, no provider file
is touched, and with the tier disabled output is byte-identical to today.

**Other teams affected — notes not yet sent, deliberately.** This binds Path C, and Paths A
and C were offered to Jarrett and Thomas. Notes go out **on acceptance**, not before;
circulating an unaccepted ADR as though it were settled is the mislabelling the measurement
contract exists to prevent. The ADR is on `Nolan-Work` and visible to anyone who merges.

## Evidence

**This ADR makes no ELM-viability or accuracy claim**, so the accuracy-evidence requirement
does not bind it. It is a placement and interface decision. What it rests on:

**Verified by reading, at `1077c766`/`5e24f80a`:**
- `CompletionResult` carries only `text` and `tokenUsage` (`llm-client/src/types.ts:82-87`) —
  the basis for "the probability is lost".
- `ProviderRegistry.register` at `provider-registry.ts:96`.
- `packages/rex` and `packages/sourcevision` both declare `"@n-dx/llm-client": "workspace:*"`.
- `@astermind/astermind-community` is declared at root `package.json` only; no workspace
  package declares it.
- The LLM path hardcodes `confidence: 0.7` (`classify.ts:464`).

**Inherited, with its provenance, and NOT re-derived here:**
- Library gotchas from `scripts/elm-hello-world.mjs`: `charSet` is interpolated unescaped
  into a RegExp character class so a literal `-` must come **last**; text training requires
  `useTokenizer: true`; npm latest is `3.0.0`, v4 is tagged but unpublished and breaking —
  **do not chase v4**.
- The hello-world's 66% floor is **3 classes, 6 held-out samples, seed 42, 33% baseline**.
  It is evidence the library trains and generalises under Node. **It is not evidence about
  the 17-class task** and is not offered as such.
- The corpus is 324 rows / 13 classes / seed 42 / 241-83 split, majority baseline **38.0%**
  (Jam, `2e6a3e43`).

**Explicitly not measured:** no ELM has been trained on the corpus; this module does not
exist; and **nothing here asserts the ELM will clear any bar.** Whether it can is
`TN-B5`/`TN-J4` Step 3, and it is a separate question from where the code lives.

## Open question for the leads

**Does `@n-dx/llm-client` widening its charter bother you enough to pay for a package?** I
have recommended the cheap option and namespaced it so the expensive one stays available. If
the answer is "extract it now", that is a reasonable call and the IMPL changes by one step —
it is much cheaper to decide before the code exists than after two call sites import it.
