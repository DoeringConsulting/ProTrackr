#!/bin/bash
# =============================================================================
# scripts/guard-prod-watch.sh — Governance-Guard (aktiv)
# =============================================================================
# Überwacht den PROD-Container (protrackr-app) via `docker events` und meldet
# JEDEN direkten Eingriff (start/die), der NICHT über deploy-prod.sh lief, per
# Unraid-Notification (Dashboard + Mail an office@doering-consulting.eu).
#
# Legitim vs. direkt:
#   deploy-prod.sh setzt vor dem Deploy einen Marker mit Timestamp. Ein Event
#   innerhalb GRACE Sekunden nach dem Marker gilt als legitim (nur geloggt).
#   Ein Event ohne gültigen Marker = DIREKTER Eingriff -> Alarm.
#
# Ehrliche Grenze: root kann den Watcher selbst stoppen — er macht direkte
# Eingriffe sichtbar, nicht unmöglich (Governance-Ebene 3).
#
# Dauerstart (Unraid User Scripts, Schedule "At Startup of Array"):
#   nohup /mnt/user/appdata/protrackr/scripts/guard-prod-watch.sh \
#         >/var/log/protrackr-guard.log 2>&1 &
# =============================================================================

set -uo pipefail

readonly PROD_CONTAINER="protrackr-app"
readonly MARKER="/tmp/protrackr-prod-deploy.marker"
readonly GRACE=300   # Event <= GRACE s nach Marker = legitim (Deploy-Fenster)
readonly NOTIFY="/usr/local/emhttp/webGui/scripts/notify"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [protrackr-guard] $*"; }

send_alert() {  # $1 = docker event status (start|die)
  local status="$1"
  local subj="WARNUNG: Direkter PROD-Eingriff (protrackr-app)"
  local msg="Direkter Eingriff an PROD erkannt: protrackr-app '$status' — NICHT über scripts/deploy-prod.sh. Governance: PROD-Änderungen nur via Dev->Prod-Promotion. Bitte prüfen, ob das gewollt war."
  if [[ -x "$NOTIFY" ]]; then
    "$NOTIFY" -e "ProTrackr PROD-Guard" -s "$subj" -d "$msg" -i "alert" -m "$msg" \
      && log "notify OK ($status)" || log "notify FEHLGESCHLAGEN ($status)"
  else
    log "notify nicht gefunden ($NOTIFY) — nur Log."
  fi
  command -v logger >/dev/null 2>&1 && logger -t protrackr-guard "$msg"
}

# Guard prüft sich nicht selbst tot: falls docker events abbricht, neu verbinden.
log "Watcher gestartet (container=$PROD_CONTAINER, grace=${GRACE}s, marker=$MARKER)"

while true; do
  # start ODER die des Prod-Containers (Docker behandelt mehrere event-Filter als OR)
  docker events \
    --filter "container=$PROD_CONTAINER" \
    --filter 'event=start' \
    --filter 'event=die' \
    --format '{{.Time}} {{.Status}}' \
  | while read -r EVENT_TIME STATUS; do
      NOW=$(date +%s)
      LEGIT=false
      DIFF="n/a"
      if [[ -f "$MARKER" ]]; then
        MARKER_TIME=$(cat "$MARKER" 2>/dev/null || echo 0)
        if [[ "$MARKER_TIME" =~ ^[0-9]+$ ]]; then
          DIFF=$((NOW - MARKER_TIME))
          if [[ "$DIFF" -ge 0 && "$DIFF" -lt "$GRACE" ]]; then
            LEGIT=true
          fi
        fi
      fi
      if [[ "$LEGIT" == "true" ]]; then
        log "legitimer Event '$STATUS' (Marker vor ${DIFF}s = deploy-prod.sh)"
      else
        log "DIREKTER Event '$STATUS' (Marker-Diff: ${DIFF}) -> ALARM"
        send_alert "$STATUS"
      fi
    done
  log "docker events beendet — reconnect in 5s"
  sleep 5
done
