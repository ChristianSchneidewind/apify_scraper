#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
WORKTREE="$TMP/worktree"
trap 'git -C "$ROOT" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
source "$ROOT/scripts/refactor-to-cli-loop.sh"

git -C "$ROOT" worktree add --detach "$WORKTREE" HEAD >/dev/null
printf '\naccepted phase\n' >>"$WORKTREE/README.md"
printf '%s\n' accepted >"$WORKTREE/accepted.txt"
make_patch "$WORKTREE" "$TMP/accepted.patch"
printf '\nlater failed phase\n' >>"$WORKTREE/README.md"
printf '%s\n' failed >"$WORKTREE/failed.txt"
restore_patch "$WORKTREE" "$TMP/accepted.patch"
grep -q 'accepted phase' "$WORKTREE/README.md"
! grep -q 'later failed phase' "$WORKTREE/README.md"
[[ -f "$WORKTREE/accepted.txt" ]]
[[ ! -e "$WORKTREE/failed.txt" ]]

WORKTREE="$WORKTREE"
STATE_DIR="$TMP/state"
STATE_FILE="$STATE_DIR/completed"
MAX_ATTEMPTS=1
mkdir -p "$STATE_DIR"
phase_checks() { return 1; }
if validate_phase automation 1; then
  echo 'validation accepted a failed focused check' >&2
  exit 1
fi

make_patch "$WORKTREE" "$STATE_DIR/before-recovery.patch"
printf '\ninterrupted change\n' >>"$WORKTREE/README.md"
implement_phase() { return 1; }
! run_phase recovery
! grep -q 'interrupted change' "$WORKTREE/README.md"
grep -q 'accepted phase' "$WORKTREE/README.md"

cat >"$TMP/reviewer-fail" <<'EOF'
#!/usr/bin/env bash
echo 'VALIDATION: FAIL'
EOF
cat >"$TMP/reviewer-pass" <<'EOF'
#!/usr/bin/env bash
echo 'VALIDATION: PASS'
EOF
chmod +x "$TMP/reviewer-fail" "$TMP/reviewer-pass"
! (cd "$ROOT" && PI_BIN="$TMP/reviewer-fail" scripts/refactor-cli-phase-validator.sh automation "$TMP/fail.log")
(cd "$ROOT" && PI_BIN="$TMP/reviewer-pass" scripts/refactor-cli-phase-validator.sh automation "$TMP/pass.log")

state="$TMP/phases"
[[ "$("$ROOT/scripts/refactor-cli-phase-detect.sh" "$state")" == automation ]]
printf '%s\n' automation >"$state"
[[ "$("$ROOT/scripts/refactor-cli-phase-detect.sh" "$state")" == guardrails ]]
echo 'refactor loop self-test OK'
