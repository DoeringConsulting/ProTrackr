// Kurs-Stichtag-Kappung für Berichte (task_bba37780 Komplex 1).
//
// Reine, TZ-sichere Datums-Key-Arithmetik (YYYY-MM-DD), von Client UND Server
// genutzt — eine Wahrheitsquelle, damit beide Seiten nicht auseinanderdriften.
// Bewusst KEIN toISOString auf lokalen Datumsobjekten (Europe/Warsaw-Off-by-one),
// sondern reine UTC-Komponenten-Arithmetik auf bereits lokal gebildeten Keys.

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
