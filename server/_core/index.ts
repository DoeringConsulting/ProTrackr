import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import crypto from "crypto";
import session from "express-session";
import expressMysqlSession from "express-mysql-session";
import mysql from "mysql2/promise";
import cookieParser from "cookie-parser";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import helmet from "helmet";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleCronRequest } from "../cronEndpoint";
import { csrfProtection } from "./csrf";
import { getSessionCookieConfig, toExpressSessionCookieOptions } from "./sessionConfig";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const isProduction = process.env.NODE_ENV === "production";
  const sessionCookieConfig = getSessionCookieConfig();
  
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for development
    crossOriginEmbedderPolicy: false,
  }));
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // ✅ AUTHENTICATION ACTIVATED
  // Session-Middleware
  // WICHTIG: In Production hinter Reverse-Proxy (Nginx/Manus) trust proxy setzen,
  // sonst kann express-session das Secure-Cookie nicht zuverlässig setzen.
  if (isProduction && sessionCookieConfig.secure) {
    app.set("trust proxy", 1);
  }
  // secure + sameSite:none sind in Production für HTTPS/Cross-Origin nötig
  // Diese Einstellungen verhindern die Login-Schleife die zur Auth-Deaktivierung geführt hat
  if (!process.env.SESSION_SECRET) {
    throw new Error("[Auth] SESSION_SECRET Umgebungsvariable ist nicht gesetzt!");
  }
  // Persistenter Session-Store (P3/M1): MySQL statt fluechtigem In-Memory-Store, damit Sessions
  // Container-Restarts/Deploys ueberleben. Dedizierter mysql2-Pool aus DATABASE_URL (getrennt vom
  // Drizzle-Pool). Tabelle via Migration 0025 → createDatabaseTable:false (kein Runtime-DDL).
  // Ohne DATABASE_URL (lokales Tooling ohne DB) faellt express-session auf seinen In-Memory-Store
  // zurueck, damit `npm run dev` weiterhin ohne DB startet.
  let sessionStore: session.Store | undefined;
  if (process.env.DATABASE_URL) {
    const sessionPool = mysql.createPool(process.env.DATABASE_URL);
    const MySQLStore = expressMysqlSession(session);
    // @types/express-mysql-session deklarieren den callback-mysql2-Pool; die Lib selbst nutzt
    // intern jedoch mysql2/promise (ihr index.js: require('mysql2/promise')). Der promise-Pool
    // ist damit zur Laufzeit korrekt (README-konform) — der Cast ueberbrueckt nur die
    // Typ-Divergenz der DefinitelyTyped-Definition (kein Runtime-Effekt).
    sessionStore = new MySQLStore(
      { createDatabaseTable: false },
      sessionPool as unknown as ConstructorParameters<typeof MySQLStore>[1]
    );
  } else {
    console.warn("[Session] DATABASE_URL nicht gesetzt — Fallback auf In-Memory-Store (nur lokales Tooling).");
  }
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      proxy: isProduction && sessionCookieConfig.secure,
      cookie: toExpressSessionCookieOptions(sessionCookieConfig),
    })
  );

  // Passport.js initialisieren (importiert Strategy als Seiteneffekt)
  await import("../auth/strategy");
  const { default: passportInstance } = await import("passport");
  app.use(passportInstance.initialize());
  app.use(passportInstance.session());
  app.use(cookieParser());
  app.use(csrfProtection());

  const normalizeRateLimitValue = (value: unknown): string =>
    typeof value === "string" ? value.trim().toLowerCase() : "";
  const hashRateLimitIdentity = (mandant: string, email: string): string =>
    crypto.createHash("sha256").update(`${mandant}:${email}`).digest("hex");
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Zu viele Anmeldeversuche. Bitte in 15 Minuten erneut versuchen." },
    keyGenerator: (req) => {
      const body = req.body as Record<string, unknown> | undefined;
      const mandant = normalizeRateLimitValue(body?.mandant);
      const email = normalizeRateLimitValue(body?.email);
      const identityHash = hashRateLimitIdentity(mandant, email);
      return `${ipKeyGenerator(req.ip ?? "")}:${identityHash}`;
    },
  });
  const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
    keyGenerator: (req) => {
      const body = req.body as Record<string, unknown> | undefined;
      const mandant = normalizeRateLimitValue(body?.mandant);
      const email = normalizeRateLimitValue(body?.email);
      const identityHash = hashRateLimitIdentity(mandant, email);
      return `${ipKeyGenerator(req.ip ?? "")}:${identityHash}`;
    },
  });
  const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Zu viele Registrierungsversuche." },
  });
  const changePasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Zu viele Passwort-Aenderungsversuche. Bitte in 15 Minuten erneut versuchen." },
    keyGenerator: (req) => {
      const userId = (req as any).user?.id ?? "anon";
      return `${ipKeyGenerator(req.ip ?? "")}:${userId}`;
    },
  });
  app.use("/api/auth/login", loginLimiter);
  app.use("/api/auth/forgot-password", passwordResetLimiter);
  app.use("/api/auth/reset-password", passwordResetLimiter);
  app.use("/api/auth/change-password", changePasswordLimiter);
  app.use("/api/auth/register", registerLimiter);

  // Auth-Routen: /api/auth/login, /api/auth/logout, /api/auth/me, /api/auth/register
  const { authRouter } = await import("../auth/router");
  app.use("/api/auth", authRouter);
  // Cron endpoint for scheduled tasks
  app.post("/api/cron/run-scheduler", handleCronRequest);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (!isProduction) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort && process.env.NODE_ENV !== 'production') {
    console.info(`[Server] Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[Server] Running on http://localhost:${port}/`);
    }
  });
}

startServer().catch((error) => {
  console.error('[Server] Failed to start:', error);
  process.exit(1);
});
