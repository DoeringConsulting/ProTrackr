import { z } from "zod";
import { getDb } from "./db";
import {
  customers,
  timeEntries,
  expenses,
  exchangeRates,
  fixedCosts,
  documents,
} from "../drizzle/schema";
import { inArray } from "drizzle-orm";

export interface BackupData {
  version: string;
  timestamp: string;
  data: {
    customers: Record<string, unknown>[];
    timeEntries: Record<string, unknown>[];
    expenses: Record<string, unknown>[];
    exchangeRates: Record<string, unknown>[];
    fixedCosts: Record<string, unknown>[];
    documents: Record<string, unknown>[];
  };
}

const BackupSchema = z.object({
  version: z.string().min(1),
  timestamp: z.string().min(1),
  data: z.object({
    customers: z.array(z.record(z.string(), z.unknown())),
    timeEntries: z.array(z.record(z.string(), z.unknown())),
    expenses: z.array(z.record(z.string(), z.unknown())),
    exchangeRates: z.array(z.record(z.string(), z.unknown())),
    fixedCosts: z.array(z.record(z.string(), z.unknown())),
    documents: z.array(z.record(z.string(), z.unknown())),
  }),
});

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
export async function restoreBackup(
  backup: BackupData,
  strategy: "merge" | "replace" = "merge"
): Promise<{
  customers: number;
  timeEntries: number;
  expenses: number;
  exchangeRates: number;
  fixedCosts: number;
  documents: number;
}> {
  const parsedBackup = BackupSchema.safeParse(backup);
  if (!parsedBackup.success) {
    throw new Error(`Ungültiges Backup-Format: ${parsedBackup.error.message}`);
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const normalized = parsedBackup.data;
  const payload = normalized.data;

  return await db.transaction(async (tx) => {
    const results = {
      customers: 0,
      timeEntries: 0,
      expenses: 0,
      exchangeRates: 0,
      fixedCosts: 0,
      documents: 0,
    };

    if (strategy === "replace") {
      await tx.delete(documents);
      await tx.delete(expenses);
      await tx.delete(timeEntries);
      await tx.delete(fixedCosts);
      await tx.delete(exchangeRates);
      await tx.delete(customers);
    }

    if (payload.customers.length > 0) {
      const ids = payload.customers
        .map((row) => Number((row as Record<string, unknown>)?.id))
        .filter((id) => Number.isInteger(id) && id > 0);
      if (ids.length > 0) {
        await tx.delete(customers).where(inArray(customers.id, ids));
      }
      await tx.insert(customers).values(payload.customers as any[]);
      results.customers = payload.customers.length;
    }

    if (payload.timeEntries.length > 0) {
      const ids = payload.timeEntries
        .map((row) => Number((row as Record<string, unknown>)?.id))
        .filter((id) => Number.isInteger(id) && id > 0);
      if (ids.length > 0) {
        await tx.delete(timeEntries).where(inArray(timeEntries.id, ids));
      }
      await tx.insert(timeEntries).values(payload.timeEntries as any[]);
      results.timeEntries = payload.timeEntries.length;
    }

    if (payload.expenses.length > 0) {
      const ids = payload.expenses
        .map((row) => Number((row as Record<string, unknown>)?.id))
        .filter((id) => Number.isInteger(id) && id > 0);
      if (ids.length > 0) {
        await tx.delete(expenses).where(inArray(expenses.id, ids));
      }
      await tx.insert(expenses).values(payload.expenses as any[]);
      results.expenses = payload.expenses.length;
    }

    if (payload.exchangeRates.length > 0) {
      if (strategy === "merge") {
        for (const row of payload.exchangeRates) {
          await tx
            .insert(exchangeRates)
            .values(row as any)
            .onDuplicateKeyUpdate({ set: row as any });
        }
      } else {
        await tx.insert(exchangeRates).values(payload.exchangeRates as any[]);
      }
      results.exchangeRates = payload.exchangeRates.length;
    }

    if (payload.fixedCosts.length > 0) {
      const ids = payload.fixedCosts
        .map((row) => Number((row as Record<string, unknown>)?.id))
        .filter((id) => Number.isInteger(id) && id > 0);
      if (ids.length > 0) {
        await tx.delete(fixedCosts).where(inArray(fixedCosts.id, ids));
      }
      await tx.insert(fixedCosts).values(payload.fixedCosts as any[]);
      results.fixedCosts = payload.fixedCosts.length;
    }

    if (payload.documents.length > 0) {
      const ids = payload.documents
        .map((row) => Number((row as Record<string, unknown>)?.id))
        .filter((id) => Number.isInteger(id) && id > 0);
      if (ids.length > 0) {
        await tx.delete(documents).where(inArray(documents.id, ids));
      }
      await tx.insert(documents).values(payload.documents as any[]);
      results.documents = payload.documents.length;
    }

    return results;
  });
}
