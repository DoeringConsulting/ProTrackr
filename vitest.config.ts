import { defineConfig } from "vitest/config";
import path from "path";

// Projekt-Zeitzone für die gesamte Suite festnageln (CLAUDE.md §4, KERN K8).
//
// WARUM: Mehrere Fachregeln vergleichen Datumswerte über LOKALE Komponenten (bewusst,
// nie via toISOString). Ihr Ergebnis hängt damit an der Zeitzone des Prozesses — die
// Zuordnungs-Tests fielen unter einer Zeitzone mit negativem UTC-Offset (z. B.
// America/New_York) auseinander, obwohl produktiv nichts kaputt ist: Server und
// Datenbank laufen in Europe/Warsaw. Ohne diese Festlegung ist das Gate latent
// umgebungsabhängig und schlägt je nach Entwicklungs-/CI-Maschine unterschiedlich aus.
//
// Hier oben gesetzt, damit die geforkten Worker (pool: "forks") es beim Fork erben, und
// zusätzlich unten über `test.env` — Node liest TZ bei Zuweisung an process.env neu ein.
process.env.TZ = "Europe/Warsaw";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    env: {
      TZ: "Europe/Warsaw",
    },
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    setupFiles: ["server/vitest.setup.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
