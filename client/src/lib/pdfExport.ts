import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportLanguage } from "@/lib/reportPdfExports";

/**
 * Sanitize text for jsPDF default (WinAnsiEncoding) fonts.
 * Transliterates Polish diacritics and strips non-WinAnsi Unicode characters
 * to prevent UCS-2 fallback which renders "&" between every letter.
 */
function sanitizeForPdf(value: string): string {
  return (
    value
      .replace(/[Ąą]/g, (c) => (c === "Ą" ? "A" : "a"))
      .replace(/[Ćć]/g, (c) => (c === "Ć" ? "C" : "c"))
      .replace(/[Ęę]/g, (c) => (c === "Ę" ? "E" : "e"))
      .replace(/[Łł]/g, (c) => (c === "Ł" ? "L" : "l"))
      .replace(/[Ńń]/g, (c) => (c === "Ń" ? "N" : "n"))
      .replace(/[Óó]/g, (c) => (c === "Ó" ? "O" : "o"))
      .replace(/[Śś]/g, (c) => (c === "Ś" ? "S" : "s"))
      .replace(/[Źź]/g, (c) => (c === "Ź" ? "Z" : "z"))
      .replace(/[Żż]/g, (c) => (c === "Ż" ? "Z" : "z"))
      .replace(/[\u00A0\u2002\u2003\u2007\u2009\u200A\u202F\u205F]/g, " ")
      .replace(/[\u2018\u2019\u201A]/g, "'")
      .replace(/[\u201C\u201D\u201E]/g, '"')
      .replace(/\u2013/g, "-")
      .replace(/\u2014/g, "--")
      .replace(/\u2026/g, "...")
      .replace(/[^\x00-\xFF]/g, "")
  );
}

interface AccountingData {
  timeRevenue?: number;
  travelRevenueInGross?: number;
  grossRevenue: number;
  totalFixedCosts: number;
  variableCosts: number;
  zus: number;
  healthInsurance: number;
  taxBase: number;
  tax: number;
  netProfit: number;
}

interface CustomerData {
  customer: {
    projectName: string;
    provider: string;
    costModel?: string;
  };
  entries: Array<{
    date: Date;
    hours: number;
    manDays: number;
    calculatedAmount: number;
    entryType: string;
  }>;
  totalHours: number;
  totalAmount: number;
  totalManDays: number;
  totalExpenses: number;
  billableExpenses?: number;
  grandTotal: number;
}

type AppliedExchangeRate = {
  pair: string;
  rate: number | null;
  date?: string | null;
  source?: string | null;
};

export async function exportAccountingReportToPDF(
  data: AccountingData,
  startDate: string,
  endDate: string,
  appliedExchangeRates: AppliedExchangeRate[] = []
) {
  const doc = new jsPDF();

  // Header — Buchhaltungsberichte ausschließlich in Polnisch
  doc.setFontSize(20);
  doc.text("Raport ksiegowy", 14, 20);

  doc.setFontSize(10);
  doc.text(sanitizeForPdf(`Okres: ${new Date(startDate).toLocaleDateString("pl-PL")} - ${new Date(endDate).toLocaleDateString("pl-PL")}`), 14, 28);
  doc.text(sanitizeForPdf(`Data utworzenia: ${new Date().toLocaleDateString("pl-PL")}`), 14, 34);

  const formatCurrency = (cents: number) => sanitizeForPdf(`€${(cents / 100).toFixed(2)}`);
  const timeRevenue = data.timeRevenue ?? (data.grossRevenue - data.variableCosts);
  const travelRevenueInGross =
    data.travelRevenueInGross ?? Math.max(0, data.grossRevenue - timeRevenue);

  autoTable(doc, {
    startY: 45,
    head: [["Pozycja", "Kwota"]],
    body: [
      ["Przychod brutto", formatCurrency(data.grossRevenue)],
      ["  Ewidencja czasu", formatCurrency(timeRevenue)],
      ["  Koszty podrozy (rozliczane, tylko Exclusive)", formatCurrency(travelRevenueInGross)],
      ["", ""],
      ["Koszty stale", formatCurrency(data.totalFixedCosts)],
      ["Koszty zmienne", formatCurrency(data.variableCosts)],
      ["", ""],
      ["ZUS (ubezpieczenie spoleczne 19,52%)", formatCurrency(data.zus)],
      ["Ubezpieczenie zdrowotne (9%)", formatCurrency(data.healthInsurance)],
      ["", ""],
      ["Podstawa opodatkowania", formatCurrency(data.taxBase)],
      ["Podatek (19%)", formatCurrency(data.tax)],
      ["", ""],
      ["Zysk netto", formatCurrency(data.netProfit)],
    ],
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 60, halign: "right" },
    },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 6,
    head: [["Zastosowane kursy walut", "Kurs", "Data kursu", "Zrodlo"]],
    body:
      appliedExchangeRates.length > 0
        ? appliedExchangeRates
            .map((entry) => ({
              pair: String(entry.pair || "").toUpperCase(),
              rate: typeof entry.rate === "number" ? entry.rate : null,
              date: entry.date ?? null,
              source: entry.source ?? "NBP",
            }))
            .sort((a, b) => a.pair.localeCompare(b.pair, "pl"))
            .map((entry) => [
              entry.pair,
              entry.rate === null ? "Brak kursu" : entry.rate.toFixed(6),
              entry.date ? new Date(entry.date).toLocaleDateString("pl-PL") : "-",
              String(entry.source || "NBP"),
            ])
        : [["-", "Brak kursu", "-", "-"]],
    theme: "striped",
    headStyles: { fillColor: [3, 109, 121] },
    styles: { fontSize: 9 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Strona ${i} z ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  const filename = `Raport_ksiegowy_${startDate}_${endDate}.pdf`;

  try {
    const { saveFileToLocal } = await import("@/lib/fileSystem");
    const pdfBlob = doc.output('blob');
    const now = new Date();
    await saveFileToLocal(
      filename,
      pdfBlob,
      now.getFullYear(),
      now.getMonth() + 1,
      'Raporty'
    );
  } catch (error) {
    doc.save(filename);
  }
}

export async function exportCustomerReportToPDF(
  data: CustomerData,
  startDate: string,
  endDate: string,
  appliedExchangeRates: AppliedExchangeRate[] = [],
  language: ReportLanguage = "de"
) {
  const t = {
    de: {
      title: "Kundenbericht",
      project: "Projekt",
      client: "Kunde",
      period: "Zeitraum",
      createdAt: "Erstellt am",
      summary: "Zusammenfassung",
      costModel: "Abrechnungsmodell",
      totalHours: "Gesamtstunden (hh:mm)",
      totalHoursDecimal: "Gesamtstunden (dezimal)",
      onsiteHours: "Stunden Vor Ort (hh:mm)",
      onsiteHoursDecimal: "Stunden Vor Ort (dezimal)",
      remoteHours: "Stunden Remote (hh:mm)",
      remoteHoursDecimal: "Stunden Remote (dezimal)",
      manDays: "Manntage",
      onsiteManDays: "Manntage Vor Ort",
      remoteManDays: "Manntage Remote",
      serviceValue: "Leistungswert",
      travelTotal: "Reisekosten (gesamt)",
      travelBillable: "Reisekosten (abrechenbar)",
      grandTotal: "Gesamtsumme",
      date: "Datum",
      type: "Typ",
      hours: "Stunden",
      amount: "Betrag",
      page: "Seite",
      pageOf: "von",
      exchangeRates: "Angewendete Wechselkurse",
      rate: "Kurs",
      rateDate: "Kursdatum",
      rateSource: "Quelle",
      noRate: "k.A.",
      onsite: "Vor Ort",
      remote: "Remote",
    },
    en: {
      title: "Customer Report",
      project: "Project",
      client: "Client",
      period: "Period",
      createdAt: "Created on",
      summary: "Summary",
      costModel: "Cost model",
      totalHours: "Total hours (hh:mm)",
      totalHoursDecimal: "Total hours (decimal)",
      onsiteHours: "Hours Onsite (hh:mm)",
      onsiteHoursDecimal: "Hours Onsite (decimal)",
      remoteHours: "Hours Remote (hh:mm)",
      remoteHoursDecimal: "Hours Remote (decimal)",
      manDays: "Man-days",
      onsiteManDays: "Man-days Onsite",
      remoteManDays: "Man-days Remote",
      serviceValue: "Service value",
      travelTotal: "Travel costs (total)",
      travelBillable: "Travel costs (billable)",
      grandTotal: "Grand total",
      date: "Date",
      type: "Type",
      hours: "Hours",
      amount: "Amount",
      page: "Page",
      pageOf: "of",
      exchangeRates: "Applied exchange rates",
      rate: "Rate",
      rateDate: "Rate date",
      rateSource: "Source",
      noRate: "n/a",
      onsite: "Onsite",
      remote: "Remote",
    },
    pl: {
      title: "Raport klienta",
      project: "Projekt",
      client: "Klient",
      period: "Okres",
      createdAt: "Data utworzenia",
      summary: "Podsumowanie",
      costModel: "Model rozliczen",
      totalHours: "Suma godzin (hh:mm)",
      totalHoursDecimal: "Suma godzin (dziesietne)",
      onsiteHours: "Godziny stacjonarnie (hh:mm)",
      onsiteHoursDecimal: "Godziny stacjonarnie (dziesietne)",
      remoteHours: "Godziny zdalnie (hh:mm)",
      remoteHoursDecimal: "Godziny zdalnie (dziesietne)",
      manDays: "Man-days",
      onsiteManDays: "Man-days stacjonarnie",
      remoteManDays: "Man-days zdalnie",
      serviceValue: "Wartosc uslugi",
      travelTotal: "Koszty podrozy (suma)",
      travelBillable: "Koszty podrozy (rozliczane)",
      grandTotal: "Suma calkowita",
      date: "Data",
      type: "Typ",
      hours: "Godziny",
      amount: "Kwota",
      page: "Strona",
      pageOf: "z",
      exchangeRates: "Zastosowane kursy walut",
      rate: "Kurs",
      rateDate: "Data kursu",
      rateSource: "Zrodlo",
      noRate: "Brak kursu",
      onsite: "Stacjonarnie",
      remote: "Zdalnie",
    },
  }[language];

  const locale = language === "pl" ? "pl-PL" : language === "en" ? "en-GB" : "de-DE";
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text(sanitizeForPdf(t.title), 14, 20);

  doc.setFontSize(12);
  doc.text(sanitizeForPdf(`${t.project}: ${data.customer.projectName}`), 14, 30);
  doc.text(sanitizeForPdf(`${t.client}: ${data.customer.provider}`), 14, 37);

  doc.setFontSize(10);
  doc.text(sanitizeForPdf(`${t.period}: ${new Date(startDate).toLocaleDateString(locale)} - ${new Date(endDate).toLocaleDateString(locale)}`), 14, 44);
  doc.text(sanitizeForPdf(`${t.createdAt}: ${new Date().toLocaleDateString(locale)}`), 14, 50);

  const formatCurrency = (cents: number) => sanitizeForPdf(`€${(cents / 100).toFixed(2)}`);
  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}h`;
  };
  const formatManDays = (manDays: number) => (manDays / 1000).toFixed(3);
  const formatDecimalHours = (minutes: number) => (minutes / 60).toFixed(5);

  // Onsite/Remote breakdown
  const onsiteEntries = data.entries.filter((e) => e.entryType === "onsite");
  const remoteEntries = data.entries.filter((e) => e.entryType === "remote");
  const onsiteHrs = onsiteEntries.reduce((sum, e) => sum + e.hours, 0);
  const onsiteMd = onsiteEntries.reduce((sum, e) => sum + e.manDays, 0);
  const remoteHrs = remoteEntries.reduce((sum, e) => sum + e.hours, 0);
  const remoteMd = remoteEntries.reduce((sum, e) => sum + e.manDays, 0);

  const entryTypeLabel = (type: string) => {
    const map: Record<string, string> = { onsite: t.onsite, remote: t.remote };
    return map[type] || type;
  };

  autoTable(doc, {
    startY: 60,
    head: [[t.summary, ""]],
    body: [
      [t.costModel, data.customer.costModel ?? "n/a"],
      [t.onsiteHours, formatHours(onsiteHrs)],
      [t.onsiteHoursDecimal, formatDecimalHours(onsiteHrs)],
      [t.onsiteManDays, formatManDays(onsiteMd)],
      [t.remoteHours, formatHours(remoteHrs)],
      [t.remoteHoursDecimal, formatDecimalHours(remoteHrs)],
      [t.remoteManDays, formatManDays(remoteMd)],
      ["", ""],
      [t.totalHours, formatHours(data.totalHours)],
      [t.totalHoursDecimal, formatDecimalHours(data.totalHours)],
      [t.manDays, formatManDays(data.totalManDays)],
      [t.serviceValue, formatCurrency(data.totalAmount)],
      [t.travelTotal, formatCurrency(data.totalExpenses)],
      [t.travelBillable, formatCurrency(data.billableExpenses ?? data.totalExpenses)],
      [t.grandTotal, formatCurrency(data.grandTotal)],
    ],
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 10 },
  });

  const detailsStartY = (doc as any).lastAutoTable.finalY + 10;

  autoTable(doc, {
    startY: detailsStartY,
    head: [[t.date, t.type, t.hours, t.manDays, t.amount]],
    body: data.entries.map((entry) => [
      new Date(entry.date).toLocaleDateString(locale),
      entryTypeLabel(entry.entryType),
      formatHours(entry.hours),
      formatManDays(entry.manDays),
      formatCurrency(entry.calculatedAmount),
    ]),
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 9 },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 6,
    head: [[t.exchangeRates, t.rate, t.rateDate, t.rateSource]],
    body:
      appliedExchangeRates.length > 0
        ? appliedExchangeRates
            .map((entry) => ({
              pair: String(entry.pair || "").toUpperCase(),
              rate: typeof entry.rate === "number" ? entry.rate : null,
              date: entry.date ?? null,
              source: entry.source ?? "NBP",
            }))
            .sort((a, b) => a.pair.localeCompare(b.pair, locale))
            .map((entry) => [
              entry.pair,
              entry.rate === null ? t.noRate : entry.rate.toFixed(6),
              entry.date ? new Date(entry.date).toLocaleDateString(locale) : "-",
              String(entry.source || "NBP"),
            ])
        : [["-", t.noRate, "-", "-"]],
    theme: "striped",
    headStyles: { fillColor: [3, 109, 121] },
    styles: { fontSize: 9 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `${t.page} ${i} ${t.pageOf} ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  const filePrefix = { de: "Kundenbericht", en: "Customer_Report", pl: "Raport_klienta" }[language];
  const filename = `${filePrefix}_${data.customer.projectName}_${startDate}_${endDate}.pdf`;

  try {
    const { saveFileToLocal } = await import("@/lib/fileSystem");
    const pdfBlob = doc.output('blob');
    const now = new Date();
    await saveFileToLocal(
      filename,
      pdfBlob,
      now.getFullYear(),
      now.getMonth() + 1,
      'Raporty'
    );
  } catch (error) {
    doc.save(filename);
  }
}
