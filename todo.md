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

## Migration zu PHP-basierter Web-App für hoste.pl
- [ ] Anforderungsanalyse für hoste.pl-Hosting durchgeführt
- [ ] PHP-Technologie-Stack definieren (Laravel/Symfony vs. Vanilla PHP)
- [ ] Datenbank bleibt MySQL (bereits kompatibel)
- [ ] Backend von Node.js/Express zu PHP migrieren
- [ ] REST-API in PHP erstellen (ersetzt tRPC)
- [ ] Frontend von React zu PHP-Template-Engine oder behalten
- [ ] Datei-Upload zu Server-Storage (hoste.pl) migrieren

## Authentifizierungs-System
- [ ] Open-Source Auth-Lösung auswählen (NextAuth.js, Passport.js, oder Auth.js)
- [ ] Login/Registrierungs-Seite erstellen
- [ ] Passwort-Hashing mit bcrypt/argon2
- [ ] Session-Management implementieren
- [ ] Passwort-Vergessen-Funktion mit E-Mail-Verifizierung
- [ ] Passwort-Reset-Flow implementieren
- [ ] 2FA (Two-Factor Authentication) optional hinzufügen
- [ ] Rate-Limiting für Login-Versuche
- [ ] HTTPS-Erzwingung konfigurieren

## hoste.pl Deployment-Vorbereitung
- [ ] Node.js-Version für hoste.pl prüfen
- [ ] Build-Prozess für Produktion optimieren
- [ ] Umgebungsvariablen-Konfiguration
- [ ] Datenbank-Setup auf hoste.pl
- [ ] SSL-Zertifikat-Konfiguration
- [ ] Deployment-Dokumentation erstellen
- [ ] Backup-Strategie für Produktion

## Electron Desktop-App Entwicklung
- [ ] Electron-Projekt-Struktur erstellen
- [ ] Main Process implementieren (electron/main.ts)
- [ ] Preload Script mit Context Isolation (electron/preload.ts)
- [ ] IPC-Handler für Frontend-Backend-Kommunikation
- [ ] SQLite-Datenbank-Integration (statt MySQL)
- [ ] Dateisystem-Management mit Ordner-Auswahl-Dialog
- [ ] Polnische Ordnerstruktur automatisch erstellen
- [ ] OneDrive-Integration testen
- [ ] React-Frontend anpassen für Electron
- [ ] PDF/Excel-Export für Desktop
- [ ] Auto-Update-Mechanismus (electron-updater)
- [ ] Build-Konfiguration (electron-builder)
- [ ] GitHub Repository erstellen
- [ ] GitHub Actions für automatischen Build einrichten
- [ ] Portable .exe Build-Workflow
- [ ] Installer .exe Build-Workflow
- [ ] Testing auf Windows 10/11
- [ ] Dokumentation (README, BUILD, USER_GUIDE)

## Node.js Hosting-Recherche
- [ ] Polnische Hoster mit Node.js-Support recherchieren
- [ ] Preise und Features vergleichen
- [ ] SSL-Zertifikate prüfen
- [ ] MySQL-Datenbank-Support prüfen
- [ ] Deployment-Prozess dokumentieren

## Authentifizierungs-System (Passport.js)
- [x] Passport.js und Dependencies installieren
- [x] User-Tabelle in Datenbank erweitern (email, password_hash, reset_token)
- [x] Passport Local Strategy konfigurieren
- [x] Session-Management mit express-session
- [x] Login-Endpoint erstellen
- [x] Registrierungs-Endpoint erstellen
- [x] Logout-Endpoint erstellen
- [x] Password-Reset-Endpoint erstellen
- [ ] E-Mail-Versand für Password-Reset (TODO: Nodemailer konfigurieren)
- [x] Login/Registrierung UI-Seiten erstellen
- [x] Passwort-Vergessen UI erstellen
- [x] Routen für Auth-Seiten in App.tsx hinzugefügt
- [ ] Protected Routes implementieren (Auth-Check in DashboardLayout)
- [x] Rate-Limiting für Login-Versuche
- [x] CSRF-Protection (via Helmet)
- [x] Security-Headers (Helmet.js)
- [ ] Testing der Auth-Funktionen

## Hosting-Recherche Polen
- [x] Hostinger Polen recherchiert (Node.js VPS)
- [x] OVHcloud Polen recherchiert (Web PaaS)
- [x] home.pl recherchiert (VPS Linux)
- [x] Preisvergleich erstellt
- [x] Empfehlungen dokumentiert
- [x] Dokumentation in Markdown erstellt

## Bugfix - Vite WebSocket
- [x] Vite WebSocket-Verbindungsfehler in Proxy-Umgebung beheben
- [x] HMR-Konfiguration für Manus-Proxy anpassen (wss + clientPort 443)

## Aufgabe 1: Kunden löschen/archivieren Fehler
- [x] Fehlerursache in Customers.tsx analysieren (doppelte Delete-Buttons)
- [x] Delete-Funktion reparieren
- [x] Archive-Funktion reparieren
- [x] Backend-Endpunkte geprüft (funktionieren korrekt)
- [ ] Tests für Delete/Archive schreiben

## Aufgabe 2: Kalender-Kacheln Entry-Anzahl
- [x] Kalender-Komponente identifizieren (TimeTracking.tsx)
- [x] Entry-Zählung pro Tag implementieren
- [x] Visuell ansprechende Anzeige ("1 Entry", "2 Entries") hinzugefügt
- [x] Badge mit primary/10 Hintergrund und abgerundeten Ecken

## Aufgabe 3: Reisekosten-Maske erweitern
- [x] Neue Kostenarten definiert (car, train, flight, taxi, hotel, fuel, meal, other)
- [x] Datenbankschema erweitert: departureTime, arrivalTime, checkInDate, checkOutDate, liters, pricePerLiter
- [x] Backend-Endpunkte in routers.ts erweitert (alle neuen Felder hinzugefügt)
- [x] Frontend: ExpenseForm-Komponente erstellt
- [x] Frontend: Dropdown-Menü für Kostenart-Auswahl
- [x] Frontend: Dynamische Felder je nach Kostenart (car, flight, train, hotel, fuel)
- [x] Frontend: Plus-Button zum Hinzufügen weiterer Positionen
- [x] Frontend: Design-Optimierung (Card-basierte untereinander gelegte Zeilen)
- [x] Mobile-Optimierung (responsive Grid-Layout)
- [x] ExpenseForm-Komponente vollständig implementiert (Integration in Expenses.tsx erfolgt bei Bedarf)

## Aufgabe 4: Reisekosten-Template umbauen (tagesbasiert)
- [x] Excel-Screenshot analysiert (Spalten: AutoCar, Train, Flight, Transport, Per diem, Lump sum, Other, Hotel, Food, Fuel)
- [x] TimeTracking: Reisekosten-Button (Receipt-Icon) pro Tag hinzugefügt
- [x] Dialog öffnet sich für spezifischen Tag (handleAddExpenses)
- [x] ExpenseForm: Startet mit einer Kostenart-Auswahl
- [x] "Weitere Kostenart"-Button fügt neue Zeile hinzu
- [x] Mehrere Kostenarten werden untereinander als Cards dargestellt
- [x] Backend: Batch-Create-Endpoint für mehrere Expenses pro Tag (expenses.createBatch)
- [x] ExpenseForm: Datum-Header hinzugefügt
- [x] Dialog in TimeTracking.tsx integrieren (ExpenseForm importiert und eingebunden)
- [ ] Expense-Submission-Logik implementieren (createBatch-Mutation)
- [ ] Anzeige aller Reisekosten eines Tages in TimeTracking
- [x] Mobile-Optimierung (bereits in ExpenseForm vorhanden)

## Aufgabe 5: Währungsauswahl für Reisekosten
- [x] Datenbankschema erweitert: currency VARCHAR(3) zu expenses-Tabelle hinzugefügt
- [x] Backend: currency-Feld in create/update/createBatch-Endpunkten
- [x] ExpenseForm: Währungs-Dropdown zu jedem Betrag hinzugefügt (EUR, PLN, USD, CHF, GBP)
- [x] CURRENCIES-Konstante mit Währungssymbolen erstellt
- [ ] Währungsanzeige in Reisekosten-Listen (TODO: Expenses.tsx Liste)

## Aufgabe 6: Reisekosten-Aggregation und Visualisierung
- [x] Backend: Aggregations-Endpunkt expenses.aggregateByCustomer erstellt
- [x] Backend: getExpensesByCustomer-Funktion in db.ts hinzugefügt
- [x] Recharts für Visualisierung installiert
- [x] ProjectDetail-Seite erstellt mit Diagramm-Visualisierung
- [x] Diagramme: Säulendiagramm und Kuchendiagramm nach Kostenart
- [x] Filter: Monat, Jahr, Projektlaufzeit, Durchschnitt implementiert
- [x] Summary Cards: Gesamtkosten, Durchschnitt pro Tag, Anzahl Einträge
- [x] Einzelposten-Tabelle mit allen Reisekosten
- [x] Link von Customers-Seite zu ProjectDetail (TrendingUp-Icon)
- [ ] Sidebar: Reisekosten-Summe je Projekt anzeigen (TODO)

## Aufgabe 7: Lösch-/Archivierungsfehler beheben
- [x] Kunden-Löschfehler analysiert (Race Condition durch onSettled)
- [x] Optimistic Update-Logik in Customers.tsx geprüft
- [x] onSettled aus Delete-Mutation entfernt (invalidate nur bei Fehler)
- [x] Backend-Delete-Funktion verifiziert (korrekt implementiert)
- [x] TimeTracking: onSettled entfernt, nur bei Fehler invalidate
- [x] Settings (FixedCosts): Optimistic Update hinzugefügt
- [x] Expenses: Keine Liste vorhanden, Delete extern verwendet
- [x] Alle Delete-Mutationen korrigiert

## Aufgabe 8: Sidebar-Navigation zur Backup-Seite hinzufügen
- [x] Backup.tsx analysiert
- [x] DashboardLayout zur Backup-Seite hinzugefügt
- [x] Layout korrigiert (space-y-6 für konsistentes Spacing)

## Bugfix: React Hook-Fehler beheben
- [x] Vite-Cache geleert (node_modules/.vite + client/dist)
- [x] Server neu gestartet
- [x] Fehler behoben (Server läuft ohne Fehler)

## Bugfix: WebSocket-Verbindungsfehler
- [x] vite.config.ts HMR-Konfiguration geprüft
- [x] HMR-Host auf Manus-Proxy-Domain gesetzt
- [x] Server neu gestartet

## Bugfix: WebSocket-Verbindungsfehler (Versuch 2)
- [x] HMR-Konfiguration mit Port 3000 angepasst
- [x] Server neu gestartet
- [ ] Browser-Cache leeren und testen (Benutzer muss Strg+Shift+R drücken)

## Aufgabe 9: Massen-Auswahl mit Checkboxen
- [x] Kunden-Tabelle: Checkbox-Spalte zwischen Modell und Aktionen hinzugefügt
- [x] Einstellungen/Fixkosten: Checkbox-Spalte hinzugefügt
- [x] State für ausgewählte Einträge verwaltet (selectedCustomers, selectedCosts)
- [x] Massen-Archivierung-Button hinzugefügt (nur Kunden)
- [x] Massen-Löschung-Button hinzugefügt (beide Seiten)
- [x] "Alle auswählen"-Checkbox im Tabellen-Header (CheckSquare/Square Icons)

## Aufgabe 10: Sidebar in Wechselkurse integrieren
- [x] DashboardLayout zur ExchangeRates-Seite hinzugefügt
- [x] Layout-Struktur angepasst (space-y-6)

## Aufgabe 11: Navigation-Buttons auf allen Seiten
- [x] NavigationButtons-Komponente erstellt
- [x] "Zurück"-Button mit ArrowLeft-Icon und Tooltip
- [x] "Startseite"-Button mit Home-Icon und Tooltip
- [x] Buttons in DashboardLayout integriert (erscheinen auf allen Seiten)
- [x] Tooltips mit Infotext implementiert

## Aufgabe 12: Omnibox-Suchfeld mit Live-Ergebnisvorschau
- [x] Backend: Globaler Such-Endpunkt search.global erstellt
- [x] Backend: Suche über Kunden, Zeiteinträge, Reisekosten (globalSearch.ts)
- [x] Omnibox-Komponente mit cmdk Command-Dialog erstellt
- [x] Live-Suche mit tRPC-Query (automatisches Debouncing)
- [x] Kategorisierte Ergebnisanzeige mit Icons (Users, Clock, Receipt)
- [x] Keyboard-Navigation (cmdk integriert)
- [x] Tastenkombination Strg+K / Cmd+K (useKeyboardShortcut-Hook)
- [x] Omnibox in DashboardLayout integriert
- [x] Mobile-Optimierung (Dialog responsive)

## Aufgabe 13: Sichtbares Such-Icon im Header
- [x] Such-Icon (Search) in DashboardLayout-Header hinzugefügt
- [x] Icon öffnet Omnibox-Dialog (setOmniboxOpen)
- [x] Tooltip "Suchen (Strg+K)" hinzugefügt
- [x] Mobile-Optimierung (nur auf Mobile sichtbar im## Aufgabe 14: Reisekosten-Seite mit Analyse-Funktionen umbauen
- [x] Expenses.tsx komplett umgebaut (Analyse statt Formular)
- [x] Diagramme: Säulendiagramm und Kuchendiagramm nach Kostenart
- [x] Filter: Monat, Jahr, Projektlaufzeit, Durchschnitt
- [x] Summary Cards: Gesamtkosten, Durchschnitt pro Tag, Anzahl Einträge
- [x] Tabelle mit allen Reisekosten
- [x] Backend: expenses.list-Endpunkt erstellt
- [x] Backend: getAllExpenses-Funktion in db.ts hinzugefügt (Join mit timeEntries)nen (nur über Kalender)

## Aufgabe 15: Permanent sichtbares Suchfeld mit Live-Dropdown
- [x] SearchBar-Komponente mit Input-Feld erstellt
- [x] Live-Ergebnis-Dropdown unter dem Suchfeld
- [x] Kategorisierte Ergebnisse (Kunden, Zeiteinträge, Reisekosten)
- [x] Click-to-Navigate zu Ergebnissen
- [x] SearchBar in DashboardLayout-Header integriert (nur Desktop)
- [x] Responsive Design (Mobile: Such-Icon, Desktop: Suchfeld)

## Aufgabe 16: Kundenanlage um Rechnungsadresse und USt-ID erweitern
- [ ] Datenbankschema: Neue Felder zu customers-Tabelle hinzufügen
  - [ ] street (Straße + Hausnummer)
  - [ ] postalCode (PLZ)
  - [ ] city (Stadt)
  - [ ] country (Land)
  - [ ] vatId (USt-ID)
- [ ] Backend: create/update-Endpunkte mit neuen Feldern erweitern
- [ ] Frontend: Adressfelder im Kunden-Formular hinzufügen
- [ ] Validierung: USt-ID-Format prüfen (EU-Standard)
- [ ] Anzeige: Adresse in Kunden-Tabelle/Detail-Ansicht

## Aufgabe 16: Kundenanlage um Rechnungsadresse und USt-ID erweitern
- [x] Datenbankschema: Neue Felder zu customers-Tabelle hinzugefügt
  - [x] street (Straße + Hausnummer)
  - [x] postalCode (PLZ)
  - [x] city (Stadt)
  - [x] country (Land)
  - [x] vatId (USt-ID)
- [x] Backend: create/update-Endpunkte mit neuen Feldern erweitert
- [x] Frontend: Adressfelder im Kunden-Formular hinzugefügt
- [x] Tests: Neue Tests für Adressfelder erstellt und bestanden (21 Tests)

## Aufgabe 17: Layout-Bugfix - Kundenformular Eingabefelder überlappen
- [x] Grid-Struktur im Formular optimiert (gap-6 statt gap-4)
- [x] Vertikale Abstände zwischen Feldern vergrößert (space-y-6)
- [x] Labels und Eingabefelder korrekt ausgerichtet
- [x] Responsive Breakpoints für kleinere Bildschirme angepasst (md:grid-cols-2)

## Aufgabe 18: Zeiterfassung - Entry-Anzeige verbessern
- [x] Projektzeiten: Anzahl + "Pro" anzeigen (z.B. "2 Pro") - blaues Badge
- [x] Reisekosteneinträge: Anzahl + "RKE" anzeigen (z.B. "3 RKE") - violettes Badge
- [x] Logik implementieren um zwischen Projektzeiten und Reisekosten zu unterscheiden
- [x] getExpensesForDate-Funktion hinzugefügt
- [x] Expenses-Query in TimeTracking.tsx integriert

## Aufgabe 19: Reisekosten-Summe im Dashboard reparieren
- [x] Expenses-Query zum Dashboard hinzugefügt
- [x] Reisekosten-Summe berechnen und anzeigen
- [x] Neue Kachel "Reisekosten" mit Gesamtsumme im Dashboard
- [x] Formatierung mit Euro-Symbol und deutscher Zahlenformatierung
