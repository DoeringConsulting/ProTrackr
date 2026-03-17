import * as XLSX from "xlsx";

interface AccountingReportData {
  revenue: number;
  timeRevenue?: number;
  travelRevenueInGross?: number;
  fixedCosts: { category: string; amount: number }[];
  variableCosts: number;
  zus: number;
  healthInsurance: number;
  tax: number;
  netProfit: number;
  startDate: string;
  endDate: string;
}

interface CustomerReportData {
  customerName: string;
  projectName: string;
  costModel?: string;
  consultant: string;
  startDate: string;
  endDate: string;
  entries: {
    date: string;
    hours: number;
    rate: number;
    amount: number;
    expenses: number;
  }[];
  totalHours: number;
  totalAmount: number;
  totalExpenses: number;
  billableExpenses?: number;
  grandTotal: number;
}

function formatHours(minutes: number) {
  const total = Number(minutes || 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours}:${String(mins).padStart(2, "0")}`;
}

export async function exportAccountingReportToExcel(data: AccountingReportData) {
  const wb = XLSX.utils.book_new();
  const timeRevenue = data.timeRevenue ?? (data.revenue - data.variableCosts);
  const travelRevenueInGross =
    data.travelRevenueInGross ?? Math.max(0, data.revenue - timeRevenue);

  // Create worksheet data
  const wsData = [
    ["Buchhaltungsbericht"],
    [`Zeitraum: ${data.startDate} bis ${data.endDate}`],
    [],
    ["Einnahmen"],
    ["Bruttoumsatz", data.revenue / 100],
    ["Zeiterfassung", timeRevenue / 100],
    ["Reisekosten (abrechenbar, nur Exclusive)", travelRevenueInGross / 100],
    [],
    ["Fixkosten"],
    ...data.fixedCosts.map((fc) => [fc.category, fc.amount / 100]),
    ["Summe Fixkosten", data.fixedCosts.reduce((sum, fc) => sum + fc.amount, 0) / 100],
    [],
    ["Variable Kosten"],
    ["Reisekosten", data.variableCosts / 100],
    [],
    ["Abzüge"],
    ["ZUS (19,52%)", data.zus / 100],
    ["Krankenversicherung (9%)", data.healthInsurance / 100],
    ["Steuer (19%)", data.tax / 100],
    [],
    ["Nettogewinn", data.netProfit / 100],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws["!cols"] = [{ wch: 30 }, { wch: 15 }];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Buchhaltung");

  // Generate filename
  const filename = `Buchhaltungsbericht_${data.startDate}_${data.endDate}.xlsx`;

  // Try to save to local file system
  try {
    const { saveFileToLocal } = await import("@/lib/fileSystem");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const now = new Date();
    await saveFileToLocal(
      filename,
      blob,
      now.getFullYear(),
      now.getMonth() + 1,
      'Raporty'
    );
  } catch (error) {
    // Fallback: Download as file
    XLSX.writeFile(wb, filename);
  }
}

export async function exportCustomerReportToExcel(data: CustomerReportData) {
  const wb = XLSX.utils.book_new();
  const isExclusive = data.costModel === "exclusive";
  const billableExpenses = data.billableExpenses ?? (isExclusive ? data.totalExpenses : 0);

  // Summary sheet
  const summaryData = [
    ["Kundenbericht"],
    [`Kunde: ${data.customerName}`],
    [`Projekt: ${data.projectName}`],
    [`Berater: ${data.consultant}`],
    [`Abrechnungsmodell: ${data.costModel ?? "n/a"}`],
    [`Zeitraum: ${data.startDate} bis ${data.endDate}`],
    [],
    ["Zusammenfassung"],
    ["Gesamtstunden (hh:mm)", formatHours(data.totalHours)],
    ["Leistungswert", data.totalAmount / 100],
    ["Reisekosten (gesamt)", data.totalExpenses / 100],
    ["Reisekosten (abrechenbar)", billableExpenses / 100],
    ["Gesamtsumme", data.grandTotal / 100],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 20 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Zusammenfassung");

  // Details sheet
  const detailsData = [
    ["Datum", "Stunden", "Tagessatz", "Betrag", "Reisekosten", "Gesamt"],
    ...data.entries.map((entry) => [
      entry.date,
      entry.hours,
      entry.rate / 100,
      entry.amount / 100,
      entry.expenses / 100,
      (entry.amount + (isExclusive ? entry.expenses : 0)) / 100,
    ]),
    [],
    ["Summe (hh:mm)", formatHours(data.totalHours), "", data.totalAmount / 100, data.totalExpenses / 100, data.grandTotal / 100],
  ];

  const wsDetails = XLSX.utils.aoa_to_sheet(detailsData);
  wsDetails["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsDetails, "Details");

  // Generate filename
  const filename = `Kundenbericht_${data.customerName}_${data.startDate}_${data.endDate}.xlsx`;

  // Try to save to local file system
  try {
    const { saveFileToLocal } = await import("@/lib/fileSystem");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const now = new Date();
    await saveFileToLocal(
      filename,
      blob,
      now.getFullYear(),
      now.getMonth() + 1,
      'Raporty'
    );
  } catch (error) {
    // Fallback: Download as file
    XLSX.writeFile(wb, filename);
  }
}
