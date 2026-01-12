import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FolderOpen, AlertCircle, CheckCircle2 } from "lucide-react";
import { selectRootDirectory, isFileSystemAccessSupported } from "@/lib/fileSystem";
import { toast } from "sonner";

interface DirectorySetupProps {
  onComplete: () => void;
}

export function DirectorySetup({ onComplete }: DirectorySetupProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [hasSelected, setHasSelected] = useState(false);

  const handleSelectDirectory = async () => {
    try {
      setIsSelecting(true);
      await selectRootDirectory();
      setHasSelected(true);
      toast.success("Ordner erfolgreich ausgewählt");
      
      // Wait a moment then complete
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.info("Ordnerauswahl abgebrochen");
      } else {
        toast.error("Fehler beim Auswählen des Ordners");
        console.error(error);
      }
    } finally {
      setIsSelecting(false);
    }
  };

  if (!isFileSystemAccessSupported()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Browser nicht unterstützt
            </CardTitle>
            <CardDescription>
              Ihr Browser unterstützt die File System Access API nicht
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Für die vollständige Offline-Funktionalität benötigen Sie einen modernen Browser 
                wie Chrome, Edge oder Opera (Version 86+).
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              Die Anwendung kann trotzdem verwendet werden, aber Dateien werden im Browser-Download-Ordner 
              gespeichert statt in einem strukturierten Ordner.
            </p>
            <Button onClick={onComplete} variant="outline" className="w-full">
              Trotzdem fortfahren
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="max-w-2xl w-full shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <FolderOpen className="h-6 w-6 text-primary" />
            Speicherort einrichten
          </CardTitle>
          <CardDescription>
            Wählen Sie einen Ordner für die lokale Datenspeicherung
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Die Anwendung erstellt automatisch eine strukturierte Ordnerhierarchie 
                für Ihre Daten, Belege und Berichte.
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="font-medium text-sm">Ordnerstruktur:</p>
              <pre className="text-xs text-muted-foreground font-mono">
{`DoringConsulting/
├── 2026/
│   ├── 01-Januar/
│   │   ├── Rechnungen/
│   │   ├── Berichte/
│   │   ├── Reisekosten/
│   │   └── Belege/
│   └── 02-Februar/
│       └── ...
└── Backups/`}
              </pre>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Empfohlene Speicherorte:</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• OneDrive-Ordner (automatische Cloud-Synchronisierung)</li>
                <li>• Google Drive-Ordner</li>
                <li>• Dokumente-Ordner</li>
              </ul>
            </div>
          </div>

          {hasSelected ? (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900">
                Ordner erfolgreich ausgewählt. Die Anwendung wird geladen...
              </AlertDescription>
            </Alert>
          ) : (
            <Button 
              onClick={handleSelectDirectory} 
              disabled={isSelecting}
              size="lg"
              className="w-full"
            >
              {isSelecting ? "Warte auf Auswahl..." : "Ordner auswählen"}
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Sie können den Speicherort jederzeit in den Einstellungen ändern.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
