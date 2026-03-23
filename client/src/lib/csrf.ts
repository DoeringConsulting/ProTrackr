const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";

export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]+)`)
  );
  return match?.[1] ?? null;
}

export function getCsrfHeaderName(): string {
  return CSRF_HEADER_NAME;
}

export async function ensureCsrfToken(): Promise<string | null> {
  const existing = getCsrfToken();
  if (existing) return existing;

  try {
    await globalThis.fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    // Ignore bootstrap request errors; caller handles missing token.
  }

  return getCsrfToken();
}

