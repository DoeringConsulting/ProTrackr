import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { FileText, Download, Calculator } from "lucide-react";
import { exportAccountingReportToPDF, exportCustomerReportToPDF } from "@/lib/pdfExport";
import { exportAccountingReportToExcel, exportCustomerReportToExcel } from "@/lib/excelExport";
import { calculateAccountingUiData } from "@/lib/uiCalculations";
import {
  SUPPORTED_CURRENCIES,
  aggregateByCurrency,
  buildLatestRateMap,
  convertAmountCents,
  formatMoney,
  type SupportedCurrency,
} from "@/lib/currencyUtils";

export default function Reports() {
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [showUnifiedCurrency, setShowUnifiedCurrency] = useState(false);
  const [targetCurrency, setTargetCurrency] = useState<SupportedCurrency>("EUR");

  const { data: customers = [] } = trpc.customers.list.useQuery();
  const { data: timeEntries = [] } = trpc.timeEntries.list.useQuery({ startDate, endDate });
  const { data: expenses = [] } = trpc.expenses.list.useQuery({ startDate, endDate });
  const { data: fixedCosts = [] } = trpc.fixedCosts.list.useQuery();
  const { data: exchangeRates = [] } = trpc.exchangeRatesManagement.list.useQuery({});
  const { data: taxProfile } = trpc.taxSettings.getProfile.useQuery();
  const reportYear = new Date(`${startDate}T00:00:00`).getFullYear();
  const { data: taxConfig } = trpc.taxSettings.getConfig.useQuery({ year: reportYear });
  const { data: taxSettings } = trpc.taxSettings.get.useQuery();

  const rateMap = useMemo(() => buildLatestRateMap(exchangeRates as any[]), [exchangeRates]);

  const convertToEur = (amountCents: number, sourceCurrency?: string | null) => {
    const source = (sourceCurrency || "EUR").toUpperCase();
    if (source === "EUR") return amountCents;
    return convertAmountCents(amountCents, source, "EUR", rateMap);
  };

  const formatCalculatedCurrency = (amountInEurCents: number) => {
    if (!showUnifiedCurrency) return formatMoney(amountInEurCents, "EUR");
    const converted = convertAmountCents(amountInEurCents, "EUR", targetCurrency, rateMap);
    if (converted === null) {
      return `Kurs fehlt (EUR → ${targetCurrency})`;
    }
    return formatMoney(converted, targetCurrency);
  };

  const formatCalculatedCurrencyNegative = (amountInEurCents: number) => {
    const formatted = formatCalculatedCurrency(amountInEurCents);
    return formatted.startsWith("Kurs fehlt") ? formatted : `-${formatted}`;
  };

  const renderCurrencyBadges = (totals: Map<string, number>) => {
    if (totals.size === 0) {
      return <span className="text-muted-foreground">-</span>;
    }
    return (
      <div className="flex flex-wrap justify-end gap-1">
        {Array.from(totals.entries()).map(([code, total]) => (
          <Badge key={code} variant="secondary" className="font-medium">
            {formatMoney(total, code)}
          </Badge>
        ))}
      </div>
    );
  };

  // Calculate accounting report data
  const calculateAccountingReport = () => {
    const fixedCostsDetailed = fixedCosts.map((cost) => {
      const sourceCurrency = (cost.currency || "EUR").toUpperCase();
      const amountEur = convertToEur(cost.amount, sourceCurrency);
      return {
        ...cost,
        sourceCurrency,
        amountEur,
      };
    });

    const expensesDetailed = expenses.map((expense) => {
      const sourceCurrency = (expense.currency || "EUR").toUpperCase();
      const amountEur = convertToEur(expense.amount, sourceCurrency);
      return {
        ...expense,
        sourceCurrency,
        amountEur,
      };
    });

    // Revenue from time entries is in EUR in current system
    const timeRevenue = timeEntries.reduce((sum, entry) => sum + entry.calculatedAmount, 0);

    // Only travel costs from "exclusive" customers are billable as extra revenue.
    const entriesById = new Map(timeEntries.map((entry) => [entry.id, entry]));
    const customersById = new Map(customers.map((customer) => [customer.id, customer]));
    const travelRevenueInGross = expensesDetailed.reduce((sum, expense) => {
      if (!expense.timeEntryId) return sum;
      const relatedEntry = entriesById.get(expense.timeEntryId);
      if (!relatedEntry) return sum;
      const relatedCustomer = customersById.get(relatedEntry.customerId);
      if (relatedCustomer?.costModel !== "exclusive") return sum;
      return sum + (expense.amountEur ?? 0);
    }, 0);

    const grossRevenue = timeRevenue + travelRevenueInGross;
    const totalFixedCosts = fixedCostsDetailed.reduce((sum, cost) => sum + (cost.amountEur ?? 0), 0);
    const variableCosts = expensesDetailed.reduce((sum, expense) => sum + (expense.amountEur ?? 0), 0);

    const taxResult = calculateAccountingUiData({
      customers,
      timeEntries: timeEntries.map((entry) => ({ ...entry, calculatedAmount: entry.calculatedAmount })),
      expenses: expensesDetailed.map((expense) => ({
        ...expense,
        amount: expense.amountEur ?? 0,
      })),
      fixedCosts: fixedCostsDetailed.map((cost) => ({
        ...cost,
        amount: cost.amountEur ?? 0,
      })),
      startDate,
      endDate,
      taxProfile: taxProfile
        ? {
            taxForm: taxProfile.taxForm,
            zusRegime: taxProfile.zusRegime,
            choroboweEnabled: taxProfile.choroboweEnabled,
            fpFsEnabled: taxProfile.fpFsEnabled,
            wypadkowaRateBp: taxProfile.wypadkowaRateBp,
            zdrowotnaRateLiniowyBp: taxProfile.zdrowotnaRateLiniowyBp,
            pitRateBp: taxProfile.pitRateBp,
          }
        : null,
      taxConfig: taxConfig
        ? {
            year: taxConfig.year,
            socialMinBaseCents: taxConfig.socialMinBaseCents,
            zdrowotnaMinBaseCents: taxConfig.zdrowotnaMinBaseCents,
            zdrowotnaMinAmountCents: taxConfig.zdrowotnaMinAmountCents,
            zdrowotnaDeductionLimitYearlyCents: taxConfig.zdrowotnaDeductionLimitYearlyCents,
            socialContributionRateBp: taxConfig.socialContributionRateBp,
            choroboweRateBp: taxConfig.choroboweRateBp,
            fpFsRateBp: taxConfig.fpFsRateBp,
          }
        : null,
      legacySettings: taxSettings,
    });

    const fixedCostsByCurrency = aggregateByCurrency(
      fixedCostsDetailed.map((cost) => ({
        amount: cost.amount,
        currency: cost.sourceCurrency,
      }))
    );
    const variableCostsByCurrency = aggregateByCurrency(
      expensesDetailed.map((expense) => ({
        amount: expense.amount,
        currency: expense.sourceCurrency,
      }))
    );

    const missingConversionCount =
      fixedCostsDetailed.filter((cost) => cost.amountEur === null).length +
      expensesDetailed.filter((expense) => expense.amountEur === null).length;

    return {
      ...taxResult,
      // keep these fields in EUR for calculation/export compatibility
      timeRevenue,
      travelRevenueInGross,
      grossRevenue,
      totalFixedCosts,
      variableCosts,
      fixedCostsDetailed,
      expensesDetailed,
      fixedCostsByCurrency,
      variableCostsByCurrency,
      missingConversionCount,
    };
  };

  // Calculate customer report data
  const calculateCustomerReport = () => {
    if (!selectedCustomerId) return null;

    const customerEntries = timeEntries.filter(e => e.customerId === selectedCustomerId);
    const customer = customers.find(c => c.id === selectedCustomerId);

    if (!customer) return null;

    const totalHours = customerEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const totalAmount = customerEntries.reduce((sum, entry) => sum + entry.calculatedAmount, 0); // EUR
    const totalManDays = customerEntries.reduce((sum, entry) => sum + entry.manDays, 0);

    // Calculate expenses for this customer
    const customerExpenses = expenses.filter(expense => {
      // Find the time entry for this expense
      const timeEntry = timeEntries.find(te => te.id === expense.timeEntryId);
      return timeEntry && timeEntry.customerId === selectedCustomerId;
    });
    const customerExpensesDetailed = customerExpenses.map((expense) => {
      const sourceCurrency = (expense.currency || "EUR").toUpperCase();
      const amountEur = convertToEur(expense.amount, sourceCurrency);
      return {
        ...expense,
        sourceCurrency,
        amountEur,
      };
    });

    const totalExpenses = customerExpensesDetailed.reduce((sum, expense) => sum + (expense.amountEur ?? 0), 0); // EUR
    const billableExpenses = customer.costModel === "exclusive" ? totalExpenses : 0; // EUR
    const totalExpensesByCurrency = aggregateByCurrency(
      customerExpensesDetailed.map((expense) => ({
        amount: expense.amount,
        currency: expense.sourceCurrency,
      }))
    );

    return {
      customer,
      entries: customerEntries,
      totalHours,
      totalAmount,
      totalManDays,
      totalExpenses,
      billableExpenses,
      grandTotal: totalAmount + billableExpenses,
      totalExpensesByCurrency,
      customerExpensesDetailed,
    };
  };

  const accountingData = calculateAccountingReport();
  const customerData = calculateCustomerReport();

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}h`;
  };

  const formatManDays = (manDays: number) => {
    return (manDays / 1000).toFixed(3);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Berichte</h1>
          <p className="text-muted-foreground">
            Buchhaltungs- und Kundenberichte für Ihre Projekte
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Zeitraum auswählen</CardTitle>
            <CardDescription>
              Wählen Sie den Berichtszeitraum aus
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Von</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Bis</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant={showUnifiedCurrency ? "default" : "outline"}
                size="sm"
                onClick={() => setShowUnifiedCurrency((prev) => !prev)}
              >
                {showUnifiedCurrency ? "Einheitliche Währung aktiv" : "Einheitliche Währung"}
              </Button>
              <Select
                value={targetCurrency}
                onValueChange={(value) => setTargetCurrency(value as SupportedCurrency)}
                disabled={!showUnifiedCurrency}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="accounting" className="space-y-4">
          <TabsList>
            <TabsTrigger value="accounting">
              <Calculator className="mr-2 h-4 w-4" />
              Buchhaltungsbericht
            </TabsTrigger>
            <TabsTrigger value="customer">
              <FileText className="mr-2 h-4 w-4" />
              Kundenbericht
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounting" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Buchhaltungsbericht (Polnisches Recht)</CardTitle>
                    <CardDescription>
                      Detaillierte Kostenrechnung für den Zeitraum {new Date(startDate).toLocaleDateString("de-DE")} - {new Date(endDate).toLocaleDateString("de-DE")}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => exportAccountingReportToPDF(accountingData, startDate, endDate)}>
                      <Download className="mr-2 h-4 w-4" />
                      PDF Export
                    </Button>
                    <Button variant="outline" onClick={() => {
                      exportAccountingReportToExcel({
                        revenue: accountingData.grossRevenue,
                        timeRevenue: accountingData.timeRevenue,
                        travelRevenueInGross: accountingData.travelRevenueInGross,
                        fixedCosts: fixedCosts.map(fc => ({ category: fc.category, amount: fc.amount })),
                        variableCosts: accountingData.variableCosts,
                        zus: accountingData.zus,
                        healthInsurance: accountingData.healthInsurance,
                        tax: accountingData.tax,
                        netProfit: accountingData.netProfit,
                        startDate,
                        endDate,
                      });
                      toast.success("Excel-Datei wird heruntergeladen");
                    }}>
                      <Download className="mr-2 h-4 w-4" />
                      Excel Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-semibold">Bruttoumsatz</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCalculatedCurrency(accountingData.grossRevenue)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8 text-muted-foreground">
                        Zeiterfassung ({timeEntries.length} Einträge)
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCalculatedCurrency(accountingData.timeRevenue)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8 text-muted-foreground">
                        Reisekosten (abrechenbar, nur Exclusive)
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {showUnifiedCurrency
                          ? formatCalculatedCurrency(accountingData.travelRevenueInGross)
                          : renderCurrencyBadges(
                              aggregateByCurrency(
                                accountingData.expensesDetailed
                                  .filter((expense) => {
                                    if (!expense.timeEntryId) return false;
                                    const relatedEntry = timeEntries.find(
                                      (entry) => entry.id === expense.timeEntryId
                                    );
                                    if (!relatedEntry) return false;
                                    const relatedCustomer = customers.find(
                                      (customer) => customer.id === relatedEntry.customerId
                                    );
                                    return relatedCustomer?.costModel === "exclusive";
                                  })
                                  .map((expense) => ({
                                    amount: expense.amount,
                                    currency: expense.sourceCurrency,
                                  }))
                              )
                            )}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-semibold">Fixkosten</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {showUnifiedCurrency
                          ? formatCalculatedCurrencyNegative(accountingData.totalFixedCosts)
                          : renderCurrencyBadges(accountingData.fixedCostsByCurrency)}
                      </TableCell>
                    </TableRow>
                    {accountingData.fixedCostsDetailed.map((cost) => (
                      <TableRow key={cost.id}>
                        <TableCell className="pl-8 text-muted-foreground">{cost.category}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {!showUnifiedCurrency ? (
                            formatMoney(cost.amount, cost.sourceCurrency)
                          ) : (() => {
                              const converted = convertAmountCents(
                                cost.amount,
                                cost.sourceCurrency,
                                targetCurrency,
                                rateMap
                              );
                              if (converted === null) {
                                return (
                                  <span className="text-amber-600">
                                    Kurs fehlt ({cost.sourceCurrency} → {targetCurrency})
                                  </span>
                                );
                              }
                              return (
                                <div className="flex flex-col items-end">
                                  <span>{formatMoney(converted, targetCurrency)}</span>
                                  {cost.sourceCurrency !== targetCurrency && (
                                    <span className="text-xs text-muted-foreground">
                                      Original: {formatMoney(cost.amount, cost.sourceCurrency)}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell className="font-semibold">Variable Kosten (Reisen)</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {showUnifiedCurrency
                          ? formatCalculatedCurrencyNegative(accountingData.variableCosts)
                          : renderCurrencyBadges(accountingData.variableCostsByCurrency)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-semibold">ZUS (Sozialversicherung)</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {formatCalculatedCurrencyNegative(accountingData.zus)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold">Krankenversicherung (Zdrowotna)</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {formatCalculatedCurrencyNegative(accountingData.healthInsurance)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8 text-muted-foreground">
                        Abzugsfähige Zdrowotna (Steuerbasis)
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCalculatedCurrency(accountingData.deductibleHealth)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-medium">Steuerbasis</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCalculatedCurrency(accountingData.taxBase)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold">Einkommensteuer (PIT)</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {formatCalculatedCurrencyNegative(accountingData.tax)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">Berechnungsmodus</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {accountingData.calculationSource === "regime_config"
                          ? `Regime + Jahreswerte (${reportYear})`
                          : "Legacy-Fallback"}{" "}
                        |{" "}
                        {showUnifiedCurrency
                          ? `Anzeige in ${targetCurrency}`
                          : "Anzeige in Originalwährung (Berechnung in EUR)"}
                      </TableCell>
                    </TableRow>
                    {accountingData.missingConversionCount > 0 && (
                      <TableRow>
                        <TableCell className="text-amber-700">
                          Hinweis (Wechselkurs fehlt)
                        </TableCell>
                        <TableCell className="text-right text-amber-700">
                          {accountingData.missingConversionCount} Position(en) ohne Kurs; in Berechnung als 0 angesetzt.
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow className="border-t-4 bg-muted/50">
                      <TableCell className="font-bold text-lg">Nettogewinn</TableCell>
                      <TableCell className="text-right font-bold text-lg text-green-600">
                        {formatCalculatedCurrency(accountingData.netProfit)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customer" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Kunde auswählen</CardTitle>
                <CardDescription>
                  Wählen Sie einen Kunden für den detaillierten Bericht aus
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedCustomerId?.toString() || ""}
                  onValueChange={(value) => setSelectedCustomerId(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kunde auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id.toString()}>
                        {customer.projectName} - {customer.provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {customerData && (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Kundenbericht - Summary</CardTitle>
                        <CardDescription>
                          {customerData.customer.projectName} - {customerData.customer.provider}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => customerData && exportCustomerReportToPDF(customerData, startDate, endDate)}>
                          <Download className="mr-2 h-4 w-4" />
                          PDF Export
                        </Button>
                        <Button variant="outline" onClick={() => {
                          if (customerData) {
                            exportCustomerReportToExcel({
                              customerName: customerData.customer.provider,
                              projectName: customerData.customer.projectName,
                              costModel: customerData.customer.costModel,
                              consultant: "Berater",
                              startDate,
                              endDate,
                              entries: customerData.entries.map(e => ({
                                date: new Date(e.date).toLocaleDateString("de-DE"),
                                hours: e.hours / 60,
                                rate: e.rate || 0,
                                amount: e.calculatedAmount,
                                expenses: 0,
                              })),
                              totalHours: customerData.totalHours,
                              totalAmount: customerData.totalAmount,
                              totalExpenses: customerData.totalExpenses,
                              billableExpenses: customerData.billableExpenses,
                              grandTotal: customerData.grandTotal,
                            });
                            toast.success("Excel-Datei wird heruntergeladen");
                          }
                        }}>
                          <Download className="mr-2 h-4 w-4" />
                          Excel Export
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Zeitraum</p>
                        <p className="font-semibold">
                          {new Date(startDate).toLocaleDateString("de-DE")} - {new Date(endDate).toLocaleDateString("de-DE")}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Abrechnungsmodell</p>
                        <p className="font-semibold capitalize">{customerData.customer.costModel}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Arbeitstage</p>
                        <p className="font-semibold">{customerData.entries.length}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Manntage</p>
                        <p className="font-semibold">{formatManDays(customerData.totalManDays)} MT</p>
                      </div>
                    </div>

                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-semibold">Leistungswert</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCalculatedCurrency(customerData.totalAmount)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="pl-8 text-muted-foreground">
                            Arbeitsstunden: {formatHours(customerData.totalHours)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCalculatedCurrency(customerData.totalAmount)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold">Reisekosten (gesamt)</TableCell>
                          <TableCell className="text-right font-semibold">
                            {showUnifiedCurrency
                              ? formatCalculatedCurrency(customerData.totalExpenses)
                              : renderCurrencyBadges(customerData.totalExpensesByCurrency)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="pl-8 text-muted-foreground">
                            Reisekosten (abrechenbar)
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {customerData.customer.costModel === "exclusive"
                              ? showUnifiedCurrency
                                ? formatCalculatedCurrency(customerData.billableExpenses)
                                : renderCurrencyBadges(customerData.totalExpensesByCurrency)
                              : formatMoney(0, "EUR")}
                          </TableCell>
                        </TableRow>
                        <TableRow className="border-t-4 bg-muted/50">
                          <TableCell className="font-bold text-lg">Gesamtsumme</TableCell>
                          <TableCell className="text-right font-bold text-lg">
                            {formatCalculatedCurrency(customerData.grandTotal)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Kundenbericht - Details</CardTitle>
                    <CardDescription>
                      Tagesübersicht mit Arbeitsstunden und Kosten
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Datum</TableHead>
                          <TableHead>Wochentag</TableHead>
                          <TableHead>Typ</TableHead>
                          <TableHead className="text-right">Stunden</TableHead>
                          <TableHead className="text-right">Manntage</TableHead>
                          <TableHead className="text-right">Betrag</TableHead>
                          <TableHead className="text-right">Reisekosten</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customerData.entries.map((entry) => {
                          // Calculate expenses for this entry
                          const entryExpenses = customerData.customerExpensesDetailed.filter(
                            (expense) => expense.timeEntryId === entry.id
                          );
                          const entryExpenseTotalEur = entryExpenses.reduce(
                            (sum, expense) => sum + (expense.amountEur ?? 0),
                            0
                          );
                          const entryExpenseByCurrency = aggregateByCurrency(
                            entryExpenses.map((expense) => ({
                              amount: expense.amount,
                              currency: expense.sourceCurrency,
                            }))
                          );
                          
                          return (
                            <TableRow key={entry.id}>
                              <TableCell>
                                {new Date(entry.date).toLocaleDateString("de-DE")}
                              </TableCell>
                              <TableCell>{entry.weekday}</TableCell>
                              <TableCell className="capitalize">{entry.entryType}</TableCell>
                              <TableCell className="text-right">{formatHours(entry.hours)}</TableCell>
                              <TableCell className="text-right">{formatManDays(entry.manDays)}</TableCell>
                              <TableCell className="text-right">
                                {formatCalculatedCurrency(entry.calculatedAmount)}
                              </TableCell>
                              <TableCell className="text-right">
                                {showUnifiedCurrency
                                  ? formatCalculatedCurrency(entryExpenseTotalEur)
                                  : renderCurrencyBadges(entryExpenseByCurrency)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="border-t-2 font-semibold">
                          <TableCell colSpan={3}>Gesamt</TableCell>
                          <TableCell className="text-right">{formatHours(customerData.totalHours)}</TableCell>
                          <TableCell className="text-right">{formatManDays(customerData.totalManDays)}</TableCell>
                          <TableCell className="text-right">
                            {formatCalculatedCurrency(customerData.totalAmount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {showUnifiedCurrency
                              ? formatCalculatedCurrency(customerData.totalExpenses)
                              : renderCurrencyBadges(customerData.totalExpensesByCurrency)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}

            {!customerData && selectedCustomerId && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <p>Keine Daten für den ausgewählten Zeitraum gefunden.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
