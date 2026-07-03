#!/bin/bash
# =============================================================================
# scripts/deploy-prod.sh — PROMOTION Dev -> Prod (bit-identisches Image)
# =============================================================================
# Der EINZIGE legitime Weg, PROD zu verändern (Governance: keine direkten
# Prod-Eingriffe). Promotet das in Dev getestete Image bit-identisch auf Prod:
# kein Rebuild, GENAU dasselbe Image (`docker tag`), das auf :9444 lief.
#
# Leitplanken (alle aktiv):
#   • Success-Criteria-Gate (explizite Bestätigung)
#   • Prod-DB-Backup VOR jeder Änderung
#   • Altes Prod-Image als Rollback-Tag gesichert
#   • Health-Gate nach Deploy → bei Fehler AUTOMATISCHER Rollback
#
# Verwendung (im Compose-Verzeichnis, NUR nach Dev-Freigabe):
#   ./scripts/deploy-prod.sh              # interaktiv (Checkliste + Bestätigung)
#   ./scripts/deploy-prod.sh --dry-run    # zeigt nur, was passieren würde
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; GRAY='\033[0;90m'; NC='\033[0m'

readonly DEV_IMAGE="protrackr-dev-app:latest"
readonly PROD_IMAGE="protrackr-app:latest"
readonly PROD_COMPOSE="docker-compose.yml"
readonly PROD_APP="protrackr-app"
readonly PROD_DB="protrackr-mysql"
readonly HEALTH_URL="http://localhost:3010/version.json"
readonly BACKUP_DIR="db-migration"

DRY_RUN=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift;;
    --help|-h) echo "Promotion Dev->Prod (bit-identisch). Optionen: --dry-run."; exit 0;;
    *) echo -e "${RED}Unbekannte Option: $1${NC}" >&2; exit 1;;
  esac
done

cd "$(dirname "$0")/.." 2>/dev/null || true

echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  ProTrackr PROMOTION  DEV ──►  PROD  (bit-identisch)${NC}"
echo -e "${CYAN}============================================================${NC}"

# -----------------------------------------------------------------------------
# [1/8] Quelle prüfen: Dev-Image existiert?
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[1/8] Quelle prüfen (Dev-Image)...${NC}"
if ! docker image inspect "$DEV_IMAGE" >/dev/null 2>&1; then
  echo -e "${RED}  $DEV_IMAGE nicht gefunden. Erst Dev deployen (deploy-dev.sh) + testen.${NC}" >&2
  exit 1
fi
DEV_IMAGE_ID=$(docker image inspect --format='{{.Id}}' "$DEV_IMAGE" | cut -c8-19)
echo -e "${GREEN}  $DEV_IMAGE ($DEV_IMAGE_ID)${NC}"

# Aktuelle Prod-Version (für Rollback-Info + Vergleich)
PROD_VERSION_NOW=$(curl -s "$HEALTH_URL" 2>/dev/null | grep -o '"version"[^,]*' | head -1 || echo "?")
echo -e "  Prod aktuell live: ${GRAY}${PROD_VERSION_NOW}${NC}"

# -----------------------------------------------------------------------------
# [2/8] Success-Criteria-Gate
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[2/8] Success-Criteria-Gate...${NC}"
echo -e "${GRAY}  Bitte bestätige, dass ALLE erfüllt sind (Governance-Regel):${NC}"
echo "    1. tsc --noEmit + vitest run grün"
echo "    2. Dieser Stand lief auf DEV, app-dev + mysql-dev healthy"
echo "    3. Health-Gate Dev ok, keine DB-Fehler im app-dev-Log"
echo "    4. Manuelle Funktionsabnahme der Änderung in DEV erfolgt"
echo "    5. kein offener kritischer Bug im geänderten Bereich"
echo "    6. (dieses Skript macht das Prod-Backup automatisch = Kriterium 6)"
echo "    7. explizite Freigabe = deine Bestätigung jetzt"
if [[ "$DRY_RUN" == "true" ]]; then
  echo -e "${GRAY}  (Dry-Run: kein Prompt, es wird nichts verändert.)${NC}"
else
  read -rp "  Alle Success Criteria erfüllt und Promotion freigeben? (PROMOTE/no): " CONFIRM
  if [[ "$CONFIRM" != "PROMOTE" ]]; then
    echo "  Abgebrochen (kein 'PROMOTE' eingegeben)."
    exit 0
  fi
fi

TS=$(date +%Y-%m-%d_%H-%M-%S)

# -----------------------------------------------------------------------------
# [3/8] Prod-DB-Backup (VOR jeder Änderung — Leitplanke)
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[3/8] Prod-DB-Backup...${NC}"
if [[ "$DRY_RUN" == "true" ]]; then
  echo -e "${GRAY}  (Dry-Run: übersprungen)${NC}"
else
  BACKUP_FILE="$BACKUP_DIR/prod-pre-promote-$TS.sql"
  docker exec "$PROD_DB" sh -c 'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --no-tablespaces --single-transaction --routines --triggers --events protrackr' > "$BACKUP_FILE"
  BK_SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || echo 0)
  if [[ "$BK_SIZE" -lt 1000 ]]; then
    echo -e "${RED}  Backup verdächtig klein ($BK_SIZE B). Abbruch.${NC}" >&2
    exit 1
  fi
  echo -e "${GREEN}  $BACKUP_FILE ($((BK_SIZE/1024)) KB)${NC}"
fi

# -----------------------------------------------------------------------------
# [4/8] Altes Prod-Image als Rollback-Tag sichern
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[4/8] Rollback-Tag des aktuellen Prod-Image...${NC}"
ROLLBACK_IMAGE="protrackr-app:rollback-$TS"
if [[ "$DRY_RUN" == "true" ]]; then
  echo -e "${GRAY}  (Dry-Run: würde $PROD_IMAGE -> $ROLLBACK_IMAGE taggen)${NC}"
else
  if docker image inspect "$PROD_IMAGE" >/dev/null 2>&1; then
    docker tag "$PROD_IMAGE" "$ROLLBACK_IMAGE"
    echo -e "${GREEN}  gesichert: $ROLLBACK_IMAGE${NC}"
  else
    echo -e "${YELLOW}  $PROD_IMAGE existiert noch nicht (Erst-Promotion) — kein Rollback-Tag.${NC}"
    ROLLBACK_IMAGE=""
  fi
fi

# -----------------------------------------------------------------------------
# [5/8] PROMOTION: Dev-Image bit-identisch auf Prod-Image taggen
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[5/8] Promotion (docker tag $DEV_IMAGE -> $PROD_IMAGE)...${NC}"
if [[ "$DRY_RUN" == "true" ]]; then
  echo -e "${GRAY}  (Dry-Run: übersprungen)${NC}"
else
  docker tag "$DEV_IMAGE" "$PROD_IMAGE"
  NEW_ID=$(docker image inspect --format='{{.Id}}' "$PROD_IMAGE" | cut -c8-19)
  echo -e "${GREEN}  Prod-Image = $NEW_ID (identisch zu Dev $DEV_IMAGE_ID)${NC}"
fi

# -----------------------------------------------------------------------------
# [6/8] Prod starten mit promotetem Image (--no-build = kein Rebuild)
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[6/8] Prod-App mit promotetem Image starten (--no-build)...${NC}"
if [[ "$DRY_RUN" == "true" ]]; then
  echo -e "${GRAY}  (Dry-Run: würde 'docker compose -f $PROD_COMPOSE up -d --no-build app')${NC}"
  echo -e "${GRAY}  (Dry-Run Ende — nichts verändert.)${NC}"
  exit 0
fi
# Marker für guard-prod-watch.sh: die folgenden protrackr-app-Events sind
# LEGITIM (dieser Deploy), nicht ein direkter Eingriff → kein Fehlalarm.
date +%s > /tmp/protrackr-prod-deploy.marker 2>/dev/null || true
docker compose -f "$PROD_COMPOSE" up -d --no-build app 2>&1 | tail -8

# -----------------------------------------------------------------------------
# [7/8] Health-Gate
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[7/8] Health-Gate (Prod :3010)...${NC}"
HEALTHY=false
for i in $(seq 1 30); do
  H=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$PROD_APP" 2>/dev/null || echo "starting")
  S=$(docker inspect --format='{{.State.Status}}' "$PROD_APP" 2>/dev/null || echo "unknown")
  echo -e "  [$((i*5))s] state=$S health=$H"
  if [[ "$H" == "healthy" ]]; then HEALTHY=true; break; fi
  if [[ "$S" == "exited" || "$S" == "dead" ]]; then break; fi
  sleep 5
done
GOT=$(curl -s "$HEALTH_URL" 2>/dev/null | grep -o '"version"[^,]*' | head -1 || echo "")

# -----------------------------------------------------------------------------
# [8/8] Ergebnis / Auto-Rollback
# -----------------------------------------------------------------------------
if [[ "$HEALTHY" == "true" && -n "$GOT" ]]; then
  echo ""
  echo -e "${CYAN}============================================================${NC}"
  echo -e "${GREEN}  PROMOTION ERFOLGREICH — Prod live: $GOT${NC}"
  echo -e "${CYAN}============================================================${NC}"
  echo -e "  ${GRAY}Backup: $BACKUP_DIR/prod-pre-promote-$TS.sql${NC}"
  [[ -n "$ROLLBACK_IMAGE" ]] && echo -e "  ${GRAY}Rollback-Image (falls später nötig): $ROLLBACK_IMAGE${NC}"
  echo -e "  ${GRAY}Hinweis: Falls der neue Stand DB-Migrationen braucht, jetzt${NC}"
  echo -e "  ${GRAY}manuell anwenden (Backup steht). v2.1.x = keine neuen Migrationen.${NC}"
else
  echo ""
  echo -e "${RED}============================================================${NC}"
  echo -e "${RED}  HEALTH-GATE FEHLGESCHLAGEN — AUTO-ROLLBACK${NC}"
  echo -e "${RED}============================================================${NC}"
  docker compose -f "$PROD_COMPOSE" logs --tail=20 app 2>&1 | tail -20
  if [[ -n "$ROLLBACK_IMAGE" ]]; then
    echo -e "${YELLOW}  Rolle Prod-Image zurück: $ROLLBACK_IMAGE -> $PROD_IMAGE${NC}"
    docker tag "$ROLLBACK_IMAGE" "$PROD_IMAGE"
    docker compose -f "$PROD_COMPOSE" up -d --no-build app 2>&1 | tail -5
    echo -e "${YELLOW}  Prod-Image zurückgerollt. DB ggf. aus Backup wiederherstellen:${NC}"
    echo -e "  ${GRAY}$BACKUP_DIR/prod-pre-promote-$TS.sql${NC}"
  else
    echo -e "${RED}  Kein Rollback-Image (Erst-Promotion). Prod-Container prüfen!${NC}"
  fi
  exit 1
fi
