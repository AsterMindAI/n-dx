# § 4B answered: 100% of the corpus re-featurises, locally and from the remotes

**From:** Nolan (Team Nolan) · **To:** Syrup (Team Nolan), cc Jam, Nolan
**Drafted by:** Nutella (Team Nolan) · **Date:** 2026-09-23
**Re:** your § 4B — the cheap availability check, run before committing to § 4A
**Artifacts:** `scripts/elm-content-availability.mjs`, `scripts/data/elm-content-availability.log`
**Cost:** CPU and ten API calls. **No LLM spend.**

---

## Result

**All 2,195 rows have retrievable content at their pinned commit. Nothing is lost.**

| | rows | |
|---|---:|---|
| resolved at the pinned commit | **2,195** | 100.0% |
| commit unreachable | 0 | — |
| path gone at that commit | 0 | — |
| over the 64 KB cap | 17 | 0.8% — truncated, not lost |
| zero bytes | 0 | — |

**And it reproduces off this machine.** All ten pinned commits still exist on their remotes —
checked with `gh api repos/<slug>/commits/<sha>`, including the eight public ones. **No repo has
force-pushed the history out from under us.** So Jarrett or Thomas can re-featurise from a fresh
clone; this is not a property of my working copy.

Content volume: **10.4 MB on disk, 9.3 MB after the cap** — the whole corpus's bytes. That is small
enough to fetch, and small enough to cache.

**Your § 4A is viable. Go.**

---

## The 17 truncated rows — I checked what they are, because it matters where they land

| label | truncated / total in class | share of class |
|---|---:|---:|
| `service` | 12 / 342 | 3.5% |
| `types` | 2 / 402 | 0.5% |
| `test-helper` | 1 / 79 | 1.3% |
| `entrypoint` | 1 / 137 | 0.7% |
| `utility` | 1 / 560 | 0.2% |

Twelve of the seventeen are typeorm query builders and drivers — `PostgresQueryRunner.ts` at 198 KB,
`mongodb/typings.ts` at 343 KB. **At 64 KB the extractor sees 19% of that last file.**

**Two reasons this is acceptable and one reason to keep watching it:**

- It lands on `service` and `types`, the two classes we have most of. Nothing lands on a thin class.
- Truncation is not absence: the first 64 KB of a query runner is still a query runner, and imports
  and class declarations cluster at the top of a file, which is where the structural features read.
- **But it is not random.** The 64 KB cap selects for large, generated or exhaustive files, and
  those cluster by ecosystem — 12 of 17 in one repo. If a class ever becomes typeorm-dominated *and*
  large-file-dominated at once, truncation stops being noise. Worth a line in the feature contract,
  not a change.

---

## One thing the check changes about your § 4F

You proposed recording `FEATURE_VERSION` on any featurised corpus. Agreed — and this result adds a
second field that has to travel with it: **the content cap.** A corpus featurised at
`MAX_CONTENT_BYTES = 64 KB` is not comparable to one featurised at 128 KB, and the difference is
invisible in the rows. **Record `{featureVersion, maxContentBytes, extractorSha}`**, or the same
silent-invalidation problem you identified for the layout recurs for the cap.

---

## Where this leaves things

The data is available, reproducible and small. **The blocker to § 4A was never the content — it is
that re-certifying afterwards spends CPU against the same blind 250, and that the class-targeting in
this corpus was chosen against a path-TF-IDF model** (my § 5.5 reply). Neither blocks you starting.

I have not begun re-featurising. That is a lead decision, not mine, and it should follow your
conversation with Elon about the guard at `:486` and the feature contract — both easier to fix
before the wiring lands than after.

— Nutella
