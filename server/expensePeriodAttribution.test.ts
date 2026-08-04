import { describe, expect, it } from "vitest";
import {
  computeMonthlyAmounts,
  computeMonthlyDisplayRevenue,
  isExpenseInPeriod,
  type MonthlyAmountsContext,
  type MonthlyCustomer,
  type MonthlyExpense,
} from "../client/src/lib/monthlyFinancials";
import { toExpenseMutationPayload, type ReceiptExpenseCandidate } from "./receiptAi";
// Bewusst aus `./expenseRules` und NICHT aus `./routers`: dieser Test steht im
// pre-commit-Gate und muss abhängigkeitsarm bleiben (kein Router-Graph, kein bcrypt).
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { expenses as expensesTable } from "../drizzle/schema";
import {
  expenseServiceEndDateSql,
  explicitCustomerIdForApproval,
  explicitCustomerIdForRangeCopy,
  isExpenseServiceEndInRange,
  isLinkedExpense,
  selectExpensesForRangeCopy,
  validateExpenseDateRules,
} from "./expenseRules";

/**
 * Kanonische Zeitraum-Zuordnung von (Reisekosten-)Belegen. Rein, keine DB.
 *
 * Regel (ADR 0002, löst ADR 0001 ab): Ein Beleg wird NIE gesplittet, sondern zählt
 * komplett in dem Zeitraum, in dem die LEISTUNG ENDET:
 *
 *   leistungsende = checkOutDate ?? date
 *
 *   - Hotel                     → checkOutDate (Check-out)
 *   - Hin-/Rückflug 1 Ticket    → checkOutDate (Rückflugdatum)
 *   - mehrtägige Belege
 *     (Mietwagen, Zug, ÖPNV,
 *     Sonstiges)                → checkOutDate (Nutzungsende, optional erfassbar)
 *   - punktuelle Ereignisse
 *     (Taxi, Kraftstoff,
 *     Verpflegung, km-Pauschale) → date (kein Enddatum, fachlich auch keins nötig)
 *
 * Hintergrund: `date` ist bei Hotels der CHECK-IN (`TimeTracking.tsx` setzt
 * `payloadBase.date = hotelCheckIn`). Die Vorgängerregel (allein `date`, ADR 0001)
 * buchte einen Aufenthalt über den Monatswechsel deshalb in den Anreisemonat —
 * abgerechnet wird er aber im Monat des Check-outs.
 *
 * Die Regel gilt EINHEITLICH (K4): Kundenabrechnung, Report-Anzeige, Dashboard und
 * Steuerbasis nutzen dieselbe eine Funktion.
 */

const JUNE = { start: "2026-06-01", end: "2026-06-30" };
const JULY = { start: "2026-07-01", end: "2026-07-31" };

/**
 * Referenzfall — Prod-Beleg #596 (Hotel Fritzmeier, 150,00 EUR, exclusive):
 * date/checkIn 30.06., checkOut 02.07. Der Server liefert ihn per Overlap sowohl bei
 * einer Juni- als auch bei einer Juli-Abfrage; die Zuordnung entscheidet allein das
 * Leistungsende (02.07.) → JULI.
 */
const hotelAcrossMonthEnd: MonthlyExpense = {
  customerId: 1,
  amount: 150_00,
  sourceCurrency: "PLN",
  date: "2026-06-30",
  checkInDate: "2026-06-30",
  checkOutDate: "2026-07-02",
};

/**
 * Hin-/Rückflug auf EINEM Ticket: Hinflug 30.06. (`date`), Rückflug 02.07.
 * (`checkOutDate`, so befüllt von `TimeTracking.tsx`). Kein checkInDate — der
 * Fallback muss trotzdem das Rückflugdatum nehmen.
 */
const flightAcrossMonthEnd: MonthlyExpense = {
  customerId: 1,
  amount: 90_00,
  sourceCurrency: "PLN",
  date: "2026-06-30",
  checkOutDate: "2026-07-02",
};

/**
 * Mietwagen über den Monatswechsel: Anmietung 30.06. (`date`), Rückgabe 02.07.
 * (`checkOutDate` als generisches Leistungsende). Kein `checkInDate` — Mietwagen
 * befüllen nur `date` + Enddatum. Ohne erfassbares Enddatum (Zustand vor der
 * Erweiterung der Erfassungs-UI) lag der Beleg im Juni, obwohl das Fahrzeug erst im
 * Juli zurückgeht.
 */
const carAcrossMonthEnd: MonthlyExpense = {
  customerId: 1,
  amount: 240_00,
  sourceCurrency: "PLN",
  date: "2026-06-30",
  checkOutDate: "2026-07-02",
};

describe("isExpenseInPeriod (kanonische Regel: Leistungsende = checkOutDate ?? date)", () => {
  it("Beleg innerhalb des Zeitraums → true", () => {
    expect(isExpenseInPeriod({ date: "2026-07-15" }, JULY.start, JULY.end)).toBe(true);
  });

  it("Beleg vor bzw. nach dem Zeitraum → false", () => {
    expect(isExpenseInPeriod({ date: "2026-06-30" }, JULY.start, JULY.end)).toBe(false);
    expect(isExpenseInPeriod({ date: "2026-08-01" }, JULY.start, JULY.end)).toBe(false);
  });

  it("Grenzen sind inklusive (erster und letzter Tag zählen — auch über das Leistungsende)", () => {
    expect(isExpenseInPeriod({ date: "2026-07-01" }, JULY.start, JULY.end)).toBe(true);
    expect(isExpenseInPeriod({ date: "2026-07-31" }, JULY.start, JULY.end)).toBe(true);
    // Leistungsende exakt auf der Zeitraumgrenze: Anreise im Vormonat, Check-out am 01.07.
    expect(
      isExpenseInPeriod({ date: "2026-06-28", checkOutDate: "2026-07-01" }, JULY.start, JULY.end)
    ).toBe(true);
    // … und am letzten Tag des Zeitraums.
    expect(
      isExpenseInPeriod({ date: "2026-07-29", checkOutDate: "2026-07-31" }, JULY.start, JULY.end)
    ).toBe(true);
    // Ein Tag daneben fällt jeweils raus.
    expect(
      isExpenseInPeriod({ date: "2026-06-25", checkOutDate: "2026-06-30" }, JULY.start, JULY.end)
    ).toBe(false);
    expect(
      isExpenseInPeriod({ date: "2026-07-30", checkOutDate: "2026-08-01" }, JULY.start, JULY.end)
    ).toBe(false);
    // Teilmonats-Zeitraum: dieselbe Regel, engere Grenzen.
    expect(isExpenseInPeriod({ date: "2026-07-15" }, "2026-07-15", "2026-07-20")).toBe(true);
    expect(isExpenseInPeriod({ date: "2026-07-20" }, "2026-07-15", "2026-07-20")).toBe(true);
    expect(isExpenseInPeriod({ date: "2026-07-14" }, "2026-07-15", "2026-07-20")).toBe(false);
    expect(isExpenseInPeriod({ date: "2026-07-21" }, "2026-07-15", "2026-07-20")).toBe(false);
  });

  it("akzeptiert Date-Objekte über die lokalen Datumskomponenten (nie toISOString)", () => {
    // Lokal konstruiert (Monat 0-basiert) → 15.07.2026, unabhängig von der
    // Browser-/Runner-Zeitzone. Ein toISOString-basierter Vergleich würde in
    // Warschau (UTC+2) im Fenster 00:00–02:00 auf den Vortag kippen.
    expect(isExpenseInPeriod({ date: new Date(2026, 6, 15) }, JULY.start, JULY.end)).toBe(true);
    expect(isExpenseInPeriod({ date: new Date(2026, 6, 1) }, JULY.start, JULY.end)).toBe(true);
    expect(isExpenseInPeriod({ date: new Date(2026, 5, 30) }, JULY.start, JULY.end)).toBe(false);
    // Auch das Leistungsende darf ein Date-Objekt sein: Check-in 30.06., Check-out 02.07.
    expect(
      isExpenseInPeriod(
        { date: new Date(2026, 5, 30), checkOutDate: new Date(2026, 6, 2) },
        JULY.start,
        JULY.end
      )
    ).toBe(true);
    expect(
      isExpenseInPeriod(
        { date: new Date(2026, 5, 30), checkOutDate: new Date(2026, 6, 2) },
        JUNE.start,
        JUNE.end
      )
    ).toBe(false);
  });

  it("ohne checkOutDate bleibt `date` maßgeblich (unveränderte Semantik für Taxi/Zug/Kraftstoff)", () => {
    expect(isExpenseInPeriod({ date: "2026-07-05" }, JULY.start, JULY.end)).toBe(true);
    expect(isExpenseInPeriod({ date: "2026-07-05" }, JUNE.start, JUNE.end)).toBe(false);
    expect(isExpenseInPeriod({ date: "2026-07-05", checkOutDate: null }, JULY.start, JULY.end)).toBe(
      true
    );
    // Leerer String / unparsebarer Wert im Enddatum darf den Beleg NICHT still
    // verschlucken — Fallback auf `date`.
    expect(isExpenseInPeriod({ date: "2026-07-05", checkOutDate: "" }, JULY.start, JULY.end)).toBe(
      true
    );
    expect(
      isExpenseInPeriod({ date: "2026-07-05", checkOutDate: "kein datum" }, JULY.start, JULY.end)
    ).toBe(true);
  });

  it("ohne verwertbares Datum → false", () => {
    expect(isExpenseInPeriod({}, JULY.start, JULY.end)).toBe(false);
    expect(isExpenseInPeriod({ date: null }, JULY.start, JULY.end)).toBe(false);
    expect(isExpenseInPeriod({ date: "kein datum" }, JULY.start, JULY.end)).toBe(false);
  });

  it("nur checkOutDate (ohne date) → das Leistungsende trägt allein", () => {
    // Kein produktiver Erfassungsweg erzeugt das, die Regel bleibt aber definiert.
    const hotelWithoutDate = { checkInDate: "2026-07-05", checkOutDate: "2026-07-08" };
    expect(isExpenseInPeriod(hotelWithoutDate, JULY.start, JULY.end)).toBe(true);
  });

  it("REFERENZFALL #596: Hotel 30.06.–02.07. zählt zu JULI, nicht zu Juni", () => {
    expect(isExpenseInPeriod(hotelAcrossMonthEnd, JULY.start, JULY.end)).toBe(true);
    expect(isExpenseInPeriod(hotelAcrossMonthEnd, JUNE.start, JUNE.end)).toBe(false);
  });

  it("Hin-/Rückflug 30.06.→02.07. auf einem Ticket zählt zu JULI (Rückflugdatum)", () => {
    expect(isExpenseInPeriod(flightAcrossMonthEnd, JULY.start, JULY.end)).toBe(true);
    expect(isExpenseInPeriod(flightAcrossMonthEnd, JUNE.start, JUNE.end)).toBe(false);
  });

  it("Mietwagen 30.06.→02.07. zählt zu JULI (Leistungsende = Rückgabe)", () => {
    // Die Regel ist kategorienunabhängig formuliert — sie greift, sobald ein
    // Enddatum erfasst ist, ganz gleich ob Hotel, Flug oder Mietwagen.
    expect(isExpenseInPeriod(carAcrossMonthEnd, JULY.start, JULY.end)).toBe(true);
    expect(isExpenseInPeriod(carAcrossMonthEnd, JUNE.start, JUNE.end)).toBe(false);
  });

  it("Mietwagen OHNE Enddatum bleibt bei `date` (unveränderte Semantik, Feld ist optional)", () => {
    // Das Leistungsende ist bewusst optional: eintägige Anmietungen erfassen nur
    // `date`. Regressionsschutz — die UI-Erweiterung darf den Normalfall nicht
    // verschieben.
    const carSingleDay = { date: "2026-06-30" };
    expect(isExpenseInPeriod(carSingleDay, JUNE.start, JUNE.end)).toBe(true);
    expect(isExpenseInPeriod(carSingleDay, JULY.start, JULY.end)).toBe(false);
    // Leeres Feld (Nutzer hat das Enddatum wieder geleert) verhält sich identisch.
    expect(isExpenseInPeriod({ date: "2026-06-30", checkOutDate: "" }, JUNE.start, JUNE.end)).toBe(
      true
    );
  });

  it("checkOutDate schlägt date auch dann, wenn beide im selben Zeitraum lägen", () => {
    // Regel ist unbedingt: existiert ein Enddatum, entscheidet es — keine Sonderfälle.
    const stayWithinJuly = { date: "2026-07-02", checkOutDate: "2026-07-06" };
    expect(isExpenseInPeriod(stayWithinJuly, JULY.start, JULY.end)).toBe(true);
    expect(isExpenseInPeriod(stayWithinJuly, "2026-07-01", "2026-07-03")).toBe(false);
    expect(isExpenseInPeriod(stayWithinJuly, "2026-07-04", "2026-07-10")).toBe(true);
  });
});

describe("Invarianz: der Report-Filter ändert die Steuerbasis nicht (K4)", () => {
  // Identitäts-Konverter: Testbeträge sind bereits "PLN cents".
  const toPln = (cents: number) => cents;

  // Explizite customerId ⇒ deterministische Attribution (Option B gewinnt vor der
  // Datums-Heuristik), leere Maps genügen. costModel "exclusive" ⇒ die Belege
  // zählen als Umsatz UND als variable Kosten — genau der Pfad, auf dem eine
  // Doppelzählung sichtbar würde.
  const customersById = new Map<number, MonthlyCustomer>([
    [1, { costModel: "exclusive", onsiteRateCurrency: "PLN" }],
  ]);
  const attributionMaps = { entriesById: new Map(), customerIdsByDate: new Map() };

  const timeEntries = [
    {
      id: 1,
      customerId: 1,
      calculatedAmount: 1_000_00,
      sourceCurrency: "PLN",
      date: "2026-07-10",
      entryType: "onsite",
      hours: 480,
      manDays: 1000,
      rate: 1_000_00,
    },
  ];

  // Die Menge, die der Server für eine Juli-Abfrage per Overlap liefert: das Hotel
  // 30.06.–02.07. ist dabei (Leistungsende 02.07. → gehört in den Juli) und ein Beleg
  // mit Check-out 02.08. ebenfalls (Leistungsende im August → gehört NICHT in den Juli).
  const loadedExpenses: MonthlyExpense[] = [
    hotelAcrossMonthEnd,
    { customerId: 1, amount: 300_00, sourceCurrency: "PLN", date: "2026-07-05" },
    {
      customerId: 1,
      amount: 80_00,
      sourceCurrency: "PLN",
      date: "2026-07-31",
      checkInDate: "2026-07-31",
      checkOutDate: "2026-08-02",
    },
  ];

  // Genau das, was Reports.tsx an EINER Stelle tut.
  const julyFilteredExpenses = loadedExpenses.filter((expense) =>
    isExpenseInPeriod(expense, JULY.start, JULY.end)
  );

  const baseCtx = {
    timeEntries,
    customersById,
    attributionMaps,
    monthlyFixedCostsCents: 500_00,
    toPln,
  };
  const ctxWith = (expenses: MonthlyExpense[]): MonthlyAmountsContext => ({
    ...baseCtx,
    expenses,
  });

  it("der Server-Overlap liefert Fremdmonats-Belege, der Filter entfernt genau diese", () => {
    // Das Hotel gehört in den Juli und bleibt drin; der August-Beleg fliegt raus.
    expect(julyFilteredExpenses).toContain(hotelAcrossMonthEnd);
    expect(julyFilteredExpenses).toHaveLength(2);
  });

  it("computeMonthlyAmounts (Juli) liefert mit voller UND mit gefilterter Belegmenge dasselbe", () => {
    const fromLoaded = computeMonthlyAmounts(JULY.start, JULY.end, ctxWith(loadedExpenses));
    const fromFiltered = computeMonthlyAmounts(JULY.start, JULY.end, ctxWith(julyFilteredExpenses));
    expect(fromFiltered).toEqual(fromLoaded);
    // Ankerwerte, damit die Gleichheit nicht versehentlich "beide 0" bedeutet:
    // Umsatz = Zeit 1.000 + exkl. RK (Hotel 150 + 300); variable = 450; fix = 500.
    expect(fromLoaded).toEqual({
      revenueCents: 1_450_00,
      fixedCostsCents: 500_00,
      variableCostsCents: 450_00,
    });
  });

  it("computeMonthlyDisplayRevenue (Dashboard-Chart) ordnet denselben Beleg demselben Monat zu", () => {
    const displayCtx = (expenses: MonthlyExpense[]) => ({
      timeEntries,
      expenses,
      customersById,
      attributionMaps,
      toTarget: toPln,
    });
    const fromLoaded = computeMonthlyDisplayRevenue(JULY.start, JULY.end, displayCtx(loadedExpenses));
    const fromFiltered = computeMonthlyDisplayRevenue(
      JULY.start,
      JULY.end,
      displayCtx(julyFilteredExpenses)
    );
    expect(fromFiltered).toEqual(fromLoaded);
    expect(fromLoaded).toEqual({
      timeCents: 1_000_00,
      travelCents: 450_00,
      grossCents: 1_450_00,
    });

    // Konsistenz-Invariante (K4): der Reisekostenanteil des Charts stimmt mit dem
    // exklusiven RK-Anteil der Steuerbasis überein — dieselbe Regel, beide Monate.
    const julyAmounts = computeMonthlyAmounts(JULY.start, JULY.end, ctxWith(loadedExpenses));
    expect(fromLoaded.travelCents).toBe(julyAmounts.variableCostsCents);
    const juneDisplay = computeMonthlyDisplayRevenue(JUNE.start, JUNE.end, displayCtx(loadedExpenses));
    const juneAmounts = computeMonthlyAmounts(JUNE.start, JUNE.end, ctxWith(loadedExpenses));
    expect(juneDisplay.travelCents).toBe(juneAmounts.variableCostsCents);
  });

  it("das Hotel zählt genau einmal — im Juli, wo seine Leistung endet", () => {
    // Juni: der Beleg ist zwar geladen (Overlap), zählt dort aber in KEINER Größe.
    const june = computeMonthlyAmounts(JUNE.start, JUNE.end, ctxWith(loadedExpenses));
    expect(june.variableCostsCents).toBe(0);
    expect(june.revenueCents).toBe(0);
    // Juli: genau einmal, in voller Höhe (150) neben dem 300er-Beleg.
    const july = computeMonthlyAmounts(JULY.start, JULY.end, ctxWith(loadedExpenses));
    expect(july.variableCostsCents).toBe(450_00);
    // Summe über beide Monate = jeder Beleg genau einmal, nichts doppelt, nichts weg.
    expect(june.variableCostsCents + july.variableCostsCents).toBe(450_00);
  });
});

/**
 * Erzeugender Pfad: Der KI-Beleg-Import muss ein Enddatum LIEFERN, sonst läuft die
 * Zuordnungsregel leer. Deutsche Hotelrechnungen nennen sehr häufig nur „2 Nächte"
 * statt eines Abreisedatums; der Validator lässt das ausdrücklich zu
 * (EXP-HOT-002: `nights` ODER `checkOutDate`). Ohne Ableitung wäre
 * `checkOutDate == checkInDate` — der Beleg klebte am Anreisemonat.
 * Rein, keine DB, kein LLM-Call (nur der Payload-Bau wird aufgerufen).
 */
describe("receiptAi.toExpenseMutationPayload: Check-out aus nights (Voraussetzung für ADR 0002)", () => {
  const hotelCandidate = (
    overrides: Partial<ReceiptExpenseCandidate>
  ): ReceiptExpenseCandidate => ({
    category: "hotel",
    amount: 150,
    currency: "EUR",
    date: "2026-06-30",
    checkInDate: "2026-06-30",
    checkOutDate: null,
    nights: null,
    ...overrides,
  });

  it("checkInDate 30.06. + 1 Nacht → checkOutDate 01.07. (NICHT 30.06.) und damit Juli", () => {
    const payload = toExpenseMutationPayload(hotelCandidate({ nights: 1 }));
    expect(payload.checkOutDate).toBe("2026-07-01");
    expect(payload.checkInDate).toBe("2026-06-30");
    // Und genau so wirkt es sich auf die kanonische Zuordnung aus:
    const expense = { date: payload.date, checkOutDate: payload.checkOutDate };
    expect(isExpenseInPeriod(expense, JULY.start, JULY.end)).toBe(true);
    expect(isExpenseInPeriod(expense, JUNE.start, JUNE.end)).toBe(false);
  });

  it("Referenzfall #596 als KI-Beleg: 30.06. + 2 Nächte → 02.07., Zuordnung Juli", () => {
    const payload = toExpenseMutationPayload(hotelCandidate({ nights: 2 }));
    expect(payload.checkOutDate).toBe("2026-07-02");
    expect(
      isExpenseInPeriod({ date: payload.date, checkOutDate: payload.checkOutDate }, JULY.start, JULY.end)
    ).toBe(true);
  });

  it("Jahresgrenze: 31.12. + 1 Nacht → 01.01. des Folgejahres", () => {
    const payload = toExpenseMutationPayload(
      hotelCandidate({ date: "2026-12-31", checkInDate: "2026-12-31", nights: 1 })
    );
    expect(payload.checkOutDate).toBe("2027-01-01");
  });

  it("explizites checkOutDate schlägt die Ableitung aus nights", () => {
    const payload = toExpenseMutationPayload(
      hotelCandidate({ nights: 5, checkOutDate: "2026-07-02" })
    );
    expect(payload.checkOutDate).toBe("2026-07-02");
  });

  it("ohne nights und ohne checkOutDate bleibt der bisherige Fallback (checkIn)", () => {
    const payload = toExpenseMutationPayload(hotelCandidate({}));
    expect(payload.checkOutDate).toBe("2026-06-30");
  });

  it("0 Nächte (Tagesnutzung) bleibt beim Check-in-Tag", () => {
    const payload = toExpenseMutationPayload(hotelCandidate({ nights: 0 }));
    expect(payload.checkOutDate).toBe("2026-06-30");
  });

  it("Flug bleibt unverändert: checkOutDate = Rückflugdatum", () => {
    const payload = toExpenseMutationPayload({
      category: "flight",
      amount: 420,
      currency: "EUR",
      date: "2026-06-30",
      returnDate: "2026-07-02",
      departureTime: "07:15",
      flightRouteType: "international",
    });
    expect(payload.checkOutDate).toBe("2026-07-02");
    expect(
      isExpenseInPeriod({ date: payload.date, checkOutDate: payload.checkOutDate }, JULY.start, JULY.end)
    ).toBe(true);
  });
});

/**
 * Schreibender Pfad: Ein Enddatum VOR dem Startdatum ordnet den Beleg einem Monat vor
 * seinem eigenen Beginn zu — die Zuordnungsregel (`checkOutDate ?? date`) fragt nicht
 * nach Plausibilität. Vor ADR 0002 war `checkOutDate` faktisch nur bei flight/hotel
 * befüllt, entsprechend prüfte der Server auch nur dort. Mit der Erfassung für
 * mehrtägige Belege (Mietwagen, Zug, ÖPNV, Sonstiges) muss die Chronologie
 * kategorienunabhängig gelten — genau diesen Defekt sucht auch die Vorprüfung
 * `scripts/analyze-expense-attribution.mjs` („DEFEKT: Enddatum VOR Startdatum").
 *
 * Rein, keine DB: die Funktion validiert nur den Eingabe-Payload.
 */
describe("validateExpenseDateRules: Leistungsende >= Leistungsbeginn (kategorienunabhängig)", () => {
  it("Mietwagen mit Enddatum VOR dem Startdatum wird abgelehnt", () => {
    expect(() =>
      validateExpenseDateRules({
        category: "car",
        date: "2026-07-02",
        checkOutDate: "2026-06-30",
      })
    ).toThrow("Enddatum (Leistungsende) darf nicht vor dem Startdatum des Belegs liegen");
  });

  it("dieselbe Regel greift für Zug, ÖPNV und Sonstiges", () => {
    for (const category of ["train", "transport", "other"]) {
      expect(() =>
        validateExpenseDateRules({
          category,
          date: "2026-07-02",
          checkOutDate: "2026-07-01",
        })
      ).toThrow("Enddatum (Leistungsende) darf nicht vor dem Startdatum des Belegs liegen");
    }
  });

  it("gültiger Mietwagen 30.06.→02.07. passiert — und landet im Juli", () => {
    const valid = { category: "car", date: "2026-06-30", checkOutDate: "2026-07-02" };
    expect(() => validateExpenseDateRules(valid)).not.toThrow();
    expect(isExpenseInPeriod(valid, JULY.start, JULY.end)).toBe(true);
  });

  it("gleiches Start- und Enddatum ist zulässig (eintägige Nutzung)", () => {
    expect(() =>
      validateExpenseDateRules({
        category: "car",
        date: "2026-07-02",
        checkOutDate: "2026-07-02",
      })
    ).not.toThrow();
  });

  it("ohne Enddatum bleibt jede Kategorie unverändert gültig", () => {
    // Regressionsschutz: Taxi/Tanken & Co. dürfen von der neuen Prüfung nicht
    // erfasst werden — dort ist checkOutDate korrekterweise leer.
    expect(() => validateExpenseDateRules({ category: "taxi", date: "2026-07-02" })).not.toThrow();
    expect(() =>
      validateExpenseDateRules({ category: "fuel", date: "2026-07-02", checkOutDate: "" })
    ).not.toThrow();
  });

  it("Hotel und Flug behalten ihre spezifischeren Fehlermeldungen", () => {
    // Die kategorienspezifischen Prüfungen laufen zuerst — ihre Texte benennen das
    // konkrete Feld und dürfen von der generischen Regel nicht verdrängt werden.
    expect(() =>
      validateExpenseDateRules({
        category: "hotel",
        date: "2026-07-02",
        checkInDate: "2026-07-02",
        checkOutDate: "2026-06-30",
      })
    ).toThrow(/Check-out darf nicht vor Check-in liegen/);

    expect(() =>
      validateExpenseDateRules({
        category: "flight",
        date: "2026-07-02",
        checkOutDate: "2026-06-30",
        departureTime: "07:15",
        flightRouteType: "international",
      })
    ).toThrow(/Rueckflug-Datum darf nicht vor dem Hinflug-Datum liegen/);
  });

  it("Startdatum ist COALESCE(checkInDate, date) — identisch zu Ladefilter und Vorprüfung", () => {
    // Ist ein checkInDate gesetzt, gewinnt es als Leistungsbeginn; sonst `date`.
    expect(() =>
      validateExpenseDateRules({
        category: "other",
        date: "2026-06-01",
        checkInDate: "2026-07-02",
        checkOutDate: "2026-07-01",
      })
    ).toThrow("Enddatum (Leistungsende) darf nicht vor dem Startdatum des Belegs liegen");
  });
});

/**
 * Kategoriewechsel beim Bearbeiten. `TimeTracking.tsx` setzt `checkInDate`/`checkOutDate`
 * in JEDEM Zweig explizit — bei Kategorien ohne das jeweilige Feld auf `""`, das
 * `db.normalizeExpenseMutationPayload` zu `NULL` normalisiert. Ohne dieses aktive Räumen
 * bliebe der Altwert stehen (ein fehlender Schlüssel heißt dort „unverändert"), mit zwei
 * Folgen — beide hier abgesichert.
 */
describe("Kategoriewechsel räumt die Datumsfelder der alten Kategorie", () => {
  // Genau der Payload, den die Maske nach dem Wechsel auf eine Kategorie ohne
  // Enddatum baut: die Felder fehlen nicht, sie stehen auf "".
  const switchedToTaxi = {
    category: "taxi",
    date: "2026-07-20",
    checkInDate: "",
    checkOutDate: "",
  };

  it("(b) der gewechselte Beleg bleibt speicherbar — keine Sackgasse", () => {
    // Ausgangslage: Flug 10.06. mit Rückflug 12.06., Wechsel auf Taxi am 20.07.
    expect(() => validateExpenseDateRules(switchedToTaxi)).not.toThrow();
    // Gegenprobe — so sähe der Merge OHNE explizites Räumen aus: der Altwert
    // 12.06. läge vor dem neuen Datum, die Chronologie-Regel würde den Beleg
    // dauerhaft ablehnen (nur noch löschen und neu anlegen).
    expect(() =>
      validateExpenseDateRules({ category: "taxi", date: "2026-07-20", checkOutDate: "2026-06-12" })
    ).toThrow("Enddatum (Leistungsende) darf nicht vor dem Startdatum des Belegs liegen");
  });

  it('(a) die Zuordnung fällt auf `date` zurück — "" und NULL verhalten sich gleich', () => {
    // Vor dem Speichern trägt der Payload "", danach steht in der DB NULL. Beide
    // Zustände müssen dieselbe Zuordnung liefern, sonst hinge das Ergebnis am
    // Speicherzeitpunkt.
    const persisted = { category: "taxi", date: "2026-07-20", checkInDate: null, checkOutDate: null };
    expect(isExpenseInPeriod(switchedToTaxi, JULY.start, JULY.end)).toBe(true);
    expect(isExpenseInPeriod(persisted, JULY.start, JULY.end)).toBe(true);
  });

  it("Mietwagen 30.06.–02.07. → Wechsel auf Taxi: zählt wieder im Juni, nicht am Altwert klebend", () => {
    const asCar = { category: "car", date: "2026-06-30", checkOutDate: "2026-07-02" };
    expect(isExpenseInPeriod(asCar, JULY.start, JULY.end)).toBe(true);

    const afterSwitch = { category: "taxi", date: "2026-06-30", checkInDate: "", checkOutDate: "" };
    expect(isExpenseInPeriod(afterSwitch, JUNE.start, JUNE.end)).toBe(true);
    expect(isExpenseInPeriod(afterSwitch, JULY.start, JULY.end)).toBe(false);
  });

  it("Hotel → Mietwagen: das Check-in wird geräumt, das Enddatum bleibt erhalten", () => {
    // `car` gehört zu SERVICE_END_DATE_CATEGORIES, das Enddatum bleibt also bewusst
    // stehen (Nutzer sieht das Feld und kann es ändern) — nur checkInDate fällt weg.
    const afterSwitch = { category: "car", date: "2026-06-30", checkInDate: "", checkOutDate: "2026-07-02" };
    expect(() => validateExpenseDateRules(afterSwitch)).not.toThrow();
    expect(isExpenseInPeriod(afterSwitch, JULY.start, JULY.end)).toBe(true);
  });
});

/**
 * DESTRUKTIVER PFAD — Zurücksetzen/Purge (`clearTimeAndExpenseEntries`, `routers.ts`).
 *
 * Was der Nutzer für einen Monat abgerechnet SIEHT, muss ein Reset dieses Monats auch
 * löschen. Vorher filterte der Purge über `DATE(expenses.date)` und lief damit an
 * ADR 0002 vorbei — Beleg #596 (Hotel 30.06.→02.07.) stand in der JULI-Abrechnung, wurde
 * aber von einem JUNI-Reset gelöscht und von einem Juli-Reset nicht erfasst.
 *
 * Die Regel existiert produktiv in GENAU ZWEI Formulierungen, weil sie in zwei Laufzeiten
 * ausgewertet wird — mehr geht nicht, weniger auch nicht:
 *
 *   (1) SQL:  `expenseServiceEndDateSql` (`server/expenseRules.ts`) → der Purge
 *   (2) JS:   `isExpenseServiceEndInRange` (`shared/expenseServiceEnd.ts`) → die Abrechnung
 *             (über `isExpenseInPeriod`), das Dashboard UND die Auswahl der zu kopierenden
 *             Belege im Server (`selectExpensesForRangeCopy`). Client und Server rufen
 *             dieselbe Implementierung; eine zweite JS-Fassung im Serverbereich wäre die
 *             nächste Driftquelle gewesen.
 *
 * Dieser Block sichert beide Seiten ab:
 *   - Abschnitt 1 rendert (1) über den echten MySQL-Dialekt und assertiert den erzeugten
 *     SQL-String. Ohne das wäre die SQL-Seite ungetestet — ein Rückbau auf
 *     `DATE(expenses.date)` bliebe unbemerkt.
 *   - Abschnitt 3 pinnt die Semantik von (1) gegen (2) — direkt gegen die PRODUKTIVE
 *     JS-Funktion, nicht gegen ein zweites Test-Orakel. Das ist der eigentliche Zweck der
 *     Umstellung: Löschumfang == Abrechnungsumfang == Kopierumfang.
 *
 * Die Werte kommen so aus der DB, wie Drizzle sie liefert: `date`, `checkInDate` und
 * `checkOutDate` sind `timestamp(..., { mode: "string" })` (`drizzle/schema.ts`), also
 * Strings — `""` erreicht die Spalte nie, `normalizeExpenseMutationPayload` mappt es
 * vorher auf `NULL`.
 */
describe("Purge/Zurücksetzen: löscht nach Leistungsende (deckungsgleich zur Abrechnung)", () => {
  const dialect = new MySqlDialect();

  /** Exakt das Prädikat, das `clearTimeAndExpenseEntries` auf Belege anwendet. */
  const renderPurgeExpenseFilter = (from: string, to: string) =>
    dialect.sqlToQuery(
      sql`DATE(${expenseServiceEndDateSql(expensesTable)}) BETWEEN ${from} AND ${to}`
    );

  /** Backticks und Whitespace raus — die Struktur wird geprüft, nicht der Quoting-Stil. */
  const normalizeSql = (statement: string) =>
    statement.replace(/`/g, "").replace(/\s+/g, " ").trim();

  /**
   * TEST-ORAKEL: die SQL-Semantik `DATE(COALESCE(checkOutDate, date)) BETWEEN …` in JS
   * nachgebildet, um sie in Abschnitt 3 gegen `isExpenseInPeriod` stellen zu können.
   *
   * Bewusst NUR hier im Test. Die Key-Ableitung ist **absichtlich identisch** zu
   * `toDateKey` — das ist keine Schwäche, sondern Voraussetzung: Die Matrix soll die
   * **Zuordnungssemantik** pinnen (COALESCE-Reihenfolge, Grenzen inklusive, Durchfallen
   * bei leer/unparsebar), NICHT das Datums-Parsing. Wäre die Parsung hier abweichend,
   * würde die Matrix Parsing-Unterschiede statt Zuordnungsfehler melden.
   * Ein drittes Exemplar dieser Regel im PRODUKTIVCODE wäre dagegen ein K4-Verstoß ohne
   * Nutzen: es hätte keinen Aufrufer und würde nur eine weitere Driftquelle schaffen.
   *
   * `from`/`to` `null` (Löschmodus „all") entspricht dem SQL-Zweig `TRUE`.
   */
  const sqlDateKey = (value: unknown): string | null => {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return null;
    return [
      parsed.getFullYear(),
      String(parsed.getMonth() + 1).padStart(2, "0"),
      String(parsed.getDate()).padStart(2, "0"),
    ].join("-");
  };
  const purgeMatches = (
    expense: { date?: unknown; checkOutDate?: unknown },
    from: string | null,
    to: string | null
  ): boolean => {
    if (!from || !to) return true;
    const serviceEndKey = sqlDateKey(expense?.checkOutDate) ?? sqlDateKey(expense?.date);
    return serviceEndKey !== null && serviceEndKey >= from && serviceEndKey <= to;
  };

  /**
   * Der Filter VOR der Umstellung — `DATE(expenses.date) BETWEEN …`. Nur hier im Test,
   * um die Verhaltensänderung explizit festzuhalten statt sie zu behaupten.
   */
  const legacyDateOnlyMatch = (expense: { date?: unknown }, from: string, to: string) => {
    const key = String(expense.date ?? "").slice(0, 10);
    return key >= from && key <= to;
  };

  describe("1) Das produktive SQL-Prädikat", () => {
    it("rendert DATE(COALESCE(checkOutDate, date)) — und nicht DATE(date)", () => {
      const query = renderPurgeExpenseFilter("2026-07-01", "2026-07-31");
      expect(normalizeSql(query.sql)).toBe(
        "DATE(COALESCE(expenses.checkOutDate, expenses.date)) BETWEEN ? AND ?"
      );
    });

    it("nimmt die Spalten in der richtigen Reihenfolge — checkOutDate schlägt date", () => {
      // Vertauscht wäre `date` immer gesetzt (NOT NULL) und `checkOutDate` nie wirksam:
      // der Fix wäre lautlos zurückgebaut.
      const rendered = normalizeSql(renderPurgeExpenseFilter("2026-07-01", "2026-07-31").sql);
      expect(rendered.indexOf("checkOutDate")).toBeLessThan(rendered.indexOf("expenses.date"));
    });

    it("bindet die Zeitraumgrenzen als Parameter (keine String-Interpolation)", () => {
      const query = renderPurgeExpenseFilter("2026-07-01", "2026-07-31");
      expect(query.params).toEqual(["2026-07-01", "2026-07-31"]);
      expect(query.sql).not.toContain("2026-07-01");
    });

    it("die Purge-Prozedur verwendet genau diesen Baustein", () => {
      // Quelltext-Prüfung, weil `routers.ts` nicht importierbar ist (zieht `bcrypt` und
      // damit ein natives Binding ins schnelle Gate). Ohne sie bliebe genau die Drift
      // ungesichert, um die es hier geht: ein Rückbau der Aufrufstelle auf
      // `dateFilter(expensesTable.date)` ließe alle übrigen Tests grün.
      //
      // GRENZEN dieser Prüfung (bewusst in Kauf genommen): Sie deckt nur die WÖRTLICHE
      // Schreibweise ab — `dateFilter( expensesTable.date )`, `expensesTable["date"]`
      // oder ein direkt eingebettetes `sql`-Fragment schlüpfen durch. Umgekehrt färbt
      // ein Kommentar, der den Alt-Aufruf zitiert, das Gate grundlos rot.
      // Bei Umbenennung/Umformatierung hier **nachziehen, nicht löschen**.
      // Sauberere Lösung als Folgeschritt: das gesamte Beleg-Prädikat nach
      // `expenseRules.ts` ziehen (`purgeExpenseWhere(...)`), dann testet das Gate den
      // vollständigen WHERE-Ausdruck und diese Quelltext-Prüfung entfällt ersatzlos.
      const routersSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
      expect(routersSource).toContain("expenseServiceEndDateSql(expensesTable)");
      expect(routersSource).not.toContain("dateFilter(expensesTable.date)");
    });
  });

  describe("2) Verhalten des Prädikats (über das Test-Orakel)", () => {
  it("REFERENZFALL #596: Hotel 30.06.→02.07. wird vom JULI-Reset gelöscht, nicht mehr vom Juni-Reset", () => {
    expect(purgeMatches(hotelAcrossMonthEnd, JULY.start, JULY.end)).toBe(true);
    expect(purgeMatches(hotelAcrossMonthEnd, JUNE.start, JUNE.end)).toBe(false);

    // Genau umgekehrt zum alten Verhalten — das ist die Verhaltensänderung.
    expect(legacyDateOnlyMatch(hotelAcrossMonthEnd, JUNE.start, JUNE.end)).toBe(true);
    expect(legacyDateOnlyMatch(hotelAcrossMonthEnd, JULY.start, JULY.end)).toBe(false);
  });

  it("ohne checkOutDate entscheidet weiterhin `date` (unverändert für Taxi/Kraftstoff/Verpflegung)", () => {
    const taxi = { date: "2026-06-30 00:00:00" };
    expect(purgeMatches(taxi, JUNE.start, JUNE.end)).toBe(true);
    expect(purgeMatches(taxi, JULY.start, JULY.end)).toBe(false);
    // NULL und leerer String verhalten sich wie „nicht gesetzt" — kein stiller Ausfall
    // aus jedem Zeitraum (der Beleg wäre sonst von KEINEM Reset mehr erfasst).
    expect(purgeMatches({ date: "2026-06-30", checkOutDate: null }, JUNE.start, JUNE.end)).toBe(true);
    expect(purgeMatches({ date: "2026-06-30", checkOutDate: "" }, JUNE.start, JUNE.end)).toBe(true);
    // Gegenprobe zum alten Verhalten: hier ändert sich nichts.
    expect(legacyDateOnlyMatch(taxi, JUNE.start, JUNE.end)).toBe(true);
  });

  it("Grenzen sind inklusive — erster und letzter Tag des Zeitraums zählen", () => {
    expect(purgeMatches({ date: "2026-07-01" }, JULY.start, JULY.end)).toBe(true);
    expect(purgeMatches({ date: "2026-07-31" }, JULY.start, JULY.end)).toBe(true);
    expect(purgeMatches({ date: "2026-06-30" }, JULY.start, JULY.end)).toBe(false);
    expect(purgeMatches({ date: "2026-08-01" }, JULY.start, JULY.end)).toBe(false);
    // … auch wenn das Leistungsende exakt auf einer Grenze liegt.
    expect(
      purgeMatches({ date: "2026-06-28", checkOutDate: "2026-07-01" }, JULY.start, JULY.end)
    ).toBe(true);
    expect(
      purgeMatches({ date: "2026-07-29", checkOutDate: "2026-07-31" }, JULY.start, JULY.end)
    ).toBe(true);
    expect(
      purgeMatches({ date: "2026-07-30", checkOutDate: "2026-08-01" }, JULY.start, JULY.end)
    ).toBe(false);
    // Teilmonats-Zeitraum (Löschmodus „custom"): dieselbe Regel, engere Grenzen.
    expect(purgeMatches({ date: "2026-07-15" }, "2026-07-15", "2026-07-20")).toBe(true);
    expect(purgeMatches({ date: "2026-07-20" }, "2026-07-15", "2026-07-20")).toBe(true);
    expect(purgeMatches({ date: "2026-07-14" }, "2026-07-15", "2026-07-20")).toBe(false);
  });

  it("MySQL-Timestamp-Strings ergeben denselben Kalendertag wie reine Datums-Keys (DATE())", () => {
    // So liefert Drizzle die Spalten tatsächlich. `DATE()` schneidet die Uhrzeit ab —
    // die Uhrzeit darf die Zuordnung an der Monatsgrenze nicht kippen.
    const hotelFromDb = { date: "2026-06-30 00:00:00", checkOutDate: "2026-07-02 00:00:00" };
    expect(purgeMatches(hotelFromDb, JULY.start, JULY.end)).toBe(true);
    expect(purgeMatches(hotelFromDb, JUNE.start, JUNE.end)).toBe(false);
    expect(purgeMatches({ date: "2026-07-31 23:59:59" }, JULY.start, JULY.end)).toBe(true);
  });

  it('Löschmodus "all" (keine Grenzen) erfasst jeden Beleg — entspricht dem SQL-Zweig TRUE', () => {
    expect(purgeMatches(hotelAcrossMonthEnd, null, null)).toBe(true);
    expect(purgeMatches({ date: "1999-01-01" }, null, null)).toBe(true);
    // Ohne verwertbares Datum, aber mit Grenzen: kein Treffer (SQL: DATE(NULL) → NULL).
    expect(purgeMatches({}, JULY.start, JULY.end)).toBe(false);
  });

  it("Altbestand mit Enddatum VOR dem Startdatum: das Enddatum entscheidet trotzdem", () => {
    // Chronologie-Verletzung, die vor `validateExpenseDateRules` speicherbar war (und
    // per direkter DB-Manipulation weiterhin entstehen kann). COALESCE fragt nicht nach
    // Plausibilität, `checkOutDate ?? date` ebenso wenig — beide nehmen stumpf das
    // Enddatum. Das ist nicht schön, aber KONSISTENT: der Beleg wird von dem Reset
    // erfasst, in dessen Monat ihn auch die Abrechnung ausweist. Genau das ist die
    // Eigenschaft, auf die es hier ankommt; die Plausibilität sichert der Schreibpfad.
    const brokenChronology = { date: "2026-07-10", checkOutDate: "2026-06-05" };
    expect(purgeMatches(brokenChronology, JUNE.start, JUNE.end)).toBe(true);
    expect(purgeMatches(brokenChronology, JULY.start, JULY.end)).toBe(false);
    expect(isExpenseInPeriod(brokenChronology, JUNE.start, JUNE.end)).toBe(true);
    expect(isExpenseInPeriod(brokenChronology, JULY.start, JULY.end)).toBe(false);
  });
  });

  /**
   * DER EIGENTLICHE ZWECK DER UMSTELLUNG: dieselbe Menge, die für einen Monat
   * abgerechnet wird, ist die Menge, die ein Reset dieses Monats löscht.
   */
  describe("3) Deckungsgleichheit SQL == JS (Abrechnung == Löschumfang == Kopierumfang)", () => {
    const cases: Array<{ label: string; expense: { date?: unknown; checkOutDate?: unknown } }> = [
      { label: "Hotel #596 über den Monatswechsel", expense: hotelAcrossMonthEnd },
      { label: "Hin-/Rückflug auf einem Ticket", expense: flightAcrossMonthEnd },
      { label: "Mietwagen über den Monatswechsel", expense: carAcrossMonthEnd },
      { label: "punktueller Beleg ohne Enddatum", expense: { date: "2026-07-05" } },
      { label: "Beleg am ersten Tag", expense: { date: "2026-07-01" } },
      { label: "Beleg am letzten Tag", expense: { date: "2026-07-31" } },
      { label: "Enddatum genau auf der unteren Grenze", expense: { date: "2026-06-28", checkOutDate: "2026-07-01" } },
      { label: "Enddatum einen Tag hinter der oberen Grenze", expense: { date: "2026-07-30", checkOutDate: "2026-08-01" } },
      { label: "Enddatum NULL", expense: { date: "2026-07-05", checkOutDate: null } },
      { label: "Enddatum leerer String", expense: { date: "2026-07-05", checkOutDate: "" } },
      { label: "Enddatum unparsebar", expense: { date: "2026-07-05", checkOutDate: "kein datum" } },
      { label: "gar kein Datum", expense: {} },
      { label: "MySQL-Timestamp aus der DB", expense: { date: "2026-06-30 00:00:00", checkOutDate: "2026-07-02 00:00:00" } },
      { label: "Date-Objekt statt String", expense: { date: new Date(2026, 5, 30), checkOutDate: new Date(2026, 6, 2) } },
      { label: "Enddatum liegt im Vormonat des Zeitraums", expense: { date: "2026-05-30", checkOutDate: "2026-06-02" } },
      // Altbestand vor `validateExpenseDateRules`: Enddatum VOR dem Startdatum. Beide
      // Formulierungen nehmen stumpf das Enddatum — unplausibel, aber deckungsgleich.
      { label: "Enddatum vor dem Startdatum (Chronologie-Verletzung)", expense: { date: "2026-07-10", checkOutDate: "2026-06-05" } },
    ];

    const ranges = [
      { label: "Juni", start: JUNE.start, end: JUNE.end },
      { label: "Juli", start: JULY.start, end: JULY.end },
      { label: "Teilmonat 15.–20.07.", start: "2026-07-15", end: "2026-07-20" },
      { label: "Jahr 2026", start: "2026-01-01", end: "2026-12-31" },
    ];

    for (const { label, expense } of cases) {
      for (const range of ranges) {
        it(`${label} — ${range.label}: SQL-Semantik == produktive JS-Regel`, () => {
          // Links das JS-Abbild der SQL-Semantik (Test-Orakel), rechts die Funktion, die
          // produktiv Abrechnung, Dashboard UND Kopier-Auswahl entscheidet.
          expect(purgeMatches(expense, range.start, range.end)).toBe(
            isExpenseServiceEndInRange(expense, range.start, range.end)
          );
          // … und der Client-Einstieg reicht wirklich an dieselbe Funktion durch.
          expect(isExpenseInPeriod(expense, range.start, range.end)).toBe(
            isExpenseServiceEndInRange(expense, range.start, range.end)
          );
        });
      }
    }

    it("Partition: jeder Beleg wird von GENAU EINEM Monats-Reset erfasst — nichts doppelt, nichts übrig", () => {
      // Das ist die Sicherheits-Invariante der Umstellung: über eine lückenlose
      // Monatsfolge verschiebt sich der Löschumfang nur, er wächst nicht und lässt
      // keinen Beleg zurück. Belege ohne verwertbares Datum sind ausgenommen — die
      // erfasst nur der Löschmodus „all".
      const months = [
        { start: "2026-05-01", end: "2026-05-31" },
        { start: "2026-06-01", end: "2026-06-30" },
        { start: "2026-07-01", end: "2026-07-31" },
        { start: "2026-08-01", end: "2026-08-31" },
      ];
      for (const { label, expense } of cases) {
        if (label === "gar kein Datum") continue;
        const hits = months.filter((m) => purgeMatches(expense, m.start, m.end)).length;
        expect(hits, `${label} wurde von ${hits} Monats-Resets erfasst`).toBe(1);
        // Dieselbe Partition muss für die produktive JS-Regel gelten — darauf stützt sich
        // der Kopier-Fix (ein Beleg wird von genau EINEM Kopierlauf erfasst).
        const jsHits = months.filter((m) =>
          isExpenseServiceEndInRange(expense, m.start, m.end)
        ).length;
        expect(jsHits, `${label} wurde von ${jsHits} Zeiträumen erfasst`).toBe(1);
      }
    });
  });
});

/**
 * SCHREIBENDER PFAD — „Zeitraum kopieren" (`copyRangeToNext`, `routers.ts`).
 *
 * `db.getAllExpenses(userId, start, end)` filtert per OVERLAP. Als LADE-Filter ist das
 * richtig (der Bericht muss jeden berührenden Beleg sehen und entscheidet selbst), als
 * SELEKTIONSMENGE EINER SCHREIBOPERATION war es der Bug: Ein grenzüberspannender Beleg
 * (Hotel 30.06.–02.07.) liegt in MEHREREN Kopierläufen. „Juni kopieren" und danach „Juli
 * kopieren" legten dasselbe Duplikat an — bei `costModel: "exclusive"` steht der Beleg damit
 * doppelt in Kundenrechnung UND Steuerbasis.
 *
 * `selectExpensesForRangeCopy` schneidet die Obermenge auf die Belege zu, die nach ADR 0002
 * in den Quellzeitraum GEHÖREN (Leistungsende). Verknüpfte Belege bleiben bewusst
 * ungefiltert — Begründung am Code.
 */
describe("copyRangeToNext: Auswahl der zu kopierenden Belege (Duplikat-Fix)", () => {
  /** Standalone-Beleg = kein `timeEntryId`. Genau die betroffene Klasse. */
  const standaloneHotel = { ...hotelAcrossMonthEnd, id: 1, timeEntryId: null };
  const standaloneTaxi = { id: 2, timeEntryId: null, date: "2026-06-15" };
  /** Verknüpfter Beleg mit demselben Datumsprofil wie das Hotel. */
  const linkedHotel = { ...hotelAcrossMonthEnd, id: 3, timeEntryId: 77 };

  /**
   * Was `getAllExpenses` per Overlap für einen Zeitraum liefert — inklusive der Belege, die
   * nur hineinragen. Bewusst grob nachgebildet (untere Grenze über Leistungsende, obere über
   * Leistungsbeginn), damit der Testfall dieselbe Obermenge sieht wie der Server.
   */
  const loadedForRange = <T extends { date?: unknown; checkInDate?: unknown; checkOutDate?: unknown }>(
    all: readonly T[],
    start: string,
    end: string
  ): T[] => {
    const key = (value: unknown) => (value ? String(value).slice(0, 10) : null);
    return all.filter((expense) => {
      const overlapEnd = key(expense.checkOutDate) ?? key(expense.checkInDate) ?? key(expense.date);
      const overlapStart = key(expense.checkInDate) ?? key(expense.date);
      return overlapEnd !== null && overlapStart !== null && overlapEnd >= start && overlapStart <= end;
    });
  };

  it("die Obermenge enthält das Hotel tatsächlich in BEIDEN Monaten (das ist die Ursache)", () => {
    expect(loadedForRange([standaloneHotel], JUNE.start, JUNE.end)).toHaveLength(1);
    expect(loadedForRange([standaloneHotel], JULY.start, JULY.end)).toHaveLength(1);
  });

  it("REFERENZFALL: Standalone-Hotel 30.06.–02.07. wird vom JULI-Lauf kopiert, vom Juni-Lauf nicht", () => {
    const june = selectExpensesForRangeCopy(
      loadedForRange([standaloneHotel], JUNE.start, JUNE.end),
      JUNE.start,
      JUNE.end
    );
    const july = selectExpensesForRangeCopy(
      loadedForRange([standaloneHotel], JULY.start, JULY.end),
      JULY.start,
      JULY.end
    );
    expect(june).toHaveLength(0);
    expect(july).toHaveLength(1);
  });

  it("über eine lückenlose Zeitraumfolge wird JEDER Standalone-Beleg genau einmal kopiert", () => {
    // Der eigentliche Duplikat-Schutz: nacheinander „Juni kopieren", „Juli kopieren", …
    const all = [standaloneHotel, standaloneTaxi];
    const months = [
      { start: "2026-05-01", end: "2026-05-31" },
      { start: JUNE.start, end: JUNE.end },
      { start: JULY.start, end: JULY.end },
      { start: "2026-08-01", end: "2026-08-31" },
    ];
    for (const expense of all) {
      const hits = months.filter(
        (m) =>
          selectExpensesForRangeCopy(loadedForRange([expense], m.start, m.end), m.start, m.end)
            .length === 1
      ).length;
      expect(hits, `Beleg ${expense.id} wurde von ${hits} Kopierläufen erfasst`).toBe(1);
    }
  });

  it("scope 'day': drei Tagesläufe über den Aufenthalt erzeugen zusammen EINE Kopie", () => {
    // Vorher der schlimmste Fall: 30.06., 01.07. und 02.07. hätten je eine Kopie angelegt.
    const days = ["2026-06-30", "2026-07-01", "2026-07-02"];
    const hits = days.filter(
      (day) =>
        selectExpensesForRangeCopy(loadedForRange([standaloneHotel], day, day), day, day).length === 1
    );
    expect(hits).toEqual(["2026-07-02"]);
  });

  it("verknüpfte Belege bleiben ungefiltert — sie folgen ihrem Zeiteintrag", () => {
    // Ohne diese Ausnahme fiele das Hotel zum Zeiteintrag vom 30.06. durch BEIDE Läufe:
    // im Juni wegen des Leistungsendes im Juli, im Juli wegen des fehlenden Eltern-Eintrags
    // (der liegt im Juni). Es wäre nie wieder kopierbar. Doppeln kann es nicht, weil
    // `getTimeEntries` exakt auf `timeEntries.date` filtert.
    const june = selectExpensesForRangeCopy(
      loadedForRange([linkedHotel], JUNE.start, JUNE.end),
      JUNE.start,
      JUNE.end
    );
    expect(june).toHaveLength(1);
    expect(june[0]?.id).toBe(3);
  });

  it("timeEntryId 0 gilt als verknüpft, nicht als 'nicht gesetzt'", () => {
    // Regressionsschutz gegen einen truthy-Check: `0` ist zwar falsy, aber ein gesetzter Wert.
    const linkedWithZero = { ...hotelAcrossMonthEnd, id: 4, timeEntryId: 0 };
    expect(
      selectExpensesForRangeCopy([linkedWithZero], JUNE.start, JUNE.end)
    ).toHaveLength(1);
  });

  it("Belege ohne verwertbares Datum werden nicht kopiert", () => {
    expect(selectExpensesForRangeCopy([{ timeEntryId: null }], JULY.start, JULY.end)).toHaveLength(0);
  });

  it("die Kopier-Prozedur verwendet genau diesen Baustein", () => {
    // Quelltext-Prüfung, weil `routers.ts` nicht importierbar ist (zieht `bcrypt` ins Gate).
    // Ohne sie bliebe ein Rückbau auf `getAllExpenses(...)` als Selektionsmenge unbemerkt.
    // Bei Umbenennung hier NACHZIEHEN, nicht löschen.
    const routersSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    expect(routersSource).toContain("selectExpensesForRangeCopy(");
  });
});

/**
 * SCHREIBENDER PFAD — Kundenzuordnung der KOPIE („Zeitraum kopieren", `copyRangeToNext`).
 *
 * Der Bug: Der Kopier-Payload trug `expense.customerId` gar nicht mit. Eine kopierte
 * EIGENSTÄNDIGE Position (`timeEntryId IS NULL`) landete mit `customerId = NULL` in der DB
 * und verlor ihre explizite Zuordnung. `getExpenseBillingCustomerId`
 * (`client/src/lib/expenseAttribution.ts`) fiel damit von Zweig (1) „explizite customerId
 * gewinnt immer" auf die Datums-Heuristik „genau EIN Kunde mit Zeiteintrag an diesem Tag"
 * zurück. An einem Tag mit zwei Kunden — oder ganz ohne Zeiteintrag — war die Kopie danach
 * KEINEM Kunden zugeordnet: raus aus der Kundenabrechnung, bei `costModel: "exclusive"`
 * kein weiterberechneter Umsatz mehr. Still, ohne Hinweis.
 *
 * Die FALLGRUBE beim Beheben: `db.getAllExpenses` liefert `customerId` aus zwei Quellen
 * unter EINEM Namen (siehe Test „die beiden Zweige …" unten). Blind übernommen, stünde bei
 * verknüpften Belegen der Kunde des ZEITEINTRAGS als explizite Belegzuweisung in der Kopie —
 * sie entschiede fortan über Zweig (1) statt über den Zeiteintrag und liefe bei einem
 * Kundenwechsel des Eintrags vom Original weg.
 */
describe("copyRangeToNext: Kundenzuordnung der Kopie", () => {
  it("die beiden `getAllExpenses`-Zweige liefern `customerId` aus VERSCHIEDENEN Quellen", () => {
    // Die Existenzberechtigung des Helfers. Würde der verknüpfte Zweig eines Tages ebenfalls
    // `expenses.customerId` selektieren, wäre die Unterscheidung überflüssig — und dieser
    // Test der Ort, an dem das auffällt. Quelltext-Prüfung, weil `db.ts` einen DB-Treiber
    // zieht und nicht ins schnelle Gate gehört. Bei Umbenennung NACHZIEHEN, nicht löschen.
    const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
    expect(dbSource).toContain("customerId: timeEntries.customerId,"); // verknüpfter Zweig
    expect(dbSource).toContain("customerId: expenses.customerId,"); // Standalone-Zweig
  });

  it("eigenständiger Beleg MIT Kundenzuordnung: die Kopie trägt dieselbe customerId", () => {
    expect(explicitCustomerIdForRangeCopy({ timeEntryId: null, customerId: 42 })).toBe(42);
  });

  it("eigenständiger Beleg OHNE Kundenzuordnung: die Kopie bleibt null (keine erfundene Zuordnung)", () => {
    expect(explicitCustomerIdForRangeCopy({ timeEntryId: null, customerId: null })).toBeNull();
    // Alt-Belege vor Migration 0024 kommen ohne das Feld aus dem Backup-Restore.
    expect(explicitCustomerIdForRangeCopy({ timeEntryId: null })).toBeNull();
  });

  it("FALLGRUBE: verknüpfter Beleg — die Kopie bekommt KEINE explizite customerId", () => {
    // `customerId: 42` stammt hier aus `timeEntries.customerId` (verknüpfter Zweig), ist also
    // keine Belegzuweisung. Die Kopie erbt ihre Zuordnung über den mitkopierten Zeiteintrag.
    expect(explicitCustomerIdForRangeCopy({ timeEntryId: 77, customerId: 42 })).toBeNull();
  });

  it("timeEntryId 0 gilt als verknüpft, nicht als 'nicht gesetzt'", () => {
    // Regressionsschutz gegen einen truthy-Check — gleiche Lesart wie in
    // `selectExpensesForRangeCopy`. Eine `0` kam aus dem innerJoin-Zweig.
    expect(explicitCustomerIdForRangeCopy({ timeEntryId: 0, customerId: 42 })).toBeNull();
  });

  it("ein unbrauchbarer Wert wird fallengelassen statt in ein INSERT getragen", () => {
    expect(explicitCustomerIdForRangeCopy({ timeEntryId: null, customerId: "" })).toBeNull();
    expect(explicitCustomerIdForRangeCopy({ timeEntryId: null, customerId: "keine Zahl" })).toBeNull();
    // Kein gültiger FK: die Spalte referenziert `customers.id` (Autoincrement, ≥ 1).
    expect(explicitCustomerIdForRangeCopy({ timeEntryId: null, customerId: 0 })).toBeNull();
    expect(explicitCustomerIdForRangeCopy({ timeEntryId: null, customerId: -1 })).toBeNull();
    // Numerische Strings sind gültige FK-Werte (JSON-Restore) und bleiben erhalten.
    expect(explicitCustomerIdForRangeCopy({ timeEntryId: null, customerId: "42" })).toBe(42);
  });

  it("die Kopier-Prozedur verwendet genau diesen Baustein", () => {
    // Ohne diese Prüfung bliebe sowohl der Rückbau (Feld fehlt wieder) als auch die
    // Blindübernahme (`customerId: expense.customerId`) unbemerkt: beides ist an den reinen
    // Funktionstests oben nicht sichtbar. Bei Umbenennung NACHZIEHEN, nicht löschen.
    const routersSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");

    // Beide Prüfungen gelten NUR dem Kopier-Payload, nicht der ganzen Datei: `routers.ts`
    // hat über 5.000 Zeilen und weitere Prozeduren mit einer lokalen `expense`-Variablen
    // (z. B. `expenses.update`, das den Beleg über `getExpenseById` lädt — dort liefert der
    // Treiber die ROHSPALTE, eine Übernahme wäre also legitim). Dateiweit würde dieser Test
    // sonst irgendwann grundlos rot. Anker ist die erste Payload-Zeile (dateiweit eindeutig,
    // anders als `const payload: Record<string, any> = {`, das es zweimal gibt); der Block
    // enthält nur flache Felder, das nächste `};` ist damit sein Ende.
    const payloadStart = routersSource.indexOf("timeEntryId: mappedTimeEntryId ?? undefined,");
    expect(payloadStart).toBeGreaterThan(-1);
    const payloadEnd = routersSource.indexOf("};", payloadStart);
    expect(payloadEnd).toBeGreaterThan(payloadStart);
    const payloadBlock = routersSource.slice(payloadStart, payloadEnd);

    expect(payloadBlock).toContain("customerId: explicitCustomerIdForRangeCopy(expense),");
    expect(payloadBlock).not.toContain("customerId: expense.customerId");
  });
});

/**
 * BERECHNUNGSGRUNDLAGE — `distance`/`rate`/`liters`/`pricePerLiter` (v2.7.4).
 *
 * `getAllExpenses` selektierte diese vier Spalten in KEINEM seiner beiden Zweige, obwohl der
 * Kopier-Payload sie liest. Sie waren dort immer `undefined` und wurden von
 * `normalizeExpenseMutationPayload` entfernt: die Kopie eines Tank-, Mietwagen- oder
 * Kilometerpauschale-Belegs hatte einen korrekten `amount`, aber keinen Nachweis mehr
 * (Belegpflicht Kilometerpauschale). Dieselbe Lücke traf die Bearbeiten-Maske, die ihre
 * Felder aus `expense.distance`/`expense.rate` befüllt.
 */
describe("getAllExpenses: Berechnungsgrundlage wird mitgeladen", () => {
  // Quelltext-Prüfung, weil `db.ts` einen DB-Treiber zieht und nicht ins schnelle Gate
  // gehört (gleiche Begründung wie beim customerId-Wächter oben). Die Zweige werden über
  // ihre unterscheidende `customerId`-Zeile aufgetrennt.
  const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
  const linkedStart = dbSource.indexOf("customerId: timeEntries.customerId,");
  const standaloneStart = dbSource.indexOf("customerId: expenses.customerId,");
  const linkedBranch = dbSource.slice(linkedStart, dbSource.indexOf(".innerJoin(", linkedStart));
  const standaloneBranch = dbSource.slice(
    standaloneStart,
    dbSource.indexOf(".where(and(...standaloneConditions))", standaloneStart)
  );

  it("die Zweige lassen sich im Quelltext sauber auftrennen", () => {
    // Schlägt das fehl, prüfen die Tests unten nichts mehr — dann NACHZIEHEN, nicht löschen.
    expect(linkedStart).toBeGreaterThan(-1);
    expect(standaloneStart).toBeGreaterThan(-1);
    expect(linkedBranch.length).toBeGreaterThan(0);
    expect(standaloneBranch.length).toBeGreaterThan(0);
  });

  it.each([
    ["distance", "distance: expenses.distance,"],
    ["rate", "rate: expenses.rate,"],
    ["liters", "liters: expenses.liters,"],
    ["pricePerLiter", "pricePerLiter: expenses.pricePerLiter,"],
  ])("beide Zweige selektieren %s", (_name, selectLine) => {
    expect(linkedBranch).toContain(selectLine);
    expect(standaloneBranch).toContain(selectLine);
  });

  it("FALLGRUBE: der verknüpfte Zweig nimmt `expenses.rate`, NICHT `timeEntries.rate`", () => {
    // Dieser Zweig joint beide Tabellen und BEIDE haben eine Spalte `rate`.
    // `timeEntries.rate` ist der Tagessatz des Zeiteintrags, `expenses.rate` die Pauschale
    // des Belegs — dieselbe Verwechslungsgefahr wie bei `customerId`. Ein Griff daneben
    // schriebe den Tagessatz als Kilometerpauschale in die Kopie: geldwirksam und still.
    expect(linkedBranch).not.toContain("rate: timeEntries.rate");
  });
});

/**
 * KI-FREIGABE — die aufgelöste Kundenzuordnung landet im Beleg (v2.7.4).
 *
 * Beide Freigabepfade lösen einen Ziel-Kunden auf und prüfen sogar den Zugriff darauf,
 * verwarfen ihn dann aber: `toExpenseMutationPayload` kennt `customerId` nicht. Ein per KI
 * ohne Zeiteintrag freigegebener Beleg bekam `customerId = NULL` — exakt das Fehlerbild, das
 * v2.7.3 für die Kopie behoben hat.
 */
describe("receiptAi-Freigabe: Kundenzuordnung der Freigabe", () => {
  it("ohne Zeiteintrag: der aufgelöste Kunde wird übernommen", () => {
    expect(explicitCustomerIdForApproval(undefined, 42)).toBe(42);
    expect(explicitCustomerIdForApproval(null, "42")).toBe(42);
  });

  it("mit Zeiteintrag: KEINE explizite Zuordnung (der Beleg folgt dem Eintrag)", () => {
    expect(explicitCustomerIdForApproval(77, 42)).toBeNull();
  });

  it("ohne Kundentreffer bleibt es null (keine erfundene Zuordnung)", () => {
    expect(explicitCustomerIdForApproval(undefined, undefined)).toBeNull();
    expect(explicitCustomerIdForApproval(undefined, "")).toBeNull();
    expect(explicitCustomerIdForApproval(undefined, "keine Zahl")).toBeNull();
  });

  it("customerId 0 wird verworfen — sonst liefe sie am Zugriffs-Guard vorbei", () => {
    // Die Kundenprüfung der Prozedur steht in `else if (targetCustomerId)` — truthy. Eine
    // `0` überspränge sie und landete ungeprüft im INSERT, wo der FK sie als roher
    // MySQL-1452 abwiese statt als sauberes 400/403. Guard und Schreibpfad müssen dieselbe
    // Menge akzeptieren. Gilt auch für negative Werte.
    expect(explicitCustomerIdForApproval(undefined, 0)).toBeNull();
    expect(explicitCustomerIdForApproval(undefined, "0")).toBeNull();
    expect(explicitCustomerIdForApproval(undefined, -1)).toBeNull();
  });

  it("die Lesart ist KOMPLEMENTÄR zum timeEntryId-Zweig derselben Prozedur", () => {
    // Der Payload setzt `timeEntryId` unter `if (targetTimeEntryId)` — truthy. Diese
    // Funktion muss exakt gegenläufig entscheiden, sonst entstünde ein Beleg, der verknüpft
    // UND explizit zugeordnet ist (oder beides nicht). Deshalb hier truthy statt
    // `isLinkedExpense`, das für getAllExpenses-Objekte gilt: bei `0` laufen sie auseinander.
    expect(explicitCustomerIdForApproval(0, 42)).toBe(42);
    expect(isLinkedExpense(0)).toBe(true);
  });

  it("beide Freigabepfade verwenden den Baustein", () => {
    // Batch- und Einzel-Pfad. Bei Umbenennung NACHZIEHEN, nicht löschen.
    const routersSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    const uses = routersSource.split(
      "customerId: explicitCustomerIdForApproval(targetTimeEntryId, targetCustomerId),"
    ).length - 1;
    expect(uses).toBe(2);
  });
});

/**
 * Das geteilte Prädikat hinter beiden Kopier-Bausteinen (K4). Stand vorher zweimal
 * wortgleich in `expenseRules.ts`.
 */
describe("isLinkedExpense", () => {
  it("null/undefined = eigenständig", () => {
    expect(isLinkedExpense(null)).toBe(false);
    expect(isLinkedExpense(undefined)).toBe(false);
  });

  it("jede gesetzte Id = verknüpft, auch die falsy 0", () => {
    expect(isLinkedExpense(1)).toBe(true);
    expect(isLinkedExpense(0)).toBe(true);
  });
});
