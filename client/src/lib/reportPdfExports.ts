import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney as formatMoneyRaw } from "@/lib/currencyUtils";

export type ReportLanguage = "de" | "en" | "pl";

type BookkeepingEntry = {
  date: string | Date;
  weekday?: string | null;
  projectName: string;
  provider: string;
  location?: string | null;
  entryType: string;
  hours: number;
  manDays: number;
  rate: number;
  amount: number;
  sourceCurrency?: string;
  amountEur?: number | null;
  comment?: string | null;
};

type BookkeepingExpense = {
  date: string | Date;
  endDate?: string | Date | null;
  category: string;
  amount: number;
  currency: string;
  amountEur: number | null;
  amountPln: number | null;
  checkInDate?: string | Date | null;
  checkOutDate?: string | Date | null;
  departureTime?: string | null;
  arrivalTime?: string | null;
  flightRouteType?: string | null;
  comment?: string | null;
  provider?: string | null;
  projectName?: string | null;
};

type BookkeepingSummary = {
  totalHoursMinutes: number;
  totalManDays: number;
  revenueEur: number;
  travelEur: number;
};

type AppliedExchangeRate = {
  pair: string;
  rate: number | null;
  date?: string | null;
  source?: string | null;
  fetchedFromArchive?: boolean;
};

/**
 * Sanitize text for jsPDF default (WinAnsiEncoding) fonts.
 *
 * WinAnsiEncoding covers ASCII 0x20-0x7E plus selected chars in 0x80-0xFF
 * (German umlauts, accented Latin chars, etc.).  Characters outside that set
 * — Polish diacritics, non-breaking spaces, smart quotes, em/en dashes,
 * ellipsis, etc. — cause jsPDF to fall back to UCS-2 encoding which renders
 * every character separated by "&".
 *
 * This function transliterates or strips all problematic codepoints so the
 * default Helvetica font can handle the entire string.
 */
function sanitizeForPdf(value: string): string {
  return (
    value
      // Polish diacritics → ASCII equivalents (upper & lower)
      .replace(/[Ąą]/g, (c) => (c === "Ą" ? "A" : "a"))
      .replace(/[Ćć]/g, (c) => (c === "Ć" ? "C" : "c"))
      .replace(/[Ęę]/g, (c) => (c === "Ę" ? "E" : "e"))
      .replace(/[Łł]/g, (c) => (c === "Ł" ? "L" : "l"))
      .replace(/[Ńń]/g, (c) => (c === "Ń" ? "N" : "n"))
      .replace(/[Óó]/g, (c) => (c === "Ó" ? "O" : "o"))
      .replace(/[Śś]/g, (c) => (c === "Ś" ? "S" : "s"))
      .replace(/[Źź]/g, (c) => (c === "Ź" ? "Z" : "z"))
      .replace(/[Żż]/g, (c) => (c === "Ż" ? "Z" : "z"))
      // Non-breaking & special Unicode spaces → regular space
      .replace(/[\u00A0\u2002\u2003\u2007\u2009\u200A\u202F\u205F]/g, " ")
      // Smart quotes → straight quotes
      .replace(/[\u2018\u2019\u201A]/g, "'")
      .replace(/[\u201C\u201D\u201E]/g, '"')
      // Dashes
      .replace(/\u2013/g, "-") // en dash
      .replace(/\u2014/g, "--") // em dash
      // Ellipsis
      .replace(/\u2026/g, "...")
      // Strip any remaining non-WinAnsi characters (codepoints > 0xFF that
      // were not already handled above).
      .replace(/[^\x00-\xFF]/g, "")
  );
}

/** PDF-safe formatMoney: sanitizes output for jsPDF default fonts. */
function formatMoney(cents: number, currencyInput: string): string {
  return sanitizeForPdf(formatMoneyRaw(cents, currencyInput));
}

function formatDateDe(value: string | Date) {
  return new Date(value).toLocaleDateString("de-DE");
}

function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function formatDecimalHours(minutes: number) {
  return (minutes / 60).toFixed(5);
}

function formatManDays(value: number) {
  return (value / 1000).toFixed(3);
}

function formatRateDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("de-DE");
}

function getPolishWeekday(weekdayValue: string | null | undefined) {
  if (!weekdayValue) return "-";
  const value = String(weekdayValue).trim();
  if (!value) return "-";
  const parts = value.split("/");
  if (parts.length > 1) return toPlainAscii((parts[1] || "-").trim());
  return toPlainAscii(value);
}

function toPlainAscii(value: string) {
  return value
    .replace(/[Ąą]/g, "A")
    .replace(/[Ćć]/g, "C")
    .replace(/[Ęę]/g, "E")
    .replace(/[Łł]/g, "L")
    .replace(/[Ńń]/g, "N")
    .replace(/[Óó]/g, "O")
    .replace(/[Śś]/g, "S")
    .replace(/[Źź]/g, "Z")
    .replace(/[Żż]/g, "Z");
}

function getWeekdayByLanguage(
  weekdayValue: string | null | undefined,
  language: ReportLanguage
) {
  if (!weekdayValue) return "-";
  const value = String(weekdayValue).trim();
  if (!value) return "-";
  const [dePartRaw, plPartRaw] = value.split("/");
  const dePart = (dePartRaw || "").trim();
  const plPart = toPlainAscii((plPartRaw || "").trim());

  if (language === "pl") return plPart || toPlainAscii(value);
  if (language === "de") return dePart || value;

  const mapDeToEn: Record<string, string> = {
    Mo: "Mon",
    Di: "Tue",
    Mi: "Wed",
    Do: "Thu",
    Fr: "Fri",
    Sa: "Sat",
    So: "Sun",
  };
  return mapDeToEn[dePart] || dePart || plPart || value;
}

function getExpenseDetailLabel(expense: BookkeepingExpense) {
  if (expense.category === "hotel") {
    const checkIn = expense.checkInDate ? formatDateDe(expense.checkInDate) : "-";
    const checkOut = expense.checkOutDate ? formatDateDe(expense.checkOutDate) : "-";
    return `Zameldowanie: ${checkIn} | Wymeldowanie: ${checkOut}`;
  }
  if (expense.category === "flight") {
    const route = expense.flightRouteType === "international" ? "Miedzynarodowy" : "Krajowy";
    const departure = expense.departureTime || "-";
    const arrival = expense.arrivalTime || "-";
    return `Typ lotu: ${route} | Wylot: ${departure} | Przylot: ${arrival}`;
  }
  return "-";
}

function getExpenseCategoryPl(category: string) {
  const map: Record<string, string> = {
    hotel: "Hotel",
    flight: "Lot",
    taxi: "Taxi",
    train: "Pociag dalekobiezny",
    car: "Samochod",
    transport: "Transport lokalny (MZK)",
    mileage_allowance: "Ryczalt kilometrowy",
    fuel: "Paliwo",
    meal: "Posilek",
    food: "Produkty spozywcze",
    other: "Inne",
  };
  return map[category] || category;
}

function getEntryTypePl(entryType: string) {
  const map: Record<string, string> = {
    onsite: "Stacjonarnie",
    remote: "Zdalnie",
    off_duty: "Wolne",
    business_trip: "Podroz sluzbowa",
  };
  return map[entryType] || entryType;
}

function getEntryTypeByLanguage(entryType: string, language: ReportLanguage) {
  const map: Record<string, Record<ReportLanguage, string>> = {
    onsite: { de: "Vor Ort", en: "Onsite", pl: "Stacjonarnie" },
    remote: { de: "Remote", en: "Remote", pl: "Zdalnie" },
    off_duty: { de: "Abwesend", en: "Off duty", pl: "Wolne" },
    business_trip: { de: "Dienstreise", en: "Business trip", pl: "Podroz sluzbowa" },
  };
  return map[entryType]?.[language] || entryType;
}

async function savePdfWithFallback(doc: jsPDF, filename: string) {
  try {
    const { saveFileToLocal } = await import("@/lib/fileSystem");
    const pdfBlob = doc.output("blob");
    const now = new Date();
    await saveFileToLocal(filename, pdfBlob, now.getFullYear(), now.getMonth() + 1, "Raporty");
  } catch {
    doc.save(filename);
  }
}

export async function exportPolishBookkeepingReportToPDF(input: {
  startDate: string;
  endDate: string;
  advisorName: string;
  entries: BookkeepingEntry[];
  expenses: BookkeepingExpense[];
  summary: BookkeepingSummary;
  appliedExchangeRates?: AppliedExchangeRate[];
}) {
  const doc = new jsPDF("l", "mm", "a4");
  doc.setFontSize(16);
  doc.text("Zestawienie ksiegowe (PL)", 14, 14);
  doc.setFontSize(10);
  doc.text(
    sanitizeForPdf(`Okres: ${new Date(input.startDate).toLocaleDateString("pl-PL")} - ${new Date(
      input.endDate
    ).toLocaleDateString("pl-PL")} | Doradca: ${input.advisorName}`),
    14,
    20
  );

  const sortedExpenses = [...input.expenses].sort((left, right) => {
    const leftCategory = getExpenseCategoryPl(left.category || "").toLowerCase();
    const rightCategory = getExpenseCategoryPl(right.category || "").toLowerCase();
    const categoryCmp = leftCategory.localeCompare(rightCategory, "pl");
    if (categoryCmp !== 0) return categoryCmp;
    const leftTs = new Date(left.date).getTime();
    const rightTs = new Date(right.date).getTime();
    return rightTs - leftTs;
  });

  autoTable(doc, {
    startY: 25,
    head: [[
      "Data",
      "Dzien",
      "Projekt",
      "Klient",
      "Lokalizacja",
      "Typ",
      "Godziny",
      "MD",
      "Stawka",
      "Wartosc",
    ]],
    body: input.entries.map((entry) => [
      formatDateDe(entry.date),
      getPolishWeekday(entry.weekday),
      sanitizeForPdf(entry.projectName || "-"),
      sanitizeForPdf(entry.provider || "-"),
      sanitizeForPdf(entry.location || "-"),
      getEntryTypePl(entry.entryType || "-"),
      formatHours(entry.hours),
      formatManDays(entry.manDays),
      formatMoney(entry.rate, entry.sourceCurrency || "EUR"),
      formatMoney(entry.amount, entry.sourceCurrency || "EUR"),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [4, 137, 152] },
  });

  const detailStartY = (doc as any).lastAutoTable.finalY + 6;
  autoTable(doc, {
    startY: detailStartY,
    head: [[
      "Data poczatkowa",
      "Data koncowa",
      "Kategoria",
      "Projekt/Klient",
      "Szczegoly",
      "Kwota oryginalna",
      "Kwota EUR",
      "Kwota PLN",
      "Komentarz",
    ]],
    body: sortedExpenses.map((exp) => [
      formatDateDe(exp.date),
      exp.endDate ? formatDateDe(exp.endDate) : formatDateDe(exp.date),
      sanitizeForPdf(getExpenseCategoryPl(exp.category)),
      sanitizeForPdf(`${exp.projectName || "-"} / ${exp.provider || "-"}`),
      sanitizeForPdf(getExpenseDetailLabel(exp)),
      formatMoney(exp.amount, exp.currency),
      exp.amountEur === null ? "Brak kursu" : formatMoney(exp.amountEur, "EUR"),
      exp.amountPln === null ? "Brak kursu" : formatMoney(exp.amountPln, "PLN"),
      sanitizeForPdf(String(exp.comment || "-")),
    ]),
    styles: { fontSize: 8, overflow: "linebreak" },
    headStyles: { fillColor: [185, 136, 71] },
    tableWidth: doc.internal.pageSize.getWidth() - 28,
    margin: { left: 14 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 22 },
      2: { cellWidth: 25 },
      3: { cellWidth: 35 },
      4: { cellWidth: 40 },
      5: { cellWidth: 25 },
      6: { cellWidth: 25 },
      7: { cellWidth: 25 },
      8: { cellWidth: 50 },
    },
  });

  // Calculate onsite/remote breakdown from entries
  const onsiteEntries = input.entries.filter((e) => e.entryType === "onsite");
  const remoteEntries = input.entries.filter((e) => e.entryType === "remote");
  const onsiteHours = onsiteEntries.reduce((sum, e) => sum + e.hours, 0);
  const onsiteManDays = onsiteEntries.reduce((sum, e) => sum + e.manDays, 0);
  const remoteHours = remoteEntries.reduce((sum, e) => sum + e.hours, 0);
  const remoteManDays = remoteEntries.reduce((sum, e) => sum + e.manDays, 0);

  const sumStartY = (doc as any).lastAutoTable.finalY + 6;
  autoTable(doc, {
    startY: sumStartY,
    head: [["Podsumowanie", "Wartosc"]],
    body: [
      ["Godziny stacjonarnie (hh:mm)", formatHours(onsiteHours)],
      ["Godziny stacjonarnie (dziesietne)", formatDecimalHours(onsiteHours)],
      ["Man-days stacjonarnie", formatManDays(onsiteManDays)],
      ["Godziny zdalnie (hh:mm)", formatHours(remoteHours)],
      ["Godziny zdalnie (dziesietne)", formatDecimalHours(remoteHours)],
      ["Man-days zdalnie", formatManDays(remoteManDays)],
      ["", ""],
      ["Suma godzin (hh:mm)", formatHours(input.summary.totalHoursMinutes)],
      ["Suma godzin (dziesietne)", formatDecimalHours(input.summary.totalHoursMinutes)],
      ["Suma man-days", formatManDays(input.summary.totalManDays)],
      ["Przychod (EUR)", formatMoney(input.summary.revenueEur, "EUR")],
      ["Koszty podrozy (EUR)", formatMoney(input.summary.travelEur, "EUR")],
      [
        "Wynik (Przychod - Koszty podrozy) (EUR)",
        formatMoney(input.summary.revenueEur - input.summary.travelEur, "EUR"),
      ],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [3, 109, 121] },
  });

  const ratesStartY = (doc as any).lastAutoTable.finalY + 6;
  const normalizedRates = (input.appliedExchangeRates ?? [])
    .map((item) => ({
      pair: String(item.pair || "").toUpperCase(),
      rate: typeof item.rate === "number" && Number.isFinite(item.rate) ? item.rate : null,
    }))
    .filter((item) => item.pair.length > 0)
    .sort((a, b) => a.pair.localeCompare(b.pair, "pl"));

  autoTable(doc, {
    startY: ratesStartY,
    head: [["Zastosowane kursy walut", "Kurs", "Data kursu", "Zrodlo"]],
    body:
      normalizedRates.length > 0
        ? normalizedRates.map((item) => {
            const original = (input.appliedExchangeRates ?? []).find(
              (entry) => String(entry.pair || "").toUpperCase() === item.pair
            );
            return [
              item.pair,
              item.rate === null ? "Brak kursu" : item.rate.toFixed(6),
              formatRateDate(original?.date ?? null),
              String(original?.source || "NBP"),
            ];
          })
        : [["-", "Brak kursow (wszystkie pozycje w walucie bazowej)", "-", "-"]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [2, 90, 100] },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Strona ${i} / ${pageCount}`, doc.internal.pageSize.getWidth() - 16, 205, {
      align: "right",
    });
  }

  await savePdfWithFallback(
    doc,
    `Raport_ksiegowy_PL_${input.startDate}_${input.endDate}.pdf`
  );
}

export async function exportCustomerTimesheetToPDF(input: {
  language: ReportLanguage;
  startDate: string;
  endDate: string;
  customerName: string;
  projectName: string;
  consultant: string;
  entries: Array<{
    date: string | Date;
    weekday?: string | null;
    entryType: string;
    hours: number;
    manDays: number;
    description?: string | null;
  }>;
  totalHours: number;
  totalManDays: number;
  onsiteHours: number;
  onsiteManDays: number;
  remoteHours: number;
  remoteManDays: number;
  appliedExchangeRates?: AppliedExchangeRate[];
}) {
  const t = {
    de: {
      title: "Stundennachweis",
      client: "Kunde",
      project: "Projekt",
      period: "Zeitraum",
      consultant: "Berater",
      date: "Datum",
      weekday: "Wochentag",
      type: "Typ",
      hours: "Stunden",
      md: "Manntage",
      desc: "Tätigkeit",
      total: "Gesamt",
      onsite: "Vor Ort",
      remote: "Remote",
      hoursDecimal: "Stunden (dezimal)",
      page: "Seite",
      exchangeRates: "Angewendete Wechselkurse",
      rate: "Kurs",
      rateDate: "Kursdatum",
      rateSource: "Quelle",
      noRate: "k.A.",
    },
    en: {
      title: "Timesheet",
      client: "Client",
      project: "Project",
      period: "Period",
      consultant: "Consultant",
      date: "Date",
      weekday: "Weekday",
      type: "Type",
      hours: "Hours",
      md: "Man-days",
      desc: "Activity",
      total: "Total",
      onsite: "Onsite",
      remote: "Remote",
      hoursDecimal: "Hours (decimal)",
      page: "Page",
      exchangeRates: "Applied exchange rates",
      rate: "Rate",
      rateDate: "Rate date",
      rateSource: "Source",
      noRate: "n/a",
    },
    pl: {
      title: "Ewidencja godzin",
      client: "Klient",
      project: "Projekt",
      period: "Okres",
      consultant: "Doradca",
      date: "Data",
      weekday: "Dzien",
      type: "Typ",
      hours: "Godziny",
      md: "Man-days",
      desc: "Zakres pracy",
      total: "Suma",
      onsite: "Stacjonarnie",
      remote: "Zdalnie",
      hoursDecimal: "Godziny (dziesietne)",
      page: "Strona",
      exchangeRates: "Zastosowane kursy walut",
      rate: "Kurs",
      rateDate: "Data kursu",
      rateSource: "Zrodlo",
      noRate: "Brak kursu",
    },
  }[input.language];

  const doc = new jsPDF("p", "mm", "a4");
  doc.setFontSize(17);
  doc.text(t.title, 14, 16);
  doc.setFontSize(10);
  doc.text(sanitizeForPdf(`${t.client}: ${input.customerName}`), 14, 22);
  doc.text(sanitizeForPdf(`${t.project}: ${input.projectName}`), 14, 27);
  doc.text(
    sanitizeForPdf(`${t.period}: ${new Date(input.startDate).toLocaleDateString("de-DE")} - ${new Date(
      input.endDate
    ).toLocaleDateString("de-DE")} | ${t.consultant}: ${input.consultant}`),
    14,
    32
  );

  autoTable(doc, {
    startY: 38,
    head: [[t.date, t.weekday, t.type, t.hours, t.md, t.desc]],
    body: input.entries.map((entry) => [
      formatDateDe(entry.date),
      getWeekdayByLanguage(entry.weekday, input.language),
      getEntryTypeByLanguage(entry.entryType, input.language),
      formatHours(entry.hours),
      formatManDays(entry.manDays),
      sanitizeForPdf(entry.description || "-"),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [4, 137, 152] },
    columnStyles: {
      5: { cellWidth: 76 },
    },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 4,
    head: [[t.total, ""]],
    body: [
      [`${t.hours} ${t.onsite} (hh:mm)`, formatHours(input.onsiteHours)],
      [`${t.hoursDecimal} ${t.onsite}`, formatDecimalHours(input.onsiteHours)],
      [`${t.md} ${t.onsite}`, formatManDays(input.onsiteManDays)],
      [`${t.hours} ${t.remote} (hh:mm)`, formatHours(input.remoteHours)],
      [`${t.hoursDecimal} ${t.remote}`, formatDecimalHours(input.remoteHours)],
      [`${t.md} ${t.remote}`, formatManDays(input.remoteManDays)],
      ["", ""],
      [`${t.hours} (hh:mm)`, formatHours(input.totalHours)],
      [`${t.hoursDecimal}`, formatDecimalHours(input.totalHours)],
      [t.md, formatManDays(input.totalManDays)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [185, 136, 71] },
  });

  const normalizedRates = (input.appliedExchangeRates ?? [])
    .map((item) => ({
      pair: String(item.pair || "").toUpperCase(),
      rate: typeof item.rate === "number" && Number.isFinite(item.rate) ? item.rate : null,
      date: item.date ?? null,
      source: item.source ?? "NBP",
    }))
    .filter((item) => item.pair.length > 0)
    .sort((a, b) => a.pair.localeCompare(b.pair, "de"));

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 4,
    head: [[t.exchangeRates, t.rate, t.rateDate, t.rateSource]],
    body:
      normalizedRates.length > 0
        ? normalizedRates.map((item) => [
            item.pair,
            item.rate === null ? t.noRate : item.rate.toFixed(6),
            formatRateDate(item.date),
            String(item.source || "NBP"),
          ])
        : [["-", t.noRate, "-", "-"]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [2, 90, 100] },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `${t.page} ${i}/${pageCount}`,
      doc.internal.pageSize.getWidth() - 16,
      288,
      { align: "right" }
    );
  }

  await savePdfWithFallback(
    doc,
    `Timesheet_${input.customerName}_${input.startDate}_${input.endDate}_${input.language}.pdf`
  );
}

export async function exportCustomerCostStatementToPDF(input: {
  language: ReportLanguage;
  startDate: string;
  endDate: string;
  customerName: string;
  projectName: string;
  customerCurrency: string;
  rows: Array<{
    date: string | Date;
    hours: number;
    manDays: number;
    serviceAmount: number;
    travelAmount: number;
    travelCategories: string;
  }>;
  totals: {
    serviceAmount: number;
    travelAmount: number;
    grandTotal: number;
  };
  appliedExchangeRates?: AppliedExchangeRate[];
}) {
  const t = {
    de: {
      title: "Kostenaufstellung",
      client: "Kunde",
      project: "Projekt",
      period: "Zeitraum",
      date: "Datum",
      hours: "Stunden",
      md: "Manntage",
      service: "Leistung",
      travel: "Reisekosten",
      travelTypes: "Reisearten",
      total: "Gesamt",
      page: "Seite",
      exchangeRates: "Angewendete Wechselkurse",
      rate: "Kurs",
      rateDate: "Kursdatum",
      rateSource: "Quelle",
      noRate: "k.A.",
    },
    en: {
      title: "Cost Statement",
      client: "Client",
      project: "Project",
      period: "Period",
      date: "Date",
      hours: "Hours",
      md: "Man-days",
      service: "Service",
      travel: "Travel Costs",
      travelTypes: "Travel Types",
      total: "Total",
      page: "Page",
      exchangeRates: "Applied exchange rates",
      rate: "Rate",
      rateDate: "Rate date",
      rateSource: "Source",
      noRate: "n/a",
    },
    pl: {
      title: "Zestawienie kosztow",
      client: "Klient",
      project: "Projekt",
      period: "Okres",
      date: "Data",
      hours: "Godziny",
      md: "Man-days",
      service: "Usluga",
      travel: "Koszty podrozy",
      travelTypes: "Rodzaje kosztow",
      total: "Suma",
      page: "Strona",
      exchangeRates: "Zastosowane kursy walut",
      rate: "Kurs",
      rateDate: "Data kursu",
      rateSource: "Zrodlo",
      noRate: "Brak kursu",
    },
  }[input.language];

  const doc = new jsPDF("p", "mm", "a4");
  doc.setFontSize(17);
  doc.text(sanitizeForPdf(`${t.title} (${input.customerCurrency})`), 14, 16);
  doc.setFontSize(10);
  doc.text(sanitizeForPdf(`${t.client}: ${input.customerName}`), 14, 22);
  doc.text(sanitizeForPdf(`${t.project}: ${input.projectName}`), 14, 27);
  doc.text(
    sanitizeForPdf(`${t.period}: ${new Date(input.startDate).toLocaleDateString("de-DE")} - ${new Date(
      input.endDate
    ).toLocaleDateString("de-DE")}`),
    14,
    32
  );

  autoTable(doc, {
    startY: 38,
    head: [[t.date, t.hours, t.md, t.service, t.travel, t.travelTypes]],
    body: input.rows.map((row) => [
      formatDateDe(row.date),
      formatHours(row.hours),
      formatManDays(row.manDays),
      formatMoney(row.serviceAmount, input.customerCurrency),
      formatMoney(row.travelAmount, input.customerCurrency),
      sanitizeForPdf(row.travelCategories || "-"),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [3, 109, 121] },
    columnStyles: {
      5: { cellWidth: 60 },
    },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 4,
    head: [[t.total, ""]],
    body: [
      [t.service, formatMoney(input.totals.serviceAmount, input.customerCurrency)],
      [t.travel, formatMoney(input.totals.travelAmount, input.customerCurrency)],
      [t.total, formatMoney(input.totals.grandTotal, input.customerCurrency)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [185, 136, 71] },
  });

  const normalizedRates = (input.appliedExchangeRates ?? [])
    .map((item) => ({
      pair: String(item.pair || "").toUpperCase(),
      rate: typeof item.rate === "number" && Number.isFinite(item.rate) ? item.rate : null,
      date: item.date ?? null,
      source: item.source ?? "NBP",
    }))
    .filter((item) => item.pair.length > 0)
    .sort((a, b) => a.pair.localeCompare(b.pair, "de"));

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 4,
    head: [[t.exchangeRates, t.rate, t.rateDate, t.rateSource]],
    body:
      normalizedRates.length > 0
        ? normalizedRates.map((item) => [
            item.pair,
            item.rate === null ? t.noRate : item.rate.toFixed(6),
            formatRateDate(item.date),
            String(item.source || "NBP"),
          ])
        : [["-", t.noRate, "-", "-"]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [2, 90, 100] },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `${t.page} ${i}/${pageCount}`,
      doc.internal.pageSize.getWidth() - 16,
      288,
      { align: "right" }
    );
  }

  await savePdfWithFallback(
    doc,
    `Cost_Statement_${input.customerName}_${input.startDate}_${input.endDate}_${input.language}.pdf`
  );
}
