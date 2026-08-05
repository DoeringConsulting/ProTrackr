# KONZEPT — Flugstrecke und Hin-/Rückflug-Kennzeichnung (Befund B3)

> **Version:** 1.0.0 · **Stand:** 2026-08-05 · **Status:** **VORSCHLAG — Entscheidung offen**
> **Auslöser:** Befund B3 der Dev-Abnahme v2.7.9 (`HANDOVER-NAS-SETUP.md` §7)
> **Fachliche Quellen:** `docs/SPEC-Reisekosten-Abgrenzung.md` v1.1.0 §3.2, Memory
> `project_reisekosten_fachregeln`
> **Braucht vor Umsetzung:** ausdrückliche Freigabe der Migration (K14)

---

## 1. Ausgangsfrage

Ist die Hin-/Rückflug-Kennzeichnung in ProTrackr hinterlegt, kommt sie mit den importierten
Reisekostendaten — und ist sie überschreibbar?

**Antwort: Sie existiert in keiner Form.** Code-verifiziert am 2026-08-05.

---

## 2. Befund — was es gibt und was nicht

| Feld | Typ | Bedeutung | Richtung? |
|---|---|---|---|
| `flightRouteType` | `varchar(20)` | `domestic` \| `international` — **Inland/Ausland** | ❌ Geografie |
| `checkOutDate` | `timestamp` | Rückflugdatum, **nur** bei Round-Trip auf *einem* Ticket | ⚠️ indirekt, selten |
| `flightNumber` | `varchar(100)` | z. B. „LH1234" — enthält keine Route | ❌ |
| `departureTime` / `arrivalTime` | `varchar(10)` | HH:MM | ❌ |
| `travelStart` / `travelEnd` | **`varchar(5)`** | **HH:MM — Uhrzeiten**, trotz des Namens keine Orte | ❌ |
| Flughafencodes | — | **existieren nirgends** | ❌ |

Verwendet wird `flightRouteType` ausschließlich im PDF-Export
(`reportPdfExports.ts`: „Miedzynarodowy"/„Krajowy"). Überschreibbar ist in der Maske nur
`domestic`/`international`, nicht die Richtung.

### 2.1 Der Befund, der den Zuschnitt bestimmt

`SPEC-Reisekosten-Abgrenzung.md` §3.2 hält fest, die Regel sei *„deterministisch aus den
Flughafencodes ableitbar, ohne neues Datenfeld"*.

**Diese Annahme trägt nicht.** Die Codes sind nirgends gespeichert:

- **Schema:** kein Feld für Start-/Zielflughafen.
- **KI-Extraktion:** `server/receiptAi.ts` erkennt zwar ein Muster `from X to Y` im Belegtext —
  aber **nur**, um `international` zu bestimmen; die Codes selbst werden verworfen.
- **CSV-Import:** `client/src/lib/expenseImportV1.ts` kennt `flight_route_type` und
  `flight_number`, keine Strecke.

Ohne Flughäfen bliebe als Automatik nur der Wochentag („v. a. Mo/Di = Hinflug"). Das liegt bei
Rückreisen am Montag und Hinreisen am Mittwoch systematisch daneben — ein Vorschlag, der oft
falsch ist, ist bei einem Feld mit Abrechnungsbezug schlechter als gar keiner.

### 2.2 Wirkungsbereich — wie viel Maschinerie sich lohnt

Nach SPEC §3.2 sind **Einzelstrecken `PUNKT` (R1)**: Dort entscheidet `date`, die Richtung hat
**keine Abrechnungswirkung**. Relevant wird sie nur bei **`UNTEILBAR` (R3)** — Round-Trip auf
einem Ticket — für den Ankermonat. Die Prod-Vorprüfung vom 2026-08-03 fand **32 Flugbelege**,
davon 9 ohne Enddatum, alle unkritisch.

**Einordnung:** Die Richtung ist überwiegend **Dokumentation und Nachweis**, nicht Rechenlogik.
Der Nutzen der Strecke liegt zusätzlich darin, dass sie auf dem Beleg nachvollziehbar wird.

---

## 3. Vorschlag (entschieden: Route + Richtung)

### 3.1 Schema — Migration `0026`

```sql
ALTER TABLE `expenses`
  ADD COLUMN `departureAirport` VARCHAR(3) NULL AFTER `flightNumber`,
  ADD COLUMN `arrivalAirport`   VARCHAR(3) NULL AFTER `departureAirport`,
  ADD COLUMN `flightDirection`  ENUM('outbound','return') NULL AFTER `arrivalAirport`;
```

**Eigenschaften:**

- **Additiv und nullable** — keine Bestandszeile wird berührt, kein Backfill erzwungen.
- **`VARCHAR(3)`** für IATA-Codes (KTW, KRK, MUC, …). Bewusst kein ENUM: Flughäfen sind eine
  offene Menge, ein ENUM müsste bei jedem neuen Ziel migriert werden — und ENUM-Erweiterungen
  sind in diesem Projekt teuer (siehe `project_db_migration_drift`).
- **`flightDirection` als ENUM** mit genau zwei Werten — geschlossene Menge, hier richtig.
  ⚠️ **Anhängen, nicht in der Mitte einfügen** (Pflicht-Prozedur aus dem 0021-Fall).
- **Kein Fremdschlüssel**, keine Referenztabelle für Flughäfen. Eine Flughafenliste zu pflegen
  wäre ein eigenes Vorhaben ohne erkennbaren Zusatznutzen für den Einsatzzweck.

`drizzle/schema.ts` parallel pflegen. **Backup ist automatisch abgedeckt** — `server/backup.ts`
nutzt `db.select().from(expenses)` ohne Spaltenliste, die neuen Felder laufen ohne Änderung mit.

### 3.2 Ableitungsregel (Auto-Vorschlag)

Umzusetzen als **reine Funktion** in `shared/` — damit Server, Client und Import dieselbe Regel
benutzen (K4), analog zu `shared/expenseServiceEnd.ts`.

```
suggestFlightDirection(departureAirport, arrivalAirport) → "outbound" | "return" | null

  1. Zielflughafen ist ein POLNISCHER Flughafen  → "return"
  2. Startflughafen ist ein POLNISCHER Flughafen → "outbound"
  3. sonst (Drittland → Drittland, Umstieg)      → null  [kein Vorschlag]
```

**Polnische Flughäfen:** `KTW`, `KRK` als bevorzugte laut Fachregel; ergänzend `WAW`, `WRO`,
`POZ`, `GDN`, `RZE`, `LCJ`, `SZZ`, `BZG` — als benannte Konstante an einer Stelle, nicht
verstreut.

**Zur Umsteige-Regel:** Die Fachregel sagt „bei Umstieg entscheidet der letzte Flughafen". Das
ist mit **zwei** Feldern genau dann erfüllt, wenn `arrivalAirport` das **Endziel** der Reise
trägt, nicht den Zwischenstopp. Das ist eine Erfassungskonvention und gehört in den Hilfetext
des Feldes — technisch erzwingen lässt es sich nicht, ohne einzelne Legs zu modellieren
(eigene Tabelle, deutlich größeres Vorhaben, für den Nutzen nicht angemessen).

**Der Wochentag geht bewusst NICHT in die Regel ein.** Er ist laut Fachregel ein Indiz
(„typisch Mo/Di"), kein Kriterium; als Automatik würde er stillschweigend falsche Vorschläge
erzeugen. Bei Fall 3 bleibt der Vorschlag leer, statt zu raten (K1).

### 3.3 Verhältnis Vorschlag ↔ gespeicherter Wert

`flightDirection` wird **gespeichert**, nicht bei jeder Anzeige neu berechnet:

- Der Nutzer kann überschreiben — genau die Anforderung.
- Ändert sich die Regel später, bleiben bereits geprüfte Belege stabil.
- Ein nur abgeleiteter Wert wäre nicht überschreibbar, ohne doch wieder ein Feld einzuführen.

Der Vorschlag greift beim **Erfassen und Bearbeiten**, nicht rückwirkend auf gespeicherte Werte.

### 3.4 Betroffene Pfade

| Pfad | Änderung |
|---|---|
| `drizzle/0026_*.sql` + `schema.ts` | drei Spalten |
| `shared/flightDirection.ts` (neu) | Ableitungsregel + Flughafenkonstante, unit-getestet |
| `server/routers.ts` | `expenses.create` / `.update` / `.createBatch`: drei Felder ins Zod-Schema |
| `server/receiptAi.ts` | Extraktion um Start-/Zielflughafen erweitern (das Muster wird bereits erkannt, nur verworfen); Vorschlag im Kandidaten mitliefern |
| `client/src/pages/TimeTracking.tsx` | Flug-Zweig: zwei Felder + Richtungs-Auswahl mit vorbelegtem Vorschlag |
| `client/src/lib/expenseImportV1.ts` | drei CSV-Spalten (`departure_airport`, `arrival_airport`, `flight_direction`), optional |
| `client/src/lib/reportPdfExports.ts` | Strecke und Richtung im Flug-Abschnitt ausweisen |
| `server/backup.ts` | **keine** — Spaltenliste ist generisch |

### 3.5 Bestandsdaten

**Kein automatischer Backfill.** Begründung:

- Die Flughäfen sind aus den Bestandszeilen **nicht rekonstruierbar** — sie stehen nirgends
  strukturiert; allenfalls im Freitext `comment`, ungeprüft und uneinheitlich.
- Ein Backfill aus dem Wochentag wäre genau das Raten, das oben verworfen wurde.
- Ohne Abrechnungswirkung bei Einzelstrecken (§2.2) entsteht kein Schaden durch leere Felder.

**Vorschlag:** Felder bleiben bei Altbelegen leer; wer sie braucht, trägt sie beim nächsten
Bearbeiten nach. Bei 32 Flugbelegen wäre ein manuelles Nachtragen an einem Nachmittag machbar —
das ist eine kaufmännische Entscheidung, keine technische.

### 3.6 Abgrenzung — was dieses Konzept NICHT tut

- Keine Änderung an `flightRouteType` (bleibt Inland/Ausland, bleibt im PDF).
- Keine Änderung an der ADR-0002-Zuordnung: `checkOutDate` bleibt der Periodenanker.
- Keine Legs-Modellierung für Umsteigeverbindungen.
- Keine automatische Round-Trip-Erkennung über zwei Einzelbelege hinweg.

---

## 4. Aufwand und Risiko

| | |
|---|---|
| **Schema-Risiko** | gering — additiv, nullable, kein FK, kein ENUM-Mitten-Einfügen |
| **Datenrisiko** | keins — keine Bestandszeile wird geschrieben |
| **Aufwandsschwerpunkt** | KI-Extraktion und Maske, nicht die Migration |
| **Rollback** | Spalten können bleiben (ältere App ignoriert sie) — Rollback-Asymmetrie wie bei 0021 |

**Pflichtschritte bei der Umsetzung** (aus `project_db_migration_drift`):

1. Migration **aus der Repo-Datei** fahren, nicht handgetippt; md5 mitloggen.
2. Vor dem `ALTER` prüfen, dass das Backup den **Vorher**-Zustand enthält.
3. Nach dem `ALTER` Spaltenexistenz **und** Zeilenzahl gegenprüfen.
4. Nach jedem Prod→Dev-Klon erneut prüfen — der Klon holt Lücken zurück.

---

## 5. Offene Entscheidung

Die Migration ist ein **kritischer Eingriff (K14)** und wird **nicht** ohne ausdrückliche
Freigabe ausgeführt. Zu entscheiden:

1. **Freigabe der Migration `0026`** in der vorgeschlagenen Form?
2. **Flughafenliste:** nur `KTW`/`KRK` (Fachregel wörtlich) oder alle polnischen Verkehrsflughäfen?
3. **Bestandsdaten:** leer lassen (Vorschlag) oder die 32 Flüge manuell nachtragen?
