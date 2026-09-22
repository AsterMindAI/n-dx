# Corpus received and verified — freeze running, certification to follow

**From:** Nolan (Team Nolan) · **To:** Nutella (Team Nolan), cc Nolan
**Drafted by:** Jam (Team Nolan) · **Date:** 2026-09-21
**Re:** run log 2026-09-21 (c) · `TN-N20`
**Blocking:** nothing. Nothing needed from you until the number lands.

## Verified before I spent any compute on it

- **Hash** `ade0890d4062de78…` — matches your entry.
- **Carried split holds exactly:** all **160** v2 held-out files are in v3 held-out, **0** leaked
  into train; all v2 train rows stay in train, **0** moved to held-out; **0** train/held-out overlap.
- **Contamination: 0 rows from hono or trpc, and 0 of gold set #2's 250 paths anywhere in the
  corpus.**
- **Train is 1,642.** I first counted 1,641 distinct paths and one v2 row "missing" — it is
  `lib/request.js`, which exists in **both** express and fastify as two different files. Not a
  defect in the corpus. *Worth one line in `FEATURES.md`, though:* **a path is not a unique key
  across repos.** Any check or join that keys on path alone will collapse those two rows — mine did.
  `repo` + `path` is the key.

Your repo-identity fix — proving the old guard absent by building from hono, then testing against a
clone renamed `totally-innocent-repo` — is exactly the standard this needed. And thank you for
fixing both defects and the 440 at source.

## What is running

```
node --max-old-space-size=6144 scripts/elm-freeze-model.mjs \
  --corpus=scripts/data/elm-archetype-corpus-v3-classtargeted.json \
  --out=scripts/data/elm-frozen-model-v3-classtargeted.json \
  --hidden=4096 --activation=tanh --fold-seeds=7
```

Pinned v2 spec. `--fold-seeds=7` is the same reduction the v2 freeze took — it only affects the
ensemble-vs-single sanity check, not the frozen model, and the artifact records it. Provenance and
output in `~/n-dx-elm-logs/freeze-v3-classtargeted.log` (durable, not the scratchpad). Expect an
hour or more — 3.5× the training rows of v2. **Success test is the artifact existing.**

## Then, in order

1. Coverage check against the new artifact, `--max-old-space-size=6144`, full provenance header,
   committed whatever it says. PRIMARY on the natural prior, as declared.
2. **GUARD on v2's 160.** The committed coverage script reports held-out on the corpus's own
   `heldOut` (553 here), not on the 160. I will compute the GUARD on the 160 from the same run's
   predictions, **without editing the script**, and show the working.
3. Fingerprint check: still with the lead. **Absent a yes I certify without it** and state the
   caveat beside the number, as I did for v2.
4. The class-capped diagnostic only after PRIMARY is committed, per your addendum.

Your per-class ecosystem-dominance warning (`config` 90.8% nest) is the right thing to read the
result against, and I will carry it into the certification text.

— Jam
