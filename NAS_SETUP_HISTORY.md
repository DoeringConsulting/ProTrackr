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

## 2026-05-29 — Phase 3.4 (Forts.): Re-Build erfolgreich

**Was:**
Auf NAS: `git pull origin nas-setup` → HEAD `945b916`. Dann `docker compose build` erneut.

**Ergebnis (Build-Cache wirksam):**
- Re-Build von **17:29:18 bis 17:29:38 = 20 Sekunden** (statt 5-10 min beim ersten Versuch ohne Cache)
- `prod-deps` Stage: **6.6 s** (ohne husky-Crash dank `--ignore-scripts`)
- `build` Stage: **8.8 s** (vite + esbuild aus Cache)
- `runtime` Stage: **4.3 s** (COPY-Operationen)
- Final-Image: `protrackr-app:latest e929ad445b0a` **563 MB**

**Beobachtung:**
`mysql:8.0` Image wurde NICHT beim Build gepullt — `docker compose build` baut nur Services mit `build:` Block. Das `mysql`-Service-Image wird erst beim ersten `up` gepullt. Erwartet, kein Problem.

---

## 2026-05-29 — Phase 3.5: MySQL Container starten + Healthcheck

**Was:**
```bash
docker compose up -d mysql
# Wait-Loop bis healthy (max 60 s)
```

**Ergebnis:**
- `mysql:8.0` Image gepullt: **799 MB**
- Network `protrackr_protrackr_net` (Bridge) erstellt ✓
- Volume `protrackr_mysql_data` (lokal) erstellt ✓
- Container `protrackr-mysql` gestartet ✓
- Health-Status: `starting` → `starting` → ... → **`healthy` nach 25 Sekunden** ✓

**MySQL-Init-Sequenz im Log:**
- `Creating database protrackr` ✓
- `Creating user protrackr_user` ✓
- `Giving user protrackr_user access to schema protrackr` ✓
- `MySQL init process done. Ready for start up.`
- `Server ready for connections. Version: '8.0.46' port: 3306` ✓

**Harmlose Warnings im Log (keine Aktion nötig):**
- `--skip-host-cache` deprecated → MySQL 8.x Hinweis, wird in compose.yml nicht gesetzt, vermutlich Default vom Image
- `CA certificate ca.pem is self signed` → MySQL-internes TLS für Replication, irrelevant für unsere Nutzung
- `Insecure configuration for --pid-file` → Container-internal, irrelevant

**Container-Status:** `Up (healthy)`, Ports `3306/tcp, 33060/tcp` (nur intern im `protrackr_protrackr_net`, NICHT zum Host exposed wie gewollt).

---

# Phase 3 — Abgeschlossen ✓

> **NAS-Vorbereitung & Container-Build komplett:**
> - Compose Manager Plus installiert ✓
> - Repo gecloned auf `/mnt/user/appdata/protrackr` ✓
> - `.env` mit 6 generierten Secrets + SMTP_PASS konfiguriert ✓
> - `protrackr-app:latest` (563 MB) gebaut ✓
> - `mysql:8.0` (799 MB) läuft healthy, frische DB initialisiert ✓
> - **App-Container noch nicht gestartet** — kommt in Phase 4 nach Datenimport

---

# Phase 4 — Erstes Anlaufen, SMTP-Test, Datenmigration

## 2026-05-29 — Phase 4.1: Dump-Transfer Notebook → NAS

**Was:**
Dump-Datei vom Notebook auf den NAS übertragen via **Tailscale SSH** + `scp`:

```powershell
scp -o StrictHostKeyChecking=accept-new \
  "C:\Projects\ProTrackr_developing_path\db-migration\protrackr-dump-2026-05-28_20-51-07.sql.gz" \
  root@dcs01.taile370c2.ts.net:/mnt/user/appdata/protrackr/db-migration/
```

**Beobachtung — Tailscale SSH ist elegant:**
Statt klassischem SSH-Passwort-Login lief die Auth über die **Tailscale-Account-Authentifizierung** (URL `https://login.tailscale.com/a/...`). Kein Unraid-Root-Passwort nötig — sehr saubere Trennung von "Tailnet-Mitgliedschaft" und "OS-Zugriff", plus ACL-Bindung an den Tailscale-Account.

**Stolperfalle: Zielverzeichnis fehlte**
Erste SCP-Übertragung scheiterte mit `dest open: Failure`, weil `/mnt/user/appdata/protrackr/db-migration/` auf NAS nicht existierte. Der Ordner ist in `.gitignore` → wird beim `git clone` nicht angelegt. Fix: `mkdir -p` im Web-Terminal, dann SCP-Wiederholung.

**Ergebnis:**
- Datei auf NAS: `db-migration/protrackr-dump-2026-05-28_20-51-07.sql.gz` (18.421 Bytes, identisch zum Notebook) ✓
- gzip-Integritätstest auf NAS: OK ✓

---

## 2026-05-29 — Phase 4.2: Dump-Import + zwei Skript-Bugs gefixt

**Erster Versuch — Import scheiterte mit:**
```
ERROR 1064 (42000) at line 1: You have an error in your SQL syntax;
... near 'mysqldump: [Warning] Using a password on the command line interface can be insec'
```

**Root cause 1 — `migrate-db.ps1`:**
Das PowerShell-Skript hatte `& mysqldump @args 2>&1 | Out-File ...` — `2>&1` merged stderr in stdout. Daher landete die mysqldump-Warning ("Using a password ...") als **erste Zeile** im Dump-File. MySQL parsed sie beim Import als SQL → ERROR 1064.

**Fix Commit `ddc9f1f`:**

Zwei-Schichten-Verteidigung:
1. **`scripts/migrate-db.sh`** (robust gegen existierende dirty dumps): Import-Stream durch `grep -v '^mysqldump:'` pipen — entfernt jegliches mysqldump-stderr-Noise on-the-fly. Wirkt für `.sql` und `.sql.gz`.
2. **`scripts/migrate-db.ps1`** (Source-Fix für zukünftige Dumps): stderr in separate Temp-Datei (`$dumpFile.stderr`) statt merge. Operator sieht Warnings (grau), Errors (rot) — aber sie landen NIE im Dump-File. Temp wird aufgeräumt.

**Stolperfalle: Pull mit chmod-Konflikt**
Nach dem Skript-Fix wollte der User `git pull` — scheiterte:
```
error: Your local changes to the following files would be overwritten by merge:
        scripts/migrate-db.sh
```
Ursache: `chmod +x` aus Phase 3.3 hatte die Mode-Bits im Repo geändert (`100644` → `100755`).

**Lösung:** Atomar via `git fetch && git reset --hard origin/nas-setup`, dann `chmod +x` erneut.

**Folge-Fix Commit `b12c559`** (Permanent-Lösung):
Mode-Bit `+x` direkt im git-Index gesetzt für `scripts/migrate-db.{sh,ps1}` via `git update-index --chmod=+x`. Damit gilt: künftige Clones haben die Skripte sofort ausführbar, und `chmod +x` nach Clone produziert keinen "local change" mehr → kein Pull-Konflikt mehr.

**Zweiter Import-Versuch (mit gefixtem Skript):**
```
[5/6] Import ausfuehren...
  Importiere komprimiertes Dump (filtere mysqldump-Warnings)...
  Import abgeschlossen
[6/6] Verifikation nach Import...
  Tabellen in protrackr nach Import: 16
  Zeilenanzahl wichtiger Tabellen:
    mandanten: 3, users: 2, customers: 3
    timeEntries: n/a, expenses: 170, exchangeRates: n/a
```

**Aber: `n/a` für `timeEntries` und `exchangeRates`** → führte zu Phase 4.3.

---

## 2026-05-29 — Phase 4.3: LCTN-Diagnose + Re-Init

**Diagnose:**
```sql
SHOW VARIABLES LIKE 'lower_case_table_names';
-- Wert: 0 (Linux-Default, case-sensitive)
```

```sql
SHOW TABLES;
-- Alle Tabellen kommen lowercase aus dem Dump:
-- timeentries, exchangerates, accountsettings, expenseaianalyses, ...
```

**Root cause:**
- Notebook (Windows-MySQL) hat Default `lower_case_table_names=1` → Tabellen-Namen werden intern als lowercase gespeichert
- `mysqldump` exportiert die Namen wie gespeichert (= lowercase)
- Container auf Linux startete mit Default `lower_case_table_names=0` → strikt case-sensitive
- Drizzle's Code (schema.ts) referenziert die Tabellen mit **camelCase** (`timeEntries`, `accountSettings`, `exchangeRates`, ...)
- Mismatch: `SELECT * FROM timeEntries` würde gegen `timeentries` scheitern → App-Crash beim Start

**Fix Commit `93085b5`:**
`command: --lower-case-table-names=1` im `mysql`-Service der `docker-compose.yml`. MySQL normalisiert dann alle Tabellen-Namen zu lowercase und vergleicht case-insensitive — Drizzle's camelCase-Reads matchen transparent gegen die lowercase Tabellen.

**Wichtiges Detail:** `lower_case_table_names` ist eine **Init-only**-Variable. Kann nur beim ersten DB-Start gelesen werden. Daher Re-Init nötig:

```bash
docker compose down
docker volume rm protrackr_mysql_data   # Frische DB
git fetch && git reset --hard origin/nas-setup
docker compose up -d mysql               # Initialisiert mit LCTN=1
# ... wait for healthy ...
./scripts/migrate-db.sh db-migration/protrackr-dump-*.sql.gz
```

**Ergebnis nach Re-Init:**
| Check | Wert |
|---|---|
| `lower_case_table_names` | **1 ✓** |
| Container-Health | healthy in 25 s ✓ |
| Import-Schritt 6/6 | **alle Row-Counts vollständig** (mandanten: 3, users: 2, customers: 3, **timeEntries: 124**, expenses: 170, **exchangeRates: 21**) ✓ |
| `SELECT FROM timeEntries` (camelCase) | 124 Zeilen ✓ (case-insensitive Match wirkt) |
| `SELECT FROM exchangeRates` (camelCase) | 21 Zeilen ✓ |

**Daten-Vollständigkeit verifiziert:**
- 16 / 16 Tabellen importiert
- 124 Zeit-Einträge, 170 Reisekosten-Einträge, 21 Wechselkurs-Einträge
- 3 Mandanten, 2 User, 3 Kunden

**Lerneffekt für andere MySQL-Windows-Linux-Migrationen:** `lower_case_table_names=1` ist Pflicht beim ersten Init, wenn der Dump aus Windows kommt. Sonst Schema-Mismatch.

---

## 2026-05-29 — Phase 4.4: App-Container Start (Port-Conflict + Vite-Static-Import-Fix)

**1. Erster Start — Port-Conflict:**

`docker compose up -d app` scheiterte mit:
```
Bind for 0.0.0.0:3000 failed: port is already allocated
```

Diagnose via `ss -tlnp`: Container `obsidian` belegt den Range **3000-3001** (in Phase 0.5 hatten wir nur 3001 = Obsidian dokumentiert; den 3000-Endpunkt hatten wir ohne netstat-Scan nicht gesehen). Curl auf `localhost:3000` lieferte `Server: nginx` mit 762 Bytes — das ist die Obsidian-Welcome-Page.

**Fix Commit `87c75e4`:**
Host-Port von `127.0.0.1:3000:3000` auf `127.0.0.1:3010:3000` geändert. Container-interner Port bleibt 3000 (App-Code, Healthcheck-Befehl `wget http://localhost:3000/`, Env-Var `PORT=3000` alles unverändert). Tailscale-Serve-Plan in Phase 5 zielt jetzt auf `localhost:3010` statt `:3000`.

---

**2. Zweiter Start — Vite-Static-Import-Crash:**

App startete, wechselte aber in Restart-Schleife:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vite' imported from /app/dist/index.js
```

**Root cause:** `server/_core/vite.ts` hat **statische** ES-Module-Imports auf Top-Level:
```typescript
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
```

ES-Module-Top-Level-Imports werden bei Module-Load **immer** ausgewertet, auch wenn die importierende Funktion (`setupVite`) in Production nie aufgerufen wird (Production-Pfad nutzt `serveStatic`). Da `vite` als devDependency im `prod-deps` Stage fehlt → Crash.

**Drei Optionen erwogen, User-Entscheidung gefragt:**

| Option | Vorgehen | Wahl |
|---|---|---|
| A | Dynamic imports in `vite.ts` (App-Code-Fix, sauberste Lösung, gehört aber auf `main`) | als TODO-M3 für später |
| B | Dockerfile: `node_modules` vom `build`-Stage statt `prod-deps`-Stage kopieren (~200 MB größeres Image, aber branch-isoliert) | **gewählt** |
| C | `vite` in `dependencies` verschieben (package.json-Change, würde main betreffen) | verworfen |

**Fix Commit `69591ff`:**
- `COPY --from=build` statt `COPY --from=prod-deps` für `/app/node_modules` im runtime stage
- Ausführlicher Kommentar mit Begründung und Verweis auf Option A als langfristige Lösung
- `prod-deps`-Stage bewusst NICHT entfernt — bleibt als "Doku der intendierten schlanken Variante", entfernen sobald Option A in `main` landet

---

**3. Re-Build + Re-Start — Erfolg:**

| Check | Ergebnis |
|---|---|
| Build-Zeit | **22 s** (Cache wirkte: `base`, `deps`, `build` Stages cached, nur `runtime` neu) |
| Image | `protrackr-app:latest sha256:35d90e0bf32b…` |
| MySQL healthy in | 5 s |
| **App healthy in** | **10 s** ✓ |
| Container-Status | `Up (healthy)`, Port-Mapping `127.0.0.1:3010->3000/tcp` |
| Curl-Test (NAS lokal) | `HTTP/1.1 200 OK` mit Helmet-Security-Headers ✓ |
| HTML-Body | `<title>Döring Consulting - Projekt & Abrechnungsmanagement</title>`, `APP_VERSION: 2.0.4` ✓ |

**Drei non-fatal Warnings im Log** (siehe Maintenance-TODOs am Ende dieser Phase):
1. `MemoryStore is not designed for a production environment` → TODO-M1
2. `ValidationError: ipKeyGenerator helper function for IPv6 addresses` (3×) → TODO-M2
3. Bewusst akzeptierter Dockerfile-Workaround (Option B statt A) → TODO-M3

---

# Phase 4 — Implementation läuft (4.5 Browser-Login + 4.6 SMTP-Test pending)

---

# Phase 5 — Tailscale Serve aktivieren & End-to-End-Test

## 2026-05-29 — Phase 5.1: Tailscale Serve aktiviert

**Was:**
```bash
tailscale serve --bg --https=9443 http://localhost:3010
```

**Ergebnis (`tailscale serve status`):**
```
https://dcs01.taile370c2.ts.net:9443 (tailnet only)
|-- / proxy http://localhost:3010
```

**Self-Connect-Test vom NAS selbst** (`curl https://dcs01.taile370c2.ts.net:9443/`) lieferte leere Response — bekannter Tailscale-Self-Routing-Quirk, kein App-Problem. Der echte Test ist von Notebook/anderen Tailnet-Geräten aus.

---

## 2026-05-29 — Phase 5.2: Externer Erreichbarkeits-Test (Notebook)

**Was:**
```powershell
curl.exe -k -I https://dcs01.taile370c2.ts.net:9443/
```

**Ergebnis:**

| Indikator | Wert | Bedeutung |
|---|---|---|
| Status | `HTTP/1.1 200 OK` | App liefert sauber aus ✓ |
| `Content-Length` | 368.030 (368 KB) | Vollständige SPA wird ausgeliefert ✓ |
| `Content-Type` | `text/html; charset=UTF-8` | ProTrackr-HTML ✓ |
| `Set-Cookie: csrf-token=…` | `Secure; HttpOnly; SameSite=Lax` | CSRF-Middleware aktiv ✓ |
| `Set-Cookie: connect.sid=…` | `Secure; HttpOnly; SameSite=Lax` | Express-Session-Cookie korrekt hardened ✓ |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HSTS aktiv ✓ |
| `X-Frame-Options`, `X-Content-Type-Options`, `Cross-Origin-Opener-Policy`, … | (alle gesetzt) | Helmet-Security-Headers ✓ |
| TLS-Cert | gültig (Let's Encrypt via Tailscale) | Grünes Schloss im Browser ✓ |

**Konsequenz:** App ist von jedem Gerät im Tailnet (Notebook, Handy, weitere Rechner) unter **`https://dcs01.taile370c2.ts.net:9443`** erreichbar. End-to-End-Verbindung Browser → Tailscale → Host:3010 → Container:3000 → MySQL funktioniert.

**Persistenz noch offen** (Phase 5.3): `tailscale serve --bg` überlebt NAS-Reboot nicht. Wird mit Unraid User Scripts Plugin nachgezogen.

---

# Phase 5 — Implementation läuft (5.3 Reboot-Persistenz pending)

---

# Maintenance-TODOs / Open-Issues

Nicht-blockierende Verbesserungen, gesammelt während der NAS-Migration. App läuft funktional einwandfrei — diese Items können bei Gelegenheit in einem separaten Wartungs-Pass abgearbeitet werden. Reihenfolge nach **kombinierten Nutzen+Aufwand**.

---

## TODO-M1: MemoryStore → MySQL-Session-Store

**Symptom:** Beim App-Start im Log:
```
Warning: connect.session() MemoryStore is not designed for a production environment,
as it will leak memory, and will not scale past a single process.
```

**Was passiert aktuell:**
Express speichert alle Login-Sessions im **RAM** des App-Containers. Bei jedem Container-Restart (Updates, Reboot des NAS, `docker compose up --force-recreate app`) gehen alle Sessions verloren → User muss sich neu einloggen.

**Auswirkung im aktuellen Setup:** Niedrig. Single-User, Container-Restarts seltener als monatlich. Ein erneuter Login pro Update ist zumutbar. Memory-Leak ist bei < 5 aktiven Sessions vernachlässigbar.

**Lösung (Empfehlung: Option A — MySQL-Session-Store):**

1. Dependencies hinzufügen:
   ```
   pnpm add express-mysql-session
   pnpm add -D @types/express-mysql-session
   ```
2. In `server/_core/index.ts` Session-Config umstellen (~15 Zeilen):
   ```typescript
   import MySQLStore from "express-mysql-session";
   const MySQLSessionStore = MySQLStore(session);
   const sessionStore = new MySQLSessionStore({
     host: dbHost, port: dbPort,
     user: dbUser, password: dbPass,
     database: dbName,
     createDatabaseTable: true,  // legt `sessions`-Tabelle automatisch an
   });
   app.use(session({ store: sessionStore, secret: ..., ... }));
   ```
3. Lokaler Test: Login → Server-Restart → noch eingeloggt?
4. Commit + Push, NAS-Rebuild + Restart, Browser-Test.

**Alternativen (verworfen):**
- B) Redis-Session-Store — overkill für Single-User (+1 Container)
- C) File-Store — kein konkurrenter Zugriff sicher, schlechte Performance
- D) Beibehalten — die hier dokumentierte Default-Strategie

**Aufwand-Schätzung:** ~**35–45 Minuten** (Code-Change 10 min, lokaler Test 10 min, Commit/Push/Tests 3 min, NAS-Rebuild 5 min, Browser-Test 3 min, HISTORY-Doku 3 min).

**Risiko:** Mittel. Session-Persistence-Konfiguration ist sensibel; bei Fehlern Login-Schleife oder unsichere Cookies möglich. Mitigation: Lokaler Test vor Push, gründliche Browser-Verifikation.

**Branch-Strategie:** Gehört konsequent auf `main` (App-Code-Verbesserung, nicht NAS-spezifisch). Wenn dort gefixt, später bewusster `main → nas-setup` Sync nach Risikoaufklärung.

---

## TODO-M2: IPv6-aware Rate-Limit-Key-Generator

**Symptom:** Beim App-Start dreimal im Log:
```
ValidationError: Custom keyGenerator appears to use request IP without calling
the ipKeyGenerator helper function for IPv6 addresses. This could allow IPv6
users to bypass limits.
  code: 'ERR_ERL_KEY_GEN_IPV6'
```

**Was passiert aktuell:**
`express-rate-limit` hat in Version 8+ einen Validator eingebaut, der prüft ob der Custom-Key-Generator IPv6-sicher ist. Unser Code nutzt `req.ip` direkt, was IPv6-Adressen nicht sauber normalisiert. Theoretisch könnten IPv6-User Rate-Limits umgehen, indem sie verschiedene Sub-Adressen im selben Prefix nutzen.

**Auswirkung im aktuellen Setup:** Niedrig. Zugriff läuft über Tailscale, das primär IPv4-Endpunkte (100.x.x.x) nutzt. Selbst wenn IPv6 im Tailnet aktiv wäre — die Bedrohung ist "Brute-Force gegen meine eigene Single-User-App durch mich selbst", was kein realistisches Szenario ist.

**Lösung:**
In den drei Aufrufen von `rateLimit()` in `server/_core/index.ts` den Custom-Key-Generator durch den Helper `ipKeyGenerator` aus `express-rate-limit` ersetzen:
```typescript
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
// vorher: keyGenerator: (req) => req.ip,
// nachher:
keyGenerator: (req) => ipKeyGenerator(req.ip),
```

**Aufwand-Schätzung:** ~**15 Minuten** (Code-Change 5 min, Tests 3 min, Commit + NAS-Restart 7 min).

**Risiko:** Niedrig — Standard-API-Anwendung des Helpers.

**Branch-Strategie:** Gehört auf `main`.

---

## TODO-M3: Vite Dynamic-Import statt Dockerfile-Workaround (Option A aus Phase 4.4)

**Symptom:** Image ist ~200 MB größer als nötig, weil das Dockerfile bewusst `node_modules` mit allen devDependencies aus dem `build`-Stage in den Runtime kopiert (Option B aus Phase 4.4).

**Was passiert aktuell:**
`server/_core/vite.ts` hat statische Top-Level-Imports von `vite` und `vite.config`. Die werden bei jedem Module-Load ausgewertet — auch in Production, wo nie `setupVite` aufgerufen wird. Daher muss `vite` in `node_modules` vorhanden sein, sonst `ERR_MODULE_NOT_FOUND`.

**Auswirkung im aktuellen Setup:** Niedrig. 200 MB mehr Disk auf NAS sind bei 7.2 TB freier Platte irrelevant. Etwas größerer Container-Attack-Surface (vite, tsx, vitest sind im Runtime obwohl nie genutzt). Image-Pull-Zeit bei Erst-Deployment minimal langsamer.

**Lösung:**
In `server/_core/vite.ts` die zwei Top-Level-Imports in dynamic imports innerhalb der `setupVite`-Funktion verlagern:
```typescript
// VORHER (Top-Level):
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

// NACHHER (in setupVite):
export async function setupVite(app: Express, server: Server) {
  const { createServer: createViteServer } = await import("vite");
  const viteConfig = (await import("../../vite.config")).default;
  // ... rest unchanged
}
```

Dann im Dockerfile: `COPY --from=prod-deps` wieder aktivieren statt `COPY --from=build`. Image schrumpft auf ~563 MB.

**Aufwand-Schätzung:** ~**25–30 Minuten** (Code-Change 5 min, lokaler Test `pnpm dev` + `pnpm build` + Run 10 min, Dockerfile-Revert 2 min, Commit/Push/Pre-commit-Tests 3 min, NAS-Rebuild 5 min, Browser-Test 3 min).

**Risiko:** Niedrig. Dynamic imports sind Standard-ES-Module-Pattern und in Node 22 voll unterstützt.

**Branch-Strategie:** Gehört auf `main` (App-Code-Fix). Sobald gefixt: Dockerfile-Hack auf `nas-setup` zurückrollen, `prod-deps`-Stage wieder verwenden.

---

## Maintenance-TODOs — Priorisierungs-Empfehlung

| Reihenfolge | TODO | Begründung |
|---|---|---|
| 1. (irgendwann zuerst) | **M2** (IPv6 Rate-Limit) | Quickest win, 15 min, viele Warnings weg, sauberer Log |
| 2. | **M1** (MySQL-Session-Store) | Mittlerer Aufwand, höchster spürbarer Nutzen (Login überlebt Restarts) |
| 3. | **M3** (Vite Dynamic Import) | Niedrigster Nutzen-Aufwand-Quotient; lohnt sich nur als Teil eines größeren Wartungs-Passes auf main |

Alle drei können auch in einem Rutsch erledigt werden (~75-90 Min Gesamtzeit) — z.B. als bewusster "Wartungs-Tag" einmal pro Quartal.

---

# Phase A — Zwei-Umgebungen-Rollout (Deployment-Blueprint)

> Ab hier folgt die Umsetzung des `docs/DEPLOYMENT-BLUEPRINT.md` (kam mit dem
> v2.1.8-Merge auf nas-setup). Ziel: Prod (echte Daten) + Dev (Test) auf dem
> NAS, Image-Promotion Dev→Prod. Rollout manuell nach den Leitplanken des
> `nas-rollout`-Skills. Phase 6 (localhost abschalten) = Schritt A5.

## 2026-07-02 — Phase A / A1: Prod scharfstellen (v2.1.8 + echte Laptop-Daten)

**Ausgangslage:**
- NAS-Prod lief v2.0.4 mit Daten von Ende Mai (124 timeEntries, 170 expenses).
- Laptop-DB war **aktueller**: 170 timeEntries, 195 expenses, v2.1.1-Schema
  (Spalte `expenses.customerId` aus Migration 0024 vorhanden).
- origin/main HEAD war v2.1.8; **schema-identisch** zu v2.1.1 (keine neuen
  Migrationen zwischen v2.1.1 und v2.1.8 — nur Code/Bugfixes).
- User-Entscheidung: Prod-Ziel = **v2.1.8** (nahtloser Übergang, Laptop-Stand).

**A1.0 — Backup + Freeze:**
- DB-Backup NAS: `db-migration/prod-pre-A1-2026-07-02_15-27-28.sql` (124 KB, 16 Tabellen).
- Git-Freeze-Tag `freeze/nas-A1-start` → `dacbda6`, auf origin gepusht.
- Altlast `.env.bak.before-nano` gelöscht (Secret-Hygiene).

**A1.1 — Laptop-Dump + Version/Schema-Check:**
- Laptop-DB inspiziert: 170 timeEntries, 195 expenses, customerId-Spalte vorhanden.
- Laptop-Server läuft v2.1.8 (localhost:3001/version.json).
- Frischer Dump via `migrate-db.ps1`: `protrackr-dump-2026-07-02_15-52-19.sql.gz`
  (22 KB). Verifiziert: 16 Tabellen, sauberes Ende (`-- Dump completed`),
  customerId im Schema.
- **Skript-Beobachtung:** mysqldump warnte `Access denied ... PROCESS privilege`
  beim Tablespace-Dump (harmlos, Dump vollständig). TODO: `--no-tablespaces`
  in migrate-db.ps1 ergänzen (in A1.4-Backup schon manuell genutzt).

**A1.3 — Code auf v2.1.8 (Merge main → nas-setup):**
- Trockenlauf (`git merge --no-commit --no-ff origin/main`): **konfliktfrei**.
- Verifiziert: package.json 2.0.4 → 2.1.8 (auto, kein Konflikt); **KEINE
  NAS-Config berührt** (Dockerfile, docker-compose.yml, migrate-db.*,
  NAS_SETUP_*, .dockerignore alle unverändert — Leitplanke eingehalten);
  neue Migration `0024_expenses_customer_id.sql`; 32 Dateien, +1700/-220.
- Merge-Commit `e4951fb`, gepusht. Pre-commit-Tests 11/11 grün.
- NAS: `git fetch && git reset --hard origin/nas-setup` → Code v2.1.8 auf NAS
  (laufende App blieb vorerst v2.0.4).

**Zwischenfall — SSH-Host-Key-Wechsel:**
- scp vom Laptop scheiterte mit `REMOTE HOST IDENTIFICATION HAS CHANGED`.
- Ursache: Unraid-Update 7.2.5 → **7.3.1** + Tailscale-Key-Rotation. Der native
  `/etc/ssh/ssh_host_ed25519_key.pub` existiert gar nicht → Verbindung läuft
  über **Tailscale SSH** (Sicherheit via WireGuard-Tunnel, nicht via SSH-Host-Key).
- Lösung: alten known_hosts-Eintrag entfernt (`ssh-keygen -R`, Backup als
  known_hosts.old), scp erneut → Tailscale SSH authentifizierte neu (Exit 0).

**A1.4 — Daten-Import + Rebuild (der zerstörerische Schritt, mit Freigabe):**
- A1.4.1: v2.0.4-Image als Rollback gesichert: `protrackr-app:pre-A1-v2.0.4` (35d90e0).
- A1.4.2: Dump auf NAS übertragen (scp, 22 KB, gzip OK).
- Vorab verifiziert: **keine Auto-Migration** beim App-Start (`CMD ["node",
  "dist/index.js"]`, kein drizzle-kit migrate in server/) → kein Schema-Konflikt
  beim v2.1.8-Start gegen importiertes 0024-Schema.
- Import-Ablauf (ein Block): frisches Backup `prod-pre-import-...sql` (124 KB) →
  `docker compose stop app` → `migrate-db.sh` (auto-yes) → `docker compose up -d
  --build app` → Health-Wait → version.json + Daten-Stichprobe.

**Ergebnis A1 (Health-Gate bestanden):**
| Check | Wert |
|---|---|
| Build | 32,5 s, Image `2a81e04f` |
| App-Health | healthy in 15 s |
| version.json | **2.1.8** (buildTime 2026-07-02T14:29) |
| timeEntries | **170** ✓ (Laptop-Stand) |
| expenses | **195** ✓ (Laptop-Stand) |
| customers | 3 ✓ |
| Crash | keiner |

**Rollback-Netz (stand bereit, nicht gebraucht):**
- Daten: `prod-pre-A1-...sql` + `prod-pre-import-...sql`
- Code: `freeze/nas-A1-start` (dacbda6)
- Image: `protrackr-app:pre-A1-v2.0.4` (35d90e0)

**Offen nach A1:**
- Browser-Endabnahme durch User (Login + neueste Daten sichtbar).
- Nach Bestätigung: Dump-Dateien auf NAS sicher löschen (`shred -u`).
- **Kosmetik:** version.json zeigt `"environment": "development"` statt production
  (generate-version.js Default; beeinflusst Health-Gate nicht, prüft nur `version`).
  → Maintenance-TODO M4.
- Weiter mit A2 (Dev-Stack: compose.dev.yml, .env.dev, Port 3011, Tailscale :9444,
  mysql-dev als Prod-Klon).

---

## 2026-07-02 — Phase A / A1: Browser-Endabnahme + Zeitzonen-Fix + App-Bug-Diagnose

**Browser-Endabnahme (User):**
- Login ✓, Version-Footer 2.1.8 ✓, Zeiteinträge korrekt ✓.
- ⚠️ Reisekosten fielen auf: (a) Datum um 1 Tag verschoben, (b) im Bericht fehlend.
  → zwei getrennte Ursachen (siehe unten).

**Thema 1 — Zeitzonen-Bug (NAS-Infra, gefixt):**
- Symptom: expenses-Datum 01.06 wurde als 31.05 angezeigt; Zeiteinträge korrekt.
- Ursache: `expenses.date` ist `timestamp(mode:"string")`, Werte sind Warschau-
  Mitternacht (= 22:00/23:00 UTC intern). `server/db.ts` formatiert bewusst in
  LOKALER TZ (für Europe/Warsaw gebaut). NAS-Container liefen ohne TZ → UTC →
  TIMESTAMP-Strings einen Tag zu früh. Zeiteinträge waren UTC-Mitternacht, daher
  kein sichtbarer Shift.
- Fix (kein Datenverlust, TIMESTAMP ist intern UTC — nur Konvertierung ändert sich):
  - `TZ: Europe/Warsaw` auf app + mysql Container (Commit `d80ce18`).
  - mysql (Debian) übernahm sofort: `sys_tz` UTC→CEST, expenses-Wert
    `2026-03-01 23:00:00` → `2026-03-02 00:00:00` (verifiziert per SELECT).
  - app-Container (node:22-alpine) blieb UTC — **Alpine hat kein tzdata**.
    Fix: `apk add --no-cache tzdata` im runtime-Stage (Commit `8fb5620`).
- **OFFEN bei Pause:** tzdata-Rebuild (`docker compose up -d --build app`) +
  Verifikation `docker exec protrackr-app date` == CEST noch nicht vom User
  bestätigt. Beim Wiedereinstieg zuerst prüfen.

**Thema 2 — Reisekosten-Attribution im Bericht (App-Code-Bug, NICHT umzugsbedingt):**
- Symptom (nach Juli-Testbelegen mit customerId=278/Sobrietas, timeEntryId=NULL):
  drei Report-Ansichten laufen auseinander:
  | Ansicht | Reisekosten | Status |
  |---|---|---|
  | Kundenbericht-Summary (App-UI) | korrekt (200€/256 PLN) | ✅ |
  | Buchhaltungsbericht "abrechenbar" | leer, rutscht unter "Variable Kosten" | ❌ |
  | PDF-Kostenaufstellung | 0,00 | ❌ |
- Root Cause: `getExpenseBillingCustomerId` (client/src/lib/expenseAttribution.ts)
  berücksichtigt customerId UND timeEntryId — wird aber nicht überall genutzt.
  `client/src/pages/Reports.tsx:1091` filtert die "abrechenbar"-Zeile noch mit
  `if (!expense.timeEntryId) return false` (alte timeEntryId-only-Logik); die
  PDF bekommt entsprechend falsche Daten. Belege mit customerId-Direktzuordnung
  (Option B, ohne timeEntryId) fallen durch.
- Endsumme rechnerisch korrekt (Betrag via travelRevenueInGross im Bruttoumsatz) —
  reiner Kategorisierungs-/Anzeige-Bug.
- **Gehört auf `main`** (App-Code, nicht nas-setup). Task-Chip erstellt:
  `task_bba37780` "Fix Reisekosten-Attribution in Buchhaltung + PDF". Am App-Code
  wurde hier bewusst NICHTS geändert.

**Maintenance-TODO M4 (neu):** version.json zeigt `"environment": "development"`
statt production (generate-version.js Default). Kosmetik, Health-Gate prüft nur
`version`. Siehe Maintenance-TODOs-Sektion.

**Stand bei Pause (Zug):**
- Branch `nas-setup` HEAD `8fb5620`, lokal = origin, Working Tree clean.
- Prod läuft v2.1.8 mit echten Laptop-Daten (170 timeEntries, 195 expenses).
- Rollback-Netz steht: `freeze/nas-A1-start`, `prod-pre-A1-*.sql`,
  `prod-pre-import-*.sql`, Image `protrackr-app:pre-A1-v2.0.4`.
- Dump-Dateien auf NAS noch NICHT gelöscht (warten auf finale Abnahme).

**Wiedereinstieg (Flughafen) — nächste Schritte:**
1. tzdata-Rebuild verifizieren (app-Container date == CEST, Reisekosten-Datum korrekt).
2. A1 final abhaken: Dump-Dateien auf NAS sicher löschen (`shred -u`).
3. Dann A2 (Dev-Stack: compose.dev.yml, .env.dev, Port 3011, Tailscale :9444,
   mysql-dev als Prod-Klon).
4. App-Bug (Thema 2) separat im Main-Chat via task_bba37780.

---

## 2026-07-02 — Phase A / A1: ABGESCHLOSSEN (tzdata verifiziert, Browser-Abnahme)

**tzdata-Rebuild verifiziert:**
- `docker compose up -d --build app` (build-Layer gecached, nur runtime neu mit tzdata).
- Vorher `docker exec protrackr-app date` = UTC → Nachher = **CEST** ✓,
  `TZ env: Europe/Warsaw` ✓, app healthy, version 2.1.8.
- version.json `buildTime` blieb alt (build-Layer gecached) — harmlos, Version stimmt.

**Browser-Abnahme (User):** Reisekosten-Datumsanzeige jetzt korrekt ✓.

**→ Thema 1 (Zeitzone) vollständig erledigt.** Beide Container CEST.

**A1-Status: DONE.**
- Prod v2.1.8 + echte Daten (170 timeEntries, 195 expenses), TZ korrekt,
  erreichbar `https://dcs01.taile370c2.ts.net:9443`.
- Rollback-Netz weiter aktiv (freeze/nas-A1-start, prod-pre-A1-*.sql,
  prod-pre-import-*.sql, Image protrackr-app:pre-A1-v2.0.4) — bewusst behalten
  bis Prod ein paar Tage stabil läuft.
- Migrations-Dumps (protrackr-dump-*) zum Aufräumen freigegeben (redundant nach
  Import); Laptop-Original-Dump vorerst behalten (Re-Import-Quelle).

**Offen (Thema 2, separat):** Reisekosten-Attribution-Bug → Main-Chat,
task_bba37780. Kein nas-setup-Thema.

**Nächste Phase: A2 — Dev-Stack.**

---

# Phase A / A2 — Dev-Stack aufbauen

> **Cleanup-Regel (User, 2026-07-02):** KEIN Löschen von Dump- oder Backup-
> Dateien (weder Migrations-Dumps noch die prod-pre-*-Rollback-Backups), bis der
> GESAMTE Dev/Prod-Umzug abgeschlossen ist UND alle unterwegs identifizierten
> Bugs gelöst sind (u.a. task_bba37780 Reisekosten-Attribution). Bis dahin
> Cleanup nicht vorschlagen.

## 2026-07-02 — Phase A / A2.1: Dev-Stack-Dateien erstellt (Laptop, kein NAS-Kontakt)

**Was (nur Dateien im Branch, ungefährlich):**

1. **`compose.dev.yml`** — vollständig isolierter Dev-Stack neben Prod:
   | Aspekt | Prod (docker-compose.yml) | Dev (compose.dev.yml) |
   |---|---|---|
   | Compose-Projektname | protrackr (default) | **protrackr-dev** (`name:`) |
   | App-Container | protrackr-app | **protrackr-app-dev** |
   | DB-Container | protrackr-mysql | **protrackr-mysql-dev** |
   | Volume | mysql_data | **mysql_data_dev** |
   | Netzwerk | protrackr_net | **protrackr_dev_net** |
   | Host-Port | 3010 | **3011** |
   | Tailscale (geplant) | :9443 | **:9444** |
   - Service heißt bewusst weiter "mysql" → DATABASE_URL strukturgleich, aber im
     dev-Netz aufgelöst auf protrackr-mysql-dev (kein Weg zur Prod-DB).
   - Übernimmt alle Prod-Härtungen: TZ=Europe/Warsaw (app+mysql), LCTN=1,
     Healthchecks, Log-Rotation. NODE_ENV=production (gebaute App servieren).
   - Aufruf immer mit `-f compose.dev.yml`.

2. **`.env.dev.example`** — Template: eigene Secrets (CHANGE_ME_DEV_*, MÜSSEN
   ≠ Prod sein), DATABASE_URL → dev-mysql, Port-Hinweis 3011, TZ, SMTP
   standardmäßig LEER (keine echten Mails aus Test-Umgebung), VITE_APP_TITLE
   "ProTrackr (DEV)" zur optischen Unterscheidung.

3. **`.gitignore`** erweitert: `.env.dev`, `.env.prod`, `.env.production`,
   `.env.staging` ignoriert (Secret-Schutz); `*.example`-Templates bleiben
   tracked. Verifiziert via `git check-ignore`.

**Isolations-Garantie:** Dev kann Prod-DB/Volume/Netz nicht berühren — getrennt
auf allen Ebenen (Projektname, Container, Volume, Netz, Port, Secrets).

**Noch OFFEN — A2.2 (NAS-Deployment, braucht Ruhe, nicht am Flughafen):**
1. Auf NAS: `git pull`, `.env.dev` aus Template anlegen (frische Secrets), Port
   3011 vorab frei prüfen (`ss -tlnp`).
2. `docker compose -f compose.dev.yml up -d mysql` → healthy.
3. **Prod → Dev klonen:** `./scripts/clone-prod-to-dev.sh` (in A2.1b erstellt).
   Richtung fest verdrahtet Prod→Dev, Prod wird nur gelesen, direkter Stream
   ohne Zwischendatei, Verifikation der Row-Counts Prod==Dev.
4. `docker compose -f compose.dev.yml up -d --build app` → healthy, version 2.1.8.
5. Tailscale Serve: `tailscale serve --bg --https=9444 http://localhost:3011`.
6. Test: https://dcs01.taile370c2.ts.net:9444 (Dev, optisch "ProTrackr (DEV)").

## 2026-07-02 — Phase A / A2.1b: Prod→Dev Klon-Skript (`clone-prod-to-dev.sh`)

**Was:** `scripts/clone-prod-to-dev.sh` erstellt (Laptop, ungefährlich; +x im
git-Index; `bash -n` Syntax-Check grün).

**Sicherheits-Design:**
- **Richtung fest verdrahtet** (readonly `PROD_DB_CONTAINER=protrackr-mysql`,
  `DEV_DB_CONTAINER=protrackr-mysql-dev`) — keine Argumente, die man
  vertauschen könnte; harte Assertion Prod≠Dev.
- **Prod nur lesen** (mysqldump), Dev wird ersetzt (Wegwerf-Klon).
- Passwörter aus den Container-internen `$MYSQL_ROOT_PASSWORD` (keine Secrets
  im Skript, keine Prod/Dev-Kollision).
- Direkter Stream Prod→filter→Dev (keine Zwischendatei = keine Produktivdaten
  auf Disk); `--no-tablespaces` + mysqldump-stderr-Filter (Lektionen aus A1).
- 5 Stufen: Container-Health → Bestandsaufnahme → Confirm (`--yes`/`--dry-run`)
  → Klon → Verifikation (Tabellen- + Row-Counts Prod==Dev, sonst Exit 1).

**Nutzung in A2.2:** deckt Schritt 3 (Prod→Dev-Klon) ab und dient später als
periodischer Klon-Job (Cron mit `--yes`).

---

## 2026-07-02 — Phase A / A2.2: Dev-Stack auf NAS deployt

**Ablauf (unter Zeitdruck vor Flug, Dev isoliert → Prod-sicher):**
1. NAS `git pull` → b3bc6ed. Port 3011 frei verifiziert.
2. **`.env.dev` vollautomatisch** erzeugt (4× openssl hex-32 Secrets + 2× DB-PW,
   SMTP leer → kein manuelles Passwort). Keine Platzhalter mehr.
3. `docker compose -f compose.dev.yml up -d mysql` → isoliertes Netz
   `protrackr-dev_protrackr_dev_net`, Volume `protrackr-dev_mysql_data_dev`,
   Container `protrackr-mysql-dev` healthy in 25 s.
4. **Prod→Dev-Klon** via `./scripts/clone-prod-to-dev.sh --yes`: 16 Tabellen,
   "KLON ERFOLGREICH". (Row-Count-Verifikation im Skript zeigte n/a — Backtick-
   Quoting-Bug in der db_query-Funktion, siehe TODO; Klon selbst OK.)
5. `docker compose -f compose.dev.yml up -d --build app` → Image
   `protrackr-dev-app`, app-dev healthy in 15 s, version 2.1.8 auf Port 3011.
   (Compose recreated dabei mysql-dev — Volume bleibt, Daten überleben.)
6. **Prod-Beweis:** Port 3010 lieferte weiter 2.1.8 mit unverändertem buildTime
   14:29 → Dev-Deployment hat Prod NICHT berührt.
7. Tailscale Serve: `tailscale serve --bg --https=9444 http://localhost:3011`.
   `serve status` zeigt beide: 9443 (Prod) + 9444 (Dev).

**Ergebnis A2.2:**
- Dev erreichbar unter `https://dcs01.taile370c2.ts.net:9444` (Prod-Klon-Daten).
- Vollständige Isolation Prod ↔ Dev bestätigt (Container/Volume/Netz/Port).
- Browser-Endabnahme durch User: (bei Sicherung noch offen).

**Kleine TODOs (nicht zeitkritisch, nach dem Umzug):**
- T1: `.env.dev.example` — `VITE_APP_TITLE=ProTrackr (DEV)` braucht Quotes
  (`"ProTrackr (DEV)"`), sonst scheitert `source .env.dev` an den Klammern.
- T2: `scripts/clone-prod-to-dev.sh` — Row-Count-Verifikation nutzt Backticks in
  der verschachtelten `sh -c`-Query → n/a. Auf `docker exec -e MYSQL_PWD` +
  einfache Query umstellen (Klon-Funktion selbst ist korrekt).
- T3: DEV-Label sichtbar machen — `VITE_APP_TITLE` als Docker **build-arg** in
  compose.dev.yml übergeben (`.dockerignore` schließt `.env*` aus Build-Context,
  daher aktuell leer). Erst dann zeigt Dev "ProTrackr (DEV)".

**Cleanup-Regel weiter aktiv:** keine Dump-/Backup-Löschung bis gesamter Umzug
fertig + alle Bugs (task_bba37780 + T1-T3) gelöst.

## 2026-07-02 — Phase A / A2.2b: Login-Bug im Dev-Stack — Ursache + Datei-Fix

**Symptom:** Dev-App (`:9444`) lädt, aber Login mit Prod-Credentials scheitert.

**Root Cause (zwei verkettete Fehler, PROD UNBERÜHRT):**
1. **`--env-file .env.dev` vergessen:** `docker compose -f compose.dev.yml`
   liest per Default die `.env` (= PROD-Werte!) für `${VAR}`-Interpolation, nicht
   `.env.dev`. → mysql-dev-Volume wurde beim ersten Init mit **Prod-DB-
   Passwörtern** angelegt.
2. **Shell-Verschmutzung:** Der frühere `set -a; source .env.dev`-Daten-Check
   scheiterte an `VITE_APP_TITLE=ProTrackr (DEV)` (unquotete Klammern =
   bash-Syntaxfehler), hatte aber vorher via `set -a` die **Dev-Werte** in die
   Shell exportiert. Der folgende `up --build app` nahm diese Shell-Dev-Werte
   → app-dev bekam Dev-DATABASE_URL.
   → Ergebnis: app-dev (Dev-PW) ↔ mysql-dev-Volume (Prod-PW) = Mismatch →
   keine DB-Verbindung → Login scheitert. (Bestätigt durch Access-denied bei
   `docker exec … root`.)

**Datei-Fix (Commit siehe unten) — behebt beide Wurzeln dauerhaft:**
- `compose.dev.yml`: beide Services bekommen `env_file: [.env.dev]`. Damit
  kommen ALLE variablen Werte fest aus `.env.dev`, unabhängig von `--env-file`
  oder Shell-Variablen. Kein `${VAR}`-Interpolations-Fallback auf Prod-`.env`
  mehr.
- `.env.dev.example`: `VITE_APP_TITLE="ProTrackr (DEV)"` (gequotet) → kein
  source-Syntaxfehler mehr (deckt T1 ab).

**Wiedereinstieg — Dev sauber neu aufsetzen (Dev ist Wegwerf, Prod bleibt):**
```bash
cd /mnt/user/appdata/protrackr
git fetch origin && git reset --hard origin/nas-setup   # gefixtes compose.dev.yml
# WICHTIG: neues/frisches Web-Terminal ODER `exec bash` — verschmutzte
#          Shell-Variablen (MYSQL_ROOT_PASSWORD etc.) loswerden.
docker compose -f compose.dev.yml down -v                # nur Dev-Volume weg
docker compose -f compose.dev.yml up -d mysql            # jetzt .env.dev-Creds
#   auf healthy warten, dann:
./scripts/clone-prod-to-dev.sh --yes                     # Prod -> Dev Klon
docker compose -f compose.dev.yml up -d --build app      # app-dev, gleiche Creds
#   Test: https://dcs01.taile370c2.ts.net:9444  (Login mit Prod-Credentials)
```
`down -v` betrifft nur den `protrackr-dev`-Stack (eigenes Volume/Netz) — Prod
(`protrackr`-Projekt, `mysql_data`) bleibt unberührt. Die bestehende `.env.dev`
auf dem NAS wird weiterverwendet (Credentials in sich konsistent); mit env_file
ziehen jetzt app-dev UND mysql-dev dieselben Werte.

**PROD-Status:** unverändert erreichbar auf `:9443`, buildTime 14:29 — der
gesamte Dev-Fehler war vollständig isoliert.

## 2026-07-02 — Phase A / A2.2c: Dev-Stack Neuaufsatz erfolgreich

**Zusätzlicher Fix vorab:** Dev-mysql-Healthcheck nutzte `-p${MYSQL_ROOT_PASSWORD}`
(Compose-Interpolation aus Prod-.env). Auf `CMD-SHELL` + `$$MYSQL_ROOT_PASSWORD`
umgestellt (Container-Laufzeit-Eval aus env_file) — Commit `1e66f45`. Sonst wäre
mysql-dev nie healthy geworden.

**Neuaufsatz (frisches Terminal + `unset` verschmutzter Shell-Vars):**
1. `git reset --hard origin/nas-setup` → 1e66f45 (env_file + Healthcheck-Fix).
2. `docker compose -f compose.dev.yml down -v` → alter Dev-Stack + Volume weg
   (nur `protrackr-dev`-Projekt; Prod `protrackr` unberührt).
3. `up -d mysql` → mysql-dev **healthy in 25 s** (Healthcheck greift jetzt).
4. **Root-Test `SELECT 1` → `1`** = Passwort-Konsistenz bewiesen (env_file).
5. `clone-prod-to-dev.sh --yes` → 16 Tabellen.
6. Daten-Verifikation (Container-PW): **users 2, timeEntries 170, expenses 197**
   (197 = 195 + 2 Juli-Sobrietas-Testbelege, konsistent mit Prod).
7. `up -d --build --no-deps app` → app-dev healthy in 15 s, **keine DB-Fehler**
   in Logs (nur IPv6-Warnings = M2).
8. version.json: Dev 3011 = 2.1.8; **Prod 3010 = 2.1.8, buildTime 14:29
   unverändert** → Prod über das gesamte Dev-Chaos hinweg isoliert.

**Lessons Learned (für spätere main-seitige Compose-Konsolidierung):**
- Zwei-Umgebungen-Compose braucht `env_file:` je Service (nicht nur
  `${VAR}`-Interpolation), sonst greift die Default-`.env` (Prod).
- Healthchecks mit Passwörtern: `CMD-SHELL` + `$$VAR`, nie `${VAR}`.
- `set -a; source .env.dev` in der interaktiven Shell vermeiden (verschmutzt
  Umgebung + bricht an ungequoteten Werten). env_file macht source überflüssig.

**Status:** A2.2 ABGESCHLOSSEN — **Browser-Login in Dev abgenommen ✓**.
Dev erreichbar `https://dcs01.taile370c2.ts.net:9444` (Prod-Klon).
**→ Phase A2 komplett fertig. Prod + Dev laufen isoliert nebeneinander.**

**Verbleibende TODOs:** T2 (clone-Skript Row-Count-Anzeige n/a, kosmetisch),
T3 (VITE_APP_TITLE build-arg für sichtbares DEV-Label), M1/M2/M4, task_bba37780.

---

## 2026-07-02 — GOVERNANCE-Regel: PROD nur via Dev→Prod-Promotion

**User-Anweisung (verbindlich):** Keine direkten Änderungen an PROD. Jede
Änderung (Code/Image, Schema, Daten) geht zwingend DEV → Test → Freigabe →
Promotion → PROD. Direkte Prod-Eingriffe sind gesperrt; angefragte
Prod-Änderungen werden auf DEV umgeleitet und der User wird informiert.

**Drei Durchsetzungs-Ebenen (ehrlich):**
1. **Claude-Verhalten (ab sofort 100%):** Memory-Regel
   `feedback_prod_only_via_dev_promotion`. Jede Prod-Änderungsanfrage → in DEV
   umsetzen + User informieren; kein direkter Prod-Deploy außer autorisierter
   Promotion.
2. **Technische Guards (A4-Umsetzung):** `scripts/deploy-prod.sh` als einziger
   legitimer Prod-Deploy-Weg mit Promotion-Gate (nur in Dev getestete Images);
   direkte `docker compose -f docker-compose.yml up/build` abfangen → Stopp +
   Hinweis + optionale SMTP-Benachrichtigung.
3. **Ehrliche Grenze:** root auf dem NAS ist technisch nicht 100% sperrbar —
   Guards machen Direkteingriffe unwahrscheinlich + sichtbar, nicht unmöglich.

**Success Criteria für Promotion Dev→Prod (alle Pflicht):**
1. `tsc --noEmit` + `vitest run` grün · 2. Dev deployt, app+mysql healthy ·
3. Health-Gate `:9444/version.json` + keine DB-Fehler · 4. Manuelle
Funktionsabnahme in DEV durch User · 5. kein offener kritischer Bug ·
6. Prod-Backup vor Promotion · 7. explizite User-Freigabe.
Dann: Image-Promotion (bit-identisch) + Prod-Restart + Health-Gate +
Auto-Rollback.

**Umsetzung der technischen Guards = Teil von A4.**

---

# Phase A / A3 — Dev-Loop

## 2026-07-02 — Phase A / A3: Dev-Loop etabliert (Modell 1)

**Git-Modell-Entscheidung (User):** **Modell 1** — `nas-setup` bleibt
Deploy-Branch, Infra getrennt von `main`. Dev-Loop = `main → nas-setup` mergen
(Claude-gesteuert) → NAS `deploy-dev.sh`. Modell 2 (Infra nach main) bleibt
späteres Blueprint-Endziel.

**Erstellt (Laptop, kein NAS-Kontakt):**
- **`scripts/deploy-dev.sh`** — deployt `origin/nas-setup` auf Dev: fetch +
  reset, rebuild `app-dev` (`--no-deps`, mysql-dev unangetastet), Health-Gate
  gegen `:9444/version.json` (Version == package.json). Nutzt **ausschließlich
  `compose.dev.yml`** → Prod strukturell unberührt. `bash -n` grün, +x im Index.
- **`docs/DEV-LOOP.md`** — Alltags-Workflow: edit main → tsc/vitest → push main
  → (Claude) merge main→nas-setup → `deploy-dev.sh` → in Dev testen → Freigabe
  → Promotion (A4). Inkl. Merksätze (`-f compose.dev.yml`, kein `source`,
  Governance PROD-nie-direkt).

**Merge-Teil bewusst NICHT skriptet:** Merges können Konflikte haben →
Claude-gesteuert mit Trockenlauf (`merge --no-commit --no-ff`) + Leitplanken
(Versionsdatei-Konflikte auto, echte Konflikte STOPP), nie `nas-setup → main`.

**Status:** Werkzeug steht. Aktuell nichts Neues zu deployen (main = v2.1.8 =
Dev/Prod-Stand). Erster echter Einsatz beim nächsten main-Update (z.B.
Reisekosten-Fix task_bba37780 → main → Dev testen → Promotion).

**Getestet ✓ (2026-07-02):** `deploy-dev.sh` idempotenter Rebuild auf NAS
durchgelaufen — [1/5]..[5/5] grün, app-dev healthy in 15 s, Health-Gate
`version.json "2.1.8"`, „DEV-DEPLOY OK". Prod (`:9443`) unberührt. **A3 fertig.**

---

# Phase A / A4 — Image-Promotion Dev→Prod + Prod-Guards (folgt)

# Phase 6 / A5 — Notebook-Server abschalten / Switchover (folgt)
