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
import { Link } from "wouter";

type FilterPeriod = "month" | "year" | "lifetime" | "average";

const CATEGORY_LABELS: Record<string, string> = {
  car: "Mietwagen",
  train: "Zug",
  flight: "Flug",
  taxi: "Taxi",
  hotel: "Hotel",
  fuel: "Tanken",
  meal: "Bewirtung",
  other: "Sonstiges",
};

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D", "#FFC658", "#FF6B9D"];

export default function ProjectDetail() {
  const params = useParams();
  const customerId = params.id ? parseInt(params.id) : null;
  
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("month");
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

  // Aggregate expenses by category
  const categoryData = useMemo(() => {
    const aggregated: Record<string, number> = {};
    expenses.forEach((expense: any) => {
      const category = expense.category;
      const amountInEur = expense.amount / 100; // Convert cents to EUR
      aggregated[category] = (aggregated[category] || 0) + amountInEur;
    });

    return Object.entries(aggregated).map(([category, amount]) => ({
      category: CATEGORY_LABELS[category] || category,
      amount: parseFloat(amount.toFixed(2)),
    }));
  }, [expenses]);

  const totalAmount = useMemo(() => {
    return categoryData.reduce((sum, item) => sum + item.amount, 0);
  }, [categoryData]);

  const averagePerDay = useMemo(() => {
    if (expenses.length === 0) return 0;
    const uniqueDates = new Set(expenses.map((e: any) => e.date));
    return totalAmount / uniqueDates.size;
  }, [expenses, totalAmount]);

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
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
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

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Gesamtkosten</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">€{totalAmount.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Durchschnitt pro Tag</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">€{averagePerDay.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Anzahl Einträge</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{expenses.length}</div>
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
                      <Tooltip formatter={(value: number) => `€${value.toFixed(2)}`} />
                      <Legend />
                      <Bar dataKey="amount" fill="#8884d8" name="Betrag (€)" />
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
                        label={(entry) => `${entry.category}: €${entry.amount.toFixed(2)}`}
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `€${value.toFixed(2)}`} />
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

        {/* Expense Table */}
        {expenses.length > 0 && (
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
                    {expenses.map((expense: any) => (
                      <TableRow key={expense.id}>
                        <TableCell>
                          {new Date(expense.date).toLocaleDateString("de-DE")}
                        </TableCell>
                        <TableCell>{CATEGORY_LABELS[expense.category] || expense.category}</TableCell>
                        <TableCell className="text-right">
                          €{(expense.amount / 100).toFixed(2)} {expense.currency !== "EUR" && `(${expense.currency})`}
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
