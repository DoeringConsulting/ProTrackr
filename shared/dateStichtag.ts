// Kurs-Stichtag-Kappung für Berichte (task_bba37780 Komplex 1) und TZ-sichere
// Datums-Key-Arithmetik.
//
// TZ-sichere Datums-Key-Helfer (YYYY-MM-DD), von Client UND Server genutzt — eine
// Wahrheitsquelle, damit beide Seiten nicht auseinanderdriften.
// "Heute/gestern" wird IMMER in Europe/Warsaw bestimmt (verbindliche Projekt-
// Zeitzone, CLAUDE.md §4), nie über toISOString (das liefert UTC und kippt im
// Fenster 00:00–02:00 Warschau auf den Vortag).

/**
 * YYYY-MM-DD-Key plus/minus N Kalendertage (monats-/jahresübergreifend).
 *
 * Rechnet bewusst in UTC-Komponenten (`Date.UTC` + `getUTC*`): ein Datums-Key trägt
 * keine Uhrzeit, die Arithmetik ist damit zeitzonenfrei. Ein lokal konstruiertes Date
 * mit anschließendem `toISOString().slice(0,10)` würde dagegen in Europe/Warsaw
 * (UTC+1/+2) auf den Vortag kippen (K8).
 */
export function addDaysToDateKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Kalendarischer Vortag zu einem YYYY-MM-DD-Key (monats-/jahresübergreifend). */
export function previousDayKey(dayKey: string): string {
  return addDaysToDateKey(dayKey, -1);
}

/**
 * Ganze Kalendertage zwischen zwei YYYY-MM-DD-Keys (`toKey - fromKey`), vorzeichenbehaftet.
 *
 * Gegenstück zu `addDaysToDateKey`: `addDaysToDateKey(a, daysBetweenDateKeys(a, b)) === b`.
 * Rechnet aus demselben Grund in UTC-Komponenten — über lokale Dates wäre die Differenz an
 * einem Sommerzeit-Wechsel um eine Stunde daneben und würde beim Runden auf Tage kippen (K8).
 */
export function daysBetweenDateKeys(fromKey: string, toKey: string): number {
  const toUtcMillis = (dayKey: string): number => {
    const [y, m, d] = dayKey.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtcMillis(toKey) - toUtcMillis(fromKey)) / 86_400_000);
}

/**
 * Lokaler Datums-Key (YYYY-MM-DD) aus einem beliebigen Datumswert (Date, `YYYY-MM-DD`,
 * MySQL-Timestamp-String `YYYY-MM-DD HH:MM:SS`, …). `null` bei leer/unparsebar.
 *
 * Nutzt bewusst die LOKALEN Datumskomponenten (nicht toISOString), damit Warschau-
 * Mitternacht nicht auf den Vortag kippt (Fehler #1, K8).
 *
 * WARUM hier und nicht im Client-Verzeichnis: Die Zeitraum-Zuordnung von Belegen
 * (`expenseServiceEndKey`, ADR 0002) wird auf BEIDEN Seiten ausgewertet — im Bericht
 * (Client) und beim Kopieren/Löschen (Server). Läge die Key-Ableitung nur im Client,
 * müsste der Server sie nachbauen; genau diese zweite Fassung wäre die Driftquelle.
 * `client/src/lib/expenseAttribution.ts` re-exportiert sie unverändert weiter, damit
 * bestehende Client-Importe unberührt bleiben.
 */
export function toDateKey(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Kappt den Kurs-Stichtag auf min(jüngstes Leistungs-/Kostendatum, gestern).
 *
 * Begründung (Polish-VAT §9): anzuwenden ist der Kurs des letzten Werktags VOR
 * dem Rechnungs-/Berichtsdatum (heute). Für Kurse gibt es keine Zukunft — liegt
 * das jüngste Leistungs-/Kostendatum in der Zukunft (laufender Monat / Vorab-
 * erfasste Termine), würde der NBP-Call sonst auf ein Zukunftsdatum laufen
 * (404-Kaskade → stale Notfall-Kurs). Der NBP-404-Fallback (bis 7 Tage rückwärts)
 * fängt Wochenende/Feiertag ab, sodass "gestern" zum letzten Werktag wird.
 *
 * Ist das jüngste Datum bereits ≤ gestern (Vergangenheits-Bericht), bleibt es
 * unverändert — bestehende Berichte rechnen byte-identisch weiter.
 */
export function capRateStichtagKey(youngestKey: string, todayKey: string): string {
  const yesterday = previousDayKey(todayKey);
  return youngestKey < yesterday ? youngestKey : yesterday;
}

/**
 * Kalender-Datumskey (YYYY-MM-DD) eines Zeitpunkts in Europe/Warsaw. Bewusst über
 * Intl (IANA-Zeitzone inkl. Sommer-/Winterzeit), NICHT über toISOString: letzteres
 * liefert das UTC-Datum und kippt im Fenster 00:00–02:00 Warschau (UTC+1/+2) auf den
 * Vortag → falscher Kurs-Stichtag (task_bba37780 TZ-Nachbesserung). Default = jetzt.
 */
export function warsawDateKey(instant: Date = new Date()): string {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError("warsawDateKey: ungültiges Date");
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
