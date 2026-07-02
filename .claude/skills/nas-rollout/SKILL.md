---
name: nas-rollout
description: Rollt eine auf main freigegebene Release (via Rollout-Manifest) kontrolliert auf den NAS aus — Merge main→nas-setup, DB-Backup, Migrationen, Docker-Rebuild, Health-Gate, Auto-Rollback. NUR im NAS-Setup-Chat verwenden, niemals im Main-Chat.
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

## Die 4 harten Leitplanken (nie brechen)
1. **Merge-Richtung ist einseitig:** ausschließlich `main → nas-setup`. Niemals
   `nas-setup → main` (das braucht separate, explizite Freigabe im Main-Chat).
2. **Versionsdatei-Konflikte automatisch zu main auflösen** (`--theirs`), keine
   anderen Konflikte automatisch — bei App-Konflikten abbrechen und melden.
3. **DB-Backup VOR jeder Migration.** Kein Migrate ohne verifiziertes Backup.
4. **Health-Gate + Auto-Rollback:** Nach dem Deploy muss die Zielversion
   antworten, sonst automatischer Rollback (Merge + Image + DB).

## Ablauf (stufenweise, mit Bestätigung)

### Stufe 0 — Manifest lesen & vorlegen
- Lies `.claude/rollouts/<version>.json` (oder den vom User genannten Pfad).
- Fasse dem User zusammen: Version, `source.commit`, Anzahl neuer Migrationen,
  `breaking`, `notes`. **Bei `breaking.value = true`: ausdrücklich warnen und
  Extra-Freigabe einholen.** Bestätigung abwarten.

### Stufe 1 — Preflight
- `git fetch origin`.
- Sicherstellen: aktueller Branch ist `nas-setup`, Working Tree sauber
  (`git status --porcelain` leer). Sonst stoppen.
- `source.commit` muss lokal vorhanden sein (`git cat-file -e <commit>^{commit}`).
- **Notiere den Pre-Merge-SHA** von nas-setup (`git rev-parse HEAD`) — für Rollback.

### Stufe 2 — Merge (Git-Mechanik über Helfer-Skript)
- Trockenlauf zuerst:
  `pwsh ./scripts/rollout-to-nas.ps1 -ManifestPath .claude/rollouts/<version>.json`
  → zeigt, was gemergt würde (Commits, geänderte Dateien).
- Nach Bestätigung ausführen: dasselbe mit `-Execute`.
  Das Skript merged `source.commit` in nas-setup, löst **nur** Versionsdatei-
  Konflikte via `--theirs` auf und **bricht bei App-Konflikten ab**
  (dann: Konflikte im Main-Chat klären, hier stoppen).

### Stufe 3 — DB-Backup (VOR Migrate, Pflicht)
- Dump aus dem MySQL-Container in eine Datei mit Zeitstempel, z.B.:
  `docker exec protrackr-mysql sh -c 'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines <DB>' > ./db-migration/nas-pre-<version>.sql`
- **Verifizieren:** Datei existiert und ist > 0 Bytes. Sonst STOPP + Rollback.
- Den exakten DB-Namen/Zugang aus dem `nas-setup`-`docker-compose.yml` / `.env`
  bestätigen (nicht raten).

### Stufe 4 — Migrationen anwenden
- `manifest.database.migrations` zeigt alle Migrationen; `drizzle-kit migrate`
  ist idempotent und wendet nur ausstehende an.
- **Mechanik gegen nas-setup bestätigen:** Migriert die App beim Start selbst,
  oder wird `npx drizzle-kit migrate` manuell gegen die NAS-DB ausgeführt?
  Entsprechend vorgehen. Fehler hier → Stufe 7 (Rollback inkl. DB-Restore).

### Stufe 5 — Build & Deploy
- `docker compose build app`
- `docker compose up -d`
- Kurz auf Container-Health warten (`docker compose ps`, healthcheck grün).

### Stufe 6 — Health-Gate
- Poll `manifest.app.healthUrl` (Host-Port 3010) bis `version` ==
  `manifest.app.expectVersion`, mit Timeout (z.B. 12×5s).
- Ungleich/Timeout → Stufe 7 (Rollback).

### Stufe 7 — Abschluss ODER Rollback
- **Erfolg:** `git push origin nas-setup`; Tag `nas-rollout/<version>` setzen +
  pushen; `.claude/rollouts/<version>.DONE` mit Zeitstempel + Ergebnis schreiben;
  dem User Health-Ausgabe zeigen. Dump aus `./db-migration/` nach Prüfung sicher
  löschen (enthält Daten).
- **Rollback (bei Fehler ab Stufe 2):**
  - Noch nicht committet: `git merge --abort`.
  - Bereits committet: `git reset --hard <Pre-Merge-SHA>`.
  - DB aus `nas-pre-<version>.sql` wiederherstellen.
  - `docker compose up -d` mit vorherigem Stand; Health erneut prüfen.
  - Fehlerursache dem User berichten; NICHT stillschweigend weitermachen.

## Niemals
- `nas-setup → main` mergen/pushen.
- Migrieren ohne verifiziertes Backup.
- Deploy als „fertig" melden ohne bestandenes Health-Gate.
- NAS-spezifische Werte (DB-Name, Ports, Migrate-Mechanik) raten statt aus
  `nas-setup` zu bestätigen.
