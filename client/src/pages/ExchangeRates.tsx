import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RefreshCw, Plus, WifiOff } from "lucide-react";
import { syncService } from "@/lib/syncService";

const CURRENCIES = [
  { code: "EUR", name: "Euro" },
  { code: "USD", name: "US Dollar" },
  { code: "CHF", name: "Schweizer Franken" },
  { code: "GBP", name: "Britisches Pfund" },
  { code: "AUD", name: "Australischer Dollar" },
  { code: "CAD", name: "Kanadischer Dollar" },
  { code: "CZK", name: "Tschechische Krone" },
  { code: "DKK", name: "Dänische Krone" },
  { code: "HUF", name: "Ungarischer Forint" },
  { code: "JPY", name: "Japanischer Yen" },
  { code: "NOK", name: "Norwegische Krone" },
  { code: "SEK", name: "Schwedische Krone" },
  { code: "XDR", name: "Sonderziehungsrechte" },
];

export default function ExchangeRates() {
  const [selectedCurrency, setSelectedCurrency] = useState("EUR");
  const [manualRate, setManualRate] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const isOnline = syncService.isConnected();

  const { data: rates, refetch } = trpc.exchangeRates.list.useQuery();
  const fetchRateMutation = trpc.exchangeRates.fetchRate.useMutation();
  const createRateMutation = trpc.exchangeRates.create.useMutation();

  const handleFetchRate = async () => {
    if (!isOnline) {
      toast.error("Keine Internetverbindung. Bitte geben Sie den Wechselkurs manuell ein.");
      return;
    }

    try {
      await fetchRateMutation.mutateAsync({
        currencyCode: selectedCurrency,
        date: selectedDate,
      });
      toast.success(`Wechselkurs für ${selectedCurrency} erfolgreich abgerufen`);
      refetch();
    } catch (error) {
      toast.error("Fehler beim Abrufen des Wechselkurses");
      console.error(error);
    }
  };

  const handleManualEntry = async () => {
    if (!manualRate || parseFloat(manualRate) <= 0) {
      toast.error("Bitte geben Sie einen gültigen Wechselkurs ein");
      return;
    }

    try {
      await createRateMutation.mutateAsync({
        date: selectedDate,
        currencyPair: `${selectedCurrency}/PLN`,
        rate: parseFloat(manualRate),
        source: "manual",
      });
      toast.success("Wechselkurs manuell gespeichert");
      setManualRate("");
      refetch();
    } catch (error) {
      toast.error("Fehler beim Speichern des Wechselkurses");
      console.error(error);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Wechselkurse</h1>

      {!isOnline && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <WifiOff className="h-5 w-5 text-yellow-600" />
          <div>
            <p className="font-medium text-yellow-900">Offline-Modus</p>
            <p className="text-sm text-yellow-700">
              Automatische Wechselkurs-Aktualisierung nicht verfügbar. Sie können Wechselkurse manuell eingeben.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Wechselkurs abrufen
            </CardTitle>
            <CardDescription>
              Aktuellen Wechselkurs von NBP (Narodowy Bank Polski) abrufen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Währung</Label>
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Datum</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>

            <Button 
              onClick={handleFetchRate} 
              disabled={!isOnline || fetchRateMutation.isPending}
              className="w-full"
            >
              {fetchRateMutation.isPending ? "Lädt..." : "Wechselkurs abrufen"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Manueller Eintrag
            </CardTitle>
            <CardDescription>
              Wechselkurs manuell eingeben (für Offline-Modus)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-currency">Währung</Label>
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger id="manual-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-date">Datum</Label>
              <Input
                id="manual-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate">Wechselkurs (zu PLN)</Label>
              <Input
                id="rate"
                type="number"
                step="0.0001"
                placeholder="z.B. 4.2850"
                value={manualRate}
                onChange={(e) => setManualRate(e.target.value)}
              />
            </div>

            <Button 
              onClick={handleManualEntry} 
              disabled={createRateMutation.isPending}
              variant="outline"
              className="w-full"
            >
              {createRateMutation.isPending ? "Speichert..." : "Manuell speichern"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gespeicherte Wechselkurse</CardTitle>
          <CardDescription>
            Übersicht aller gespeicherten Wechselkurse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Währungspaar</TableHead>
                <TableHead>Kurs</TableHead>
                <TableHead>Quelle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates && rates.length > 0 ? (
                rates.map((rate: any) => (
                  <TableRow key={rate.id}>
                    <TableCell>{new Date(rate.date).toLocaleDateString("de-DE")}</TableCell>
                    <TableCell>{rate.currencyPair}</TableCell>
                    <TableCell>{rate.rate.toFixed(4)}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded ${
                        rate.source === "manual" 
                          ? "bg-yellow-100 text-yellow-800" 
                          : "bg-green-100 text-green-800"
                      }`}>
                        {rate.source === "manual" ? "Manuell" : "NBP"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Keine Wechselkurse vorhanden
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
