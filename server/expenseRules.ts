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
// hat. Hier hängt nichts an DB, Session oder nativen Modulen — auch der Import aus
// `@shared/expenseServiceEnd` ist ein reines, abhängigkeitsfreies Modul.

import { TRPCError } from "@trpc/server";
import { sql, type SQL, type SQLWrapper } from "drizzle-orm";
import {
  isExpenseServiceEndInRange,
  type ExpenseServiceEndFields,
} from "@shared/expenseServiceEnd";

// Die JS-Seite der Leistungsende-Regel wird hier durchgereicht, damit SQL- und JS-Fassung
// über dieselbe Tür erreichbar sind (und ein Leser beide nebeneinander sieht). Implementiert
// ist sie genau einmal, in `shared/expenseServiceEnd.ts` — Client (Abrechnung) und Server
// (Kopieren) rufen dieselbe Funktion.
//
// Bewusst NUR das Prädikat: `expenseServiceEndKey` (die reine Key-Ableitung) hat seine
// Aufrufer in `shared/` (`isExpenseServiceEndInRange`, `shiftExpenseDateKeys`) und wird von
// dort importiert. Ein zusätzlicher Durchreicher hier wäre ungenutzte Oberfläche —
// ausgerechnet am K4-Angelpunkt eine Einladung, die Regel an zwei Türen zu betreten.
export { isExpenseServiceEndInRange };

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

/**
 * Das LEISTUNGSENDE eines Belegs als SQL-Ausdruck: `COALESCE(checkOutDate, date)`.
 *
 * Die EINZIGE produktive Formulierung dieser Regel auf der SQL-Seite. Sie liegt hier
 * und nicht in `routers.ts`, damit das pre-commit-Gate sie rendern und den erzeugten
 * SQL-String assertieren kann — ohne den Router-Graph (und damit `bcrypt`) zu importieren.
 * Aus `drizzle-orm` kommt nur der reine SQL-Builder, kein Treiber, kein nativer Code;
 * das Modul bleibt damit so abhängigkeitsarm wie zuvor.
 *
 * Fachlich deckungsgleich zur kanonischen JS-Regel `leistungsende = checkOutDate ?? date`
 * (`isExpenseInPeriod`, `client/src/lib/monthlyFinancials.ts`, ADR 0002). Zwei Laufzeiten
 * (MySQL und JS) lassen sich nicht auf eine Implementierung reduzieren; die Gleichheit
 * beider Formulierungen ist deshalb in `server/expensePeriodAttribution.test.ts` gepinnt.
 *
 * Die Spalten kommen als Parameter herein, damit dieses Modul das Drizzle-Schema nicht
 * importieren muss.
 */
export function expenseServiceEndDateSql(columns: {
  checkOutDate: SQLWrapper;
  date: SQLWrapper;
}): SQL {
  return sql`COALESCE(${columns.checkOutDate}, ${columns.date})`;
}

/**
 * Welche der geladenen Belege darf „Zeitraum kopieren" (`copyRangeToNext`) tatsächlich
 * kopieren?
 *
 * DAS PROBLEM: `db.getAllExpenses(userId, start, end)` filtert per OVERLAP
 * (`COALESCE(checkOutDate, checkInDate, date) >= start AND COALESCE(checkInDate, date) <= end`).
 * Als LADE-Filter ist das richtig — ein Bericht muss jeden Beleg sehen, der den Zeitraum
 * berührt, und entscheidet die Zuordnung danach selbst über das Leistungsende. Als
 * SELEKTIONSMENGE EINER SCHREIBOPERATION ist es falsch: Ein Beleg, der eine Bereichsgrenze
 * überspannt (Hotel 30.06.–02.07.), wird von MEHREREN Kopierläufen erfasst. „Juni kopieren"
 * und danach „Juli kopieren" legen dann DASSELBE Duplikat an, bei `scope: "day"` sogar drei
 * Kopien. Bei `costModel: "exclusive"` steht der Beleg damit doppelt in der Kundenrechnung
 * UND in der Steuerbasis.
 *
 * DIE REGEL: Kopiert wird, was nach ADR 0002 in den Quellzeitraum GEHÖRT — Leistungsende
 * (`checkOutDate ?? date`) innerhalb `[rangeStart, rangeEnd]`. Dieselbe Zuordnung wie
 * Abrechnung und Purge, also greift auch deren Invariante: über eine lückenlose
 * Zeitraumfolge trifft sie jeden Beleg GENAU EINMAL.
 *
 * AUSNAHME — verknüpfte Belege (`timeEntryId` gesetzt) bleiben ungefiltert: Sie folgen
 * ihrem Zeiteintrag, nicht dem Zeitraum. `copyRangeToNext` kopiert sie ausschließlich, wenn
 * der Eltern-Zeiteintrag im selben Lauf kopiert wurde (`entryIdMap`), sonst zählt es sie als
 * `skippedExpenses`. Da `db.getTimeEntries` exakt auf `timeEntries.date` filtert, wird ein
 * Zeiteintrag von genau einem Lauf erfasst — verknüpfte Belege können also gar nicht
 * doppeln. Sie zusätzlich nach dem Leistungsende zu filtern, würde nichts verhindern, aber
 * den Hotelbeleg zum Zeiteintrag vom 30.06. aus BEIDEN Läufen werfen (Juni: Leistungsende
 * liegt im Juli; Juli: Eltern-Eintrag fehlt) — er wäre nie wieder kopierbar.
 */
export function selectExpensesForRangeCopy<
  T extends ExpenseServiceEndFields & { timeEntryId?: unknown }
>(loadedExpenses: readonly T[], rangeStart: string, rangeEnd: string): T[] {
  return loadedExpenses.filter((expense) => {
    if (isLinkedExpense(expense?.timeEntryId)) return true;
    return isExpenseServiceEndInRange(expense, rangeStart, rangeEnd);
  });
}

/**
 * Hängt dieser Beleg an einem Zeiteintrag?
 *
 * Gilt für Beleg-Objekte aus `db.getAllExpenses`: `timeEntryId == null` spiegelt exakt die
 * SQL-Bedingung seines Standalone-Zweigs (`IS NULL`). Bewusst `== null` und KEIN
 * truthy-Check — eine `0` ist zwar falsy, käme aber aus dem verknüpften Zweig (innerJoin
 * auf `timeEntries.id`); ihr `customerId` stammt dann vom Zeiteintrag. Bei Autoincrement-PKs
 * (≥ 1) ist der Fall praktisch unerreichbar, aber die Lesart einmal festzuhalten kostet
 * nichts und hält die Aufrufer davon ab, auseinanderzulaufen.
 *
 * NICHT für Request-Eingaben verwenden (z. B. `targetTimeEntryId` der KI-Freigabe): dort
 * gilt die truthy-Lesart, weil sie komplementär zu dem Zweig sein muss, der `timeEntryId`
 * tatsächlich in den Payload schreibt. Siehe `explicitCustomerIdForApproval`.
 */
export function isLinkedExpense(timeEntryId: unknown): boolean {
  return timeEntryId !== null && timeEntryId !== undefined;
}

/**
 * Rohwert → `int`-FK oder `null`. Die Spalte `expenses.customerId` ist ein int-FK; ein
 * nicht-numerischer Wert wäre ein Datenfehler und wird fallengelassen, statt ihn in ein
 * INSERT zu tragen. Numerische Strings (JSON-Restore) bleiben gültig.
 *
 * `> 0` ist nicht kosmetisch: die Zugriffsprüfungen der Aufrufer stehen in truthy-Zweigen
 * (`else if (targetCustomerId)`), eine `0` liefe also am Guard VORBEI und landete ungeprüft
 * im INSERT — wo sie der Fremdschlüssel als roher MySQL-1452 abwiese statt als sauberes
 * 400/403. Kein Sicherheitsloch (einen Kunden mit `id = 0` gibt es nicht), aber Guard und
 * Schreibpfad sollen dieselbe Menge akzeptieren.
 */
function toCustomerIdOrNull(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * Die EXPLIZITE Kundenzuordnung (`expenses.customerId`) eines geladenen Belegs für die
 * KOPIE — oder `null`, wenn es keine gibt.
 *
 * VORBEDINGUNG: gilt NUR für Beleg-Objekte aus `db.getAllExpenses`. Andere Lader
 * (`getExpenseById`, `getExpensesByTimeEntry`) machen `select().from(expenses)` und liefern
 * die Rohspalte auch für VERKNÜPFTE Belege — für solche Objekte ist die Annahme unten
 * invertiert, und diese Funktion verwürfe eine echte Zuordnung. Die Signatur nimmt sie
 * klaglos an; der Name grenzt den Einsatz ein.
 *
 * DAS PROBLEM: `db.getAllExpenses` liefert das Feld `customerId` aus ZWEI verschiedenen
 * Quellen, unter demselben Namen:
 *   - verknüpfter Zweig (`innerJoin timeEntries`): `customerId: timeEntries.customerId`
 *     — der Kunde des ELTERN-ZEITEINTRAGS, keine Belegzuordnung.
 *   - Standalone-Zweig (`expenses.timeEntryId IS NULL`): `customerId: expenses.customerId`
 *     — die echte explizite Zuordnung (Spalte seit Migration 0024).
 *
 * Beim Kopieren darf deshalb NUR der zweite Fall übernommen werden. Übernähme man auch den
 * ersten, stünde der Zeiteintrags-Kunde anschließend als EXPLIZITE Zuweisung in
 * `expenses.customerId`; `getExpenseBillingCustomerId`
 * (`client/src/lib/expenseAttribution.ts`) entschiede für die Kopie dann über Zweig (1)
 * „explizite customerId gewinnt immer" statt wie beim Original über den Zeiteintrag. Bei
 * einem späteren Kundenwechsel des Zeiteintrags liefe die Kopie auseinander — geldwirksam
 * bei `costModel: "exclusive"`.
 *
 * Umgekehrt kostet das FEHLEN der Übernahme bei Standalone-Belegen ebenso Geld: ohne
 * `customerId` bleibt nur die Datums-Heuristik „genau ein Kunde mit Zeiteintrag an diesem
 * Tag". An einem Tag mit zwei Kunden — oder ganz ohne Zeiteintrag — fällt die Kopie still
 * aus der Kundenabrechnung.
 *
 * UNTERSCHEIDUNG: `timeEntryId == null` spiegelt exakt die SQL-Bedingung des
 * Standalone-Zweigs (`IS NULL`). Bewusst `== null` und kein truthy-Check: eine `0` ist zwar
 * falsy, kam aber aus dem verknüpften Zweig (innerJoin) — ihr `customerId` stammt dann vom
 * Zeiteintrag und darf nicht übernommen werden. Gleiche Lesart wie in
 * `selectExpensesForRangeCopy`.
 */
export function explicitCustomerIdForRangeCopy(expense: {
  timeEntryId?: unknown;
  customerId?: unknown;
}): number | null {
  if (isLinkedExpense(expense?.timeEntryId)) return null;
  return toCustomerIdOrNull(expense?.customerId);
}

/**
 * Die EXPLIZITE Kundenzuordnung für einen per KI freigegebenen Beleg — oder `null`.
 *
 * Beide Freigabepfade (`receiptAi.approveBatch`, `receiptAi.approve`) lösen einen
 * Ziel-Kunden auf und prüfen sogar den Zugriff darauf, schrieben ihn bis v2.7.4 aber NICHT
 * in den Beleg: `toExpenseMutationPayload` (`server/receiptAi.ts`) kennt `customerId` gar
 * nicht. Ein per KI OHNE Zeiteintrag, aber MIT Kundentreffer freigegebener Beleg landete
 * damit als eigenständige Position mit `customerId = NULL` — derselbe stille Verlust wie
 * beim Kopieren (siehe `explicitCustomerIdForRangeCopy`): zurück auf die Datums-Heuristik,
 * und an einem Tag mit zwei Kunden fällt der Beleg aus der Kundenabrechnung.
 *
 * WARUM HIER TRUTHY statt `isLinkedExpense`: `targetTimeEntryId` ist eine Request-Eingabe,
 * kein Wert aus dem innerJoin-Zweig. Maßgeblich ist, dass diese Bedingung KOMPLEMENTÄR zu
 * dem Zweig ist, der `timeEntryId` tatsächlich in den Payload schreibt (`if
 * (targetTimeEntryId)`) — sonst entstünde ein Beleg, der verknüpft UND explizit zugeordnet
 * ist, oder einer, der beides nicht ist. Innere Konsistenz der Prozedur schlägt hier
 * projektweite Einheitlichkeit der Lesart.
 */
export function explicitCustomerIdForApproval(
  targetTimeEntryId: unknown,
  targetCustomerId: unknown
): number | null {
  if (targetTimeEntryId) return null;
  return toCustomerIdOrNull(targetCustomerId);
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
