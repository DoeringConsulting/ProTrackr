# HANDOVER — ProTrackr Main-Entwicklungslinie (Sitzungs-Übergabe)

> Self-contained Übergabe für die **main-Welt** von ProTrackr. Eine neue
> Main-Sitzung kann allein auf Basis dieses Dokuments + der Memory-Dateien
> lückenlos weiterarbeiten. Stand: **2026-07-05, v2.1.22, HEAD `9e82aa3`**
> (task_bba37780 komplett + LIVE auf Prod v2.1.22; dieses Doku-Update bumpt auf v2.1.23).
> Pendant: `HANDOVER-NAS-SETUP.md` (Branch `nas-setup`, NAS-Welt).

## 0. SOFORT-EINSTIEG (TL;DR)

- **Wo:** Worktree `C:\Projects\ProTrackr_main`, Branch **`main`** (ausschließlich).
- **Stand:** v2.1.22 auf main + origin, Baum sauber. **task_bba37780 (Reisekosten-
  Berichte) komplett + LIVE auf Prod** (v2.1.22, Prod-Promotion 2026-07-05,
  bit-identisch). Alles davor erledigt (Fehler #1/#2/#3, Backlog P1/P2/P4/P5,
  K1/2a/2c/TZ, PDF-Original-Beträge). NAS-Rollout-Tooling + Blueprint +
  Manifest-Prozess stehen, A5 komplett. Details §4.
- **Nächste Aufgaben (main/App-Code) — Reihenfolge festgelegt 2026-07-05:**
  1. **`APP_ENV_LABEL` Runtime-Titel (§6.5) ZUERST** — entblockt den wartenden NAS-Chat
     (NAS §6.4 ist **bestätigt auf main blockiert**; Prod-Tab zeigt fälschlich „(DEV)").
     Klein: Runtime-Env server→client + `VITE_APP_TITLE` raus.
  2. **Umsatzentwicklung-Chart (§6.1, v2.2.0)** danach — Konzept abgestimmt, Turnkey-Plan
     in `HANDOVER-UMSATZCHART.md`.
- **Folge-Punkte aus der Prod-Promotion** (§6.2): Punkt 1 Rollback-Cleanup (NAS-Chat),
  Punkt 2 TZ-Kohärenz + Session-Store (main, niedrig-prio), Punkt 3 rollout-Skript-Bug
  (NAS-Chat). **Welt-Trennung: nur Punkt 2 ist main.**
- **Deploy:** committen + `git push origin main`; NAS-Deploy im **NAS-Chat** via
  `/nas-rollout`. **Nach jeder Release: Rollout-Manifest** generieren+committen
  ([[feedback_rollout_manifest]]).

## 1. WIEDEREINSTIEGS-PROZEDUR (zuerst in der neuen Sitzung)

1. **Branch/Worktree prüfen:** `cd C:\Projects\ProTrackr_main` → `git branch
   --show-current` muss `main` sein; `git fetch origin` → sync mit `origin/main`
   prüfen (`git rev-list --left-right --count origin/main...HEAD`).
   NIE in `ProTrackr_developing_path` arbeiten (= nas-setup, NAS-Welt).
2. **Memory lesen:** `MEMORY.md` + verlinkte Einträge, v.a.
   [[feedback_deploy_workflow]] (nach A5 geändert!), [[feedback_worktree_separation]],
   [[feedback_3agent_workflow]], [[feedback_prod_only_via_dev_promotion]].
3. **Dieses Handover lesen.**
4. **Nächste Aufgaben (Reihenfolge 2026-07-05):** ZUERST `APP_ENV_LABEL` Runtime-Titel
   (§6.5 — entblockt NAS §6.4), DANN Umsatzentwicklung-Chart (§6.1, v2.2.0). Beide über
   den 3-Agenten-Workflow + Post-A5-Commit-Ablauf (§3, §6.4). Danach übrige Folge-Punkte
   §6.2.

## 2. PROJEKT-KONTEXT (Stack)

ProTrackr = Projekt-/Abrechnungs-/Reisekosten-Management (DÖRING Consulting,
Mandant `dc001`).

- **Frontend:** React + Vite + TypeScript (`client/`). UI-Komponenten unter
  `@/components/ui` (Radix), Charts `recharts`, Routing `wouter`.
- **Backend:** tRPC + Express, per esbuild zu `dist/index.js` gebündelt (ESM)
  (`server/`). Server-Entry `server/_core/index.ts`.
- **DB:** MySQL via Drizzle ORM (`drizzle/schema.ts`, Migrationen `drizzle/*.sql`,
  aktuell bis `0024_expenses_customer_id.sql`). **Geld = int Cents**, Wechselkurse
  = Zehntausendstel. **Zeitzone Europe/Warsaw (UTC+2)** — Ursache diverser
  `toISOString()`-off-by-one-Bugs (Monatsgrenzen daher als String bauen, nicht
  via toISOString).
- **Tooling:** pnpm; husky-Hooks. **pre-commit** = `tsc` + `vitest` (braucht
  erreichbare MySQL via `DATABASE_URL` in `.env`). **post-commit** = Auto-Version-
  Bump (conventional commits: `feat!`/BREAKING→major, `feat`→minor, sonst→patch)
  + Production-Build (`vite build` + esbuild) + `git --amend`. **Kein Server-
  Restart mehr** (A5, siehe §3/§6).
- **DB-Zugriff:** über `node -e "require('dotenv/config'); const mysql=require('mysql2/promise')…"`.
  DATABASE_URL in Shell-Variablen lesen ist sandbox-geblockt; destruktive DB-
  DELETEs können vom Classifier geblockt werden (nur mit ausdrücklicher User-
  Freigabe + Sicherheits-Recheck, ggf. `dangerouslyDisableSandbox`).

## 3. BRANCH-/WORKTREE-DISZIPLIN + DEPLOY-WORKFLOW

**Worktrees** (`git worktree list`):
- `C:\Projects\ProTrackr_main` → **`main`** — DIESE (App/Main-)Welt.
- `C:\Projects\ProTrackr_developing_path` → **`nas-setup`** — NAS-Welt (eigener
  Chat). Hier NIE anfassen.
- `C:\Projects\ProTrackr` → git store (detached HEAD).

Getrennte Ordner beenden die frühere Branch-Kollision (der auto-version-Hook
einer Session schob den geteilten Ordner sonst auf `main`). Siehe
[[feedback_worktree_separation]].

**Deploy-Workflow (NACH A5, 2026-07-03):** localhost:3001 ist komplett
abgeschaltet, der NAS ist die **einzige laufende Instanz** (Prod
`https://dcs01.taile370c2.ts.net:9443` / Dev `:9444`).
1. Auf `main` committen (Hook bumpt + baut `dist/`, **kein Restart**).
2. `git push origin main` — fertig für die main-Seite.
3. **Deploy auf NAS** getrennt im **NAS-Chat** via `/nas-rollout`.
**Lokal testen:** `npx tsc --noEmit` + `npx vitest run` (schnell, braucht DB);
laufende App ad hoc `npm run dev` oder gegen NAS-Dev `:9444`. Notebook-`MySQL84`
wird gestoppt (StartType Manual) — DB für lokale Tests ggf. erst starten.

**⚠ Post-A5-Stolperfalle (Commits!):** Weil `MySQL84` jetzt Manual/aus ist,
scheitert der **`pre-commit`-Hook** — NICHT an den Tests (die sind grün), sondern
am **DB-Fixture-Cleanup** in `server/vitest.setup.ts` (`ECONNREFUSED
127.0.0.1:3306`). Lösung: **vor Code-Commits `Start-Service MySQL84`**
(Admin-PowerShell); für reine Doku-/Nicht-DB-Commits
**`SKIP_TEST_CLEANUP=1 git commit …`** (überspringt nur den Cleanup, Tests laufen
normal; Skip-Check in `vitest.setup.ts:22` vor dem DB-Connect). Steht auch in
Memory [[feedback_deploy_workflow]].
**Praxis (2026-07-03, P1/P2/P4/P5):** Alle vier Commits liefen problemlos mit
`SKIP_TEST_CLEANUP=1` — die betroffenen Änderungen legten keine DB-Fixtures an,
die 2 pre-commit-Tests sind DB-frei und grün. MySQL84 musste nicht gestartet
werden (A5-Zustand blieb erhalten).

## 4. AKTUELLER STAND

- **Version:** v2.1.22 · **HEAD:** `9e82aa3` (= origin/main, synchron). **task_bba37780
  LIVE auf Prod** (Prod-Promotion 2026-07-05, bit-identisch).
- **Letzte Arbeit (diese Sitzung, 2026-07-03):** Backlog P1/P2/P4/P5 abgearbeitet,
  jeweils Junior→Senior(APPROVE)→QA(tsc + 11 pre-commit-Tests grün), eigener
  Commit + Push:
  - **P1** `c8b9691` (v2.1.12) — Reisekosten-Attribution (`task_bba37780`): 3
    Render-Pfade auf `getExpenseBillingCustomerId` umgestellt, verwaiste
    Direktzuordnungs-Belege als eigene Zeilen (Bildschirm + PDF). Client-only.
  - **P2** `6c7ebe6` (v2.1.13) — `server/_core/index.ts`: rateLimit-keyGenerator
    IPv6-sicher via `ipKeyGenerator(req.ip ?? "")` (behebt `ERR_ERL_KEY_GEN_IPV6`).
  - **P4** `2924665` (v2.1.14) — `client/src/main.tsx`: `VITE_APP_TITLE`-Konsum
    verdrahtet (`document.title`, zwingender Fallback). NAS-Nachzügler: T3b.
  - **P5** `ee6cd2b` (v2.1.15) — `scripts/generate-version.js`: environment-Default
    `development`→`production` (kosmetisch, kein Konsument des Feldes).
- **task_bba37780-Nachbesserung (2026-07-04, `5196a72`, v2.1.17):** Dev-Abnahme
  v2.1.15 fand 3 Folgefehler; behoben in einem Commit (3-Agenten-Workflow,
  Senior-APPROVE, tsc + 25 DB-freie Tests + esbuild-Bundle grün):
  - **K1 Kurs-Stichtag:** bei Zukunfts-Leistungsdatum (laufender Monat) lief der
    NBP-Call auf ein Zukunftsdatum → 404-Kaskade → stale Notfall-Kurs. Neuer Helper
    `shared/dateStichtag.ts` (`capRateStichtagKey`, min(jüngstes, gestern), Polish-
    VAT §9), Client (`reportStichtag`+Label) + Server (`rateStichtag` in
    `routers.ts:resolveForReportDate`, ersetzt `stichtag` vor beiden NBP-Calls).
  - **2a Doppelzählung:** exclusive-RK zählten als Umsatz UND Kosten; jetzt via
    `isBillableExclusiveTravel` aus `variableCostsPln`/`variableCostsByCurrency`
    ausgeschlossen. Steuer-Engine (`getMonthlyAmounts`) unangetastet (netto null).
  - **2c Chronologie:** neuer getesteter Row-Builder
    `client/src/lib/customerReportRows.ts` (RK an Tages-Erst-Eintrag, reine RK-Tage
    eigene chronologische Zeile, jeder Beleg genau einmal) in UI/Kostenaufstellung-
    PDF/Excel; `customerEntries` aufsteigend sortiert (PDF+Timesheet konsistent).
  - **B (Rundung) verworfen:** die 0,66-EUR-Divergenz war Symptom von K1, keine
    Doppel-Rundung — der zunächst geplante Single-Rundungs-Fix entfiel.
- **TZ-Fix (2026-07-04, `13f64f1`, v2.1.19):** „heute/gestern" für den Kurs-Stichtag
  wurde per UTC (`toISOString`) bzw. browser-lokal bestimmt → im Fenster 00:00–02:00
  Warschau (UTC+1/+2) Off-by-one, Cap 1 Tag zu früh. Neue gemeinsame
  `shared/dateStichtag.ts` `warsawDateKey()` (Intl/Europe-Warsaw, DST-sicher,
  `RangeError` bei Invalid Date) an allen 3 Stellen (Server `resolveForReportDate` +
  „Kurse von NBP abrufen"; Client `reportStichtag`) → Client+Server konsistent
  Warschau. 4 Tests, Senior-APPROVE. **Offen (niedrig-prio, separat):** `Reports.tsx`
  Default-Monatsgrenzen (`startDate`/`endDate`) + `scheduler.ts` Monatsend-
  Notification bleiben browser-lokal/UTC — TZ-Kohärenz-Folge-Ticket-Kandidaten.
- **PDF-Original-Beträge + Manifest-Prozess + Version-Konsistenz (2026-07-04/05):**
  Kostenaufstellung-PDF zeigt je Reisekostenbeleg den Original-Betrag in Original-
  Währung (`4053c24`/Tag v2.1.21). Rollout-Manifest-Prozess etabliert
  (`.claude/rollouts/<version>.json` via `scripts/generate-rollout-manifest.mjs`;
  post-commit nimmt Manifest-Commits vom Bump aus → kein Phantom-Bump,
  [[feedback_rollout_manifest]]) — aktuelle Release **v2.1.22** (`9e82aa3`, Tag
  v2.1.22), Manifest `2.1.22.json`. Danach NAS-Chat: Dev-Abnahme bestanden +
  **Prod-Promotion v2.1.22 (2026-07-05)** → task_bba37780 abgeschlossen.
- **Davor (Kontext):** Fehler #2 komplett live auf **v2.1.0** (`v2.1.0-phase3c-done`);
  Tech-Debt aggregateByCustomer entfernt (v2.1.1); NAS-Rollout-Tooling +
  Deployment-Blueprint (v2.1.2–v2.1.8); A5-Hook-Schritt (v2.1.9).
- **Freeze-Tags:** letzter Feature-Freeze `v2.1.0-phase3c-done`; v2.1.1–v2.1.15
  sind Tooling/Docs/Chore + kleine Fixes (kein Schema-Change).

## 5. VERHÄLTNIS ZUR NAS-WELT

- **`main` = Entwicklungslinie** (App-Code, Tooling, Docs). **`nas-setup` =
  Deploy/Infra** (Docker, `docker-compose.yml`, `Dockerfile`, migrate-Skripte —
  NAS-only-Dateien, nicht auf main).
- **Sync-Modell:** `main → nas-setup` **kontrolliert** über das `/nas-rollout`-
  Tooling (Manifest pinnt einen Commit; Ziel `dev`/`prod`). Das Tooling liegt auf
  `main`; der NAS-Chat liest es via `git show origin/main:…`.
- **NIEMALS `nas-setup → main`** ohne ausdrückliche Freigabe (siehe
  [[feedback_nas_umzug_branch]]).
- **Zielarchitektur:** zwei Server-Umgebungen (Prod :9443 / Dev :9444) auf Unraid
  **7.3.1**, Image-Promotion Dev→Prod. Vollplan `docs/DEPLOYMENT-BLUEPRINT.md`.
  Governance: PROD nur via Dev→Promotion ([[feedback_prod_only_via_dev_promotion]]).
- **Offene NAS-Nachzügler aus dieser main-Sitzung** (im NAS-Chat abzuarbeiten):
  1. **Erneute Dev-Abnahme der task_bba37780-Nachbesserung** (v2.1.19) in NAS-Dev
     `:9444`, Kunde exclusive, laufender Monat 07/2026. Prüfen: (a) „Angewendete
     Wechselkurse"-Box zeigt Stichtag ≠ Zukunft (letzter Werktag vor heute, nicht
     3.6/3.7 bei Stichtag 31.7) — inkl. TZ: bei Bericht-Erstellung 00:00–02:00
     Warschau kein zusätzlicher Tag-Rückfall; (b) abrechenbare RK NICHT mehr doppelt (Umsatz vs.
     „Variable Kosten"); (c) Kundenbericht-Detail/PDF/Excel chronologisch, verwaiste
     RK-Belege in Tages-/eigener Zeile (nicht mehr hinten/0,00). Belege 580 (flight
     20000 EUR) + 581 (taxi 25600 PLN), Kunde 278, `date=2026-07-02`. Danach
     `task_bba37780` schließen.
  2. **P4-T3b (ABGELÖST):** der frühere build-arg-Ansatz für `VITE_APP_TITLE` wird
     **verworfen** — er ist die Ursache des „(DEV)"-auf-Prod-Bugs (build-time-Label bei
     bit-identischer Image-Promotion). Ersetzt durch das **Runtime-Label `APP_ENV_LABEL`**
     (main-Anteil in §6.5; NAS-Chat entfernt T3b + setzt die Env-Werte pro Umgebung).

## 6. OFFENE PUNKTE / NÄCHSTE SCHRITTE

task_bba37780 ist abgeschlossen + LIVE auf Prod (§4). **Nächste main/App-Code-Aufgaben,
Reihenfolge festgelegt 2026-07-05: ZUERST `APP_ENV_LABEL` Runtime-Titel (§6.5) — entblockt
den wartenden NAS-Chat (NAS §6.4 bestätigt blockiert) —, DANN der Umsatzentwicklung-Chart
(§6.1, v2.2.0).** Dazu Folge-Punkte aus der Prod-Promotion (§6.2). Rahmen-Regeln §6.4.

### 6.1 — Umsatzentwicklung-Chart erweitern (PRIMÄR, main/App-Code)
> **STATUS 2026-07-05 (gesichert, pausiert; jetzt 2. Aufgabe — NACH §6.5 APP_ENV_LABEL):**
> Code-Analyse abgeschlossen, **noch kein Code geschrieben**. Entscheidungen **gelockt**: (1) **Option 1** — geteiltes Modul
> `client/src/lib/monthlyFinancials.ts` in Dashboard UND Reports; (2) Version **v2.2.0
> (MINOR)**, Commit `feat(dashboard): …`. **Turnkey-Umsetzungsplan (startklar ab
> 2026-07-06): `HANDOVER-UMSATZCHART.md`** (committet). Fortsetzung: dort §4 abarbeiten.

**Konzept mit User abgestimmt (2026-07-05, Mockup gezeigt).** Datei
`client/src/pages/Dashboard.tsx`, Funktion `buildRevenueChart` (~Z.168, nutzt heute
NUR `entry.calculatedAmount` = reiner Zeitumsatz, keine Reisekosten).

Finaler Konzept-Stand:
| Aspekt | Festlegung |
|---|---|
| Anf. 1 — Reisekosten im Umsatz | Bruttoumsatz = Zeitumsatz + exklusive RK (`costModel="exclusive"`); Attribution via `getExpenseBillingCustomerId` (wie Buchhaltungsbericht). Nicht-exclusive RK bleiben Kosten. |
| Anf. 2a — Monatlich/Kumuliert | Umschalter; kumuliert = laufende Summe im Zeitfenster, Start 0. |
| Anf. 2b — Nettogewinn-Linie | Voller Netto: Umsatz (inkl. exkl. RK) − variable Kosten (Reisekosten/Spesen) − **fixe Monatskosten** (`fixedCosts`: Internet/Leasing/ChatGPT) − Provision − ZUS/Kranken/Steuer. Logik = Buchhaltungsbericht. |
| Währungsmodus | Netto-Linie NUR im vereinheitlichte-Währung-Modus (Netto = eine abgeleitete Größe). |
| Negativer Netto | zeigen (Anlaufmonate mit Fixkosten, ohne Umsatz). |
| Zeitumsatz-Referenz | optionaler Toggle (gestrichelt), default AUS. |
| Default-Ansicht | Brutto + Netto an, Zeit aus, Monatlich. |

**Umsetzungs-Hinweise (wichtig):**
- Die Netto-Infrastruktur existiert schon: `buildCostChart` (~Z.400) nutzt
  `aggregateMonthlyTaxResults` mit monatlichen Beträgen. ABER dessen `getMonthlyAmounts`
  hat 2 Lücken ggü. dem Buchhaltungsbericht: (a) **exklusive RK fehlen im Umsatz**,
  (b) **Provision fehlt in den Kosten**. Fixkosten sind drin.
- Netto-Linie EXAKT auf die Buchhaltungsbericht-Logik ausrichten
  (`calculateAccountingReport` in `Reports.tsx`, dortige `getMonthlyAmounts`) — **eine
  Wahrheitsquelle**. Empfehlung: die monatliche „amounts pro Monat"-Logik in ein
  shared lib extrahieren, das Dashboard UND Reports nutzen (damit sie nicht
  divergieren — genau die Bug-Klasse, die wir mehrfach gefixt haben).
- Attribution-Maps (`entriesById`, `customerIdsByDate`) im Dashboard bauen (wie in
  Reports.tsx), für `getExpenseBillingCustomerId`.
- Kein Datenleck-Thema (Dashboard = user-internal; Provision/Netto dürfen dort).
- Aufwand moderat (mehrere Stellen in Dashboard.tsx). 3-Agenten-Workflow. Mockup +
  Abstimmung liegen im Chat-Verlauf dieser Sitzung.

### 6.2 — Folge-Punkte aus der Prod-Promotion v2.1.22 (2026-07-05)
**Welt-Trennung:** nur **Punkt 2** ist App-Code (main). Punkt 1 + 3 laufen im
**NAS-Chat** — hier nur erfasst/priorisiert, NICHT hier umsetzen.
**Priorität:** Chart (§6.1) = P1. Dann Punkt 2 (main, niedrig-prio). Punkt 1 + 3 im
NAS-Chat nach User-Entscheidung.

- **Punkt 1 — Rollback-Netz / Cleanup (NAS-Chat; User entscheidet):** Nach der
  Prod-Promotion v2.1.22 stehen als Rollback-Netz `prod-pre-promote-2026-07-05_17-47-17.sql`
  + Image `protrackr-app:rollback-2026-07-05` (+ ältere NAS-Backups `prod-pre-A1-*`,
  `prod-pre-import-*`, Migrations-Dumps). User-Regel: **keine Löschung bis GESAMTER
  Umzug fertig UND alle Bugs gelöst.** Status: weitgehend erfüllt (Phase A komplett,
  task_bba37780 gelöst, T2/T3 gelöst). Zu klären (User): Backups nach ein paar Tagen
  Prod-Stabilität aufräumen? **Ausführung NAS-Chat.**
- **Punkt 2 — TZ-Folgepunkte + Session-Store (main, niedrig-prio):**
  - (a) **TZ-Kohärenz:** `Reports.tsx` Default-Monatsgrenzen (`getTodayLocalDate`/
    `startDate`/`endDate`, ~Z.67-90) sind browser-lokal; `server/scheduler.ts`
    (~Z.32-33) baut die `expenses`-Monatsgrenzen der Monatsend-Notification via
    `toISOString().slice(0,10)` (UTC → für Warschau-Server evtl. Vormonats-Letzter).
    Beide unkritisch für Warschau-Nutzer, aber Kandidaten für
    `shared/dateStichtag.ts` `warsawDateKey` (existiert bereits!).
  - (b) **P3/M1 — MySQL-Session-Store:** `server/_core/index.ts` (~Z.66) nutzt
    `MemoryStore` (Sessions gehen bei Container-Restart/Deploy verloren). Umstellen auf
    `express-mysql-session`; **dedizierter mysql2-Pool aus `DATABASE_URL`** (`db.ts`
    exportiert keinen wiederverwendbaren Pool); `sessions`-Tabelle per echter Migration
    `0025_sessions.sql` + `schema.ts` (nicht `createDatabaseTable:true`); Sessions NICHT
    ins Backup. ~40 Min, unkritisch (Single-User; Login-Verlust pro Deploy zumutbar).
    Laufzeit-Test „Login → Restart → eingeloggt?" nur in NAS-Dev (A5). Neue Dependency
    → NAS-Container-Build muss sie ziehen.
  - **Umsetzungsvorschlag (Punkt 2):** NACH dem Chart. (a) TZ-Kohärenz ist klein +
    risikoarm (nutzt das schon vorhandene `warsawDateKey`) → als eigener kleiner
    3-Agenten-Commit mitnehmen. (b) Session-Store ist Infra + Dependency + DB-Migration
    + Laufzeit-Test (nur NAS-Dev) → eigene fokussierte Runde, **vor Beginn Vorgehen/
    Test-Strategie mit User klären** (bewusst vertagt, unkritisch da Single-User).
    Beides danach über `/nas-rollout` nach Dev/Prod (NAS-Chat).
- **Punkt 3 — `rollout-to-nas.ps1` `-e`-Bug (NAS-Chat):** `scripts/rollout-to-nas.ps1`
  Z.50 `Invoke-Git cat-file -e "$commit^{commit}"` bricht mit „parameter name 'e' is
  ambiguous" ab (PowerShell bindet `-e` an `-ErrorAction`/`-ErrorVariable`); deshalb
  liefen v2.1.20/v2.1.22 über manuellen Merge statt des Skript-Wegs. Fix (klein):
  Array-Splatting `Invoke-Git @('cat-file','-e',"$commit^{commit}")`. **Fix im
  NAS-Chat** (nas-setup-Datei) — hier nur erfasst.

### 6.3 A5 (localhost-Shutdown) — Status
- **Komplett abgeschlossen** (main + NAS): Hook-Restart-Block entfernt (v2.1.9),
  MySQL84 gestoppt/Manual, localhost:3001 aus. NAS = einzige Instanz. Siehe
  [[project_a5_localhost_shutdown]].

### 6.4 Rahmen-Regeln für die Umsetzung (verbindlich)
- **3-Agenten-Workflow** (Junior/Senior/QA) für ALLE Code-Änderungen
  ([[feedback_3agent_workflow]]). Bewährt in dieser Sitzung: präzise Junior-Spec →
  unabhängiger Senior-Review (APPROVE) → QA (tsc + vitest) → Commit → Push.
- **Commit-Ablauf:** `SKIP_TEST_CLEANUP=1 git commit …` reicht für Nicht-DB-Fixes;
  post-commit bumpt + baut + amended (Version-Dateien einfolden, dist/ nicht
  versioniert). Nach Push Drift prüfen (`0 0`); sw.js kann driften → ggf.
  `git checkout -- client/public/sw.js`.
- **Nach main-Änderungen NUR committen + pushen**; NAS-Deploy separat im NAS-Chat
  via `/nas-rollout`; **niemals `nas-setup → main`** ohne Freigabe.

### 6.5 — Runtime-Umgebungslabel `APP_ENV_LABEL` (Prod-Tab zeigt fälschlich „(DEV)")
> **★ ZUERST in der nächsten Main-Sitzung** (Reihenfolge festgelegt 2026-07-05, vor §6.1):
> Der NAS-Chat hat bestätigt, dass **NAS §6.4 auf genau diese main-Aufgabe blockiert** ist
> (`APP_ENV_LABEL` fehlt in origin/main; `VITE_APP_TITLE` noch aktiv `main.tsx:16-17` —
> direkt verifiziert). „Erst main, dann NAS" ist zwingend — NAS darf T3b NICHT vorher
> entfernen (sonst verliert Dev sein „(DEV)"). **Nach main-Push an den NAS-Chat zurückmelden.**

**Herkunft:** NAS-Setup-Sitzung (2026-07-05), main/App-Code-Anteil. **Noch nicht begonnen.**
3-Agenten-Workflow; **vor Code-Commits `Start-Service MySQL84`** (Admin-PowerShell) — dieser
Change hat einen Server-Anteil, ist NICHT rein client-only. Nach main-Push **an die
NAS-Setup-Sitzung zurückmelden**. Verwandt: [[project_app_env_label_runtime_title]].

**Bug:** Der Prod-Tab zeigt „ProTrackr (DEV)". Ursache: `VITE_APP_TITLE` wird **build-time**
in den Client gebacken (NAS-T3b build-arg), und `deploy-prod.sh` promotet das Dev-Image
**bit-identisch** nach Prod → das eingebackene „(DEV)" landet auf Prod. Grundkonflikt:
build-time-Label ↔ bit-identische Image-Promotion. **Ziel:** EIN umgebungsneutrales Image,
Titel zur **Laufzeit** aus der Umgebung (DEV → „ProTrackr (DEV)", PROD → Prod-Titel).
**Löst §5-Nachzügler #2 (P4-T3b build-arg) ab** — der Ansatz wird verworfen.

**Aufgabe (main/App-Code):**
1. Neue **RUNTIME**-Env-Var `APP_ENV_LABEL` (server-lesbar via `process.env`, **KEIN**
   `VITE_`-Prefix). Semantik: leer/ungesetzt = Prod (Prod-Titel); gesetzt (z.B. „DEV") =
   „ProTrackr (<LABEL>)". Die Env-WERTE pro Umgebung (`.env.dev`/`.env`) setzt der NAS-Chat —
   hier nur der Mechanismus.
2. Server exponiert `APP_ENV_LABEL` **zur Laufzeit** an den Client. Sauber bevorzugt:
   (a) `index.html` beim Ausliefern injizieren (Platzhalter / `window.__APP_ENV_LABEL__`),
   ODER (b) kleiner dynamischer Endpoint `/api/app-config` (bzw. `version.json` dynamisch aus
   `process.env`, **falls es aktuell statisch ausgeliefert wird — prüfen**). **Wichtig:**
   RUNTIME aus `process.env`, NICHT build-time (sonst wieder ins Image gebacken).
3. `client/src/main.tsx`: `document.title` aus dem Runtime-Label bauen (das bisherige
   `import.meta.env.VITE_APP_TITLE` **ENTFERNEN**, T3a raus):
   ```js
   document.title = label ? `ProTrackr (${label})` : "Döring Consulting - Projekt & Abrechnungsmanagement";
   ```
4. `client/index.html` `<title>` darf als initialer Fallback der Prod-Titel bleiben (kurz
   sichtbar bis JS greift).
5. `tsc` + `vitest` grün, Senior-APPROVE → committen/pushen + **Rollout-Manifest** erzeugen
   ([[feedback_rollout_manifest]]).

**NICHT anfassen:** NAS-Dateien (`Dockerfile`/`compose.dev.yml`/`.env*`) — T3b-Entfernung +
Env-Werte macht der **NAS-Chat**. Verwandt: §4 P4 (v2.1.14, führte `VITE_APP_TITLE` ein — wird
hier rückgebaut), §8 (VITE_*-Lesson).

## 7. GOVERNANCE-REGELN (verbindlich)

- **Main-only in diesem Chat** ([[feedback_main_only_session]]); NAS hat eigenen
  Chat. Bei Sessionstart Branch prüfen.
- **Kein `nas-setup → main`** ohne Freigabe.
- **Keine direkten PROD-Änderungen** — alles über DEV→Test→Freigabe→Promotion
  ([[feedback_prod_only_via_dev_promotion]]).
- **Sprache:** Antworten Deutsch, Code/Identifier Englisch (globale CLAUDE.md).

## 8. LESSONS LEARNED / FALLSTRICKE

- **Git Bash (Windows) verhaspelt `git show ref:.claude/…`-Pfade** (MSYS
  `:`→`;`, `/`→`\`). → PowerShell nutzen oder `MSYS_NO_PATHCONV=1` voranstellen.
- **Auto-Version-Hook** bumpt bei JEDEM Nicht-Version-Datei-Commit auf main +
  baut `dist/`. `client/public/sw.js` driftet (Build-Artefakt) → nach Push
  `git checkout -- client/public/sw.js`.
- **TZ Europe/Warsaw:** Monatsgrenzen als String (`${y}-${mm}-01`), nie
  `new Date(...).toISOString()` (kippt auf Vortag).
- **Attribution = eine Wahrheitsquelle:** `getExpenseBillingCustomerId` in
  `client/src/lib/expenseAttribution.ts`. Option B: explizite `customerId` gewinnt
  datumsunabhängig; ohne customerId gilt Alt-Logik (timeEntryId), Datums-Fallback
  nur ab Cutover 2026-07-01. `customerData.customerExpensesDetailed` ist bereits
  via diese Funktion gefiltert → Summen stimmen; nur Pro-Zeile-Zuordnung
  (`timeEntryId === entry.id`) verlor „verwaiste" Belege (P1-Fix, 2026-07-03).
- **`import.meta.env.VITE_*`** ist im Client typkonform (Präzedenz `Map.tsx`).
  Für Titel/Fallback `||` statt `??` (fängt auch leeren String ab).

## 9. ROLLBACK-/SICHERHEITSPUNKTE

- Alles auf **GitHub `DoeringConsulting/ProTrackr`**, `origin/main` = `9e82aa3`
  (v2.1.22). Milestones/Tags: `v2.1.21`, `v2.1.22`, `v2.1.0-phase3c-done` etc.
  task_bba37780 live auf Prod; NAS-Rollback-Netz siehe §6.2 Punkt 1.
- Kein Datenverlustrisiko durch die bisherige main-Arbeit — P1/P2/P4/P5 waren
  reine Code-/Config-Fixes ohne Schema-/DB-Eingriff; Tests grün. **P3 wird das
  ändern** (DB-`sessions`-Tabelle + Dependency) → dort vor Umsetzung Backup/Test-
  Strategie festlegen.
- NAS bleibt unberührt, solange kein Rollout im NAS-Chat gefahren wird.
