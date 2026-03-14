import * as XLSX from "xlsx";

export type ImportIssueSeverity = "error" | "warning";

export type ImportIssue = {
  code: string;
  severity: ImportIssueSeverity;
  table: "Kunden" | "Zeiteintraege" | "Reisekosten" | "Datei";
  row: number;
  field?: string;
  message: string;
  value?: string;
};

export type CustomerImportRow = {
  rowNumber: number;
  customerExternalId: string;
  mandantenNr: string;
  provider: string;
  projectName: string;
  projectNr: string;
  location: string;
  costModel: "inclusive" | "exclusive";
  standardDayHours: number;
  onsiteRate: number;
  remoteRate: number;
  kmRate: number;
  mealRate: number;
  defaultCurrency: string;
};

export type TimeEntryImportRow = {
  rowNumber: number;
  timeEntryExternalId: string;
  customerExternalId: string;
  date: string;
  projectName: string;
  entryType: "onsite" | "remote" | "off_duty" | "business_trip";
  minutes: number;
  description: string;
};

export type ExpenseImportRow = {
  rowNumber: number;
  expenseExternalId: string;
  timeEntryExternalId: string;
  customerExternalId: string;
  mandantenNr: string;
  projectName: string;
  date: string;
  category: "car" | "train" | "flight" | "taxi" | "transport" | "meal" | "hotel" | "food" | "fuel" | "other";
  amount: number;
  currency: string;
  fullDay: "0" | "1" | "";
  comment: string;
  flightRouteType: "domestic" | "international" | "";
  departureTime: string;
  arrivalTime: string;
  returnDate: string;
  ticketNumber: string;
  flightNumber: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number | null;
  distanceKm: number | null;
  ratePerKm: number | null;
  liters: number | null;
  pricePerLiter: number | null;
  receiptNo: string;
  vendorName: string;
};

export type ParsedImportWorkbook = {
  customers: CustomerImportRow[];
  timeEntries: TimeEntryImportRow[];
  expenses: ExpenseImportRow[];
};

export const IMPORT_CHECKLIST: Record<string, string[]> = {
  Datei: [
    "Mindestens eine erkannte Tabelle mit Daten vorhanden",
    "Pflichtspalten je Tabelle vorhanden",
    "Keine doppelten Headernamen",
  ],
  Kunden: [
    "customer_external_id vorhanden und eindeutig",
    "mandanten_nr ist 3-stellig (z. B. 003)",
    "provider und project_name sind gesetzt",
    "cost_model ist inclusive oder exclusive",
    "Zahlenfelder sind numerisch und >= 0",
  ],
  Zeiteintraege: [
    "time_entry_external_id vorhanden und eindeutig",
    "customer_external_id referenziert eine Kundenzeile",
    "date im Format YYYY-MM-DD",
    "entry_type ist onsite|remote|off_duty|business_trip",
    "minutes ist ganze Zahl 1..1440",
  ],
  Reisekosten: [
    "expense_external_id vorhanden und eindeutig",
    "customer_external_id referenziert Kundenzeile",
    "date YYYY-MM-DD, amount > 0, currency ISO-3",
    "Kategorie-spezifische Pflichtfelder (flight/hotel/fuel)",
    "Referenzen auf time_entry_external_id sind konsistent",
  ],
};

export const IMPORT_ERROR_CATALOG: Record<
  string,
  { severity: ImportIssueSeverity; template: string; explanation: string }
> = {
  "FMT-001": {
    severity: "error",
    template: 'Datei-Fehler: Keine gültige Import-Tabelle erkannt ("{sheet}").',
    explanation: "Die Datei muss mindestens eine gültige Tabelle (Kunden, Zeiteintraege, Reisekosten) enthalten.",
  },
  "FMT-002": {
    severity: "error",
    template: '[{sheet}] Pflichtspalte "{column}" fehlt.',
    explanation: "Ohne Pflichtspalte ist kein valider Import möglich.",
  },
  "FMT-003": {
    severity: "error",
    template: "[Datei] Keine Datenzeilen gefunden.",
    explanation: "Mindestens eine Tabelle muss neben dem Header mindestens eine Datenzeile enthalten.",
  },
  "CUS-001": {
    severity: "error",
    template: '[Kunden | Zeile {row}] customer_external_id fehlt.',
    explanation: "Eindeutiger Kundenschlüssel ist erforderlich.",
  },
  "CUS-002": {
    severity: "error",
    template: '[Kunden | Zeile {row}] customer_external_id doppelt.',
    explanation: "Jede Kundenzeile muss eindeutig referenzierbar sein.",
  },
  "CUS-003": {
    severity: "error",
    template: '[Kunden | Zeile {row}] mandanten_nr ist ungültig.',
    explanation: "Format muss 3-stellig sein (001, 012, 123).",
  },
  "TIM-001": {
    severity: "error",
    template: '[Zeiteintraege | Zeile {row}] customer_external_id nicht gefunden.',
    explanation: "Zeitzeile verweist auf unbekannten Kunden.",
  },
  "TIM-002": {
    severity: "error",
    template: '[Zeiteintraege | Zeile {row}] date ungültig.',
    explanation: "Datum nur im ISO-Format YYYY-MM-DD.",
  },
  "TIM-003": {
    severity: "error",
    template: '[Zeiteintraege | Zeile {row}] entry_type ungültig.',
    explanation: "Erlaubt: onsite, remote, off_duty, business_trip.",
  },
  "TIM-004": {
    severity: "error",
    template: '[Zeiteintraege | Zeile {row}] minutes ungültig.',
    explanation: "Minuten müssen 1 bis 1440 sein.",
  },
  "EXP-001": {
    severity: "error",
    template: '[Reisekosten | Zeile {row}] category ungültig.',
    explanation: "Nur erlaubte Kategorien aus dem Importstandard.",
  },
  "EXP-002": {
    severity: "error",
    template: '[Reisekosten | Zeile {row}] amount fehlt oder <= 0.',
    explanation: "Betrag ist Pflicht und muss positiv sein.",
  },
  "EXP-003": {
    severity: "error",
    template: '[Reisekosten | Zeile {row}] currency ungültig.',
    explanation: "Währung muss ISO-3 (z. B. EUR, PLN) sein.",
  },
  "EXP-FLT-001": {
    severity: "error",
    template: "[Reisekosten | Zeile {row}] Internationaler Flug ohne Abflugzeit.",
    explanation: "Bei internationalem Flug ist departure_time Pflicht.",
  },
  "EXP-FLT-002": {
    severity: "error",
    template: "[Reisekosten | Zeile {row}] Internationaler Flug ohne Ankunftszeit.",
    explanation: "Bei internationalem Flug ist arrival_time Pflicht.",
  },
  "EXP-FLT-003": {
    severity: "error",
    template: "[Reisekosten | Zeile {row}] departure_time ungültig.",
    explanation: "Zeitformat HH:MM.",
  },
  "EXP-FLT-004": {
    severity: "error",
    template: "[Reisekosten | Zeile {row}] return_date liegt vor date.",
    explanation: "Rückflugdatum darf nicht vor Hinflug liegen.",
  },
  "EXP-HOT-001": {
    severity: "error",
    template: "[Reisekosten | Zeile {row}] check_in_date fehlt (hotel).",
    explanation: "Hotel benötigt Check-in-Datum.",
  },
  "EXP-HOT-002": {
    severity: "error",
    template: "[Reisekosten | Zeile {row}] nights oder check_out_date fehlt (hotel).",
    explanation: "Hotel braucht Nächte oder Check-out.",
  },
  "EXP-HOT-003": {
    severity: "error",
    template: "[Reisekosten | Zeile {row}] nights ist negativ.",
    explanation: "Nächte müssen >= 0 sein.",
  },
  "EXP-HOT-004": {
    severity: "error",
    template: "[Reisekosten | Zeile {row}] check_out_date liegt vor check_in_date.",
    explanation: "Check-out darf nicht vor Check-in liegen.",
  },
  "EXP-FUEL-001": {
    severity: "error",
    template: "[Reisekosten | Zeile {row}] liters fehlt oder <= 0 (fuel).",
    explanation: "Für Fuel sind Literangaben verpflichtend.",
  },
  "EXP-FUEL-002": {
    severity: "error",
    template: "[Reisekosten | Zeile {row}] price_per_liter fehlt oder <= 0 (fuel).",
    explanation: "Für Fuel ist Preis/Liter verpflichtend.",
  },
  "REF-001": {
    severity: "error",
    template: "[Reisekosten | Zeile {row}] time_entry_external_id nicht gefunden.",
    explanation: "Referenzierter Zeiteintrag existiert nicht in der Importdatei.",
  },
  "REF-002": {
    severity: "error",
    template: "[Reisekosten | Zeile {row}] Kunde passt nicht zum referenzierten Zeiteintrag.",
    explanation: "Kundenzuordnung zwischen Reise- und Zeitzeile ist widersprüchlich.",
  },
  "REF-003": {
    severity: "warning",
    template: "[Reisekosten | Zeile {row}] Kein Zeiteintrag referenziert, Fallback-Matching nötig.",
    explanation: "Import versucht Kunde+Datum+Projekt als Zuordnung.",
  },
  "DUP-001": {
    severity: "error",
    template: "[Reisekosten | Zeile {row}] expense_external_id ist doppelt.",
    explanation: "Jede Reisekostenzeile muss eindeutig sein.",
  },
  "DUP-002": {
    severity: "warning",
    template: "[Reisekosten | Zeile {row}] Mögliche Beleg-Dublette erkannt.",
    explanation: "receipt_no+date+amount+currency+vendorName überschneiden sich.",
  },
};

const REQUIRED_CUSTOMER_COLUMNS = [
  "customer_external_id",
  "mandanten_nr",
  "provider",
  "project_name",
] as const;

const REQUIRED_TIME_COLUMNS = [
  "time_entry_external_id",
  "customer_external_id",
  "date",
  "entry_type",
  "minutes",
] as const;

const REQUIRED_EXPENSE_COLUMNS = [
  "expense_external_id",
  "customer_external_id",
  "date",
  "category",
  "amount",
  "currency",
  "project_name",
] as const;

const ENTRY_TYPES = new Set(["onsite", "remote", "off_duty", "business_trip"]);
const EXPENSE_CATEGORIES = new Set([
  "car",
  "train",
  "flight",
  "taxi",
  "transport",
  "meal",
  "hotel",
  "food",
  "fuel",
  "other",
]);

function toUpper(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function readString(row: Record<string, unknown>, key: string): string {
  return String(row[key] ?? "").trim();
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:[.,]|$))/g, "")
    .replace(",", ".");
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: unknown): number | null {
  const parsed = parseNumber(value);
  if (parsed === null) return null;
  return Number.isInteger(parsed) ? parsed : null;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isIsoTime(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function addIssue(
  issues: ImportIssue[],
  issue: Omit<ImportIssue, "severity"> & { severity?: ImportIssueSeverity }
) {
  issues.push({
    severity: issue.severity ?? "error",
    ...issue,
  });
}

function getSheetRows(workbook: XLSX.WorkBook, sheetName: string): Record<string, unknown>[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows.map(rawRow => {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawRow)) {
      normalized[normalizeHeader(key)] = value;
    }
    return normalized;
  });
}

function getSheetHeaders(workbook: XLSX.WorkBook, sheetName: string): string[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as unknown[][];
  const firstRow = Array.isArray(matrix[0]) ? matrix[0] : [];
  return firstRow
    .map(cell => normalizeHeader(cell))
    .filter(Boolean);
}

function sheetHasDataRows(workbook: XLSX.WorkBook, sheetName: string): boolean {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return false;
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as unknown[][];
  if (matrix.length < 2) return false;
  for (const row of matrix.slice(1)) {
    if (!Array.isArray(row)) continue;
    if (row.some(cell => String(cell ?? "").trim().length > 0)) {
      return true;
    }
  }
  return false;
}

function detectSheetTypeByHeaders(headers: string[]): "Kunden" | "Zeiteintraege" | "Reisekosten" | null {
  const available = new Set(headers);
  const hasAll = (columns: readonly string[]) => columns.every(col => available.has(col));
  if (hasAll(REQUIRED_CUSTOMER_COLUMNS)) return "Kunden";
  if (hasAll(REQUIRED_TIME_COLUMNS)) return "Zeiteintraege";
  if (hasAll(REQUIRED_EXPENSE_COLUMNS)) return "Reisekosten";
  return null;
}

export function parseWorkbookV1(workbook: XLSX.WorkBook): ParsedImportWorkbook {
  let customerRows = getSheetRows(workbook, "Kunden");
  let timeRows = getSheetRows(workbook, "Zeiteintraege");
  let expenseRows = getSheetRows(workbook, "Reisekosten");

  if (
    customerRows.length === 0 &&
    timeRows.length === 0 &&
    expenseRows.length === 0 &&
    workbook.SheetNames.length === 1
  ) {
    const fallbackRows = getSheetRows(workbook, workbook.SheetNames[0]);
    const detected = detectSheetTypeByHeaders(getSheetHeaders(workbook, workbook.SheetNames[0]));
    if (detected === "Kunden") customerRows = fallbackRows;
    if (detected === "Zeiteintraege") timeRows = fallbackRows;
    if (detected === "Reisekosten") expenseRows = fallbackRows;
  }

  return {
    customers: customerRows.map((row, index) => ({
      rowNumber: index + 2,
      customerExternalId: readString(row, "customer_external_id"),
      mandantenNr: readString(row, "mandanten_nr"),
      provider: readString(row, "provider"),
      projectName: readString(row, "project_name"),
      projectNr: readString(row, "project_nr"),
      location: readString(row, "location"),
      costModel: readString(row, "cost_model").toLowerCase() === "inclusive" ? "inclusive" : "exclusive",
      standardDayHours: parseNumber(row.standard_day_hours) ?? 8,
      onsiteRate: parseNumber(row.onsite_rate) ?? 0,
      remoteRate: parseNumber(row.remote_rate) ?? 0,
      kmRate: parseNumber(row.km_rate) ?? 0,
      mealRate: parseNumber(row.meal_rate) ?? 0,
      defaultCurrency: toUpper(readString(row, "default_currency") || "EUR"),
    })),
    timeEntries: timeRows.map((row, index) => ({
      rowNumber: index + 2,
      timeEntryExternalId: readString(row, "time_entry_external_id"),
      customerExternalId: readString(row, "customer_external_id"),
      date: readString(row, "date"),
      projectName: readString(row, "project_name"),
      entryType: readString(row, "entry_type").toLowerCase() as TimeEntryImportRow["entryType"],
      minutes: parseInteger(row.minutes) ?? 0,
      description: readString(row, "description"),
    })),
    expenses: expenseRows.map((row, index) => ({
      rowNumber: index + 2,
      expenseExternalId: readString(row, "expense_external_id"),
      timeEntryExternalId: readString(row, "time_entry_external_id"),
      customerExternalId: readString(row, "customer_external_id"),
      mandantenNr: readString(row, "mandanten_nr"),
      projectName: readString(row, "project_name"),
      date: readString(row, "date"),
      category: readString(row, "category").toLowerCase() as ExpenseImportRow["category"],
      amount: parseNumber(row.amount) ?? 0,
      currency: toUpper(readString(row, "currency")),
      fullDay: (readString(row, "full_day") as "0" | "1" | "") || "",
      comment: readString(row, "comment"),
      flightRouteType: (readString(row, "flight_route_type").toLowerCase() as
        | "domestic"
        | "international"
        | "") || "",
      departureTime: readString(row, "departure_time"),
      arrivalTime: readString(row, "arrival_time"),
      returnDate: readString(row, "return_date"),
      ticketNumber: readString(row, "ticket_number"),
      flightNumber: readString(row, "flight_number"),
      checkInDate: readString(row, "check_in_date"),
      checkOutDate: readString(row, "check_out_date"),
      nights: parseInteger(row.nights),
      distanceKm: parseNumber(row.distance_km),
      ratePerKm: parseNumber(row.rate_per_km),
      liters: parseNumber(row.liters),
      pricePerLiter: parseNumber(row.price_per_liter),
      receiptNo: readString(row, "receipt_no"),
      vendorName: readString(row, "vendor_name"),
    })),
  };
}

export function validateWorkbookStructure(workbook: XLSX.WorkBook): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const requiredSheets = ["Kunden", "Zeiteintraege", "Reisekosten"] as const;
  const existingRequiredSheets = requiredSheets.filter(sheet => workbook.SheetNames.includes(sheet));

  if (existingRequiredSheets.length === 0 && workbook.SheetNames.length === 1) {
    const detected = detectSheetTypeByHeaders(getSheetHeaders(workbook, workbook.SheetNames[0]));
    if (!detected) {
      addIssue(issues, {
        code: "FMT-001",
        table: "Datei",
        row: 1,
        field: "sheet",
        message: `Datei-Fehler: Einzeltabelle konnte keinem Importtyp zugeordnet werden.`,
      });
      return issues;
    }
    const requiredColumnsByType = {
      Kunden: REQUIRED_CUSTOMER_COLUMNS as readonly string[],
      Zeiteintraege: REQUIRED_TIME_COLUMNS as readonly string[],
      Reisekosten: REQUIRED_EXPENSE_COLUMNS as readonly string[],
    };
    const headers = new Set(getSheetHeaders(workbook, workbook.SheetNames[0]));
    for (const col of requiredColumnsByType[detected]) {
      if (!headers.has(col)) {
        addIssue(issues, {
          code: "FMT-002",
          table: "Datei",
          row: 1,
          field: col,
          message: `[${detected}] Pflichtspalte "${col}" fehlt.`,
        });
      }
    }
    return issues;
  }

  if (existingRequiredSheets.length === 0) {
    addIssue(issues, {
      code: "FMT-001",
      table: "Datei",
      row: 1,
      field: "sheet",
      message: `Datei-Fehler: Keine der Tabellen Kunden, Zeiteintraege, Reisekosten gefunden.`,
    });
    return issues;
  }

  let hasAnyDataRows = false;

  const checkRequiredColumnsForSheet = (
    sheet: "Kunden" | "Zeiteintraege" | "Reisekosten",
    requiredColumns: readonly string[]
  ) => {
    const headers = getSheetHeaders(workbook, sheet);
    const available = new Set(headers);
    for (const col of requiredColumns) {
      if (!available.has(col)) {
        addIssue(issues, {
          code: "FMT-002",
          table: "Datei",
          row: 1,
          field: col,
          message: `[${sheet}] Pflichtspalte "${col}" fehlt.`,
        });
      }
    }
    if (sheetHasDataRows(workbook, sheet)) {
      hasAnyDataRows = true;
    }
  };

  for (const sheet of existingRequiredSheets) {
    if (sheet === "Kunden") checkRequiredColumnsForSheet("Kunden", REQUIRED_CUSTOMER_COLUMNS);
    if (sheet === "Zeiteintraege") checkRequiredColumnsForSheet("Zeiteintraege", REQUIRED_TIME_COLUMNS);
    if (sheet === "Reisekosten") checkRequiredColumnsForSheet("Reisekosten", REQUIRED_EXPENSE_COLUMNS);
  }

  if (!hasAnyDataRows) {
    addIssue(issues, {
      code: "FMT-003",
      table: "Datei",
      row: 1,
      field: "rows",
      message: "[Datei] Keine Datenzeilen gefunden.",
    });
  }

  return issues;
}

export function validateParsedWorkbook(parsed: ParsedImportWorkbook): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const hasCustomerRows = parsed.customers.length > 0;
  const hasTimeEntryRows = parsed.timeEntries.length > 0;

  const customerIds = new Set<string>();
  const mandantenNumbers = new Set<string>();
  for (const row of parsed.customers) {
    if (!row.customerExternalId) {
      addIssue(issues, {
        code: "CUS-001",
        table: "Kunden",
        row: row.rowNumber,
        field: "customer_external_id",
        message: `[Kunden | Zeile ${row.rowNumber}] customer_external_id fehlt.`,
      });
    } else if (customerIds.has(row.customerExternalId)) {
      addIssue(issues, {
        code: "CUS-002",
        table: "Kunden",
        row: row.rowNumber,
        field: "customer_external_id",
        message: `[Kunden | Zeile ${row.rowNumber}] customer_external_id doppelt.`,
      });
    } else {
      customerIds.add(row.customerExternalId);
    }

    if (!/^\d{3}$/.test(row.mandantenNr)) {
      addIssue(issues, {
        code: "CUS-003",
        table: "Kunden",
        row: row.rowNumber,
        field: "mandanten_nr",
        message: `[Kunden | Zeile ${row.rowNumber}] mandanten_nr ist ungültig.`,
      });
    } else if (mandantenNumbers.has(row.mandantenNr)) {
      addIssue(issues, {
        code: "CUS-004",
        severity: "warning",
        table: "Kunden",
        row: row.rowNumber,
        field: "mandanten_nr",
        message: `[Kunden | Zeile ${row.rowNumber}] mandanten_nr kommt mehrfach vor.`,
      });
    } else {
      mandantenNumbers.add(row.mandantenNr);
    }

    if (!row.provider) {
      addIssue(issues, {
        code: "CUS-005",
        table: "Kunden",
        row: row.rowNumber,
        field: "provider",
        message: `[Kunden | Zeile ${row.rowNumber}] provider fehlt.`,
      });
    }
    if (!row.projectName) {
      addIssue(issues, {
        code: "CUS-006",
        table: "Kunden",
        row: row.rowNumber,
        field: "project_name",
        message: `[Kunden | Zeile ${row.rowNumber}] project_name fehlt.`,
      });
    }
  }

  const timeEntryIds = new Set<string>();
  const timeEntryCustomerById = new Map<string, string>();
  for (const row of parsed.timeEntries) {
    if (!row.timeEntryExternalId) {
      addIssue(issues, {
        code: "TIM-005",
        table: "Zeiteintraege",
        row: row.rowNumber,
        field: "time_entry_external_id",
        message: `[Zeiteintraege | Zeile ${row.rowNumber}] time_entry_external_id fehlt.`,
      });
    } else if (timeEntryIds.has(row.timeEntryExternalId)) {
      addIssue(issues, {
        code: "TIM-006",
        table: "Zeiteintraege",
        row: row.rowNumber,
        field: "time_entry_external_id",
        message: `[Zeiteintraege | Zeile ${row.rowNumber}] time_entry_external_id ist doppelt.`,
      });
    } else {
      timeEntryIds.add(row.timeEntryExternalId);
      timeEntryCustomerById.set(row.timeEntryExternalId, row.customerExternalId);
    }

    if (!customerIds.has(row.customerExternalId)) {
      addIssue(issues, {
        code: "TIM-001",
        severity: hasCustomerRows ? "error" : "warning",
        table: "Zeiteintraege",
        row: row.rowNumber,
        field: "customer_external_id",
        message: hasCustomerRows
          ? `[Zeiteintraege | Zeile ${row.rowNumber}] customer_external_id nicht gefunden.`
          : `[Zeiteintraege | Zeile ${row.rowNumber}] customer_external_id nicht in Importdatei gefunden (wird gegen Bestand aufgelöst).`,
      });
    }
    if (!isIsoDate(row.date)) {
      addIssue(issues, {
        code: "TIM-002",
        table: "Zeiteintraege",
        row: row.rowNumber,
        field: "date",
        message: `[Zeiteintraege | Zeile ${row.rowNumber}] date ungültig.`,
      });
    }
    if (!ENTRY_TYPES.has(row.entryType)) {
      addIssue(issues, {
        code: "TIM-003",
        table: "Zeiteintraege",
        row: row.rowNumber,
        field: "entry_type",
        message: `[Zeiteintraege | Zeile ${row.rowNumber}] entry_type ungültig.`,
      });
    }
    if (!Number.isInteger(row.minutes) || row.minutes < 1 || row.minutes > 1440) {
      addIssue(issues, {
        code: "TIM-004",
        table: "Zeiteintraege",
        row: row.rowNumber,
        field: "minutes",
        message: `[Zeiteintraege | Zeile ${row.rowNumber}] minutes ungültig.`,
      });
    }
  }

  const expenseIds = new Set<string>();
  const duplicateCompositeSet = new Set<string>();
  for (const row of parsed.expenses) {
    if (!row.expenseExternalId) {
      addIssue(issues, {
        code: "EXP-005",
        table: "Reisekosten",
        row: row.rowNumber,
        field: "expense_external_id",
        message: `[Reisekosten | Zeile ${row.rowNumber}] expense_external_id fehlt.`,
      });
    } else if (expenseIds.has(row.expenseExternalId)) {
      addIssue(issues, {
        code: "DUP-001",
        table: "Reisekosten",
        row: row.rowNumber,
        field: "expense_external_id",
        message: `[Reisekosten | Zeile ${row.rowNumber}] expense_external_id ist doppelt.`,
      });
    } else {
      expenseIds.add(row.expenseExternalId);
    }

    if (!customerIds.has(row.customerExternalId)) {
      addIssue(issues, {
        code: "EXP-006",
        severity: hasCustomerRows ? "error" : "warning",
        table: "Reisekosten",
        row: row.rowNumber,
        field: "customer_external_id",
        message: hasCustomerRows
          ? `[Reisekosten | Zeile ${row.rowNumber}] customer_external_id nicht gefunden.`
          : `[Reisekosten | Zeile ${row.rowNumber}] customer_external_id nicht in Importdatei gefunden (wird gegen Bestand aufgelöst).`,
      });
    }
    if (!isIsoDate(row.date)) {
      addIssue(issues, {
        code: "EXP-004",
        table: "Reisekosten",
        row: row.rowNumber,
        field: "date",
        message: `[Reisekosten | Zeile ${row.rowNumber}] date ungültig.`,
      });
    }
    if (!EXPENSE_CATEGORIES.has(row.category)) {
      addIssue(issues, {
        code: "EXP-001",
        table: "Reisekosten",
        row: row.rowNumber,
        field: "category",
        message: `[Reisekosten | Zeile ${row.rowNumber}] category ungültig.`,
      });
    }
    if (!Number.isFinite(row.amount) || row.amount <= 0) {
      addIssue(issues, {
        code: "EXP-002",
        table: "Reisekosten",
        row: row.rowNumber,
        field: "amount",
        message: `[Reisekosten | Zeile ${row.rowNumber}] amount fehlt oder <= 0.`,
      });
    }
    if (!/^[A-Z]{3}$/.test(row.currency)) {
      addIssue(issues, {
        code: "EXP-003",
        table: "Reisekosten",
        row: row.rowNumber,
        field: "currency",
        message: `[Reisekosten | Zeile ${row.rowNumber}] currency ungültig.`,
      });
    }
    if (row.fullDay && row.fullDay !== "0" && row.fullDay !== "1") {
      addIssue(issues, {
        code: "EXP-007",
        table: "Reisekosten",
        row: row.rowNumber,
        field: "full_day",
        message: `[Reisekosten | Zeile ${row.rowNumber}] full_day erlaubt nur 0 oder 1.`,
      });
    }

    if (row.timeEntryExternalId) {
      if (!timeEntryIds.has(row.timeEntryExternalId)) {
        addIssue(issues, {
          code: "REF-001",
          severity: hasTimeEntryRows ? "error" : "warning",
          table: "Reisekosten",
          row: row.rowNumber,
          field: "time_entry_external_id",
          message: hasTimeEntryRows
            ? `[Reisekosten | Zeile ${row.rowNumber}] time_entry_external_id nicht gefunden.`
            : `[Reisekosten | Zeile ${row.rowNumber}] time_entry_external_id nicht in Importdatei gefunden (wird gegen Bestand aufgelöst).`,
        });
      } else {
        const mappedCustomerExternalId = timeEntryCustomerById.get(row.timeEntryExternalId);
        if (mappedCustomerExternalId && mappedCustomerExternalId !== row.customerExternalId) {
          addIssue(issues, {
            code: "REF-002",
            table: "Reisekosten",
            row: row.rowNumber,
            field: "customer_external_id",
            message: `[Reisekosten | Zeile ${row.rowNumber}] Kunde passt nicht zum referenzierten Zeiteintrag.`,
          });
        }
      }
    } else {
      addIssue(issues, {
        code: "REF-003",
        severity: "warning",
        table: "Reisekosten",
        row: row.rowNumber,
        field: "time_entry_external_id",
        message: `[Reisekosten | Zeile ${row.rowNumber}] Kein Zeiteintrag referenziert, Fallback-Matching nötig.`,
      });
    }

    if (row.category === "flight") {
      if (row.flightRouteType === "international") {
        if (!row.departureTime) {
          addIssue(issues, {
            code: "EXP-FLT-001",
            table: "Reisekosten",
            row: row.rowNumber,
            field: "departure_time",
            message: `[Reisekosten | Zeile ${row.rowNumber}] Internationaler Flug ohne Abflugzeit.`,
          });
        }
        if (!row.arrivalTime) {
          addIssue(issues, {
            code: "EXP-FLT-002",
            table: "Reisekosten",
            row: row.rowNumber,
            field: "arrival_time",
            message: `[Reisekosten | Zeile ${row.rowNumber}] Internationaler Flug ohne Ankunftszeit.`,
          });
        }
      }
      if (row.departureTime && !isIsoTime(row.departureTime)) {
        addIssue(issues, {
          code: "EXP-FLT-003",
          table: "Reisekosten",
          row: row.rowNumber,
          field: "departure_time",
          message: `[Reisekosten | Zeile ${row.rowNumber}] departure_time ungültig.`,
        });
      }
      if (row.arrivalTime && !isIsoTime(row.arrivalTime)) {
        addIssue(issues, {
          code: "EXP-FLT-005",
          table: "Reisekosten",
          row: row.rowNumber,
          field: "arrival_time",
          message: `[Reisekosten | Zeile ${row.rowNumber}] arrival_time ungültig.`,
        });
      }
      if (row.returnDate && (!isIsoDate(row.returnDate) || row.returnDate < row.date)) {
        addIssue(issues, {
          code: "EXP-FLT-004",
          table: "Reisekosten",
          row: row.rowNumber,
          field: "return_date",
          message: `[Reisekosten | Zeile ${row.rowNumber}] return_date liegt vor date.`,
        });
      }
    }

    if (row.category === "hotel") {
      if (!row.checkInDate || !isIsoDate(row.checkInDate)) {
        addIssue(issues, {
          code: "EXP-HOT-001",
          table: "Reisekosten",
          row: row.rowNumber,
          field: "check_in_date",
          message: `[Reisekosten | Zeile ${row.rowNumber}] check_in_date fehlt (hotel).`,
        });
      }
      if (row.nights === null && !row.checkOutDate) {
        addIssue(issues, {
          code: "EXP-HOT-002",
          table: "Reisekosten",
          row: row.rowNumber,
          field: "nights",
          message: `[Reisekosten | Zeile ${row.rowNumber}] nights oder check_out_date fehlt (hotel).`,
        });
      }
      if (row.nights !== null && row.nights < 0) {
        addIssue(issues, {
          code: "EXP-HOT-003",
          table: "Reisekosten",
          row: row.rowNumber,
          field: "nights",
          message: `[Reisekosten | Zeile ${row.rowNumber}] nights ist negativ.`,
        });
      }
      if (row.checkInDate && row.checkOutDate && isIsoDate(row.checkInDate) && isIsoDate(row.checkOutDate) && row.checkOutDate < row.checkInDate) {
        addIssue(issues, {
          code: "EXP-HOT-004",
          table: "Reisekosten",
          row: row.rowNumber,
          field: "check_out_date",
          message: `[Reisekosten | Zeile ${row.rowNumber}] check_out_date liegt vor check_in_date.`,
        });
      }
    }

    if (row.category === "fuel") {
      if (row.liters === null || row.liters <= 0) {
        addIssue(issues, {
          code: "EXP-FUEL-001",
          table: "Reisekosten",
          row: row.rowNumber,
          field: "liters",
          message: `[Reisekosten | Zeile ${row.rowNumber}] liters fehlt oder <= 0 (fuel).`,
        });
      }
      if (row.pricePerLiter === null || row.pricePerLiter <= 0) {
        addIssue(issues, {
          code: "EXP-FUEL-002",
          table: "Reisekosten",
          row: row.rowNumber,
          field: "price_per_liter",
          message: `[Reisekosten | Zeile ${row.rowNumber}] price_per_liter fehlt oder <= 0 (fuel).`,
        });
      }
    }

    const composite = [
      row.receiptNo.toUpperCase(),
      row.date,
      row.amount.toFixed(2),
      row.currency,
      row.vendorName.toUpperCase(),
    ].join("|");
    if (row.receiptNo && duplicateCompositeSet.has(composite)) {
      addIssue(issues, {
        code: "DUP-002",
        severity: "warning",
        table: "Reisekosten",
        row: row.rowNumber,
        field: "receipt_no",
        message: `[Reisekosten | Zeile ${row.rowNumber}] Mögliche Beleg-Dublette erkannt.`,
      });
    } else if (row.receiptNo) {
      duplicateCompositeSet.add(composite);
    }
  }

  return issues;
}

export function hasBlockingIssues(issues: ImportIssue[]): boolean {
  return issues.some(issue => issue.severity === "error");
}

