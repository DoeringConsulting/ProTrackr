# HANDOVER — Feature: Dashboard „Umsatzentwicklung"-Chart erweitern

> Self-contained Übergabe für eine **neue Main-Sitzung**. Konzept + Architektur mit
> dem User final abgestimmt; **Entscheidungen unten in §2b gelockt (2026-07-05)**.
> Umsetzung bewusst auf **morgen (ab 2026-07-06)** vertagt („für heute pausieren,
> Stand sichern"). Es wurde **noch kein Code geschrieben** — nur die vollständige
> Code-Analyse (unten eingearbeitet). Main-only, Worktree `C:\Projects\ProTrackr_main`,
> Branch `main`.

## 0. Stand / Rahmen
- `main` synchron mit origin. package.json aktuell **2.1.23** (Auto-Bump aus dem
  Handover-Commit; letzte *Release* + Tag + Manifest ist v2.1.22). `task_bba37780`
  KOMPLETT + live auf Prod (Memory [[project_open_fix_expense_attribution_main]]).
- **Deploy:** committen + `git push` (Hook baut `dist/`, kein Restart). App-Release →
  Rollout-Manifest erzeugen (`node scripts/generate-rollout-manifest.mjs --notes "…"`)
  + `.claude/rollouts/<version>.json` committen + Tag `v<version>`; NAS-Deploy im
  NAS-Chat via `/nas-rollout`. Manifest-Commits bumpen NICHT (post-commit-Exemption).
  Siehe [[feedback_deploy_workflow]], [[feedback_rollout_manifest]].
- **3-Agenten-Workflow** (Junior→Senior→QA) für Code ([[feedback_3agent_workflow]]).
  Vor Commit `npx tsc --noEmit` + `SKIP_TEST_CLEANUP=1 npx vitest run` (dieser Change
  ist client-only, keine DB-Fixtures → MySQL84 nicht nötig).

## 1. Aufgabe
Den Chart **„Umsatzentwicklung"** im Dashboard erweitern:
`client/src/pages/Dashboard.tsx`, Funktion `buildRevenueChart` (**verifiziert Z.168**),
gerendert mit **recharts** (`LineChart`/`Line`, Import Z.18 — **NICHT Chart.js**; der
gezeigte Mockup nutzte Chart.js nur zur Visualisierung).

## 2. Finalisiertes Konzept (vom User bestätigt)

| Aspekt | Festlegung |
|---|---|
| Anf. 1 — Reisekosten im Umsatz | `Bruttoumsatz = Zeitumsatz + exklusive Reisekosten` (nur Kunden mit `costModel="exclusive"`) |
| Anf. 2a — Monatlich/Kumuliert | Umschalter; kumuliert = laufende Summe der Monatswerte **innerhalb** des gewählten Zeitfensters, Start bei 0 |
| Anf. 2b — Nettogewinn | Volle Netto-Linie neben dem Bruttoumsatz; Logik **identisch zum Buchhaltungsbericht** |
| Netto-Kostenbasis | Netto zieht ab: variable Kosten (`expenses`), **fixe Monatskosten** (`fixedCosts`: Internet/Leasing/ChatGPT), Provision, ZUS/Kranken/Steuer |
| Währungsmodus | Netto-Linie NUR im vereinheitlichte-Währung-Modus (`showUnifiedCurrency`). Pro-Währung-Modus bleibt wie heute (je Währung eine Linie, kein Netto/Zeit/Brutto) |
| Negativer Netto | wird gezeigt (Anlaufmonate: Fixkosten ohne Umsatz) |
| Zeitumsatz-Referenz | **optionaler Toggle, default AUS** (gestrichelte Linie = Umsatz ohne Reisekosten; Abstand zu Brutto = durchgereichte exkl. RK) |
| Default-Ansicht | Bruttoumsatz + Nettogewinn AN, Zeitumsatz AUS, Monatlich |

## 2b. GELOCKTE ENTSCHEIDUNGEN (2026-07-05, User-bestätigt)
1. **Refactor-Umfang = Option 1 (geteilte Wahrheitsquelle in Dashboard UND Reports).**
   Neues Modul `client/src/lib/monthlyFinancials.ts` mit der **echten** Monats-Amounts-
   Logik; Dashboard nutzt es für die Netto-Linie, **und `Reports.tsx` wird chirurgisch
   darauf umgestellt** (nur der `getMonthlyAmounts`-Callback). Abgesichert durch neuen
   Unit-Test + Browser-QA (Buchhaltungsbericht Vorher/Nachher **bit-identisch**).
2. **Version = MINOR → v2.2.0.** Commit-Subject `feat(dashboard): …` (Auto-Bump MINOR).

## 3. CODE-ANALYSE (verifiziert 2026-07-05 — als Faktenbasis übernehmen)
- **`buildRevenueChart` (Dashboard.tsx:168):** summiert heute NUR `entry.calculatedAmount`
  (Zeitumsatz). Zwei Zweige: `showUnifiedCurrency` (eine Linie `umsatz` in `targetCurrency`)
  und Pro-Währung (je Währung eine Linie). Keine RK, kein Monatlich/Kumuliert, kein Netto.
- **`buildCostChart` (Dashboard.tsx:330):** hat die Steuer-Engine bereits verdrahtet
  (`aggregateMonthlyTaxResults`, Z.400) — liefert aber nur ein **Aggregat** (Kosten-Pie),
  KEINE Pro-Monat-Werte. Dessen `getMonthlyAmounts` (Z.403-431) hat ggü. dem Buchhaltungs-
  bericht 2 Lücken: (a) exklusive RK fehlen im `revenue`, (b) Provision fehlt in `variable`
  (Fixkosten sind drin).
- **Wahrheitsquelle = `Reports.tsx:calculateAccountingReport` (Z.344-588).** Der maßgebliche
  Monats-Callback `getMonthlyAmounts` (Z.458-506) rechnet in **PLN**:
  - `revenueCents` = Σ Zeit (`calculatedAmount`→PLN) + Σ exkl. RK (`expense.amount`→PLN,
    Attribution via `getExpenseBillingCustomerId` + `costModel==="exclusive"`).
  - `variableCostsCents` = Σ **ALLE** `expenses`→PLN **+** Σ Provision→PLN
    (`calculateProvisionCents` je Time-Entry im Monat).
  - `fixedCostsCents` = `monthlyFixedCostsPln` (ein Monat Fixkosten).
  → Netto = `aggregateMonthlyTaxResults(...).netProfit` (PLN), dann in Zielwährung.
- **`aggregateMonthlyTaxResults` (taxEnginePl.ts:222):** iteriert Monate, ruft je Monat
  `calculatePolishTaxResult` (rechnet `netProfit = revenue − fixed − variable − zus −
  health − tax`), summiert. Gibt nur das **Aggregat** zurück → für eine Monats-**Linie**
  brauche ich eine **Pro-Monat-Serie** (existiert noch nicht).
- **⚠ `client/src/lib/uiCalculations.ts`:** enthält getestete Pure-Funktionen
  (`calculateAccountingUiData`, `calculateDashboardCostBreakdown`,
  `calculateMonthlyRevenueSeries`), ist aber eine **bereits divergierte, NUR von
  `server/uiValidationReportsDashboard.test.ts` genutzte Referenz** — alte `timeEntryId`-
  Attribution (kein `getExpenseBillingCustomerId`), KEINE Provision, KEINE Währungs-
  umrechnung, andere Farben (`#3b82f6` statt live `#048998`). Die Live-Seiten importieren
  daraus nur `formatLocalDate`/`getDateKey`. **NICHT als Wahrheitsquelle behandeln.**
- **Steuer-Minima (ZUS/Zdrowotna) sind PLN-definiert** (`socialMinBaseCents` etc.) →
  Netto MUSS in PLN gerechnet und danach in Zielwährung konvertiert werden.
- **`convertAmountCents` (currencyUtils.ts:33):** kreuzkonvertiert über PLN, gibt **null**
  bei fehlendem Kurs zurück (Caller zählt Miss + behandelt als 0).
- **Attribution-Utils** in `client/src/lib/expenseAttribution.ts`:
  `getExpenseBillingCustomerId`, `createEntriesById`, `createCustomerIdsByDateMap` — im
  Dashboard identisch aufbaubar (heute NICHT vorhanden, muss ergänzt werden).
- **Tests:** `server/taxEnginePl.test.ts` testet nur `calculatePolishTaxResult` (nicht das
  Aggregat direkt). `server/uiValidationReportsDashboard.test.ts` testet die *simplifizierte*
  `uiCalculations`-Variante — deckt die **echte** Reports-Inline-Logik NICHT ab. → Der
  Reports-Migrations-Safety-Net ist der **neue Unit-Test** (§4 Step E) + Browser-QA.

## 4. TURNKEY-UMSETZUNGSPLAN (Option 1)

**Step A — `taxEnginePl.ts`: Pro-Monat-Serie.**
Neue `export function computeMonthlyTaxSeries(input): Array<{ monthStart; monthEnd;
result: TaxCalculationResult }>` — identische Monatsschleife wie heute in
`aggregateMonthlyTaxResults` (Monats-Strings via `${y}-${mm}-01` / letzter Tag, NICHT
`toISOString`). Danach `aggregateMonthlyTaxResults` als Summe der Serie **reimplementieren**
(Output byte-identisch → `taxEnginePl.test.ts` + `uiValidation`-Test bleiben grün). Invalid-
Date-Guard beibehalten.

**Step B — neues Modul `client/src/lib/monthlyFinancials.ts` (die EINE Wahrheitsquelle).**
Reine Funktion, parametrisiert (kein DB-/Kurs-Wissen fest verdrahtet):
```
computeMonthlyAmounts(monthStart, monthEnd, ctx): { revenueCents, fixedCostsCents, variableCostsCents }
  ctx: { timeEntries[], expenses[], customersById, attributionMaps:{entriesById,customerIdsByDate},
         monthlyFixedCostsCents, toPln(amountCents, sourceCurrency)=>number }
```
Logik **exakt** wie Reports.tsx:458-506 (PLN): Zeit + exkl.-RK-Umsatz; ALLE expenses +
Provision als variable; Fixkosten = `monthlyFixedCostsCents`. Monats-Bucketing über
`expense.date`/`entry.date` (via `toDateKey`, lokal). Zusätzlich (damit die Attribution
NICHT dupliziert wird) einen Helper `computeMonthlyRevenueInTarget(monthStart, monthEnd,
{...,toTarget})` → `{ timeRevenue, travelRevenue, gross }` in Zielwährung für die Anzeige-
Linien (Brutto/Zeit).

**Step C — `Reports.tsx` chirurgisch migrieren.**
Callback-Body Z.458-506 ersetzen durch Aufruf von `computeMonthlyAmounts(monthStart,
monthEnd, { timeEntries: timeEntriesDetailed, expenses: expensesDetailed, customersById,
attributionMaps:{ entriesById, customerIdsByDate }, monthlyFixedCostsCents:
monthlyFixedCostsPln, toPln: convertAmountToPlnForTax })`. Rest von
`calculateAccountingReport` bleibt unverändert (Provision-Anzeige-Aggregat,
`isBillableExclusiveTravel`, EUR-Kompatfelder). `convertAmountToPlnForTax` als `toPln`
übergeben → die Missing-Count-Seiteneffekte bleiben erhalten. **Ziel: identische Zahlen.**

**Step D — `Dashboard.tsx`.**
1. Attribution-Maps ergänzen: `createEntriesById(timeEntries)` +
   `createCustomerIdsByDateMap(timeEntries)` (aus `@/lib/expenseAttribution`).
2. State: `chartMode: "monthly"|"cumulative"` (default monthly); `showGross`(true),
   `showNet`(true), `showTime`(false).
3. `buildRevenueChart` (unified-Zweig) auf Zeilen mit Keys `brutto`/`netto`/`zeit` umbauen:
   - `zeit` = Σ Zeit (source→target); `travel` = Σ exkl.-RK (source→target, via Attribution);
     `brutto` = zeit + travel  → via `computeMonthlyRevenueInTarget`.
   - `netto` = `computeMonthlyTaxSeries` mit `getMonthlyAmounts = computeMonthlyAmounts(...
     toPln über latest `rateMap`)`, je Monat `result.netProfit` (PLN) → PLN→target. Nur wenn
     `showUnifiedCurrency`.
   - Kumuliert: laufende Summe je Serie über das Fenster (Start 0).
   - **Pro-Währung-Zweig unverändert lassen** (Konzept: dort kein Netto/Zeit/Brutto).
4. Rendering: im unified-Modus bis zu 3 `<Line>` (Brutto teal, Netto gold `#eda100`, Zeit
   gestrichelt grau `#898781` via `strokeDasharray`), gegated per `showGross/showNet/showTime`.
   UI: Segment-Umschalter Monatlich/Kumuliert + 3 Serien-Toggles — **nur sichtbar wenn
   `showUnifiedCurrency`** (Netto braucht unified). Farbwahl final morgen (Mockup: Brutto
   `#1baf7a`; App-Bestand nutzt `#048998` — an Palette angleichen).

**Step E — Tests.**
Neuer `server/monthlyFinancials.test.ts` (Konvention: Tests liegen unter `server/`,
importieren client-libs; reine Funktion, keine DB-Fixtures): deckt **exkl. RK im Umsatz**
+ **Provision in variable** gegen handgerechnete Fixtures ab (der Safety-Net, den
`uiValidation` NICHT liefert). `taxEnginePl.test.ts` + `uiValidationReportsDashboard.test.ts`
müssen grün bleiben.

**Step F — Abschluss.**
`npx tsc --noEmit` + `SKIP_TEST_CLEANUP=1 npx vitest run` grün → Browser-QA:
(a) Reports-Buchhaltungsbericht Netto Vorher/Nachher **identisch** (Regressions-Guard);
(b) Dashboard Brutto/Netto/Zeit-Linien, Monatlich/Kumuliert, Netto nur in unified, Netto
negativ in Anlaufmonaten. Commit `feat(dashboard): …` → v2.2.0. Rollout-Manifest
(`node scripts/generate-rollout-manifest.mjs --notes "…"`) + `.claude/rollouts/2.2.0.json`
+ Tag `v2.2.0` committen. Push. NAS-Dev-Abnahme + Prod-Promotion separat im NAS-Chat.

## 5. FALLSTRICKE (verbindlich beachten)
- **Netto immer in PLN rechnen, dann konvertieren** (ZUS/Zdrowotna-Minima sind PLN).
- **Dashboard nutzt `buildLatestRateMap` (latest), NICHT den Report-Stichtag** → die
  Dashboard-Netto-Linie ist NICHT bit-identisch zu einem konkreten Berichtslauf (andere
  Kursquelle); die **Logik/Struktur** ist identisch. Erwartet + akzeptiert.
- **Exkl. RK zählen in der Steuer-Rechnung in BEIDEN** (Umsatz UND variable) → netto null
  auf die Steuerbasis (Pass-Through). **NICHT „korrigieren".** Nicht-exkl. RK = nur Kosten.
- **Monatsgrenzen als String** (`${y}-${mm}-01`), nie `toISOString` (Warschau-TZ kippt).
- `uiCalculations.ts` ist **divergierte Test-only-Referenz** — nicht als Quelle nehmen.
  (Optional-Stretch, nur nach Rücksprache: sie retten/auf das echte Modul umbiegen — NICHT
  Teil des gelockten Scopes.)
- Reports: **nur** den Monats-Callback migrieren; Provision-Anzeige-Aggregat unangetastet.

## 6. Offene Nebenpunkte (unabhängig, niedrig-prio)
TZ-Folgepunkte (`Reports.tsx` Default-Monatsgrenzen; `server/scheduler.ts` Monatsend-
Notification) + P3/M1 persistenter Session-Store — siehe `HANDOVER-MAIN.md` §6.2 Punkt 2.
