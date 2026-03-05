import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Info } from "lucide-react";
import { useState } from "react";
import { manualUpdate, getCurrentVersion } from "@/hooks/useUpdateCheck";
import { toast } from "sonner";

export default function SystemTab() {
  const [isUpdating, setIsUpdating] = useState(false);
  const currentVersion = getCurrentVersion();

  const handleManualUpdate = async () => {
    setIsUpdating(true);
    toast.info("Suche nach Updates...");
    
    try {
      // Check if new version is available
      const response = await fetch(`/index.html?t=${Date.now()}`, {
        cache: 'no-cache',
      });
      const html = await response.text();
      const versionMatch = html.match(/<!-- APP_VERSION: ([\d.]+) -->/);
      const serverVersion = versionMatch ? versionMatch[1] : null;

      if (serverVersion && serverVersion !== currentVersion) {
        toast.success(`Neue Version ${serverVersion} gefunden! Update wird durchgeführt...`);
        setTimeout(async () => {
          await manualUpdate();
        }, 2000);
      } else {
        toast.success("Sie verwenden bereits die neueste Version!");
        setIsUpdating(false);
      }
    } catch (error) {
      console.error('Update check failed:', error);
      toast.error("Update-Prüfung fehlgeschlagen");
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            App-Version
          </CardTitle>
          <CardDescription>
            Aktuelle Version und Update-Informationen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Installierte Version</p>
              <p className="text-2xl font-bold">{currentVersion}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="text-sm font-medium text-primary">Aktuell</p>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleManualUpdate}
              disabled={isUpdating}
              className="w-full"
              size="lg"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Prüfe auf Updates...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Jetzt auf Updates prüfen
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Die App prüft automatisch alle 60 Sekunden auf neue Versionen
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automatische Updates</CardTitle>
          <CardDescription>
            Wie funktioniert das Update-System?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--badge-inclusive-bg)] flex items-center justify-center text-[var(--badge-inclusive-text)] font-bold">
              1
            </div>
            <div>
              <p className="font-medium">Automatische Erkennung</p>
              <p className="text-sm text-muted-foreground">
                Die App prüft alle 60 Sekunden, ob eine neue Version verfügbar ist
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--badge-inclusive-bg)] flex items-center justify-center text-[var(--badge-inclusive-text)] font-bold">
              2
            </div>
            <div>
              <p className="font-medium">Update-Banner</p>
              <p className="text-sm text-muted-foreground">
                Bei verfügbarem Update erscheint ein Banner und die App lädt automatisch neu
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--badge-inclusive-bg)] flex items-center justify-center text-[var(--badge-inclusive-text)] font-bold">
              3
            </div>
            <div>
              <p className="font-medium">Changelog-Dialog</p>
              <p className="text-sm text-muted-foreground">
                Nach dem Update sehen Sie automatisch, was neu ist
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
