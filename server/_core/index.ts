import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import session from "express-session";
import helmet from "helmet";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleCronRequest } from "../cronEndpoint";

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
  if (isProduction) {
    app.set("trust proxy", 1);
  }
  // secure + sameSite:none sind in Production für HTTPS/Cross-Origin nötig
  // Diese Einstellungen verhindern die Login-Schleife die zur Auth-Deaktivierung geführt hat
  if (!process.env.SESSION_SECRET) {
    throw new Error("[Auth] SESSION_SECRET Umgebungsvariable ist nicht gesetzt!");
  }
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      proxy: isProduction,
      cookie: {
        secure: isProduction, // lokal ohne HTTPS, in Production nur mit HTTPS
        httpOnly: true,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 Tage
      },
    })
  );

  // Passport.js initialisieren (importiert Strategy als Seiteneffekt)
  await import("../auth/strategy");
  const { default: passportInstance } = await import("passport");
  app.use(passportInstance.initialize());
  app.use(passportInstance.session());

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
