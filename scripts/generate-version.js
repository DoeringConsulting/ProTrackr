import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Generate version info
const versionInfo = {
  version: process.env.npm_package_version || '1.0.0',
  buildTime: new Date().toISOString(),
  gitCommit: process.env.GIT_COMMIT || 'unknown',
  environment: process.env.NODE_ENV || 'development'
};

// Write to public directory
const outputPath = join(__dirname, '../client/public/version.json');
writeFileSync(outputPath, JSON.stringify(versionInfo, null, 2));

console.log('[Version] Generated version.json:', versionInfo);
