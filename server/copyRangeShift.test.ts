import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
// Bewusst aus `@shared/copyRangeShift` und NICHT aus `./routers`: dieser Test steht im
// pre-commit-Gate und muss abhängigkeitsarm bleiben (kein Router-Graph, kein bcrypt).
import {
  isWorkdayKey,
  nextWorkdayKey,
  shiftDateKeyByScope,
  shiftExpenseDateKeys,
  shiftExpenseDateKeysByDays,
  shiftMonthKeepingWeekdayOccurrence,
  weekdayIndexOfDateKey,
} from "@shared/copyRangeShift";
import { addDaysToDateKey, daysBetweenDateKeys } from "@shared/dateStichtag";
import { isExpenseServiceEndInRange } from "@shared/expenseServiceEnd";

/**
 * „Zeitraum kopieren" (`copyRangeToNext`) verschiebt nicht mehr datumsgleich, sondern
 * WOCHENTAGSTREU (Entscheidung des Account-Inhabers):
 *
 *   day   → nächster Arbeitstag (Fr/Sa/So → Mo)
 *   week  → +7 Tage (unverändert)
 *   month → n-tes Wochentag-Vorkommen bleibt erhalten; überzählige Vorkommen haben KEIN Ziel
 *           (seit der Dev-Abnahme 2026-08-05, siehe `shared/copyRangeShift.ts`) — früher:
 *           das 1. Vorkommen im Folgemonat des Zielmonats
 *
 * Kalendarische Anker (verifiziert): Juni 2026 beginnt Mo und hat 5 Montage, Juli 2026
 * beginnt Mi und hat 4 Montage. Genau daran hängen die Erwartungswerte unten — sie sind
 * absichtlich hart notiert und nicht aus der Implementierung abgeleitet.
 */

const WEEKDAY_NAMES = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;
const nameOf = (dayKey: string) => WEEKDAY_NAMES[weekdayIndexOfDateKey(dayKey)];

describe("weekdayIndexOfDateKey", () => {
  it("liefert den Wochentag zeitzonenfrei (0 = Sonntag)", () => {
    expect(nameOf("2026-06-01")).toBe("Mo");
    expect(nameOf("2026-06-05")).toBe("Fr");
    expect(nameOf("2026-06-06")).toBe("Sa");
    expect(nameOf("2026-06-07")).toBe("So");
    expect(nameOf("2026-07-01")).toBe("Mi");
    expect(nameOf("2027-01-01")).toBe("Fr");
  });

  it("stimmt mit einem lokal konstruierten Date überein (Runner-TZ = Europe/Warsaw)", () => {
    // Der Router beschriftet den kopierten Zeiteintrag mit diesem Index; er muss zu dem
    // Datum passen, das tatsächlich gespeichert wird (`new Date(key + "T00:00:00")`).
    for (const key of ["2026-01-01", "2026-03-29", "2026-06-30", "2026-10-25", "2026-12-31"]) {
      const [y, m, d] = key.split("-").map(Number);
      expect(weekdayIndexOfDateKey(key), key).toBe(new Date(y, m - 1, d).getDay());
    }
  });

  it("weist einen unbrauchbaren Key ab, statt still NaN weiterzureichen", () => {
    expect(() => weekdayIndexOfDateKey("kein datum")).toThrow(/ungültiger Datums-Key/);
  });
});

describe("scope 'day': nächster Arbeitstag (kein Feiertagskalender)", () => {
  it("Fr → Mo (nicht Sa) — der Kernfall", () => {
    // Fr 05.06.2026 landete vorher auf Sa 06.06.
    expect(shiftDateKeyByScope("2026-06-05", "day")).toBe("2026-06-08");
    expect(nameOf("2026-06-08")).toBe("Mo");
  });

  it("Sa und So laufen ebenfalls auf den Montag", () => {
    expect(nextWorkdayKey("2026-06-06")).toBe("2026-06-08");
    expect(nextWorkdayKey("2026-06-07")).toBe("2026-06-08");
  });

  it("Mo–Do bleiben beim schlichten Folgetag", () => {
    expect(nextWorkdayKey("2026-06-01")).toBe("2026-06-02");
    expect(nextWorkdayKey("2026-06-04")).toBe("2026-06-05");
  });

  it("das Ergebnis ist IMMER ein Arbeitstag und liegt immer in der Zukunft", () => {
    let key = "2026-05-25";
    for (let i = 0; i < 60; i += 1) {
      const next = nextWorkdayKey(key);
      expect(isWorkdayKey(next), next).toBe(true);
      expect(next > key, `${next} > ${key}`).toBe(true);
      key = next;
    }
  });

  it("über Monats- und Jahresgrenze", () => {
    // Di 30.06.2026 → Mi 01.07.2026
    expect(shiftDateKeyByScope("2026-06-30", "day")).toBe("2026-07-01");
    // Do 31.12.2026 → Fr 01.01.2027
    expect(shiftDateKeyByScope("2026-12-31", "day")).toBe("2027-01-01");
    // Fr 01.01.2027 → Mo 04.01.2027 (Neujahr wird NICHT übersprungen, nur das Wochenende)
    expect(shiftDateKeyByScope("2027-01-01", "day")).toBe("2027-01-04");
  });
});

describe("scope 'week': unverändert +7 Tage", () => {
  it("verschiebt exakt eine Woche und erhält den Wochentag", () => {
    for (const key of ["2026-06-05", "2026-06-06", "2026-06-28", "2026-12-31"]) {
      const shifted = shiftDateKeyByScope(key, "week");
      expect(shifted, key).toBe(addDaysToDateKey(key, 7));
      expect(weekdayIndexOfDateKey(shifted), key).toBe(weekdayIndexOfDateKey(key));
    }
  });

  it("läuft über die Jahresgrenze", () => {
    expect(shiftDateKeyByScope("2026-12-28", "week")).toBe("2027-01-04");
  });
});

describe("scope 'month': n-tes Wochentag-Vorkommen bleibt erhalten", () => {
  it("Mo 01.06. (1. Montag) → Mo 06.07. (1. Montag Juli)", () => {
    expect(shiftDateKeyByScope("2026-06-01", "month")).toBe("2026-07-06");
  });

  it("Fr 05.06. (1. Freitag) → Fr 03.07. (1. Freitag Juli)", () => {
    expect(shiftDateKeyByScope("2026-06-05", "month")).toBe("2026-07-03");
  });

  // GEÄNDERTE FACHREGEL (Dev-Abnahme 2026-08-05): Ein überzähliges Vorkommen bekommt KEIN
  // Ausweichziel mehr im Monat danach — es gibt schlicht kein Ziel. Vorher landete der
  // 5. Montag aus dem Juni im AUGUST, also außerhalb des Zeitraums, den der Nutzer im Dialog
  // bestätigt hatte. Verworfene Alternative: auf das letzte Vorkommen im Zielmonat legen —
  // dann träfen zwei Quelltage auf denselben Zieltag (zwei 8-Stunden-Tage an einem Datum).
  it("Mo 29.06. ist der 5. Montag — Juli hat nur 4 → KEIN Ziel (null)", () => {
    expect(shiftDateKeyByScope("2026-06-29", "month")).toBeNull();
  });

  it("Di 30.06. ist der 5. Dienstag — Juli hat nur 4 → KEIN Ziel (null)", () => {
    expect(shiftDateKeyByScope("2026-06-30", "month")).toBeNull();
  });

  it("mittlere Vorkommen: Mo 15.06. ist der 3. Montag → 3. Montag im Juli (20.07.)", () => {
    expect(nameOf("2026-06-15")).toBe("Mo");
    expect(shiftMonthKeepingWeekdayOccurrence("2026-06-15")).toBe("2026-07-20");
    expect(nameOf("2026-07-20")).toBe("Mo");
  });

  it("Jahresgrenze: Mo 28.12.2026 (4. Montag) → Mo 25.01.2027 (4. Montag)", () => {
    expect(shiftDateKeyByScope("2026-12-28", "month")).toBe("2027-01-25");
  });

  it("Jahresgrenze mit Überlauf: Do 31.12.2026 ist der 5. Donnerstag → KEIN Ziel (null)", () => {
    // Januar 2027 hat nur 4 Donnerstage. Vorher wich die Regel auf den 1. Donnerstag im
    // Februar aus — zwei Monate nach der Quelle.
    expect(shiftDateKeyByScope("2026-12-31", "month")).toBeNull();
  });

  it("DIE ZUSAGE: das Ziel liegt im FOLGEMONAT oder es gibt keines — nie weiter", () => {
    // Vollständige Jahresrunde: jeder Kalendertag 2026. Das ist die eigentliche Zusage der
    // neuen Regel — Einzelanker allein könnten sie nicht tragen.
    const nextMonthOf = (dayKey: string) => {
      const [y, m] = dayKey.split("-").map(Number);
      const d = new Date(Date.UTC(y, m, 1));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    };
    let key = "2026-01-01";
    let withoutTarget = 0;
    while (key <= "2026-12-31") {
      const shifted = shiftMonthKeepingWeekdayOccurrence(key);
      if (shifted === null) {
        // `null` ist AUSSCHLIESSLICH für ein überzähliges (5.) Vorkommen zulässig. Träte es
        // sonst auf, verlöre der Nutzer Einträge ohne fachlichen Grund.
        expect(Math.ceil(Number(key.slice(8, 10)) / 7), `${key} ohne Ziel`).toBe(5);
        withoutTarget += 1;
      } else {
        expect(weekdayIndexOfDateKey(shifted), key).toBe(weekdayIndexOfDateKey(key));
        expect(shifted > key, `${key} → ${shifted}`).toBe(true);
        // Kern der Änderung: der Zielmonat ist IMMER der unmittelbare Folgemonat.
        expect(shifted.slice(0, 7), `${key} → ${shifted}`).toBe(nextMonthOf(key));
        const distance = daysBetweenDateKeys(key, shifted);
        expect(distance, key).toBeGreaterThanOrEqual(28);
        expect(distance, key).toBeLessThanOrEqual(35);
      }
      key = addDaysToDateKey(key, 1);
    }
    // Gegenprobe, damit der Test nicht still zur Tautologie wird, falls die Regel je wieder
    // ein Ausweichziel liefert: den Fall „kein Ziel" gibt es 2026 wirklich.
    expect(withoutTarget).toBeGreaterThan(0);
  });

  it("ein Arbeitstag bleibt ein Arbeitstag (Wochentagstreue impliziert das)", () => {
    for (const key of ["2026-06-01", "2026-06-05", "2026-06-15"]) {
      expect(isWorkdayKey(shiftMonthKeepingWeekdayOccurrence(key)!), key).toBe(true);
    }
    // 29./30.06. sind 5. Vorkommen und haben im Juli kein Ziel mehr — separat gepinnt.
    for (const key of ["2026-06-29", "2026-06-30"]) {
      expect(shiftMonthKeepingWeekdayOccurrence(key), key).toBeNull();
    }
  });
});

/**
 * B1 — Ein Beleg trägt bis zu drei Datumsfelder. Würde jedes einzeln nach der
 * Wochentagsregel verschoben, änderte sich die DAUER (2 Nächte → 3) oder die Chronologie
 * bräche (Enddatum vor Startdatum, von `validateExpenseDateRules` abgelehnt).
 *
 * ANKER ist das LEISTUNGSENDE (`checkOutDate ?? date`) — dieselbe Größe, nach der
 * `selectExpensesForRangeCopy` auswählt. Am `date`-Anker fielen Auswahl und Verschiebung
 * auseinander und die Kopie konnte im QUELLZEITRAUM landen (siehe eigener Block unten).
 */
describe("shiftExpenseDateKeys: Leistungsende nach Regel, übrige Felder mit gleichem Offset", () => {
  const hotelAcrossMonthEnd = {
    date: "2026-06-30 00:00:00",
    checkInDate: "2026-06-30 00:00:00",
    checkOutDate: "2026-07-02 00:00:00",
  };

  it("Hotel mit 2 Nächten über den Monatswechsel behält exakt 2 Nächte", () => {
    const shifted = shiftExpenseDateKeys(hotelAcrossMonthEnd, "month");
    expect(shifted).not.toBeNull();
    if (!shifted) return;
    // Anker ist das Check-out 02.07. (Do, 1. Donnerstag im Juli) → 1. Donnerstag im
    // August = 06.08.; Offset 35 Tage zieht Check-in und `date` auf den 04.08.
    expect(shifted.checkOutDate).toBe("2026-08-06");
    expect(shifted.date).toBe("2026-08-04");
    expect(shifted.checkInDate).toBe("2026-08-04");
    expect(daysBetweenDateKeys(shifted.checkInDate!, shifted.checkOutDate!)).toBe(2);
    expect(shifted.checkOutDate! >= shifted.checkInDate!).toBe(true);
  });

  it("Dauer und Chronologie bleiben in JEDEM Scope erhalten", () => {
    for (const scope of ["day", "week", "month"] as const) {
      const shifted = shiftExpenseDateKeys(hotelAcrossMonthEnd, scope);
      expect(shifted, scope).not.toBeNull();
      if (!shifted) continue;
      expect(daysBetweenDateKeys(shifted.checkInDate!, shifted.checkOutDate!), scope).toBe(2);
      expect(daysBetweenDateKeys(shifted.date, shifted.checkInDate!), scope).toBe(0);
    }
  });

  it("Gegenprobe 'day': einzeln verschoben fielen Start und Ende auf DENSELBEN Montag", () => {
    // Genau das tat die Vorgängerfassung (`tryShiftDateValue` pro Feld): Fr 05.06. und
    // Sa 06.06. laufen beide auf Mo 08.06. — aus 1 Nacht würden 0.
    expect(daysBetweenDateKeys(nextWorkdayKey("2026-06-05"), nextWorkdayKey("2026-06-06"))).toBe(0);
    // Mit gemeinsamem Offset bleibt die Nacht erhalten. Anker ist das Ende (Sa 06.06. →
    // Mo 08.06., Offset 2), der Beginn wandert auf So 07.06. — dass ein mehrtägiger Beleg
    // am Wochenende BEGINNEN darf, ist gewollt; nur das Ende folgt der Arbeitstagsregel.
    const shifted = shiftExpenseDateKeys({ date: "2026-06-05", checkOutDate: "2026-06-06" }, "day");
    expect(shifted?.checkOutDate).toBe("2026-06-08");
    expect(shifted?.date).toBe("2026-06-07");
    expect(daysBetweenDateKeys(shifted!.date, shifted!.checkOutDate!)).toBe(1);
  });

  it("Gegenprobe 'month': unterschiedliche Vorkommen-Indizes reißen die Felder auseinander", () => {
    // Fr 05.06. ist das 1. Vorkommen, Mo 08.06. schon das 2. — einzeln verschoben würden aus
    // 3 Tagen Abstand 10.
    const naiveStart = shiftMonthKeepingWeekdayOccurrence("2026-06-05"); // → Fr 03.07.
    const naiveEnd = shiftMonthKeepingWeekdayOccurrence("2026-06-08"); // → Mo 13.07.
    expect(daysBetweenDateKeys("2026-06-05", "2026-06-08")).toBe(3);
    expect(daysBetweenDateKeys(naiveStart, naiveEnd)).toBe(10);
    // Mit gemeinsamem Offset am Ende (Mo 08.06. → Mo 13.07.) bleiben es 3 Tage.
    const shifted = shiftExpenseDateKeys({ date: "2026-06-05", checkOutDate: "2026-06-08" }, "month");
    expect(shifted?.checkOutDate).toBe("2026-07-13");
    expect(shifted?.date).toBe("2026-07-10");
    expect(daysBetweenDateKeys(shifted!.date, shifted!.checkOutDate!)).toBe(3);
  });

  it("Flug (nur date + checkOutDate, kein checkInDate) behält den Abstand", () => {
    const flight = { date: "2026-06-30", checkOutDate: "2026-07-02" };
    const shifted = shiftExpenseDateKeys(flight, "week");
    expect(shifted?.date).toBe("2026-07-07");
    expect(shifted?.checkInDate).toBeUndefined();
    expect(shifted?.checkOutDate).toBe("2026-07-09");
  });

  it("punktueller Beleg ohne Nebendaten: nur `date` wandert", () => {
    const taxi = { date: "2026-06-05", checkInDate: null, checkOutDate: "" };
    const shifted = shiftExpenseDateKeys(taxi, "day");
    expect(shifted?.date).toBe("2026-06-08"); // Fr → Mo
    expect(shifted?.checkInDate).toBeUndefined();
    expect(shifted?.checkOutDate).toBeUndefined();
  });

  it("ohne verwertbares `date` → null (Aufrufer überspringt den Beleg)", () => {
    expect(shiftExpenseDateKeys({}, "day")).toBeNull();
    expect(shiftExpenseDateKeys({ date: "" }, "day")).toBeNull();
    expect(shiftExpenseDateKeys({ date: "kein datum" }, "month")).toBeNull();
    // Auch mit brauchbarem Leistungsende: aus dem Ende wird KEIN Startdatum erfunden.
    expect(shiftExpenseDateKeys({ date: "kein datum", checkOutDate: "2026-07-02" }, "day")).toBeNull();
  });

  it("unparsebares Nebenfeld wird weggelassen, nicht geraten", () => {
    // Zugleich der Fallback des Ankers: ein unbrauchbares Enddatum fällt auf `date` zurück.
    const shifted = shiftExpenseDateKeys(
      { date: "2026-06-01", checkOutDate: "kein datum" },
      "week"
    );
    expect(shifted?.date).toBe("2026-06-08");
    expect(shifted?.checkOutDate).toBeUndefined();
  });

  it("akzeptiert Date-Objekte (so liefert Drizzle die Spalten je nach Modus)", () => {
    const shifted = shiftExpenseDateKeys(
      { date: new Date(2026, 5, 30), checkOutDate: new Date(2026, 6, 2) },
      "week"
    );
    expect(shifted?.date).toBe("2026-07-07");
    expect(shifted?.checkOutDate).toBe("2026-07-09");
  });
});

/**
 * K1 — Anker der Verschiebung = Anker der AUSWAHL.
 *
 * Ausgewählt wird nach dem Leistungsende (ADR 0002). Verschöbe man dann an `date`, fielen
 * beide Anker bei grenzüberspannenden Belegen auseinander und die KOPIE landete im
 * QUELLZEITRAUM — ein neuer Beleg in einer bereits abgerechneten Periode, bei
 * `costModel: "exclusive"` eine zusätzliche Position auf einer fakturierten Rechnung.
 */
describe("Der Kopie-Anker ist das Leistungsende (nicht `date`)", () => {
  const JULY = { start: "2026-07-01", end: "2026-07-31" };

  it("REFERENZFALL Mietwagen 25.06.–02.07.: Juli-Lauf legt die Kopie im AUGUST an", () => {
    const car = { date: "2026-06-25", checkOutDate: "2026-07-02" };
    // Er gehört in den Juli — das entscheidet die Auswahl.
    expect(isExpenseServiceEndInRange(car, JULY.start, JULY.end)).toBe(true);

    const shifted = shiftExpenseDateKeys(car, "month");
    expect(shifted?.date).toBe("2026-07-30");
    expect(shifted?.checkOutDate).toBe("2026-08-06");
    // Entscheidend: die Kopie fällt NICHT in den Quellmonat zurück.
    expect(
      isExpenseServiceEndInRange(
        { date: shifted!.date, checkOutDate: shifted!.checkOutDate },
        JULY.start,
        JULY.end
      )
    ).toBe(false);
  });

  it("Gegenprobe: am `date`-Anker wäre die Kopie im Juli gelandet", () => {
    // 25.06. ist der 4. Donnerstag im Juni → 4. Donnerstag im Juli = 23.07.; das Enddatum
    // folgte mit demselben Offset (28) auf den 30.07. — Leistungsende also wieder JULI.
    const naiveStart = shiftMonthKeepingWeekdayOccurrence("2026-06-25");
    expect(naiveStart).toBe("2026-07-23");
    const naiveEnd = addDaysToDateKey("2026-07-02", daysBetweenDateKeys("2026-06-25", naiveStart));
    expect(naiveEnd).toBe("2026-07-30");
    expect(
      isExpenseServiceEndInRange({ date: naiveStart, checkOutDate: naiveEnd }, JULY.start, JULY.end)
    ).toBe(true);
  });

  it("INVARIANTE: die Kopie liegt nie im Quellmonat — über 5 Jahre und alle Belegdauern", () => {
    // Die eigentliche Zusage von K1. Am `date`-Anker war sie verletzbar; hier darf es keinen
    // einzigen Treffer geben.
    const monthOf = (dayKey: string) => dayKey.slice(0, 7);
    const violations: string[] = [];
    let key = "2024-01-01";
    while (key <= "2028-12-31") {
      for (const durationDays of [0, 1, 2, 3, 5, 10, 33]) {
        const expense = { date: key, checkOutDate: addDaysToDateKey(key, durationDays) };
        const shifted = shiftExpenseDateKeys(expense, "month");
        // `null` ist seit der Regeländerung ein LEGITIMES Ergebnis: das Leistungsende liegt
        // auf einem überzähligen Wochentag-Vorkommen, der Zielmonat hat dafür keinen Tag.
        // Der Beleg wird dann nicht kopiert — er kann also auch nicht im Quellmonat landen,
        // was diese Invariante gerade zusagt. Kein Verstoß, sondern der Auslassungsfall.
        if (shifted === null) continue;
        if (!shifted.checkOutDate) {
          violations.push(`${key}+${durationDays}: keine Verschiebung`);
          continue;
        }
        if (monthOf(shifted.checkOutDate) <= monthOf(expense.checkOutDate)) {
          violations.push(`${key}+${durationDays} → ${shifted.checkOutDate}`);
        }
        // Dauer bleibt in jedem Fall erhalten.
        if (daysBetweenDateKeys(shifted.date, shifted.checkOutDate) !== durationDays) {
          violations.push(`${key}+${durationDays}: Dauer verändert`);
        }
      }
      key = addDaysToDateKey(key, 1);
    }
    expect(violations.slice(0, 5)).toEqual([]);
    expect(violations).toHaveLength(0);
  });

  it("EINTÄGIGE Belege verhalten sich unverändert — der Ankerwechsel ist für sie ein No-op", () => {
    // Ohne (oder mit leerem) Enddatum ist das Leistungsende gleich `date`. Taxi, Kraftstoff,
    // Verpflegung und km-Pauschale dürfen von K1 nicht angefasst werden.
    for (const scope of ["day", "week", "month"] as const) {
      let key = "2026-01-01";
      while (key <= "2026-12-31") {
        const expected = shiftDateKeyByScope(key, scope);
        // `?? null`, weil ein fehlendes Ziel als `null` aus `shiftDateKeyByScope` kommt, aus
        // `shiftExpenseDateKeys` aber als `null`-Objekt (und damit `?.date === undefined`).
        // Beide Wege müssen dieselbe Aussage treffen: kopierbar oder nicht.
        expect(
          shiftExpenseDateKeys({ date: key }, scope)?.date ?? null,
          `${key}/${scope}`
        ).toBe(expected);
        expect(
          shiftExpenseDateKeys({ date: key, checkOutDate: "" }, scope)?.date ?? null,
          `${key}/${scope} (leeres Enddatum)`
        ).toBe(expected);
        expect(
          shiftExpenseDateKeys({ date: key, checkOutDate: key }, scope)?.date ?? null,
          `${key}/${scope} (Ende == Beginn)`
        ).toBe(expected);
        key = addDaysToDateKey(key, 1);
      }
    }
  });
});

describe("copyRangeToNext verwendet genau diese Bausteine", () => {
  // Quelltext-Prüfung, weil `routers.ts` nicht importierbar ist (zieht `bcrypt` und damit ein
  // natives Binding ins schnelle Gate). Ohne sie bliebe ein Rückbau auf die datumsgleiche
  // Verschiebung unbemerkt: alle übrigen Tests blieben grün.
  // GRENZEN: deckt nur die wörtliche Schreibweise ab — bei Umbenennung hier NACHZIEHEN,
  // nicht löschen.
  const routersSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");

  it("verschiebt Zeiteinträge über `shiftDateKeyByScope`", () => {
    expect(routersSource).toContain("shiftDateKeyByScope(sourceDateKey, input.scope)");
  });

  it("verschiebt Belege über `shiftExpenseDateKeys` (Offset), nicht mehr feldweise", () => {
    expect(routersSource).toContain("shiftExpenseDateKeys(expense, input.scope)");
    expect(routersSource).not.toContain("tryShiftDateValue(");
  });

  it("leitet das `weekday`-Label aus dem ZIELdatum ab", () => {
    expect(routersSource).toContain("weekdayIndexOfDateKey(shiftedDateKey)");
  });

  it("lässt Einträge ohne Zieltag aus, statt sie in den Folgemonat zu schieben", () => {
    // Ohne diese Prüfung bliebe ein Rückbau unbemerkt: Würde `shiftDateKeyByScope` je wieder
    // ein Ausweichziel liefern, wären alle Funktionstests oben weiterhin grün, und der
    // Eintrag landete still zwei Monate nach der Quelle.
    expect(routersSource).toContain("if (!shiftedDateKey)");
    expect(routersSource).toContain("skippedNoTarget += 1");
  });

  it("filtert Wochenend-Einträge nur auf ausdrücklichen Wunsch und zählt sie", () => {
    expect(routersSource).toContain("!input.includeWeekends && !isWorkdayKey(sourceDateKey)");
    expect(routersSource).toContain("skippedWeekend += 1");
  });

  it("reicht alle Auslassungsgründe getrennt an die UI durch (K1)", () => {
    // Eine Sammelzahl würde verschleiern, ob die eigene Wochenend-Entscheidung oder der
    // Kalender gewirkt hat. BEIDE Rückgabepfade müssen jeden Zähler führen: der Leerlauf-
    // Zweig (`feld: 0`) und der Normalfall (Kurzschreibweise `feld,`). Wäre nur einer
    // geprüft, könnte der andere still verkümmern und der Client bekäme `undefined`.
    for (const field of ["skippedWeekend", "skippedNoTarget", "skippedNoTargetExpenses", "skippedOther"]) {
      expect(routersSource, `${field} im Leerlauf-Return`).toContain(`${field}: 0,`);
      expect(routersSource, `${field} im Normalfall-Return`).toContain(`\n        ${field},`);
    }
  });

  it("verknüpfte Belege folgen dem Offset ihres Zeiteintrags, nicht ihrem Leistungsende", () => {
    // Der Kern von Befund 1 des Reviews: Am eigenen Leistungsende verschoben, landete ein
    // Beleg mit Enddatum im Folgemonat einen Monat nach seinem Eltern-Eintrag — und damit in
    // einer Periode, die der Nutzer im Dialog nie bestätigt hat (ADR 0002, geldwirksam).
    expect(routersSource).toContain("entryShiftDays.set(");
    expect(routersSource).toContain("shiftExpenseDateKeysByDays(expense, parentShiftDays)");
    // Eigenständige Belege müssen weiterhin am Leistungsende hängen — nach ihm wurden sie
    // ausgewählt; ein anderer Anker ließe die Kopie im Quellzeitraum landen.
    expect(routersSource).toContain("shiftExpenseDateKeys(expense, input.scope)");
  });
});

/**
 * REGRESSIONSSCHUTZ zu Review-Befund 1: Ein verknüpfter Beleg, dessen Leistungsende in den
 * Folgemonat ragt, darf nicht von seinem Eltern-Zeiteintrag weglaufen.
 */
describe("verknüpfte Belege bleiben beim Eltern-Zeiteintrag", () => {
  it("REFERENZFALL: Hotel 28.07.–01.08. am Zeiteintrag 28.07. bleibt im August", () => {
    const entrySource = "2026-07-28";
    const entryTarget = shiftDateKeyByScope(entrySource, "month");
    expect(entryTarget, "Zeiteintrag hat ein Ziel").not.toBeNull();
    expect(entryTarget).toBe("2026-08-25");

    const parentShiftDays = daysBetweenDateKeys(entrySource, entryTarget!);
    const hotel = { date: "2026-07-28", checkOutDate: "2026-08-01" };

    // NEU: am Eltern-Offset — Beleg und Zeiteintrag im selben Monat.
    const withParent = shiftExpenseDateKeysByDays(hotel, parentShiftDays);
    expect(withParent?.date).toBe("2026-08-25");
    expect(withParent?.checkOutDate).toBe("2026-08-29");
    expect(withParent!.checkOutDate!.slice(0, 7), "Leistungsende im Zielmonat").toBe("2026-08");

    // ALT (Gegenprobe): am eigenen Leistungsende wäre der Beleg im September gelandet —
    // ein Monat nach seinem Eltern-Eintrag, in einer nicht bestätigten Periode.
    const withOwnAnchor = shiftExpenseDateKeys(hotel, "month");
    expect(withOwnAnchor?.checkOutDate?.slice(0, 7)).toBe("2026-09");
  });

  it("die Dauer bleibt auch am Eltern-Offset exakt erhalten", () => {
    for (const durationDays of [0, 1, 2, 5, 33]) {
      const hotel = { date: "2026-07-28", checkOutDate: addDaysToDateKey("2026-07-28", durationDays) };
      const shifted = shiftExpenseDateKeysByDays(hotel, 28);
      expect(daysBetweenDateKeys(shifted!.date, shifted!.checkOutDate!), `Dauer ${durationDays}`).toBe(
        durationDays
      );
    }
  });

  it("ohne verwertbares `date` weiterhin null (Aufrufer überspringt und zählt)", () => {
    expect(shiftExpenseDateKeysByDays({ date: "" }, 28)).toBeNull();
    expect(shiftExpenseDateKeysByDays({ date: "kein Datum" }, 28)).toBeNull();
  });

  it("DER PREIS des Eltern-Ankers: die Kopie KANN in den Quellzeitraum zurückfallen", () => {
    // Genau die Gefahr, gegen die der Leistungsende-Anker argumentiert — am Eltern-Offset ist
    // sie wieder erreichbar, wenn der Beleg VOR seinem Zeiteintrag beginnt und das Eltern-Ziel
    // auf einen der ersten Tage des Zielmonats fällt.
    // Eltern Mi 03.06. → Mi 01.07. (Offset 28). Flug am Vortag, 02.06. → 30.06. = QUELLmonat.
    const entryTarget = shiftDateKeyByScope("2026-06-03", "month");
    expect(entryTarget).toBe("2026-07-01");
    const parentShiftDays = daysBetweenDateKeys("2026-06-03", entryTarget!);

    const flight = { date: "2026-06-02" };
    const shifted = shiftExpenseDateKeysByDays(flight, parentShiftDays);
    expect(shifted?.date).toBe("2026-06-30");
    // DESHALB der Guard in `copyRangeToNext`: Leistungsende der Kopie <= Quellbereichsende
    // → auslassen. Ohne ihn stünde die Position in einer bereits fakturierten Periode.
    expect(shifted!.date <= "2026-06-30", "läge im Quellzeitraum Juni").toBe(true);
  });

  it("der Guard gegen den Quellzeitraum-Rückfall ist in copyRangeToNext verdrahtet", () => {
    const routers = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    expect(routers).toContain("const targetServiceEnd = shiftedDates.checkOutDate ?? shiftedDates.date;");
    expect(routers).toContain("if (targetServiceEnd <= sourceEndKey)");
    // Nur für verknüpfte Belege — eigenständige können konstruktiv nicht zurückfallen, dort
    // wäre der Guard eine wirkungslose Zusatzbedingung.
    expect(routers).toContain("if (parentShiftDays !== undefined) {");
  });
});
