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
import { validateExpenseDateRules } from "./expenseRules";

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
