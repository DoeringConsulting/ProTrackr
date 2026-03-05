import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WifiOff, Wifi, Cloud, CloudOff } from "lucide-react";
import { syncService } from "@/lib/syncService";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Update pending sync count
    const updatePendingCount = async () => {
      const count = await syncService.getPendingSyncCount();
      setPendingSync(count);
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 10000); // Every 10 seconds

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (isOnline && pendingSync === 0) {
    return null; // Don't show anything when online and synced
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      {!isOnline ? (
        <Alert variant="destructive" className="shadow-lg">
          <WifiOff className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Offline-Modus aktiv</span>
            <span className="text-xs">Änderungen werden lokal gespeichert</span>
          </AlertDescription>
        </Alert>
      ) : pendingSync > 0 ? (
        <Alert className="shadow-lg bg-[var(--badge-inclusive-bg)] border-[var(--badge-inclusive-text)]/30">
          <Cloud className="h-4 w-4 text-[var(--badge-inclusive-text)]" />
          <AlertDescription className="flex items-center justify-between text-[var(--badge-inclusive-text)]">
            <span>Synchronisiere...</span>
            <span className="text-xs">{pendingSync} ausstehende Änderungen</span>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
