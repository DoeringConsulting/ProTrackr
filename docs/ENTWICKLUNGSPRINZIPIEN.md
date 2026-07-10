# Entwicklungs- und Programmierprinzipien — ProTrackr

> **Projekt:** ProTrackr (DÖRING Consulting — Projekt-, Reisekosten- und Abrechnungsmanagement, Polish JDG)
> **Dokument-Version:** 1.0.0
> **Stand:** 2026-07-07 · App-Release **v2.4.0** (komplett live auf Prod)
> **Geltungsbereich:** Verbindliche Methodik für die gesamte Weiterentwicklung von ProTrackr.
> **Verhältnis zu anderen Dokumenten:** Dies ist die konsolidierte Prinzipien-Referenz. Sie fasst
> die über die Projektlaufzeit gereiften Regeln aus `~/.claude/CLAUDE.md` (global), `CLAUDE.md`
> (projektspezifisch), `HANDOVER-MAIN.md`, `docs/DEPLOYMENT-BLUEPRINT.md` und den Memory-Dateien
> zusammen — in ihrer **heutigen, ausgereiften Fassung** samt Zielausprägung (§13).

---

## 0. Zweck & Leitidee

ProTrackr wird **von einem Einzelentwickler mit KI-Assistenz** (Claude Code / ChatGPT Codex) betrieben.
Die hier dokumentierten Prinzipien haben ein übergeordnetes Ziel: **Produktionsstabilität und lückenlose
Nachvollziehbarkeit trotz Solo-Betrieb.** Jede Regel adressiert eine der drei Kern-Gefahren dieses Setups:

1. **Kontinuitätsverlust** — Wissen darf nicht an eine einzelne Chat-Sitzung gebunden sein (→ §9).
2. **Divergenz** — dieselbe Logik an zwei Stellen driftet auseinander (→ §7.1).
3. **Ungetestete Produktions-Eingriffe** — jede Änderung muss erst in DEV bewiesen sein (→ §5).

Grundhaltung: **klar, ehrlich, faktenbasiert.** Keine Beschönigung, bei Unsicherheit nachfragen statt raten.

---

## 1. Sprache & Code-Qualität

- **Antworten, Erklärungen, Kommentare: Deutsch.** **Code selbst (Variablen, Funktionen, Klassen,
  Dateien): Englisch** — Best Practice. Englische Fachbegriffe ohne gängiges deutsches Pendant im Original
  („Pull Request", „Race Condition", „Worktree").
- **Keine Platzhalter** (`// TODO: implement`, „Rest analog") in finalen Outputs — immer vollständige,
  lauffähige Implementierung.
- **Kommentare erklären das WARUM, nicht das WAS.** Der Code selbst ist selbsterklärend.
- **Fehlerbehandlung explizit** (try/catch mit aussagekräftigen Meldungen).
- **Standards:** Zeitzone `Europe/Warsaw`; Datum `YYYY-MM-DD` (ISO 8601); Zeit 24 h `HH:MM`; Encoding
  UTF-8 ohne BOM; Zeilenumbruch LF (außer Windows-spezifische Skripte). Dezimaltrennung: Punkt im Code,
  Komma in DE-Anzeigen.

---

## 2. Der 3-Agenten-Entwicklungsworkflow (Kernverfahren)

**Jede** Code-Änderung durchläuft einen Loop aus drei getrennten Rollen. Das ist das wichtigste
Qualitätsprinzip des Projekts.

| Rolle | Aufgabe | Ergebnis |
|---|---|---|
| **Junior** (Implementierung) | Führt die Code-Änderung durch. | Diff |
| **Senior** (Code-Review) | Prüft Diff unabhängig: Type-Safety, Edge Cases, Logik, Projekt-Fallstricke. | **APPROVE** oder **CHANGES REQUESTED** |
| **QA** (Verifikation) | `tsc` + `vitest` + Build-Checks; bei UI-Änderungen visuelle Abnahme in NAS-Dev. | grün/rot |

**Regeln:**
- Bei Fehlern in Review/QA → zurück zu Junior mit konkreten Korrekturanweisungen.
- **Kritische Entscheidungen → User fragen** (via strukturierte Rückfrage): falsche Steuerberechnung,
  Datenverlust, Architekturentscheidung, **DB-Migration, neue Runtime-Dependency**.
- **Unkritische Punkte** (Typo, Styling) → im Loop selbst korrigieren.
- Der Senior-Review erfolgt als **eigenständige, unabhängige Instanz** (frischer Blick), nicht als
  Selbst-Kontrolle des Implementierers.
- Lessons Learned nach jedem Durchlauf ins Memory (§9).

---

## 3. Umgebungs-, Worktree- und Branch-Architektur

### 3.1 Zwei Server-Umgebungen — kein localhost mehr (Stand seit A5, 2026-07-03)

Der Laptop ist **ausschließlich Autoren-Maschine** (Code, Git, `tsc`, `vitest`). Die App läuft **nur**
auf dem Unraid-Server (AOOSTAR WTR MAX 8845), in zwei isolierten Umgebungen:

| Umgebung | Zweck | Git-Ref | Compose | Container | Host-Port | Tailscale |
|---|---|---|---|---|---|---|
| **PROD** | produktiv, echte Daten | `production` | `compose.prod.yml` | `protrackr-app` (+ eigener MySQL-Container) | 3010 | `:9443` |
| **DEV** | Staging / Prod-Klon | `main` | `compose.dev.yml` | `protrackr-app-dev` (+ eigener MySQL-Container) | 3011 | `:9444` |

- **Image-Promotion Dev→Prod** (bit-identisch, kein Rebuild). Dev-DB = periodischer Klon der Prod-DB
  (Richtung immer nur Prod→Dev).
- `localhost:3001` ist **komplett abgeschaltet**; lokale `MySQL84` steht auf **Manual/aus**; der frühere
  `post-commit`-Server-Restart wurde entfernt (v2.1.9).
- Container-interner Port immer **3000**. `VITE_*`-Variablen sind **build-time** (Docker build-args) —
  laufzeitabhängige Werte gehören NICHT hinein (→ §7.8).

### 3.2 Worktree-Trennung (physisch getrennte Arbeitsordner)

| Worktree | Branch | Zweck |
|---|---|---|
| `C:\Projects\ProTrackr_main` | `main` | App-/Entwicklungslinie (dieser Chat) |
| `C:\Projects\ProTrackr_developing_path` | `nas-setup` | NAS-/Infrastruktur (eigener Chat) |
| `C:\Projects\ProTrackr` | (git-Store, detached) | Repository-Speicher — niemals direkt anfassen |

**Warum getrennt:** Teilten sich beide Chats einen Worktree, schob der Auto-Version-Hook den Branch
immer wieder auf `main` und überschrieb die andere Sitzung. Getrennte Worktrees = kein Tug-of-War.
**Die Zuordnung muss schon beim Sitzungsstart über das Arbeitsverzeichnis stimmen** — eine Main-Sitzung
direkt in `ProTrackr_main` starten. Niemals in `developing_path` ein `git switch main` (Worktree-Kollision,
bricht beide).

### 3.3 Chat- und Branch-Disziplin

- **Main-Chat:** ausschließlich Branch `main`, ausschließlich Worktree `ProTrackr_main`.
- **NAS-Chat:** ausschließlich Branch `nas-setup`, ausschließlich Worktree `developing_path`. Eigenes
  Memory, eigenes Handover (`HANDOVER-NAS-SETUP.md`), eigene Chronik (`NAS_SETUP_HISTORY.md`).
- **`main` = Entwicklungslinie** (App-Code, Tooling, Docs). **`nas-setup` = Deploy/Infra** (Docker, Compose,
  Migrations-Skripte — NAS-only, nicht auf main).
- **Niemals `nas-setup → main` mergen** ohne ausdrückliche Freigabe. Sync läuft **nur** `main → nas-setup`
  kontrolliert über das Rollout-Manifest (§5.2).
- Cross-Branch-Fixes (z.B. Hook-Bug) **immer auf `main` fixen** — die andere Seite zieht nach, nie umgekehrt.

---

## 4. Versionierung (Conventional Commits + Auto-Bump)

Semantic Versioning `MAJOR.MINOR.PATCH`, automatisch aus der Commit-Message abgeleitet.

| Commit-Muster | Bump |
|---|---|
| `BREAKING CHANGE` / `BREAKING-CHANGE` im Body **oder** `<type>!:` im Subject | **MAJOR** |
| `feat:` / `feat(scope):` | **MINOR** |
| alles andere (`fix:`, `chore:`, `refactor:`, `docs:`, …) | **PATCH** |

- Override per `BUMP_LEVEL=major git commit …`.
- **Hooks** (husky):
  - `pre-commit` = **nur `vitest`** (`server/taxEnginePl.test.ts` + `server/uiValidationReportsDashboard.test.ts`).
    `tsc` läuft **nicht** im Hook — separat `npx tsc --noEmit` vor Commits.
  - `post-commit` (gated auf `main`): leitet Bump-Level ab → `scripts/increment-version.mjs` → baut `dist/`
    → foldet Versionsdateien per `git commit --amend --no-edit --no-verify` ein. **Kein Server-Restart** (A5).
- **Skip/Exemption:** Merge-Commits, sowie Commits, die **nur** Versionsdateien **oder** ein
  Rollout-Manifest (`.claude/rollouts/*.json`) anfassen, lösen **keinen** Bump aus. Ein Manifest-Commit
  bewegt die Version daher nicht (Phantom-Bump behoben).
- **Phantom-Bumps normal:** Reine Docs-Commits erzeugen Patch-Bumps — bei diesem Repo systembedingt und
  akzeptiert. Die stabile, relevante Zahl ist immer der letzte **App-Release**, nicht der Docs-HEAD.

---

## 5. Deploy- und Rollout-Governance (Herzstück)

### 5.1 Main-Deploy-Workflow

1. Auf `main` **committen** — der Hook bumpt + baut `dist/` (kein Restart).
2. `git push origin main`. Damit ist die Main-Seite fertig.
3. **Rollout-Manifest** erzeugen (§5.2) + **Milestone-Tag** `vX.Y.Z` setzen + pushen.
4. **NAS-Deploy läuft getrennt im NAS-Chat** via `/nas-rollout` — niemals aus dem Main-Chat.

### 5.2 Rollout-Manifest — die deterministische Übergabe

Für **jede** auf `main` freigegebene Release erzeugt der Main-Chat ein Manifest
`.claude/rollouts/<version>.json` (`scripts/generate-rollout-manifest.mjs --notes "…"`). Es entkoppelt
Produzent (main) und Ausführer (NAS-Chat) und **pinnt exakt**: `source.commit`, Version, Freeze-Tag,
Migrationsliste (aus `drizzle/`), Health-Ziel, Ziel-Umgebung. Der NAS-Chat liest es via `/nas-rollout`.

**Reihenfolge (wichtig):** Erst den **Tag** `vX.Y.Z` auf den Release-Commit setzen + pushen, **dann** das
Manifest generieren — sonst pinnt das Skript den falschen `freezeTag`. Das Skript läuft nur auf `main`
und bricht bei getrackten Working-Tree-Änderungen ab.

### 5.3 PROD ausschließlich über Dev-Promotion

**An der PROD-Instanz sind niemals direkte Änderungen erlaubt** — weder Code/Image, Schema noch Daten.
Jede Änderung geht zwingend: **DEV → Test → Freigabe → Promotion → PROD.**

**Success Criteria (alle 7 müssen erfüllt sein, bevor promotet wird):**
1. `npx tsc --noEmit` + `npx vitest run` grün auf dem zu promotenden Stand.
2. Dev-Stack deployt, `app-dev` + `mysql-dev` **healthy**.
3. Health-Gate: `:9444/version.json` zeigt die erwartete Version; keine DB-Fehler im Log.
4. **Manuelle Funktionsabnahme in DEV durch den User.**
5. Kein offener kritischer Bug im geänderten Bereich.
6. **Backup von PROD vor der Promotion.**
7. **Explizite Promotion-Freigabe des Users.**

Erst dann: **bit-identische** Image-Promotion (`docker tag` dev-app→app) via `scripts/deploy-prod.sh` +
Prod-Restart + Health-Gate + Auto-Rollback bei Fehler.

**Technische Guards:** `deploy-prod.sh` ist der **einzige** legitime Prod-Deploy-Weg (Eingabe `PROMOTE`,
Backup, Rollback-Image-Tag, Health-Gate). `guard-prod-watch.sh` überwacht `docker events` und alarmiert
bei jedem Prod-Eingriff **ohne** Marker (Unraid-Dashboard + Mail an a.doering@doering-consulting.eu),
reboot-fest. **Ehrliche Grenze:** root kann nicht 100 % gesperrt werden — die Guards machen direkte
Prod-Änderungen unwahrscheinlich und **sichtbar**, nicht unmöglich.

### 5.4 Freeze-Tags & Rollback

- **Freeze-Tags vor riskanten Eingriffen**, immer auf `origin` gepusht:
  `vX.Y.Z-stable` (Major-Releases), `vX.Y.Z-phaseN-done` (zwischen Rollout-Phasen),
  `vX.Y.Z-stable-cleanup` (nach DB-Aufräumen). NAS-Prod-Rollouts tragen zusätzlich `nas-rollout/<version>`.
- **Force-Push** nur als `--force-with-lease`, nur auf `main` bei Hash-Drift durch Auto-Bump-Amend.
  **Nie auf Tags.**
- Additive Migrationen (`CREATE TABLE IF NOT EXISTS`) sind gefahrlos zurückrollbar (alter Code ignoriert
  die neue Tabelle); der NAS hält zwei Image-Generationen als Rollback-Netz vor.

---

## 6. Qualitätssicherung

- **Pflicht vor Commit:** `npx tsc --noEmit` (Type-Check) + `npx vitest run`.
- **Post-A5-Commit-Stolperfalle:** Da `MySQL84` Manual/aus ist, scheitert der `pre-commit`-Fixture-Cleanup
  mit `ECONNREFUSED 127.0.0.1:3306` — **nicht** die Tests. Lösung: `SKIP_TEST_CLEANUP=1 git commit …`
  (client-only/Nicht-DB-Fixes; Tests laufen normal) **oder** `Start-Service MySQL84` (Admin) vor
  DB-Fixture-Commits.
- **Integration-Tests** in `server/*.test.ts` schreiben in die echte Dev-DB. Globaler Cleanup in
  `server/vitest.setup.ts:afterAll` löscht Fixtures mit definierten Projektnamen (`'Test Project'`,
  `'Test Project 2'`, `'Update Test'`, `'Address Test Project'`) + `exchangeRates.source = 'Manual Test'`.
  **Neue Tests müssen diese Fixture-Namen wiederverwenden**, damit die Cleanup-Logik greift.
- **Bundle-Checks** vor riskanten Releases: `esbuild` (Server) + `vite build` (Client) in ein temporäres
  Verzeichnis bauen, um Bundle-Fähigkeit und Alias-Auflösung zu prüfen, ohne `dist/`/Git zu verschmutzen.
- **Visuelle e2e-Abnahme gehört in NAS-Dev** (`:9444`), nicht auf den Laptop — Seiten sind auth-/DB-gated,
  lokal fehlen echte Daten.
- **SSR-Repro als Diagnose ohne Browser:** `renderToStaticMarkup` mit fest dimensioniertem Chart rendert
  das SVG statisch; per Regex (`recharts-line-curve`, Tick-Count, `/NaN/`) lässt sich Render-Verhalten
  ohne laufende App verifizieren — sehr wertvoll, weil lokal keine echten Daten vorliegen (→ §10.2).

---

## 7. Architektur- und Code-Prinzipien

### 7.1 Eine Wahrheitsquelle je Belang (wichtigstes Architektur-Prinzip)

Die Divergenz-Bug-Klasse dieses Projekts entsteht, wenn dieselbe Logik doppelt existiert. Gegenmittel:
gemeinsame Module, die von allen Aufrufern geteilt werden — z.B.:
- `client/src/lib/monthlyFinancials.ts` (`computeMonthlyAmounts`, `computeMonthlyDisplayRevenue`) —
  von **Reports UND Dashboard** genutzt.
- `client/src/lib/expenseAttribution.ts` (`getExpenseBillingCustomerId`) — Reisekosten-Attribution.
- `client/src/lib/customerReportRows.ts` (`buildCustomerReportRows`) — Zeilenmodell der Kundenberichte.
- `shared/dateStichtag.ts` (`warsawDateKey`, `capRateStichtagKey`) — TZ-/Kurs-Stichtag, Client **und** Server.

Beim Umbau: die geteilte Quelle chirurgisch umstellen und per Unit-Test **byte-identisches** Vorher/Nachher
absichern.

### 7.2 Geld immer als `int` (Cents) — nie Decimal/String

Sonderskalen (verbindlich):

| Feld | Skala |
|---|---|
| Geldbeträge allgemein | Cents (`4231` = 42,31) |
| `customers.standardDayHours` | Hundertstel-Stunden (`800` = 8,00 h) |
| `timeEntries.manDays` | Tausendstel (`1250` = 1,250 MT) |
| `timeEntries.hours` | Minuten total (`480` = 8 h) |
| `exchangeRates.rate` | Zehntausendstel (`42369` = 4,2369) |
| `*RateBp` / `provisionValueBp` | Basis Points (`1952` = 19,52 %) |

### 7.3 Zeitzone Europe/Warsaw — konsequent

- **Monatsgrenzen als String bauen** (`${y}-${mm}-01`), **nie `toISOString`** — letzteres liefert UTC und
  kippt im Fenster 00:00–02:00 Warschau auf den Vortag.
- „Heute/gestern" für Kurs-Stichtage immer über `warsawDateKey()` (Intl, DST-sicher), Client und Server
  konsistent.
- **Server-seitiger Zeit-Code setzt einen Container in `Europe/Warsaw` voraus** — der Docker-Container
  erbt die Host-TZ NICHT automatisch (Default UTC); zu kontrollieren mit `docker exec <container> date`
  (muss `CEST`/`CET` zeigen, nie `UTC`).

### 7.4 Datenschutz / kein Datenleck (strukturelle Garantie)

- **Buchhaltungsbericht** = user-internal (zeigt Provision, Steuerlast, Nettogewinn).
- **Kundenbericht** = customer-facing — zeigt **niemals** Provision oder Provisionsdetails.
- Provisions-Aggregate (`accountingData.provisionTotal`, `customer.provision*`) dürfen **niemals** in ein
  customer-facing Export-Objekt (`CustomerData`/`CustomerReportData`) fließen. Das ist eine **strukturelle
  Trennung**, nicht durch Konvention zu ersetzen. Provisionsberechnung gekapselt in
  `client/src/lib/provision.ts`.

### 7.5 Migrations-Konvention

- `drizzle/NNNN_descriptive_name.sql`; Muster `ADD COLUMN … NOT NULL DEFAULT … AFTER existing_col`.
- Schema-Sync in `drizzle/schema.ts` **parallel** pflegen (sonst schlägt `drizzle-kit generate` eine
  Drop-Migration vor).
- Anwenden direkt via `mysql2/promise`, **nicht** `drizzle-kit migrate` interaktiv. Aktueller Stand: bis
  `0025_sessions.sql`.
- **DB-Migration + neue Dependency sind kritische Eingriffe** → Vorgehen/Test-Strategie vorher mit User
  klären (§2).

### 7.6 Backup-System

`server/backup.ts` (`createBackup`/`restoreBackup`, Endpoint `backup.create`/`backup.restore`). Deckt eine
**explizit gelistete** Tabellenmenge ab (Format `1.1.0`, `1.0.0` bleibt restoreable). Beim Hinzufügen neuer
Tabellen **beide** Funktionen erweitern und mit altem 1.0.0-Backup testen. Flüchtige Daten (z.B.
`sessions`) bleiben **bewusst ausgeschlossen** (kein Stammdatum).

### 7.7 Wechselkurse — NBP als einzige Quelle

- Ausschließlich NBP-Tabela-A-API
  (`https://api.nbp.pl/api/exchangerates/rates/a/<currency>/<YYYY-MM-DD>/?format=json`). **Keine** anderen
  Forex-Quellen.
- **Stichtag-Regel (Polish VAT/PIT):** letzter Werktag vor heute; 404-Fallback bis 7 Tage rückwärts
  (Wochenenden/Feiertage). Cache-Fenster 12 h. Manual-Override via `accountSettings.useManualExchangeRate`.
- Stichtag auf `min(jüngstes Leistungs-/Kostendatum, gestern)` kappen (`capRateStichtagKey`) — sonst läuft
  der NBP-Call bei Zukunftsdaten in eine 404-Kaskade und nimmt einen veralteten Notfall-Kurs.

### 7.8 Laufzeit- statt Build-time-Konfiguration

Umgebungsabhängige Werte, die bit-identisch nach Prod promotet werden, dürfen **nicht** build-time gebacken
werden. Lehrbeispiel: Der Tab-Titel wurde über `VITE_APP_TITLE` (build-time) gesetzt und zeigte auf Prod
fälschlich „(DEV)". Lösung: Wert zur **Laufzeit** injizieren (`APP_ENV_LABEL` server→client), kein
`VITE_`-Prefix.

### 7.9 i18n

PDF-/Excel-Exports und UI-Strings dreisprachig (DE/EN/PL) **parallel** pflegen.

---

## 8. Phasen-Roll-out-Pattern für große Features

Pflicht für jedes Feature mit Daten-Migration oder breit verzweigter Logik (etabliert im Provision-Feature,
7 Phasen):

1. **Master-Freeze** vor Beginn (`vX.Y.Z-stable`), auf `origin` pushen.
2. Pro Phase: **DoD definieren** → implementieren → `tsc` + `vitest` + Regression → **Phase-Freeze**
   (`vX.Y.Z-phaseN-done`), pushen.
3. **Bei Fehler:** `git reset --hard <letzter Phase-Freeze>`, Lessons-Learned dokumentieren, neuer Versuch.
4. **Eskalation:** Bei zweimaligem Scheitern derselben Phase → drei alternative Lösungsansätze vorlegen,
   User wählt. Kein dritter Versuch ohne neue Konzeption.
5. **Worst-Case-Reset:** `git reset --hard <Master-Freeze>`.

---

## 9. Wissens- und Kontinuitätssystem

Das Wissen lebt **nicht** in der laufenden Sitzung, sondern in dauerhaften, versionierten Dateien — so kann
jede neue Sitzung lückenlos anschließen.

- **Handover-Dokumente** (`HANDOVER-MAIN.md`, `HANDOVER-NAS-SETUP.md`): self-contained, immer aktuell
  gehalten. Eine neue Sitzung kann allein daraus + dem Memory weiterarbeiten. Enthalten Stand, offene
  Punkte, Lessons, Rollback-Punkte.
- **Memory-Dateien** (`~/.claude/projects/…/memory/`, außerhalb des Repos): ein Fakt pro Datei, mit
  Frontmatter. Typen: `user`, `feedback` (Arbeitsweise + Warum), `project` (laufende Arbeit), `reference`.
  `MEMORY.md` = Index, bei Sitzungsstart gelesen. Nach jedem Durchlauf pflegen; veraltete Einträge
  korrigieren/löschen.
- **Einstiegsprompt = obligatorischer Begleiter jedes Handovers.** Nach Handover-Erstellung **immer**
  zusätzlich einen ready-to-paste Start-Prompt liefern (Worktree-/Branch-/Drift-Check, „Lies MEMORY.md +
  HANDOVER", Kontext, PRIMÄRE AUFGABE + Folgepunkte, Rahmen).
- **NAS-Doku-Pflicht:** Jeder Schritt im NAS-Setup (Entscheidung, Befehl, Output, Datei-Änderung) wird
  chronologisch in `NAS_SETUP_HISTORY.md` (nur Branch `nas-setup`) protokolliert.

---

## 10. Lessons Learned / Fallstricke

### 10.1 recharts + React-Fragment
Serien-Komponenten (`<Line>`/`<Bar>`/`<Area>`) dürfen **nie** in ein React-Fragment `<>…</>` gewickelt
werden — recharts findet sie dann nicht (0 Linien, keine Y-Domain, **kein** JS-Error). Immer als **Array**
`[cond && <Line/>, …]` oder direkte Kinder.

### 10.2 recharts ohne Browser diagnostizieren
`renderToStaticMarkup` mit fest dimensioniertem `<LineChart>` (keine `ResponsiveContainer`) rendert das SVG
statisch; per Regex die Linienzahl, Tick-Count (Y-Achse) und `/NaN/` (kaputte Koordinaten) prüfen.

### 10.3 Zeitzonen — die drei Fallen
- `toISOString().slice(0,10)` liefert **immer** UTC und kippt bei Warschau-Server auf den Vortag → statt
  dessen `warsawDateKey()` bzw. String-Monatsgrenzen.
- **Host ≠ Container:** Der Docker-Container erbt die Host-TZ nicht automatisch — separat prüfen.
- Server-lokale `now`-Berechnungen (Scheduler-Trigger, `db.ts`-Range-Filter) sind nur korrekt, **solange
  der Container Europe/Warsaw läuft** — daher ist die Container-TZ der eine abzusichernde Anker.

### 10.4 Netto in PLN rechnen, dann konvertieren
ZUS-/Zdrowotna-Minima sind PLN-definiert → erst in PLN rechnen, dann in die Zielwährung konvertieren
(negative Anlaufmonate zulassen).

### 10.5 @types-Divergenz sauber überbrücken
Wenn DefinitelyTyped von der tatsächlichen Lib abweicht (Beispiel: `express-mysql-session` nutzt intern
`mysql2/promise`, die `@types` deklarieren den callback-`mysql2`-Pool), den Cast **präzise und
dokumentiert** setzen — nach Verifikation am tatsächlichen Lib-Code, mit erklärendem Kommentar (WARUM).

### 10.6 Kurs-Divergenz ≠ Rundung
Übersteigt eine EUR/PLN-Berichts-Divergenz die Sub-Cent-je-Beleg-Rundung, ist die **Kurs-Stichtag-Auflösung**
verdächtig (zwei verschiedene Fallback-Kurse gleichzeitig), nicht die Rundungslogik.

### 10.7 Windows/Git-Bash
Git Bash verhaspelt `git show ref:.claude/…`-Pfade → PowerShell oder `MSYS_NO_PATHCONV=1`. Commit-Messages
umlautfrei halten (Encoding-Sicherheit).

---

## 11. Eskalations- und Entscheidungsregeln (verbindlich)

- **Main-only im Main-Chat**; NAS hat eigenen Chat.
- **Kein `nas-setup → main`** ohne Freigabe.
- **Keine direkten PROD-Änderungen** — alles über DEV→Test→Freigabe→Promotion.
- **3-Agenten-Workflow für ALLE Code-Änderungen.**
- **User fragen** bei: Architektur, Steuer-/Berechnungslogik, Datenverlust, DB-Migration, neuer
  Runtime-Dependency, sowie vor jedem Push/Prod-Schritt mit Außenwirkung.
- Bei **Styling/Typo** im Loop selbst korrigieren.

---

## 12. Werkzeug-Stack (heutiger Stand)

- **Frontend:** React + Vite + TypeScript; UI Radix (`@/components/ui`); Charts `recharts`; Routing `wouter`.
- **Backend:** tRPC + Express, per esbuild zu `dist/index.js` (ESM) gebündelt; Entry `server/_core/index.ts`.
- **DB:** MySQL via Drizzle ORM; Sessions persistent via `express-mysql-session` (MySQL-Store,
  Migration `0025`).
- **Tooling:** pnpm; husky (pre-/post-commit, §4); Vitest; `node_modules` jederzeit per `pnpm install`
  regenerierbar.
- **Betrieb:** Docker/Compose auf Unraid 7.3.1; Tailscale-Zugriff; NBP-API als feste externe Abhängigkeit.

---

## 13. Zielausprägung / Ausblick

Die Prinzipien laufen auf folgende Zielbilder zu:

1. **CI/CD Level 3 (Phase B):** Automatisierte Pipeline via **GitHub Actions + self-hosted Unraid-Runner +
   GHCR** — die heute manuelle `/nas-rollout`-Promotion wird pipeline-gestützt, unter Beibehaltung des
   Dev→Prod-Governance-Gates. Bauplan: `docs/DEPLOYMENT-BLUEPRINT.md`.
2. **Vollständige „eine Wahrheitsquelle":** verbleibende doppelte Logik konsequent in geteilte Module
   überführen (Divergenz-Klasse dauerhaft eliminieren).
3. **TZ-Robustheit als Standard:** Container-TZ-Anker (`Europe/Warsaw`) als fester, dokumentierter Bestandteil
   jeder Umgebung; server-lokale Zeit-Logik langfristig TZ-unabhängig härten.
4. **Governance bleibt verbindlich:** PROD niemals direkt; jede Änderung erst in DEV bewiesen; jede Release
   mit Manifest + Tag deterministisch übergeben.

---

## Anhang A — Quellenverzeichnis & Validierungsleitfaden

> **Zweck:** Jede Aussage der §§0–13 lässt sich hierüber auf eine **öffenbare, prüfbare Quelle**
> zurückführen. Eine spätere Claude-(Cowork-)Sitzung kann damit **selbstständig nachsehen, prüfen,
> validieren und evaluieren** — jede Quelle ist mit exaktem Pfad und Zugriffsweg gelistet.
> Stand des Registers: 2026-07-07 (Repo bis `0025_sessions.sql`, 10 Rollout-Manifeste).

### A.1 Verlässlichkeits-Hierarchie (bei Widerspruch maßgeblich)

Von hoch nach niedrig — bei Konflikt gewinnt die höhere Stufe, die niedrigere ist dann zu korrigieren:

1. **Ground Truth = der Code** (`.husky/`, `scripts/`, `drizzle/`, `client/src/lib/`, `server/`,
   Compose/Dockerfile). Die tatsächliche Implementierung. Widerspricht die Doku dem Code, **gewinnt der Code**.
2. **Normativ = `CLAUDE.md`** (global + projektspezifisch). Die geltenden Regeln und Absichten.
3. **Stand = Handover-Dokumente.** Aktueller Projektzustand + Lessons.
4. **Notiz = Memory-Dateien.** Point-in-time-Beobachtungen — **immer gegen den Code validieren**
   (Datei-/Zeilenangaben können veraltet sein; jede Memory-Datei trägt ein Alter im System-Reminder).

### A.2 Zugriffswege (für einen Agenten)

| Quell-Ort | Zugriff |
|---|---|
| **main-Dateien** (App-Code, Docs) | direkt lesen ab Repo-Root `C:\Projects\ProTrackr_main\<pfad>` |
| **nas-setup-Dateien** (Infrastruktur) | read-only via Git, **kein Branch-Wechsel** (Governance §3.3): `git show origin/nas-setup:<pfad>` — in Git Bash `MSYS_NO_PATHCONV=1` voranstellen oder PowerShell nutzen |
| **Memory** (außerhalb Repo) | `C:\Users\adoer\.claude\projects\C--Projects-ProTrackr\memory\<name>.md` |
| **globale Anweisungen** | `C:\Users\adoer\.claude\CLAUDE.md` |

**Validierungs-Vorgehen:** Aussage → in A.4 Primärquelle + Validierungs-Code nachschlagen → Quelle öffnen →
gegen den Ground-Truth-Code prüfen → bei Abweichung Code = Wahrheit, Doku aktualisieren (Auto-Bump greift).

### A.3 Quellenregister

**(a) Normative Anweisungen**

| Quelle | Pfad / Ort | Inhalt |
|---|---|---|
| Globale Regeln | `~/.claude/CLAUDE.md` | Sprache, Kommunikation, Code-Qualität, Daten-/Währungsstandards, NBP, Sicherheit, Branding |
| Projekt-Regeln | `CLAUDE.md` (main, Repo-Root) | Stack, Worktrees, Branch/Tag-Disziplin, Build/Deploy, DB-Konventionen, Auto-Bump, Tests, Backup, NBP, Datenschutz, Phasen-Rollout, Memory |

**(b) Handover, Bauplan & Rollout-Doku**

| Quelle | Pfad / Ort | Inhalt |
|---|---|---|
| Main-Handover | `HANDOVER-MAIN.md` (main) | Stand, Governance, Lessons Learned, Rollback-Punkte |
| NAS-Handover | `HANDOVER-NAS-SETUP.md` (origin/nas-setup) | NAS-Live-Stand, Artefakte §5, Governance §7, **Lessons §9**, Rollback §10 |
| Deploy-Bauplan | `docs/DEPLOYMENT-BLUEPRINT.md` (main) | Zwei-Umgebungen-Architektur, CI/CD-Phasen |
| Unraid-Deploy | `docs/UNRAID_DEPLOYMENT.md` (origin/nas-setup) | Unraid-spezifische Deploy-Doku |
| NAS-Chronik | `NAS_SETUP_HISTORY.md` (origin/nas-setup) | chronologisches Vollprotokoll aller NAS-Schritte |
| Rollout-Format | `.claude/rollouts/README.md` + `.claude/rollouts/<version>.json` (main) | Manifest-Format + 10 Release-Manifeste (Übergabe main→NAS) |

**(c) Memory-Dateien** — `~/.claude/projects/C--Projects-ProTrackr/memory/`

| Datei | Belegt (§) |
|---|---|
| `feedback_3agent_workflow.md` | §2 3-Agenten-Workflow |
| `feedback_deploy_workflow.md` | §5.1 Main-Deploy (post-A5) |
| `feedback_prod_only_via_dev_promotion.md` | §5.3 PROD-Governance + Success Criteria |
| `feedback_rollout_manifest.md` | §5.2 Rollout-Manifest-Prozess |
| `feedback_worktree_separation.md` | §3.2 Worktree-Trennung |
| `feedback_nas_umzug_branch.md` | §3.3 NAS-Branch-Isolation, NAS-Doku-Pflicht |
| `feedback_main_only_session.md` | §3.3 main-only, §11 |
| `feedback_handover_entry_prompt.md` | §9 Einstiegsprompt |
| `project_two_env_server_architecture.md` | §3.1 Zwei-Umgebungen, §13 CI/CD-Ziel |
| `project_a5_localhost_shutdown.md` | §3.1 A5-Umstellung, §6 Post-A5-Stolperfalle |
| `project_app_env_label_runtime_title.md` | §7.8 Laufzeit-Konfiguration |
| `project_umsatzchart_task.md` | §7.1 eine Wahrheitsquelle, §10.1/10.2 recharts |
| `project_open_fix_expense_attribution_main.md` | §7.1/§7.7 Attribution/Kurs, §10.3/10.6 TZ/Kurs |
| `MEMORY.md` | Index aller Memory-Einträge (bei Sitzungsstart gelesen) |

**(d) Ground-Truth-Code (main)** — die Implementierung, gegen die validiert wird

| Prinzip (§) | Beleg-Code |
|---|---|
| §4 Versionierung/Hooks | `.husky/pre-commit`, `.husky/post-commit`, `scripts/increment-version.mjs` |
| §5.2 Manifest-Generator | `scripts/generate-rollout-manifest.mjs`, `.claude/rollouts/*.json` |
| §6 Fixture-Cleanup | `server/vitest.setup.ts` |
| §7.1 eine Wahrheitsquelle | `client/src/lib/monthlyFinancials.ts`, `expenseAttribution.ts`, `customerReportRows.ts` |
| §7.2/§7.5 Geld/Migrationen | `drizzle/schema.ts`, `drizzle/*.sql` (aktuell bis `0025_sessions.sql`) |
| §7.3 Zeitzone | `shared/dateStichtag.ts`, `server/scheduler.ts`, `server/db.ts`, `client/src/pages/Reports.tsx` |
| §7.4 Datenschutz | `client/src/lib/provision.ts`, `client/src/pages/Reports.tsx` |
| §7.6 Backup | `server/backup.ts` |
| §7.7 NBP | `server/nbp.ts`, `server/routers.ts` (`exchangeRatesManagement`) |
| §7.8 Laufzeit-Konfig | `server/_core/envLabel.ts`, `client/src/lib/appTitle.ts` |
| §12 Session-Store | `server/_core/index.ts`, `server/_core/sessionConfig.ts`, `drizzle/0025_sessions.sql` |
| §10.1 recharts-Fragment | `client/src/pages/Dashboard.tsx` (`buildRevenueChart`) |

**(e) NAS-Infrastruktur-Artefakte (origin/nas-setup)** — Zugriff via `git show origin/nas-setup:<pfad>`

| Datei | Belegt (§) |
|---|---|
| `docker-compose.yml`, `compose.dev.yml` | §3.1 Umgebungen, §5.3 Compose |
| `Dockerfile`, `.dockerignore` | §12 Build, §7.8 build-args |
| `scripts/deploy-prod.sh` | §5.3 Prod-Promotion + Guards |
| `scripts/deploy-dev.sh` | §5.1 Dev-Deploy |
| `scripts/clone-prod-to-dev.sh` | §3.1 Dev-DB = Prod-Klon |
| `scripts/guard-prod-watch.sh` | §5.3 aktiver Prod-Guard |
| `scripts/migrate-db.ps1`, `scripts/migrate-db.sh` | §7.5 Migrations-Mechanik |
| `NAS_SETUP_README.md` | NAS-Setup-Übersicht |

> Diese Kategorie ist bewusst nur referenziert, nicht inhaltlich ausgeführt — die NAS-/Infrastruktur-
> Ausführungsprinzipien (Compose-Konventionen, Healthcheck-Escaping, `tzdata`, `env_file`, `mysqldump`-
> Feinheiten) sind in `HANDOVER-NAS-SETUP.md` §9 dokumentiert und werden durch die NAS-Setup-Sitzung
> ergänzt (governance-konform: Zulieferung als Vorschlag, Einarbeitung auf `main`).

### A.4 Prinzip → Primärquelle → Validierungs-Code (Mapping)

| § | Prinzip | Primärquelle(n) | Validieren gegen |
|---|---|---|---|
| 1 | Sprache / Code-Qualität | `CLAUDE.md` global §1–4,10 | — |
| 2 | 3-Agenten-Workflow | `feedback_3agent_workflow.md`; HANDOVER-MAIN §7 | — (Prozess) |
| 3.1 | Zwei Umgebungen | `project_two_env_server_architecture.md`; `project_a5_localhost_shutdown.md` | Compose-Dateien (nas-setup) |
| 3.2/3.3 | Worktree / Branch | `feedback_worktree_separation.md`; `feedback_main_only_session.md`; `feedback_nas_umzug_branch.md` | `git worktree list`, `git branch -vv` |
| 4 | Versionierung | `CLAUDE.md` projekt §6 | `.husky/post-commit`, `scripts/increment-version.mjs` |
| 5 | Deploy / Rollout / Governance | `feedback_deploy_workflow.md`; `feedback_prod_only_via_dev_promotion.md`; `feedback_rollout_manifest.md` | `scripts/generate-rollout-manifest.mjs`; `scripts/deploy-prod.sh` (nas-setup) |
| 6 | Qualitätssicherung | `CLAUDE.md` projekt §7; HANDOVER-MAIN §8 | `.husky/pre-commit`, `server/vitest.setup.ts` |
| 7.1 | eine Wahrheitsquelle | `project_umsatzchart_task.md`; HANDOVER-MAIN §8 | `client/src/lib/monthlyFinancials.ts` |
| 7.2 | Geld = Cents | `CLAUDE.md` projekt §5 | `drizzle/schema.ts` |
| 7.3 | Zeitzone Warsaw | `CLAUDE.md` global §4; HANDOVER-MAIN §8 | `shared/dateStichtag.ts` |
| 7.4 | Datenschutz | `CLAUDE.md` projekt §10 | `client/src/lib/provision.ts`, `Reports.tsx` |
| 7.5 | Migrationen | `CLAUDE.md` projekt §5 | `drizzle/*.sql`, `drizzle/schema.ts` |
| 7.6 | Backup | `CLAUDE.md` projekt §8 | `server/backup.ts` |
| 7.7 | NBP-Kurse | `CLAUDE.md` global §5, projekt §9/§12 | `server/nbp.ts` |
| 7.8 | Laufzeit-Konfiguration | `project_app_env_label_runtime_title.md` | `server/_core/envLabel.ts` |
| 8 | Phasen-Rollout | `CLAUDE.md` projekt §11 | Git-Tags (`vX.Y.Z-phaseN-done`) |
| 9 | Wissens-System | `CLAUDE.md` projekt §13; `feedback_handover_entry_prompt.md` | `HANDOVER-*.md`, `MEMORY.md` |
| 10 | Lessons Learned | HANDOVER-MAIN §8; `project_*`-Memory | jeweiliger Beleg-Code (§7.x, §10.x) |
| 11 | Eskalation / Governance | HANDOVER-MAIN §7; `feedback_*` | — |
| 12 | Werkzeug-Stack | `CLAUDE.md` projekt §1 | `package.json`; Compose/Dockerfile (nas-setup) |
| 13 | Zielausprägung | `project_two_env_server_architecture.md`; `docs/DEPLOYMENT-BLUEPRINT.md` | — (Zielbild) |

---

*Dieses Dokument lebt im Repo (`main`, `docs/`) und ist mit dem Code versioniert. Änderungen werden wie
normaler Code committet (Auto-Bump greift). Es ersetzt keine der Quelldateien, sondern konsolidiert sie —
**bei Konflikt gilt die Verlässlichkeits-Hierarchie aus Anhang A.1** (Code › `CLAUDE.md` › Handover ›
Memory). Anhang A wird bei jeder inhaltlichen Änderung mitgepflegt, damit die Selbst-Validierbarkeit
erhalten bleibt.*
