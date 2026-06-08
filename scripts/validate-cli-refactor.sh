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
  [[ "$branch" == "feat/refactor-to-cli" ]] || fail "must run on branch feat/refactor-to-cli (current: $branch)"
}

check_file_loc() {
  local violations
  violations="$(find cli/src cli/tests tools -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.mjs' \) -print0 2>/dev/null | xargs -0 -r -n1 wc -l | awk '$2 != "total" && $1 > 250 { print $2 ":" $1 }')"
  [[ -z "$violations" ]] || fail "file LOC limit exceeded (>250):\n$violations"
}

check_indent_depth() {
  local violations
  violations="$(python3 - <<'PY'
from pathlib import Path
for path in Path('cli/src').rglob('*.ts'):
    for idx, line in enumerate(path.read_text(encoding='utf-8').splitlines(), start=1):
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip(' '))
        if indent % 2:
            print(f"{path}:{idx}:odd-indent:{indent}")
            continue
        depth = indent // 2
        if depth > 2:
            print(f"{path}:{idx}:depth:{depth}")
PY
)"
  [[ -z "$violations" ]] || fail "indentation depth exceeded (>2) or invalid indentation found:\n$violations"
}

check_function_loc() {
  local script="tools/check-function-loc.mjs"
  [[ -f "$script" ]] || fail "missing $script"
  node "$script"
}

check_strict_tsconfig() {
  [[ -f tsconfig.json ]] || fail "missing tsconfig.json"
  grep -q '"strict"[[:space:]]*:[[:space:]]*true' tsconfig.json || fail 'tsconfig.json must set strict=true'
}

check_no_push_automation() {
  local violations
  violations="$(grep -RInE '(^|[^a-z])(git push|npm publish|pnpm publish|yarn publish)' scripts/refactor-to-cli-loop.sh docs .ralph 2>/dev/null | grep -vi 'do not' || true)"
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
check_file_loc
node tools/check-types-centralized.mjs
node tools/check-no-any.mjs
check_indent_depth
check_function_loc
check_strict_tsconfig
check_no_push_automation
run_standard_checks

echo "[guardrail] OK"
