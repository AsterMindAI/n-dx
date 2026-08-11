#!/usr/bin/env bash
#
# unread-notes.sh — print unread team-inbox notes into an agent's session context.
#
# ─────────────────────────────────────────────────────────────────────────────
#  THIS SCRIPT IS NOT WIRED UP BY THIS REPOSITORY, AND MUST NOT BE.
#
#  It lives here as a readable artifact so all three teams can see, review, and
#  copy it. Nothing in the repo executes it. It is deliberately NOT executable
#  (no +x bit) and is invoked as `bash <path>`.
#
#  Each intern wires it up on their own machine, in the GITIGNORED file
#  `.claude/settings.local.json` — never in the committed `.claude/settings.json`:
#
#      {
#        "hooks": {
#          "SessionStart": [
#            {
#              "hooks": [
#                {
#                  "type": "command",
#                  "command": "bash /ABSOLUTE/PATH/TO/n-dx/Claude-Context/hooks/unread-notes.sh",
#                  "timeout": 10
#                }
#              ]
#            }
#          ]
#        }
#      }
#
#  WHY LOCAL-ONLY: AsterMindAI/n-dx is a PUBLIC fork of a PUBLIC repo (9 forks,
#  16 stars as of 2026-08-11), and n-dx is a published npm package. A hook in the
#  committed settings.json would execute on the machine of anyone who clones the
#  repo and opens it in Claude Code — including people who have nothing to do
#  with this migration. That is arbitrary code execution on a stranger's machine.
#  The notes themselves are already public (Claude-Context/ is committed), so the
#  risk here is execution, not disclosure. Keep the wiring local.
#  Decided by Nolan, 2026-08-11.
# ─────────────────────────────────────────────────────────────────────────────
#
# BEHAVIOUR
#   - Reads the working tree only. NO NETWORK, no `git fetch`. A note is visible
#     only if it is on the branch you have checked out, which means the merge
#     discipline (<TeamBranch> -> dev -> your branch) is what actually delivers
#     it. This script reports; it does not deliver.
#   - Silent when there is nothing unread. Silence is the normal case.
#   - Never exits non-zero and never blocks a session. A broken inbox reader
#     must not cost anyone their session.
#
# READ STATE
#   Stored in the git directory (`git rev-parse --git-common-dir`), which is
#   never tracked and never shipped — so no .gitignore entry is needed and it
#   cannot be committed by accident. One file per team.
#
# USAGE
#   bash unread-notes.sh                 # print unread notes, then mark them read
#   bash unread-notes.sh --mark-read     # mark everything read, print nothing
#   bash unread-notes.sh --list          # print unread notes, do NOT mark read
#
#   Team defaults to Nolan. Override with NDX_TEAM=Jarrett or NDX_TEAM=Thomas.

set -uo pipefail   # deliberately NOT -e: this must never abort mid-run

MODE="${1:-report}"
TEAM="${NDX_TEAM:-Nolan}"

# Resolve the repo from this script's own location, so the hook works regardless
# of the session's working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" || exit 0
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)" || exit 0

NOTES_DIR="$REPO_ROOT/Claude-Context/${TEAM}-Agents/Notes"
[ -d "$NOTES_DIR" ] || exit 0

GIT_DIR="$(git -C "$REPO_ROOT" rev-parse --git-common-dir 2>/dev/null)" || exit 0
case "$GIT_DIR" in
  /*) ;;                              # already absolute
  *) GIT_DIR="$REPO_ROOT/$GIT_DIR" ;; # relative form, e.g. ".git"
esac
STATE_FILE="$GIT_DIR/ndx-notes-read-$(echo "$TEAM" | tr '[:upper:]' '[:lower:]')"
[ -f "$STATE_FILE" ] || : > "$STATE_FILE"

# --- collect unread -----------------------------------------------------------
UNREAD=""
UNREAD_COUNT=0
for path in "$NOTES_DIR"/NOTE-*.md; do
  [ -e "$path" ] || continue                       # no matches: glob stayed literal
  name="$(basename "$path")"
  grep -Fxq "$name" "$STATE_FILE" && continue      # already seen
  UNREAD="$UNREAD$name"$'\n'
  UNREAD_COUNT=$((UNREAD_COUNT + 1))
done

if [ "$MODE" = "--mark-read" ]; then
  [ -n "$UNREAD" ] && printf '%s' "$UNREAD" >> "$STATE_FILE"
  echo "Marked $UNREAD_COUNT note(s) read for Team $TEAM."
  exit 0
fi

[ "$UNREAD_COUNT" -eq 0 ] && exit 0                # nothing to say; stay quiet

# --- build the message --------------------------------------------------------
# One line per note: filename, then its Subject (or H1 title) as a preview.
BODY="Unread notes in your team inbox — Team $TEAM (Claude-Context/${TEAM}-Agents/Notes/):"$'\n'
while IFS= read -r name; do
  [ -n "$name" ] || continue
  subject="$(grep -m1 '^\*\*Subject:\*\*' "$NOTES_DIR/$name" 2>/dev/null \
             | sed 's/^\*\*Subject:\*\* *//')"
  if [ -z "$subject" ]; then
    # Fall back to the H1. Titles read "NOTE — Nolan → Jarrett — 2026-08-11 — subject",
    # so take the last em-dash-separated field; that is the subject when one is
    # present, and the whole title when it is not.
    subject="$(grep -m1 '^# ' "$NOTES_DIR/$name" 2>/dev/null \
               | sed 's/^# *//' | awk -F' — ' '{print $NF}')"
  fi
  BODY="$BODY"$'\n'"  • $name"
  [ -n "$subject" ] && BODY="$BODY"$'\n'"    $subject"
done <<< "$UNREAD"

BODY="$BODY"$'\n\n'"Read these before starting work — see claude-context-instruction § 5 (your operating loop)."

# --- mark read ----------------------------------------------------------------
if [ "$MODE" = "--list" ]; then
  BODY="$BODY"$' '"(--list: NOT marked read, so they will appear again.)"
else
  printf '%s' "$UNREAD" >> "$STATE_FILE"
  BODY="$BODY"$' '"They are now marked read and will not be shown again; the files stay in place."
fi

# --- emit ---------------------------------------------------------------------
# additionalContext goes to the model; systemMessage is the one-liner the human sees.
if command -v jq >/dev/null 2>&1; then
  jq -n --arg ctx "$BODY" --arg msg "$UNREAD_COUNT unread note(s) in the Team $TEAM inbox" \
    '{systemMessage: $msg,
      hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}'
else
  # Without jq, fall back to plain stdout — still reaches the session context.
  printf '%s\n' "$BODY"
fi

exit 0
