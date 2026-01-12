import { getDb } from "./db";
import { customers, timeEntries, expenses, exchangeRates, fixedCosts, documents } from "../drizzle/schema";

export interface BackupData {
  version: string;
  timestamp: string;
  data: {
    customers: any[];
    timeEntries: any[];
    expenses: any[];
    exchangeRates: any[];
    fixedCosts: any[];
    documents: any[];
  };
}

/**
 * Creates a complete backup of all database tables
 * @returns Backup data as JSON object
 */
export async function createBackup(): Promise<BackupData> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const [
    customersData,
    timeEntriesData,
    expensesData,
    exchangeRatesData,
    fixedCostsData,
    documentsData,
  ] = await Promise.all([
    db.select().from(customers),
    db.select().from(timeEntries),
    db.select().from(expenses),
    db.select().from(exchangeRates),
    db.select().from(fixedCosts),
    db.select().from(documents),
  ]);

  return {
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    data: {
      customers: customersData,
      timeEntries: timeEntriesData,
      expenses: expensesData,
      exchangeRates: exchangeRatesData,
      fixedCosts: fixedCostsData,
      documents: documentsData,
    },
  };
}

/**
 * Restores database from backup data
 * @param backup - Backup data to restore
 * @returns Number of records restored per table
 */
export async function restoreBackup(backup: BackupData): Promise<{
  customers: number;
  timeEntries: number;
  expenses: number;
  exchangeRates: number;
  fixedCosts: number;
  documents: number;
}> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Note: This is a simple restore that inserts data
  // In production, you might want to clear tables first or handle conflicts
  
  const results = {
    customers: 0,
    timeEntries: 0,
    expenses: 0,
    exchangeRates: 0,
    fixedCosts: 0,
    documents: 0,
  };

  if (backup.data.customers.length > 0) {
    await db.insert(customers).values(backup.data.customers);
    results.customers = backup.data.customers.length;
  }

  if (backup.data.timeEntries.length > 0) {
    await db.insert(timeEntries).values(backup.data.timeEntries);
    results.timeEntries = backup.data.timeEntries.length;
  }

  if (backup.data.expenses.length > 0) {
    await db.insert(expenses).values(backup.data.expenses);
    results.expenses = backup.data.expenses.length;
  }

  if (backup.data.exchangeRates.length > 0) {
    await db.insert(exchangeRates).values(backup.data.exchangeRates);
    results.exchangeRates = backup.data.exchangeRates.length;
  }

  if (backup.data.fixedCosts.length > 0) {
    await db.insert(fixedCosts).values(backup.data.fixedCosts);
    results.fixedCosts = backup.data.fixedCosts.length;
  }

  if (backup.data.documents.length > 0) {
    await db.insert(documents).values(backup.data.documents);
    results.documents = backup.data.documents.length;
  }

  return results;
}
