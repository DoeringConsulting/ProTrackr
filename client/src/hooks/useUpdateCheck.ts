import { useEffect, useState } from 'react';

const APP_VERSION = '1.0.89'; // Increment this when deploying new version
const VERSION_CHECK_INTERVAL = 60000; // Check every 60 seconds

export function useUpdateCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        // Fetch index.html with cache-busting
        const response = await fetch(`/index.html?t=${Date.now()}`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        
        const html = await response.text();
        
        // Extract version from HTML comment (we'll add this)
        const versionMatch = html.match(/<!-- APP_VERSION: ([\d.]+) -->/);
        const serverVersion = versionMatch ? versionMatch[1] : null;
        
        console.log('[UpdateCheck] Current:', APP_VERSION, 'Server:', serverVersion);
        
        if (serverVersion && serverVersion !== APP_VERSION) {
          console.log('[UpdateCheck] New version available:', serverVersion);
          setUpdateAvailable(true);
          // Kein automatischer Reload – User wählt Zeitpunkt über Notification-Banner
        }
      } catch (error) {
        console.error('[UpdateCheck] Error checking for updates:', error);
      }
    };

    // Check immediately on mount
    checkForUpdates();

    // Check periodically
    const interval = setInterval(checkForUpdates, VERSION_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return { updateAvailable };
}

async function forceReload() {
  console.log('[UpdateCheck] Forcing reload with cache clear...');
  
  // Clear all caches
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('[UpdateCheck] Caches cleared:', cacheNames);
  }
  
  // Mark that update just happened (before reload)
  localStorage.setItem('justUpdated', 'true');
  
  // Force hard reload
  window.location.reload();
}

export function checkIfJustUpdated(): boolean {
  const justUpdated = localStorage.getItem('justUpdated');
  if (justUpdated === 'true') {
    localStorage.removeItem('justUpdated');
    return true;
  }
  return false;
}

export function getCurrentVersion(): string {
  return APP_VERSION;
}

export async function manualUpdate(): Promise<void> {
  console.log('[UpdateCheck] Manual update triggered');
  await forceReload();
}
