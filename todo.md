# Project TODO

## Datenmodell und Backend
- [x] Datenbankschema für Kunden mit Stammdaten erstellen
- [x] Datenbankschema für Zeiterfassung erstellen
- [x] Datenbankschema für Reisekosten erstellen
- [x] Datenbankschema für Wechselkurse erstellen
- [x] Datenbankschema für Fixkosten erstellen
- [x] Datenbankschema für Belege/Dokumente erstellen
- [x] tRPC-Procedures für Kundenverwaltung (CRUD) implementieren
- [x] tRPC-Procedures für Zeiterfassung implementieren
- [x] tRPC-Procedures für Reisekostenerfassung implementieren
- [x] NBP-Wechselkurs-API Integration implementieren
- [ ] Abrechnungslogik für Exclusive-Modell implementieren
- [ ] Abrechnungslogik für Inclusive-Modell implementieren
- [ ] Buchhaltungsbericht-Logik nach polnischem Recht implementieren

## UI/UX
- [x] Dashboard-Layout mit Sidebar-Navigation erstellen
- [x] Dashboard-Übersicht mit Projekten, Umsatz und Kosten
- [x] Kundendatenbank-Seite mit Tabelle und Such-/Filterfunktion
- [x] Kunden-Formular für Erstellen/Bearbeiten
- [ ] Zeiterfassung mit Kalenderansicht (Monatsansicht)
- [ ] Tageserfassung-Formular für Stunden und Projektdetails
- [ ] Reisekosten-Formular mit allen Kategorien
- [ ] Belegverwaltung mit Upload-Funktion
- [ ] Abrechnungsübersicht-Seite
- [ ] Buchhaltungsbericht-Ansicht
- [ ] Kundenbericht-Ansicht (Details und Summary)

## Export und Berichte
- [ ] PDF-Export für Buchhaltungsbericht
- [ ] PDF-Export für Kundenbericht
- [ ] Excel-Export für Buchhaltungsbericht
- [ ] Excel-Export für Kundenbericht

## Benachrichtigungen
- [ ] E-Mail-Benachrichtigung bei Monatsabschluss
- [ ] E-Mail-Benachrichtigung bei fehlenden Zeiterfassungen
- [ ] E-Mail-Benachrichtigung bei anstehenden Abrechnungsfristen
- [ ] E-Mail-Benachrichtigung bei unvollständigen Reisekostenabrechnungen

## Testing
- [ ] Unit-Tests für Kundenverwaltung
- [ ] Unit-Tests für Zeiterfassung
- [ ] Unit-Tests für Reisekostenerfassung
- [ ] Unit-Tests für Abrechnungslogik
- [ ] Unit-Tests für Währungsumrechnung

## Bugfixes
- [x] require() Fehler in tRPC-Procedures beheben (Zod-Import)

## Zeiterfassung
- [x] Kalenderkomponente mit Monatsansicht erstellen
- [x] Tageserfassung-Formular mit Projekt-Zuordnung
- [x] Onsite/Remote/Off duty/Business trip Status-Auswahl
- [x] Automatische Manntage-Berechnung (1h = 0,125 MT)
- [x] Automatische Tagessatz-Berechnung basierend auf Kundenstammdaten
- [x] Monatsnavigation (vor/zurück)
- [x] Tagesdetails anzeigen und bearbeiten

## Bugfixes (aktuell)
- [x] tRPC API gibt HTML statt JSON zurück auf Zeiterfassungsseite (durch Server-Neustart behoben)

## Reisekostenverwaltung
- [x] Reisekosten-Formular mit allen Kategorien erstellen
- [x] Distanz-Eingabe mit automatischer km-Pauschalen-Berechnung
- [x] Transport-Kategorien (Auto, Zug, Flug, Transport)
- [x] Unterkunft und Verpflegung (Hotel, Gastronomie, Verpflegungspauschale)
- [x] Treibstoff und sonstige Kosten
- [x] Belegupload-Funktion mit S3-Integration (Backend vorbereitet)
- [x] Verknüpfung mit Zeiteinträgen
- [x] Reisekosten-Übersicht mit Filter und Suche
- [x] Automatische Berechnung der Gesamtkosten
- [x] Tests für Reisekostenverwaltung
