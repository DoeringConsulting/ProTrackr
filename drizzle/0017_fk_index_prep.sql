-- Phase 1: Ensure FK helper indexes exist before constraints.
-- This reduces lock duration during ALTER TABLE ... ADD CONSTRAINT operations.

ALTER TABLE `users`
  ADD INDEX `idx_users_mandantId` (`mandantId`);

ALTER TABLE `invoiceNumbers`
  ADD INDEX `idx_invoiceNumbers_customerId` (`customerId`);

ALTER TABLE `timeEntries`
  ADD INDEX `idx_timeEntries_customerId` (`customerId`),
  ADD INDEX `idx_timeEntries_userId` (`userId`);

ALTER TABLE `expenses`
  ADD INDEX `idx_expenses_timeEntryId` (`timeEntryId`),
  ADD INDEX `idx_expenses_userId` (`userId`);

ALTER TABLE `documents`
  ADD INDEX `idx_documents_expenseId` (`expenseId`),
  ADD INDEX `idx_documents_timeEntryId` (`timeEntryId`),
  ADD INDEX `idx_documents_userId` (`userId`);

ALTER TABLE `expenseAiAnalyses`
  ADD INDEX `idx_expenseAiAnalyses_userId` (`userId`),
  ADD INDEX `idx_expenseAiAnalyses_documentId` (`documentId`),
  ADD INDEX `idx_expenseAiAnalyses_approvedExpenseId` (`approvedExpenseId`);

ALTER TABLE `fixedCosts`
  ADD INDEX `idx_fixedCosts_userId` (`userId`);
