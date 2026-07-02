#!/usr/bin/env node
// =============================================================================
// scripts/generate-rollout-manifest.mjs
// =============================================================================
// Erzeugt ein Rollout-Manifest unter .claude/rollouts/<version>.json — die
// DETERMINISTISCHE ÜBERGABE von main an den NAS-Setup-Chat.
//
//   Auf main ausführen, wenn ein Release reif/gefreezt ist:
//     node scripts/generate-rollout-manifest.mjs --notes "Rollt #1/#2/#3-Fixes aus"
//
// Das Manifest deklariert WAS ausgerollt wird (Version, Commit, Freeze-Tag,
// Migrationen, Health-Check-Ziel). WIE ausgerollt wird, steht im Skill
// .claude/skills/nas-rollout/SKILL.md. So bleiben beide Chats entkoppelt:
// main = Produzent (schreibt Manifest), NAS-Chat = Ausführer (liest Manifest).
// =============================================================================
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const git = (cmd) => execSync(`git ${cmd}`, { cwd: root }).toString().trim();

const notesIdx = process.argv.indexOf("--notes");
const notes = notesIdx > -1 ? process.argv[notesIdx + 1] : "";

const branch = git("rev-parse --abbrev-ref HEAD");
if (branch !== "main") {
  console.error(`ABBRUCH: Manifest wird nur auf main erzeugt (aktuell: ${branch}).`);
  process.exit(1);
}
// Nur getrackte Änderungen blockieren (untracked Tooling/Manifest ist ok).
const dirtyTracked = git("status --porcelain").split("\n").filter((l) => l && !l.startsWith("??"));
if (dirtyTracked.length > 0) {
  console.error("ABBRUCH: getrackte Änderungen im Working Tree — erst committen/stashen:\n" + dirtyTracked.join("\n"));
  process.exit(1);
}

const version = JSON.parse(readFileSync(join(root, "client/public/version.json"), "utf8")).version;
const commit = git("rev-parse HEAD");
const shortCommit = git("rev-parse --short HEAD");
let freezeTag = "(kein Tag)";
try { freezeTag = git("describe --tags --abbrev=0"); } catch { /* kein Tag erreichbar */ }

const migrations = readdirSync(join(root, "drizzle"))
  .filter((f) => f.endsWith(".sql"))
  .sort();

// Breaking-Heuristik: seit dem letzten nas-rollout/*-Tag (falls vorhanden).
const rolloutTags = git("tag").split("\n").map((s) => s.trim()).filter((t) => t.startsWith("nas-rollout/"));
let breaking = { value: false, note: "" };
if (rolloutTags.length > 0) {
  const since = rolloutTags[rolloutTags.length - 1];
  const log = git(`log ${since}..HEAD --pretty=%s%x00%b`);
  breaking = {
    value: /(^|\n)[a-z]+(\([^)]*\))?!:/.test(log) || /BREAKING[ -]CHANGE/.test(log),
    note: `Commits seit ${since}`,
  };
} else {
  breaking = { value: false, note: "Kein früheres nas-rollout/*-Tag — bitte manuell prüfen" };
}

const manifest = {
  schema: "nas-rollout/v1",
  version,
  generatedAt: new Date().toISOString(),
  source: { branch: "main", commit, shortCommit, freezeTag },
  target: { branch: "nas-setup", deploy: "docker compose (Unraid)" },
  app: {
    composeService: "app",
    container: "protrackr-app",
    hostPort: 3010,
    healthUrl: "http://<NAS_HOST>:3010/version.json",
    expectVersion: version,
  },
  database: {
    container: "protrackr-mysql",
    backupBeforeMigrate: true,
    migrations,
    applyNote: "Schema-Migrationen via `npx drizzle-kit migrate` gegen die NAS-DB — genaue Mechanik im NAS-Chat gegen nas-setup bestätigen (App-Startup vs. manuell).",
  },
  breaking,
  verified: {
    freezeTagPresent: freezeTag !== "(kein Tag)",
    note: "tsc + vitest waren auf main zum Freeze-Zeitpunkt grün.",
  },
  notes: notes || "(keine Notiz — mit --notes ergänzen)",
  rollback:
    "Vor Merge-Commit: `git merge --abort`. Nach Deploy-Fehler: nas-setup auf vorherigen Commit zurücksetzen + vorheriges Image, DB aus dem Pre-Migrate-Backup wiederherstellen.",
};

const outDir = join(root, ".claude/rollouts");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `${version}.json`);
writeFileSync(outFile, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Rollout-Manifest geschrieben: .claude/rollouts/${version}.json`);
console.log(`  Version ${version} | Commit ${shortCommit} | Freeze-Tag ${freezeTag} | ${migrations.length} Migrationen`);
