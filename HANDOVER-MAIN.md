# HANDOVER — ProTrackr Main-Entwicklungslinie (Sitzungs-Übergabe)

> Self-contained Übergabe für die **main-Welt** von ProTrackr. Eine neue Main-Sitzung
> kann allein auf Basis dieses Dokuments + der Memory-Dateien lückenlos weiterarbeiten.
> **Stand: 2026-08-04 · App-Release v2.7.4 (auf main; NAS-Prod-Rollout offen) · origin/main synchron.**
> **Working Tree sauber, Manifest `2.7.4.json` + Tag `v2.7.4` gesetzt.**
> Pendant: `HANDOVER-NAS-SETUP.md` (Branch `nas-setup`, NAS-Welt, eigener Chat).

---

## 0.1 SOFORT ZU TUN (Stand 2026-08-04, Abschluss der Sitzung)

**Nichts Halbfertiges offen.** Working Tree sauber, `origin/main` synchron (Drift `0 0`), HEAD auf
**v2.7.4**, Manifest `.claude/rollouts/2.7.4.json` + Tag `v2.7.4` gesetzt. Der in der Vorsitzung
offene `customerId`-Fix ist reviewt, committet (`b3625d0`, v2.7.3) und gepusht; die Fallgrube wurde
dabei **nicht** getreten (belegt: `routers.ts` nutzt `explicitCustomerIdForRangeCopy(expense)`, null
Vorkommen von `customerId: expense.customerId`).

**Zwei Punkte fällig, beide NICHT im Code offen:**

1. **NAS-Prod-Rollout** (NAS-Chat, `/nas-rollout`). PROD steht weiterhin auf **v2.4.0**, main auf
   v2.7.4 — dazwischen liegen 2.5.0, 2.5.2, 2.5.5, 2.6.0, 2.6.2, 2.6.4, 2.7.0, 2.7.3, 2.7.4.
   Maßgeblich ist Manifest `2.7.4.json` (löst `2.7.3.json` und `2.7.2.json` ab). **Vorbedingung unverändert:** vor dem
   Rollout `node scripts/analyze-expense-attribution.mjs` (read-only) **erneut** fahren — ADR 0002,
   offener Punkt 5 (kategoriefremde Enddaten aus früheren Kategoriewechseln; die Prüfung vom
   2026-08-03 deckt sie nicht ab). **Zusätzlich auf Dev abzunehmen:** der neue Betrags-Hinweis in der
   Reisekosten-Maske wurde **nie visuell geprüft** (lokal läuft seit A5 weder Server noch MySQL) —
   Kilometerpauschale-Beleg öffnen, nur den Kommentar ändern, es darf kein stiller Betragswechsel
   passieren.
2. **Offene Entscheidung des Account-Inhabers** (klein, UX): Bei der **Neuanlage** eines
   Kilometerpauschale-Belegs wird ein eingetippter Betrag weiterhin **ohne Rückmeldung** durch
   km × Pauschale ersetzt — der Speicherpfad ignoriert das Betrag-Feld für diese Kategorie. Das ist
   Alt-Verhalten, aber dieselbe Klasse stiller Überschreibung, gegen die v2.7.4 antritt. Sauberster
   Fix wäre, das Betrag-Feld für `mileage_allowance` auf `readOnly` zu setzen (der berechnete Wert
   steht ohnehin darunter). Beim Bearbeiten ist das Problem seit v2.7.4 gelöst (Hinweis mit altem
   und neuem Betrag).

3. **Legacy-Kommentare im Kategorie-Enum — Entscheidung offen (K14, siehe §6.9).**
   `drizzle/schema.ts` markiert `transport` als „legacy, wird zu taxi migriert" und `food` als
   „legacy, wird zu meal migriert". Beide sind aktiv auswählbar, und `transport` darf seit v2.6.0 ein
   `checkOutDate` tragen — eine Migration nach `taxi` (punktuell, kein Enddatum) erzeugte genau den
   Befundtyp 3, den `analyze-expense-attribution.mjs` sucht. **Nichts tun ohne Entscheidung.**

> **🪤 FALLGRUBE, die weiterhin gilt (nicht wegoptimieren!):** `getAllExpenses` hat **zwei** Zweige,
> die Felder unter **demselben Namen** aus **verschiedenen Quellen** liefern. `customerId`:
> `server/db.ts` verknüpfter Zweig = `timeEntries.customerId` (Kunde des **Eltern-Zeiteintrags**),
> Standalone-Zweig = `expenses.customerId` (die **explizite** Zuordnung). Diskriminator
> `timeEntryId == null` (`isLinkedExpense`). Seit v2.7.4 gilt dasselbe für **`rate`**: der verknüpfte
> Zweig joint `expenses` UND `timeEntries`, **beide** haben eine Spalte `rate` — selektiert wird
> `expenses.rate` (Kilometerpauschale), **nicht** `timeEntries.rate` (Tagessatz). Beide Fallgruben
> sind im Gate per Quelltext-Wächter gepinnt; ein Rückbau wird rot.

---

## 0. SOFORT-EINSTIEG (TL;DR)

- **Wo:** Worktree `C:\Projects\ProTrackr_main`, Branch **`main`** (ausschließlich). NIE in
  `ProTrackr_developing_path` (= `nas-setup`, NAS-Welt).
- **Stand:** main-HEAD **v2.7.x** (laufende Handover-Doku-Bumps, jeder Docs-Commit patcht),
  App-Release **v2.7.4** (2026-08-04), `origin/main` synchron (Drift `0 0`), **Working Tree sauber**.
  Manifest `2.7.4.json` + Tag `v2.7.4` gesetzt.
- **Versionsstände auseinander:** **PROD läuft weiterhin auf `v2.4.0`** (Stand 2026-08-04) — die
  v2.5.0-Promotion wurde nie abgeschlossen. Zwischen Prod und main liegen damit **v2.5.0, v2.5.2,
  v2.5.5, v2.6.0, v2.6.2, v2.6.4, v2.7.0, v2.7.3, v2.7.4**. Ein Rollout bringt alles auf einmal;
  Details §0.1 + §6.7 + §6.8.
  Die Workstreams **bis v2.4.0** sind live auf Prod:
  1. **APP_ENV_LABEL Runtime-Titel** (v2.1.28) — live auf Prod (Prod-Tab-„(DEV)"-Bug behoben).
  2. **Umsatzentwicklung-Chart** (v2.2.0 → **v2.3.0**) — live auf Prod.
  3. **Zeitumsatz-Tooltip** (v2.3.3) — **live auf Prod** (im v2.4.0-Rollout).
  4. **§6.2-Aufräumaufgaben — live auf Prod (v2.4.0):** (a) **TZ-Kohärenz** (v2.3.5, `warsawDateKey`);
     (b) **persistenter MySQL-Session-Store** (v2.4.0, `express-mysql-session` + Migration
     `0025_sessions`) — Abnahme bestanden (Login überlebt Container-Restart).
- **Offen (Kurzliste, Details §0.1):** (1) **NAS-Prod-Rollout** (Prod = v2.4.0, NAS-Chat, Manifest
  `2.7.4.json`; vorher Analyse-Skript erneut fahren — ADR 0002 offene Punkte 3+5; **visuelle Abnahme
  des Betrags-Hinweises auf Dev nachholen**); (2) **664,17 EUR** aus den verfallenen Tickets
  #605/#492 sind **abrechenbar, aber noch nicht nachberechnet** (§6.5, kaufmännisch); (3) kleine
  offene UX-Entscheidung: Betrag-Feld bei **Neuanlage** einer Kilometerpauschale wird still
  überschrieben (§0.1 Punkt 2). — **Erledigt in dieser Sitzung:** `customerId`-Fix reviewt +
  released (v2.7.3), Manifest + Tag für 2.6.4/2.7.0 nachgeholt, Berechnungsgrundlage und
  KI-Freigabe-Zuordnung gefixt (v2.7.4).
- **Historie:** v2.4.0 wurde über den Dev-Loop bit-identisch nach Prod promotet
  (Prod v2.3.0 → v2.4.0, Image `91e956650dd9`); Migration `0025` auf Dev+Prod angewandt. **Erster
  NAS-Rollout mit Schema-Change** — sauber durch (Backup → Migration → verify → deploy).
- **Zuletzt erledigt auf main:** (a) **v2.5.0** Dashboard-Backlog (§6.4) — „Rechnungen"-Kachel +
  Umsatzentwicklung-**Prognose-Toggle**; (b) **v2.5.2** (§6.5) **Reisekosten-Zeitraum-Zuordnung vereinheitlicht**
  (Divergenz Report/Dashboard + Doppelzählung behoben, ADR `docs/adr/0001`).
  **Direkt danach fachlich nachgeschärft (§6.5, ✅ v2.5.5):** maßgeblich ist das
  **Leistungsende `checkOutDate ?? date`** statt `expense.date` — ADR `docs/adr/0002` **supersedes 0001**;
  (c) **v2.6.0** (§6.6) **Phase 2** — Leistungsende auch für **mehrtägige Belege** erfassbar
  (`car`/`train`/`transport`/`other`), ohne Schema-Change; dabei zwei Defekte gefixt (Kategoriewechsel
  räumte Datumsfelder nie; Rückflugdatum nicht löschbar) und die Validierung „Ende ≥ Start"
  kategorienunabhängig gemacht.
  (d) **v2.6.2** Cleanup (tote Erfassungsmasken entfernt, separate Session); (e) **v2.6.4 + v2.7.0**
  (§6.7) **Purge- und Kopier-Konsistenz** — Zurücksetzen folgt dem Leistungsende, „Zeitraum kopieren"
  wird wochentagstreu und legt keine Duplikate mehr an.
  **NAS-Prod-Rollout offen. ⚠️ Manifest + Tag fehlen für 2.6.4/2.7.0** (bewusst aufgeschoben, siehe
  §0.1) — letztes Manifest `2.6.2.json`. **Vor dem Rollout Analyse-Skript ERNEUT fahren** (ADR 0002,
  offene Punkte 3 + 5). — Sonst nur
  der TZ-Restpunkt (Scheduler-Monatstrigger +
  db.ts-Range-Filter, server-lokal) ist über die **Container-TZ** abgesichert — **User-Check 2026-07-06
  bestätigt beide Container `CEST`** (Europe/Warsaw), §6.1/§6.2. Rest-Kandidaten (kosmetisch/unkritisch,
  NICHT priorisiert): `sessionStore.close()` beim Shutdown (Prozess terminiert ohnehin); optionales
  CHF-Y-Achsen-Symbol im Umsatzchart (§6.3).
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
4. **Nächster Schritt:** derzeit **keiner offen** — v2.4.0 ist komplett live auf Prod (§6.1), §6.2 (a+b)
   erledigt, Zeitzonen-Anker bestätigt. Neue App-Themen wie gewohnt hier auf `main` starten (§3).

## 2. PROJEKT-KONTEXT (Stack)

ProTrackr = Projekt-/Abrechnungs-/Reisekosten-Management (DÖRING Consulting, Mandant `dc001`).

- **Frontend:** React + Vite + TypeScript (`client/`). UI unter `@/components/ui` (Radix),
  Charts **`recharts`**, Routing `wouter`.
- **Backend:** tRPC + Express, per esbuild zu `dist/index.js` gebündelt (ESM) (`server/`).
  Entry `server/_core/index.ts`; Static/SPA-Serving `server/_core/vite.ts` (`serveStatic` prod,
  `setupVite` dev).
- **DB:** MySQL via Drizzle (`drizzle/schema.ts`, Migrationen `drizzle/*.sql`, aktuell bis
  `0025_sessions.sql`). **Geld = int Cents**; Wechselkurse = Zehntausendstel;
  `manDays` = Tausendstel; `hours` = Minuten. **Zeitzone Europe/Warsaw** — Monatsgrenzen als
  String bauen (`${y}-${mm}-01`), NIE `toISOString` (kippt auf Vortag).
- **Tooling:** pnpm; husky. **pre-commit** = NUR `vitest` (2 Dateien: `taxEnginePl.test.ts`
  + `uiValidationReportsDashboard.test.ts`; braucht DB nur für den Fixture-Cleanup → `SKIP_TEST_CLEANUP=1`).
  **`tsc` läuft NICHT im Hook** — separat `npx tsc --noEmit` vor Commits. **post-commit**
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

## 4. AKTUELLER STAND (v2.4.0, komplett live auf Prod)

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

### 4.2 Umsatzentwicklung-Chart — ✅ LIVE AUF PROD (Chart v2.3.0 + Zeitumsatz-Tooltip v2.3.3, via v2.4.0)
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
    Fragment-Lesson beachtet (Serien-Array unangetastet). **LIVE AUF PROD** (im v2.4.0-Rollout).
- Referenz [[project_umsatzchart_task]] (inkl. recharts-Fragment-Lesson).

### 4.3 Version/Prod-Stand
- **origin/main-HEAD = v2.4.x** (laufende Doku-Bumps); letzter **App-Release = v2.4.0**. Manifeste: `2.1.28`,
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
  **✅ Live auf Prod:** Laufzeit-Beweis (Session überlebt Restart) bestanden, Migration `0025` auf
  Dev+Prod angewandt (§6.1).

### 6.3 Umsatzchart-Nachpolituren
- **Zeitumsatz-Tooltip — ✅ ERLEDIGT (v2.3.3, Commit `8cbe589`).** Info-Icon (lucide `Info`) am
  Zeitumsatz-Toggle in `client/src/pages/Dashboard.tsx`; Radix-Tooltip als `UiTooltip` aliased
  (recharts-`Tooltip`-Namenskonflikt). Text: Zeitumsatz = Umsatz aus abgerechneter Arbeitszeit
  ohne durchgereichte RK, Abstand zur Bruttoumsatz-Linie = exklusive RK (deckt sich mit
  `computeMonthlyDisplayRevenue`: `grossCents − timeCents = travelCents`). 3-Agenten-Loop grün
  (tsc/pre-commit-Tests/Build), Fragment-Lesson beachtet. ✅ Live auf Prod (v2.4.0-Rollout, §6.1).
- (optional, offen) Y-Achsen-Symbol bei CHF ist „250kCHF" (ohne Leerzeichen, wie spezifiziert);
  Label-Überlappung auf schmalen Viewports ggf. `angle={-45} textAnchor="end"`.

### 6.4 Dashboard-Backlog — ✅ ERLEDIGT (v2.5.0, 2026-07-15), live auf main
**Umgesetzt im 3-Agenten-Workflow (Junior→Senior→QA). Rein clientseitig, KEIN Schema-Change. Detail:
Memory [[project_dashboard_backlog]].**
1. **Kachel „Berichte" → „Rechnungen".** `client/src/pages/Dashboard.tsx`: statische `0` ersetzt durch
   Anzahl der im laufenden Jahr vergebenen Rechnungsnummern (`invoiceNumbers.list({ year })`, existierte
   bereits), `isLoading` gekoppelt. User-Entscheidung: „Rechnungen dieses Jahr" (Alternative „unbezahlt"
   hätte Zahlungsstatus-Migration gebraucht — nicht im Datenmodell).
2. **Umsatzentwicklung — Prognose-Toggle** (nur Einheitliche-Währung-Modus). Umsatz aus real erfassten
   Zukunfts-Zeiteinträgen (separater konditionaler Query); Kosten-**Run-Rate** (Ø letzte 3 abgeschl. Monate
   variable + Fixkosten) als eigene Linie UND Netto-Input; Netto via `computeMonthlyTaxSeries` (geteilte
   Wahrheitsquelle). Neue reine lib `client/src/lib/revenueForecast.ts` + Unit-Test
   `server/revenueForecast.test.ts` (**ins pre-commit-Gate aufgenommen**, jetzt 3 Suites). Gestrichelt/
   gedämpft, „heute"-Marker, Methodik-Disclaimer; Serien als Array (Fragment-Lesson), Warschau-Strings,
   kein Datenleck.
   - **K1-Lesson (Senior-Blocker, gefixt):** Run-Rate/gleitender Ø braucht ein Query-Fenster, das das
     Berechnungsfenster VOLL abdeckt. IST-ctx (`rangeStart..rangeEnd`) ließ im 3M-View Monat −3 fehlen →
     stille `0` → Ø ~1/3 zu niedrig (Verstoß gegen globale Regel §6, Missing-Data-Penalty). Fix: dedizierter
     Run-Rate-Query über die letzten 3 abgeschlossenen Monate, entkoppelt vom Anzeigezeitraum.
**Offen:** NAS-Prod-Rollout im **NAS-Chat** via `/nas-rollout` (Manifest `.claude/rollouts/2.5.0.json`,
`breaking:false`, keine neue Migration). Visuelle e2e-Abnahme in NAS-Dev — Prognose zeigt Zukunftsmonate
nur, wenn Zeiteinträge in der Zukunft erfasst sind.

### 6.5 Reisekosten-Zeitraum-Zuordnung — Schritt 1 ✅ (v2.5.2, live auf main), Schritt 2 ⏳ (implementiert, QA/Commit offen)

#### Schritt 1 — Vereinheitlichung (v2.5.2, 2026-08-03; ADR 0001, inzwischen superseded)
**Auslöser (User-Beobachtung):** Buchhaltungsbericht Juli 2026 zeigte **38.090 €** Bruttoumsatz, das
Dashboard **37.940 €** — Differenz 150 € = ein Hotelbeleg über den Monatswechsel (30.06.–02.07.).

**Ursache — zwei konkurrierende Datums-Konventionen:** Der Server-Ladefilter `getAllExpenses`
(`server/db.ts:746-755`) lädt per **Overlap** (`COALESCE(checkOutDate, checkInDate, date)`), und
`Reports.tsx` übernahm diese Ladung **ungefiltert**; `monthlyFinancials.ts` (Dashboard **und
Steuerbasis**) ordnete dagegen nach `expense.date` zu. Folgen: Divergenz Report/Dashboard, der
**angezeigte Bruttoumsatz wich von der Steuerbasis desselben Berichts ab** (Nettogewinn basierte auf
37.940 €), und ein monatsübergreifender Beleg zählte im Juni- **und** Juli-Bericht voll
(Doppelzählung; bei exclusive-Kunden Doppelfakturierung).

**Umsetzung:** Eine exportierte reine Funktion `isExpenseInPeriod()` in `monthlyFinancials.ts`
(K4 SSoT); `Reports.tsx` filtert an **genau einer** Stelle, bevor die Belegmenge in irgendeinen
Konsumenten fließt. Zuordnungsfeld war in diesem Schritt `expense.date` (ADR
`docs/adr/0001-reisekosten-zeitraum-zuordnung.md`, **Status jetzt `superseded by ADR 0002`**).
Bewusst unverändert: Server-Ladefilter (ist ein *Lade*-, kein *Zuordnungs*filter — die Kalenderansicht
spannt Hotelnächte über checkIn..checkOut auf, `TimeTracking.tsx:538-582`) und `reportStichtag`
(Kursfrage, nicht Monatsfrage). Die Struktur (eine Funktion, eine Filterstelle) gilt unverändert weiter.

- Neu: `server/expensePeriodAttribution.test.ts` (Regressionsfall + Invarianz-Beweis).
  **pre-commit-Gate seither 5 Suites** (+ `monthlyFinancials`, + `expensePeriodAttribution`).

#### Schritt 2 — Leistungsende statt Belegdatum (⏳ implementiert, QA/Commit offen; ADR 0002)
**Auslöser:** Prod-Beleg **#596** (Hotel Fritzmeier, 150,00 EUR, `exclusive`): `date`/`checkInDate`
30.06.2026, `checkOutDate` 02.07.2026 → nach Schritt 1 in **Juni**, gelebte Abrechnungspraxis ist
**Juli**. Grund: `date` ist bei Hotels der **Check-in** (`TimeTracking.tsx:1258` setzt
`payloadBase.date = hotelCheckIn`), bei Hin-/Rückflug auf einem Ticket das **Hinflugdatum**.

**Entscheidung (User, K14):** Ein Beleg wird **niemals gesplittet** (Spec-Entwurf v1.0.0 mit
Nacht-Split bewusst verworfen), sondern zählt komplett in dem Monat, in dem die **Leistung endet**:
`leistungsende = checkOutDate ?? date`. Hotel → Check-out · Hin-/Rückflug auf einem Ticket →
Rückflugdatum · alles Übrige (Taxi, Zug, Kraftstoff, km-Pauschale) → `date`. Gilt **einheitlich** für
Kundenabrechnung, Report-Anzeige, Dashboard **und Steuerbasis** — eine Zahl überall.
**Vollständige Begründung + Alternativen: ADR `docs/adr/0002-reisekosten-leistungsende.md`
(supersedes 0001).**

Geändert an der **einen** Regelstelle (`isExpenseInPeriod`) — plus die Stellen, die eine **zweite**
Zuordnung hatten oder das Feld **erzeugen**:
- `Dashboard.tsx:812` Kosten-Pie (war eine zweite Zuordnungsregel im selben useMemo wie die
  Steuer-Slices) und `Dashboard.tsx:1023-1046` Reisekosten-Kachel → beide auf `isExpenseInPeriod`.
- `Import.tsx:661-664`: Check-out aus `nights` über lokale Datumskomponenten statt `toISOString`
  (lieferte in Warschau konsequent den **Vortag**).
- `receiptAi.ts:533-548`: leitete `nights` bislang **gar nicht** ab → `checkOutDate == checkInDate`.
  Jetzt über den neuen geteilten Helfer `addDaysToDateKey` (`shared/dateStichtag.ts`, TZ-neutral).

- **⚠️ Steuerbasis verschiebt sich bewusst** (monatsübergreifende Belege wandern vom Anreise- in den
  Abreisemonat) — gewollte K14-Entscheidung, keine stille Nebenwirkung.
- **⚠️ Außenwirkung:** Kundenberichte/-exporte (`costModel: exclusive`) ändern sich; Beleg #596 =
  150,00 EUR jetzt in **Juli**. Wurden bereits Rechnungen versandt, weicht eine Neuerstellung ab.
  **Vor NAS-Prod-Rollout beachten.**
- **Invariante hält:** Die Server-Ladung (Overlap) bleibt Obermenge — für Belege mit `checkOutDate` ist
  die untere Ladegrenze **exakt** das Leistungsende; die obere nutzt den Beleg-*Beginn*, der per
  Validierung (`routers.ts:328-352`: Check-out ≥ Check-in, Rückflug ≥ Hinflug) ≤ Leistungsende ist.
- **✅ Bestandsdaten-Prüfung ERLEDIGT (2026-08-03, Prod, read-only):** Datenqualität `checkOutDate`
  **sauber** (0 defekte von 48 Hotels) → **kein Backfill**. Genau **1** geldwirksame Verschiebung:
  Beleg **#596** (Fritzmeier `exclusive`, 150,00 EUR, Juni → Juli) — korrektes Check-out 02.07., also
  der **gewollte** Effekt (Beleg-Kommentar „koszt ujęty w lipcu"). Beleg #368 (273,00 EUR, März → April)
  ist keinem Kunden zugeordnet → nur interne Steuerbasis. **Datenqualitätsseitig grünes Licht für
  v2.5.5.** Details im ADR 0002, offener Punkt 3.
- **✅ Kaufmännischer Abgleich erledigt (2026-08-04):** Für Fritzmeier gab es **keine** Juni-Rechnung mit
  den 150 EUR — nur die Juli-Rechnung. **Keine Doppelfakturierung, keine Gutschrift nötig**; ADR 0002
  bestätigt die gelebte Praxis. Punkt geschlossen.
- **✅ Verfallene Tickets geklärt (2026-08-04):** #605 (425,97 EUR, Fritzmeier) und #492 (238,20 EUR)
  beide **dienstlich/kundenverursacht** → nach Spec §8.1a **weiterberechenbar**, zusammen **664,17 EUR**.
  **Offener kaufmännischer Schritt:** Die Nachberechnung ist möglich, aber noch nicht erfolgt — und sie
  läuft nicht automatisch, weil `status='VERFALLEN'` + `verfall_ursache` erst mit der Spec-Umsetzung
  existieren. Manuell anzustoßen.
- **Prüfergebnis im Detail (NAS-Chat, read-only gegen Prod):** Hotels **48/48** plausibel (0× `NULL`,
  0× `== checkIn`, 0× `< checkIn`); Flüge **32**, davon 9 Kandidaten mit fehlendem/gleichem Enddatum —
  **alle unkritisch** (One-Way, Round-Trip im selben Monat, 0 EUR).
- **🔑 Methodische Lesson:** Die Abweichungs-Abfrage des Skripts zeigt **nur Monatsverschiebungen**, ein
  **kaputtes `checkOutDate` bleibt darin unsichtbar** (`checkOut == checkIn` erzeugt keine Abweichung —
  der Defekt äußert sich als *Ausbleiben* einer Verschiebung). Deshalb waren separate
  Datenqualitäts-Queries nötig. **Nachgezogen (v2.5.6):** fest im Skript als `DATA_QUALITY_SQL` —
  `NULL` / `== Startdatum` / `< Startdatum`, kategorienspezifisch, mit Zählung je Kategorie und Befund.
- **Fachregeln des Account-Inhabers** (Memory [[project_reisekosten_fachregeln]], eingearbeitet in
  `docs/SPEC-Reisekosten-Abgrenzung.md` v1.1.0): (a) **§3.2 Flugrichtung** — nach Polen (KTW/KRK) =
  Rückflug, aus Polen = Hinflug, bei Umstieg letzter Flughafen; kein DB-Feld kodiert das
  (`flightRouteType` = Geografie). Praxis: Flüge als **Einzelstrecken** erfasst → `PUNKT`, kein
  Ankermonat, `checkOutDate = NULL` **korrekt**. (b) **§8.1a verfallene Tickets** — abrechenbar bei
  Ursache `DIENSTLICH`/`MANDANT`, **nicht** bei `KRANKHEIT`; neuer Status `VERFALLEN` +
  Pflichtfeld `verfall_ursache`.
- **Spec ins Repo geholt (K13/K4):** `docs/SPEC-Reisekosten-Abgrenzung.md` **v1.1.0** löst die lose
  Datei in `Downloads/` ab — eine Wahrheitsquelle. Sie bleibt **K14-freigabepflichtig** (§16); R2/R3
  (Split, Ankermonat) sind **Zielbild, nicht implementiert** — ADR 0002 ist der bewusst einfachere,
  freigegebene Stand.
- `server/expensePeriodAttribution.test.ts` erweitert: Referenzfall #596, Flug, Grenzen inklusive über
  das Leistungsende, K8 (Date-Objekte lokal), Konsistenz Chart ↔ Steuerbasis, `receiptAi`-Payload-
  Ableitung inkl. Jahresgrenze.

**🔑 Lessons:**
1. Ein *Lade*-Filter (welche Daten kommen aus der DB) ist **nicht** dieselbe Frage wie eine
   *Zuordnungs*-Regel (in welchen Zeitraum zählt ein Datensatz). Wer beides vermischt, bekommt Divergenz
   **und** Doppelzählung. Zuordnung gehört in **eine** geteilte, getestete Funktion.
2. **Wird eine Zuordnungsregel auf ein anderes Feld umgestellt, müssen ALLE Pfade geprüft werden, die
   dieses Feld ERZEUGEN — nicht nur die, die es lesen.** Hier: `Import.tsx` (Check-out aus `nights` mit
   `toISOString`-Vortagsfehler) und `receiptAi.ts` (leitete `nights` überhaupt nicht ab). Ein Feld, das
   vorher nur Anzeige/Stichtag war, wird durch die Regeländerung **geldwirksam** — seine Erzeuger
   brauchen dieselbe Sorgfalt wie die Rechenlogik.

### 6.6 Leistungsende für mehrtägige Belege (ADR 0002 Phase 2) — ✅ ERLEDIGT (v2.6.0, 2026-08-04)
**Lücke:** Das Leistungsende war nur bei **Hotel** (Check-out) und **Flug** (Rückflug) erfassbar. Ein
**Mietwagen** 30.06.–02.07. landete daher weiter im Juni — die ADR-0002-Regel griff dort nicht.

**Kernerkenntnis (korrigiert die ursprüngliche Phase-2-Annahme):** Es brauchte **kein neues Feld und
keine Migration**. `checkOutDate` ist bereits ein **generisches Leistungsende** (bei Flügen trägt es das
Rückflugdatum, nicht ein „Check-out"), die Spalte ist nullable und kategorienunabhängig. Ein zweites Feld
`usageEndDate` wäre **K4-Redundanz** gewesen. Freigegeben für `car`/`train`/`transport`/`other`
(User-Entscheidung K14); punktuelle Arten (`taxi`, `fuel`, `meal`, `food`, `mileage_allowance`) bleiben
bewusst ohne Enddatum.

**Zwei Defekte im selben Zug gefixt (Senior-Review):**
- **Kategoriewechsel räumte die Datumsfelder der alten Kategorie NIE.** (a) Ein von Mietwagen auf Taxi
  gewechselter Beleg behielt sein `checkOutDate` — **unsichtbar** in der Maske, aber weiterhin maßgeblich
  für die Monatszuordnung (Steuerbasis + Kundenrechnung). (b) **Neue Sackgasse durch die generische
  Validierung:** Ein Flug mit Rückflug, auf Taxi mit späterem Datum gewechselt, war über die UI **nicht
  mehr speicherbar**. Jetzt setzt jeder Zweig die nicht zuständigen Datumsfelder explizit auf `""` → NULL.
- **Rückflugdatum war nie löschbar** (`|| undefined` verwarf den Key statt `""` → NULL zu schreiben).

**Validierung** „Ende ≥ Start" gilt jetzt **kategorienunabhängig** — vorher wurde `checkOutDate`
außerhalb von hotel/flight **gar nicht** geprüft, ein invertiertes Datum war speicherbar.

**Gate-Härtung:** Validierung nach `server/expenseRules.ts` extrahiert und in `validateExpenseDateRules`
umbenannt (der alte Name `validateFlightAndHotelExpenseRules` stimmte nicht mehr). Grund: Der Test zog
sonst den kompletten Router-Graph inkl. **bcrypt** (Native-Binding) in das pre-commit-Gate.
**Gate-Laufzeit 5,8s → 2,8s.**

**🔑 Lessons:**
1. **Prüfe, ob ein Feld schon existiert, bevor du eins hinzufügst.** Der Feldname (`checkOutDate`) war
   hotel-klingend, die Semantik längst generisch — ein zweites Feld hätte zwei Wahrheiten erzeugt.
2. **Wer eine Validierung verschärft, muss die Zustände prüfen, die schon in der DB liegen.** Die neue
   Regel war korrekt, machte aber einen bestehenden (falschen) Datenzustand plötzlich *unspeicherbar*
   statt nur falsch — aus einem stillen Fehler wurde eine Sackgasse.
3. **Ein Gate-Test darf nicht am halben Server hängen.** Native Bindings im schnellsten Test blockieren
   im Zweifel jeden Commit.

**⚠️ Offen (ADR 0002, Punkt 5):** Kategoriefremde Enddaten im **Bestand** (Altfälle aus früheren
Kategoriewechseln) sind **heute schon still fehlzugeordnet**. Die Vorprüfung vom 2026-08-03 deckte diese
Klasse **nicht** ab. Das Skript hat dafür jetzt einen dritten Befund-Typ — **vor dem Prod-Rollout erneut
fahren**.

### 6.7 Purge- und Kopier-Konsistenz (v2.6.4 + v2.7.0) — ✅ ERLEDIGT, 2026-08-04
Beide Änderungen ziehen die letzten Stellen nach, die Belege noch nach `expense.date` statt nach dem
**Leistungsende** (ADR 0002) einem Zeitraum zuordneten. Je 3-Agenten-Loop mit Senior-PASS.

**v2.6.4 — Zurücksetzen/Purge** (`server/routers.ts`, Aufrufer `BackupTab.tsx`)
- Belegfilter jetzt `DATE(COALESCE(checkOutDate, date))`. Vorher löschte ein **Juni**-Reset Beleg #596,
  der in der **Juli**-Abrechnung steht — und ein Juli-Reset erfasste ihn nicht.
- **Bewusste Einschränkung:** Ein Beleg mit Leistungsende Juli an einem **Juni**-Zeiteintrag wird vom
  Juni-Reset trotzdem mitgelöscht (die Kaskade). Integrität schlägt Deckungsgleichheit.
- **Kaskaden-Begründung korrigiert:** `fk_expenses_timeentry` ist `ON DELETE CASCADE` — MySQL räumt die
  Belege ohnehin ab. Das explizite Einsammeln ist nötig, weil `fk_documents_expense`
  `ON DELETE SET NULL` ist (sonst **Waisen-Dokumente**) und `deleted.expenses` sonst zu niedrig wäre.
- **Transaktion** um die drei Deletes ergänzt (vorher: Abbruch nach Delete 1 = Dokumente weg, Rest da).
- `BackupTab.tsx` nutzt `warsawDateKey()`; vorher lieferte `toISOString().slice(0,7)` am Monatsersten
  zwischen 00:00–02:00 den **Vormonat** als vorausgewählten Löschmonat (K8, destruktiver Dialog).

**v2.7.0 — „Zeitraum kopieren"**
- **Doppelanlage behoben:** Die Overlap-Ladung wurde als Selektionsmenge einer *Schreib*operation
  genutzt → ein grenzüberspannender **eigenständiger** Beleg wurde von mehreren Läufen kopiert
  („Juni kopieren" + „Juli kopieren" = dasselbe Duplikat; `scope:"day"` sogar dreifach), bei
  `exclusive` doppelt in Kundenrechnung **und** Steuerbasis. Jetzt Auswahl nach Leistungsende.
  **Verknüpfte Belege bleiben bewusst ungefiltert** — sie können ohnehin nicht doppeln, mit Filter
  wären sie *nie wieder* kopierbar.
- **Wochentagstreue (User-Entscheidung):** `day` → nächster Arbeitstag (Fr→Mo); `week` → +7 (war schon
  korrekt); `month` → n-tes Wochentag-Vorkommen bleibt erhalten (3. Montag → 3. Montag); Überzählige
  (nur das **5.** Vorkommen, also Quelltage 29.–31.) → 1. Vorkommen im Folgemonat. **Kein
  Feiertagskalender.**
- **Anker ist das Leistungsende, nicht `date`** — sonst fielen Auswahl- und Verschiebungsanker
  auseinander und die **Kopie landete im Quellzeitraum** (Sweep 2024–2028, ~12.800 Fälle: vorher
  **214** Rückfälle, jetzt **0**). Für eintägige Belege ist der Ankerwechsel ein **exakter No-op**.
  `date`/`checkInDate` folgen per **Tagesoffset** → Dauer und Chronologie konstruktiv erhalten.
- **K4:** Die Zuordnungsregel liegt jetzt **einmal** in `shared/expenseServiceEnd.ts`;
  `isExpenseInPeriod` delegiert dorthin (im Review als **byte-identisch verschoben** nachgewiesen),
  `toDateKey` wanderte nach `shared/dateStichtag.ts` (Client-Importe über Re-Export). Damit hat die
  Regel erstmals einen echten Produktionsaufrufer im Serverbereich.
- Gate um `server/copyRangeShift.test.ts` erweitert (bleibt abhängigkeitsarm).

**🔑 Lessons:**
1. **Ein Ladefilter ist keine Zuordnungsregel.** Wird eine großzügige Ladung (Overlap) als
   Selektionsmenge einer Schreib- oder Löschoperation verwendet, entstehen Duplikate bzw.
   Fehllöschungen. Beides trat hier real auf.
2. **Wer eine Validierung verschärft, muss die Zustände prüfen, die schon in der DB liegen** — die
   neue Chronologie-Regel machte einen bestehenden falschen Zustand von „still falsch" zu
   „unspeicherbar" (Kategoriewechsel, §6.6).
3. **Auswahl- und Verschiebungsanker müssen dasselbe Datum sein.** Diese Inkonsistenz stand zuerst in
   der *Spezifikation*, nicht im Code — der Review hat sie gefunden.
4. **Ein Test, der die Spiegelung prüft, prüft nicht das Original.** Die Matrix pinnte die JS-Fassung
   gegen die kanonische Regel, während das **produktive SQL** ungetestet blieb: ein Rückbau auf
   `expenses.date` wäre grün geblieben. Jetzt wird der SQL-Baustein über `MySqlDialect` gerendert und
   assertiert.

### 6.8 Kundenzuordnung + Berechnungsgrundfeld-Verlust (v2.7.3 + v2.7.4) — ✅ ERLEDIGT, 2026-08-04

Drei Stellen, an denen beim Schreiben eines Belegs Information **still** verlorenging. Je
3-Agenten-Loop mit Senior-PASS; Manifest `2.7.4.json`, Tag `v2.7.4`.

**v2.7.3 — „Zeitraum kopieren" verlor die explizite Kundenzuordnung** (`b3625d0`)
- Der Kopier-Payload trug `expenses.customerId` nicht mit. Eine kopierte **eigenständige** Position
  landete mit `customerId = NULL` und fiel auf die Datums-Heuristik zurück — an einem Tag mit zwei
  Kunden (oder ohne Zeiteintrag) **still raus aus der Kundenabrechnung**, bei `exclusive` kein
  weiterberechneter Umsatz. Betrag blieb korrekt, Zuordnung nicht.
- Übernahme über `explicitCustomerIdForRangeCopy`, **nur für eigenständige Belege**.

**v2.7.4 — Berechnungsgrundlage + KI-Freigabe** (`be5a1eb`)
- `getAllExpenses` selektierte `distance`/`rate`/`liters`/`pricePerLiter` in **keinem** Zweig,
  obwohl der Kopier-Payload sie liest → immer `undefined` → die Kopie eines Tank-, Mietwagen- oder
  Kilometerpauschale-Belegs hatte einen korrekten `amount`, aber **keinen Nachweis** mehr. Dieselbe
  Lücke machte die Bearbeiten-Maske für `mileage_allowance` **de facto unbenutzbar**: Felder leer,
  Wächter brach jeden Speichervorgang ab.
- Beide **KI-Freigabepfade** lösten einen Ziel-Kunden auf, prüften sogar den **Zugriff** darauf, und
  verwarfen ihn dann — `toExpenseMutationPayload` kennt `customerId` gar nicht. Ergebnis: dasselbe
  Fehlerbild wie beim Kopieren. Neu: `explicitCustomerIdForApproval`, in beiden Pfaden.
- **K4:** Das Prädikat „ist verknüpft" stand zweimal wortgleich → jetzt einmal als `isLinkedExpense`;
  Zahl-Normalisierung als `toCustomerIdOrNull` (fordert `> 0`, damit Zugriffs-Guard und Schreibpfad
  dieselbe Menge akzeptieren — eine `0` lief sonst am truthy-Guard vorbei in einen rohen FK-Fehler).
- **Folgeänderung in der Maske:** Da sie jetzt durchläuft statt abzubrechen, hätte eine reine
  Kommentaränderung den Betrag still auf km × Pauschale korrigiert (Import und KI-Freigabe setzen
  Betrag und Grundlage unabhängig). Auf Entscheidung des Account-Inhabers zeigt sie einen **Hinweis
  mit altem und neuem Betrag**, sobald beide auseinanderliegen — Bedingung deckungsgleich mit dem
  Speicherpfad (`Math.round(x * 100)`) **und** dessen Guard (`> 0`).

**🔑 Lessons:**
1. **Ein Feldname ist keine Quellenangabe.** `getAllExpenses` liefert `customerId` und `rate` je nach
   Zweig aus **verschiedenen Tabellen**. Wer ein solches Objekt in eine *Schreib*operation
   weiterreicht, muss den Zweig kennen — sonst wird der Kunde des Zeiteintrags zur „expliziten"
   Belegzuweisung oder der Tagessatz zur Kilometerpauschale. Beide Fallen sind jetzt per
   Quelltext-Wächter gepinnt.
2. **Ein Ladefehler kann sich als Validierungsfehler tarnen.** Die Maske war für Kilometerpauschale
   unbenutzbar — sichtbar aber nur als Toast „Bitte Kilometer eingeben", nicht als fehlendes Feld.
   Die Ursache lag zwei Schichten tiefer im SELECT.
3. **Wer einen Ladefehler behebt, schaltet Schreibpfade frei, die vorher nie liefen.** Der
   Betrags-Hinweis existiert nur, weil das Beheben von (1) einen bis dahin toten Pfad aktiviert hat.
   Bei jedem „wir laden jetzt zusätzlich X" prüfen, wer X **schreibt**.
4. **Prüf-Guard und Schreibpfad müssen dieselbe Menge akzeptieren.** `else if (targetCustomerId)`
   (truthy) und `Number.isFinite` (lässt `0` durch) ergaben zusammen einen Wert, der die
   Zugriffsprüfung übersprang.
5. **⚠️ Release-Artefakte gegen den FRISCHEN Remote-Stand prüfen, nicht gegen den Sessionstart.**
   Während dieser Sitzung hat eine **Parallelsession** im selben Worktree (21:53) Manifest
   `2.7.2.json` erzeugt und die Tags `v2.6.4` + `v2.7.0` gesetzt — genau die Artefakte, die laut
   Auftrag „fehlten". Der Sessionstart-Befund (`git tag --list` zeigte nur bis `v2.6.2`) war beim
   Setzen der Tags längst veraltet. Entstandener Schaden: keiner (die Manifest-Reihe
   `2.7.2 → 2.7.3 → 2.7.4` ist konsistent, jedes pinnt einen eigenen Commit), aber die Begründung im
   Tag `v2.7.3` („holt 2.6.4/2.7.0 nach") ist unzutreffend. **Vor `git tag` und vor dem Manifest
   immer erneut `git fetch` + `git tag --list` + `ls .claude/rollouts/`.** Siehe
   [[feedback_parallel_sessions_one_worktree]].

### 6.9 „Legacy"-Kategorien `transport` und `food` — ⚠️ OFFEN, Entscheidung Account-Inhaber (K14)

Nebenbefund aus der Doku-Session, hier festgehalten. **Kein Auftrag, keine Code-Änderung erfolgt** —
die Lage ist am 2026-08-04 gegen den Code verifiziert und gilt unverändert.

**Der Befund:** `drizzle/schema.ts` kommentiert zwei Enum-Werte als Übergangszustand —
`"transport", // Transport (legacy, wird zu taxi migriert)` und
`"food", // Food (legacy, wird zu meal migriert)`. Beide sind jedoch **aktiv auswählbar**
(`client/src/pages/TimeTracking.tsx`, Select + `EXPENSE_CATEGORY_LABELS`).

**Warum das geldwirksam ist:** `transport` gehört seit v2.6.0 zu
`SERVICE_END_DATE_CATEGORIES` (`car`/`train`/`transport`/`other`), darf also ein **Leistungsende**
(`checkOutDate`) tragen. `taxi` gehört bewusst **nicht** dazu (punktuelles Ereignis). Eine
Migration `transport → taxi` würde Bestandsbelege mit **kategoriefremdem Enddatum** erzeugen —
exakt **Befundtyp 3** aus `scripts/analyze-expense-attribution.mjs` (dessen Positivliste
`('hotel','flight','car','train','transport','other')` lautet, ohne `taxi`). Wirkung: das Enddatum
bleibt für die Monatszuordnung nach ADR 0002 maßgeblich, ist in der Maske aber **unsichtbar** →
stille Fehlzuordnung, geldwirksam bei `costModel: "exclusive"`.

**Beobachtung, die gegen die Legacy-Annahme spricht (2026-08-04):** Die Labels beschreiben
**fachlich verschiedene Sachverhalte**, keine Dubletten:
- `transport` = **„ÖPNV"**, `taxi` = „Taxi". Eine ÖPNV-Wochen-/Monatskarte ist genau der mehrtägige
  Fall, für den `transport` zu Recht ein Leistungsende führt; eine Taxifahrt ist punktuell.
- `food` = **„Lebensmittel"**, `meal` = **„Verpflegungspauschale"**. Ein Einkaufsbeleg ist kein
  Pauschbetrag — die Zusammenlegung hätte eine steuerliche Dimension (Polish JDG), nicht nur eine
  technische.

Damit sieht der Kommentar eher nach einer **nie ausgeführten und fachlich überholten Absicht** aus
als nach einem echten Migrationsplan.

**Zu entscheiden (nur der Account-Inhaber):**
- **(a) `transport` ist NICHT legacy** → Kommentar in `drizzle/schema.ts` streichen, Kategorie bleibt
  eigenständig. *(Nach heutiger Beleglage die naheliegende Variante; kein Datenänderungsbedarf.)*
- **(b) Migration wird doch gewollt** → sie **muss** vorhandene `checkOutDate`-Werte mitbehandeln
  (räumen oder Belege vorher trennen) und das Analyse-Skript **vorher und nachher** laufen.
- **`food`/`meal`** ist bezüglich des Enddatums **harmlos** (beide punktuell, keins von beiden steht
  in `SERVICE_END_DATE_CATEGORIES`) — die fachliche Frage oben bleibt davon unberührt.

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

- Alles auf **GitHub `DoeringConsulting/ProTrackr`**, `origin/main-HEAD` = **v2.7.x**
  (App-Release **v2.7.4**, Commit `be5a1eb`).
  Tags (Stand 2026-08-04, `git ls-remote --tags origin`): `v2.1.21`, `v2.1.22`, `v2.1.28`, `v2.2.0`,
  `v2.2.2`, `v2.2.3`, `v2.3.0`, `v2.3.3`, `v2.3.5`, `v2.4.0`, `v2.5.0`, `v2.5.2`, `v2.5.5`, `v2.6.0`,
  `v2.6.2`, `v2.6.4`, `v2.7.0`, **`v2.7.3`**, **`v2.7.4`**; NAS-Prod-Rollout-Tags
  `nas-rollout/2.4.0` (2026-07-06), `nas-rollout/2.3.0`, `nas-rollout/2.1.28` etc.
  Manifest-Reihe zuletzt: `2.6.2` → `2.7.2` → `2.7.3` → **`2.7.4`** (maßgeblich).
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
