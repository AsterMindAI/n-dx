# Team Sync 001 — 2026-08-11 — ELM path assignment

> **Cross-team.** Filed in Team Nolan's `syncs/`; linked from Jarrett's and Thomas's `Notes/`.
> **This is a decision document for the three leads.** It does not assign anything.

**Team:** Team Nolan · **Prepared by:** Jam (agent) · **Other leads:** async — Jarrett, Thomas
**Source:** [`ADR-2026-08-11-jam-elm-replacement-survey-and-split.md`](../../ADR/ADR-2026-08-11-jam-elm-replacement-survey-and-split.md) (Proposed)
**Next sync:** when the three of you have picked paths

---

## 1. What the survey found

Every LLM call in the repo runs through two chokepoints — `callClaude`
(`sourcevision/analyzers/claude-client.ts:145`) and `spawnClaude` (`rex/analyze/llm-bridge.ts:135`)
— plus hench's CLI agent loop. **22 call sites. Only 2 can be replaced by an ELM.**

The dividing line is output shape: an ELM emits a label from a closed set. It cannot write prose.
The other 20 sites generate PRD trees, zone names, descriptions and findings, and stay on a hosted
model. That is not a limitation to engineer around — it is the answer.

Two corrections to what we assumed going in:

- **rex placement is already deterministic** (`core/move.ts:91`, `core/structural.ts:125`;
  `rex/src/recommend/` has zero LLM calls). There is no token spend there to remove.
- **`enrichClassificationsWithLLM` is the classification path despite its name.** The `enrich*.ts`
  files are generation and are not replaceable. Easy to conflate; worth keeping in separate hands.

---

## 2. The three paths

### Path A — ELM inference module + measurement · `packages/llm-client/`

Build the shared ELM wrapper (load, train, predict, expose confidence), and **fix token
accounting**.

**Importance: highest, and it gates the other two.** All 6 stored runs in `.hench/runs/*.json`
record `tokenUsage {"input": 0, "output": 0}`, and this checkout has no `.sourcevision` artifacts.
We are running a project to minimize token usage with **no way to measure token usage**. Until that
is fixed, neither B nor C can state what they saved — we would finish with an anecdote instead of a
number.

Path A also owns the one architectural decision in § 4, and the only shared files in the split.

### Path B — sourcevision archetype classification · `packages/sourcevision/src/analyzers/`

The 17-class task at `classify.ts:404`, behind a confidence threshold with LLM fallback.

**Importance: highest token value.** This is the only site with real volume — classification runs
across ~1,319 files in batches of 30 (`LLM_BATCH_SIZE = 30`), with up to 3 retries per batch. If
ELM works anywhere, this is where it pays.

**It is also the only path whose feasibility is genuinely unknown.** 17 classes against a 5.9%
random baseline; our only evidence is a 3-class smoke test at a 33% baseline. Several labels are
semantically adjacent (`route-handler`/`route-module`, `service`/`utility`, `model`/`schema`/
`types`) and may not separate on path features at all. A well-run Path B can honestly return "no" —
that is a publishable finding, not a failure, and we should agree on that *before* someone is
holding a bad accuracy number.

Good raw material: `BUILTIN_ARCHETYPES` labels training data for free, and `classify.test.ts:394+`
is a ready regression harness.

### Path C — rex granularity assessment · `packages/rex/src/analyze/`

The 3-class enum at `reason.ts:1481` (`break_down` / `consolidate` / `keep`).

**Importance: lowest token value — it fires rarely.** Its real value is as our cheapest proof that
an ELM can sit in a production path at all.

**One gate before any code:** that call returns the enum *plus* prose (`reasoning`, `issues[]`)
that the CLI renders to users (`reason.ts:1456-1466`). An ELM gives you the label only. If we
decide the prose must stay, **this path is not viable** — the prose is the expensive part of the
call, not the label. Decide that first; it is a product question, not a technical one.

---

## 3. Should we split Path B?

**Recommendation: not into two teams — but yes, into two phases with a real go/no-go between them.**

Splitting B across two teams means two people editing `classify.ts` and its test file, which is the
merge collision the whole by-package split exists to avoid. The work also doesn't divide cleanly:
you cannot tune a model and integrate it into a call site in parallel, because the integration
depends on what the accuracy turns out to be.

What it *does* divide into is sequence:

- **B1 — feasibility.** An offline seeded benchmark script (the `scripts/elm-hello-world.mjs`
  pattern) answering "can an ELM do 17-class archetypes at all", reported against the 5.9%
  baseline. Touches no production code, so nothing is wasted if the answer is no.
- **B2 — integration.** Only if B1 clears a bar we agree on *in advance*. Confidence threshold,
  LLM fallback, regression against the existing tests.

If a second person joins B, the clean second job is **the labeled corpus** — extracting training
data from the deterministic pass and the existing tests. That is separable, useful whatever B1
returns, and touches different files.

**Set the B1 bar now, before anyone has a number to argue with.**

---

## 4. The one architectural decision we owe

Standing doctrine says the ELM is a registered vendor, not a fork. On reading the contract, the
provider seam is **text-in, text-out** — `CompletionRequest {prompt: string}`,
`CompletionResult {text: string}` (`types.ts:68-87`). An ELM's native shape is
`predict(text) -> [{label, prob}]`.

Registered as a vendor, an ELM would have to reverse-engineer structured features out of a rendered
prompt string and re-serialize its labels as JSON text — two layers of parsing each way to move one
label, and **the confidence score is lost**, which is exactly what a fallback threshold needs.

| | (a) registered vendor | (b) ELM tier at the call site |
|---|---|---|
| Confidence score | lost | kept |
| Shared files touched | `provider-registry.ts`, `provider-interface.ts` | none |
| Fits our 2 candidates | poorly | well |

**(b) does not break the standing rule.** That rule exists to stop ELM being bolted *into the
provider files*, where all three teams collide. (b) touches no provider file — it adds a tier ahead
of the existing call and falls through to the untouched hosted path below a threshold.

Jam's read: **(b) for both candidate sites; (a) buys us nothing we currently need.** Flagged as a
decision rather than taken, because it touches doctrine.

---

## 5. Action items

| # | Owner | Action | By |
|---|---|---|---|
| 1 | Three leads | Pick paths. A first if we are sequencing. | Next sync |
| 2 | Three leads | Decide (a) vs (b) from § 4 — unblocks A, B and C alike | Next sync |
| 3 | Three leads | Set the B1 go/no-go accuracy bar *before* B1 runs | Before B1 |
| 4 | Whoever takes C | Product call on the granularity prose — viability gate | Before any C code |
| 5 | Whoever takes A | Token counters (`TN-J3`, unclaimed) | Ahead of ELM work |

## 6. Open questions

- **Sequencing vs parallel.** All three paths need A's measurement work to report a result. Argues
  for A starting first and narrow, rather than three teams starting at once.
- **Model lifecycle, unanswered.** Where a trained model lives, whether it ships in the package,
  when it retrains. Worth checking early whether it can simply **retrain in-process each run** —
  the hello-world trains in milliseconds. If so this question disappears; if not, it is real work
  nobody has scoped.
- **Scopes are still formally unassigned** in `OWNERSHIP.md`, and `IN-FLIGHT.md` was unused until
  2026-08-11. "The board is empty" is currently weak evidence that nothing is in flight.

---

*Prepared by Jam (Team Nolan) under `TN-J1`. Everything above is verified at `file:line` against
commit `ef99e4e3`; no ELM viability claim is made anywhere in it.*
