#!/usr/bin/env bash
set -euo pipefail

STATE_FILE="${1:-.loop/refactor-cli.completed}"
PHASES=(automation guardrails browser-typescript central-types modular-core cli-semantics likers-disabled documentation final-review)

touch "$STATE_FILE"
for phase in "${PHASES[@]}"; do
  if ! grep -Fxq "$phase" "$STATE_FILE"; then
    printf '%s\n' "$phase"
    exit 0
  fi
done
printf '%s\n' complete
