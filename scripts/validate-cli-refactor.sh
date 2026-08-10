#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

fail() {
  echo "[guardrail] $*" >&2
  exit 1
}

require_clean_branch_name() {
  local branch
  [[ "${CI:-0}" == "1" ]] && return 0
  branch="$(git branch --show-current)"
  [[ "$branch" =~ ^(feat|fix|chore)/ ]] || fail "must run on a work branch (current: $branch)"
}

check_strict_tsconfig() {
  [[ -f tsconfig.json ]] || fail "missing tsconfig.json"
  grep -q '"strict"[[:space:]]*:[[:space:]]*true' tsconfig.json || fail 'tsconfig.json must set strict=true'
}

check_no_push_automation() {
  local violations
  violations="$(grep -RInE '(^|[^a-z])(git push|npm publish|pnpm publish|yarn publish)' docs .ralph 2>/dev/null | grep -vi 'do not' || true)"
  [[ -z "$violations" ]] || fail "automation scripts/docs must not include push/publish steps:\n$violations"
}

run_standard_checks() {
  [[ -f package.json ]] || {
    echo "[guardrail] skip npm checks (package.json missing)" >&2
    return 0
  }

  npm run lint
  npm run typecheck
  npm run test:coverage
}

require_clean_branch_name
check_strict_tsconfig
check_no_push_automation
run_standard_checks

echo "[guardrail] OK"
