import { useState, useEffect } from 'react';
import { getCurrentVersion } from '@/hooks/useUpdateCheck';

// Version info - automatically synced with useUpdateCheck
const APP_VERSION = getCurrentVersion();
const BUILD_TIME = new Date().toISOString();

export function VersionFooter() {
  const [currentVersion, setCurrentVersion] = useState(APP_VERSION);
  const [buildTime, setBuildTime] = useState(BUILD_TIME);

  useEffect(() => {
    // Try to fetch version info from a generated file
    fetch('/version.json')
      .then(res => res.json())
      .then(data => {
        if (data.version) setCurrentVersion(data.version);
        if (data.buildTime) setBuildTime(data.buildTime);
      })
      .catch(() => {
        // Fallback to hardcoded version
        console.log('[Version] Using fallback version info');
      });
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-muted/50 backdrop-blur-sm border-t border-border px-4 py-2 text-xs text-muted-foreground z-50">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-mono">
            Version: <span className="font-semibold text-foreground">{currentVersion}</span>
          </span>
          <span className="hidden sm:inline">
            Build: {new Date(buildTime).toLocaleString('de-DE', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
        <div className="text-right">
          <span className="hidden md:inline">Döring Consulting - Projekt & Abrechnungsmanagement</span>
        </div>
      </div>
    </div>
  );
}
