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
import { aggregateMonthlyTaxResults, getPeriodMonthCount } from "@/lib/taxEnginePl";
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
import {
  calculateProvisionCents,
  provisionConfigFromCustomer,
} from "@/lib/provision";
import { getExpenseBillingCustomerId as attributeExpenseToCustomer } from "@/lib/expenseAttribution";
import { computeMonthlyAmounts } from "@/lib/monthlyFinancials";
import { buildCustomerReportRows } from "@/lib/customerReportRows";
import { capRateStichtagKey, warsawDateKey } from "@shared/dateStichtag";

const EXPENSE_CATEGORY_LABELS: Record<
  string,
  { de: string; en: string; pl: string }
> = {
  car: { de: "Mietwagen", en: "Rental car", pl: "Auto" },
  train: { de: "Zug/Fernverkehr", en: "Long-distance rail", pl: "Pociag dalekobiezny" },
  flight: { de: "Flug", en: "Flight", pl: "Lot" },
  taxi: { de: "Taxi", en: "Taxi", pl: "Taxi" },
  transport: { de: "ÖPNV", en: "Local transit", pl: "Transport lokalny" },
  mileage_allowance: { de: "Kilometerpauschale", en: "Mileage allowance", pl: "Ryczalt kilometrowy" },
  hotel: { de: "Hotel", en: "Hotel", pl: "Hotel" },
  meal: { de: "Verpflegung", en: "Meal", pl: "Posilek" },
  food: { de: "Lebensmittel", en: "Groceries", pl: "Artykuly spozywcze" },
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

  // ── Stichtag-Berechnung für den Wechselkurs (Variante C) ──────────────
  //
  // Stichtag = jüngstes effectiveEndDate aller Einträge im Bericht, wobei:
  //   - timeEntry.date                        zählt als Ende
  //   - expense.date (ohne checkOutDate)      zählt als Ende
  //   - expense.checkOutDate (mit checkOut)   zählt als Ende
  //
  // Einträge mit Ende AUSSERHALB des Bericht-Zeitraums werden ignoriert
  // (z.B. Hotel-Check-out im Folgemonat → das Hotel zählt nicht für den
  // Stichtag des aktuellen Berichts).
  //
  // Wenn überhaupt keine Einträge im Zeitraum sind → Stichtag bleibt null;
  // der Bericht zeigt dann "kein Kurs" (kein NBP-Call).
  const reportStichtag = useMemo<string | null>(() => {
    const rangeStart = toDateKey(startDate);
    const rangeEnd = toDateKey(endDate);
    if (!rangeStart || !rangeEnd) return null;

    const inRange = (key: string | null | undefined) =>
      key !== null && key !== undefined && key >= rangeStart && key <= rangeEnd;

    let maxKey: string | null = null;
    const consider = (key: string | null | undefined) => {
      if (!inRange(key)) return;
      if (maxKey === null || (key as string) > maxKey) maxKey = key as string;
    };

    for (const te of timeEntries as any[]) {
      consider(toDateKey(te?.date));
    }
    for (const exp of expenses as any[]) {
      // Bei Hotels gibt es checkInDate + checkOutDate. effectiveEnd = checkOutDate
      // falls vorhanden, sonst expense.date. Wenn effectiveEnd außerhalb des
      // Berichts liegt (z.B. checkOut im Folgemonat), wird der Eintrag durch
      // inRange() schlicht verworfen.
      const effectiveEnd =
        toDateKey(exp?.checkOutDate) ?? toDateKey(exp?.date) ?? toDateKey(exp?.checkInDate);
      consider(effectiveEnd);
    }

    const youngest = maxKey;
    if (youngest === null) return null;
    // Kurs-Stichtag auf den letzten Werktag vor heute cappen (Polish-VAT §9):
    // Kurse haben keine Zukunft. Liegt das jüngste Leistungs-/Kostendatum in der
    // Zukunft (laufender Monat / vorab erfasste Termine), liefe der NBP-Call sonst
    // auf ein Zukunftsdatum → 404-Kaskade → stale Notfall-Kurs (task_bba37780 K1).
    // "Heute" verbindlich in Europe/Warsaw (Projekt-Zeitzone, CLAUDE.md §4) —
    // identisch zum Server, statt browser-lokal (robust auch bei abweichender
    // Browser-Zeitzone).
    const todayKey = warsawDateKey();
    return capRateStichtagKey(youngest, todayKey);
  }, [timeEntries, expenses, startDate, endDate]);
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
  // Wenn der Bericht keine Einträge enthält, fragen wir den Server gar nicht
  // erst — kein Stichtag, kein Kurs. Sonst geht der Stichtag mit auf den Wire.
  const reportRatesQuery = trpc.exchangeRatesManagement.resolveForReportDate.useQuery(
    {
      date: reportStichtag ?? "",
      pairs: reportPairs.length > 0 ? reportPairs : ["EUR/PLN"],
    },
    { enabled: Boolean(reportStichtag) }
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
            queriedAt: typeof entry?.queriedAt === "string" ? entry.queriedAt : null,
            source: String(entry?.source || "NBP"),
            isManual: Boolean(entry?.isManual),
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

  // ── Fehler #2 (Sobrietas exclusive): abrechnungsrelevanter Kunde eines Belegs ──
  // Zentrale Zuordnungslogik (Cutover 01.07.2026 + Option-B-Override: explizite
  // customerId gewinnt datumsunabhängig) liegt in lib/expenseAttribution und
  // wird mit ProjectDetail geteilt.

  // Datums-Key → Kunden-IDs mit einem Time-Entry an diesem Tag (für den
  // datumsbasierten Fallback, analog zur Reisekosten-Analyse-Seite).
  const customerIdsByDate = useMemo(() => {
    const map = new Map<string, Set<number>>();
    for (const entry of timeEntries) {
      const key = toDateKey(entry.date);
      if (!key) continue;
      if (!map.has(key)) map.set(key, new Set<number>());
      map.get(key)!.add(Number(entry.customerId));
    }
    return map;
  }, [timeEntries]);

  // Ermittelt den abrechnungsrelevanten Kunden eines Belegs (customerId oder
  // null) — delegiert an das geteilte Util, damit Reports und ProjectDetail
  // exakt dieselbe Zuordnung verwenden.
  const getExpenseBillingCustomerId = (expense: any): number | null =>
    attributeExpenseToCustomer(expense, { entriesById, customerIdsByDate });

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
    // Abrechenbare Reisekosten (exclusive-Kunde) zählen als Umsatz, nicht als
    // (Anzeige-)Kosten — sonst Doppelzählung (task_bba37780 Fehler A).
    const isBillableExclusiveTravel = (expense: any): boolean => {
      const billingCustomerId = getExpenseBillingCustomerId(expense);
      if (billingCustomerId == null) return false;
      const relatedCustomer = customersById.get(billingCustomerId);
      return relatedCustomer?.costModel === "exclusive";
    };
    const travelRevenueInGrossPln = expensesDetailed.reduce((sum, expense) => {
      if (!isBillableExclusiveTravel(expense)) return sum;
      return sum + convertAmountToPlnForTax(expense.amount, expense.sourceCurrency);
    }, 0);
    const grossRevenuePln = timeRevenuePln + travelRevenueInGrossPln;

    // ── Provision an Vermittler ────────────────────────────────────────
    // Pro Time-Entry abgeleitete Größe (nicht persistiert), aggregiert in
    // PLN (für Steuer) und in Original-Währung (für die Anzeige aufgeschlüsselt
    // pro Währung wie Fixkosten / Variable Kosten).
    let provisionTotalPln = 0;
    const provisionByCurrencyMap = new Map<string, number>();
    for (const entry of timeEntriesDetailed) {
      const customer = customersById.get(entry.customerId);
      if (!customer) continue;
      const cfg = provisionConfigFromCustomer(customer as any);
      if (!cfg.enabled) continue;
      const provisionCents = calculateProvisionCents(cfg, {
        entryType: (entry.entryType ?? "onsite") as "onsite" | "remote",
        hoursMinutes: Number(entry.hours ?? 0),
        manDays: Number(entry.manDays ?? 0) / 1000, // DB stores thousandths
        rate: Number(entry.rate ?? 0),
      });
      if (provisionCents <= 0) continue;
      const provCurrency = String(customer.onsiteRateCurrency || "EUR").toUpperCase();
      provisionByCurrencyMap.set(
        provCurrency,
        (provisionByCurrencyMap.get(provCurrency) ?? 0) + provisionCents
      );
      provisionTotalPln += convertAmountToPlnForTax(provisionCents, provCurrency);
    }
    const provisionByCurrency = provisionByCurrencyMap;
    const periodMonthCount = getPeriodMonthCount(startDate, endDate);
    const monthlyFixedCostsPln = fixedCostsDetailed.reduce(
      (sum, cost) => sum + convertAmountToPlnForTax(cost.amount, cost.sourceCurrency),
      0
    );
    const totalFixedCostsPln = monthlyFixedCostsPln * periodMonthCount;
    const variableCostsPln = expensesDetailed.reduce((sum, expense) => {
      if (isBillableExclusiveTravel(expense)) return sum;
      return sum + convertAmountToPlnForTax(expense.amount, expense.sourceCurrency);
    }, 0);

    const taxResultPln = aggregateMonthlyTaxResults({
      startDate,
      endDate,
      // Monats-Beträge kommen jetzt aus der geteilten Wahrheitsquelle
      // (lib/monthlyFinancials), die das Dashboard identisch nutzt — verhindert die
      // Divergenz-Bug-Klasse. Einschluss-Regeln unverändert: Zeit + exkl. RK als
      // Umsatz; ALLE RK + Provision als variable Kosten; Fixkosten je Monat.
      getMonthlyAmounts: (monthStart, monthEnd) =>
        computeMonthlyAmounts(monthStart, monthEnd, {
          timeEntries: timeEntriesDetailed,
          expenses: expensesDetailed,
          customersById,
          attributionMaps: { entriesById, customerIdsByDate },
          monthlyFixedCostsCents: monthlyFixedCostsPln,
          toPln: convertAmountToPlnForTax,
        }),
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
    //
    // timeRevenue / travelRevenueInGross / grossRevenue werden direkt aus den bereits
    // zu EUR konvertierten Entry-Werten (.amountEur) summiert. Anzeige- und
    // PLN-Steuerpfad nutzen denselben Report-Stichtagskurs (reportRateMap) und stimmen
    // daher überein — sofern der Stichtag einen gültigen Kurs liefert (siehe Komplex 1:
    // Wechselkurs-Stichtag bei Zukunfts-Leistungsdatum). Ein früher vermuteter
    // RK-Single-Rundungs-Fix entfällt bewusst: die 0,66-EUR-Divergenz war ein Symptom
    // des Stichtag-Bugs (zwei verschiedene Fallback-Kurse), keine Doppel-Rundung.
    const timeRevenue = timeEntriesDetailed.reduce(
      (sum, entry) => sum + (entry.amountEur ?? 0),
      0
    );
    const travelRevenueInGross = expensesDetailed.reduce((sum, expense) => {
      if (!isBillableExclusiveTravel(expense)) return sum;
      return sum + (expense.amountEur ?? 0);
    }, 0);
    const grossRevenue = timeRevenue + travelRevenueInGross;
    const totalFixedCosts = convertPlnResultToEur(totalFixedCostsPln);
    const variableCosts = convertPlnResultToEur(variableCostsPln);
    const provisionTotal = convertPlnResultToEur(provisionTotalPln);
    const zus = convertPlnResultToEur(taxResultPln.zus);
    const healthInsurance = convertPlnResultToEur(taxResultPln.healthInsurance);
    const deductibleHealth = convertPlnResultToEur(taxResultPln.deductibleHealth);
    const taxBase = convertPlnResultToEur(taxResultPln.taxBase);
    const tax = convertPlnResultToEur(taxResultPln.tax);
    const netProfit = convertPlnResultToEur(taxResultPln.netProfit);

    const fixedCostsByCurrency = aggregateByCurrency(
      fixedCostsDetailed.map((cost) => ({
        amount: cost.amount * periodMonthCount,
        currency: cost.sourceCurrency,
      }))
    );
    const variableCostsByCurrency = aggregateByCurrency(
      expensesDetailed
        .filter((expense) => !isBillableExclusiveTravel(expense))
        .map((expense) => ({ amount: expense.amount, currency: expense.sourceCurrency }))
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
      provisionTotal,
      provisionByCurrency,
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

    // Chronologisch aufsteigend sortieren, damit ALLE Kundenbericht-Ansichten
    // dieselbe Reihenfolge haben: die rows-basierten Pfade (UI-Detailtabelle,
    // Kostenaufstellung-PDF, Excel) sortiert der Row-Builder ohnehin aufsteigend;
    // die entries-basierten Pfade (Kundenbericht-PDF, Stundennachweis) müssen dazu
    // passen, sonst driftet Screen (ASC) gegen PDF (DESC) auseinander.
    const customerEntries = timeEntriesDetailed
      .filter((e) => e.customerId === selectedCustomerId)
      .sort((a, b) => {
        const ka = toDateKey(a.date) ?? "";
        const kb = toDateKey(b.date) ?? "";
        return ka < kb ? -1 : ka > kb ? 1 : 0;
      });
    const customer = customers.find(c => c.id === selectedCustomerId);

    if (!customer) return null;

    // Customer-facing amounts: in deduction-mode entry.amountEur is already
    // the customer-brutto value; in surcharge-mode we need to add the per-day
    // provision so the customer sees the rate they actually pay (without the
    // provision being separately labelled — that's the whole point of the
    // surcharge mode).
    const provisionCfg = provisionConfigFromCustomer(customer as any);
    const customerVisibleAmountEur = (entry: any): number => {
      const stored = entry.amountEur ?? 0;
      if (!provisionCfg.enabled || provisionCfg.mode === "deduction") return stored;
      // surcharge: add provision per day, converted to EUR using same rate map
      const provisionCents = calculateProvisionCents(provisionCfg, {
        entryType: (entry.entryType ?? "onsite") as "onsite" | "remote",
        hoursMinutes: Number(entry.hours ?? 0),
        manDays: Number(entry.manDays ?? 0),
        rate: Number(entry.rate ?? 0),
      });
      const provisionEur = convertToEur(provisionCents, customer.onsiteRateCurrency || "EUR") ?? 0;
      return stored + provisionEur;
    };

    const totalHours = customerEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const totalAmount = customerEntries.reduce((sum, entry) => sum + customerVisibleAmountEur(entry), 0);
    const totalManDays = customerEntries.reduce((sum, entry) => sum + entry.manDays, 0);

    // Calculate expenses for this customer
    const customerExpenses = expensesDetailedAll.filter(expense => {
      return getExpenseBillingCustomerId(expense) === selectedCustomerId;
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
      rows: buildCustomerReportRows(customerEntries, customerExpensesDetailed),
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
          date: meta?.date ?? null,
          queriedAt: meta?.queriedAt ?? null,
          source: meta?.source ?? "NBP",
          isManual: Boolean(meta?.isManual),
        };
      })
      .sort((a, b) => a.pair.localeCompare(b.pair, "de"));
  }, [timeEntriesDetailed, expensesDetailedAll, reportRateMap, reportRateMetaByPair]);

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
          date: meta?.date ?? null,
          queriedAt: meta?.queriedAt ?? null,
          source: meta?.source ?? "NBP",
          isManual: Boolean(meta?.isManual),
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
        provisionEur: accountingData.provisionTotal,
      },
      appliedExchangeRates,
    });
    toast.success("Polnischer Buchhaltungsbericht wurde erstellt");
  };

  const handleExportCustomerTimesheet = async () => {
    if (!customerData) return;
    const onsiteEntries = customerData.entries.filter((e) => e.entryType === "onsite");
    const remoteEntries = customerData.entries.filter((e) => e.entryType === "remote");

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
      onsiteHours: onsiteEntries.reduce((sum, e) => sum + e.hours, 0),
      onsiteManDays: onsiteEntries.reduce((sum, e) => sum + e.manDays, 0),
      remoteHours: remoteEntries.reduce((sum, e) => sum + e.hours, 0),
      remoteManDays: remoteEntries.reduce((sum, e) => sum + e.manDays, 0),
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

    // Original-Belegbetrag je Reisekostenbeleg in Original-Währung ausweisen
    // (Kundenwunsch): Zahl sprachgerecht, Währung als Code (eindeutig bei B2B-
    // Multi-Currency). Der konvertierte Gesamtbetrag bleibt in der Spalte
    // „Reisekosten" (Kundenwährung).
    const originalAmountFmt = new Intl.NumberFormat(
      reportLanguage === "en" ? "en-GB" : reportLanguage === "pl" ? "pl-PL" : "de-DE",
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    );

    // Kanonisches Zeilenmodell (bereits chronologisch sortiert, jeder Beleg genau
    // einer Zeile zugeordnet) → kein separates Anhängen von Orphan-Zeilen mehr.
    const allRows = customerData.rows.map((row) => {
      const entry = row.entry;
      const convertedService =
        entry ? (convertToCustomerCurrency(entry.calculatedAmount, entry.sourceCurrency) ?? 0) : null;
      const convertedTravel = row.expenses.reduce((sum, expense) => {
        const converted = convertToCustomerCurrency(expense.amount, expense.sourceCurrency);
        return converted === null ? sum : sum + converted;
      }, 0);
      const travelCategories = row.expenses
        .map((exp) => {
          const labels = EXPENSE_CATEGORY_LABELS[exp.category] || EXPENSE_CATEGORY_LABELS.other;
          const label =
            reportLanguage === "en" ? labels.en : reportLanguage === "pl" ? labels.pl : labels.de;
          return `${label} ${originalAmountFmt.format((exp.amount ?? 0) / 100)} ${exp.sourceCurrency}`;
        })
        .filter(Boolean)
        .join(", ");
      return {
        date: row.date,
        hours: entry ? entry.hours : null,
        manDays: entry ? entry.manDays : null,
        serviceAmount: convertedService,
        travelAmount: convertedTravel,
        travelCategories,
      };
    });

    const serviceTotal = allRows.reduce((sum, row) => sum + (row.serviceAmount ?? 0), 0);
    const travelTotal = allRows.reduce((sum, row) => sum + row.travelAmount, 0);

    await exportCustomerCostStatementToPDF({
      language: reportLanguage,
      startDate,
      endDate,
      customerName: customerData.customer.provider,
      projectName: customerData.customer.projectName,
      customerCurrency,
      rows: allRows.map((row) => ({
        date: row.date as string | Date,
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
                        provisionTotal: accountingData.provisionTotal,
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
                                    // Zentrale Attribution nutzen (Option B: explizite customerId gewinnt,
                                    // auch ohne timeEntryId) — sonst fehlen Direktzuordnungs-Belege in dieser
                                    // Detailzeile, obwohl sie in der Gesamtsumme (travelRevenueInGross) stecken.
                                    const billingCustomerId = getExpenseBillingCustomerId(expense);
                                    if (billingCustomerId == null) return false;
                                    const relatedCustomer = customers.find(
                                      (customer) => customer.id === billingCustomerId
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
                    {accountingData.provisionTotal > 0 && (
                      <TableRow className="border-t-2">
                        <TableCell className="font-semibold">Provision (Vermittler)</TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          {showUnifiedCurrency
                            ? formatCalculatedCurrencyNegative(accountingData.provisionTotal)
                            : renderCurrencyBadges(accountingData.provisionByCurrency)}
                        </TableCell>
                      </TableRow>
                    )}
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
                              appliedExchangeRatesForUi,
                              reportLanguage
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
                              entries: customerData.rows.map((row) => ({
                                date: new Date(row.date as any).toLocaleDateString("de-DE"),
                                hours: row.entry ? row.entry.hours : null,      // Minuten; null bei reinen RK-Tagen
                                rate: row.entry ? (row.entry.rate || 0) : 0,
                                amount: row.entry ? (row.entry.amountEur ?? 0) : null, // Leistung EUR
                                expenses: row.expenses.reduce((s, e) => s + (e.amountEur ?? 0), 0), // Reisekosten EUR
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
                        {customerData.rows.map((row) => {
                          const entryExpenseTotalEur = row.expenses.reduce(
                            (sum, expense) => sum + (expense.amountEur ?? 0),
                            0
                          );
                          const entryExpenseByCurrency = aggregateByCurrency(
                            row.expenses.map((expense) => ({
                              amount: expense.amount,
                              currency: expense.sourceCurrency,
                            }))
                          );
                          const rowKey = row.entry ? `entry-${row.entry.id}` : `rk-${row.dateKey}`;
                          return (
                            <TableRow key={rowKey}>
                              <TableCell>{new Date(row.date as any).toLocaleDateString("de-DE")}</TableCell>
                              <TableCell>{row.entry?.weekday ?? ""}</TableCell>
                              <TableCell className="capitalize">{row.entry?.entryType ?? ""}</TableCell>
                              <TableCell className="text-right">
                                {row.entry ? formatHours(row.entry.hours) : ""}
                              </TableCell>
                              <TableCell className="text-right">
                                {row.entry ? formatManDays(row.entry.manDays) : ""}
                              </TableCell>
                              <TableCell className="text-right">
                                {row.entry ? formatCalculatedCurrency(row.entry.amountEur ?? 0) : ""}
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
                    {reportStichtag
                      ? `Kurs-Stichtag (jüngstes Leistungs-/Kostendatum, max. letzter Werktag vor heute): ${new Date(`${reportStichtag}T00:00:00`).toLocaleDateString("de-DE")}`
                      : "Kein Stichtag — Bericht enthält keine Einträge"}
                    {reportRatesQuery.isLoading ? " · Kurse werden geladen…" : ""}
                  </p>
                  {appliedExchangeRatesForUi.length === 0 ? (
                    <p className="text-muted-foreground">Keine Wechselkurse erforderlich (nur Basiswährung).</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-1 text-muted-foreground">
                      {appliedExchangeRatesForUi.map((entry) => {
                        const nbpDate = entry.date
                          ? new Date(`${entry.date}T00:00:00`).toLocaleDateString("de-DE")
                          : "—";
                        const queriedAt = entry.queriedAt
                          ? new Date(entry.queriedAt).toLocaleString("de-DE", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : null;
                        const sourceLabel = entry.isManual ? "Manueller Kurs" : "NBP-Datum";
                        return (
                          <p key={entry.pair}>
                            <span className="font-medium text-foreground">{entry.pair}:</span>{" "}
                            {entry.rate === null ? "Kurs fehlt" : entry.rate.toFixed(6)}
                            {" · "}
                            {sourceLabel} {nbpDate}
                            {queriedAt ? ` · abgefragt ${queriedAt}` : ""}
                          </p>
                        );
                      })}
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
