import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Receipt, DollarSign, Calendar } from "lucide-react";
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

export default function Expenses() {
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("month");
  const [showUnifiedCurrency, setShowUnifiedCurrency] = useState(false);
  const [targetCurrency, setTargetCurrency] = useState<SupportedCurrency>("EUR");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());

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

  // Fetch all expenses (no customer filter)
  const { data: allExpenses = [] } = trpc.expenses.list.useQuery({
    startDate,
    endDate,
  });
  const { data: timeEntries = [] } = trpc.timeEntries.list.useQuery({
    startDate,
    endDate,
  });
  const { data: exchangeRates = [] } = trpc.exchangeRatesManagement.list.useQuery({});

  const rateMap = useMemo(() => buildLatestRateMap(exchangeRates as any[]), [exchangeRates]);

  const chartCurrency = showUnifiedCurrency ? targetCurrency : "EUR";
  const expenseRows = useMemo(
    () =>
      allExpenses.map((expense: any) => {
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
    [allExpenses, chartCurrency, rateMap]
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

  const averagePerDay = useMemo(() => {
    if (expenseRows.length === 0) return 0;

    const parseDayKey = (value: string | Date) => {
      const date = typeof value === "string" ? new Date(value) : value;
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    };
    const countCalendarDays = (from: Date, to: Date) => {
      const ms = to.getTime() - from.getTime();
      return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
    };

    let calendarDays = 1;
    if (startDate && endDate) {
      calendarDays = countCalendarDays(parseDayKey(startDate), parseDayKey(endDate));
    } else {
      const dateCandidates = expenseRows
        .map((row: any) => parseDayKey(row.date))
        .sort((a: Date, b: Date) => a.getTime() - b.getTime());
      const minDate = dateCandidates[0];
      const maxDate = dateCandidates[dateCandidates.length - 1];
      if (minDate && maxDate) {
        calendarDays = countCalendarDays(minDate, maxDate);
      }
    }

    const manDays = timeEntries.reduce((sum: number, entry: any) => sum + Number(entry.manDays || 0), 0) / 1000;
    const divisor = Math.max(1, calendarDays, Math.ceil(manDays));
    return totalAmount / divisor;
  }, [expenseRows, totalAmount, timeEntries, startDate, endDate]);

  const averageBaseLabel = useMemo(() => {
    const parseDayKey = (value: string | Date) => {
      const date = typeof value === "string" ? new Date(value) : value;
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    };
    const countCalendarDays = (from: Date, to: Date) => {
      const ms = to.getTime() - from.getTime();
      return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
    };
    let calendarDays = 1;
    if (startDate && endDate) {
      calendarDays = countCalendarDays(parseDayKey(startDate), parseDayKey(endDate));
    } else if (expenseRows.length > 0) {
      const sorted = expenseRows
        .map((row: any) => parseDayKey(row.date))
        .sort((a: Date, b: Date) => a.getTime() - b.getTime());
      calendarDays = countCalendarDays(sorted[0], sorted[sorted.length - 1]);
    }
    const manDays =
      timeEntries.reduce((sum: number, entry: any) => sum + Number(entry.manDays || 0), 0) / 1000;
    return `Kalendertage: ${calendarDays} | kalk. Manntage: ${manDays.toFixed(3)}`;
  }, [expenseRows, timeEntries, startDate, endDate]);

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
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#025a64]">Reisekosten-Analyse</h1>
          <p className="text-muted-foreground">
            Übersicht und Analyse Ihrer Reisekosten nach Kostenart
          </p>
        </div>

        {/* Filter Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Zeitraum-Filter</CardTitle>
            <CardDescription>Wählen Sie den Analysezeitraum</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Periode</label>
                <Select value={filterPeriod} onValueChange={(value) => setFilterPeriod(value as FilterPeriod)}>
                  <SelectTrigger className="w-[200px]">
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
                      {monthOptions.map((option) => (
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
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gesamtkosten</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatMoney(Math.round(totalAmount * 100), chartCurrency)}
              </div>
              <p className="text-xs text-muted-foreground">
                {filterPeriod === "month" ? "Diesen Monat" : filterPeriod === "year" ? "Dieses Jahr" : "Gesamt"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Durchschnitt pro Tag</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatMoney(Math.round(averagePerDay * 100), chartCurrency)}
              </div>
              <p className="text-xs text-muted-foreground">
                Basierend auf {averageBaseLabel}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Anzahl Einträge</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allExpenses.length}</div>
              <p className="text-xs text-muted-foreground">
                Reisekosten-Positionen
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Kosten nach Kategorie (Säulendiagramm)</CardTitle>
              <CardDescription>Verteilung der Reisekosten</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => formatMoney(Math.round(Number(value) * 100), chartCurrency)}
                  />
                  <Legend />
                  <Bar dataKey="amount" fill="#048998" name={`Betrag (${chartCurrency})`} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kosten nach Kategorie (Kuchendiagramm)</CardTitle>
              <CardDescription>Prozentuale Verteilung</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ category, percent }) => `${category}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#048998"
                    dataKey="amount"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatMoney(Math.round(Number(value) * 100), chartCurrency)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Expenses Table */}
        <Card>
          <CardHeader>
            <CardTitle>Alle Reisekosten</CardTitle>
            <CardDescription>Detaillierte Auflistung aller Einträge</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Betrag</TableHead>
                  <TableHead>Währung</TableHead>
                  <TableHead>Kommentar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Keine Reisekosten im ausgewählten Zeitraum
                    </TableCell>
                  </TableRow>
                ) : (
                  expenseRows.map((expense: any) => (
                    <TableRow key={expense.id}>
                      <TableCell>{new Date(expense.date).toLocaleDateString("de-DE")}</TableCell>
                      <TableCell>{CATEGORY_LABELS[expense.category] || expense.category}</TableCell>
                      <TableCell>
                        {formatMoney(expense.amount, expense.sourceCurrency)}
                        {expense.convertedAmount !== null && expense.sourceCurrency !== chartCurrency && (
                          <div className="text-xs text-muted-foreground">
                            ≈ {formatMoney(expense.convertedAmount, chartCurrency)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{expense.sourceCurrency || "EUR"}</TableCell>
                      <TableCell className="max-w-xs truncate">{expense.comment || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              <strong>Hinweis:</strong> Reisekosten werden über den Kalender erfasst. Klicken Sie auf das Receipt-Icon (📄) in einem Kalendertag, um Reisekosten für diesen Tag hinzuzufügen.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
