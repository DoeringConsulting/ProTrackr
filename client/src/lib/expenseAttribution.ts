// Zentrale Zuordnung: welcher Kunde ist für einen (Reisekosten-)Beleg
// abrechnungsrelevant? Eine Wahrheitsquelle für Reports.tsx und ProjectDetail.tsx,
// damit beide Seiten dieselbe Logik nutzen und nicht auseinanderdriften.
//
// Fehler #2 (Sobrietas exclusive). Cutover 01.07.2026 + Option-B-Override:
//   - Eine explizit gesetzte expenses.customerId gewinnt IMMER (datumsunabhängig).
//     So kann der User gezielt auch Alt-Belege einem Kunden zuordnen.
//   - Belege OHNE customerId bleiben exakt bei der alten Logik → historische
//     Berichte bleiben byte-identisch, solange nichts manuell zugewiesen wurde.
//   - Der datumsbasierte Fallback (genau 1 Kunde am Beleg-Tag) greift NUR ab
//     dem Cutover — er würde sonst Alt-Belege automatisch umbuchen.

export const EXPENSE_CUSTOMER_CUTOVER = "2026-07-01";

/**
 * Lokaler Datums-Key (YYYY-MM-DD) aus einem Datumswert. Nutzt bewusst die
 * lokalen Datumskomponenten (nicht toISOString), damit Warschau-Mitternacht
 * nicht auf den Vortag kippt (siehe Fehler #1).
 */
export function toDateKey(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type TimeEntryLike = { id: number; customerId: number | string | null; date: unknown };
type EntryWithCustomer = { customerId: number | string | null };

/** Index Time-Entry-Id → Time-Entry (für die timeEntryId-Zuordnung). */
export function createEntriesById<T extends { id: number }>(
  timeEntries: ReadonlyArray<T>
): Map<number, T> {
  return new Map(timeEntries.map((entry) => [entry.id, entry]));
}

/** Map: Datums-Key → Menge der Kunden-IDs mit Time-Entry an diesem Tag. */
export function createCustomerIdsByDateMap(
  timeEntries: ReadonlyArray<TimeEntryLike>
): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  for (const entry of timeEntries) {
    const key = toDateKey(entry.date);
    if (!key) continue;
    if (!map.has(key)) map.set(key, new Set<number>());
    map.get(key)!.add(Number(entry.customerId));
  }
  return map;
}

export interface ExpenseAttributionMaps {
  entriesById: Map<number, EntryWithCustomer>;
  customerIdsByDate: Map<string, Set<number>>;
}

/**
 * Ermittelt den abrechnungsrelevanten Kunden eines Belegs (customerId) oder null.
 * Reihenfolge: (1) explizite customerId [Option B, jedes Datum] →
 * (2) vor Cutover: nur timeEntryId → (3) ab Cutover: timeEntryId, dann
 * Datums-Fallback (genau 1 Kunde am Tag).
 */
export function getExpenseBillingCustomerId(
  expense: any,
  maps: ExpenseAttributionMaps
): number | null {
  // (1) Manuelle Zuweisung gewinnt immer — auch für Alt-Belege (Option B).
  if (expense?.customerId != null) return Number(expense.customerId);

  const dateKey =
    toDateKey(expense?.date) ??
    toDateKey(expense?.checkInDate) ??
    toDateKey(expense?.checkOutDate);

  // (2) Vor Cutover ohne explizite Zuweisung: unveränderte Alt-Logik.
  if (!dateKey || dateKey < EXPENSE_CUSTOMER_CUTOVER) {
    if (!expense?.timeEntryId) return null;
    const te = maps.entriesById.get(expense.timeEntryId);
    return te?.customerId != null ? Number(te.customerId) : null;
  }

  // (3) Ab Cutover ohne explizite customerId: timeEntry, dann Datums-Fallback.
  if (expense?.timeEntryId) {
    const te = maps.entriesById.get(expense.timeEntryId);
    if (te?.customerId != null) return Number(te.customerId);
  }
  const set = maps.customerIdsByDate.get(dateKey);
  if (set && set.size === 1) return set.values().next().value ?? null;
  return null;
}
