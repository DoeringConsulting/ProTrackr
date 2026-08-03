# ADR 0002 — Zeitraum-Zuordnung von Reisekostenbelegen: das Leistungsende (`checkOutDate ?? date`) ist kanonisch

- **Status:** accepted
- **Datum:** 2026-08-03
- **Entscheider:** Alexander Döring (Account-Inhaber)
- **Betrifft:** `client/src/lib/monthlyFinancials.ts`, `client/src/pages/Reports.tsx`, `client/src/pages/Dashboard.tsx`, `client/src/pages/Import.tsx`, Kundenabrechnung, Steuerbasis
- **Ersetzt:** [ADR 0001](0001-reisekosten-zeitraum-zuordnung.md) (`expense.date` als kanonische Zuordnung)
- **Bezug:** KERN K4 (SSoT), K8 (Zeit-Invarianten), K13 (ADR), K14 (Steuer-/Berechnungslogik)

## Kontext

ADR 0001 (v2.5.2) hat die Divergenz zwischen Bericht, Dashboard und Steuerbasis geschlossen, indem es
**`expense.date`** zur alleinigen Zuordnungsregel erklärt hat. Damit war die Doppelzählung behoben —
die fachliche Zuordnung ist bei Hotels und Flügen aber falsch:

- Bei Hotels ist `date` **der Check-in**. `TimeTracking.tsx:1258` setzt `payloadBase.date = hotelCheckIn`
  (analog `Import.tsx:649-650`, `receiptAi.ts:534`).
- Bei einem Hin-/Rückflug auf **einem** Ticket ist `date` das **Hinflugdatum**;
  `TimeTracking.tsx:1256` legt das Rückflugdatum in `checkOutDate` ab.

Ein Aufenthalt über den Monatswechsel landete dadurch im **Anreisemonat**, obwohl die Leistung erst im
Folgemonat endet und dort abgerechnet wird.

**Referenzfall — Prod-Beleg #596** (Hotel Fritzmeier, 150,00 EUR, Kunde `exclusive`):
`date`/`checkInDate` = 2026-06-30, `checkOutDate` = 2026-07-02. Nach ADR 0001 zählte der Beleg in
**Juni 2026**; gelebte Abrechnungspraxis ist **Juli 2026**.

Ein Spec-Entwurf (v1.0.0) sah als Lösung einen **Nacht-Split** vor (Aufteilung des Hotelbetrags auf die
Übernachtungen und damit auf beide Monate). Der Account-Inhaber hat das **bewusst verworfen**: Belege
sollen nie geteilt werden — ein Beleg, eine Zahl, ein Monat. Nachvollziehbarkeit gegenüber der
Buchhaltung und dem Kunden schlägt periodengerechte Feinabgrenzung.

## Entscheidung

**Maßgeblich für die Zeitraum-Zuordnung eines Belegs ist das Leistungsende:**

```
leistungsende = checkOutDate ?? date
```

- **Hotel** → `checkOutDate` (Check-out)
- **Hin-/Rückflug auf einem Ticket** → `checkOutDate` (Rückflugdatum)
- **alle übrigen Belege** (Taxi, Zug, Kraftstoff, Kilometerpauschale, Bewirtung, Sonstiges) → `date`
  (kein Enddatum vorhanden)

Ein Beleg wird **niemals gesplittet** und zählt in **genau einem** Zeitraum.

Die Regel gilt **einheitlich für alles**: Kundenabrechnung, Report-Anzeige, Dashboard **und
Steuerbasis**. Eine Zahl überall (bewusste Entscheidung des Account-Inhabers — keine getrennte
steuerliche Abgrenzung).

Umsetzung:

- Die Regel existiert weiterhin als **eine** exportierte, reine Funktion
  `isExpenseInPeriod(expense, periodStart, periodEnd)` in `client/src/lib/monthlyFinancials.ts` (K4).
  `computeMonthlyAmounts` und `computeMonthlyDisplayRevenue` nutzen sie intern; `Reports.tsx` filtert
  damit an **genau einer** Stelle. Kein Konsument bekommt eine eigene Datumslogik.
- Das Leistungsende wird über `toDateKey(checkOutDate) ?? toDateKey(date)` gebildet (nicht `??` auf den
  Rohwerten): leere Strings und unparsebare Werte in `checkOutDate` fallen so ebenfalls auf `date`
  zurück, statt den Beleg still aus allen Zeiträumen zu werfen.
- Vergleich auf `YYYY-MM-DD`-Keys, Grenzen inklusive, kein `Date`-Roundtrip und kein `toISOString`
  (K8, Europe/Warsaw).

### Mit umgestellt (im selben Schritt, weil sonst inkonsistent)

- **Dashboard-Kostenverteilung** (`client/src/pages/Dashboard.tsx:811`) war eine **zweite
  Zuordnungsstelle**: der Reisekosten-Slice filterte per `expense.date`, während **derselbe** useMemo
  die ZUS-/Zdrowotna-/Steuer-Slices über `computeMonthlyAmounts` (Leistungsende) berechnet. Zwei Regeln
  in einem Diagramm hätten am Rand des 3/6/12-Monats-Fensters widersprüchliche Slices erzeugt. Die
  Stelle nutzt jetzt `isExpenseInPeriod` — damit existiert wieder genau **eine** Regel (K4).
- **Dashboard-Reisekosten-Kachel** (`client/src/pages/Dashboard.tsx:1023-1046`) aggregierte
  `expenseByCurrency` / `unifiedExpenseTotal` **ohne jeden Zeitraumfilter** über die komplette
  Server-Ladung. Unter ADR 0002 wandert die Divergenz vollständig an die **obere** Fenstergrenze — und
  `rangeEnd` ist immer das Ende des laufenden Monats. Betroffen wäre also genau der Hotelaufenthalt,
  der gerade läuft und im Folgemonat endet: die Kachel zählte ihn, der Pie nicht, während das Label
  „Im Zeitraum (N Monate)" behauptet. Beide Aggregate laufen jetzt über die gefilterte Menge.
- **Import-Ableitung des Check-out aus `nights`** (`client/src/pages/Import.tsx:653-664`) nutzte
  `checkOut.toISOString().slice(0,10)` auf einem lokal konstruierten Date. In Europe/Warsaw (UTC+1/+2)
  liefert das konsequent den **Vortag**. Unter ADR 0001 betraf das nur Anzeige und Kurs-Stichtag; unter
  ADR 0002 steuert `checkOutDate` die **Zeitraum-Zuordnung und den abgerechneten Betrag** (Check-in
  30.06. + 1 Nacht ergab `checkOutDate` 30.06. statt 01.07. → der Beleg wäre fälschlich im Juni
  geblieben). Umgestellt auf den vorhandenen Helfer `formatLocalDate` (K4/K8). **Der Fix ist
  Voraussetzung für korrekte Beträge** bei allen per Workbook importierten Hotelbelegen ohne
  explizites Check-out.
- **KI-Beleg-Pfad** (`server/receiptAi.ts:533-548`) leitete den Check-out **gar nicht** aus `nights`
  ab: `payload.checkOutDate = candidate.checkOutDate ?? candidate.checkInDate ?? candidate.date`. Der
  Validator lässt Hotelbelege mit `nights` **ohne** `checkOutDate` ausdrücklich zu (`EXP-HOT-002`:
  „nights ODER check_out_date"), und deutsche Hotelrechnungen nennen sehr häufig nur „2 Nächte" statt
  eines Abreisedatums — kein Randfall. Ergebnis war `checkOutDate == checkInDate`, der Beleg klebte
  unter ADR 0002 am Anreisemonat. Jetzt wird das Check-out aus `nights` abgeleitet (fachlich identisch
  zu `Import.tsx`), über den neuen geteilten Helfer **`addDaysToDateKey`** in `shared/dateStichtag.ts`.
  Der arbeitet auf UTC-Komponenten eines datumsreinen Keys (zeitzonenfrei, kein `toISOString`-Kippen);
  `previousDayKey` delegiert seither an ihn, damit es bei **einer** Implementierung bleibt (K4).

### Bewusst NICHT geändert

- **Server-Ladefilter (`getAllExpenses`, `server/db.ts:746-799`) bleibt Overlap-basiert.** Er ist ein
  *Lade*-Filter, keine *Zuordnungs*-Regel. Er ist unter der neuen Regel weiterhin eine **Obermenge**
  (siehe Invariante).
- **`reportStichtag`** (`Reports.tsx:110-148`) nutzt unverändert `checkOutDate ?? date ?? checkInDate`.
  Er beantwortet die Frage „welcher Tageskurs gilt" — inhaltlich jetzt deckungsgleich mit dem
  Leistungsende, aber weiterhin eine eigene Frage (Kurs-Stichtag, K8 Währung).
- **Kalender-/Anzeigelogik** bleibt unangetastet: `TimeTracking.tsx:538-582` spannt Hotelnächte
  bewusst über `checkIn..checkOut` auf, `customerReportRows.ts:34` nutzt für Gruppierung/Sortierung
  `date ?? checkIn ?? checkOut`. Beides beantwortet nicht „in welchen Abrechnungszeitraum gehört der
  Beleg".

## Konsequenzen

**Positiv**

- Die Zuordnung entspricht wieder der gelebten Abrechnungspraxis: Beleg #596 = 150,00 EUR in
  **Juli 2026**.
- Ein Beleg zählt weiterhin genau einmal; Report, Dashboard und Steuerbasis bleiben deckungsgleich
  (die Invariante aus ADR 0001 bleibt erhalten, nur mit anderem Stichtag).
- Zuordnung und Kurs-Stichtag laufen jetzt auf demselben Datum — eine Fehlerquelle weniger.

**Zu beachten (Außenwirkung)**

- **Die Steuerbasis verschiebt sich bewusst.** Monatsübergreifende Belege wandern vom Anreise- in den
  Abreisemonat. Betroffen sind alle Monatspaare mit solchen Belegen — auch bereits erstellte Berichte
  liefern bei Neuerstellung andere Zahlen. Das ist gewollt (K14-Entscheidung des Account-Inhabers),
  keine stille Nebenwirkung.
- **Kundenexporte ändern sich** bei `costModel: "exclusive"`: abrechenbare Reisekosten fließen in den
  `grandTotal`. Wurden für betroffene Monate bereits Rechnungen versandt, weicht eine Neuerstellung ab.
- Der Effekt ist gegenläufig zu ADR 0001: Belege, die dort in den Anreisemonat gezogen wurden, gehen
  jetzt in den Abreisemonat. Netto über zwei Monate bleibt die Summe identisch.

## Invariante (Voraussetzung der Lösung)

Damit der Client-Filter garantiert eine **Teilmenge** der Server-Ladung ist, muss der Server jeden
Beleg liefern, dessen Leistungsende im Abfragefenster liegt. Der Ladefilter lautet:

```
COALESCE(checkOutDate, checkInDate, date) >= start   AND   COALESCE(checkInDate, date) < end+1d
```

- **Untere Grenze:** Für Belege mit `checkOutDate` ist der COALESCE-Ausdruck **exakt** das
  Leistungsende → erfüllt. Ohne `checkOutDate` ist das Leistungsende `date`; der Ausdruck fällt auf
  `checkInDate` zurück, das per Erfassungs-Invariante gleich `date` ist.
- **Obere Grenze:** `COALESCE(checkInDate, date)` ist der **Beginn** der Leistung und damit ≤
  Leistungsende. Erzwungen durch `validateFlightAndHotelExpenseRules`
  (`server/routers.ts:328-352`: Rückflug ≥ Hinflug, Check-out ≥ Check-in).

Die neue Regel liegt damit **näher** am Ladefilter als die alte: die untere Ladegrenze ist für Belege
mit Enddatum identisch mit der Zuordnungsregel.

**Offener Restpunkt (theoretisch, unverändert aus ADR 0001):** Ein per direkter DB-Manipulation
erzeugter Beleg mit `checkInDate > checkOutDate` bzw. `date` außerhalb der Beleg-Zeitspanne fiele still
aus allen Berichten. Eine DB-Constraint existiert nicht.

## Offene Punkte

### 1. Mietwagen / Dauerparken ohne Enddatum (Phase 2)

**Mietwagen (`category: "car"`) und Dauerparken haben heute kein Enddatum.** `travelStart`/`travelEnd`
sind `varchar(5)` im Format `HH:MM` (`drizzle/schema.ts:189-190`) — reine Uhrzeiten, keine Daten.
`checkOutDate` wird für diese Kategorien nicht befüllt. Ein Mietwagen über den Monatswechsel wird
deshalb weiterhin dem Anmietmonat (`date`) zugeordnet.

Behebung in einer Folgephase:

1. Migration: neue Spalte `usageEndDate` (timestamp, nullable),
2. UI-Erfassung in `ExpenseForm` / `TimeTracking` für die betroffenen Kategorien,
3. Backfill bestehender Belege,
4. Formel erweitern zu `leistungsende = checkOutDate ?? usageEndDate ?? date` — an der **einen**
   Stelle in `monthlyFinancials.ts`.

### 2. Zeilendatum im Kundenbericht (kosmetisch, Phase-2-UX-Entscheidung)

`client/src/lib/customerReportRows.ts:34` gruppiert und sortiert Zeilen über
`date ?? checkInDate ?? checkOutDate`. Beleg #596 erscheint dadurch im **Juli**-Bericht mit dem
Zeilendatum **30.06.** und sortiert an den Anfang. Das ist Anzeige-/Sortierlogik, keine
Zeitraum-Zuordnung — bewusst nicht mit umgestellt. Ob die Zeile stattdessen das Leistungsende oder
eine Spanne („30.06.–02.07.") zeigen soll, ist eine offene UX-Entscheidung.

### 3. Bestandsdaten-Prüfung vor Rollout (geldwirksam)

Der Import-Fix wirkt **nur nach vorn**. Bereits importierte Hotelbelege ohne explizites Check-out
tragen ein deterministisch um **einen Tag zu frühes** `checkOutDate` (empirisch bestätigt: ganzjährig
genau ein Tag, weil Europe/Warsaw ganzjährig einen positiven UTC-Offset hat). Über den KI-Beleg-Pfad
erfasste Hotelbelege mit `nights` tragen sogar `checkOutDate == checkInDate`.

**Vor dem Rollout ist `scripts/analyze-expense-attribution.mjs` (strikt read-only) gegen die Prod-DB zu
fahren** und über einen Backfill zu entscheiden. Bei `costModel: "exclusive"` ist die Auswirkung
geldwirksam (Kundenrechnungen); das Skript weist die betroffenen Belege und die Beträge je Monat aus.

> **✅ ERLEDIGT — Prüfergebnis 2026-08-03 (Prod, read-only):**
> - **Datenqualität `checkOutDate`: sauber** — 0 defekte von 48 Hotelbelegen. **Kein Backfill nötig.**
>   Die beiden Erfassungsfehler (Import-Vortag, KI-Pfad `checkOut == checkIn`) haben sich im
>   Bestand nicht materialisiert.
> - **Geldwirksame Monatsverschiebung: genau 1 Fall** — Beleg **#596** (Fritzmeier, `exclusive`,
>   150,00 EUR, Juni → Juli). Check-out 02.07. ist korrekt erfasst, die Verschiebung ist der
>   **gewollte** Effekt und deckt sich mit dem Beleg-Kommentar („koszt ujęty w lipcu").
> - **Beleg #368** (273,00 EUR, März → April): keinem Kunden zugeordnet → wirkt nur auf die interne
>   Steuerbasis, **keine Kundenrechnung betroffen**.
>
> **Datenqualitätsseitig grünes Licht für den v2.5.5-Rollout.**
>
> **Verbleibender kaufmännischer Abgleich (kein Code-Thema):** Prod läuft noch auf v2.4.0, wo die
> **Doppelzählung** aktiv ist — #596 erscheint dort im Juni- *und* im Juli-Bericht mit je 150 EUR.
> Zu prüfen ist daher, ob für Fritzmeier neben der Juli-Rechnung auch eine **Juni-Rechnung mit
> denselben 150 EUR** versandt wurde. Falls ja, wurden sie doppelt berechnet (Altbestand aus der
> Doppelzählung, nicht Folge dieser Umstellung) und wären per Gutschrift zu bereinigen.
>
> **Nachgezogen:** Das Analyseskript prüft seit diesem Lauf zusätzlich die **Datenqualität des
> Enddatums für Hotels UND Rundflüge** (`checkOutDate` fehlt oder = Startdatum). Bei Rundflügen ist
> `checkOutDate` das Rückflugdatum — dieselbe Fehlerklasse, nur unauffälliger, weil eine fehlende
> Angabe dort keine sichtbare Verschiebung erzeugt, sondern den Beleg still im Abflugmonat hält.

### 4. Bulk-Delete/Purge filtert weiter über `expenses.date`

`server/routers.ts:3961-3986` löscht per `DATE(expenses.date) BETWEEN dateFrom AND dateTo`. Ein Beleg,
der nach neuer Regel im Juli ausgewiesen wird, kann damit von einem „Juni"-Purge erfasst werden.
**Bewusst nicht geändert:** destruktive Admin-Funktion mit eigener Semantik („welche Datensätze wurden
in diesem Zeitraum erfasst"), eigene Entscheidung erforderlich.

## Alternativen

- **Nacht-Split nach Spec R2 (v1.0.0):** Hotelbetrag anteilig auf die Übernachtungen und damit auf beide
  Monate verteilen. Fachlich periodengerecht. **Verworfen** durch den Account-Inhaber: ein Beleg soll
  nie geteilt werden (Nachvollziehbarkeit gegenüber Buchhaltung und Kunde; kein Rundungsrest, keine
  Teilbeträge in Kundenexporten).
- **`expense.date` beibehalten (ADR 0001):** stabil und rückwirkungsfrei, aber fachlich falsch, weil
  `date` bei Hotels der Check-in und bei Flügen das Hinflugdatum ist. **Verworfen** — genau der
  Referenzfall #596.
- **Getrennte Regeln für Steuerbasis und Kundenabrechnung:** verworfen — reaktiviert exakt die
  Divergenz-Bugklasse, die ADR 0001 geschlossen hat (K1/K4).
