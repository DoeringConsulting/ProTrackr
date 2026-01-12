import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface AccountingData {
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
  grandTotal: number;
}

export async function exportAccountingReportToPDF(
  data: AccountingData,
  startDate: string,
  endDate: string
) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.text("Buchhaltungsbericht", 14, 20);

  doc.setFontSize(10);
  doc.text(`Zeitraum: ${new Date(startDate).toLocaleDateString("de-DE")} - ${new Date(endDate).toLocaleDateString("de-DE")}`, 14, 28);
  doc.text(`Erstellt am: ${new Date().toLocaleDateString("de-DE")}`, 14, 34);

  // Accounting table
  const formatCurrency = (cents: number) => `€${(cents / 100).toFixed(2)}`;

  autoTable(doc, {
    startY: 45,
    head: [["Position", "Betrag"]],
    body: [
      ["Bruttoumsatz", formatCurrency(data.grossRevenue)],
      ["  Zeiterfassung", formatCurrency(data.grossRevenue - data.variableCosts)],
      ["  Reisekosten", formatCurrency(data.variableCosts)],
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
  endDate: string
) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.text("Kundenbericht", 14, 20);

  doc.setFontSize(12);
  doc.text(`Projekt: ${data.customer.projectName}`, 14, 30);
  doc.text(`Kunde: ${data.customer.provider}`, 14, 37);

  doc.setFontSize(10);
  doc.text(`Zeitraum: ${new Date(startDate).toLocaleDateString("de-DE")} - ${new Date(endDate).toLocaleDateString("de-DE")}`, 14, 44);
  doc.text(`Erstellt am: ${new Date().toLocaleDateString("de-DE")}`, 14, 50);

  const formatCurrency = (cents: number) => `€${(cents / 100).toFixed(2)}`;
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
      ["Gesamtstunden", formatHours(data.totalHours)],
      ["Manntage", formatManDays(data.totalManDays)],
      ["Leistungswert", formatCurrency(data.totalAmount)],
      ["Reisekosten", formatCurrency(data.totalExpenses)],
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
