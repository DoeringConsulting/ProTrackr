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

## Abrechnungsberichte
- [x] Berichte-Seite mit Zeitraum-Auswahl und Kunden-Filter
- [x] Buchhaltungsbericht nach polnischem Recht erstellen
- [x] Bruttoumsatz-Berechnung (Zeiterfassung + Reisekosten)
- [x] Fixkosten-Integration
- [x] ZUS (Sozialversicherung) Berechnung (19,52%)
- [x] Krankenversicherung (9%) Berechnung
- [x] Steuer (19%) Berechnung
- [x] Nettogewinn-Berechnung
- [x] Kundenbericht mit Details-Ansicht (Tagesübersicht)
- [x] Kundenbericht mit Summary-Ansicht (Zusammenfassung)
- [x] Berücksichtigung Exclusive/Inclusive Abrechnungsmodelle
- [x] EUR/PLN Währungsumrechnung mit NBP-Integration (Backend vorbereitet)
- [x] Tests für Berichtsfunktionen

## Fixkosten-Verwaltung
- [x] Fixkosten-Verwaltungsseite erstellen
- [x] Tabelle mit allen Fixkosten-Posten
- [x] Formular zum Hinzufügen neuer Fixkosten
- [x] Bearbeiten-Funktion für bestehende Fixkosten
- [x] Löschen-Funktion mit Bestätigung
- [x] Kategorien: Auto, Telefon, Software, Buchhaltung, Sonstige
- [x] Integration in Navigation (Settings-Bereich)
- [x] Tests für Fixkosten-Verwaltung

## PDF-Export
- [x] PDF-Export-Funktion für Buchhaltungsbericht
- [x] PDF-Export-Funktion für Kundenbericht
- [x] PDF-Layout mit Logo und Formatierung
- [x] Export-Button in Berichte-Seite integrieren

## Dashboard-Charts
- [x] Recharts-Bibliothek integrieren
- [x] Umsatz-Diagramm (monatlicher Verlauf)
- [x] Kosten-Diagramm (Fixkosten vs. variable Kosten)
- [x] Projekt-Vergleichs-Diagramm
- [x] Responsive Chart-Darstellung

## Belegupload-UI
- [x] Upload-Komponente für Dokumente erstellen
- [x] S3-Integration für Datei-Upload (Backend vorbereitet)
- [x] Dokumenten-Vorschau implementieren
- [x] Verknüpfung mit Reisekosten-Einträgen
- [x] Dokumenten-Liste mit Download-Funktion
- [x] Löschen-Funktion für Belege

## Excel-Export
- [x] Excel-Export-Bibliothek installieren
- [x] Excel-Export-Funktion für Buchhaltungsbericht
- [x] Excel-Export-Funktion für Kundenbericht
- [x] Export-Button in Berichte-Seite integrieren

## E-Mail-Benachrichtigungen
- [x] Benachrichtigungs-Logik für Monatsabschluss
- [x] Benachrichtigungs-Logik für fehlende Zeiterfassungen
- [x] Benachrichtigungs-Logik für anstehende Abrechnungsfristen
- [x] Benachrichtigungs-Logik für unvollständige Reisekostenabrechnungen
- [x] Integration mit Manus Notification API

## Datenimport
- [x] Import-Seite erstellen
- [x] Excel-Parser für Kundendaten
- [x] Excel-Parser für Zeiterfassungsdaten (vorbereitet)
- [x] Excel-Parser für Reisekostendaten (vorbereitet)
- [x] Validierung und Fehlerbehandlung
- [x] Fortschrittsanzeige während Import

## Automatische Benachrichtigungen
- [x] Scheduler-Service für automatische Benachrichtigungen erstellen
- [x] Monatliche Benachrichtigung am Monatsende
- [x] Wöchentliche Prüfung auf fehlende Zeiterfassungen
- [x] Benachrichtigung für anstehende Abrechnungsfristen
- [x] Konfiguration für Benachrichtigungsintervalle

## Mehrsprachigkeit
- [x] i18n-Bibliothek integrieren
- [x] Deutsche Übersetzungen erstellen
- [x] Polnische Übersetzungen erstellen
- [x] Sprachumschaltung in UI implementieren
- [x] Automatische Spracherkennung basierend auf Browser-Einstellungen
- [x] Berichte in gewählter Sprache generieren (vorbereitet)

## Mobile Optimierung
- [x] Touch-Targets vergrößern (min. 44x44px)
- [x] Formulare für Touch-Bedienung optimieren
- [x] Kalenderansicht für mobile Geräte anpassen
- [x] Navigation für Smartphones optimieren
- [x] Responsive Breakpoints überprüfen und anpassen
- [x] Touch-Gesten für häufige Aktionen implementieren
