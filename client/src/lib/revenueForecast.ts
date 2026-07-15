// =============================================================================
// client/src/lib/revenueForecast.ts
// =============================================================================
// Reine, testbare Helfer für die Umsatz-/Kostenprognose des Dashboards. Bewusst
// frei von React/tRPC, damit die Run-Rate isoliert getestet werden kann und die
// EINE Wahrheitsquelle (computeMonthlyAmounts) auch für die Prognose gilt — keine
// zweite Rechenlogik.

import { computeMonthlyAmounts, type MonthlyAmountsContext } from "./monthlyFinancials";

/**
 * Durchschnittliche variable Kosten (PLN cents) der letzten `lookbackMonths`
 * ABGESCHLOSSENEN Ist-Monate (Monate VOR referenceMonthStart). Basis für die
 * Kostenprognose: Reisekosten/Provision schwanken, daher Run-Rate statt letztem
 * Monat. Fixkosten sind konstant und NICHT Teil dieser Run-Rate (separat addieren).
 * Aufrufer reicht denselben ctx wie fürs Ist-Chart. Gibt 0 zurück, wenn kein
 * Rückblickfenster betrachtet wird (lookbackMonths <= 0) oder der Referenzmonat
 * unparsebar ist.
 *
 * Monatsgrenzen werden als Strings gebaut (nie toISOString) — Europe/Warsaw-sicher,
 * exakt wie der monthBounds-Helper im Dashboard.
 */
export function computeVariableRunRateCents(
  referenceMonthStart: string, // "YYYY-MM-01" des aktuellen Monats (erster Prognose-Vormonats-Anker)
  lookbackMonths: number,
  ctx: MonthlyAmountsContext,
): number {
  if (lookbackMonths <= 0) return 0;

  const year = Number(referenceMonthStart.slice(0, 4));
  const monthIndex = Number(referenceMonthStart.slice(5, 7)) - 1; // 0-basiert
  if (Number.isNaN(year) || Number.isNaN(monthIndex)) return 0;

  let sumVariableCents = 0;
  let consideredMonths = 0;
  for (let back = 1; back <= lookbackMonths; back++) {
    // Grenzen des `back`-ten Monats VOR dem Referenzmonat. Date-Konstruktor
    // normalisiert negative Monatsindizes (Jahreswechsel) korrekt; wir lesen danach
    // Jahr/Monat wieder aus und bauen die Grenzen als String.
    const d = new Date(year, monthIndex - back, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const monthStart = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const monthEnd = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const amounts = computeMonthlyAmounts(monthStart, monthEnd, ctx);
    sumVariableCents += amounts.variableCostsCents;
    consideredMonths += 1;
  }

  if (consideredMonths === 0) return 0;
  return Math.round(sumVariableCents / consideredMonths);
}
