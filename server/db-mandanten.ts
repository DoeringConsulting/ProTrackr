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

export async function getAllMandanten() {
  const db = await getDb();
  if (!db) return [];
  const { mandanten } = await import("../drizzle/schema");
  return await db.select().from(mandanten);
}
