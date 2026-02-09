import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Upload, AlertCircle, FileJson } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ImportTab() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const importMutation = trpc.database.import.useMutation({
    onSuccess: () => {
      toast.success("Daten erfolgreich importiert");
      setIsImporting(false);
      setSelectedFile(null);
      // Reload page to refresh all data
      setTimeout(() => window.location.reload(), 1500);
    },
    onError: (error) => {
      toast.error(`Fehler beim Importieren: ${error.message}`);
      setIsImporting(false);
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== "application/json") {
        toast.error("Bitte wählen Sie eine JSON-Datei aus");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error("Bitte wählen Sie eine Backup-Datei aus");
      return;
    }

    try {
      setIsImporting(true);
      const text = await selectedFile.text();
      const backup = JSON.parse(text);

      // Validate backup structure
      if (!backup.version || !backup.data) {
        toast.error("Ungültiges Backup-Format");
        setIsImporting(false);
        return;
      }

      // Confirm import
      const confirmed = window.confirm(
        "WARNUNG: Der Import überschreibt alle vorhandenen Daten. Möchten Sie fortfahren?"
      );

      if (!confirmed) {
        setIsImporting(false);
        return;
      }

      importMutation.mutate({ backup });
    } catch (error) {
      toast.error("Fehler beim Lesen der Datei");
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Datenimport</h2>
        <p className="text-muted-foreground">
          Importieren Sie ein Backup und stellen Sie Ihre Daten wieder her
        </p>
      </div>

      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Achtung</AlertTitle>
        <AlertDescription>
          Der Import überschreibt ALLE vorhandenen Daten. Erstellen Sie vorher ein Backup unter
          "Datensicherung", falls Sie Ihre aktuellen Daten behalten möchten.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Backup-Datei importieren
          </CardTitle>
          <CardDescription>
            Wählen Sie eine JSON-Backup-Datei zum Importieren aus
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backup-file">Backup-Datei auswählen</Label>
            <Input
              id="backup-file"
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              disabled={isImporting}
            />
            {selectedFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileJson className="h-4 w-4" />
                <span>{selectedFile.name}</span>
                <span className="text-xs">
                  ({(selectedFile.size / 1024).toFixed(2)} KB)
                </span>
              </div>
            )}
          </div>

          <div className="pt-4">
            <Button
              onClick={handleImport}
              disabled={!selectedFile || isImporting}
              variant="destructive"
              className="w-full sm:w-auto"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isImporting ? "Importiere Daten..." : "Jetzt importieren"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import-Prozess</CardTitle>
          <CardDescription>
            Was passiert beim Import?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <div className="mt-0.5">1.</div>
              <div>
                <strong>Validierung:</strong> Die Backup-Datei wird auf Gültigkeit geprüft
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-0.5">2.</div>
              <div>
                <strong>Bestätigung:</strong> Sie werden um Bestätigung gebeten
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-0.5">3.</div>
              <div>
                <strong>Import:</strong> Alle Daten werden in die Datenbank importiert
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-0.5">4.</div>
              <div>
                <strong>Neustart:</strong> Die Anwendung wird automatisch neu geladen
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unterstützte Backup-Formate</CardTitle>
          <CardDescription>
            Welche Dateien können importiert werden?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <div className="mt-0.5">✓</div>
              <div>
                <strong>JSON-Backups:</strong> Erstellt über "Datensicherung" in dieser Anwendung
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-0.5">✓</div>
              <div>
                <strong>Format:</strong> doering-consulting-backup-YYYY-MM-DD.json
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-0.5">✗</div>
              <div>
                <strong>Nicht unterstützt:</strong> Excel-Dateien, CSV-Dateien, andere Formate
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
