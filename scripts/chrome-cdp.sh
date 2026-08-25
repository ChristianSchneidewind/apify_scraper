#!/usr/bin/env bash
# Startet Chrome mit CDP-Remote-Debugging in einem dedizierten Scraping-Profil.
#
# Hintergrund: Chrome >= 136 ignoriert --remote-debugging-port, wenn das
# Datenverzeichnis das Default-Verzeichnis ist. Deshalb nutzt der Scraper ein
# eigenes Profil-Verzeichnis (Default: ~/.chrome-cdp). Dort einmal bei
# Instagram einloggen - die Session bleibt im Profil erhalten.
#
# Usage:
#   scripts/chrome-cdp.sh              # starten (oder melden, dass es laeuft)
#   scripts/chrome-cdp.sh --restart    # laufendes Chrome beenden und neu starten
#   PORT=9333 PROFILE="Default" CDP_PROFILE_DIR=~/andere scripts/chrome-cdp.sh
set -euo pipefail

PORT="${PORT:-9222}"
PROFILE="${PROFILE:-Profile 1}"
CHROME_BIN="${CHROME_BIN:-google-chrome}"
CDP_PROFILE_DIR="${CDP_PROFILE_DIR:-$HOME/.chrome-cdp}"

info() { echo "[chrome-cdp] $*"; }
fail() { echo "[chrome-cdp] FEHLER: $*" >&2; exit 1; }

port_ready() {
  curl -s --max-time 2 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1
}

chrome_running() {
  pgrep -f "/opt/google/chrome/chrome" >/dev/null 2>&1 \
    || pgrep -x chrome >/dev/null 2>&1 \
    || pgrep -f "google-chrome" >/dev/null 2>&1
}

restart_chrome() {
  info "Beende laufendes Chrome (Session wird wiederhergestellt) ..."
  pkill -TERM -f "/opt/google/chrome/chrome" 2>/dev/null || true
  pkill -TERM -x chrome 2>/dev/null || true
  for _ in $(seq 1 20); do
    chrome_running || break
    sleep 0.5
  done
  chrome_running && fail "Chrome konnte nicht beendet werden - bitte manuell schliessen"
}

launch_chrome() {
  mkdir -p "$CDP_PROFILE_DIR"
  info "Starte Chrome mit Debug-Port ${PORT} (Profil: ${CDP_PROFILE_DIR}/${PROFILE}) ..."
  setsid nohup "$CHROME_BIN" \
    --user-data-dir="$CDP_PROFILE_DIR" \
    --profile-directory="$PROFILE" \
    --remote-debugging-port="$PORT" \
    --restore-last-session \
    >/tmp/chrome-cdp.log 2>&1 &
  for _ in $(seq 1 30); do
    port_ready && break
    sleep 0.5
  done
  port_ready || fail "Debug-Port ${PORT} nicht erreichbar - Details: /tmp/chrome-cdp.log"
  info "DevTools erreichbar: $(curl -s --max-time 2 "http://127.0.0.1:${PORT}/json/version" | grep -o '"Browser": *"[^"]*"')"
}

main() {
  if port_ready; then
    info "Debug-Port ${PORT} bereits erreichbar - nichts zu tun."
    exit 0
  fi
  if [[ "${1:-}" == "--restart" ]]; then
    restart_chrome
  elif chrome_running; then
    fail "Chrome laeuft bereits OHNE Debug-Port. Entweder Chrome manuell schliessen und erneut aufrufen - oder: $0 --restart"
  fi
  launch_chrome
  info "Bereit. CLI nutzen mit: npx tsx cli/src/bin/instagram.ts --cdp-url http://127.0.0.1:${PORT} ..."
  info "Hinweis: Beim ersten Start einmal bei Instagram einloggen (bleibt gespeichert)."
}

main "$@"
