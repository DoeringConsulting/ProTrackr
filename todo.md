# Project TODO

**Letzte Aktualisierung:** 14. Februar 2026 | Version 1.0.10

---

## Kritische Bugs

- [ ] **Login-Schleife beheben** - Nach erfolgreichem Login wird User wieder zur Login-Seite weitergeleitet (sporadisch)
  - Mögliche Ursachen: Session-Cookie-Konfiguration, Auth-Guard-Logik, SameSite/Secure-Einstellungen
  - Debug-Schritte: Browser-Konsole prüfen, `/api/auth/me` Response analysieren, Cookie-Header prüfen

---

## Geplante Features (Priorität: Hoch)

### Passwort-Verwaltung
- [ ] Passwort-Änderungs-Seite erstellen (Settings-Bereich)
- [ ] Passwort-Validierung (min. 8 Zeichen, Groß-/Kleinbuchstaben, Zahlen)
- [ ] Aktuelles Passwort vor Änderung abfragen
- [ ] Passwort-Änderungs-Bestätigung per E-Mail (optional)

### User-Verwaltung
- [ ] User-Verwaltungs-Seite erstellen (nur für Admins)
- [ ] User-Liste mit Filter und Suche
- [ ] User-Formular (E-Mail, Name, Rolle, Mandant)
- [ ] User anlegen, bearbeiten, löschen
- [ ] User-Rollen-Verwaltung (Admin, User, weitere Rollen)
- [ ] User-Status (Aktiv, Inaktiv, Gesperrt)

### Mandanten-Verwaltung
- [ ] Mandanten-Verwaltungs-Seite erstellen (nur für Admins)
- [ ] Mandanten-Liste mit Filter und Suche
- [ ] Mandanten-Formular (Name, Mandanten-Nr., Logo, Kontaktdaten)
- [ ] Mandanten anlegen, bearbeiten, löschen
- [ ] Mandanten-Logo-Upload mit S3-Integration
- [ ] Mandanten-Einstellungen (Währung, Steuersätze, etc.)

---

## Geplante Features (Priorität: Mittel)

### E-Mail-Funktionen
- [ ] E-Mail-Versand konfigurieren und testen (SMTP)
- [ ] Password-Reset per E-Mail implementieren
- [ ] E-Mail-Templates erstellen (Welcome, Password-Reset, etc.)
- [ ] E-Mail-Benachrichtigungen für wichtige Ereignisse

### Sicherheit
- [ ] Rate-Limiting für Login implementieren (max. 5 Versuche pro 15 Minuten)
- [ ] Brute-Force-Protection mit Account-Sperrung
- [ ] Zwei-Faktor-Authentifizierung (2FA) implementieren
- [ ] Security-Audit durchführen

### Testing
- [ ] E2E-Tests mit Playwright schreiben
- [ ] Kritische User-Flows testen (Login, Zeiterfassung, Rechnungserstellung)
- [ ] Performance-Tests durchführen
- [ ] Security-Tests durchführen

---

## Geplante Features (Priorität: Niedrig)

### Offline-Funktionalität
- [ ] Offline-Daten-Synchronisierung mit IndexedDB implementieren
- [ ] Background Sync API für automatische Synchronisierung bei Reconnect
- [ ] Conflict-Resolution-Strategie für Offline-Änderungen
- [ ] Offline-Indikator in UI verbessern

### Rechnungserstellung
- [ ] Automatische Rechnungserstellung basierend auf Zeiteinträgen
- [ ] Rechnungs-Templates mit anpassbarem Layout
- [ ] Rechnungs-Versand per E-Mail
- [ ] Rechnungs-Status-Tracking (Offen, Bezahlt, Überfällig)

### Projektverwaltung
- [ ] Projekt-Tabelle in Datenbank erstellen
- [ ] Projekt-Verwaltungs-UI (Anlegen, Bearbeiten, Löschen)
- [ ] Budget-Tracking pro Projekt
- [ ] Fortschrittsanzeige pro Projekt
- [ ] Projekt-Berichte mit Kosten-Nutzen-Analyse

### Team-Funktionen
- [ ] Mehrere Benutzer pro Mandant unterstützen
- [ ] Rollen und Berechtigungen erweitern (z.B. Buchhalter, Projektmanager)
- [ ] Team-Dashboard mit Übersicht über alle Projekte
- [ ] Team-Kalender mit gemeinsamer Zeiterfassung

### Monitoring & Analytics
- [ ] Sentry für Error-Tracking integrieren
- [ ] Plausible für Analytics integrieren
- [ ] Performance-Monitoring mit Web Vitals
- [ ] Custom Dashboards für Business-Metrics

---

## Technische Schulden

- [ ] Dokumentation für API-Endpoints erstellen (OpenAPI/Swagger)
- [ ] Code-Coverage für Tests erhöhen (Ziel: >80%)
- [ ] Performance-Optimierungen (Code-Splitting, Lazy-Loading)
- [ ] Accessibility-Audit durchführen (WCAG 2.1 Level AA)
- [ ] SEO-Optimierungen (Meta-Tags, Sitemap, Robots.txt)

---

## Abgeschlossene Features (Version 1.0.10)

### Authentifizierung & Autorisierung
- [x] E-Mail/Passwort-Authentifizierung mit Passport.js
- [x] Login-Seite mit Mandanten-Feld
- [x] Logout-Funktion
- [x] Session-Management (7 Tage Gültigkeit)
- [x] Rollenbasierte Zugriffskontrolle (Admin, User)
- [x] Protected Procedures für alle geschäftskritischen Routen
- [x] Scheduler-Absicherung mit API-Key

### Mandanten-Verwaltung
- [x] Mandanten-Tabelle in Datenbank
- [x] Mandanten-DB-Funktionen (findMandantByNr, findMandantByName)
- [x] 3-Felder-Login (Mandant, E-Mail, Passwort)
- [x] Mandanten-Validierung bei Login
- [x] Erster Mandant "Döring Consulting" (DC001) angelegt

### Datenmodell & Backend
- [x] Datenbankschema für Kunden, Zeiterfassung, Reisekosten
- [x] tRPC-Procedures für CRUD-Operationen
- [x] NBP-Wechselkurs-API Integration
- [x] Fixkosten-Verwaltung
- [x] Dokumente/Belege-Verwaltung
- [x] Backup-Funktion (Export/Import)

### UI/UX
- [x] Dashboard mit Sidebar-Navigation
- [x] Kundenverwaltung mit Tabelle und Formular
- [x] Zeiterfassung mit Kalenderansicht
- [x] Reisekosten-Formular mit allen Kategorien
- [x] Belegupload mit S3-Integration
- [x] Berichte-Seite (Buchhaltungsbericht, Kundenbericht)
- [x] Einstellungen-Seite (Stundensätze, Währungen, Steuersätze)

### Export & Berichte
- [x] PDF-Export für Buchhaltungsbericht und Kundenbericht
- [x] Excel-Export für Buchhaltungsbericht und Kundenbericht
- [x] Rechnungsnummern-Generator (Format: YYYY-NNN)

### Offline-Funktionalität
- [x] Service Worker für Offline-Caching
- [x] Network-First-Strategie mit Cache-Fallback
- [x] Update-Banner bei neuer Version
- [x] Automatische Cache-Invalidierung

### Mehrsprachigkeit
- [x] i18n-Integration mit Deutsch und Polnisch
- [x] Sprachumschaltung in UI
- [x] Automatische Spracherkennung

### Mobile Optimierung
- [x] Responsive Design für alle Seiten
- [x] Touch-Targets vergrößert (min. 44x44px)
- [x] Touch-Gesten für häufige Aktionen

---

## Abgeschlossene Bugfixes

### Version 1.0.10
- [x] Login-Problem behoben (Passwort-Hash korrigiert)
- [x] Admin-E-Mail-Adresse aktualisiert (a.doering@doering-consulting.eu)

### Version 1.0.8
- [x] Update-Banner Timeout behoben (iOS Safari Kompatibilität)
- [x] Doppel-Reload nach Update verhindert
- [x] Service Worker Aktivierung korrigiert

### Version 1.0.7
- [x] Reisekosten Datum-Offset behoben (Timezone-Problem)

### Frühere Versionen
- [x] tRPC API gibt HTML statt JSON zurück (Server-Neustart)
- [x] require() Fehler in tRPC-Procedures (Zod-Import)
- [x] SQL INSERT-Fehler in exchangeRates Tabelle (Upsert-Logik)
- [x] Wechselkurs-Anzeige bei manueller Datumsänderung
- [x] iframe-Kompatibilität (File System Access API durch Download-API ersetzt)

---

## Hinweise für Entwickler

### Vor dem Start
1. Alle Umgebungsvariablen in `.env` setzen (siehe README.md)
2. Datenbank-Migration ausführen: `pnpm db:push`
3. Ersten Mandanten und Admin-User anlegen (siehe DEVELOPMENT_HISTORY.md)
4. Development-Server starten: `pnpm dev`

### Vor jedem Commit
1. TypeScript-Check: `pnpm check`
2. Tests ausführen: `pnpm test`
3. Linting: `pnpm lint` (falls konfiguriert)

### Vor jedem Deployment
1. Version in `package.json` erhöhen: `pnpm prepare-checkpoint`
2. CHANGELOG.md aktualisieren
3. Tests ausführen: `pnpm test`
4. Checkpoint erstellen in Manus UI

---

*Für technische Details siehe [DEVELOPMENT_HISTORY.md](./DEVELOPMENT_HISTORY.md)*  
*Für Versions-Historie siehe [CHANGELOG.md](./CHANGELOG.md)*  
*Für Architektur-Überblick siehe [ARCHITECTURE.md](./ARCHITECTURE.md)*
