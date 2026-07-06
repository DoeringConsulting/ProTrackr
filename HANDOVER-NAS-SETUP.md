# HANDOVER — ProTrackr NAS-Setup (Sitzungs-Übergabe)

> **Zweck:** Vollständiger, self-contained Wiedereinstiegspunkt für den **NAS-Setup-Chat**.
> Wer dieses Dokument + die Memory-Dateien liest, hat den kompletten Stand ohne Verluste.
> **Stand:** 2026-07-06 · **Branch:** `nas-setup` (v2.4.0) · in Sync mit origin.
> **Status:** NAS-Umzug **komplett abgeschlossen.** Prod + Dev live auf **v2.4.0**. Der Chat
> läuft ab jetzt **rein als Rollout-Ziel** für main-Releases (Dev-Loop). Alle Setup-Themen und
> Folge-Punkte (§6.1–§6.4) sind **erledigt**; keine offenen Pflicht-TODOs.
> **Bei neuem Release:** §8 Rollout-Zyklus. **Bei Schema-Change / neuer Migration:** zwingend
> §9 Lesson 9 (Backup + Migration MANUELL vor `deploy-*.sh`).

---

## 0. SOFORT-EINSTIEG (TL;DR)

ProTrackr läuft in **zwei isolierten Umgebungen auf dem Unraid-NAS (DCS01)**: **PROD**
(echte Daten, `:9443`) + **DEV** (Prod-Klon, `:9444`), **beide auf v2.4.0**. Der alte
Laptop-`localhost` ist seit A5 abgeschaltet (NAS = einzige Instanz). Neue main-Releases
kommen über den **Dev-Loop**: `main → nas-setup` mergen (`rollout-to-nas.ps1`) → `deploy-dev.sh`
→ Dev-Abnahme → `deploy-prod.sh` bit-identische Promotion. Governance: **Prod nur via
Dev→Freigabe→Promotion**, per Guard + Mail überwacht.

**Alles läuft, alles committet + auf GitHub, Prod ist geschützt + überwacht.** Der Dev-Loop ist
9× erprobt — inkl. eines in Dev gefangenen Feature-Bugs (recharts-Fragment, v2.2.0) und eines
Schema-Change-Rollouts (Session-Store, v2.4.0). §6.4 (Prod-Tab „(DEV)") und §6.2 (TZ + Session-
Store) sind **behoben und live**.

---

## 1. WIEDEREINSTIEGS-PROZEDUR (in der neuen Sitzung zuerst)

1. **Memory ist automatisch geladen** — beachte besonders:
   `feedback_worktree_separation` (Session-Start-Verankerung!),
   `feedback_prod_only_via_dev_promotion`, `feedback_deploy_workflow`,
   `feedback_rollout_manifest`, `feedback_nas_umzug_branch`,
   `project_app_env_label_runtime_title`, `project_umsatzchart_task` (beide LIVE auf Prod).
2. **Dieses Handover + `NAS_SETUP_HISTORY.md` lesen** (HISTORY = volle Chronik).
3. **Worktree/Branch verifizieren (Laptop):** Dieser Chat gehört in
   `C:\Projects\ProTrackr_developing_path` (Branch `nas-setup`). Falls die neue Sitzung
   in einem anderen Ordner startet — prüfen, **nicht** `git switch main` im developing_path
   (Worktree-Kollision). Dann:
   ```
   cd C:\Projects\ProTrackr_developing_path
   git branch --show-current      # MUSS nas-setup sein
   git fetch origin && git status -sb
   ```
4. **NAS-Live-Stand verifizieren (Unraid Web-Terminal):**
   ```
   cd /mnt/user/appdata/protrackr
   docker compose ps                          # PROD: protrackr-app + -mysql (healthy)
   docker compose -f compose.dev.yml ps       # DEV:  protrackr-app-dev + -mysql-dev
   pgrep -af guard-prod-watch.sh              # Guard laeuft? (2 PIDs = 1 Baum, ok)
   curl -s http://localhost:3010/version.json # PROD 2.4.0
   curl -s http://localhost:3011/version.json # DEV  2.4.0
   ```

---

## 2. PROJEKT-KONTEXT

- **App:** ProTrackr (DÖRING Consulting) — Single-User Zeiterfassung/Reisekosten/
  Steuer(PL)/Rechnungen. React+Vite / tRPC+Express (ESM via esbuild) / MySQL+Drizzle.
- **NAS:** AOOSTAR WTR MAX 8845 (Ryzen 7 8845HS, x86_64), **Unraid 7.3.1**, Docker 29.x,
  Tailscale-Plugin. Hostname **DCS01**, Tailnet `dcs01.taile370c2.ts.net` (IP 100.108.232.64).
- **Compose-Verzeichnis auf NAS:** `/mnt/user/appdata/protrackr` (Klon von `nas-setup`).
- **Verwechslungs-Warnung:** Mandant **`dc001`** (App-intern) ≠ NAS-Hostname **`DCS01`**.
- **Zwei getrennte Chats/Worktrees** (Memory `feedback_worktree_separation`):
  `nas-setup` = Deploy/Infra (**dieser Chat**, `ProTrackr_developing_path`);
  `main` = App-Entwicklung (eigener Chat, `C:\Projects\ProTrackr_main`).

---

## 3. AKTUELLER LIVE-STAND (NAS)

| | **PROD** | **DEV** |
|---|---|---|
| URL | `https://dcs01.taile370c2.ts.net:9443` | `https://dcs01.taile370c2.ts.net:9444` |
| Host-Port → Container | 3010 → 3000 | 3011 → 3000 |
| Compose-Datei | `docker-compose.yml` | `compose.dev.yml` |
| App-/DB-Container | `protrackr-app` / `protrackr-mysql` | `protrackr-app-dev` / `protrackr-mysql-dev` |
| Image | `protrackr-app:latest` (`91e95665`) | `protrackr-dev-app:latest` |
| Env (gitignored) | `.env` | `.env.dev` |
| **Version** | **v2.4.0** | **v2.4.0** |
| Deploy-Weg | `deploy-prod.sh` (Promotion) | `deploy-dev.sh` |

- **Tailscale Serve:** `:9443 → localhost:3010` (Prod), `:9444 → localhost:3011` (Dev).
  Reboot-Persistenz: `tailscale serve --bg` — bei Reboot ggf. prüfen (potenziell offener Punkt).
- **Beide Container TZ=Europe/Warsaw** (app via tzdata im Image, mysql via SYSTEM-TZ) —
  am 2026-07-06 per `docker exec … date` verifiziert (beide CEST).
- **MySQL `lower_case_table_names=1`** (Windows-Dump-Kompatibilität, nur bei Init).
- **DB-Tabellen:** Schema bis Migration **`0025_sessions.sql`** (Session-Store). Die `sessions`-
  Tabelle ist bewusst NICHT im App-Backup (`server/backup.ts`) — flüchtige Auth-Sessions.
- **Session-Store:** persistent via `express-mysql-session` (überlebt Container-Restarts). Aktiv,
  wenn `DATABASE_URL` gesetzt ist (NAS: ja) — sonst In-Memory-Fallback. `createDatabaseTable:false`.
- **Titel-Mechanismus (§6.4):** ein umgebungs-neutrales Image; Titel zur Laufzeit aus
  `process.env.APP_ENV_LABEL`. Dev-Container `APP_ENV_LABEL=DEV` (fest in `compose.dev.yml`
  `environment:`), Prod unset → Prod-Titel. „Ein Image, zwei Titel."
- **Guard läuft** (`guard-prod-watch.sh`), reboot-fest via User-Script (Schedule „At Startup of Array").
- **Notification-Mail** hoste.pl → a.doering@doering-consulting.eu.
- **Laptop-`localhost:3001` ist AUS** (A5); **MySQL84 auf Laptop = Manual/gestoppt**.

---

## 4. WAS ERREICHT WURDE (Chronik-Kurzfassung — Details in `NAS_SETUP_HISTORY.md`)

**Phase 0 → A5 (NAS-Umzug):** Container-Setup, DB-Migration Laptop→NAS, Zwei-Umgebungen-Stack
(Prod+Dev isoliert), Dev-Loop + Promotion + Governance-Guards, **A5 = localhost abgeschaltet**.

**Dev-Loop im Produktiv-Einsatz — 9 Rollouts, alle über `rollout-to-nas.ps1` + Dev-Abnahme:**
- **v2.1.15/2.1.20/2.1.22** — `task_bba37780` (Reisekosten-Attribution, Kurs-Stichtag, TZ,
  PDF-Beträge). v2.1.15 in Dev **gescheitert** (Governance-Gate fing unvollständigen Fix), dann
  live v2.1.22. Prod v2.1.8 → v2.1.22.
- **v2.1.28** — §6.4 `APP_ENV_LABEL` Runtime-Titel (Prod-Tab „(DEV)"-Bug behoben). Prod → v2.1.28.
- **v2.2.0 → v2.3.0** — Umsatzentwicklung-Chart. **v2.2.0 in Dev gescheitert** (Chart leer —
  recharts findet `<Line>` NICHT in React-Fragment; Governance-Gate fing es vor Prod) → v2.2.2
  Fix → v2.2.3 Labels/Break-even → v2.3.0 Default 12M/PLN + Y-Achse-Kompaktformat. Prod → v2.3.0.
- **v2.4.0** — **erster Schema-Change-Rollout:** persistenter Session-Store (`express-mysql-session`
  + Migration `0025_sessions.sql`) + Zeitumsatz-Tooltip (v2.3.3) + TZ-Kohärenz (v2.3.5). Dev-Abnahme
  inkl. Session-Überlebt-Test bestanden. Prod v2.3.0 → **v2.4.0**.

Alle live auf Prod, jeweils bit-identische Promotion. Kein Prod-Ausfall über die ganze Serie.

---

## 5. ARTEFAKTE (nas-setup-eigene Dateien, nicht auf main)

**Infra:**
- `Dockerfile` — Multi-Stage (node:22-alpine, pnpm, tzdata). **Kein** VITE_APP_TITLE-build-arg mehr
  (T3b entfernt §6.4); App-Titel läuft runtime über `APP_ENV_LABEL`.
- `docker-compose.yml` (PROD) — Ports 3010→3000, explizite `environment:` (kein `env_file`),
  `APP_ENV_LABEL` bewusst UNSET (Doku-Kommentar).
- `compose.dev.yml` (DEV) — Ports 3011→3000, `env_file: .env.dev` + feste `environment:` inkl.
  `APP_ENV_LABEL: "DEV"`.
- `.dockerignore` · `.env.production.example` · `.env.dev.example`.

**Skripte (`scripts/`):**
- `deploy-dev.sh` — Dev-Deploy: `git fetch`+`reset --hard origin/nas-setup`, `up -d --build --no-deps app`,
  Health-Gate :3011. **Macht KEINE Migration/kein Schema-Backup** (siehe §9 Lesson 9).
- `deploy-prod.sh` — Promotion Dev→Prod: Success-Gate `PROMOTE`, Prod-DB-Backup, Rollback-Image-Tag,
  `docker tag` bit-identisch, `up --no-build`, Health-Gate, Auto-Rollback. **Ebenfalls keine Migration.**
- `rollout-to-nas.ps1` — Git-Merge-Helfer für `/nas-rollout` (Manifest-Commit → nas-setup; löst nur
  Versionsdatei-Konflikte via `--theirs`, App-Konflikte STOPP). `-e`-Bug behoben (§6.3).
- `clone-prod-to-dev.sh` — Prod→Dev-DB-Klon (Dev neu befüllen). `guard-prod-watch.sh` — Prod-Eingriff-Watcher.
- `migrate-db.ps1`/`migrate-db.sh` — Laptop-DB-Dump/Import (Erst-Migration, historisch).

**Rollout-Tooling:** `/nas-rollout`-Skill (`.claude/skills/nas-rollout/`) liest
`.claude/rollouts/<version>.json` (Manifest, von main via `generate-rollout-manifest.mjs`).
Manifeste vorhanden für alle Releases **2.1.1 … 2.4.0**. Erledigte Rollouts tragen einen lokalen
`.DONE`-Marker (`.claude/rollouts/*.DONE`, per `.gitignore` NICHT getrackt).

**Doku:** `NAS_SETUP_HISTORY.md` (volle Chronik) · `NAS_SETUP_README.md` ·
`docs/DEV-LOOP.md` · `docs/DEPLOYMENT-BLUEPRINT.md` · dieses Handover.

**Tags:** `freeze/nas-A1-start` · `nas-rollout/{2.1.22, 2.1.28, 2.3.0, 2.4.0}` · diverse `vX.Y.Z`.

**Nicht im Git (NAS-lokal):** `.env`, `.env.dev` (Secrets) · `db-migration/*.sql` (Prod-Backups) ·
Rollback-Image `protrackr-app:rollback-2026-07-06_23-15-25` (= v2.3.0) · `/var/log/protrackr-guard.log`
· Guard-Autostart-Script · `.DONE`-Marker.

---

## 6. THEMEN-STATUS (alle Setup-Punkte erledigt)

**✅ §6.1 — Rollback-Netz / Cleanup (fortlaufend, zuletzt 2026-07-06 nach v2.4.0):**
Konservativ 2 Generationen behalten (v2.4.0 laufend + v2.3.0-Rückfall-Image `af97e678`; DB-Backups
v2.4.0 `…23-13-21`/`…23-15-25` + v2.3.0 `…20-26-58`). Alles Ältere gelöscht. **Rollback-Fähigkeit
ungeschmälert** (Git-Tags: jede Version `git checkout <tag>` + `docker compose build` neu baubar).
*Kleines Rest-TODO:* v2.3.0-Puffer (Image + DB-Backup) kann nach ein paar Tagen v2.4.0-Stabilität weg.

**✅ §6.2 — TZ-Kohärenz + persistenter Session-Store (P3/M1):** live mit v2.3.5 (`warsawDateKey`) +
v2.4.0 (`express-mysql-session`). War der letzte main-relevante NAS-Folgepunkt — **erledigt**.

**✅ §6.3 — `rollout-to-nas.ps1` `-e`-Bug:** behoben (Array-Literal). Skript-Weg erprobt (9 Rollouts).

**✅ §6.4 — Prod-Tab „(DEV)":** behoben (v2.1.28, `APP_ENV_LABEL` Runtime-Label). Ein Image, zwei Titel.

**Potenziell offen (niedrig, beobachten):** Tailscale-Serve-Reboot-Persistenz (`tailscale serve --bg`)
— bei einem NAS-Reboot prüfen, ob `:9443`/`:9444` noch stehen.

---

## 7. GOVERNANCE-REGEL (verbindlich, Memory `feedback_prod_only_via_dev_promotion`)

**PROD-Änderungen ausschließlich via Dev→Freigabe→Promotion.** Drei Ebenen:
1. **Claude-Verhalten:** jede Prod-Änderungsanfrage → in DEV umsetzen + User informieren;
   kein direkter Prod-Deploy außer autorisierter Promotion.
2. **Technisch:** `deploy-prod.sh` = einziger Prod-Weg (Success-Gate `PROMOTE`, Backup,
   Auto-Rollback); passiver Guard (Compose-Warnung) + aktiver Guard (Watcher+Mail).
3. **Ehrliche Grenze:** root nicht 100 % sperrbar — Guards machen Eingriffe sichtbar.

**Success Criteria für Promotion (alle Pflicht):** tsc+vitest grün (main) · Dev deployt+healthy ·
Health-Gate+keine DB-Fehler · **manuelle Dev-Abnahme** · kein kritischer Bug · Prod-Backup ·
explizite `PROMOTE`-Freigabe. Bei Schema-Change zusätzlich: Migration+Backup vor `deploy-prod.sh` (§9).

---

## 8. BEZUG ZUR MAIN-SITZUNG + ROLLOUT-ZYKLUS

- **Zwei getrennte Welten:** `main` = App-Code (eigener Chat, `ProTrackr_main`).
  `nas-setup` = Deploy/Infra (dieser Chat, `developing_path`). **NIEMALS `nas-setup → main`
  mergen** ohne explizite Freigabe. `main → nas-setup` ist der Rollout-Weg (kontrolliert).
- **Rollout-Zyklus (Standard, ohne Schema-Change):**
  1. Main-Chat pusht auf `main` + erzeugt Manifest (`.claude/rollouts/<version>.json`) + meldet sich.
  2. NAS-Chat: Manifest bit-identisch bereitstellen (aus `origin/main`) + committen; `rollout-to-nas.ps1
     -Execute` merged den gepinnten Commit; push.
  3. `deploy-dev.sh` (User im Web-Terminal) → **Dev-Abnahme** (visuell/fachlich).
  4. Nach Freigabe: `deploy-prod.sh` → `PROMOTE` (bit-identische Promotion).
  5. Abschluss: Tag `nas-rollout/<version>`, `.DONE`, Handover/History aktualisieren.
- **Rollout mit Schema-Change:** wie oben, aber Backup + Migration MANUELL vor `deploy-*.sh` einschieben
  → **§9 Lesson 9**.
- **Main-Handover:** `HANDOVER-MAIN.md` (auf `main`). App-seitige offene Punkte gehören dorthin.

---

## 9. LESSONS LEARNED (technische Fallstricke)

1. **Post-A5-Commits:** MySQL84 (Laptop) ist Manual/aus → `pre-commit`-Hook scheitert am
   DB-Fixture-Cleanup (`vitest.setup.ts`, ECONNREFUSED 3306), NICHT an den Tests. Lösung:
   `SKIP_TEST_CLEANUP=1 git commit …` für Nicht-DB-Commits (Skip-Check `vitest.setup.ts:22`).
   *(Alle nas-setup-Doku-/Infra-Commits laufen so.)*
2. **`rollout-to-nas.ps1` `-e`-Bug** (§6.3, behoben): `-e` band mehrdeutig gegen Common-Parameter
   einer PowerShell-Advanced-Function → als **Array-Element** übergeben. Fallback bei Skript-Problemen:
   manueller Merge `git merge --no-commit --no-ff <commit>` (Konfliktcheck) → `--abort` → echter Merge;
   nur Versionsdateien auto zu main, App-Konflikte STOPP.
3. **Manifest bit-identisch holen** (Windows-MSYS `git show origin/main:pfad` ist kaputt):
   Blob-Hash-Weg — `BLOB=$(git ls-tree origin/main .claude/rollouts/X.json | awk '{print $3}');
   git cat-file blob "$BLOB" > datei`; mit `git hash-object` gegen `$BLOB` verifizieren.
4. **Merge ist meist konfliktfrei:** nas-setup macht keine eigenen Versions-Bumps (post-commit-Hook
   auf main gegated) → die Versionsdateien kollidieren nicht. `sharedConfigChanged` im Manifest prüfen
   (z.B. `pnpm-lock.yaml` = neue Dep → Image-Rebuild zieht sie).
5. **Session-Start-Verankerung:** Für Main-Arbeit die Sitzung DIREKT in `ProTrackr_main` starten,
   nie Branch im `developing_path` umschalten (Worktree-Kollision).
6. **Compose Zwei-Umgebungen:** Dev nutzt `env_file: [.env.dev]` je Service; Nicht-Secret-Konstanten
   (`APP_ENV_LABEL`, TZ) fest in `environment:` (versioniert, kein manueller NAS-Schritt). Healthcheck-
   Passwort `CMD-SHELL` + `$$VAR`.
7. **recharts-Fragment-Fallstrick** (v2.2.0): bedingte `<Line>`/`<Bar>`/`<Area>` NIE in ein React-
   Fragment `<>…</>` wickeln — recharts findet Serien-Kinder nur als direkte Kinder / Array. Symptom:
   Chart leer, keine Y-Achse, KEIN JS-Error. *(App-Code = main; hier nur zur Diagnose-Erinnerung.)*
8. **Alpine kein tzdata** → `apk add tzdata`; Windows→Linux MySQL braucht `lower_case_table_names=1`.
9. **★ Rollout mit Schema-Change / neuer Migration** (erstmals v2.4.0, `0025_sessions.sql`):
   `deploy-dev.sh`/`deploy-prod.sh` machen **keine** Migration und **kein** Schema-Backup — und
   `express-mysql-session` läuft mit `createDatabaseTable:false`, braucht die Tabelle also VOR
   App-Start. Prozedur je Umgebung (Dev zuerst, dann Prod):
   1. Merge+Push (lokal, `rollout-to-nas.ps1`).
   2. NAS: `git fetch origin && git reset --hard origin/nas-setup` (bringt die neue `drizzle/*.sql`).
   3. **DB-Backup manuell** (`docker exec <db> sh -c 'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD"
      --no-tablespaces --single-transaction --routines "$MYSQL_DATABASE"' > db-migration/<name>.sql`,
      `> 1000 B` prüfen).
   4. **Migration direkt via mysql:** `docker exec -i <db> sh -c 'exec mysql -u root
      -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < drizzle/NNNN.sql`.
   5. **Verifizieren** (`SHOW COLUMNS FROM <tabelle>`).
   6. `deploy-dev.sh` bzw. `deploy-prod.sh` (Image-Rebuild zieht neue Deps über `pnpm-lock`).
   Container-Namen: Dev `protrackr-mysql-dev`, Prod `protrackr-mysql`. Bei Prod: Backup+Migration
   **vor** `deploy-prod.sh` (dessen `[3]`-Backup ist zusätzlich; alte laufende App-Version wird von
   `CREATE TABLE IF NOT EXISTS` nicht gestört). Die manuellen `docker exec` auf Prod können eine
   Guard-Mail auslösen — legitim (freigegebene Promotion-Vorarbeit).

---

## 10. ROLLBACK-/SICHERHEITSPUNKTE

- **Vier Rollback-Ebenen** (die wichtigste — Git — ist immer da):
  1. **Git-Tags auf GitHub** (`vX.Y.Z`, `nas-rollout/X.Y.Z`) — jede Version 1:1 neu baubar
     (`git checkout <tag>` + `docker compose build`). Unabhängig von jedem Image/Backup-Cleanup.
  2. **Rollback-Image** (aktuell `protrackr-app:rollback-2026-07-06_23-15-25` = v2.3.0): Sekunden-
     Rückfall bei Code-Fehler — `docker tag <rollback> protrackr-app:latest` + `up -d --no-build app`,
     **Daten bleiben** (Code-Rollback ≠ DB-Rollback).
  3. **Prod-DB-Backups** (`db-migration/prod-pre-*.sql`, aktuell v2.4.0 + v2.3.0): für DB-Restore bei
     echter Daten-Korruption. `deploy-prod.sh` macht bei Health-Gate-Fehler **automatischen** Rollback.
  4. **App-Backup** (Settings → Datensicherung, `server/backup.ts`): DB-Backup on demand.
- **Dev ist Wegwerf:** `docker compose -f compose.dev.yml down -v` + `clone-prod-to-dev.sh --yes`
  stellt Dev jederzeit neu her (Prod unberührt).
- **Schema-Rollback:** additive Migrationen (`CREATE TABLE`) sind harmlos — ein Image-Rollback auf die
  Vorversion lässt die neue Tabelle einfach ungenutzt (kein DB-Rückbau nötig).

---

*Ende Handover. Volle Details: `NAS_SETUP_HISTORY.md`. Regeln: Memory-Dateien.*
