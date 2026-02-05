import { Router } from "express";
import passport from "./passport";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import rateLimit from "express-rate-limit";

const router = Router();

/**
 * Rate limiters for auth endpoints
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: "Zu viele Login-Versuche. Bitte versuchen Sie es später erneut.",
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations
  message: "Zu viele Registrierungsversuche. Bitte versuchen Sie es später erneut.",
  standardHeaders: true,
  legacyHeaders: false,
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 reset requests
  message: "Zu viele Passwort-Reset-Anfragen. Bitte versuchen Sie es später erneut.",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /auth/register
 * Register a new user with email and password
 */
router.post("/register", registerLimiter, async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: "E-Mail und Passwort sind erforderlich" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Passwort muss mindestens 8 Zeichen lang sein" });
    }

    // Check if user already exists
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Datenbankverbindung fehlgeschlagen" });
    }

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      return res.status(400).json({ error: "E-Mail-Adresse wird bereits verwendet" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name: name || null,
        loginMethod: "local",
        emailVerified: 0,
      })
      .$returningId();

    // Auto-login after registration
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, newUser.id))
      .limit(1);

    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ error: "Fehler beim automatischen Login" });
      }
      return res.status(201).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ error: "Fehler bei der Registrierung" });
  }
});

/**
 * POST /auth/login
 * Login with email and password
 */
router.post("/login", loginLimiter, (req, res, next) => {
  passport.authenticate("local", (err: any, user: any, info: any) => {
    if (err) {
      return res.status(500).json({ error: "Fehler beim Login" });
    }

    if (!user) {
      return res.status(401).json({ error: info?.message || "Ungültige Anmeldedaten" });
    }

    req.login(user, (loginErr) => {
      if (loginErr) {
        return res.status(500).json({ error: "Fehler beim Login" });
      }

      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    });
  })(req, res, next);
});

/**
 * POST /auth/logout
 * Logout current user
 */
router.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: "Fehler beim Logout" });
    }
    if (req.session) {
      req.session.destroy((destroyErr: any) => {
        if (destroyErr) {
          return res.status(500).json({ error: "Fehler beim Logout" });
        }
        res.clearCookie("connect.sid");
        return res.json({ success: true });
      });
    } else {
      res.clearCookie("connect.sid");
      return res.json({ success: true });
    }
  });
});

/**
 * GET /auth/me
 * Get current user
 */
router.get("/me", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Nicht angemeldet" });
  }

  const user = req.user as any;
  return res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerified,
  });
});

/**
 * POST /auth/request-reset
 * Request password reset
 */
router.post("/request-reset", resetLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "E-Mail ist erforderlich" });
    }

    // Find user
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Datenbankverbindung fehlgeschlagen" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: "Wenn die E-Mail-Adresse existiert, wurde eine Passwort-Reset-E-Mail gesendet",
      });
    }

    // Check if user has password (not OAuth user)
    if (!user.passwordHash) {
      return res.json({
        success: true,
        message: "Wenn die E-Mail-Adresse existiert, wurde eine Passwort-Reset-E-Mail gesendet",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Save token to database
    await db
      .update(users)
      .set({
        resetToken,
        resetTokenExpiry,
      })
      .where(eq(users.id, user.id));

    // TODO: Send email with reset link
    // For now, log the token (in production, send email)
    console.log(`Password reset token for ${email}: ${resetToken}`);
    console.log(`Reset link: http://localhost:3000/reset-password?token=${resetToken}`);

    return res.json({
      success: true,
      message: "Wenn die E-Mail-Adresse existiert, wurde eine Passwort-Reset-E-Mail gesendet",
      // TODO: Remove this in production
      _devToken: resetToken,
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    return res.status(500).json({ error: "Fehler bei der Passwort-Reset-Anfrage" });
  }
});

/**
 * POST /auth/reset-password
 * Reset password with token
 */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token und neues Passwort sind erforderlich" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Passwort muss mindestens 8 Zeichen lang sein" });
    }

    // Find user with valid token
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Datenbankverbindung fehlgeschlagen" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.resetToken, token))
      .limit(1);

    if (!user || !user.resetTokenExpiry) {
      return res.status(400).json({ error: "Ungültiger oder abgelaufener Token" });
    }

    // Check if token is expired
    if (new Date() > user.resetTokenExpiry) {
      return res.status(400).json({ error: "Token ist abgelaufen" });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password and clear reset token
    await db
      .update(users)
      .set({
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      })
      .where(eq(users.id, user.id));

    return res.json({
      success: true,
      message: "Passwort erfolgreich zurückgesetzt",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return res.status(500).json({ error: "Fehler beim Zurücksetzen des Passworts" });
  }
});

export default router;
