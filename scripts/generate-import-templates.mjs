import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const outputDir = path.resolve("client/public/import-templates");
fs.mkdirSync(outputDir, { recursive: true });

const customerHeaders = [
  "customer_external_id",
  "mandanten_nr",
  "provider",
  "project_name",
  "project_nr",
  "location",
  "cost_model",
  "standard_day_hours",
  "onsite_rate",
  "remote_rate",
  "km_rate",
  "meal_rate",
  "default_currency",
];

const timeHeaders = [
  "time_entry_external_id",
  "customer_external_id",
  "date",
  "project_name",
  "entry_type",
  "minutes",
  "description",
];

const expenseHeaders = [
  "expense_external_id",
  "time_entry_external_id",
  "customer_external_id",
  "mandanten_nr",
  "project_name",
  "date",
  "category",
  "amount",
  "currency",
  "full_day",
  "comment",
  "flight_route_type",
  "departure_time",
  "arrival_time",
  "return_date",
  "ticket_number",
  "flight_number",
  "check_in_date",
  "check_out_date",
  "nights",
  "distance_km",
  "rate_per_km",
  "liters",
  "price_per_liter",
  "receipt_no",
  "vendor_name",
];

const templateWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(templateWorkbook, XLSX.utils.aoa_to_sheet([customerHeaders]), "Kunden");
XLSX.utils.book_append_sheet(templateWorkbook, XLSX.utils.aoa_to_sheet([timeHeaders]), "Zeiteintraege");
XLSX.utils.book_append_sheet(templateWorkbook, XLSX.utils.aoa_to_sheet([expenseHeaders]), "Reisekosten");

XLSX.writeFile(templateWorkbook, path.join(outputDir, "reisekosten-import-template-v1.xlsx"));

const customerRows = [
  customerHeaders,
  [
    "CUST-003",
    "003",
    "Corpuls GmbH",
    "Corpuls Rollout",
    "PRJ-CP-2026",
    "Warschau",
    "exclusive",
    10,
    1200,
    950,
    0.59,
    45,
    "EUR",
  ],
];

const timeRows = [
  timeHeaders,
  ["TE-2026-03-01-01", "CUST-003", "2026-03-01", "Corpuls Rollout", "onsite", 480, "Kickoff Workshop"],
  ["TE-2026-03-02-01", "CUST-003", "2026-03-02", "Corpuls Rollout", "business_trip", 600, "Onsite + Reise"],
  ["TE-2026-03-11-01", "CUST-003", "2026-03-11", "Corpuls Rollout", "onsite", 540, "GoLive Support"],
];

const expenseRows = [
  expenseHeaders,
  [
    "EXP-2026-03-01",
    "TE-2026-03-01-01",
    "CUST-003",
    "003",
    "Corpuls Rollout",
    "2026-03-01",
    "taxi",
    185.0,
    "PLN",
    "0",
    "Flughafen zum Hotel",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "TX-88421",
    "iTaxi",
  ],
  [
    "EXP-2026-03-02",
    "TE-2026-03-02-01",
    "CUST-003",
    "003",
    "Corpuls Rollout",
    "2026-03-02",
    "flight",
    420.0,
    "EUR",
    "0",
    "Hinflug MUC-WAW",
    "domestic",
    "08:30",
    "10:05",
    "",
    "LH2040",
    "LH2040",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "FL-2201",
    "Lufthansa",
  ],
  [
    "EXP-2026-03-03",
    "TE-2026-03-02-01",
    "CUST-003",
    "003",
    "Corpuls Rollout",
    "2026-03-03",
    "hotel",
    1450.0,
    "PLN",
    "0",
    "Hotel Warszawa 3 Nächte",
    "",
    "",
    "",
    "",
    "",
    "",
    "2026-03-03",
    "2026-03-06",
    3,
    "",
    "",
    "",
    "",
    "HT-7712",
    "Hotel Centrum",
  ],
  [
    "EXP-2026-03-11",
    "TE-2026-03-11-01",
    "CUST-003",
    "003",
    "Corpuls Rollout",
    "2026-03-11",
    "fuel",
    320.5,
    "PLN",
    "0",
    "Tankfüllung Dienstwagen",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    42.3,
    7.58,
    "FU-1190",
    "Orlen",
  ],
  [
    "EXP-2026-03-12",
    "",
    "CUST-003",
    "003",
    "Corpuls Rollout",
    "2026-03-12",
    "meal",
    96.0,
    "PLN",
    "1",
    "Verpflegung ganzer Tag",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "ME-1102",
    "Bistro WAW",
  ],
];

const testWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(testWorkbook, XLSX.utils.aoa_to_sheet(customerRows), "Kunden");
XLSX.utils.book_append_sheet(testWorkbook, XLSX.utils.aoa_to_sheet(timeRows), "Zeiteintraege");
XLSX.utils.book_append_sheet(testWorkbook, XLSX.utils.aoa_to_sheet(expenseRows), "Reisekosten");
XLSX.writeFile(testWorkbook, path.join(outputDir, "reisekosten-import-testdaten-v1.xlsx"));

fs.writeFileSync(path.join(outputDir, "kunden-template-v1.csv"), XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet([customerHeaders]), { FS: ";" }));
fs.writeFileSync(path.join(outputDir, "zeiteintraege-template-v1.csv"), XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet([timeHeaders]), { FS: ";" }));
fs.writeFileSync(path.join(outputDir, "reisekosten-template-v1.csv"), XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet([expenseHeaders]), { FS: ";" }));
fs.writeFileSync(path.join(outputDir, "kunden-testdaten-v1.csv"), XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(customerRows), { FS: ";" }));
fs.writeFileSync(path.join(outputDir, "zeiteintraege-testdaten-v1.csv"), XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(timeRows), { FS: ";" }));
fs.writeFileSync(path.join(outputDir, "reisekosten-testdaten-v1.csv"), XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(expenseRows), { FS: ";" }));

console.log("Import templates generated in", outputDir);
