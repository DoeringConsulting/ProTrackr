import { relations } from "drizzle-orm";
import {
  accountSettings,
  customers,
  documents,
  expenseAiAnalyses,
  expenses,
  fixedCosts,
  invoiceNumbers,
  mandanten,
  passwordResetTokens,
  taxProfiles,
  taxSettings,
  timeEntries,
  users,
} from "./schema";

export const mandantenRelations = relations(mandanten, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  mandant: one(mandanten, {
    fields: [users.mandantId],
    references: [mandanten.id],
  }),
  customers: many(customers),
  timeEntries: many(timeEntries),
  expenses: many(expenses),
  documents: many(documents),
  fixedCosts: many(fixedCosts),
  taxSettings: many(taxSettings),
  taxProfiles: many(taxProfiles),
  accountSettings: many(accountSettings),
  passwordResetTokens: many(passwordResetTokens),
  expenseAiAnalyses: many(expenseAiAnalyses),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  owner: one(users, {
    fields: [customers.userId],
    references: [users.id],
  }),
  invoiceNumbers: many(invoiceNumbers),
  timeEntries: many(timeEntries),
}));

export const invoiceNumbersRelations = relations(invoiceNumbers, ({ one }) => ({
  customer: one(customers, {
    fields: [invoiceNumbers.customerId],
    references: [customers.id],
  }),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one, many }) => ({
  customer: one(customers, {
    fields: [timeEntries.customerId],
    references: [customers.id],
  }),
  owner: one(users, {
    fields: [timeEntries.userId],
    references: [users.id],
  }),
  expenses: many(expenses),
  documents: many(documents),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  timeEntry: one(timeEntries, {
    fields: [expenses.timeEntryId],
    references: [timeEntries.id],
  }),
  owner: one(users, {
    fields: [expenses.userId],
    references: [users.id],
  }),
  documents: many(documents),
  approvedByAnalyses: many(expenseAiAnalyses),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  owner: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  expense: one(expenses, {
    fields: [documents.expenseId],
    references: [expenses.id],
  }),
  timeEntry: one(timeEntries, {
    fields: [documents.timeEntryId],
    references: [timeEntries.id],
  }),
  analyses: many(expenseAiAnalyses),
}));

export const expenseAiAnalysesRelations = relations(expenseAiAnalyses, ({ one }) => ({
  owner: one(users, {
    fields: [expenseAiAnalyses.userId],
    references: [users.id],
  }),
  document: one(documents, {
    fields: [expenseAiAnalyses.documentId],
    references: [documents.id],
  }),
  approvedExpense: one(expenses, {
    fields: [expenseAiAnalyses.approvedExpenseId],
    references: [expenses.id],
  }),
}));

export const fixedCostsRelations = relations(fixedCosts, ({ one }) => ({
  owner: one(users, {
    fields: [fixedCosts.userId],
    references: [users.id],
  }),
}));

export const taxSettingsRelations = relations(taxSettings, ({ one }) => ({
  owner: one(users, {
    fields: [taxSettings.userId],
    references: [users.id],
  }),
}));

export const taxProfilesRelations = relations(taxProfiles, ({ one }) => ({
  owner: one(users, {
    fields: [taxProfiles.userId],
    references: [users.id],
  }),
}));

export const accountSettingsRelations = relations(accountSettings, ({ one }) => ({
  owner: one(users, {
    fields: [accountSettings.userId],
    references: [users.id],
  }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  owner: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));
