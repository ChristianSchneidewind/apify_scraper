#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PI_BIN="${PI_BIN:-pi}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-3}"
STATE_DIR="${STATE_DIR:-$ROOT_DIR/.loop}"
STATE_FILE="$STATE_DIR/refactor-cli.completed"
WORKTREE="$STATE_DIR/worktree"

make_patch() {
  local repo="$1" target="$2"
  git -C "$repo" add -N .
  git -C "$repo" diff --binary HEAD >"$target"
  git -C "$repo" reset --mixed HEAD >/dev/null
}

restore_patch() {
  local repo="$1" patch="$2"
  git -C "$repo" reset --hard HEAD >/dev/null
  git -C "$repo" clean -fd >/dev/null
  [[ ! -s "$patch" ]] || git -C "$repo" apply "$patch"
}

prepare_workspace() {
  [[ "$MAX_ATTEMPTS" =~ ^[1-9][0-9]*$ ]] || { echo 'MAX_ATTEMPTS must be positive' >&2; exit 2; }
  git -C "$ROOT_DIR" diff --quiet HEAD -- || { echo 'root worktree must be clean' >&2; exit 2; }
  [[ -z "$(git -C "$ROOT_DIR" ls-files --others --exclude-standard)" ]] || { echo 'remove untracked files first' >&2; exit 2; }
  mkdir -p "$STATE_DIR"
  touch "$STATE_FILE"
  [[ -d "$WORKTREE/.git" || -f "$WORKTREE/.git" ]] || git -C "$ROOT_DIR" worktree add --detach "$WORKTREE" HEAD >/dev/null
}

phase_checks() {
  local phase="$1"
  case "$phase" in
    automation) bash -n scripts/refactor-*.sh && scripts/refactor-cli-phase-detect.sh /dev/null >/dev/null ;;
    browser-typescript) ! find cli/src -type f \( -name '*.script' -o -name '*.js' -o -name '*.mjs' \) | grep -q . ;;
    likers-disabled) rg -q "liker_collection_disabled" cli/src/modules/scrape-comments/process-comment.ts && ! grep -RInE "from .*/likers|enrich(CommentLikers|ReelCommentsAfterCapture)" cli/src --include='*.ts' --exclude-dir=likers ;;
    *) npm run lint && npm run typecheck ;;
  esac
}

implement_phase() {
  local phase="$1" attempt="$2" prompt="$WORKTREE/.refactor-phase.md"
  cat >"$prompt" <<EOF
Implement only phase '$phase' from docs/refactor-compliance-plan.md.
Keep liker profile collection intentionally disabled. Read AGENTS.md and tests first.
Do not commit, push, publish, deploy, or inspect secrets/runtime artifacts.
You cannot run commands; the parent loop runs checks. Summarize changed paths and concerns.
EOF
  (cd "$WORKTREE" && "$PI_BIN" --print --no-approve --no-session --tools read,grep,find,ls,edit,write @.refactor-phase.md) \
    | tee "$STATE_DIR/$phase-implement-$attempt.log"
  rm -f "$prompt"
}

validate_phase() {
  local phase="$1" attempt="$2"
  (cd "$WORKTREE" && phase_checks "$phase") | tee "$STATE_DIR/$phase-focused-$attempt.log" || return 1
  (cd "$WORKTREE" && CI=1 npm run guardrails) | tee "$STATE_DIR/$phase-guardrails-$attempt.log" || return 1
  (cd "$WORKTREE" && scripts/refactor-cli-phase-validator.sh "$phase" "$STATE_DIR/$phase-review-$attempt.log") || return 1
}

run_phase() {
  local phase="$1" attempt before
  before="$STATE_DIR/before-$phase.patch"
  [[ -f "$before" ]] || make_patch "$WORKTREE" "$before"
  for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1)); do
    restore_patch "$WORKTREE" "$before"
    if ! implement_phase "$phase" "$attempt"; then
      continue
    fi
    if validate_phase "$phase" "$attempt"; then
      printf '%s\n' "$phase" >>"$STATE_FILE"
      rm -f "$before"
      return 0
    fi
  done
  restore_patch "$WORKTREE" "$before"
  echo "phase '$phase' failed after $MAX_ATTEMPTS attempts" >&2
  return 1
}

finish_workspace() {
  local final_patch="$STATE_DIR/refactor-cli-final.patch"
  make_patch "$WORKTREE" "$final_patch"
  git -C "$ROOT_DIR" apply "$final_patch"
  git -C "$ROOT_DIR" worktree remove --force "$WORKTREE"
  echo 'refactor loop complete'
}

main() {
  local phase
  prepare_workspace
  while true; do
    phase="$("$WORKTREE/scripts/refactor-cli-phase-detect.sh" "$STATE_FILE")"
    [[ "$phase" != complete ]] || break
    run_phase "$phase"
  done
  finish_workspace
}

[[ "${BASH_SOURCE[0]}" != "$0" ]] || main "$@"
