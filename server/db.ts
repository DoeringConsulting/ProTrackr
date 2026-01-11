import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
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
  await db.delete(customers).where(eq(customers.id, id));
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
  const result = await db.insert(timeEntries).values(data);
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

// Expense queries
export async function getExpensesByTimeEntry(timeEntryId: number) {
  const db = await getDb();
  if (!db) return [];
  const { expenses } = await import("../drizzle/schema");
  return await db.select().from(expenses).where(eq(expenses.timeEntryId, timeEntryId));
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
  await db.delete(expenses).where(eq(expenses.id, id));
}

// Exchange rate queries
export async function getExchangeRateByDate(date: Date) {
  const db = await getDb();
  if (!db) return undefined;
  const { exchangeRates } = await import("../drizzle/schema");
  const result = await db.select().from(exchangeRates).where(eq(exchangeRates.date, date)).limit(1);
  return result[0];
}

export async function createExchangeRate(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { exchangeRates } = await import("../drizzle/schema");
  const result = await db.insert(exchangeRates).values(data);
  return result;
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
