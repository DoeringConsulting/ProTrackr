import { Router, Request, Response, NextFunction } from "express";
import passport from "./strategy";
import bcrypt from "bcrypt";
import { findUserByEmail, createUser } from "../db";

export const authRouter = Router();

// POST /api/auth/login
authRouter.post("/login", (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate("local", (err: any, user: any, info: any) => {
    if (err) {
      return res.status(500).json({ error: "Interner Serverfehler" });
    }
    if (!user) {
      return res.status(401).json({ error: info?.message ?? "Ungültige E-Mail oder Passwort" });
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        return res.status(500).json({ error: "Login fehlgeschlagen" });
      }
      return res.json({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
      });
    });
  })(req, res, next);
});

// POST /api/auth/logout
authRouter.post("/logout", (req: Request, res: Response) => {
  req.logout(() => {
    res.json({ success: true });
  });
});

// GET /api/auth/me
authRouter.get("/me", (req: Request, res: Response) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Nicht angemeldet" });
  }
  return res.json({ user: req.user });
});

// POST /api/auth/register
// ⚠️ In Produktion: nur von Admin aufrufbar machen oder entfernen
authRouter.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body as {
      email?: string;
      password?: string;
      displayName?: string;
    };
    if (!email || !password) {
      return res.status(400).json({ error: "E-Mail und Passwort sind erforderlich" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Passwort muss mindestens 8 Zeichen haben" });
    }
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "E-Mail-Adresse bereits registriert" });
    }
    // Registration temporarily disabled - admin must create users
    return res.status(501).json({ error: "Registrierung derzeit deaktiviert. Bitte kontaktieren Sie Ihren Administrator." });
    
    // const passwordHash = await bcrypt.hash(password, 10);
    // await createUser({ mandantId: 1, email, passwordHash, displayName: displayName ?? null });
    // return res.status(201).json({ success: true });
  } catch (err) {
    console.error("[Auth] Register error:", err);
    return res.status(500).json({ error: "Registrierung fehlgeschlagen" });
  }
});
