import { desc, eq, and, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, invoiceNumbers, customers } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    await db
      .insert(users)
      .values(values)
      .onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] upsertUser failed:", error);
    throw error;
  }
}

export async function generateInvoiceNumber(customerId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const year = new Date().getFullYear();
  const yearPrefix = year.toString();

  // Get the last invoice number for this year
  const lastInvoice = await db
    .select()
    .from(invoiceNumbers)
    .where(eq(invoiceNumbers.year, year))
    .orderBy(desc(invoiceNumbers.number))
    .limit(1);

  const nextSequence = lastInvoice.length > 0 ? lastInvoice[0].number + 1 : 1;
  const invoiceNumber = `${yearPrefix}-${String(nextSequence).padStart(3, '0')}`;

  // Insert the new invoice number
  await db.insert(invoiceNumbers).values({
    year,
    number: nextSequence,
    invoiceNumber,
    customerId,
  });

  return invoiceNumber;
}

export async function getInvoiceNumbers(year?: number) {
  const db = await getDb();
  if (!db) return [];

  const currentYear = year || new Date().getFullYear();
  return await db
    .select()
    .from(invoiceNumbers)
    .where(eq(invoiceNumbers.year, currentYear))
    .orderBy(desc(invoiceNumbers.number));
}

// Customer queries
export async function getCustomers() {
  const db = await getDb();
  if (!db) return [];
  const { customers } = await import("../drizzle/schema");
  return await db.select().from(customers).where(eq(customers.isArchived, 0));
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const { customers } = await import("../drizzle/schema");
  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result[0] || null;
}

export async function createCustomer(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { customers } = await import("../drizzle/schema");
  await db.insert(customers).values(data);
  // Return the created customer
  const result = await db.select().from(customers).orderBy(desc(customers.id)).limit(1);
  return result[0];
}

export async function updateCustomer(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { customers, customerRateHistory } = await import("../drizzle/schema");
  
  // Check if rate fields are being updated
  const rateFields = ['onsiteRate', 'onsiteRateCurrency', 'remoteRate', 'remoteRateCurrency', 'kmRate', 'kmRateCurrency', 'mealRate', 'mealRateCurrency', 'costModel'];
  const hasRateChanges = rateFields.some(field => data[field] !== undefined);
  
  if (hasRateChanges) {
    // Get current customer data
    const currentCustomer = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    if (currentCustomer[0]) {
      const current = currentCustomer[0];
      
      // Close previous rate history entry (set validUntil to now)
      await db.update(customerRateHistory)
        .set({ validUntil: new Date() })
        .where(and(
          eq(customerRateHistory.customerId, id),
          isNull(customerRateHistory.validUntil)
        ));
      
      // Create new rate history entry with old values
      await db.insert(customerRateHistory).values({
        customerId: id,
        onsiteRate: current.onsiteRate,
        onsiteRateCurrency: current.onsiteRateCurrency,
        remoteRate: current.remoteRate,
        remoteRateCurrency: current.remoteRateCurrency,
        kmRate: current.kmRate,
        kmRateCurrency: current.kmRateCurrency,
        mealRate: current.mealRate,
        mealRateCurrency: current.mealRateCurrency,
        costModel: current.costModel,
        validFrom: current.updatedAt,
        validUntil: new Date(),
        changedBy: data.changedBy || 'system',
        changeReason: data.changeReason
      });
    }
  }
  
  // Update customer
  await db.update(customers).set(data).where(eq(customers.id, id));
}

export async function deleteCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { customers } = await import("../drizzle/schema");
  const result = await db.delete(customers).where(eq(customers.id, id));
  console.log('[deleteCustomer] Deleted customer:', id, 'Result:', result);
  return result;
}

export async function getRateHistory(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  const { customerRateHistory } = await import("../drizzle/schema");
  return await db
    .select()
    .from(customerRateHistory)
    .where(eq(customerRateHistory.customerId, customerId))
    .orderBy(desc(customerRateHistory.validFrom));
}

export async function getRateForDate(customerId: number, date: Date) {
  const db = await getDb();
  if (!db) return null;
  const { customers, customerRateHistory } = await import("../drizzle/schema");
  
  // First try to find in history
  const history = await db
    .select()
    .from(customerRateHistory)
    .where(and(
      eq(customerRateHistory.customerId, customerId),
      // validFrom <= date AND (validUntil IS NULL OR validUntil > date)
    ))
    .limit(1);
  
  if (history[0]) {
    return history[0];
  }
  
  // Fallback to current customer rates
  const customer = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  return customer[0] || null;
}

// Time entry queries
export async function getTimeEntries(userId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const { timeEntries } = await import("../drizzle/schema");
  
  let query = db.select().from(timeEntries).where(eq(timeEntries.userId, userId));
  
  // Note: Date filtering would require additional where clauses with date comparison
  // For now, returning all entries for the user
  
  return await query.orderBy(desc(timeEntries.date));
}

export async function createTimeEntry(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { timeEntries } = await import("../drizzle/schema");
  const result = await db.insert(timeEntries).values(data);
  
  // Return the created entry
  const insertId = (result as any).insertId || (result as any)[0]?.insertId;
  if (insertId) {
    const created = await db.select().from(timeEntries).where(eq(timeEntries.id, insertId)).limit(1);
    return created[0];
  }
  
  return result;
}

export async function updateTimeEntry(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { timeEntries } = await import("../drizzle/schema");
  await db.update(timeEntries).set(data).where(eq(timeEntries.id, id));
}

export async function deleteTimeEntry(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { timeEntries } = await import("../drizzle/schema");
  await db.delete(timeEntries).where(eq(timeEntries.id, id));
}

// Fixed costs queries
export async function getFixedCosts() {
  const db = await getDb();
  if (!db) return [];
  const { fixedCosts } = await import("../drizzle/schema");
  return await db.select().from(fixedCosts);
}

export async function createFixedCost(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { fixedCosts } = await import("../drizzle/schema");
  await db.insert(fixedCosts).values(data);
}

export async function updateFixedCost(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { fixedCosts } = await import("../drizzle/schema");
  await db.update(fixedCosts).set(data).where(eq(fixedCosts.id, id));
}

export async function deleteFixedCost(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { fixedCosts } = await import("../drizzle/schema");
  await db.delete(fixedCosts).where(eq(fixedCosts.id, id));
}

// Tax settings queries
export async function getTaxSettings() {
  const db = await getDb();
  if (!db) return null;
  const { taxSettings } = await import("../drizzle/schema");
  const result = await db.select().from(taxSettings).limit(1);
  return result[0] || null;
}

export async function upsertTaxSettings(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { taxSettings } = await import("../drizzle/schema");
  
  // Check if settings exist
  const existing = await getTaxSettings();
  
  if (existing) {
    await db.update(taxSettings).set(data).where(eq(taxSettings.id, existing.id));
  } else {
    await db.insert(taxSettings).values(data);
  }
  
  // Return updated settings
  return await getTaxSettings();
}

// Expense queries
export async function getExpensesByTimeEntry(timeEntryId: number) {
  const db = await getDb();
  if (!db) return [];
  const { expenses } = await import("../drizzle/schema");
  return await db.select().from(expenses).where(eq(expenses.timeEntryId, timeEntryId));
}

export async function getExpensesByCustomer(userId: number, customerId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const { expenses, timeEntries } = await import("../drizzle/schema");
  
  // Join expenses with timeEntries to filter by customerId
  const result = await db
    .select({
      id: expenses.id,
      timeEntryId: expenses.timeEntryId,
      category: expenses.category,
      amount: expenses.amount,
      currency: expenses.currency,
      comment: expenses.comment,
      date: timeEntries.date,
    })
    .from(expenses)
    .innerJoin(timeEntries, eq(expenses.timeEntryId, timeEntries.id))
    .where(and(
      eq(timeEntries.userId, userId),
      eq(timeEntries.customerId, customerId)
    ));
  
  return result;
}

// Document queries (placeholder - implement if needed)
export async function deleteDocument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Implement document deletion logic here
  console.log('[deleteDocument] Document deletion not yet implemented:', id);
}

// User queries
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] || null;
}

// Document queries (placeholder - implement if needed)
export async function createDocument(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Implement document creation logic here
  console.log('[createDocument] Document creation not yet implemented:', data);
  return { id: 1 }; // Placeholder return
}

export async function getDocumentsByExpense(expenseId: number) {
  const db = await getDb();
  if (!db) return [];
  // Implement document retrieval logic here
  console.log('[getDocumentsByExpense] Document retrieval not yet implemented:', expenseId);
  return []; // Placeholder return
}

// Exchange rate queries
export async function createExchangeRate(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { exchangeRates } = await import("../drizzle/schema");
  await db.insert(exchangeRates).values(data);
}

export async function getExchangeRates(filters?: { startDate?: Date; endDate?: Date; currency?: string }) {
  const db = await getDb();
  if (!db) return [];
  const { exchangeRates } = await import("../drizzle/schema");
  
  // For now, return all exchange rates
  // TODO: Add filtering logic based on filters parameter
  return await db.select().from(exchangeRates).orderBy(desc(exchangeRates.date));
}

export async function getExchangeRateByDate(currencyPair: string, date: Date) {
  const db = await getDb();
  if (!db) return null;
  const { exchangeRates } = await import("../drizzle/schema");
  
  const result = await db
    .select()
    .from(exchangeRates)
    .where(and(
      eq(exchangeRates.currencyPair, currencyPair),
      eq(exchangeRates.date, date)
    ))
    .limit(1);
  
  return result[0] || null;
}

export async function deleteExpense(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { expenses } = await import("../drizzle/schema");
  await db.delete(expenses).where(eq(expenses.id, id));
}

export async function updateExpense(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { expenses } = await import("../drizzle/schema");
  await db.update(expenses).set(data).where(eq(expenses.id, id));
}

export async function createExpense(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { expenses } = await import("../drizzle/schema");
  const result = await db.insert(expenses).values(data);
  return result;
}

export async function getAllExpenses(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const { expenses, timeEntries } = await import("../drizzle/schema");
  
  // Join expenses with timeEntries to filter by userId
  const result = await db
    .select({
      id: expenses.id,
      timeEntryId: expenses.timeEntryId,
      category: expenses.category,
      amount: expenses.amount,
      currency: expenses.currency,
      comment: expenses.comment,
      date: timeEntries.date,
      createdAt: expenses.createdAt,
    })
    .from(expenses)
    .innerJoin(timeEntries, eq(expenses.timeEntryId, timeEntries.id))
    .where(eq(timeEntries.userId, userId));
  
  return result;
}

export async function getTimeEntryById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const { timeEntries } = await import("../drizzle/schema");
  const result = await db.select().from(timeEntries).where(eq(timeEntries.id, id)).limit(1);
  return result[0] || null;
}

export async function unarchiveCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { customers } = await import("../drizzle/schema");
  await db.update(customers).set({ isArchived: 0 }).where(eq(customers.id, id));
}

export async function archiveCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { customers } = await import("../drizzle/schema");
  await db.update(customers).set({ isArchived: 1 }).where(eq(customers.id, id));
}
