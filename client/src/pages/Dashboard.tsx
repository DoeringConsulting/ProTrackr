import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Calendar, Euro, FileText, Users, TrendingUp, PieChart as PieChartIcon } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import {
  calculateDashboardCostBreakdown,
  calculateMonthlyRevenueSeries,
  formatLocalDate,
  getDateKey,
} from "@/lib/uiCalculations";

export default function Dashboard() {
  const [selectedMonths, setSelectedMonths] = useState<3 | 6 | 12>(6);

  // One shared date range for all chart sections.
  const now = new Date();
  const currentMonthStart = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const currentMonthEnd = formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const rangeStart = formatLocalDate(new Date(now.getFullYear(), now.getMonth() - (selectedMonths - 1), 1));
  const rangeEnd = currentMonthEnd;
  const selectedPeriodLabel = `${selectedMonths} Monate`;

  const { data: customers, isLoading: customersLoading } = trpc.customers.list.useQuery();
  const { data: timeEntries = [], isLoading: timeEntriesLoading } = trpc.timeEntries.list.useQuery({
    startDate: rangeStart,
    endDate: rangeEnd,
  });
  const { data: expenses = [] } = trpc.expenses.list.useQuery({
    startDate: rangeStart,
    endDate: rangeEnd,
  });
  const { data: fixedCosts } = trpc.fixedCosts.list.useQuery();
  const { data: taxProfile } = trpc.taxSettings.getProfile.useQuery();
  const { data: taxConfig } = trpc.taxSettings.getConfig.useQuery({ year: now.getFullYear() });
  const { data: taxSettings } = trpc.taxSettings.get.useQuery();

  const currentYearMonth = currentMonthStart.slice(0, 7);
  const thisMonthEntries = timeEntries.filter((entry) => getDateKey(entry.date).slice(0, 7) === currentYearMonth);
  const latestEntries = [...timeEntries]
    .sort((a, b) => getDateKey(b.date).localeCompare(getDateKey(a.date)))
    .slice(0, 5);

  // Calculate cost breakdown
  const getCostBreakdown = () => {
    const breakdown = calculateDashboardCostBreakdown({
      timeEntries,
      expenses,
      fixedCosts: fixedCosts ?? [],
      startDate: rangeStart,
      endDate: rangeEnd,
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

    return breakdown.items;
  };

  // Calculate project comparison
  const getProjectComparison = () => {
    const projectRevenue: Record<string, number> = {};
    
    timeEntries.forEach(entry => {
      if (!projectRevenue[entry.projectName]) {
        projectRevenue[entry.projectName] = 0;
      }
      projectRevenue[entry.projectName] += entry.calculatedAmount;
    });
    
    return Object.entries(projectRevenue)
      .map(([name, value]) => ({
        projekt: name.length > 15 ? name.substring(0, 15) + '...' : name,
        umsatz: Math.round(value / 100),
      }))
      .sort((a, b) => b.umsatz - a.umsatz)
      .slice(0, 5);
  };

  const monthlyData = calculateMonthlyRevenueSeries({
    timeEntries,
    referenceDate: now,
    monthsBack: selectedMonths,
  });
  const costData = getCostBreakdown();
  const projectData = getProjectComparison();

  const stats = [
    {
      title: "Kunden",
      value: customers?.length ?? 0,
      icon: Users,
      description: "Aktive Kunden",
      color: "text-indigo-600",
    },
    {
      title: "Zeiteinträge",
      value: thisMonthEntries.length,
      icon: Calendar,
      description: "Diesen Monat",
      color: "text-emerald-600",
    },
    {
      title: "Reisekosten",
      value: `€${Math.round((expenses.reduce((sum, exp) => sum + exp.amount, 0) ?? 0) / 100).toLocaleString('de-DE')}`,
      icon: Euro,
      description: `Im Zeitraum (${selectedPeriodLabel})`,
      color: "text-purple-600",
    },
    {
      title: "Berichte",
      value: "0",
      icon: FileText,
      description: "Ausstehend",
      color: "text-rose-600",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Willkommen bei Döring Consulting - Projekt & Abrechnungsmanagement
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Aktuelle Projekte</CardTitle>
              <CardDescription>Übersicht Ihrer laufenden Projekte</CardDescription>
            </CardHeader>
            <CardContent>
              {customersLoading ? (
                <p className="text-muted-foreground">Lädt...</p>
              ) : customers && customers.length > 0 ? (
                <div className="space-y-2">
                  {customers.slice(0, 5).map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <p className="font-medium">{customer.projectName}</p>
                        <p className="text-sm text-muted-foreground">{customer.provider}</p>
                      </div>
                      <span className="text-sm font-medium">
                        {customer.costModel === "exclusive" ? "Exclusive" : "Inclusive"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Keine Kunden vorhanden</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Letzte Zeiteinträge</CardTitle>
              <CardDescription>Ihre neuesten Zeiterfassungen</CardDescription>
            </CardHeader>
            <CardContent>
              {timeEntriesLoading ? (
                <p className="text-muted-foreground">Lädt...</p>
              ) : latestEntries.length > 0 ? (
                <div className="space-y-2">
                  {latestEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <p className="font-medium">{entry.projectName}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(`${getDateKey(entry.date)}T00:00:00`).toLocaleDateString("de-DE")}
                        </p>
                      </div>
                      <span className="text-sm font-medium">
                        {Math.floor(entry.hours / 60)}:{String(entry.hours % 60).padStart(2, "0")}h
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Keine Zeiteinträge vorhanden</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground">Zeitraum:</span>
          {([3, 6, 12] as const).map((months) => (
            <Button
              key={months}
              variant={selectedMonths === months ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMonths(months)}
            >
              {months}M
            </Button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <CardTitle>Umsatzentwicklung</CardTitle>
              </div>
              <CardDescription>Monatlicher Umsatz ({selectedPeriodLabel})</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => `€${value}`} />
                  <Legend />
                  <Line type="monotone" dataKey="umsatz" stroke="#10b981" strokeWidth={2} name="Umsatz (€)" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-indigo-600" />
                <CardTitle>Kostenverteilung</CardTitle>
              </div>
              <CardDescription>Kostenaufschlüsselung ({selectedPeriodLabel})</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={costData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: €${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {costData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `€${value}`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Projekt-Vergleich</CardTitle>
            <CardDescription>Top 5 Projekte nach Umsatz ({selectedPeriodLabel})</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={projectData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="projekt" />
                <YAxis />
                <Tooltip formatter={(value) => `€${value}`} />
                <Legend />
                <Bar dataKey="umsatz" fill="#3b82f6" name="Umsatz (€)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
