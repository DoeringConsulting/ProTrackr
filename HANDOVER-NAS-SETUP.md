# HANDOVER — ProTrackr NAS-Setup (Sitzungs-Übergabe)

> **Zweck:** Vollständiger, self-contained Wiedereinstiegspunkt für den **NAS-Setup-Chat**.
> Wer dieses Dokument + die Memory-Dateien liest, hat den kompletten Stand ohne Verluste.
> **Stand:** 2026-07-05 · **Branch:** `nas-setup` @ `cc7c4d0` (v2.1.22) · in Sync mit origin.
> **Status:** Phase A (Zwei-Umgebungen-Rollout) **komplett** · Dev-Loop etabliert & 3× genutzt ·
> `task_bba37780` **abgeschlossen und LIVE auf Prod v2.1.22**.
> **Nächster Schritt:** Prod-Tab-„(DEV)"-Bug (§6.4) — **Lösung (a) Runtime-Label
> (`APP_ENV_LABEL`) in Umsetzung** (main baut den Mechanismus, NAS-Teil zieht danach nach:
> T3b raus + Env-Werte + Rollout) — plus niedrig-prio Folge-TODOs (§6).

---

## 0. SOFORT-EINSTIEG (TL;DR)

ProTrackr läuft in **zwei isolierten Umgebungen auf dem Unraid-NAS (DCS01)**: **PROD**
(echte Daten, `:9443`) + **DEV** (Prod-Klon, `:9444`), beide auf **v2.1.22**. Der alte
Laptop-`localhost` ist seit A5 abgeschaltet (NAS = einzige Instanz). Neue main-Releases
kommen über den **Dev-Loop** (`main → nas-setup` mergen → `deploy-dev.sh` → Dev-Abnahme →
`deploy-prod.sh` bit-identische Promotion). Governance: **Prod nur via Dev→Freigabe→Promotion**,
aktiv per Guard + Mail überwacht.

**Alles läuft, alles committet + auf GitHub, Prod ist geschützt + überwacht.** Offen: Prod-Tab
zeigt „(DEV)" (§6.4) — **Lösung (a) Runtime-Label ist in Umsetzung** (main baut, NAS zieht nach).

---

## 1. WIEDEREINSTIEGS-PROZEDUR (in der neuen Sitzung zuerst)

1. **Memory ist automatisch geladen** — beachte besonders:
   `feedback_worktree_separation` (Session-Start-Verankerung!),
   `feedback_prod_only_via_dev_promotion`, `feedback_deploy_workflow`,
   `feedback_rollout_manifest`, `project_open_fix_expense_attribution_main`,
   `project_a5_localhost_shutdown`, `feedback_nas_umzug_branch`.
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
   docker compose ps                         # PROD: protrackr-app + -mysql (healthy)
   docker compose -f compose.dev.yml ps      # DEV:  protrackr-app-dev + -mysql-dev
   pgrep -af guard-prod-watch.sh             # Guard laeuft? (2 PIDs = 1 Baum, ok)
   curl -s http://localhost:3010/version.json # PROD 2.1.22
   curl -s http://localhost:3011/version.json # DEV  2.1.22
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
| Image | `protrackr-app:latest` | `protrackr-dev-app:latest` |
| Env (gitignored) | `.env` | `.env.dev` |
| **Version** | **v2.1.22** | **v2.1.22** |
| Deploy-Weg | `deploy-prod.sh` (Promotion) | `deploy-dev.sh` |

- **Tailscale Serve:** `:9443 → localhost:3010` (Prod), `:9444 → localhost:3011` (Dev).
  Reboot-Persistenz: `tailscale serve --bg` — bei Reboot ggf. prüfen (potenziell offener Punkt).
- **Beide Container TZ=Europe/Warsaw** (app via tzdata im Image, mysql via SYSTEM-TZ).
- **MySQL `lower_case_table_names=1`** (Windows-Dump-Kompatibilität, nur bei Init).
- **Guard läuft** (`guard-prod-watch.sh`), reboot-fest via User-Script (Schedule „At Startup of Array").
- **Notification-Mail** hoste.pl → a.doering@doering-consulting.eu.
- **Laptop-`localhost:3001` ist AUS** (A5); **MySQL84 auf Laptop = Manual/gestoppt**
  (Re-Import-Quelle; vor lokalen main-Tests ggf. manuell starten).

---

## 4. WAS ERREICHT WURDE

**Phase 0 → A5 (NAS-Umzug):** Container-Setup, DB-Migration Laptop→NAS, Zwei-Umgebungen-
Stack (Prod+Dev isoliert), Dev-Loop (`deploy-dev.sh`) + Promotion (`deploy-prod.sh`) +
Governance-Guards, **A5 = localhost abgeschaltet** (NAS einzige Instanz). Details:
`NAS_SETUP_HISTORY.md` + Memory `project_a5_localhost_shutdown`.

**Dev-Loop im Produktiv-Einsatz (3×):**
- **v2.1.15** (task_bba37780 Erst-Nachbesserung): Dev-Abnahme **gescheitert** → 2 Bug-Komplexe
  im NAS-Dev geortet (Wechselkurs-Stichtag + Attribution-Darstellung), Bug-Paket an main.
  Governance-Gate hat den unvollständigen Fix vor Prod gefangen.
- **v2.1.20** (Komplex 1 Kurs-Stichtag-Cap + TZ, Komplex 2a/2c): Dev-Abnahme bestanden.
- **v2.1.22** (PDF-Original-Belegbeträge): Dev-Abnahme bestanden → **Prod-Promotion**.

**`task_bba37780` KOMPLETT ABGESCHLOSSEN, LIVE AUF PROD (v2.1.8 → v2.1.22, 2026-07-05):**
Reisekosten-Attribution · Doppelzählung (2a) · Kundenbericht-Chronologie (2c) ·
Wechselkurs-Stichtag-Cap bei Zukunfts-Leistungsdatum (K1) · TZ-Fix Europe/Warsaw ·
PDF-Original-Belegbeträge. Prod-Promotion bit-identisch (Image `8a3f855c4e41`), Tag
`nas-rollout/2.1.22`. Memory `project_open_fix_expense_attribution_main` = KOMPLETT.

---

## 5. ARTEFAKTE (nas-setup-eigene Dateien, nicht auf main)

**Infra:** `Dockerfile` (inkl. T3b VITE_APP_TITLE build-arg) · `.dockerignore` ·
`docker-compose.yml` (PROD) · `compose.dev.yml` (DEV, `env_file:` + build-arg) ·
`.env.production.example` · `.env.dev.example`

**Skripte (`scripts/`):**
- `migrate-db.ps1` / `migrate-db.sh` — Laptop-DB-Dump/Import.
- `clone-prod-to-dev.sh` — Prod→Dev-Klon (T2-Fix: Row-Count via stdin).
- `deploy-dev.sh` — Dev-Deploy (fetch+reset, rebuild app-dev, Health-Gate).
- `deploy-prod.sh` — Promotion Dev→Prod (Success-Gate `PROMOTE`, Backup, Rollback-Tag,
  `docker tag` bit-identisch, `--no-build`, Health-Gate, Auto-Rollback).
- `guard-prod-watch.sh` — Docker-Event-Watcher → `notify` bei direktem Eingriff.
- `rollout-to-nas.ps1` — Git-Merge-Helfer für `/nas-rollout`. (Z.50 `-e`-Bug behoben 2026-07-05, §6.3.)

**Rollout-Tooling:** `/nas-rollout`-Skill (`.claude/skills/nas-rollout/`) liest
`.claude/rollouts/<version>.json` (Manifest, von main via `generate-rollout-manifest.mjs`).
Vorhandene Manifeste: `2.1.1.json`, `2.1.20.json` (im NAS-Chat erzeugt), `2.1.22.json` (von main).

**Doku:** `NAS_SETUP_HISTORY.md` (volle Chronik) · `NAS_SETUP_README.md` ·
`docs/DEV-LOOP.md` · `docs/DEPLOYMENT-BLUEPRINT.md` · dieses Handover.

**Tags:** `freeze/nas-A1-start` · `nas-rollout/2.1.22` · `v2.1.21` · `v2.1.22`.

**Nicht im Git (NAS-lokal):** `.env`, `.env.dev` (Secrets) · `db-migration/*.sql*`
(Prod-Backups, u.a. `prod-pre-promote-2026-07-05_17-47-17.sql`) · Rollback-Image
`protrackr-app:rollback-2026-07-05_17-47-17` · `/var/log/protrackr-guard.log` ·
Guard-Autostart-Script.

---

## 6. OFFENE PUNKTE (§6.4 = sichtbarer Prod-Kosmetik-Bug; Rest niedrig-prio)

### 6.1 — Rollback-Netz / Cleanup (NAS-Chat; Entscheidung: User)
Rollback bereit (**behalten**): `prod-pre-promote-2026-07-05_17-47-17.sql` + Image
`protrackr-app:rollback-2026-07-05`. Dazu ältere Backups (`prod-pre-A1-*`,
`prod-pre-import-*`, Migrations-Dumps). **Cleanup-Regel** (User): keine Löschung bis
GESAMTER Umzug fertig UND alle Bugs gelöst — Bedingung ist jetzt weitgehend erfüllt
(Phase A komplett, task_bba37780 + T2/T3 gelöst). Nach ein paar Tagen Prod-Stabilität
kann aufgeräumt werden (User entscheidet, Ausführung hier).

### 6.2 — main-seitige Folge-TODOs (App-Code → main, nicht hier)
- **TZ-Folgepunkte:** `Reports.tsx` Default-Monatsgrenzen (`getTodayLocalDate`, ~Z.67-90)
  browser-lokal; `server/scheduler.ts` (~Z.32-33) Monatsend-Notification via `toISOString`
  (UTC). Beide unkritisch für Warschau-Nutzer, Kandidaten für `warsawDateKey`.
- **P3/M1:** MySQL-Session-Store (`express-mysql-session`) statt MemoryStore in
  `server/_core/index.ts`. Unkritisch (Single-User). Laufzeit-Test nur in NAS-Dev.
→ Ein Main-Chat-Prompt dafür wurde bereits erstellt (siehe letzte NAS-Chat-Nachricht).

### 6.3 — ✅ ERLEDIGT (2026-07-05): `rollout-to-nas.ps1` `-e`-Bug behoben
`scripts/rollout-to-nas.ps1` Z.50 auf Array-Literal `Invoke-Git @('cat-file','-e',
"$commit^{commit}")` umgestellt (+ WARUM-Kommentar). Ursache war die Advanced-Function-
Parameter-Ambiguität von `-e` gegen `-ErrorAction`/`-ErrorVariable`. Empirisch abgesichert:
**nur** Z.50 war betroffen (alle anderen `Invoke-Git`-Aufrufe binden sauber über
`ValueFromRemainingArguments`); Fix gegen echtes git verifiziert (`Code=0`, Gegenprobe
`128`). `/nas-rollout` kann den formalen Skript-Weg wieder nutzen — manueller Merge nicht
mehr nötig. Details: `NAS_SETUP_HISTORY.md` (2026-07-05 §6.3).

### 6.4 — ⚠ Prod-Tab zeigt „ProTrackr (DEV)" (Bug: T3b build-time × bit-identische Promotion)
**Symptom:** Die **Prod**-App (`:9443`) zeigt im Browser-Tab/Titel **„ProTrackr (DEV)"**
statt des Prod-Titels („Döring Consulting - Projekt & Abrechnungsmanagement"). Kosmetisch,
kein Funktions-/Datenfehler — aber auf Prod sichtbar/unprofessionell.
**Ursache:** T3b setzt `VITE_APP_TITLE=ProTrackr (DEV)` als **build-arg** → der Titel wird
**build-time** in den Client gebacken (`client/src/main.tsx` `document.title`).
`deploy-prod.sh` promotet das Dev-Image **bit-identisch** (`docker tag protrackr-dev-app
→ protrackr-app`, kein Rebuild) → das Dev-Image **inkl. eingebackenem „(DEV)"** landet auf
Prod. Grundkonflikt: **build-time DEV-Label ⚔ bit-identische Image-Promotion** (T3b war zu
kurz gedacht — es macht das Image umgebungs-SPEZIFISCH, was die Promotion-Idee bricht).
**Fix-Richtungen (betrifft beide Welten):**
- **(a) empfohlen — Label RUNTIME statt build-time:** Titel aus einer server-injizierten
  Runtime-Variable / Port / Hostname bestimmen (App-Code → **main**), NICHT via `VITE_*`;
  danach das T3b build-arg entfernen (**nas-setup**: `compose.dev.yml` + `Dockerfile`). Dann
  ist das Image wieder umgebungs-neutral → bit-identische Promotion intakt, Dev zeigt
  „(DEV)", Prod den Prod-Titel.
- **(b) T3 zurückrollen:** DEV-Label ganz entfernen (Dev/Prod nur via URL `:9444`/`:9443`
  unterscheidbar) — T3a (main, `main.tsx`) + T3b (nas-setup) rückgängig.
**Sofort-Notbehelf (unsauber, nur wenn Prod-Titel dringend):** Prod separat bauen ohne
build-arg (`docker compose up -d --build app` gegen `docker-compose.yml`) → bricht aber die
„Prod == getestetes Dev-Image"-Garantie; besser (a) oder (b) sauber umsetzen.

**ENTSCHEIDUNG (2026-07-05): Lösung (a) — Runtime-Label.** User-Vorgabe: „DEV bleibt DEV,
PROD bleibt PROD, Promotion hin oder her." Umsetzung koordiniert über beide Welten via
Runtime-Env-Var **`APP_ENV_LABEL`** (Server-lesbar, KEIN `VITE_`-Prefix; **Dev = `DEV`,
Prod = leer**):
- **main (in Arbeit):** Prompt ist im Main-Chat platziert — Server reicht `APP_ENV_LABEL`
  **runtime** an den Client (index.html-Injektion **oder** dynamischer Config-Endpoint),
  `client/src/main.tsx` baut `document.title` = `label ? "ProTrackr ("+label+")" :
  "Döring Consulting - …"`, **`VITE_APP_TITLE` (T3a) raus**. tsc/vitest grün, dann Manifest.
- **NAS-Chat (nach main-Push, HIER):** T3b build-arg entfernen (`Dockerfile` +
  `compose.dev.yml`), `APP_ENV_LABEL` setzen (`.env.dev` = `DEV`, Prod-`.env` = leer), dann
  Rollout (Dev-Build → Abnahme „(DEV)" → Prod-Promotion → Prod-Titel; **ein Image, zwei Titel**).
- **Trigger:** Sobald der Main-Chat den Runtime-Mechanismus gepusht hat + ein Rollout-Manifest
  vorliegt → hier weitermachen (T3b raus, Env-Werte, Rollout).

---

## 7. GOVERNANCE-REGEL (verbindlich, Memory `feedback_prod_only_via_dev_promotion`)

**PROD-Änderungen ausschließlich via Dev→Freigabe→Promotion.** Drei Ebenen:
1. **Claude-Verhalten:** jede Prod-Änderungsanfrage → in DEV umsetzen + User informieren;
   kein direkter Prod-Deploy außer autorisierter Promotion.
2. **Technisch:** `deploy-prod.sh` = einziger Prod-Weg (Success-Gate `PROMOTE`, Backup,
   Auto-Rollback); passiver Guard (Compose-Warnung) + aktiver Guard (Watcher+Mail).
3. **Ehrliche Grenze:** root nicht 100 % sperrbar — Guards machen Eingriffe sichtbar.

**Success Criteria für Promotion (alle Pflicht):** tsc+vitest grün · Dev deployt+healthy ·
Health-Gate+keine DB-Fehler · manuelle Dev-Abnahme · kein kritischer Bug · Prod-Backup
(macht Skript) · explizite Freigabe (`PROMOTE`).

---

## 8. BEZUG ZUR MAIN-SITZUNG

- **Zwei getrennte Welten:** `main` = App-Code (eigener Chat, `ProTrackr_main`).
  `nas-setup` = Deploy/Infra (dieser Chat, `developing_path`). **NIEMALS `nas-setup → main`
  mergen** ohne explizite Freigabe. `main → nas-setup` ist der Rollout-Weg (kontrolliert).
- **Rollout-Zyklus:** Main-Chat committet+pusht auf `main` + erzeugt Manifest
  (`generate-rollout-manifest.mjs`). NAS-Chat: `/nas-rollout` (bzw. manueller Merge wegen
  §6.3) → `deploy-dev.sh` → Dev-Abnahme → nach Freigabe `deploy-prod.sh`.
- **Main-Handover:** `HANDOVER-MAIN.md` (auf `main`) ist der Wiedereinstiegspunkt der
  Main-Welt. App-seitige offene Punkte (§6.2) gehören dorthin.

---

## 9. LESSONS LEARNED (technische Fallstricke)

1. **Post-A5-Commits:** MySQL84 (Laptop) ist Manual/aus → der `pre-commit`-Hook scheitert
   am DB-Fixture-Cleanup (`vitest.setup.ts`, ECONNREFUSED 3306), NICHT an den Tests.
   Lösung: `Start-Service MySQL84` (Admin) **oder** `SKIP_TEST_CLEANUP=1 git commit …` für
   Nicht-DB-Commits (Skip-Check `vitest.setup.ts:22`, vor dem DB-Connect).
2. **`rollout-to-nas.ps1` `-e`-Bug** (§6.3, **behoben 2026-07-05**) → Skript-Weg wieder nutzbar.
   Manueller Merge bleibt als Fallback-Wissen: `git merge --no-commit --no-ff origin/main`
   (Konfliktcheck) → `--abort` → echter Merge. Konflikt-Leitplanke: nur Versionsdateien auto
   zu main, App-Konflikte STOPP. Root-Cause: `-e` band mehrdeutig gegen Common-Parameter einer
   PowerShell-Advanced-Function → als Array-Element übergeben.
3. **Kurs-Stichtag-Bug-Ortung:** Eine EUR/PLN-Berichts-Divergenz über der Sub-Cent-je-Beleg-
   Rundung ist ein **Kurs-/Stichtag**-Symptom, nicht Rundung. Die „0,66 €" waren zwei
   gleichzeitige Fallback-Kurse (Zukunfts-Stichtag → stale letzter DB-Kurs).
4. **Windows-MSYS git show:** `git show origin/main:.claude/…` konvertiert `:`/`/` falsch
   („ambiguous argument"). Umgehung: über den **Blob-Hash** lesen (`git cat-file blob <hash>`).
5. **Session-Start-Verankerung:** Neue Sitzungen starten evtl. mit Root `developing_path` —
   Symptom: Statusleiste zeigt „nas-setup", PR-Button/Diff gehören zu diesem Worktree.
   Für Main-Arbeit die Sitzung DIREKT in `ProTrackr_main` starten, nie Branch umschalten.
6. **Compose Zwei-Umgebungen:** `env_file: [.env.dev]` je Service (nicht `${VAR}`, das
   nimmt Default-`.env` = Prod). Healthcheck-Passwort `CMD-SHELL` + `$$VAR`.
7. **`VITE_*` build-time:** `.dockerignore` schließt `.env*` aus → als build-arg übergeben
   (T3b: Dockerfile schreibt `.env.production.local` im build-Stage aus dem arg).
8. **Alpine kein tzdata** → `apk add tzdata`; Windows→Linux MySQL braucht `lower_case_table_names=1`.

---

## 10. ROLLBACK-/SICHERHEITSPUNKTE

- **Prod-Rollback (frische Promotion v2.1.22):** DB `prod-pre-promote-2026-07-05_17-47-17.sql`
  + Image `protrackr-app:rollback-2026-07-05_17-47-17`. `deploy-prod.sh` rollt bei
  Health-Gate-Fehler automatisch.
- **Code-Rollback vor A1:** Tag `freeze/nas-A1-start`.
- **Dev ist Wegwerf:** `docker compose -f compose.dev.yml down -v` +
  `clone-prod-to-dev.sh --yes` stellt Dev jederzeit neu her (Prod unberührt).

---

*Ende Handover. Volle Details: `NAS_SETUP_HISTORY.md`. Regeln: Memory-Dateien.*
