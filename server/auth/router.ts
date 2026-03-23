import { Router, Request, Response, NextFunction } from "express";
import passport from "./strategy";
import bcrypt from "bcrypt";
import crypto from "crypto";
import {
  consumePasswordResetToken,
  createPasswordResetToken,
  findUserByEmail,
  findUserByEmailAndMandant,
  findUserById,
  getValidPasswordResetToken,
  updateUserPasswordHash,
} from "../db";
import { findMandantByName, findMandantByNr } from "../db-mandanten";
import { sendPasswordResetEmail, testEmailConnectionDetailed } from "../email";
import { getSessionCookieConfig } from "../_core/sessionConfig";

export const authRouter = Router();
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_EXP_MINUTES = 60;

function resolveAccountStatus(
  user: { accountStatus?: string | null; passwordHash?: string | null } | null | undefined
): "active" | "suspended" | "deleted" {
  const status = user?.accountStatus ?? null;
  if (status === "active" || status === "suspended" || status === "deleted") {
    return status;
  }
  return user?.passwordHash ? "active" : "suspended";
}

function buildAppBaseUrl(req: Request): string {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const protocol = req.protocol || "http";
  const host = req.get("host");
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

// POST /api/auth/login
authRouter.post("/login", (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate("local", (err: any, user: any, info: any) => {
    if (err) {
      return res.status(500).json({ error: "Interner Serverfehler" });
    }
    if (!user) {
      return res.status(401).json({ error: info?.message ?? "Ungültige E-Mail oder Passwort" });
    }
    req.session.regenerate((regenerateErr) => {
      if (regenerateErr) {
        console.error("[Auth] Session regenerate failed:", regenerateErr);
        return res.status(500).json({ error: "Session-Fehler" });
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ error: "Login fehlgeschlagen" });
        }
        return res.json({
          user: {
            id: user.id,
            mandantId: user.mandantId,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
          },
        });
      });
    });
  })(req, res, next);
});

// POST /api/auth/logout
authRouter.post("/logout", (req: Request, res: Response) => {
  req.logout(() => {
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        console.error("[Auth] Session destroy failed:", destroyErr);
      }
      const cookieConfig = getSessionCookieConfig();
      res.clearCookie("connect.sid", {
        path: cookieConfig.path,
        httpOnly: cookieConfig.httpOnly,
        secure: cookieConfig.secure,
        sameSite: cookieConfig.sameSite,
      });
      res.clearCookie("csrf-token", {
        path: cookieConfig.path,
        httpOnly: false,
        secure: cookieConfig.secure,
        sameSite: cookieConfig.sameSite,
      });
      res.json({ success: true });
    });
  });
});

// GET /api/auth/me
authRouter.get("/me", (req: Request, res: Response) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Nicht angemeldet" });
  }
  return res.json({ user: req.user });
});

// POST /api/auth/forgot-password
authRouter.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email, mandant } = req.body as { email?: string; mandant?: string };
    if (!email || !mandant) {
      return res.status(400).json({ error: "Mandant und E-Mail sind erforderlich" });
    }

    const smtpReady = await testEmailConnectionDetailed();
    if (!smtpReady.success) {
      return res.status(503).json({
        error: "Passwort-Reset-Mail konnte nicht versendet werden",
        reason: smtpReady.message,
        code: smtpReady.code,
        detail: smtpReady.technicalReason,
      });
    }

    let resolvedMandant = await findMandantByNr(mandant);
    if (!resolvedMandant) {
      resolvedMandant = await findMandantByName(mandant);
    }
    if (!resolvedMandant) {
      return res.status(404).json({
        error: "Passwort-Reset-Mail konnte nicht versendet werden",
        reason: "Mandant nicht gefunden.",
        code: "MANDANT_NOT_FOUND",
        detail: "Pruefen Sie Mandanten-Nr oder Mandantenname.",
      });
    }

    const user = await findUserByEmailAndMandant(email, resolvedMandant.id);
    if (!user) {
      return res.status(404).json({
        error: "Passwort-Reset-Mail konnte nicht versendet werden",
        reason: "Kein Benutzer mit dieser E-Mail im angegebenen Mandanten gefunden.",
        code: "USER_NOT_FOUND",
        detail: "Pruefen Sie E-Mail-Adresse und Mandant.",
      });
    }
    const accountStatus = resolveAccountStatus(user);
    if (accountStatus === "suspended") {
      return res.status(403).json({
        error: "Passwort-Reset-Mail konnte nicht versendet werden",
        reason: "Konto ist gesperrt und kann nicht per Selbstservice entsperrt werden.",
        code: "ACCOUNT_SUSPENDED",
        detail: "Bitte wenden Sie sich an einen Mandanten- oder WebApp-Admin.",
      });
    }
    if (accountStatus === "deleted") {
      return res.status(403).json({
        error: "Passwort-Reset-Mail konnte nicht versendet werden",
        reason: "Konto ist geloescht und muss zuerst wiederhergestellt werden.",
        code: "ACCOUNT_DELETED",
        detail: "Bitte wenden Sie sich an einen Mandanten- oder WebApp-Admin.",
      });
    }

    const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXP_MINUTES * 60 * 1000);

    await createPasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const baseUrl = buildAppBaseUrl(req);
    const resetLink = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

    const sendResult = await sendPasswordResetEmail({
      toEmail: user.email,
      recipientName: user.displayName ?? null,
      resetLink,
      expiresMinutes: RESET_TOKEN_EXP_MINUTES,
    });

    if (!sendResult.success) {
      return res.status(502).json({
        error: "Passwort-Reset-Mail konnte nicht versendet werden",
        reason: sendResult.message,
        code: sendResult.code,
        detail: sendResult.technicalReason,
      });
    }

    return res.json({
      success: true,
      message: "Reset-Link wurde erfolgreich versendet.",
    });
  } catch (err) {
    console.error("[Auth] Forgot-password error:", err);
    return res.status(500).json({ error: "Anfrage konnte nicht verarbeitet werden" });
  }
});

// POST /api/auth/verify-reset-token
authRouter.post("/verify-reset-token", async (req: Request, res: Response) => {
  try {
    const { token } = req.body as { token?: string };
    if (!token) {
      return res.status(400).json({ valid: false });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const stored = await getValidPasswordResetToken(tokenHash);

    return res.json({ valid: !!stored });
  } catch (err) {
    console.error("[Auth] Verify-reset-token error:", err);
    return res.status(500).json({ valid: false });
  }
});

// POST /api/auth/reset-password
authRouter.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token und neues Passwort sind erforderlich" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Passwort muss mindestens 8 Zeichen haben" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const stored = await getValidPasswordResetToken(tokenHash);
    if (!stored) {
      return res.status(400).json({ error: "Reset-Link ist ungueltig oder abgelaufen" });
    }
    const user = await findUserById(stored.userId);
    if (!user) {
      return res.status(404).json({ error: "Benutzerkonto nicht gefunden" });
    }
    const accountStatus = resolveAccountStatus(user);
    if (accountStatus !== "active") {
      return res.status(403).json({
        error: "Konto ist nicht aktiv. Passwort-Reset kann nicht ausgefuehrt werden.",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await updateUserPasswordHash(stored.userId, passwordHash);
    await consumePasswordResetToken(stored.id);

    return res.json({ success: true });
  } catch (err) {
    console.error("[Auth] Reset-password error:", err);
    return res.status(500).json({ error: "Passwort konnte nicht zurueckgesetzt werden" });
  }
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
