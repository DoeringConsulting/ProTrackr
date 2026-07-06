# HANDOVER — ProTrackr Main-Entwicklungslinie (Sitzungs-Übergabe)

> Self-contained Übergabe für die **main-Welt** von ProTrackr. Eine neue Main-Sitzung
> kann allein auf Basis dieses Dokuments + der Memory-Dateien lückenlos weiterarbeiten.
> **Stand: 2026-07-06 · Release v2.3.3 · origin/main synchron.**
> Pendant: `HANDOVER-NAS-SETUP.md` (Branch `nas-setup`, NAS-Welt, eigener Chat).

---

## 0. SOFORT-EINSTIEG (TL;DR)

- **Wo:** Worktree `C:\Projects\ProTrackr_main`, Branch **`main`** (ausschließlich). NIE in
  `ProTrackr_developing_path` (= `nas-setup`, NAS-Welt).
- **Stand:** main-HEAD **v2.4.4** (reine Handover-Doku-Bumps), App-Release **v2.4.0** — **komplett
  LIVE AUF PROD (2026-07-06)**. Baum sauber, Drift `0 0`. Alle Workstreams dieser Sitzungsreihe sind
  **live**:
  1. **APP_ENV_LABEL Runtime-Titel** (v2.1.28) — live auf Prod (Prod-Tab-„(DEV)"-Bug behoben).
  2. **Umsatzentwicklung-Chart** (v2.2.0 → **v2.3.0**) — live auf Prod.
  3. **Zeitumsatz-Tooltip** (v2.3.3) — **live auf Prod** (im v2.4.0-Rollout).
  4. **§6.2-Aufräumaufgaben — live auf Prod (v2.4.0):** (a) **TZ-Kohärenz** (v2.3.5, `warsawDateKey`);
     (b) **persistenter MySQL-Session-Store** (v2.4.0, `express-mysql-session` + Migration
     `0025_sessions`) — Abnahme bestanden (Login überlebt Container-Restart).
- **Nichts offen, nichts blockiert.** v2.4.0 wurde über den Dev-Loop bit-identisch nach Prod promotet
  (Prod v2.3.0 → v2.4.0, Image `91e956650dd9`); Migration `0025` auf Dev+Prod angewandt. **Erster
  NAS-Rollout mit Schema-Change** — sauber durch (Backup → Migration → verify → deploy).
- **Offen auf main:** derzeit **nichts** Priorisiertes. Der TZ-Restpunkt (Scheduler-Monatstrigger +
  db.ts-Range-Filter, server-lokal) ist über die **Container-TZ** abgesichert — **User-Check 2026-07-06
  bestätigt beide Container `CEST`** (Europe/Warsaw), §6.1/§6.2. Einziger Rest-Kandidat: `sessionStore.close()`
  beim Shutdown (unkritisch, Prozess terminiert ohnehin).
- **Deploy (nach A5):** committen + `git push origin main` (Hook bumpt Version + baut `dist/`,
  **kein** Restart) → **Rollout-Manifest** erzeugen + committen + **Tag** `v<version>`; NAS-Deploy
  getrennt im **NAS-Chat** via `/nas-rollout`. Siehe §3, [[feedback_deploy_workflow]],
  [[feedback_rollout_manifest]].

## 1. WIEDEREINSTIEGS-PROZEDUR (zuerst in der neuen Sitzung)

1. **Branch/Worktree prüfen:** `cd C:\Projects\ProTrackr_main` → `git branch --show-current`
   == `main`; `git fetch origin`; Drift `git rev-list --left-right --count origin/main...HEAD`
   == `0 0`; HEAD-Version == 2.4.0 oder neuer.
2. **Memory lesen:** `MEMORY.md` + verlinkte Einträge, v.a. [[feedback_deploy_workflow]]
   (nach A5!), [[feedback_worktree_separation]], [[feedback_3agent_workflow]],
   [[feedback_prod_only_via_dev_promotion]], [[project_umsatzchart_task]],
   [[project_app_env_label_runtime_title]].
3. **Dieses Handover lesen.**
4. **Nächster Schritt:** siehe §6. Kein main-Blocker; die NAS-Dev-Abnahme + Prod-Promotion von
   **v2.4.0** (inkl. Migration `0025` + neue Dependency) läuft im **NAS-Chat**. §6.2 (a+b) erledigt.

## 2. PROJEKT-KONTEXT (Stack)

ProTrackr = Projekt-/Abrechnungs-/Reisekosten-Management (DÖRING Consulting, Mandant `dc001`).

- **Frontend:** React + Vite + TypeScript (`client/`). UI unter `@/components/ui` (Radix),
  Charts **`recharts`**, Routing `wouter`.
- **Backend:** tRPC + Express, per esbuild zu `dist/index.js` gebündelt (ESM) (`server/`).
  Entry `server/_core/index.ts`; Static/SPA-Serving `server/_core/vite.ts` (`serveStatic` prod,
  `setupVite` dev).
- **DB:** MySQL via Drizzle (`drizzle/schema.ts`, Migrationen `drizzle/*.sql`, aktuell bis
  `0024_expenses_customer_id.sql`). **Geld = int Cents**; Wechselkurse = Zehntausendstel;
  `manDays` = Tausendstel; `hours` = Minuten. **Zeitzone Europe/Warsaw** — Monatsgrenzen als
  String bauen (`${y}-${mm}-01`), NIE `toISOString` (kippt auf Vortag).
- **Tooling:** pnpm; husky. **pre-commit** = `tsc` + `vitest` (2 Dateien: `taxEnginePl.test.ts`
  + `uiValidationReportsDashboard.test.ts`; braucht DB nur für den Fixture-Cleanup). **post-commit**
  = Auto-Version-Bump (conventional commits: `feat!`/BREAKING→major, `feat`→minor, sonst→patch)
  + Production-Build + `git --amend` (**kein Restart**, A5).

## 3. BRANCH-/WORKTREE-DISZIPLIN + DEPLOY-WORKFLOW

**Worktrees:**
- `C:\Projects\ProTrackr_main` → **`main`** — DIESE (App/Main-)Welt.
- `C:\Projects\ProTrackr_developing_path` → **`nas-setup`** — NAS-Welt (eigener Chat, NIE hier).
- `C:\Projects\ProTrackr` → git store (detached HEAD).

**Deploy (nach A5, 2026-07-03):** localhost:3001 aus, NAS = einzige laufende Instanz
(Prod `:9443` / Dev `:9444`).
1. Auf `main` committen (Hook bumpt + baut `dist/`, kein Restart).
2. `git push origin main`.
3. **Rollout-Manifest**: `node scripts/generate-rollout-manifest.mjs --notes "…"` →
   `.claude/rollouts/<version>.json` committen (Manifest-Commits bumpen NICHT, post-commit-
   Exemption) + **Tag** `git tag -a v<version>` + `git push origin v<version>`.
4. **NAS-Deploy** getrennt im **NAS-Chat** via `/nas-rollout` (dev → Abnahme → Prod-Promotion).

**⚠ Post-A5-Commit-Stolperfalle:** `MySQL84` ist Manual/aus → der pre-commit-**Fixture-Cleanup**
scheitert (`ECONNREFUSED 127.0.0.1:3306`), NICHT die Tests. Lösung: **`SKIP_TEST_CLEANUP=1
git commit …`** (client-only/Nicht-DB-Fixes; Tests laufen normal) ODER `Start-Service MySQL84`
(Admin-PowerShell) vor Commits mit DB-Fixtures. Nach Push ggf. `git checkout -- client/public/sw.js`
(Build-Artefakt-Drift). Drift danach `0 0` prüfen.

## 4. AKTUELLER STAND (v2.3.0)

**Frühere Basis:** task_bba37780 (Reisekosten-Berichte) komplett + LIVE auf Prod (v2.1.22).
Fehler #1/#2/#3, Backlog P1/P2/P4/P5, A5-localhost-Shutdown, NAS-Rollout-Tooling + Blueprint —
alles erledigt.

### 4.1 APP_ENV_LABEL Runtime-Titel — ✅ KOMPLETT (main+NAS live Prod)
- **main `abe2383` (v2.1.28)**, Tag `v2.1.28`, Manifest `2.1.28.json`. **NAS `feee5ae`**, Tag
  `nas-rollout/2.1.28`, dev→prod bit-identisch (Image `8151af1e87c4`).
- Behebt: Prod-Tab zeigte fälschlich „ProTrackr (DEV)" (build-time `VITE_APP_TITLE` wurde bit-
  identisch nach Prod promotet). Fix: Titel zur **Laufzeit** — Server injiziert
  `window.__APP_ENV_LABEL__` (aus `process.env.APP_ENV_LABEL`, KEIN `VITE_`-Prefix) vor `</head>`
  (`server/_core/envLabel.ts`, verdrahtet in `vite.ts`); Client `client/src/lib/appTitle.ts`
  `computeAppTitle` in `main.tsx`. `VITE_APP_TITLE` (T3a) entfernt. Env-Werte: NAS setzt
  `APP_ENV_LABEL=DEV` in `compose.dev.yml`, Prod unset. Referenz [[project_app_env_label_runtime_title]].

### 4.2 Umsatzentwicklung-Chart — ✅ LIVE AUF PROD (v2.3.0) + Zeitumsatz-Tooltip (v2.3.3, main)
Datei `client/src/pages/Dashboard.tsx`, Funktion `buildRevenueChart`. **Kein Datenleck**
(Dashboard = user-internal; Netto/Provision dürfen dort).
- **Geteilte Wahrheitsquelle** `client/src/lib/monthlyFinancials.ts` (`computeMonthlyAmounts`,
  `computeMonthlyDisplayRevenue`, `isBillableExclusiveTravel`) — von **Reports.tsx UND
  Dashboard** genutzt (verhindert die Divergenz-Bug-Klasse). `taxEnginePl.ts` neu
  `computeMonthlyTaxSeries` (Pro-Monat), `aggregateMonthlyTaxResults` verhaltensgleich darauf.
- **Inhalt:** Bruttoumsatz (Zeit + exklusive Reisekosten), Nettogewinn-Linie (voller Netto =
  Buchhaltungsbericht-Logik, in PLN gerechnet → Zielwährung, negativ möglich), optionale
  Zeitumsatz-Referenz; Umschalter Monatlich/Kumuliert; nur im vereinheitlichte-Währung-Modus.
- **Release-Historie (alle main, gepusht):**
  - `f110801` **v2.2.0** — Feature (Reisekosten im Umsatz, Monatlich/Kumuliert, Netto-Linie).
  - `934be80` **v2.2.2** — **BUGFIX (Dev-Abnahme):** Chart im unified-Modus komplett leer.
    Ursache = **recharts findet `<Line>`-Serien NICHT in einem React-Fragment `<>…</>`** →
    Serien als **Array** übergeben. (Reine Render-Sache; Datenlogik war korrekt.)
  - `49bcb0c` **v2.2.3** — Feinschliff: `<XAxis interval={0}>` (alle 12 Monatslabels, recharts
    dünnte „Juni" weg); ReferenceLine y=0.
  - `0d361fe` **v2.3.0** — Default-Ansicht **12M / monatlich / PLN**; Y-Achse Tausender-Format
    mit Währungssymbol (`250000 → 250k€/zł/$/£/CHF`, via `CURRENCY_SYMBOLS`); Null-/Break-even-
    Linie dunkelgold `#b98847` gestrichelt (statt Netto-Gelb). **LIVE AUF PROD** (Image `af97e6786e65`).
  - `8cbe589` **v2.3.3** — **Zeitumsatz-Tooltip:** lucide-`Info`-Icon am Zeitumsatz-Toggle,
    Radix-Tooltip als `UiTooltip` aliased (recharts exportiert ebenfalls `Tooltip`). Erklärt:
    Zeitumsatz = Umsatz aus Arbeitszeit ohne RK, Abstand zur Brutto-Linie = exklusive RK.
    Fragment-Lesson beachtet (Serien-Array unangetastet). Nur main, Prod-Promotion offen.
- Referenz [[project_umsatzchart_task]] (inkl. recharts-Fragment-Lesson).

### 4.3 Version/Prod-Stand
- **origin/main-HEAD = v2.4.4** (Doku-Bumps); letzter **App-Release = v2.4.0**. Manifeste: `2.1.28`,
  `2.2.0`, `2.2.2`, `2.2.3`, `2.3.0`, `2.3.3`, `2.3.5`, `2.4.0`.
- **PROD (NAS :9443) = v2.4.0** (2026-07-06, Image `91e956650dd9`) — Tooltip + TZ-Fix + Session-Store
  live; Migration `0025` angewandt; APP_ENV_LABEL-Titel-Garantie intakt. **Prod + Dev beide v2.4.0, healthy.**

## 5. VERHÄLTNIS ZUR NAS-WELT

- **`main` = Entwicklungslinie** (App-Code, Tooling, Docs). **`nas-setup` = Deploy/Infra**
  (Docker/compose/migrate — NAS-only, nicht auf main).
- **Sync:** `main → nas-setup` kontrolliert via `/nas-rollout` (Manifest pinnt einen Commit;
  Ziel `dev`/`prod`). **NIEMALS `nas-setup → main`** ohne Freigabe ([[feedback_nas_umzug_branch]]).
- **Governance:** PROD nur via Dev→Test→Freigabe→Promotion ([[feedback_prod_only_via_dev_promotion]]).
- Vollplan `docs/DEPLOYMENT-BLUEPRINT.md`.

## 6. OFFENE PUNKTE / NÄCHSTE SCHRITTE

### 6.1 NAS-Nachzug v2.4.0 — ✅ ERLEDIGT, LIVE AUF PROD (2026-07-06)
v2.4.0 ist über den Dev-Loop ausgerollt und **bit-identisch nach Prod promotet** (Prod v2.3.0 → v2.4.0,
Image `91e956650dd9`). Enthält kumulativ: Zeitumsatz-Tooltip (v2.3.3), TZ-Kohärenz (v2.3.5) und den
persistenten Session-Store (v2.4.0). **Erster NAS-Rollout mit Schema-Change:** Migration
`0025_sessions.sql` auf Dev **und** Prod angewandt (Backup → Migration → verify → deploy); neue
Dependency `express-mysql-session` beim Image-Rebuild gezogen (`createDatabaseTable:false` → Tabelle
war vor App-Start da). Dev-Abnahme (:9444) grün: Tooltip da, Reports-Default-Monat korrekt,
**Login → Container-Restart → Session überlebt**. Prod + Dev beide v2.4.0, healthy. **Nichts offen.**

**Zeitzonen-Anker — ✅ BESTÄTIGT ERLEDIGT (User-Check 2026-07-06, kein Handlungsbedarf):** Beide
App-Container laufen bereits auf **Europe/Warsaw**: `docker exec protrackr-app date` **und**
`docker exec protrackr-app-dev date` → beide **`CEST`** (22:34 = UTC+2, Warschauer Sommerzeit). Unraid
reicht die Host-TZ hier durch (typ. `/etc/localtime`-Mount). Damit steht der gesamte server-lokale
Zeit-Code auf korrektem Anker: `server/db.ts` Range-Filter (`localDayStartUtc` u.a., produktiv im
Reisekostenbericht) UND `server/scheduler.ts` Monats-Trigger (`isLastDayOfMonth`, `now`). Der v2.3.5-Fix
hatte bereits die *immer*-UTC-Stellen (`toISOString`) TZ-fest gemacht. **Nichts zu tun.** Einzige künftige
Kontrolle: bei Compose-/Container-Änderungen darf `docker exec <app-container> date` **`CEST`/`CET`**
zeigen, nie `UTC`.

### 6.2 Niedrig-prio (main/App-Code) — ✅ ERLEDIGT (v2.3.5 + v2.4.0)
- **(a) TZ-Kohärenz — ✅ v2.3.5 (Commit `cd69da1`, Tag `v2.3.5`).** `server/scheduler.ts`
  `checkMonthEnd`: `expenses`-Monatsgrenzen via `warsawDateKey(firstDay/lastDay)` statt
  `toISOString().slice(0,10)` (UTC-Kippung behoben). `Reports.tsx`: Default `startDate`/`endDate`
  über `warsawDateKey()` statt browser-lokalem `getTodayLocalDate` (entfernt). Senior-APPROVE (beide
  Server-TZ durchgerechnet), 26 Tests grün. **Restpunkt → ✅ abgesichert (2026-07-06):** der Scheduler-
  *Monatstrigger* (`now`, `isLastDayOfMonth`) + die `db.ts`-Range-Filter bleiben server-lokal →
  Anker = **Container-TZ Europe/Warsaw, per User-Check bestätigt** (beide Container `CEST`, §6.1), NICHT
  via Code-Umbau (db.ts bericht-kritisch; Container-TZ deckt Scheduler + db.ts gemeinsam).
- **(b) P3/M1 MySQL-Session-Store — ✅ v2.4.0 (Commit `328aa38`, Tag `v2.4.0`), main-Teil.**
  `express-mysql-session` (+ `@types`) als Dependency; `server/_core/index.ts` nutzt `MySQLStore`
  mit dediziertem `mysql2/promise`-Pool aus `DATABASE_URL` (`createDatabaseTable:false`); Tabelle via
  Migration `0025_sessions.sql` + `schema.ts`. Ohne `DATABASE_URL` Fallback auf In-Memory (lokales
  Tooling). `sessions` bewusst NICHT im Backup. Cast überbrückt @types-Divergenz (Lib nutzt intern
  `mysql2/promise`, laufzeit-verifiziert). tsc + esbuild + 26 Tests grün, Senior-APPROVE.
  **Laufzeit-Beweis (Session überlebt Restart) + Migration `0025` = NAS-Dev→Prod** (§6.1).

### 6.3 Umsatzchart-Nachpolituren
- **Zeitumsatz-Tooltip — ✅ ERLEDIGT (v2.3.3, Commit `8cbe589`).** Info-Icon (lucide `Info`) am
  Zeitumsatz-Toggle in `client/src/pages/Dashboard.tsx`; Radix-Tooltip als `UiTooltip` aliased
  (recharts-`Tooltip`-Namenskonflikt). Text: Zeitumsatz = Umsatz aus abgerechneter Arbeitszeit
  ohne durchgereichte RK, Abstand zur Bruttoumsatz-Linie = exklusive RK (deckt sich mit
  `computeMonthlyDisplayRevenue`: `grossCents − timeCents = travelCents`). 3-Agenten-Loop grün
  (tsc/pre-commit-Tests/Build), Fragment-Lesson beachtet. NAS-Dev-Abnahme + Prod-Promotion §6.1.
- (optional, offen) Y-Achsen-Symbol bei CHF ist „250kCHF" (ohne Leerzeichen, wie spezifiziert);
  Label-Überlappung auf schmalen Viewports ggf. `angle={-45} textAnchor="end"`.

## 7. GOVERNANCE-REGELN (verbindlich)

- **Main-only in diesem Chat** ([[feedback_main_only_session]]); NAS hat eigenen Chat.
- **Kein `nas-setup → main`** ohne Freigabe.
- **Keine direkten PROD-Änderungen** — alles über DEV→Test→Freigabe→Promotion.
- **3-Agenten-Workflow** (Junior→Senior→QA) für ALLE Code-Änderungen ([[feedback_3agent_workflow]]).
  Bei Architektur/Steuer-Logik/Datenverlust → User via AskUserQuestion fragen; bei Styling/Typo →
  im Loop selbst korrigieren.
- **Sprache:** Antworten Deutsch, Code/Identifier Englisch (globale CLAUDE.md).

## 8. LESSONS LEARNED / FALLSTRICKE

- **recharts + React-Fragment:** Serien-Komponenten (`<Line>`/`<Bar>`/`<Area>`) dürfen NIE in
  `<>…</>` gewickelt werden — recharts findet sie dann nicht (0 Linien, keine Y-Domain, KEIN
  JS-Error). Immer als **Array** `[cond && <Line/>, …]` oder direkte Kinder. (v2.2.2-Bug.)
- **recharts ohne Browser diagnostizieren (A5!):** `renderToStaticMarkup` mit `<LineChart
  width={…} height={…}>` (feste Größe, keine ResponsiveContainer) rendert das SVG statisch;
  dann `html.match(/recharts-line-curve/g)` (Linienzahl), tick-value-Count (Y-Achse), `/NaN/`
  (kaputte Koordinaten). So habe ich Fragment-Bug + Domain-Verhalten ohne laufende App verifiziert.
  **Sehr wertvoll**, weil MySQL84 aus ist und die Seiten auth-gated sind → lokal keine echten
  Daten. Faustregel: Datenlogik per Unit-Test + SSR-Repro absichern, **visuelle e2e-Abnahme in
  NAS-Dev**.
- **Netto in PLN rechnen, dann konvertieren:** ZUS/Zdrowotna-Minima sind PLN-definiert.
- **Eine Wahrheitsquelle:** monatliche Amounts-/Attribution-Logik geteilt (`monthlyFinancials.ts`,
  `expenseAttribution.ts`) — die Divergenz-Bug-Klasse dieses Projekts.
- **TZ Europe/Warsaw:** Monatsgrenzen als String, nie `toISOString`.
- **Git Bash (Windows) verhaspelt `git show ref:.claude/…`-Pfade** → PowerShell oder
  `MSYS_NO_PATHCONV=1`.
- **Auto-Version-Hook** bumpt bei JEDEM Nicht-Version-/Nicht-Manifest-Commit auf main. Docs-
  Commits erzeugen „Phantom"-Patch-Bumps — normal für dieses Repo.

## 9. ROLLBACK-/SICHERHEITSPUNKTE

- Alles auf **GitHub `DoeringConsulting/ProTrackr`**, `origin/main-HEAD` = v2.4.4 (App-Release v2.4.0).
  Tags: `v2.1.28`, `v2.2.0`, `v2.2.2`, `v2.2.3`, `v2.3.0`, `v2.3.3`, `v2.3.5`, `v2.4.0`; NAS-Prod-Rollout-
  Tags `nas-rollout/2.4.0` (2026-07-06), `nas-rollout/2.3.0`, `nas-rollout/2.1.28` etc.
- **v2.4.0 war der ERSTE NAS-Rollout mit Schema-Change seit 0024** (live auf Prod): `sessions`-Tabelle
  (Migration `0025`) + neue Runtime-Dependency `express-mysql-session`. **Rollback (falls je nötig):**
  Migration `0025` ist additiv (`CREATE TABLE IF NOT EXISTS`, keine bestehende Tabelle berührt) →
  Roll-back = altes Image (NAS hält 2 Generationen vor: v2.4.0 + v2.3.0); die Tabelle kann bleiben
  (alter Code ignoriert sie). `sessions` ist NICHT im Backup.
- **PROD (NAS :9443) = v2.4.0** (2026-07-06, Image `91e956650dd9`) — alles live: APP_ENV_LABEL,
  Umsatzchart, Tooltip, TZ-Fix, Session-Store. Dev + Prod beide v2.4.0, healthy.

---

*Historische Feature-Übergabe `HANDOVER-UMSATZCHART.md` ist mit v2.3.0 obsolet (Feature fertig) —
nur noch Referenz. `HANDOVER_PHASE3.md` ist Alt-Doku.*
