# Certification: all four criteria pass — and the three things that must travel with that sentence

**From:** Nolan (Team Nolan) · **To:** Nutella (Team Nolan), cc Nolan, Syrup
**Drafted by:** Jam (Team Nolan) · **Date:** 2026-09-22
**Re:** `TN-N20` Phase 7 · run log 2026-09-21 (c)
**Artifacts:** `a5bee0b7` (certification), `719dd985` (frozen model), `c2c0b3ed` (GUARD instrument)

---

## 1. The result

Measured against the bar you registered at `2f8cb926`, **before the corpus existed**.

| criterion | test | result | |
|---|---|---:|---|
| **PRIMARY** | fresh coverage ≥ 30.0% | **47.2%** | **PASS** |
| **SECONDARY** | distinct labels > 7 | **12** | **PASS** |
| **TERTIARY** | both repos improve separately | hono 35.8→**80.2**, trpc 24.3→**31.4** | **PASS** |
| **GUARD** | v2's 160 held-out ≥ 31.8% | **36.9%** | **PASS** |

**The class starvation is fixed.** The model emits **12 of the teacher's 13 classes** on repos it
has never seen, including every class it previously could not produce at all: `model` 8, `gateway`
3, `config` 2, `middleware` 2, `schema` 1, `component` 1. Service/utility share fell **96.4% (v1)
→ 87.2% (structural) → 58.8%**, against a teacher's 48.4%.

**The GUARD is the part I find most persuasive.** 36.9% on the identical 160 files where v2 itself
scored 33.8% — the in-distribution case did not just survive, it improved. Nothing was traded away.

Your diagnosis was right, and it was right for the stated reason: 40 files locked behind six
unreachable classes, 6 needed to move, and buying those classes moved them.

---

## 2. What this does not show — your own clause, and I am holding you to it

**Coverage counts predictions outside `service`/`utility` whether or not they are correct.**
Clearing 30% proves the prior widened. It does **not** prove the predictions are right. Precision
needs the blind 250 labelled — the one irreversible spend — and is capped by the teacher's 72.3%
agreement with human judgement. **No accuracy claim is made here, and any report of this number
must carry this paragraph.**

The risk you flagged in advance — a model over-predicting starved classes clearing the bar
mechanically — is **live, and visible in the per-repo split**:

| | ELM says S/U | teacher says | reading |
|---|---:|---:|---|
| **hono** (80.2%) | **22.2%** | 45.7% | now **under**-predicts S/U; calls 38 of 81 files `types` |
| **trpc** (31.4%) | **76.3%** | 49.7% | still **over**-predicts S/U; clears by 1.4 pp |

**Opposite biases on the two fresh repos, and the 47.2% average hides both.** hono's 80.2% is not
the tier being right about hono; it is the prior having swung past the teacher in the other
direction. trpc is the honest case and it barely clears.

So: **PASS on every declared criterion, and a pass that is necessary, not sufficient.** Your
per-class ecosystem-dominance warning (`config` 90.8% nest) is the right lens for what comes next —
the classes that got cheap are the ones one repo supplied.

---

## 3. ⚠️ A defect you need before anyone reads the logs

**`elm-coverage-check.mjs:156-157` prints a hardcoded verdict.** Unconditional `console.log`:

```
and collapses where it was not (58.8% vs 48.4%).
It learned this corpus's archetype prior, not a general path->archetype mapping.
```

Written for the v1 failure, never made conditional, **printed for any model regardless of its
numbers**. Both committed logs therefore end with a narration that contradicts the result directly
above it. **Nobody should quote that block**, and the next person to run this will be misled by it
unless it is fixed. It is my line; I will not touch that file without the lead's yes, which is the
same standing request as the fingerprint check.

Two more that belong beside the number:

- **The vocabulary cap binds for the first time.** v2's corpus produced 2,890 terms under a 4,000
  cap; this one fills it, so the rarest terms are dropped. The spec is honoured as pinned, but the
  effective feature space changed between v2 and v3 — worth a line in `FEATURES.md`.
- **The refit fingerprint is still unverified.** The artifact carries one; the script never checks
  it. Every figure here is faithful-by-construction rather than verified.

---

## 4. Method, so it can be re-run

- **GUARD instrument validated before use** (`c2c0b3ed`): the 160-file path reproduced v2's
  **33.8%** exactly — same coverage, same S/U share, same label count — against the v2 model. It
  measures what the script's native held-out path measures.
- Provenance headers written **before** each run: repo commit, script and model hashes, corpus and
  row count, full invocation including the heap flag. In
  `elm-{coverage,guard160}-v3-classtargeted.log`.
- Script **unmodified at HEAD**. The 160-file GUARD used the existing directory mode rather than
  an edit.
- `--max-old-space-size=6144` throughout, and the artifact-exists test rather than the exit code.

---

## 5. What I am not doing, and what is yours

- **The class-capped diagnostic is yours to trigger**, per your addendum: after PRIMARY is
  committed, which it now is. It can never change this verdict, and it is the cheapest way to show
  how much of the 47.2% is mechanical. Given § 2, I think it is worth running.
- **`TN-J22` remains unclaimed and remains the only lever on label quality.** Nothing here improves
  the teacher. Raising it a fourth time.
- **The blind 250 stay blind.** Coverage needed no labels, so they are unspent and reusable.

Good work. The pre-registration held through a failure and a pass, which is the harder direction.

— Jam
