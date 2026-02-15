# Architektur-Dokumentation - Döring Consulting Projekt & Abrechnungsmanagement

**Zweck:** High-Level-Überblick über Architektur, Technologie-Stack und Design-Entscheidungen  
**Zielgruppe:** Entwickler, Architekten, neue Team-Mitglieder, LLMs  
**Letzte Aktualisierung:** 14. Februar 2026 | Version 1.0.10

---

## Überblick

Die Anwendung ist eine **Full-Stack-Web-Anwendung** für Projekt- und Abrechnungsmanagement, entwickelt für Beratungsunternehmen und Freiberufler. Sie ermöglicht die Erfassung von Arbeitszeiten, Reisekosten und die Erstellung von Berichten und Rechnungen.

### Kern-Features

Die Anwendung bietet Funktionen für **Zeiterfassung** mit minutengenauer Erfassung von Arbeitszeiten pro Kunde und Projekt, **Reisekostenverwaltung** für Kilometer, Verpflegung und Übernachtungskosten, **Kundenverwaltung** mit Kontaktdaten und Projekten, **Berichtswesen** mit Auswertungen und Exporten sowie **Multi-Mandanten-Fähigkeit** zur Verwaltung mehrerer Unternehmen in einer Installation.

### Architektur-Stil

Die Anwendung folgt einer **Monolithischen Architektur** mit klarer Trennung zwischen Frontend und Backend. Frontend und Backend kommunizieren über eine **tRPC-API** mit End-to-End-Typsicherheit. Die Datenbank ist **MySQL/TiDB** mit Drizzle ORM für typsichere Queries.

---

## Technologie-Stack

### Frontend

Das Frontend basiert auf **React 19** als UI-Framework mit funktionalen Komponenten und Hooks. **Vite 6** dient als Build-Tool und Dev-Server mit Hot Module Replacement. Für das Styling wird **Tailwind CSS 4** verwendet mit Utility-First-Ansatz und Custom Design System. Die UI-Komponenten stammen von **shadcn/ui**, einer Sammlung von zugänglichen und anpassbaren Komponenten basierend auf Radix UI. Das Routing erfolgt über **Wouter**, einen minimalistischen React-Router mit Hook-basierter API. Für Diagramme und Visualisierungen kommt **Recharts** zum Einsatz, während **i18next** die Internationalisierung übernimmt (derzeit nur Deutsch).

### Backend

Das Backend nutzt **Node.js 22** als Runtime-Umgebung mit ES Modules. **Express 4** dient als Web-Framework für HTTP-Server und Middleware. Die API-Schicht wird durch **tRPC 11** realisiert, das type-safe APIs ohne Code-Generierung ermöglicht. Die Authentifizierung erfolgt über **Passport.js** mit Local Strategy für E-Mail/Passwort-Login. Als Datenbank kommt **MySQL 8 / TiDB** zum Einsatz, eine relationale Datenbank mit ACID-Garantien. **Drizzle ORM** bietet type-safe Queries und Schema-Management. Für das Passwort-Hashing wird **bcryptjs** verwendet (10 Runden), während **express-session** das Session-Management übernimmt (7 Tage Gültigkeit).

### Testing

Für Unit- und Integration-Tests wird **Vitest** eingesetzt, ein schneller Test-Runner mit Jest-kompatibler API.

### Tools & DevOps

Die Entwicklung nutzt **TypeScript 5** für statische Typisierung und IntelliSense. **pnpm** dient als Paket-Manager mit schnelleren Installs und weniger Disk-Usage. **ESLint** übernimmt das Linting für Code-Qualität und Konsistenz. Die Deployment-Plattform ist **Manus Hosting** mit integriertem CI/CD und Custom Domains.

---

## Projekt-Struktur

```
project-billing-app/
├── client/                    # Frontend (React + Vite)
│   ├── public/               # Statische Assets
│   │   ├── sw.js            # Service Worker (Offline-Support)
│   │   └── ...              # Favicons, Robots.txt
│   ├── src/
│   │   ├── components/      # React-Komponenten
│   │   │   ├── ui/         # shadcn/ui Komponenten
│   │   │   ├── DashboardLayout.tsx  # Haupt-Layout mit Sidebar
│   │   │   └── ...
│   │   ├── contexts/        # React-Contexts (z.B. Theme)
│   │   ├── hooks/           # Custom Hooks
│   │   │   ├── useUpdateCheck.ts   # Service Worker Updates
│   │   │   └── ...
│   │   ├── lib/             # Utilities
│   │   │   ├── trpc.ts     # tRPC-Client-Setup
│   │   │   └── utils.ts    # Helper-Funktionen
│   │   ├── pages/           # Seiten-Komponenten
│   │   │   ├── Home.tsx    # Dashboard
│   │   │   ├── Login.tsx   # Login-Seite
│   │   │   ├── TimeTracking.tsx  # Zeiterfassung
│   │   │   └── ...
│   │   ├── App.tsx          # Haupt-App-Komponente (Routing)
│   │   ├── main.tsx         # Entry Point
│   │   └── index.css        # Global Styles (Tailwind)
│   ├── index.html           # HTML Template
│   └── vite.config.ts       # Vite-Konfiguration
├── server/                   # Backend (Express + tRPC)
│   ├── _core/               # Core-Funktionalität
│   │   ├── context.ts       # tRPC-Context (User, Session)
│   │   ├── index.ts         # Express-Server-Setup
│   │   ├── trpc.ts          # tRPC-Router-Setup
│   │   ├── env.ts           # Umgebungsvariablen
│   │   └── ...
│   ├── auth/                # Authentifizierung
│   │   ├── strategy.ts      # Passport Local Strategy
│   │   └── router.ts        # Auth-Routen (Login, Logout)
│   ├── db.ts                # Datenbank-Funktionen (User, Customer, etc.)
│   ├── db-mandanten.ts      # Mandanten-DB-Funktionen
│   ├── routers.ts           # tRPC-Routers (Haupt-API)
│   └── *.test.ts            # Tests (Vitest)
├── drizzle/                  # Datenbank-Schema
│   └── schema.ts            # Drizzle ORM Schema
├── shared/                   # Shared Code (Frontend + Backend)
│   └── constants.ts         # Konstanten
├── storage/                  # S3 Storage Helpers
│   └── index.ts             # storagePut, storageGet
├── scripts/                  # Build-Scripts
│   └── prepare-checkpoint.mjs  # Version-Bump vor Checkpoint
├── package.json             # npm-Pakete und Scripts
├── tsconfig.json            # TypeScript-Konfiguration
├── vitest.config.ts         # Vitest-Konfiguration
├── CHANGELOG.md             # Nutzer-freundliche Versions-Historie
├── DEVELOPMENT_HISTORY.md   # Technische Entwicklungs-Historie
├── ARCHITECTURE.md          # Diese Datei
├── todo.md                  # Task-Tracking
└── README.md                # Projekt-Dokumentation
```

---

## Datenbank-Schema

### Tabellen-Übersicht

| Tabelle | Zweck | Wichtige Felder |
|---------|-------|-----------------|
| `mandanten` | Mandanten-Verwaltung | mandantNr, name |
| `users` | Benutzer-Accounts | email, passwordHash, role, mandantId |
| `customers` | Kunden | name, email, hourlyRate, userId |
| `timeEntries` | Zeiteinträge | date, hours, description, customerId, userId |
| `expenses` | Reisekosten | date, type, amount, distance, timeEntryId, userId |
| `documents` | Dokumente/Rechnungen | title, content, type, userId |
| `fixedCosts` | Fixkosten | name, amount, frequency, userId |
| `taxSettings` | Steuersätze | vatRate, incomeTaxRate, userId |
| `accountSettings` | Konto-Einstellungen | defaultHourlyRate, currency, userId |
| `currencies` | Währungen | code, name, symbol |
| `exchangeRates` | Wechselkurse | fromCurrency, toCurrency, rate |

### Wichtige Beziehungen

**Mandanten → Users (1:n)** - Ein Mandant kann mehrere Benutzer haben, jeder Benutzer gehört zu genau einem Mandanten.

**Users → Customers (1:n)** - Ein Benutzer kann mehrere Kunden haben, jeder Kunde gehört zu genau einem Benutzer.

**Customers → TimeEntries (1:n)** - Ein Kunde kann mehrere Zeiteinträge haben, jeder Zeiteintrag gehört zu genau einem Kunden.

**TimeEntries → Expenses (1:n)** - Ein Zeiteintrag kann mehrere Reisekosten haben, jede Reisekosten-Position gehört zu genau einem Zeiteintrag.

### Datenbank-Migrations-Strategie

Die Anwendung verwendet **Drizzle Kit** für Schema-Migrations mit `pnpm db:push` zum Anwenden von Schema-Änderungen. Migrations werden **nicht** automatisch bei Deployment ausgeführt, sondern müssen manuell getriggert werden. Schema-Änderungen sollten **rückwärtskompatibel** sein (z.B. neue Spalten mit Defaults).

---

## API-Design

### tRPC-Router-Struktur

Die API ist in **logische Router** unterteilt, die jeweils einen Funktionsbereich abdecken:

**auth** - Authentifizierung (Login, Logout, Me)  
**customers** - Kundenverwaltung (List, Create, Update, Delete)  
**timeEntries** - Zeiterfassung (List, Create, Update, Delete)  
**expenses** - Reisekostenverwaltung (List, Create, Update, Delete)  
**documents** - Dokumentenverwaltung (List, Create, Update, Delete)  
**reports** - Berichtswesen (Generate, Export)  
**settings** - Einstellungen (Account, Tax, Fixed Costs)  
**database** - Datenbank-Import/Export  
**scheduler** - Automatisierte Tasks (Backups)  
**system** - System-Funktionen (Notifications)

### Procedure-Typen

**publicProcedure** - Öffentlich zugänglich, keine Authentifizierung erforderlich (nur für invoiceNumbers, system, scheduler)

**protectedProcedure** - Erfordert Authentifizierung, `ctx.user` ist verfügbar

**adminProcedure** - Erfordert Admin-Rolle, `ctx.user.role === "admin"`

### Input-Validation

Alle Inputs werden mit **Zod** validiert. Beispiel:

```typescript
customers: {
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      email: z.string().email().optional(),
      hourlyRate: z.number().positive().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return await db.createCustomer({
        ...input,
        userId: ctx.user.id,
      });
    }),
}
```

### Error-Handling

tRPC wirft **typisierte Errors** mit spezifischen Codes:

- `UNAUTHORIZED` - Nicht authentifiziert (401)
- `FORBIDDEN` - Keine Berechtigung (403)
- `NOT_FOUND` - Ressource nicht gefunden (404)
- `BAD_REQUEST` - Ungültige Eingabe (400)
- `INTERNAL_SERVER_ERROR` - Server-Fehler (500)

Frontend kann Errors mit `onError`-Handler abfangen:

```typescript
const mutation = trpc.customers.create.useMutation({
  onError: (error) => {
    if (error.data?.code === "UNAUTHORIZED") {
      window.location.href = "/login";
    }
  },
});
```

---

## Authentifizierung & Autorisierung

### Authentifizierungs-Flow

Der Authentifizierungsprozess beginnt, wenn der Benutzer das Login-Formular ausfüllt (Mandant, E-Mail, Passwort) und absendet. Das Frontend sendet dann eine POST-Anfrage an `/api/auth/login` mit den Credentials. Der Server validiert zunächst den Mandanten (nach Mandanten-Nr. oder Name), sucht dann den User in der Datenbank (gefiltert nach Mandant und E-Mail) und prüft das Passwort mit bcrypt. Bei erfolgreicher Validierung wird eine Session erstellt und ein Session-Cookie gesetzt. Das Frontend speichert den User im State und leitet zur Dashboard-Seite weiter.

### Session-Management

Sessions werden **serverseitig** in Memory gespeichert (express-session). Session-Cookies haben eine Gültigkeit von **7 Tagen** und sind als `httpOnly`, `secure` und `sameSite: none` markiert. Bei jedem Request wird die Session validiert und der User in `ctx.user` verfügbar gemacht.

### Autorisierungs-Strategie

Die Autorisierung erfolgt auf **Procedure-Ebene** durch `protectedProcedure` und `adminProcedure`. Zusätzlich gibt es **Daten-Ebene-Filterung** durch `userId` und `mandantId` in Queries. Beispiel:

```typescript
// User kann nur eigene Kunden sehen
const customers = await db.getAllCustomers(ctx.user.id);

// User kann nur Kunden seines Mandanten sehen
const customers = await db.getAllCustomersByMandant(ctx.user.mandantId);
```

### Passwort-Sicherheit

Passwörter werden mit **bcrypt** gehasht (10 Runden). Passwörter werden **niemals** im Klartext gespeichert oder geloggt. Bei Login-Fehlern wird eine **generische Fehlermeldung** angezeigt ("Ungültige Anmeldedaten") um Enumeration zu verhindern.

---

## Frontend-Architektur

### Komponenten-Hierarchie

Die Komponenten-Hierarchie beginnt mit **App.tsx** als Root-Komponente mit Routing. Darunter liegt **DashboardLayout.tsx** als Haupt-Layout mit Sidebar und Header. Die **Seiten-Komponenten** (Home, TimeTracking, etc.) bilden die nächste Ebene, gefolgt von **Feature-Komponenten** (CustomerList, TimeEntryForm, etc.). Die unterste Ebene besteht aus **UI-Komponenten** (Button, Input, Card, etc.).

### State-Management

**Lokaler State** wird mit `useState` für Formular-Inputs und UI-State verwaltet. **Server-State** wird durch tRPC-Queries und Mutations gehandhabt. **Globaler State** wird über React-Context für Theme und Auth-State verwaltet.

### Data-Fetching

Data-Fetching erfolgt mit **tRPC-Hooks** (`useQuery`, `useMutation`). Beispiel:

```typescript
// Query (GET)
const { data, isLoading, error } = trpc.customers.list.useQuery();

// Mutation (POST/PUT/DELETE)
const createMutation = trpc.customers.create.useMutation({
  onSuccess: () => {
    trpc.useUtils().customers.list.invalidate();
  },
});
```

**Optimistic Updates** werden für sofortiges Feedback bei List-Operationen verwendet:

```typescript
const deleteMutation = trpc.customers.delete.useMutation({
  onMutate: async (id) => {
    await trpc.useUtils().customers.list.cancel();
    const previousData = trpc.useUtils().customers.list.getData();
    trpc.useUtils().customers.list.setData(undefined, (old) =>
      old?.filter((c) => c.id !== id)
    );
    return { previousData };
  },
  onError: (err, id, context) => {
    trpc.useUtils().customers.list.setData(undefined, context.previousData);
  },
});
```

### Routing-Strategie

Das Routing basiert auf **Wouter** mit deklarativen Routes:

```typescript
<Switch>
  <Route path="/login" component={Login} />
  <Route path="/" component={Home} />
  <Route path="/customers" component={Customers} />
  <Route path="/time-tracking" component={TimeTracking} />
  <Route path="/:rest*" component={NotFound} />
</Switch>
```

**Auth-Guard** in DashboardLayout.tsx prüft bei jedem Laden, ob User authentifiziert ist, und leitet zur Login-Seite weiter, falls nicht.

---

## Offline-Funktionalität

### Service Worker

Die Anwendung verwendet einen **Custom Service Worker** (`client/public/sw.js`) mit **Network-First-Strategie**. Der Service Worker versucht zuerst, Ressourcen aus dem Netzwerk zu laden, und fällt bei Offline auf Cache zurück. Er cached alle statischen Assets (HTML, CSS, JS, Fonts, Images) und API-Responses (optional).

### Update-Mechanismus

Der Update-Mechanismus funktioniert wie folgt: Bei neuem Deployment wird ein neuer Service Worker registriert. Der `useUpdateCheck`-Hook prüft alle 60 Sekunden auf neue Versionen. Bei neuer Version wird ein **Update-Banner** angezeigt. Der User klickt auf "Jetzt aktualisieren", woraufhin eine `SKIP_WAITING`-Nachricht an den Service Worker gesendet wird. Nach 500ms erfolgt ein automatischer Reload mit neuer Version.

### Daten-Synchronisierung

Aktuell gibt es **keine** automatische Daten-Synchronisierung. Offline-Änderungen werden **nicht** gespeichert. Geplant ist die Implementierung von **IndexedDB** für lokale Daten-Speicherung und **Background Sync API** für automatische Synchronisierung bei Reconnect.

---

## Sicherheit

### Authentifizierung

Die Anwendung nutzt **Passport.js Local Strategy** für E-Mail/Passwort-Login. Passwörter werden mit **bcrypt** gehasht (10 Runden). Sessions werden **serverseitig** verwaltet (express-session) mit einer Gültigkeit von 7 Tagen.

### Autorisierung

Autorisierung erfolgt auf **Procedure-Ebene** durch `protectedProcedure` und `adminProcedure`. Zusätzlich gibt es **Daten-Ebene-Filterung** durch `userId` und `mandantId`.

### CSRF-Protection

Die Anwendung verwendet **Helmet** für Security-Header. Session-Cookies sind als `httpOnly` und `sameSite: none` markiert.

### XSS-Prevention

React escaped automatisch alle Outputs. Zusätzlich wird **DOMPurify** für User-Generated-Content verwendet (geplant).

### SQL-Injection-Prevention

Drizzle ORM verwendet **Prepared Statements** für alle Queries. Niemals werden String-Concatenation für SQL-Queries verwendet.

### Rate-Limiting

Aktuell gibt es **kein** Rate-Limiting. Geplant ist die Implementierung von **express-rate-limit** für Login-Endpoints (z.B. max. 5 Versuche pro 15 Minuten).

---

## Performance-Optimierungen

### Frontend

Das Frontend nutzt **Code-Splitting** mit React.lazy() für Seiten-Komponenten. **Tree-Shaking** durch Vite entfernt ungenutzten Code. **Minification** und **Compression** erfolgen im Production-Build. **Image-Optimization** wird durch moderne Formate (WebP, AVIF) erreicht.

### Backend

Das Backend verwendet **Connection-Pooling** für Datenbank-Verbindungen. **Query-Optimization** erfolgt durch Indexes auf häufig abgefragte Felder. **Caching** ist für statische Daten geplant (z.B. Währungen, Wechselkurse).

### Datenbank

Die Datenbank nutzt **Indexes** auf `userId`, `mandantId`, `email`, `customerId`. **Query-Optimization** erfolgt durch `EXPLAIN ANALYZE` für langsame Queries.

---

## Testing-Strategie

### Unit-Tests

Unit-Tests werden mit **Vitest** für Business-Logic in `server/db.ts` geschrieben. Beispiel:

```typescript
describe("findUserByEmail", () => {
  it("should return user if found", async () => {
    const user = await findUserByEmail("test@example.com");
    expect(user).toBeDefined();
    expect(user.email).toBe("test@example.com");
  });

  it("should return null if not found", async () => {
    const user = await findUserByEmail("nonexistent@example.com");
    expect(user).toBeNull();
  });
});
```

### Integration-Tests

Integration-Tests werden mit **Vitest** für tRPC-Procedures geschrieben. Beispiel:

```typescript
describe("customers.list", () => {
  it("should return all customers for authenticated user", async () => {
    const mockContext = {
      req: {} as any,
      res: {} as any,
      user: { id: 1, mandantId: 1, role: "admin" },
    };

    const result = await appRouter
      .createCaller(mockContext)
      .customers.list();

    expect(result).toBeInstanceOf(Array);
  });
});
```

### E2E-Tests

Aktuell gibt es **keine** E2E-Tests. Geplant ist die Implementierung mit **Playwright** für kritische User-Flows (Login, Zeiterfassung, Rechnungserstellung).

---

## Deployment

### Build-Prozess

Der Build-Prozess läuft wie folgt ab: `pnpm build` erstellt Production-Build für Frontend (Vite) und Backend (TypeScript). Frontend-Assets werden in `dist/client/` abgelegt, während Backend-Code in `dist/server/` kompiliert wird. `pnpm preview` startet Production-Server lokal zum Testen.

### Manus Hosting

Die Anwendung wird auf **Manus Hosting** deployed mit integriertem CI/CD. Bei jedem Checkpoint wird automatisch ein neuer Build erstellt. Custom Domains können über die Management UI konfiguriert werden. SSL-Zertifikate werden automatisch von Let's Encrypt bereitgestellt.

### Umgebungsvariablen

Folgende Umgebungsvariablen müssen gesetzt sein:

**Datenbank:** `DATABASE_URL`  
**Auth:** `SESSION_SECRET`, `JWT_SECRET`  
**Scheduler:** `SCHEDULER_API_KEY`  
**OAuth:** `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID`  
**Owner:** `OWNER_OPEN_ID`, `OWNER_NAME`  
**SMTP:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`  
**Manus APIs:** `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`  
**App:** `VITE_APP_TITLE`, `VITE_APP_LOGO`

### Monitoring

Aktuell gibt es **kein** Monitoring. Geplant ist die Integration von **Sentry** für Error-Tracking und **Plausible** für Analytics.

---

## Design-Entscheidungen

### Warum tRPC statt REST?

tRPC bietet **End-to-End-Typsicherheit** ohne Code-Generierung. Änderungen am Backend brechen sofort TypeScript-Compilation im Frontend. Kein manuelles Schreiben von API-Clients oder OpenAPI-Specs erforderlich. Bessere Developer-Experience mit IntelliSense und Auto-Completion.

### Warum Drizzle ORM statt Prisma?

Drizzle ist **leichtgewichtiger** und hat weniger Overhead. Es bietet **bessere TypeScript-Integration** mit nativen SQL-Queries. Schema-Definitionen sind näher an SQL und leichter zu verstehen. Keine separate CLI für Migrations erforderlich (nur `pnpm db:push`).

### Warum Passport.js statt NextAuth?

Passport.js bietet **mehr Kontrolle** über Authentifizierungs-Flow. Es ist **framework-agnostisch** und funktioniert mit jedem Express-Server. NextAuth ist zu stark an Next.js gekoppelt und schwerer zu customizen.

### Warum Wouter statt React Router?

Wouter ist **minimalistisch** (nur 1.5 KB) und hat weniger Boilerplate. Es bietet Hook-basierte API (`useLocation`, `useRoute`) statt Component-basiert. Für einfache Routing-Anforderungen ist React Router überdimensioniert.

### Warum Tailwind CSS statt CSS Modules?

Tailwind bietet **Utility-First-Ansatz** mit weniger Context-Switching. Es hat **kein CSS-Purging-Problem** (ungenutztes CSS wird automatisch entfernt). Konsistentes Design-System durch vordefinierte Spacing-, Color- und Typography-Scales. Schnellere Entwicklung durch Copy-Paste von Utility-Klassen.

---

## Bekannte Einschränkungen

### Technische Schulden

**Passwort-Änderungs-Funktion fehlt** - Admin kann Passwort nicht selbst ändern, Workaround: Manuelles SQL-UPDATE

**User-Verwaltungs-UI fehlt** - Admin kann keine neuen User anlegen, Workaround: Manuelles SQL-INSERT

**Mandanten-Verwaltungs-UI fehlt** - Admin kann keine neuen Mandanten anlegen, Workaround: Manuelles SQL-INSERT

**E-Mail-Versand nicht konfiguriert** - Password-Reset per E-Mail nicht möglich, SMTP-Konfiguration vorhanden aber nicht getestet

**Rate-Limiting fehlt** - Login-Versuche nicht limitiert, Brute-Force-Angriffe möglich

**Keine E2E-Tests** - Kritische User-Flows nicht automatisch getestet

**Keine Offline-Daten-Synchronisierung** - Offline-Änderungen gehen verloren

### Bekannte Bugs

**Login-Schleife** (seit v1.0.10) - Nach erfolgreichem Login wird User wieder zur Login-Seite weitergeleitet (sporadisch)

---

## Roadmap

### Kurzfristig (1-2 Wochen)

- Login-Schleife beheben
- Passwort-Änderungs-Funktion implementieren
- User-Verwaltungs-UI erstellen
- Mandanten-Verwaltungs-UI erstellen

### Mittelfristig (1-3 Monate)

- E-Mail-Versand konfigurieren und testen
- Rate-Limiting für Login implementieren
- E2E-Tests mit Playwright schreiben
- Offline-Daten-Synchronisierung mit IndexedDB

### Langfristig (3-6 Monate)

- Rechnungserstellung automatisieren
- Projektverwaltung mit Budget-Tracking
- Team-Funktionen mit Rollen und Berechtigungen
- Zwei-Faktor-Authentifizierung

---

## Referenzen

- **React Dokumentation:** https://react.dev/
- **tRPC Dokumentation:** https://trpc.io/
- **Drizzle ORM Dokumentation:** https://orm.drizzle.team/
- **Tailwind CSS Dokumentation:** https://tailwindcss.com/
- **Passport.js Dokumentation:** http://www.passportjs.org/
- **Vitest Dokumentation:** https://vitest.dev/

---

*Für technische Details siehe [DEVELOPMENT_HISTORY.md](./DEVELOPMENT_HISTORY.md)*  
*Für Versions-Historie siehe [CHANGELOG.md](./CHANGELOG.md)*
