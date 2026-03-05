import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Info } from "lucide-react";

interface DirectorySetupProps {
  onComplete: () => void;
}

export function DirectorySetup({ onComplete }: DirectorySetupProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[var(--badge-inclusive-bg)] to-[#f4f7f8]">
      <Card className="max-w-2xl w-full shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Download className="h-6 w-6 text-primary" />
            Offline-Speicherung
          </CardTitle>
          <CardDescription>
            Informationen zur lokalen Datenspeicherung
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Alle exportierten Dateien (PDFs, Excel, Backups) werden automatisch 
                in Ihren Browser-Download-Ordner heruntergeladen.
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="font-medium text-sm">Dateinamen-Struktur:</p>
              <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">
{`DoringConsulting_YYYY_MM-Monat_Kategorie_Dateiname

Beispiele:
• DoringConsulting_2026_01-Styczen_Faktury_Rechnung-2026-001.pdf
• DoringConsulting_2026_01-Styczen_Raporty_Buchhaltung-Januar.xlsx
• DoringConsulting_2026_01-Styczen_Koszty_podrozy_Beleg-123.pdf`}
              </pre>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">OneDrive-Synchronisierung:</p>
              <ol className="text-sm text-muted-foreground space-y-1 ml-4 list-decimal">
                <li>Öffnen Sie die Browser-Einstellungen</li>
                <li>Ändern Sie den Download-Ordner auf einen OneDrive-Ordner</li>
                <li>Alle Dateien werden automatisch mit OneDrive synchronisiert</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                Alternativ können Sie auch Google Drive oder iCloud verwenden.
              </p>
            </div>

            <Alert className="bg-[var(--badge-inclusive-bg)] border-[var(--badge-inclusive-text)]/30">
              <Info className="h-4 w-4 text-[var(--badge-inclusive-text)]" />
              <AlertDescription className="text-[var(--badge-inclusive-text)]">
                <strong>Tipp:</strong> Organisieren Sie Ihre Downloads automatisch, indem Sie 
                den Browser-Download-Ordner auf einen Cloud-Ordner Ihrer Wahl setzen.
              </AlertDescription>
            </Alert>
          </div>

          <Button 
            onClick={onComplete}
            size="lg"
            className="w-full"
          >
            Verstanden, weiter zur Anwendung
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Diese Meldung wird nur einmal angezeigt.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
