import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, uniqueIndex, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. Optional for Passport.js users. */
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  /** Password hash for Passport.js local authentication. NULL for OAuth users. */
  passwordHash: varchar("passwordHash", { length: 255 }),
  /** Password reset token for password recovery. */
  resetToken: varchar("resetToken", { length: 255 }),
  /** Password reset token expiration timestamp. */
  resetTokenExpiry: timestamp("resetTokenExpiry"),
  /** Email verification status. */
  emailVerified: int("emailVerified").default(0).notNull(), // 0 = not verified, 1 = verified
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Customers table - stores client master data
 */
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  provider: varchar("provider", { length: 255 }).notNull(),
  mandatenNr: varchar("mandatenNr", { length: 50 }).notNull().unique(),
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
});

export type Customer = typeof customers.$inferSelect;

/**
 * Customer Rate History table - tracks changes to customer rates over time
 */
export const customerRateHistory = mysqlTable("customerRateHistory", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull().references(() => customers.id, { onDelete: "cascade" }),
  onsiteRate: int("onsiteRate").notNull(), // in cents
  onsiteRateCurrency: varchar("onsiteRateCurrency", { length: 3 }).notNull(),
  remoteRate: int("remoteRate").notNull(), // in cents
  remoteRateCurrency: varchar("remoteRateCurrency", { length: 3 }).notNull(),
  kmRate: int("kmRate").notNull(), // in cents per km
  kmRateCurrency: varchar("kmRateCurrency", { length: 3 }).notNull(),
  mealRate: int("mealRate").notNull(), // in cents per day
  mealRateCurrency: varchar("mealRateCurrency", { length: 3 }).notNull(),
  costModel: mysqlEnum("costModel", ["exclusive", "inclusive"]).notNull(),
  validFrom: timestamp("validFrom").notNull(), // When this rate became effective
  validUntil: timestamp("validUntil"), // When this rate was replaced (NULL = current)
  changedBy: varchar("changedBy", { length: 255 }), // User who made the change
  changeReason: text("changeReason"), // Optional reason for the change
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  customerIdIdx: index("customerId_idx").on(table.customerId),
  validFromIdx: index("validFrom_idx").on(table.validFrom),
}));

export type CustomerRateHistory = typeof customerRateHistory.$inferSelect;
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
  timeEntryId: int("timeEntryId").notNull(),
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
  // Flight/Train specific
  ticketNumber: varchar("ticketNumber", { length: 100 }),
  flightNumber: varchar("flightNumber", { length: 100 }),
  departureTime: varchar("departureTime", { length: 10 }), // HH:MM format
  arrivalTime: varchar("arrivalTime", { length: 10 }), // HH:MM format
  // Hotel specific
  checkInDate: timestamp("checkInDate"),
  checkOutDate: timestamp("checkOutDate"),
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
  rate: int("rate").notNull(), // stored as ten-thousandths (e.g., 42369 = 4.2369)
  source: varchar("source", { length: 50 }).notNull().default("NBP"),
  isManual: int("isManual").default(0).notNull(), // 0 = auto, 1 = manual override
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  // Unique constraint on date + currencyPair combination to allow multiple currencies per date
  dateAndCurrencyUnique: uniqueIndex("date_currency_unique").on(table.date, table.currencyPair),
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