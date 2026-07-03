# HANDOVER — ProTrackr NAS-Umzug (Sitzungs-Übergabe)

> **Zweck:** Vollständiger, self-contained Wiedereinstiegspunkt. Wer dieses
> Dokument + die Memory-Dateien liest, hat den kompletten Stand ohne Verluste.
> **Stand:** 2026-07-03 (2. Update, A5-Vorbereitung) · **Branch:** `nas-setup` (HEAD nach diesem Doku-Commit) · **Phase A zu ~95 %**
> **Nächster Schritt:** A5 (localhost abschalten) — **Entscheidungen getroffen, Ausführung in neuer Sitzung** (Plan in §6). Dieses Handover ist der Wiedereinstiegspunkt.

---

## 0. SOFORT-EINSTIEG (TL;DR)

ProTrackr wurde vom Laptop-`localhost` auf einen **Unraid-NAS (DCS01)** umgezogen,
in **zwei isolierte Umgebungen**: **PROD** (echte Daten) + **DEV** (Prod-Klon),
mit **bit-identischer Image-Promotion** Dev→Prod und einer **Governance-Regel**
(keine direkten Prod-Änderungen, aktiv per Mail überwacht). A1–A4 sind fertig
und live getestet. Es fehlt nur **A5** (den alten localhost-Server abschalten) —
dessen Entscheidungen + Ausführungsplan stehen jetzt in §6; die Ausführung läuft
in einer **frischen Sitzung** (diese hier stieß ans Context-Limit).

**Alles läuft, alles ist committet + auf GitHub, Prod ist geschützt + überwacht.**

---

## 1. WIEDEREINSTIEGS-PROZEDUR (in der neuen Sitzung zuerst)

1. **Memory ist automatisch geladen** — beachte besonders:
   `feedback_nas_umzug_branch`, `feedback_prod_only_via_dev_promotion`,
   `feedback_worktree_separation`, `project_two_env_server_architecture`,
   `project_open_fix_expense_attribution_main`.
2. **Dieses Handover + `NAS_SETUP_HISTORY.md` lesen** (HISTORY = volle Chronik).
3. **Branch verifizieren (Laptop):**
   ```
   cd C:\Projects\ProTrackr_developing_path
   git branch --show-current      # MUSS nas-setup sein
   git fetch origin && git status -sb
   ```
4. **NAS-Live-Stand verifizieren (Unraid Web-Terminal):**
   ```
   cd /mnt/user/appdata/protrackr
   docker compose ps                         # PROD: protrackr-app + -mysql (healthy)
   docker compose -f compose.dev.yml ps      # DEV:  protrackr-app-dev + -mysql-dev
   pgrep -f guard-prod-watch.sh               # Guard laeuft? (2 PIDs = 1 Baum, ok)
   curl -s http://localhost:3010/version.json # PROD 2.1.8
   curl -s http://localhost:3011/version.json # DEV  2.1.8
   ```

---

## 2. PROJEKT-KONTEXT

- **App:** ProTrackr (DÖRING Consulting) — Single-User Zeiterfassung/Reisekosten/
  Steuer(PL)/Rechnungen. React+Vite / tRPC+Express (ESM via esbuild) / MySQL+Drizzle.
- **NAS:** AOOSTAR WTR MAX 8845 (Ryzen 7 8845HS, x86_64), **Unraid 7.3.1**,
  Docker 29.3.1, Tailscale-Plugin. Hostname **DCS01**, Tailnet
  `dcs01.taile370c2.ts.net` (Tailscale-IP 100.108.232.64).
- **Compose-Verzeichnis auf NAS:** `/mnt/user/appdata/protrackr` (Klon von
  `nas-setup`).
- **Verwechslungs-Warnung:** Mandant **`dc001`** (App-intern) ≠ NAS-Hostname
  **`DCS01`**.

---

## 3. AKTUELLER LIVE-STAND (NAS)

| | **PROD** | **DEV** |
|---|---|---|
| URL | `https://dcs01.taile370c2.ts.net:9443` | `https://dcs01.taile370c2.ts.net:9444` |
| Host-Port → Container | 3010 → 3000 | 3011 → 3000 |
| Compose-Datei | `docker-compose.yml` | `compose.dev.yml` |
| Compose-Projekt | `protrackr` (default) | `protrackr-dev` (`name:`) |
| App-Container | `protrackr-app` | `protrackr-app-dev` |
| DB-Container | `protrackr-mysql` | `protrackr-mysql-dev` |
| Image | `protrackr-app:latest` | `protrackr-dev-app:latest` |
| Volume | `protrackr_mysql_data` | `protrackr-dev_mysql_data_dev` |
| Netzwerk | `protrackr_net` | `protrackr-dev_protrackr_dev_net` |
| Env-Datei (gitignored) | `.env` | `.env.dev` |
| Version | **v2.1.8** | **v2.1.8** |
| Daten | echt: 3 Mandanten, 2 User, 3 Kunden, ~170 Zeit, ~197 Reisekosten | Prod-Klon |

- **Tailscale Serve:** `:9443 → localhost:3010` (Prod), `:9444 → localhost:3011`
  (Dev). Persistenz-Hinweis: `tailscale serve --bg` — bei Reboot ggf. prüfen
  (bisher nicht als User-Script hinterlegt → **potenziell offener Punkt**).
- **Beide Container TZ=Europe/Warsaw** (app via tzdata im Image, mysql via SYSTEM-TZ).
- **MySQL `lower_case_table_names=1`** (Windows-Dump-Kompatibilität, nur bei Init).
- **Guard läuft** (`guard-prod-watch.sh`), reboot-fest via User-Script
  `protrackr-prod-guard` (Schedule „At Startup of Array").
- **Unraid-Notification-Mail:** auf hoste.pl umgestellt, Empfänger
  **a.doering@doering-consulting.eu** (Test-Mails kamen an).

---

## 4. WAS ERREICHT WURDE (Phase 0 → A4)

- **Phase 0** — Klärung: Hardware/OS, Tailscale, Ports (9443 Prod, 9444 Dev;
  3010/3011 Host), SMTP hoste.pl, Workflow „Web-Terminal-Mikro-Loop".
- **Phase 1** — Container-Dateien: Dockerfile, .dockerignore, docker-compose.yml,
  .env.production.example, README, Unraid-Doku, migrate-db-Skripte.
- **Phase 2** — DB-Dump vom Laptop.
- **Phase 3** — NAS-Vorbereitung: Compose-Manager-Plugin, Repo-Clone, Secrets,
  Build, mysql healthy. (Bugfix: Husky/`--ignore-scripts`.)
- **Phase 4 (Erst-Deploy)** — Import, LCTN=1-Fix, Vite-Static-Import-Fix
  (node_modules aus build-Stage), Port-Konflikt 3000→3010 (Obsidian), App live,
  Tailscale Serve, **Zeitzonen-Fix** (TZ + tzdata).
- **A1** — Prod scharfgestellt: Merge main→nas-setup (**v2.1.8**), echte
  Laptop-Daten importiert, TZ korrekt, Browser-Abnahme ✓.
- **A2** — Dev-Stack aufgebaut (isoliert) + Prod-Klon. **3 Konfig-Bugs gefixt:**
  (a) `env_file:` statt `${VAR}` (Compose las Prod-.env), (b) Healthcheck
  `CMD-SHELL`+`$$VAR`, (c) VITE_APP_TITLE gequotet. Login abgenommen ✓.
- **A3** — Dev-Loop `deploy-dev.sh` + `docs/DEV-LOOP.md` (Git-Modell 1). Getestet ✓.
- **A4** — Promotion `deploy-prod.sh` (bit-identisch) + **Governance-Guards**:
  passiv (Compose-Header-Warnung) + aktiv (`guard-prod-watch.sh` → Dashboard +
  Mail). Alarm live getestet ✓, reboot-fest ✓. (Bugfix: docker events `.Action`.)

---

## 5. ARTEFAKTE (nas-setup-eigene Dateien, nicht auf main)

**Infra:** `Dockerfile` · `.dockerignore` · `docker-compose.yml` (PROD, mit
Governance-Header + `image:`) · `compose.dev.yml` (DEV, `env_file:`, `image:`) ·
`.env.production.example` · `.env.dev.example`

**Skripte (`scripts/`):**
- `migrate-db.ps1` — Laptop-DB-Dump (PowerShell). *Bekannt: mysqldump-Warnung
  ohne `--no-tablespaces`; Filter beim Import deckt es ab.*
- `migrate-db.sh` — Dump-Import in Container (stderr-Filter, LCTN-tauglich).
- `clone-prod-to-dev.sh` — Prod→Dev-Klon (Richtung fest verdrahtet).
  *TODO T2: Row-Count-Verifikation zeigt n/a (Backtick-Quoting), Klon selbst ok.*
- `deploy-dev.sh` — Dev-Deploy (fetch+reset, rebuild app-dev, Health-Gate).
- `deploy-prod.sh` — **Promotion Dev→Prod** (Success-Gate `PROMOTE`, Backup,
  Rollback-Tag, `docker tag` bit-identisch, `--no-build`, Health-Gate,
  Auto-Rollback; setzt Guard-Marker).
- `guard-prod-watch.sh` — Docker-Event-Watcher → `notify` bei direktem Eingriff.

**Doku:** `NAS_SETUP_HISTORY.md` (volle Chronik) · `NAS_SETUP_README.md` ·
`docs/DEV-LOOP.md` · dieses `HANDOVER-NAS-SETUP.md`.

**Tags:** `freeze/nas-A1-start` (Rollback-Punkt vor A1) · `v2.1.1-cleanup`.

**Nicht im Git (NAS-lokal):** `.env`, `.env.dev` (Secrets), `db-migration/*.sql*`
(Prod-Backups + Dumps), `/var/log/protrackr-guard.log`,
`/boot/config/plugins/user.scripts/scripts/protrackr-prod-guard/` (Autostart),
Rollback-Image-Tags `protrackr-app:rollback-*` (falls Promotions liefen).

---

## 6. OFFENE PUNKTE

### A5 — localhost abschalten (Entscheidungen getroffen, Ausführung in neuer Sitzung)

**Entscheidungen (2026-07-03, User):**
- **Timing:** jetzt — unabhängig von `task_bba37780`.
- **Umfang:** komplett aus. localhost:3001 wird NICHT mehr für main-Tests gebraucht;
  der NAS (Prod :9443 / Dev :9444) ist ab sofort die einzige laufende Instanz.
- **Notebook-MySQL:** auch stoppen, StartType `Automatic → Manual` (Daten +
  Re-Import-Quelle bleiben; Cleanup-Regel gewahrt).
- **Hook-Entschärfung:** via **Main-Chat** (Option 1) — main-Welt-Trennung strikt gewahrt.

**Befund der Bestandsaufnahme (2026-07-03, read-only, Laptop):**
- localhost:3001-Server läuft **bereits nicht** (kein Port-3001-Listener, keine
  node-Prozesse, curl refused).
- **KEIN** Windows-Autostart: keine Scheduled Tasks „protrackr", nichts im
  Startup-Ordner (User+Common), keine Registry Run-Keys (HKCU+HKLM).
- Service **`MySQL84`**: Running, StartType **Automatic**.
- **Einzige Server-Wiederbelebungs-Quelle:** `.husky/post-commit` (aktuell Zeilen
  110–123, gated auf `main`) → ruft `protrackr.ps1 Restart` beim nächsten
  qualifizierenden main-Commit. Ohne Hook-Fix käme der Server beim nächsten
  main-Commit zurück.
- `C:\Projects\ProTrackr_main` existiert (Branch `main`) = main-Worktree des Main-Chats.

**A5-Ausführungsplan (neue Sitzung):**

1. **MySQL84 stoppen + Manual** (Laptop, Admin-PowerShell nötig):
   `Stop-Service MySQL84` → `Set-Service MySQL84 -StartupType Manual` →
   `Get-Service MySQL84 | Select-Object Name,Status,StartType` (erwartet: Stopped / Manual).

2. **Hook-Restart-Block entfernen — im MAIN-CHAT auf `main`** (NICHT nas-setup!):
   In `.husky/post-commit` den **letzten Block** löschen (aktuell Z. 110–123),
   beginnend beim Kommentar `# Restart the local production server …` bis
   einschließlich des `fi`. Es ist der Block `if [ -f "protrackr.ps1" ]; then …
   powershell.exe … 'protrackr.ps1','Restart' … & ; disown … ; fi`.
   **Auto-Version-Bump + Production-Build + Amend (Z. ~65–108) bleiben unangetastet.**
   Commit-Vorschlag auf main:
   `chore: retire localhost:3001 auto-restart from post-commit (NAS is sole instance)`.
   (Auto-Bump greift auf main = patch, harmlos; ggf. Hash-Drift wie üblich.)

3. **Verifikation:**
   - Nach Schritt 2 ein Test-Commit auf main → Port 3001 bleibt frei (kein Node-Start).
   - Optional Reboot-Test: nach Windows-Neustart läuft weder `MySQL84` noch ein
     ProTrackr-node-Prozess.

4. **Doku + Memory nachziehen:**
   - HISTORY „A5 DONE"-Eintrag, dieses Handover aktualisieren.
   - Memory `feedback_deploy_workflow` anpassen: der „restart auf localhost:3001"-
     Schritt entfällt. Neuer Main-Test-Weg festlegen (ad-hoc `npm run dev` lokal
     ODER gegen NAS-Dev :9444) — **Main-Chat-Abstimmung nötig** (Welt-Trennung).

**Wichtige Folge:** `feedback_deploy_workflow` wird durch A5 obsolet. Der Main-Chat
testet main-Änderungen dann nicht mehr gegen localhost:3001 — der neue Test-Weg
gehört in die A5-Abschluss-Doku + eine kurze Main-Chat-Abstimmung.

### Weitere offene Punkte / TODOs
- **Tailscale-Serve-Reboot-Persistenz** prüfen (evtl. User-Script wie beim Guard).
- **task_bba37780** — Reisekosten-Attribution-Bug (Buchhaltungsbericht + PDF
  nutzen `timeEntryId`-only statt `getExpenseBillingCustomerId`,
  `client/src/pages/Reports.tsx:1091`). **Gehört auf `main`** (App-Code), NICHT
  nas-setup. Siehe Memory `project_open_fix_expense_attribution_main`.
- **T2** clone-Skript Row-Count-Anzeige · **T3** VITE_APP_TITLE als build-arg
  (sichtbares DEV-Label) · **M1** MemoryStore→MySQL-Session · **M2** IPv6
  Rate-Limit-Key · **M4** version.json `environment:development` (kosmetisch).
  (Details in `NAS_SETUP_HISTORY.md` Maintenance-Sektion.)

### Cleanup-Regel (User, verbindlich)
KEINE Löschung von Dump-/Backup-Dateien (Migrations-Dumps + `prod-pre-*`) bis der
GESAMTE Umzug fertig UND alle Bugs (task_bba37780, T-Punkte) gelöst sind.

---

## 7. GOVERNANCE-REGEL (verbindlich, siehe Memory)

**PROD-Änderungen ausschließlich via Dev→Prod-Promotion.** Umgesetzt auf 3 Ebenen:
1. **Claude-Verhalten (immer):** jede Prod-Änderungsanfrage → in DEV umsetzen +
   User informieren; kein direkter Prod-Deploy außer autorisierter Promotion.
2. **Technisch:** `deploy-prod.sh` = einziger Weg (Success-Gate, Backup,
   Auto-Rollback); passiver Guard (Compose-Warnung); aktiver Guard (Watcher+Mail).
3. **Ehrliche Grenze:** root kann nicht 100 % gesperrt werden — Guards machen
   Eingriffe **sichtbar** (Alarm), nicht unmöglich.

**Success Criteria für Promotion:** tsc+vitest grün · Dev deployt+healthy ·
Health-Gate+keine DB-Fehler · manuelle Funktionsabnahme in Dev · kein kritischer
Bug · Prod-Backup (macht Skript) · explizite Freigabe (`PROMOTE`).

---

## 8. BEZUG ZUR MAIN-SITZUNG (wichtig!)

- **Zwei getrennte Welten:** `main` = App-Code/Entwicklungslinie (eigener Chat,
  eigener Klon). `nas-setup` = Deploy/Infra (dieser Chat, `developing_path`).
  **NIEMALS `nas-setup → main` mergen ohne explizite User-Freigabe** nach
  Risiko-Aufklärung. `main → nas-setup` ist erlaubt (Sync), aber kontrolliert.
- **Stand:** `origin/main` = `e8ebc1d` (**v2.1.8**). `nas-setup` basiert darauf
  (A1.3-Merge) + hat die NAS-Infra obendrauf. **main hat aktuell nichts Neues**
  gegenüber dem, was auf Dev/Prod läuft.
- **Sync-Modell (A3, „Modell 1"):** Neuer main-Code kommt so auf den NAS:
  `main → nas-setup` mergen (Claude-gesteuert, Trockenlauf + Leitplanken:
  Versionsdatei-Konflikte auto, echte Konflikte STOPP) → push → NAS
  `deploy-dev.sh` → in Dev testen → nach Freigabe `deploy-prod.sh`.
- **Offener App-Bug gehört auf main:** `task_bba37780` (Reisekosten). Wenn der
  Main-Chat ihn fixt → neuer main-Stand → über den Dev-Loop nach Dev, dann
  Promotion nach Prod. Memory `project_open_fix_expense_attribution_main` hält
  den main-seitigen Kontext.
- **Der Laptop-`localhost` gehört zur main-Welt** (A5 berührt sie → Sorgfalt).

---

## 9. LESSONS LEARNED (technische Fallstricke — für künftige Deploys)

1. **Compose Zwei-Umgebungen:** `${VAR}`-Interpolation nimmt Default-`.env`
   (= Prod!). Dev braucht `env_file: [.env.dev]` je Service. Healthcheck-
   Passwort: `CMD-SHELL` + `"$$VAR"` (nicht `${VAR}`).
2. **Docker 29.x events:** `--format '{{.Action}}'` (nicht `.Status`).
3. **Alpine Node-Image:** kein tzdata → `TZ` wirkt nicht → `apk add tzdata`.
   MySQL-TIMESTAMP-Anzeige folgt der Container-SYSTEM-TZ.
4. **Windows→Linux MySQL:** Dump hat lowercase-Tabellen → `--lower-case-table-
   names=1` (nur bei Init; sonst Volume neu + re-import).
5. **mysqldump stderr** landet sonst als Zeile 1 im Dump → Import ERROR 1064;
   `--no-tablespaces` + `grep -v '^mysqldump:'` beim Import.
6. **Vite static import** in `server/_core/vite.ts` → Prod braucht vite im Image
   → node_modules aus `build`-Stage kopiert (Image ~+200 MB; T3/M3-Kandidat).
7. **Port-Konflikte auf DCS01:** 3000-3001 Obsidian, 8080 Open-WebUI, 8443
   Nextcloud, 443 Unraid, 3306 MariaDB-Official (öffentlich; unser mysql intern).
   Freie: 3011 (Dev), 9444 (Tailscale Dev).
8. **Shell-Hygiene:** kein `source .env.dev` in der interaktiven Shell
   (verschmutzt Umgebung, bricht an Klammern) — env_file macht es überflüssig.
9. **git pull auf NAS:** wegen chmod-Mode-Drift `git fetch && git reset --hard
   origin/nas-setup` nutzen; +x der Skripte ist im Index gesetzt.
10. **Hook-Gate:** post-commit-Bump/Build/Restart läuft NUR auf `main`; auf
    `nas-setup` nur Tests (kein Version-Bump, kein Server-Hijack).

---

## 10. WICHTIGE ROLLBACK-/SICHERHEITSPUNKTE

- Code-Rollback vor A1: Tag `freeze/nas-A1-start`.
- Prod-DB-Backups: `db-migration/prod-pre-A1-*.sql`,
  `prod-pre-import-*.sql` (NAS-lokal, bleiben laut Cleanup-Regel).
- Prod-Image-Rollback: `deploy-prod.sh` legt vor jeder Promotion
  `protrackr-app:rollback-<ts>` an + rollt bei Health-Gate-Fehler automatisch.
- Dev ist Wegwerf: `docker compose -f compose.dev.yml down -v` +
  `clone-prod-to-dev.sh --yes` stellt ihn jederzeit neu her (Prod unberührt).

---

*Ende Handover. Volle Details: `NAS_SETUP_HISTORY.md`. Regeln: Memory-Dateien.*
