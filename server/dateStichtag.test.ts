import { describe, it, expect } from "vitest";
import {
  capRateStichtagKey,
  isLastDayOfMonth,
  monthLastDay,
  previousDayKey,
  warsawDateKey,
} from "@shared/dateStichtag";

/**
 * Monatslänge und Monatsletzter — Auslöser der Monatsend- und Rechnungsfrist-Benachrichtigung
 * (`server/scheduler.ts`). Lagen bis v2.7.x als maschinenlokale Date-Getter im Scheduler und
 * hingen damit an der Container-Zeitzone; hier liegen sie zeitzonenfrei über `Date.UTC`.
 */
describe("monthLastDay", () => {
  it.each([
    ["2024-02-15", 29, "Schaltjahr"],
    ["2026-02-15", 28, "Nicht-Schaltjahr"],
    ["2000-02-01", 29, "durch 400 teilbar → Schaltjahr"],
    ["1900-02-01", 28, "durch 100, nicht durch 400 → kein Schaltjahr"],
    ["2026-04-10", 30, "30-Tage-Monat"],
    ["2026-01-01", 31, "31-Tage-Monat"],
  ])("%s → %i (%s)", (key, expected) => {
    expect(monthLastDay(key as string)).toBe(expected);
  });

  it("normalisiert den Jahresüberlauf im Dezember", () => {
    // Dezember rechnet intern mit Monat 12 = Januar des FOLGEjahres, Tag 0. Ohne die
    // Date.UTC-Normalisierung käme hier ein Unsinnswert heraus.
    expect(monthLastDay("2026-12-31")).toBe(31);
  });

  it("ist unabhängig von der Tageszahl im Key", () => {
    expect(monthLastDay("2026-02-01")).toBe(monthLastDay("2026-02-28"));
  });
});

describe("isLastDayOfMonth", () => {
  it.each([
    ["2026-12-31", true],
    ["2026-12-30", false],
    ["2024-02-29", true],
    ["2026-02-28", true],
    ["2026-04-30", true],
    ["2026-04-29", false],
  ])("%s → %s", (key, expected) => {
    expect(isLastDayOfMonth(key as string)).toBe(expected);
  });

  it("führende Null in der Tageszahl wird dezimal gelesen, nicht oktal", () => {
    // Regressionsschutz: `Number("08")` ist 8, `parseInt("08", 8)` wäre 0.
    expect(isLastDayOfMonth("2026-04-08")).toBe(false);
  });
});

describe("previousDayKey", () => {
  it("subtrahiert einen Tag innerhalb des Monats", () => {
    expect(previousDayKey("2026-07-03")).toBe("2026-07-02");
  });

  it("überschreitet die Monatsgrenze korrekt", () => {
    expect(previousDayKey("2026-07-01")).toBe("2026-06-30");
  });

  it("überschreitet die Jahresgrenze korrekt", () => {
    expect(previousDayKey("2026-01-01")).toBe("2025-12-31");
  });

  it("behandelt das Nicht-Schaltjahr-Februar-Ende korrekt", () => {
    // 2026 ist kein Schaltjahr → 1. März geht auf 28. Februar zurück.
    expect(previousDayKey("2026-03-01")).toBe("2026-02-28");
  });
});

describe("capRateStichtagKey", () => {
  const today = "2026-07-03"; // gestern = 2026-07-02

  it("lässt ein Vergangenheitsdatum unverändert", () => {
    // Vergangenheits-Bericht (jüngstes Datum < gestern) → kein Cap.
    expect(capRateStichtagKey("2026-06-30", today)).toBe("2026-06-30");
  });

  it("cappt ein Zukunftsdatum auf gestern", () => {
    // Laufender Monat mit Vorab-Termin am 31.7. → Kurs-Stichtag = gestern.
    expect(capRateStichtagKey("2026-07-31", today)).toBe("2026-07-02");
  });

  it("cappt das heutige Datum auf gestern", () => {
    // Jüngstes Datum == heute → gestern (§9: letzter Werktag VOR heute).
    expect(capRateStichtagKey("2026-07-03", today)).toBe("2026-07-02");
  });

  it("lässt exakt gestern unverändert", () => {
    expect(capRateStichtagKey("2026-07-02", today)).toBe("2026-07-02");
  });
});

describe("warsawDateKey", () => {
  it("gibt in der Sommerzeit (CEST, UTC+2) das Warschauer Datum zurück — nicht UTC", () => {
    // 23:30 UTC am 3.7. = 01:30 Warschau am 4.7. → Warschau-Datum ist der 4.7.
    // (toISOString().slice(0,10) läge hier falsch beim 3.7. — genau der Bug.)
    expect(warsawDateKey(new Date("2026-07-03T23:30:00Z"))).toBe("2026-07-04");
  });

  it("stimmt tagsüber mit dem Kalendertag überein", () => {
    expect(warsawDateKey(new Date("2026-07-04T10:00:00Z"))).toBe("2026-07-04");
  });

  it("kippt kurz vor Mitternacht Warschau noch nicht auf morgen", () => {
    // 21:30 UTC am 4.7. = 23:30 Warschau am 4.7. (noch derselbe Tag)
    expect(warsawDateKey(new Date("2026-07-04T21:30:00Z"))).toBe("2026-07-04");
  });

  it("berücksichtigt die Winterzeit (CET, UTC+1)", () => {
    // 23:30 UTC am 15.1. = 00:30 Warschau am 16.1.
    expect(warsawDateKey(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16");
  });
});
