import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { trpc } from "@/lib/trpc";

export default function Import() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{
    customers: number;
    timeEntries: number;
    expenses: number;
    errors: string[];
  } | null>(null);

  const createCustomerMutation = trpc.customers.create.useMutation();
  const createTimeEntryMutation = trpc.timeEntries.create.useMutation();
  const createExpenseMutation = trpc.expenses.create.useMutation();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.name.endsWith(".xlsx") && !selectedFile.name.endsWith(".xls")) {
        toast.error("Bitte wählen Sie eine Excel-Datei aus (.xlsx oder .xls)");
        return;
      }
      setFile(selectedFile);
      setResults(null);
    }
  };

  const parseExcelFile = async (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          resolve(workbook);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Bitte wählen Sie eine Datei aus");
      return;
    }

    setImporting(true);
    setProgress(0);
    const errors: string[] = [];
    let customersImported = 0;
    let timeEntriesImported = 0;
    let expensesImported = 0;

    try {
      const workbook = await parseExcelFile(file);
      
      // Import customers (assuming there's a "Kunden" sheet)
      if (workbook.SheetNames.includes("Kunden")) {
        const sheet = workbook.Sheets["Kunden"];
        const data = XLSX.utils.sheet_to_json(sheet);
        
        for (let i = 0; i < data.length; i++) {
          try {
            const row: any = data[i];
            await createCustomerMutation.mutateAsync({
              provider: row["Provider"] || row["Anbieter"] || "",
              mandatenNr: row["Mandanten-Nr"] || "",
              projectName: row["Projekt"] || row["Project"] || "",
              location: row["Ort"] || row["Location"] || "",
              onsiteRate: Math.round((row["Onsite-Tagessatz"] || 0) * 100),
              remoteRate: Math.round((row["Remote-Tagessatz"] || 0) * 100),
              kmRate: Math.round((row["km-Pauschale"] || 0) * 100),
              mealRate: Math.round((row["Verpflegungspauschale"] || 0) * 100),
              costModel: row["Kostenmodell"] === "Inclusive" ? "inclusive" : "exclusive",
            });
            customersImported++;
          } catch (error: any) {
            errors.push(`Kunde Zeile ${i + 2}: ${error.message}`);
          }
          setProgress(Math.round((i / data.length) * 33));
        }
      }

      toast.success(`Import abgeschlossen: ${customersImported} Kunden, ${timeEntriesImported} Zeiteinträge, ${expensesImported} Reisekosten`);
      setResults({
        customers: customersImported,
        timeEntries: timeEntriesImported,
        expenses: expensesImported,
        errors,
      });
    } catch (error: any) {
      toast.error(`Import fehlgeschlagen: ${error.message}`);
      errors.push(`Allgemeiner Fehler: ${error.message}`);
      setResults({
        customers: customersImported,
        timeEntries: timeEntriesImported,
        expenses: expensesImported,
        errors,
      });
    } finally {
      setImporting(false);
      setProgress(100);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Datenimport</h1>
          <p className="text-muted-foreground">
            Importieren Sie bestehende Daten aus Excel-Dateien
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Excel-Datei hochladen</CardTitle>
            <CardDescription>
              Wählen Sie eine Excel-Datei mit Ihren Kunden-, Zeiterfassungs- und Reisekostendaten aus
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">Excel-Datei</Label>
              <Input
                id="file"
                type="file"
                onChange={handleFileChange}
                accept=".xlsx,.xls"
                disabled={importing}
              />
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>{file.name}</span>
                  <span>({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>

            {importing && (
              <div className="space-y-2">
                <Label>Fortschritt</Label>
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground">{progress}% abgeschlossen</p>
              </div>
            )}

            <Button
              onClick={handleImport}
              disabled={!file || importing}
              className="w-full"
            >
              {importing ? (
                <>Wird importiert...</>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import starten
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {results && (
          <Card>
            <CardHeader>
              <CardTitle>Import-Ergebnisse</CardTitle>
              <CardDescription>
                Zusammenfassung des Import-Vorgangs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Kunden</p>
                    <p className="text-2xl font-bold">{results.customers}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Zeiteinträge</p>
                    <p className="text-2xl font-bold">{results.timeEntries}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Reisekosten</p>
                    <p className="text-2xl font-bold">{results.expenses}</p>
                  </div>
                </div>
              </div>

              {results.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle className="h-5 w-5" />
                    <p className="font-medium">Fehler ({results.errors.length})</p>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {results.errors.map((error, index) => (
                      <p key={index} className="text-sm text-muted-foreground">
                        {error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Hinweise zum Import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Die Excel-Datei sollte ein Tabellenblatt namens "Kunden" enthalten</p>
            <p>• Erforderliche Spalten: Provider, Mandanten-Nr, Projekt, Ort, Onsite-Tagessatz, Remote-Tagessatz, km-Pauschale, Verpflegungspauschale, Kostenmodell</p>
            <p>• Tagessätze und Pauschalen sollten als Dezimalzahlen angegeben werden (z.B. 800.00 für €800)</p>
            <p>• Kostenmodell sollte entweder "Inclusive" oder "Exclusive" sein</p>
            <p>• Duplikate werden übersprungen und als Fehler gemeldet</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
