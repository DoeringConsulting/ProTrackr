import {
  calculatePolishTaxResult,
  type LegacyTaxSettings,
  type TaxConfigPl,
  type TaxProfilePl,
} from "./taxEnginePl";

type CustomerLike = {
  id: number;
  costModel?: string | null;
};

type TimeEntryLike = {
  id: number;
  customerId: number;
  calculatedAmount: number;
  date: string | Date;
};

type ExpenseLike = {
  amount: number;
  timeEntryId?: number | null;
  date?: string | Date;
};

type FixedCostLike = {
  amount: number;
};

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDateKey(value: string | Date): string {
  if (typeof value === "string") {
    return value.split("T")[0] ?? value;
  }
  return formatLocalDate(value);
}

function getYearMonthKey(value: string | Date): string {
  return getDateKey(value).slice(0, 7);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getPeriodMonthCount(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;

  const rawMonths =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1;

  return clamp(rawMonths, 1, 12);
}

function isWithinDateRange(value: string | Date, startDate: string, endDate: string) {
  const key = getDateKey(value);
  return key >= startDate && key <= endDate;
}

export type AccountingUiData = {
  timeRevenue: number;
  travelRevenueInGross: number;
  grossRevenue: number;
  totalFixedCosts: number;
  variableCosts: number;
  zus: number;
  healthInsurance: number;
  taxBase: number;
  tax: number;
  netProfit: number;
  deductibleHealth: number;
  calculationSource: "regime_config" | "legacy";
};

export type MonthlyRevenuePoint = {
  month: string;
  yearMonth: string;
  umsatz: number;
};

export function calculateMonthlyRevenueSeries(input: {
  timeEntries: TimeEntryLike[];
  referenceDate?: Date;
  monthsBack?: number;
}): MonthlyRevenuePoint[] {
  const referenceDate = input.referenceDate ?? new Date();
  const monthsBack = Math.max(1, input.monthsBack ?? 6);

  const monthStarts: Date[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    monthStarts.push(new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1));
  }

  const totalsByMonth = new Map<string, number>();
  for (const monthStart of monthStarts) {
    totalsByMonth.set(getYearMonthKey(monthStart), 0);
  }

  for (const entry of input.timeEntries) {
    const yearMonth = getYearMonthKey(entry.date);
    if (!totalsByMonth.has(yearMonth)) continue;
    totalsByMonth.set(yearMonth, (totalsByMonth.get(yearMonth) ?? 0) + entry.calculatedAmount);
  }

  return monthStarts.map((monthStart) => {
    const yearMonth = getYearMonthKey(monthStart);
    return {
      month: monthStart.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }),
      yearMonth,
      umsatz: Math.round((totalsByMonth.get(yearMonth) ?? 0) / 100),
    };
  });
}

export function calculateAccountingUiData(input: {
  customers: CustomerLike[];
  timeEntries: TimeEntryLike[];
  expenses: ExpenseLike[];
  fixedCosts: FixedCostLike[];
  startDate: string;
  endDate: string;
  taxProfile?: TaxProfilePl | null;
  taxConfig?: TaxConfigPl | null;
  legacySettings?: LegacyTaxSettings | null;
}): AccountingUiData {
  const timeRevenue = input.timeEntries.reduce((sum, entry) => sum + entry.calculatedAmount, 0);
  const totalExpenses = input.expenses.reduce((sum, expense) => sum + expense.amount, 0);

  // Only travel costs of "exclusive" customers are billable on top.
  const entriesById = new Map(input.timeEntries.map((entry) => [entry.id, entry]));
  const customersById = new Map(input.customers.map((customer) => [customer.id, customer]));
  const travelRevenueInGross = input.expenses.reduce((sum, expense) => {
    if (!expense.timeEntryId) return sum;
    const relatedEntry = entriesById.get(expense.timeEntryId);
    if (!relatedEntry) return sum;
    const relatedCustomer = customersById.get(relatedEntry.customerId);
    return relatedCustomer?.costModel === "exclusive" ? sum + expense.amount : sum;
  }, 0);

  const grossRevenue = timeRevenue + travelRevenueInGross;
  const totalFixedCosts = input.fixedCosts.reduce((sum, cost) => sum + cost.amount, 0);
  const variableCosts = totalExpenses;

  const taxResult = calculatePolishTaxResult({
    revenueCents: grossRevenue,
    fixedCostsCents: totalFixedCosts,
    variableCostsCents: variableCosts,
    startDate: input.startDate,
    endDate: input.endDate,
    profile: input.taxProfile ?? null,
    config: input.taxConfig ?? null,
    legacySettings: input.legacySettings ?? null,
  });

  return {
    timeRevenue,
    travelRevenueInGross,
    grossRevenue,
    totalFixedCosts,
    variableCosts,
    zus: taxResult.zus,
    healthInsurance: taxResult.healthInsurance,
    taxBase: taxResult.taxBase,
    tax: taxResult.tax,
    netProfit: taxResult.netProfit,
    deductibleHealth: taxResult.deductibleHealth,
    calculationSource: taxResult.source,
  };
}

type DashboardCostItem = {
  name: string;
  value: number;
  color: string;
};

export function calculateDashboardCostBreakdown(input: {
  timeEntries: TimeEntryLike[];
  expenses: ExpenseLike[];
  fixedCosts: FixedCostLike[];
  startDate: string;
  endDate: string;
  taxProfile?: TaxProfilePl | null;
  taxConfig?: TaxConfigPl | null;
  legacySettings?: LegacyTaxSettings | null;
}): { items: DashboardCostItem[]; periodRevenue: number } {
  const periodMonthCount = getPeriodMonthCount(input.startDate, input.endDate);
  const monthlyFixed = input.fixedCosts.reduce((sum, cost) => sum + cost.amount, 0);
  const totalFixed = monthlyFixed * periodMonthCount;

  const periodEntries = input.timeEntries.filter((entry) =>
    isWithinDateRange(entry.date, input.startDate, input.endDate)
  );
  const periodRevenue = periodEntries.reduce((sum, entry) => sum + entry.calculatedAmount, 0);

  const periodExpenses = input.expenses.filter((expense) => {
    if (!expense.date) return true;
    return isWithinDateRange(expense.date, input.startDate, input.endDate);
  });
  const variableCosts = periodExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const taxResult = calculatePolishTaxResult({
    revenueCents: periodRevenue,
    fixedCostsCents: totalFixed,
    variableCostsCents: variableCosts,
    startDate: input.startDate,
    endDate: input.endDate,
    profile: input.taxProfile ?? null,
    config: input.taxConfig ?? null,
    legacySettings: input.legacySettings ?? null,
  });

  return {
    periodRevenue,
    items: [
      { name: "Fixkosten", value: Math.round(totalFixed / 100), color: "#3b82f6" },
      { name: "Reisekosten", value: Math.round(variableCosts / 100), color: "#0ea5e9" },
      { name: "ZUS", value: Math.round(taxResult.zus / 100), color: "#8b5cf6" },
      { name: "Krankenvers.", value: Math.round(taxResult.healthInsurance / 100), color: "#ec4899" },
      { name: "Steuer", value: Math.round(taxResult.tax / 100), color: "#f59e0b" },
    ],
  };
}

