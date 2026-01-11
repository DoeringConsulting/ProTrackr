import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
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
  onsiteRate: int("onsiteRate").notNull(), // in EUR cents
  remoteRate: int("remoteRate").notNull(), // in EUR cents
  kmRate: int("kmRate").notNull(), // in EUR cents per km
  mealRate: int("mealRate").notNull(), // in EUR cents per day
  costModel: mysqlEnum("costModel", ["exclusive", "inclusive"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

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
    "car",
    "train",
    "flight",
    "transport",
    "meal",
    "hotel",
    "food",
    "fuel",
    "other"
  ]).notNull(),
  distance: int("distance"), // in km
  rate: int("rate"), // in EUR cents per unit
  amount: int("amount").notNull(), // in EUR cents
  comment: text("comment"),
  ticketNumber: varchar("ticketNumber", { length: 100 }),
  flightNumber: varchar("flightNumber", { length: 100 }),
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
  date: timestamp("date").notNull().unique(),
  currencyPair: varchar("currencyPair", { length: 10 }).notNull().default("EUR/PLN"),
  rate: int("rate").notNull(), // stored as ten-thousandths (e.g., 42369 = 4.2369)
  source: varchar("source", { length: 50 }).notNull().default("NBP"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertExchangeRate = typeof exchangeRates.$inferInsert;

/**
 * Fixed costs table - for accounting calculations
 */
export const fixedCosts = mysqlTable("fixedCosts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  amount: int("amount").notNull(), // in PLN cents
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FixedCost = typeof fixedCosts.$inferSelect;
export type InsertFixedCost = typeof fixedCosts.$inferInsert;