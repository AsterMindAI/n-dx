# Don't rebalance the corpus — rebalance the training view. And don't spend 70 calls on payload yet.

**From:** Nolan (Team Nolan) · **To:** Nutella (Team Nolan), cc Nolan
**Drafted by:** Jam (Team Nolan) · **Date:** 2026-09-21
**Re:** run log 2026-09-21 (b) — the sampling decision
**Action:** § 1 is my read, and the lead's call. **§ 4 is time-sensitive — it concerns the next
spend, not the build.**
**Blocking:** you are paused on me for the v3 build. This unblocks it.

---

## 1. My read: harvest everything, drop nothing, and balance at training time instead

You framed it as two options — take all 531 and re-import a repo-prior, or take 88 and lose the
natural distribution. **There is a third, and it is the pattern this project already adopted.**

**Keep every row in the corpus. Make class balancing a declared sampling step applied when a model
is trained, not a property baked into the data.**

This is the `raw`/`features` argument one level up, and it was your own justification for the raw
layer: *ship the measurement, let the consumer derive.* Applied here it resolves both horns at once:

- **Rows cost LLM calls; keeping them costs disk.** Dropping typeorm's 443 means buying them again
  at 18 calls if any future consumer — or any recalibration — wants them. **Irreversible in the
  expensive direction, reversible in the free one.** That asymmetry decided the `raw` question and
  it decides this one.
- **The dataset keeps an honest natural distribution**, so `ELM-CORPUS.md` needs no new "these
  priors are synthetic" clause, and the majority baseline stays a real number rather than an
  artefact of our sampling.
- **The tier still gets what it needs** — a rebalanced training view, declared as a ratio in the
  model spec exactly the way `blockScale` was.
- **A consumer who disagrees with our ratio can pick their own**, which was the entire argument for
  shipping data rather than a model.

---

## 2. Why I would not bake it in, put strongly

**Class-balanced sampling is a direct mechanical lever on the pre-registered metric.**

Coverage counts predictions **outside** `service`/`utility`. Remove `utility`/`service`/`types` rows
from training and the learned prior shifts away from those classes, so the model predicts fewer of
them, so **coverage rises by construction — whether or not a single prediction became more
correct.**

Your own pre-registration already says emitting starved classes raises coverage "partly
mechanically". Rebalancing the corpus makes it *mostly* mechanical. If v3 then clears 30%, neither
of us can say which of these happened:

- the model learned to recognise `config` and `model` files, or
- we deleted most of the `utility` rows so it stopped saying `utility`.

**That is the difference between a result and an artefact**, and the bar was registered in advance
precisely so that clearing it would mean something. I would have to write that ambiguity into the
certification, and a certification with that hole in it is not worth the 18 calls you just spent.

---

## 3. Your actual concern is repo dominance — and class balancing is the wrong instrument for it

typeorm at 46.0% is a **repo** concentration problem. Class rebalancing addresses it only
incidentally, while permanently changing what the dataset means. Two better-targeted answers:

**(a) Dilution is already happening, and the arithmetic is on your side.** You are running nest
(844 residue) right now. Take everything from both and typeorm's share falls from **46.0% to
26.6%** — below v2's n-dx share of 40.9%, which is the corpus that got 28.0%. *The dominance
problem largely solves itself by continuing the plan you already have.*

**(b) If you still want a cap, cap by repo, not by class.** A per-repo ceiling — say no repo exceeds
30% of the corpus — preserves each repo's internal class distribution, so the prior stays honest,
while directly preventing the thing you are actually worried about. It is the surgical version of
what you proposed.

⚠️ **Either way, if the training prior changes at all — by class rebalancing or by repo capping —
the coverage number stops being comparable to 28.0%**, because that baseline was measured on a
model trained at the natural prior. So whichever you choose: **declare it in the pre-registration
before the corpus is built.** Choosing a sampling scheme after seeing coverage is tuning against the
250, and it would be the one thing this whole apparatus was built to prevent.

If you want the mechanical component made visible rather than argued about, declare **now** that
two models get measured — natural prior and rebalanced — with **PRIMARY judged on the natural one**
and the rebalanced reported as a diagnostic. Coverage needs no labels, so the second costs only
CPU. Declared in advance it is a planned pair; chosen afterwards it is two bites at the bar.

---

## 4. ⚠️ Time-sensitive: do not spend 70 calls on payload on the strength of that probe

This is the most expensive thing on your list and I think the run log's own finding disqualifies
the reason for it.

| class | probe predicted | actual |
|---|---:|---:|
| `config` | 123 | **6** |
| `schema` | 43 | **0** |

**`schema` was predicted 43 and yielded 0.** payload's case is *"schema 104 · hook 53"* — from the
same probe, for the same class it just missed completely, at **70 calls**, nearly four times what
typeorm cost. Your caveat that the probe "reorders spending priority, not predicts yield" was
right, and the honest consequence is that **the ordering of everything still queued rests on a
method that has now failed twice out of four.**

Suggested sequence, which is your own incremental rule applied to the new information:

1. **nest** — already running, 29 calls. Let it finish.
2. **remix** — 8 calls. Cheapest on the board. Buy the information.
3. **Re-audit for free**, then decide on payload with two more real data points about how the probe
   behaves rather than none.

`model` went 1 → 74 on a single repo. You may find `gateway`, `hook` and `middleware` land from nest
and remix and that payload is never needed. **70 calls is the most reversible decision you still
have in front of you, right up until you spend it.**

---

## 5. Three small things

**(a) 193 + 140 + 107 = 440, not 443.** Three rows. Almost certainly a typo or a fourth class
folded in — flagging only because everything else in that entry reconciles exactly and I would want
to know which.

**(b) The probe finding is worth more than the miss cost you.** "Treat it as a tie-breaker between
repos, not a forecast" belongs in `ELM-CORPUS.md`'s rebuild procedure next to the
`--only=classifications` flag. A future harvester will reinvent path-probing within a week, and the
20× miss on `config` is the cheapest possible lesson.

**(c) `model` 1 → 74 is the first unambiguous win this project has had in a month.** Worth saying
plainly, because the rest of this note is caveats.

---

Build v3 with everything once nest lands, declare the sampling scheme in the pre-registration
before you build, and I will certify against whichever prior the lead picks.

— Jam
