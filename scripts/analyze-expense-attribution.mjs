#!/usr/bin/env node
// =============================================================================
// scripts/analyze-expense-attribution.mjs
// =============================================================================
// DIAGNOSE-SKRIPT (STRIKT READ-ONLY — ausschliesslich SELECTs, keine Schreib-
// operation, keine DDL). Beantwortet die Frage aus ADR 0001:
//
//   Welche Reisekostenbelege fallen je nach Datums-Konvention in EINEN ANDEREN
//   Monat, und wie gross ist die betragsmaessige Auswirkung?
//
// Hintergrund: Bei Hotels setzt die Erfassung `expenses.date` zwangsweise auf
// das Check-in-Datum (client/src/pages/TimeTracking.tsx). Ein Aufenthalt ueber
// den Monatswechsel wird damit dem ANREISE-Monat zugeordnet, auch wenn die
// Rechnung erst im Folgemonat ausgestellt/beglichen wurde. Dieses Skript zeigt
// alle betroffenen Belege und stellt die Varianten gegenueber:
//
//   Variante A (aktuell, v2.5.2):  expense.date
//   Variante B (Alternative):      COALESCE(checkOutDate, date)
//
// Aufruf (DATABASE_URL zeigt auf die zu pruefende DB, z.B. im NAS-Container):
//   node scripts/analyze-expense-attribution.mjs
//   DATABASE_URL="mysql://user:pass@host:3306/protrackr" node scripts/analyze-expense-attribution.mjs
//
// Optional: --json  → maschinenlesbare Ausgabe statt Tabelle.

import mysql from "mysql2/promise";
import { config } from "dotenv";

config();

const asJson = process.argv.includes("--json");
const url = process.env.DATABASE_URL;

if (!url) {
  console.error("FEHLER: DATABASE_URL ist nicht gesetzt (.env oder Umgebungsvariable).");
  process.exit(1);
}

// Verbindungsziel anzeigen, aber NIEMALS Credentials ausgeben (K9 Secrets-Hygiene).
try {
  const parsed = new URL(url.replace(/^mysql:/, "http:"));
  console.error(`[info] Ziel-DB: ${parsed.hostname}:${parsed.port || "3306"}/${parsed.pathname.slice(1)} (read-only)`);
} catch {
  console.error("[warn] DATABASE_URL nicht parsebar — versuche Verbindung trotzdem.");
}

/**
 * Belege, deren Monatszuordnung zwischen den Varianten abweicht.
 * Abrechnungsrelevanter Kunde vereinfacht: explizite expenses.customerId, sonst
 * ueber den verknuepften Zeiteintrag. Der Datums-Fallback aus
 * expenseAttribution.ts (genau 1 Kunde am Belegtag, ab Cutover 2026-07-01) ist
 * hier NICHT nachgebildet — Belege ohne beide Zuordnungen erscheinen als NULL
 * und sind manuell zu bewerten.
 */
const DIVERGING_SQL = `
  SELECT
    e.id,
    e.category,
    e.amount,
    e.currency,
    DATE_FORMAT(e.date, '%Y-%m-%d')                              AS belegDatum,
    DATE_FORMAT(e.checkInDate, '%Y-%m-%d')                       AS checkIn,
    DATE_FORMAT(e.checkOutDate, '%Y-%m-%d')                      AS checkOut,
    DATE_FORMAT(e.date, '%Y-%m')                                 AS monatVarianteA,
    DATE_FORMAT(COALESCE(e.checkOutDate, e.date), '%Y-%m')       AS monatVarianteB,
    COALESCE(e.customerId, te.customerId)                        AS billingCustomerId,
    c.projectName,
    c.costModel,
    e.comment
  FROM expenses e
  LEFT JOIN timeEntries te ON te.id = e.timeEntryId
  LEFT JOIN customers  c  ON c.id  = COALESCE(e.customerId, te.customerId)
  WHERE DATE_FORMAT(e.date, '%Y-%m')
     <> DATE_FORMAT(COALESCE(e.checkOutDate, e.date), '%Y-%m')
  ORDER BY e.date ASC, e.id ASC
`;

/** Wie viele Hotelbelege gibt es insgesamt (Bezugsgroesse fuer die Quote). */
const TOTALS_SQL = `
  SELECT
    COUNT(*)                                                          AS gesamt,
    SUM(CASE WHEN e.checkOutDate IS NOT NULL THEN 1 ELSE 0 END)       AS mitCheckOut,
    SUM(CASE WHEN e.category = 'hotel' THEN 1 ELSE 0 END)             AS hotels
  FROM expenses e
`;

function formatAmount(cents, currency) {
  const value = (Number(cents) / 100).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value} ${currency}`;
}

const conn = await mysql.createConnection(url);
try {
  const [rows] = await conn.execute(DIVERGING_SQL);
  const [[totals]] = await conn.execute(TOTALS_SQL);

  if (asJson) {
    console.log(JSON.stringify({ totals, diverging: rows }, null, 2));
  } else {
    console.log("");
    console.log("=".repeat(100));
    console.log("BELEGE MIT ABWEICHENDER MONATSZUORDNUNG (Variante A: date  |  Variante B: checkOut ?? date)");
    console.log("=".repeat(100));

    if (rows.length === 0) {
      console.log("\nKeine abweichenden Belege gefunden — beide Varianten liefern identische Monatszuordnungen.\n");
    } else {
      for (const r of rows) {
        const exclusive = r.costModel === "exclusive";
        console.log("");
        console.log(`Beleg #${r.id}  [${r.category}]  ${formatAmount(r.amount, r.currency)}`);
        console.log(`  Belegdatum (date): ${r.belegDatum}   Check-in: ${r.checkIn ?? "-"}   Check-out: ${r.checkOut ?? "-"}`);
        console.log(`  Variante A (aktuell): ${r.monatVarianteA}     ->  Variante B: ${r.monatVarianteB}`);
        console.log(`  Kunde/Projekt: ${r.projectName ?? "(nicht zugeordnet)"} | costModel: ${r.costModel ?? "-"}` +
                    `${exclusive ? "  <== ABRECHENBAR, wirkt auf Kundenrechnung" : ""}`);
        if (r.comment) console.log(`  Kommentar: ${r.comment}`);
      }

      // Betragsmaessige Auswirkung je Monat und Waehrung: was wandert wohin.
      console.log("");
      console.log("-".repeat(100));
      console.log("AUSWIRKUNG JE MONAT (nur abrechenbare exclusive-Belege — diese veraendern Kundenrechnungen)");
      console.log("-".repeat(100));
      const impact = new Map();
      for (const r of rows) {
        if (r.costModel !== "exclusive") continue;
        const key = `${r.monatVarianteA} -> ${r.monatVarianteB} | ${r.currency}`;
        impact.set(key, (impact.get(key) ?? 0) + Number(r.amount));
      }
      if (impact.size === 0) {
        console.log("\nKeine abrechenbaren (exclusive) Belege betroffen — Kundenrechnungen bleiben unveraendert.\n");
      } else {
        for (const [key, cents] of impact) {
          const [move, currency] = key.split(" | ");
          console.log(`  ${move}:  ${formatAmount(cents, currency)}`);
        }
      }
    }

    console.log("");
    console.log("-".repeat(100));
    console.log(`Bestand gesamt: ${totals.gesamt} Belege | davon mit Check-out: ${totals.mitCheckOut} | Hotels: ${totals.hotels}`);
    console.log(`Abweichend: ${rows.length}`);
    console.log("-".repeat(100));
    console.log("");
  }
} finally {
  await conn.end();
}
