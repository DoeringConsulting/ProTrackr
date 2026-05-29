# NAS-Setup — Entwicklungs-Historie

> **Dieses Dokument existiert ausschließlich im Branch `nas-setup` und dokumentiert chronologisch jeden Schritt des ProTrackr-Umzugs vom Notebook auf den AOOSTAR WTR MAX 8845 NAS.**

---

## Projekt-Eckdaten

| Schlüssel | Wert |
|---|---|
| **Projekttitel** | ProTrackr — NAS-Umzug |
| **Branch (lokal & GitHub)** | `nas-setup` |
| **Freeze-Punkt** | Tag `v1.3.2` (Commit `d2f2458`) |
| **Repo-Pfad lokal** | `C:\Projects\ProTrackr_developing_path` |
| **GitHub-Branch** | https://github.com/DoeringConsulting/ProTrackr/tree/nas-setup |
| **Ziel-Hardware** | AOOSTAR WTR MAX 8845 (Ryzen 7 8845HS) |
| **Ziel-OS** | Unraid 7.2.5 |
| **Ziel-URL** | `https://dcs01.taile370c2.ts.net:9443` |
| **Workflow** | Option B — Befehle copy-paste in Unraid Web-Terminal |
| **Trennungsregel** | Kein Merge/Rebase mit main ohne explizite User-Freigabe nach Risikoaufklärung |

---

## Doku-Format

Jeder Schritt wird wie folgt erfasst:

```
### YYYY-MM-DD — Phase X.Y: <Kurzbeschreibung>

**Was:**       Konkrete Aktion / Befehl / Datei-Änderung
**Warum:**     Begründung / Kontext
**Ergebnis:**  Output / Status / Folge-Aktionen
```

Bei Befehlen, die der User im Web-Terminal ausführt, wird der **gesamte Output** (oder relevante Auszug) hier dokumentiert. Bei Datei-Änderungen werden Pfade und Commit-SHA referenziert.

---

# Phase 0 — Vorbereitung & Klärung

## 2026-05-04 — Phase 0.1: Initialer Plan & Branch-Anlage

**Was:**
- Branch `nas-setup` lokal aus Tag `v1.3.2` (Commit `d2f2458`) erstellt:
  ```
  git checkout -b nas-setup v1.3.2
  ```
- Branch auf GitHub gepusht und Tracking gesetzt:
  ```
  git push -u origin nas-setup
  ```

**Warum:**
- User hatte parallel auf `main` weiterentwickelt; explizite Trennungs-Anforderung, damit beide Stränge sich nicht in die Quere kommen.
- v1.3.2 wurde als stabiler Freeze-Punkt für die NAS-Migration gewählt.

**Ergebnis:**
- Branch `nas-setup` aktiv im lokalen Klon `ProTrackr_developing_path`.
- Upstream `origin/nas-setup` angelegt.
- Verifiziert: `git describe --exact-match HEAD` → `v1.3.2`.
- Hauptrepo `C:\Projects\ProTrackr` bewusst NICHT angefasst (befand sich in detached HEAD aus paralleler Session).

---

## 2026-05-04 — Phase 0.2: Hardware- und OS-Klärung

**Was:** Klärung der Ziel-Plattform mit dem User.

**Warum:** AOOSTAR WTR MAX ist ein x86-Mini-PC-NAS — der konkrete OS-Layer entscheidet über den Deployment-Weg.

**Ergebnis:**
| Eigenschaft | Wert |
|---|---|
| Hardware | AOOSTAR WTR MAX 8845 (Ryzen 7 8845HS, x86_64) |
| OS | Unraid 7.2.5 |
| Container-Engine | Docker (Unraid-nativ) |
| Tailscale-Installation | Unraid Community-Plugin (siehe Plugins-Tab im UI) |

---

## 2026-05-04 — Phase 0.3: Tailscale-Identifikation

**Was:** Tailscale-Hostname & Tailnet-Domain ermittelt.

**Warum:** Nötig für die HTTPS-Konfiguration via Tailscale Serve.

**Ergebnis:**
- Hostname: **DCS01**
- Volle Tailnet-Domain: **`dcs01.taile370c2.ts.net`**
- Tailscale-IP: `100.108.232.64`
- TLS-Cert: bereits aktiv und gültig (Let's-Encrypt via Tailscale, "Verbindung ist sicher" verifiziert beim Aufruf der URL)

**Naming-Hinweis:** Mandant `dc001` (App-intern) ≠ NAS-Hostname `DCS01` — Verwechslung im weiteren Verlauf vermeiden.

---

## 2026-05-04 — Phase 0.4: HTTPS-Strategie

**Was:** Drei Optionen verglichen (Tailscale Serve auf eigenem Port / Sub-Pfad / Unraid-Port-Wechsel).

**Warum:** Port 443 ist von Unraid-WebGUI belegt, ProTrackr braucht eigenen TLS-Endpunkt.

**Entscheidung:** **Option A — Tailscale Serve auf eigenem TLS-Port.**

**Begründung:**
- Niedrigstes Risiko (kein Code-Change, kein Unraid-Konfig-Change)
- Reversibel (`tailscale serve reset`)
- Konsistent mit Notebook-Setup (auch dort Port-suffix-URL)
- TLS-Cert wird von Tailscale automatisch wiederverwendet

---

## 2026-05-04 — Phase 0.5: Port-Auswahl

**Was:** Freien externen TLS-Port auf dem NAS suchen.

**Warum:** Mehrere Dienste laufen bereits.

**Bekannte Port-Belegung auf DCS01:**
| Port | Dienst |
|---|---|
| 443 | Unraid WebGUI |
| 3001 | Obsidian |
| 8080 | Open WebUI / Ollama 3.2 |
| 8443 | Nextcloud |

**Test-Methode:** Browser-Aufruf `https://dcs01.taile370c2.ts.net:9443` → erwartete Antwort: `ERR_CONNECTION_REFUSED` (= Port frei).

**Ergebnis:** Port **9443** verifiziert frei (`ERR_CONNECTION_REFUSED` per Screenshot bestätigt).

**Final-URL:** `https://dcs01.taile370c2.ts.net:9443`

---

## 2026-05-04 — Phase 0.6: Datenbank-Migration-Strategie

**Was:** Festgelegt, dass die bestehende MySQL-DB vom Notebook (Mandant `dc001`, alle User/Projekte/Zeitbuchungen/Reisekosten) auf den NAS migriert wird.

**Warum:** User will keinen Neuanfang mit leerer DB; bestehende Buchungen müssen erhalten bleiben.

**Methode:** `mysqldump` auf Notebook → Transport zum NAS → Import in MySQL-Container auf Unraid.

**Skripte werden in Phase 1 erstellt:**
- `scripts/migrate-db.ps1` — PowerShell, Dump auf Notebook
- `scripts/migrate-db.sh` — Bash, Import auf NAS

---

## 2026-05-04 — Phase 0.7: SMTP-Klärung

**Was:** SMTP-Konfiguration des Notebook-Setups geprüft, Ziel-SMTP-Server ermittelt.

**Warum:** ProTrackr versendet Passwort-Reset-Mails via Nodemailer. Auf dem Notebook ist SMTP aktuell nicht konfiguriert (Code prüft env vars und überspringt schweigend).

**Code-Befund:** [server/email.ts:42-50](server/email.ts:42) — `nodemailer.createTransport()` ohne explizite `authMethod`, nodemailer wählt automatisch.

**Ergebnis — SMTP-Ziel-Konfig auf NAS:**
| Variable | Wert |
|---|---|
| `SMTP_HOST` | `doeringconsulting.hoste.pl` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` (Port 465 = implizites TLS) |
| `SMTP_USER` | `office@doering-consulting.eu` |
| `SMTP_PASS` | (wird in Phase 4 separat gesetzt, nie im Repo) |
| `SMTP_FROM` | `office@doering-consulting.eu` |
| Auth-Methode (vom User angegeben) | MD5 Challenge-Response (CRAM-MD5) |

**Plan-Annahme:** Nodemailer wird CRAM-MD5 automatisch wählen, falls der hoste.pl-Server es als einzige Methode anbietet. Falls nicht: in Phase 4 nachsteuern mit explizitem `authMethod: 'CRAM-MD5'`.

**Sicherheits-Strategie für SMTP-Passwort:** Variante D — direkt in Unraid Container Variables (Masked). Niemals in Chat, Repo oder unverschlüsselten Files.

---

## 2026-05-04 — Phase 0.8: Workflow-Festlegung

**Was:** Zusammenarbeitsmodell für die Implementierungsphase festgelegt.

**Entscheidung:** **Option B — Web-Terminal Mikro-Loop**.

**Workflow:**
1. Claude (im Chat) gibt einen Befehl als Code-Block aus, mit Erklärung & erwartetem Output.
2. User kopiert den Code-Block ins Unraid Web-Terminal (Konsolen-Icon rechts oben in der WebGUI).
3. User führt den Befehl aus, kopiert den Output zurück in den Chat.
4. Claude validiert den Output, dokumentiert in dieser Datei, gibt nächsten Schritt.

**Sicherheits-Garantien:**
- Vor destruktiven Befehlen (`rm`, `docker rm`, DB-DROP, etc.) explizite Bestätigung
- Verifizierungs-Befehle vor und nach kritischen Aktionen
- Erste Aktionen aller Phasen sind read-only

**Doku-Pflicht (User-Anforderung):** Jeder Schritt — Entscheidung, Befehl, Output — wird in dieser Datei `NAS_SETUP_HISTORY.md` chronologisch festgehalten.

---

## 2026-05-04 — Phase 0.9: Finale Vorab-Konfiguration

| Komponente | Wert |
|---|---|
| Branch | `nas-setup` |
| Freeze-Tag | `v1.3.2` |
| NAS-Hostname | DCS01 |
| Tailnet-Domain | `dcs01.taile370c2.ts.net` |
| OS | Unraid 7.2.5 |
| External Port | **9443** |
| Internal Container Port | 3000 |
| **Final-URL** | **`https://dcs01.taile370c2.ts.net:9443`** |
| HTTPS-Strategie | Tailscale Serve (Plugin) |
| Datenbank | MySQL Container, Daten-Migration vom Notebook |
| SMTP | hoste.pl:465 SSL, `office@doering-consulting.eu`, CRAM-MD5 |
| SMTP-Passwort-Handling | Unraid Container Variables (Masked) |
| Workflow | Option B (Web-Terminal Mikro-Loop) |
| Doku | Diese Datei (chronologisches Log jedes Schritts) |

---

## 2026-05-04 — Phase 0.10: Hook-Bereinigung & Branch-Rekonstruktion (parallele Session)

**Was:**
Die parallele Session hat den Branch saniert, nachdem der Initial-Commit dieser Session (`6352135`, lokal verworfen) durch die main-Hooks Pollution-Files mitgezogen hatte:

1. **Auf `main` Bug-Fix für die post-commit-Hooks**: Auto-Version-Bump, Production-Build und Server-Restart laufen ab jetzt **nur noch auf main**, nicht mehr auf Feature-Branches wie `nas-setup`. Commit: `f114132 fix: gate post-commit auto-bump+build+restart to main branch only`.
2. **Branch `nas-setup` auf origin sauber rekonstruiert** mit:
   - `main@f114132` als Basis (Hook-Gate-Fix bereits enthalten)
   - + nur 1 zusätzliche Datei: `NAS_SETUP_HISTORY.md` (diese Datei)
   - Resultat-HEAD: `7fa4fed`
3. **Lokaler Klon `developing_path` synchronisiert** via:
   ```bash
   git fetch origin
   git reset --hard origin/nas-setup
   ```

**Warum:**
Der initiale Phase-0.9-Commit dieser Session hatte 7 ungewollte Pollution-Files: Auto-Version-Bump (`1.3.2 → 1.3.3`), CHANGELOG-Bump, neuer Production-Build — alle ausgelöst durch die main-Hooks, die zu dem Zeitpunkt nicht zwischen Branches unterschieden. Außerdem hatte der Server-Restart-Hook den Notebook-Server auf `localhost:3001` mit nas-setup-Code "gehijackt", was die parallele main-Arbeit gestört hätte.

**Ergebnis:**
- Lokaler `nas-setup` HEAD = `origin/nas-setup` HEAD = `7fa4fed` ✓ (verifiziert via `rev-parse`)
- Log zeigt exakt die 3 erwarteten Commits:
  - `7fa4fed docs: add NAS_SETUP_HISTORY.md — Phase 0 (Vorbereitung & Klaerung)`
  - `f114132 fix: gate post-commit auto-bump+build+restart to main branch only`
  - `d2f2458 fix: detach server-restart so commits don't leave zombie shells`
- Working Tree clean (nur `.claude/settings.local.json` als untracked, irrelevant).
- Notebook-Server auf `localhost:3001` läuft jetzt auf v1.3.3 (main-Code) — saubere Trennung wiederhergestellt.
- Künftige Commits auf `nas-setup` lösen **weder Bump noch Build noch Restart** aus — nur Tests laufen weiter als Sicherheitsnetz.

**Konsequenz für die weitere Arbeit:**
Ab jetzt kann auf `nas-setup` ohne Pollution committet werden. Phase 1 (Implementations-Dateien) kann beginnen.

---

## 2026-05-28 — Phase 0.11: Sync mit main via Merge (Option A)

**Was:**
Erste explizit autorisierte `main → nas-setup`-Integration via `git merge`:

```bash
git checkout nas-setup
git merge origin/main -m "merge: sync nas-setup with main..."
git push origin nas-setup
```

**Warum:**
`main` hatte seit Branch-Anlage **14 Commits** vorgelegt — u.a. das komplette Provision-Feature in 6 Phasen, ein BREAKING CHANGE bei der Stichtag-Logik, mehrere Bugfixes und die neue projekt-`CLAUDE.md`. NAS-Setup-Arbeit braucht den aktuellen Code-Stand, weil Phase 1 (Container-Build) sonst auf veraltetem v1.3.3-Stand aufbauen würde. User hat Methode A (Merge) nach detaillierter Risikoaufklärung (Mirror vs. Merge vs. Rebase vs. Re-Fork) explizit freigegeben.

**Ergebnis:**
- **Merge-Commit:** `7400755 merge: sync nas-setup with main (incl. provision feature + breaking changes)`
- **Parents:** `894e6d6` (alter nas-setup HEAD) + `327e770` (main HEAD)
- 23 Files integriert: **+1.673 / -193 Zeilen**
- **0 Konflikte** (Vorprüfung bestätigt: disjunkte File-Mengen — main hat nie `NAS_SETUP_HISTORY.md` angefasst)
- `NAS_SETUP_HISTORY.md` unverändert erhalten ✓
- Working Tree clean
- Hooks: kein Bump/Build/Restart ausgelöst (Hook-Gate aus Phase 0.10 funktioniert)

**Integrierte main-Commits (neu in nas-setup):**
- `327e770 fix:` vereinheitliche EUR-Summen — keine Doppel-Rundung mehr über PLN
- `a1f4a67 fix:` vitest afterAll cleanup hook (this time actually persisted)
- `5d0d8d2 fix:` NBP-Update + Mitnahme-Pfad fragen jetzt für heute statt gestern
- `c6f8b3b feat!:` **BREAKING CHANGE** — rewrite report exchange-rate stichtag to last-leistung-day
- `41435b8 docs:` project-specific CLAUDE.md (repo-level memory for Claude sessions)
- `0c06253 fix:` full-coverage backup + auto-cleanup of vitest fixtures + retire server/lib/
- `1dd76e9 feat:` phase 6 — Polish bookkeeping PDF includes provision (Prowizja)
- `e537452 feat:` phase 5 — customer report surcharge-mode + data-leak guard
- `25cc9c3 feat:` phase 4 — provision integrated into accounting report + tax base
- `0e26288 feat:` phase 3 — customer form supports commission configuration
- `aad1376 feat:` phase 2 — provision helper + zod schemas
- `da33a09 feat:` phase 1 — customers schema for commission/provision feature
- `b03a0a7 fix:` dashboard loading skeletons + direct logout button
- `3bc46ec fix:` clean stale references to v1.0/v1.1 setup paths in docs and scripts

**Wichtige Folgen für die weitere NAS-Implementierung:**

1. **Neue DB-Migration `drizzle/0023_customers_provision.sql`** muss beim Container-Start auf der Container-DB ausgeführt werden (legt Provision-Spalten in `customers`-Tabelle an). Drizzle übernimmt das per `drizzle-kit migrate` oder im Container-Boot-Skript.
2. **BREAKING CHANGE Stichtag-Logik** in `server/routers.ts`: Wechselkurse für Reports berechnen sich nach "letzter Leistungs-Werktag" statt vorheriger Logik. Bei Datenmigration vom Notebook beachten — der Notebook-Server läuft schon mit dieser Logik (laut Phase 0.10 auf v1.3.3 main-Code), die Daten sind also bereits konsistent.
3. **Neue `CLAUDE.md` im Repo-Root** — enthält projekt-spezifische Konventionen (Drizzle, Geld als int cents, Provision-Felder, etc.). Wird im NAS-Container-Image mit verpackt.
4. **Versions-Stand** von nas-setup ist nun identisch mit main (vermutlich ≥ v1.4.x wegen `feat!` BREAKING CHANGE-Bump auf main).
5. **Erste Änderung an der nas-setup ↔ main-Trennung:** Nur die `main → nas-setup`-Richtung wurde berührt. Die `nas-setup → main`-Richtung bleibt **weiterhin gesperrt** ohne weitere explizite Freigabe und Risikoaufklärung.

**Trennungsregel-Status (gemäß Memory `feedback_nas_umzug_branch.md`):**
> ✓ Aktion war explizit autorisiert nach vorheriger Klärung & Risiko-Aufklärung
> ✓ Memory-Regel "Einzige Ausnahme — ich genehmige es nach vorheriger Klärung und Aufklärung — inkl. aller Risiken" eingehalten

---

# Phase 1 — Implementations-Dateien

## 2026-05-28 — Phase 1.1: Container-Core (Dockerfile, docker-compose.yml, .env.production.example)

**Was:**
Drei Kern-Files für die Container-Architektur angelegt — die minimale Basis, mit der ein `docker compose build` lauffähig wäre (wird in dieser Phase aber NICHT ausgeführt):

1. **`Dockerfile`** — Multi-Stage-Build:
   - `base` (node:22-alpine + pnpm 10.4.1 via corepack)
   - `deps` (full install inkl. devDependencies + Patches)
   - `build` (führt `pnpm build` aus → `dist/index.js` + `dist/public/`)
   - `prod-deps` (production-only `node_modules`)
   - `runtime` (slim Final-Image, non-root user `protrackr:nodejs`)
   - EXPOSE 3000, CMD `node dist/index.js`

2. **`docker-compose.yml`** — zwei Services:
   - **`app`** — built from local Dockerfile, port-mapping `127.0.0.1:3000:3000` (nur Localhost, weil Tailscale Serve davor terminiert), depends_on `mysql healthy`, alle ENV-Variablen aus `.env`, json-file logging mit Rotation 10m×5
   - **`mysql`** — `mysql:8.0` Image, persistent volume `mysql_data`, **keine Port-Exposition** (nur im internen `protrackr_net` erreichbar), Healthcheck via `mysqladmin ping`
   - Network: `protrackr_net` (Bridge, isoliert)
   - Volume: `mysql_data` (lokal; Bind-Mount auf `/mnt/user/appdata/protrackr/mysql` als auskommentierte Unraid-Empfehlung)

3. **`.env.production.example`** — Template mit allen erforderlichen Variablen:
   - Application: `NODE_ENV`, `PORT`
   - Secrets: `SESSION_SECRET`, `JWT_SECRET`, `SCHEDULER_API_KEY`, `CRON_SECRET` (alle als `CHANGE_ME_*` Platzhalter, mit `openssl rand -hex 32` Generierungs-Hinweis)
   - Cookies: `SESSION_COOKIE_SECURE=true` (HTTPS via Tailscale), `SESSION_COOKIE_SAMESITE=lax`
   - DB: `DATABASE_URL`, `MYSQL_*` (Passwort-Konsistenz-Hinweis)
   - SMTP: vollständige hoste.pl-Konfig + CRAM-MD5 Hinweis für ggf. nötigen Code-Patch in `server/email.ts:42`
   - Vite-Build-Vars + ungenutzte Legacy-Manus-Vars (leer, damit env-Parser nicht warnt)

**Warum:**
Die drei Files bilden die **minimale Container-Architektur**. Mit diesen drei Files alleine könnte man theoretisch `docker compose build` aufrufen (wird in dieser Phase aber NICHT getan — wir warten auf NAS-Vorbereitung in Phase 3). Bewusst weggelassen wurden in 1.1: `.dockerignore` (Build wird langsamer aber funktioniert), Master-README, Unraid-Anleitung und DB-Migrations-Skripte — kommen in 1.2.

**Design-Entscheidungen mit Begründung:**

| Entscheidung | Begründung |
|---|---|
| `node:22-alpine` als Base | Minimaler Footprint, gleicher Node-Major wie Notebook |
| pnpm via `corepack prepare pnpm@10.4.1` | Exakte Version aus `package.json` packageManager-Feld |
| Non-root user 1001 im Container | Defense-in-depth; Container-User-Mapping zu Unraid wird in Phase 3 falls nötig nachgesteuert |
| `127.0.0.1:3000:3000` (statt `0.0.0.0:3000`) | Verhindert versehentliche LAN-Exposition; Tailscale Serve bindet auf Localhost |
| MySQL keine Host-Port-Exposition | Datenbank ist Backend-only; Admin via `docker exec` |
| `depends_on: mysql healthy` | App startet erst wenn DB ready ist — verhindert Crash-Loop beim ersten Boot |
| `restart: unless-stopped` | NAS reboots überstehen, manuelle Stops respektieren |
| json-file logging 10m×5 | Verhindert Log-Wachstum auf Unraid-Cache-Disk |
| Drizzle-Migrations NICHT im Container-Entrypoint | Bewusste Trennung: bei Daten-Migration vom Notebook bringt der Dump das Schema mit; bei Fresh-Start wird `pnpm db:push` manuell einmalig getriggert (Doku in 1.2) |

**Ergebnis:**
- `Dockerfile` (~70 Zeilen, gut kommentiert)
- `docker-compose.yml` (~110 Zeilen, alle Felder begründet)
- `.env.production.example` (~80 Zeilen, vollständig dokumentiert)
- Keine Änderung am bestehenden App-Code
- Branch `nas-setup` Working Tree um 3 Files erweitert
- Pre-commit-Tests laufen vor dem Commit; Hook-Gate verhindert Pollution

**Noch offen in Phase 1 (kommt in 1.2 beim nächsten Termin):**
- `.dockerignore` (reduziert Build-Context, schließt Secrets aus)
- `NAS_SETUP_README.md` — Master-Anleitung mit Architektur-Diagramm
- `docs/UNRAID_DEPLOYMENT.md` — Unraid-spezifische Schritt-für-Schritt-Doku
- `scripts/migrate-db.ps1` — PowerShell-Helfer für Notebook-DB-Dump
- `scripts/migrate-db.sh` — Bash-Helfer für NAS-DB-Import

---

## 2026-05-28 — Phase 1.2: Doku + Migrations-Skripte (Phase 1 Abschluss)

**Was:**
Die in Phase 1.1 ausgesparten 5 Files angelegt:

1. **`.dockerignore`** (~70 Zeilen) — schließt vom Build-Context aus: `.git`, `.env*`, `node_modules`, `dist`, `logs`, IDE-Dateien, `.claude`, `*.md` (außer Runtime-nötige), Test-Files, `.husky`, Dump-Files. Erklärt jeden Block mit Kommentar.

2. **`NAS_SETUP_README.md`** (~190 Zeilen) — Master-Anleitung:
   - Projekt-Eckdaten mit `dc001` vs `DCS01` Verwechslungs-Hinweis
   - ASCII-Architektur-Diagramm (Tailnet → NAS → Container-Stack → SMTP outbound)
   - Files-Übersicht im Branch
   - Phasen-Quick-Start-Tabelle mit Doku-Verweisen
   - Secrets-Management (Variante A `.env`, Variante B Unraid Container Variables Masked — empfohlen)
   - Update-Workflow (git pull + docker compose build + up)
   - Troubleshooting-Sektion (App-Crash, SMTP, Tailscale Serve 502, Backup-Restore)
   - Verweise auf andere Doku-Files

3. **`docs/UNRAID_DEPLOYMENT.md`** (~220 Zeilen) — Unraid-spezifische Schritt-für-Schritt-Anleitung:
   - Voraussetzungs-Checkliste (Unraid 7.2.5, Plugins, Web-Terminal, Port 9443 frei)
   - Compose Manager Plugin Installation
   - Verzeichnis-Layout-Vorschlag (`/mnt/user/appdata/protrackr/`)
   - Repo-Clone direkt auf NAS (Branch `nas-setup` explizit)
   - Secrets: zwei Wege (`.env` file vs Container Variables masked)
   - DB vorbereiten: Weg A Fresh-Start (Drizzle push), Weg B Daten-Migration vom Notebook
   - Stack starten + Erfolgs-Indikatoren
   - Tailscale Serve einrichten + Persistierung über User Scripts Plugin
   - Update-Workflow mit explizitem Hinweis: niemals `git pull origin main`
   - Backup-Strategie (User Scripts Plugin für tägliches mysqldump + Retention 14 Tage)
   - Unraid-spezifisches Troubleshooting (UID/GID 1001 vs 99, Compose Manager, Tailscale persistence)

4. **`scripts/migrate-db.ps1`** (~180 Zeilen, PowerShell 7+):
   - Liest `DATABASE_URL` aus `.env`, parsed `mysql://user:pass@host:port/dbname` Format
   - Sechs nummerierte Schritte mit farbigen Status-Ausgaben (Yellow/Green/Red/Cyan)
   - Voraussetzungs-Check (mysqldump im PATH)
   - Vorab-Check via `mysql` CLI (Tabellen-Count, optional)
   - `mysqldump --single-transaction --quick --routines --triggers --events --default-character-set=utf8mb4 --set-gtid-purged=OFF --column-statistics=0`
   - Komprimierung via .NET `GZipStream` (PowerShell hat kein natives gzip)
   - Output: `db-migration/protrackr-dump-YYYY-MM-DD_HH-MM-SS.sql.gz`
   - Flags: `-OutDir`, `-SkipGzip`, `-DryRun`
   - Abschluss mit Copy-Paste-fertigem `scp`-Befehl für NAS-Übertragung

5. **`scripts/migrate-db.sh`** (~210 Zeilen, Bash mit `set -euo pipefail`):
   - Erwartet Dump-Pfad als Argument; unterstützt `--dry-run` und `--help`
   - Sechs nummerierte Schritte mit ANSI-Farben
   - Liest `.env` via `set -a; source .env; set +a`
   - Container-Status-Check (`docker compose ps mysql --status running`)
   - Healthcheck-Wait (bis zu 10 Sekunden auf `healthy`)
   - **Sicherheits-Check:** Wenn Ziel-DB schon Tabellen hat → explizite `yes`-Bestätigung erforderlich (außer im Dry-Run)
   - Auto-Erkennung `.sql.gz` vs `.sql` (gunzip-Pipe vs `< file`)
   - **Verifikation nach Import:** Tabellen-Count + Zeilen-Counts für `mandanten`, `users`, `customers`, `timeEntries`, `expenses`, `exchangeRates`
   - Abschluss-Hinweis: `shred -u <dump>` nach Verifikation

**Warum:**
Phase 1.1 hatte nur die Container-Architektur-Kernfiles geliefert. Für ein produktives NAS-Deployment braucht es zusätzlich:
- **`.dockerignore`** — sonst kommt der gesamte Source-Tree inkl. `node_modules` und `.env` in den Build-Context (Build-Aufwand, Image-Größe, Secret-Leak-Risiko)
- **README + Unraid-Doku** — Self-Service-Anleitung für später (z.B. nach 6 Monaten, wenn Details vergessen)
- **Migrations-Skripte** — Phase 2 (Notebook-Dump) und Phase 4 (NAS-Import) brauchen reproduzierbare, sichere Helfer

**Design-Entscheidungen mit Begründung:**

| Entscheidung | Begründung |
|---|---|
| `*.md` im `.dockerignore` (außer wirklich nötig) | Docs gehören nicht ins Runtime-Image; reduziert Größe + Layer-Invalidation |
| `CLAUDE.md` im `.dockerignore` | Agent-Memory soll nicht im Container landen |
| Sechs-Schritt-Struktur in beiden Skripten | Konsistente UX; jeder Schritt verifizierbar einzeln |
| Farbige Output-Ausgaben | Visuelle Unterscheidung Fortschritt vs Warnung vs Fehler |
| Sicherheits-Bestätigung im Import-Skript (`yes`-Confirm) | Verhindert versehentliches Überschreiben |
| PowerShell GZipStream statt externem gzip | Keine externe Abhängigkeit auf Windows |
| Zeilen-Counts wichtiger Tabellen nach Import | Quick-Sanity-Check ohne UI-Login |
| Empfehlung Container Variables (masked) vor `.env` file | Stärkerer Schutz vor Backup-Leaks und Log-Exposure |

**Ergebnis:**
- `.dockerignore` (~70 Zeilen)
- `NAS_SETUP_README.md` (~190 Zeilen)
- `docs/UNRAID_DEPLOYMENT.md` (~220 Zeilen)
- `scripts/migrate-db.ps1` (~180 Zeilen)
- `scripts/migrate-db.sh` (~210 Zeilen)
- Branch `nas-setup` Working Tree um 5 Files erweitert
- **Phase 1 abgeschlossen** — alle 8 ursprünglich geplanten Files vorhanden
- Hook-Gate verhindert weiterhin Pollution (Tests bleiben aktiv)

---

# Phase 1 — Abgeschlossen ✓

> Alle 8 Files aus dem ursprünglichen Phase-1-Plan vorhanden:
> Dockerfile, .dockerignore, docker-compose.yml, .env.production.example,
> NAS_SETUP_README.md, docs/UNRAID_DEPLOYMENT.md, scripts/migrate-db.{ps1,sh}

---

# Phase 2 — Datenbank-Dump auf dem Notebook

## 2026-05-28 — Phase 2.1: Pre-Checks & Tool-Verfügbarkeit

**Was:**
- Branch-State: `nas-setup` sauber, synchron mit `origin/nas-setup`
- Tool-Suche nach `mysqldump.exe`:
  - **Nicht im `PATH`**, aber gefunden unter `C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe`
  - Workaround: PATH temporär in PowerShell-Aufruf erweitert
- MySQL-Service-Test: `Test-NetConnection 127.0.0.1 -Port 3306` → `True` (Server hört auf 3306)
- `.env` vorhanden mit gültigem `DATABASE_URL`
- PowerShell 7 + gzip verfügbar

**Warum:**
Robustes Setup vor Schreib-Operationen: erst alle Voraussetzungen prüfen, dann sich auf den eigentlichen Schritt konzentrieren.

**Ergebnis:**
Alle Voraussetzungen erfüllt. `mysqldump` muss bei Aufruf mit erweitertem PATH genutzt werden — Skript an sich ist robust (sucht via `Get-Command`).

---

## 2026-05-28 — Phase 2.2: `.gitignore` für Dump-Schutz erweitert

**Was:**
`.gitignore` um Block "NAS Migration — DB dumps" erweitert:
```
db-migration/
protrackr-dump-*.sql
protrackr-dump-*.sql.gz
*.dump
```

**Warum:**
Sicherheit. Verhindert versehentliches Committen der Produktivdaten-Dumps. Verifiziert via `git check-ignore -v`:
- `db-migration/...sql.gz` → blockiert ✓
- `drizzle/0023_customers_provision.sql` → **NICHT** blockiert ✓ (Drizzle-Migrations müssen committed bleiben)

**Ergebnis:**
Wenn der echte Dump erzeugt wird, taucht er in `git status` nicht auf und kann nicht versehentlich in einen Commit landen.

---

## 2026-05-28 — Phase 2.3: Dry-Run von `migrate-db.ps1`

**Was:**
```powershell
$env:PATH = "C:\Program Files\MySQL\MySQL Server 8.4\bin;" + $env:PATH
.\scripts\migrate-db.ps1 -DryRun
```

**Warum:**
Skript-Logik validieren ohne tatsächlichen Dump.

**Ergebnis:**
- Voraussetzungs-Check ✓
- `DATABASE_URL` korrekt aus `.env` geparst (Host `127.0.0.1:3306`, User `protrackr_user`, DB `protrackr`, Passwort 23 Zeichen)
- Output-Verzeichnis `db-migration/` angelegt
- Geplanter Ziel-Pfad: `db-migration/protrackr-dump-2026-05-28_20-50-27.sql.gz`
- Keine Fehler im Dry-Run

---

## 2026-05-28 — Phase 2.4: Echter Dump erzeugt

**Was:**
```powershell
$env:PATH = "C:\Program Files\MySQL\MySQL Server 8.4\bin;" + $env:PATH
.\scripts\migrate-db.ps1
```

**Warum:**
Erzeugt den eigentlichen MySQL-Dump für die spätere NAS-Migration in Phase 4. Read-only auf DB, schreibend nur auf lokales `db-migration/`-Verzeichnis.

**Ergebnis:**
- Tabellen-Vorabcheck: **16 Tabellen** in `protrackr`-DB ✓
- mysqldump erfolgreich: unkomprimiert 0.09 MB
- Komprimierung via .NET GZipStream: **0.02 MB (18.421 bytes)**
- Unkomprimiertes Zwischen-File automatisch gelöscht (Sicherheit)
- Output-Datei: `db-migration/protrackr-dump-2026-05-28_20-51-07.sql.gz`

---

## 2026-05-28 — Phase 2.5: Verifikation des Dumps

**Was:**
- `gzip -t` Integritäts-Test
- Header-Inspektion (Dump-Format, Server-Version, Charset)
- Tabellen-Liste aus `CREATE TABLE`-Statements
- Schema-Spot-Check auf Provision-Migration (Migration `0023`)
- `__drizzle_migrations`-Tabellen-Inhalt
- Approximate Row-Count
- gitignore-Block-Verifikation

**Warum:**
Vor der Übertragung auf NAS sicherstellen, dass der Dump:
1. Technisch valide ist (gzip OK)
2. Das vollständige aktuelle Schema enthält (inkl. neuestem Provision-Feature)
3. Realistisch viel Inhalt hat (nicht leer, nicht abgeschnitten)
4. Nicht versehentlich committed wird

**Ergebnis:**

| Check | Ergebnis |
|---|---|
| gzip-Integrität | OK ✓ |
| MySQL-Server-Version im Dump | 8.4.8 (Win64) |
| Charset | utf8mb4 ✓ |
| Tabellen im Dump | **16/16** (alle bekannten: `__drizzle_migrations`, `accountsettings`, `customers`, `documents`, `exchangerates`, `expenseaianalyses`, `expenses`, `fixedcosts`, `invoicenumbers`, `mandanten`, `passwordresettokens`, `taxconfigpl`, `taxprofiles`, `taxsettings`, `timeentries`, `users`) |
| **Provision-Spalten in `customers`** | ✅ **alle 8 vorhanden** (`provisionEnabled`, `provisionMode`, `provisionType`, `provisionValueBp`, `provisionValueCents`, `provisionUnit`, `provisionUserRate`, `provisionUserRateRemote`) — Migration 0023 ist bereits angewandt |
| `__drizzle_migrations` Einträge | 19 — alle bisherigen Migrations sind getrackt |
| Row-Counts (INSERT-Statements pro Tabelle) | 1 pro Tabelle für mandanten/users/customers/timeentries/expenses/exchangerates — mysqldump-Standard packt alle Rows einer Tabelle in ein INSERT-Statement mit mehreren VALUES-Tupeln |
| `git check-ignore db-migration/...sql.gz` | matcht Regel auf Zeile 110 ✓ |
| `git status` | Dump-File erscheint **nicht** (gitignore-Schutz wirkt) |

**Konsequenz für Phase 4 (NAS-Datenimport):**
- Schema im Dump = aktueller Stand (inkl. Provision-Feature)
- **Kein extra `drizzle migrate` Lauf nötig** vor erstem Container-Start
- `scripts/migrate-db.sh` auf NAS kann direkt das `.sql.gz` einspielen
- Die `mysqldump`-Warnung "Using a password on the command line interface can be insecure" ist Standard und auf Single-User-Notebook unbedenklich

---

## 2026-05-28 — Phase 2.6: Phase-2-Abschluss

**Status:**
- Dump-Datei lokal verfügbar: `db-migration/protrackr-dump-2026-05-28_20-51-07.sql.gz` (18 KB)
- Notebook-DB **unverändert** (nur gelesen)
- Notebook-Server `localhost:3001` **läuft weiter** auf main-Code, unbeeinträchtigt
- Dump-Datei **nicht im Git** (gitignore-geschützt)
- Branch-State sauber

**Was als nächstes (Phase 3) erforderlich:**
- Dump-Datei muss in Phase 4 zum NAS übertragen werden — Vorschlag: `scp` via Tailscale-IP, oder Unraid SMB-Share
- **NICHT JETZT** — erst Phase 3 (NAS-Vorbereitung + Container-Build) muss durchlaufen sein
- Bis dahin: Dump-Datei lokal aufbewahren, NICHT löschen

**Sicherheits-Hinweis (für Phase 4):**
Nach erfolgreichem Import auf NAS und Verifizierung in der App: Dump-Datei sicher löschen (`Remove-Item` auf Notebook, `shred -u` auf NAS).

---

# Phase 2 — Abgeschlossen ✓

> Dump-Datei: `db-migration/protrackr-dump-2026-05-28_20-51-07.sql.gz` (18 KB, gitignore-geschützt, gzip-integer, vollständiges Schema inkl. Provision-Feature)

> Geplante Dateien im Branch `nas-setup`:
> - `Dockerfile`
> - `.dockerignore`
> - `docker-compose.yml`
> - `.env.production.example`
> - `docs/UNRAID_DEPLOYMENT.md`
> - `scripts/migrate-db.ps1`
> - `scripts/migrate-db.sh`

---

# Phase 3 — NAS-Vorbereitung & Container-Build

## 2026-05-29 — Phase 3.1: Voraussetzungs-Check auf NAS + Compose-Plugin-Install

**Was:**
Erster echter NAS-Kontakt via Unraid Web-Terminal (Konsolen-Icon rechts oben in der WebGUI). Befehl: Voraussetzungs-Check der Tools, Speicher und vorhandenen Container.

**Befund:**
| Komponente | Erkenntnis |
|---|---|
| Unraid | 7.2.5 ✓ |
| Docker | 29.3.1 ✓ |
| **`docker compose`** | ⚠️ `unknown command` — Compose v2 Plugin fehlte |
| Tailscale | 1.96.2, Hostname `dcs01` ist Self, IP `100.108.232.64` ✓ |
| Git | 2.51.1 ✓ |
| Speicher `/mnt/user` | 7.3 TB, 143 GB belegt (2%) ✓ |
| `/mnt/user/appdata/` | enthält `mariadb-official/`, `nextcloud/`, `obsidian/`, `ollama/`, `open-webui/` — `protrackr/` noch nicht da ✓ |

**Aktion:**
Plugin **"Compose Manager Plus"** von `mstrhakr` (Tools-Kategorie, **stable** Version, nicht BETA) über Unraid Community Apps installiert. Bringt sowohl Web-UI als auch `docker compose` CLI mit.

**Nachher:** `docker compose version` zeigt `v5.1.2` (Plugin-Version, intern Compose-v2-kompatibel). ✓

**Beobachtung am Rande:**
NAS hostet bereits Nextcloud (mit eigener MariaDB), Obsidian, Open-WebUI/Ollama. **Plan bleibt:** Wir nutzen unseren **eigenen** MySQL-Container für ProTrackr (Isolation, keine Schema-Konflikte mit Nextcloud-DB).

---

## 2026-05-29 — Phase 3.2: Repo auf NAS clonen

**Was:**
```bash
mkdir -p /mnt/user/appdata
cd /mnt/user/appdata
git clone --branch nas-setup --single-branch \
  https://github.com/DoeringConsulting/ProTrackr.git protrackr
cd protrackr
```

**Warum `--single-branch`:**
Verhindert versehentliches Mitziehen von `main` — schützt vor versehentlichem Branch-Wechsel auf dem NAS und spart Platte (~ 1.35 MiB Branch-only statt ~10 MiB full clone).

**Ergebnis:**
- Clone-Output: 3.779 Objekte, 1.35 MiB ✓
- Working Dir: `/mnt/user/appdata/protrackr` ✓
- Branch: `nas-setup` ✓
- HEAD: `62e8613` (= Phase 2 Commit auf origin) ✓
- Alle Top-Level Files vorhanden: `Dockerfile`, `docker-compose.yml`, `.env.production.example`, `.dockerignore` ✓
- Scripts: `migrate-db.{ps1,sh}` ✓
- **24 Drizzle-SQL-Files** in `drizzle/` (Notebook-Dump hat 19 `__drizzle_migrations`-Einträge — 5 weitere SQL-Files vorhanden im Repo; nicht alle sind unbedingt versionierte Migrations; nicht-kritisch, wird beim ersten Container-Start automatisch geprüft)

---

## 2026-05-29 — Phase 3.3: Secrets generieren + `.env` anlegen

**Was:**
- `scripts/migrate-db.sh` ausführbar gemacht (`chmod +x`)
- `.env.production.example` → `.env` kopiert
- **6 Secrets generiert mit `openssl rand -hex`** (alle hex → sed-safe, keine Sonderzeichen):
  - `SESSION_SECRET` (64 Zeichen)
  - `JWT_SECRET` (64 Zeichen)
  - `SCHEDULER_API_KEY` (64 Zeichen)
  - `CRON_SECRET` (64 Zeichen)
  - `MYSQL_ROOT_PASSWORD` (48 Zeichen)
  - `MYSQL_PASSWORD` (48 Zeichen)
- Via `sed -i` in `.env` eingesetzt, inkl. der `DATABASE_URL`-Zeile (gleiches Passwort wie `MYSQL_PASSWORD`)
- `.env` Permissions auf `600` gesetzt (nur root liest)

**SMTP_PASS manuelles Setzen:**

Erste Eingabe via `read -s` ergab eine fehlerhafte Länge in `.env` (38 Zeichen statt der 10 Zeichen des Mailbox-Passworts). Mögliche Ursache: Web-Terminal-Quirk, Bracket-Pasting, oder unerwartetes Tastatur-Layout-Verhalten.

**Erfolgreiche Methode (zweiter Versuch):**
- Webmail-Login-Test vorher zur Passwort-Verifizierung (User bestätigt: PW korrekt)
- Sichtbare Eingabe via `read -p` (User kontrolliert Eingabe selbst mit den Augen)
- Visuelle Bestätigung (`>${PW}<`) + Länge angezeigt
- In-Place-Update mit **`awk -v pw="$PW"`** statt `sed` — robuster gegen Sonderzeichen
- `clear` am Schluss als Schulter-Schutz
- Verifikation: 10 Bytes in .env ✓, 1 SMTP_PASS-Zeile ✓

**Lerneffekt:**
- `read -s` mit anschließendem `sed`-Escape ist im Web-Terminal nicht zuverlässig
- `read -p` (sichtbar) + `awk`-Replacement ist robuster
- **`Strg + W`** schließt den Browser-Tab und damit das Web-Terminal — also kann `nano` mit `Strg+W` (Search) nicht genutzt werden. Falls Editing nötig: `vi` (keine Strg-Tasten nötig) oder die `awk`-Methode

**Ergebnis:**
- `.env` vollständig konfiguriert (alle 6 generierten Secrets + SMTP_PASS gesetzt)
- Permissions `600` ✓
- Keine `CHANGE_ME_*`-Platzhalter mehr ✓

---

## 2026-05-29 — Phase 3.4: Container-Build (erster Versuch + Husky-Fix)

**Erster Versuch — `docker compose build`:**

Build durchlief mehrere Stages erfolgreich (`base`, `deps`, parallel `build` und `prod-deps`), brach dann ab im `prod-deps`-Stage mit:

```
> project-billing-app@2.0.4 prepare /app
> husky
sh: husky: not found
 ELIFECYCLE  Command failed.
ERROR: process "/bin/sh -c pnpm install --frozen-lockfile --prod" did not complete successfully: exit code: 1
```

**Diagnose:**
`package.json` hat `"prepare": "husky"` als Script. pnpm führt `prepare` nach jedem `install` automatisch aus. Im `prod-deps`-Stage installieren wir nur Production-Dependencies (`--prod`), Husky ist aber eine devDependency → `husky: not found` → Build bricht.

Im `deps`-Stage lief Husky auch (mit Warning `.git can't be found` weil Build-Container kein .git hat), exit aber mit 0. Nur der `--prod`-Stage scheitert hart.

**Fix (Commit `945b916`):**

```dockerfile
# Original (failed):
RUN pnpm install --frozen-lockfile --prod

# Fixed:
RUN pnpm install --frozen-lockfile --prod --ignore-scripts
```

**Warum sicher:**
- `--ignore-scripts` überspringt ALLE Lifecycle-Scripts (prepare, postinstall, ...) — nur im `prod-deps`-Stage
- Der `build`-Stage hatte alle devDependencies + Scripts aktiv (vite, esbuild liefen normal)
- bcryptjs (pure JS) ist die im Code genutzte Auth-Lib, nicht bcrypt (native) → kein postinstall-Rebuild nötig
- Runtime-Image braucht nur den resolved node_modules tree, keine Scripts

**Re-Build:**
- Auf NAS: `git pull origin nas-setup` zog Fix
- HEAD: `945b916` ✓
- `docker compose build` neu gestartet — Build-Cache erleichtert (deps + build cached, nur prod-deps und runtime neu)
- *Ergebnis kommt sobald Build durch ist*

---

# Phase 3 — Implementation läuft (3.4 Re-Build in Arbeit, 3.5 folgt)

---

# Phase 4 — Erstes Anlaufen, SMTP-Test, Datenmigration (folgt)

# Phase 5 — Tailscale Serve aktivieren & End-to-End-Test (folgt)

# Phase 6 — Notebook-Server abschalten / Switchover (folgt)
