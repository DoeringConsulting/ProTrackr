import { notifyMonthEnd, notifyMissingTimeEntries, notifyUpcomingInvoiceDeadline, notifyIncompleteExpenses } from "./notifications";
import { getDb } from "./db";
import { timeEntries, customers } from "../drizzle/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

/**
 * Scheduler service for automatic notifications
 * This service should be called periodically (e.g., via cron job or scheduled task)
 */

export async function checkMonthEnd() {
  const now = new Date();
  const isLastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() === now.getDate();
  
  if (!isLastDayOfMonth) {
    return { executed: false, reason: "Not last day of month" };
  }

  const db = await getDb();
  if (!db) {
    return { executed: false, reason: "Database not available" };
  }

  // Calculate month revenue and expenses
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const firstDayStr = `${firstDay.toISOString().slice(0, 10)} 00:00:00`;
  const lastDayStr = `${lastDay.toISOString().slice(0, 10)} 23:59:59`;

  const entries = await db
    .select()
    .from(timeEntries)
    .where(
      and(
        gte(timeEntries.date, firstDay),
        lte(timeEntries.date, lastDay)
      )
    );

  const revenue = entries.reduce((sum, entry) => sum + entry.calculatedAmount, 0);
  
  // Query expenses for the month
  const { expenses: expensesTable } = await import("../drizzle/schema");
  const expenseRecords = await db
    .select()
    .from(expensesTable)
    .where(
      and(
        gte(expensesTable.date, firstDayStr),
        lte(expensesTable.date, lastDayStr)
      )
    );
  const expenses = expenseRecords.reduce((sum, exp) => sum + exp.amount, 0);

  const monthName = now.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  await notifyMonthEnd(monthName, revenue, expenses);

  return { executed: true, month: monthName, revenue, expenses };
}

export async function checkMissingTimeEntries(userId?: number) {
  const now = new Date();
  const db = await getDb();
  if (!db) {
    return { executed: false, reason: "Database not available" };
  }

  // Check last 7 days for missing entries (weekdays only)
  const daysToCheck = 7;
  const missingDays: string[] = [];

  for (let i = 1; i <= daysToCheck; i++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() - i);
    
    // Skip weekends
    const dayOfWeek = checkDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const startOfDay = new Date(checkDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(checkDate.setHours(23, 59, 59, 999));

    const whereConditions = [
      gte(timeEntries.date, startOfDay),
      lte(timeEntries.date, endOfDay)
    ];
    
    if (userId) {
      whereConditions.push(eq(timeEntries.userId, userId));
    }
    
    const entries = await db
      .select()
      .from(timeEntries)
      .where(and(...whereConditions));

    if (entries.length === 0) {
      missingDays.push(checkDate.toLocaleDateString("de-DE"));
    }
  }

  if (missingDays.length > 0) {
    const latestDate = missingDays[0] || "";
    await notifyMissingTimeEntries(latestDate, missingDays.length);
    return { executed: true, missingDays };
  }

  return { executed: false, reason: "No missing entries" };
}

export async function checkUpcomingInvoiceDeadlines() {
  const now = new Date();
  const db = await getDb();
  if (!db) {
    return { executed: false, reason: "Database not available" };
  }

  // Check if we're within 5 days of month end
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysUntilMonthEnd = lastDayOfMonth - now.getDate();

  if (daysUntilMonthEnd <= 5 && daysUntilMonthEnd > 0) {
    const allCustomers = await db.select().from(customers);
    
    for (const customer of allCustomers) {
      const deadline = new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString("de-DE");
      await notifyUpcomingInvoiceDeadline(
        `${customer.provider} - ${customer.projectName}`,
        deadline,
        daysUntilMonthEnd
      );
    }

    return { executed: true, daysLeft: daysUntilMonthEnd, customers: allCustomers.length };
  }

  return { executed: false, reason: "Not within deadline window" };
}

export async function checkIncompleteExpenses() {
  const now = new Date();
  const db = await getDb();
  if (!db) {
    return { executed: false, reason: "Database not available" };
  }

  // Check current month for business trips without expenses
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const entries = await db
    .select()
    .from(timeEntries)
    .where(
      and(
        gte(timeEntries.date, firstDay),
        lte(timeEntries.date, lastDay),
        eq(timeEntries.entryType, "business_trip")
      )
    );

  // Check which entries have no associated expenses
  const { expenses: expensesTable } = await import("../drizzle/schema");
  let entriesWithoutExpenses = 0;
  
  for (const entry of entries) {
    const expenseCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(expensesTable)
      .where(eq(expensesTable.timeEntryId, entry.id));
    
    if (expenseCount[0]?.count === 0) {
      entriesWithoutExpenses++;
    }
  }

  if (entriesWithoutExpenses > 0) {
    const monthName = now.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    await notifyIncompleteExpenses(monthName, entriesWithoutExpenses);
    return { executed: true, count: entriesWithoutExpenses };
  }

  return { executed: false, reason: "No incomplete expenses" };
}

/**
 * Main scheduler function to run all checks
 * Should be called periodically (e.g., daily at a specific time)
 */
export async function runScheduledTasks(userId?: number) {
  console.log("[Scheduler] Running scheduled tasks...");
  
  const results = {
    monthEnd: await checkMonthEnd(),
    missingEntries: userId ? await checkMissingTimeEntries(userId) : { executed: false, reason: "No userId provided" },
    invoiceDeadlines: await checkUpcomingInvoiceDeadlines(),
    incompleteExpenses: await checkIncompleteExpenses(),
  };

  console.log("[Scheduler] Results:", JSON.stringify(results, null, 2));
  return results;
}
