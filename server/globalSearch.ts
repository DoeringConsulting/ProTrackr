import { getDb } from "./db";
import { customers, timeEntries, expenses } from "../drizzle/schema";
import { like, or, sql } from "drizzle-orm";

export interface SearchResult {
  type: "customer" | "timeEntry" | "expense";
  id: number;
  title: string;
  subtitle?: string;
  metadata?: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const db = await getDb();
  if (!db) return [];
  
  const searchTerm = `%${query}%`;
  const results: SearchResult[] = [];

  // Search customers
  const customerResults = await db
    .select()
    .from(customers)
    .where(
      or(
        like(customers.provider, searchTerm),
        like(customers.mandatenNr, searchTerm),
        like(customers.projectName, searchTerm)
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
    .where(like(timeEntries.description, searchTerm))
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
      or(
        like(expenses.category, searchTerm),
        like(expenses.comment, searchTerm)
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
