# Development History - Döring Consulting Projekt & Abrechnungsmanagement

**Zweck:** Vollständige technische Dokumentation aller Code-Änderungen für AI-Agents und Entwickler  
**Zielgruppe:** LLMs (Cursor, GitHub Copilot), Entwickler, Code-Reviews  
**Format:** Chronologisch, mit Datei-Pfaden und Code-Details

---

## Version 1.0.10 - Login-Problem behoben + Mandanten-Verwaltung

**Datum:** 14. Februar 2026  
**Checkpoint:** 27a2fe61  
**Typ:** Feature + Bugfix

### Problem: Login funktioniert nicht

**Symptom:** Login mit admin@doering-consulting.eu / ChangeMe123! schlägt fehl

**Root Cause Analysis:**
1. Passwort-Hash in Datenbank war inkorrekt generiert
2. E-Mail-Adresse entsprach nicht den echten Adressen des Kunden

**Fix:**

```sql
-- Neuen bcrypt-Hash generieren (10 rounds)
UPDATE users 
SET passwordHash = '$2b$10$YourNewHashHere',
    email = 'a.doering@doering-consulting.eu',
    name = 'Alexander Döring',
    role = 'admin'
WHERE id = 1260000;
```

**Betroffene Dateien:** Keine Code-Änderungen, nur Datenbank-Update

---

### Feature: Mandanten-Verwaltung (Multi-Tenancy)

**Motivation:**
- Vorbereitung für Multi-Mandanten-Fähigkeit
- Sicherere Authentifizierung durch zusätzlichen Faktor (Mandant + E-Mail + Passwort)
- Klare Datentrennung zwischen verschiedenen Mandanten

#### 1. Datenbank-Schema-Änderungen

**Datei:** `drizzle/schema.ts`

**Neue Tabelle: mandanten**

```typescript
export const mandanten = mysqlTable("mandanten", {
  id: int("id").primaryKey().autoincrement(),
  mandantNr: varchar("mandantNr", { length: 50 }).unique().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
```

**users-Tabelle erweitert:**

```typescript
export const users = mysqlTable("users", {
  // ... existing fields ...
  mandantId: int("mandantId").notNull().references(() => mandanten.id),
});
```

**Migration:**

```sql
-- Mandanten-Tabelle erstellen
CREATE TABLE mandanten (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mandantNr VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- users-Tabelle erweitern
ALTER TABLE users 
ADD COLUMN mandantId INT NOT NULL,
ADD CONSTRAINT fk_users_mandant 
  FOREIGN KEY (mandantId) REFERENCES mandanten(id);

-- Ersten Mandanten anlegen
INSERT INTO mandanten (mandantNr, name) 
VALUES ('DC001', 'Döring Consulting');

-- Existierende User mit Mandant verknüpfen
UPDATE users SET mandantId = 1 WHERE id = 1260000;
```

#### 2. Backend-Änderungen

**Neue Datei:** `server/db-mandanten.ts`

```typescript
import { db } from "./db";
import { mandanten } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export async function findMandantByNr(mandantNr: string) {
  const result = await db
    .select()
    .from(mandanten)
    .where(eq(mandanten.mandantNr, mandantNr))
    .limit(1);
  return result[0] || null;
}

export async function findMandantByName(name: string) {
  const result = await db
    .select()
    .from(mandanten)
    .where(eq(mandanten.name, name))
    .limit(1);
  return result[0] || null;
}

export async function getAllMandanten() {
  return await db.select().from(mandanten);
}
```

**Geänderte Datei:** `server/db.ts`

```typescript
// Alte Funktion (ohne Mandanten-Filter)
export async function findUserByEmail(email: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result[0] || null;
}

// Neue Funktion (mit Mandanten-Filter)
export async function findUserByEmailAndMandant(email: string, mandantId: number) {
  const result = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.email, email),
        eq(users.mandantId, mandantId)
      )
    )
    .limit(1);
  return result[0] || null;
}

// createUser erweitert
export async function createUser(data: {
  email: string;
  passwordHash: string;
  displayName?: string;
  role?: "user" | "admin";
  mandantId: number; // NEU
}) {
  const result = await db.insert(users).values({
    email: data.email,
    passwordHash: data.passwordHash,
    name: data.displayName || null,
    role: data.role || "user",
    mandantId: data.mandantId, // NEU
  });
  return result.insertId;
}
```

**Geänderte Datei:** `server/auth/strategy.ts`

**Wichtige Änderung:** `passReqToCallback: true` aktiviert, damit `req.body.mandant` verfügbar ist

```typescript
import { findMandantByNr, findMandantByName } from "../db-mandanten";
import { findUserByEmailAndMandant } from "../db";

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
      passReqToCallback: true, // NEU: Ermöglicht Zugriff auf req.body.mandant
    },
    async (req: any, email, password, done) => {
      try {
        const mandantInput = req.body.mandant;

        // 1. Mandant validieren (nach Nr. oder Name)
        let mandant = await findMandantByNr(mandantInput);
        if (!mandant) {
          mandant = await findMandantByName(mandantInput);
        }
        if (!mandant) {
          return done(null, false, { message: "Ungültiger Mandant" });
        }

        // 2. User validieren (mit Mandanten-Filter)
        const user = await findUserByEmailAndMandant(email, mandant.id);
        if (!user || !user.passwordHash) {
          return done(null, false, { message: "Ungültige Anmeldedaten" });
        }

        // 3. Passwort prüfen
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return done(null, false, { message: "Ungültige Anmeldedaten" });
        }

        // 4. Session mit mandantId erstellen
        return done(null, {
          id: user.id,
          mandantId: user.mandantId, // NEU
          email: user.email,
          displayName: user.name,
          role: user.role,
        });
      } catch (error) {
        return done(error);
      }
    }
  )
);
```

**Geänderte Datei:** `server/_core/context.ts`

```typescript
export async function createContext({ req, res }: CreateContextOptions) {
  const user = req.user as {
    id: number;
    mandantId: number; // NEU
    email: string;
    displayName: string | null;
    role: "user" | "admin";
  } | undefined;

  return {
    req,
    res,
    user: user || null,
  };
}
```

**Geänderte Datei:** `server/auth/router.ts`

```typescript
// Register-Route deaktiviert (nur Admin kann User anlegen)
router.post("/register", (req, res) => {
  res.status(403).json({ error: "Registration disabled. Contact admin." });
});
```

#### 3. Frontend-Änderungen

**Geänderte Datei:** `client/src/pages/Login.tsx`

```typescript
export default function Login() {
  const [mandant, setMandant] = useState(""); // NEU
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mandant, email, password }), // NEU: mandant
      });

      if (res.ok) {
        setLocation("/");
      } else {
        const data = await res.json();
        setError(data.error || "Login fehlgeschlagen");
      }
    } catch (err) {
      setError("Netzwerkfehler");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Anmelden</CardTitle>
          <CardDescription>
            Melden Sie sich mit Ihren Zugangsdaten an
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* NEU: Mandanten-Feld */}
            <div className="space-y-2">
              <Label htmlFor="mandant">Mandant</Label>
              <Input
                id="mandant"
                type="text"
                placeholder="Mandanten-Nr. oder Name"
                value={mandant}
                onChange={(e) => setMandant(e.target.value)}
                required
                autoComplete="organization"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="ihre@email.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full">
              Anmelden
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### 4. Test-Anpassungen

**Alle Test-Dateien:** `server/*.test.ts`

```typescript
// Mock-User mit mandantId erweitert
const mockUser = {
  id: 1,
  mandantId: 1, // NEU
  email: "test@example.com",
  displayName: "Test User",
  role: "admin" as const,
};

const mockContext = {
  req: {} as any,
  res: {} as any,
  user: mockUser,
};
```

**Betroffene Dateien:**
- `server/settings.test.ts`
- `server/customers.test.ts`
- `server/timeEntries.test.ts`
- `server/expenses.test.ts`
- `server/documents.test.ts`
- `server/auth.logout.test.ts`
- `server/secrets.test.ts`

---

## Version 1.0.9 - Authentifizierung mit Passport.js

**Datum:** 14. Februar 2026  
**Checkpoint:** 5bd39353  
**Typ:** Feature + Security

### Motivation

Ersetzen der Manus OAuth durch eigenes Login-System mit E-Mail/Passwort-Authentifizierung für mehr Kontrolle und Unabhängigkeit.

### 1. Datenbank-Schema-Anpassung

**Datei:** `drizzle/schema.ts`

**Problem:** Existierende users-Tabelle hatte OAuth-spezifische Felder

**Lösung:** Schema an bestehende Struktur anpassen (kein DROP TABLE)

```typescript
export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  resetToken: varchar("resetToken", { length: 255 }),
  resetTokenExpiry: timestamp("resetTokenExpiry"),
  emailVerified: int("emailVerified").default(0).notNull(),
});
```

**Wichtig:** Drizzle konvertiert `passwordHash` automatisch zu `password_hash` in MySQL

### 2. User-DB-Funktionen

**Datei:** `server/db.ts`

```typescript
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";

export async function findUserByEmail(email: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result[0] || null;
}

export async function findUserById(id: number) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return result[0] || null;
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  displayName?: string;
  role?: "user" | "admin";
}) {
  const result = await db.insert(users).values({
    email: data.email,
    passwordHash: data.passwordHash,
    name: data.displayName || null,
    role: data.role || "user",
  });
  return result.insertId;
}
```

### 3. Passport.js Local Strategy

**Neue Datei:** `server/auth/strategy.ts`

```typescript
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import { findUserByEmail, findUserById } from "../db";

passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const user = await findUserByEmail(email);
        if (!user || !user.passwordHash) {
          return done(null, false, { message: "Ungültige Anmeldedaten" });
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return done(null, false, { message: "Ungültige Anmeldedaten" });
        }

        return done(null, {
          id: user.id,
          email: user.email,
          displayName: user.name,
          role: user.role,
        });
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await findUserById(id);
    if (!user) {
      return done(null, false);
    }
    done(null, {
      id: user.id,
      email: user.email,
      displayName: user.name,
      role: user.role,
    });
  } catch (error) {
    done(error);
  }
});
```

### 4. Auth-Routen

**Neue Datei:** `server/auth/router.ts`

```typescript
import express from "express";
import passport from "passport";
import bcrypt from "bcryptjs";
import { createUser, findUserByEmail } from "../db";

const router = express.Router();

// Login
router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err: any, user: any, info: any) => {
    if (err) {
      return res.status(500).json({ error: "Server error" });
    }
    if (!user) {
      return res.status(401).json({ error: info?.message || "Login failed" });
    }
    req.logIn(user, (err) => {
      if (err) {
        return res.status(500).json({ error: "Session error" });
      }
      return res.json({ user });
    });
  })(req, res, next);
});

// Logout
router.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Session destroy failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });
});

// Current User
router.get("/me", (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
});

// Register (deaktiviert)
router.post("/register", async (req, res) => {
  res.status(403).json({ error: "Registration disabled. Contact admin." });
});

export default router;
```

### 5. Session-Konfiguration

**Geänderte Datei:** `server/_core/index.ts`

```typescript
import session from "express-session";
import passport from "passport";
import "../auth/strategy"; // Passport Strategy laden
import authRouter from "../auth/router";

const app = express();

// Session Middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // HTTPS erforderlich
      httpOnly: true,
      sameSite: "none", // Cross-Origin Support
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Tage
    },
  })
);

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Auth Routes
app.use("/api/auth", authRouter);
```

### 6. Context-Anpassung

**Geänderte Datei:** `server/_core/context.ts`

```typescript
import { CreateExpressContextOptions } from "@trpc/server/adapters/express";

export async function createContext({ req, res }: CreateExpressContextOptions) {
  const user = req.user as {
    id: number;
    email: string;
    displayName: string | null;
    role: "user" | "admin";
  } | undefined;

  return {
    req,
    res,
    user: user || null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

### 7. Protected Procedures

**Geänderte Datei:** `server/_core/trpc.ts`

```typescript
import { TRPCError } from "@trpc/server";

// adminProcedure Auth-Check reaktiviert
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
});
```

### 8. Router-Absicherung

**Geänderte Datei:** `server/routers.ts`

**Änderungen:** 50+ Routen von `publicProcedure` auf `protectedProcedure` umgestellt

**Beispiel:**

```typescript
// Vorher
customers: {
  list: publicProcedure.query(async ({ ctx }) => {
    return await db.getAllCustomers(1); // Hardcoded userId
  }),
}

// Nachher
customers: {
  list: protectedProcedure.query(async ({ ctx }) => {
    return await db.getAllCustomers(ctx.user.id); // Dynamischer userId
  }),
}
```

**Alle 9 Stellen mit `userId: 1` ersetzt durch `ctx.user.id`:**
1. `customers.list` (Zeile 28)
2. `customers.create` (Zeile 33)
3. `timeEntries.list` (Zeile 116)
4. `timeEntries.create` (Zeile 137)
5. `expenses.create` (Zeile 221)
6. `documents.create` (Zeile 483)
7. `accountSettings.get` (Zeile 605)
8. `accountSettings.upsert` (Zeile 612)
9. `database.importDatabase` (Zeile 625)

### 9. Scheduler-Absicherung

**Geänderte Datei:** `server/routers.ts`

```typescript
import { TRPCError } from "@trpc/server";

scheduler: {
  triggerBackup: publicProcedure
    .input(z.object({ apiKey: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // API-Key-Check
      if (input.apiKey !== process.env.SCHEDULER_API_KEY) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid API key",
        });
      }
      // Backup-Logik...
    }),
}
```

### 10. Frontend-Integration

**Neue Datei:** `client/src/pages/Login.tsx`

```typescript
import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        setLocation("/");
      } else {
        const data = await res.json();
        setError(data.error || "Login fehlgeschlagen");
      }
    } catch (err) {
      setError("Netzwerkfehler");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Anmelden</CardTitle>
          <CardDescription>
            Melden Sie sich mit Ihren Zugangsdaten an
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="ihre@email.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full">
              Anmelden
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Geänderte Datei:** `client/src/App.tsx`

```typescript
import { Route, Switch } from "wouter";
import Login from "./pages/Login";

function App() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      {/* ... andere Routen ... */}
    </Switch>
  );
}
```

**Geänderte Datei:** `client/src/components/DashboardLayout.tsx`

```typescript
// Auth-Check beim Laden
useEffect(() => {
  const checkAuth = async (isRetry = false) => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) {
        if (!isRetry) {
          // Retry nach 800ms (Race Condition beim Cookie-Setzen)
          setTimeout(() => checkAuth(true), 800);
        } else {
          // Zweiter Versuch auch 401 → zur Login-Seite
          setLocation("/login");
        }
      } else if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setAuthChecked(true);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setLocation("/login");
    }
  };

  checkAuth();
}, [setLocation]);

// Logout-Handler
const handleLogout = async () => {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setLocation("/login");
  } catch (error) {
    console.error("Logout failed:", error);
  }
};
```

**Geänderte Datei:** `client/src/main.tsx`

```typescript
// UNAUTHORIZED-Redirect aktiviert
trpc.useQueryClient().setDefaultOptions({
  queries: {
    onError: (error: any) => {
      if (error?.data?.code === "UNAUTHORIZED") {
        window.location.href = "/login";
      }
    },
  },
  mutations: {
    onError: (error: any) => {
      if (error?.data?.code === "UNAUTHORIZED") {
        window.location.href = "/login";
      }
    },
  },
});
```

### 11. Secrets

**Neue Umgebungsvariablen:**

```env
SESSION_SECRET=<64-Zeichen-zufälliger-String>
SCHEDULER_API_KEY=<64-Zeichen-zufälliger-String>
```

**Generierung:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 12. Test-Anpassungen

**Alle Test-Dateien:** `server/*.test.ts`

```typescript
// Mock-User für Auth-Context
const mockUser = {
  id: 1,
  email: "test@example.com",
  displayName: "Test User",
  role: "admin" as const,
};

const mockContext = {
  req: {} as any,
  res: {} as any,
  user: mockUser,
};
```

---

## Version 1.0.8 - Update-System Timeout & Doppel-Reload behoben

**Datum:** 14. Februar 2026  
**Checkpoint:** 4b001556  
**Typ:** Bugfix

### Problem 1: Update-Banner Timeout auf iOS Safari

**Symptom:** Nach Klick auf "Jetzt aktualisieren" passiert nichts, Timeout-Fehler

**Root Cause:** `controllerchange`-Event wird auf iOS Safari nicht gefeuert

**Fix:** Direkter Reload nach `postMessage`, ohne auf `controllerchange` zu warten

**Datei:** `client/src/registerSW.ts`

```typescript
// Vorher (FALSCH)
navigator.serviceWorker.addEventListener('controllerchange', () => {
  window.location.reload(); // Wird auf iOS Safari nie aufgerufen
});

button.onclick = async () => {
  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    // Wartet auf controllerchange...
  }
};

// Nachher (KORREKT)
button.onclick = async () => {
  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    setTimeout(() => window.location.reload(), 500); // Direkter Reload
  }
};
```

### Problem 2: skipWaiting() zu früh aufgerufen

**Symptom:** Service Worker aktiviert sich sofort, bevor User bereit ist

**Root Cause:** `skipWaiting()` im `install`-Event statt auf explizite Nachricht

**Fix:** `skipWaiting()` nur auf `SKIP_WAITING`-Nachricht aufrufen

**Datei:** `client/public/sw.js`

```javascript
// Vorher (FALSCH)
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Zu früh!
});

// Nachher (KORREKT)
self.addEventListener('install', (event) => {
  // Kein skipWaiting() hier
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting(); // Nur auf explizite Nachricht
  }
});
```

### Problem 3: Doppel-Reload (automatisch + Button)

**Symptom:** Nach Update wird Seite zweimal neu geladen

**Root Cause:** Zwei konkurrierende Update-Systeme (useUpdateCheck.ts + registerSW.ts)

**Fix:** Auto-Reload in `useUpdateCheck.ts` deaktiviert

**Datei:** `client/src/hooks/useUpdateCheck.ts`

```typescript
// Vorher (FALSCH)
if (newVersion !== currentVersion) {
  window.location.reload(); // Automatischer Reload
}

// Nachher (KORREKT)
if (newVersion !== currentVersion) {
  setUpdateAvailable(true); // Nur Banner anzeigen
}
```

---

## Version 1.0.7 - Reisekosten Timezone-Problem behoben

**Datum:** 14. Februar 2026  
**Checkpoint:** 6d82bfa8  
**Typ:** Bugfix

### Problem: Reisekosten fallen in Vortag

**Symptom:** Reisekosteneintrag am 14. Feb wird als 13. Feb gespeichert

**Root Cause:** `.toISOString()` konvertiert lokale Mitternacht nach UTC

**Beispiel:**

```
User wählt: 14. Februar 2026
new Date(2026, 1, 14) → 14.02.2026 00:00 MEZ (UTC+1)
.toISOString() → "2026-02-13T23:00:00.000Z" ← Vortag!
```

**Fix:** Lokale Datumsformatierung ohne UTC-Konvertierung

**Datei:** `client/src/pages/TimeTracking.tsx` (Zeile 879-883)

```typescript
// Vorher (FALSCH)
date: selectedExpenseDate!.toISOString(),

// Nachher (KORREKT)
date: (() => {
  const d = selectedExpenseDate!;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
})(),
```

**Gleiche Lösung bereits bei Zeiteinträgen (Zeile 249):**

```typescript
// Format date as YYYY-MM-DD in local timezone to avoid UTC conversion issues
const year = selectedDate.getFullYear();
const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
const day = String(selectedDate.getDate()).padStart(2, '0');
const dateStr = `${year}-${month}-${day}`;
```

---

## Bekannte Probleme

### Kritisch

**Login-Schleife nach erfolgreichem Login** (seit v1.0.10)

**Symptom:** Nach erfolgreichem Login wird User wieder zur Login-Seite weitergeleitet

**Mögliche Ursachen:**
1. Session-Cookie wird nicht korrekt gesetzt
2. Auth-Guard in `DashboardLayout.tsx` erkennt Session nicht
3. `/api/auth/me` gibt 401 zurück trotz gültiger Session
4. SameSite/Secure Cookie-Konfiguration inkompatibel mit Deployment-Umgebung

**Debug-Schritte:**
```typescript
// In DashboardLayout.tsx, Zeile 92-110
const checkAuth = async (isRetry = false) => {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    console.log("Auth check:", res.status, res.headers.get("set-cookie"));
    // ...
  }
};
```

**Status:** Nicht behoben (auf Wunsch des Nutzers)

---

## Technische Schulden

1. **Passwort-Änderungs-Funktion fehlt**
   - Admin kann Passwort nicht selbst ändern
   - Workaround: Manuelles SQL-Update

2. **User-Verwaltungs-UI fehlt**
   - Admin kann keine neuen User anlegen
   - Workaround: Manuelles SQL-INSERT

3. **Mandanten-Verwaltungs-UI fehlt**
   - Admin kann keine neuen Mandanten anlegen
   - Workaround: Manuelles SQL-INSERT

4. **E-Mail-Versand nicht konfiguriert**
   - Password-Reset per E-Mail nicht möglich
   - SMTP-Konfiguration vorhanden, aber nicht getestet

5. **Rate-Limiting fehlt**
   - Login-Versuche nicht limitiert
   - Brute-Force-Angriffe möglich

---

## Nächste Schritte

1. **Login-Schleife beheben** (Priorität: Kritisch)
2. **Passwort-Änderungs-Funktion** implementieren
3. **User-Verwaltungs-UI** erstellen
4. **Mandanten-Verwaltungs-UI** erstellen
5. **E-Mail-Versand** testen und konfigurieren
6. **Rate-Limiting** für Login implementieren

---

*Letzte Aktualisierung: 14. Februar 2026 | Version 1.0.10*
