import { z } from "zod";
import { getDb } from "./db";
import {
  mandanten,
  users,
  passwordResetTokens,
  customers,
  invoiceNumbers,
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
} from "../drizzle/schema";

/**
 * Vollständiges Datensicherungs-/Restore-Modul.
 *
 * Deckt ALLE 15 Tabellen des Schemas ab (vorher nur 6 — dadurch gingen
 * Steuerprofil, Kontoeinstellungen, Rechnungsnummern etc. beim Restore
 * verloren; ausserdem konnte ein FK-Bruch (fixedCosts.userId → users.id,
 * users war nicht im Backup) die gesamte Restore-Transaktion still
 * zurückrollen, sodass z.B. nur 8 statt 10 Fixkosten ankamen).
 *
 * Backup-Format-Version 1.1.0. Restore akzeptiert weiterhin alte 1.0.0-Backups
 * (die 9 neuen Tabellen sind im Schema optional).
 */

export interface BackupData {
  version: string;
  timestamp: string;
  data: {
    // Ursprüngliche 6 (Pflicht — 1.0.0-kompatibel)
    customers: Record<string, unknown>[];
    timeEntries: Record<string, unknown>[];
    expenses: Record<string, unknown>[];
    exchangeRates: Record<string, unknown>[];
    fixedCosts: Record<string, unknown>[];
    documents: Record<string, unknown>[];
    // Ab 1.1.0 ergänzt (optional, damit alte Backups weiter laden)
    mandanten?: Record<string, unknown>[];
    users?: Record<string, unknown>[];
    passwordResetTokens?: Record<string, unknown>[];
    invoiceNumbers?: Record<string, unknown>[];
    expenseAiAnalyses?: Record<string, unknown>[];
    taxSettings?: Record<string, unknown>[];
    taxProfiles?: Record<string, unknown>[];
    taxConfigPl?: Record<string, unknown>[];
    accountSettings?: Record<string, unknown>[];
  };
}

const rowArray = z.array(z.record(z.string(), z.unknown()));

const BackupSchema = z.object({
  version: z.string().min(1),
  timestamp: z.string().min(1),
  data: z.object({
    customers: rowArray,
    timeEntries: rowArray,
    expenses: rowArray,
    exchangeRates: rowArray,
    fixedCosts: rowArray,
    documents: rowArray,
    // neu, optional
    mandanten: rowArray.optional(),
    users: rowArray.optional(),
    passwordResetTokens: rowArray.optional(),
    invoiceNumbers: rowArray.optional(),
    expenseAiAnalyses: rowArray.optional(),
    taxSettings: rowArray.optional(),
    taxProfiles: rowArray.optional(),
    taxConfigPl: rowArray.optional(),
    accountSettings: rowArray.optional(),
  }),
});

/**
 * Reihenfolge für den Restore: Eltern-Tabellen VOR Kind-Tabellen (FK-sicher).
 * `auth: true` markiert Auth-/Mandanten-Tabellen, die beim Restore nur
 * eingefügt werden, wenn sie noch nicht existieren — ein bestehender
 * Login/Passwort-Hash wird NICHT überschrieben (kein versehentliches Aussperren).
 */
const RESTORE_ORDER: Array<{ key: keyof BackupData["data"]; table: any; auth?: boolean }> = [
  { key: "mandanten", table: mandanten, auth: true },
  { key: "users", table: users, auth: true },
  { key: "passwordResetTokens", table: passwordResetTokens, auth: true },
  { key: "exchangeRates", table: exchangeRates },
  { key: "taxConfigPl", table: taxConfigPl },
  { key: "customers", table: customers },
  { key: "invoiceNumbers", table: invoiceNumbers },
  { key: "fixedCosts", table: fixedCosts },
  { key: "taxSettings", table: taxSettings },
  { key: "taxProfiles", table: taxProfiles },
  { key: "accountSettings", table: accountSettings },
  { key: "timeEntries", table: timeEntries },
  { key: "expenses", table: expenses },
  { key: "documents", table: documents },
  { key: "expenseAiAnalyses", table: expenseAiAnalyses },
];

function isDuplicateKeyError(err: any): boolean {
  return err?.code === "ER_DUP_ENTRY" || err?.errno === 1062;
}

/**
 * Erstellt ein vollständiges Backup aller 15 Tabellen.
 */
export async function createBackup(): Promise<BackupData> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const [
    mandantenData,
    usersData,
    passwordResetTokensData,
    customersData,
    invoiceNumbersData,
    timeEntriesData,
    expensesData,
    documentsData,
    expenseAiAnalysesData,
    exchangeRatesData,
    fixedCostsData,
    taxSettingsData,
    taxProfilesData,
    taxConfigPlData,
    accountSettingsData,
  ] = await Promise.all([
    db.select().from(mandanten),
    db.select().from(users),
    db.select().from(passwordResetTokens),
    db.select().from(customers),
    db.select().from(invoiceNumbers),
    db.select().from(timeEntries),
    db.select().from(expenses),
    db.select().from(documents),
    db.select().from(expenseAiAnalyses),
    db.select().from(exchangeRates),
    db.select().from(fixedCosts),
    db.select().from(taxSettings),
    db.select().from(taxProfiles),
    db.select().from(taxConfigPl),
    db.select().from(accountSettings),
  ]);

  return {
    version: "1.1.0",
    timestamp: new Date().toISOString(),
    data: {
      customers: customersData,
      timeEntries: timeEntriesData,
      expenses: expensesData,
      exchangeRates: exchangeRatesData,
      fixedCosts: fixedCostsData,
      documents: documentsData,
      mandanten: mandantenData,
      users: usersData,
      passwordResetTokens: passwordResetTokensData,
      invoiceNumbers: invoiceNumbersData,
      expenseAiAnalyses: expenseAiAnalysesData,
      taxSettings: taxSettingsData,
      taxProfiles: taxProfilesData,
      taxConfigPl: taxConfigPlData,
      accountSettings: accountSettingsData,
    },
  };
}

/**
 * Stellt die Datenbank aus einem Backup wieder her.
 *
 * - Reihenfolge FK-sicher (Eltern vor Kindern).
 * - Auth-/Mandanten-Tabellen: nur einfügen-wenn-fehlend (kein Clobber).
 * - Daten-Tabellen: Upsert (Backup gewinnt), PK bleibt unangetastet.
 * - Zeilenweise mit Fehlererfassung: schlägt eine Zeile fehl (z.B. FK-Bruch),
 *   wird das NICHT verschluckt, sondern am Ende als detaillierte Exception
 *   gemeldet — die gesamte Transaktion rollt dann zurück (kein Halb-Zustand).
 *
 * Rückgabe: ausschliesslich numerische Zähler pro Tabelle (die UI summiert sie).
 */
export async function restoreBackup(
  backup: BackupData,
  strategy: "merge" | "replace" = "merge"
): Promise<Record<string, number>> {
  const parsedBackup = BackupSchema.safeParse(backup);
  if (!parsedBackup.success) {
    throw new Error(`Ungültiges Backup-Format: ${parsedBackup.error.message}`);
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const payload = parsedBackup.data.data as Record<string, Record<string, unknown>[] | undefined>;

  return await db.transaction(async (tx) => {
    const results: Record<string, number> = {};
    for (const t of RESTORE_ORDER) results[t.key] = 0;

    const failures: Array<{ table: string; id: unknown; reason: string }> = [];

    // "replace": nur die Daten-Tabellen leeren (Kinder vor Eltern), NIEMALS
    // die Auth-/Mandanten-Tabellen — sonst würde sich der aktuelle Benutzer
    // aussperren.
    if (strategy === "replace") {
      const deleteOrder = [...RESTORE_ORDER].reverse().filter((t) => !t.auth);
      for (const t of deleteOrder) {
        await tx.delete(t.table);
      }
    }

    for (const t of RESTORE_ORDER) {
      const rows = payload[t.key] ?? [];
      for (const row of rows) {
        try {
          if (t.auth) {
            // Einfügen-wenn-fehlend: bestehende Auth-Zeile bleibt unangetastet.
            try {
              await tx.insert(t.table).values(row as any);
            } catch (e) {
              if (isDuplicateKeyError(e)) {
                // Zeile existiert bereits — bewusst NICHT überschreiben.
              } else {
                throw e;
              }
            }
          } else {
            // Daten-Tabelle: Upsert. PK (id) NICHT in den Update-Satz, damit
            // ein per Unique-Key getroffener Bestandssatz seine id behält.
            const { id: _omitId, ...updatable } = row as Record<string, unknown>;
            await tx
              .insert(t.table)
              .values(row as any)
              .onDuplicateKeyUpdate({ set: updatable as any });
          }
          results[t.key] += 1;
        } catch (e: any) {
          failures.push({
            table: String(t.key),
            id: (row as any)?.id,
            reason: String(e?.message ?? e).slice(0, 300),
          });
        }
      }
    }

    if (failures.length > 0) {
      const detail = failures
        .map((f) => `  • ${f.table} id=${String(f.id)}: ${f.reason}`)
        .join("\n");
      throw new Error(
        `Restore unvollständig — ${failures.length} Zeile(n) konnten nicht importiert werden ` +
          `(gesamte Wiederherstellung zurückgerollt):\n${detail}`
      );
    }

    return results;
  });
}
