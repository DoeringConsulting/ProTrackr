#!/bin/bash
# =============================================================================
# scripts/deploy-dev.sh
# =============================================================================
# Deployt den aktuellen origin/nas-setup-Stand auf die DEV-Umgebung (:9444).
#
# Dev-Loop-Schritt: NACHDEM main->nas-setup gemergt + gepusht wurde (auf dem
# Laptop, Claude-gesteuert mit Leitplanken), bringt dieses Skript den Stand
# auf Dev — pull + rebuild app-dev + Health-Gate.
#
#   BETRIFFT AUSSCHLIESSLICH DEV.  Prod (docker-compose.yml, protrackr-app,
#   :9443) wird NICHT angefasst — dieses Skript nutzt nur compose.dev.yml.
#   (Governance: PROD nur via Dev->Prod-Promotion, siehe deploy-prod in A4.)
#
# Verwendung (im Compose-Verzeichnis /mnt/user/appdata/protrackr):
#   ./scripts/deploy-dev.sh
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; GRAY='\033[0;90m'; NC='\033[0m'

readonly COMPOSE_FILE="compose.dev.yml"
readonly APP_CONTAINER="protrackr-app-dev"
readonly HEALTH_URL="http://localhost:3011/version.json"

cd "$(dirname "$0")/.." 2>/dev/null || true   # ins Repo-Root (falls aus scripts/ aufgerufen)

echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  ProTrackr DEV-Deploy  (nur :9444 — Prod unberührt)${NC}"
echo -e "${CYAN}============================================================${NC}"

# Sicherheits-Assertion: compose.dev.yml muss existieren (nie versehentlich Prod)
if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo -e "${RED}  $COMPOSE_FILE nicht gefunden — bist du im Compose-Verzeichnis?${NC}" >&2
  exit 1
fi

echo -e "${YELLOW}[1/5] Stand holen (origin/nas-setup)...${NC}"
git fetch origin
BEFORE=$(git rev-parse --short HEAD)
git reset --hard origin/nas-setup
AFTER=$(git rev-parse --short HEAD)
if [[ "$BEFORE" == "$AFTER" ]]; then
  echo -e "${GREEN}  Stand unverändert ($AFTER) — Rebuild trotzdem (idempotent).${NC}"
else
  echo -e "${GREEN}  $BEFORE -> $AFTER${NC}"
fi

echo -e "${YELLOW}[2/5] Erwartete Version...${NC}"
EXPECTED=$(grep '"version"' package.json | head -1 | sed -E 's/.*"version"[: ]*"([^"]+)".*/\1/')
echo -e "${GREEN}  package.json: $EXPECTED${NC}"

echo -e "${YELLOW}[3/5] Dev-App bauen + starten (--no-deps: mysql-dev unangetastet)...${NC}"
docker compose -f "$COMPOSE_FILE" up -d --build --no-deps app 2>&1 | tail -8

echo -e "${YELLOW}[4/5] Warten auf healthy...${NC}"
OK=false
for i in $(seq 1 30); do
  H=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$APP_CONTAINER" 2>/dev/null || echo "starting")
  S=$(docker inspect --format='{{.State.Status}}' "$APP_CONTAINER" 2>/dev/null || echo "unknown")
  echo -e "  [$((i*5))s] state=$S health=$H"
  if [[ "$H" == "healthy" ]]; then OK=true; break; fi
  if [[ "$S" == "exited" || "$S" == "dead" ]]; then
    echo -e "${RED}  app-dev gecrasht — Logs:${NC}"
    docker compose -f "$COMPOSE_FILE" logs --tail=30 app
    exit 1
  fi
  sleep 5
done
if [[ "$OK" != "true" ]]; then
  echo -e "${RED}  Timeout: app-dev nicht healthy. Logs:${NC}"
  docker compose -f "$COMPOSE_FILE" logs --tail=30 app
  exit 1
fi

echo -e "${YELLOW}[5/5] Health-Gate: version.json auf :9444...${NC}"
GOT=$(curl -s "$HEALTH_URL" 2>/dev/null | grep -o '"version"[^,]*' | head -1 || echo "")
echo -e "  live: ${GREEN}${GOT:-<keine Antwort>}${NC}"

echo ""
if echo "$GOT" | grep -q "\"$EXPECTED\""; then
  echo -e "${CYAN}============================================================${NC}"
  echo -e "${GREEN}  DEV-DEPLOY OK — v$EXPECTED live auf https://dcs01.taile370c2.ts.net:9444${NC}"
  echo -e "${CYAN}============================================================${NC}"
  echo ""
  echo -e "  ${GRAY}Nächster Schritt: in Dev testen. Bei Freigabe -> Promotion nach Prod (A4).${NC}"
else
  echo -e "${RED}  WARNUNG: Live-Version != erwartet ($EXPECTED). Bitte prüfen.${NC}"
  exit 1
fi
