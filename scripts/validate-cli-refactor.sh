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

check_no_release_automation() {
  local violations
  violations="$(grep -nE '(^|[;&|(])[[:space:]]*(git([^;&|]*[[:space:]])(commit|push)|npx[[:space:]]+apify[[:space:]]+push|apify[[:space:]]+push|(npm|pnpm|yarn)[[:space:]]+(publish|run[[:space:]]+deploy)|gh[[:space:]]+release)' scripts/refactor-to-cli-loop.sh scripts/refactor-cli-phase-detect.sh scripts/refactor-cli-phase-validator.sh scripts/refactor-cli-loop.test.sh 2>/dev/null || true)"
  [[ -z "$violations" ]] || fail "automation must not commit, push, publish, or deploy:\n$violations"
}

check_refactor_automation() {
  local state
  bash -n scripts/refactor-to-cli-loop.sh scripts/refactor-cli-phase-detect.sh scripts/refactor-cli-phase-validator.sh scripts/refactor-cli-loop.test.sh
  scripts/refactor-cli-loop.test.sh >/dev/null
  state="$(mktemp)"
  [[ "$(scripts/refactor-cli-phase-detect.sh "$state")" == "automation" ]] || fail "phase detector must begin with automation"
  printf '%s\n' automation >>"$state"
  [[ "$(scripts/refactor-cli-phase-detect.sh "$state")" == "guardrails" ]] || fail "phase detector must advance"
  rm -f "$state"
}

check_source_file_limits() {
  local path lines violations=""
  while IFS= read -r -d '' path; do
    lines="$(wc -l <"$path")"
    ((lines <= 250)) || violations+="$lines $path"$'\n'
  done < <(find cli/src -type f -print0)
  [[ -z "$violations" ]] || fail "runtime files exceed 250 lines:\n$violations"
}

check_typescript_runtime() {
  local foreign dynamic
  foreign="$(find cli/src -type f ! -name '*.ts' -print)"
  [[ -z "$foreign" ]] || fail "runtime contains non-TypeScript files:\n$foreign"
  dynamic="$(grep -RInE 'new[[:space:]]+Function|eval[[:space:]]*\(' cli/src --include='*.ts' || true)"
  [[ -z "$dynamic" ]] || fail "runtime contains dynamic code execution:\n$dynamic"
}

check_modular_core() {
  local command_literals direct_imports
  command_literals="$(grep -RInE "instagram|auth[ .]login|scrape[ .](comments|profiles|reposts)|profile[ .]show" cli/src/core cli/src/bin || true)"
  [[ -z "$command_literals" ]] || fail "core contains command-specific literals:\n$command_literals"
  direct_imports="$(grep -RInE "modules/(auth|scrape-comments|scrape-profiles|scrape-reposts)" cli/src/core cli/src/bin || true)"
  [[ -z "$direct_imports" ]] || fail "core imports command implementations directly:\n$direct_imports"
}

check_liker_collection_disabled() {
  local active_calls
  grep -q "liker_collection_disabled" cli/src/modules/scrape-comments/process-comment.ts \
    || fail "production comments must mark liker collection disabled"
  active_calls="$(grep -RInE "scrape-comments/likers|from .*/likers|enrich(CommentLikers|ReelCommentsAfterCapture)|collectLikersFromDialog|openLikes(Inline|DeepLink)" \
    cli/src --include='*.ts' --exclude-dir=likers || true)"
  [[ -z "$active_calls" ]] || fail "production path invokes dormant liker code:\n$active_calls"
  ! grep -q "retryIncompleteLikers" cli/src/modules/scrape-comments/scrape-loop.ts \
    || fail "retry liker flags must not alter the production scrape loop"
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
check_no_release_automation
check_refactor_automation
check_source_file_limits
check_typescript_runtime
check_modular_core
check_liker_collection_disabled
run_standard_checks

echo "[guardrail] OK"
