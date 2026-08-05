# KONZEPT — Flugstrecke und Hin-/Rückflug-Kennzeichnung (Befund B3)

> **Version:** 1.2.0 · **Stand:** 2026-08-05 · **Status:** **UMGESETZT — Migration `0026` beim Rollout anzuwenden**
>
> **Änderungen 1.1.0 → 1.2.0 (bei der Umsetzung):** Regel 0 in §3.2 ergänzt (beide
> Heimatflughäfen → Rückfrage statt stiller Entscheidung); §4 um die harte
> Migrations-Reihenfolge erweitert; §6 um die tatsächlich berührten Pfade ergänzt, die
> §3.4 nicht kannte (Kalender-Beschriftung, Kopierpfad, Import-Vorlage).
> **Freigabe des Account-Inhabers am 2026-08-05:** Migration `0026` freigegeben; Heimatflughäfen
> auf **KTW/KRK beschränkt** (andere polnische Flughäfen lösen eine Rückfrage aus, keinen
> Vorschlag); Bestandsdaten bleiben zunächst leer, **Nachtragen zu einem späteren Zeitpunkt**
> muss möglich bleiben.
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
Restore alter Sicherungen bleibt möglich: Das Zod-Schema ist spaltenagnostisch
(`z.record(z.string(), z.unknown())`), fehlende Felder werden schlicht NULL.

> ⚠️ „Ohne Spaltenliste" heißt **nicht** `SELECT *` — Drizzle setzt die Spalten aus der
> Schema-Definition ein. Das ist der Grund für die harte Rollout-Reihenfolge in §4.

### 3.2 Ableitungsregel (Auto-Vorschlag)

Umzusetzen als **reine Funktion** in `shared/` — damit Server, Client und Import dieselbe Regel
benutzen (K4), analog zu `shared/expenseServiceEnd.ts`.

```
suggestFlightDirection(departureAirport, arrivalAirport)
  → { direction: "outbound" | "return" | null, hint?: string }

  0. Start UND Ziel sind Heimatflughäfen (auch Start == Ziel) → null + Hinweis
        „<A> und <B> sind beide Heimatflughäfen — Richtung bitte selbst festlegen."
  1. Ziel   ist HEIMATflughafen (KTW/KRK) → "return"
  2. Start  ist HEIMATflughafen (KTW/KRK) → "outbound"
  3. anderer POLNISCHER Flughafen beteiligt → null + Hinweis
        „<Code> ist ein polnischer Flughafen, aber kein hinterlegter Heimatflughafen —
         Richtung bitte prüfen."
  4. sonst (Drittland → Drittland, Umstieg) → null, kein Hinweis

  Fehlt einer der beiden Codes, gibt es keinen Vorschlag und keinen Hinweis: Aus einem
  einzelnen Code folgt nichts — bei Start „KTW" hinge das Ergebnis noch daran, ob das
  Ziel „KRK" ist (Regel 0) oder ein Auslandsziel (Regel 2).
```

> **Regel 0 ergänzt bei der Umsetzung (2026-08-05).** Ohne sie griffen bei `KTW → KRK`
> die Regeln 1 und 2 gleichzeitig und widersprächen sich; die Reihenfolge hätte still
> „Rückflug" entschieden. Zwei Heimatflughäfen auf einem Ticket sind aber genau kein
> sicherer Fall — dieselbe Haltung wie in Regel 3, nur aus umgekehrtem Grund.

**HEIMATflughäfen: ausschließlich `KTW` und `KRK`** (Entscheidung des Account-Inhabers,
2026-08-05).

> ⚠️ **Korrektur gegenüber v1.0.0 dieses Konzepts.** Der erste Entwurf zählte alle polnischen
> Verkehrsflughäfen (`WAW`, `WRO`, `POZ`, `GDN`, …) als Heimat. Das hätte **falsche Vorschläge
> erzeugt**: Ein Flug nach Warschau ist weit eher ein **Kundeneinsatz** als eine Heimreise —
> die Automatik hätte ihn als Rückflug vorgeschlagen. Nur KTW/KRK sind die tatsächlichen
> Heimatflughäfen.

**Die übrigen polnischen Flughäfen** (`WAW`, `WRO`, `POZ`, `GDN`, `RZE`, `LCJ`, `SZZ`, `BZG`)
werden trotzdem als Konstante geführt — nicht um sie als Heimat zu werten, sondern um Fall 3
zu erkennen und **gezielt nachzufragen**. Genau das war die Anforderung („wenn anderer
Flughafen genannt wird, nachfragen"): Die Automatik entscheidet nur, wo sie sicher ist, und
macht auf die Fälle aufmerksam, die eine menschliche Entscheidung brauchen — statt still zu
raten (K1).

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

**Entschieden (2026-08-05):** Felder bleiben bei Altbelegen zunächst **leer**; das Nachtragen
soll **zu einem späteren Zeitpunkt möglich** sein.

Das ist konstruktiv erfüllt und braucht keine Zusatzarbeit: Die Spalten sind nullable, die
Bearbeiten-Maske schreibt sie wie jedes andere Feld, und es gibt keine Validierung, die einen
Altbeleg ohne Flughäfen ablehnt. Ein Nachtragen ist damit jederzeit möglich — Beleg öffnen,
Start/Ziel eintragen, Richtung wird vorgeschlagen, speichern.

**Bewusst NICHT gebaut:** eine eigene Nachtrage-Maske oder ein Massenbearbeitungs-Dialog für
die 32 Altbelege. Bei dieser Menge ist der Weg über die normale Bearbeitung schneller gebaut
und weniger fehleranfällig als ein Sonderwerkzeug. Sollte sich das ändern, ist es ein eigenes,
kleines Vorhaben.

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

> 🔴 **Die Reihenfolge ist bei dieser Migration HART: Migration VOR Container-Start.**
>
> Drizzle erzeugt **nie** ein `SELECT *` — auch `db.select().from(expenses)` ohne
> Spaltenliste listet jede Spalte der Schema-Definition namentlich auf (verifiziert am
> 2026-08-05 über `QueryBuilder(...).toSQL()`). Läuft die neue App gegen eine DB ohne
> `0026`, scheitert deshalb **jeder** Zugriff auf `expenses` — Belegliste, Bericht,
> Kopierlauf **und das Backup**, nicht nur die Flugfelder.
>
> Folgen für den Rollout:
> - Die Migration muss **vor** dem Container-Start liegen. `/nas-rollout` macht das so;
>   die Reihenfolge darf nicht getauscht werden.
> - Der **Backup-Guard vor der Migration** läuft noch mit der ALTEN App — das ist richtig
>   so und funktioniert, weil deren Schema-Definition die neuen Spalten nicht kennt.
> - **Rollback ist asymmetrisch:** Container zurückrollen bei stehenden Spalten ist
>   unbedenklich (die ältere App kennt sie nicht und fragt sie nicht ab). Die Spalten
>   entfernen, während die neue App läuft, legt die Anwendung lahm.
>
> Bei `0021`/`0024` war das weicher — dort fehlte nur ein Wert bzw. eine Zuordnung.

---

## 5. Entscheidungen — alle getroffen (2026-08-05)

| Frage | Entscheidung |
|---|---|
| Migration `0026` | ✅ **freigegeben** in der vorgeschlagenen Form |
| Flughafenliste | ✅ **nur KTW/KRK** als Heimat; andere polnische Flughäfen → **Rückfrage**, kein Vorschlag |
| Bestandsdaten | ✅ zunächst **leer**; Nachtragen muss später möglich bleiben (konstruktiv erfüllt, §3.5) |

**Damit ist die Umsetzung freigegeben.** Reihenfolge für die Umsetzung siehe §6.

---

## 6. Umsetzungsreihenfolge (für die nächste Sitzung)

Vorschlag, jeweils mit `tsc` + Gate und Senior-Review vor dem Commit:

1. **Fundament** — `drizzle/0026_*.sql`, `drizzle/schema.ts`, `shared/flightDirection.ts`
   (Ableitungsregel + Heimat-/PL-Konstanten) mit Unit-Tests. In sich abgeschlossen und
   ohne Verhaltensänderung, weil noch kein Aufrufer existiert.
2. **Server** — Zod-Schemas in `expenses.create` / `.update` / `.createBatch`.
3. **Maske** — Flug-Zweig in `TimeTracking.tsx`: zwei Flughafenfelder, Richtungsauswahl mit
   vorbelegtem Vorschlag und dem Hinweistext aus Fall 3.
4. **KI-Pfad** — `receiptAi.ts`: Flughafencodes extrahieren statt verwerfen, Vorschlag im
   Kandidaten mitliefern.
5. **Rand** — CSV-Import (drei optionale Spalten), PDF-Export (Strecke + Richtung ausweisen).

Nach 1–3 ist das Feature nutzbar; 4 und 5 sind Komfort und können nachziehen.

### 6.1 Tatsächlich berührte Pfade — Nachtrag aus der Umsetzung

Drei Pfade standen nicht in §3.4 und kamen im Review dazu:

| Pfad | Warum er dazugehört |
|---|---|
| `TimeTracking.tsx` **Kalender-Zweig** (nicht nur die Maske) | Der Kalender beschriftete Flüge hart mit „Hinflug" aus dem Datum. Ein einbeiniger Beleg mit erfasster Richtung „Rückflug" hätte im selben Bildschirm die Gegenaussage getragen. Beschriftung folgt jetzt der erfassten Richtung; die **Uhrzeit**-Anzeige (`_flightLeg`) bleibt datumsgesteuert, weil sie an der Zweiteilung des Round-Trips hängt. |
| `routers.ts` **`copyRangeToNext`** | Der Kopierlauf baut den Beleg feldweise neu auf. Ohne Erweiterung verlöre jede Kopie Strecke und Richtung. Die Richtung wird **nicht** gedreht — kopiert wird derselbe Einsatz in einen neuen Zeitraum, keine Rückreise. |
| `scripts/generate-import-templates.mjs` | Ohne die drei Spalten in der Vorlage kann der dokumentierte Importweg die Felder gar nicht transportieren. Enthält jetzt zusätzlich einen Längen-Wächter: Die Testdaten sind positionsbasierte Arrays, eine vergessene Zeile verschöbe alle Werte ab der neuen Spalte lautlos. |

Ebenfalls aus dem Review, im Code umgesetzt:

- **Kategoriewechsel weg von `flight`** leert alle drei Felder mit (`routers.ts`), sonst
  blieben unsichtbare Karteileichen an einem Taxi-Beleg — sichtbar nur im PDF und im Backup.
- **Unvollständige Eingabe** („KT") wird in der Maske **abgelehnt** statt still zu NULL zu
  werden. Der Zod-Guard allein hätte nicht gereicht: Der Client hätte den Fall nie an ihn
  weitergereicht.
- **Import:** Ein ungültiger `flight_direction`-Wert wird **nicht** durch den Vorschlag
  ersetzt (das schriebe etwas anderes in die DB, als in der Datei steht), sondern als
  `EXP-FLT-006` gemeldet; ungültige Flughafencodes als `EXP-FLT-005`.
- **Kein Fallback auf den Vorschlag beim Speichern.** Der Vorschlag entsteht ausschließlich
  als Folge einer Flughafen-Eingabe und steht dann sichtbar im Feld. Sonst wäre „bewusst
  leer gelassen" bei jedem späteren Speichern still überschrieben worden — in der DB sind
  „nie entschieden" und „bewusst leer" derselbe Wert.

**Migration erst beim Rollout anwenden** — nach der Pflicht-Prozedur aus
`project_db_migration_drift` (Backup-Guard, Migration aus der Repo-Datei, Spalten- und
Zeilenzahl-Gegenprüfung, nach jedem Prod→Dev-Klon erneut prüfen).
