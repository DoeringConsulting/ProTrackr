import { eq } from "drizzle-orm";
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
