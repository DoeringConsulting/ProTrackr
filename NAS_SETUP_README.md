# ProTrackr NAS-Setup — Master-Anleitung

> **Zielgruppe:** Du selbst (Alexander), beim Einrichten und späteren Warten von ProTrackr auf dem Unraid-NAS.
> **Branch:** `nas-setup` (sauber getrennt vom Entwicklungs-Branch `main`)
> **Stand:** 2026-05-28 — Phase 1 abgeschlossen, Phasen 2–6 folgen schrittweise

---

## 📍 Was diese Doku ist (und was nicht)

**Ist:** Die zentrale Übersichts- und Quick-Start-Anleitung für das NAS-Setup. Beantwortet: *Was läuft wo? Wie starte ich? Was tun wenn …?*

**Nicht:** Detail-Anleitung für jeden einzelnen Schritt. Dafür gibt es:
- **Schritt-für-Schritt-Historie:** [`NAS_SETUP_HISTORY.md`](NAS_SETUP_HISTORY.md) — chronologisches Protokoll jeder Entscheidung und Aktion
- **Unraid-spezifische Schritte:** [`docs/UNRAID_DEPLOYMENT.md`](docs/UNRAID_DEPLOYMENT.md) — Plugin-Installation, Compose-Manager, Tailscale-Plugin
- **DB-Migration:** [`scripts/migrate-db.ps1`](scripts/migrate-db.ps1) + [`scripts/migrate-db.sh`](scripts/migrate-db.sh) — Helfer-Skripte für Daten-Umzug

---

## 🎯 Projekt-Eckdaten

| | Wert |
|---|---|
| **NAS-Hardware** | AOOSTAR WTR MAX 8845 (Ryzen 7 8845HS, x86_64) |
| **NAS-OS** | Unraid 7.2.5 |
| **NAS-Hostname** | `DCS01` |
| **Tailnet-Domain** | `dcs01.taile370c2.ts.net` |
| **Final-URL für ProTrackr** | `https://dcs01.taile370c2.ts.net:9443` |
| **TLS-Cert** | von Tailscale automatisch (Let's Encrypt), bereits aktiv |
| **Externer Port** | 9443 (Tailscale Serve) |
| **Container-interner Port** | 3000 |
| **Datenbank** | MySQL 8.0 im Container, persistent volume |
| **SMTP** | `doeringconsulting.hoste.pl:465` (SSL, CRAM-MD5) |
| **Container-Engine** | Docker (Unraid-nativ, Compose Manager Plugin) |
| **Tailscale** | Unraid Community-Plugin |

⚠️ **Verwechslungs-Hinweis:** Mandant **`dc001`** (in ProTrackr-App, kleingeschrieben) ≠ NAS-Hostname **`DCS01`** (Unraid). Beide sehen ähnlich aus, sind aber unterschiedliche Dinge.

---

## 🏗️ Architektur

```
┌──────────────────────────────────────────────────────────────────┐
│  Dein Notebook / Handy / anderes Gerät im Tailnet                │
│                          │                                       │
│                          │  Tailscale-VPN (TLS, gültiges Cert)   │
│                          ▼                                       │
│                                                                  │
│  https://dcs01.taile370c2.ts.net:9443                            │
└──────────────────────────────────────────────────────────────────┘
                          │
                          │  Tailscale Serve (auf NAS, Plugin)
                          │  Port 9443 (extern) → 3000 (intern)
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  Unraid 7.2.5 (DCS01)                                            │
│                                                                  │
│  ┌─ Compose Manager Plugin: protrackr-stack ─────────────────┐   │
│  │                                                            │   │
│  │  ┌─ Container: protrackr-app ───────┐                     │   │
│  │  │  node:22-alpine                  │                     │   │
│  │  │  Node 22 + Express + tRPC        │ <─── 127.0.0.1:3000 │   │
│  │  │  Vite SPA aus dist/public/       │                     │   │
│  │  │  User: protrackr (UID 1001)      │                     │   │
│  │  └────────────┬─────────────────────┘                     │   │
│  │               │                                           │   │
│  │               │  internes Docker-Netz "protrackr_net"     │   │
│  │               ▼                                           │   │
│  │  ┌─ Container: protrackr-mysql ─────┐                     │   │
│  │  │  mysql:8.0                       │                     │   │
│  │  │  Persistent: mysql_data Volume   │                     │   │
│  │  │  KEIN Host-Port                  │                     │   │
│  │  └──────────────────────────────────┘                     │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Unraid WebGUI: https://dcs01.taile370c2.ts.net   (Port 443)     │
│  Nextcloud:     https://dcs01.taile370c2.ts.net:8443             │
│  Obsidian:      http://localhost:3001                            │
│  Open WebUI:    http://localhost:8080                            │
└──────────────────────────────────────────────────────────────────┘
                          │
                          │  Outbound (SMTP-Versand für Passwort-Reset)
                          ▼
                doeringconsulting.hoste.pl:465 (SSL, CRAM-MD5)
```

---

## 📦 Was im Branch `nas-setup` liegt

| Datei / Verzeichnis | Zweck |
|---|---|
| `Dockerfile` | Multi-Stage Build (node:22-alpine, pnpm, non-root user) |
| `.dockerignore` | Schließt unnötige/sensitive Files vom Build-Context aus |
| `docker-compose.yml` | App + MySQL Services, Volumes, Network, Healthchecks |
| `.env.production.example` | Template für `.env` mit allen Variablen + Erklärungen |
| `NAS_SETUP_README.md` | Diese Datei (Master-Anleitung) |
| `NAS_SETUP_HISTORY.md` | Schritt-für-Schritt-Protokoll aller Phasen |
| `docs/UNRAID_DEPLOYMENT.md` | Unraid-spezifische Schritt-für-Schritt-Anleitung |
| `scripts/migrate-db.ps1` | PowerShell-Helfer auf Notebook (DB-Dump erzeugen) |
| `scripts/migrate-db.sh` | Bash-Helfer auf NAS (DB-Dump importieren) |

---

## 🚀 Quick-Start (Phasen-Übersicht)

| Phase | Inhalt | Doku-Verweis |
|---|---|---|
| **1** | Implementations-Dateien anlegen | ✅ erledigt — siehe HISTORY Phase 1.1 + 1.2 |
| **2** | DB-Dump auf Notebook erzeugen | [`scripts/migrate-db.ps1`](scripts/migrate-db.ps1) |
| **3** | NAS vorbereiten + Container bauen | [`docs/UNRAID_DEPLOYMENT.md`](docs/UNRAID_DEPLOYMENT.md) |
| **4** | Erstes Anlaufen + SMTP-Test + Datenimport | [`scripts/migrate-db.sh`](scripts/migrate-db.sh) + manuelle Schritte |
| **5** | Tailscale Serve aktivieren | [`docs/UNRAID_DEPLOYMENT.md`](docs/UNRAID_DEPLOYMENT.md) §"Tailscale Serve" |
| **6** | Notebook-Server abschalten + Switchover | wird in Phase 6 dokumentiert |

---

## 🔐 Secrets-Management

**Niemals** Secrets im Repo committen. Alle `CHANGE_ME_*` Platzhalter in `.env.production.example` werden auf dem NAS ersetzt — entweder via:

1. **Empfohlen — Unraid Container Variables (Masked):** Beim Anlegen des Compose-Stacks werden Secrets in der Unraid-UI eingegeben und mit "Masked" markiert. Sie erscheinen nicht im Klartext in Logs oder Backups.
2. **Alternative — `.env` auf NAS-Filesystem:** Eine `.env` Datei neben `docker-compose.yml` legen. **Pfad-Empfehlung:** `/mnt/user/appdata/protrackr/.env` mit Permissions `chmod 600`.

**Secret-Generierung** (auf Notebook oder NAS-Terminal):
```bash
openssl rand -hex 32      # für SESSION_SECRET, JWT_SECRET etc. (64 Zeichen)
openssl rand -base64 24   # für DB-Passwörter (~32 Zeichen, URL-safe-ish)
```

**Wichtig:** Das Passwort in `DATABASE_URL` und in `MYSQL_PASSWORD` müssen **identisch** sein, sonst kann die App sich nicht verbinden.

---

## 🔧 Update-Workflow (nach erstem Live-Start)

1. Auf Notebook: `main` Branch weiterentwickeln, committen, pushen.
2. Wenn Stand stabil: `nas-setup` Branch syncen via Merge (siehe HISTORY Phase 0.11 als Vorlage).
3. Auf NAS (SSH oder Web-Terminal):
   ```bash
   cd /mnt/user/appdata/protrackr
   git pull origin nas-setup
   docker compose build app
   docker compose up -d app
   ```
4. Logs prüfen: `docker compose logs -f app`
5. Bei DB-Schema-Änderungen: `docker compose exec app pnpm db:push` (kommt mit drizzle-kit aus dev-deps — Hinweis: aktuell nur in `deps` Stage, nicht im Runtime-Image; für Runtime-Migrationen prüfen ob drizzle-kit nötig oder SQL manuell)

---

## 🆘 Troubleshooting

### App-Container startet nicht / Crash-Loop

```bash
docker compose logs --tail=100 app
docker compose ps
```

Häufige Ursachen:
- **`SESSION_SECRET ist nicht gesetzt`** → `.env` fehlt oder Container Variables nicht gesetzt
- **`ECONNREFUSED mysql:3306`** → MySQL-Container nicht ready (Healthcheck noch nicht grün); warten oder `docker compose ps mysql` checken
- **Schema-Mismatch (`Unknown column …`)** → DB-Migrations nicht gelaufen, manuell triggern

### Passwort-Reset-Mails kommen nicht an

1. SMTP-Verbindung testen:
   ```bash
   docker compose exec app node -e "import('./dist/index.js'); /* trigger sendTest */"
   ```
   *(Detail-Anleitung in Phase 4)*
2. Falls **`EAUTH` mit Auth-Methode**: hoste.pl verlangt CRAM-MD5 → `server/email.ts:42` patchen, Container neu bauen.

### Tailscale Serve zeigt 502 / nichts

```bash
tailscale serve status            # zeigt aktive Routen
docker compose ps app             # ist app-Container up?
wget -O - http://localhost:3000/  # antwortet ProTrackr direkt?
```

### Backup wiederherstellen

ProTrackr hat eine eingebaute Backup-Funktion (im UI: Settings → Datensicherung). Zusätzlich: MySQL-Dump-Skript regelmäßig laufen lassen (siehe [scripts/migrate-db.sh](scripts/migrate-db.sh) — kann auch als Cron im Unraid genutzt werden).

---

## 📚 Weiterführende Doku im Branch

- **[NAS_SETUP_HISTORY.md](NAS_SETUP_HISTORY.md)** — chronologisches Protokoll jedes Setup-Schritts
- **[docs/UNRAID_DEPLOYMENT.md](docs/UNRAID_DEPLOYMENT.md)** — Unraid-spezifische Schritte
- **[CLAUDE.md](CLAUDE.md)** — projekt-spezifische Konventionen (für Claude-Sessions)
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — App-Architektur (gilt unverändert für NAS-Deployment)
- **[docs/EMAIL_KONFIGURATION.md](docs/EMAIL_KONFIGURATION.md)** — SMTP-Details
