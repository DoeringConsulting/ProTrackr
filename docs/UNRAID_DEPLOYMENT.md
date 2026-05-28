# ProTrackr auf Unraid 7.2.5 — Schritt-für-Schritt-Anleitung

> **Zielgruppe:** Du selbst (Alexander), beim Einrichten des NAS-Containers
> **Voraussetzung:** Unraid läuft, du hast Admin-Zugriff via Web-UI, Tailscale ist installiert und der Hostname `dcs01.taile370c2.ts.net` ist erreichbar.

---

## 📋 Voraussetzungen prüfen

Vor dem ersten Stack-Deployment:

| Check | Wie | Soll-Zustand |
|---|---|---|
| Unraid-Version | UI oben links | 7.2.5 (oder neuer im 7.x-Zweig) |
| Docker-Service | Settings → Docker | aktiviert, lokales Image-Verzeichnis konfiguriert |
| Community Apps | Plugins-Tab | installiert (✅ verifiziert bei Klärung 0.2) |
| Compose Manager Plugin | Plugins-Tab | **muss noch installiert werden** falls fehlt |
| Tailscale Plugin | Plugins-Tab | installiert (✅ verifiziert) |
| Tailscale Hostname | `tailscale status` im Terminal | `dcs01.taile370c2.ts.net` aktiv |
| Web-Terminal | Icon rechts oben in Unraid-UI | erreichbar |
| Freie Ports | (siehe HISTORY Phase 0.5) | **9443 frei** (verifiziert) |

---

## 🔌 Plugin: Compose Manager installieren

Falls noch nicht da:

1. Unraid Web-UI → **Apps** (Community Applications)
2. Suche nach **"Compose Manager"** (von Squid / Lime Technology)
3. Install klicken
4. Nach Installation: neuer Menüpunkt **Docker → Compose Manager** taucht auf

> **Alternative:** Falls du Compose-Files lieber direkt über die Kommandozeile managst, kannst du `docker-compose` auch im Unraid-Terminal direkt aufrufen — Unraid bringt das Binary mit. Compose Manager ist nur ein UI-Komfort.

---

## 📁 Verzeichnis-Layout auf dem NAS

Vorschlag für saubere Struktur (anpassbar):

```
/mnt/user/appdata/protrackr/         ← Compose-Working-Directory
├── docker-compose.yml               ← gepullt aus dem Repo
├── .env                             ← lokal angelegt, NICHT im Git
├── Dockerfile                       ← gepullt aus dem Repo
├── .dockerignore                    ← gepullt aus dem Repo
├── package.json                     ← aus dem Repo (für Container-Build)
├── pnpm-lock.yaml                   ← aus dem Repo
├── patches/                         ← aus dem Repo
├── client/, server/, shared/, ...   ← Source-Code (für Container-Build)
├── drizzle/                         ← Schema-Migrations
└── mysql_data/                      ← (optional, bei Bind-Mount für DB-Volume)
```

**Erste Einrichtung:** Repo direkt nach `/mnt/user/appdata/protrackr/` clonen:

```bash
# Im Unraid Web-Terminal
mkdir -p /mnt/user/appdata
cd /mnt/user/appdata
git clone --branch nas-setup https://github.com/DoeringConsulting/ProTrackr.git protrackr
cd protrackr
ls -la
```

---

## 🔐 `.env` anlegen (Variante A: file-basiert)

Im Compose-Verzeichnis:

```bash
cd /mnt/user/appdata/protrackr
cp .env.production.example .env
chmod 600 .env
```

Dann editieren (z.B. `nano .env` oder über Unraid-File-Manager) und alle `CHANGE_ME_*` Werte ersetzen:

**Secret-Generierung direkt im Terminal:**
```bash
# Vier Mal ausführen — eines pro Secret:
openssl rand -hex 32

# Drei Mal ausführen — eines pro DB-Passwort (root, app-user, derselbe wert in DATABASE_URL):
openssl rand -base64 24
```

**Wichtig:** Wenn du `.env` anlegst, **niemals committen**. Sie ist in `.gitignore`.

---

## 🔐 Container Variables (Variante B: Unraid-GUI, Masked) — EMPFOHLEN

Statt einer `.env`-Datei kannst du Secrets direkt in der Unraid-Compose-Manager-UI als **Container Variables mit "Masked"-Flag** setzen. Vorteile: erscheinen nicht in Logs, nicht in Backups (sofern verschlüsselt), nicht im Filesystem.

**Schritte:**
1. Compose Manager → "Add New Stack" → Name: `protrackr`
2. Compose-File-Pfad: `/mnt/user/appdata/protrackr/docker-compose.yml`
3. Container Variables: Tab öffnen → für jedes Secret eine Variable anlegen, "Masked" markieren
4. Stack speichern, aber **noch nicht starten**

---

## 🏗️ Datenbank vorbereiten (zwei Wege)

### Weg A — Fresh-Start (leere DB, Schema via Drizzle)

Falls du noch keine Daten vom Notebook übertragen willst:

```bash
cd /mnt/user/appdata/protrackr
docker compose up -d mysql                                    # MySQL alleine starten
docker compose ps mysql                                       # warten bis "healthy"
docker compose exec app pnpm db:push                          # Schema anwenden
# (geht erst nach erstem app-Start; alternativ direkt SQL aus drizzle/*.sql einspielen)
```

### Weg B — Daten-Migration vom Notebook (mit `scripts/migrate-db.sh`)

Vorbereitung auf dem Notebook (siehe `scripts/migrate-db.ps1`) und dann auf dem NAS:

```bash
# Dump vom Notebook auf den NAS kopieren (z.B. via Tailscale-IP oder SMB-Share)
scp protrackr-dump-2026-05-28.sql.gz dcs01:/mnt/user/appdata/protrackr/db-migration/

# Import auf NAS
cd /mnt/user/appdata/protrackr
docker compose up -d mysql
docker compose ps mysql                                       # warten bis healthy
./scripts/migrate-db.sh db-migration/protrackr-dump-2026-05-28.sql.gz
```

---

## 🚀 Stack starten

```bash
cd /mnt/user/appdata/protrackr
docker compose build                  # Erstes Mal: 5–10 Minuten (Image-Pulls + pnpm install + vite build)
docker compose up -d                  # Alle Services starten
docker compose ps                     # beide sollten "running (healthy)" sein
docker compose logs -f app            # Live-Logs der App
```

**Erfolgs-Indikatoren:**
- `protrackr-app` ist `Up (healthy)`
- `protrackr-mysql` ist `Up (healthy)`
- App-Log enthält `[Auth] AUTHENTICATION ACTIVATED` oder ähnliche Startmeldung
- Auf NAS lokal: `curl -I http://localhost:3000/` → `200 OK`

---

## 🌐 Tailscale Serve einrichten (Port 9443)

Mit der App auf `localhost:3000` aktiv, jetzt Tailscale-Routing:

```bash
# Aktiviert Port 9443 (extern) → http://localhost:3000 (intern)
tailscale serve --bg --https=9443 http://localhost:3000

# Status anzeigen
tailscale serve status
```

**Erwartete Ausgabe `tailscale serve status`:**
```
https://dcs01.taile370c2.ts.net (tailnet only)
|-- /
    proxy http://127.0.0.1:3000
```

**Test:**
```bash
# Vom Notebook (mit Tailscale aktiv):
curl -I https://dcs01.taile370c2.ts.net:9443/
# Erwartet: HTTP/2 200, gültiges Cert
```

Oder einfach im Browser: `https://dcs01.taile370c2.ts.net:9443` → ProTrackr-Login.

### Tailscale Serve persistieren

`tailscale serve --bg` ist beim nächsten NAS-Reboot weg. Damit es persistiert:

**Variante 1 — Unraid User Scripts Plugin:**
1. Plugins → User Scripts installieren
2. Neues Skript anlegen: `tailscale-serve-protrackr`
3. Schedule: "At Startup of Array"
4. Inhalt:
   ```bash
   #!/bin/bash
   sleep 30  # Warte bis Docker-Stacks oben sind
   tailscale serve --bg --https=9443 http://localhost:3000
   ```

**Variante 2 — Tailscale-Plugin GUI:**
Manche Versionen des Unraid-Tailscale-Plugins bieten "Serve"-Konfiguration in der GUI. Falls vorhanden: dort konfigurieren.

---

## 🔄 Update einspielen (nach Code-Änderungen auf `main` / `nas-setup`)

```bash
cd /mnt/user/appdata/protrackr
git fetch origin
git pull origin nas-setup                  # nur den nas-setup Branch ziehen!
docker compose build app
docker compose up -d app                   # MySQL bleibt unangetastet
docker compose logs -f app
```

**Achtung:** Niemals `git pull origin main` — würde den Branch wechseln und die NAS-Setup-Files überschreiben.

---

## 💾 Backup-Strategie

### Empfohlen: Tägliches MySQL-Dump als Unraid User Script

`/boot/config/plugins/user.scripts/scripts/protrackr-backup/script`:
```bash
#!/bin/bash
TS=$(date +%Y-%m-%d)
DUMP_DIR=/mnt/user/backups/protrackr
mkdir -p "$DUMP_DIR"
docker exec protrackr-mysql mysqldump \
  -u root -p"$MYSQL_ROOT_PASSWORD" \
  --single-transaction --routines --triggers \
  protrackr | gzip > "$DUMP_DIR/protrackr-$TS.sql.gz"

# Retention: 14 Tage
find "$DUMP_DIR" -name "protrackr-*.sql.gz" -mtime +14 -delete
```

Schedule: täglich 03:00.

### Zusätzlich: Container-Image-Backup

`/mnt/user/appdata/protrackr/` (Compose-Files, .env, Source) sollte ohnehin in deinen normalen Unraid-Backup-Plan einbezogen werden (Appdata Backup Plugin).

---

## 🆘 Troubleshooting (Unraid-spezifisch)

### "Permission denied" bei Volume-Mounts
Unraid User ist standardmäßig UID 99 (`nobody`), Container-User ist UID 1001. Bei Bind-Mounts:
```bash
chown -R 1001:1001 /mnt/user/appdata/protrackr/mysql_data
```

### Compose Manager zeigt Container nicht
- Compose Manager Plugin korrekt installiert?
- Stack-Verzeichnis korrekt gesetzt?
- `docker compose ps` im Terminal — wird der Container dort gelistet?

### Tailscale Serve verliert seinen Status nach Reboot
- User Scripts Plugin nutzen (siehe oben)
- ODER Tailscale Plugin auf neueste Version updaten — manche Versionen persistieren Serve-Konfig automatisch

### MySQL-Volume liegt auf falscher Disk
Default-Pfad ist `/var/lib/docker/volumes/protrackr_mysql_data/`. Für Disk-Wahl:
- Bind-Mount in `docker-compose.yml` aktivieren (auskommentierte Variante im File)
- Oder Docker Image Path in Unraid Settings → Docker auf gewünschte Disk legen

---

## 📚 Verweise

- **Master-Anleitung:** [`NAS_SETUP_README.md`](../NAS_SETUP_README.md)
- **Schritt-Historie:** [`NAS_SETUP_HISTORY.md`](../NAS_SETUP_HISTORY.md)
- **DB-Dump Notebook:** [`scripts/migrate-db.ps1`](../scripts/migrate-db.ps1)
- **DB-Import NAS:** [`scripts/migrate-db.sh`](../scripts/migrate-db.sh)
