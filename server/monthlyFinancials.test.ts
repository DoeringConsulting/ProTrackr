import { describe, expect, it } from "vitest";
import {
  computeMonthlyAmounts,
  computeMonthlyDisplayRevenue,
} from "../client/src/lib/monthlyFinancials";
import {
  createCustomerIdsByDateMap,
  createEntriesById,
} from "../client/src/lib/expenseAttribution";

// Kursbasis für den Test: EUR→PLN = 4.0 (also EUR-cents × 4 = PLN-cents); PLN bleibt.
const toPln = (cents: number, cur: string): number =>
  cur.toUpperCase() === "PLN" ? cents : cents * 4;
// Zielwährung EUR: EUR bleibt, PLN → EUR /4.
const toTarget = (cents: number, cur: string): number =>
  cur.toUpperCase() === "EUR" ? cents : Math.round(cents / 4);

const customersById = new Map<number, any>([
  [1, { costModel: "exclusive", onsiteRateCurrency: "EUR" }],
  [2, { costModel: "inclusive", onsiteRateCurrency: "EUR" }],
  [3, {
    costModel: "exclusive",
    onsiteRateCurrency: "EUR",
    provisionEnabled: 1,
    provisionMode: "deduction",
    provisionType: "percentage",
    provisionValueBp: 1000, // 10 %
  }],
]);

const timeEntries = [
  { id: 101, customerId: 1, calculatedAmount: 100_000, sourceCurrency: "EUR", date: "2026-03-05", entryType: "onsite", hours: 480, manDays: 1000, rate: 100_000 },
  { id: 102, customerId: 2, calculatedAmount: 50_000, sourceCurrency: "EUR", date: "2026-03-10", entryType: "onsite", hours: 480, manDays: 1000, rate: 50_000 },
  { id: 103, customerId: 3, calculatedAmount: 200_000, sourceCurrency: "EUR", date: "2026-03-15", entryType: "onsite", hours: 960, manDays: 2000, rate: 100_000 },
];

// Alle mit expliziter customerId → deterministische Attribution.
const expenses = [
  { customerId: 1, amount: 10_000, sourceCurrency: "EUR", date: "2026-03-06" }, // exclusive → Umsatz + Kosten
  { customerId: 2, amount: 20_000, sourceCurrency: "EUR", date: "2026-03-11" }, // inclusive → nur Kosten
  { customerId: 3, amount: 5_000, sourceCurrency: "EUR", date: "2026-03-16" },  // exclusive → Umsatz + Kosten
];

const attributionMaps = {
  entriesById: createEntriesById(timeEntries),
  customerIdsByDate: createCustomerIdsByDateMap(timeEntries),
};

describe("monthlyFinancials.computeMonthlyAmounts (= Buchhaltungsbericht-Logik)", () => {
  const ctx = {
    timeEntries,
    expenses,
    customersById,
    attributionMaps,
    monthlyFixedCostsCents: 40_000,
    toPln,
  };

  it("März: Zeit + exkl. RK als Umsatz; ALLE RK + Provision als variable; Fixkosten je Monat", () => {
    // Umsatz (PLN): Zeit 400k+200k+800k = 1.400.000; exkl. RK 40k(K1)+20k(K3) = 60.000
    // Variable (PLN): alle RK 40k+80k+20k = 140.000; Provision K3 = 10%*100k*2MT = 20k€ → 80.000
    // Fix: 40.000 (immer, unabhängig von Aktivität)
    expect(computeMonthlyAmounts("2026-03-01", "2026-03-31", ctx)).toEqual({
      revenueCents: 1_460_000,
      fixedCostsCents: 40_000,
      variableCostsCents: 220_000,
    });
  });

  it("nicht-exklusive RK (K2) zählen NUR als Kosten, nicht als Umsatz", () => {
    const march = computeMonthlyAmounts("2026-03-01", "2026-03-31", ctx);
    // exkl. Umsatzanteil = 60.000 (nur K1+K3), K2 (80.000 PLN) NICHT im Umsatz …
    expect(march.revenueCents).toBe(1_400_000 + 60_000);
    // … aber K2 IST in den variablen Kosten enthalten.
    expect(march.variableCostsCents).toBe(140_000 + 80_000);
  });

  it("leerer Monat: Umsatz/variable 0, aber Fixkosten laufen weiter (→ negativer Netto möglich)", () => {
    expect(computeMonthlyAmounts("2026-04-01", "2026-04-30", ctx)).toEqual({
      revenueCents: 0,
      fixedCostsCents: 40_000,
      variableCostsCents: 0,
    });
  });
});

describe("monthlyFinancials.computeMonthlyDisplayRevenue (Chart-Linien in Zielwährung)", () => {
  const ctx = { timeEntries, expenses, customersById, attributionMaps, toTarget };

  it("März: time / travel(exkl.) / gross", () => {
    // Zeit 100k+50k+200k = 350.000; travel exkl. 10k(K1)+5k(K3) = 15.000; gross = 365.000
    expect(computeMonthlyDisplayRevenue("2026-03-01", "2026-03-31", ctx)).toEqual({
      timeCents: 350_000,
      travelCents: 15_000,
      grossCents: 365_000,
    });
  });

  it("leerer Monat → alles 0", () => {
    expect(computeMonthlyDisplayRevenue("2026-04-01", "2026-04-30", ctx)).toEqual({
      timeCents: 0,
      travelCents: 0,
      grossCents: 0,
    });
  });
});
