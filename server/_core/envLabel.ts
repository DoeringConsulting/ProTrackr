// Runtime-Umgebungslabel (APP_ENV_LABEL) → index.html.
//
// Der App-Titel wird zur LAUFZEIT aus `process.env.APP_ENV_LABEL` bestimmt (KEIN
// `VITE_`-Prefix, also NICHT build-time). Dadurch zeigt EIN und dasselbe Production-
// Image in verschiedenen Umgebungen verschiedene Titel — nötig, weil Prod das
// getestete Dev-Image bit-identisch promotet (`docker tag`, kein Rebuild). Ein
// build-time-eingebackenes Label (früheres VITE_APP_TITLE) landete sonst mit auf Prod
// ("(DEV)"-Bug). Leer/unset ⇒ der Client fällt auf den Prod-Titel zurück.

/** Liest APP_ENV_LABEL aus der Umgebung (getrimmt). Leerer String, wenn unset. */
export function getAppEnvLabel(): string {
  return (process.env.APP_ENV_LABEL ?? "").trim();
}

/**
 * Injiziert `window.__APP_ENV_LABEL__` als Inline-Script direkt vor `</head>`, damit
 * der Wert synchron (vor dem deferred Module-Script von main.tsx) gesetzt ist — kein
 * Titel-Flash. `label` defaultet auf die Laufzeit-Env, ist aber überschreibbar (Tests).
 */
export function injectAppEnvLabel(html: string, label: string = getAppEnvLabel()): string {
  // `<` → `<` verhindert ein "</script>"-Breakout, falls das Label je exotisch
  // gesetzt wird. Der Wert kommt aus process.env (operator-kontrolliert) — reines
  // Defense-in-depth.
  const serialized = JSON.stringify(label).replace(/</g, "\\u003c");
  const snippet = `<script>window.__APP_ENV_LABEL__=${serialized};</script>`;
  return html.includes("</head>")
    ? html.replace("</head>", `${snippet}</head>`)
    : `${snippet}${html}`;
}
