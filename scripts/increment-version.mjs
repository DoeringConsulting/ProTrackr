#!/usr/bin/env node
/**
 * increment-version.mjs <major|minor|patch>
 *
 * Bumps the version in package.json + all version-bearing client files and
 * prepends a placeholder entry to CHANGELOG.json. Defaults to "patch" if no
 * level is passed.
 *
 * Used by .husky/pre-commit, which determines the level from the conventional
 * commit prefix (feat → minor, BREAKING CHANGE / `!` → major, else patch).
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const rawLevel = (process.argv[2] || 'patch').toLowerCase();
const level = ['major', 'minor', 'patch'].includes(rawLevel) ? rawLevel : 'patch';

const packageJsonPath = join(projectRoot, 'package.json');
const changelogPath = join(projectRoot, 'CHANGELOG.json');
const publicChangelogPath = join(projectRoot, 'client/public/CHANGELOG.json');

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const currentVersion = packageJson.version;
const [major, minor, patch] = currentVersion.split('.').map(Number);

let newVersion;
if (level === 'major') newVersion = `${major + 1}.0.0`;
else if (level === 'minor') newVersion = `${major}.${minor + 1}.0`;
else newVersion = `${major}.${minor}.${patch + 1}`;

console.log(`📦 Bump (${level}): ${currentVersion} → ${newVersion}`);

// package.json (single source of truth)
packageJson.version = newVersion;
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log('✅ package.json');

// useUpdateCheck.ts
const hookPath = join(projectRoot, 'client/src/hooks/useUpdateCheck.ts');
let hookContent = readFileSync(hookPath, 'utf-8');
hookContent = hookContent.replace(/const APP_VERSION = '[^']+';/, `const APP_VERSION = '${newVersion}';`);
writeFileSync(hookPath, hookContent);
console.log('✅ useUpdateCheck.ts');

// client/index.html
const htmlPath = join(projectRoot, 'client/index.html');
let htmlContent = readFileSync(htmlPath, 'utf-8');
htmlContent = htmlContent.replace(/<!-- APP_VERSION: [^ ]+ -->/, `<!-- APP_VERSION: ${newVersion} -->`);
writeFileSync(htmlPath, htmlContent);
console.log('✅ index.html');

// VersionFooter.tsx
const footerPath = join(projectRoot, 'client/src/components/VersionFooter.tsx');
let footerContent = readFileSync(footerPath, 'utf-8');
footerContent = footerContent.replace(/const APP_VERSION = '[^']+';/, `const APP_VERSION = '${newVersion}';`);
writeFileSync(footerPath, footerContent);
console.log('✅ VersionFooter.tsx');

// CHANGELOG.json placeholder entry
const changelog = JSON.parse(readFileSync(changelogPath, 'utf-8'));
const today = new Date().toISOString().split('T')[0];
const versionTypeLabel = level === 'major' ? 'Major' : level === 'minor' ? 'Minor' : 'Patch';
changelog.versions.unshift({
  version: newVersion,
  date: today,
  changes: [
    {
      type: level === 'major' ? 'breaking' : level === 'minor' ? 'feature' : 'improvement',
      title: `${versionTypeLabel} release`,
      description: 'Neue Version mit Änderungen und Fehlerbehebungen.',
    },
  ],
});
writeFileSync(changelogPath, JSON.stringify(changelog, null, 2));
console.log('✅ CHANGELOG.json');

writeFileSync(publicChangelogPath, JSON.stringify(changelog, null, 2));
console.log('✅ client/public/CHANGELOG.json');

console.log(`\n🎉 Version bumped to ${newVersion} (${level})`);
