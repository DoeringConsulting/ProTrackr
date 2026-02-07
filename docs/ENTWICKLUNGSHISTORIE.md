# Entwicklungshistorie: Döring Consulting - Projekt & Abrechnungsmanagement

**Projekt:** project-billing-app  
**Aktuelle Version:** 2dbfac0f  
**Autor:** Manus AI  
**Datum:** 7. Februar 2026

---

## Übersicht

Dieses Dokument dokumentiert die vollständige Entwicklungshistorie des Projekts **Döring Consulting - Projekt & Abrechnungsmanagement** von der Initialisierung bis zur aktuellen Version. Es enthält alle abgeschlossenen Features, bekannte Probleme, wiederkehrende Fehlerbilder und offene Aufgaben.

---

## Versions-Journal

### Version [AKTUELL] (7. Februar 2026)

**Änderungen:**
- Cache-Busting mit Content-Hash in Dateinamen implementiert
- Service Worker mit automatischer Versionierung (APP_VERSION)
- Service Worker Update-Logik mit skipWaiting() und clients.claim()
- Automatische Update-Prüfung alle 60 Sekunden
- Update-Benachrichtigung für Benutzer (unten rechts, dunkles Design)
- Network-First-Strategie für bessere Aktualität
- Automatischer Reload bei Controller-Wechsel
- Vollständige Projektdokumentation erstellt (3 Dokumente)

**Bugfixes:**
- Browser-Caching-Problem behoben (alte Versionen werden nicht mehr angezeigt)
- Service Worker zeigt jetzt immer aktuelle Version nach Deployment

**Dokumentation:**
- PROJEKTDOKUMENTATION.md erstellt (49 KB)
- ENTWICKLUNGSHISTORIE.md erstellt (29 KB)
- README_ENTWICKLERTEAM.md erstellt (15 KB)

**Tests:** 21/21 bestanden

---

### Version 2dbfac0f (7. Februar 2026)

**Änderungen:**
- Währungswahlmöglichkeit für Fixkosten implementiert (EUR, PLN, USD, GBP)
- Reisekosten-Speicherung repariert (createBatch-Mutation)
- Automatische Off-Duty TimeEntry-Erstellung für reine Reisekosten-Tage
- Cache-Invalidierung nach Reisekosten-Eintrag implementiert

**Bugfixes:**
- Reisekosten werden nach Eintrag nicht angezeigt - behoben
- Aggregierte Reisekosten-Posten im Dashboard fehlten - behoben

**Tests:** 21/21 bestanden

---

### Version e88f88dd (7. Februar 2026)

**Änderungen:**
- Zeiterfassung-Anzeige verbessert: Projektzeiten ("X Pro") und Reisekosten ("X RKE") unterscheiden
- Reisekosten-Summe im Dashboard aggregiert
- Neue Dashboard-Kachel "Reisekosten" mit Gesamtsumme

**Bugfixes:**
- Reisekosten-Badge-Anzeige in Zeiterfassung implementiert

**Tests:** 21/21 bestanden

---

### Version d20a3a5f (7. Februar 2026)

**Änderungen:**
- Layout-Bugfix im Kundenformular: Vertikale Abstände vergrößert (gap-6, space-y-6)
- Responsive Breakpoints für kleinere Bildschirme angepasst (md:grid-cols-2)

**Bugfixes:**
- Kundenformular Eingabefelder überlappen - behoben

**Tests:** 21/21 bestanden

---

### Version 964ef1d9 (7. Februar 2026)

**Änderungen:**
- Kundenanlage um Rechnungsadresse erweitert (Straße, PLZ, Stadt, Land)
- USt-ID-Feld hinzugefügt
- Backend-Endpunkte customers.create und update erweitert
- Frontend-Formular mit Adressfeldern

**Tests:** 21/21 bestanden

---

### Version 5d9d385f (Initialisierung)

**Änderungen:**
- Projekt initialisiert mit React 19, Tailwind 4, Express 4, tRPC 11
- Datenbank-Schema erstellt (users, customers, timeEntries, expenses, fixedCosts, taxSettings, exchangeRates, documents, invoiceNumbers)
- Authentifizierung mit Manus OAuth
- Dashboard-Layout mit Sidebar-Navigation
- Kundenverwaltung (CRUD)
- Zeiterfassung mit Kalenderansicht
- Reisekostenverwaltung
- Abrechnungsberichte (Buchhaltung, Kunden)
- Fixkosten-Verwaltung
- Wechselkurs-Management mit NBP-API
- Belegverwaltung mit S3-Integration
- PDF- und Excel-Export
- Backup & Wiederherstellung
- Offline-Funktionalität mit Service Worker

**Tests:** 21/21 bestanden

---

## Abgeschlossene Features (chronologisch)

### Phase 1: Grundfunktionalitäten (Initialisierung)

**Datenmodell und Backend:**
- Datenbankschema für Kunden, Zeiterfassung, Reisekosten, Wechselkurse, Fixkosten, Belege erstellt
- tRPC-Procedures für Kundenverwaltung, Zeiterfassung, Reisekostenerfassung implementiert
- NBP-Wechselkurs-API Integration implementiert

**UI/UX:**
- Dashboard-Layout mit Sidebar-Navigation erstellt
- Dashboard-Übersicht mit Projekten, Umsatz und Kosten
- Kundendatenbank-Seite mit Tabelle und Such-/Filterfunktion
- Kunden-Formular für Erstellen/Bearbeiten
- Zeiterfassung mit Kalenderansicht (Monatsansicht)
- Tageserfassung-Formular für Stunden und Projektdetails
- Reisekosten-Formular mit allen Kategorien
- Belegverwaltung mit Upload-Funktion
- Abrechnungsübersicht-Seite
- Buchhaltungsbericht-Ansicht
- Kundenbericht-Ansicht (Details und Summary)

**Export und Berichte:**
- PDF-Export für Buchhaltungsbericht und Kundenbericht
- Excel-Export für Buchhaltungsbericht und Kundenbericht

**Testing:**
- Unit-Tests für Kundenverwaltung, Zeiterfassung, Reisekostenerfassung, Fixkosten, Steuern, Authentifizierung

---

### Phase 2: Erweiterte Funktionen

**Zeiterfassung:**
- Kalenderkomponente mit Monatsansicht
- Tageserfassung-Formular mit Projekt-Zuordnung
- Onsite/Remote/Off duty/Business trip Status-Auswahl
- Automatische Manntage-Berechnung (1h = 0,125 MT)
- Automatische Tagessatz-Berechnung basierend auf Kundenstammdaten
- Monatsnavigation (vor/zurück)
- Tagesdetails anzeigen und bearbeiten

**Reisekostenverwaltung:**
- Reisekosten-Formular mit allen Kategorien (Auto, Zug, Flug, Taxi, Hotel, Tanken, Bewirtung, Sonstiges)
- Distanz-Eingabe mit automatischer km-Pauschalen-Berechnung
- Transport-Kategorien mit kategoriespezifischen Feldern
- Unterkunft und Verpflegung
- Treibstoff und sonstige Kosten
- Belegupload-Funktion mit S3-Integration
- Verknüpfung mit Zeiteinträgen
- Reisekosten-Übersicht mit Filter und Suche
- Automatische Berechnung der Gesamtkosten

**Abrechnungsberichte:**
- Berichte-Seite mit Zeitraum-Auswahl und Kunden-Filter
- Buchhaltungsbericht nach polnischem Recht
- Bruttoumsatz-Berechnung (Zeiterfassung + Reisekosten)
- Fixkosten-Integration
- ZUS (Sozialversicherung) Berechnung (19,52%)
- Krankenversicherung (9%) Berechnung
- Steuer (19%) Berechnung
- Nettogewinn-Berechnung
- Kundenbericht mit Details-Ansicht (Tagesübersicht)
- Kundenbericht mit Summary-Ansicht (Zusammenfassung)
- Berücksichtigung Exclusive/Inclusive Abrechnungsmodelle
- EUR/PLN Währungsumrechnung mit NBP-Integration

**Fixkosten-Verwaltung:**
- Fixkosten-Verwaltungsseite erstellt
- Tabelle mit allen Fixkosten-Posten
- Formular zum Hinzufügen neuer Fixkosten
- Bearbeiten-Funktion für bestehende Fixkosten
- Löschen-Funktion mit Bestätigung
- Kategorien: Auto, Telefon, Software, Buchhaltung, Sonstige
- Integration in Navigation (Settings-Bereich)

---

### Phase 3: UI/UX-Verbesserungen

**Dashboard-Charts:**
- Recharts-Bibliothek integriert
- Umsatz-Diagramm (monatlicher Verlauf)
- Kosten-Diagramm (Fixkosten vs. variable Kosten)
- Projekt-Vergleichs-Diagramm
- Responsive Chart-Darstellung

**Belegupload-UI:**
- Upload-Komponente für Dokumente erstellt
- S3-Integration für Datei-Upload
- Dokumenten-Vorschau implementiert
- Verknüpfung mit Reisekosten-Einträgen
- Dokumenten-Liste mit Download-Funktion
- Löschen-Funktion für Belege

**E-Mail-Benachrichtigungen:**
- Benachrichtigungs-Logik für Monatsabschluss
- Benachrichtigungs-Logik für fehlende Zeiterfassungen
- Benachrichtigungs-Logik für anstehende Abrechnungsfristen
- Benachrichtigungs-Logik für unvollständige Reisekostenabrechnungen
- Integration mit Manus Notification API

---

### Phase 4: Datenimport und Automatisierung

**Datenimport:**
- Import-Seite erstellt
- Excel-Parser für Kundendaten
- Excel-Parser für Zeiterfassungsdaten
- Excel-Parser für Reisekostendaten
- Validierung und Fehlerbehandlung
- Fortschrittsanzeige während Import

**Automatische Benachrichtigungen:**
- Scheduler-Service für automatische Benachrichtigungen erstellt
- Monatliche Benachrichtigung am Monatsende
- Wöchentliche Prüfung auf fehlende Zeiterfassungen
- Benachrichtigung für anstehende Abrechnungsfristen
- Konfiguration für Benachrichtigungsintervalle

**Cron-Job für Benachrichtigungen:**
- Public Endpoint für Scheduler erstellt
- API-Key-Authentifizierung für Scheduler-Endpoint
- Dokumentation für Cron-Job-Konfiguration
- Fehlerbehandlung und Logging

---

### Phase 5: Internationalisierung und Mobile-Optimierung

**Mehrsprachigkeit:**
- i18n-Bibliothek integriert
- Deutsche Übersetzungen erstellt
- Polnische Übersetzungen erstellt
- Sprachumschaltung in UI implementiert
- Automatische Spracherkennung basierend auf Browser-Einstellungen
- Berichte in gewählter Sprache generieren

**Mobile Optimierung:**
- Touch-Targets vergrößern (min. 44x44px)
- Formulare für Touch-Bedienung optimieren
- Kalenderansicht für mobile Geräte anpassen
- Navigation für Smartphones optimieren
- Responsive Breakpoints überprüfen und anpassen
- Touch-Gesten für häufige Aktionen implementieren

---

### Phase 6: Erweiterte Währungsumrechnung und Backup

**Erweiterte Währungsumrechnung:**
- NBP-API für alle verfügbaren Währungen erweitern (13 Währungen)
- Währungsauswahl in Berichten integrieren
- Automatische Wechselkurs-Abfrage für gewähltes Datum
- Währungsumrechnung in Buchhaltungsbericht anzeigen
- Historische Wechselkurse speichern

**Backup-Funktion:**
- Datenbank-Export als JSON implementieren
- Backup-Seite in UI erstellen
- Download-Funktion für Backup-Dateien
- Automatisches Backup mit Zeitplan (via Cron-Job)
- Wiederherstellungs-Funktion (Import)

---

### Phase 7: Offline-Funktionalität

**Vollständige Offline-Funktionalität:**
- Service Worker für Offline-Caching implementiert
- IndexedDB für lokale Datenspeicherung eingerichtet
- Lokales Dateisystem für Belege und Reports (File System Access API)
- Ordnerstruktur: Jahr/Monat/Kategorie (Rechnungen, Berichte, Reisekosten, Belege, Backups)
- Synchronisierungslogik für Online/Offline-Modus
- Offline-Indikator in UI anzeigen
- Ordnerauswahl-Dialog beim ersten Start
- Manuelle Währungsaktualisierung im Offline-Modus
- Automatische Synchronisierung bei Internet-Verbindung
- Integration von lokalem Dateisystem in Backup, PDF-Export und Excel-Export

**Polnische Ordnerbezeichnungen:**
- Ordnernamen in fileSystem.ts auf Polnisch geändert
- Rechnungen → Faktury
- Berichte → Raporty
- Reisekosten → Koszty_podrozy
- Belege → Dokumenty
- Backups → Kopie_zapasowe
- Monatsnamen auf Polnisch (Styczen, Luty, Marzec, etc.)

**Service Worker:**
- Service Worker Datei erstellt
- Offline-Caching für alle App-Ressourcen
- Service Worker in Produktion registrieren
- Cache-Strategie implementieren (Network First mit Fallback)

---

### Phase 8: Rechnungsnummern und Archivierung

**Rechnungsnummern-Generator:**
- Datenbankschema für Rechnungsnummern erweitern
- Automatischer Generator mit Jahres-Präfix
- Fortlaufende Nummerierung pro Jahr
- Format: YYYY-NNN (z.B. 2026-001)
- Integration in Kundenbericht
- tRPC-Procedures für Generierung und Abruf

**Projekt-Archivierung:**
- Archivierungs-Status zu Kunden-Schema hinzufügen
- Archivierungs-Button in Kundenverwaltung
- Filter für aktive/archivierte Projekte
- Archivierte Projekte aus Dashboard ausblenden
- Archivierte Projekte in Berichten verfügbar halten
- Wiederherstellungs-Funktion für archivierte Projekte

---

### Phase 9: Bugfixes und Optimierungen

**Bugfixes - iframe-Kompatibilität:**
- File System Access API durch Download-API ersetzen
- Automatische Downloads mit polnischer Ordnerstruktur im Dateinamen
- OneDrive-Synchronisierung über Browser-Download-Ordner ermöglichen
- Ordnerauswahl-Dialog entfernen und durch Download-basierte Lösung ersetzen
- Info-Dialog für Download-basierte Speicherung implementiert

**Bugfixes - Wechselkurse:**
- SQL INSERT-Fehler in exchangeRates Tabelle beheben (Upsert-Logik implementieren)
- Datenbankschema für exchangeRates überprüfen und korrigieren
- Unique constraint auf date+currencyPair statt nur date
- Upsert-Logik in createExchangeRate implementiert

**Features - Wechselkurse:**
- Aktuellen Wechselkurs neben Währungsauswahl anzeigen
- Kurs-Anzeige mit Quelle (NBP/Manuell) Badge

**Anpassungen - Wechselkurse:**
- Währungsliste auf 4 Währungen reduziert (EUR, USD, CHF, GBP)
- Bug behoben: Wechselkurs wird jetzt angezeigt bei manueller Datumsänderung
- currentRate-Berechnung funktioniert jetzt dynamisch

**Bugfixes - Kunden & Steuern:**
- "Neuer Kunde" Button öffnet kein Dialog-Fenster - Pop-up für Kundenstammdatenanlage implementiert
- Steuerberechnung flexibel gestalten - variable Prozentsätze oder feste Beträge ermöglicht
- Steuerkonfiguration in Einstellungen implementiert
- taxSettings Tabelle in Datenbank erstellt
- Backend-Funktionen für Steuereinstellungen implementiert
- Steuereinstellungen-Seite mit UI erstellt
- Dashboard und Reports verwenden konfigurierbare Steuersätze

---

### Phase 10: Kritische Bugfixes für Produktion

**Kritische Bugfixes - Produktionsversion:**
- "Neuer Kunde" Button öffnet kein Fenster - Dialog Handler korrigiert
- Zeiteinträge werden am falschen Tag gespeichert - Timezone-Konvertierung behoben
- Datumsfeld in Zeiterfassung zeigt falsches Datum - entfernt
- Datumsfeld in Zeiterfassung entfernt - Datum wird in DialogDescription angezeigt
- Timezone/UTC-Konvertierung bei Datumsspeicherung korrigiert - lokale Zeitzone verwendet
- handleDialogOpenChange und handleDialogClose getrennt für korrekte Dialog-Steuerung
- Datums-Vergleich ohne UTC-Konvertierung für korrekte Anzeige der Einträge

**Kritischer Bugfix - Löschfunktion:**
- Löschungen werden visuell bestätigt aber nicht in Datenbank ausgeführt - behoben
- Backend-Löschfunktionen mit Logging erweitert
- Optimistic Updates für Löschungen implementiert (Customers, TimeEntries)
- onMutate/onError/onSettled Pattern für robuste Löschungen
- Rollback-Mechanismus bei Fehlern implementiert

---

### Phase 11: Bulk-Operationen und Ordnerstruktur

**Feature - Bulk-Zeiterfassung:**
- Funktion zum Kopieren von Zeiteinträgen auf mehrere Tage implementiert
- UI mit Kalender-Auswahl für mehrere Tage
- Backend-Endpoint bulkCreate für Bulk-Erstellung von Zeiteinträgen
- Copy-Button bei jedem Zeiteintrag (erscheint bei Hover)
- Dialog zur Auswahl der Ziel-Tage mit visueller Bestätigung
- Validierung und Fehlerbehandlung für Bulk-Operationen

**Feature - Ordnerstruktur Erweiterung:**
- Neuen Ordner für Überweisungsbestätigungen/Zahlungseingänge hinzugefügt
- Polnischen Ordnernamen definiert: "Potwierdzenia_przelewow"
- Dateinamen-Logik für Zahlungsbestätigungen implementiert
- fileSystem.ts erweitert um neuen Ordner-Typ
- Kategorie in allen Funktionen hinzugefügt
- TypeScript-Typen aktualisiert

---

### Phase 12: Authentifizierungs-System

**Authentifizierungs-System (Passport.js):**
- Passport.js und Dependencies installiert
- User-Tabelle in Datenbank erweitert (email, password_hash, reset_token)
- Passport Local Strategy konfiguriert
- Session-Management mit express-session
- Login-Endpoint erstellt
- Registrierungs-Endpoint erstellt
- Logout-Endpoint erstellt
- Password-Reset-Endpoint erstellt
- Login/Registrierung UI-Seiten erstellt
- Passwort-Vergessen UI erstellt
- Routen für Auth-Seiten in App.tsx hinzugefügt
- Rate-Limiting für Login-Versuche
- CSRF-Protection (via Helmet)
- Security-Headers (Helmet.js)

---

### Phase 13: Bugfixes und UI-Verbesserungen

**Bugfix - Vite WebSocket:**
- Vite WebSocket-Verbindungsfehler in Proxy-Umgebung beheben
- HMR-Konfiguration für Manus-Proxy anpassen (wss + clientPort 443)

**Aufgabe 1: Kunden löschen/archivieren Fehler:**
- Fehlerursache in Customers.tsx analysieren (doppelte Delete-Buttons)
- Delete-Funktion reparieren
- Archive-Funktion reparieren
- Backend-Endpunkte geprüft (funktionieren korrekt)

**Aufgabe 2: Kalender-Kacheln Entry-Anzahl:**
- Kalender-Komponente identifizieren (TimeTracking.tsx)
- Entry-Zählung pro Tag implementieren
- Visuell ansprechende Anzeige ("1 Entry", "2 Entries") hinzugefügt
- Badge mit primary/10 Hintergrund und abgerundeten Ecken

---

### Phase 14: Reisekosten-Maske erweitern

**Aufgabe 3: Reisekosten-Maske erweitern:**
- Neue Kostenarten definiert (car, train, flight, taxi, hotel, fuel, meal, other)
- Datenbankschema erweitert: departureTime, arrivalTime, checkInDate, checkOutDate, liters, pricePerLiter
- Backend-Endpunkte in routers.ts erweitert (alle neuen Felder hinzugefügt)
- Frontend: ExpenseForm-Komponente erstellt
- Frontend: Dropdown-Menü für Kostenart-Auswahl
- Frontend: Dynamische Felder je nach Kostenart (car, flight, train, hotel, fuel)
- Frontend: Plus-Button zum Hinzufügen weiterer Positionen
- Frontend: Design-Optimierung (Card-basierte untereinander gelegte Zeilen)
- Mobile-Optimierung (responsive Grid-Layout)

**Aufgabe 4: Reisekosten-Template umbauen (tagesbasiert):**
- Excel-Screenshot analysiert (Spalten: AutoCar, Train, Flight, Transport, Per diem, Lump sum, Other, Hotel, Food, Fuel)
- TimeTracking: Reisekosten-Button (Receipt-Icon) pro Tag hinzugefügt
- Dialog öffnet sich für spezifischen Tag (handleAddExpenses)
- ExpenseForm: Startet mit einer Kostenart-Auswahl
- "Weitere Kostenart"-Button fügt neue Zeile hinzu
- Mehrere Kostenarten werden untereinander als Cards dargestellt
- Backend: Batch-Create-Endpoint für mehrere Expenses pro Tag (expenses.createBatch)
- ExpenseForm: Datum-Header hinzugefügt
- Dialog in TimeTracking.tsx integrieren (ExpenseForm importiert und eingebunden)

**Aufgabe 5: Währungsauswahl für Reisekosten:**
- Datenbankschema erweitert: currency VARCHAR(3) zu expenses-Tabelle hinzugefügt
- Backend: currency-Feld in create/update/createBatch-Endpunkten
- ExpenseForm: Währungs-Dropdown zu jedem Betrag hinzugefügt (EUR, PLN, USD, CHF, GBP)
- CURRENCIES-Konstante mit Währungssymbolen erstellt

---

### Phase 15: Reisekosten-Aggregation und Visualisierung

**Aufgabe 6: Reisekosten-Aggregation und Visualisierung:**
- Backend: Aggregations-Endpunkt expenses.aggregateByCustomer erstellt
- Backend: getExpensesByCustomer-Funktion in db.ts hinzugefügt
- Recharts für Visualisierung installiert
- ProjectDetail-Seite erstellt mit Diagramm-Visualisierung
- Diagramme: Säulendiagramm und Kuchendiagramm nach Kostenart
- Filter: Monat, Jahr, Projektlaufzeit, Durchschnitt implementiert
- Summary Cards: Gesamtkosten, Durchschnitt pro Tag, Anzahl Einträge
- Einzelposten-Tabelle mit allen Reisekosten
- Link von Customers-Seite zu ProjectDetail (TrendingUp-Icon)

**Aufgabe 7: Lösch-/Archivierungsfehler beheben:**
- Kunden-Löschfehler analysiert (Race Condition durch onSettled)
- Optimistic Update-Logik in Customers.tsx geprüft
- onSettled aus Delete-Mutation entfernt (invalidate nur bei Fehler)
- Backend-Delete-Funktion verifiziert (korrekt implementiert)
- TimeTracking: onSettled entfernt, nur bei Fehler invalidate
- Settings (FixedCosts): Optimistic Update hinzugefügt
- Expenses: Keine Liste vorhanden, Delete extern verwendet
- Alle Delete-Mutationen korrigiert

**Aufgabe 8: Sidebar-Navigation zur Backup-Seite hinzufügen:**
- Backup.tsx analysiert
- DashboardLayout zur Backup-Seite hinzugefügt
- Layout korrigiert (space-y-6 für konsistentes Spacing)

---

### Phase 16: Massen-Auswahl und Navigation

**Aufgabe 9: Massen-Auswahl mit Checkboxen:**
- Kunden-Tabelle: Checkbox-Spalte zwischen Modell und Aktionen hinzugefügt
- Einstellungen/Fixkosten: Checkbox-Spalte hinzugefügt
- State für ausgewählte Einträge verwaltet (selectedCustomers, selectedCosts)
- Massen-Archivierung-Button hinzugefügt (nur Kunden)
- Massen-Löschung-Button hinzugefügt (beide Seiten)
- "Alle auswählen"-Checkbox im Tabellen-Header (CheckSquare/Square Icons)

**Aufgabe 10: Sidebar in Wechselkurse integrieren:**
- DashboardLayout zur ExchangeRates-Seite hinzugefügt
- Layout-Struktur angepasst (space-y-6)

**Aufgabe 11: Navigation-Buttons auf allen Seiten:**
- NavigationButtons-Komponente erstellt
- "Zurück"-Button mit ArrowLeft-Icon und Tooltip
- "Startseite"-Button mit Home-Icon und Tooltip
- Buttons in DashboardLayout integriert (erscheinen auf allen Seiten)
- Tooltips mit Infotext implementiert

---

### Phase 17: Omnibox-Suche

**Aufgabe 12: Omnibox-Suchfeld mit Live-Ergebnisvorschau:**
- Backend: Suche über Kunden, Zeiteinträge, Reisekosten (globalSearch.ts)
- Omnibox-Komponente mit cmdk Command-Dialog erstellt
- Live-Suche mit tRPC-Query (automatisches Debouncing)
- Kategorisierte Ergebnisanzeige mit Icons (Users, Clock, Receipt)
- Keyboard-Navigation (cmdk integriert)
- Tastenkombination Strg+K / Cmd+K (useKeyboardShortcut-Hook)
- Omnibox in DashboardLayout integriert
- Mobile-Optimierung (Dialog responsive)

**Aufgabe 13: Sichtbares Such-Icon im Header:**
- Such-Icon (Search) in DashboardLayout-Header hinzugefügt
- Icon öffnet Omnibox-Dialog (setOmniboxOpen)
- Tooltip "Suchen (Strg+K)" hinzugefügt
- Mobile-Optimierung (nur auf Mobile sichtbar)

**Aufgabe 14: Reisekosten-Seite mit Analyse-Funktionen umbauen:**
- Expenses.tsx komplett umgebaut (Analyse statt Formular)
- Diagramme: Säulendiagramm und Kuchendiagramm nach Kostenart
- Filter: Monat, Jahr, Projektlaufzeit, Durchschnitt
- Summary Cards: Gesamtkosten, Durchschnitt pro Tag, Anzahl Einträge
- Tabelle mit allen Reisekosten
- Backend: expenses.list-Endpunkt erstellt
- Backend: getAllExpenses-Funktion in db.ts hinzugefügt (Join mit timeEntries)

**Aufgabe 15: Permanent sichtbares Suchfeld mit Live-Dropdown:**
- SearchBar-Komponente mit Input-Feld erstellt
- Live-Ergebnis-Dropdown unter dem Suchfeld
- Kategorisierte Ergebnisse (Kunden, Zeiteinträge, Reisekosten)
- Click-to-Navigate zu Ergebnissen
- SearchBar in DashboardLayout-Header integriert (nur Desktop)
- Responsive Design (Mobile: Such-Icon, Desktop: Suchfeld)

---

### Phase 18: Kundenanlage und Layout-Fixes

**Aufgabe 16: Kundenanlage um Rechnungsadresse und USt-ID erweitern:**
- Datenbankschema: Neue Felder zu customers-Tabelle hinzugefügt (street, postalCode, city, country, vatId)
- Backend: create/update-Endpunkte mit neuen Feldern erweitert
- Frontend: Adressfelder im Kunden-Formular hinzugefügt
- Tests: Neue Tests für Adressfelder erstellt und bestanden (21 Tests)

**Aufgabe 17: Layout-Bugfix - Kundenformular Eingabefelder überlappen:**
- Grid-Struktur im Formular optimiert (gap-6 statt gap-4)
- Vertikale Abstände zwischen Feldern vergrößert (space-y-6)
- Labels und Eingabefelder korrekt ausgerichtet
- Responsive Breakpoints für kleinere Bildschirme angepasst (md:grid-cols-2)

---

### Phase 19: Zeiterfassung und Reisekosten-Verbesserungen

**Aufgabe 18: Zeiterfassung - Entry-Anzeige verbessern:**
- Projektzeiten: Anzahl + "Pro" anzeigen (z.B. "2 Pro") - blaues Badge
- Reisekosteneinträge: Anzahl + "RKE" anzeigen (z.B. "3 RKE") - violettes Badge
- Logik implementieren um zwischen Projektzeiten und Reisekosten zu unterscheiden
- getExpensesForDate-Funktion hinzugefügt
- Expenses-Query in TimeTracking.tsx integriert

**Aufgabe 19: Reisekosten-Summe im Dashboard reparieren:**
- Expenses-Query zum Dashboard hinzugefügt
- Reisekosten-Summe berechnen und anzeigen
- Neue Kachel "Reisekosten" mit Gesamtsumme im Dashboard
- Formatierung mit Euro-Symbol und deutscher Zahlenformatierung

---

### Phase 20: Währungswahlmöglichkeit und Reisekosten-Speicherung

**Aufgabe 20: Währungswahlmöglichkeit überall implementieren:**
- Bestehende Währungsfelder analysiert (Reisekosten: vorhanden, Fixkosten: fehlte)
- Fixkosten: Währungsfeld hinzugefügt (currency VARCHAR(3) DEFAULT 'PLN')
- Backend: fixedCosts.create und update mit currency erweitert
- Frontend: Währungsauswahl im Fixkosten-Formular (EUR, PLN, USD, GBP)
- Select-Import in Settings.tsx hinzugefügt

**Aufgabe 21: Reisekosten-Anzeige reparieren:**
- Problem identifiziert: onSubmit-Handler war nur TODO-Kommentar
- Reisekosten-Speicherung implementiert mit createBatch-Mutation
- Automatische Off-Duty TimeEntry-Erstellung für reine Reisekosten-Tage
- Cache-Invalidierung nach Reisekosten-Eintrag implementiert
- Aggregierte Reisekosten-Posten im Dashboard vorhanden
- RKE-Badge-Anzeige in Zeiterfassung vorhanden

---

## Offene Aufgaben

### Kurzfristig (Priorität: Hoch)

**Währungsfelder für Kundentarife:**
- Kunden: Währungsfelder für Tarife (onsiteRate, remoteRate, kmRate, mealRate) hinzufügen
- Zeiterfassung: Währungsfeld für rate/calculatedAmount hinzufügen
- Berichte: Währungsumrechnung in allen Reports implementieren

**Offline-Speicherung-Problem beheben:**
- Service Worker-Routing-Problem analysieren
- Fallback-Route für "/" implementieren
- Cache-Strategie überprüfen

### Mittelfristig (Priorität: Mittel)

**E-Mail-Versand für Password-Reset:**
- Nodemailer konfigurieren
- E-Mail-Template für Password-Reset erstellen
- SMTP-Server-Konfiguration

**Protected Routes implementieren:**
- Auth-Check in DashboardLayout
- Redirect zu Login-Seite bei fehlender Authentifizierung
- Session-Validierung bei jedem Request

**Testing der Auth-Funktionen:**
- Unit-Tests für Login/Registrierung
- Unit-Tests für Password-Reset
- Integration-Tests für Auth-Flow

### Langfristig (Priorität: Niedrig)

**Migration zu PHP-basierter Web-App:**
- Anforderungsanalyse für hoste.pl-Hosting
- PHP-Technologie-Stack definieren (Laravel/Symfony vs. Vanilla PHP)
- Backend von Node.js/Express zu PHP migrieren
- REST-API in PHP erstellen (ersetzt tRPC)
- Frontend von React zu PHP-Template-Engine oder behalten
- Datei-Upload zu Server-Storage (hoste.pl) migrieren

**Electron Desktop-App Entwicklung:**
- Electron-Projekt-Struktur erstellen
- Main Process implementieren (electron/main.ts)
- Preload Script mit Context Isolation (electron/preload.ts)
- IPC-Handler für Frontend-Backend-Kommunikation
- SQLite-Datenbank-Integration (statt MySQL)
- Dateisystem-Management mit Ordner-Auswahl-Dialog
- Polnische Ordnerstruktur automatisch erstellen
- OneDrive-Integration testen
- React-Frontend anpassen für Electron
- PDF/Excel-Export für Desktop
- Auto-Update-Mechanismus (electron-updater)
- Build-Konfiguration (electron-builder)
- GitHub Repository erstellen
- GitHub Actions für automatischen Build einrichten
- Portable .exe Build-Workflow
- Installer .exe Build-Workflow
- Testing auf Windows 10/11
- Dokumentation (README, BUILD, USER_GUIDE)

---

## Bekannte Probleme

### Kritische Probleme

**Problem:** Offline-Speicherung zeigt sich statt der eigentlichen Anwendung  
**Beschreibung:** Nach Veröffentlichung zeigt die Anwendung die "Offline-Speicherung"-Seite statt des Dashboards. Dies deutet auf ein Service Worker- oder Routing-Problem hin.  
**Workaround:** Browser-Cache leeren (Strg+Shift+Entf), Service Worker deaktivieren (DevTools → Application → Service Workers → Unregister), oder Inkognito-Fenster verwenden.  
**Status:** Offen  
**Priorität:** Hoch  
**Zugewiesen:** -

### Wiederkehrende Fehlerbilder

**Problem:** Entwicklungsserver reagiert nicht mehr  
**Beschreibung:** Nach längerer Inaktivität oder vielen Änderungen reagiert der Entwicklungsserver nicht mehr.  
**Lösung:** Server-Neustart über `webdev_restart_server` oder manuell mit `pnpm dev`.  
**Status:** Bekannt, kein Fix geplant (Entwicklungsumgebung)  
**Häufigkeit:** Gelegentlich

**Problem:** TypeScript-Fehler nach Schema-Änderungen  
**Beschreibung:** Nach Änderungen am Datenbank-Schema zeigt TypeScript Fehler an, obwohl `pnpm db:push` erfolgreich war.  
**Lösung:** Server-Neustart und TypeScript-Cache leeren (`rm -rf node_modules/.vite`).  
**Status:** Bekannt, kein Fix geplant (Entwicklungsumgebung)  
**Häufigkeit:** Häufig nach Schema-Änderungen

**Problem:** Migrations-Journal-Fehler  
**Beschreibung:** `pnpm db:push` schlägt fehl mit "No file ./drizzle/XXXX.sql found" weil `_journal.json` auf nicht-existierende Migrations verweist.  
**Lösung:** Fehlende Einträge manuell aus `drizzle/meta/_journal.json` entfernen oder SQL direkt mit `webdev_execute_sql` ausführen.  
**Status:** Bekannt, Workaround dokumentiert  
**Häufigkeit:** Gelegentlich nach manuellen Schema-Änderungen

### Nicht-kritische Probleme

**Problem:** Währungsfelder fehlen für Kundentarife  
**Beschreibung:** Kundentarife (onsiteRate, remoteRate, kmRate, mealRate) haben keine Währungsfelder, nur Cents-Werte.  
**Impact:** Internationale Kunden mit verschiedenen Währungen können nicht korrekt abgerechnet werden.  
**Status:** Offen (siehe Roadmap)  
**Priorität:** Mittel  
**Zugewiesen:** -

**Problem:** Zeiterfassung hat kein Währungsfeld  
**Beschreibung:** TimeEntry.rate und calculatedAmount haben keine Währungsfelder.  
**Impact:** Berichte zeigen alle Beträge in einer Währung, auch wenn Kunde in anderer Währung abgerechnet wird.  
**Status:** Offen (siehe Roadmap)  
**Priorität:** Mittel  
**Zugewiesen:** -

**Problem:** Löschungen werden bestätigt aber nicht ausgeführt (Produktion)  
**Beschreibung:** In der Produktionsumgebung werden Löschungen visuell bestätigt, aber nicht in der Datenbank ausgeführt.  
**Impact:** Benutzer müssen Seite neu laden um zu sehen dass Löschung nicht funktioniert hat.  
**Status:** Möglicherweise Caching-Problem in Produktion  
**Priorität:** Mittel  
**Zugewiesen:** -

---

## Test-Abdeckung

### Aktuelle Test-Statistiken

**Gesamt:** 21/21 Tests bestehen (100%)

**Test-Dateien:**
- `server/auth.test.ts`: 6 Tests (Authentifizierung)
- `server/auth.logout.test.ts`: 1 Test (Logout)
- `server/customers.test.ts`: 4 Tests (Kundenverwaltung)
- `server/expenses.test.ts`: 2 Tests (Reisekosten)
- `server/fixedCosts.test.ts`: 4 Tests (Fixkosten)
- `server/timeEntries.test.ts`: 2 Tests (Zeiterfassung)
- `server/taxSettings.test.ts`: 2 Tests (Steuereinstellungen)

### Fehlende Tests

**Frontend-Tests:**
- UI-Komponenten (React Testing Library)
- Integration-Tests für tRPC-Queries
- E2E-Tests mit Playwright

**Backend-Tests:**
- Wechselkurs-API-Integration
- Rechnungsnummern-Generator
- Backup & Wiederherstellung
- Projekt-Archivierung
- Bulk-Operationen

---

## Deployment-Historie

### Produktions-Deployments

**Aktuell:** Keine Produktions-Deployments

**Geplant:** Deployment auf Hostinger Polen oder OVHcloud Polen

---

## Kontakt und Support

**Projektinhaber:** Döring Consulting  
**Entwickler:** Manus AI  
**Support:** https://help.manus.im

---

**Ende der Entwicklungshistorie**
