// =============================================================================
// shared/flightDirection.ts
// =============================================================================
// Die KANONISCHE Ableitungsregel für die Hin-/Rückflug-Kennzeichnung (Befund B3).
// Fachliche Herleitung, Abwägungen und Abgrenzung stehen in
// `docs/KONZEPT-flugrichtung.md` v1.2.0 — hier steht nur die Mechanik.
//
// WARUM in `shared/`: Die Regel wird in DREI Aufrufern ausgewertet — Erfassungsmaske
// (`client/src/pages/TimeTracking.tsx`), KI-Extraktion (`server/receiptAi.ts`) und
// CSV-Import (`client/src/lib/expenseImportV1.ts`). Jede zweite Formulierung wäre die
// nächste Driftquelle (K4), analog zu `shared/expenseServiceEnd.ts`.
//
// WICHTIG — der Vorschlag ist ein Vorschlag, kein berechneter Wert. `flightDirection`
// wird gespeichert und ist überschreibbar; diese Funktion belegt nur vor. Ändert sich
// die Regel später, bleiben bereits geprüfte Belege stabil.

export type FlightDirection = "outbound" | "return";

/**
 * HEIMATflughäfen — ausschließlich Katowice und Krakau.
 *
 * ⚠️ NICHT um weitere polnische Flughäfen ergänzen. Das war der Fehler des ersten
 * Konzeptentwurfs: Ein Flug nach Warschau ist weit eher ein KUNDENEINSATZ als eine
 * Heimreise. Zählte WAW als Heimat, schlüge die Automatik dort "Rückflug" vor — bei
 * einem Feld mit Abrechnungsbezug ist ein oft falscher Vorschlag schlechter als keiner.
 * Entscheidung des Account-Inhabers vom 2026-08-05.
 */
export const HOME_AIRPORTS = ["KTW", "KRK"] as const;

/**
 * Polnische Verkehrsflughäfen, die KEINE Heimatflughäfen sind.
 *
 * Diese Liste wertet nichts — sie dient allein dazu, Fall 3 der Regel zu erkennen und
 * gezielt NACHZUFRAGEN statt still zu raten (K1). Genau das war die Anforderung:
 * "wenn ein anderer Flughafen genannt wird, nachfragen".
 *
 * Die Liste darf wachsen (neue Verkehrsflughäfen), ohne dass sich die Regel ändert —
 * ein unbekannter polnischer Flughafen fällt lediglich in den stillen Fall 4.
 */
export const OTHER_POLISH_AIRPORTS = [
  "WAW", // Warschau Chopin
  "WMI", // Warschau Modlin
  "WRO", // Breslau
  "POZ", // Posen
  "GDN", // Danzig
  "RZE", // Rzeszów
  "LCJ", // Łódź
  "SZZ", // Stettin
  "BZG", // Bromberg
  "IEG", // Zielona Góra
  "LUZ", // Lublin
  "RDO", // Radom
] as const;

const HOME_AIRPORT_SET: ReadonlySet<string> = new Set<string>(HOME_AIRPORTS);
const OTHER_POLISH_AIRPORT_SET: ReadonlySet<string> = new Set<string>(OTHER_POLISH_AIRPORTS);

export type FlightDirectionSuggestion = {
  /** `null`, wo die Codes keine sichere Antwort hergeben — bewusst kein Rateversuch (K1). */
  direction: FlightDirection | null;
  /** Rückfrage an den Nutzer; `null`, wenn es nichts zu klären gibt. */
  hint: string | null;
};

/**
 * IATA-Code auf die Speicherform bringen: getrimmt, Großbuchstaben, exakt drei Buchstaben.
 * Alles andere (leer, Ziffern, falsche Länge) ergibt `null` — Server, Maske und Import
 * benutzen dieselbe Normalisierung, damit dieselbe Eingabe überall denselben Wert erzeugt.
 */
export function normalizeAirportCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

export function isHomeAirport(code: unknown): boolean {
  const normalized = normalizeAirportCode(code);
  return normalized !== null && HOME_AIRPORT_SET.has(normalized);
}

export function isPolishAirport(code: unknown): boolean {
  const normalized = normalizeAirportCode(code);
  return normalized !== null && (HOME_AIRPORT_SET.has(normalized) || OTHER_POLISH_AIRPORT_SET.has(normalized));
}

function polishNonHomeHint(code: string): string {
  return `${code} ist ein polnischer Flughafen, aber kein hinterlegter Heimatflughafen — Richtung bitte prüfen.`;
}

/**
 * Richtungsvorschlag aus Start- und Zielflughafen.
 *
 *   0. BEIDE sind Heimatflughäfen (auch Start == Ziel) → kein Vorschlag + Rückfrage
 *   1. Ziel  ist Heimatflughafen (KTW/KRK) → "return"
 *   2. Start ist Heimatflughafen (KTW/KRK) → "outbound"
 *   3. anderer polnischer Flughafen beteiligt → kein Vorschlag + Rückfrage
 *   4. sonst (Drittland → Drittland, Umstieg) → kein Vorschlag, keine Rückfrage
 *
 * Beide Codes müssen vorhanden sein. Aus einem einzelnen Code lässt sich nichts
 * ableiten: Bei bekanntem Start "KTW" hinge das Ergebnis noch daran, ob das Ziel
 * "KRK" ist (mehrdeutig) oder ein Auslandsziel (outbound).
 *
 * Der WOCHENTAG geht bewusst NICHT ein. Er ist laut Fachregel ein Indiz ("typisch
 * Mo/Di"), kein Kriterium — bei Rückreisen am Montag und Hinreisen am Mittwoch läge
 * er systematisch daneben.
 */
export function suggestFlightDirection(
  departureAirport: unknown,
  arrivalAirport: unknown
): FlightDirectionSuggestion {
  const from = normalizeAirportCode(departureAirport);
  const to = normalizeAirportCode(arrivalAirport);

  if (from === null || to === null) {
    return { direction: null, hint: null };
  }

  const fromIsHome = HOME_AIRPORT_SET.has(from);
  const toIsHome = HOME_AIRPORT_SET.has(to);

  // Heimat → Heimat (auch Start == Ziel): Beide Regeln griffen zugleich und
  // widersprächen sich. Kein Vorschlag, sondern nachfragen — dieselbe Haltung wie
  // in Fall 3, nur aus umgekehrtem Grund.
  if (fromIsHome && toIsHome) {
    return {
      direction: null,
      hint: `${from} und ${to} sind beide Heimatflughäfen — Richtung bitte selbst festlegen.`,
    };
  }

  if (toIsHome) return { direction: "return", hint: null };
  if (fromIsHome) return { direction: "outbound", hint: null };

  // Ab hier ist KEIN Heimatflughafen beteiligt. Ein polnischer Flughafen im Spiel ist
  // der Fall, der eine menschliche Entscheidung braucht: Warschau kann Kundeneinsatz
  // (outbound) oder Zwischenstation sein — die Codes sagen es nicht.
  if (OTHER_POLISH_AIRPORT_SET.has(to)) return { direction: null, hint: polishNonHomeHint(to) };
  if (OTHER_POLISH_AIRPORT_SET.has(from)) return { direction: null, hint: polishNonHomeHint(from) };

  return { direction: null, hint: null };
}

/**
 * Persistierbarer Wert für `expenses.flightDirection` aus beliebigem Input
 * (Formularfeld, CSV-Zelle, LLM-Antwort). Alles Unbekannte wird `null`, nie geraten.
 */
export function normalizeFlightDirection(value: unknown): FlightDirection | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized === "outbound" || normalized === "return" ? normalized : null;
}
