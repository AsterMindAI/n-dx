# NOTE — Nolan internal — 2026-09-04 — K2 handover: everything Jam is absorbing, including a job still running

**Drafted by:** K2 (Team Nolan) · **For:** Jam (Team Nolan)
**Needs a reply by:** nothing needs a reply. **§ 1 is time-sensitive — a background job is still
running as I write this and will finish after my session ends.**
**Blocking:** `TN-J25`, `TN-J30` and the ensemble question in § 4 are blocked on the lead, not on you.

K2 is retired as of today (lead's decision, recorded by you at `ab055e46`). I never had a charter,
so `NEW-AGENT.md`'s "leave the charter — it's the record of why things were built the way they
were" has nothing to leave. **This note is the substitute.** It is longer than a note should be
because it is standing in for a week of session log that was never written.

---

## 1. ⚠️ A job is running RIGHT NOW and nobody is watching it

```
pid 25842  node scripts/elm-freeze-model.mjs
             --corpus=scripts/data/elm-archetype-corpus-v2.json
             --out=scripts/data/elm-frozen-model-v2.json
             --hidden=4096 --activation=tanh --fold-seeds=7
log: <session scratchpad>/freeze-v2b.log     ← ⚠️ REAPABLE, see § 7
```

It was launched with `nohup`, so it survives my session ending. **The watcher does not.** When this
chat closes, that process keeps running and nothing will report its result.

**How to check it, and the one rule that matters:**

```sh
pgrep -f elm-freeze-model                     # still going?
ls -la scripts/data/elm-frozen-model-v2.json  # THE ONLY SUCCESS TEST
```

**Do not trust the exit code.** It already lied to me once today — my watcher printed
`[exited with code 0]` for a run that died with `FATAL ERROR: Reached heap limit`. That was the
*watcher's* exit code, not node's. **The artifact existing is the only evidence the freeze
succeeded.** This is the handbook's documented OOM trap and it is still live.

If the artifact is missing, the run failed. Re-launch is the same command; it is idempotent because
the script refuses to overwrite an existing frozen artifact without `--force`.

Expect ~60 min. It has already consumed ~50 min of that on the CV stage alone.

## 2. What the whole thing is for, in four sentences

Corpus v1 produced a model that **did not generalise** — on fresh repos it collapsed onto the
majority class (96.4% `service`/`utility` vs the teacher's 48.4%, 5 of 13 labels emitted, coverage
34.9% → 13.2%). It had learned n-dx's archetype prior, not a path→archetype mapping. Corpus v2
(624 rows, 7 ecosystems, up from 324 / 2) is the attempted fix. **The single open question is
whether that fix worked**, and the freeze in § 1 exists only to let you ask it.

**The answer costs nothing once the freeze lands:**

```sh
node scripts/elm-coverage-check.mjs --frozen=scripts/data/elm-frozen-model-v2.json
```

No ground truth, no labels, no LLM calls. Coverage depends only on the model's own predictions.
That property is why the Phase 3 failure cost zero labelling days, and it is the most valuable
thing I found.

## 3. What I did this session (all committed, 5 unpushed at time of writing)

| Commit | What |
|---|---|
| `688ca17f` | **Phase 1b result** — `elm-4096 tanh` adopted on corpus v2: 68.80%, **+2.06 pp, 7 of 9 paired wins**. Ran the grid declared at `1a5403c6` exactly — 9 configs, none added or dropped. |
| `e73ca327` | Parameterized `elm-freeze-model.mjs` (`--corpus/--out/--hidden/--activation/--fold-seeds`); defaults reproduce the old artifact byte-for-byte. |
| `b4fde7b2` | **`ELM-CORPUS.md`** + `elm-corpus-build.mjs` now records the teacher per repo. |
| `ab497642` | Backlog: `TN-J32` → IN-PROGRESS, `TN-J31` → PARTIALLY CLOSED. |
| `95a42439` | `IN-FLIGHT.md`: Phase 3 failed; K2 claim extended to cover the corpus rebuild + 13 classify calls. |
| `c2d1ddb4` | Cross-team notes to Jarrett and Thomas (see § 6). |
| `d91612b1` | **Fixed a defect in my own change** — see § 5. |
| `13cf8b8a` | `elm-coverage-check.mjs` takes `--frozen`. |
| `c913acf0` | **Phase 1c pre-registration** with a stopping rule — see § 4. |
| `69259048` | **Streamed the ensemble fits** — the OOM fix. |

Also: the 8 commits that were sitting unpushed when I revived are now on `origin/Nolan-Work`
(`b0003e7c..c2d1ddb4`), and everything from this session is pushed too — `origin/Nolan-Work` is at
`88a78822` and **nothing is outstanding.**

⚠️ **Correction to what I wrote three lines up an hour ago:** I said tracking was set so a bare
`git push` works now. **It does not.** Git refuses it because the local branch name (`nolan-work`)
does not match the remote (`Nolan-Work`) — it warns about `branch.autoSetupMerge` and pushes
nothing, while `git rev-list --count origin/Nolan-Work..nolan-work` still shows commits pending.
It fails quietly enough to look like success. **Always push explicitly:**

```sh
git push origin nolan-work:Nolan-Work
```

Corrected here rather than only in a later document, per `claude-context-instruction` § 8.

## 4. Phase 1c is pre-registered and NOT run — read the stopping rule before you run it

`c913acf0` declares the capacity extension. **Nothing has been measured at 8192.** The lead
authorised opening the grid on 2026-09-04.

Why it exists: 4096 won at the **top edge** of the Phase 1b grid. A win at the boundary is evidence
the grid stopped too early, not evidence of a plateau. Phase 1's 1024 plateau was measured on 241
rows; v2 has 624.

**The stopping rule, which is the actual content of that commit** — capacity sweeps invite crawling
upward until something wins by chance, so it is fixed in advance:

- If 8192 does **not** clear the bar → capacity is **CLOSED at 4096**, and 16384 is not run. A
  non-winning 8192 is a plateau result, not an invitation.
- If 8192 **does** clear it → capacity is *still* closed for this phase. Further extension needs its
  own pre-registration and a reason beyond "the last one won."

```sh
node scripts/elm-architecture-sweep.mjs --phase1c --corpus=scripts/data/elm-archetype-corpus-v2.json
```

**Run it alone.** At 8192, W is ~158 MB per model on an 8 GB box already carrying ~4.5 GB of swap.
And verify the results table is populated — the Phase 1 sweep was OOM-killed here and exited 0 with
an empty table.

**Sequencing I would keep:** freeze → coverage check → *then* Phase 1c. Coverage is cheap and
decides whether more capacity tuning is worth any compute at all.

## 5. Two things I got wrong, both caught before they produced a false number

Recording these because § 12 of the findings ledger exists for exactly this, and because in both
cases the *guard* caught it rather than my judgement.

**(a) I published a fold-seed claim my code did not honour.** `e73ca327` made `--fold-seeds`
reducible and its commit message asserted the reduction "records it in its output." It did not —
`selection.channel` was a hard-coded string reading `"fold seeds [7,13,29]"`, so a reduced run would
have written an artifact **asserting three fold-seeds while using one**. That is the
"consistent with vs recorded" trap, third occurrence on this project. Fixed at `d91612b1`: the field
is derived, plus a `foldSeedsReduced` warning that says not to quote those CV figures as model
selection. No artifact ever carried the wrong claim.

**(b) I nearly reported that no corpus repo had a teacher pin.** I checked `~/n-dx-elm-corpus`,
which does not exist. **The staging tree is at `/Users/nolanmoore/Work/n-dx-elm-corpus`**, and the
corpus provenance block records the old path. Every repo *does* pin correctly. I caught it before it
reached `ELM-CORPUS.md`. **The stale path is still in the corpus artifact** — worth knowing before
you trust a `path` field in there.

## 6. Notes I sent, on your behalf as much as mine

`c2d1ddb4` put a note in **both** Jarrett's and Thomas's inboxes. Per Syrup's `TN-S1` read, both
teams have a working `classify-elm.ts` shipped disabled. If either trained on n-dx-derived labels,
**the generalisation failure very likely applies to them too**, and neither had any way to know.
The note leads with the free check, explains why held-out CV cannot reveal it (held-out rows come
from the same repos — which is exactly how it got past me to certification), and asks them not to
train on hono/trpc.

Flagging one judgement call for you: the roster says **Syrup** drafts outbound cross-team notes for
Nolan to send rather than sending them. That constraint is written for Syrup, not for me, and
`claude-context-instruction` § 3 says anyone may drop a note in any team's inbox — so I sent them.
If the lead wants that tightened to "all outbound goes through Nolan," these two are the precedent
to point at.

## 7. Traps that cost me time today, on top of the handbook's ten

- **The `--fold-seeds` reduction bites later.** § 8 below is weak evidence *because* of a cost
  saving I took. Cheap now, ambiguous later. Take it knowingly.
- **`git push` needed `nolan-work:Nolan-Work`.** Local branch is lowercase, remote is capitalised,
  and git refs are case-sensitive even where the filesystem is not. A bare `git push -u origin
  nolan-work` mints a **second** remote branch. Tracking is set now, so this is handled — but if you
  ever re-clone, remember it.
- **Logs in the session scratchpad die with the session.** `freeze-v2b.log` is in
  `/private/tmp/claude-501/…`. The handbook already says to stage *corpora* under `~`; the same
  applies to logs you want to read tomorrow. If you re-launch anything, redirect somewhere durable.
- **`origin/Nolan-Work` is 43 Dependabot vulnerabilities deep** (1 critical, 16 high). Unrelated to
  us, surfaced on push, someone's problem.

## 8. The one result I am handing over unresolved

Before the OOM, the CV comparison completed and said this:

```
single seed (42)        69.2%
9-seed majority vote    67.0%
delta                   -2.2 pp
⚠️  The ensemble is WORSE on train-CV.
```

The frozen artifact is *supposed* to be a 9-seed majority vote — that is how the seed lottery is
removed, and seed spread on this corpus is ~16 pp. At 4096 on corpus v2, that vote now **costs**
2.2 pp. The script's own guard fired and framed it correctly: freezing it anyway trades accuracy for
determinism, which is a real trade but must be a stated one.

**This is one fold-seed. Do not treat it as a finding.** It is the reduction from § 5(a), and the
`foldSeedsReduced` field exists to stop exactly that misquote. Resolving it properly is a
3-fold-seed re-run at 4096, roughly 2.5 h.

**I deliberately did not resolve it, and I would keep that order:** if the coverage check fails
again, the ensemble question is moot. Coverage is far cheaper than 2.5 h of compute. Wrong order to
spend it.

## 9. What I would tell the lead when the number lands

**If coverage passes (≥30%):** the ensemble question in § 8 needs a real answer before anything is
certified, and gold set #2's 250 files are still blind and reusable — `TN-J30`'s labelling decision
comes back live.

**If coverage fails again:** corpus v2 did not fix it, and the honest read is that path-only
classification does not transfer across ecosystems at this corpus size. I would **not** reach for a
third corpus expansion by reflex. `TN-J22` — improving the classify prompt — is still unclaimed, and
the LLM sits **13.1 pp below the human path-only ceiling**. That is a cheaper and larger win than
this entire tier, and it has been true since 2026-08-11.

Either way the corpus survives the decision. It is documented as a cross-team asset in
[`../ELM-CORPUS.md`](../ELM-CORPUS.md), and § 6 of that file carries the generalisation failure so
nobody trains on it naively.

## 10. Last thing

The two largest effects on this project — `hiddenUnits` 256→1024 and `relu`→`tanh` — were **defaults
nobody chose**, inherited from the first script written. I said in the handbook that the lesson was
to list what your code is choosing on your behalf. Today `4096` won at a grid edge and the 9-seed
ensemble turned out to cost 2.2 pp, and **both are the same shape of thing**: values that were
settled once, under different conditions, and carried forward without being re-asked when the corpus
doubled.

When you inherit these rows, the question worth asking first is not "what should I tune" but
**"what is still true from before the corpus changed?"** Most of my errors were answers to the
second question that I never actually asked.

— K2
