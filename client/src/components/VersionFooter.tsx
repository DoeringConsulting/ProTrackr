import { useState, useEffect } from 'react';

// Version is managed by scripts/increment-version.mjs
const APP_VERSION = '1.0.79';

function compareSemver(a: string, b: string): number {
  const parse = (value: string) => value.split('.').map((part) => Number.parseInt(part, 10));
  const left = parse(a);
  const right = parse(b);
  if (left.length !== 3 || right.length !== 3) return 0;
  if (left.some((part) => Number.isNaN(part)) || right.some((part) => Number.isNaN(part))) return 0;

  for (let i = 0; i < 3; i += 1) {
    const diff = left[i] - right[i];
    if (diff !== 0) return diff;
  }
  return 0;
}

export function VersionFooter() {
  const [currentVersion, setCurrentVersion] = useState(APP_VERSION);
  const [buildTime, setBuildTime] = useState(() => new Date().toISOString());

  useEffect(() => {
    // Try to fetch version info from a generated file
    fetch('/version.json')
      .then(res => res.json())
      .then(data => {
        if (typeof data.version === 'string') {
          // Never downgrade the displayed app version because of stale/cached metadata.
          if (compareSemver(data.version, APP_VERSION) >= 0) {
            setCurrentVersion(data.version);
          } else {
            setCurrentVersion(APP_VERSION);
          }
        }
        if (data.buildTime) setBuildTime(data.buildTime);
      })
      .catch(() => {
        // Fallback to hardcoded version
        console.log('[Version] Using fallback version info');
      });
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-2 text-[10px] text-muted-foreground z-50">
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
