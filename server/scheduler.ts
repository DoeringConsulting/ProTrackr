import {
  notifyMonthEnd,
  notifyMissingTimeEntries,
  notifyUpcomingInvoiceDeadline,
  notifyIncompleteExpenses,
} from "./notifications";
import { getDb, listAllActiveUsers } from "./db";
import { customers, expenses, timeEntries } from "../drizzle/schema";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { isLastDayOfMonth, monthLastDay, warsawDateKey } from "@shared/dateStichtag";

/**
 * Scheduler service for automatic notifications
 * This service should be called periodically (e.g., via cron job or scheduled task)
 */


export async function checkMonthEnd(userId: number) {
  const now = new Date();
  // Die AUSLÖSEBEDINGUNG folgt Europe/Warsaw, nicht der Container-Zeitzone: sonst entscheidet
  // die Container-Einstellung darüber, an welchem Kalendertag die Monatsend-Meldung feuert
  // (die SQL-Grenzen unten waren mit v2.3.5 bereits umgestellt, die Bedingung nicht).
  const isMonthEnd = isLastDayOfMonth(warsawDateKey());

  // Das Auswertungsfenster unten (`firstDay`/`lastDay`, `monthName`) leitet sich weiterhin aus
  // dem container-lokalen `now` ab. Divergenz zur Warschauer Auslösebedingung ist für die real
  // eingesetzten Container-Zeitzonen ausgeschlossen: der früheste Warschauer Monatsletzte
  // (00:00) ist UTC 22:00 des Vortags, also derselbe Monat. Erst ein Container ÖSTLICH von
  // Warschau (z.B. Asia/Tokyo) könnte „Monatsende Juli" mit August-Zahlen melden. Bewusst nicht
  // umgestellt, weil `firstDay`/`lastDay` zugleich als Date-Objekte in die SQL-Query gehen und
  // damit an der Grenzen-Konvention aus `db.ts` hängen — die wird separat entschieden.

  if (!isMonthEnd) {
    return { executed: false, reason: "Not last day of month" };
  }

  const db = await getDb();
  if (!db) {
    return { executed: false, reason: "Database not available" };
  }

  // Calculate month revenue and expenses
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  // Monatsgrenzen als Europe/Warsaw-Datumskey (verbindliche Projekt-TZ, CLAUDE.md §4), NICHT
  // via toISOString: letzteres liefert das UTC-Datum und kippt bei Server-TZ oestlich von UTC
  // (z.B. Warschau) auf den Vortag → expenses am Monatsersten/-letzten faelschlich ausgeschlossen.
  const firstDayStr = `${warsawDateKey(firstDay)} 00:00:00`;
  const lastDayStr = `${warsawDateKey(lastDay)} 23:59:59`;

  const entries = await db
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.userId, userId),
        gte(timeEntries.date, firstDay),
        lte(timeEntries.date, lastDay)
      )
    );

  const revenue = entries.reduce((sum, entry) => sum + entry.calculatedAmount, 0);
  
  // Query expenses for the month (linked to user-owned time entries + standalone user expenses)
  const linkedExpenseRecords = await db
    .select({ amount: expenses.amount })
    .from(expenses)
    .innerJoin(timeEntries, eq(expenses.timeEntryId, timeEntries.id))
    .where(
      and(
        eq(timeEntries.userId, userId),
        gte(expenses.date, firstDayStr),
        lte(expenses.date, lastDayStr)
      )
    );

  const standaloneExpenseRecords = await db
    .select({ amount: expenses.amount })
    .from(expenses)
    .where(
      and(
        eq(expenses.userId, userId),
        isNull(expenses.timeEntryId),
        gte(expenses.date, firstDayStr),
        lte(expenses.date, lastDayStr)
      )
    );

  const totalExpenses = [...linkedExpenseRecords, ...standaloneExpenseRecords].reduce(
    (sum, exp) => sum + exp.amount,
    0
  );

  const monthName = now.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  await notifyMonthEnd(monthName, revenue, totalExpenses);

  return { executed: true, month: monthName, revenue, expenses: totalExpenses };
}

export async function checkMissingTimeEntries(userId: number) {
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

    const entries = await db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, userId),
          gte(timeEntries.date, startOfDay),
          lte(timeEntries.date, endOfDay)
        )
      );

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

export async function checkUpcomingInvoiceDeadlines(userId: number) {
  const db = await getDb();
  if (!db) {
    return { executed: false, reason: "Database not available" };
  }

  // Check if we're within 5 days of month end — Fenster und Restlaufzeit folgen Europe/Warsaw,
  // nicht der Container-Zeitzone (sonst verschiebt sich der Versandtag der Erinnerung).
  const todayKey = warsawDateKey();
  const lastDayOfMonth = monthLastDay(todayKey);
  const daysUntilMonthEnd = lastDayOfMonth - Number(todayKey.split("-")[2]);

  if (daysUntilMonthEnd <= 5 && daysUntilMonthEnd > 0) {
    const allCustomers = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, userId));
    
    for (const customer of allCustomers) {
      // Aus demselben Warschauer Key wie das Fenster oben abgeleitet, damit angezeigtes
      // Fristdatum und berechnete Restlaufzeit nicht auseinanderlaufen können.
      // FORMAT bewusst DD.MM.YYYY mit Nullstellen ("31.07.2026"): `toLocaleDateString("de-DE")`
      // lieferte vorher das Kurzformat ohne Monats-Null ("31.7.2026"). Die Vereinheitlichung ist
      // gewollt (Projektstandard, globale CLAUDE.md §4) und wirkt nur kosmetisch — der Wert wird
      // ausschließlich in einen Meldungstext interpoliert, nichts parst ihn.
      const [dlYear, dlMonth] = todayKey.split("-").map(Number);
      const deadline = `${String(lastDayOfMonth).padStart(2, "0")}.${String(dlMonth).padStart(2, "0")}.${dlYear}`;
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

export async function checkIncompleteExpenses(userId: number) {
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
        eq(timeEntries.userId, userId),
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
export async function runScheduledTasks(userId: number) {
  console.log("[Scheduler] Running scheduled tasks...");
  
  const results = {
    monthEnd: await checkMonthEnd(userId),
    missingEntries: await checkMissingTimeEntries(userId),
    invoiceDeadlines: await checkUpcomingInvoiceDeadlines(userId),
    incompleteExpenses: await checkIncompleteExpenses(userId),
  };

  console.log("[Scheduler] Results:", JSON.stringify(results, null, 2));
  return results;
}

export async function runScheduledTasksGlobal() {
  const users = await listAllActiveUsers();
  const results: Record<number, Awaited<ReturnType<typeof runScheduledTasks>>> = {};

  for (const user of users) {
    results[user.id] = await runScheduledTasks(user.id);
  }

  return results;
}
