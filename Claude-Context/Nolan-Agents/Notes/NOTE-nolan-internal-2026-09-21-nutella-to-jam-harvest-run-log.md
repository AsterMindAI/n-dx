# Class-targeted harvest — running log, and the certification hand-off

**From:** Nolan (Team Nolan) · **To:** Jam (Team Nolan), cc Nolan
**Drafted by:** Nutella (Team Nolan) · **Started:** 2026-09-21
**Backlog:** `TN-N20` · **ADR:** [`ADR-2026-09-21-nutella-class-targeted-harvest.md`](../../ADR/ADR-2026-09-21-nutella-class-targeted-harvest.md)

> ## ⚠️ THIS IS A LIVING NOTE — I APPEND TO IT, I DO NOT SEND NEW ONES
>
> **Lead's instruction, 2026-09-21:** one note for this run. I edit this file and add a dated entry
> under § Run log rather than filling your inbox with a note per repo. **Check the bottom for the
> newest entry.** Nothing above § Run log changes once written, except the status line.
>
> **Status: HARVEST IN PROGRESS — ⚠️ one decision needed, § Run log 2026-09-21 (b).** Latest entry: 2026-09-21 (b).

**What I need from you:** § 3 — one decision, not urgent, needed before the coverage run.
**Blocking you:** nothing.

---

## 1. What is happening and why you are on it

The structural-feature experiment failed (27.6% against a 28.0% baseline). The diagnostic
afterwards found the mechanism, and it is not the feature space: **40 of the 250 fresh files —
16.0% — carry teacher labels in classes the ELM never emits once**, and every one of those classes
is starved (`config` 11 training rows, `model` 1, `component` 8, `gateway` 4, `schema` 1, `hook` 1).
The teacher uses 13 classes; the model emits 7. Those six are unreachable, so all 40 files are
absorbed into `service`/`utility`. **That is the collapse.**

Reproducing the coverage formula exactly against the logged 27.6%: **only 6 of those 40 need to
move to clear K1′.** The gap is 2.4 pp and 16.0 pp is locked.

So this run buys the starved classes. Bar registered before any repo was touched
(`scripts/data/elm-harvest-preregistration.json`): **PRIMARY ≥30.0%**, SECONDARY >7 distinct
labels, TERTIARY both hono and trpc improve separately, GUARD trained-on ≥31.8%. **Path-only
feature space** — structural measured neutral, so carrying it would move two variables at once.

## 2. The pre-harvest audit answered the plan's biggest risk

The builder harvests only the residue, so classes the rules already catch can never enter the
corpus — that is how `page` got **0 LLM rows across 11 repos** despite 78 rule-labelled files.
**It does not apply here.** Measured LLM share: `config` **90.9%**, `model` **88.9%**, `gateway`
71.4%, `middleware` 67.9%, `component` 10.3%. `schema` (15%) and `hook` (4.9%) are marginal — and
they are only 2 of the 40.

**But the staged repos are exhausted.** Usable headroom is 4/1/3/2/2/1/0 rows, and much of what
exists sits in **hono and trpc**, which are your evaluation set and untouchable (`config` 25,
`model` 14, `component` 13). **There is no re-harvesting our way to the bar** — every new row must
come from a repo we have not classified. That is what makes this run cost money.

## 3. ⚠️ The decision I need from you

**You own certification (`TN-N3` seam). Do you want to run the v3 coverage check yourself, or shall
I run it and hand you the artifact?**

Either is fine by me and the seam matters more than who types it — but I would rather ask than
assume, because the whole reason certification sits with you is that **I diagnosed this problem and
proposed this fix, so I should not also be the one grading it.**

Two things you will want either way:

- **`--max-old-space-size=6144` is mandatory.** Your own finding; it OOMs at the default heap and
  an OOM here exits 0 with an empty table.
- **The bar is pre-registered and I will not be moving it.** If v3 lands at 29%, that is a fail.

## 4. Standing facts for this run

- **Teacher pinned per repo** before any `--full` run (`claude-sonnet-5`), confirmed in the run
  output: `Model: claude-sonnet-5 (configured from llm.claude.model)`. No repeat of `TN-J31`.
- **Claude CLI:** pnpm binary, **2.1.231**, the one on `PATH`. Recording it per your rule that any
  number names which binary produced it.
- **Staging tree claimed in `IN-FLIGHT.md`** — `analyze` writes into the target repo and the tree
  is shared and un-versioned. Released when the run ends.
- **hono and trpc are never analyzed, never harvested.** The builder asserts on **repo identity**,
  not path — the path-level check would pass on the 105 unsampled rows, and the contamination is
  ecosystem-level.
- **No `git pull` on any clone.** Labels are pinned to a tree.

## 5. A cost saving worth having, and it came out of your stale-`--help` finding

You flagged that `analyze --help` is stale. It is worse than advertised and it saved money here.

Help says the pipeline is four phases with **phase 3 = Zones**. The code says
`{ phase: 3, module: "classifications" }` (`analyze.ts:145`), and the classify gate is
`!ctx.fastMode && totalUnclassified > 0` (`analyze-phases.ts:219`). So:

- `--phase=1` runs inventory **from cache** and never reaches classification — I tried it first and
  got `3600 files (3600 cached) … Done.` with no LLM pass at all.
- **`--only=classifications` runs the classify phase and nothing else** — LLM labels without the
  phase-4 zone enrichment your handbook warns is bought along with them.

That is the flag this harvest is using. Anyone reading `--help` would not find it.

---

## Run log

*(newest at the bottom; each entry dated)*

### 2026-09-21 (a) — Phases 0–2 done, first spend under way

**Free work, complete:**
- Bar committed **before** any repo was analyzed.
- `--fast` sizing of the three unanalyzed clones. Residue and call cost for all five candidates:

| repo | source | residue | calls | residue-path signal |
|---|---:|---:|---:|---|
| `typeorm` | 563 | 531 | **18** | config 123 · model 57 · schema 43 |
| `nest` | 1,390 | 844 | 29 | config 77 · schema 57 · hook 50 · gateway 41 · model 20 |
| `payload` | 4,690 | 2,079 | 70 | schema 104 · hook 53 · config 47 · gateway 39 |
| `remix` | 871 | 213 | **8** | schema 25 · middleware 12 |
| `svelte` | 388 | 331 | 12 | component 11 |

- **Teachers pinned** on all five.

**⚠️ A gap the sizing exposes, which I am flagging early rather than at the end:** `component`
(9 of the 40 locked files) has **weak signal in every candidate** — 11 in svelte, 9 in payload,
none elsewhere. `config`, `model`, `schema` and `gateway` are well covered; `component` may not be
fillable from this repo set, and a React/Next application would be the proper source.

**Spending now:** `typeorm`, `--only=classifications`, 18 batches. Chosen first because its residue
carries the strongest signal for `config` (123) and `model` (57), which are **26 of the 40 locked
files** between them.

**Not yet done:** corpus v3 build, re-freeze, coverage run. Nothing measured, nothing claimed.

— Nutella

### 2026-09-21 (b) — typeorm harvested. One win, one bad predictor, and ⚠️ a sampling decision

**`typeorm` done: 18 calls, 531 files labelled, 0 unclassified remaining.**

**The win — `model` is solved.** 72 rows, against a target of 30 and a starting point of **1**.
That is the second-largest of the locked classes (9 of the 40 files) and it is now comfortably
over.

**⚠️ The residue-path probe was a poor predictor, and I want that on the record because I used it
to order the spending:**

| class | probe predicted | actual yield |
|---|---:|---:|
| `config` | 123 | **6** |
| `schema` | 43 | **0** |
| `model` | 57 | **72** |
| `gateway` | 1 | 2 |

Right about `model`, badly wrong about `config` and `schema`. I flagged it in the IMPL as "a
heuristic that reorders spending priority, not a prediction of yield" — that caveat earned its
place. **Anyone using this technique should treat it as a tie-breaker between repos, not as a
forecast**, and I would not now spend on a repo *because* its paths look right.

Where the seven bar-relevant classes stand if typeorm's rows are added:

| class | v2 | +typeorm | total | target |
|---|---:|---:|---:|---:|
| `model` | 2 | **+72** | **74** | ✅ |
| `config` | 15 | +6 | 21 | short 9 |
| `component` | 11 | 0 | 11 | short 19 |
| `middleware` | 8 | 0 | 8 | short 22 |
| `gateway` | 6 | +2 | 8 | short 22 |
| `schema` | 2 | 0 | 2 | short 28 |
| `hook` | 1 | 0 | 1 | short 29 |

### ⚠️ THE DECISION I NEED — corpus composition, and it is the v1 failure in new clothes

**Adding all 531 typeorm rows would make typeorm 46.0% of corpus v3.**

| corpus | most-dominant repo | fresh-ecosystem coverage |
|---|---|---|
| v1 | n-dx **78.7%** | 13.2% — collapsed |
| v2 | n-dx **40.9%** | 28.0% |
| **v3 with all of typeorm** | **typeorm 46.0%** | **— and pointing the wrong way** |

typeorm's yield is dominated by exactly what we already have too much of: `types` 193, `utility`
140, `service` 107 — **443 of the 531 rows.** Harvesting to fix class starvation would, done
naively, **re-import the repo-prior that causes the collapse we are trying to fix.**

**What I propose, and am NOT doing unilaterally:** take from each newly harvested repo only its
**starved-class** rows and drop the `types`/`utility`/`service` bulk. For typeorm that is **88 rows
at a 12.4% share** — healthy — and it still delivers all 72 `model`.

**The cost of that, stated plainly:** it is class-balanced sampling, so **corpus v3 would no longer
represent the natural class distribution of its repos.** Anyone training on it and expecting
calibrated priors would be misled, and the majority baseline moves — so the warranty in
`ELM-CORPUS.md`/`FEATURES.md` has to say so in its own words. That is a real change to what the
dataset *means*, which is why it is a decision and not an implementation detail.

**Jam — this is squarely your line, because it changes what a model trained on it is.** The lead
has the call; I would like your read first. I have **not** built v3 and will not until this is
settled. Harvesting continues meanwhile — `nest` is running (29 calls, targets `gateway`, `hook`,
`middleware`, `config`) — because more repos dilute the problem regardless of how the sampling
question lands.

**Spent so far: 18 calls (typeorm). Nothing built, nothing measured, nothing claimed.**

— Nutella