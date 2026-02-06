import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, Upload, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DashboardLayout from "@/components/DashboardLayout";

export default function Backup() {
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  
  const createBackupMutation = trpc.backup.create.useMutation();
  const restoreBackupMutation = trpc.backup.restore.useMutation();

  const handleCreateBackup = async () => {
    try {
      setIsCreating(true);
      const backup = await createBackupMutation.mutateAsync();
      
      // Download as JSON file
      const filename = `backup-${new Date().toISOString().split("T")[0]}.json`;
      const content = JSON.stringify(backup, null, 2);
      
      // Try to save to local file system
      try {
        const { saveBackup } = await import("@/lib/fileSystem");
        await saveBackup(filename, content);
        toast.success("Backup im lokalen Ordner gespeichert");
      } catch (error) {
        // Fallback: Download as file
        const blob = new Blob([content], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Backup heruntergeladen");
      }
      
      toast.success("Backup erfolgreich erstellt und heruntergeladen");
    } catch (error) {
      toast.error("Fehler beim Erstellen des Backups");
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsRestoring(true);
      const text = await file.text();
      const backup = JSON.parse(text);
      
      const result = await restoreBackupMutation.mutateAsync({ backup });
      
      toast.success(`Backup wiederhergestellt: ${Object.values(result).reduce((a, b) => a + b, 0)} Einträge`);
      
      // Reload page to reflect changes
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      toast.error("Fehler beim Wiederherstellen des Backups");
      console.error(error);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Datensicherung</h1>

      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Erstellen Sie regelmäßig Backups Ihrer Daten. Die Backup-Datei enthält alle Kunden, Zeiteinträge, 
          Reisekosten, Fixkosten und Wechselkurse im JSON-Format.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Backup erstellen
            </CardTitle>
            <CardDescription>
              Exportieren Sie alle Daten als JSON-Datei
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleCreateBackup} 
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? "Erstelle Backup..." : "Backup herunterladen"}
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Die Backup-Datei wird automatisch heruntergeladen und kann zur Wiederherstellung 
              oder Archivierung verwendet werden.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Backup wiederherstellen
            </CardTitle>
            <CardDescription>
              Importieren Sie Daten aus einer Backup-Datei
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              accept=".json"
              onChange={handleRestoreBackup}
              disabled={isRestoring}
              className="hidden"
              id="backup-upload"
            />
            <label htmlFor="backup-upload">
              <Button 
                variant="outline" 
                disabled={isRestoring}
                className="w-full cursor-pointer"
              >
                {isRestoring ? "Stelle wieder her..." : "Backup-Datei auswählen"}
              </Button>
            </label>
            <Alert className="mt-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Achtung: Das Wiederherstellen fügt Daten zur Datenbank hinzu. 
                Duplikate können entstehen.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
      </div>
    </DashboardLayout>
  );
}
