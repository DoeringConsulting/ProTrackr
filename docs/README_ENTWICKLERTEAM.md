# README für Entwicklerteam

**Projekt:** Döring Consulting - Projekt & Abrechnungsmanagement  
**Version:** 2dbfac0f  
**Datum:** 7. Februar 2026

---

## Willkommen im Entwicklerteam!

Dieses Dokument dient als Einstiegspunkt für neue Entwickler, die an diesem Projekt arbeiten werden. Es enthält alle wichtigen Informationen, um schnell produktiv zu werden.

---

## Projekt-Übersicht

Die Anwendung **Döring Consulting - Projekt & Abrechnungsmanagement** ist eine webbasierte Lösung für Freiberufler und kleine Beratungsunternehmen zur Verwaltung von Projekten, Zeiterfassung, Reisekosten und Abrechnungen nach polnischem Steuerrecht. Die Anwendung ermöglicht die vollständige Offline-Nutzung mit automatischer Cloud-Synchronisierung über OneDrive, iCloud oder Google Drive.

**Technologie-Stack:**
- **Frontend:** React 19, Tailwind CSS 4, shadcn/ui, Recharts
- **Backend:** Express 4, tRPC 11, Drizzle ORM
- **Datenbank:** MySQL/TiDB
- **Authentifizierung:** Manus OAuth
- **Deployment:** Manus Platform (aktuell), geplant: Hostinger Polen oder OVHcloud Polen

---

## Schnellstart

### 1. Repository klonen

```bash
git clone <repository-url>
cd project-billing-app
```

### 2. Dependencies installieren

```bash
pnpm install
```

### 3. Umgebungsvariablen konfigurieren

Erstellen Sie eine `.env`-Datei im Projektverzeichnis. Fragen Sie den Projektinhaber nach den aktuellen Werten.

```env
DATABASE_URL=mysql://user:password@host:port/database
JWT_SECRET=<random-secret>
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
VITE_APP_ID=<app-id>
OWNER_OPEN_ID=<owner-open-id>
OWNER_NAME=<owner-name>
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=<api-key>
VITE_FRONTEND_FORGE_API_KEY=<frontend-api-key>
VITE_FRONTEND_FORGE_API_URL=https://forge.manus.im
VITE_APP_TITLE=Döring Consulting - Projekt & Abrechnungsmanagement
VITE_APP_LOGO=<logo-url>
```

### 4. Datenbank-Schema erstellen

```bash
pnpm db:push
```

### 5. Entwicklungsserver starten

```bash
pnpm dev
```

Die Anwendung ist jetzt unter `http://localhost:3000` erreichbar.

---

## Projekt-Struktur

```
project-billing-app/
├── client/                    # Frontend (React)
│   ├── src/
│   │   ├── pages/           # Seiten-Komponenten
│   │   ├── components/      # Wiederverwendbare UI-Komponenten
│   │   ├── contexts/        # React Contexts
│   │   ├── hooks/           # Custom Hooks
│   │   ├── lib/trpc.ts     # tRPC Client
│   │   ├── App.tsx          # Routing
│   │   └── main.tsx         # Entry Point
│   └── index.html
├── server/                    # Backend (Express + tRPC)
│   ├── _core/                # Framework-Plumbing (nicht anfassen!)
│   ├── routers.ts            # tRPC Procedures
│   ├── db.ts                 # Datenbank-Helfer
│   └── *.test.ts            # Unit-Tests
├── drizzle/                   # Datenbank-Schema & Migrationen
│   ├── schema.ts             # Tabellen-Definitionen
│   └── meta/                 # Migrations-Metadaten
├── shared/                    # Geteilte Typen & Konstanten
└── package.json
```

**Wichtige Dateien:**
- `server/routers.ts`: Alle tRPC-Endpunkte
- `server/db.ts`: Datenbank-Query-Funktionen
- `drizzle/schema.ts`: Datenbank-Schema
- `client/src/App.tsx`: Routing-Konfiguration
- `client/src/components/DashboardLayout.tsx`: Haupt-Layout mit Sidebar

---

## Entwicklungs-Workflow

### Datenbank-Schema ändern

1. Schema in `drizzle/schema.ts` bearbeiten
2. `pnpm db:push` ausführen
3. Server neu starten (falls nötig)

**Beispiel:** Neues Feld zu `customers`-Tabelle hinzufügen

```typescript
// drizzle/schema.ts
export const customers = mysqlTable("customers", {
  // ... bestehende Felder
  newField: varchar("new_field", { length: 255 }),
});
```

```bash
pnpm db:push
```

### Neuen tRPC-Endpunkt erstellen

1. Endpunkt in `server/routers.ts` definieren
2. Datenbank-Helfer in `server/db.ts` erstellen (falls nötig)
3. Frontend-Query in Komponente verwenden

**Beispiel:** Neuer Endpunkt `customers.getArchived`

```typescript
// server/routers.ts
customers: router({
  // ... bestehende Endpunkte
  getArchived: protectedProcedure.query(async ({ ctx }) => {
    const { getArchivedCustomers } = await import("./db");
    return await getArchivedCustomers(ctx.user.id);
  }),
}),
```

```typescript
// server/db.ts
export async function getArchivedCustomers(userId: number) {
  const db = await getDb();
  return await db
    .select()
    .from(customers)
    .where(and(eq(customers.userId, userId), eq(customers.archived, true)));
}
```

```typescript
// client/src/pages/Customers.tsx
const { data: archivedCustomers = [] } = trpc.customers.getArchived.useQuery();
```

### Tests schreiben

Tests befinden sich in `server/*.test.ts` und verwenden Vitest.

**Beispiel:** Test für `customers.create`

```typescript
// server/customers.test.ts
import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

describe("Customers", () => {
  it("should create a new customer", async () => {
    const caller = appRouter.createCaller({ user: { id: 1 } });
    const customer = await caller.customers.create({
      provider: "Test GmbH",
      mandantNr: "12345",
      projectNr: "PRJ-001",
      country: "Deutschland",
      onsiteRate: 80000,
      remoteRate: 60000,
      kmRate: 30,
      mealRate: 2000,
      billingModel: "exclusive",
    });
    expect(customer.id).toBeDefined();
    expect(customer.provider).toBe("Test GmbH");
  });
});
```

```bash
pnpm test
```

### Komponenten erstellen

shadcn/ui-Komponenten werden mit dem CLI installiert:

```bash
npx shadcn@latest add <component-name>
```

**Beispiel:** Button-Komponente hinzufügen

```bash
npx shadcn@latest add button
```

Die Komponente wird in `client/src/components/ui/button.tsx` erstellt und kann importiert werden:

```typescript
import { Button } from "@/components/ui/button";

<Button variant="default" size="lg">
  Klick mich
</Button>
```

---

## Wichtige Konzepte

### tRPC

tRPC ermöglicht End-to-End-Typsicherheit zwischen Frontend und Backend ohne Code-Generierung. Alle API-Endpunkte sind in `server/routers.ts` definiert und können im Frontend direkt aufgerufen werden.

**Beispiel: Query**
```typescript
const { data, isLoading } = trpc.customers.list.useQuery();
```

**Beispiel: Mutation**
```typescript
const createMutation = trpc.customers.create.useMutation({
  onSuccess: () => {
    toast.success("Kunde erstellt");
  },
});

createMutation.mutate({
  provider: "Test GmbH",
  // ... weitere Felder
});
```

### Optimistic Updates

Für bessere UX verwenden wir Optimistic Updates bei Mutationen. Dabei wird die UI sofort aktualisiert, bevor die Server-Antwort eintrifft.

**Beispiel:**
```typescript
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
    toast.success("Kunde gelöscht");
  },
  onError: (error, variables, context) => {
    if (context?.previousCustomers) {
      utils.customers.list.setData(undefined, context.previousCustomers);
    }
    toast.error(`Fehler: ${error.message}`);
    utils.customers.list.invalidate();
  },
});
```

### Drizzle ORM

Drizzle ist ein TypeScript-first ORM mit typsicheren Queries. Alle Tabellen sind in `drizzle/schema.ts` definiert.

**Beispiel: Select**
```typescript
const db = await getDb();
const customers = await db
  .select()
  .from(customers)
  .where(eq(customers.userId, userId));
```

**Beispiel: Insert**
```typescript
const result = await db.insert(customers).values({
  userId: 1,
  provider: "Test GmbH",
  // ... weitere Felder
});
```

**Beispiel: Update**
```typescript
await db
  .update(customers)
  .set({ archived: true })
  .where(eq(customers.id, customerId));
```

**Beispiel: Delete**
```typescript
await db.delete(customers).where(eq(customers.id, customerId));
```

---

## Häufige Aufgaben

### Neues Feature implementieren

1. **Datenbank-Schema erweitern** (falls nötig)
   - `drizzle/schema.ts` bearbeiten
   - `pnpm db:push` ausführen

2. **Backend-Endpunkt erstellen**
   - `server/routers.ts` erweitern
   - `server/db.ts` Helfer-Funktionen hinzufügen

3. **Frontend-UI erstellen**
   - Neue Seite in `client/src/pages/` erstellen
   - Komponenten in `client/src/components/` erstellen
   - Route in `client/src/App.tsx` hinzufügen

4. **Tests schreiben**
   - `server/*.test.ts` erstellen
   - `pnpm test` ausführen

5. **Dokumentation aktualisieren**
   - `PROJEKTDOKUMENTATION.md` aktualisieren
   - `ENTWICKLUNGSHISTORIE.md` aktualisieren
   - `todo.md` aktualisieren

### Bug beheben

1. **Bug reproduzieren**
   - Schritte dokumentieren
   - Browser-Konsole prüfen
   - Server-Logs prüfen

2. **Ursache finden**
   - Code-Stelle identifizieren
   - Debugging mit `console.log()` oder Breakpoints

3. **Fix implementieren**
   - Code ändern
   - Tests schreiben (falls noch nicht vorhanden)
   - Tests ausführen

4. **Dokumentation aktualisieren**
   - `ENTWICKLUNGSHISTORIE.md` aktualisieren
   - Bekannte Probleme entfernen (falls behoben)

### Deployment vorbereiten

1. **Tests ausführen**
   ```bash
   pnpm test
   ```

2. **Build erstellen**
   ```bash
   pnpm build
   ```

3. **Datenbank-Backup erstellen**
   - Über UI: Dashboard → Backup → "Backup erstellen"

4. **Umgebungsvariablen für Produktion konfigurieren**
   - `.env.production` erstellen

5. **Deployment durchführen**
   - Code auf Server übertragen
   - Dependencies installieren: `pnpm install --prod`
   - Build erstellen: `pnpm build`
   - Datenbank-Migrationen ausführen: `pnpm db:push`
   - Server starten: `pnpm start`

---

## Bekannte Probleme

### Entwicklungsserver reagiert nicht mehr

**Symptom:** Nach längerer Inaktivität oder vielen Änderungen reagiert der Entwicklungsserver nicht mehr.

**Lösung:** Server neu starten
```bash
# Strg+C zum Stoppen
pnpm dev
```

### TypeScript-Fehler nach Schema-Änderungen

**Symptom:** Nach Änderungen am Datenbank-Schema zeigt TypeScript Fehler an, obwohl `pnpm db:push` erfolgreich war.

**Lösung:** Server neu starten und TypeScript-Cache leeren
```bash
rm -rf node_modules/.vite
pnpm dev
```

### Migrations-Journal-Fehler

**Symptom:** `pnpm db:push` schlägt fehl mit "No file ./drizzle/XXXX.sql found"

**Lösung:** Fehlende Einträge aus `drizzle/meta/_journal.json` entfernen

```bash
# Öffnen Sie drizzle/meta/_journal.json und entfernen Sie Einträge
# die auf nicht-existierende .sql-Dateien verweisen
```

### Offline-Speicherung-Seite statt Dashboard

**Symptom:** Nach Veröffentlichung zeigt die Anwendung die "Offline-Speicherung"-Seite statt des Dashboards.

**Lösung:** Browser-Cache leeren oder Service Worker deaktivieren
```
1. Strg+Shift+Entf drücken
2. "Gesamter Zeitraum" wählen
3. "Cookies und andere Websitedaten" + "Bilder und Dateien im Cache" aktivieren
4. "Daten löschen" klicken

ODER

1. F12 drücken (DevTools öffnen)
2. Tab "Application" wählen
3. "Service Workers" klicken
4. "Unregister" bei allen Service Workern klicken
5. Seite neu laden (F5)
```

---

## Nützliche Befehle

```bash
# Entwicklungsserver starten
pnpm dev

# Tests ausführen
pnpm test

# Build für Produktion
pnpm build

# Linting
pnpm lint

# Datenbank-Schema aktualisieren
pnpm db:push

# Datenbank-Studio öffnen (Drizzle Studio)
pnpm db:studio

# Dependencies aktualisieren
pnpm update

# Dependencies installieren
pnpm install

# Cache leeren
rm -rf node_modules/.vite
rm -rf client/dist
```

---

## Code-Konventionen

### Naming Conventions

- **Komponenten:** PascalCase (z.B. `CustomerForm.tsx`)
- **Funktionen:** camelCase (z.B. `getCustomers()`)
- **Variablen:** camelCase (z.B. `const customerId = 1`)
- **Konstanten:** UPPER_SNAKE_CASE (z.B. `const MAX_RETRIES = 3`)
- **Typen/Interfaces:** PascalCase (z.B. `type Customer = { ... }`)

### Datei-Struktur

- **Seiten:** `client/src/pages/PageName.tsx`
- **Komponenten:** `client/src/components/ComponentName.tsx`
- **UI-Komponenten:** `client/src/components/ui/component-name.tsx`
- **Hooks:** `client/src/hooks/useHookName.ts`
- **Contexts:** `client/src/contexts/ContextName.tsx`
- **Utils:** `client/src/lib/utilName.ts`

### Kommentare

- Verwenden Sie Kommentare sparsam
- Erklären Sie **warum**, nicht **was**
- Nutzen Sie JSDoc für öffentliche Funktionen

```typescript
/**
 * Berechnet den Nettogewinn nach Abzug aller Kosten und Steuern.
 * 
 * @param revenue - Bruttoumsatz in Cents
 * @param costs - Fixkosten in Cents
 * @param taxRate - Steuersatz als Dezimalzahl (z.B. 0.19 für 19%)
 * @returns Nettogewinn in Cents
 */
function calculateNetProfit(revenue: number, costs: number, taxRate: number): number {
  const taxableIncome = revenue - costs;
  const tax = taxableIncome * taxRate;
  return taxableIncome - tax;
}
```

### Git Commit Messages

Verwenden Sie aussagekräftige Commit-Messages im Format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Typen:**
- `feat`: Neues Feature
- `fix`: Bugfix
- `docs`: Dokumentation
- `style`: Formatierung
- `refactor`: Code-Refactoring
- `test`: Tests
- `chore`: Wartung

**Beispiel:**
```
feat(customers): add address fields to customer form

- Added street, postalCode, city, country, vatId fields to customers table
- Extended backend endpoints customers.create and update
- Added address fields to customer form in frontend
- All 21 tests passing

Closes #16
```

---

## Ressourcen

### Dokumentation

- **Projekt-Dokumentation:** `PROJEKTDOKUMENTATION.md`
- **Entwicklungshistorie:** `ENTWICKLUNGSHISTORIE.md`
- **TODO-Liste:** `todo.md`

### Externe Dokumentation

- **React:** https://react.dev
- **Tailwind CSS:** https://tailwindcss.com
- **shadcn/ui:** https://ui.shadcn.com
- **tRPC:** https://trpc.io
- **Drizzle ORM:** https://orm.drizzle.team
- **Express:** https://expressjs.com
- **Vitest:** https://vitest.dev

### Support

- **Projektinhaber:** Döring Consulting
- **Manus Support:** https://help.manus.im

---

## Nächste Schritte

1. **Projekt klonen und Setup durchführen** (siehe Schnellstart)
2. **Dokumentation lesen** (`PROJEKTDOKUMENTATION.md`, `ENTWICKLUNGSHISTORIE.md`)
3. **Code-Basis erkunden** (starten Sie mit `client/src/App.tsx` und `server/routers.ts`)
4. **Erstes Feature implementieren** (siehe `todo.md` für offene Aufgaben)
5. **Tests schreiben** (siehe `server/*.test.ts` für Beispiele)

---

**Viel Erfolg beim Entwickeln!**

Bei Fragen wenden Sie sich an den Projektinhaber oder das Manus Support-Team.
