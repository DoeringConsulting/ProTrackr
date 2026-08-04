// =============================================================================
// server/expenseRules.ts
// =============================================================================
// Fachregeln für die DATUMSFELDER eines Reisekostenbelegs — bewusst als eigenes,
// abhängigkeitsarmes Modul.
//
// WARUM getrennt von `routers.ts`: Diese Regeln entscheiden mit über die
// Monatszuordnung (ADR 0002) und gehören deshalb in das schnelle
// pre-commit-Gate (`server/expensePeriodAttribution.test.ts`). Läge die Funktion
// weiter in `routers.ts`, zöge der Test den kompletten Router-Graph inklusive
// `bcrypt` (Native-Binding) nach — der schnellste Gate-Test bräche dann bei jedem
// Node-Version-Drift im Build-Image, ohne dass sich an der Fachlogik etwas geändert
// hat. Hier hängt nichts an DB, Session oder nativen Modulen.

import { TRPCError } from "@trpc/server";

const hhmmTimeSchema = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Datumswert in ein vergleichbares `Date` überführen (lokale Mitternacht).
 *
 * Akzeptiert `YYYY-MM-DD` (HTML-Date-Input), `DD.MM.YYYY` (lokalisierte Controls) und
 * als letzten Ausweg alles, was `new Date()` parst. Leerer/unparsebarer Wert → `null`;
 * die Aufrufer behandeln `null` durchgängig als „nicht gesetzt" und prüfen dann nicht.
 * Genau das macht das explizite Leeren eines Datumsfelds (`""`) beim Kategoriewechsel
 * unschädlich.
 *
 * Vergleiche laufen zwischen zwei Werten DERSELBEN Zeitzone (lokale Mitternacht),
 * die Ordnung ist damit zeitzonenunabhängig korrekt — kein `toISOString` (K8).
 */
export function toComparableDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
    const [dd, mm, yyyy] = trimmed.split(".");
    const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export type ExpenseDateRuleInput = {
  category?: string;
  date?: string;
  checkInDate?: string;
  checkOutDate?: string;
  departureTime?: string;
  arrivalTime?: string;
  flightRouteType?: string;
};

/**
 * Datums- und Zeitregeln für Reisekosten-Belege beim Anlegen und Ändern.
 *
 * Zwei Ebenen:
 *  1. kategorienspezifisch für `flight`/`hotel` — Pflichtfelder, Zeitformate und
 *     die präziseren Fehlertexte („Rueckflug…", „Check-out…"),
 *  2. kategorienUNABHÄNGIG am Ende — Leistungsende >= Leistungsbeginn.
 *
 * Die spezifischen Prüfungen laufen bewusst zuerst, damit ihre Meldungen das
 * konkrete Feld benennen; die generische greift für alles Übrige.
 */
export function validateExpenseDateRules(input: ExpenseDateRuleInput) {
  if (input.category === "flight") {
    const routeType = input.flightRouteType ?? "domestic";
    if (routeType !== "domestic" && routeType !== "international") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Ungueltiger Flugtyp. Erlaubt: domestic|international",
      });
    }

    if (!input.date) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Flug erfordert ein Hinflug-Datum",
      });
    }

    if (input.departureTime && !hhmmTimeSchema.test(input.departureTime)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Abflugzeit muss im Format HH:MM angegeben werden",
      });
    }

    if (input.arrivalTime && !hhmmTimeSchema.test(input.arrivalTime)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Ankunftszeit muss im Format HH:MM angegeben werden",
      });
    }

    if (!input.departureTime && !input.arrivalTime) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Bei Fluegen muss mindestens eine Zeit (Abflug oder Ankunft) angegeben werden",
      });
    }

    const outboundDate = toComparableDate(input.date);
    const returnDate = toComparableDate(input.checkOutDate);
    if (outboundDate && returnDate && returnDate.getTime() < outboundDate.getTime()) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Rueckflug-Datum darf nicht vor dem Hinflug-Datum liegen",
      });
    }
  }

  if (input.category === "hotel") {
    if (!input.checkInDate) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Hotel erfordert ein Check-in-Datum",
      });
    }
    const checkIn = toComparableDate(input.checkInDate);
    const checkOut = toComparableDate(input.checkOutDate);
    if (checkIn && checkOut && checkOut.getTime() < checkIn.getTime()) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Check-out darf nicht vor Check-in liegen",
      });
    }
  }

  // Kategorienunabhängige Chronologie: Leistungsende >= Leistungsbeginn.
  //
  // WARUM generisch: `checkOutDate` ist seit ADR 0002 kein Hotel-Feld mehr, sondern das
  // Leistungsende JEDES Belegs und damit allein maßgeblich für die Monatszuordnung
  // (`leistungsende = checkOutDate ?? date`). Solange nur flight/hotel geprüft wurden,
  // war für alle anderen Kategorien — jetzt auch per UI erfassbar (Mietwagen, Zug, ÖPNV,
  // Sonstiges) — ein Enddatum VOR dem Startdatum speicherbar. Der Beleg wäre damit einem
  // Monat vor seinem eigenen Beginn zugeordnet worden und in der Vorprüfung
  // `scripts/analyze-expense-attribution.mjs` als „DEFEKT: Enddatum VOR Startdatum"
  // aufgeschlagen.
  //
  // Startdatum = COALESCE(checkInDate, date) — dieselbe Ableitung wie die Vorprüfung und
  // wie die OBERE Grenze des Ladefilters in `db.getAllExpenses` (dessen untere Grenze
  // nutzt bewusst ein anderes COALESCE, siehe ADR 0002 „Invariante").
  const serviceStart = toComparableDate(input.checkInDate) ?? toComparableDate(input.date);
  const serviceEnd = toComparableDate(input.checkOutDate);
  if (serviceStart && serviceEnd && serviceEnd.getTime() < serviceStart.getTime()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Enddatum (Leistungsende) darf nicht vor dem Startdatum des Belegs liegen",
    });
  }
}
