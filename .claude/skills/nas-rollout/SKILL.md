---
name: nas-rollout
description: Rollt eine freigegebene Release (via Rollout-Manifest) kontrolliert auf EINE der zwei Server-Umgebungen (dev | prod) aus — Ziel-Config aus manifest.environments, DB-Backup, Migrationen, Deploy, Health-Gate, Auto-Rollback. NUR im NAS-Setup-Chat verwenden, niemals im Main-Chat.
---

# NAS-Rollout

Führt einen **einseitigen, geprüften Rollout** einer main-Release auf den NAS aus.
Die Übergabe von main kommt als **Manifest** (`.claude/rollouts/<version>.json`),
das main erzeugt hat. Dieser Skill liest das Manifest und führt den Deploy
stufenweise aus — mit Bestätigung vor jedem zerstörerischen Schritt.

## Wann verwenden
- **Nur im NAS-Setup-Chat** (dort, wo die NAS-Container verwaltet werden).
- NIEMALS im Main-Chat aufrufen (dort gilt Main-Only; NAS-Arbeit ist isoliert).
- Voraussetzung: NAS online, Repo-Clone mit Docker-Zugriff auf den NAS, ein
  Manifest existiert und ist reviewed.

## Die 5 harten Leitplanken (nie brechen)
1. **Merge-Richtung ist einseitig:** ausschließlich `main → nas-setup`. Niemals
   `nas-setup → main` (das braucht separate, explizite Freigabe im Main-Chat).
2. **Versionsdatei-Konflikte automatisch zu main auflösen** (`--theirs`), keine
   anderen Konflikte automatisch — bei App-Konflikten abbrechen und melden.
3. **DB-Backup VOR jeder Migration.** Kein Migrate ohne verifiziertes Backup.
4. **Health-Gate + Auto-Rollback:** Nach dem Deploy muss die Zielversion
   antworten, sonst automatischer Rollback (Merge + Image + DB).
5. **Dev und Prod strikt trennen:** ein Dev-Deploy fasst NIE den Prod-Stack/-DB
   an und umgekehrt; DB-Klon-Richtung ist immer nur Prod → Dev.

## Ziel-Umgebung wählen (dev | prod)
Der Rollout zielt auf **eine** von zwei Server-Umgebungen (siehe
`docs/DEPLOYMENT-BLUEPRINT.md`). Die Zielkonfiguration steht im Manifest unter
`environments.<env>` (`composeFile`, `envFile`, `appContainer`, `dbContainer`,
`hostPort`, `healthUrl`):
- **dev** — Entwicklung/Test, DB = Prod-Klon. Normaler Fluss nach jedem reifen
  main-Stand.
- **prod** — produktiv, echte Daten (`requireExtraConfirm: true` → zusätzliche
  ausdrückliche Freigabe). Bevorzugt **Image-Promotion**: das auf dev getestete
  Image unverändert deployen (kein Rebuild).
Alle folgenden Stufen verwenden die Werte der GEWÄHLTEN Umgebung. Die genaue
Git-/Promotion-Mechanik pro Umgebung wird in Phase A finalisiert.

## NAS-individuelle Einstellungen (schützen — NIEMALS überschreiben)
Diese Werte existieren NUR auf dem NAS. Der Merge fasst sie ohnehin nicht an
(alle gitignored oder NAS-only) — trotzdem vor dem Deploy verifizieren:

- **`.env` / `.env.production` (gitignored, NICHT im Merge)** — die eigentliche
  NAS-Konfiguration:
  - *Runtime* (docker-compose liest via `${VAR}`): `DATABASE_URL` zeigt auf den
    **mysql-Container** (`…@mysql:3306/protrackr`, NICHT localhost), `PORT=3000`,
    `SESSION_SECRET`/`JWT_SECRET`/`SCHEDULER_API_KEY`/`CRON_SECRET`,
    `SESSION_COOKIE_SECURE=true`, `SMTP_*`, `MYSQL_*`.
  - *Build-Zeit* `VITE_*`: werden beim `vite build` in den Client gebacken.
    **ACHTUNG:** `.dockerignore` schließt `.env*` aus dem Build-Context aus → im
    Container-Build sind `VITE_*` standardmäßig LEER, außer sie werden als
    Build-`args` übergeben. Wird künftig ein `VITE_*`-Wert auf dem NAS gebraucht,
    das VOR dem Build sicherstellen. (Der App-Titel läuft seit §6.4 NICHT mehr über
    ein `VITE_*`-build-arg, sondern zur Laufzeit über `APP_ENV_LABEL` — siehe compose.)
- **NAS-only-Dateien (nur auf nas-setup — Merge lässt sie unberührt):**
  `docker-compose.yml` (Ports **3010→3000**, Volume `mysql_data`, Healthcheck,
  Tailscale-Reverse-Proxy `:9443`), `Dockerfile`, `.dockerignore`,
  `scripts/migrate-db.*`, NAS-Docs.
- **DB liegt im Container `protrackr-mysql`** — Backup & Migrationen laufen gegen
  diese Container-DB, nie gegen die lokale Notebook-DB.

Fasst der Merge wider Erwarten eine dieser Dateien an → STOPP, im Main-Chat
klären (Leitplanke 2).

## Ablauf (stufenweise, mit Bestätigung)

### Stufe 0 — Manifest lesen, Umgebung wählen & vorlegen
- Lies `.claude/rollouts/<version>.json` (oder den vom User genannten Pfad).
- **Ziel-Umgebung festlegen:** `dev` oder `prod`; lade `environments.<env>`.
  Bei `prod` (`requireExtraConfirm`): zusätzliche ausdrückliche Freigabe einholen.
- Fasse dem User zusammen: Version, **Ziel-Umgebung**, `source.commit`, Anzahl
  neuer Migrationen, `breaking`, `notes`. **Bei `breaking.value = true`:
  ausdrücklich warnen.** Bestätigung abwarten.

### Stufe 1 — Preflight
- `git fetch origin`.
- Sicherstellen: aktueller Branch ist `nas-setup`, Working Tree sauber
  (`git status --porcelain` leer). Sonst stoppen.
- `source.commit` muss lokal vorhanden sein (`git cat-file -e <commit>^{commit}`).
- **Notiere den Pre-Merge-SHA** von nas-setup (`git rev-parse HEAD`) — für Rollback.
- **NAS-Config prüfen (nicht raten):** `.env`/`.env.production` existiert und ist
  vollständig — Schlüssel gegen `.env.production.example` abgleichen, fehlende
  Keys = STOPP. NAS-only-Dateien (`docker-compose.yml`, `Dockerfile`) vorhanden.
- Manifest-Feld `nas.sharedConfigChanged` prüfen: bringt die Release Änderungen
  an geteilten Config-/Dependency-Dateien (env.ts, vite/drizzle/tsconfig,
  package.json-Scripts, pnpm-lock)? Falls ja → auf NAS-Kompatibilität sichten.

### Stufe 2 — Merge (Git-Mechanik über Helfer-Skript)
- Trockenlauf zuerst:
  `pwsh ./scripts/rollout-to-nas.ps1 -ManifestPath .claude/rollouts/<version>.json`
  → zeigt, was gemergt würde (Commits, geänderte Dateien).
- Nach Bestätigung ausführen: dasselbe mit `-Execute`.
  Das Skript merged `source.commit` in nas-setup, löst **nur** Versionsdatei-
  Konflikte via `--theirs` auf und **bricht bei App-Konflikten ab**
  (dann: Konflikte im Main-Chat klären, hier stoppen).

### Stufe 3 — DB-Backup (VOR Migrate, Pflicht)
- Dump aus dem DB-Container der Umgebung (`environments.<env>.dbContainer`, z.B.
  `mysql-prod`) in eine Datei mit Zeitstempel:
  `docker exec <dbContainer> sh -c 'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines <DB>' > ./db-migration/<env>-pre-<version>.sql`
- **Verifizieren:** Datei existiert und ist > 0 Bytes. Sonst STOPP + Rollback.
- DB-Name/Zugang aus `environments.<env>.envFile` / compose bestätigen (nicht raten).

### Stufe 4 — Migrationen anwenden
- `manifest.database.migrations` zeigt alle Migrationen; `drizzle-kit migrate`
  ist idempotent und wendet nur ausstehende an.
- **Mechanik gegen nas-setup bestätigen:** Migriert die App beim Start selbst,
  oder wird `npx drizzle-kit migrate` manuell gegen die NAS-DB ausgeführt?
  Entsprechend vorgehen. Fehler hier → Stufe 7 (Rollback inkl. DB-Restore).

### Stufe 5 — Build & Deploy
- **Vor dem Build:** die Umgebungs-Env-Datei (`environments.<env>.envFile`) muss
  vorhanden sein (Runtime-Vars für compose). Braucht der Client gefüllte `VITE_*`,
  diese als Build-`args` übergeben — `.dockerignore` schließt `.env*` aus dem
  Build-Context aus, sonst werden leere `VITE_*` gebacken.
- **prod bevorzugt Image-Promotion:** das auf dev getestete Image unverändert
  deployen (kein Rebuild); dev baut aus dem aktuellen Stand.
- `docker compose -f <environments.<env>.composeFile> up -d` (dev ggf. mit
  vorherigem `build`).
- Kurz auf Container-Health warten (`docker compose -f <composeFile> ps`).

### Stufe 6 — Health-Gate
- Poll `environments.<env>.healthUrl` (Host-Port der Umgebung) bis `version` ==
  `app.expectVersion`, mit Timeout (z.B. 12×5s).
- Ungleich/Timeout → Stufe 7 (Rollback).

### Stufe 7 — Abschluss ODER Rollback
- **Erfolg:** `git push origin nas-setup`; Tag `nas-rollout/<version>` setzen +
  pushen; `.claude/rollouts/<version>.DONE` mit Zeitstempel + Ergebnis schreiben;
  dem User Health-Ausgabe zeigen. Dump aus `./db-migration/` nach Prüfung sicher
  löschen (enthält Daten).
- **Rollback (bei Fehler ab Stufe 2):**
  - Noch nicht committet: `git merge --abort`.
  - Bereits committet: `git reset --hard <Pre-Merge-SHA>`.
  - DB aus `<env>-pre-<version>.sql` wiederherstellen.
  - `docker compose -f <environments.<env>.composeFile> up -d` mit vorherigem
    Stand (bei prod: vorheriges Image); Health erneut prüfen.
  - Fehlerursache dem User berichten; NICHT stillschweigend weitermachen.

## Niemals
- `nas-setup → main` (bzw. `production → main`) mergen/pushen.
- Einen Dev-Deploy gegen den Prod-Stack/-DB laufen lassen (oder umgekehrt).
- Migrieren ohne verifiziertes Backup.
- Deploy als „fertig" melden ohne bestandenes Health-Gate.
- NAS-spezifische Werte (DB-Name, Ports, Migrate-Mechanik) raten statt zu bestätigen.
