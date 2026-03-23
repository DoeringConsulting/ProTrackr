import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { getSessionCookieConfig } from "./sessionConfig";

const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_SESSION_FIELD = "csrfNonce";

const CSRF_EXEMPT_PREFIXES = ["/api/cron/"];

function toBuffer(value: string): Buffer {
  return Buffer.from(value, "utf8");
}

function secureEquals(left: string, right: string): boolean {
  const leftBuffer = toBuffer(left);
  const rightBuffer = toBuffer(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isSafeMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

function isExemptPath(path: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some(prefix => path.startsWith(prefix));
}

function normalizeSecret(secret: string): string {
  return secret.trim();
}

function getCsrfSecret(): string {
  const csrfSecret = process.env.CSRF_SECRET?.trim();
  if (csrfSecret) return csrfSecret;

  const sessionSecret = process.env.SESSION_SECRET?.trim();
  if (sessionSecret) return sessionSecret;

  throw new Error("[CSRF] CSRF_SECRET oder SESSION_SECRET muss gesetzt sein.");
}

function getSessionNonce(req: Request): string {
  const session = req.session as unknown as Record<string, unknown> | undefined;
  if (!session) {
    throw new Error("[CSRF] Session ist nicht verfügbar.");
  }

  const existing = session[CSRF_SESSION_FIELD];
  if (typeof existing === "string" && existing.length > 0) {
    return existing;
  }

  const created = crypto.randomBytes(32).toString("hex");
  session[CSRF_SESSION_FIELD] = created;
  return created;
}

function buildExpectedToken(req: Request): string {
  const sessionId = req.sessionID;
  if (!sessionId || typeof sessionId !== "string") {
    throw new Error("[CSRF] Session-ID fehlt.");
  }

  const nonce = getSessionNonce(req);
  const secret = normalizeSecret(getCsrfSecret());
  return crypto
    .createHmac("sha256", secret)
    .update(`${sessionId}:${nonce}`)
    .digest("hex");
}

function readHeaderToken(req: Request): string | null {
  const raw = req.headers[CSRF_HEADER_NAME];
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }
  return null;
}

function readCookieToken(req: Request): string | null {
  const raw = (req.cookies?.[CSRF_COOKIE_NAME] ?? null) as string | null;
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }
  return null;
}

function ensureTokenCookie(req: Request, res: Response): string {
  const token = buildExpectedToken(req);
  const cookieConfig = getSessionCookieConfig();
  const existingCookie = readCookieToken(req);

  if (!existingCookie || !secureEquals(existingCookie, token)) {
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: cookieConfig.secure,
      sameSite: cookieConfig.sameSite,
      maxAge: cookieConfig.maxAge,
      path: cookieConfig.path,
    });
  }

  return token;
}

export function csrfProtection() {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const expectedToken = ensureTokenCookie(req, res);

      if (isSafeMethod(req.method) || isExemptPath(req.path)) {
        return next();
      }

      const headerToken = readHeaderToken(req);
      const cookieToken = readCookieToken(req);
      if (!headerToken || !cookieToken) {
        return res.status(403).json({ error: "CSRF-Token fehlt" });
      }

      if (!secureEquals(headerToken, cookieToken)) {
        return res.status(403).json({ error: "CSRF-Token ungültig" });
      }

      if (!secureEquals(headerToken, expectedToken)) {
        return res.status(403).json({ error: "CSRF-Token passt nicht zur Session" });
      }

      next();
    } catch (error) {
      console.error("[CSRF] Validation failed:", error);
      return res.status(500).json({ error: "CSRF-Prüfung fehlgeschlagen" });
    }
  };
}

export function getCsrfHeaderName(): string {
  return CSRF_HEADER_NAME;
}
