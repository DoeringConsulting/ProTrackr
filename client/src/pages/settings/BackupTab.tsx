import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Database, Download, AlertCircle, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DeleteScope = "all" | "year" | "month" | "custom";

export default function BackupTab() {
  const [isExporting, setIsExporting] = useState(false);
  const [deleteScope, setDeleteScope] = useState<DeleteScope>("month");
  const [deleteYear, setDeleteYear] = useState(String(new Date().getFullYear()));
  const [deleteMonth, setDeleteMonth] = useState(new Date().toISOString().slice(0, 7));
  const [deleteStartDate, setDeleteStartDate] = useState("");
  const [deleteEndDate, setDeleteEndDate] = useState("");
  const [latestDeleteResult, setLatestDeleteResult] = useState<any>(null);

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

  const clearEntriesMutation = trpc.database.clearTimeAndExpenseEntries.useMutation({
    onSuccess: data => {
      setLatestDeleteResult(data);
      const deletedTime = Number(data?.deleted?.timeEntries ?? 0);
      const deletedExpenses = Number(data?.deleted?.expenses ?? 0);
      const deletedDocs = Number(data?.deleted?.documents ?? 0);
      toast.success(
        `Löschung abgeschlossen: ${deletedTime} Zeiteinträge, ${deletedExpenses} Reisekosten, ${deletedDocs} Dokumente`
      );
    },
    onError: error => {
      toast.error(`Löschung fehlgeschlagen: ${error.message}`);
    },
  });

  const handleExport = () => {
    setIsExporting(true);
    exportMutation.mutate();
  };

  const handleDeleteRange = () => {
    const payload: Record<string, unknown> = { scope: deleteScope };
    if (deleteScope === "year") {
      payload.year = Number(deleteYear);
    } else if (deleteScope === "month") {
      payload.month = deleteMonth;
    } else if (deleteScope === "custom") {
      payload.startDate = deleteStartDate;
      payload.endDate = deleteEndDate;
    }

    const label =
      deleteScope === "all"
        ? "Kompletter Datenbestand (Zeit + Reisekosten)"
        : deleteScope === "year"
          ? `Jahr ${deleteYear}`
          : deleteScope === "month"
            ? `Monat ${deleteMonth}`
            : `Benutzerdefiniert ${deleteStartDate || "?"} bis ${deleteEndDate || "?"}`;
    const confirmed = window.confirm(
      `Achtung: Diese Aktion löscht Zeiteinträge und Reisekosten endgültig.\nZeitraum: ${label}\n\nMöchten Sie fortfahren?`
    );
    if (!confirmed) return;

    clearEntriesMutation.mutate(payload as any);
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

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <Trash2 className="h-5 w-5" />
            Zeit- und Reisekosten löschen (Zeitraum)
          </CardTitle>
          <CardDescription>
            Löscht Zeiteinträge, zugehörige Reisekosten und verknüpfte Dokumente im gewählten Zeitraum.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Unwiderruflich</AlertTitle>
            <AlertDescription>
              Diese Löschung kann nicht rückgängig gemacht werden. Erstellen Sie vorher unbedingt ein Backup.
            </AlertDescription>
          </Alert>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Löschmodus</Label>
              <Select value={deleteScope} onValueChange={(value: DeleteScope) => setDeleteScope(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Komplett (alles löschen)</SelectItem>
                  <SelectItem value="year">Jahr</SelectItem>
                  <SelectItem value="month">Monat</SelectItem>
                  <SelectItem value="custom">Benutzerdefiniert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {deleteScope === "year" && (
              <div className="space-y-2">
                <Label>Jahr</Label>
                <Input
                  type="number"
                  min={2000}
                  max={2100}
                  value={deleteYear}
                  onChange={event => setDeleteYear(event.target.value)}
                />
              </div>
            )}

            {deleteScope === "month" && (
              <div className="space-y-2">
                <Label>Monat</Label>
                <Input type="month" value={deleteMonth} onChange={event => setDeleteMonth(event.target.value)} />
              </div>
            )}

            {deleteScope === "custom" && (
              <>
                <div className="space-y-2">
                  <Label>Startdatum</Label>
                  <Input
                    type="date"
                    value={deleteStartDate}
                    onChange={event => setDeleteStartDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Enddatum</Label>
                  <Input type="date" value={deleteEndDate} onChange={event => setDeleteEndDate(event.target.value)} />
                </div>
              </>
            )}
          </div>

          <div className="pt-2">
            <Button
              variant="destructive"
              onClick={handleDeleteRange}
              disabled={clearEntriesMutation.isPending}
              className="w-full sm:w-auto"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {clearEntriesMutation.isPending ? "Lösche..." : "Zeitraum löschen"}
            </Button>
          </div>

          {latestDeleteResult && (
            <div className="rounded border bg-muted/40 p-3 text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Letztes Lösch-Ergebnis</p>
              <p>
                Zeitraum: {latestDeleteResult.scope}
                {latestDeleteResult.dateFrom && latestDeleteResult.dateTo
                  ? ` (${latestDeleteResult.dateFrom} bis ${latestDeleteResult.dateTo})`
                  : " (komplett)"}
              </p>
              <p>Zeiteinträge gelöscht: {latestDeleteResult.deleted?.timeEntries ?? 0}</p>
              <p>Reisekosten gelöscht: {latestDeleteResult.deleted?.expenses ?? 0}</p>
              <p>Dokumente gelöscht: {latestDeleteResult.deleted?.documents ?? 0}</p>
            </div>
          )}
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
