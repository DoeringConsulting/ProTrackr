import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  FileBarChart,
  PieChart as PieChartIcon,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { calculatePolishTaxResult } from "@/lib/taxEnginePl";
import {
  formatLocalDate,
  getDateKey,
} from "@/lib/uiCalculations";
import {
  SUPPORTED_CURRENCIES,
  aggregateByCurrency,
  buildLatestRateMap,
  convertAmountCents,
  formatMoney,
  type SupportedCurrency,
} from "@/lib/currencyUtils";

type CurrencyValueMap = Map<string, number>;

type RevenueChartState = {
  data: Array<Record<string, string | number>>;
  seriesKeys: string[];
  missingRates: number;
};

type ProjectChartState = {
  data: Array<Record<string, string | number>>;
  seriesKeys: string[];
  missingRates: number;
};

type CostSlice = {
  name: string;
  value: number; // major units for recharts
  color: string;
  chartCurrency: string;
  originalCurrency?: string;
  originalAmountCents?: number;
};

type CostChartState = {
  data: CostSlice[];
  missingRates: number;
};

const SERIES_COLORS = ["#048998", "#06a5b6", "#036d79", "#025a64", "#dbbe76", "#b98847", "#7a8f94"];
const CURRENCY_COLOR_MAP: Record<string, string> = {
  EUR: "#048998",
  PLN: "#06a5b6",
  USD: "#036d79",
  GBP: "#b98847",
  CHF: "#dbbe76",
};

function getSeriesColor(key: string, index: number): string {
  return CURRENCY_COLOR_MAP[key] ?? SERIES_COLORS[index % SERIES_COLORS.length];
}

function getPeriodMonthCount(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const rawMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
  return Math.min(Math.max(rawMonths, 1), 12);
}

function isWithinDateRange(value: string | Date | null | undefined, startDate: string, endDate: string): boolean {
  if (!value) return false;
  const dateKey = getDateKey(value);
  return dateKey >= startDate && dateKey <= endDate;
}

export default function Dashboard() {
  const [selectedMonths, setSelectedMonths] = useState<3 | 6 | 12>(6);
  const [showUnifiedCurrency, setShowUnifiedCurrency] = useState(false);
  const [targetCurrency, setTargetCurrency] = useState<SupportedCurrency>("EUR");

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
  const { data: exchangeRates = [] } = trpc.exchangeRatesManagement.list.useQuery({});
  const { data: taxProfile } = trpc.taxSettings.getProfile.useQuery();
  const { data: taxConfig } = trpc.taxSettings.getConfig.useQuery({ year: now.getFullYear() });
  const { data: taxSettings } = trpc.taxSettings.get.useQuery();

  const rateMap = useMemo(() => buildLatestRateMap(exchangeRates as any[]), [exchangeRates]);
  const customersById = useMemo(
    () => new Map((customers ?? []).map((customer) => [customer.id, customer])),
    [customers]
  );

  const timeEntriesDetailed = useMemo(
    () =>
      timeEntries.map((entry) => {
        const customer = customersById.get(entry.customerId);
        const sourceCurrency =
          (entry.entryType === "onsite"
            ? customer?.onsiteRateCurrency
            : customer?.remoteRateCurrency) || "EUR";
        return {
          ...entry,
          sourceCurrency: String(sourceCurrency).toUpperCase(),
        };
      }),
    [customersById, timeEntries]
  );

  const expensesDetailed = useMemo(
    () =>
      expenses.map((expense) => ({
        ...expense,
        sourceCurrency: String(expense.currency || "EUR").toUpperCase(),
      })),
    [expenses]
  );

  const fixedCostsDetailed = useMemo(
    () =>
      (fixedCosts ?? []).map((cost) => ({
        ...cost,
        sourceCurrency: String(cost.currency || "EUR").toUpperCase(),
      })),
    [fixedCosts]
  );

  const toEur = (amountCents: number, sourceCurrency: string) => {
    const source = String(sourceCurrency || "EUR").toUpperCase();
    if (source === "EUR") return amountCents;
    return convertAmountCents(amountCents, source, "EUR", rateMap);
  };

  const buildRevenueChart = (): RevenueChartState => {
    const monthStarts: Date[] = [];
    for (let i = selectedMonths - 1; i >= 0; i--) {
      monthStarts.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
    }

    if (showUnifiedCurrency) {
      const totalsByMonth = new Map<string, number>();
      let missingRates = 0;

      for (const monthStart of monthStarts) {
        totalsByMonth.set(getDateKey(monthStart).slice(0, 7), 0);
      }

      for (const entry of timeEntriesDetailed) {
        const yearMonth = getDateKey(entry.date).slice(0, 7);
        if (!totalsByMonth.has(yearMonth)) continue;
        const converted = convertAmountCents(
          entry.calculatedAmount,
          entry.sourceCurrency,
          targetCurrency,
          rateMap
        );
        if (converted === null) {
          missingRates += 1;
          continue;
        }
        totalsByMonth.set(yearMonth, (totalsByMonth.get(yearMonth) ?? 0) + converted);
      }

      return {
        data: monthStarts.map((monthStart) => {
          const yearMonth = getDateKey(monthStart).slice(0, 7);
          return {
            month: monthStart.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }),
            umsatz: (totalsByMonth.get(yearMonth) ?? 0) / 100,
          };
        }),
        seriesKeys: ["umsatz"],
        missingRates,
      };
    }

    const totalsByMonthCurrency = new Map<string, CurrencyValueMap>();
    const currencies = new Set<string>();

    for (const monthStart of monthStarts) {
      totalsByMonthCurrency.set(getDateKey(monthStart).slice(0, 7), new Map());
    }

    for (const entry of timeEntriesDetailed) {
      const yearMonth = getDateKey(entry.date).slice(0, 7);
      const monthMap = totalsByMonthCurrency.get(yearMonth);
      if (!monthMap) continue;
      monthMap.set(
        entry.sourceCurrency,
        (monthMap.get(entry.sourceCurrency) ?? 0) + entry.calculatedAmount
      );
      currencies.add(entry.sourceCurrency);
    }

    const seriesKeys = Array.from(currencies).sort();
    const data = monthStarts.map((monthStart) => {
      const yearMonth = getDateKey(monthStart).slice(0, 7);
      const monthMap = totalsByMonthCurrency.get(yearMonth) ?? new Map();
      const row: Record<string, string | number> = {
        month: monthStart.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }),
      };
      for (const currency of seriesKeys) {
        row[currency] = (monthMap.get(currency) ?? 0) / 100;
      }
      return row;
    });

    return { data, seriesKeys, missingRates: 0 };
  };

  const buildProjectChart = (): ProjectChartState => {
    type ProjectAggregate = {
      label: string;
      byCurrency: CurrencyValueMap;
      unifiedCents: number;
      rankingEurCents: number;
    };

    const projectMap = new Map<string, ProjectAggregate>();
    let missingRates = 0;

    for (const entry of timeEntriesDetailed) {
      const rawName = entry.projectName || "Unbekannt";
      const aggregate = projectMap.get(rawName) ?? {
        label: rawName.length > 15 ? `${rawName.slice(0, 15)}...` : rawName,
        byCurrency: new Map(),
        unifiedCents: 0,
        rankingEurCents: 0,
      };

      if (showUnifiedCurrency) {
        const converted = convertAmountCents(
          entry.calculatedAmount,
          entry.sourceCurrency,
          targetCurrency,
          rateMap
        );
        if (converted === null) {
          missingRates += 1;
        } else {
          aggregate.unifiedCents += converted;
        }
      } else {
        aggregate.byCurrency.set(
          entry.sourceCurrency,
          (aggregate.byCurrency.get(entry.sourceCurrency) ?? 0) + entry.calculatedAmount
        );
        const eur = toEur(entry.calculatedAmount, entry.sourceCurrency);
        if (eur === null) {
          missingRates += 1;
        } else {
          aggregate.rankingEurCents += eur;
        }
      }

      projectMap.set(rawName, aggregate);
    }

    if (showUnifiedCurrency) {
      const top = Array.from(projectMap.values())
        .sort((a, b) => b.unifiedCents - a.unifiedCents)
        .slice(0, 5)
        .map((project) => ({
          projekt: project.label,
          umsatz: project.unifiedCents / 100,
        }));

      return { data: top, seriesKeys: ["umsatz"], missingRates };
    }

    const sorted = Array.from(projectMap.values())
      .sort((a, b) => b.rankingEurCents - a.rankingEurCents)
      .slice(0, 5);

    const currencySet = new Set<string>();
    for (const project of sorted) {
      for (const currency of Array.from(project.byCurrency.keys())) {
        currencySet.add(currency);
      }
    }
    const seriesKeys = Array.from(currencySet).sort();

    const data = sorted.map((project) => {
      const row: Record<string, string | number> = {
        projekt: project.label,
      };
      for (const currency of seriesKeys) {
        row[currency] = (project.byCurrency.get(currency) ?? 0) / 100;
      }
      return row;
    });

    return { data, seriesKeys, missingRates };
  };

  const buildCostChart = (): CostChartState => {
    const periodMonthCount = getPeriodMonthCount(rangeStart, rangeEnd);
    const fixedByCurrencyOriginal = new Map<string, number>();
    const fixedByCurrencyEur = new Map<string, number>();
    const variableByCurrencyOriginal = new Map<string, number>();
    const variableByCurrencyEur = new Map<string, number>();

    let fixedCostsEur = 0;
    let variableCostsEur = 0;
    let revenueEur = 0;
    let missingRates = 0;

    for (const cost of fixedCostsDetailed) {
      const periodAmount = cost.amount * periodMonthCount;
      fixedByCurrencyOriginal.set(
        cost.sourceCurrency,
        (fixedByCurrencyOriginal.get(cost.sourceCurrency) ?? 0) + periodAmount
      );
      const amountEur = toEur(cost.amount, cost.sourceCurrency);
      if (amountEur === null) {
        missingRates += 1;
      } else {
        const periodAmountEur = amountEur * periodMonthCount;
        fixedByCurrencyEur.set(
          cost.sourceCurrency,
          (fixedByCurrencyEur.get(cost.sourceCurrency) ?? 0) + periodAmountEur
        );
        fixedCostsEur += amountEur * periodMonthCount;
      }
    }

    for (const expense of expensesDetailed) {
      if (!isWithinDateRange(expense.date, rangeStart, rangeEnd)) continue;
      variableByCurrencyOriginal.set(
        expense.sourceCurrency,
        (variableByCurrencyOriginal.get(expense.sourceCurrency) ?? 0) + expense.amount
      );
      const amountEur = toEur(expense.amount, expense.sourceCurrency);
      if (amountEur === null) {
        missingRates += 1;
      } else {
        variableByCurrencyEur.set(
          expense.sourceCurrency,
          (variableByCurrencyEur.get(expense.sourceCurrency) ?? 0) + amountEur
        );
        variableCostsEur += amountEur;
      }
    }

    for (const entry of timeEntriesDetailed) {
      if (!isWithinDateRange(entry.date, rangeStart, rangeEnd)) continue;
      const amountEur = toEur(entry.calculatedAmount, entry.sourceCurrency);
      if (amountEur === null) {
        missingRates += 1;
      } else {
        revenueEur += amountEur;
      }
    }

    const taxResult = calculatePolishTaxResult({
      revenueCents: revenueEur,
      fixedCostsCents: fixedCostsEur,
      variableCostsCents: variableCostsEur,
      startDate: rangeStart,
      endDate: rangeEnd,
      profile: taxProfile
        ? {
            taxCalculationMode: taxProfile.taxCalculationMode,
            taxForm: taxProfile.taxForm,
            zusRegime: taxProfile.zusRegime,
            choroboweEnabled: taxProfile.choroboweEnabled,
            fpFsEnabled: taxProfile.fpFsEnabled,
            wypadkowaRateBp: taxProfile.wypadkowaRateBp,
            zdrowotnaRateLiniowyBp: taxProfile.zdrowotnaRateLiniowyBp,
            pitRateBp: taxProfile.pitRateBp,
          }
        : null,
      config: taxConfig
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

    if (showUnifiedCurrency) {
      const convertEurToTarget = (amountCents: number) => {
        if (targetCurrency === "EUR") return amountCents;
        const converted = convertAmountCents(amountCents, "EUR", targetCurrency, rateMap);
        if (converted === null) {
          missingRates += 1;
          return 0;
        }
        return converted;
      };

      const unifiedData: CostSlice[] = [
        { name: "Fixkosten", value: convertEurToTarget(fixedCostsEur) / 100, color: "#048998", chartCurrency: targetCurrency },
        { name: "Reisekosten", value: convertEurToTarget(variableCostsEur) / 100, color: "#06a5b6", chartCurrency: targetCurrency },
        { name: "ZUS", value: convertEurToTarget(taxResult.zus) / 100, color: "#036d79", chartCurrency: targetCurrency },
        { name: "Krankenvers.", value: convertEurToTarget(taxResult.healthInsurance) / 100, color: "#dbbe76", chartCurrency: targetCurrency },
        { name: "Steuer", value: convertEurToTarget(taxResult.tax) / 100, color: "#b98847", chartCurrency: targetCurrency },
      ];

      return { data: unifiedData, missingRates };
    }

    const data: CostSlice[] = [];
    const sortedFixed = Array.from(fixedByCurrencyOriginal.entries()).sort((a, b) => b[1] - a[1]);
    const sortedVariable = Array.from(variableByCurrencyOriginal.entries()).sort((a, b) => b[1] - a[1]);

    sortedFixed.forEach(([currency, originalAmount], index) => {
      const amountInEur = fixedByCurrencyEur.get(currency) ?? 0;
      data.push({
        name: `Fixkosten (${currency})`,
        value: amountInEur / 100,
        color: index % 2 === 0 ? "#048998" : "#06a5b6",
        chartCurrency: "EUR",
        originalCurrency: currency,
        originalAmountCents: originalAmount,
      });
    });

    sortedVariable.forEach(([currency, originalAmount], index) => {
      const amountInEur = variableByCurrencyEur.get(currency) ?? 0;
      data.push({
        name: `Reisekosten (${currency})`,
        value: amountInEur / 100,
        color: index % 2 === 0 ? "#036d79" : "#7a8f94",
        chartCurrency: "EUR",
        originalCurrency: currency,
        originalAmountCents: originalAmount,
      });
    });

    data.push(
      { name: "ZUS (EUR)", value: taxResult.zus / 100, color: "#036d79", chartCurrency: "EUR" },
      {
        name: "Krankenvers. (EUR)",
        value: taxResult.healthInsurance / 100,
        color: "#dbbe76",
        chartCurrency: "EUR",
      },
      { name: "Steuer (EUR)", value: taxResult.tax / 100, color: "#b98847", chartCurrency: "EUR" }
    );

    return { data, missingRates };
  };

  const currentYearMonth = currentMonthStart.slice(0, 7);
  const thisMonthEntries = timeEntries.filter((entry) => getDateKey(entry.date).slice(0, 7) === currentYearMonth);
  const latestEntries = [...timeEntries]
    .sort((a, b) => getDateKey(b.date).localeCompare(getDateKey(a.date)))
    .slice(0, 5);

  const revenueChart = buildRevenueChart();
  const projectChart = buildProjectChart();
  const costChart = buildCostChart();
  const costChartVisibleData = costChart.data.filter((entry) => Number(entry.value ?? 0) > 0);
  const totalMissingRates =
    revenueChart.missingRates + projectChart.missingRates + costChart.missingRates;

  const formatCostSliceLabel = (entry: CostSlice) => {
    const baseCents = Math.round(Number(entry.value ?? 0) * 100);
    const chartCurrency = String(entry.chartCurrency || "EUR");
    const originalCurrency = String(entry.originalCurrency || chartCurrency);
    const originalCents =
      typeof entry.originalAmountCents === "number" ? entry.originalAmountCents : baseCents;

    if (!showUnifiedCurrency && originalCurrency !== chartCurrency) {
      return `${entry.name}: ${formatMoney(originalCents, originalCurrency)} (~${formatMoney(
        baseCents,
        chartCurrency
      )})`;
    }

    return `${entry.name}: ${formatMoney(originalCents, originalCurrency)}`;
  };

  const expenseByCurrency = aggregateByCurrency(
    expensesDetailed.map((expense) => ({
      amount: expense.amount,
      currency: expense.sourceCurrency,
    }))
  );

  const unifiedExpenseTotal = showUnifiedCurrency
    ? expensesDetailed.reduce((sum, expense) => {
        const converted = convertAmountCents(
          expense.amount,
          expense.sourceCurrency,
          targetCurrency,
          rateMap
        );
        return converted === null ? sum : sum + converted;
      }, 0)
    : null;

  const expenseStatValue = (() => {
    if (showUnifiedCurrency && unifiedExpenseTotal !== null) {
      return formatMoney(unifiedExpenseTotal, targetCurrency);
    }
    if (expenseByCurrency.size === 0) return "-";
    if (expenseByCurrency.size === 1) {
      const [currency, amount] = Array.from(expenseByCurrency.entries())[0];
      return formatMoney(amount, currency);
    }
    return `${expenseByCurrency.size} Währungen`;
  })();

  const stats = [
    {
      title: "Kunden",
      value: customers?.length ?? 0,
      icon: Users,
      description: "Aktive Kunden",
      color: "text-primary",
    },
    {
      title: "Zeiteinträge",
      value: thisMonthEntries.length,
      icon: CalendarDays,
      description: "Diesen Monat",
      color: "text-primary",
    },
    {
      title: "Reisekosten",
      value: expenseStatValue,
      icon: Receipt,
      description: showUnifiedCurrency
        ? `Im Zeitraum (${selectedPeriodLabel}) in ${targetCurrency}`
        : `Im Zeitraum (${selectedPeriodLabel})`,
      color: "text-primary",
    },
    {
      title: "Berichte",
      value: "0",
      icon: FileBarChart,
      description: "Ausstehend",
      color: "text-primary",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#025a64]">Dashboard</h1>
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
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                          customer.costModel === "exclusive"
                            ? "bg-[var(--badge-exclusive-bg)] text-[var(--badge-exclusive-text)]"
                            : "bg-[var(--badge-inclusive-bg)] text-[var(--badge-inclusive-text)]"
                        }`}
                      >
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
        <div className="flex flex-wrap items-center justify-end gap-2">
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
          <Button
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
                {SUPPORTED_CURRENCIES.map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {totalMissingRates > 0 && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="pt-6 text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <span>
                {totalMissingRates} Position(en) konnten wegen fehlender Wechselkurse nicht umgerechnet werden
                und wurden in den Diagrammen als 0 behandelt.
              </span>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle>Umsatzentwicklung</CardTitle>
              </div>
              <CardDescription>
                Monatlicher Umsatz ({selectedPeriodLabel}){" "}
                {showUnifiedCurrency ? `in ${targetCurrency}` : "in Originalwährungen"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueChart.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value, name) => {
                      const numeric = Number(value ?? 0);
                      const currency = showUnifiedCurrency ? targetCurrency : String(name);
                      return formatMoney(Math.round(numeric * 100), currency);
                    }}
                  />
                  <Legend />
                  {showUnifiedCurrency ? (
                    <Line
                      type="monotone"
                      dataKey="umsatz"
                      stroke="#048998"
                      strokeWidth={2}
                      name={targetCurrency}
                    />
                  ) : (
                    revenueChart.seriesKeys.map((currency, index) => (
                      <Line
                        key={currency}
                        type="monotone"
                        dataKey={currency}
                        stroke={getSeriesColor(currency, index)}
                        strokeWidth={2}
                        name={currency}
                      />
                    ))
                  )}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-primary" />
                <CardTitle>Kostenverteilung</CardTitle>
              </div>
              <CardDescription>
                Kostenaufschlüsselung ({selectedPeriodLabel}){" "}
                {showUnifiedCurrency
                  ? `in ${targetCurrency}`
                  : "Anteile nach EUR-Basis, Beschriftung in Originalwährungen"}{" "}
                (0-Werte ausgeblendet)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={costChartVisibleData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={false}
                    outerRadius={80}
                    fill="#048998"
                    dataKey="value"
                  >
                    {costChartVisibleData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, _name, item) => {
                      const numeric = Number(value ?? 0);
                      const payload = (item as any)?.payload ?? {};
                      const baseCents = Math.round(numeric * 100);
                      const chartCurrency = String(payload.chartCurrency || "EUR");
                      const originalCurrency = String(payload.originalCurrency || chartCurrency);
                      const originalCents =
                        typeof payload.originalAmountCents === "number"
                          ? payload.originalAmountCents
                          : baseCents;

                      if (!showUnifiedCurrency && originalCurrency !== chartCurrency) {
                        return `${formatMoney(originalCents, originalCurrency)} (Basis ${formatMoney(
                          baseCents,
                          chartCurrency
                        )})`;
                      }

                      return formatMoney(originalCents, originalCurrency);
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {costChartVisibleData.length > 0 ? (
                <div className="mt-3 grid gap-1 text-sm">
                  {costChartVisibleData.map((entry, index) => (
                    <div key={`${entry.name}-${index}`} className="flex items-start gap-2">
                      <span
                        className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-muted-foreground">{formatCostSliceLabel(entry)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Keine Kostenpositionen &gt; 0 im gewaehlten Zeitraum.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <CardTitle>Projekt-Vergleich</CardTitle>
            </div>
            <CardDescription>
              Top 5 Projekte nach Umsatz ({selectedPeriodLabel}){" "}
              {showUnifiedCurrency ? `in ${targetCurrency}` : "in Originalwährungen"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={projectChart.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="projekt" />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => {
                    const numeric = Number(value ?? 0);
                    const currency = showUnifiedCurrency ? targetCurrency : String(name);
                    return formatMoney(Math.round(numeric * 100), currency);
                  }}
                />
                <Legend />
                {showUnifiedCurrency ? (
                  <Bar dataKey="umsatz" fill="#048998" name={targetCurrency} />
                ) : (
                  projectChart.seriesKeys.map((currency, index) => (
                    <Bar
                      key={currency}
                      dataKey={currency}
                      stackId="umsatz"
                      fill={getSeriesColor(currency, index)}
                      name={currency}
                    />
                  ))
                )}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
