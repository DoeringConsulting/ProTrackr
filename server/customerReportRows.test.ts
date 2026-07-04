import { describe, it, expect } from "vitest";
import { buildCustomerReportRows } from "@/lib/customerReportRows";

// Minimal-Fixtures im Shape, den der Row-Builder erwartet. Bewusst schlank —
// der Builder ist währungsagnostisch und liest nur id/date/timeEntryId.
const E = (id: number, date: string) => ({
  id,
  date,
  calculatedAmount: 0,
  sourceCurrency: "EUR",
});
const X = (id: number, date: string, timeEntryId: number | null = null) => ({
  id,
  date,
  timeEntryId,
  amount: 100,
  sourceCurrency: "EUR",
});

describe("buildCustomerReportRows", () => {
  it("hängt verknüpfte Belege an ihren Eintrag", () => {
    // Fall 1: Beleg mit timeEntryId === entry.id landet in dessen Zeile.
    const entries = [E(1, "2026-07-10")];
    const expenses = [X(50, "2026-07-11", 1)]; // anderes Datum, aber verknüpft
    const rows = buildCustomerReportRows(entries, expenses);

    expect(rows).toHaveLength(1);
    expect(rows[0].entry?.id).toBe(1);
    expect(rows[0].expenses.map((e) => e.id)).toEqual([50]);
  });

  it("hängt Direktbelege an die erste Eintragszeile desselben Tages", () => {
    // Fall 2: Direktbeleg (timeEntryId null) am selben Tag wie zwei Einträge
    // -> an die ERSTE Eintragszeile des Tages.
    const entries = [E(1, "2026-07-10"), E(2, "2026-07-10")];
    const expenses = [X(50, "2026-07-10", null)];
    const rows = buildCustomerReportRows(entries, expenses);

    expect(rows).toHaveLength(2);
    const firstDayRow = rows.find((r) => r.entry?.id === 1)!;
    const secondDayRow = rows.find((r) => r.entry?.id === 2)!;
    expect(firstDayRow.expenses.map((e) => e.id)).toEqual([50]);
    expect(secondDayRow.expenses).toHaveLength(0);
  });

  it("macht aus einem reinen RK-Tag eine eigene Zeile", () => {
    // Fall 3: Direktbeleg an einem Tag OHNE Eintrag -> eigene reine RK-Zeile.
    const entries = [E(1, "2026-07-10")];
    const expenses = [X(50, "2026-07-12", null)]; // Tag ohne Eintrag
    const rows = buildCustomerReportRows(entries, expenses);

    expect(rows).toHaveLength(2);
    const pureRow = rows.find((r) => r.entry === null)!;
    expect(pureRow).toBeDefined();
    expect(pureRow.dateKey).toBe("2026-07-12");
    expect(pureRow.expenses.map((e) => e.id)).toEqual([50]);
  });

  it("bündelt mehrere Belege eines reinen RK-Tages in einer Zeile", () => {
    // Fall 4: Zwei Direktbelege am selben reinen RK-Tag -> GENAU EINE Zeile.
    const entries = [E(1, "2026-07-10")];
    const expenses = [X(50, "2026-07-12", null), X(51, "2026-07-12", null)];
    const rows = buildCustomerReportRows(entries, expenses);

    const pureRows = rows.filter((r) => r.entry === null);
    expect(pureRows).toHaveLength(1);
    expect(pureRows[0].expenses.map((e) => e.id).sort()).toEqual([50, 51]);
  });

  it("sortiert chronologisch aufsteigend", () => {
    // Fall 5: Ergebnis chronologisch aufsteigend nach dateKey (ältester zuerst).
    const entries = [E(1, "2026-07-20"), E(2, "2026-07-05")];
    const expenses = [X(50, "2026-07-12", null)]; // reiner RK-Tag dazwischen
    const rows = buildCustomerReportRows(entries, expenses);

    const keys = rows.map((r) => r.dateKey);
    expect(keys).toEqual(["2026-07-05", "2026-07-12", "2026-07-20"]);
  });

  it("ordnet jeden Beleg genau einer Zeile zu", () => {
    // Fall 6: Partition — Summe der expenses-Längen über alle Zeilen ===
    // Eingabe-Belegzahl (kein Doppelzählen, kein Verlust).
    const entries = [E(1, "2026-07-10"), E(2, "2026-07-10"), E(3, "2026-07-15")];
    const expenses = [
      X(50, "2026-07-10", 1), // verknüpft -> Eintrag 1
      X(51, "2026-07-10", null), // selber Tag -> erste Zeile (Eintrag 1)
      X(52, "2026-07-15", 3), // verknüpft -> Eintrag 3
      X(53, "2026-07-18", null), // reiner RK-Tag
      X(54, "2026-07-18", null), // reiner RK-Tag (gebündelt)
      X(55, "2026-07-99", 999), // ungültiger timeEntryId + ungültiges Datum -> eigene Zeile
    ];
    const rows = buildCustomerReportRows(entries, expenses);

    const totalAssigned = rows.reduce((sum, row) => sum + row.expenses.length, 0);
    expect(totalAssigned).toBe(expenses.length);

    // Jede Beleg-ID kommt exakt einmal vor.
    const allIds = rows.flatMap((row) => row.expenses.map((e) => e.id)).sort();
    expect(allIds).toEqual([50, 51, 52, 53, 54, 55]);
  });
});
