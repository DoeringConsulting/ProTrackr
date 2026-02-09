import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Database, Download, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function BackupTab() {
  const [isExporting, setIsExporting] = useState(false);

  const exportMutation = trpc.database.export.useMutation({
    onSuccess: (data) => {
      // Create download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `doering-consulting-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Backup erfolgreich erstellt und heruntergeladen");
      setIsExporting(false);
    },
    onError: (error) => {
      toast.error(`Fehler beim Erstellen des Backups: ${error.message}`);
      setIsExporting(false);
    },
  });

  const handleExport = () => {
    setIsExporting(true);
    exportMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Datensicherung</h2>
        <p className="text-muted-foreground">
          Erstellen Sie ein vollständiges Backup Ihrer Datenbank
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Wichtig</AlertTitle>
        <AlertDescription>
          Das Backup enthält alle Ihre Daten: Kunden, Zeiterfassung, Reisekosten, Fixkosten,
          Steuereinstellungen und Wechselkurse. Bewahren Sie die Backup-Datei sicher auf.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Datenbank-Export
          </CardTitle>
          <CardDescription>
            Exportieren Sie alle Daten als JSON-Datei
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Das Backup enthält folgende Daten:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Kundendaten und Projektinformationen</li>
              <li>Zeiterfassungen und Manntage</li>
              <li>Reisekosten und Belege</li>
              <li>Fixkosten und Kategorien</li>
              <li>Steuereinstellungen (ZUS, Krankenversicherung, Steuer)</li>
              <li>Wechselkurse (NBP und manuelle)</li>
              <li>Rechnungsnummern</li>
            </ul>
          </div>

          <div className="pt-4">
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full sm:w-auto"
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Erstelle Backup..." : "Backup jetzt erstellen"}
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            <p className="font-semibold mb-2">Dateiname-Format:</p>
            <code className="bg-muted px-2 py-1 rounded">
              doering-consulting-backup-YYYY-MM-DD.json
            </code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup-Empfehlungen</CardTitle>
          <CardDescription>
            Best Practices für Datensicherung
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <div className="mt-0.5">✓</div>
              <div>
                <strong>Regelmäßige Backups:</strong> Erstellen Sie mindestens einmal pro Woche
                ein Backup
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-0.5">✓</div>
              <div>
                <strong>Mehrere Speicherorte:</strong> Speichern Sie Backups an verschiedenen
                Orten (z.B. OneDrive, Google Drive, lokale Festplatte)
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-0.5">✓</div>
              <div>
                <strong>Vor wichtigen Änderungen:</strong> Erstellen Sie ein Backup bevor Sie
                größere Änderungen vornehmen
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-0.5">✓</div>
              <div>
                <strong>Aufbewahrung:</strong> Bewahren Sie mindestens die letzten 3 Backups auf
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
