ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_mandant`
  FOREIGN KEY (`mandantId`) REFERENCES `mandanten`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `customers`
  ADD CONSTRAINT `fk_customers_user`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `passwordResetTokens`
  ADD CONSTRAINT `fk_prt_user`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `fixedCosts`
  ADD CONSTRAINT `fk_fixedcosts_user`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `taxSettings`
  ADD CONSTRAINT `fk_taxsettings_user`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `taxProfiles`
  ADD CONSTRAINT `fk_taxprofiles_user`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `accountSettings`
  ADD CONSTRAINT `fk_accountsettings_user`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `invoiceNumbers`
  ADD CONSTRAINT `fk_invoicenumbers_customer`
  FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `timeEntries`
  ADD CONSTRAINT `fk_timeentries_customer`
  FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `timeEntries`
  ADD CONSTRAINT `fk_timeentries_user`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `expenses`
  ADD CONSTRAINT `fk_expenses_timeentry`
  FOREIGN KEY (`timeEntryId`) REFERENCES `timeEntries`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `expenses`
  ADD CONSTRAINT `fk_expenses_user`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `documents`
  ADD CONSTRAINT `fk_documents_expense`
  FOREIGN KEY (`expenseId`) REFERENCES `expenses`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `documents`
  ADD CONSTRAINT `fk_documents_timeentry`
  FOREIGN KEY (`timeEntryId`) REFERENCES `timeEntries`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `documents`
  ADD CONSTRAINT `fk_documents_user`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `expenseAiAnalyses`
  ADD CONSTRAINT `fk_eaa_user`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `expenseAiAnalyses`
  ADD CONSTRAINT `fk_eaa_document`
  FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `expenseAiAnalyses`
  ADD CONSTRAINT `fk_eaa_expense`
  FOREIGN KEY (`approvedExpenseId`) REFERENCES `expenses`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
