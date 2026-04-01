#!/usr/bin/env node
/**
 * sync-version.mjs — Synchronises the version from package.json into all
 * files that carry a version string.  Unlike increment-version.mjs this
 * script does NOT bump the version; it treats package.json as the single
 * source of truth and propagates the value already set there.
 *
 * Usage:
 *   1. Set the version in package.json (manually or via `npm version`)
 *   2. Run `node scripts/sync-version.mjs`
 *
 * Called by the pre-commit hook so that all version-bearing files stay in
 * sync regardless of whether the version was bumped manually.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// ── Source of truth ──────────────────────────────────────────────
const packageJsonPath = join(projectRoot, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

console.log(`📦 Syncing version: ${version}`);

// ── useUpdateCheck.ts ────────────────────────────────────────────
const hookPath = join(projectRoot, 'client/src/hooks/useUpdateCheck.ts');
let hookContent = readFileSync(hookPath, 'utf-8');
hookContent = hookContent.replace(
  /const APP_VERSION = '[^']+';/,
  `const APP_VERSION = '${version}';`
);
writeFileSync(hookPath, hookContent);
console.log('✅ useUpdateCheck.ts');

// ── index.html ───────────────────────────────────────────────────
const htmlPath = join(projectRoot, 'client/index.html');
let htmlContent = readFileSync(htmlPath, 'utf-8');
htmlContent = htmlContent.replace(
  /<!-- APP_VERSION: [^ ]+ -->/,
  `<!-- APP_VERSION: ${version} -->`
);
writeFileSync(htmlPath, htmlContent);
console.log('✅ index.html');

// ── VersionFooter.tsx ────────────────────────────────────────────
const footerPath = join(projectRoot, 'client/src/components/VersionFooter.tsx');
let footerContent = readFileSync(footerPath, 'utf-8');
footerContent = footerContent.replace(
  /const APP_VERSION = '[^']+';/,
  `const APP_VERSION = '${version}';`
);
writeFileSync(footerPath, footerContent);
console.log('✅ VersionFooter.tsx');

// ── CHANGELOG.json ───────────────────────────────────────────────
const changelogPath = join(projectRoot, 'CHANGELOG.json');
const publicChangelogPath = join(projectRoot, 'client/public/CHANGELOG.json');
const changelog = JSON.parse(readFileSync(changelogPath, 'utf-8'));

// Only add a new entry if the top entry has a different version
if (changelog.versions[0]?.version !== version) {
  const today = new Date().toISOString().split('T')[0];
  changelog.versions.unshift({
    version,
    date: today,
    changes: [
      {
        type: 'improvement',
        title: 'Version Update',
        description: 'Neue Version mit Verbesserungen und Fehlerbehebungen'
      }
    ]
  });
  writeFileSync(changelogPath, JSON.stringify(changelog, null, 2));
  console.log('✅ CHANGELOG.json (new entry added)');
} else {
  console.log('✅ CHANGELOG.json (already current)');
}

// Keep public changelog in sync
writeFileSync(publicChangelogPath, JSON.stringify(changelog, null, 2));
console.log('✅ client/public/CHANGELOG.json');

console.log(`\n🎉 All files synced to version ${version}`);
