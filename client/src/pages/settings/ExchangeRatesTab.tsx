import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { TrendingUp, RefreshCw, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const CURRENCIES = [
  { code: "PLN", name: "Polnischer Zloty" },
  { code: "EUR", name: "Euro" },
  { code: "CHF", name: "Schweizer Franken" },
  { code: "GBP", name: "Britisches Pfund" },
  { code: "USD", name: "US-Dollar" },
];

function normalizeStoredRate(rawRate: number) {
  // Rates are stored as ten-thousandths in DB (e.g. 4.2369 => 42369).
  // Keep backward compatibility in case old rows are already decimal.
  return rawRate > 100 ? rawRate / 10000 : rawRate;
}

export default function ExchangeRatesTab() {
  const [selectedCurrency, setSelectedCurrency] = useState("EUR");
  const [manualRate, setManualRate] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const utils = trpc.useUtils();
  
  // Fetch exchange rates with optional filters
  const { data: exchangeRates, isLoading } = trpc.exchangeRatesManagement.list.useQuery({
    currency: filterCurrency !== "all" ? filterCurrency : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  // Mutation to update exchange rates from NBP
  const updateFromNBPMutation = trpc.exchangeRatesManagement.updateFromNBP.useMutation({
    onSuccess: () => {
      toast.success("Wechselkurse erfolgreich von NBP aktualisiert");
      utils.exchangeRatesManagement.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Fehler beim Aktualisieren: ${error.message}`);
    },
  });

  // Mutation to create manual exchange rate
  const createManualRateMutation = trpc.exchangeRatesManagement.createManual.useMutation({
    onSuccess: () => {
      toast.success("Manueller Wechselkurs erfolgreich gespeichert");
      setManualRate("");
      utils.exchangeRatesManagement.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Fehler beim Speichern: ${error.message}`);
    },
  });

  const handleUpdateFromNBP = async () => {
    const currencies = CURRENCIES.filter(c => c.code !== "PLN").map(c => c.code);
    await updateFromNBPMutation.mutateAsync({ currencies });
  };

  const handleCreateManualRate = async () => {
    if (!manualRate || parseFloat(manualRate) <= 0) {
      toast.error("Bitte gültigen Wechselkurs eingeben");
      return;
    }

    await createManualRateMutation.mutateAsync({
      currencyPair: `${selectedCurrency}/PLN`,
      rate: parseFloat(manualRate),
      date: new Date().toISOString().split('T')[0],
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Wechselkurse-Verwaltung</h2>
        <p className="text-muted-foreground">
          NBP-Wechselkurse abrufen und manuelle Kurse eingeben (Basis: PLN)
        </p>
      </div>

      {/* Update from NBP */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            NBP-Kurse aktualisieren
          </CardTitle>
          <CardDescription>
            Aktuelle Wechselkurse von der Narodowy Bank Polski (NBP) abrufen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleUpdateFromNBP} 
            disabled={updateFromNBPMutation.isPending}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {updateFromNBPMutation.isPending ? "Aktualisiere..." : "Kurse von NBP abrufen"}
          </Button>
        </CardContent>
      </Card>

      {/* Manual Rate Entry */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Manuellen Wechselkurs eingeben
          </CardTitle>
          <CardDescription>
            Überschreiben Sie NBP-Kurse mit eigenen Werten (z.B. für Wochenenden)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Währung</Label>
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.filter(c => c.code !== "PLN").map(currency => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate">Kurs (1 {selectedCurrency} = X PLN)</Label>
              <Input
                id="rate"
                type="number"
                step="0.0001"
                placeholder="z.B. 4.2369"
                value={manualRate}
                onChange={(e) => setManualRate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button 
                onClick={handleCreateManualRate} 
                disabled={createManualRateMutation.isPending}
                className="w-full"
              >
                Speichern
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exchange Rates Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Wechselkurs-Historie
          </CardTitle>
          <CardDescription>
            Alle gespeicherten Wechselkurse (Darstellung: 1 PLN = x X und 1 X = x PLN)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="filter-currency">Währung filtern</Label>
              <Select value={filterCurrency} onValueChange={setFilterCurrency}>
                <SelectTrigger id="filter-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Währungen</SelectItem>
                  {CURRENCIES.filter(c => c.code !== "PLN").map(currency => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-date">Von Datum</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Bis Datum</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Lade Wechselkurse...</p>
            </div>
          ) : !exchangeRates || exchangeRates.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold mb-2">Keine Wechselkurse gefunden</p>
              <p className="text-muted-foreground">
                Klicken Sie auf "Kurse von NBP abrufen", um aktuelle Kurse zu laden
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Währungspaar</TableHead>
                    <TableHead className="text-right">Kurs (1 PLN = x X)</TableHead>
                    <TableHead className="text-right">Kurs (1 X = x PLN)</TableHead>
                    <TableHead>Quelle</TableHead>
                    <TableHead>Manuell</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exchangeRates.map((rate: any) => {
                    const [baseCurrency] = String(rate.currencyPair || "").split("/");
                    const normalizedRate = normalizeStoredRate(rate.rate);
                    const plnToForeign = normalizedRate > 0 ? 1 / normalizedRate : 0;
                    const foreignToPln = normalizedRate;
                    
                    return (
                      <TableRow key={rate.id}>
                        <TableCell>{new Date(rate.date).toLocaleDateString('de-DE')}</TableCell>
                        <TableCell className="font-medium">{rate.currencyPair}</TableCell>
                        <TableCell className="text-right font-mono">
                          {plnToForeign.toFixed(4)} {baseCurrency}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {foreignToPln.toFixed(4)} PLN
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            rate.source === 'NBP' 
                              ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20' 
                              : 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20'
                          }`}>
                            {rate.source}
                          </span>
                        </TableCell>
                        <TableCell>
                          {rate.isManual ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
