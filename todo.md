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

## Cron-Job für Benachrichtigungen
- [x] Public Endpoint für Scheduler erstellen
- [x] API-Key-Authentifizierung für Scheduler-Endpoint
- [x] Dokumentation für Cron-Job-Konfiguration
- [x] Fehlerbehandlung und Logging

## Erweiterte Währungsumrechnung
- [x] NBP-API für alle verfügbaren Währungen erweitern (13 Währungen)
- [x] Währungsauswahl in Berichten integrieren (Backend vorbereitet)
- [x] Automatische Wechselkurs-Abfrage für gewähltes Datum
- [x] Währungsumrechnung in Buchhaltungsbericht anzeigen (Backend vorbereitet)
- [x] Historische Wechselkurse speichern

## Backup-Funktion
- [x] Datenbank-Export als JSON implementieren
- [x] Backup-Seite in UI erstellen
- [x] Download-Funktion für Backup-Dateien
- [x] Automatisches Backup mit Zeitplan (via Cron-Job)
- [x] Wiederherstellungs-Funktion (Import)

## Vollständige Offline-Funktionalität
- [x] Service Worker für Offline-Caching implementieren (vorbereitet)
- [x] IndexedDB für lokale Datenspeicherung einrichten
- [x] Lokales Dateisystem für Belege und Reports (File System Access API)
- [x] Ordnerstruktur: Jahr/Monat/Kategorie (Rechnungen, Berichte, Reisekosten, Belege, Backups)
- [x] Synchronisierungslogik für Online/Offline-Modus
- [x] Offline-Indikator in UI anzeigen
- [x] Ordnerauswahl-Dialog beim ersten Start
- [x] Manuelle Währungsaktualisierung im Offline-Modus (Wechselkurs-Verwaltungsseite)
- [x] Automatische Synchronisierung bei Internet-Verbindung
- [x] Integration von lokalem Dateisystem in Backup, PDF-Export und Excel-Export
- [ ] OneDrive-Synchronisierung (erfolgt automatisch wenn Ordner in OneDrive gewählt wird)

## Polnische Ordnerbezeichnungen
- [x] Ordnernamen in fileSystem.ts auf Polnisch ändern
- [x] Rechnungen → Faktury
- [x] Berichte → Raporty
- [x] Reisekosten → Koszty_podrozy
- [x] Belege → Dokumenty
- [x] Backups → Kopie_zapasowe
- [x] Monatsnamen auf Polnisch (Styczen, Luty, Marzec, etc.)

## Service Worker
- [x] Service Worker Datei erstellen
- [x] Offline-Caching für alle App-Ressourcen
- [x] Service Worker in Produktion registrieren
- [x] Cache-Strategie implementieren (Network First mit Fallback)

## Rechnungsnummern-Generator
- [x] Datenbankschema für Rechnungsnummern erweitern
- [x] Automatischer Generator mit Jahres-Präfix
- [x] Fortlaufende Nummerierung pro Jahr
- [x] Format: YYYY-NNN (z.B. 2026-001)
- [x] Integration in Kundenbericht (Backend vorbereitet)
- [x] tRPC-Procedures für Generierung und Abruf

## Projekt-Archivierung
- [x] Archivierungs-Status zu Kunden-Schema hinzufügen
- [x] Archivierungs-Button in Kundenverwaltung
- [x] Filter für aktive/archivierte Projekte
- [x] Archivierte Projekte aus Dashboard ausblenden (Filter implementiert)
- [x] Archivierte Projekte in Berichten verfügbar halten
- [x] Wiederherstellungs-Funktion für archivierte Projekte

## Bugfixes - iframe-Kompatibilität
- [x] File System Access API durch Download-API ersetzen (iframe-Kompatibilität)
- [x] Automatische Downloads mit polnischer Ordnerstruktur im Dateinamen
- [x] OneDrive-Synchronisierung über Browser-Download-Ordner ermöglichen
- [x] Ordnerauswahl-Dialog entfernen und durch Download-basierte Lösung ersetzen
- [x] Info-Dialog für Download-basierte Speicherung implementiert

## Bugfixes - Wechselkurse
- [x] SQL INSERT-Fehler in exchangeRates Tabelle beheben (Upsert-Logik implementieren)
- [x] Datenbankschema für exchangeRates überprüfen und korrigieren
- [x] Unique constraint auf date+currencyPair statt nur date
- [x] Upsert-Logik in createExchangeRate implementiert

## Features - Wechselkurse
- [x] Aktuellen Wechselkurs neben Währungsauswahl anzeigen
- [x] Kurs-Anzeige mit Quelle (NBP/Manuell) Badge

## Anpassungen - Wechselkurse
- [x] Währungsliste auf 4 Währungen reduziert (EUR, USD, CHF, GBP)
- [x] Bug behoben: Wechselkurs wird jetzt angezeigt bei manueller Datumsänderung
- [x] useEffect hinzugefügt um Daten bei Datums-/Währungsänderung neu zu laden
- [x] currentRate-Berechnung funktioniert jetzt dynamisch

## Bugfixes - Kunden & Steuern
- [x] "Neuer Kunde" Button öffnet kein Dialog-Fenster - Pop-up für Kundenstammdatenanlage implementiert
- [x] Steuerberechnung flexibel gestalten - variable Prozentsätze oder feste Beträge ermöglicht
- [x] Steuerkonfiguration in Einstellungen implementiert
- [x] taxSettings Tabelle in Datenbank erstellt
- [x] Backend-Funktionen für Steuereinstellungen implementiert
- [x] Steuereinstellungen-Seite mit UI erstellt
- [x] Dashboard und Reports verwenden konfigurierbare Steuersätze
- [x] Tests für taxSettings Router geschrieben und bestanden

## Kritische Bugfixes - Produktionsversion
- [x] "Neuer Kunde" Button öffnet kein Fenster - Dialog Handler korrigiert
- [x] Zeiteinträge werden am falschen Tag gespeichert - Timezone-Konvertierung behoben
- [x] Datumsfeld in Zeiterfassung zeigt falsches Datum - entfernt
- [x] Datumsfeld in Zeiterfassung entfernt - Datum wird in DialogDescription angezeigt
- [x] Timezone/UTC-Konvertierung bei Datumsspeicherung korrigiert - lokale Zeitzone verwendet
- [x] handleDialogOpenChange und handleDialogClose getrennt für korrekte Dialog-Steuerung
- [x] Datums-Vergleich ohne UTC-Konvertierung für korrekte Anzeige der Einträge
- [ ] Löschungen werden bestätigt aber nicht ausgeführt - Backend-Funktionen korrekt, möglicherweise Caching-Problem in Produktion

## Kritischer Bugfix - Löschfunktion
- [x] Löschungen werden visuell bestätigt aber nicht in Datenbank ausgeführt - behoben
- [x] Backend-Löschfunktionen mit Logging erweitert
- [x] Optimistic Updates für Löschungen implementiert (Customers, TimeEntries)
- [x] onMutate/onError/onSettled Pattern für robuste Löschungen
- [x] Rollback-Mechanismus bei Fehlern implementiert

## Feature - Bulk-Zeiterfassung
- [x] Funktion zum Kopieren von Zeiteinträgen auf mehrere Tage implementiert
- [x] UI mit Kalender-Auswahl für mehrere Tage
- [x] Backend-Endpoint bulkCreate für Bulk-Erstellung von Zeiteinträgen
- [x] Copy-Button bei jedem Zeiteintrag (erscheint bei Hover)
- [x] Dialog zur Auswahl der Ziel-Tage mit visueller Bestätigung
- [x] Validierung und Fehlerbehandlung für Bulk-Operationen

## Feature - Ordnerstruktur Erweiterung
- [x] Neuen Ordner für Überweisungsbestätigungen/Zahlungseingänge hinzugefügt
- [x] Polnischen Ordnernamen definiert: "Potwierdzenia_przelewow"
- [x] Dateinamen-Logik für Zahlungsbestätigungen implementiert
- [x] fileSystem.ts erweitert um neuen Ordner-Typ
- [x] Kategorie in allen Funktionen hinzugefügt (generateStructuredFilename, saveFileToLocal, ensureDirectoryStructure, readFileFromLocal)
- [x] TypeScript-Typen aktualisiert
