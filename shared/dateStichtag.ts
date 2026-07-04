// Kurs-Stichtag-Kappung für Berichte (task_bba37780 Komplex 1).
//
// TZ-sichere Datums-Key-Helfer (YYYY-MM-DD) für den Kurs-Stichtag, von Client UND
// Server genutzt — eine Wahrheitsquelle, damit beide Seiten nicht auseinanderdriften.
// "Heute/gestern" wird IMMER in Europe/Warsaw bestimmt (verbindliche Projekt-
// Zeitzone, CLAUDE.md §4), nie über toISOString (das liefert UTC und kippt im
// Fenster 00:00–02:00 Warschau auf den Vortag).

/** Kalendarischer Vortag zu einem YYYY-MM-DD-Key (monats-/jahresübergreifend). */
export function previousDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
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
