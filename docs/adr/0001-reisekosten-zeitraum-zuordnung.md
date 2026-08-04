# ADR 0001 — Zeitraum-Zuordnung von Reisekostenbelegen: `expense.date` ist kanonisch

- **Status:** superseded by [ADR 0002](0002-reisekosten-leistungsende.md)
- **Datum:** 2026-08-03
- **Entscheider:** Alexander Döring (Account-Inhaber)
- **Betrifft:** `client/src/lib/monthlyFinancials.ts`, `client/src/pages/Reports.tsx`, Dashboard, Steuerbasis
- **Bezug:** KERN K4 (SSoT), K8 (Zeit-Invarianten), K13 (ADR), K14 (Steuer-/Berechnungslogik)

> **Hinweis (2026-08-03):** Die hier festgelegte Zuordnung über `expense.date` wurde durch
> [ADR 0002](0002-reisekosten-leistungsende.md) ersetzt — maßgeblich ist seither das Leistungsende
> (`checkOutDate ?? date`). Der Text unten bleibt unverändert als historische Entscheidungsgrundlage
> (append-only). Die strukturellen Festlegungen (eine Funktion `isExpenseInPeriod`, eine Filterstelle,
> Vergleich auf `YYYY-MM-DD`-Keys, Server-Ladefilter bleibt Overlap) gelten unverändert weiter.

## Kontext

Buchhaltungsbericht und Dashboard zeigten für denselben Monat (Juli 2026) unterschiedliche
Bruttoumsätze: **38.090,00 €** im Report vs. **37.940,00 €** im Dashboard. Die Differenz von
150,00 € war ein Hotelbeleg über den Monatswechsel (Aufenthalt 30.06.–02.07.).

Ursache waren **zwei konkurrierende Datums-Konventionen**:

1. **Server-Ladefilter** `getAllExpenses` (`server/db.ts:746-755`) lädt Belege per **Overlap**:
   `COALESCE(checkOutDate, checkInDate, date) >= start` UND `COALESCE(checkInDate, date) <= end`.
   Ein Aufenthalt, der das Fenster berührt, wird geladen.
2. **`Reports.tsx`** übernahm diese Ladung **ungefiltert** (`expensesDetailedAll`) — der Beleg zählte
   damit voll im Juli.
3. **`monthlyFinancials.ts`** (geteilte Wahrheitsquelle für Dashboard **und Steuerbasis**) ordnet
   dagegen seit jeher per **`expense.date`** genau einem Monat zu.

Folgen: (a) Report und Dashboard divergierten; (b) der **im Report angezeigte Bruttoumsatz wich von
der Steuerbasis desselben Berichts ab** (der ausgewiesene Nettogewinn basierte auf 37.940 €);
(c) ein monatsübergreifender Beleg erschien im Juni- **und** im Juli-Bericht jeweils in voller Höhe
(**Doppelzählung**, bei exclusive-Kunden auch Doppelfakturierung).

## Entscheidung

**Maßgeblich für die Zeitraum-Zuordnung eines Belegs ist allein `expense.date`.**
checkIn/checkOut spielen für die Zuordnung **keine** Rolle.

Umsetzung:

- Die Regel existiert als **eine** exportierte, reine Funktion `isExpenseInPeriod(expense, periodStart,
  periodEnd)` in `client/src/lib/monthlyFinancials.ts` (K4). `computeMonthlyAmounts` und
  `computeMonthlyDisplayRevenue` nutzen sie intern; `Reports.tsx` filtert damit an **genau einer**
  Stelle, bevor die Belegmenge in irgendeinen Konsumenten fließt.
- Vergleich auf `YYYY-MM-DD`-Keys, Grenzen inklusive, kein `Date`-Roundtrip und kein `toISOString`
  (K8, Europe/Warsaw).

### Bewusst NICHT geändert

- **Server-Ladefilter (`getAllExpenses`) bleibt Overlap-basiert.** Er ist ein *Lade*-Filter, keine
  *Zuordnungs*-Regel: Die Kalender-/Zeiterfassungsansicht spannt Hotels bewusst über
  checkIn..checkOut auf (`TimeTracking.tsx:538-582`). Eine Umstellung auf `date` würde dort Nächte
  verschwinden lassen. Die eindeutige Zuordnung passiert kanonisch im Client.
- **`reportStichtag`** (`Reports.tsx:110-148`) nutzt weiterhin `checkOutDate ?? date ?? checkInDate`.
  Das beantwortet eine andere Frage („welcher Tageskurs gilt", K8 Währung/Stichtag), nicht „welcher
  Monat".

## Konsequenzen

**Positiv**

- Report, Dashboard und Steuerbasis zeigen dieselbe Zahl; die Divergenz-Bugklasse (K1/K4) ist an
  dieser Stelle strukturell geschlossen.
- Die Doppelzählung monatsübergreifender Belege entfällt — jeder Beleg zählt genau einmal.

**Neutral / geprüft**

- **Steuerbasis bei Vollmonats-Berichten unverändert** (bewiesen in
  `server/expensePeriodAttribution.test.ts`): `computeMonthlyTaxSeries` expandiert ohnehin auf volle
  Kalendermonate und filtert intern schon nach `date`; der neue Filter entfernt nur, was dort bereits
  verworfen wurde.

**Zu beachten (Außenwirkung)**

- **Bei Teilmonats-Berichten kann die Steuerbasis sinken:** Belege mit `date` außerhalb des
  Teilzeitraums fallen jetzt raus. Vorher war die Basis asymmetrisch (Zeiteinträge exakt gefiltert,
  Belege per Overlap erweitert); der neue Zustand ist konsistenter. Der Default-Zeitraum ist der volle
  Kalendermonat.
- **Kundenberichte/-exporte ändern sich:** Bei `costModel: "exclusive"` fließen abrechenbare
  Reisekosten in `grandTotal`. Ein monatsübergreifender Beleg erscheint künftig nur noch im Monat
  seines `date`. Wurden für betroffene Monate bereits Rechnungen versandt, liefert eine Neuerstellung
  einen abweichenden (niedrigeren) Betrag — sachlich eine Korrektur der vorherigen Doppelfakturierung.

## Invariante (Voraussetzung der Lösung)

Damit der Client-Filter garantiert eine **Teilmenge** der Server-Ladung ist, muss gelten:
`date` liegt innerhalb der Beleg-Zeitspanne. Das ist durch beide Erfassungswege erzwungen —
`TimeTracking.tsx:1258` (`payloadBase.date = hotelCheckIn`) und `Import.tsx:649-650`
(`payload.date = row.checkInDate || row.date`).

**Offener Restpunkt (theoretisch):** Läge `date` außerhalb von `[checkInDate, checkOutDate]` — nur
durch direkte DB-Manipulation erreichbar —, würde der Beleg bei der Abfrage seines eigenen
`date`-Monats nicht geladen und fiele still aus allen Berichten. Eine DB-Constraint existiert nicht.
Absicherung bei Bedarf: Server-Ladefilter additiv um `OR date BETWEEN start AND end` erweitern.

## Alternativen

- **`checkOutDate ?? date` (Leistungsende) als Konvention:** fachlich ebenfalls vertretbar (Hotel wird
  beim Check-out abgerechnet) und bereits die Stichtag-Logik. **Verworfen**, weil es Umsätze zwischen
  Monaten verschoben und damit **bereits erstellte Steuerbasen rückwirkend geändert** hätte.
- **Nur die Doppelzählung beheben, Divergenz belassen:** verworfen — Report und Steuerbasis wären
  weiterhin auseinandergelaufen.
