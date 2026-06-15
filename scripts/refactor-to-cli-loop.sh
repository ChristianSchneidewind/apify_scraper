#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PI_BIN="${PI_BIN:-pi}"
MODEL_IMPL="${MODEL_IMPL:-sonnet}"
MODEL_REVIEW="${MODEL_REVIEW:-sonnet}"
PLAN_FILE="docs/refactor-to-cli-plan.md"
STATUS_FILE="docs/refactor-to-cli-status.md"
STATE_DIR=".loop/refactor-to-cli"
STATE_FILE="$STATE_DIR/state.env"
VALIDATE_SCRIPT="scripts/validate-cli-refactor.sh"
DETECT_SCRIPT="scripts/refactor-cli-phase-detect.sh"
PHASE_VALIDATOR="scripts/refactor-cli-phase-validator.sh"
SKILL_CLI="${SKILL_CLI:-$ROOT_DIR/.agents/skills/apify-actorization/SKILL.md}"
SKIP_PI="${SKIP_PI:-0}"

mkdir -p "$STATE_DIR"

fail() {
  echo "[loop] $*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage:
  scripts/refactor-to-cli-loop.sh status
  scripts/refactor-to-cli-loop.sh init-state
  scripts/refactor-to-cli-loop.sh guardrails
  scripts/refactor-to-cli-loop.sh validate <phase>
  scripts/refactor-to-cli-loop.sh run [phase]
  scripts/refactor-to-cli-loop.sh run-all

Environment:
  PI_BIN          pi executable (default: pi)
  MODEL_IMPL      implementation model
  MODEL_REVIEW    validator model
  SKILL_CLI       skill file for pi agents
  SKIP_PI=1       skip pi subagent, use deterministic validator only
  CI=1            skip branch-name guard in validate script

Guardrails after every implementation step:
  1. scripts/validate-cli-refactor.sh
  2. scripts/refactor-cli-phase-validator.sh <phase>
  3. read-only pi subagent review (unless SKIP_PI=1)
EOF
}

require_repo_state() {
  [[ -f "$PLAN_FILE" ]] || fail "missing $PLAN_FILE"
  [[ -x "$VALIDATE_SCRIPT" ]] || fail "missing executable $VALIDATE_SCRIPT"
  [[ -x "$DETECT_SCRIPT" ]] || fail "missing executable $DETECT_SCRIPT"
  [[ -x "$PHASE_VALIDATOR" ]] || fail "missing executable $PHASE_VALIDATOR"
  local branch
  branch="$(git branch --show-current)"
  [[ "${CI:-0}" == "1" || "$branch" == "feat/refactor-to-cli" ]] \
    || fail "must run on branch feat/refactor-to-cli (current: $branch)"
}

load_state() {
  if [[ -f "$STATE_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$STATE_FILE"
  else
    CURRENT_PHASE="$("$DETECT_SCRIPT" current)"
  fi
}

save_state() {
  cat > "$STATE_FILE" <<EOF
CURRENT_PHASE=$CURRENT_PHASE
UPDATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
}

phase_name() {
  "$DETECT_SCRIPT" label "$1"
}

phase_goal() {
  case "$1" in
    1) echo "Add docs, loop scripts, validation scripts, and measurable guardrails." ;;
    2) echo "Bootstrap a strict TypeScript CLI workspace and basic command runner." ;;
    3) echo "Centralize every command/config/output schema with TypeBox." ;;
    4) echo "Implement the tiny core dispatcher, context, result, and output pipeline." ;;
    5) echo "Implement browser profile selection plus instagram auth login." ;;
    6) echo "Port Python comment scraping into modular TypeScript adapters and scrape loop." ;;
    7) echo "Implement profile screenshot flow with slug/out-dir/json output modes." ;;
    8) echo "Finish tests, docs, migration notes, and retire obsolete Python entry path when safe." ;;
    9) echo "Port Python likers, highlighting, and multipart capture into modular TypeScript with tests." ;;
    *) echo "No goal" ;;
  esac
}

phase_blockers() {
  case "$1" in
    6) echo "Missing: cli/src/adapters/instagram/dom-selectors.ts, cli/src/modules/scrape-comments/scrape-loop.ts" ;;
    7) echo "Missing: cli/src/modules/scrape-profiles/capture.ts" ;;
    8) echo "Needs: broader adapter tests, migration parity notes, optional Python deprecation gate" ;;
    9) echo "Missing: likers/, highlight.ts, multipart/, capture/, process-comment wiring, phase-9 tests" ;;
    *) echo "none" ;;
  esac
}

print_status() {
  require_repo_state
  load_state
  echo "[loop] branch: $(git branch --show-current)"
  echo "[loop] plan: $PLAN_FILE"
  echo "[loop] status doc: $STATUS_FILE"
  echo
  "$DETECT_SCRIPT" detect
  echo
  echo "[loop] saved state: CURRENT_PHASE=${CURRENT_PHASE:-unset}"
  for phase in 1 2 3 4 5 6 7 8 9; do
    local verdict
    verdict="$("$PHASE_VALIDATOR" "$phase" 2>/dev/null | head -n1 || true)"
    [[ -n "$verdict" ]] || verdict="REJECTED"
    echo "  phase $phase ($(phase_name "$phase")): $verdict"
  done
  echo
  echo "[loop] next blockers:"
  echo "  phase 6: $(phase_blockers 6)"
  echo "  phase 7: $(phase_blockers 7)"
  echo "  phase 8: $(phase_blockers 8)"
  echo "  phase 9: $(phase_blockers 9)"
}

init_state() {
  require_repo_state
  CURRENT_PHASE="$("$DETECT_SCRIPT" current)"
  save_state
  echo "[loop] initialized CURRENT_PHASE=$CURRENT_PHASE ($(phase_name "$CURRENT_PHASE"))"
}

run_guardrails() {
  "$VALIDATE_SCRIPT"
}

run_local_validator() {
  local phase="$1"
  "$PHASE_VALIDATOR" "$phase"
}

phase_review_prompt() {
  local phase="$1"
  local name
  name="$(phase_name "$phase")"
  cat <<EOF
Validate phase $phase ($name) against docs/refactor-to-cli-plan.md and docs/refactor-to-cli-status.md.

Requirements to verify:
- TypeScript-only CLI
- TypeBox is the only centralized schema/type source
- no local type/interface declarations outside cli/src/schemas/**
- tiny core, highly modular feature modules, adapters around dependencies
- strict typing, no any, and guardrails for max 250 LOC/file, max 45 LOC/function, indent depth <= 2
- command surface stays aligned with:
  - instagram auth login
  - instagram --browser-profile "default"
  - instagram scrape comments --url "..."
  - instagram scrape profiles --url "..." --profile-slug "..." --out-dir "..." --json
- only the phase deliverables expected for phase $phase
- do not reopen already approved phases unless there is a regression

You are a read-only validator.
If compliant, print exactly: APPROVED
If not compliant, print exactly: REJECTED, then a short bullet list of blockers.
EOF
}

run_pi_validator() {
  local phase="$1"
  local prompt
  prompt="$(phase_review_prompt "$phase")"

  if [[ "$SKIP_PI" == "1" ]]; then
    echo "[loop] SKIP_PI=1, using deterministic validator only" >&2
    run_local_validator "$phase"
    return
  fi

  if ! command -v "$PI_BIN" >/dev/null 2>&1; then
    echo "[loop] $PI_BIN not found, falling back to deterministic validator" >&2
    run_local_validator "$phase"
    return
  fi

  "$PI_BIN" -p \
    --model "$MODEL_REVIEW" \
    --skill "$SKILL_CLI" \
    --tools read,grep,find,ls,bash \
    --append-system-prompt "Read-only validator. Do not modify files or state." \
    "$prompt"
}

run_implementer() {
  local phase="$1"
  local name goal prompt
  name="$(phase_name "$phase")"
  goal="$(phase_goal "$phase")"

  if [[ "$SKIP_PI" == "1" ]]; then
    echo "[loop] SKIP_PI=1: no automatic implementation. Run phase $phase manually, then rerun validate/guardrails." >&2
    echo "[loop] goal: $goal" >&2
    return 0
  fi

  if ! command -v "$PI_BIN" >/dev/null 2>&1; then
    fail "$PI_BIN not found. Set SKIP_PI=1 and implement phase $phase manually."
  fi

  prompt="You are the implementation agent for phase $phase ($name).

Requirements:
- Follow $PLAN_FILE and $STATUS_FILE.
- TypeScript only for the CLI.
- TypeBox is the only source of types/schemas.
- No local type/interface declarations outside cli/src/schemas/**.
- Small pi-style core, highly modular feature modules.
- Keep files under 250 LOC, functions under 45 LOC, indentation max depth 2.
- Make incremental changes only for this phase.
- Never run remote publish steps from automation.
- After edits, run: CI=1 npm run guardrails

Phase goal: $goal
Phase blockers hint: $(phase_blockers "$phase")

Before editing, read the plan, status doc, and inspect repo. Implement only the minimal changes needed for this phase."

  "$PI_BIN" -p \
    --model "$MODEL_IMPL" \
    --skill "$SKILL_CLI" \
    --append-system-prompt "Follow docs/refactor-to-cli-plan.md. Keep changes phase-scoped." \
    "$prompt"
}

validate_phase() {
  local phase="$1"
  local review
  run_guardrails
  review="$(run_pi_validator "$phase")"
  echo "$review"
  grep -qx 'APPROVED' <<<"$review" || fail "validator rejected phase $phase"
}

checkpoint_commit() {
  local phase="$1"
  if git diff --quiet && git diff --cached --quiet; then
    echo "[loop] no changes to checkpoint"
    return 0
  fi
  git add -A
  git commit -m "wip(cli-refactor): phase $phase $(phase_name "$phase")"
}

run_phase() {
  local next_phase="$1"
  [[ "$next_phase" =~ ^[1-9]$ ]] || fail "phase must be 1..9"

  echo "[loop] implementing phase $next_phase: $(phase_name "$next_phase")"
  run_implementer "$next_phase"
  validate_phase "$next_phase"
  checkpoint_commit "$next_phase"
  CURRENT_PHASE="$next_phase"
  save_state
  echo "[loop] phase $next_phase approved"
}

phase_is_approved() {
  local phase="$1"
  local review
  review="$($PHASE_VALIDATOR "$phase" 2>/dev/null || true)"
  grep -qx 'APPROVED' <<<"$review"
}

run_all() {
  require_repo_state
  load_state
  local start="$((CURRENT_PHASE + 1))"
  local phase
  for ((phase = start; phase <= 9; phase++)); do
    if phase_is_approved "$phase"; then
      echo "[loop] phase $phase already approved, skipping"
      CURRENT_PHASE="$phase"
      save_state
      continue
    fi
    run_phase "$phase"
  done
}

main() {
  local cmd="${1:-run}"
  shift || true

  case "$cmd" in
    status)
      print_status
      ;;
    init-state)
      init_state
      ;;
    guardrails)
      require_repo_state
      run_guardrails
      ;;
    validate)
      require_repo_state
      local phase="${1:-}"
      [[ -n "$phase" ]] || fail "usage: $0 validate <phase>"
      validate_phase "$phase"
      ;;
    run)
      require_repo_state
      load_state
      local next_phase="${1:-$((CURRENT_PHASE + 1))}"
      run_phase "$next_phase"
      ;;
    run-all)
      run_all
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      usage
      fail "unknown command: $cmd"
      ;;
  esac
}

main "$@"
