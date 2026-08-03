---
titel: "ProTrackr — Spezifikation Reisekosten- und Spesen-Abgrenzung"
version: "1.1.0"
status: "ENTWURF — Freigabe erforderlich (K14)"
autor: "Alexander Döring"
organisation: "DÖRING Consulting"
erstellt: 2026-08-03
geaendert: 2026-08-03
plattform: "P1 Web/Full-Stack (React/TypeScript, tRPC/Express, MySQL/Drizzle)"
kanon: "ENTWICKLUNGSPRINZIPIEN-KERN v1.3.0 · Playbook P1"
tags: [protrackr, reisekosten, spesen, abgrenzung, spezifikation]
---

# ProTrackr — Reisekosten- und Spesen-Abgrenzung

**Version 1.1.0 · Status: ENTWURF, Freigabe erforderlich**

> **Ablage (K13):** Dieses Dokument ist ab v1.1.0 im Repo versioniert
> (`docs/SPEC-Reisekosten-Abgrenzung.md`) und löst die lose Datei
> `Downloads/ProTrackr_Spec_Reisekosten-Abgrenzung_v1.0.0.md` ab — **eine** Wahrheitsquelle (K4).
>
> **Änderungen v1.1.0 (2026-08-03):** Zwei Fachregeln des Account-Inhabers eingearbeitet —
> **§3.2** Hin-/Rückflug-Bestimmung nach geografischer Richtung (betrifft R3/Ankermonat und die
> Erfassungspraxis) und **§8.1a** Abrechenbarkeit verfallener/ungenutzter Tickets nach Verfallursache.
> Beide sind Nutzerentscheidungen (K14), keine Werkzeug-Annahmen. Ergänzt außerdem den Bezug zu
> **ADR 0002** (Leistungsende-Zuordnung, umgesetzt in v2.5.5) — die Spec bleibt das Zielbild, ADR 0002
> ist der aktuell implementierte, bewusst einfachere Zwischenstand (**kein Split**).

> **K14-Hinweis (Steuer-/Berechnungslogik):** Dieses Dokument definiert Berechnungs- und Steuerlogik. Nach
> CORE §0.3/K14 entscheidet Alexander Döring, nicht das Werkzeug. Vor Implementierung: ausdrückliche Freigabe
> je Entscheidungspunkt (§16) + ADR (K13). Vor dem Schema-Umbau: Master-Freeze und verifiziertes Backup (K12/K15).
>
> **Kein Steuerrat.** Die rechtliche Herleitung ist recherchiert, aber nicht durch einen doradca podatkowy
> geprüft. Empfohlener Absicherungspfad: interpretacja indywidualna (ORD-IN) — siehe §17.

---

## 1. Zweck und Grundsatz

### 1.1 Was diese Spezifikation regelt

Wie ProTrackr Reisekosten und Spesen **erfasst**, **einem Abrechnungsmonat zuordnet** und an
`invoice-generator-v3` übergibt — insbesondere bei **monatsübergreifenden Sachverhalten**.

### 1.2 Der tragende Grundsatz

> **Der Abrechnungsmonat richtet sich nach dem Zeitpunkt der Nutzung, nicht nach dem Zeitpunkt der Zahlung
> und nicht nach dem Belegdatum.**

Reisekosten sind umsatzsteuerlich keine eigenständige Leistung, sondern **unselbständige Nebenleistung** zur
Beratungsleistung (art. 29a ust. 1 i ust. 6 ustawy o VAT). Die Nebenleistung teilt den Leistungszeitpunkt der
Hauptleistung (art. 19a ust. 1 bzw. ust. 3). Eine im August bezahlte, im September genutzte Leistung gehört in
die September-Abrechnung.

**Daraus folgt die zentrale Modellentscheidung:** Zahlung, Beleg und Nutzung sind **drei getrennte Belange**
und brauchen **drei getrennte Datumsfelder** (K4 — eine Wahrheitsquelle je Belang).

---

## 2. Die drei Datumsachsen

Jede Reisekostenposition trägt drei voneinander unabhängige Datumsangaben. Sie dürfen **nie** aufeinander
abgebildet oder voneinander abgeleitet werden.

| Feld | Bedeutung | Steuert ausschließlich |
|---|---|---|
| `beleg_datum` | Datum des Lieferantenbelegs | KPiR-Kostenbuchung (art. 22 ust. 6b PIT) · NBP-Kurs Kostenseite (art. 22 ust. 2 PIT) · VAT-REF-Jahr |
| `zahlung_datum` | tatsächlicher Geldabfluss | ausschließlich Liquiditäts-/Vorfinanzierungsreport. **Niemals** Abrechnungslogik. |
| `nutzung_von` / `nutzung_bis` | Verbrauchszeitraum der Leistung | **Abrechnungsmonat** und Weiterberechnung |

### 2.1 Warum das die Kernentscheidung ist

Der häufigste Fehler in Reisekostentools ist, das Belegdatum als Abrechnungsdatum zu verwenden. Bei
Vorauszahlung (Flug im August gebucht, im September geflogen) und bei Zahlung im Nachhinein (Hotel-Check-out
am 1. des Folgemonats) liefert das systematisch den falschen Monat — **in beide Richtungen**.

Beispiel Hotel, Aufenthalt 28.09.–01.10., Zahlung bei Check-out:

- Belegdatum-Logik → gesamter Betrag in Oktober. **Falsch.**
- Nutzungs-Logik → 3 Nächte September. **Richtig.**

---

## 3. Klassifizierung: Abgrenzungstyp

Jede Kostenart trägt einen festen `abgrenzungstyp`. Er entscheidet, **ob** und **wie** gesplittet wird.

| Typ | Definition | Kostenarten (Beispiele) |
|---|---|---|
| `PUNKT` | Einzelereignis an genau einem Tag (`nutzung_von = nutzung_bis`) | Taxi, Transfer, One-Way-Flug, Tanken, Einzel-Parkticket, Maut |
| `TEILBAR_TAG` | pro Kalendertag atomar und exakt zerlegbar | Mietwagen, Dauerparken, Kilometergeld, Roaming/eSIM, Tagestickets ÖPNV |
| `TEILBAR_NACHT` | pro Übernachtung atomar zerlegbar | Hotel, Apartment, Monteurzimmer |
| `UNTEILBAR` | ein Vertrag, ein Preis, nicht datumsscharf zerlegbar | Hin-/Rückflug als ein Ticket, Bahn-Rundfahrt-Ticket, Visum, reisebezogene Versicherung |

### 3.1 Sonderfall: aufteilbare Rundreise-Tickets

Weist der Beleg **je Streckenabschnitt einen eigenen Preis** aus (getrennte Fare-Komponenten inkl. Steuern und
Gebühren je Segment), darf die Position als zwei `PUNKT`-Positionen erfasst werden. Das ist eine
**manuelle Entscheidung bei der Erfassung** (`split_belegt = true`), keine Heuristik. Ohne belegte
Preisaufteilung bleibt es bei `UNTEILBAR`.

**Begründung:** Eine geschätzte 50/50-Aufteilung eines Rundflugpreises ist eine Erfindung, keine Abgrenzung —
sie ist gegenüber dem Kunden nicht belegbar und im Prüfungsfall nicht verteidigbar.

### 3.2 Hin- vs. Rückflug: Bestimmung nach geografischer Richtung *(Fachregel, K14-Entscheidung)*

**Kein Datenbankfeld kodiert die Flugrichtung.** `flightRouteType` beschreibt die **Geografie**
(Wert `international`), **nicht** Hin/Rück. Maßgeblich ist daher folgende Regel des Account-Inhabers:

| Richtung | Bedeutung |
|---|---|
| Flug **nach Polen** (bevorzugt **KTW** oder **KRK**) | **Rückflug** |
| Flug **aus Polen heraus** (typisch Montag/Dienstag) | **Hinflug** zum Einsatzort |
| Umsteige-/Zwischenstoppflug | der **letzte Flughafen** bestimmt die Richtung |

**Begründung:** Der Leistungserbringer ist in Polen ansässig (Mandant `dc001`); Dienstreisen beginnen und
enden dort. Die Regel ist damit deterministisch aus den Flughafencodes ableitbar, ohne neues Datenfeld.

**Folgen für die Abgrenzung:**

- **Erfassungspraxis geht vor Modellannahme:** Flüge werden überwiegend als **getrennte Einzelstrecken**
  erfasst (je Beleg `date` = Flugtag). Solche Belege sind **`PUNKT` (R1)**, nicht `UNTEILBAR` — es gibt
  nichts abzugrenzen, und es wird **kein Ankermonat** benötigt. `checkOutDate = NULL` ist dort **fachlich
  korrekt** und kein Datenfehler (bestätigt in der Prod-Vorprüfung 2026-08-03: von 32 Flugbelegen waren
  alle 9 Kandidaten mit fehlendem Enddatum unkritisch).
- **`UNTEILBAR` (R3) greift nur** beim echten Hin-/Rückflug **auf einem Ticket** — in der Praxis selten.
  Nur dann ist der Ankermonat überhaupt zu bestimmen.
- **Für ADR 0002** (implementierter Stand): Bei einem Round-Trip auf einem Beleg trägt `checkOutDate` das
  **Rückflugdatum**; der Beleg zählt damit im Monat der Rückkehr. Bei Einzelstrecken entscheidet `date`.

> **Prüfhinweis:** Ein fehlendes `checkOutDate` bei einem *echten* Round-Trip-Beleg über den Monatswechsel
> wäre ein stiller Fehler — der Beleg bliebe im Abflugmonat. Die Datenqualitätsabfrage in
> `scripts/analyze-expense-attribution.mjs` deckt genau das auf.

---

## 4. Abgrenzungsregeln R1–R6

### R1 — Punktereignis

```
abrechnungsmonat = monat(nutzung_von)
```

### R2 — Teilbar (Tag oder Nacht)

Jede Einheit wird ihrem eigenen Kalendermonat zugeordnet.

- **Tag-Einheit:** trägt ihr eigenes Kalenderdatum.
- **Nacht-Einheit:** trägt das Datum des **Check-in-Tages dieser Nacht**.
  Die Nacht 30.09.→01.10. zählt zu **September**.
- Anzahl Nächte = `nutzung_bis − nutzung_von` (Check-out minus Check-in, in Tagen).

Der Betrag wird gleichmäßig auf die Einheiten verteilt; Restminoreinheiten nach §10.

> **Ausnahme bei belegter Preisstaffelung:** Weist die Hotelrechnung je Nacht unterschiedliche Preise aus
> (Messezuschlag, Wochenendtarif), gilt die belegte Staffelung — nicht der Durchschnitt.

### R3 — Unteilbar: Ankermonat der Reise

```
anker_monat(reise) =
  1. Monat mit der größten Anzahl Leistungstage (Manntage) dieser Reise
  2. bei Gleichstand: Monat des Reisebeginns (nutzung_von der Reise)
```

Die gesamte unteilbare Position geht **vollständig** in den Ankermonat.

**Begründung der Tie-Break-Regel:** Bei Gleichstand ist keine Zuordnung sachlich überlegen. Gewählt wird der
Reisebeginn, weil (a) die Verpflichtung und die Vorleistung dort entstehen, (b) die Regel deterministisch und
ohne Kalenderabhängigkeit reproduzierbar ist. Die Regel ist bewusst gesetzt und in §16 freizugeben.

### R4 — Leistungstage (Manntage) einer Reise

Maßgeblich sind die in ProTrackr erfassten **abrechenbaren Leistungstage** dieser Reise, nicht die
Kalendertage der Anwesenheit. Reine Reisetage ohne Leistungserbringung zählen nur mit, wenn der Mandantenvertrag
sie als abrechenbar führt (`mandant.reisetag_abrechenbar`).

### R5 — Reisezuordnung ist Pflicht

Jede Reisekostenposition **muss** einer `reise` zugeordnet sein. Positionen ohne Reisebezug (z. B. Jahres-
Bahncard, Reiseversicherung als Jahrespolice) sind **keine Reisekosten** im Sinne dieser Spezifikation, sondern
allgemeiner Betriebsaufwand und nicht weiterberechenbar. Sie laufen über eine eigene Kostenart mit
`weiterberechenbar = false`.

### R6 — Abgrenzungsmodus (Konfiguration, K10)

```
ABGRENZUNG_MODUS ∈ { HYBRID, ANKER }   -- Default: HYBRID
```

| Modus | Verhalten | Bewertung |
|---|---|---|
| `HYBRID` (empfohlen) | R1–R3 wie oben: Teilbares taggenau, Unteilbares zum Anker | Sachlich präzise, für den Kunden nachvollziehbar |
| `ANKER` | **alle** Positionen einer Reise gehen in den Ankermonat | Einfacher, aber verschiebt Hotelnächte monatsfremd |

Der Modus ist **je Mandant** konfigurierbar, weil er vertraglich abhängt. Er darf **nicht** unterjährig
gewechselt werden (Stetigkeit); ein Wechsel gilt ab dem nächsten Geschäftsjahr und wird als ADR protokolliert.

---

## 5. Spesen / Diäten

Spesen entstehen **nicht aus Belegen**, sondern aus Reisetagen. Sie sind damit immer `TEILBAR_TAG` und
haben **kein Monatsübergreifungsproblem** — jeder Tag fällt in seinen eigenen Monat.

### 5.1 Zwei getrennte Beträge — strukturell, nicht per Flag (K9.1)

| Feld | Rechtsgrundlage | Sichtbarkeit |
|---|---|---|
| `dieta_kup_minor` | art. 23 ust. 1 pkt 52 PIT — KUP-fähig bis zum Satz der einschlägigen Verordnung | **nur intern** |
| `spesen_weiterberechnung_minor` | Vertrag mit dem Mandanten (Tagespauschale) | Kundenausgabe |

**Diese beiden Beträge sind verschiedene Zahlen mit verschiedenen Rechtsgrundlagen.** Sie werden in getrennten
Feldern geführt und über getrennte Typen exportiert (§13). Ein einzelnes Feld mit Umschalt-Flag ist ein
K9.1-Verstoß: der interne KUP-Betrag darf strukturell nicht in ein kundenseitiges Objekt gelangen können.

### 5.2 Sätze als versionierte Konfiguration (K10)

```
spesen_satz: land · satz_minor · waehrung · gueltig_von · gueltig_bis · quelle · quelle_abrufdatum
```

Sätze werden **nie** hartkodiert. Bei Reisen über einen Satzwechsel hinweg gilt je Tag der am jeweiligen Tag
gültige Satz.

> **Pflege-Hinweis:** Die aktuellen Sätze des rozporządzenie sind vor Inbetriebnahme gegen die Primärquelle zu
> prüfen und mit Abrufdatum zu hinterlegen. Sie ändern sich periodisch.

### 5.3 Kürzung bei gestellten Mahlzeiten

Enthält eine Hotelrechnung Frühstück oder stellt der Mandant Mahlzeiten, ist die Diäte nach den Regeln der
Verordnung zu kürzen. Feld je Reisetag:

```
mahlzeiten_gestellt: SET('FRUEHSTUECK','MITTAG','ABEND')
```

Die Kürzungsprozentsätze gehören in dieselbe versionierte Konfigurationstabelle wie die Sätze.

**Praxis-Trigger:** Deutsche Hotelrechnungen weisen Frühstück regelmäßig separat aus. Der Import muss beim
Erkennen einer Frühstücksposition `mahlzeiten_gestellt` für die betroffenen Tage vorschlagen und zur
Bestätigung markieren (kein stilles Setzen).

### 5.4 Anfangs- und Endtag

Teiltagesregelungen (Stundenschwellen für An- und Abreisetag) gehören ebenfalls in die Konfiguration.
`reise.abfahrt_zeit` und `reise.ankunft_zeit` sind dafür zu erfassen, Zeitzone `Europe/Warsaw` (K8).

---

## 6. Währung und Wechselkurse (K8)

**Einzige Kursquelle: NBP Tabela A.** Keine Forex-Daten, keine gemischten Quellen. Die bestehende
NBP-Spezifikation v2.0.0 bleibt maßgeblich (SSoT, K4) — hier werden nur die **Stichtage** je Belang festgelegt.

### 6.1 Drei verschiedene Kursstichtage — nicht vermischen

| Belang | Stichtag | Rechtsgrundlage |
|---|---|---|
| **Kostenseite PIT** | letzter Werktag **vor** `beleg_datum` | art. 22 ust. 2 i. V. m. art. 11a ust. 2 PIT |
| **Erlösseite PIT** | letzter Werktag **vor** dem letzten Tag des Abrechnungsmonats | art. 14 ust. 1e i. V. m. art. 11a ust. 1 PIT |
| **Kundenrechnung (PLN→EUR)** | vertraglich zu definieren — Empfehlung: NBP Tabela A EUR/PLN, letzter Werktag des Abrechnungsmonats | Vertrag |

### 6.2 Keine Umrechnung ohne Notwendigkeit

Ein EUR-Beleg, der auf einer EUR-Rechnung weiterberechnet wird, wird **kundenseitig nicht umgerechnet** — der
Originalbetrag geht 1:1 durch. Umgerechnet wird ausschließlich für die PLN-Bücher.

Nur PLN-Belege (polnisches Taxi, PKP, Tankstelle) müssen für die EUR-Rechnung konvertiert werden. Kurs und
Kursdatum sind **je Position** auf der Reisekostenaufstellung auszuweisen, damit der Mandant nachrechnen kann.

### 6.3 Kursdifferenz ist ein Ergebnis, kein Fehler

Kostenseite und Erlösseite verwenden unterschiedliche Stichtage. Bei einem durchlaufenden Posten entsteht
dadurch in PLN eine Differenz. Diese wird als **eigene interne Kennzahl** ausgewiesen
(`kursdifferenz_pln_grosze`), nicht in der Position versteckt.

> **P1.12-Lesson:** Übersteigt eine Berichts-Divergenz die Sub-Cent-Rundung, ist die **Kurs-Stichtag-Auflösung**
> verdächtig, nicht die Rundung. Bei Abweichungen zuerst den Stichtag prüfen.

---

## 7. Umsatzsteuer der Belege und VAT-REF

### 7.1 Felder

```
ust_land            CHAR(2)     -- PL, DE, AT, ...
netto_minor         BIGINT
ust_minor           BIGINT
brutto_minor        BIGINT      -- Invariante: netto + ust = brutto
vorsteuer_abzug_pl  BOOLEAN     -- in PL als Vorsteuer abziehbar?
vat_ref_kandidat    BOOLEAN     -- über VAT-REF rückforderbar?
vat_ref_ausschluss  BOOLEAN     -- im Erstattungsland vom Abzug ausgeschlossen
```

### 7.2 Regel für die Weiterberechnungsbasis

| Konstellation | Basis |
|---|---|
| `ust_land = 'PL'` und `vorsteuer_abzug_pl = true` | **NETTO** |
| `ust_land ≠ 'PL'` und `vat_ref_kandidat = true` | **NETTO** |
| `ust_land ≠ 'PL'` und `vat_ref_kandidat = false` | **BRUTTO** |

Die Wahl zwischen den letzten beiden Zeilen ist eine **Mandantenentscheidung mit Geldwert** und gehört in den
Vertrag (`mandant.weiterberechnung_auslands_ust ∈ {NETTO_MIT_VATREF, BRUTTO}`).

### 7.3 VAT-REF-Report

Eigener interner Report je Kalenderjahr:

- Filter: `ust_land ≠ 'PL'` und `vat_ref_kandidat = true` und `vat_ref_ausschluss = false`
- Gruppierung: Erstattungsland, Kostenart
- **Fristen-Alert:** 30.09. des Folgejahres, nicht verlängerbar. Warnstufen bei T−90 / T−30 / T−7.

> Die Liste der im jeweiligen Erstattungsland vom Abzug ausgeschlossenen Leistungen ist als Konfiguration je
> Land zu pflegen und vor Antragstellung gegen die Primärquelle zu verifizieren.

---

## 8. Status und Storno

```
position.status ∈ { GEPLANT, GEBUCHT, DURCHGEFUEHRT, STORNIERT, UMGEBUCHT, ERSTATTET, VERFALLEN }
```

`VERFALLEN` = gebuchte, bezahlte, aber **ungenutzte** Leistung, die **nicht storniert** wurde (typisch:
nicht angetretenes Flugticket). Fachlich ein eigener Fall — es gibt weder eine Nutzung noch einen
Stornobeleg (siehe §8.1a).

### 8.1 Weiterberechnungsfähigkeit

```
weiterberechenbar =
     status = 'DURCHGEFUEHRT'
  OR (status = 'STORNIERT'
      AND storno_verursacher = 'MANDANT'
      AND mandant.storno_weiterberechenbar = true)
  OR (status = 'VERFALLEN'
      AND verfall_ursache IN ('DIENSTLICH', 'MANDANT'))
```

### 8.1a Verfallene / ungenutzte Tickets *(Fachregel, K14-Entscheidung)*

> **Verfallene Tickets sind NICHT per se nicht-abrechenbar.** Entscheidend ist die **Ursache** des
> Verfalls, nicht der Verfall selbst.

| `verfall_ursache` | Beispiel | Weiterberechenbar |
|---|---|---|
| `KRANKHEIT` | Leistungserbringer erkrankt, Flug verfällt | **nein** — Risiko liegt beim Dienstleister |
| `DIENSTLICH` | Aufgabe beim Kunden verhindert die Wahrnehmung des Fluges | **ja** |
| `MANDANT` | Kunde sagt ab / verschiebt, Ticket verfällt | **ja** (kundenverursacht) |

**Begründung:** Das ist dieselbe Verursacherlogik wie beim Storno (§8.1): Wer die Nichtnutzung zu
vertreten hat, trägt die Kosten. Ein pauschales „verfallen ⇒ nicht abrechenbar" wäre sachlich falsch und
verschenkt bare Beträge; ein pauschales „immer abrechenbar" wäre gegenüber dem Mandanten nicht
vertretbar.

**Abrechnungsmonat:** Es existiert keine Nutzung. Es gilt daher — analog §8.2 — der Monat des
Beleg-/Verfallsdatums (`monat(beleg_datum)`), nicht der Monat des ursprünglich geplanten Fluges.

**Erfassung:** `verfall_ursache` ist ein **Pflichtfeld**, sobald `status = 'VERFALLEN'` gesetzt wird.
Kein Default — die Ursache ist eine kaufmännische Feststellung und darf nicht geraten werden
(Missing-Data-Penalty, globale Regel §6). Bis zur Erfassung gilt die Position als **nicht**
weiterberechenbar.

**Offene Altfälle (Stand 2026-08-03):** Prod-Belege **#605** (Fritzmeier, 425,97 EUR,
„bilet niewykorzystany") und **#492** (238,20 EUR) — Abrechenbarkeit hängt je Beleg an der Ursache und
ist kaufmännisch zu klären.

`GEPLANT` und `GEBUCHT` fließen **nie** in eine Rechnung — sie erscheinen ausschließlich im
Vorfinanzierungsreport (§13.2).

### 8.2 Abrechnungsmonat bei Storno

Bei weiterberechenbarem Storno existiert keine Nutzung. Dann gilt:

```
abrechnungsmonat = monat(storno_beleg_datum)
```

### 8.3 Erstattungen und Gutschriften

Eine Erstattung wird als **eigene Position mit negativem Betrag** erfasst, verknüpft über
`storniert_position_id`. Sie wird **nie** durch Änderung der Ursprungsposition abgebildet — das verletzt
Append-only (K6) und zerstört die Nachvollziehbarkeit bereits abgeschlossener Monate.

Abrechnungsmonat der Gutschrift: siehe §9.2.

---

## 9. Monatsabschluss und Nachzügler

### 9.1 Sperre

```
monatsabschluss: mandant_id · monat (YYYY-MM) · status ∈ {OFFEN, GESPERRT}
                 · rechnung_nr · ksef_nr · gesperrt_am
```

Sobald die Monatsrechnung eine KSeF-Nummer trägt, wird der Monat **GESPERRT**. Für gesperrte Monate:

- keine neuen Abgrenzungszeilen,
- kein Neulauf der Abgrenzung,
- keine Änderung bestehender Abgrenzungszeilen.

### 9.2 Rechnungslauf-Stichtag (strukturelle Vermeidung von Nachzüglern)

```
RECHNUNGSLAUF_AB = 5. Werktag des Folgemonats    -- Konfiguration je Mandant
```

Belege der letzten Monatstage (typisch: Hotelrechnung beim Check-out am 1./2.) sind bis dahin erfasst. Das
löst den Großteil des Problems, ohne Sonderlogik.

### 9.3 Nachzügler-Regel

Trifft ein Beleg für einen bereits **gesperrten** Leistungsmonat ein:

| Betrag | Behandlung |
|---|---|
| ≤ `NACHZUEGLER_SCHWELLE` (Default 250 EUR) | Aufnahme in die nächste **offene** Monatsrechnung als eigene Position mit Kennzeichnung `Nachtrag Leistungsmonat MM/YYYY` |
| > `NACHZUEGLER_SCHWELLE` | **Nachtragsrechnung** für den ursprünglichen Leistungsmonat |

> **Rechtlicher Hinweis:** Formal streng korrekt ist immer die Nachtragsrechnung, weil der
> Umsatzsteuer-Zeitpunkt am ursprünglichen Leistungsmonat hängt (art. 19a ust. 3). Die Schwellenlösung ist eine
> bewusste Wesentlichkeitsentscheidung und **freigabepflichtig** (§16, Punkt 3). Sie sollte im Mandantenvertrag
> abgebildet sein.

Jede Nachzügler-Position trägt `leistungsmonat_original` und wird auf der Reisekostenaufstellung getrennt
ausgewiesen.

---

## 10. Beträge, Rundung und Restminoreinheiten (K8)

### 10.1 Geldtyp

Alle Beträge als **Ganzzahl in der kleinsten Einheit** (`BIGINT`), nie Float, nie Decimal, nie String.
Feldsuffix `_minor`; die Währung steht im Feld `waehrung`. EUR → Cent, PLN → Grosz.

### 10.2 Split-Invariante

```
SUMME(abgrenzung.betrag_minor WHERE position_id = P) = position.betrag_minor
```

**Byte-exakt, ohne Toleranz.** Diese Invariante ist als Datenbank-Constraint bzw. als verpflichtender Unit-Test
zu führen.

### 10.3 Restminoreinheiten-Verteilung

```
basis     = floor(betrag_minor / einheiten)
rest      = betrag_minor - (basis * einheiten)
```

Der Rest wird **einheitenweise auf die chronologisch frühesten Einheiten** verteilt (je +1 Minoreinheit).
Deterministisch, reproduzierbar, keine Zufallsverteilung.

*Beispiel:* 44 701 Cent auf 3 Nächte → 14 901 / 14 900 / 14 900 = 44 701 ✓

---

## 11. Datenmodell (MySQL 8 / Drizzle)

```sql
-- Reise (Kopf)
CREATE TABLE reise (
  id                  BIGINT PRIMARY KEY AUTO_INCREMENT,
  mandant_id          BIGINT NOT NULL,
  reise_von           DATE NOT NULL,
  reise_bis           DATE NOT NULL,
  abfahrt_zeit        TIME NULL,
  ankunft_zeit        TIME NULL,
  zweck               VARCHAR(255) NOT NULL,
  anker_monat         CHAR(7) NOT NULL,          -- 'YYYY-MM', materialisiert
  anker_regel_version VARCHAR(16) NOT NULL,
  status              ENUM('GEPLANT','LAUFEND','ABGESCHLOSSEN','STORNIERT') NOT NULL,
  CONSTRAINT ck_reise_zeitraum CHECK (reise_bis >= reise_von)
);

-- Reisekostenposition (Beleg-Ebene)
CREATE TABLE reisekosten_position (
  id                    BIGINT PRIMARY KEY AUTO_INCREMENT,
  reise_id              BIGINT NOT NULL,
  mandant_id            BIGINT NOT NULL,
  kostenart_id          BIGINT NOT NULL,
  abgrenzungstyp        ENUM('PUNKT','TEILBAR_TAG','TEILBAR_NACHT','UNTEILBAR') NOT NULL,

  -- die drei Datumsachsen (§2)
  beleg_datum           DATE NOT NULL,
  zahlung_datum         DATE NULL,
  nutzung_von           DATE NOT NULL,
  nutzung_bis           DATE NOT NULL,

  -- Betrag (K8: Ganzzahl, kleinste Einheit)
  waehrung              CHAR(3) NOT NULL,
  netto_minor           BIGINT NOT NULL,
  ust_minor             BIGINT NOT NULL DEFAULT 0,
  brutto_minor          BIGINT NOT NULL,

  -- Umsatzsteuer / VAT-REF (§7)
  ust_land              CHAR(2) NOT NULL,
  vorsteuer_abzug_pl    BOOLEAN NOT NULL DEFAULT FALSE,
  vat_ref_kandidat      BOOLEAN NOT NULL DEFAULT FALSE,
  vat_ref_ausschluss    BOOLEAN NOT NULL DEFAULT FALSE,
  weiterberechnung_basis ENUM('NETTO','BRUTTO') NOT NULL,

  -- Status / Storno (§8)
  status                ENUM('GEPLANT','GEBUCHT','DURCHGEFUEHRT','STORNIERT','UMGEBUCHT','ERSTATTET','VERFALLEN') NOT NULL,
  storno_verursacher    ENUM('MANDANT','DIENSTLEISTER','DRITTER') NULL,
  storno_beleg_datum    DATE NULL,
  storniert_position_id BIGINT NULL,
  -- Verfall (§8.1a): Pflicht, sobald status = 'VERFALLEN'. Kein Default —
  -- die Ursache entscheidet ueber die Weiterberechenbarkeit und wird nicht geraten.
  verfall_ursache       ENUM('KRANKHEIT','DIENSTLICH','MANDANT') NULL,

  -- Nachweis
  beleg_nr              VARCHAR(64) NULL,
  beleg_pfad            VARCHAR(512) NULL,
  split_belegt          BOOLEAN NOT NULL DEFAULT FALSE,

  CONSTRAINT ck_pos_zeitraum CHECK (nutzung_bis >= nutzung_von),
  CONSTRAINT ck_pos_betrag   CHECK (netto_minor + ust_minor = brutto_minor),
  CONSTRAINT fk_pos_reise    FOREIGN KEY (reise_id) REFERENCES reise(id)
);

-- Materialisierte Abgrenzung — die eigentlichen Abrechnungsatome (append-only)
CREATE TABLE reisekosten_abgrenzung (
  id                     BIGINT PRIMARY KEY AUTO_INCREMENT,
  position_id            BIGINT NOT NULL,
  abrechnungsmonat       CHAR(7) NOT NULL,        -- 'YYYY-MM'
  leistungsmonat_original CHAR(7) NULL,           -- gesetzt bei Nachzüglern (§9.3)
  einheiten              INT NOT NULL,
  betrag_minor           BIGINT NOT NULL,
  waehrung               CHAR(3) NOT NULL,
  regel_code             VARCHAR(8) NOT NULL,     -- 'R1'..'R6'
  regel_version          VARCHAR(16) NOT NULL,
  erzeugt_am             DATETIME NOT NULL,
  CONSTRAINT fk_abgr_pos FOREIGN KEY (position_id) REFERENCES reisekosten_position(id)
);

-- Spesen je Reisetag (§5)
CREATE TABLE spesen_tag (
  id                            BIGINT PRIMARY KEY AUTO_INCREMENT,
  reise_id                      BIGINT NOT NULL,
  datum                         DATE NOT NULL,
  land                          CHAR(2) NOT NULL,
  satz_id                       BIGINT NOT NULL,
  mahlzeiten_gestellt           SET('FRUEHSTUECK','MITTAG','ABEND') NULL,
  dieta_kup_minor               BIGINT NOT NULL,   -- INTERN (K9.1)
  dieta_kup_waehrung            CHAR(3) NOT NULL,
  spesen_weiterberechnung_minor BIGINT NOT NULL,   -- EXTERN
  spesen_waehrung               CHAR(3) NOT NULL,
  UNIQUE KEY uq_spesen_tag (reise_id, datum)
);

-- Versionierte Satz-Konfiguration (K10)
CREATE TABLE spesen_satz (
  id               BIGINT PRIMARY KEY AUTO_INCREMENT,
  land             CHAR(2) NOT NULL,
  satz_minor       BIGINT NOT NULL,
  waehrung         CHAR(3) NOT NULL,
  gueltig_von      DATE NOT NULL,
  gueltig_bis      DATE NULL,
  quelle           VARCHAR(255) NOT NULL,
  quelle_abrufdatum DATE NOT NULL
);

-- Monatssperre (§9.1)
CREATE TABLE monatsabschluss (
  mandant_id  BIGINT NOT NULL,
  monat       CHAR(7) NOT NULL,
  status      ENUM('OFFEN','GESPERRT') NOT NULL DEFAULT 'OFFEN',
  rechnung_nr VARCHAR(32) NULL,
  ksef_nr     VARCHAR(64) NULL,
  gesperrt_am DATETIME NULL,
  PRIMARY KEY (mandant_id, monat)
);
```

### 11.1 Warum die Abgrenzung materialisiert wird

`reisekosten_abgrenzung` wird **persistiert, nicht zur Laufzeit berechnet**. Grund: Ändert sich später eine
Regel, dürfen bereits fakturierte Monate sich **nicht rückwirkend verändern**. Die gespeicherte
`regel_version` macht jede historische Rechnung reproduzierbar (K6, append-only).

---

## 12. Algorithmus

```ts
// Alle Datumsarithmetik in Europe/Warsaw.
// K8: Monatsschlüssel als String bauen — NIEMALS über toISOString()/UTC.
//     `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`

function berechneAbgrenzung(
  position: Position,
  reise: Reise,
  modus: 'HYBRID' | 'ANKER',
  regelVersion: string
): Abgrenzung[] {

  // Gate 1 — Weiterberechnungsfähigkeit (§8.1)
  if (!istWeiterberechenbar(position)) return [];

  // Gate 2 — Storno mit Kundenverursachung (§8.2)
  if (position.status === 'STORNIERT') {
    return [zeile(monatVon(position.storno_beleg_datum),
                  1, position.betragMinor, 'R6', regelVersion)];
  }

  // Modus ANKER: alles zum Anker (§4/R6)
  if (modus === 'ANKER') {
    return [zeile(reise.ankerMonat, 1, position.betragMinor, 'R6', regelVersion)];
  }

  switch (position.abgrenzungstyp) {

    case 'PUNKT':                                                   // R1
      return [zeile(monatVon(position.nutzungVon),
                    1, position.betragMinor, 'R1', regelVersion)];

    case 'TEILBAR_TAG':                                             // R2
    case 'TEILBAR_NACHT': {
      const einheiten = position.abgrenzungstyp === 'TEILBAR_NACHT'
        ? tageZwischen(position.nutzungVon, position.nutzungBis)     // Nächte
        : tageZwischen(position.nutzungVon, position.nutzungBis) + 1; // Tage

      const datumsliste = einheitenDaten(position.nutzungVon, einheiten);
      const betraege    = verteileRest(position.betragMinor, einheiten); // §10.3

      return gruppiereNachMonat(datumsliste, betraege)
             .map(g => zeile(g.monat, g.anzahl, g.summe, 'R2', regelVersion));
    }

    case 'UNTEILBAR':                                               // R3
      return [zeile(reise.ankerMonat, 1, position.betragMinor, 'R3', regelVersion)];
  }
}

// Ankermonat der Reise (R3)
function berechneAnkerMonat(reise: Reise, leistungstage: Date[]): string {
  const proMonat = new Map<string, number>();
  for (const t of leistungstage) {
    const m = monatVon(t);
    proMonat.set(m, (proMonat.get(m) ?? 0) + 1);
  }
  const max = Math.max(...proMonat.values());
  const kandidaten = [...proMonat.entries()]
                       .filter(([, n]) => n === max)
                       .map(([m]) => m)
                       .sort();                       // chronologisch
  return kandidaten.length === 1
       ? kandidaten[0]
       : monatVon(reise.reiseVon);                    // Tie-Break: Reisebeginn
}
```

### 12.1 Idempotenz

Ein erneuter Lauf für einen **offenen** Monat muss bit-identische Zeilen erzeugen. Für **gesperrte** Monate
wirft der Lauf einen Fehler und ändert nichts. Beides ist als Test zu führen.

---

## 13. Reports und strukturelle Datentrennung (K9.1)

### 13.1 Getrennte Typen, kein Filter-Flag

```ts
// Kundenseitig — enthält strukturell keine internen Felder
type ReisekostenExportPosition = {
  datum: string;
  bezeichnung: string;
  nutzungVon: string;
  nutzungBis: string;
  einheiten: number;
  betragMinor: number;
  waehrung: string;
  kurs?: { wert: string; datum: string; quelle: 'NBP_TABELA_A' };
  belegNr?: string;
  nachtragZuMonat?: string;
};

// Intern — nie an einen Export-Adapter übergeben
type ReisekostenInternPosition = ReisekostenExportPosition & {
  dietaKupMinor: number;
  vatRefKandidat: boolean;
  vatRefErstattungMinor: number;
  kursdifferenzGrosze: number;
  vorfinanzierungTage: number;
};
```

Die Umwandlung erfolgt über eine **explizite Mapping-Funktion**, nicht durch Weglassen von Feldern beim
Serialisieren. Ein Objekt-Spread vom internen auf den externen Typ ist verboten.

### 13.2 Reportliste

| Report | Adressat | Inhalt |
|---|---|---|
| **Reisekostenaufstellung** | Mandant (Rechnungsanlage) | Positionen des Abrechnungsmonats, Nutzungszeitraum, Einheiten, Betrag, Kurs bei Umrechnung, Belegverweis |
| **Buchungsreport** | `invoice-generator-v3` | aggregierte Positionen je Abrechnungsmonat, MT + Reisekosten + Spesen |
| **Vorfinanzierungsreport** | intern | Positionen mit `zahlung_datum` gesetzt und noch nicht abgerechnet; Summe je Mandant; Alter in Tagen → Grundlage für Vorschussanforderung |
| **VAT-REF-Kandidaten** | intern | je Kalenderjahr und Erstattungsland; Fristen-Alert 30.09. Folgejahr |
| **Abgrenzungsprotokoll** | intern / Prüfung | je Position: angewandte Regel, Regelversion, Splitzeilen, Summenprobe |

---

## 14. Testfälle (Abnahmekriterien)

Alle Daten sind reale Kalendertermine des Mo–Do-Musters KRK↔MUC.

| ID | Sachverhalt | Erwartetes Ergebnis |
|---|---|---|
| **TC-01** | Reise Mo **28.09.2026** → Do **01.10.2026**. Flug LH1627/LH1626, ein Ticket, 420,00 EUR, gebucht und bezahlt **14.08.2026**. | MT: Sept 3, Okt 1 → Anker **2026-09**. `UNTEILBAR` → **eine Zeile: 2026-09, 42 000 Cent**. Kostenbuchung KPiR im **August** (`beleg_datum`). |
| **TC-02** | Gleiche Reise, Hotel Check-in 28.09., Check-out 01.10., 3 Nächte à 149,00 EUR = 447,00 EUR, Zahlung **bei Check-out 01.10.** | Nächte 28.09./29.09./30.09. → **alle 3 in 2026-09**, eine Zeile: 2026-09, 44 700 Cent. Kostenbuchung KPiR im **Oktober**. **Abrechnung und Kostenbuchung fallen auseinander — korrekt.** |
| **TC-03** | Reise Mo **31.08.2026** → Do **03.09.2026**. Hotel 3 Nächte à 149,00 EUR, vorausbezahlt **10.08.** | Nächte 31.08. / 01.09. / 02.09. → **2026-08: 1 Nacht, 14 900** · **2026-09: 2 Nächte, 29 800**. Summe 44 700 ✓ |
| **TC-04** | Gleiche Reise, Flug ein Ticket 420,00 EUR | MT: Aug 1, Sept 3 → Anker **2026-09**. Ganzes Ticket in **2026-09**, obwohl der Hinflug im August lag. |
| **TC-05** | Gleichstand: Reise Mo **29.06.2026** → Do **02.07.2026**, Flug ein Ticket | MT: Juni 2, Juli 2 → Gleichstand → Tie-Break Reisebeginn → Anker **2026-06**. Hotel (3 Nächte 29.06./30.06./01.07.) splittet dagegen **2 Nächte Juni / 1 Nacht Juli**. |
| **TC-06** | Restminoreinheiten: 447,01 EUR auf 3 Nächte | 14 901 / 14 900 / 14 900. Summe = 44 701 ✓ |
| **TC-07** | Taxi Sosnowiec→KRK 180,00 PLN am 28.09., Rechnung in EUR an den Mandanten | `PUNKT` → 2026-09. Umrechnung PLN→EUR mit NBP Tabela A, letzter Werktag September; Kurs + Kursdatum auf der Aufstellung ausgewiesen. |
| **TC-08** | Storno durch Mandanten: Flug 420,00 EUR für Reise ab 28.09. am 20.09. storniert, Stornogebühr 180,00 EUR, `mandant.storno_weiterberechenbar = true` | Ursprungsposition `STORNIERT`, nicht weiterberechnet. Stornogebühr als eigene Position, Abrechnungsmonat = Monat des Storno-Belegs = **2026-09**. |
| **TC-09** | Nachzügler: Hotelrechnung 149,00 EUR für Nacht 30.09. trifft am 12.10. ein, September ist GESPERRT, Schwelle 250 EUR | Aufnahme in **2026-10** mit `leistungsmonat_original = '2026-09'`, getrennter Ausweis auf der Aufstellung. |
| **TC-10** | Idempotenz | Zweiter Lauf für offenen Monat → identische Zeilen. Lauf für gesperrten Monat → Fehler, keine Änderung. |
| **TC-11** | Datentrennung (K9.1) | `ReisekostenExportPosition` enthält kein `dietaKupMinor`, kein `vatRef*`, keine `kursdifferenz*`. Test schlägt fehl, sobald ein internes Feld im Export-Serialisat auftaucht. |
| **TC-12** | Zeitzone | Position mit `nutzung_von = 2026-09-30 23:30 Europe/Warsaw` → Monat **2026-09**, nicht 2026-10 (kein UTC-Umweg). |

---

## 15. Migration (K15 — Expand-Contract)

1. **Master-Freeze** + verifiziertes DB-Backup (K12). Restore einmal testen.
2. **Expand:** neue Felder (`nutzung_von`, `nutzung_bis`, `zahlung_datum`, `abgrenzungstyp`, Status-Felder)
   **nullable** additiv einführen. Tabellen `reisekosten_abgrenzung`, `spesen_satz`, `monatsabschluss` neu anlegen.
3. **Backfill:** Bestandspositionen befüllen. Wo keine Nutzungsdaten vorliegen:
   `nutzung_von = nutzung_bis = beleg_datum`, `abgrenzungstyp = 'PUNKT'`, Flag `backfill_geschaetzt = true`.
   **Bereits fakturierte Monate werden dabei nicht neu abgegrenzt** — sie erhalten eine Abgrenzungszeile, die
   dem historischen Rechnungsstand entspricht (`regel_version = 'LEGACY'`).
4. **Verifikation:** Summenprobe über alle Mandanten und Monate — Positionssumme = Abgrenzungssumme; historische
   Rechnungsbeträge unverändert.
5. **Contract:** Felder auf `NOT NULL` ziehen, Altfelder entfernen — erst nach grüner Verifikation.
6. Je Phase ein **Phase-Freeze**; bei Fehler zurück auf den letzten Freeze.

---

## 16. Offene Entscheidungen (K14 — Freigabe erforderlich)

| # | Entscheidung | Vorschlag | Wirkung |
|---|---|---|---|
| 1 | **Ankermonat-Regel** (R3): Mehrheit der Leistungstage, Tie-Break Reisebeginn | annehmen | bestimmt Monat aller unteilbaren Positionen |
| 2 | **Abgrenzungsmodus** je Mandant | `HYBRID` als Default | Hotel taggenau vs. alles zum Anker |
| 3 | **Nachzügler-Schwelle** (§9.3) | 250 EUR | darunter nächste Rechnung, darüber Nachtragsrechnung |
| 4 | **Auslands-USt** (§7.2) je Mandant | `NETTO_MIT_VATREF` | echter Geldwert; muss in den Vertrag |
| 5 | **PLN→EUR-Kurs** gegenüber Kunden (§6.1) | NBP Tabela A, letzter Werktag des Abrechnungsmonats | muss vertraglich fixiert und auf der Aufstellung ausgewiesen werden |
| 6 | **Storno-Weiterberechnung** je Mandant | vertragsabhängig, Default `false` | ohne Vertragsklausel trägst du das Stornorisiko |
| 7 | **Rechnungslauf-Stichtag** (§9.2) | 5. Werktag des Folgemonats | reduziert Nachzügler strukturell |
| 8 | **Reisetag abrechenbar?** (R4) | vertragsabhängig | beeinflusst den Ankermonat |

Punkte **4, 5 und 6** sind zugleich **Vertragsthemen**, nicht nur Konfiguration. Ohne entsprechende Klausel im
Mandantenvertrag ist die Konfiguration nur eine Behauptung.

### 16.1 Bereits entschieden (v1.1.0)

| # | Entscheidung | Status |
|---|---|---|
| 9 | **Flugrichtung** (§3.2): nach Polen = Rückflug, aus Polen = Hinflug, bei Umstieg letzter Flughafen | ✅ **entschieden** (Account-Inhaber) |
| 10 | **Verfallene Tickets** (§8.1a): abrechenbar bei `DIENSTLICH`/`MANDANT`, nicht bei `KRANKHEIT` | ✅ **entschieden** (Account-Inhaber) |
| — | **Zuordnung monatsübergreifender Belege**: **kein Split**, komplett in den Monat des **Leistungsendes** | ✅ **entschieden + implementiert** → **ADR 0002**, v2.5.5 |

> **Verhältnis Spec ↔ implementierter Stand:** ADR 0002 weicht bewusst von **R2** (Nacht-/Tages-Split) ab —
> der Account-Inhaber hat entschieden, Belege **nie** zu splitten, sondern vollständig dem Monat des
> Leistungsendes zuzuordnen (`checkOutDate ?? date`). Die Split-Regeln R2/R3 dieser Spec bleiben als
> **Zielbild** dokumentiert, sind aber **nicht** implementiert und nicht freigegeben. Wird R2 künftig
> gewünscht, ist das eine neue K14-Entscheidung mit eigenem ADR (supersedes 0002).

---

## 17. Richtlinien-Konformität

| Regel | Umsetzung in dieser Spezifikation |
|---|---|
| **K4** SSoT | Abgrenzungslogik in **einem** geteilten Modul; eine Definition je Kennzahl; NBP-Spec v2.0.0 bleibt SSoT für Kurse |
| **K8** Datentyp-Invarianten | Geld als `BIGINT` in Minoreinheiten · `Europe/Warsaw` · Monatsschlüssel als String · NBP Tabela A als einzige Kursquelle · DE/EN/PL parallel in Report-Labels |
| **K9.1** Strukturelle Datentrennung | getrennte Typen `Export` vs. `Intern`; KUP-Diäten und VAT-REF nie kundenseitig |
| **K6** Versionierung | `reisekosten_abgrenzung` append-only mit `regel_version` |
| **K10** Konfiguration außerhalb des Codes | Modus, Schwellen, Sätze, Stichtage als Konfiguration je Mandant |
| **K13** ADR | je Freigabe aus §16 ein ADR unter `docs/adr/` |
| **K15** Phasen-Rollout | Expand-Contract-Migration (§15) |

### Absicherungspfad Steuerrecht

Der belastbarste Weg ist eine **interpretacja indywidualna** (ORD-IN, 40 zł je Sachverhalt, bis zu 3 Monate
Bearbeitungszeit) zu den Punkten: Zuordnung monatsübergreifender Reisekosten zum Abrechnungsmonat, Behandlung
des Auslagenvorschusses, Weiterberechnungsbasis bei ausländischer Umsatzsteuer. Bis dahin gilt diese
Spezifikation als begründete, dokumentierte Auslegung — nicht als gesicherte Rechtslage.

---

## Anhang — Rechtsgrundlagen (Stand 03.08.2026)

| Thema | Norm |
|---|---|
| Reisekosten als Nebenleistung in der Bemessungsgrundlage | art. 29a ust. 1 i ust. 6 ustawy o VAT |
| Steuerentstehung Leistung / Abrechnungsperiode | art. 19a ust. 1 i ust. 3 ustawy o VAT |
| Rechnungsfristen, 60-Tage-Grenze und deren Ausnahme | art. 106i ust. 1, ust. 7, ust. 8 ustawy o VAT |
| Leistungsort B2B / Reverse Charge | art. 28b ustawy o VAT |
| VAT-UE-Meldezeitpunkt | art. 100 ust. 1 pkt 4 i ust. 11 ustawy o VAT |
| KSeF für ausländische Erwerber | art. 106gb ust. 4 ustawy o VAT |
| Umsatzentstehung bei Abrechnungsperioden | art. 14 ust. 1e ustawy o PIT |
| Anzahlung ist kein Umsatz | art. 14 ust. 3 pkt 1 ustawy o PIT |
| Kostenzeitpunkt KPiR | art. 22 ust. 6b ustawy o PIT |
| Umrechnungskurse | art. 11a ustawy o PIT |
| Diäten als KUP | art. 23 ust. 1 pkt 52 ustawy o PIT |
| Aufwendungsersatz / Vorschuss (bei PL-Vertragsstatut) | art. 742, art. 743 i. V. m. art. 750 KC |
| Aufwendungsersatz / Vorschuss (bei DE-Vertragsstatut) | §§ 669, 670 i. V. m. § 675 BGB |
| VAT-REF-Frist | 30.09. des Folgejahres, nicht verlängerbar |

---

*ProTrackr Reisekosten-Abgrenzung v1.0.0 · ENTWURF · Freigabe nach §16 erforderlich · Änderungen nur nach
CORE §0.7 (Version bumpen + ADR).*
