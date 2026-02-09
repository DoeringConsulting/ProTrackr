import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import session from "express-session";
import helmet from "helmet";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleCronRequest } from "../cronEndpoint";
import passport from "../auth/passport";
import authRouter from "../auth/authRouter";

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
  
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for development
    crossOriginEmbedderPolicy: false,
  }));
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // ⚠️ AUTHENTICATION COMPLETELY DISABLED FOR DEVELOPMENT
  // Re-enable before final release!
  
  // Session configuration - DISABLED
  // app.use(
  //   session({
  //     secret: process.env.JWT_SECRET || "fallback-secret-change-in-production",
  //     resave: false,
  //     saveUninitialized: false,
  //     cookie: {
  //       secure: process.env.NODE_ENV === "production",
  //       httpOnly: true,
  //       sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  //       maxAge: 1000 * 60 * 60 * 24 * 7,
  //     },
  //   })
  // );
  
  // Passport initialization - DISABLED
  // app.use(passport.initialize());
  // app.use(passport.session());
  // OAuth callback under /api/oauth/callback
  // TEMPORARILY DISABLED FOR DEVELOPMENT - Re-enable before production release!
  // registerOAuthRoutes(app);
  
  // Passport.js auth routes - DISABLED FOR DEVELOPMENT
  // app.use("/api/auth", authRouter);
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
  if (process.env.NODE_ENV === "development") {
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
