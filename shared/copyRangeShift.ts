// =============================================================================
// shared/copyRangeShift.ts
// =============================================================================
// Verschiebungsregeln für „Zeitraum kopieren" (Tag / Woche / Monat).
//
// WARUM `shared/`: Der Server SCHREIBT damit die Zieldaten (`copyRangeToNext`,
// `server/routers.ts`), der Kopier-Dialog in `client/src/pages/TimeTracking.tsx` ZEIGT sie
// vorher an („Quelle … / Ziel …"). Zwei Implementierungen hießen: die Vorschau verspricht
// etwas anderes, als der Kopiervorgang anlegt (K4).
//
// Fachregel (Entscheidung des Account-Inhabers, ersetzt die frühere datumsgleiche
// Verschiebung):
//
//   day   → nächster ARBEITSTAG (Mo–Fr). Fr/Sa/So → Montag.
//   week  → unverändert +7 Tage (der Wochentag bleibt dabei ohnehin erhalten).
//   month → das n-te Wochentag-Vorkommen bleibt erhalten: der 3. Montag im Quellmonat wird
//           zum 3. Montag im Zielmonat. Existiert das n-te Vorkommen dort nicht (Quellmonat
//           hat 5 Montage, Zielmonat nur 4), landet der Eintrag auf dem 1. Vorkommen dieses
//           Wochentags im FOLGEMONAT des Zielmonats.
//
// Angewendet wird die Regel bei Zeiteinträgen auf `date` (das einzige Datum, das sie haben)
// und bei Belegen auf das LEISTUNGSENDE (`checkOutDate ?? date`) — dieselbe Größe, nach der
// `selectExpensesForRangeCopy` auswählt. Näheres bei `shiftExpenseDateKeys`.
//
// KEIN Feiertagskalender: Feiertage werden bewusst NICHT übersprungen — einen solchen
// Kalender gibt es im Projekt nicht, und ein halbgepflegter wäre schlechter als keiner.
// Ein Kopiervorgang, der auf einen Feiertag fällt, wird vom Nutzer manuell korrigiert.
//
// Alle Funktionen rechnen auf YYYY-MM-DD-Keys über UTC-Komponenten: ein Datums-Key trägt
// keine Uhrzeit, die Arithmetik ist damit zeitzonenfrei (K8, nie toISOString auf einem
// lokal konstruierten Date).

import { addDaysToDateKey, daysBetweenDateKeys, toDateKey } from "./dateStichtag";
import { expenseServiceEndKey } from "./expenseServiceEnd";

export type CopyScope = "day" | "week" | "month";

/** Montag (1) bis Freitag (5) in der Zählweise von `Date.getUTCDay()` (0 = Sonntag). */
const FIRST_WORKDAY_INDEX = 1;
const LAST_WORKDAY_INDEX = 5;
const DAYS_PER_WEEK = 7;

/** Wochentag-Index (0 = Sonntag … 6 = Samstag) eines YYYY-MM-DD-Keys. */
export function weekdayIndexOfDateKey(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) {
    throw new RangeError(`weekdayIndexOfDateKey: ungültiger Datums-Key "${dayKey}"`);
  }
  return dt.getUTCDay();
}

/** Arbeitstag = Mo–Fr. Ohne Feiertagsbetrachtung (siehe Kopf). */
export function isWorkdayKey(dayKey: string): boolean {
  const weekday = weekdayIndexOfDateKey(dayKey);
  return weekday >= FIRST_WORKDAY_INDEX && weekday <= LAST_WORKDAY_INDEX;
}

/**
 * Nächster Arbeitstag NACH `dayKey` (Fr → Mo, Sa → Mo, So → Mo).
 *
 * Terminiert garantiert: nach höchstens drei Schritten ist ein Mo–Fr erreicht.
 */
export function nextWorkdayKey(dayKey: string): string {
  let candidate = addDaysToDateKey(dayKey, 1);
  for (let step = 0; step < DAYS_PER_WEEK && !isWorkdayKey(candidate); step += 1) {
    candidate = addDaysToDateKey(candidate, 1);
  }
  return candidate;
}

/** Anzahl der Tage im Monat (monthIndex 0-basiert). */
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function dateKeyOf(year: number, monthIndex: number, day: number): string {
  const yyyy = String(year).padStart(4, "0");
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Das `occurrence`-te Vorkommen von `weekday` im Monat, oder `null` wenn der Monat so viele
 * Vorkommen nicht hat (der Fall „5. Montag existiert im Zielmonat nicht").
 */
function nthWeekdayOfMonth(
  year: number,
  monthIndex: number,
  weekday: number,
  occurrence: number
): string | null {
  const firstOfMonth = dateKeyOf(year, monthIndex, 1);
  const offsetToFirstHit = (weekday - weekdayIndexOfDateKey(firstOfMonth) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const day = 1 + offsetToFirstHit + (occurrence - 1) * DAYS_PER_WEEK;
  return day > daysInMonth(year, monthIndex) ? null : dateKeyOf(year, monthIndex, day);
}

/**
 * Monats-Verschiebung unter Erhalt des n-ten Wochentag-Vorkommens.
 *
 * Vorkommen = `Math.ceil(tagImMonat / 7)` — der 1.–7. ist das 1. Vorkommen, der 8.–14. das
 * 2. usw. Das ist bewusst nicht „gleicher Kalendertag": Termine sind an Wochentagen
 * verabredet (jeder 2. Dienstag), nicht an Kalendertagen, und ein datumsgleiches Kopieren
 * warf Einträge regelmäßig aufs Wochenende.
 */
export function shiftMonthKeepingWeekdayOccurrence(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const weekday = weekdayIndexOfDateKey(dayKey);
  const occurrence = Math.ceil(day / DAYS_PER_WEEK);

  // Über Date.UTC konstruiert, damit der Jahreswechsel (Dezember → Januar) mitläuft.
  const target = new Date(Date.UTC(year, month, 1));
  const targetHit = nthWeekdayOfMonth(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    weekday,
    occurrence
  );
  if (targetHit) return targetHit;

  // Überzähliges Vorkommen: 1. Vorkommen desselben Wochentags im Folgemonat des Zielmonats.
  const overflow = new Date(Date.UTC(year, month + 1, 1));
  const overflowHit = nthWeekdayOfMonth(
    overflow.getUTCFullYear(),
    overflow.getUTCMonth(),
    weekday,
    1
  );
  if (overflowHit) return overflowHit;

  // Unerreichbar: das 1. Vorkommen eines Wochentags liegt immer im Bereich 1.–7.
  throw new RangeError(`shiftMonthKeepingWeekdayOccurrence: kein Zieltag für "${dayKey}"`);
}

/** Zieltag eines Quelltags für den gewählten Kopier-Bereich. */
export function shiftDateKeyByScope(dayKey: string, scope: CopyScope): string {
  if (scope === "day") return nextWorkdayKey(dayKey);
  if (scope === "week") return addDaysToDateKey(dayKey, DAYS_PER_WEEK);
  return shiftMonthKeepingWeekdayOccurrence(dayKey);
}

export type ShiftedExpenseDateKeys = {
  date: string;
  checkInDate?: string;
  checkOutDate?: string;
};

/**
 * Zieldaten eines Belegs beim Kopieren: Die Scope-Regel greift am LEISTUNGSENDE
 * (`checkOutDate ?? date`), `date`/`checkInDate` folgen mit demselben TAGESABSTAND.
 *
 * WARUM das Leistungsende als Anker (und nicht `date`): Ausgewählt wird ein Beleg nach
 * seinem Leistungsende (`selectExpensesForRangeCopy`, ADR 0002). Verschöbe man ihn dann an
 * `date`, fielen Auswahl- und Verschiebungsanker bei grenzüberspannenden Belegen
 * auseinander — die KOPIE könnte im QUELLZEITRAUM landen. Beispiel: Mietwagen 25.06.–02.07.
 * gehört (Leistungsende 02.07.) in den Juli; „Juli auf August kopieren" erzeugte am
 * `date`-Anker 23.07.–30.07., also einen neuen Beleg im bereits abgerechneten Juli — bei
 * `costModel: "exclusive"` eine zusätzliche Position in einer fakturierten Periode. Am
 * Leistungsende-Anker wird daraus 30.07.–06.08., Zuordnung August.
 * Konsequenz von ADR 0002: Was die Periode bestimmt, muss auch die Verschiebung bestimmen.
 *
 * FÜR EINTÄGIGE BELEGE ÄNDERT SICH NICHTS: ohne (oder mit leerem) `checkOutDate` ist das
 * Leistungsende gleich `date`, der Anker also derselbe wie zuvor — Taxi, Kraftstoff,
 * Verpflegung, km-Pauschale verhalten sich unverändert.
 *
 * WARUM Offset statt Einzelverschiebung: Unter der Wochentagsregel verschiebt sich jedes
 * Datum um eine ANDERE Anzahl Tage (die Monatsregel springt je nach Wochentag um 28–35
 * Tage). Würde man jedes Feld einzeln verschieben, änderte sich die DAUER — aus 2 Nächten
 * würden 3 — oder die Chronologie bräche (Enddatum vor Startdatum), was
 * `validateExpenseDateRules` inzwischen sogar zurückweist. Über den gemeinsamen Offset
 * bleiben Dauer und Reihenfolge konstruktiv erhalten.
 *
 * NEBENEFFEKT (bewusst): Weil die Arbeitstagsregel am ENDE greift, kann der BEGINN eines
 * mehrtägigen Belegs auf ein Wochenende fallen — Ende Sa→Mo zieht den Beginn auf So. Das
 * betrifft ausschließlich `scope: "day"`; `week` (+7) und `month` (28 oder 35 Tage, immer
 * ein Vielfaches von 7) verschieben alle Felder wochentagstreu. Bewusst hingenommen: Ein
 * Hotel-Check-in am Sonntag ist geschäftsreisetypisch, und beide Enden auf Arbeitstage zu
 * zwingen würde die DAUER brechen — die Zusage oben wiegt schwerer als die Wochentagslage
 * des Beginns.
 *
 * `null`, wenn `date` fehlt oder unparsebar ist — der Aufrufer überspringt den Beleg dann
 * (unverändertes Verhalten). Einzelne unparsebare Nebenfelder werden weggelassen, nicht
 * geraten.
 */
export function shiftExpenseDateKeys(
  expense: { date?: unknown; checkInDate?: unknown; checkOutDate?: unknown },
  scope: CopyScope
): ShiftedExpenseDateKeys | null {
  const sourceDateKey = toDateKey(expense?.date);
  const sourceServiceEndKey = expenseServiceEndKey(expense);
  // `date` ist NOT NULL in der DB; fehlt es trotzdem, wird der Beleg übersprungen statt
  // aus dem Leistungsende ein Startdatum zu erfinden.
  if (!sourceDateKey || !sourceServiceEndKey) return null;

  const targetServiceEndKey = shiftDateKeyByScope(sourceServiceEndKey, scope);
  const shiftDays = daysBetweenDateKeys(sourceServiceEndKey, targetServiceEndKey);

  const shiftRelative = (value: unknown): string | undefined => {
    const key = toDateKey(value);
    return key ? addDaysToDateKey(key, shiftDays) : undefined;
  };

  return {
    date: addDaysToDateKey(sourceDateKey, shiftDays),
    checkInDate: shiftRelative(expense?.checkInDate),
    checkOutDate: shiftRelative(expense?.checkOutDate),
  };
}
