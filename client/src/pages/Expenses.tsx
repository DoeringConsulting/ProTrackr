import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Receipt, DollarSign, Calendar } from "lucide-react";

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

  // Aggregate expenses by category
  const categoryData = useMemo(() => {
    const aggregated: Record<string, number> = {};
    allExpenses.forEach((expense: any) => {
      const category = expense.category;
      const amountInEur = expense.amount / 100; // Convert cents to EUR
      aggregated[category] = (aggregated[category] || 0) + amountInEur;
    });

    return Object.entries(aggregated).map(([category, amount]) => ({
      category: CATEGORY_LABELS[category] || category,
      amount: parseFloat(amount.toFixed(2)),
    }));
  }, [allExpenses]);

  const totalAmount = useMemo(() => {
    return categoryData.reduce((sum, item) => sum + item.amount, 0);
  }, [categoryData]);

  const averagePerDay = useMemo(() => {
    if (allExpenses.length === 0) return 0;
    const uniqueDates = new Set(allExpenses.map((e: any) => e.date));
    return totalAmount / uniqueDates.size;
  }, [allExpenses, totalAmount]);

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
              <div className="text-2xl font-bold">{totalAmount.toFixed(2)} €</div>
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
              <div className="text-2xl font-bold">{averagePerDay.toFixed(2)} €</div>
              <p className="text-xs text-muted-foreground">
                Basierend auf {new Set(allExpenses.map((e: any) => e.date)).size} Tagen
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
                  <Tooltip formatter={(value: number) => `${value.toFixed(2)} €`} />
                  <Legend />
                  <Bar dataKey="amount" fill="#048998" name="Betrag (€)" />
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
                  <Tooltip formatter={(value: number) => `${value.toFixed(2)} €`} />
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
                  allExpenses.map((expense: any) => (
                    <TableRow key={expense.id}>
                      <TableCell>{new Date(expense.date).toLocaleDateString("de-DE")}</TableCell>
                      <TableCell>{CATEGORY_LABELS[expense.category] || expense.category}</TableCell>
                      <TableCell>{(expense.amount / 100).toFixed(2)} €</TableCell>
                      <TableCell>{expense.currency || "EUR"}</TableCell>
                      <TableCell className="max-w-xs truncate">{expense.comment || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

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
