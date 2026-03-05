import { AlertCircle } from "lucide-react";

export function UpdateBanner() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-white px-4 py-3 shadow-lg">
      <div className="container mx-auto flex items-center justify-center gap-2">
        <AlertCircle className="h-5 w-5 animate-pulse" />
        <p className="text-sm font-medium">
          Neue Version wird geladen... Die App wird in wenigen Sekunden aktualisiert.
        </p>
      </div>
    </div>
  );
}
