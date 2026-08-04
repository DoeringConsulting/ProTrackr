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
- **mehrtägige Belege** (Mietwagen, Zug, ÖPNV, Sonstiges) → `checkOutDate` (Nutzungsende, optional
  erfassbar — siehe Offener Punkt 1, erledigt)
- **punktuelle Ereignisse** (Taxi, Kraftstoff, Kilometerpauschale, Bewirtung) → `date`
  (kein Enddatum, fachlich auch keins nötig)

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
  Leistungsende. Erzwungen durch `validateExpenseDateRules` (`server/expenseRules.ts`):
  Rückflug ≥ Hinflug, Check-out ≥ Check-in **und** — seit Erledigung von Offener Punkt 1 —
  kategorienunabhängig `checkOutDate ≥ COALESCE(checkInDate, date)`. Damit gilt die Invariante
  jetzt für **alle** Kategorien, nicht nur für flight/hotel. Die generische Regel nutzt **genau
  diesen** `COALESCE(checkInDate, date)`-Ausdruck, also die **obere** Ladegrenze; die untere
  Ladegrenze ist bewusst ein anderes COALESCE (`checkOutDate, checkInDate, date`).

**Schreibpfade ohne diese Validierung** (`createExpense` direkt, ohne `validateExpenseDateRules`) —
alle drei sind geprüft und unkritisch:

1. **KI-Beleg-Freigabe** (`server/routers.ts`, Einzel- und Batch-Freigabe): eigene, gleichwertige
   Prüfungen `EXP-FLT-004` / `EXP-HOT-004` in `server/receiptAi.ts`; `checkOutDate` wird dort
   ausschließlich für `flight`/`hotel` gesetzt.
2. **Zeitraum-Kopie** („Tag/Woche/Monat kopieren", `server/routers.ts`): verschiebt `date`,
   `checkInDate` und `checkOutDate` über denselben Helfer. Bei Monatskopien ist der Versatz wegen
   `addMonthsClamped` **nicht** für alle Felder identisch (der Tag wird auf die Monatslänge
   geklemmt, 31.01. → 28.02.), die Abbildung ist aber **monoton** — aus `Ende ≥ Beginn` folgt
   `Ende' ≥ Beginn'`. Die Invariante überlebt die Kopie also auch im Klemmfall.
3. **Workbook-Import** (`client/src/pages/Import.tsx`): läuft über `expenses.create`, ist damit
   **nicht** ohne Validierung — hier nur der Vollständigkeit halber genannt.

Die neue Regel liegt damit **näher** am Ladefilter als die alte: die untere Ladegrenze ist für Belege
mit Enddatum identisch mit der Zuordnungsregel.

**Offener Restpunkt (theoretisch, unverändert aus ADR 0001):** Ein per direkter DB-Manipulation
erzeugter Beleg mit `checkInDate > checkOutDate` bzw. `date` außerhalb der Beleg-Zeitspanne fiele still
aus allen Berichten. Eine DB-Constraint existiert nicht.

## Offene Punkte

### 1. Mietwagen / Dauerparken ohne Enddatum (Phase 2)

**Mietwagen (`category: "car"`) und Dauerparken hatten kein Enddatum.** `travelStart`/`travelEnd`
sind `varchar(5)` im Format `HH:MM` (`drizzle/schema.ts`) — reine Uhrzeiten, keine Daten.
`checkOutDate` wurde für diese Kategorien nicht befüllt. Ein Mietwagen über den Monatswechsel
(30.06.–02.07.) landete deshalb im Anmietmonat Juni statt im Rückgabemonat Juli.

> **✅ ERLEDIGT — umgesetzt als reine Erfassungs-Erweiterung, OHNE neues Feld und OHNE Migration.**
>
> **🔑 Korrigierte Erkenntnis gegenüber dem ursprünglich skizzierten Plan:** Die oben vorgeschlagene
> Spalte `usageEndDate` war **nicht nötig und wäre ein K4-Verstoß gewesen** (zwei Felder für
> dieselbe fachliche Größe). `checkOutDate` ist bereits das **generische Leistungsende** und nicht
> hotel-spezifisch — bei Flügen trägt es das Rückflugdatum, nicht einen „Check-out". Die Spalte ist
> nullable und kategorienunabhängig; die kanonische Formel `leistungsende = checkOutDate ?? date`
> bleibt damit **unverändert**, ebenso `isExpenseInPeriod`, der Ladefilter `getAllExpenses` und die
> Invariante oben. Gefehlt hat allein die **Erfassung**. Ein Backfill entfällt: Bestandsbelege ohne
> Enddatum sind unter der unveränderten Formel weiterhin korrekt über `date` zugeordnet.
>
> **Freigegebene Kategorien (Entscheidung Account-Inhaber):** `car` (Mietwagen), `train` (Zug),
> `transport` (ÖPNV), `other` (Sonstiges, z. B. Dauerparken). Das Feld ist **optional**; leer =
> bisheriges Verhalten (`date` entscheidet).
> **Bewusst NICHT freigegeben:** `taxi`, `fuel`, `meal`, `food`, `mileage_allowance` — punktuelle
> Ereignisse, bei denen Leistung und Beleg auf denselben Tag fallen und ein Enddatum fachlich
> sinnlos wäre. `hotel` und `flight` behalten ihre spezifischeren Masken (Check-in/Nächte bzw.
> Hin-/Rückflug) auf demselben DB-Feld.
>
> **Umgesetzt:**
> - **Erfassung:** `client/src/pages/TimeTracking.tsx` — optionales Feld „Ende (bei mehrtägiger
>   Nutzung)" im `else`-Zweig des Kategorie-Switch, gesteuert über die Konstante
>   `SERVICE_END_DATE_CATEGORIES`. Schreibt auf `checkOutDate`; der leere String löscht das Enddatum
>   beim Bearbeiten wieder (`normalizeExpenseMutationPayload` mappt `"" → NULL`).
> - **Kategoriewechsel — Datumsfelder werden aktiv geräumt:** Jeder Zweig des Kategorie-Switch
>   setzt `checkInDate` und `checkOutDate` **explizit**, bei Kategorien ohne das jeweilige Feld auf
>   `""` (→ `NULL`). Vorher fehlte der Schlüssel, was in `normalizeExpenseMutationPayload`
>   „unverändert lassen" bedeutet — der Altwert blieb also in der DB stehen. Zwei Folgen, beide
>   damit erledigt: **(a)** stille Fehlzuordnung (Mietwagen 30.06.–02.07. → Wechsel auf Taxi → der
>   Beleg zählte weiter im Juli, ohne sichtbares Feld) und **(b)** eine Sackgasse, die erst durch
>   die neue Chronologie-Regel entstanden wäre (Flug 10.06./Rückflug 12.06. → Wechsel auf Taxi am
>   20.07. → Merge `{date: 20.07., checkOutDate: 12.06.}` → dauerhaft nicht mehr speicherbar).
>   Gleiche Mechanik beim Rückflugdatum: auch dort ersetzt der leere String das frühere
>   `|| undefined`, sodass sich ein Round-Trip wieder zu One-Way korrigieren lässt.
> - **Validierung (Korrektheits-Lücke, unabhängig von der UI):** Die Regelfunktion prüfte
>   „Ende ≥ Start" **nur** für `flight` und `hotel`. Für alle anderen Kategorien war ein Enddatum
>   **vor** dem Startdatum speicherbar — der Beleg wäre einem Monat vor seinem eigenen Beginn
>   zugeordnet worden. Sie hat jetzt zusätzlich eine **kategorienunabhängige** Chronologie-Prüfung
>   `checkOutDate >= COALESCE(checkInDate, date)`; die spezifischen flight/hotel-Meldungen laufen
>   zuerst und bleiben erhalten. Startdatum-Ableitung identisch zur Vorprüfung
>   `scripts/analyze-expense-attribution.mjs` („DEFEKT: Enddatum VOR Startdatum").
> - **Regeln aus dem Router extrahiert:** Die Funktion heißt jetzt `validateExpenseDateRules`
>   (der alte Name `validateFlightAndHotelExpenseRules` war irreführend, seit sie eine
>   kategorienunabhängige Regel trägt) und liegt mitsamt `toComparableDate` im neuen,
>   abhängigkeitsarmen Modul **`server/expenseRules.ts`**. Grund: der Test gehört ins schnelle
>   pre-commit-Gate, dürfte dafür aber nicht den kompletten Router-Graph inklusive `bcrypt`
>   (Native-Binding, bricht bei Node-Version-Drift im Build-Image) nachziehen. Verhalten und
>   Signatur unverändert, alle drei Call-Sites (`create`, `createBatch`, `update`) mitgezogen.
> - **Schema-Kommentar** über `checkInDate`/`checkOutDate` in `drizzle/schema.ts` korrigiert
>   („Hotel specific" → generisches Leistungsende, Verweis auf dieses ADR).
> - **Tests** in `server/expensePeriodAttribution.test.ts` (pre-commit-Gate): Mietwagen
>   30.06.→02.07. fällt in den Juli, Mietwagen ohne Enddatum bleibt bei `date`, die generische
>   Chronologie-Prüfung lehnt ein Enddatum vor dem Startdatum für Nicht-Hotel-/Nicht-Flug-Kategorien
>   ab, und der Kategoriewechsel räumt die Felder der alten Kategorie (`""` und `NULL` liefern
>   dieselbe Zuordnung).
>
> **Bewusst nicht mitgeändert:** Der Workbook-Import (`client/src/pages/Import.tsx`) und der
> KI-Beleg-Pfad (`server/receiptAi.ts`) leiten `checkOutDate` weiterhin nur für `flight`/`hotel` in
> den Payload. Beide haben eigene, gleichwertige Chronologie-Prüfungen (`EXP-FLT-004`,
> `EXP-HOT-004`) und erzeugen für die neu freigegebenen Kategorien gar kein Enddatum — es entsteht
> dort also **keine Korrektheits-Lücke**, nur eine noch fehlende Erfassungs-Möglichkeit.
> Der Workbook-Import wäre billig nachzuziehen: die Spalte `check_out_date` wird in
> `client/src/lib/expenseImportV1.ts` bereits für **jede** Zeile eingelesen (`row.checkOutDate`),
> `Import.tsx` reicht sie nur im `hotel`-Zweig weiter. Kein Schema-Change nötig — eigene
> Entscheidung, deshalb hier nicht mitgenommen.

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

> **✅ ERLEDIGT — Prüfung durchgeführt 2026-08-03 (Prod, read-only), KEIN Backfill nötig.**
> Durchgeführt im NAS-Chat mit `analyze-expense-attribution.mjs` **plus ergänzenden
> `checkOut`-Datenqualitäts-Queries** im mysql-Container.
> - **Hotels: 48/48 mit plausiblem `checkOutDate`** — 0× `NULL`, 0× `== checkIn`, 0× `< checkIn`.
> - **Flüge: 32 Belege**, davon 9 Kandidaten mit `checkOutDate` `NULL`/`== Hinflug` — **alle
>   unkritisch** (One-Way, Round-Trip innerhalb desselben Monats, oder 0 EUR).
> - Die beiden Erfassungsfehler (Import-Vortag, KI-Pfad `checkOut == checkIn`) haben sich im
>   Bestand **nicht materialisiert**.
> - **Geldwirksame Monatsverschiebung: genau 1 Fall** — Beleg **#596** (Fritzmeier, `exclusive`,
>   150,00 EUR, Juni → Juli). Check-out 02.07. ist korrekt erfasst, die Verschiebung ist der
>   **gewollte** Effekt und deckt sich mit dem Beleg-Kommentar („koszt ujęty w lipcu").
> - **Beleg #368** (273,00 EUR, März → April): keinem Kunden zugeordnet → wirkt nur auf die interne
>   Steuerbasis, **keine Kundenrechnung betroffen**.
>
> **Datenqualitätsseitig grünes Licht für den v2.5.5-Rollout.**
>
> **✅ Kaufmännischer Abgleich erledigt (Account-Inhaber, 2026-08-04):** Für Fritzmeier wurde **keine**
> Juni-Rechnung mit diesen 150 EUR versandt — sie stehen ausschließlich in der Juli-Rechnung. Damit ist
> **keine Doppelfakturierung** entstanden (obwohl Prod auf v2.4.0 mit aktiver Doppelzählung läuft und
> der Beleg dort in beiden Monatsberichten erscheint), und **keine Gutschrift nötig**. ADR 0002
> bestätigt die gelebte Abrechnungspraxis: Eine Neuerstellung des Juli-Berichts liefert denselben
> Betrag wie die versandte Rechnung. **Punkt geschlossen.**
>
> **🔑 Methodische Lesson (wichtig für jede künftige Vorprüfung):** Die Abweichungs-Abfrage des
> Skripts findet **nur Monatsverschiebungen** — ein **kaputtes `checkOutDate` bleibt darin
> unsichtbar**. Denn sie vergleicht `Monat(date)` gegen `Monat(checkOut ?? date)`; ist `checkOutDate`
> gleich dem Startdatum oder `NULL`, sind beide Monate identisch und es entsteht **keine** Abweichung.
> Ein defektes Enddatum äußert sich also gerade **nicht** als Verschiebung, sondern als deren stilles
> Ausbleiben. Deshalb waren im Prüflauf separate Datenqualitäts-Queries nötig.
>
> **Nachgezogen (v2.5.6):** Diese Prüfung ist jetzt **fest im Skript** (`DATA_QUALITY_SQL`), damit die
> Vorprüfung dauerhaft vollständig ist — drei Befund-Typen, mit Zählung je Kategorie und Befund:
> 1. `checkOutDate < Startdatum` — **kategorieunabhängig** defekt (invertierte Daten);
> 2. `checkOutDate` `NULL` oder `== Startdatum` — verdächtig **nur dort, wo ein Enddatum fachlich
>    erwartet wird** (Hotels, Nicht-One-Way-Flüge);
> 3. `checkOutDate IS NOT NULL` bei einer Kategorie, die **keins tragen darf** (nicht in
>    `hotel`, `flight`, `car`, `train`, `transport`, `other`) — der Altfall aus einem
>    Kategoriewechsel, siehe Offener Punkt 5.
>
> Bei Taxi, Kraftstoff und Verpflegung ist `checkOutDate = NULL` korrekt und erzeugt bewusst keinen
> Befund.
>
> **Fachlicher Kontext zu den Flügen** (User-Regel, siehe Memory `project_reisekosten_fachregeln`):
> Flüge werden in der Praxis meist als **getrennte Einzelstrecken** erfasst (je Beleg `date` = Flugtag)
> — dort ist `checkOutDate = NULL` **fachlich korrekt**, kein Defekt. Round-Trip auf einem Beleg ist
> selten. Hin-/Rückrichtung ist zudem **in keinem DB-Feld kodiert**: `flightRouteType` beschreibt
> Geografie (`international`), nicht Hin/Rück.

### 4. Bulk-Delete/Purge filtert weiter über `expenses.date`

`server/routers.ts` löscht per `DATE(expenses.date) BETWEEN dateFrom AND dateTo`. Ein Beleg,
der nach neuer Regel im Juli ausgewiesen wird, kann damit von einem „Juni"-Purge erfasst werden.
**Bewusst nicht geändert:** destruktive Admin-Funktion mit eigener Semantik („welche Datensätze wurden
in diesem Zeitraum erfasst"), eigene Entscheidung erforderlich.

### 5. Bestandsdaten: kategoriefremde Enddaten (Rollout-Vorbehalt, OFFEN)

Der Fix aus Offener Punkt 1 (Kategoriewechsel räumt die Datumsfelder) wirkt **nur nach vorn**. Belege,
bei denen die Kategorie **vor** v2.5.6 gewechselt wurde, können ein `checkOutDate` tragen, das ihre
heutige Kategorie gar nicht kennt — z. B. ein Taxi mit dem Check-out des ehemaligen Hotels. Das Feld
ist in der Maske unsichtbar, steuert aber weiterhin die Monatszuordnung: **stille Fehlzuordnung, bei
`costModel: "exclusive"` geldwirksam.**

Die Vorprüfung 2026-08-03 hat diese Klasse **nicht** abgedeckt — die damalige Abfrage kannte nur die
Befund-Typen 1 und 2, ein kategoriefremdes, aber nicht invertiertes Enddatum fällt durch beide
Raster. Befund-Typ 3 ist deshalb ins Skript nachgezogen worden (siehe Punkt 3).

**Vor dem Prod-Rollout ist `scripts/analyze-expense-attribution.mjs` (strikt read-only) erneut zu
fahren** und über die gefundenen Altfälle zu entscheiden. Erwartung nach heutigem Kenntnisstand:
keine oder sehr wenige Treffer (der Bestand war 2026-08-03 sauber, und Kategoriewechsel sind selten) —
verifiziert ist das aber nicht.

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
