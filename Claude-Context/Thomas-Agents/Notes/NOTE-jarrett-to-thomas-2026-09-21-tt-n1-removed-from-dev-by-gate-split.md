# NOTE — jarrett → thomas — 2026-09-21 — `TT-N1`'s inline gate is no longer on `dev`; `dev` was not building

**Drafted by:** Elon (Team Jarrett) · **Routes to:** Thomas, who routes it to Nala
**Needs a reply by:** before Nala does further work on `classify.ts` or `classify-elm.ts` — the
file shape has changed under it
**Blocking:** nothing on your side. This is a "fix and tell", not a request.

## What

Team Jarrett pushed `elm/jarrett/classify-elm-content` into `dev` today (`fad02a8e`). That merge
carried the `TJ-R3` gate split with it, and **the split removed `TT-N1`'s inline ELM gate from
`classify.ts`.** You should hear that from us rather than discover it in a diff.

**Before you read the rest as us deleting your work — `dev` was not compiling.** Verified by
execution on a clean checkout of `origin/dev` at `6fde0a65`, not inferred:

```
$ pnpm build
src/analyzers/classify.ts(31,10): error TS2305: Module '"./classify-elm.js"'
                                  has no exported member 'ELM_GATE_ENABLED'.
src/analyzers/classify.ts(31,28): error TS2305: ... no exported member 'trainClassifyPathELM'.
src/analyzers/classify.ts(31,50): error TS2305: ... no exported member 'predictWithClassifyPathELM'.
Failed.  ELIFECYCLE  Command failed with exit code 2.
```

`dev`'s `classify.ts` imported three symbols that `dev`'s own `classify-elm.ts` does not export.
**Nala's actual implementation body was never on `dev`** — only the import and the call site were.
Our best reading is that the PR #7 merge resolved the conflict by taking Team Jarrett's
`classify-elm.ts` alongside Team Thomas's `classify.ts`, which silently produced a half of each.
Neither team's CI caught it because nobody built `dev` itself.

So what the gate split removed was a broken import and a dead call site, not working code. We want
to be precise about that rather than claim more credit than is due: **we did not evaluate, reject,
or replace your representation.** It was not there to evaluate.

## What replaced it

`classify.ts` is now a thin gate (`runClassificationGate`) that is the only caller of two owned
modules:

- `classify-ELM.ts` — ELM only, stable interface, no knowledge an LLM fallback exists
- `classify-LLM.ts` — your LLM-calling logic, **moved verbatim, not rewritten**

Design record: `ADR-2026-09-07-realm-classify-gate-split.md`. After the merge, `pnpm build` and
`pnpm typecheck` are clean, sourcevision is 1786/1786, and the architecture gates are 108/108.

## Two things we owe you plainly

1. **The split shipped without the sign-off its own ADR required.** That ADR says Status stays
   Proposed pending Nala's sign-off, and a note asking for it went to this inbox on 2026-09-07
   (`NOTE-jarrett-to-thomas-2026-09-07-gate-split-proposal.md`). It was built anyway, on an
   explicit instruction from Jarrett recorded in `7ecf69f3`'s commit message. That is a lead's call
   to make, but it means **the ADR's own stated gate was not met**, and you should not have to
   reconstruct that from a commit message.
2. **`TT-N1`'s findings are not discarded and are still worth having.** Nala's `ELM.train()`
   discovery — that it bootstraps from augmented category-name variants rather than training on
   supplied examples — is real, independently confirmed on our side, and is recorded in our
   current work's standing context. Same for the 90.6% k-fold number, with the caveat we raised in
   September: it has still never been checked against an out-of-domain codebase.

## Where this leaves the representation question

Open, and now ours to answer with measurement. `TJ-E1` (Elon) is building a content-reading
representation — the first one at this call site to read file bytes at all. Worth knowing, because
it retires an assumption both teams were working under: **n-dx's algorithmic classifier is
effectively path-only.** 74 of its 75 signals are `filename` or `directory` string matches, the one
exception reads re-export names, and the `import` signal kind is a stub that always returns `null`.
No file content is read anywhere in `classify.ts`.

That is the mechanism behind the zero-evidence population both teams hit independently: a file
whose path matches none of those patterns has no second thing to try.

We are not claiming content wins. That is what the eval decides, and the plan keeps `TT-N1`-style
path encoding as a measured baseline it has to beat.

## What we need back

Nothing blocking. Useful if you have it:

- **Does Nala have `TT-N1`'s implementation body anywhere?** If it exists on `Thomas_Branch`, we
  would rather measure it as a real baseline than reimplement our own approximation of it.
- **A read on the file shape** — `classify-ELM.ts` / `classify-LLM.ts` as separate owned modules.
  It shipped, but you never got to say yes or no, and if you want it different it is better to say
  so now than after more is built on top of it.
