import { describe, it, expect } from "vitest";
import { capRateStichtagKey, previousDayKey } from "@shared/dateStichtag";

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
