# Team Thomas — inbox

Anyone may drop a note here. Team Thomas reads it at the start of every session.

**Filename:** `NOTE-<from-lead>-to-<to-lead>-YYYY-MM-DD-<slug>.md`
e.g. `NOTE-jarrett-to-thomas-2026-08-05-need-elm-config-shape.md`

**Intern names only — `nolan`, `jarrett`, `thomas` — never an agent name.** A note an agent drafts
is still *from that agent's lead*, because that is how it routes: the receiving lead passes it to
their agents. Name the drafting agent in the body instead. Full rationale:
[`../../Command-Structure`](../../Command-Structure) § Communication.

**Within Team Thomas** (agent to agent), use `NOTE-thomas-internal-YYYY-MM-DD-<slug>.md`.

Write a note when you: need something this team owns · changed something that affects them ·
found a defect in their territory · are about to touch a shared file.

## Note format

```markdown
# NOTE — <from-lead> → <to-lead> — YYYY-MM-DD — <subject>

**Drafted by:** <agent name> (Team <lead>) · **Routes to:** <to-lead>, who routes it to their agents
**Needs a reply by:** <date, or "no reply needed">
**Blocking:** <backlog ID, or "nothing">

## What
One paragraph. The ask or the news, stated plainly.

## Why it matters to you
Why this lands in *their* inbox specifically.

## What I need back
A concrete, checkable thing — an interface signature, a yes/no, a merged PR.
Vague asks get vague answers.
```

**Resolved notes:** don't delete them — append a `## Resolved YYYY-MM-DD` section saying what
happened, and leave the file. The record of *why* a decision was made lives here.
