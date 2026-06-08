#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PLAN_FILE="docs/refactor-to-cli-plan.md"
PHASE="${1:-}"

fail() {
  echo "REJECTED"
  echo "- $*"
  exit 1
}

approve() {
  echo "APPROVED"
  exit 0
}

[[ -n "$PHASE" && "$PHASE" =~ ^[1-8]$ ]] || fail "phase must be 1..8"

exists() { [[ -f "$1" || -d "$1" ]]; }

check_phase_1() {
  exists "$PLAN_FILE" || fail "missing $PLAN_FILE"
  exists scripts/validate-cli-refactor.sh || fail "missing scripts/validate-cli-refactor.sh"
  exists scripts/refactor-to-cli-loop.sh || fail "missing scripts/refactor-to-cli-loop.sh"
  exists tools/check-function-loc.mjs || fail "missing tools/check-function-loc.mjs"
  approve
}

check_phase_2() {
  exists package.json || fail "missing package.json"
  exists tsconfig.json || fail "missing tsconfig.json"
  grep -q '"strict"[[:space:]]*:[[:space:]]*true' tsconfig.json || fail "tsconfig strict mode required"
  grep -q '@sinclair/typebox' package.json || fail "typebox dependency required"
  grep -q playwright package.json || fail "playwright dependency required"
  approve
}

check_phase_3() {
  for file in cli/src/schemas/commands.ts cli/src/schemas/config.ts cli/src/schemas/outputs.ts; do
    exists "$file" || fail "missing $file"
    grep -q '@sinclair/typebox' "$file" || fail "$file must use TypeBox"
  done
  node tools/check-types-centralized.mjs >/dev/null || fail "types must be centralized under cli/src/schemas"
  approve
}

check_phase_4() {
  for file in cli/src/core/app.ts cli/src/core/argv.ts cli/src/core/context.ts cli/src/bin/instagram.ts; do
    exists "$file" || fail "missing $file"
  done
  grep -q 'auth login' cli/src/core/app.ts || fail "core must register auth login"
  grep -q 'scrape comments' cli/src/core/app.ts || fail "core must register scrape comments"
  grep -q 'scrape profiles' cli/src/core/app.ts || fail "core must register scrape profiles"
  approve
}

check_phase_5() {
  exists cli/src/modules/auth/login.ts || fail "missing auth login module"
  exists cli/src/adapters/playwright/browser.ts || fail "missing playwright browser adapter"
  grep -q 'storageState' cli/src/modules/auth/login.ts || fail "auth login must persist storage state"
  grep -q 'browser-profile' cli/src/core/argv.ts || fail "global browser profile flag required"
  approve
}

check_phase_6() {
  exists cli/src/modules/scrape-comments/run.ts || fail "missing scrape comments module"
  exists cli/src/adapters/instagram/dom-selectors.ts || fail "missing instagram dom selectors adapter"
  exists cli/src/modules/scrape-comments/scrape-loop.ts || fail "missing scrape loop module (Python parity)"
  grep -q 'scrape comments' cli/src/core/app.ts || fail "scrape comments command not wired"
  approve
}

check_phase_7() {
  exists cli/src/modules/scrape-profiles/run.ts || fail "missing scrape profiles module"
  exists cli/src/modules/scrape-profiles/capture.ts || fail "missing profile capture module"
  grep -q 'profile-slug' cli/src/core/app.ts || fail "profile slug flag required"
  grep -q 'out-dir' cli/src/core/app.ts || fail "out-dir flag required"
  approve
}

check_phase_8() {
  exists docs/cli-migration.md || fail "missing docs/cli-migration.md"
  exists docs/cli-usage.md || fail "missing docs/cli-usage.md"
  exists .github/workflows/tests-on-push.yml || fail "missing CI workflow"
  approve
}

case "$PHASE" in
  1) check_phase_1 ;;
  2) check_phase_2 ;;
  3) check_phase_3 ;;
  4) check_phase_4 ;;
  5) check_phase_5 ;;
  6) check_phase_6 ;;
  7) check_phase_7 ;;
  8) check_phase_8 ;;
esac
