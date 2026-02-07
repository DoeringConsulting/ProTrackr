#!/usr/bin/env node

/**
 * Update APP_VERSION in sw.js with current Git commit hash
 * This script runs before build to ensure the service worker always has the latest version
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get current Git commit hash (short version, 8 characters)
function getGitCommitHash() {
  try {
    const hash = execSync('git rev-parse --short=8 HEAD', { encoding: 'utf-8' }).trim();
    console.log(`[update-version] Git commit hash: ${hash}`);
    return hash;
  } catch (error) {
    // Fallback if Git is not available or not a Git repository
    const fallback = Date.now().toString(36).substring(0, 8);
    console.warn(`[update-version] Git not available, using timestamp fallback: ${fallback}`);
    return fallback;
  }
}

// Update APP_VERSION in sw.js
function updateServiceWorkerVersion(version) {
  const swPath = path.resolve(__dirname, '../client/public/sw.js');
  
  if (!fs.existsSync(swPath)) {
    console.error(`[update-version] Service Worker not found at: ${swPath}`);
    process.exit(1);
  }
  
  let swContent = fs.readFileSync(swPath, 'utf-8');
  
  // Replace APP_VERSION value
  const versionRegex = /const APP_VERSION = ['"]([^'"]+)['"]/;
  const match = swContent.match(versionRegex);
  
  if (!match) {
    console.error('[update-version] APP_VERSION not found in sw.js');
    process.exit(1);
  }
  
  const oldVersion = match[1];
  swContent = swContent.replace(versionRegex, `const APP_VERSION = '${version}'`);
  
  fs.writeFileSync(swPath, swContent, 'utf-8');
  console.log(`[update-version] Updated APP_VERSION: ${oldVersion} → ${version}`);
}

// Main execution
const version = getGitCommitHash();
updateServiceWorkerVersion(version);
console.log('[update-version] ✓ Version update complete');
