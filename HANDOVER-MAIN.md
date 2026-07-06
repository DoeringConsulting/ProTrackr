# HANDOVER — ProTrackr Main-Entwicklungslinie (Sitzungs-Übergabe)

> Self-contained Übergabe für die **main-Welt** von ProTrackr. Eine neue Main-Sitzung
> kann allein auf Basis dieses Dokuments + der Memory-Dateien lückenlos weiterarbeiten.
> **Stand: 2026-07-06 · Release v2.3.3 · origin/main synchron.**
> Pendant: `HANDOVER-NAS-SETUP.md` (Branch `nas-setup`, NAS-Welt, eigener Chat).

---

## 0. SOFORT-EINSTIEG (TL;DR)

- **Wo:** Worktree `C:\Projects\ProTrackr_main`, Branch **`main`** (ausschließlich). NIE in
  `ProTrackr_developing_path` (= `nas-setup`, NAS-Welt).
- **Stand:** **v2.3.3** auf main + origin, Baum sauber, Drift `0 0`. Die großen Workstreams
  dieser Sitzungsreihe sind **abgeschlossen**:
  1. **APP_ENV_LABEL Runtime-Titel** (v2.1.28) — **main + NAS live auf Prod**. Behebt den
     Prod-Tab-„(DEV)"-Bug (Titel zur Laufzeit statt build-time).
  2. **Umsatzentwicklung-Chart** (v2.2.0 → **v2.3.0**) — **LIVE AUF PROD** (NAS-Dev-Abnahme
     bestanden, bit-identisch promotet: Prod v2.1.28 → v2.3.0, Image `af97e6786e65`).
  3. **Zeitumsatz-Tooltip** (v2.3.3) — **main fertig** (Info-Icon am Zeitumsatz-Toggle erklärt
     die Linie); **NAS-Dev-Abnahme + Prod-Promotion stehen aus** (Prod = v2.3.0).
- **Nichts blockiert auf main.** Nächste NAS-Aktion: **v2.3.3 auf Dev nachziehen → Prod-Promotion**
  (NAS-Chat, §6.1).
- **Offen auf main (§6.2, niedrig-prio):** (a) TZ-Kohärenz (`scheduler.ts` + `Reports.tsx`
  Default-Monatsgrenzen auf `warsawDateKey`); (b) persistenter MySQL-Session-Store (P3/M1 — DB-
  Migration + Dependency, Vorgehen mit User klären).
- **Deploy (nach A5):** committen + `git push origin main` (Hook bumpt Version + baut `dist/`,
  **kein** Restart) → **Rollout-Manifest** erzeugen + committen + **Tag** `v<version>`; NAS-Deploy
  getrennt im **NAS-Chat** via `/nas-rollout`. Siehe §3, [[feedback_deploy_workflow]],
  [[feedback_rollout_manifest]].

## 1. WIEDEREINSTIEGS-PROZEDUR (zuerst in der neuen Sitzung)

1. **Branch/Worktree prüfen:** `cd C:\Projects\ProTrackr_main` → `git branch --show-current`
   == `main`; `git fetch origin`; Drift `git rev-list --left-right --count origin/main...HEAD`
   == `0 0`; HEAD-Version == 2.3.3 oder neuer.
2. **Memory lesen:** `MEMORY.md` + verlinkte Einträge, v.a. [[feedback_deploy_workflow]]
   (nach A5!), [[feedback_worktree_separation]], [[feedback_3agent_workflow]],
   [[feedback_prod_only_via_dev_promotion]], [[project_umsatzchart_task]],
   [[project_app_env_label_runtime_title]].
3. **Dieses Handover lesen.**
4. **Nächster Schritt:** siehe §6. Kein main-Blocker; ggf. auf NAS-Dev-Abnahme des Umsatzcharts
   warten, danach §6.2 (niedrig-prio) anbieten.

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
- **origin/main = v2.3.3.** Manifeste vorhanden: `2.1.28`, `2.2.0`, `2.2.2`, `2.2.3`, `2.3.0`, `2.3.3`.
- **PROD (NAS :9443) = v2.3.0** (APP_ENV_LABEL + Umsatzchart live, Image `af97e6786e65`). Der
  **Zeitumsatz-Tooltip (v2.3.3) ist noch NICHT auf Prod** — NAS-Dev-Abnahme + Promotion stehen
  aus (Prod springt dann v2.3.0 → v2.3.3).

## 5. VERHÄLTNIS ZUR NAS-WELT

- **`main` = Entwicklungslinie** (App-Code, Tooling, Docs). **`nas-setup` = Deploy/Infra**
  (Docker/compose/migrate — NAS-only, nicht auf main).
- **Sync:** `main → nas-setup` kontrolliert via `/nas-rollout` (Manifest pinnt einen Commit;
  Ziel `dev`/`prod`). **NIEMALS `nas-setup → main`** ohne Freigabe ([[feedback_nas_umzug_branch]]).
- **Governance:** PROD nur via Dev→Test→Freigabe→Promotion ([[feedback_prod_only_via_dev_promotion]]).
- Vollplan `docs/DEPLOYMENT-BLUEPRINT.md`.

## 6. OFFENE PUNKTE / NÄCHSTE SCHRITTE

### 6.1 NAS-Nachzug Zeitumsatz-Tooltip v2.3.3 (NAS-Chat, nicht hier)
Umsatzchart v2.3.0 ist bereits **live auf Prod** (Image `af97e6786e65`). Offen ist nur noch der
**Zeitumsatz-Tooltip (v2.3.3)**: im NAS-Chat `/nas-rollout` auf **Dev** mit **Manifest `2.3.3`**
(Commit `8cbe589`, Tag `v2.3.3`). Abnahme auf `:9444` (unified/PLN): Info-Icon rechts neben dem
Zeitumsatz-Toggle, Hover/Tab-Fokus zeigt den Erklärtext; Chart-Linien unverändert gerendert.
**Danach Prod-Promotion** (Prod v2.3.0 → v2.3.3). Reine Client-UI, keine Migration.
Auf der **main-Seite ist hierfür nichts zu tun** außer ggf. Nachbesserungen aus der Abnahme.

### 6.2 Niedrig-prio (main/App-Code) — nach dem NAS-Nachzug
- **(a) TZ-Kohärenz:** `Reports.tsx` Default-Monatsgrenzen (`getTodayLocalDate`/`startDate`/
  `endDate`) sind browser-lokal; `server/scheduler.ts` (~Z.32-33) baut die `expenses`-Monatsgrenzen
  der Monatsend-Notification via `toISOString().slice(0,10)` (UTC). Beide unkritisch für Warschau-
  Nutzer, aber Kandidaten für das schon vorhandene `shared/dateStichtag.ts` `warsawDateKey()`.
  Klein + risikoarm → eigener kleiner 3-Agenten-Commit.
- **(b) P3/M1 MySQL-Session-Store:** `server/_core/index.ts` (~Z.66) nutzt `MemoryStore`
  (Sessions gehen bei Container-Restart/Deploy verloren). Umstellen auf `express-mysql-session`;
  dedizierter mysql2-Pool aus `DATABASE_URL`; `sessions`-Tabelle per echter Migration
  `0025_sessions.sql` + `schema.ts`; Sessions NICHT ins Backup. Neue Dependency → NAS-Container-
  Build muss sie ziehen; Laufzeit-Test nur in NAS-Dev. **Vor Beginn Vorgehen/Test-Strategie mit
  User klären** (unkritisch, Single-User; Login-Verlust pro Deploy zumutbar).

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

- Alles auf **GitHub `DoeringConsulting/ProTrackr`**, `origin/main` = v2.3.3. Tags: `v2.1.28`,
  `v2.2.0`, `v2.2.2`, `v2.2.3`, `v2.3.0`, `v2.3.3`, `nas-rollout/2.3.0`, `nas-rollout/2.1.28` etc.
- Umsatzchart v2.0→v2.3.0 waren reine Client-/UI-Änderungen (kein Schema-Change seit 0024);
  Tests grün. **P3 (Session-Store) wird das ändern** (DB-`sessions`-Tabelle + Dependency) →
  dort vor Umsetzung Backup/Test-Strategie festlegen.
- PROD (NAS :9443) = v2.3.0 (APP_ENV_LABEL + Umsatzchart live); der Tooltip v2.3.3 folgt via NAS-Chat.

---

*Historische Feature-Übergabe `HANDOVER-UMSATZCHART.md` ist mit v2.3.0 obsolet (Feature fertig) —
nur noch Referenz. `HANDOVER_PHASE3.md` ist Alt-Doku.*
