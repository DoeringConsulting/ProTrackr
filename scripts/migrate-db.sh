#!/bin/bash
# =============================================================================
# scripts/migrate-db.sh
# =============================================================================
# Zweck:
#   Importiert einen MySQL-Dump (.sql oder .sql.gz) in den protrackr-mysql
#   Container, der via docker-compose laeuft. Verifiziert vor und nach dem
#   Import die Anzahl der Tabellen und gibt eine Zusammenfassung aus.
#
# Voraussetzungen:
#   - docker-compose Stack ist deployed
#   - mysql Container laeuft und ist healthy
#   - .env existiert im Compose-Verzeichnis mit MYSQL_* Variablen
#   - Skript wird im Compose-Verzeichnis ausgefuehrt
#     (default: /mnt/user/appdata/protrackr)
#
# Verwendung:
#   ./scripts/migrate-db.sh <pfad-zum-dump>
#   ./scripts/migrate-db.sh db-migration/protrackr-dump-2026-05-28.sql.gz
#   ./scripts/migrate-db.sh --dry-run db-migration/dump.sql.gz
#
# Sicherheit:
#   - Falls Datenbank schon Tabellen enthaelt: Skript fragt nach Bestaetigung
#   - Dump-Datei wird NICHT automatisch geloescht (manuell nach Verifizierung)
# =============================================================================

set -euo pipefail

# Farben fuer Output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m'  # No Color

DRY_RUN=false
DUMP_FILE=""

# -----------------------------------------------------------------------------
# Argumente parsen
# -----------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help|-h)
      echo "Verwendung: $0 [--dry-run] <pfad-zum-dump>"
      echo "  --dry-run: zeigt nur was getan wuerde, fuehrt nichts aus"
      exit 0
      ;;
    -*)
      echo -e "${RED}Unbekannte Option: $1${NC}" >&2
      exit 1
      ;;
    *)
      if [[ -z "$DUMP_FILE" ]]; then
        DUMP_FILE="$1"
      else
        echo -e "${RED}Zu viele Argumente.${NC}" >&2
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$DUMP_FILE" ]]; then
  echo -e "${RED}Fehler: Kein Dump-Pfad angegeben.${NC}" >&2
  echo "Verwendung: $0 [--dry-run] <pfad-zum-dump>" >&2
  exit 1
fi

# -----------------------------------------------------------------------------
# Header
# -----------------------------------------------------------------------------
echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  ProTrackr DB-Import Skript${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# -----------------------------------------------------------------------------
# 1. Voraussetzungen pruefen
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[1/6] Voraussetzungen pruefen...${NC}"

if [[ ! -f "$DUMP_FILE" ]]; then
  echo -e "${RED}  Dump-Datei nicht gefunden: $DUMP_FILE${NC}" >&2
  exit 1
fi
echo -e "${GREEN}  Dump-Datei gefunden: $DUMP_FILE${NC}"

if ! command -v docker >/dev/null 2>&1; then
  echo -e "${RED}  docker nicht im PATH gefunden.${NC}" >&2
  exit 1
fi

if [[ ! -f ".env" ]]; then
  echo -e "${RED}  .env nicht gefunden im aktuellen Verzeichnis: $(pwd)${NC}" >&2
  echo "  Wechsele zuerst ins Compose-Verzeichnis: cd /mnt/user/appdata/protrackr" >&2
  exit 1
fi
echo -e "${GREEN}  .env gefunden${NC}"

# -----------------------------------------------------------------------------
# 2. Variablen aus .env laden
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[2/6] Variablen laden...${NC}"

# shellcheck disable=SC1091
set -a
source .env
set +a

: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD ist nicht in .env gesetzt}"
: "${MYSQL_DATABASE:?MYSQL_DATABASE ist nicht in .env gesetzt}"

echo -e "${GREEN}  Datenbank: $MYSQL_DATABASE${NC}"
echo -e "${GREEN}  Root-Passwort: (geladen, ${#MYSQL_ROOT_PASSWORD} Zeichen)${NC}"

# -----------------------------------------------------------------------------
# 3. MySQL-Container Status pruefen
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[3/6] MySQL-Container pruefen...${NC}"

if ! docker compose ps mysql --status running --quiet | grep -q .; then
  echo -e "${RED}  MySQL-Container laeuft nicht.${NC}" >&2
  echo "  Starte ihn zuerst: docker compose up -d mysql" >&2
  exit 1
fi
echo -e "${GREEN}  MySQL-Container laeuft${NC}"

# Healthcheck pruefen
HEALTH=$(docker inspect --format='{{.State.Health.Status}}' protrackr-mysql 2>/dev/null || echo "unknown")
if [[ "$HEALTH" != "healthy" ]]; then
  echo -e "${YELLOW}  Healthcheck: $HEALTH${NC}"
  echo "  Warte 10 Sekunden auf 'healthy'..."
  for i in $(seq 1 10); do
    sleep 1
    HEALTH=$(docker inspect --format='{{.State.Health.Status}}' protrackr-mysql 2>/dev/null || echo "unknown")
    if [[ "$HEALTH" == "healthy" ]]; then
      break
    fi
  done
  if [[ "$HEALTH" != "healthy" ]]; then
    echo -e "${RED}  MySQL nicht healthy nach 10s. Logs: docker compose logs mysql${NC}" >&2
    exit 1
  fi
fi
echo -e "${GREEN}  MySQL ist healthy${NC}"

# -----------------------------------------------------------------------------
# 4. Vorab-Check: Schon Daten drin?
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[4/6] Vorab-Check der Ziel-Datenbank...${NC}"

EXISTING_TABLES=$(docker exec protrackr-mysql mysql \
  -u root -p"$MYSQL_ROOT_PASSWORD" \
  -se "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$MYSQL_DATABASE';" 2>/dev/null)

echo -e "${GREEN}  Tabellen in $MYSQL_DATABASE vor Import: $EXISTING_TABLES${NC}"

if [[ "$EXISTING_TABLES" -gt 0 ]]; then
  echo -e "${YELLOW}  ACHTUNG: Datenbank enthaelt bereits Tabellen.${NC}"
  echo "  Ein Import koennte bestehende Daten ueberschreiben."
  if [[ "$DRY_RUN" == "false" ]]; then
    read -rp "  Trotzdem fortfahren? (yes/no): " CONFIRM
    if [[ "$CONFIRM" != "yes" ]]; then
      echo "  Abgebrochen."
      exit 0
    fi
  fi
fi

# -----------------------------------------------------------------------------
# 5. Import ausfuehren
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[5/6] Import ausfuehren...${NC}"

DUMP_SIZE=$(stat -c%s "$DUMP_FILE")
echo -e "${GREEN}  Dump-Groesse: $((DUMP_SIZE / 1024 / 1024)) MB${NC}"

if [[ "$DRY_RUN" == "true" ]]; then
  echo -e "${GRAY}  (Dry-Run: ueberspringe Import)${NC}"
else
  if [[ "$DUMP_FILE" == *.gz ]]; then
    echo "  Importiere komprimiertes Dump..."
    gunzip -c "$DUMP_FILE" | docker exec -i protrackr-mysql mysql \
      -u root -p"$MYSQL_ROOT_PASSWORD" \
      --default-character-set=utf8mb4 \
      "$MYSQL_DATABASE"
  else
    echo "  Importiere unkomprimiertes Dump..."
    docker exec -i protrackr-mysql mysql \
      -u root -p"$MYSQL_ROOT_PASSWORD" \
      --default-character-set=utf8mb4 \
      "$MYSQL_DATABASE" < "$DUMP_FILE"
  fi
  echo -e "${GREEN}  Import abgeschlossen${NC}"
fi

# -----------------------------------------------------------------------------
# 6. Verifikation
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[6/6] Verifikation nach Import...${NC}"

if [[ "$DRY_RUN" == "true" ]]; then
  echo -e "${GRAY}  (Dry-Run: ueberspringe Verifikation)${NC}"
else
  NEW_TABLES=$(docker exec protrackr-mysql mysql \
    -u root -p"$MYSQL_ROOT_PASSWORD" \
    -se "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$MYSQL_DATABASE';" 2>/dev/null)
  echo -e "${GREEN}  Tabellen in $MYSQL_DATABASE nach Import: $NEW_TABLES${NC}"

  # Wichtige Tabellen-Zeilen-Counts ausgeben
  echo "  Zeilenanzahl wichtiger Tabellen:"
  for TABLE in mandanten users customers timeEntries expenses exchangeRates; do
    COUNT=$(docker exec protrackr-mysql mysql \
      -u root -p"$MYSQL_ROOT_PASSWORD" \
      -se "SELECT COUNT(*) FROM \`$MYSQL_DATABASE\`.\`$TABLE\`;" 2>/dev/null || echo "n/a")
    printf "    %-20s %s\n" "$TABLE:" "$COUNT"
  done
fi

# -----------------------------------------------------------------------------
# Zusammenfassung
# -----------------------------------------------------------------------------
echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${GREEN}  FERTIG${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""
echo "  Naechste Schritte:"
echo "  1. App-Container starten:    docker compose up -d app"
echo "  2. Logs pruefen:             docker compose logs -f app"
echo "  3. Login testen:             https://dcs01.taile370c2.ts.net:9443"
echo ""
echo -e "${YELLOW}  WICHTIG:${NC}"
echo "  Nach erfolgreichem Login + Daten-Verifizierung:"
echo "  Dump-Datei sicher loeschen: shred -u $DUMP_FILE"
echo ""
