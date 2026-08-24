#!/usr/bin/env bash
set -euo pipefail

PHASE="${1:?usage: refactor-cli-phase-validator.sh <phase> <log-path>}"
LOG_PATH="${2:?usage: refactor-cli-phase-validator.sh <phase> <log-path>}"
PI_BIN="${PI_BIN:-pi}"
PROMPT="$(mktemp)"
DIFF="$(mktemp)"
trap 'rm -f "$PROMPT" "$DIFF"' EXIT
mkdir -p "$(dirname "$LOG_PATH")"

git diff --no-ext-diff HEAD -- . ':(exclude).loop' >"$DIFF"
while IFS= read -r path; do
  git diff --no-index -- /dev/null "$path" >>"$DIFF" 2>/dev/null || true
done < <(git ls-files --others --exclude-standard)
cat >"$PROMPT" <<EOF
Independently review phase '$PHASE' of the strict modular Instagram CLI refactor.
Read docs/refactor-compliance-plan.md, AGENTS.md, source, tests, and guardrails.
The current git diff is attached as @$DIFF.
Do not edit files. Do not inspect .env, .instagram-cli, artifacts, or other secrets/runtime data.
Verify the phase requirements and ensure liker collection remains intentionally disabled.
End with exactly one of:
VALIDATION: PASS
VALIDATION: FAIL
Before that marker, list concrete violations with file paths. Never pass based only on existing test output.
EOF

"$PI_BIN" --print --no-approve --no-session --tools read,grep,find,ls "@$PROMPT" | tee "$LOG_PATH"
[[ "$(tail -n 1 "$LOG_PATH")" == 'VALIDATION: PASS' ]]
