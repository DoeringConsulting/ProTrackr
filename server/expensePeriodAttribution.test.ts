import { describe, expect, it } from "vitest";
import {
  computeMonthlyAmounts,
  computeMonthlyDisplayRevenue,
  isExpenseInPeriod,
  type MonthlyAmountsContext,
  type MonthlyCustomer,
  type MonthlyExpense,
} from "../client/src/lib/monthlyFinancials";

/**
 * Kanonische Zeitraum-Zuordnung von (Reisekosten-)Belegen. Rein, keine DB.
 *
 * Hintergrund: Buchhaltungsbericht und Dashboard zeigten für Juli 2026
 * unterschiedliche Bruttoumsätze (38.090 € vs. 37.940 €). Ursache waren ZWEI
 * Datums-Konventionen: der Server lädt Belege per Overlap
 * (COALESCE(checkOut, checkIn, date) >= start AND COALESCE(checkIn, date) <= end),
 * der Report zählte die geladene Menge ungefiltert — die Steuerbasis
 * (computeMonthlyAmounts) und das Dashboard dagegen nur Belege mit `expense.date`
 * im Monat. Ein Hotel 30.06.–02.07. steckte dadurch im Juni- UND im Juli-Bericht
 * in voller Höhe (Doppelzählung).
 *
 * Festgelegte Regel: maßgeblich ist ALLEIN `expense.date`.
 */

const JUNE = { start: "2026-06-01", end: "2026-06-30" };
const JULY = { start: "2026-07-01", end: "2026-07-31" };

/**
 * Der Regressionsbeleg: Hotel über den Monatswechsel. Der Server liefert ihn per
 * Overlap AUCH bei einer Juli-Abfrage (checkOutDate 02.07.) — die Zuordnung
 * entscheidet trotzdem `date` (30.06.) → Juni.
 */
const hotelAcrossMonthEnd: MonthlyExpense = {
  customerId: 1,
  amount: 150_00,
  sourceCurrency: "PLN",
  date: "2026-06-30",
  checkInDate: "2026-06-30",
  checkOutDate: "2026-07-02",
};

describe("isExpenseInPeriod (kanonische Regel: allein expense.date)", () => {
  it("Beleg innerhalb des Zeitraums → true", () => {
    expect(isExpenseInPeriod({ date: "2026-07-15" }, JULY.start, JULY.end)).toBe(true);
  });

  it("Beleg vor bzw. nach dem Zeitraum → false", () => {
    expect(isExpenseInPeriod({ date: "2026-06-30" }, JULY.start, JULY.end)).toBe(false);
    expect(isExpenseInPeriod({ date: "2026-08-01" }, JULY.start, JULY.end)).toBe(false);
  });

  it("Grenzen sind inklusive (erster und letzter Tag zählen)", () => {
    expect(isExpenseInPeriod({ date: "2026-07-01" }, JULY.start, JULY.end)).toBe(true);
    expect(isExpenseInPeriod({ date: "2026-07-31" }, JULY.start, JULY.end)).toBe(true);
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
  });

  it("ohne verwertbares date → false (bewusst KEIN Fallback auf checkIn/checkOut)", () => {
    const hotelWithoutDate = { checkInDate: "2026-07-05", checkOutDate: "2026-07-08" };
    expect(isExpenseInPeriod(hotelWithoutDate, JULY.start, JULY.end)).toBe(false);
    expect(isExpenseInPeriod({}, JULY.start, JULY.end)).toBe(false);
    expect(isExpenseInPeriod({ date: null }, JULY.start, JULY.end)).toBe(false);
    expect(isExpenseInPeriod({ date: "kein datum" }, JULY.start, JULY.end)).toBe(false);
  });

  it("REGRESSION: Hotel 30.06.–02.07. zählt zu Juni, NICHT zu Juli (keine Doppelzählung)", () => {
    expect(isExpenseInPeriod(hotelAcrossMonthEnd, JUNE.start, JUNE.end)).toBe(true);
    expect(isExpenseInPeriod(hotelAcrossMonthEnd, JULY.start, JULY.end)).toBe(false);
  });
});

describe("Invarianz: der Report-Filter ändert die Steuerbasis nicht (K4)", () => {
  // Identitäts-Konverter: Testbeträge sind bereits "PLN cents".
  const toPln = (cents: number) => cents;

  // Explizite customerId ⇒ deterministische Attribution (Option B gewinnt vor der
  // Datums-Heuristik), leere Maps genügen. costModel "exclusive" ⇒ die Belege
  // zählen als Umsatz UND als variable Kosten — genau der Pfad, auf dem die
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

  // Die Menge, die der Server für eine Juli-Abfrage per Overlap liefert:
  // das Juni-Hotel (checkOut 02.07.) ist dabei, ein August-Beleg (checkIn 31.07.)
  // ebenfalls — beide gehören per `date` NICHT in den Juli.
  const loadedExpenses: MonthlyExpense[] = [
    hotelAcrossMonthEnd,
    { customerId: 1, amount: 300_00, sourceCurrency: "PLN", date: "2026-07-05" },
    {
      customerId: 1,
      amount: 80_00,
      sourceCurrency: "PLN",
      date: "2026-08-01",
      checkInDate: "2026-07-31",
      checkOutDate: "2026-08-02",
    },
  ];

  // Genau das, was Reports.tsx jetzt an EINER Stelle tut.
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
    expect(loadedExpenses).toContain(hotelAcrossMonthEnd);
    expect(julyFilteredExpenses).not.toContain(hotelAcrossMonthEnd);
    expect(julyFilteredExpenses).toHaveLength(1);
  });

  it("computeMonthlyAmounts (Juli) liefert mit voller UND mit gefilterter Belegmenge dasselbe", () => {
    const fromLoaded = computeMonthlyAmounts(JULY.start, JULY.end, ctxWith(loadedExpenses));
    const fromFiltered = computeMonthlyAmounts(JULY.start, JULY.end, ctxWith(julyFilteredExpenses));
    expect(fromFiltered).toEqual(fromLoaded);
    // Ankerwerte, damit die Gleichheit nicht versehentlich "beide 0" bedeutet:
    // Umsatz = Zeit 1.000 + exkl. RK 300; variable = RK 300; fix = 500.
    expect(fromLoaded).toEqual({
      revenueCents: 1_300_00,
      fixedCostsCents: 500_00,
      variableCostsCents: 300_00,
    });
  });

  it("computeMonthlyDisplayRevenue (Dashboard-Chart) ist ebenso invariant", () => {
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
      travelCents: 300_00,
      grossCents: 1_300_00,
    });
  });

  it("das Hotel zählt genau einmal — im Juni, wo sein date liegt", () => {
    const june = computeMonthlyAmounts(JUNE.start, JUNE.end, ctxWith(loadedExpenses));
    expect(june.variableCostsCents).toBe(150_00);
    expect(june.revenueCents).toBe(150_00);
    // Und im Juli taucht es in keiner Größe mehr auf.
    const july = computeMonthlyAmounts(JULY.start, JULY.end, ctxWith(loadedExpenses));
    expect(july.variableCostsCents).toBe(300_00);
  });
});
