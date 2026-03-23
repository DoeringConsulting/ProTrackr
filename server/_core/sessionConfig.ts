import type { CookieOptions } from "express-session";

export type SessionCookieSameSite = "none" | "lax" | "strict";

export type SessionCookieConfig = {
  secure: boolean;
  httpOnly: boolean;
  sameSite: SessionCookieSameSite;
  maxAge: number;
  path: string;
};

export function getSessionCookieConfig(): SessionCookieConfig {
  const isProduction = process.env.NODE_ENV === "production";
  const secure =
    process.env.SESSION_COOKIE_SECURE !== undefined
      ? process.env.SESSION_COOKIE_SECURE === "true"
      : isProduction;
  const sameSiteEnv = process.env.SESSION_COOKIE_SAMESITE;
  const sameSite: SessionCookieSameSite =
    sameSiteEnv === "none" || sameSiteEnv === "lax" || sameSiteEnv === "strict"
      ? sameSiteEnv
      : secure
        ? "none"
        : "lax";

  return {
    secure,
    httpOnly: true,
    sameSite,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 Tage
    path: "/",
  };
}

export function toExpressSessionCookieOptions(
  config: SessionCookieConfig
): CookieOptions {
  return {
    secure: config.secure,
    httpOnly: config.httpOnly,
    sameSite: config.sameSite,
    maxAge: config.maxAge,
    path: config.path,
  };
}
