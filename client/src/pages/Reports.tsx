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
import { calculatePolishTaxResult } from "@/lib/taxEnginePl";
import {
  exportCustomerCostStatementToPDF,
  exportCustomerTimesheetToPDF,
  exportPolishBookkeepingReportToPDF,
  type ReportLanguage,
} from "@/lib/reportPdfExports";
import {
  SUPPORTED_CURRENCIES,
  aggregateByCurrency,
  buildLatestRateMap,
  convertAmountCents,
  formatMoney,
  type SupportedCurrency,
} from "@/lib/currencyUtils";

const EXPENSE_CATEGORY_LABELS: Record<
  string,
  { de: string; en: string; pl: string }
> = {
  car: { de: "Mietwagen", en: "Car", pl: "Auto" },
  train: { de: "ÖPNV", en: "Train", pl: "Pociag" },
  flight: { de: "Flug", en: "Flight", pl: "Lot" },
  taxi: { de: "Taxi", en: "Taxi", pl: "Taxi" },
  transport: { de: "Transport", en: "Transport", pl: "Transport" },
  hotel: { de: "Hotel", en: "Hotel", pl: "Hotel" },
  meal: { de: "Verpflegung", en: "Meal", pl: "Posilek" },
  food: { de: "Gastronomie", en: "Food", pl: "Gastronomia" },
  fuel: { de: "Kraftstoff", en: "Fuel", pl: "Paliwo" },
  other: { de: "Sonstiges", en: "Other", pl: "Inne" },
};

export default function Reports() {
  const toDateKey = (value: unknown): string | null => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const getTodayLocalDate = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const [startDate, setStartDate] = useState(() => {
    const now = new Date(getTodayLocalDate());
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const y = first.getFullYear();
    const m = String(first.getMonth() + 1).padStart(2, "0");
    const d = String(first.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date(getTodayLocalDate());
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const y = last.getFullYear();
    const m = String(last.getMonth() + 1).padStart(2, "0");
    const d = String(last.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [showUnifiedCurrency, setShowUnifiedCurrency] = useState(false);
  const [targetCurrency, setTargetCurrency] = useState<SupportedCurrency>("EUR");
  const [reportLanguage, setReportLanguage] = useState<ReportLanguage>("de");

  const { data: customers = [] } = trpc.customers.list.useQuery();
  const { data: timeEntries = [] } = trpc.timeEntries.list.useQuery({ startDate, endDate });
  const { data: expenses = [] } = trpc.expenses.list.useQuery({ startDate, endDate });
  const { data: fixedCosts = [] } = trpc.fixedCosts.list.useQuery();
  const { data: exchangeRates = [] } = trpc.exchangeRatesManagement.list.useQuery({});
  const { data: taxProfile } = trpc.taxSettings.getProfile.useQuery();
  const reportYear = new Date(`${startDate}T00:00:00`).getFullYear();
  const { data: taxConfig } = trpc.taxSettings.getConfig.useQuery({ year: reportYear });
  const { data: taxSettings } = trpc.taxSettings.get.useQuery();

  const historyRateMap = useMemo(() => buildLatestRateMap(exchangeRates as any[]), [exchangeRates]);
  const reportLastDate = useMemo(() => {
    const keys: string[] = [];
    for (const entry of timeEntries as any[]) {
      const key = toDateKey(entry?.date);
      if (key) keys.push(key);
    }
    for (const expense of expenses as any[]) {
      const key = toDateKey(expense?.checkOutDate || expense?.checkInDate || expense?.date);
      if (key) keys.push(key);
    }
    if (keys.length === 0) return endDate;
    keys.sort((a, b) => a.localeCompare(b, "de"));
    return keys[keys.length - 1] ?? endDate;
  }, [timeEntries, expenses, endDate]);
  const reportPairs = useMemo(() => {
    const currencies = new Set<string>(["EUR", "PLN", targetCurrency]);
    for (const customer of customers as any[]) {
      currencies.add(String(customer?.onsiteRateCurrency || "EUR").toUpperCase());
      currencies.add(String(customer?.remoteRateCurrency || "EUR").toUpperCase());
    }
    for (const expense of expenses as any[]) {
      currencies.add(String(expense?.currency || "EUR").toUpperCase());
    }
    for (const cost of fixedCosts as any[]) {
      currencies.add(String(cost?.currency || "EUR").toUpperCase());
    }
    return Array.from(currencies)
      .filter(code => code.length === 3 && code !== "PLN")
      .map(code => `${code}/PLN`)
      .sort((a, b) => a.localeCompare(b, "de"));
  }, [customers, expenses, fixedCosts, targetCurrency]);
  const reportRatesQuery = trpc.exchangeRatesManagement.resolveForReportDate.useQuery(
    {
      date: reportLastDate,
      pairs: reportPairs.length > 0 ? reportPairs : ["EUR/PLN"],
    },
    { enabled: Boolean(reportLastDate) }
  );
  const reportRateMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of reportRatesQuery.data ?? []) {
      if (typeof entry?.rate === "number" && Number.isFinite(entry.rate) && entry.rate > 0) {
        map.set(String(entry.pair).toUpperCase(), entry.rate);
      }
    }
    return map.size > 0 ? map : historyRateMap;
  }, [reportRatesQuery.data, historyRateMap]);
  const reportRateMetaByPair = useMemo(
    () =>
      new Map(
        (reportRatesQuery.data ?? []).map((entry: any) => [
          String(entry.pair).toUpperCase(),
          {
            pair: String(entry.pair).toUpperCase(),
            rate: typeof entry?.rate === "number" ? entry.rate : null,
            date: typeof entry?.date === "string" ? entry.date : null,
            source: String(entry?.source || "NBP"),
            fetchedFromArchive: Boolean(entry?.fetchedFromArchive),
          },
        ])
      ),
    [reportRatesQuery.data]
  );

  const convertToEur = (amountCents: number, sourceCurrency?: string | null) => {
    const source = (sourceCurrency || "EUR").toUpperCase();
    if (source === "EUR") return amountCents;
    return convertAmountCents(amountCents, source, "EUR", reportRateMap);
  };

  const convertToPln = (amountCents: number, sourceCurrency?: string | null) => {
    const source = (sourceCurrency || "EUR").toUpperCase();
    if (source === "PLN") return amountCents;
    return convertAmountCents(amountCents, source, "PLN", reportRateMap);
  };

  const formatCalculatedCurrency = (amountInEurCents: number) => {
    if (!showUnifiedCurrency) return formatMoney(amountInEurCents, "EUR");
    const converted = convertAmountCents(amountInEurCents, "EUR", targetCurrency, reportRateMap);
    if (converted === null) {
      return `Kurs fehlt (EUR → ${targetCurrency})`;
    }
    return formatMoney(converted, targetCurrency);
  };

  const formatCalculatedCurrencyNegative = (amountInEurCents: number) => {
    const formatted = formatCalculatedCurrency(amountInEurCents);
    return formatted.startsWith("Kurs fehlt") ? formatted : `-${formatted}`;
  };

  // Steuerwerte (PL-Regime) stammen aus PLN-Basiswerten.
  const formatPlnBasedCurrency = (amountInPlnCents: number) => {
    if (!showUnifiedCurrency) return formatMoney(amountInPlnCents, "PLN");
    const converted = convertAmountCents(amountInPlnCents, "PLN", targetCurrency, reportRateMap);
    if (converted === null) return `Kurs fehlt (PLN → ${targetCurrency})`;
    return formatMoney(converted, targetCurrency);
  };

  const formatPlnBasedCurrencyNegative = (amountInPlnCents: number) => {
    const formatted = formatPlnBasedCurrency(amountInPlnCents);
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

  const customersById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers]
  );

  const entriesById = useMemo(
    () => new Map(timeEntries.map((entry) => [entry.id, entry])),
    [timeEntries]
  );

  const timeEntriesDetailed = useMemo(
    () =>
      timeEntries.map((entry) => {
        const customer = customersById.get(entry.customerId);
        const sourceCurrency = (
          (entry.entryType === "onsite"
            ? customer?.onsiteRateCurrency
            : customer?.remoteRateCurrency) || "EUR"
        ).toUpperCase();
        const amountEur = convertToEur(entry.calculatedAmount, sourceCurrency);
        return {
          ...entry,
          sourceCurrency,
          amountEur,
        };
      }),
    [timeEntries, customersById, reportRateMap]
  );

  const expensesDetailedAll = useMemo(
    () =>
      expenses.map((expense) => {
        const sourceCurrency = (expense.currency || "EUR").toUpperCase();
        const amountEur = convertToEur(expense.amount, sourceCurrency);
        const amountPln =
          sourceCurrency === "PLN"
            ? expense.amount
            : convertAmountCents(expense.amount, sourceCurrency, "PLN", reportRateMap);
        const relatedEntry = expense.timeEntryId ? entriesById.get(expense.timeEntryId) : undefined;
        const relatedCustomer = relatedEntry ? customersById.get(relatedEntry.customerId) : undefined;
        return {
          ...expense,
          sourceCurrency,
          amountEur,
          amountPln,
          relatedEntry,
          relatedCustomer,
        };
      }),
    [expenses, reportRateMap, entriesById, customersById]
  );

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

    const expensesDetailed = expensesDetailedAll;

    const mappedTaxProfile = taxProfile
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
      : null;

    const mappedTaxConfig = taxConfig
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
      : null;

    let missingTaxPlnConversionCount = 0;
    const convertAmountToPlnForTax = (amountCents: number, sourceCurrency?: string | null) => {
      const converted = convertToPln(amountCents, sourceCurrency);
      if (converted === null) {
        missingTaxPlnConversionCount += 1;
        return 0;
      }
      return converted;
    };

    const timeRevenuePln = timeEntriesDetailed.reduce(
      (sum, entry) => sum + convertAmountToPlnForTax(entry.calculatedAmount, entry.sourceCurrency),
      0
    );
    const travelRevenueInGrossPln = expensesDetailed.reduce((sum, expense) => {
      if (!expense.timeEntryId) return sum;
      const relatedEntry = entriesById.get(expense.timeEntryId);
      if (!relatedEntry) return sum;
      const relatedCustomer = customersById.get(relatedEntry.customerId);
      if (relatedCustomer?.costModel !== "exclusive") return sum;
      return sum + convertAmountToPlnForTax(expense.amount, expense.sourceCurrency);
    }, 0);
    const grossRevenuePln = timeRevenuePln + travelRevenueInGrossPln;
    const totalFixedCostsPln = fixedCostsDetailed.reduce(
      (sum, cost) => sum + convertAmountToPlnForTax(cost.amount, cost.sourceCurrency),
      0
    );
    const variableCostsPln = expensesDetailed.reduce(
      (sum, expense) => sum + convertAmountToPlnForTax(expense.amount, expense.sourceCurrency),
      0
    );

    const taxResultPln = calculatePolishTaxResult({
      revenueCents: grossRevenuePln,
      fixedCostsCents: totalFixedCostsPln,
      variableCostsCents: variableCostsPln,
      startDate,
      endDate,
      profile: mappedTaxProfile,
      config: mappedTaxConfig,
      legacySettings: taxSettings,
    });

    const convertPlnResultToEur = (amountPlnCents: number) => {
      const converted = convertToEur(amountPlnCents, "PLN");
      if (converted === null) {
        missingTaxPlnConversionCount += 1;
        return 0;
      }
      return converted;
    };

    // Kompatibilitätsfelder in EUR für bestehende Exporte/Anzeige.
    const timeRevenue = convertPlnResultToEur(timeRevenuePln);
    const travelRevenueInGross = convertPlnResultToEur(travelRevenueInGrossPln);
    const grossRevenue = convertPlnResultToEur(grossRevenuePln);
    const totalFixedCosts = convertPlnResultToEur(totalFixedCostsPln);
    const variableCosts = convertPlnResultToEur(variableCostsPln);
    const zus = convertPlnResultToEur(taxResultPln.zus);
    const healthInsurance = convertPlnResultToEur(taxResultPln.healthInsurance);
    const deductibleHealth = convertPlnResultToEur(taxResultPln.deductibleHealth);
    const taxBase = convertPlnResultToEur(taxResultPln.taxBase);
    const tax = convertPlnResultToEur(taxResultPln.tax);
    const netProfit = convertPlnResultToEur(taxResultPln.netProfit);

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
      expensesDetailed.filter((expense) => expense.amountEur === null).length +
      missingTaxPlnConversionCount;

    return {
      calculationSource: taxResultPln.source,
      timeRevenue,
      travelRevenueInGross,
      grossRevenue,
      totalFixedCosts,
      variableCosts,
      zus,
      healthInsurance,
      deductibleHealth,
      taxBase,
      tax,
      netProfit,
      fixedCostsDetailed,
      expensesDetailed,
      fixedCostsByCurrency,
      variableCostsByCurrency,
      taxResultPln,
      missingConversionCount,
    };
  };

  // Calculate customer report data
  const calculateCustomerReport = () => {
    if (!selectedCustomerId) return null;

    const customerEntries = timeEntriesDetailed.filter((e) => e.customerId === selectedCustomerId);
    const customer = customers.find(c => c.id === selectedCustomerId);

    if (!customer) return null;

    const totalHours = customerEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const totalAmount = customerEntries.reduce((sum, entry) => sum + (entry.amountEur ?? 0), 0); // EUR
    const totalManDays = customerEntries.reduce((sum, entry) => sum + entry.manDays, 0);

    // Calculate expenses for this customer
    const customerExpenses = expensesDetailedAll.filter(expense => {
      // Find the time entry for this expense
      const timeEntry = timeEntries.find(te => te.id === expense.timeEntryId);
      return timeEntry && timeEntry.customerId === selectedCustomerId;
    });
    const customerExpensesDetailed = customerExpenses;

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

  const appliedExchangeRatesForUi = useMemo(() => {
    const pairs = new Set<string>();
    for (const entry of timeEntriesDetailed) {
      const source = String(entry.sourceCurrency || "EUR").toUpperCase();
      if (source !== "EUR") {
        pairs.add(`${source}/PLN`);
        pairs.add("EUR/PLN");
      }
    }
    for (const expense of expensesDetailedAll) {
      const source = String(expense.sourceCurrency || "EUR").toUpperCase();
      if (source !== "PLN") pairs.add(`${source}/PLN`);
      if (source !== "EUR") pairs.add("EUR/PLN");
    }
    return Array.from(pairs)
      .map(pair => {
        const meta = reportRateMetaByPair.get(pair);
        return {
          pair,
          rate: typeof meta?.rate === "number" ? meta.rate : reportRateMap.get(pair) ?? null,
          date: meta?.date ?? reportLastDate ?? null,
          source: meta?.source ?? "NBP",
          fetchedFromArchive: Boolean(meta?.fetchedFromArchive),
        };
      })
      .sort((a, b) => a.pair.localeCompare(b.pair, "de"));
  }, [timeEntriesDetailed, expensesDetailedAll, reportRateMap, reportRateMetaByPair, reportLastDate]);

  const handleExportPolishBookkeepingReport = async () => {
    const dateKeyOf = (value: string | Date) => {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.includes("T")) return trimmed.split("T")[0] || trimmed;
        if (trimmed.includes(" ")) return trimmed.split(" ")[0] || trimmed;
        return trimmed;
      }
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, "0");
      const d = String(value.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };

    const projectByDate = new Map<string, { projectName: string; provider: string }>();

    const bookkeepingEntries = timeEntriesDetailed.map((entry) => {
      const customer = customersById.get(entry.customerId);
      const dateKey = dateKeyOf(entry.date as any);
      const fallbackRecord = {
        projectName: entry.projectName || "-",
        provider: customer?.provider || "-",
      };
      if (!projectByDate.has(dateKey)) {
        projectByDate.set(dateKey, fallbackRecord);
      }
      if (entry.entryType === "onsite") {
        projectByDate.set(dateKey, fallbackRecord);
      }

      return {
        date: entry.date,
        weekday: entry.weekday,
        projectName: entry.projectName,
        provider: customer?.provider || "-",
        location: customer?.location || "-",
        entryType: entry.entryType,
        hours: entry.hours,
        manDays: entry.manDays,
        rate: entry.rate || 0,
        amount: entry.calculatedAmount,
        sourceCurrency: entry.sourceCurrency,
        amountEur: entry.amountEur ?? 0,
        comment: entry.description || "",
      };
    });

    const bookkeepingExpenses = expensesDetailedAll.map((expense) => {
      const dateKey = dateKeyOf(expense.date as any);
      const dateProject = projectByDate.get(dateKey);
      const endDate =
        expense.category === "hotel"
          ? expense.checkOutDate || expense.date
          : expense.category === "flight"
            ? expense.checkOutDate || expense.date
            : expense.date;
      return {
        date: expense.date,
        endDate,
        category: expense.category,
        amount: expense.amount,
        currency: expense.sourceCurrency,
        amountEur: expense.amountEur ?? null,
        amountPln: expense.amountPln ?? null,
        checkInDate: expense.checkInDate || null,
        checkOutDate: expense.checkOutDate || null,
        departureTime: expense.departureTime || null,
        arrivalTime: expense.arrivalTime || null,
        flightRouteType: expense.flightRouteType || null,
        comment: expense.comment || "",
        provider: expense.relatedCustomer?.provider || dateProject?.provider || "-",
        projectName: expense.relatedEntry?.projectName || dateProject?.projectName || "-",
      };
    });

    const revenueEur = timeEntriesDetailed.reduce((sum, entry) => sum + (entry.amountEur ?? 0), 0);
    const travelEur = expensesDetailedAll.reduce((sum, expense) => sum + (expense.amountEur ?? 0), 0);

    const appliedRatePairs = new Set<string>();
    for (const entry of timeEntriesDetailed) {
      const source = String(entry.sourceCurrency || "EUR").toUpperCase();
      if (source !== "EUR") {
        appliedRatePairs.add(`${source}/PLN`);
        appliedRatePairs.add("EUR/PLN");
      }
    }
    for (const expense of expensesDetailedAll) {
      const source = String(expense.sourceCurrency || "EUR").toUpperCase();
      if (source !== "PLN") {
        appliedRatePairs.add(`${source}/PLN`);
      }
      if (source !== "EUR") {
        appliedRatePairs.add("EUR/PLN");
      }
    }

    const appliedExchangeRates = Array.from(appliedRatePairs)
      .map((pair) => {
        const meta = reportRateMetaByPair.get(pair);
        return {
          pair,
          rate: typeof meta?.rate === "number" ? meta.rate : reportRateMap.get(pair) ?? null,
          date: meta?.date ?? reportLastDate ?? null,
          source: meta?.source ?? "NBP",
          fetchedFromArchive: Boolean(meta?.fetchedFromArchive),
        };
      })
      .sort((a, b) => a.pair.localeCompare(b.pair, "pl"));

    await exportPolishBookkeepingReportToPDF({
      startDate,
      endDate,
      advisorName: "Alexander Döring",
      entries: bookkeepingEntries,
      expenses: bookkeepingExpenses,
      summary: {
        totalHoursMinutes: timeEntries.reduce((sum, entry) => sum + entry.hours, 0),
        totalManDays: timeEntries.reduce((sum, entry) => sum + entry.manDays, 0),
        revenueEur,
        travelEur,
      },
      appliedExchangeRates,
    });
    toast.success("Polnischer Buchhaltungsbericht wurde erstellt");
  };

  const handleExportCustomerTimesheet = async () => {
    if (!customerData) return;
    await exportCustomerTimesheetToPDF({
      language: reportLanguage,
      startDate,
      endDate,
      customerName: customerData.customer.provider,
      projectName: customerData.customer.projectName,
      consultant: "Alexander Döring",
      entries: customerData.entries.map((entry) => ({
        date: entry.date,
        weekday: entry.weekday,
        entryType: entry.entryType,
        hours: entry.hours,
        manDays: entry.manDays,
        description: entry.description || "",
      })),
      totalHours: customerData.totalHours,
      totalManDays: customerData.totalManDays,
      appliedExchangeRates: appliedExchangeRatesForUi,
    });
    toast.success("Stundennachweis wurde erstellt");
  };

  const handleExportCustomerCostStatement = async () => {
    if (!customerData) return;
    const customerCurrency = (
      customerData.customer.onsiteRateCurrency ||
      customerData.customer.remoteRateCurrency ||
      "EUR"
    ).toUpperCase();

    const convertToCustomerCurrency = (amount: number, sourceCurrency: string) => {
      const source = sourceCurrency.toUpperCase();
      if (source === customerCurrency) return amount;
      return convertAmountCents(amount, source, customerCurrency, reportRateMap);
    };

    const rows = customerData.entries.map((entry) => {
      const entryExpenses = customerData.customerExpensesDetailed.filter(
        (expense) => expense.timeEntryId === entry.id
      );

      const convertedService =
        convertToCustomerCurrency(entry.calculatedAmount, entry.sourceCurrency) ?? 0;
      const convertedTravel = entryExpenses.reduce((sum, expense) => {
        const converted = convertToCustomerCurrency(expense.amount, expense.sourceCurrency);
        return converted === null ? sum : sum + converted;
      }, 0);

      return {
        date: entry.date,
        hours: entry.hours,
        manDays: entry.manDays,
        serviceAmount: convertedService,
        travelAmount: convertedTravel,
        travelCategories: entryExpenses
          .map((exp) => {
            const labels = EXPENSE_CATEGORY_LABELS[exp.category] || EXPENSE_CATEGORY_LABELS.other;
            const label =
              reportLanguage === "en" ? labels.en : reportLanguage === "pl" ? labels.pl : labels.de;
            return `${label} (${exp.sourceCurrency})`;
          })
          .filter(Boolean)
          .join(", "),
      };
    });

    const serviceTotal = rows.reduce((sum, row) => sum + row.serviceAmount, 0);
    const travelTotal = rows.reduce((sum, row) => sum + row.travelAmount, 0);

    await exportCustomerCostStatementToPDF({
      language: reportLanguage,
      startDate,
      endDate,
      customerName: customerData.customer.provider,
      projectName: customerData.customer.projectName,
      customerCurrency,
      rows: rows.map((row) => ({
        date: row.date,
        hours: row.hours,
        manDays: row.manDays,
        serviceAmount: row.serviceAmount,
        travelAmount: row.travelAmount,
        travelCategories: row.travelCategories,
      })),
      totals: {
        serviceAmount: serviceTotal,
        travelAmount: travelTotal,
        grandTotal: serviceTotal + travelTotal,
      },
      appliedExchangeRates: appliedExchangeRatesForUi,
    });
    toast.success("Kostenaufstellung wurde erstellt");
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
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <Select
                value={reportLanguage}
                onValueChange={(value) => setReportLanguage(value as ReportLanguage)}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="pl">Polski</SelectItem>
                </SelectContent>
              </Select>
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
                    <Button
                      variant="outline"
                      onClick={handleExportPolishBookkeepingReport}
                      disabled={reportRatesQuery.isLoading}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      PL Buchhaltung (PDF)
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        exportAccountingReportToPDF(
                          accountingData,
                          startDate,
                          endDate,
                          appliedExchangeRatesForUi
                        )
                      }
                      disabled={reportRatesQuery.isLoading}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      PDF Export
                    </Button>
                    <Button variant="outline" disabled={reportRatesQuery.isLoading} onClick={() => {
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
                        appliedExchangeRates: appliedExchangeRatesForUi,
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
                                reportRateMap
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
                        {formatPlnBasedCurrencyNegative(accountingData.taxResultPln.zus)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold">Krankenversicherung (Zdrowotna)</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {formatPlnBasedCurrencyNegative(accountingData.taxResultPln.healthInsurance)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8 text-muted-foreground">
                        Abzugsfähige Zdrowotna (Steuerbasis)
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatPlnBasedCurrency(accountingData.taxResultPln.deductibleHealth)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-medium">Steuerbasis</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPlnBasedCurrency(accountingData.taxResultPln.taxBase)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold">Einkommensteuer (PIT)</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {formatPlnBasedCurrencyNegative(accountingData.taxResultPln.tax)}
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
                      <TableCell className="text-right font-bold text-lg text-primary">
                        {formatPlnBasedCurrency(accountingData.taxResultPln.netProfit)}
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
                        <Button
                          variant="outline"
                          onClick={handleExportCustomerTimesheet}
                          disabled={reportRatesQuery.isLoading}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Stundennachweis (PDF)
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleExportCustomerCostStatement}
                          disabled={reportRatesQuery.isLoading}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Kostenaufstellung (PDF)
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            customerData &&
                            exportCustomerReportToPDF(
                              customerData,
                              startDate,
                              endDate,
                              appliedExchangeRatesForUi
                            )
                          }
                          disabled={reportRatesQuery.isLoading}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          PDF Export
                        </Button>
                        <Button variant="outline" disabled={reportRatesQuery.isLoading} onClick={() => {
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
                                amount: e.amountEur ?? 0,
                                expenses: 0,
                              })),
                              totalHours: customerData.totalHours,
                              totalAmount: customerData.totalAmount,
                              totalExpenses: customerData.totalExpenses,
                              billableExpenses: customerData.billableExpenses,
                              grandTotal: customerData.grandTotal,
                              appliedExchangeRates: appliedExchangeRatesForUi,
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
                            Arbeitsstunden (hh:mm): {formatHours(customerData.totalHours)}
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
                          <TableHead className="text-right">Stunden (hh:mm)</TableHead>
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
                                {formatCalculatedCurrency(entry.amountEur ?? 0)}
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
                <div className="mt-4 rounded border p-3 text-sm">
                  <p className="font-medium mb-2">Angewendete Wechselkurse</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Referenzdatum für Berichte: {new Date(reportLastDate).toLocaleDateString("de-DE")}
                    {reportRatesQuery.isLoading ? " (Kurse werden geladen...)" : ""}
                  </p>
                  {appliedExchangeRatesForUi.length === 0 ? (
                    <p className="text-muted-foreground">Keine Wechselkurse erforderlich (nur Basiswährung).</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-muted-foreground">
                      {appliedExchangeRatesForUi.map((entry) => (
                        <p key={entry.pair}>
                          {entry.pair}: {entry.rate === null ? "Kurs fehlt" : entry.rate.toFixed(6)} ·{" "}
                          {entry.date ? `Datum ${new Date(entry.date).toLocaleDateString("de-DE")}` : "Datum -"}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
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
