// Runtime-App-Titel aus dem Umgebungslabel (APP_ENV_LABEL). Reine Funktion, damit die
// mit dem NAS-Chat verbindlich vereinbarte Semantik testbar ist:
//   gesetzt      ⇒ "ProTrackr (<LABEL>)"
//   leer/unset   ⇒ Prod-Titel
// Das Label wird vom Server zur Laufzeit in `window.__APP_ENV_LABEL__` injiziert
// (siehe server/_core/envLabel.ts); der Titel entsteht NICHT mehr build-time.

export const PROD_APP_TITLE = "Döring Consulting - Projekt & Abrechnungsmanagement";

export function computeAppTitle(label?: string | null): string {
  const trimmed = (label ?? "").trim();
  return trimmed ? `ProTrackr (${trimmed})` : PROD_APP_TITLE;
}
