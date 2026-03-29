import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

  // Header
  doc.setFontSize(20);
  doc.text("Buchhaltungsbericht", 14, 20);

  doc.setFontSize(10);
  doc.text(sanitizeForPdf(`Zeitraum: ${new Date(startDate).toLocaleDateString("de-DE")} - ${new Date(endDate).toLocaleDateString("de-DE")}`), 14, 28);
  doc.text(sanitizeForPdf(`Erstellt am: ${new Date().toLocaleDateString("de-DE")}`), 14, 34);

  // Accounting table
  const formatCurrency = (cents: number) => sanitizeForPdf(`€${(cents / 100).toFixed(2)}`);
  const timeRevenue = data.timeRevenue ?? (data.grossRevenue - data.variableCosts);
  const travelRevenueInGross =
    data.travelRevenueInGross ?? Math.max(0, data.grossRevenue - timeRevenue);

  autoTable(doc, {
    startY: 45,
    head: [["Position", "Betrag"]],
    body: [
      ["Bruttoumsatz", formatCurrency(data.grossRevenue)],
      ["  Zeiterfassung", formatCurrency(timeRevenue)],
      ["  Reisekosten (abrechenbar, nur Exclusive)", formatCurrency(travelRevenueInGross)],
      ["", ""],
      ["Fixkosten", formatCurrency(data.totalFixedCosts)],
      ["Variable Kosten", formatCurrency(data.variableCosts)],
      ["", ""],
      ["ZUS (Sozialversicherung 19,52%)", formatCurrency(data.zus)],
      ["Krankenversicherung (9%)", formatCurrency(data.healthInsurance)],
      ["", ""],
      ["Steuerbasis", formatCurrency(data.taxBase)],
      ["Steuer (19%)", formatCurrency(data.tax)],
      ["", ""],
      ["Nettogewinn", formatCurrency(data.netProfit)],
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
    head: [["Angewendete Wechselkurse", "Kurs", "Kursdatum", "Quelle"]],
    body:
      appliedExchangeRates.length > 0
        ? appliedExchangeRates
            .map((entry) => ({
              pair: String(entry.pair || "").toUpperCase(),
              rate: typeof entry.rate === "number" ? entry.rate : null,
              date: entry.date ?? null,
              source: entry.source ?? "NBP",
            }))
            .sort((a, b) => a.pair.localeCompare(b.pair, "de"))
            .map((entry) => [
              entry.pair,
              entry.rate === null ? "n/a" : entry.rate.toFixed(6),
              entry.date ? new Date(entry.date).toLocaleDateString("de-DE") : "-",
              String(entry.source || "NBP"),
            ])
        : [["-", "n/a", "-", "-"]],
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
      `Seite ${i} von ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  const filename = `Buchhaltungsbericht_${startDate}_${endDate}.pdf`;
  
  // Try to save to local file system
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
    // Fallback: Download as file
    doc.save(filename);
  }
}

export async function exportCustomerReportToPDF(
  data: CustomerData,
  startDate: string,
  endDate: string,
  appliedExchangeRates: AppliedExchangeRate[] = []
) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.text("Kundenbericht", 14, 20);

  doc.setFontSize(12);
  doc.text(sanitizeForPdf(`Projekt: ${data.customer.projectName}`), 14, 30);
  doc.text(sanitizeForPdf(`Kunde: ${data.customer.provider}`), 14, 37);

  doc.setFontSize(10);
  doc.text(sanitizeForPdf(`Zeitraum: ${new Date(startDate).toLocaleDateString("de-DE")} - ${new Date(endDate).toLocaleDateString("de-DE")}`), 14, 44);
  doc.text(sanitizeForPdf(`Erstellt am: ${new Date().toLocaleDateString("de-DE")}`), 14, 50);

  const formatCurrency = (cents: number) => sanitizeForPdf(`€${(cents / 100).toFixed(2)}`);
  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}h`;
  };
  const formatManDays = (manDays: number) => (manDays / 1000).toFixed(3);

  // Summary
  autoTable(doc, {
    startY: 60,
    head: [["Zusammenfassung", ""]],
    body: [
      ["Abrechnungsmodell", data.customer.costModel ?? "n/a"],
      ["Gesamtstunden (hh:mm)", formatHours(data.totalHours)],
      ["Manntage", formatManDays(data.totalManDays)],
      ["Leistungswert", formatCurrency(data.totalAmount)],
      ["Reisekosten (gesamt)", formatCurrency(data.totalExpenses)],
      ["Reisekosten (abrechenbar)", formatCurrency(data.billableExpenses ?? data.totalExpenses)],
      ["Gesamtsumme", formatCurrency(data.grandTotal)],
    ],
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 10 },
  });

  // Details
  const detailsStartY = (doc as any).lastAutoTable.finalY + 10;

  autoTable(doc, {
    startY: detailsStartY,
    head: [["Datum", "Typ", "Stunden", "Manntage", "Betrag"]],
    body: data.entries.map((entry) => [
      new Date(entry.date).toLocaleDateString("de-DE"),
      entry.entryType,
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
    head: [["Angewendete Wechselkurse", "Kurs", "Kursdatum", "Quelle"]],
    body:
      appliedExchangeRates.length > 0
        ? appliedExchangeRates
            .map((entry) => ({
              pair: String(entry.pair || "").toUpperCase(),
              rate: typeof entry.rate === "number" ? entry.rate : null,
              date: entry.date ?? null,
              source: entry.source ?? "NBP",
            }))
            .sort((a, b) => a.pair.localeCompare(b.pair, "de"))
            .map((entry) => [
              entry.pair,
              entry.rate === null ? "n/a" : entry.rate.toFixed(6),
              entry.date ? new Date(entry.date).toLocaleDateString("de-DE") : "-",
              String(entry.source || "NBP"),
            ])
        : [["-", "n/a", "-", "-"]],
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
      `Seite ${i} von ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  const filename = `Kundenbericht_${data.customer.projectName}_${startDate}_${endDate}.pdf`;
  
  // Try to save to local file system
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
    // Fallback: Download as file
    doc.save(filename);
  }
}
