import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { TrendingUp, RefreshCw, Plus, Info } from "lucide-react";
import { useEffect, useState } from "react";
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

function formatDateTime(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso as any).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function todayLocalIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function ExchangeRatesTab() {
  const [selectedCurrency, setSelectedCurrency] = useState("EUR");
  const [manualRate, setManualRate] = useState("");
  const [manualDate, setManualDate] = useState(todayLocalIso());
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

  // Account settings hold the global "use manual rate for reports" toggle.
  const { data: accountSettings } = trpc.accountSettings.get.useQuery();
  const [useManualOverride, setUseManualOverride] = useState(false);
  useEffect(() => {
    setUseManualOverride(Number(accountSettings?.useManualExchangeRate ?? 0) === 1);
  }, [accountSettings?.useManualExchangeRate]);

  const accountSettingsMutation = trpc.accountSettings.upsert.useMutation({
    onSuccess: () => {
      utils.accountSettings.get.invalidate();
    },
    onError: (error) => {
      toast.error(`Fehler beim Speichern: ${error.message}`);
    },
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
    if (!manualDate) {
      toast.error("Bitte ein Datum für den Kurs angeben");
      return;
    }
    if (selectedCurrency === "PLN") {
      toast.error("PLN ist Basiswährung — kein Wechselkurs nötig");
      return;
    }

    await createManualRateMutation.mutateAsync({
      currencyPair: `${selectedCurrency}/PLN`,
      rate: parseFloat(manualRate),
      date: manualDate,
    });
  };

  const handleToggleManualOverride = async (checked: boolean) => {
    setUseManualOverride(checked);
    try {
      await accountSettingsMutation.mutateAsync({ useManualExchangeRate: checked });
      toast.success(
        checked
          ? "Berichte verwenden ab sofort den manuellen Wechselkurs"
          : "Berichte verwenden ab sofort den automatischen NBP-Kurs"
      );
    } catch {
      // onError handler shows toast; revert local state
      setUseManualOverride(!checked);
    }
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
            Aktuelle Wechselkurse von der Narodowy Bank Polski (NBP) abrufen — automatisch
            der Kurs des letzten Werktages
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
            Hinterlegen Sie einen eigenen Kurs (z.B. für Wochenenden oder spezielle Vereinbarungen).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
              <Label htmlFor="manual-date">Datum</Label>
              <Input
                id="manual-date"
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
              />
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

          <div className="flex items-start gap-3 rounded-md border p-3">
            <Checkbox
              id="use-manual"
              checked={useManualOverride}
              onCheckedChange={(checked) => handleToggleManualOverride(Boolean(checked))}
              disabled={accountSettingsMutation.isPending}
            />
            <div className="space-y-1">
              <Label htmlFor="use-manual" className="cursor-pointer">
                Manuellen Wechselkurs für alle Berichte verwenden
              </Label>
              <p className="text-xs text-muted-foreground">
                Häkchen gesetzt — alle Berichte (Buchhaltungs-, Kunden-, PDF-, Excel-Export)
                verwenden den jeweils zuletzt manuell hinterlegten Kurs pro Währungspaar.
                Häkchen entfernt — Berichte holen den NBP-Kurs des letzten Werktages
                automatisch.
              </p>
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
            Maximal 20 Einträge — ältere werden automatisch entfernt. Bei mehrfacher
            Abfrage am selben Tag wird ein neuer Eintrag nur dann angelegt, wenn sich
            der Kurs tatsächlich geändert hat (z.B. nach NBP-Tagesveröffentlichung).
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
                    <TableHead>NBP-Datum</TableHead>
                    <TableHead>Abgefragt am</TableHead>
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
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(rate.queriedAt ?? rate.createdAt)}
                        </TableCell>
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
                              ? 'bg-[var(--badge-inclusive-bg)] text-[var(--badge-inclusive-text)] ring-1 ring-inset ring-[var(--badge-inclusive-text)]/20'
                              : 'bg-[var(--badge-exclusive-bg)] text-[var(--badge-exclusive-text)] ring-1 ring-inset ring-[var(--badge-exclusive-text)]/20'
                          }`}>
                            {rate.source}
                          </span>
                        </TableCell>
                        <TableCell>
                          {rate.isManual ? (
                            <span className="text-primary">✓</span>
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
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            NBP veröffentlicht die Tabelle A einmal pro Werktag (~12:00 Uhr polnischer Zeit).
            Abfragen davor liefern den Kurs vom Vortag, danach den Tageskurs.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
