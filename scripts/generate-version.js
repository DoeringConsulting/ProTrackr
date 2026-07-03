import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readJsonFile(path) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function getVersion() {
  const changelogPath = join(__dirname, "../CHANGELOG.json");
  const changelog = readJsonFile(changelogPath);
  const changelogVersion = changelog?.versions?.[0]?.version;
  if (typeof changelogVersion === "string" && changelogVersion.trim().length > 0) {
    return changelogVersion.trim();
  }

  const packagePath = join(__dirname, "../package.json");
  const packageJson = readJsonFile(packagePath);
  const packageVersion = packageJson?.version;
  if (typeof packageVersion === "string" && packageVersion.trim().length > 0) {
    return packageVersion.trim();
  }

  return process.env.npm_package_version || "1.0.0";
}

const versionInfo = {
  version: getVersion(),
  buildTime: new Date().toISOString(),
  gitCommit: process.env.GIT_COMMIT || "unknown",
  // Dieses Skript laeuft im Rahmen des Production-Builds (vite build). Ohne
  // explizit gesetztes NODE_ENV war der alte Default "development" im Prod-Build
  // irrefuehrend. NODE_ENV bleibt Override — NAS-Stacks koennen es je Umgebung
  // (dev/prod) setzen fuer eine praezise Zuordnung.
  environment: process.env.NODE_ENV || "production",
};

const outputPath = join(__dirname, "../client/public/version.json");
writeFileSync(outputPath, JSON.stringify(versionInfo, null, 2));

console.log("[Version] Generated version.json:", versionInfo);
