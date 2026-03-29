import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney } from "@/lib/currencyUtils";

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

function formatDateDe(value: string | Date) {
  return new Date(value).toLocaleDateString("de-DE");
}

function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
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
    `Okres: ${new Date(input.startDate).toLocaleDateString("pl-PL")} - ${new Date(
      input.endDate
    ).toLocaleDateString("pl-PL")} | Doradca: ${input.advisorName}`,
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
      entry.projectName || "-",
      entry.provider || "-",
      entry.location || "-",
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
      getExpenseCategoryPl(exp.category),
      `${exp.projectName || "-"} / ${exp.provider || "-"}`,
      getExpenseDetailLabel(exp),
      formatMoney(exp.amount, exp.currency),
      exp.amountEur === null ? "Brak kursu" : formatMoney(exp.amountEur, "EUR"),
      exp.amountPln === null ? "Brak kursu" : formatMoney(exp.amountPln, "PLN"),
      String(exp.comment || "-"),
    ]),
    styles: { fontSize: 8, overflow: "linebreak" },
    headStyles: { fillColor: [185, 136, 71] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 20 },
      2: { cellWidth: 22 },
      3: { cellWidth: 30 },
      4: { cellWidth: 22 },
      5: { cellWidth: 22 },
      6: { cellWidth: 22 },
      7: { cellWidth: 22 },
      8: { cellWidth: "auto" },
    },
  });

  const sumStartY = (doc as any).lastAutoTable.finalY + 6;
  autoTable(doc, {
    startY: sumStartY,
    head: [["Podsumowanie", "Wartosc"]],
    body: [
      ["Suma godzin (hh:mm)", formatHours(input.summary.totalHoursMinutes)],
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
  appliedExchangeRates?: AppliedExchangeRate[];
}) {
  const t = {
    de: {
      title: "Stundennachweis",
      period: "Zeitraum",
      consultant: "Berater",
      date: "Datum",
      weekday: "Wochentag",
      type: "Typ",
      hours: "Stunden",
      md: "Manntage",
      desc: "Tätigkeit",
      total: "Gesamt",
      page: "Seite",
    },
    en: {
      title: "Timesheet",
      period: "Period",
      consultant: "Consultant",
      date: "Date",
      weekday: "Weekday",
      type: "Type",
      hours: "Hours",
      md: "Man-days",
      desc: "Activity",
      total: "Total",
      page: "Page",
    },
    pl: {
      title: "Ewidencja godzin",
      period: "Okres",
      consultant: "Doradca",
      date: "Data",
      weekday: "Dzien",
      type: "Typ",
      hours: "Godziny",
      md: "Man-days",
      desc: "Zakres pracy",
      total: "Suma",
      page: "Strona",
    },
  }[input.language];

  const doc = new jsPDF("p", "mm", "a4");
  doc.setFontSize(17);
  doc.text(t.title, 14, 16);
  doc.setFontSize(10);
  doc.text(`Client: ${input.customerName}`, 14, 22);
  doc.text(`Project: ${input.projectName}`, 14, 27);
  doc.text(
    `${t.period}: ${new Date(input.startDate).toLocaleDateString("de-DE")} - ${new Date(
      input.endDate
    ).toLocaleDateString("de-DE")} | ${t.consultant}: ${input.consultant}`,
    14,
    32
  );

  autoTable(doc, {
    startY: 38,
    head: [[t.date, t.weekday, t.type, t.hours, t.md, t.desc]],
    body: input.entries.map((entry) => [
      formatDateDe(entry.date),
      getWeekdayByLanguage(entry.weekday, input.language),
      entry.entryType,
      formatHours(entry.hours),
      formatManDays(entry.manDays),
      entry.description || "-",
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
      [`${t.hours} (hh:mm)`, formatHours(input.totalHours)],
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
    head: [["Applied exchange rates", "Rate", "Rate date", "Source"]],
    body:
      normalizedRates.length > 0
        ? normalizedRates.map((item) => [
            item.pair,
            item.rate === null ? "n/a" : item.rate.toFixed(6),
            formatRateDate(item.date),
            String(item.source || "NBP"),
          ])
        : [["-", "n/a", "-", "-"]],
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
      period: "Zeitraum",
      date: "Datum",
      hours: "Stunden",
      md: "Manntage",
      service: "Leistung",
      travel: "Reisekosten",
      travelTypes: "Reisearten",
      total: "Gesamt",
      page: "Seite",
    },
    en: {
      title: "Cost Statement",
      period: "Period",
      date: "Date",
      hours: "Hours",
      md: "Man-days",
      service: "Service",
      travel: "Travel Costs",
      travelTypes: "Travel Types",
      total: "Total",
      page: "Page",
    },
    pl: {
      title: "Zestawienie kosztow",
      period: "Okres",
      date: "Data",
      hours: "Godziny",
      md: "Man-days",
      service: "Usluga",
      travel: "Koszty podrozy",
      travelTypes: "Rodzaje kosztow",
      total: "Suma",
      page: "Strona",
    },
  }[input.language];

  const doc = new jsPDF("p", "mm", "a4");
  doc.setFontSize(17);
  doc.text(`${t.title} (${input.customerCurrency})`, 14, 16);
  doc.setFontSize(10);
  doc.text(`Client: ${input.customerName}`, 14, 22);
  doc.text(`Project: ${input.projectName}`, 14, 27);
  doc.text(
    `${t.period}: ${new Date(input.startDate).toLocaleDateString("de-DE")} - ${new Date(
      input.endDate
    ).toLocaleDateString("de-DE")}`,
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
      row.travelCategories || "-",
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
    head: [["Applied exchange rates", "Rate", "Rate date", "Source"]],
    body:
      normalizedRates.length > 0
        ? normalizedRates.map((item) => [
            item.pair,
            item.rate === null ? "n/a" : item.rate.toFixed(6),
            formatRateDate(item.date),
            String(item.source || "NBP"),
          ])
        : [["-", "n/a", "-", "-"]],
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
