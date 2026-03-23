import { getDb } from "./db";
import { customers, timeEntries, expenses, users } from "../drizzle/schema";
import { and, eq, inArray, like, or } from "drizzle-orm";
import type { ScopeContext } from "./scope";

export interface SearchResult {
  type: "customer" | "timeEntry" | "expense";
  id: number;
  title: string;
  subtitle?: string;
  metadata?: string;
}

export async function globalSearch(query: string, scope: ScopeContext): Promise<SearchResult[]> {
  const db = await getDb();
  if (!db) return [];
  if (scope.role === "webapp_admin") return [];
  
  const searchTerm = `%${query}%`;
  let visibleUserIds: number[] = [scope.userId];

  if (scope.role === "mandant_admin" && scope.mandantId) {
    const mandantUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.mandantId, scope.mandantId));
    visibleUserIds = mandantUsers.map((entry) => entry.id);
  }

  if (visibleUserIds.length === 0) {
    return [];
  }
  const results: SearchResult[] = [];

  // Search customers
  const customerResults = await db
    .select()
    .from(customers)
    .where(
      and(
        inArray(customers.userId, visibleUserIds),
        or(
          like(customers.provider, searchTerm),
          like(customers.mandatenNr, searchTerm),
          like(customers.projectName, searchTerm)
        )
      )
    )
    .limit(5);

  results.push(
    ...customerResults.map((c: any) => ({
      type: "customer" as const,
      id: c.id,
      title: c.provider,
      subtitle: `Mandanten-Nr: ${c.mandatenNr}`,
      metadata: c.projectName,
    }))
  );

  // Search time entries
  const timeEntryResults = await db
    .select({
      id: timeEntries.id,
      date: timeEntries.date,
      hours: timeEntries.hours,
      description: timeEntries.description,
      customerId: timeEntries.customerId,
    })
    .from(timeEntries)
    .where(
      and(
        inArray(timeEntries.userId, visibleUserIds),
        like(timeEntries.description, searchTerm)
      )
    )
    .limit(5);

  results.push(
    ...timeEntryResults.map((t: any) => ({
      type: "timeEntry" as const,
      id: t.id,
      title: t.description || "Zeiteintrag",
      subtitle: `${new Date(t.date).toLocaleDateString("de-DE")} - ${t.hours}h`,
      metadata: `Kunde ID: ${t.customerId}`,
    }))
  );

  // Search expenses
  const expenseResults = await db
    .select()
    .from(expenses)
    .where(
      and(
        inArray(expenses.userId, visibleUserIds),
        or(
          like(expenses.category, searchTerm),
          like(expenses.comment, searchTerm)
        )
      )
    )
    .limit(5);

  results.push(
    ...expenseResults.map((e: any) => ({
      type: "expense" as const,
      id: e.id,
      title: `${e.category} - ${(e.amount / 100).toFixed(2)} ${e.currency || "EUR"}`,
      subtitle: e.comment || "",
      metadata: e.createdAt ? new Date(e.createdAt).toLocaleDateString("de-DE") : "",
    }))
  );

  return results;
}
