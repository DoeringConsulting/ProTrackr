import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
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

  const { data: customers = [] } = trpc.customers.list.useQuery();
  const { data: timeEntries = [] } = trpc.timeEntries.list.useQuery({ startDate, endDate });
  const { data: expenses = [] } = trpc.expenses.list.useQuery({ startDate, endDate });
  const { data: fixedCosts = [] } = trpc.fixedCosts.list.useQuery();
  const { data: taxSettings } = trpc.taxSettings.get.useQuery();

  // Calculate accounting report data
  const calculateAccountingReport = () => {
    // Revenue from time entries
    const timeRevenue = timeEntries.reduce((sum, entry) => sum + entry.calculatedAmount, 0);

    // Get all expenses for the period
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    // Only travel costs from "exclusive" customers are billable as extra revenue.
    // "inclusive" customers already include travel in the day/hour rate.
    const entriesById = new Map(timeEntries.map((entry) => [entry.id, entry]));
    const customersById = new Map(customers.map((customer) => [customer.id, customer]));
    const travelRevenueInGross = expenses.reduce((sum, expense) => {
      if (!expense.timeEntryId) return sum;
      const relatedEntry = entriesById.get(expense.timeEntryId);
      if (!relatedEntry) return sum;
      const relatedCustomer = customersById.get(relatedEntry.customerId);
      if (relatedCustomer?.costModel === "exclusive") {
        return sum + expense.amount;
      }
      return sum;
    }, 0);

    const grossRevenue = timeRevenue + travelRevenueInGross;

    // Fixed costs
    const totalFixedCosts = fixedCosts.reduce((sum, cost) => sum + cost.amount, 0);

    // Variable costs (travel expenses)
    const variableCosts = totalExpenses;

    // Use configured tax settings or defaults
    const zusRate = taxSettings?.zusType === "percentage" ? taxSettings.zusValue / 10000 : 0.1952;
    const zusFixed = taxSettings?.zusType === "fixed" ? taxSettings.zusValue : 0;
    const healthRate = taxSettings?.healthInsuranceType === "percentage" ? taxSettings.healthInsuranceValue / 10000 : 0.09;
    const healthFixed = taxSettings?.healthInsuranceType === "fixed" ? taxSettings.healthInsuranceValue : 0;
    const taxRate = taxSettings?.taxType === "percentage" ? taxSettings.taxValue / 10000 : 0.19;
    const taxFixed = taxSettings?.taxType === "fixed" ? taxSettings.taxValue : 0;
    
    // ZUS (Social security)
    const zus = taxSettings?.zusType === "fixed" ? zusFixed : Math.round(grossRevenue * zusRate);

    // Health insurance
    const healthInsurance = taxSettings?.healthInsuranceType === "fixed" ? healthFixed : Math.round(grossRevenue * healthRate);

    // Tax base
    const taxBase = grossRevenue - totalFixedCosts - variableCosts - zus;

    // Tax
    const tax = taxSettings?.taxType === "fixed" ? taxFixed : Math.round(Math.max(0, taxBase) * taxRate);

    // Net profit
    const netProfit = grossRevenue - totalFixedCosts - variableCosts - zus - healthInsurance - tax;

    return {
      timeRevenue,
      travelRevenueInGross,
      grossRevenue,
      totalFixedCosts,
      variableCosts,
      zus,
      healthInsurance,
      taxBase,
      tax,
      netProfit,
    };
  };

  // Calculate customer report data
  const calculateCustomerReport = () => {
    if (!selectedCustomerId) return null;

    const customerEntries = timeEntries.filter(e => e.customerId === selectedCustomerId);
    const customer = customers.find(c => c.id === selectedCustomerId);

    if (!customer) return null;

    const totalHours = customerEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const totalAmount = customerEntries.reduce((sum, entry) => sum + entry.calculatedAmount, 0);
    const totalManDays = customerEntries.reduce((sum, entry) => sum + entry.manDays, 0);

    // Calculate expenses for this customer
    const customerExpenses = expenses.filter(expense => {
      // Find the time entry for this expense
      const timeEntry = timeEntries.find(te => te.id === expense.timeEntryId);
      return timeEntry && timeEntry.customerId === selectedCustomerId;
    });
    const totalExpenses = customerExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const billableExpenses = customer.costModel === "exclusive" ? totalExpenses : 0;

    return {
      customer,
      entries: customerEntries,
      totalHours,
      totalAmount,
      totalManDays,
      totalExpenses,
      billableExpenses,
      grandTotal: totalAmount + billableExpenses,
    };
  };

  const accountingData = calculateAccountingReport();
  const customerData = calculateCustomerReport();

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

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
                        {formatCurrency(accountingData.grossRevenue)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8 text-muted-foreground">
                        Zeiterfassung ({timeEntries.length} Einträge)
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(accountingData.timeRevenue)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8 text-muted-foreground">
                        Reisekosten (abrechenbar, nur Exclusive)
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(accountingData.travelRevenueInGross)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-semibold">Fixkosten</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        -{formatCurrency(accountingData.totalFixedCosts)}
                      </TableCell>
                    </TableRow>
                    {fixedCosts.map((cost) => (
                      <TableRow key={cost.id}>
                        <TableCell className="pl-8 text-muted-foreground">{cost.category}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(cost.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell className="font-semibold">Variable Kosten (Reisen)</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        -{formatCurrency(accountingData.variableCosts)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-semibold">ZUS (Sozialversicherung 19,52%)</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        -{formatCurrency(accountingData.zus)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold">Krankenversicherung (9%)</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        -{formatCurrency(accountingData.healthInsurance)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-medium">Steuerbasis</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(accountingData.taxBase)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold">Steuer (19%)</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        -{formatCurrency(accountingData.tax)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-4 bg-muted/50">
                      <TableCell className="font-bold text-lg">Nettogewinn</TableCell>
                      <TableCell className="text-right font-bold text-lg text-green-600">
                        {formatCurrency(accountingData.netProfit)}
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
                            {formatCurrency(customerData.totalAmount)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="pl-8 text-muted-foreground">
                            Arbeitsstunden: {formatHours(customerData.totalHours)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(customerData.totalAmount)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold">Reisekosten (gesamt)</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(customerData.totalExpenses)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="pl-8 text-muted-foreground">
                            Reisekosten (abrechenbar)
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(customerData.billableExpenses)}
                          </TableCell>
                        </TableRow>
                        <TableRow className="border-t-4 bg-muted/50">
                          <TableCell className="font-bold text-lg">Gesamtsumme</TableCell>
                          <TableCell className="text-right font-bold text-lg">
                            {formatCurrency(customerData.grandTotal)}
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
                          const entryExpenses = expenses.filter(e => e.timeEntryId === entry.id);
                          const entryExpenseTotal = entryExpenses.reduce((sum, e) => sum + e.amount, 0);
                          
                          return (
                            <TableRow key={entry.id}>
                              <TableCell>
                                {new Date(entry.date).toLocaleDateString("de-DE")}
                              </TableCell>
                              <TableCell>{entry.weekday}</TableCell>
                              <TableCell className="capitalize">{entry.entryType}</TableCell>
                              <TableCell className="text-right">{formatHours(entry.hours)}</TableCell>
                              <TableCell className="text-right">{formatManDays(entry.manDays)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(entry.calculatedAmount)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(entryExpenseTotal)}</TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="border-t-2 font-semibold">
                          <TableCell colSpan={3}>Gesamt</TableCell>
                          <TableCell className="text-right">{formatHours(customerData.totalHours)}</TableCell>
                          <TableCell className="text-right">{formatManDays(customerData.totalManDays)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(customerData.totalAmount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(customerData.totalExpenses)}</TableCell>
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
