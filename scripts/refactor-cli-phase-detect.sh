#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

exists() { [[ -f "$1" || -d "$1" ]]; }

phase_done() {
  case "$1" in
    1)
      exists docs/refactor-to-cli-plan.md \
        && exists scripts/validate-cli-refactor.sh \
        && exists scripts/refactor-to-cli-loop.sh \
        && exists tools/check-function-loc.mjs
      ;;
    2)
      phase_done 1 \
        && exists package.json \
        && exists tsconfig.json \
        && exists eslint.config.mjs \
        && grep -q '@sinclair/typebox' package.json
      ;;
    3)
      phase_done 2 \
        && exists cli/src/schemas/commands.ts \
        && exists cli/src/schemas/config.ts \
        && exists cli/src/schemas/outputs.ts \
        && exists cli/src/schemas/index.ts
      ;;
    4)
      phase_done 3 \
        && exists cli/src/core/app.ts \
        && exists cli/src/core/argv.ts \
        && exists cli/src/core/context.ts \
        && exists cli/src/core/result.ts \
        && exists cli/src/bin/instagram.ts \
        && exists cli/tests/app.test.ts
      ;;
    5)
      phase_done 4 \
        && exists cli/src/modules/auth/login.ts \
        && exists cli/src/adapters/playwright/browser.ts \
        && exists cli/src/modules/browser/profile.ts \
        && exists cli/tests/auth-login.test.ts
      ;;
    6)
      phase_done 5 \
        && exists cli/src/modules/scrape-comments/run.ts \
        && exists cli/src/adapters/filesystem/output.ts \
        && exists cli/src/adapters/instagram/dom-selectors.ts \
        && exists cli/src/modules/scrape-comments/scrape-loop.ts
      ;;
    7)
      phase_done 6 \
        && exists cli/src/modules/scrape-profiles/run.ts \
        && exists cli/src/modules/scrape-profiles/capture.ts \
        && exists cli/tests/scrape-profiles.test.ts
      ;;
    8)
      phase_done 7 \
        && exists docs/cli-migration.md \
        && exists docs/cli-usage.md \
        && exists .github/workflows/tests-on-push.yml
      ;;
    *) return 1 ;;
  esac
}

detect_phase() {
  local phase=0
  for phase in 1 2 3 4 5 6 7 8; do
    if phase_done "$phase"; then
      continue
    fi
    echo "$((phase - 1))"
    return 0
  done
  echo 8
}

phase_label() {
  case "$1" in
    0) echo "not-started" ;;
    1) echo "spec-and-guardrails" ;;
    2) echo "ts-workspace-bootstrap" ;;
    3) echo "central-schemas" ;;
    4) echo "core-runtime" ;;
    5) echo "browser-profile-and-auth" ;;
    6) echo "scrape-comments-port" ;;
    7) echo "scrape-profiles-port" ;;
    8) echo "hardening-and-migration" ;;
    *) echo "unknown" ;;
  esac
}

CURRENT="$(detect_phase)"
NEXT=$((CURRENT + 1))
[[ "$NEXT" -gt 8 ]] && NEXT=8

case "${1:-detect}" in
  detect)
    echo "CURRENT_PHASE=$CURRENT"
    echo "NEXT_PHASE=$NEXT"
    echo "CURRENT_LABEL=$(phase_label "$CURRENT")"
    echo "NEXT_LABEL=$(phase_label "$NEXT")"
    ;;
  current)
    echo "$CURRENT"
    ;;
  next)
    echo "$NEXT"
    ;;
  label)
    phase_label "${2:-$CURRENT}"
    ;;
  *)
    echo "usage: $0 [detect|current|next|label <phase>]" >&2
    exit 2
    ;;
esac
