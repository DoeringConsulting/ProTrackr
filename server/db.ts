import { desc, eq } from "drizzle-orm";
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

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Customer queries
export async function getCustomers() {
  const db = await getDb();
  if (!db) return [];
  const { customers } = await import("../drizzle/schema");
  return await db.select().from(customers).orderBy(customers.createdAt);
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const { customers } = await import("../drizzle/schema");
  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result[0];
}

export async function createCustomer(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { customers } = await import("../drizzle/schema");
  const result = await db.insert(customers).values(data);
  return result;
}

export async function updateCustomer(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { customers } = await import("../drizzle/schema");
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

// Time entry queries
export async function getTimeEntries(userId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const { timeEntries } = await import("../drizzle/schema");
  const { and, gte, lte } = await import("drizzle-orm");
  
  let conditions = [eq(timeEntries.userId, userId)];
  if (startDate) conditions.push(gte(timeEntries.date, startDate));
  if (endDate) conditions.push(lte(timeEntries.date, endDate));
  
  return await db.select().from(timeEntries).where(and(...conditions)).orderBy(timeEntries.date);
}

export async function getTimeEntryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const { timeEntries } = await import("../drizzle/schema");
  const result = await db.select().from(timeEntries).where(eq(timeEntries.id, id)).limit(1);
  return result[0];
}

export async function createTimeEntry(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { timeEntries } = await import("../drizzle/schema");
  const { desc } = await import("drizzle-orm");
  await db.insert(timeEntries).values(data);
  // Return the created entry
  const entries = await db.select().from(timeEntries).where(eq(timeEntries.userId, data.userId)).orderBy(desc(timeEntries.id)).limit(1);
  return entries[0];
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
  const result = await db.delete(timeEntries).where(eq(timeEntries.id, id));
  console.log('[deleteTimeEntry] Deleted time entry:', id, 'Result:', result);
  return result;
}

// Expense queries
export async function getAllExpenses(startDate?: string, endDate?: string) {
  const db = await getDb();
  if (!db) return [];
  const { expenses, timeEntries } = await import("../drizzle/schema");
  const { and, gte, lte } = await import("drizzle-orm");
  
  const conditions = [];
  if (startDate) conditions.push(gte(timeEntries.date, new Date(startDate)));
  if (endDate) conditions.push(lte(timeEntries.date, new Date(endDate)));
  
  const result = await db
    .select({
      id: expenses.id,
      timeEntryId: expenses.timeEntryId,
      category: expenses.category,
      amount: expenses.amount,
      currency: expenses.currency,
      comment: expenses.comment,
      createdAt: expenses.createdAt,
      date: timeEntries.date,
    })
    .from(expenses)
    .innerJoin(timeEntries, eq(expenses.timeEntryId, timeEntries.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  
  return result;
}

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
  const { and, gte, lte } = await import("drizzle-orm");
  
  // Join expenses with timeEntries to filter by customerId and userId
  const conditions = [
    eq(timeEntries.userId, userId),
    eq(timeEntries.customerId, customerId),
  ];
  
  if (startDate) conditions.push(gte(timeEntries.date, startDate));
  if (endDate) conditions.push(lte(timeEntries.date, endDate));
  
  const result = await db
    .select({
      id: expenses.id,
      timeEntryId: expenses.timeEntryId,
      category: expenses.category,
      amount: expenses.amount,
      currency: expenses.currency,
      comment: expenses.comment,
      createdAt: expenses.createdAt,
      date: timeEntries.date,
    })
    .from(expenses)
    .innerJoin(timeEntries, eq(expenses.timeEntryId, timeEntries.id))
    .where(and(...conditions));
  
  return result;
}

export async function createExpense(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { expenses } = await import("../drizzle/schema");
  const result = await db.insert(expenses).values(data);
  return result;
}

export async function updateExpense(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { expenses } = await import("../drizzle/schema");
  await db.update(expenses).set(data).where(eq(expenses.id, id));
}

export async function deleteExpense(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { expenses } = await import("../drizzle/schema");
  const result = await db.delete(expenses).where(eq(expenses.id, id));
  console.log('[deleteExpense] Deleted expense:', id, 'Result:', result);
  return result;
}

// Exchange rate queries
export async function getExchangeRates() {
  const db = await getDb();
  if (!db) return [];
  const { exchangeRates } = await import("../drizzle/schema");
  const { desc } = await import("drizzle-orm");
  return await db.select().from(exchangeRates).orderBy(desc(exchangeRates.date)).limit(50);
}

export async function getExchangeRateByDate(date: Date, currencyPair: string = "EUR/PLN") {
  const db = await getDb();
  if (!db) return undefined;
  const { exchangeRates } = await import("../drizzle/schema");
  const { and } = await import("drizzle-orm");
  const result = await db.select().from(exchangeRates)
    .where(and(
      eq(exchangeRates.date, date),
      eq(exchangeRates.currencyPair, currencyPair)
    ))
    .limit(1);
  return result[0];
}

export async function createExchangeRate(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { exchangeRates } = await import("../drizzle/schema");
  const { and } = await import("drizzle-orm");
  
  // Check if exchange rate already exists for this date and currency pair
  const existing = await db.select().from(exchangeRates)
    .where(and(
      eq(exchangeRates.date, data.date),
      eq(exchangeRates.currencyPair, data.currencyPair)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing rate
    await db.update(exchangeRates)
      .set({ rate: data.rate, source: data.source })
      .where(eq(exchangeRates.id, existing[0].id));
    return existing[0];
  } else {
    // Insert new rate
    const result = await db.insert(exchangeRates).values(data);
    return result;
  }
}

// Fixed cost queries
export async function getFixedCosts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const { fixedCosts } = await import("../drizzle/schema");
  return await db.select().from(fixedCosts).where(eq(fixedCosts.userId, userId));
}

export async function createFixedCost(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { fixedCosts } = await import("../drizzle/schema");
  const result = await db.insert(fixedCosts).values(data);
  return result;
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

// Document queries
export async function getDocumentsByExpense(expenseId: number) {
  const db = await getDb();
  if (!db) return [];
  const { documents } = await import("../drizzle/schema");
  return await db.select().from(documents).where(eq(documents.expenseId, expenseId));
}

export async function getDocumentsByTimeEntry(timeEntryId: number) {
  const db = await getDb();
  if (!db) return [];
  const { documents } = await import("../drizzle/schema");
  return await db.select().from(documents).where(eq(documents.timeEntryId, timeEntryId));
}

export async function createDocument(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { documents } = await import("../drizzle/schema");
  const result = await db.insert(documents).values(data);
  return result;
}

export async function deleteDocument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { documents } = await import("../drizzle/schema");
  await db.delete(documents).where(eq(documents.id, id));
}

// Invoice Numbers
export async function generateInvoiceNumber(customerId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const currentYear = new Date().getFullYear();

  // Get the last invoice number for this year
  const lastInvoice = await db
    .select()
    .from(invoiceNumbers)
    .where(eq(invoiceNumbers.year, currentYear))
    .orderBy(desc(invoiceNumbers.number))
    .limit(1);

  const nextNumber = lastInvoice.length > 0 ? lastInvoice[0]!.number + 1 : 1;
  const formattedNumber = `${currentYear}-${nextNumber.toString().padStart(3, '0')}`;

  // Insert new invoice number
  await db.insert(invoiceNumbers).values({
    year: currentYear,
    number: nextNumber,
    invoiceNumber: formattedNumber,
    customerId,
  });

  return formattedNumber;
}

export async function getInvoiceNumbers(year?: number) {
  const db = await getDb();
  if (!db) return [];

  if (year) {
    return await db
      .select()
      .from(invoiceNumbers)
      .where(eq(invoiceNumbers.year, year))
      .orderBy(desc(invoiceNumbers.createdAt));
  }

  return await db
    .select()
    .from(invoiceNumbers)
    .orderBy(desc(invoiceNumbers.createdAt));
}

export async function archiveCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(customers).set({ isArchived: 1 }).where(eq(customers.id, id));
}

export async function unarchiveCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(customers).set({ isArchived: 0 }).where(eq(customers.id, id));
}

// Tax settings queries
export async function getTaxSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const { taxSettings } = await import("../drizzle/schema");
  const result = await db.select().from(taxSettings).where(eq(taxSettings.userId, userId)).limit(1);
  return result[0] || null;
}

export async function upsertTaxSettings(userId: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { taxSettings } = await import("../drizzle/schema");
  
  // Check if settings exist
  const existing = await db.select().from(taxSettings).where(eq(taxSettings.userId, userId)).limit(1);
  
  if (existing.length > 0) {
    // Update existing settings
    await db.update(taxSettings).set(data).where(eq(taxSettings.userId, userId));
    return await getTaxSettings(userId);
  } else {
    // Insert new settings
    await db.insert(taxSettings).values({ userId, ...data });
    return await getTaxSettings(userId);
  }
}
