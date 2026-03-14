import { and, desc, eq, gt, gte, isNull, lte, or, sql } from "drizzle-orm";
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

export async function getAllCustomersIncludingArchived() {
  const db = await getDb();
  if (!db) return [];
  const { customers } = await import("../drizzle/schema");
  return await db.select().from(customers);
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const { customers } = await import("../drizzle/schema");
  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result[0] || null;
}

export async function getCustomersByMandatenNr(mandatenNr: string) {
  const db = await getDb();
  if (!db) return [];
  const { customers } = await import("../drizzle/schema");
  return await db
    .select()
    .from(customers)
    .where(eq(customers.mandatenNr, mandatenNr));
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

export async function recalculateTimeEntriesForCustomer(customerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { customers, timeEntries } = await import("../drizzle/schema");
  const customerResult = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  const customer = customerResult[0];
  if (!customer) return { updated: 0 };

  const dayHours = Math.max(1, Number(customer.standardDayHours ?? 800) / 100);
  const baseMinutesPerManDay = dayHours * 60;
  const entries = await db.select().from(timeEntries).where(eq(timeEntries.customerId, customerId));

  let updated = 0;
  for (const entry of entries) {
    const manDaysThousandths = Math.round((entry.hours / baseMinutesPerManDay) * 1000);
    const manDays = manDaysThousandths / 1000;
    const rate = entry.entryType === "onsite" ? customer.onsiteRate : customer.remoteRate;
    const calculatedAmount = Math.round(manDays * rate);
    await db
      .update(timeEntries)
      .set({
        rate,
        manDays: manDaysThousandths,
        calculatedAmount,
      })
      .where(eq(timeEntries.id, entry.id));
    updated += 1;
  }

  return { updated };
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

export async function getFixedCostById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const { fixedCosts } = await import("../drizzle/schema");
  const result = await db.select().from(fixedCosts).where(eq(fixedCosts.id, id)).limit(1);
  return result[0] || null;
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

export async function getTaxProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const { taxProfiles } = await import("../drizzle/schema");
  const result = await db
    .select()
    .from(taxProfiles)
    .where(eq(taxProfiles.userId, userId))
    .limit(1);
  return result[0] || null;
}

export async function upsertTaxProfile(userId: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { taxProfiles } = await import("../drizzle/schema");

  const existing = await getTaxProfile(userId);

  if (existing) {
    await db.update(taxProfiles).set(data).where(eq(taxProfiles.userId, userId));
  } else {
    await db.insert(taxProfiles).values({ ...data, userId });
  }

  return await getTaxProfile(userId);
}

export async function getTaxConfigByYear(year: number) {
  const db = await getDb();
  if (!db) return null;
  const { taxConfigPl } = await import("../drizzle/schema");
  const result = await db
    .select()
    .from(taxConfigPl)
    .where(eq(taxConfigPl.year, year))
    .limit(1);
  return result[0] || null;
}

export async function upsertTaxConfigByYear(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { taxConfigPl } = await import("../drizzle/schema");

  const existing = await getTaxConfigByYear(data.year);

  if (existing) {
    await db.update(taxConfigPl).set(data).where(eq(taxConfigPl.year, data.year));
  } else {
    await db.insert(taxConfigPl).values(data);
  }

  return await getTaxConfigByYear(data.year);
}

// Expense queries
export async function getExpensesByTimeEntry(timeEntryId: number) {
  const db = await getDb();
  if (!db) return [];
  const { expenses } = await import("../drizzle/schema");
  return await db.select().from(expenses).where(eq(expenses.timeEntryId, timeEntryId));
}

export async function getExpenseById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const { expenses } = await import("../drizzle/schema");
  const result = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  return result[0] || null;
}

export async function getExpensesByCustomer(userId: number, customerId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const { expenses, timeEntries } = await import("../drizzle/schema");
  const conditions = [eq(timeEntries.userId, userId), eq(timeEntries.customerId, customerId)];
  if (startDate) {
    const startKey = startDate.toISOString().slice(0, 10);
    conditions.push(
      sql`DATE(COALESCE(${expenses.checkOutDate}, ${expenses.checkInDate}, ${expenses.date})) >= ${startKey}`
    );
  }
  if (endDate) {
    const endKey = endDate.toISOString().slice(0, 10);
    conditions.push(
      sql`DATE(COALESCE(${expenses.checkInDate}, ${expenses.date})) <= ${endKey}`
    );
  }
  
  // Join expenses with timeEntries to filter by customerId
  const result = await db
    .select({
      id: expenses.id,
      timeEntryId: expenses.timeEntryId,
      category: expenses.category,
      amount: expenses.amount,
      currency: expenses.currency,
      comment: expenses.comment,
      date: expenses.date,
      flightRouteType: expenses.flightRouteType,
      departureTime: expenses.departureTime,
      arrivalTime: expenses.arrivalTime,
      checkInDate: expenses.checkInDate,
      checkOutDate: expenses.checkOutDate,
    })
    .from(expenses)
    .innerJoin(timeEntries, eq(expenses.timeEntryId, timeEntries.id))
    .where(and(...conditions));
  
  return result;
}

export async function deleteDocument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { documents } = await import("../drizzle/schema");
  await db.delete(documents).where(eq(documents.id, id));
}

// ⚠️ User queries removed (auth disabled for development)

export async function createDocument(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { documents } = await import("../drizzle/schema");
  const result = await db.insert(documents).values(data);
  const insertId = Number((result as any)?.insertId ?? (result as any)?.[0]?.insertId ?? 0);
  if (insertId > 0) {
    return await getDocumentById(insertId);
  }
  const fallback = await db
    .select()
    .from(documents)
    .where(and(eq(documents.userId, data.userId), eq(documents.fileKey, data.fileKey)))
    .orderBy(desc(documents.id))
    .limit(1);
  return fallback[0] ?? null;
}

export async function getDocumentsByExpense(expenseId: number) {
  const db = await getDb();
  if (!db) return [];
  const { documents } = await import("../drizzle/schema");
  return await db
    .select()
    .from(documents)
    .where(eq(documents.expenseId, expenseId))
    .orderBy(desc(documents.createdAt));
}

export async function getDocumentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const { documents } = await import("../drizzle/schema");
  const rows = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createExpenseAiAnalysis(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { expenseAiAnalyses } = await import("../drizzle/schema");
  const result = await db.insert(expenseAiAnalyses).values(data);
  const insertId = Number((result as any)?.insertId ?? (result as any)?.[0]?.insertId ?? 0);
  if (insertId > 0) {
    return await getExpenseAiAnalysisById(insertId);
  }
  const fallback = await db
    .select()
    .from(expenseAiAnalyses)
    .where(eq(expenseAiAnalyses.userId, data.userId))
    .orderBy(desc(expenseAiAnalyses.id))
    .limit(1);
  return fallback[0] ?? null;
}

export async function getExpenseAiAnalysisById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const { expenseAiAnalyses } = await import("../drizzle/schema");
  const rows = await db.select().from(expenseAiAnalyses).where(eq(expenseAiAnalyses.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listExpenseAiAnalysesByUser(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  const { expenseAiAnalyses } = await import("../drizzle/schema");
  return await db
    .select()
    .from(expenseAiAnalyses)
    .where(eq(expenseAiAnalyses.userId, userId))
    .orderBy(desc(expenseAiAnalyses.createdAt))
    .limit(limit);
}

export async function updateExpenseAiAnalysis(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { expenseAiAnalyses } = await import("../drizzle/schema");
  await db.update(expenseAiAnalyses).set(data).where(eq(expenseAiAnalyses.id, id));
}

// Exchange rate queries
export async function createExchangeRate(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { exchangeRates } = await import("../drizzle/schema");
  const userId = typeof data.userId === "number" ? data.userId : 0;
  const payload = { ...data, userId };
  
  // Check if rate already exists for this date and currency pair
  const existing = await getExchangeRateByDate(data.currencyPair, data.date, userId);
  
  if (existing) {
    // Update existing rate
    await db.update(exchangeRates)
      .set(payload)
      .where(and(
        eq(exchangeRates.currencyPair, data.currencyPair),
        eq(exchangeRates.date, data.date),
        eq(exchangeRates.userId, userId)
      ));
  } else {
    // Insert new rate
    await db.insert(exchangeRates).values(payload);
  }
}

export async function getExchangeRates(filters?: {
  startDate?: Date;
  endDate?: Date;
  currency?: string;
  userId?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const { exchangeRates } = await import("../drizzle/schema");

  const conditions = [];

  if (typeof filters?.userId === "number") {
    conditions.push(or(eq(exchangeRates.userId, 0), eq(exchangeRates.userId, filters.userId)));
  } else {
    conditions.push(eq(exchangeRates.userId, 0));
  }

  if (filters?.startDate) {
    conditions.push(sql`DATE(${exchangeRates.date}) >= ${filters.startDate.toISOString().split("T")[0]}`);
  }
  if (filters?.endDate) {
    conditions.push(sql`DATE(${exchangeRates.date}) <= ${filters.endDate.toISOString().split("T")[0]}`);
  }
  if (filters?.currency) {
    conditions.push(sql`${exchangeRates.currencyPair} LIKE ${`${filters.currency.toUpperCase()}/%`}`);
  }

  return await db
    .select()
    .from(exchangeRates)
    .where(and(...conditions))
    .orderBy(desc(exchangeRates.date));
}

export async function getExchangeRateByDate(currencyPair: string, date: Date, userId: number = 0) {
  const db = await getDb();
  if (!db) return null;
  const { exchangeRates } = await import("../drizzle/schema");
  
  const result = await db
    .select()
    .from(exchangeRates)
    .where(and(
      eq(exchangeRates.currencyPair, currencyPair),
      eq(exchangeRates.date, date),
      eq(exchangeRates.userId, userId)
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

function normalizeExpenseMutationPayload(data: Record<string, any>) {
  const payload: Record<string, any> = { ...data };
  const dateKeys = ["date", "checkInDate", "checkOutDate"] as const;
  const formatSqlDateTime = (date: Date) => date.toISOString().slice(0, 19).replace("T", " ");
  const normalizeDateInput = (value: unknown): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return undefined;
      return formatSqlDateTime(value);
    }

    if (typeof value !== "string") return undefined;

    const trimmed = value.trim();
    if (!trimmed) return null;

    // Accept HTML date input format.
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return `${trimmed} 00:00:00`;
    }

    // Accept German date format (DD.MM.YYYY) from localized controls.
    const deMatch = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (deMatch) {
      const [, dd, mm, yyyy] = deMatch;
      return `${yyyy}-${mm}-${dd} 00:00:00`;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return formatSqlDateTime(parsed);
  };

  for (const key of dateKeys) {
    if (!(key in payload)) continue;
    const value = payload[key];

    const normalized = normalizeDateInput(value);
    if (normalized === undefined) {
      delete payload[key];
      continue;
    }
    payload[key] = normalized;
  }

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) {
      delete payload[key];
    }
  }

  if ("flightRouteType" in payload) {
    const raw = payload.flightRouteType;
    if (raw === null || raw === "") {
      payload.flightRouteType = null;
    } else if (typeof raw === "string") {
      payload.flightRouteType = raw.trim().toLowerCase();
    }
  }

  return payload;
}

export async function updateExpense(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { expenses } = await import("../drizzle/schema");
  const payload = normalizeExpenseMutationPayload(data ?? {});
  await db.update(expenses).set(payload as any).where(eq(expenses.id, id));
}

export async function createExpense(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { expenses } = await import("../drizzle/schema");
  const payload = normalizeExpenseMutationPayload(data ?? {});
  const result = await db.insert(expenses).values(payload as any);
  return result;
}

export async function getAllExpenses(userId: number, startDate?: string, endDate?: string) {
  const db = await getDb();
  if (!db) return [];
  const { expenses, timeEntries } = await import("../drizzle/schema");
  
  // Build where conditions for time-entry-linked expenses
  const timeEntryConditions = [eq(timeEntries.userId, userId)];
  
  if (startDate) {
    timeEntryConditions.push(
      sql`DATE(COALESCE(${expenses.checkOutDate}, ${expenses.checkInDate}, ${expenses.date})) >= ${startDate}`
    );
  }
  if (endDate) {
    timeEntryConditions.push(
      sql`DATE(COALESCE(${expenses.checkInDate}, ${expenses.date})) <= ${endDate}`
    );
  }
  
  // Get expenses linked to time entries
  const linkedExpenses = await db
    .select({
      id: expenses.id,
      timeEntryId: expenses.timeEntryId,
      customerId: timeEntries.customerId,
      category: expenses.category,
      amount: expenses.amount,
      currency: expenses.currency,
      comment: expenses.comment,
      travelStart: expenses.travelStart,
      travelEnd: expenses.travelEnd,
      fullDay: expenses.fullDay,
      ticketNumber: expenses.ticketNumber,
      flightNumber: expenses.flightNumber,
      flightRouteType: expenses.flightRouteType,
      departureTime: expenses.departureTime,
      arrivalTime: expenses.arrivalTime,
      checkInDate: expenses.checkInDate,
      checkOutDate: expenses.checkOutDate,
      date: expenses.date,
      createdAt: expenses.createdAt,
    })
    .from(expenses)
    .innerJoin(timeEntries, eq(expenses.timeEntryId, timeEntries.id))
    .where(and(...timeEntryConditions));
  
  // Build where conditions for standalone expenses
  const standaloneConditions = [
    sql`${expenses.timeEntryId} IS NULL`,
    eq(expenses.userId, userId),
  ];
  
  if (startDate) {
    standaloneConditions.push(
      sql`DATE(COALESCE(${expenses.checkOutDate}, ${expenses.checkInDate}, ${expenses.date})) >= ${startDate}`
    );
  }
  if (endDate) {
    standaloneConditions.push(
      sql`DATE(COALESCE(${expenses.checkInDate}, ${expenses.date})) <= ${endDate}`
    );
  }
  
  // Get standalone expenses (not linked to time entries)
  const standaloneExpenses = await db
    .select({
      id: expenses.id,
      timeEntryId: expenses.timeEntryId,
      customerId: sql<number | null>`NULL`,
      category: expenses.category,
      amount: expenses.amount,
      currency: expenses.currency,
      comment: expenses.comment,
      travelStart: expenses.travelStart,
      travelEnd: expenses.travelEnd,
      fullDay: expenses.fullDay,
      ticketNumber: expenses.ticketNumber,
      flightNumber: expenses.flightNumber,
      flightRouteType: expenses.flightRouteType,
      departureTime: expenses.departureTime,
      arrivalTime: expenses.arrivalTime,
      checkInDate: expenses.checkInDate,
      checkOutDate: expenses.checkOutDate,
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
  const isManual = String(data.source || "").toLowerCase() === "manual" ? 1 : 0;
  const userId = typeof data.userId === "number" ? data.userId : 0;
  const payload = { ...data, userId };
  
  // Check if rate exists for this date and currency pair
  const existing = await getExchangeRateByDate(data.currencyPair, data.date, userId);
  
  if (existing) {
    await db.update(exchangeRates)
      .set({ ...payload, isManual })
      .where(and(
        eq(exchangeRates.currencyPair, data.currencyPair),
        eq(exchangeRates.date, data.date),
        eq(exchangeRates.userId, userId)
      ));
  } else {
    await db.insert(exchangeRates).values({ ...payload, isManual });
  }
  
  return await getExchangeRateByDate(data.currencyPair, data.date, userId);
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
  
  const {
    mandanten,
    users,
    passwordResetTokens,
    customers,
    timeEntries,
    expenses,
    documents,
    expenseAiAnalyses,
    exchangeRates,
    fixedCosts,
    taxSettings,
    taxProfiles,
    taxConfigPl,
    accountSettings,
    invoiceNumbers,
  } = await import("../drizzle/schema");
  
  // Export all tables
  const backup = {
    version: "1.0",
    exportDate: new Date().toISOString(),
    data: {
      mandanten: await db.select().from(mandanten),
      users: await db.select().from(users),
      passwordResetTokens: await db.select().from(passwordResetTokens),
      customers: await db.select().from(customers),
      timeEntries: await db.select().from(timeEntries),
      expenses: await db.select().from(expenses),
      documents: await db.select().from(documents),
      expenseAiAnalyses: await db.select().from(expenseAiAnalyses),
      exchangeRates: await db.select().from(exchangeRates),
      fixedCosts: await db.select().from(fixedCosts),
      taxSettings: await db.select().from(taxSettings),
      taxProfiles: await db.select().from(taxProfiles),
      taxConfigPl: await db.select().from(taxConfigPl),
      accountSettings: await db.select().from(accountSettings),
      invoiceNumbers: await db.select().from(invoiceNumbers),
    },
  };
  
  return backup;
}

// ─── AUTH: USER FUNCTIONS ───────────────────────────────────────────

export async function findUserByEmailAndMandant(email: string, mandantId: number) {
  const db = await getDb();
  if (!db) return null;
  const { users } = await import("../drizzle/schema");
  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.mandantId, mandantId)))
    .limit(1);
  return result[0] ?? null;
}

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

export async function createPasswordResetToken(data: {
  userId: number;
  tokenHash: string;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { passwordResetTokens } = await import("../drizzle/schema");
  await db.insert(passwordResetTokens).values({
    userId: data.userId,
    tokenHash: data.tokenHash,
    expiresAt: data.expiresAt,
  });
}

export async function getValidPasswordResetToken(tokenHash: string) {
  const db = await getDb();
  if (!db) return null;
  const { passwordResetTokens } = await import("../drizzle/schema");
  const result = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .limit(1);
  return result[0] ?? null;
}

export async function consumePasswordResetToken(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { passwordResetTokens } = await import("../drizzle/schema");
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, id));
}

export async function updateUserPasswordHash(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { users } = await import("../drizzle/schema");
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function createUser(data: {
  mandantId: number;
  email: string;
  passwordHash: string;
  displayName?: string | null;
  role?: "user" | "admin" | "mandant_admin" | "webapp_admin";
  accountStatus?: "active" | "suspended" | "deleted";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { users } = await import("../drizzle/schema");
  await db.insert(users).values({
    mandantId: data.mandantId,
    email: data.email,
    passwordHash: data.passwordHash,
    displayName: data.displayName ?? null,
    role: (data.role ?? "user") as any,
    accountStatus: data.accountStatus ?? "active",
  });
}

export async function updateUserById(
  id: number,
  data: {
    mandantId?: number;
    email?: string;
    displayName?: string | null;
    role?: "user" | "admin" | "mandant_admin" | "webapp_admin";
    passwordHash?: string | null;
    accountStatus?: "active" | "suspended" | "deleted";
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { users } = await import("../drizzle/schema");
  await db
    .update(users)
    .set({
      ...(data.mandantId !== undefined ? { mandantId: data.mandantId } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      ...(data.role !== undefined ? { role: data.role as any } : {}),
      ...(data.passwordHash !== undefined ? { passwordHash: data.passwordHash } : {}),
      ...(data.accountStatus !== undefined ? { accountStatus: data.accountStatus as any } : {}),
    })
    .where(eq(users.id, id));
}

export async function listUsersGlobal() {
  const db = await getDb();
  if (!db) return [];
  const { users } = await import("../drizzle/schema");
  return await db
    .select({
      id: users.id,
      mandantId: users.mandantId,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      accountStatus: users.accountStatus,
      isActive: sql<number>`CASE WHEN ${users.accountStatus} = 'active' AND ${users.passwordHash} IS NOT NULL THEN 1 ELSE 0 END`,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(desc(users.id));
}

export async function listUsersByMandantId(mandantId: number) {
  const db = await getDb();
  if (!db) return [];
  const { users } = await import("../drizzle/schema");
  return await db
    .select({
      id: users.id,
      mandantId: users.mandantId,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      accountStatus: users.accountStatus,
      isActive: sql<number>`CASE WHEN ${users.accountStatus} = 'active' AND ${users.passwordHash} IS NOT NULL THEN 1 ELSE 0 END`,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.mandantId, mandantId))
    .orderBy(desc(users.id));
}

export async function suspendUserById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { users } = await import("../drizzle/schema");
  await db.update(users).set({ accountStatus: "suspended" as any }).where(eq(users.id, id));
}

export async function deleteUserById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { users } = await import("../drizzle/schema");
  await db.update(users).set({ accountStatus: "deleted" as any }).where(eq(users.id, id));
}

export async function restoreUserById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { users } = await import("../drizzle/schema");
  await db.update(users).set({ accountStatus: "active" as any }).where(eq(users.id, id));
}

export async function countActiveMandantAdmins(mandantId: number, excludeUserId?: number) {
  const db = await getDb();
  if (!db) return 0;
  const { users } = await import("../drizzle/schema");
  const conditions: any[] = [
    eq(users.mandantId, mandantId),
    or(eq(users.role, "mandant_admin"), eq(users.role, "admin")),
    eq(users.accountStatus, "active"),
  ];
  if (excludeUserId !== undefined) {
    conditions.push(sql`${users.id} <> ${excludeUserId}`);
  }
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(...conditions));
  return Number(rows[0]?.count ?? 0);
}

export async function countNonDeletedMandantAdmins(mandantId: number, excludeUserId?: number) {
  const db = await getDb();
  if (!db) return 0;
  const { users } = await import("../drizzle/schema");
  const conditions: any[] = [
    eq(users.mandantId, mandantId),
    or(eq(users.role, "mandant_admin"), eq(users.role, "admin")),
    sql`${users.accountStatus} <> 'deleted'`,
  ];
  if (excludeUserId !== undefined) {
    conditions.push(sql`${users.id} <> ${excludeUserId}`);
  }
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(...conditions));
  return Number(rows[0]?.count ?? 0);
}

export async function countActiveGlobalSetupAdmins(excludeUserId?: number) {
  const db = await getDb();
  if (!db) return 0;
  const { users } = await import("../drizzle/schema");
  const conditions: any[] = [
    eq(users.accountStatus, "active"),
    or(eq(users.role, "webapp_admin"), and(eq(users.role, "admin"), eq(users.id, 1))),
  ];
  if (excludeUserId !== undefined) {
    conditions.push(sql`${users.id} <> ${excludeUserId}`);
  }
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(...conditions));
  return Number(rows[0]?.count ?? 0);
}

// ─── END AUTH ─────────────────────────────────────────────────────────

export async function importDatabase(backup: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Validate backup structure
  if (!backup.version || !backup.data) {
    throw new Error("Invalid backup format");
  }
  
  const {
    mandanten,
    users,
    passwordResetTokens,
    customers,
    timeEntries,
    expenses,
    documents,
    expenseAiAnalyses,
    exchangeRates,
    fixedCosts,
    taxSettings,
    taxProfiles,
    taxConfigPl,
    accountSettings,
    invoiceNumbers,
  } = await import("../drizzle/schema");
  
  // Import data (this will overwrite existing data)
  // In production, you might want to add more sophisticated merge logic
  if (backup.data.mandanten && backup.data.mandanten.length > 0) {
    for (const mandant of backup.data.mandanten) {
      await db.insert(mandanten).values(mandant).onDuplicateKeyUpdate({ set: mandant });
    }
  }

  if (backup.data.users && backup.data.users.length > 0) {
    for (const user of backup.data.users) {
      await db.insert(users).values(user).onDuplicateKeyUpdate({ set: user });
    }
  }

  if (backup.data.passwordResetTokens && backup.data.passwordResetTokens.length > 0) {
    for (const token of backup.data.passwordResetTokens) {
      await db.insert(passwordResetTokens).values(token).onDuplicateKeyUpdate({ set: token });
    }
  }
  
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

  if (backup.data.documents && backup.data.documents.length > 0) {
    for (const document of backup.data.documents) {
      await db.insert(documents).values(document).onDuplicateKeyUpdate({ set: document });
    }
  }

  if (backup.data.expenseAiAnalyses && backup.data.expenseAiAnalyses.length > 0) {
    for (const analysis of backup.data.expenseAiAnalyses) {
      await db.insert(expenseAiAnalyses).values(analysis).onDuplicateKeyUpdate({ set: analysis });
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

  if (backup.data.taxProfiles && backup.data.taxProfiles.length > 0) {
    for (const profile of backup.data.taxProfiles) {
      await db.insert(taxProfiles).values(profile).onDuplicateKeyUpdate({ set: profile });
    }
  }

  if (backup.data.taxConfigPl && backup.data.taxConfigPl.length > 0) {
    for (const config of backup.data.taxConfigPl) {
      await db.insert(taxConfigPl).values(config).onDuplicateKeyUpdate({ set: config });
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
