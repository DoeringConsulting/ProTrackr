import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, uniqueIndex, index } from "drizzle-orm/mysql-core";

// ✅ AUTH TABLES RESTORED
/**
 * Users table - application users for authentication
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  mandantId: int("mandantId").notNull(), // Foreign key to mandanten
  email: varchar("email", { length: 320 }).notNull(), // Removed unique - unique per mandant
  passwordHash: varchar("passwordHash", { length: 255 }),     // bestehender Spaltenname in DB
  displayName: varchar("name", { length: 255 }),              // bestehender Spaltenname "name" in DB
  role: varchar("role", { length: 50 }).default("user").notNull(),
  accountStatus: mysqlEnum("accountStatus", ["active", "suspended", "deleted"]).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Mandanten table - multi-tenancy support
 */
export const mandanten = mysqlTable("mandanten", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  mandantNr: varchar("mandantNr", { length: 50 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Mandant = typeof mandanten.$inferSelect;
export type InsertMandant = typeof mandanten.$inferInsert;

/**
 * Password reset tokens - one-time tokens for secure password recovery
 */
export const passwordResetTokens = mysqlTable("passwordResetTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tokenHashUnique: uniqueIndex("password_reset_tokens_hash_unique").on(table.tokenHash),
  userIdIdx: index("password_reset_tokens_user_idx").on(table.userId),
}));

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

/**
 * Customers table - stores client master data
 */
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"), // owner (creator/backfilled from first related time entry)
  provider: varchar("provider", { length: 255 }).notNull(),
  mandatenNr: varchar("mandatenNr", { length: 50 }).notNull(),
  projectName: varchar("projectName", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  onsiteRate: int("onsiteRate").notNull(), // in cents
  onsiteRateCurrency: varchar("onsiteRateCurrency", { length: 3 }).default("EUR").notNull(),
  remoteRate: int("remoteRate").notNull(), // in cents
  remoteRateCurrency: varchar("remoteRateCurrency", { length: 3 }).default("EUR").notNull(),
  kmRate: int("kmRate").notNull(), // in cents per km
  kmRateCurrency: varchar("kmRateCurrency", { length: 3 }).default("EUR").notNull(),
  mealRate: int("mealRate").notNull(), // in cents per day
  mealRateCurrency: varchar("mealRateCurrency", { length: 3 }).default("EUR").notNull(),
  costModel: mysqlEnum("costModel", ["exclusive", "inclusive"]).notNull(),
  isArchived: int("isArchived").default(0).notNull(), // 0 = active, 1 = archived
  // Billing address fields
  street: varchar("street", { length: 255 }),
  postalCode: varchar("postalCode", { length: 20 }),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }),
  vatId: varchar("vatId", { length: 50 }), // VAT/USt-ID
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userMandantenNrUnique: uniqueIndex("customers_user_mandaten_unique").on(table.userId, table.mandatenNr),
}));

export type Customer = typeof customers.$inferSelect;

export type InsertCustomer = typeof customers.$inferInsert;

/**
 * Invoice numbers table - auto-generated invoice numbers with year prefix
 */
export const invoiceNumbers = mysqlTable("invoiceNumbers", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").notNull(),
  number: int("number").notNull(), // sequential number within year
  invoiceNumber: varchar("invoiceNumber", { length: 20 }).notNull().unique(), // formatted: YYYY-NNN
  customerId: int("customerId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InvoiceNumber = typeof invoiceNumbers.$inferSelect;
export type InsertInvoiceNumber = typeof invoiceNumbers.$inferInsert;

/**
 * Time entries table - daily time tracking
 */
export const timeEntries = mysqlTable("timeEntries", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  userId: int("userId").notNull(),
  date: timestamp("date").notNull(),
  weekday: varchar("weekday", { length: 10 }).notNull(),
  projectName: varchar("projectName", { length: 255 }).notNull(),
  entryType: mysqlEnum("entryType", ["onsite", "remote", "off_duty", "business_trip"]).notNull(),
  description: text("description"),
  hours: int("hours").notNull(), // stored as minutes
  rate: int("rate").notNull(), // in EUR cents (daily or hourly)
  calculatedAmount: int("calculatedAmount").notNull(), // in EUR cents
  manDays: int("manDays").notNull(), // stored as thousandths (e.g., 125 = 0.125)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = typeof timeEntries.$inferInsert;

/**
 * Expenses table - travel costs per time entry
 */
export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  timeEntryId: int("timeEntryId"),
  userId: int("userId"), // owner for standalone expenses (and optional duplicate for linked)
  date: timestamp("date", { mode: "string" }).notNull(), // Direct date for standalone expenses
  category: mysqlEnum("category", [
    "car",           // Mietwagen
    "train",         // Zug
    "flight",        // Flug
    "taxi",          // Taxi
    "transport",     // Transport (legacy, wird zu taxi migriert)
    "hotel",         // Hotel
    "fuel",          // Tanken
    "meal",          // Bewirtung
    "food",          // Food (legacy, wird zu meal migriert)
    "other"          // Sonstiges
  ]).notNull(),
  distance: int("distance"), // in km (for car)
  rate: int("rate"), // in EUR cents per unit
  amount: int("amount").notNull(), // in currency cents
  currency: varchar("currency", { length: 3 }).notNull().default("EUR"), // ISO 4217 currency code
  comment: text("comment"),
  // Onsite travel allowance fields (Polish accounting)
  travelStart: varchar("travelStart", { length: 5 }), // HH:MM
  travelEnd: varchar("travelEnd", { length: 5 }), // HH:MM
  fullDay: int("fullDay").default(0).notNull(), // 0 = no, 1 = yes
  // Flight/Train specific
  ticketNumber: varchar("ticketNumber", { length: 100 }),
  flightNumber: varchar("flightNumber", { length: 100 }),
  flightRouteType: varchar("flightRouteType", { length: 20 }),
  departureTime: varchar("departureTime", { length: 10 }), // HH:MM format
  arrivalTime: varchar("arrivalTime", { length: 10 }), // HH:MM format
  // Hotel specific
  checkInDate: timestamp("checkInDate", { mode: "string" }),
  checkOutDate: timestamp("checkOutDate", { mode: "string" }),
  // Fuel specific
  liters: int("liters"), // in milliliters (e.g., 45500 = 45.5L)
  pricePerLiter: int("pricePerLiter"), // in EUR cents
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

/**
 * Documents table - receipts and invoices
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  expenseId: int("expenseId"),
  timeEntryId: int("timeEntryId"),
  userId: int("userId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileSize: int("fileSize").notNull(), // in bytes
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * Exchange rates table - EUR/PLN rates from NBP
 */
export const exchangeRates = mysqlTable("exchangeRates", {
  id: int("id").autoincrement().primaryKey(),
  date: timestamp("date").notNull(),
  currencyPair: varchar("currencyPair", { length: 10 }).notNull().default("EUR/PLN"),
  userId: int("userId").notNull().default(0), // 0 = global/NBP, >0 = user-specific manual
  rate: int("rate").notNull(), // stored as ten-thousandths (e.g., 42369 = 4.2369)
  source: varchar("source", { length: 50 }).notNull().default("NBP"),
  isManual: int("isManual").default(0).notNull(), // 0 = auto, 1 = manual override
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  // Unique per date+pair+scope (global scope = userId 0, user scope = userId > 0)
  dateCurrencyUserUnique: uniqueIndex("date_currency_user_unique").on(table.date, table.currencyPair, table.userId),
}));

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertExchangeRate = typeof exchangeRates.$inferInsert;

/**
 * Fixed costs table - for accounting calculations
 */
export const fixedCosts = mysqlTable("fixedCosts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  amount: int("amount").notNull(), // in currency cents
  currency: varchar("currency", { length: 3 }).notNull().default("PLN"), // ISO 4217 currency code
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FixedCost = typeof fixedCosts.$inferSelect;
export type InsertFixedCost = typeof fixedCosts.$inferInsert;

/**
 * Tax settings table - configurable tax rates and fixed amounts
 */
export const taxSettings = mysqlTable("taxSettings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // one setting per user
  zusType: mysqlEnum("zusType", ["percentage", "fixed"]).notNull().default("percentage"),
  zusValue: int("zusValue").notNull(), // percentage in basis points (1952 = 19.52%) or fixed amount in PLN cents
  healthInsuranceType: mysqlEnum("healthInsuranceType", ["percentage", "fixed"]).notNull().default("percentage"),
  healthInsuranceValue: int("healthInsuranceValue").notNull(), // percentage in basis points (900 = 9%) or fixed amount in PLN cents
  taxType: mysqlEnum("taxType", ["percentage", "fixed"]).notNull().default("percentage"),
  taxValue: int("taxValue").notNull(), // percentage in basis points (1900 = 19%) or fixed amount in PLN cents
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TaxSetting = typeof taxSettings.$inferSelect;
export type InsertTaxSetting = typeof taxSettings.$inferInsert;

/**
 * Tax profile table (PL JDG) - user specific regime and rates
 */
export const taxProfiles = mysqlTable("taxProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  taxCalculationMode: mysqlEnum("taxCalculationMode", ["normal", "zero"]).notNull().default("normal"),
  taxForm: mysqlEnum("taxForm", ["liniowy_19"]).notNull().default("liniowy_19"),
  zusRegime: mysqlEnum("zusRegime", [
    "ulga_na_start",
    "preferencyjny_zus",
    "maly_zus_plus",
    "pelny_zus",
  ]).notNull().default("pelny_zus"),
  choroboweEnabled: int("choroboweEnabled").notNull().default(0), // 0 = false, 1 = true
  fpFsEnabled: int("fpFsEnabled").notNull().default(1), // 0 = false, 1 = true
  wypadkowaRateBp: int("wypadkowaRateBp").notNull().default(167), // basis points (1.67%)
  zdrowotnaRateLiniowyBp: int("zdrowotnaRateLiniowyBp").notNull().default(490), // 4.9%
  pitRateBp: int("pitRateBp").notNull().default(1900), // 19%
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TaxProfile = typeof taxProfiles.$inferSelect;
export type InsertTaxProfile = typeof taxProfiles.$inferInsert;

/**
 * Tax config per year (PL legal bases/limits)
 */
export const taxConfigPl = mysqlTable("taxConfigPl", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").notNull().unique(),
  socialMinBaseCents: int("socialMinBaseCents").notNull(), // e.g. 5652.00 PLN => 565200
  zdrowotnaMinBaseCents: int("zdrowotnaMinBaseCents").notNull(),
  zdrowotnaMinAmountCents: int("zdrowotnaMinAmountCents").notNull(),
  zdrowotnaDeductionLimitYearlyCents: int("zdrowotnaDeductionLimitYearlyCents").notNull(),
  socialContributionRateBp: int("socialContributionRateBp").notNull().default(1952), // 19.52%
  choroboweRateBp: int("choroboweRateBp").notNull().default(245), // 2.45%
  fpFsRateBp: int("fpFsRateBp").notNull().default(245), // 2.45%
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TaxConfigPl = typeof taxConfigPl.$inferSelect;
export type InsertTaxConfigPl = typeof taxConfigPl.$inferInsert;

/**
 * Account settings table - company logo and user preferences
 * Note: Multi-user functionality is planned but not yet implemented
 */
export const accountSettings = mysqlTable("accountSettings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // one setting per user
  companyName: varchar("companyName", { length: 255 }),
  companyLogoUrl: varchar("companyLogoUrl", { length: 1000 }),
  companyLogoKey: varchar("companyLogoKey", { length: 500 }),
  // Billing address (can override per invoice)
  street: varchar("street", { length: 255 }),
  postalCode: varchar("postalCode", { length: 20 }),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }),
  vatId: varchar("vatId", { length: 50 }), // VAT/USt-ID
  taxNumber: varchar("taxNumber", { length: 50 }), // Polish NIP or other tax ID
  bankName: varchar("bankName", { length: 255 }),
  iban: varchar("iban", { length: 50 }),
  swift: varchar("swift", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AccountSetting = typeof accountSettings.$inferSelect;
export type InsertAccountSetting = typeof accountSettings.$inferInsert;