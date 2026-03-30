import { eq, sql } from "drizzle-orm";
import { getDb } from "./db";

// ─── MANDANTEN FUNCTIONS ───────────────────────────────────────────

export async function findMandantByNr(mandantNr: string) {
  const db = await getDb();
  if (!db) return null;
  const { mandanten } = await import("../drizzle/schema");
  const result = await db
    .select()
    .from(mandanten)
    .where(eq(mandanten.mandantNr, mandantNr))
    .limit(1);
  return result[0] ?? null;
}

export async function findMandantByName(name: string) {
  const db = await getDb();
  if (!db) return null;
  const { mandanten } = await import("../drizzle/schema");
  const result = await db
    .select()
    .from(mandanten)
    .where(eq(mandanten.name, name))
    .limit(1);
  return result[0] ?? null;
}

export async function findMandantById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const { mandanten } = await import("../drizzle/schema");
  const result = await db
    .select()
    .from(mandanten)
    .where(eq(mandanten.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function getAllMandanten() {
  const db = await getDb();
  if (!db) return [];
  const { mandanten } = await import("../drizzle/schema");
  return await db.select().from(mandanten);
}

export async function createMandant(data: { name: string; mandantNr: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { mandanten } = await import("../drizzle/schema");

  await db.insert(mandanten).values({
    name: data.name,
    mandantNr: data.mandantNr,
  });

  const created = await findMandantByNr(data.mandantNr);
  return created;
}

export async function updateMandant(
  id: number,
  data: { name?: string; mandantNr?: string; status?: "active" | "archived" | "locked" }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { mandanten } = await import("../drizzle/schema");
  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.mandantNr !== undefined) updates.mandantNr = data.mandantNr;
  if (data.status !== undefined) updates.status = data.status;
  if (Object.keys(updates).length === 0) return await findMandantById(id);
  await db.update(mandanten).set(updates).where(eq(mandanten.id, id));
  return await findMandantById(id);
}

export async function archiveMandant(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { mandanten } = await import("../drizzle/schema");
  await db.update(mandanten).set({ status: "archived" }).where(eq(mandanten.id, id));
}

export async function lockMandant(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { mandanten } = await import("../drizzle/schema");
  await db.update(mandanten).set({ status: "locked" }).where(eq(mandanten.id, id));
}

export async function restoreMandant(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { mandanten } = await import("../drizzle/schema");
  await db.update(mandanten).set({ status: "active" }).where(eq(mandanten.id, id));
}

export async function deleteMandant(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { mandanten } = await import("../drizzle/schema");
  await db.delete(mandanten).where(eq(mandanten.id, id));
}

export async function countUsersByMandantId(mandantId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const { users } = await import("../drizzle/schema");
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .where(eq(users.mandantId, mandantId));
  return result[0]?.count ?? 0;
}
