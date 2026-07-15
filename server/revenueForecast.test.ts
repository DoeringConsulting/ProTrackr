import { describe, expect, it } from "vitest";
import { computeVariableRunRateCents } from "../client/src/lib/revenueForecast";
import type { MonthlyAmountsContext } from "../client/src/lib/monthlyFinancials";

/**
 * Unit-Tests für die Kosten-Run-Rate der Dashboard-Prognose. Rein (keine DB):
 * verifiziert, dass die Funktion GENAU die letzten `lookbackMonths` Monate VOR
 * dem Referenzmonat über `computeMonthlyAmounts` mittelt (eine Wahrheitsquelle)
 * und dabei Warschau-sichere Monatsgrenzen (inkl. Jahreswechsel) baut.
 */
describe("computeVariableRunRateCents", () => {
  // Identitäts-Konverter: Testbeträge sind bereits "PLN cents".
  const toPln = (cents: number) => cents;

  // Kein Kunde/keine Attribution nötig: variableCostsCents = Σ expense.amount des
  // Monats (Belege ohne customerId + leere Maps ⇒ nicht "billable exclusive",
  // beeinflusst nur revenue, nicht die variablen Kosten).
  const emptyCtx = (
    expenses: Array<{ date: string; amount: number }>
  ): MonthlyAmountsContext => ({
    timeEntries: [],
    expenses: expenses.map((e) => ({ ...e, sourceCurrency: "PLN" })),
    customersById: new Map(),
    attributionMaps: { entriesById: new Map(), customerIdsByDate: new Map() },
    // Fixkosten dürfen die Run-Rate NICHT beeinflussen (bewusst hoch gesetzt).
    monthlyFixedCostsCents: 999_999,
    toPln,
  });

  it("mittelt die variablen Kosten der letzten 3 abgeschlossenen Monate", () => {
    // Referenz Juli → betrachtet Juni/Mai/April.
    const ctx = emptyCtx([
      { date: "2026-04-15", amount: 300_00 },
      { date: "2026-05-15", amount: 600_00 },
      { date: "2026-06-15", amount: 900_00 },
    ]);
    // (300 + 600 + 900) / 3 = 600 (in cents: 60_000).
    expect(computeVariableRunRateCents("2026-07-01", 3, ctx)).toBe(600_00);
  });

  it("zählt einen datenlosen Monat als 0 in den Durchschnitt (Aufrufer muss volle Historie liefern)", () => {
    // April fehlt → (0 + 600 + 900) / 3 = 500. Genau dieses Verhalten motiviert den
    // dedizierten Run-Rate-Query (K1): fehlt Monat −3 im ctx, sinkt die Run-Rate.
    const ctx = emptyCtx([
      { date: "2026-05-15", amount: 600_00 },
      { date: "2026-06-15", amount: 900_00 },
    ]);
    expect(computeVariableRunRateCents("2026-07-01", 3, ctx)).toBe(500_00);
  });

  it("baut die Monatsgrenzen über den Jahreswechsel korrekt (Warschau-sicher)", () => {
    // Referenz Januar 2026 → betrachtet Dez/Nov/Okt 2025.
    const ctx = emptyCtx([
      { date: "2025-12-20", amount: 1_200_00 },
      { date: "2025-11-10", amount: 0 },
      // Beleg AUSSERHALB des Lookbacks (Sep 2025) darf nicht einfließen.
      { date: "2025-09-30", amount: 5_000_00 },
    ]);
    // (Okt 0 + Nov 0 + Dez 1200) / 3 = 400.
    expect(computeVariableRunRateCents("2026-01-01", 3, ctx)).toBe(400_00);
  });

  it("ignoriert Belege im/nach dem Referenzmonat (nur abgeschlossene Vormonate)", () => {
    const ctx = emptyCtx([
      { date: "2026-06-15", amount: 300_00 },
      { date: "2026-07-15", amount: 9_000_00 }, // Referenzmonat selbst → raus
      { date: "2026-08-15", amount: 9_000_00 }, // Zukunft → raus
    ]);
    // Nur Juni zählt, Mai/April = 0 → (0 + 0 + 300) / 3 = 100.
    expect(computeVariableRunRateCents("2026-07-01", 3, ctx)).toBe(100_00);
  });

  it("gibt 0 zurück bei lookbackMonths <= 0", () => {
    const ctx = emptyCtx([{ date: "2026-06-15", amount: 900_00 }]);
    expect(computeVariableRunRateCents("2026-07-01", 0, ctx)).toBe(0);
    expect(computeVariableRunRateCents("2026-07-01", -2, ctx)).toBe(0);
  });

  it("gibt 0 zurück bei unparsebarem Referenzmonat", () => {
    const ctx = emptyCtx([{ date: "2026-06-15", amount: 900_00 }]);
    expect(computeVariableRunRateCents("nonsense", 3, ctx)).toBe(0);
  });
});
