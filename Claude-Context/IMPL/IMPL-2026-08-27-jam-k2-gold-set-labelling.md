# IMPL — 2026-08-27 — K2 gold set: labelling protocol and analysis

**Implements:** [`ADR-2026-08-27-jam-k2-gold-set.md`](../ADR/ADR-2026-08-27-jam-k2-gold-set.md)
**Owner:** Jam (Team Nolan) · **Backlog:** `TN-J20`
**Status:** Packet generated and ready to hand over. Analysis blocked until labels come back.

---

# PART A — For the labeller

**You need nothing from this project except this section. No coding, no setup, no tools beyond a
text editor and the repository.**

## A1. The task

You will be given a spreadsheet of **83 file paths** from a TypeScript/JavaScript codebase. For each
one you record **two judgements**, in this order:

1. **Pass 1 — from the path alone.** Read only the file path. Do not open the file. Write down which
   category you think it is.
2. **Pass 2 — after opening the file.** Now open it, read enough to understand what it does, and
   write down which category it actually is.

**The order matters and cannot be recovered if you get it wrong.** Once you have read a file you can
never un-know it, so pass 1 for a given file must be written before you open it. Doing all 83 pass-1
judgements first, then all 83 pass-2 judgements, is the safest way to guarantee this.

Also record, for pass 2 only:
- **`confident_yes_no`** — were you confident? `yes` or `no`.
- **`notes`** — anything worth saying, especially *why* a file was hard.

## A2. Rules

- **Do not look at any existing classification.** Not `.sourcevision/classifications.json`, not
  anything labelled "archetype", not any output from this project. **You are the reference we are
  checking the machines against.** If you see their answers first, the exercise is worthless.
- **Do not discuss files with Jam or Butter while labelling.** We are both compromised as raters.
- **`unclear` is a real, encouraged answer.** If a file genuinely sits between two categories,
  write `unclear` and say why in the notes. **Do not force a choice** — how often this happens is
  one of the results we most want. It is not a failure to use it.
- **Two categories overlap badly on purpose of study — `service` and `utility`.** Expect to find them
  hard. That difficulty *is* the subject of the investigation, so record it rather than resolving it
  by instinct.
- All 83 paths were verified to exist before handover, so you should not hit any missing files. If one is genuinely gone, write `missing` and flag it — it means something moved underneath us and the row should be excluded rather than guessed.

## A3. The categories

Use exactly these ids. They come verbatim from the tool's own definitions.

| id | Definition |
|---|---|
| **`service`** | **Service layer modules — API clients, data fetching, and business logic orchestration.** |
| **`utility`** | **Shared utility, helper, and infrastructure modules where high fan-in is expected.** |
| `types` | Type definitions, constants, and enums — companion files, not logic. |
| `entrypoint` | Module entry points, public APIs, and CLI entry files where uncalled exports are expected. |
| `config` | Configuration files and settings modules. |
| `cli-command` | CLI command handlers and subcommand implementations. |
| `route-handler` | Server-side HTTP route handlers (Express, Hono, Koa, etc.). |
| `middleware` | Request/response middleware in server frameworks. |
| `store` | State management stores and slices where high fan-in is expected. |
| `gateway` | Re-export-heavy gateway modules that concentrate cross-package imports. |
| `schema` | Runtime validation schemas and data shape definitions (Zod, Yup, Joi, etc.). |
| `hook` | React hooks — custom hooks encapsulating reusable stateful logic. |
| `test-helper` | Test utilities, fixtures, and mocks. |
| `unclear` | **You cannot reasonably decide. Encouraged where true — say why in notes.** |
| `missing` | Path does not exist in the repo. |

**On `service` vs `utility`:** these two genuinely overlap — "business logic orchestration" and
"shared infrastructure module" describe the same file more often than the definitions admit. A rough
heuristic, offered only as a tie-breaker and **not** as a rule to follow mechanically: if the module
*does something specific to this product's domain*, lean `service`; if it *could be lifted into any
other project unchanged*, lean `utility`. **If that heuristic does not settle it, write `unclear`.**

## A4. The file

`scripts/data/k2-goldset-packet.csv` — 83 rows, already shuffled:

```
id, repo, path, full_path_to_open, pass1_path_only, pass2_after_reading_file, confident_yes_no, notes
```

Fill in the last four columns. Leave the first four alone. Hand back the same file.

**⚠️ The 83 files come from TWO different repositories** — 65 from `n-dx-1` and 18 from
`AsterMind-Community-Edition`. That is why there are both a `path` and a `full_path_to_open` column,
and using the right one for each pass matters:

- **Pass 1 — judge on the `path` column.** That short, repo-relative path is *exactly* what the
  machines see. Judging on the absolute path would give you information they do not have and would
  invalidate the ceiling measurement.
- **Pass 2 — open `full_path_to_open`.** It is the absolute location on disk and is already verified
  to exist for all 83 rows.

**It deliberately contains no machine answers. Please do not add any.**

---

# PART B — For whoever runs the analysis afterwards

## B1. Regenerate the packet (only if it needs rebuilding)

```sh
node scripts/elm-goldset-packet.mjs          # writes scripts/data/k2-goldset-packet.csv
```

Deterministic: full held-out split, shuffled with seed 42. Rebuilding produces an identical file.

## B2. Compute the five numbers

Join the returned labels to `scripts/data/elm-archetype-corpus.json` (`heldOut[].label` is the LLM's
label) and to a fresh run of `scripts/elm-feasibility-screen.mjs` (the ELM's predictions).

| # | Comparison | Question |
|---|---|---|
| 1 | human pass-1 vs human pass-2 | **path-information ceiling — the headline** |
| 2 | LLM vs human pass-2 | is the training corpus correct? |
| 3 | ELM vs human pass-2 | **K2 itself** |
| 4 | ELM vs LLM | agreement — what we have measured so far |
| 5 | rater A vs rater B *(if two raters)* | is the taxonomy usable? |

**K2 passes if (3) ≥ (2).**

Report each with its `n`, and exclude `unclear`/`missing` rows from the agreement rates while
**reporting their count separately** — the `unclear` rate is a result, not a nuisance.

## B3. Constraints on the analysis

- **Compare only on the 83 held-out rows.** They were never used to fit the model or the TF-IDF
  vocabulary. Do not extend this to the 241 training rows.
- **Report per-comparison confidence intervals or at least `n`.** 83 rows split across 13 classes is
  thin; `service` (31) and `utility` (29) are the only classes with enough support to say much.
- **The ELM's numbers vary by seed** — the observed spread was 16 pp (51.8–67.5%). Use the same
  multi-seed mean and range as the screen; never a single run.
- **Do not tune anything after seeing these results.** If the model changes in response, the gold set
  is spent and a fresh held-out sample is needed.

## B4. What each outcome means

| Outcome | Reading |
|---|---|
| **(3) ≥ (2)** | **K2 passes.** The local model is at least as right as the LLM. Path B ships behind the confidence gate. |
| **(3) < (2)**, both high | The model is genuinely worse. Path B does not ship; publish the negative. |
| **(2) is low** | **The corpus is wrong**, not the model. Retrain against corrected labels; every archetype label the tool has ever produced is suspect. Escalate beyond Path B. |
| **(1) is low** | **Paths are not enough information** — for the LLM as much as for us. Recommend feeding the classifier file contents. Bigger prize than Path B; currently nobody's scope. |
| **(5) is low** | **The taxonomy is broken.** Fix the class definitions before judging any model. |
| High `unclear` rate | Same as (5): the boundary is under-specified and no classifier can be held to it. |

## B5. After the numbers land

- [ ] Update `TN-J10` — resolved in whichever direction, with the number.
- [ ] Update K2's status in
      [`ADR-2026-08-27-jam-confidence-gated-deployment-and-a-measurable-kill-criterion.md`](../ADR/ADR-2026-08-27-jam-confidence-gated-deployment-and-a-measurable-kill-criterion.md).
- [ ] If K2 passes, Step 4 of
      [`IMPL-2026-08-27-jam-confidence-gated-classification-tier.md`](IMPL-2026-08-27-jam-confidence-gated-classification-tier.md)
      is unblocked.
- [ ] Either way, record the result in `Claude-Context/Nolan-Agents/ELM-FINDINGS.txt` — it is the
      one place every number lives with provenance.
- [ ] Note to Butter: (2) and (1) affect Path A and Path C as much as Path B.

## B6. Cost and honesty notes

- **Estimated one focused session** for 83 files at two passes. Pass 1 is fast (paths only); pass 2
  dominates.
- **The labeller's time is the scarce resource here, not compute.** Everything else in this IMPL is
  free and already built.
- **This gold set is single-use.** Once its labels are known they cannot un-inform later modelling
  decisions. Spend it on a decision, not on exploration.
