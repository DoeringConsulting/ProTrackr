import { useState, useMemo } from "react";
import { useParams } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import {
  SUPPORTED_CURRENCIES,
  buildLatestRateMap,
  convertAmountCents,
  formatMoney,
  type SupportedCurrency,
} from "@/lib/currencyUtils";

type FilterPeriod = "month" | "year" | "lifetime" | "average";

const CATEGORY_LABELS: Record<string, string> = {
  car: "Mietwagen",
  train: "ÖPNV",
  flight: "Flug",
  taxi: "Taxi",
  hotel: "Hotel",
  fuel: "Kraftstoff",
  meal: "Bewirtung",
  other: "Sonstiges",
};

const COLORS = ["#048998", "#06a5b6", "#036d79", "#025a64", "#dbbe76", "#b98847", "#7a8f94", "#dc2626"];

export default function ProjectDetail() {
  const params = useParams();
  const customerId = params.id ? parseInt(params.id) : null;
  
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("month");
  const [showUnifiedCurrency, setShowUnifiedCurrency] = useState(false);
  const [targetCurrency, setTargetCurrency] = useState<SupportedCurrency>("EUR");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());

  const { data: customer } = trpc.customers.getById.useQuery(
    { id: customerId! },
    { enabled: !!customerId }
  );

  // Calculate date range based on filter
  const { startDate, endDate } = useMemo(() => {
    if (filterPeriod === "month") {
      const [year, month] = selectedMonth.split("-");
      const start = new Date(parseInt(year), parseInt(month) - 1, 1);
      const end = new Date(parseInt(year), parseInt(month), 0);
      return {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      };
    } else if (filterPeriod === "year") {
      return {
        startDate: `${selectedYear}-01-01`,
        endDate: `${selectedYear}-12-31`,
      };
    }
    // lifetime or average - no date filter
    return { startDate: undefined, endDate: undefined };
  }, [filterPeriod, selectedMonth, selectedYear]);

  const { data: expenses = [] } = trpc.expenses.aggregateByCustomer.useQuery(
    {
      customerId: customerId!,
      startDate,
      endDate,
    },
    { enabled: !!customerId }
  );
  const { data: timeEntries = [] } = trpc.timeEntries.list.useQuery({
    startDate,
    endDate,
  });
  const { data: exchangeRates = [] } = trpc.exchangeRatesManagement.list.useQuery({});

  const rateMap = useMemo(() => buildLatestRateMap(exchangeRates as any[]), [exchangeRates]);
  const chartCurrency = showUnifiedCurrency ? targetCurrency : "EUR";
  const expenseRows = useMemo(
    () =>
      expenses.map((expense: any) => {
        const sourceCurrency = String(expense.currency || "EUR").toUpperCase();
        const converted =
          sourceCurrency === chartCurrency
            ? expense.amount
            : convertAmountCents(expense.amount, sourceCurrency, chartCurrency, rateMap);
        return {
          ...expense,
          sourceCurrency,
          convertedAmount: converted,
        };
      }),
    [expenses, chartCurrency, rateMap]
  );

  // Aggregate expenses by category
  const categoryData = useMemo(() => {
    const aggregated: Record<string, number> = {};
    expenseRows.forEach((expense: any) => {
      const category = expense.category;
      const amountInChartCurrency = (expense.convertedAmount ?? 0) / 100;
      aggregated[category] = (aggregated[category] || 0) + amountInChartCurrency;
    });

    return Object.entries(aggregated).map(([category, amount]) => ({
      category: CATEGORY_LABELS[category] || category,
      amount: parseFloat(amount.toFixed(2)),
    }));
  }, [expenseRows]);

  const totalAmount = useMemo(() => {
    return categoryData.reduce((sum, item) => sum + item.amount, 0);
  }, [categoryData]);

  const averageStats = useMemo(() => {
    const customerEntries = timeEntries.filter((entry: any) => entry.customerId === customerId);
    const entryDayKeys = new Set(
      customerEntries
        .filter((entry: any) => Number(entry.hours || 0) > 0)
        .map((entry: any) => {
          const date = new Date(entry.date);
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, "0");
          const d = String(date.getDate()).padStart(2, "0");
          return `${y}-${m}-${d}`;
        })
    );
    const calendarEntryDays = Math.max(1, entryDayKeys.size || expenseRows.length || 1);
    const manDays =
      customerEntries.reduce((sum: number, entry: any) => sum + Number(entry.manDays || 0), 0) / 1000;
    const safeManDays = Math.max(0.001, manDays);

    return {
      calendarEntryDays,
      manDays,
      averagePerCalendarDay: totalAmount / calendarEntryDays,
      averagePerManDay: totalAmount / safeManDays,
    };
  }, [timeEntries, customerId, expenseRows, totalAmount]);

  const missingConversionCount = useMemo(
    () =>
      expenseRows.filter(
        (expense: any) => expense.sourceCurrency !== chartCurrency && expense.convertedAmount === null
      ).length,
    [expenseRows, chartCurrency]
  );

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("de-DE", { year: "numeric", month: "long" });
      options.push({ value, label });
    }
    return options;
  }, []);

  // Generate year options (last 5 years)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i).map(year => ({
      value: year.toString(),
      label: year.toString(),
    }));
  }, []);

  if (!customerId) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Ungültige Projekt-ID</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/customers">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#025a64]">
              {customer?.projectName || "Projekt"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {customer?.provider} • {customer?.location}
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Reisekosten-Analyse</CardTitle>
            <CardDescription>Visualisierung der Reisekosten nach Kostenart</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Zeitraum</label>
                <Select value={filterPeriod} onValueChange={(value: FilterPeriod) => setFilterPeriod(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Monat</SelectItem>
                    <SelectItem value="year">Jahr</SelectItem>
                    <SelectItem value="lifetime">Projektlaufzeit</SelectItem>
                    <SelectItem value="average">Durchschnitt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filterPeriod === "month" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Monat</label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {filterPeriod === "year" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Jahr</label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant={showUnifiedCurrency ? "default" : "outline"}
                size="sm"
                onClick={() => setShowUnifiedCurrency((prev) => !prev)}
              >
                {showUnifiedCurrency ? "Einheitliche Währung aktiv" : "Einheitliche Währung"}
              </Button>
              <div className="w-[150px]">
                <Label className="sr-only">Zielwährung</Label>
                <Select
                  value={targetCurrency}
                  onValueChange={(value) => setTargetCurrency(value as SupportedCurrency)}
                  disabled={!showUnifiedCurrency}
                >
                  <SelectTrigger>
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
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Gesamtkosten</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatMoney(Math.round(totalAmount * 100), chartCurrency)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Durchschnitt</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold">
                    Pro Kalendertag:{" "}
                    {formatMoney(Math.round(averageStats.averagePerCalendarDay * 100), chartCurrency)}
                  </div>
                  <div className="text-lg font-semibold">
                    Pro Manntag:{" "}
                    {formatMoney(Math.round(averageStats.averagePerManDay * 100), chartCurrency)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Kalendertage mit Projekteinträgen: {averageStats.calendarEntryDays} | kalk. Manntage:{" "}
                    {averageStats.manDays.toFixed(3)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Anzahl Einträge</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{expenseRows.length}</div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            {categoryData.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Kosten nach Kategorie</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={categoryData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number) =>
                          formatMoney(Math.round(Number(value) * 100), chartCurrency)
                        }
                      />
                      <Legend />
                      <Bar dataKey="amount" fill="#048998" name={`Betrag (${chartCurrency})`} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Pie Chart */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Verteilung</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        dataKey="amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry) =>
                          `${entry.category}: ${formatMoney(
                            Math.round(Number(entry.amount) * 100),
                            chartCurrency
                          )}`
                        }
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) =>
                          formatMoney(Math.round(Number(value) * 100), chartCurrency)
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Keine Reisekosten vorhanden</h3>
                <p className="text-muted-foreground mt-2">
                  Für den ausgewählten Zeitraum wurden keine Reisekosten erfasst.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {missingConversionCount > 0 && (
          <Card className="border-amber-300 bg-amber-50/60">
            <CardContent className="pt-6 text-amber-800">
              Für {missingConversionCount} Position(en) fehlt ein Wechselkurs nach {chartCurrency}. Diese
              Werte sind in Diagrammen/Summen als 0 enthalten, bis ein Kurs gepflegt ist.
            </CardContent>
          </Card>
        )}

        {/* Expense Table */}
        {expenseRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Einzelposten</CardTitle>
              <CardDescription>Alle Reisekosten im Detail</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Kategorie</TableHead>
                      <TableHead className="text-right">Betrag</TableHead>
                      <TableHead>Kommentar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseRows.map((expense: any) => (
                      <TableRow key={expense.id}>
                        <TableCell>
                          {new Date(expense.date).toLocaleDateString("de-DE")}
                        </TableCell>
                        <TableCell>{CATEGORY_LABELS[expense.category] || expense.category}</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(expense.amount, expense.sourceCurrency)}
                          {expense.convertedAmount !== null && expense.sourceCurrency !== chartCurrency && (
                            <div className="text-xs text-muted-foreground">
                              ≈ {formatMoney(expense.convertedAmount, chartCurrency)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{expense.comment || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
