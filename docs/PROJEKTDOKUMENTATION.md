# Projektdokumentation: Döring Consulting - Projekt & Abrechnungsmanagement

**Version:** 2dbfac0f  
**Autor:** Manus AI  
**Datum:** 7. Februar 2026  
**Status:** In Entwicklung

---

## Inhaltsverzeichnis

1. [Projekt-Übersicht](#projekt-übersicht)
2. [User Stories](#user-stories)
3. [Technischer Bauplan](#technischer-bauplan)
4. [Datenmodell](#datenmodell)
5. [API-Struktur](#api-struktur)
6. [Source Code Dokumentation](#source-code-dokumentation)
7. [Entwicklungshistorie](#entwicklungshistorie)
8. [Setup-Anleitung](#setup-anleitung)
9. [Bekannte Probleme](#bekannte-probleme)
10. [Roadmap](#roadmap)

---

## Projekt-Übersicht

### Geschäftsziel

Die Anwendung **Döring Consulting - Projekt & Abrechnungsmanagement** ist eine webbasierte Lösung für Freiberufler und kleine Beratungsunternehmen zur Verwaltung von Projekten, Zeiterfassung, Reisekosten und Abrechnungen nach polnischem Steuerrecht. Die Anwendung ermöglicht die vollständige Offline-Nutzung mit automatischer Cloud-Synchronisierung über OneDrive, iCloud oder Google Drive.

### Kernfunktionalitäten

Die Anwendung bietet folgende Hauptfunktionen:

**Kundenverwaltung:** Verwaltung von Kundenstammdaten mit Rechnungsadressen, USt-ID, Tarifen (Onsite/Remote/Kilometer/Verpflegung) und Kostenmodellen (Exclusive/Inclusive). Kunden können archiviert werden, um die aktive Projektliste übersichtlich zu halten.

**Zeiterfassung:** Kalenderbasierte Erfassung von Arbeitsstunden mit automatischer Berechnung von Manntagen (1 Stunde = 0,125 MT) und Tagessätzen basierend auf Kundentarifen. Unterstützt werden verschiedene Arbeitstypen wie Onsite, Remote, Off-Duty und Geschäftsreisen. Die Bulk-Zeiterfassung ermöglicht das Kopieren von Einträgen auf mehrere Tage.

**Reisekostenverwaltung:** Erfassung von Reisekosten mit verschiedenen Kategorien (Auto, Zug, Flug, Taxi, Hotel, Tanken, Bewirtung, Sonstiges) inklusive kategoriespezifischer Felder wie Distanz, Ticketnummern, Check-in/Check-out-Daten und Treibstoffmengen. Reisekosten werden tagesbasiert erfasst und können in verschiedenen Währungen (EUR, PLN, USD, CHF, GBP) angelegt werden.

**Abrechnungsberichte:** Generierung von Buchhaltungsberichten nach polnischem Steuerrecht mit Berechnung von Bruttoumsatz, Fixkosten, ZUS (Sozialversicherung 19,52%), Krankenversicherung (9%) und Steuer (19%). Kundenberichte zeigen detaillierte Tagesübersichten und Zusammenfassungen mit automatischer Rechnungsnummerngenerierung im Format YYYY-NNN.

**Fixkosten-Verwaltung:** Verwaltung monatlicher Fixkosten mit Kategorien (Auto, Telefon, Software, Buchhaltung, Sonstiges) und Währungsauswahl. Fixkosten fließen in die Buchhaltungsberichte ein.

**Wechselkurs-Management:** Integration der Polnischen Nationalbank (NBP) API für automatische Wechselkursabfragen mit 13 Währungen. Historische Wechselkurse werden gespeichert und können manuell bearbeitet werden.

**Belegverwaltung:** Upload und Verwaltung von Belegen (Rechnungen, Quittungen, Verträge) mit S3-Integration und automatischer Verknüpfung zu Reisekosten und Zeiteinträgen.

**Export-Funktionen:** PDF- und Excel-Export für Buchhaltungsberichte und Kundenberichte mit automatischer Speicherung in polnischer Ordnerstruktur (Jahr/Monat/Kategorie).

**Backup & Wiederherstellung:** Vollständiger Datenbank-Export als JSON mit automatischer Backup-Erstellung und Wiederherstellungsfunktion.

**Offline-Funktionalität:** Service Worker für vollständige Offline-Nutzung mit IndexedDB für lokale Datenspeicherung und automatischer Synchronisierung bei Internetverbindung. Implementiert Cache-Busting mit Content-Hash in Dateinamen, automatische Update-Prüfung alle 60 Sekunden und Update-Benachrichtigung für Benutzer. Network-First-Strategie gewährleistet Aktualität bei bestehender Internetverbindung.

### Technologie-Stack

Die Anwendung basiert auf einem modernen Full-Stack-Technologie-Stack mit React 19, Tailwind CSS 4, Express 4, tRPC 11 und MySQL/TiDB als Datenbank. Das Frontend nutzt shadcn/ui-Komponenten für ein konsistentes Design und Recharts für Datenvisualisierungen. Die Authentifizierung erfolgt über Manus OAuth mit Session-Management. Die Anwendung ist für alle gängigen Browser (Chrome, Safari, Edge) und Gerätetypen (Desktop, Tablet, Smartphone) optimiert.

---

## User Stories

### US-001: Kundenanlage mit Rechnungsadresse

**Als** Freiberufler  
**möchte ich** neue Kunden mit vollständigen Stammdaten anlegen können  
**damit** ich alle relevanten Informationen für Abrechnungen und Kommunikation an einem Ort habe.

**Akzeptanzkriterien:**
- Erfassung von Firmenname, Mandantennummer, Projekt-/Kostenstellennummer und Land
- Eingabe von Rechnungsadresse (Straße, PLZ, Stadt, Land) und USt-ID
- Definition von Tarifen: Onsite-Tagessatz, Remote-Tagessatz, Kilometerpauschale, Verpflegungspauschale
- Auswahl des Kostenmodells: Exclusive (Kosten 1:1 verrechnet) oder Inclusive (Kosten eingepreist)
- Validierung der Pflichtfelder (Firmenname, Mandantennummer, Land)
- Responsive Formular-Layout ohne überlappende Labels

**Status:** ✅ Abgeschlossen (Aufgabe 16, 17)

---

### US-002: Zeiterfassung mit Kalenderansicht

**Als** Berater  
**möchte ich** meine Arbeitszeiten kalenderbasiert erfassen  
**damit** ich einen visuellen Überblick über meine Projekttage habe.

**Akzeptanzkriterien:**
- Monatskalender mit Tagesansicht
- Erfassung von Stunden und Minuten pro Tag
- Auswahl des Arbeitstyps: Onsite, Remote, Off-Duty, Geschäftsreise
- Automatische Berechnung von Manntagen (1h = 0,125 MT)
- Automatische Berechnung des Tagessatzes basierend auf Kundentarifen
- Anzeige der Anzahl Einträge pro Tag als Badge
- Unterscheidung zwischen Projektzeiten ("X Pro") und Reisekosten ("X RKE")
- Bulk-Zeiterfassung: Kopieren von Einträgen auf mehrere Tage

**Status:** ✅ Abgeschlossen (Aufgabe 2, 18)

---

### US-003: Reisekostenerfassung tagesbasiert

**Als** Berater  
**möchte ich** Reisekosten tagesbasiert mit verschiedenen Kategorien erfassen  
**damit** ich alle Ausgaben strukturiert dokumentieren kann.

**Akzeptanzkriterien:**
- Tagesbasierte Erfassung über Kalender-Button
- Mehrere Kostenarten pro Tag: Auto, Zug, Flug, Taxi, Hotel, Tanken, Bewirtung, Sonstiges
- Kategoriespezifische Felder:
  - Auto: Distanz, Pauschale
  - Zug/Flug: Ticketnummer, Flugnummer, Abfahrts-/Ankunftszeit
  - Hotel: Check-in/Check-out-Datum
  - Tanken: Liter, Preis pro Liter
- Währungsauswahl pro Kostenart (EUR, PLN, USD, CHF, GBP)
- Plus-Button zum Hinzufügen weiterer Kostenarten
- Automatische Verknüpfung mit TimeEntry (Off-Duty Entry wird erstellt falls kein Entry vorhanden)
- Anzeige in Zeiterfassung als violettes "RKE"-Badge

**Status:** ✅ Abgeschlossen (Aufgabe 3, 4, 5, 21)

---

### US-004: Buchhaltungsbericht nach polnischem Recht

**Als** Freiberufler in Polen  
**möchte ich** einen Buchhaltungsbericht nach polnischem Steuerrecht generieren  
**damit** ich meine Steuererklärung korrekt vorbereiten kann.

**Akzeptanzkriterien:**
- Berechnung Bruttoumsatz aus Zeiterfassung und Reisekosten
- Abzug Fixkosten
- Berechnung ZUS (Sozialversicherung): 19,52% vom Bruttoumsatz
- Berechnung Krankenversicherung: 9% vom Bruttoumsatz
- Berechnung Steuer: 19% vom steuerpflichtigen Einkommen
- Berechnung Nettogewinn
- Zeitraum-Auswahl (Monat/Jahr)
- PDF- und Excel-Export
- Automatische Speicherung in polnischer Ordnerstruktur

**Status:** ✅ Abgeschlossen

---

### US-005: Kundenbericht mit Rechnungsnummer

**Als** Freiberufler  
**möchte ich** einen Kundenbericht mit automatischer Rechnungsnummer generieren  
**damit** ich professionelle Rechnungen erstellen kann.

**Akzeptanzkriterien:**
- Details-Ansicht: Tagesübersicht mit Stunden, Manntagen, Tagessatz
- Summary-Ansicht: Zusammenfassung mit Gesamtsummen
- Automatische Rechnungsnummerngenerierung im Format YYYY-NNN
- Berücksichtigung Exclusive/Inclusive Kostenmodell
- Währungsumrechnung EUR/PLN mit NBP-Wechselkurs
- PDF- und Excel-Export
- Automatische Speicherung in polnischer Ordnerstruktur

**Status:** ✅ Abgeschlossen

---

### US-006: Währungsauswahl für Fixkosten

**Als** Freiberufler mit internationalen Ausgaben  
**möchte ich** Fixkosten in verschiedenen Währungen erfassen  
**damit** ich meine tatsächlichen Kosten korrekt dokumentieren kann.

**Akzeptanzkriterien:**
- Währungsauswahl im Fixkosten-Formular (EUR, PLN, USD, GBP)
- Währungsfeld in Datenbank (currency VARCHAR(3) DEFAULT 'PLN')
- Backend-Unterstützung für create/update mit currency
- Anzeige der Währung in Fixkosten-Tabelle

**Status:** ✅ Abgeschlossen (Aufgabe 20)

---

### US-007: Offline-Funktionalität mit Cloud-Sync

**Als** Berater ohne permanente Internetverbindung  
**möchte ich** die Anwendung vollständig offline nutzen können  
**damit** ich auch unterwegs produktiv arbeiten kann.

**Akzeptanzkriterien:**
- Service Worker für Offline-Caching mit automatischer Versionierung
- Cache-Busting mit Content-Hash in Dateinamen (assets/[name].[hash].js)
- Automatische Update-Prüfung alle 60 Sekunden
- Update-Benachrichtigung für Benutzer (unten rechts, dunkles Design)
- Network-First-Strategie für bessere Aktualität
- Automatischer Reload bei neuer Version (skipWaiting + clients.claim)
- IndexedDB für lokale Datenspeicherung
- Automatische Synchronisierung bei Internetverbindung
- Lokales Dateisystem für Belege und Reports
- Polnische Ordnerstruktur: Jahr/Monat/Kategorie
- OneDrive/iCloud/Google Drive Synchronisierung über Browser-Download-Ordner
- Offline-Indikator in UI
- Manuelle Währungsaktualisierung im Offline-Modus

**Status:** ✅ Abgeschlossen

---

### US-008: Omnibox-Suche mit Live-Vorschau

**Als** Benutzer  
**möchte ich** über eine zentrale Suchleiste schnell auf alle Funktionen zugreifen  
**damit** ich effizienter arbeiten kann.

**Akzeptanzkriterien:**
- Suchfeld im Header mit Tastenkürzel (Strg+K / Cmd+K)
- Live-Ergebnisvorschau während der Eingabe
- Durchsuchbare Entitäten: Kunden, Zeiteinträge, Reisekosten, Berichte, Einstellungen
- Gruppierung der Ergebnisse nach Kategorie
- Navigation per Tastatur (Pfeiltasten, Enter)
- Fuzzy-Matching für fehlertolerante Suche

**Status:** ✅ Abgeschlossen (Aufgabe 12)

---

### US-009: Massen-Auswahl mit Checkboxen

**Als** Benutzer mit vielen Datensätzen  
**möchte ich** mehrere Einträge gleichzeitig auswählen und bearbeiten  
**damit** ich Zeit bei wiederkehrenden Aktionen spare.

**Akzeptanzkriterien:**
- Checkbox-Spalte in Kunden-Tabelle und Fixkosten-Tabelle
- "Alle auswählen"-Checkbox im Tabellen-Header
- Massen-Archivierung-Button (nur Kunden)
- Massen-Löschung-Button mit Bestätigung
- Visuelle Hervorhebung ausgewählter Zeilen

**Status:** ✅ Abgeschlossen (Aufgabe 9)

---

### US-010: Reisekosten-Aggregation pro Projekt

**Als** Projektleiter  
**möchte ich** Reisekosten pro Projekt visualisiert sehen  
**damit** ich Budgets überwachen kann.

**Akzeptanzkriterien:**
- Aggregations-Endpunkt expenses.aggregateByCustomer
- ProjectDetail-Seite mit Diagramm-Visualisierung
- Säulendiagramm und Kuchendiagramm nach Kostenart
- Filter: Monat, Jahr, Projektlaufzeit, Durchschnitt
- Summary Cards: Gesamtkosten, Durchschnitt pro Tag, Anzahl Einträge
- Einzelposten-Tabelle mit allen Reisekosten
- Link von Customers-Seite zu ProjectDetail

**Status:** ✅ Abgeschlossen (Aufgabe 6)

---

## Technischer Bauplan

### Architektur-Übersicht

Die Anwendung folgt einer **Client-Server-Architektur** mit klarer Trennung zwischen Frontend (React), Backend (Express + tRPC) und Datenbank (MySQL/TiDB). Die Kommunikation erfolgt über tRPC, wodurch End-to-End-Typsicherheit gewährleistet ist.

```
┌─────────────────────────────────────────────────────────────┐
│                         Client (React 19)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Pages      │  │  Components  │  │   Contexts   │      │
│  │ (Dashboard,  │  │  (shadcn/ui, │  │  (Auth,      │      │
│  │  Customers,  │  │   Custom)    │  │   Theme)     │      │
│  │  TimeTracking│  │              │  │              │      │
│  │  Expenses,   │  │              │  │              │      │
│  │  Reports)    │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                          │                                   │
│                    ┌─────▼─────┐                            │
│                    │ tRPC Client│                            │
│                    └─────┬─────┘                            │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTP/JSON
┌──────────────────────────▼──────────────────────────────────┐
│                    Server (Express 4)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ tRPC Routers │  │  Middleware  │  │    Auth      │      │
│  │ (customers,  │  │  (CORS,      │  │  (Manus      │      │
│  │  timeEntries,│  │   Helmet,    │  │   OAuth)     │      │
│  │  expenses,   │  │   Rate       │  │              │      │
│  │  reports)    │  │   Limiting)  │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                          │                                   │
│                    ┌─────▼─────┐                            │
│                    │  Drizzle  │                            │
│                    │    ORM    │                            │
│                    └─────┬─────┘                            │
└──────────────────────────┼──────────────────────────────────┘
                           │ SQL
┌──────────────────────────▼──────────────────────────────────┐
│                    Database (MySQL/TiDB)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tables: users, customers, timeEntries, expenses,    │   │
│  │  fixedCosts, taxSettings, exchangeRates, documents,  │   │
│  │  invoiceNumbers                                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Verzeichnisstruktur

```
project-billing-app/
├── client/                    # Frontend (React)
│   ├── public/               # Statische Assets
│   ├── src/
│   │   ├── pages/           # Seiten-Komponenten
│   │   ├── components/      # Wiederverwendbare UI-Komponenten
│   │   │   ├── ui/         # shadcn/ui Komponenten
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── ExpenseForm.tsx
│   │   │   └── ...
│   │   ├── contexts/        # React Contexts
│   │   ├── hooks/           # Custom Hooks
│   │   ├── lib/
│   │   │   └── trpc.ts     # tRPC Client
│   │   ├── App.tsx          # Routing
│   │   ├── main.tsx         # Entry Point
│   │   └── index.css        # Globale Styles
│   └── index.html
├── server/                    # Backend (Express + tRPC)
│   ├── _core/                # Framework-Plumbing
│   │   ├── context.ts       # tRPC Context
│   │   ├── trpc.ts          # tRPC Setup
│   │   ├── auth.ts          # Authentifizierung
│   │   ├── cookies.ts       # Session-Management
│   │   ├── llm.ts           # LLM-Integration
│   │   ├── map.ts           # Maps-Integration
│   │   ├── voiceTranscription.ts
│   │   ├── imageGeneration.ts
│   │   └── systemRouter.ts
│   ├── routers.ts            # tRPC Procedures
│   ├── db.ts                 # Datenbank-Helfer
│   ├── *.test.ts            # Unit-Tests
│   └── storage.ts            # S3-Integration
├── drizzle/                   # Datenbank-Schema & Migrationen
│   ├── schema.ts             # Tabellen-Definitionen
│   ├── meta/                 # Migrations-Metadaten
│   └── *.sql                 # SQL-Migrationen
├── shared/                    # Geteilte Typen & Konstanten
├── package.json
├── drizzle.config.ts
├── vite.config.ts
└── tsconfig.json
```

### Komponenten-Übersicht

**Frontend-Komponenten:**

- **DashboardLayout:** Haupt-Layout mit Sidebar-Navigation, Header mit Omnibox-Suche, Benutzer-Profil und Theme-Toggle
- **ExpenseForm:** Formular für tagesbasierte Reisekostenerfassung mit dynamischen Feldern je nach Kostenart
- **NavigationButtons:** Zurück- und Startseite-Buttons mit Tooltips
- **Omnibox:** Zentrale Suchleiste mit Live-Ergebnisvorschau und Tastaturnavigation
- **shadcn/ui Komponenten:** Button, Card, Dialog, Input, Select, Table, Tooltip, etc.

**Backend-Module:**

- **routers.ts:** Zentrale tRPC-Router-Definition mit allen Procedures
- **db.ts:** Datenbank-Helfer-Funktionen (CRUD-Operationen)
- **storage.ts:** S3-Integration für Datei-Upload
- **_core/auth.ts:** Manus OAuth Authentifizierung
- **_core/llm.ts:** LLM-Integration für KI-Funktionen
- **_core/map.ts:** Google Maps Proxy-Integration

---

## Datenmodell

### Entity-Relationship-Diagramm

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    users     │       │  customers   │       │ timeEntries  │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │       │ id (PK)      │
│ email        │       │ userId (FK)  │───┐   │ userId (FK)  │
│ password_hash│       │ provider     │   │   │ customerId   │──┐
│ name         │       │ mandantNr    │   │   │ date         │  │
│ openId       │       │ projectNr    │   │   │ projectName  │  │
│ role         │       │ country      │   │   │ entryType    │  │
│ ...          │       │ onsiteRate   │   │   │ hours        │  │
└──────────────┘       │ remoteRate   │   │   │ rate         │  │
                       │ kmRate       │   │   │ ...          │  │
                       │ mealRate     │   │   └──────────────┘  │
                       │ billingModel │   │                     │
                       │ street       │   │                     │
                       │ postalCode   │   │   ┌──────────────┐  │
                       │ city         │   │   │   expenses   │  │
                       │ country      │   │   ├──────────────┤  │
                       │ vatId        │   │   │ id (PK)      │  │
                       │ archived     │   │   │ timeEntryId  │──┘
                       │ ...          │   │   │ category     │
                       └──────────────┘   │   │ distance     │
                                          │   │ rate         │
┌──────────────┐                         │   │ amount       │
│  fixedCosts  │                         │   │ currency     │
├──────────────┤                         │   │ comment      │
│ id (PK)      │                         │   │ ...          │
│ userId (FK)  │─────────────────────────┘   └──────────────┘
│ category     │
│ amount       │       ┌──────────────┐
│ currency     │       │ taxSettings  │
│ description  │       ├──────────────┤
│ ...          │       │ id (PK)      │
└──────────────┘       │ userId (FK)  │
                       │ zusRate      │
                       │ healthRate   │
┌──────────────┐       │ taxRate      │
│exchangeRates │       │ ...          │
├──────────────┤       └──────────────┘
│ id (PK)      │
│ date         │       ┌──────────────┐
│ currencyPair │       │  documents   │
│ rate         │       ├──────────────┤
│ source       │       │ id (PK)      │
│ ...          │       │ userId (FK)  │
└──────────────┘       │ entityType   │
                       │ entityId     │
┌──────────────┐       │ fileName     │
│invoiceNumbers│       │ fileUrl      │
├──────────────┤       │ ...          │
│ id (PK)      │       └──────────────┘
│ customerId   │
│ year         │
│ number       │
│ ...          │
└──────────────┘
```

### Tabellen-Definitionen

#### users

Speichert Benutzerinformationen für Authentifizierung und Autorisierung.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INT (PK, AUTO_INCREMENT) | Eindeutige Benutzer-ID |
| email | VARCHAR(255) UNIQUE | E-Mail-Adresse |
| password_hash | VARCHAR(255) | Gehashtes Passwort (bcrypt) |
| name | VARCHAR(255) | Benutzername |
| openId | VARCHAR(255) UNIQUE | Manus OAuth OpenID |
| role | ENUM('admin', 'user') | Benutzerrolle |
| resetToken | VARCHAR(255) | Passwort-Reset-Token |
| resetTokenExpiry | TIMESTAMP | Token-Ablaufzeit |
| emailVerified | BOOLEAN | E-Mail-Verifizierungsstatus |
| createdAt | TIMESTAMP | Erstellungszeitpunkt |
| updatedAt | TIMESTAMP | Aktualisierungszeitpunkt |

#### customers

Speichert Kundenstammdaten mit Tarifen und Rechnungsadressen.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INT (PK, AUTO_INCREMENT) | Eindeutige Kunden-ID |
| userId | INT (FK → users.id) | Besitzer des Kunden |
| provider | VARCHAR(255) | Firmenname |
| mandantNr | VARCHAR(100) | Mandantennummer |
| projectNr | VARCHAR(100) | Projekt-/Kostenstellennummer |
| country | VARCHAR(100) | Land |
| onsiteRate | INT | Onsite-Tagessatz (Cents) |
| remoteRate | INT | Remote-Tagessatz (Cents) |
| kmRate | INT | Kilometerpauschale (Cents) |
| mealRate | INT | Verpflegungspauschale (Cents) |
| billingModel | ENUM('exclusive', 'inclusive') | Kostenmodell |
| street | VARCHAR(255) | Straße + Hausnummer |
| postalCode | VARCHAR(20) | PLZ |
| city | VARCHAR(100) | Stadt |
| vatId | VARCHAR(50) | USt-ID |
| archived | BOOLEAN DEFAULT FALSE | Archivierungsstatus |
| createdAt | TIMESTAMP | Erstellungszeitpunkt |
| updatedAt | TIMESTAMP | Aktualisierungszeitpunkt |

#### timeEntries

Speichert Zeiterfassungseinträge mit automatischer Berechnung von Manntagen und Tagessätzen.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INT (PK, AUTO_INCREMENT) | Eindeutige Entry-ID |
| userId | INT (FK → users.id) | Besitzer des Eintrags |
| customerId | INT (FK → customers.id) | Zugehöriger Kunde |
| date | DATE | Arbeitstag |
| weekday | VARCHAR(20) | Wochentag (Deutsch) |
| projectName | VARCHAR(255) | Projektname |
| entryType | ENUM('onsite', 'remote', 'off_duty', 'business_trip') | Arbeitstyp |
| description | TEXT | Beschreibung |
| hours | INT | Arbeitsstunden |
| rate | INT | Tagessatz (Cents) |
| calculatedAmount | INT | Berechneter Betrag (Cents) |
| manDays | DECIMAL(5,3) | Manntage (1h = 0,125 MT) |
| createdAt | TIMESTAMP | Erstellungszeitpunkt |
| updatedAt | TIMESTAMP | Aktualisierungszeitpunkt |

#### expenses

Speichert Reisekosten mit kategoriespezifischen Feldern.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INT (PK, AUTO_INCREMENT) | Eindeutige Expense-ID |
| timeEntryId | INT (FK → timeEntries.id) | Zugehöriger TimeEntry |
| category | ENUM('car', 'train', 'flight', 'taxi', 'transport', 'meal', 'hotel', 'food', 'fuel', 'other') | Kostenart |
| distance | INT | Distanz (Kilometer) |
| rate | INT | Pauschale (Cents) |
| amount | INT | Betrag (Cents) |
| currency | VARCHAR(3) DEFAULT 'EUR' | Währung (ISO 4217) |
| comment | TEXT | Kommentar |
| ticketNumber | VARCHAR(100) | Ticketnummer |
| flightNumber | VARCHAR(100) | Flugnummer |
| departureTime | VARCHAR(50) | Abfahrtszeit |
| arrivalTime | VARCHAR(50) | Ankunftszeit |
| checkInDate | VARCHAR(50) | Check-in-Datum |
| checkOutDate | VARCHAR(50) | Check-out-Datum |
| liters | INT | Treibstoffmenge (Milliliter) |
| pricePerLiter | INT | Preis pro Liter (Cents) |
| createdAt | TIMESTAMP | Erstellungszeitpunkt |
| updatedAt | TIMESTAMP | Aktualisierungszeitpunkt |

#### fixedCosts

Speichert monatliche Fixkosten mit Währungsauswahl.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INT (PK, AUTO_INCREMENT) | Eindeutige Fixkosten-ID |
| userId | INT (FK → users.id) | Besitzer der Fixkosten |
| category | VARCHAR(100) | Kategorie |
| amount | INT | Betrag (Cents) |
| currency | VARCHAR(3) DEFAULT 'PLN' | Währung (ISO 4217) |
| description | TEXT | Beschreibung |
| createdAt | TIMESTAMP | Erstellungszeitpunkt |
| updatedAt | TIMESTAMP | Aktualisierungszeitpunkt |

#### taxSettings

Speichert konfigurierbare Steuersätze für Buchhaltungsberichte.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INT (PK, AUTO_INCREMENT) | Eindeutige Settings-ID |
| userId | INT (FK → users.id) | Besitzer der Einstellungen |
| zusRate | INT | ZUS-Satz (Cents) |
| zusIsPercent | BOOLEAN | ZUS als Prozentsatz |
| healthRate | INT | Krankenversicherungssatz (Cents) |
| healthIsPercent | BOOLEAN | Krankenversicherung als Prozentsatz |
| taxRate | INT | Steuersatz (Cents) |
| taxIsPercent | BOOLEAN | Steuer als Prozentsatz |
| createdAt | TIMESTAMP | Erstellungszeitpunkt |
| updatedAt | TIMESTAMP | Aktualisierungszeitpunkt |

#### exchangeRates

Speichert historische Wechselkurse von der NBP-API.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INT (PK, AUTO_INCREMENT) | Eindeutige Rate-ID |
| date | DATE | Gültigkeitsdatum |
| currencyPair | VARCHAR(10) | Währungspaar (z.B. EUR/PLN) |
| rate | DECIMAL(10,6) | Wechselkurs |
| source | ENUM('nbp', 'manual') | Quelle |
| createdAt | TIMESTAMP | Erstellungszeitpunkt |

**Unique Constraint:** (date, currencyPair)

#### documents

Speichert Belege und Dokumente mit S3-Integration.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INT (PK, AUTO_INCREMENT) | Eindeutige Dokument-ID |
| userId | INT (FK → users.id) | Besitzer des Dokuments |
| entityType | VARCHAR(50) | Entitätstyp (expense, timeEntry, etc.) |
| entityId | INT | Entitäts-ID |
| fileName | VARCHAR(255) | Dateiname |
| fileUrl | VARCHAR(500) | S3-URL |
| mimeType | VARCHAR(100) | MIME-Typ |
| fileSize | INT | Dateigröße (Bytes) |
| createdAt | TIMESTAMP | Erstellungszeitpunkt |
| updatedAt | TIMESTAMP | Aktualisierungszeitpunkt |

#### invoiceNumbers

Speichert generierte Rechnungsnummern mit Jahres-Präfix.

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | INT (PK, AUTO_INCREMENT) | Eindeutige Invoice-ID |
| customerId | INT (FK → customers.id) | Zugehöriger Kunde |
| year | INT | Jahr |
| number | INT | Fortlaufende Nummer |
| invoiceNumber | VARCHAR(20) | Vollständige Rechnungsnummer (YYYY-NNN) |
| createdAt | TIMESTAMP | Erstellungszeitpunkt |

---

## API-Struktur

### tRPC-Router-Übersicht

Die API ist in thematische Router unterteilt, die über tRPC exponiert werden. Alle Procedures sind typsicher und nutzen Zod für Input-Validierung.

```typescript
appRouter = {
  auth: {
    me: publicProcedure.query(),
    logout: publicProcedure.mutation(),
  },
  customers: {
    list: protectedProcedure.query(),
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(),
    create: protectedProcedure.input(CustomerCreateSchema).mutation(),
    update: protectedProcedure.input(CustomerUpdateSchema).mutation(),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(),
    archive: protectedProcedure.input(z.object({ id: z.number() })).mutation(),
  },
  timeEntries: {
    list: protectedProcedure.input(DateRangeSchema).query(),
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(),
    create: protectedProcedure.input(TimeEntryCreateSchema).mutation(),
    bulkCreate: protectedProcedure.input(BulkTimeEntrySchema).mutation(),
    update: protectedProcedure.input(TimeEntryUpdateSchema).mutation(),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(),
  },
  expenses: {
    list: protectedProcedure.input(DateRangeSchema).query(),
    listByTimeEntry: protectedProcedure.input(z.object({ timeEntryId: z.number() })).query(),
    create: protectedProcedure.input(ExpenseCreateSchema).mutation(),
    createBatch: protectedProcedure.input(BatchExpenseSchema).mutation(),
    update: protectedProcedure.input(ExpenseUpdateSchema).mutation(),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(),
    aggregateByCustomer: protectedProcedure.input(AggregateSchema).query(),
  },
  fixedCosts: {
    list: protectedProcedure.query(),
    create: protectedProcedure.input(FixedCostCreateSchema).mutation(),
    update: protectedProcedure.input(FixedCostUpdateSchema).mutation(),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(),
  },
  taxSettings: {
    get: protectedProcedure.query(),
    upsert: protectedProcedure.input(TaxSettingsSchema).mutation(),
  },
  exchangeRates: {
    list: protectedProcedure.query(),
    getByDate: protectedProcedure.input(z.object({ date: z.string(), currency: z.string() })).query(),
    create: protectedProcedure.input(ExchangeRateCreateSchema).mutation(),
    update: protectedProcedure.input(ExchangeRateUpdateSchema).mutation(),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(),
    fetchFromNBP: protectedProcedure.input(z.object({ date: z.string(), currency: z.string() })).mutation(),
  },
  invoiceNumbers: {
    generate: protectedProcedure.input(z.object({ customerId: z.number() })).mutation(),
    list: protectedProcedure.input(z.object({ year: z.number().optional() })).query(),
  },
  system: {
    notifyOwner: protectedProcedure.input(NotificationSchema).mutation(),
  },
};
```

### Wichtige Schemas

**CustomerCreateSchema:**
```typescript
z.object({
  provider: z.string(),
  mandantNr: z.string(),
  projectNr: z.string(),
  country: z.string(),
  onsiteRate: z.number(),
  remoteRate: z.number(),
  kmRate: z.number(),
  mealRate: z.number(),
  billingModel: z.enum(['exclusive', 'inclusive']),
  street: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  vatId: z.string().optional(),
})
```

**TimeEntryCreateSchema:**
```typescript
z.object({
  customerId: z.number(),
  date: z.string(),
  weekday: z.string(),
  projectName: z.string(),
  entryType: z.enum(['onsite', 'remote', 'off_duty', 'business_trip']),
  description: z.string().optional(),
  hours: z.number(),
  rate: z.number(),
  calculatedAmount: z.number(),
  manDays: z.number(),
})
```

**ExpenseCreateSchema:**
```typescript
z.object({
  timeEntryId: z.number(),
  category: z.enum(['car', 'train', 'flight', 'taxi', 'transport', 'meal', 'hotel', 'food', 'fuel', 'other']),
  distance: z.number().optional(),
  rate: z.number().optional(),
  amount: z.number(),
  currency: z.string().length(3).default('EUR'),
  comment: z.string().optional(),
  ticketNumber: z.string().optional(),
  flightNumber: z.string().optional(),
  departureTime: z.string().optional(),
  arrivalTime: z.string().optional(),
  checkInDate: z.string().optional(),
  checkOutDate: z.string().optional(),
  liters: z.number().optional(),
  pricePerLiter: z.number().optional(),
})
```

**BatchExpenseSchema:**
```typescript
z.object({
  timeEntryId: z.number(),
  expenses: z.array(ExpenseCreateSchema.omit({ timeEntryId: true })),
})
```

### Authentifizierung

Die Anwendung nutzt **Manus OAuth** für die Authentifizierung. Der OAuth-Flow läuft über `/api/oauth/callback` und erstellt eine Session-Cookie. Alle geschützten Procedures prüfen die Session über `protectedProcedure`.

**Context-Erstellung:**
```typescript
export const createContext = async ({ req, res }: CreateExpressContextOptions) => {
  const user = await getUserFromSession(req);
  return { req, res, user };
};
```

**Protected Procedure:**
```typescript
export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
```

---

## Source Code Dokumentation

### Frontend-Struktur

**Routing (App.tsx):**
```typescript
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/customers" element={<Customers />} />
  <Route path="/time-tracking" element={<TimeTracking />} />
  <Route path="/expenses" element={<Expenses />} />
  <Route path="/reports" element={<Reports />} />
  <Route path="/settings" element={<Settings />} />
  <Route path="/backup" element={<Backup />} />
  <Route path="/exchange-rates" element={<ExchangeRates />} />
  <Route path="/project/:customerId" element={<ProjectDetail />} />
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
  <Route path="/forgot-password" element={<ForgotPassword />} />
</Routes>
```

**tRPC Client (lib/trpc.ts):**
```typescript
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../../server/routers';

export const trpc = createTRPCReact<AppRouter>();

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

**Beispiel: Kunden-Verwaltung (pages/Customers.tsx):**
```typescript
export default function Customers() {
  const utils = trpc.useUtils();
  const { data: customers = [], isLoading } = trpc.customers.list.useQuery();

  const deleteMutation = trpc.customers.delete.useMutation({
    onMutate: async (variables) => {
      await utils.customers.list.cancel();
      const previousCustomers = utils.customers.list.getData();
      utils.customers.list.setData(undefined, (old) => {
        if (!old) return old;
        return old.filter(c => c.id !== variables.id);
      });
      return { previousCustomers };
    },
    onSuccess: () => {
      toast.success("Kunde erfolgreich gelöscht");
    },
    onError: (error, variables, context) => {
      if (context?.previousCustomers) {
        utils.customers.list.setData(undefined, context.previousCustomers);
      }
      toast.error(`Fehler beim Löschen: ${error.message}`);
      utils.customers.list.invalidate();
    },
  });

  // ... UI-Rendering
}
```

### Backend-Struktur

**tRPC Router (server/routers.ts):**
```typescript
export const appRouter = router({
  customers: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getCustomers } = await import("./db");
      return await getCustomers(ctx.user.id);
    }),
    create: protectedProcedure.input(CustomerCreateSchema).mutation(async ({ ctx, input }) => {
      const { createCustomer } = await import("./db");
      return await createCustomer({
        ...input,
        userId: ctx.user.id,
      });
    }),
    // ... weitere Procedures
  }),
  // ... weitere Router
});

export type AppRouter = typeof appRouter;
```

**Datenbank-Helfer (server/db.ts):**
```typescript
export async function getCustomers(userId: number) {
  const db = await getDb();
  return await db.select().from(customers).where(eq(customers.userId, userId));
}

export async function createCustomer(data: InsertCustomer) {
  const db = await getDb();
  const result = await db.insert(customers).values(data);
  return { id: Number(result.insertId), ...data };
}

export async function updateCustomer(id: number, data: Partial<InsertCustomer>) {
  const db = await getDb();
  await db.update(customers).set(data).where(eq(customers.id, id));
}

export async function deleteCustomer(id: number) {
  const db = await getDb();
  await db.delete(customers).where(eq(customers.id, id));
}
```

### Wichtige Komponenten

**DashboardLayout (components/DashboardLayout.tsx):**
- Sidebar-Navigation mit aktiven Routen
- Header mit Omnibox-Suche, Benutzer-Profil, Theme-Toggle
- Responsive Design mit Hamburger-Menü für Mobile
- Navigation-Buttons (Zurück, Startseite)

**ExpenseForm (components/ExpenseForm.tsx):**
- Dynamisches Formular für Reisekosten
- Kategoriespezifische Felder (Auto, Zug, Flug, Hotel, Tanken, etc.)
- Plus-Button zum Hinzufügen weiterer Kostenarten
- Währungsauswahl pro Kostenart
- Mobile-Optimierung mit Card-Layout

**Omnibox (components/Omnibox.tsx):**
- Zentrale Suchleiste mit Tastenkürzel (Strg+K / Cmd+K)
- Live-Ergebnisvorschau während der Eingabe
- Fuzzy-Matching mit Fuse.js
- Gruppierung nach Kategorie (Kunden, Zeiteinträge, Reisekosten, etc.)
- Tastaturnavigation (Pfeiltasten, Enter, Escape)

---

## Entwicklungshistorie

### Abgeschlossene Features

Die folgende Tabelle zeigt alle erfolgreich implementierten Features mit Aufgabennummer, Beschreibung und Abschlussdatum.

| Aufgabe | Feature | Status | Datum |
|---------|---------|--------|-------|
| 1 | Kunden löschen/archivieren Fehler beheben | ✅ | 2026-02-05 |
| 2 | Kalender-Kacheln Entry-Anzahl anzeigen | ✅ | 2026-02-05 |
| 3 | Reisekosten-Maske erweitern (alle Kategorien) | ✅ | 2026-02-05 |
| 4 | Reisekosten-Template umbauen (tagesbasiert) | ✅ | 2026-02-05 |
| 5 | Währungsauswahl für Reisekosten | ✅ | 2026-02-05 |
| 6 | Reisekosten-Aggregation und Visualisierung | ✅ | 2026-02-05 |
| 7 | Lösch-/Archivierungsfehler beheben (Optimistic Updates) | ✅ | 2026-02-05 |
| 8 | Sidebar-Navigation zur Backup-Seite hinzufügen | ✅ | 2026-02-05 |
| 9 | Massen-Auswahl mit Checkboxen | ✅ | 2026-02-05 |
| 10 | Sidebar in Wechselkurse integrieren | ✅ | 2026-02-05 |
| 11 | Navigation-Buttons auf allen Seiten | ✅ | 2026-02-05 |
| 12 | Omnibox-Suchfeld mit Live-Ergebnisvorschau | ✅ | 2026-02-05 |
| 13 | Omnibox-Tastenkürzel (Strg+K / Cmd+K) | ✅ | 2026-02-05 |
| 14 | Omnibox-Fuzzy-Matching mit Fuse.js | ✅ | 2026-02-05 |
| 15 | Omnibox-Tastaturnavigation | ✅ | 2026-02-05 |
| 16 | Kundenanlage um Rechnungsadresse und USt-ID erweitern | ✅ | 2026-02-07 |
| 17 | Layout-Bugfix - Kundenformular Eingabefelder überlappen | ✅ | 2026-02-07 |
| 18 | Zeiterfassung - Entry-Anzeige verbessern (Pro/RKE) | ✅ | 2026-02-07 |
| 19 | Reisekosten-Summe im Dashboard aggregieren | ✅ | 2026-02-07 |
| 20 | Währungswahlmöglichkeit für Fixkosten implementieren | ✅ | 2026-02-07 |
| 21 | Reisekosten-Anzeige reparieren (Speicherung funktioniert nicht) | ✅ | 2026-02-07 |

### Features in Arbeit

Derzeit sind keine Features aktiv in Arbeit. Die nächsten Schritte sind in der Roadmap definiert.

### Bekannte Probleme und Fehlerbilder

#### Kritische Probleme

**Problem:** Offline-Speicherung zeigt sich statt der eigentlichen Anwendung  
**Beschreibung:** Nach Veröffentlichung zeigt die Anwendung die "Offline-Speicherung"-Seite statt des Dashboards. Dies deutet auf ein Service Worker- oder Routing-Problem hin.  
**Lösung:** Cache-Busting mit Content-Hash in Dateinamen implementiert, Service Worker mit automatischer Versionierung und Update-Logik erweitert. Network-First-Strategie gewährleistet Aktualität. Update-Benachrichtigung informiert Benutzer über neue Versionen.  
**Status:** ✅ Behoben (Aufgabe 23)  
**Priorität:** Hoch

#### Wiederkehrende Fehlerbilder

**Problem:** Entwicklungsserver reagiert nicht mehr  
**Beschreibung:** Nach längerer Inaktivität oder vielen Änderungen reagiert der Entwicklungsserver nicht mehr.  
**Lösung:** Server-Neustart über `webdev_restart_server` oder manuell mit `pnpm dev`.  
**Status:** Bekannt, kein Fix geplant (Entwicklungsumgebung)

**Problem:** TypeScript-Fehler nach Schema-Änderungen  
**Beschreibung:** Nach Änderungen am Datenbank-Schema zeigt TypeScript Fehler an, obwohl `pnpm db:push` erfolgreich war.  
**Lösung:** Server-Neustart und TypeScript-Cache leeren (`rm -rf node_modules/.vite`).  
**Status:** Bekannt, kein Fix geplant (Entwicklungsumgebung)

**Problem:** Migrations-Journal-Fehler  
**Beschreibung:** `pnpm db:push` schlägt fehl mit "No file ./drizzle/XXXX.sql found" weil `_journal.json` auf nicht-existierende Migrations verweist.  
**Lösung:** Fehlende Einträge manuell aus `drizzle/meta/_journal.json` entfernen oder SQL direkt mit `webdev_execute_sql` ausführen.  
**Status:** Bekannt, Workaround dokumentiert

#### Nicht-kritische Probleme

**Problem:** Währungsfelder fehlen für Kundentarife  
**Beschreibung:** Kundentarife (onsiteRate, remoteRate, kmRate, mealRate) haben keine Währungsfelder, nur Cents-Werte.  
**Impact:** Internationale Kunden mit verschiedenen Währungen können nicht korrekt abgerechnet werden.  
**Status:** Offen (siehe Roadmap)  
**Priorität:** Mittel

**Problem:** Zeiterfassung hat kein Währungsfeld  
**Beschreibung:** TimeEntry.rate und calculatedAmount haben keine Währungsfelder.  
**Impact:** Berichte zeigen alle Beträge in einer Währung, auch wenn Kunde in anderer Währung abgerechnet wird.  
**Status:** Offen (siehe Roadmap)  
**Priorität:** Mittel

---

## Setup-Anleitung

### Voraussetzungen

Folgende Software muss auf dem Entwicklungssystem installiert sein:

- **Node.js:** Version 22.13.0 oder höher
- **pnpm:** Version 8.0.0 oder höher
- **MySQL:** Version 8.0 oder höher (oder TiDB-kompatible Datenbank)
- **Git:** Für Versionskontrolle

### Installation

**Schritt 1: Repository klonen**
```bash
git clone <repository-url>
cd project-billing-app
```

**Schritt 2: Dependencies installieren**
```bash
pnpm install
```

**Schritt 3: Umgebungsvariablen konfigurieren**

Erstellen Sie eine `.env`-Datei im Projektverzeichnis mit folgenden Variablen:

```env
# Datenbank
DATABASE_URL=mysql://user:password@host:port/database

# Authentifizierung
JWT_SECRET=<random-secret>
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im

# Manus OAuth
VITE_APP_ID=<app-id>
OWNER_OPEN_ID=<owner-open-id>
OWNER_NAME=<owner-name>

# Manus Built-in APIs
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=<api-key>
VITE_FRONTEND_FORGE_API_KEY=<frontend-api-key>
VITE_FRONTEND_FORGE_API_URL=https://forge.manus.im

# Analytics (optional)
VITE_ANALYTICS_ENDPOINT=<endpoint>
VITE_ANALYTICS_WEBSITE_ID=<website-id>

# App-Konfiguration
VITE_APP_TITLE=Döring Consulting - Projekt & Abrechnungsmanagement
VITE_APP_LOGO=<logo-url>
```

**Schritt 4: Datenbank-Schema erstellen**
```bash
pnpm db:push
```

Dieser Befehl generiert SQL-Migrationen aus `drizzle/schema.ts` und führt sie auf der Datenbank aus.

**Schritt 5: Entwicklungsserver starten**
```bash
pnpm dev
```

Die Anwendung ist jetzt unter `http://localhost:3000` erreichbar.

### Entwicklungs-Workflow

**Datenbank-Schema ändern:**
1. Schema in `drizzle/schema.ts` bearbeiten
2. `pnpm db:push` ausführen
3. Server neu starten (falls nötig)

**Tests ausführen:**
```bash
pnpm test
```

**Build für Produktion:**
```bash
pnpm build
```

**Linting:**
```bash
pnpm lint
```

### Deployment

**Vorbereitung:**
1. Alle Tests müssen bestehen (`pnpm test`)
2. Build muss erfolgreich sein (`pnpm build`)
3. Umgebungsvariablen für Produktion konfigurieren
4. Datenbank-Backup erstellen

**Deployment-Schritte:**
1. Code auf Produktionsserver übertragen
2. Dependencies installieren: `pnpm install --prod`
3. Build erstellen: `pnpm build`
4. Datenbank-Migrationen ausführen: `pnpm db:push`
5. Server starten: `pnpm start`

**Empfohlene Hosting-Anbieter:**
- **Hostinger Polen:** Node.js VPS ab 6,99 PLN/Monat
- **OVHcloud Polen:** Web PaaS ab 8 PLN/Monat
- **home.pl:** VPS Linux ab 15 PLN/Monat

Detaillierte Hosting-Dokumentation siehe `docs/hosting-polen.md`.

---

## Bekannte Probleme

### Kritische Probleme

**Offline-Speicherung-Seite statt Dashboard**  
Nach Veröffentlichung zeigt die Anwendung die "Offline-Speicherung"-Seite statt des Dashboards. Dies deutet auf ein Service Worker- oder Routing-Problem hin. Workaround: Browser-Cache leeren, Service Worker deaktivieren, oder Inkognito-Fenster verwenden.

### Nicht-kritische Probleme

**Währungsfelder fehlen für Kundentarife**  
Kundentarife (onsiteRate, remoteRate, kmRate, mealRate) haben keine Währungsfelder. Internationale Kunden mit verschiedenen Währungen können nicht korrekt abgerechnet werden.

**Zeiterfassung hat kein Währungsfeld**  
TimeEntry.rate und calculatedAmount haben keine Währungsfelder. Berichte zeigen alle Beträge in einer Währung.

### Wiederkehrende Fehlerbilder

**Entwicklungsserver reagiert nicht mehr**  
Nach längerer Inaktivität oder vielen Änderungen reagiert der Entwicklungsserver nicht mehr. Lösung: Server-Neustart.

**TypeScript-Fehler nach Schema-Änderungen**  
Nach Änderungen am Datenbank-Schema zeigt TypeScript Fehler an. Lösung: Server-Neustart und TypeScript-Cache leeren.

**Migrations-Journal-Fehler**  
`pnpm db:push` schlägt fehl weil `_journal.json` auf nicht-existierende Migrations verweist. Lösung: Fehlende Einträge manuell entfernen oder SQL direkt ausführen.

---

## Roadmap

### Kurzfristig (nächste 2 Wochen)

**Währungsfelder für Kundentarife**  
Erweitern Sie die Kundenverwaltung um Währungsfelder für Onsite-/Remote-/KM-Tarife, damit internationale Kunden mit verschiedenen Währungen abgerechnet werden können.

**Reisekosten-Export**  
Implementieren Sie einen Excel-Export für Reisekosten eines Monats mit Kategorien-Breakdown und Währungsumrechnung für die Buchhaltung.

**Wechselkurs-Integration in Reports**  
Nutzen Sie die vorhandene exchangeRates-Tabelle für automatische Währungsumrechnung in Reports und Dashboard-Summen.

### Mittelfristig (nächste 4 Wochen)

**Adressspalte in Kundentabelle**  
Fügen Sie eine kompakte "Standort"-Spalte hinzu, die Stadt und Land anzeigt (z.B. "Berlin, Deutschland").

**Formular-Validierung**  
Implementieren Sie Live-Validierung für PLZ-Format und USt-ID-Struktur mit visuellen Hinweisen.

**Adress-Autovervollständigung**  
Integrieren Sie eine Adress-API (z.B. Google Places) für schnellere und fehlerfreie Adresseingabe.

### Langfristig (nächste 3 Monate)

**Electron Desktop-App**  
Entwickeln Sie eine Electron-basierte Desktop-Anwendung mit SQLite-Datenbank für vollständige Offline-Nutzung ohne Browser-Einschränkungen.

**Multi-User-Support**  
Erweitern Sie die Anwendung um Team-Funktionen mit Rollen- und Rechteverwaltung.

**Automatische Rechnungserstellung**  
Implementieren Sie einen Workflow für automatische Rechnungserstellung am Monatsende mit E-Mail-Versand an Kunden.

**API-Integration für Buchhaltungssoftware**  
Integrieren Sie APIs für Buchhaltungssoftware wie Lexoffice, DATEV oder FastBill für automatischen Datenexport.

---

## Anhang

### Verwendete Bibliotheken

| Bibliothek | Version | Zweck |
|------------|---------|-------|
| React | 19.0.0 | Frontend-Framework |
| Tailwind CSS | 4.0.0 | Styling |
| shadcn/ui | Latest | UI-Komponenten |
| tRPC | 11.0.0 | API-Framework |
| Express | 4.21.2 | Backend-Server |
| Drizzle ORM | 0.44.6 | Datenbank-ORM |
| Zod | 3.24.1 | Schema-Validierung |
| Recharts | 2.15.0 | Datenvisualisierung |
| Fuse.js | 7.0.0 | Fuzzy-Suche |
| date-fns | 4.1.0 | Datums-Utilities |
| Sonner | 1.7.3 | Toast-Benachrichtigungen |

### Kontakt

**Projektinhaber:** Döring Consulting  
**Entwickler:** Manus AI  
**Support:** https://help.manus.im

---

**Ende der Dokumentation**
