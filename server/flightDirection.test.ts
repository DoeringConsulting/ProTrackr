import { describe, it, expect } from "vitest";
import {
  HOME_AIRPORTS,
  OTHER_POLISH_AIRPORTS,
  isHomeAirport,
  isPolishAirport,
  normalizeAirportCode,
  normalizeFlightDirection,
  suggestFlightDirection,
} from "@shared/flightDirection";
import { resolveImportFlightFields } from "@/lib/expenseImportV1";

/**
 * Ableitungsregel für die Hin-/Rückflug-Kennzeichnung (Befund B3,
 * docs/KONZEPT-flugrichtung.md v1.2.0).
 *
 * Der Kern dieser Suite ist NEGATIV: Sie pinnt fest, wo die Regel bewusst KEINEN
 * Vorschlag macht. Ein oft falscher Vorschlag ist bei einem Feld mit Abrechnungsbezug
 * schlechter als gar keiner (K1) — und genau dieser Teil geht beim Umbauen als Erstes
 * verloren, weil "da könnte man doch noch was raten" immer verlockend aussieht.
 */

describe("normalizeAirportCode", () => {
  it.each([
    ["ktw", "KTW", "Kleinschreibung"],
    ["  MUC  ", "MUC", "Leerzeichen"],
    ["KtW", "KTW", "gemischt"],
  ])("%s → %s (%s)", (input, expected) => {
    expect(normalizeAirportCode(input)).toBe(expected);
  });

  it.each([
    ["", "leer"],
    ["MU", "zu kurz"],
    ["MUCH", "zu lang"],
    ["M1C", "Ziffer"],
    ["M-C", "Sonderzeichen"],
    [null, "null"],
    [undefined, "undefined"],
    [123, "Zahl"],
  ])("%s → null (%s)", (input) => {
    expect(normalizeAirportCode(input)).toBeNull();
  });
});

describe("Flughafen-Konstanten", () => {
  it("führt AUSSCHLIESSLICH KTW und KRK als Heimatflughäfen", () => {
    // Bewusst als exakte Gleichheit gepinnt, nicht als "enthält": Die Erweiterung um
    // WAW & Co. war der Fehler des ersten Konzeptentwurfs (ein Flug nach Warschau ist
    // ein Kundeneinsatz, keine Heimreise). Dieser Test wird rot, wenn jemand die Liste
    // "vervollständigt" — und das soll er.
    expect([...HOME_AIRPORTS]).toEqual(["KTW", "KRK"]);
  });

  it("zählt keinen Heimatflughafen zur Nicht-Heimat-Liste", () => {
    for (const home of HOME_AIRPORTS) {
      expect(OTHER_POLISH_AIRPORTS as readonly string[]).not.toContain(home);
    }
  });

  it.each(["WAW", "GDN", "POZ", "WRO"])("%s ist polnisch, aber KEIN Heimatflughafen", (code) => {
    expect(isPolishAirport(code)).toBe(true);
    expect(isHomeAirport(code)).toBe(false);
  });

  it.each(["KTW", "KRK", "ktw"])("%s ist Heimatflughafen", (code) => {
    expect(isHomeAirport(code)).toBe(true);
    expect(isPolishAirport(code)).toBe(true);
  });

  it.each(["MUC", "FRA", "ZRH", ""])("%s ist kein polnischer Flughafen", (code) => {
    expect(isPolishAirport(code)).toBe(false);
  });
});

describe("suggestFlightDirection — sichere Fälle", () => {
  it.each([
    ["MUC", "KTW", "return", "Ankunft an der Heimatbasis"],
    ["FRA", "KRK", "return", "Ankunft an der zweiten Heimatbasis"],
    ["ZRH", "ktw", "return", "Normalisierung greift auch in der Regel"],
    ["KTW", "MUC", "outbound", "Abflug von der Heimatbasis"],
    ["KRK", "LHR", "outbound", "Abflug von der zweiten Heimatbasis"],
  ])("%s → %s ergibt %s (%s)", (from, to, expected) => {
    expect(suggestFlightDirection(from, to)).toEqual({ direction: expected, hint: null });
  });

  it("schlägt outbound vor, wenn von der Heimat zu einem anderen PL-Flughafen geflogen wird", () => {
    // KTW → WAW ist trotz polnischem Ziel eindeutig: Start ist Heimat. Der WAW-Hinweis
    // gilt nur, wenn GAR KEIN Heimatflughafen beteiligt ist.
    expect(suggestFlightDirection("KTW", "WAW")).toEqual({ direction: "outbound", hint: null });
    expect(suggestFlightDirection("WAW", "KRK")).toEqual({ direction: "return", hint: null });
  });
});

describe("suggestFlightDirection — kein Vorschlag, sondern Rückfrage", () => {
  it.each([
    ["WAW", "MUC"],
    ["MUC", "WAW"],
    ["GDN", "FRA"],
    ["ZRH", "gdn"],
  ])("%s → %s liefert keinen Vorschlag, aber einen Hinweis", (from, to) => {
    const result = suggestFlightDirection(from, to);
    expect(result.direction).toBeNull();
    expect(result.hint).toMatch(/polnischer Flughafen/);
  });

  it("nennt im Hinweis den polnischen Code, nicht den ausländischen", () => {
    expect(suggestFlightDirection("MUC", "WAW").hint).toMatch(/^WAW /);
    expect(suggestFlightDirection("WAW", "MUC").hint).toMatch(/^WAW /);
  });

  it("verweigert den Vorschlag, wenn Start und Ziel beide Heimatflughäfen sind", () => {
    const result = suggestFlightDirection("KTW", "KRK");
    expect(result.direction).toBeNull();
    expect(result.hint).toMatch(/beide Heimatflughäfen/);
  });

  it("verweigert den Vorschlag bei identischem Start und Ziel", () => {
    expect(suggestFlightDirection("KTW", "KTW").direction).toBeNull();
  });
});

describe("suggestFlightDirection — stille Fälle", () => {
  it.each([
    ["MUC", "FRA", "Drittland → Drittland"],
    ["LHR", "JFK", "Umstieg ohne PL-Bezug"],
  ])("%s → %s: kein Vorschlag und kein Hinweis (%s)", (from, to) => {
    expect(suggestFlightDirection(from, to)).toEqual({ direction: null, hint: null });
  });

  it.each([
    ["KTW", "", "Ziel fehlt"],
    ["", "KTW", "Start fehlt"],
    ["KTW", null, "Ziel null"],
    [undefined, undefined, "beide leer"],
    ["KT", "MUC", "Start unvollständig"],
  ])("%s → %s: kein Vorschlag, solange nicht beide Codes stehen (%s)", (from, to) => {
    // Aus einem einzelnen Code folgt nichts: Bei Start "KTW" hinge das Ergebnis noch
    // daran, ob das Ziel "KRK" ist (mehrdeutig) oder ein Auslandsziel (outbound).
    expect(suggestFlightDirection(from, to)).toEqual({ direction: null, hint: null });
  });

  it("zieht den Wochentag nicht heran", () => {
    // Die Fachregel nennt "typisch Mo/Di = Hinflug" als Indiz, nicht als Kriterium.
    // Die Signatur nimmt deshalb gar kein Datum entgegen — dieser Test hält das fest,
    // damit ein späterer Datums-Parameter eine bewusste Entscheidung bleibt.
    expect(suggestFlightDirection.length).toBe(2);
  });
});

describe("resolveImportFlightFields — Rangfolge Datei vs. Vorschlag", () => {
  it("übernimmt den Wert aus der Datei, auch wenn die Strecke etwas anderes nahelegt", () => {
    // MUC → KTW schlüge "return" vor. Steht in der Datei "outbound", gilt die Datei:
    // Der Import darf nichts anderes schreiben, als in der Quelle steht.
    expect(
      resolveImportFlightFields({
        departureAirport: "MUC",
        arrivalAirport: "KTW",
        flightDirection: "outbound",
      })
    ).toEqual({ departureAirport: "MUC", arrivalAirport: "KTW", flightDirection: "outbound" });
  });

  it("leitet nur ab, wenn die Richtungsspalte LEER ist", () => {
    expect(
      resolveImportFlightFields({ departureAirport: "MUC", arrivalAirport: "KTW", flightDirection: "" })
    ).toEqual({ departureAirport: "MUC", arrivalAirport: "KTW", flightDirection: "return" });
  });

  it("ersetzt einen UNGÜLTIGEN Richtungswert nicht durch den Vorschlag", () => {
    // Der gefährlichste Fall: "hinflug" ist ungültig, die Strecke schlüge "return" vor.
    // Würde hier abgeleitet, stünde in der Datenbank das GEGENTEIL dessen, was in der
    // Datei steht — und niemand erführe es. Die Zeile ist als EXP-FLT-006 gemeldet.
    expect(
      resolveImportFlightFields({
        departureAirport: "MUC",
        arrivalAirport: "KTW",
        flightDirection: "hinflug",
      }).flightDirection
    ).toBe("");
  });

  it("liefert leere Codes, wo die Datei nichts Brauchbares enthält", () => {
    expect(
      resolveImportFlightFields({ departureAirport: "Munich", arrivalAirport: "", flightDirection: "" })
    ).toEqual({ departureAirport: "", arrivalAirport: "", flightDirection: "" });
  });

  it("normalisiert die Schreibweise der Codes", () => {
    expect(
      resolveImportFlightFields({ departureAirport: " ktw ", arrivalAirport: "muc", flightDirection: "" })
    ).toEqual({ departureAirport: "KTW", arrivalAirport: "MUC", flightDirection: "outbound" });
  });
});

describe("normalizeFlightDirection", () => {
  it.each([
    ["outbound", "outbound"],
    ["return", "return"],
    ["  RETURN ", "return"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeFlightDirection(input)).toBe(expected);
  });

  it.each([["hinflug"], ["rueckflug"], [""], ["null"], [null], [undefined], [1]])(
    "%s → null (nichts wird geraten)",
    (input) => {
      expect(normalizeFlightDirection(input)).toBeNull();
    }
  );
});
