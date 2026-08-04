// =============================================================================
// shared/expenseServiceEnd.ts
// =============================================================================
// Die KANONISCHE JS-Formulierung der Zuordnungsregel aus ADR 0002:
//
//   leistungsende = checkOutDate ?? date
//
// Ein Beleg wird NIE gesplittet, sondern zählt komplett in den Zeitraum, in dem seine
// Leistung endet. Fachliche Herleitung, Kategorien-Matrix und Referenzfall #596 stehen
// in `docs/adr/0002-reisekosten-leistungsende.md` und im Kopf von
// `client/src/lib/monthlyFinancials.ts` — hier steht nur die Mechanik.
//
// WARUM in `shared/` und nicht (mehr) im Client-Verzeichnis: Die Regel wird in ZWEI
// Laufzeiten ausgewertet — in MySQL (`expenseServiceEndDateSql`, `server/expenseRules.ts`,
// für den Purge) und in JS. Auf der JS-Seite braucht sie inzwischen der Client (Bericht,
// Dashboard) UND der Server (Auswahl der zu kopierenden Belege in `copyRangeToNext`).
// Eine zweite JS-Fassung im Serverbereich wäre eine dritte Formulierung derselben Regel
// und damit die nächste Driftquelle (K4). Es bleibt bei genau zwei Formulierungen: SQL
// und JS — die Gleichheit beider ist in `server/expensePeriodAttribution.test.ts` gepinnt.

import { toDateKey } from "./dateStichtag";

export type ExpenseServiceEndFields = {
  date?: unknown;
  checkOutDate?: unknown;
};

/**
 * Leistungsende eines Belegs als lokaler YYYY-MM-DD-Key: `checkOutDate ?? date`.
 * `null`, wenn beide Felder leer oder unparsebar sind.
 *
 * Bewusst über `toDateKey` VERKETTET statt `??` auf den Rohwerten: leere Strings und
 * unparsebare Werte in `checkOutDate` müssen ebenfalls auf `date` durchfallen — `??`
 * würde nur bei null/undefined greifen und den Beleg sonst still aus allen Zeiträumen
 * werfen. Genau dieser Zustand entsteht beim Kategoriewechsel (`""` aus der Maske).
 */
export function expenseServiceEndKey(expense: ExpenseServiceEndFields): string | null {
  return toDateKey(expense?.checkOutDate) ?? toDateKey(expense?.date);
}

/**
 * Liegt das Leistungsende des Belegs im Zeitraum `[rangeStart, rangeEnd]`?
 * Grenzen INKLUSIVE, Vergleich auf YYYY-MM-DD-Keys (nie toISOString, K8).
 *
 * Ein Beleg erfüllt das für GENAU EINEN Zeitraum einer lückenlosen Folge — das ist die
 * Eigenschaft, auf der Abrechnung, Purge und Kopieren gleichermaßen aufsetzen.
 */
export function isExpenseServiceEndInRange(
  expense: ExpenseServiceEndFields,
  rangeStart: string,
  rangeEnd: string
): boolean {
  const endKey = expenseServiceEndKey(expense);
  return endKey !== null && endKey >= rangeStart && endKey <= rangeEnd;
}
