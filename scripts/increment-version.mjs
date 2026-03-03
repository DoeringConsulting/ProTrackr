#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Read current version from CHANGELOG.json
const changelogPath = join(projectRoot, 'CHANGELOG.json');
const publicChangelogPath = join(projectRoot, 'client/public/CHANGELOG.json');
const packageJsonPath = join(projectRoot, 'package.json');
const changelog = JSON.parse(readFileSync(changelogPath, 'utf-8'));
const currentVersion = changelog.versions[0].version;

// Increment patch version (1.0.1 -> 1.0.2)
const [major, minor, patch] = currentVersion.split('.').map(Number);
const newVersion = `${major}.${minor}.${patch + 1}`;

console.log(`📦 Incrementing version: ${currentVersion} → ${newVersion}`);

// Update package.json version to keep build metadata consistent
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
packageJson.version = newVersion;
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log(`✅ Updated package.json`);

// Update useUpdateCheck.ts
const hookPath = join(projectRoot, 'client/src/hooks/useUpdateCheck.ts');
let hookContent = readFileSync(hookPath, 'utf-8');
hookContent = hookContent.replace(
  /const APP_VERSION = '[^']+';/,
  `const APP_VERSION = '${newVersion}';`
);
writeFileSync(hookPath, hookContent);
console.log(`✅ Updated useUpdateCheck.ts`);

// Update index.html
const htmlPath = join(projectRoot, 'client/index.html');
let htmlContent = readFileSync(htmlPath, 'utf-8');
htmlContent = htmlContent.replace(
  /<!-- APP_VERSION: [^ ]+ -->/,
  `<!-- APP_VERSION: ${newVersion} -->`
);
writeFileSync(htmlPath, htmlContent);
console.log(`✅ Updated index.html`);

// Update VersionFooter.tsx
const footerPath = join(projectRoot, 'client/src/components/VersionFooter.tsx');
let footerContent = readFileSync(footerPath, 'utf-8');
footerContent = footerContent.replace(
  /const APP_VERSION = '[^']+';/,
  `const APP_VERSION = '${newVersion}';`
);
writeFileSync(footerPath, footerContent);
console.log(`✅ Updated VersionFooter.tsx`);

// Add new version entry to CHANGELOG.json
const today = new Date().toISOString().split('T')[0];
changelog.versions.unshift({
  version: newVersion,
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
console.log(`✅ Updated CHANGELOG.json`);

// Keep public changelog in sync with the canonical root file
writeFileSync(publicChangelogPath, JSON.stringify(changelog, null, 2));
console.log(`✅ Synced client/public/CHANGELOG.json`);

console.log(`\n🎉 Version successfully incremented to ${newVersion}`);
console.log(`📝 Don't forget to update CHANGELOG.json with actual changes!`);
