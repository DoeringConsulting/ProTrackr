#!/usr/bin/env node
// =============================================================================
// scripts/analyze-expense-attribution.mjs
// =============================================================================
// DIAGNOSE-SKRIPT (STRIKT READ-ONLY — ausschliesslich SELECTs, keine Schreib-
// operation, keine DDL). Beantwortet die Frage aus ADR 0001/0002:
//
//   Welche Reisekostenbelege fallen je nach Datums-Konvention in EINEN ANDEREN
//   Monat, und wie gross ist die betragsmaessige Auswirkung?
//
// Hintergrund: Bei Hotels setzt die Erfassung `expenses.date` zwangsweise auf
// das Check-in-Datum (client/src/pages/TimeTracking.tsx). Ein Aufenthalt ueber
// den Monatswechsel wurde damit dem ANREISE-Monat zugeordnet, obwohl die
// Leistung erst im Folgemonat endet und dort abgerechnet wird. Dieses Skript
// zeigt alle betroffenen Belege und stellt die Varianten gegenueber:
//
//   Variante A (historisch, ADR 0001 / v2.5.2):  expense.date
//   Variante B (AKTIV seit ADR 0002):            COALESCE(checkOutDate, date)
//                                                = Leistungsende, kanonische Regel
//
// Die Auflistung "A -> B" ist damit die Verschiebung, die der Umstieg auf
// ADR 0002 bewirkt: Spalte links = alte Zuordnung, Spalte rechts = geltende.
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

/**
 * DATENQUALITAET des Enddatums — die Voraussetzung dafuer, dass ADR 0002 ueberhaupt
 * greifen kann. Belege, deren `checkOutDate` fehlt oder mit dem Startdatum
 * zusammenfaellt, werden still dem START-Monat zugeordnet, obwohl die Leistung
 * spaeter endet. Zwei bekannte Ursachen (beide in v2.5.5 gefixt, wirken aber nur
 * nach vorn):
 *   - KI-Beleg-Pfad setzte `checkOutDate = checkInDate`, wenn die Rechnung nur
 *     "N Naechte" nennt (server/receiptAi.ts).
 *   - Workbook-Import leitete das Check-out per toISOString ab -> in Warschau
 *     ganzjaehrig der Vortag (client/src/pages/Import.tsx).
 * Geprueft werden Hotels UND Rundfluege (dort ist `checkOutDate` das Rueckflug-
 * datum) — bei Flugtickets ist die Fehlerklasse identisch, nur unauffaelliger.
 */
const DATA_QUALITY_SQL = `
  SELECT
    e.id,
    e.category,
    e.flightRouteType,
    e.amount,
    e.currency,
    DATE_FORMAT(e.date, '%Y-%m-%d')        AS belegDatum,
    DATE_FORMAT(e.checkInDate, '%Y-%m-%d') AS checkIn,
    DATE_FORMAT(e.checkOutDate, '%Y-%m-%d') AS checkOut,
    c.projectName,
    c.costModel,
    e.comment,
    CASE
      WHEN e.checkOutDate IS NULL THEN 'kein Enddatum erfasst'
      WHEN DATE(e.checkOutDate) = DATE(COALESCE(e.checkInDate, e.date))
        THEN 'Enddatum = Startdatum (verdaechtig: 0 Naechte / KI-Pfad / Import)'
      ELSE 'ok'
    END AS befund
  FROM expenses e
  LEFT JOIN timeEntries te ON te.id = e.timeEntryId
  LEFT JOIN customers  c  ON c.id  = COALESCE(e.customerId, te.customerId)
  WHERE (
          e.category = 'hotel'
       OR (e.category = 'flight' AND (e.flightRouteType IS NULL OR e.flightRouteType <> 'one_way'))
        )
    AND (
          e.checkOutDate IS NULL
       OR DATE(e.checkOutDate) = DATE(COALESCE(e.checkInDate, e.date))
        )
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
  const [quality] = await conn.execute(DATA_QUALITY_SQL);

  if (asJson) {
    console.log(JSON.stringify({ totals, diverging: rows, dataQuality: quality }, null, 2));
  } else {
    console.log("");
    console.log("=".repeat(100));
    console.log("BELEGE MIT ABWEICHENDER MONATSZUORDNUNG (A: date [alt, ADR 0001]  ->  B: checkOut ?? date [AKTIV, ADR 0002])");
    console.log("=".repeat(100));

    if (rows.length === 0) {
      console.log("\nKeine abweichenden Belege gefunden — beide Varianten liefern identische Monatszuordnungen.\n");
    } else {
      for (const r of rows) {
        const exclusive = r.costModel === "exclusive";
        console.log("");
        console.log(`Beleg #${r.id}  [${r.category}]  ${formatAmount(r.amount, r.currency)}`);
        console.log(`  Belegdatum (date): ${r.belegDatum}   Check-in: ${r.checkIn ?? "-"}   Check-out: ${r.checkOut ?? "-"}`);
        console.log(`  Variante A (alt): ${r.monatVarianteA}     ->  Variante B (aktiv): ${r.monatVarianteB}`);
        console.log(`  Kunde/Projekt: ${r.projectName ?? "(nicht zugeordnet)"} | costModel: ${r.costModel ?? "-"}` +
                    `${exclusive ? "  <== ABRECHENBAR, wirkt auf Kundenrechnung" : ""}`);
        if (r.comment) console.log(`  Kommentar: ${r.comment}`);
      }

      // Betragsmaessige Auswirkung je Monat und Waehrung: was wandert wohin.
      console.log("");
      console.log("-".repeat(100));
      console.log("AUSWIRKUNG JE MONAT DES UMSTIEGS AUF ADR 0002 (nur abrechenbare exclusive-Belege — diese veraendern Kundenrechnungen)");
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

    // Datenqualitaet: Belege, bei denen die Zuordnung nach ADR 0002 gar nicht
    // greifen KANN, weil das Enddatum fehlt oder gleich dem Startdatum ist.
    console.log("");
    console.log("-".repeat(100));
    console.log("DATENQUALITAET ENDDATUM (Hotels + Rundfluege — Voraussetzung dafuer, dass ADR 0002 greift)");
    console.log("-".repeat(100));
    if (quality.length === 0) {
      console.log("\nAlle Hotels und Rundfluege tragen ein verwertbares Enddatum — keine stillen Fehlzuordnungen moeglich.\n");
    } else {
      console.log("");
      for (const q of quality) {
        const exclusive = q.costModel === "exclusive";
        console.log(`Beleg #${q.id}  [${q.category}${q.flightRouteType ? `/${q.flightRouteType}` : ""}]  ${formatAmount(q.amount, q.currency)}`);
        console.log(`  date: ${q.belegDatum}   Check-in: ${q.checkIn ?? "-"}   Check-out: ${q.checkOut ?? "-"}`);
        console.log(`  Befund: ${q.befund}${exclusive ? "   <== ABRECHENBAR, geldwirksam" : ""}`);
        console.log(`  Kunde/Projekt: ${q.projectName ?? "(nicht zugeordnet)"}`);
        if (q.comment) console.log(`  Kommentar: ${q.comment}`);
        console.log("");
      }
      console.log(`${quality.length} Beleg(e) mit fehlendem/verdaechtigem Enddatum — pruefen, ob das Enddatum`);
      console.log("nachgetragen werden muss (v2.5.5 fixt nur kuenftige Erfassungen, nicht den Bestand).");
    }

    console.log("");
    console.log("-".repeat(100));
    console.log(`Bestand gesamt: ${totals.gesamt} Belege | davon mit Check-out: ${totals.mitCheckOut} | Hotels: ${totals.hotels}`);
    console.log(`Abweichend (Monatsverschiebung): ${rows.length} | Enddatum fehlend/verdaechtig: ${quality.length}`);
    console.log("-".repeat(100));
    console.log("");
  }
} finally {
  await conn.end();
}
