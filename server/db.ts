import { and, eq, desc, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { invoiceNumbers, customers } from "../drizzle/schema";
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

// ⚠️ User functions removed (auth disabled for development)

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
  const { customers } = await import("../drizzle/schema");
  
  const result = await db.update(customers).set(data).where(eq(customers.id, id));
  return result;
}

export async function deleteCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { customers } = await import("../drizzle/schema");
  const result = await db.delete(customers).where(eq(customers.id, id));
  // Customer deleted successfully
  return result;
}


// Time entry queries
export async function getTimeEntries(userId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const { timeEntries } = await import("../drizzle/schema");
  
  // Build where conditions
  const conditions = [eq(timeEntries.userId, userId)];
  
  if (startDate) {
    conditions.push(sql`DATE(${timeEntries.date}) >= ${startDate.toISOString().split('T')[0]}`);
  }
  if (endDate) {
    conditions.push(sql`DATE(${timeEntries.date}) <= ${endDate.toISOString().split('T')[0]}`);
  }
  
  return await db.select().from(timeEntries).where(and(...conditions)).orderBy(desc(timeEntries.date));
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
  // TODO: Implement document deletion
}

// ⚠️ User queries removed (auth disabled for development)

// Document queries (placeholder - implement if needed)
export async function createDocument(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Implement document creation logic here
  // TODO: Implement document creation
  return { id: 1 }; // Placeholder return
}

export async function getDocumentsByExpense(expenseId: number) {
  const db = await getDb();
  if (!db) return [];
  // Implement document retrieval logic here
  // TODO: Implement document retrieval
  return []; // Placeholder return
}

// Exchange rate queries
export async function createExchangeRate(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { exchangeRates } = await import("../drizzle/schema");
  
  // Check if rate already exists for this date and currency pair
  const existing = await getExchangeRateByDate(data.currencyPair, data.date);
  
  if (existing) {
    // Update existing rate
    await db.update(exchangeRates)
      .set(data)
      .where(and(
        eq(exchangeRates.currencyPair, data.currencyPair),
        eq(exchangeRates.date, data.date)
      ));
  } else {
    // Insert new rate
    await db.insert(exchangeRates).values(data);
  }
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

export async function getAllExpenses(userId: number, startDate?: string, endDate?: string) {
  const db = await getDb();
  if (!db) return [];
  const { expenses, timeEntries } = await import("../drizzle/schema");
  
  // Build where conditions for time-entry-linked expenses
  const timeEntryConditions = [eq(timeEntries.userId, userId)];
  
  if (startDate) {
    timeEntryConditions.push(sql`DATE(${timeEntries.date}) >= ${startDate}`);
  }
  if (endDate) {
    timeEntryConditions.push(sql`DATE(${timeEntries.date}) <= ${endDate}`);
  }
  
  // Get expenses linked to time entries
  const linkedExpenses = await db
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
    .where(and(...timeEntryConditions));
  
  // Build where conditions for standalone expenses
  const standaloneConditions = [sql`${expenses.timeEntryId} IS NULL`];
  
  if (startDate) {
    standaloneConditions.push(sql`DATE(${expenses.date}) >= ${startDate}`);
  }
  if (endDate) {
    standaloneConditions.push(sql`DATE(${expenses.date}) <= ${endDate}`);
  }
  
  // Get standalone expenses (not linked to time entries)
  const standaloneExpenses = await db
    .select({
      id: expenses.id,
      timeEntryId: expenses.timeEntryId,
      category: expenses.category,
      amount: expenses.amount,
      currency: expenses.currency,
      comment: expenses.comment,
      date: expenses.date,
      createdAt: expenses.createdAt,
    })
    .from(expenses)
    .where(and(...standaloneConditions));
  
  // Combine both results
  return [...linkedExpenses, ...standaloneExpenses];
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

// Account settings queries
export async function getAccountSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const { accountSettings } = await import("../drizzle/schema");
  const result = await db.select().from(accountSettings).where(eq(accountSettings.userId, userId)).limit(1);
  return result[0] || null;
}

export async function upsertAccountSettings(userId: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { accountSettings } = await import("../drizzle/schema");
  
  // Check if settings exist
  const existing = await getAccountSettings(userId);
  
  if (existing) {
    await db.update(accountSettings).set(data).where(eq(accountSettings.userId, userId));
  } else {
    await db.insert(accountSettings).values({ ...data, userId });
  }
  
  // Return updated settings
  return await getAccountSettings(userId);
}

// Manual exchange rate management
export async function upsertExchangeRate(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { exchangeRates } = await import("../drizzle/schema");
  
  // Check if rate exists for this date and currency pair
  const existing = await getExchangeRateByDate(data.currencyPair, data.date);
  
  if (existing) {
    await db.update(exchangeRates)
      .set({ ...data, isManual: 1 })
      .where(and(
        eq(exchangeRates.currencyPair, data.currencyPair),
        eq(exchangeRates.date, data.date)
      ));
  } else {
    await db.insert(exchangeRates).values({ ...data, isManual: 1 });
  }
  
  return await getExchangeRateByDate(data.currencyPair, data.date);
}

export async function deleteExchangeRate(currencyPair: string, date: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { exchangeRates } = await import("../drizzle/schema");
  
  await db.delete(exchangeRates).where(and(
    eq(exchangeRates.currencyPair, currencyPair),
    eq(exchangeRates.date, date)
  ));
}

// Database backup and restore
export async function exportDatabase() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { customers, timeEntries, expenses, documents, exchangeRates, fixedCosts, taxSettings, accountSettings, invoiceNumbers } = await import("../drizzle/schema");
  
  // Export all tables
  const backup = {
    version: "1.0",
    exportDate: new Date().toISOString(),
    data: {
      customers: await db.select().from(customers),
      timeEntries: await db.select().from(timeEntries),
      expenses: await db.select().from(expenses),
      documents: await db.select().from(documents),
      exchangeRates: await db.select().from(exchangeRates),
      fixedCosts: await db.select().from(fixedCosts),
      taxSettings: await db.select().from(taxSettings),
      accountSettings: await db.select().from(accountSettings),
      invoiceNumbers: await db.select().from(invoiceNumbers),
    },
  };
  
  return backup;
}

// ─── AUTH: USER FUNCTIONS ───────────────────────────────────────────

export async function findUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const { users } = await import("../drizzle/schema");
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result[0] ?? null;
}

export async function findUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const { users } = await import("../drizzle/schema");
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  displayName?: string | null;
  role?: "user" | "admin";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { users } = await import("../drizzle/schema");
  await db.insert(users).values({
    email: data.email,
    passwordHash: data.passwordHash,
    displayName: data.displayName ?? null,
    role: data.role ?? "user",
  });
}

// ─── END AUTH ─────────────────────────────────────────────────────────

export async function importDatabase(backup: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Validate backup structure
  if (!backup.version || !backup.data) {
    throw new Error("Invalid backup format");
  }
  
  const { customers, timeEntries, expenses, documents, exchangeRates, fixedCosts, taxSettings, accountSettings, invoiceNumbers } = await import("../drizzle/schema");
  
  // Import data (this will overwrite existing data)
  // In production, you might want to add more sophisticated merge logic
  
  if (backup.data.customers && backup.data.customers.length > 0) {
    for (const customer of backup.data.customers) {
      await db.insert(customers).values(customer).onDuplicateKeyUpdate({ set: customer });
    }
  }
  
  if (backup.data.timeEntries && backup.data.timeEntries.length > 0) {
    for (const entry of backup.data.timeEntries) {
      await db.insert(timeEntries).values(entry).onDuplicateKeyUpdate({ set: entry });
    }
  }
  
  if (backup.data.expenses && backup.data.expenses.length > 0) {
    for (const expense of backup.data.expenses) {
      await db.insert(expenses).values(expense).onDuplicateKeyUpdate({ set: expense });
    }
  }
  
  if (backup.data.exchangeRates && backup.data.exchangeRates.length > 0) {
    for (const rate of backup.data.exchangeRates) {
      await db.insert(exchangeRates).values(rate).onDuplicateKeyUpdate({ set: rate });
    }
  }
  
  if (backup.data.fixedCosts && backup.data.fixedCosts.length > 0) {
    for (const cost of backup.data.fixedCosts) {
      await db.insert(fixedCosts).values(cost).onDuplicateKeyUpdate({ set: cost });
    }
  }
  
  if (backup.data.taxSettings && backup.data.taxSettings.length > 0) {
    for (const setting of backup.data.taxSettings) {
      await db.insert(taxSettings).values(setting).onDuplicateKeyUpdate({ set: setting });
    }
  }
  
  if (backup.data.accountSettings && backup.data.accountSettings.length > 0) {
    for (const setting of backup.data.accountSettings) {
      await db.insert(accountSettings).values(setting).onDuplicateKeyUpdate({ set: setting });
    }
  }
  
  if (backup.data.invoiceNumbers && backup.data.invoiceNumbers.length > 0) {
    for (const invoice of backup.data.invoiceNumbers) {
      await db.insert(invoiceNumbers).values(invoice).onDuplicateKeyUpdate({ set: invoice });
    }
  }
  
  return { success: true, message: "Database imported successfully" };
}
