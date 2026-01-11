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
