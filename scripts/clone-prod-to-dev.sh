#!/bin/bash
# =============================================================================
# scripts/clone-prod-to-dev.sh
# =============================================================================
# Klont die PROD-Datenbank in die DEV-Datenbank auf dem NAS.
#
#   RICHTUNG IST FEST VERDRAHTET:  Prod  ──►  Dev
#   Niemals umgekehrt. Prod wird ausschliesslich GELESEN (mysqldump), nie
#   beschrieben. Dev wird komplett ersetzt (es ist ein Wegwerf-Klon).
#
# Verwendung (im Compose-Verzeichnis /mnt/user/appdata/protrackr):
#   ./scripts/clone-prod-to-dev.sh            # interaktiv (fragt vor Ueberschreiben)
#   ./scripts/clone-prod-to-dev.sh --yes      # ohne Rueckfrage (z.B. Cron)
#   ./scripts/clone-prod-to-dev.sh --dry-run  # zeigt nur, was passieren wuerde
#
# Voraussetzung: beide DB-Container laufen + healthy (Prod-Stack + Dev-Stack).
#   Prod:  docker compose up -d mysql
#   Dev:   docker compose -f compose.dev.yml up -d mysql
#
# Passwoerter werden NICHT hier gelesen — jeder Container nutzt sein eigenes,
# schon gesetztes $MYSQL_ROOT_PASSWORD (aus seiner compose-environment). Damit
# gibt es keine Passwort-Kollision zwischen Prod und Dev und keine Secrets im
# Klartext in diesem Skript.
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; GRAY='\033[0;90m'; NC='\033[0m'

# --- FESTE Container (bewusst KEINE Argumente — verhindert Richtungs-Verwechslung)
readonly PROD_DB_CONTAINER="protrackr-mysql"
readonly DEV_DB_CONTAINER="protrackr-mysql-dev"
readonly DB_NAME="protrackr"

DRY_RUN=false
ASSUME_YES=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift;;
    --yes|-y)  ASSUME_YES=true; shift;;
    --help|-h)
      echo "Klont Prod-DB ($PROD_DB_CONTAINER) -> Dev-DB ($DEV_DB_CONTAINER)."
      echo "Optionen: --dry-run (nur zeigen), --yes (ohne Rueckfrage)."
      exit 0;;
    *) echo -e "${RED}Unbekannte Option: $1${NC}" >&2; exit 1;;
  esac
done

# --- Harte Sicherheits-Assertion: Prod und Dev DUERFEN NIE identisch sein ----
if [[ "$PROD_DB_CONTAINER" == "$DEV_DB_CONTAINER" ]]; then
  echo -e "${RED}FATAL: Prod- und Dev-Container sind identisch. Abbruch (Datenschutz).${NC}" >&2
  exit 1
fi

echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  ProTrackr DB-Klon:  PROD  ──►  DEV${NC}"
echo -e "${CYAN}============================================================${NC}"
echo -e "  Quelle (nur lesen): ${GREEN}$PROD_DB_CONTAINER${NC}"
echo -e "  Ziel  (wird ersetzt): ${YELLOW}$DEV_DB_CONTAINER${NC}"
echo ""

# --- Helfer: Query in einem DB-Container ausfuehren (nutzt Container-internes PW)
db_query() {  # $1 = container, $2 = sql
  docker exec "$1" sh -c "exec mysql -u root -p\"\$MYSQL_ROOT_PASSWORD\" -N -se \"$2\"" 2>/dev/null
}

# --- Helfer: Container laeuft + healthy? -------------------------------------
require_healthy() {  # $1 = container
  if ! docker ps --format '{{.Names}}' | grep -qx "$1"; then
    echo -e "${RED}  Container '$1' laeuft nicht. Bitte zuerst starten.${NC}" >&2
    exit 1
  fi
  local health
  health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$1" 2>/dev/null || echo "unknown")
  if [[ "$health" != "healthy" && "$health" != "none" ]]; then
    echo -e "${RED}  Container '$1' ist nicht healthy (Status: $health).${NC}" >&2
    exit 1
  fi
}

# -----------------------------------------------------------------------------
echo -e "${YELLOW}[1/5] Container pruefen...${NC}"
require_healthy "$PROD_DB_CONTAINER"
require_healthy "$DEV_DB_CONTAINER"
echo -e "${GREEN}  Beide Container laufen + healthy.${NC}"

# -----------------------------------------------------------------------------
echo -e "${YELLOW}[2/5] Bestandsaufnahme (Quelle vs Ziel)...${NC}"
PROD_TABLES=$(db_query "$PROD_DB_CONTAINER" "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';")
DEV_TABLES=$(db_query "$DEV_DB_CONTAINER"  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';")
echo -e "  Prod-Tabellen: ${GREEN}${PROD_TABLES:-0}${NC}   Dev-Tabellen (werden ersetzt): ${YELLOW}${DEV_TABLES:-0}${NC}"

if [[ "${PROD_TABLES:-0}" -eq 0 ]]; then
  echo -e "${RED}  Quelle (Prod) hat 0 Tabellen — nichts zu klonen. Abbruch.${NC}" >&2
  exit 1
fi

# -----------------------------------------------------------------------------
echo -e "${YELLOW}[3/5] Bestaetigung...${NC}"
if [[ "$DRY_RUN" == "true" ]]; then
  echo -e "${GRAY}  (Dry-Run: es wird NICHTS veraendert. Ende.)${NC}"
  exit 0
fi
if [[ "$ASSUME_YES" != "true" ]]; then
  echo -e "  ${YELLOW}Die Dev-DB '$DB_NAME' in '$DEV_DB_CONTAINER' wird KOMPLETT ersetzt.${NC}"
  read -rp "  Fortfahren? (yes/no): " CONFIRM
  if [[ "$CONFIRM" != "yes" ]]; then
    echo "  Abgebrochen."
    exit 0
  fi
fi

# -----------------------------------------------------------------------------
echo -e "${YELLOW}[4/5] Klonen (Prod-Dump direkt in Dev importieren)...${NC}"
# Direkter Stream Prod -> Dev, keine Zwischendatei (keine Produktivdaten auf Disk).
# mysqldump-stderr-Zeilen ("mysqldump: [Warning]...") werden herausgefiltert,
# damit sie nicht als SQL im Import landen (Lektion aus migrate-db.sh).
# --no-tablespaces vermeidet die PROCESS-privilege-Warnung.
set +e
docker exec "$PROD_DB_CONTAINER" sh -c \
  'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --no-tablespaces --single-transaction --routines --triggers --events --default-character-set=utf8mb4 protrackr' \
  2>/dev/null \
| grep -v '^mysqldump:' \
| docker exec -i "$DEV_DB_CONTAINER" sh -c \
  'exec mysql -u root -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 protrackr'
CLONE_RC=$?
set -e
if [[ $CLONE_RC -ne 0 ]]; then
  echo -e "${RED}  Klon fehlgeschlagen (Exit $CLONE_RC). Dev-DB koennte unvollstaendig sein.${NC}" >&2
  exit 1
fi
echo -e "${GREEN}  Klon-Stream abgeschlossen.${NC}"

# -----------------------------------------------------------------------------
echo -e "${YELLOW}[5/5] Verifikation (Dev sollte jetzt == Prod sein)...${NC}"
DEV_TABLES_AFTER=$(db_query "$DEV_DB_CONTAINER" "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';")
echo -e "  Tabellen  Prod: ${GREEN}$PROD_TABLES${NC}   Dev nach Klon: ${GREEN}$DEV_TABLES_AFTER${NC}"

MISMATCH=0
for T in mandanten users customers timeEntries expenses exchangeRates; do
  P=$(db_query "$PROD_DB_CONTAINER" "SELECT COUNT(*) FROM \`$DB_NAME\`.\`$T\`;" 2>/dev/null || echo "n/a")
  D=$(db_query "$DEV_DB_CONTAINER"  "SELECT COUNT(*) FROM \`$DB_NAME\`.\`$T\`;" 2>/dev/null || echo "n/a")
  if [[ "$P" == "$D" ]]; then
    printf "    %-16s Prod=%-6s Dev=%-6s ${GREEN}OK${NC}\n" "$T" "$P" "$D"
  else
    printf "    %-16s Prod=%-6s Dev=%-6s ${RED}MISMATCH${NC}\n" "$T" "$P" "$D"
    MISMATCH=1
  fi
done

echo ""
if [[ "$PROD_TABLES" == "$DEV_TABLES_AFTER" && "$MISMATCH" -eq 0 ]]; then
  echo -e "${CYAN}============================================================${NC}"
  echo -e "${GREEN}  KLON ERFOLGREICH — Dev entspricht Prod.${NC}"
  echo -e "${CYAN}============================================================${NC}"
else
  echo -e "${RED}  WARNUNG: Abweichung zwischen Prod und Dev. Bitte pruefen.${NC}"
  exit 1
fi
