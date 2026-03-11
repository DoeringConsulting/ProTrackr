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
  category: string;
  block: string;
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

function getPolishWeekday(weekdayValue: string | null | undefined) {
  if (!weekdayValue) return "-";
  const value = String(weekdayValue).trim();
  if (!value) return "-";
  const parts = value.split("/");
  if (parts.length > 1) return (parts[1] || "-").trim();
  return value;
}

function getExpenseDetailLabel(expense: BookkeepingExpense) {
  if (expense.category === "hotel") {
    const checkIn = expense.checkInDate ? formatDateDe(expense.checkInDate) : "-";
    const checkOut = expense.checkOutDate ? formatDateDe(expense.checkOutDate) : "-";
    return `Check-in: ${checkIn} | Check-out: ${checkOut}`;
  }
  if (expense.category === "flight") {
    const route = expense.flightRouteType === "international" ? "International" : "Inland";
    const departure = expense.departureTime || "-";
    const arrival = expense.arrivalTime || "-";
    return `Typ: ${route} | Abflug: ${departure} | Ankunft: ${arrival}`;
  }
  return "-";
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
      entry.entryType || "-",
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
      "Data",
      "Blok",
      "Kategoria",
      "Projekt/Klient",
      "Szczegoly",
      "Kwota oryginalna",
      "Kwota EUR",
      "Kwota PLN",
      "Komentarz",
    ]],
    body: input.expenses.map((exp) => [
      formatDateDe(exp.date),
      exp.block,
      exp.category,
      `${exp.projectName || "-"} / ${exp.provider || "-"}`,
      getExpenseDetailLabel(exp),
      formatMoney(exp.amount, exp.currency),
      exp.amountEur === null ? "Brak kursu" : formatMoney(exp.amountEur, "EUR"),
      exp.amountPln === null ? "Brak kursu" : formatMoney(exp.amountPln, "PLN"),
      exp.comment || "-",
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [185, 136, 71] },
  });

  const sumStartY = (doc as any).lastAutoTable.finalY + 6;
  autoTable(doc, {
    startY: sumStartY,
    head: [["Podsumowanie", "Wartosc"]],
    body: [
      ["Suma godzin", formatHours(input.summary.totalHoursMinutes)],
      ["Suma man-days", formatManDays(input.summary.totalManDays)],
      ["Umsatz (EUR)", formatMoney(input.summary.revenueEur, "EUR")],
      ["Koszty podrozy (EUR)", formatMoney(input.summary.travelEur, "EUR")],
      [
        "Ergebnis (Umsatz - Reisekosten) (EUR)",
        formatMoney(input.summary.revenueEur - input.summary.travelEur, "EUR"),
      ],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [3, 109, 121] },
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
      entry.weekday || "-",
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
      [t.hours, formatHours(input.totalHours)],
      [t.md, formatManDays(input.totalManDays)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [185, 136, 71] },
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
