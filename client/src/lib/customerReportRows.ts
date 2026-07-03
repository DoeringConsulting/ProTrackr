import { toDateKey } from "./expenseAttribution";

export interface CustomerReportRow<TEntry, TExpense> {
  /** Zeiteintrag dieser Zeile, oder null für einen reinen Reisekosten-Tag. */
  entry: TEntry | null;
  /** Anzeige-/Sortierdatum (entry.date bzw. Beleg-Datum bei reinen RK-Zeilen). */
  date: unknown;
  /** Lokaler YYYY-MM-DD-Key für Gruppierung + chronologische Sortierung. */
  dateKey: string;
  /** Der Zeile zugeordnete Reisekosten (jeder Quell-Beleg genau einmal). */
  expenses: TExpense[];
}

/**
 * Baut das kanonische Kundenbericht-Zeilenmodell (Option 1). Eine Wahrheitsquelle
 * für UI-, PDF- und Excel-Render (task_bba37780 Fehler C).
 * Währungsagnostisch: die Funktion ordnet nur zu und sortiert; die Umrechnung
 * (EUR / Abrechnungswährung) übernimmt der jeweilige Render-Pfad auf row.expenses.
 */
export function buildCustomerReportRows<
  TEntry extends { id: number; date: unknown },
  TExpense extends {
    id: number;
    timeEntryId?: number | null;
    date?: unknown;
    checkInDate?: unknown;
    checkOutDate?: unknown;
  }
>(
  entries: ReadonlyArray<TEntry>,
  expenses: ReadonlyArray<TExpense>
): Array<CustomerReportRow<TEntry, TExpense>> {
  const expenseDateKey = (e: TExpense): string | null =>
    toDateKey(e.date) ?? toDateKey(e.checkInDate) ?? toDateKey(e.checkOutDate);

  // (1) Eine Zeile je Eintrag, in Eingabereihenfolge.
  const entryRows: Array<CustomerReportRow<TEntry, TExpense>> = entries.map((entry) => ({
    entry,
    date: entry.date,
    dateKey: toDateKey(entry.date) ?? "",
    expenses: [],
  }));

  // (2) Indizes für die Zuordnung.
  const rowByEntryId = new Map<number, CustomerReportRow<TEntry, TExpense>>();
  for (const row of entryRows) if (row.entry) rowByEntryId.set(row.entry.id, row);
  const firstRowByDateKey = new Map<string, CustomerReportRow<TEntry, TExpense>>();
  for (const row of entryRows) {
    if (!row.dateKey || firstRowByDateKey.has(row.dateKey)) continue;
    firstRowByDateKey.set(row.dateKey, row);
  }

  // (3) Jeden Beleg genau einer Zeile zuordnen.
  const pureByKey = new Map<string, CustomerReportRow<TEntry, TExpense>>();
  for (const expense of expenses) {
    // (a) an bekannten Eintrag verknüpft -> dessen Zeile
    if (expense.timeEntryId != null && rowByEntryId.has(expense.timeEntryId)) {
      rowByEntryId.get(expense.timeEntryId)!.expenses.push(expense);
      continue;
    }
    const dk = expenseDateKey(expense);
    // (b) selber Kalendertag wie ein Eintrag -> erste Eintrags-Zeile des Tages
    if (dk && firstRowByDateKey.has(dk)) {
      firstRowByDateKey.get(dk)!.expenses.push(expense);
      continue;
    }
    // (c) sonst -> reine RK-Zeile, je Tag gebündelt (ohne Datum: je Beleg eigene Zeile)
    const bucketKey = dk ?? `__nodate_${expense.id}`;
    let bucket = pureByKey.get(bucketKey);
    if (!bucket) {
      bucket = {
        entry: null,
        date: expense.date ?? expense.checkInDate ?? expense.checkOutDate ?? null,
        dateKey: dk ?? "",
        expenses: [],
      };
      pureByKey.set(bucketKey, bucket);
    }
    bucket.expenses.push(expense);
  }

  // (4) Zusammenführen + stabil chronologisch aufsteigend sortieren (leere Keys ans Ende).
  // Array.from statt Spread über den MapIterator — targetunabhängig (kein downlevelIteration nötig).
  const all = [...entryRows, ...Array.from(pureByKey.values())];
  return all
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const ka = a.row.dateKey || "9999-99-99";
      const kb = b.row.dateKey || "9999-99-99";
      if (ka < kb) return -1;
      if (ka > kb) return 1;
      return a.index - b.index; // stabil
    })
    .map((x) => x.row);
}
