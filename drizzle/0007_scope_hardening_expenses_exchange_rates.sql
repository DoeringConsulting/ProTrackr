ALTER TABLE `expenses`
	ADD COLUMN IF NOT EXISTS `userId` int NULL;
--> statement-breakpoint
ALTER TABLE `exchangeRates`
	ADD COLUMN IF NOT EXISTS `userId` int NOT NULL DEFAULT 0;
--> statement-breakpoint
DROP INDEX IF EXISTS `date_currency_unique` ON `exchangeRates`;
--> statement-breakpoint
CREATE UNIQUE INDEX `date_currency_user_unique` ON `exchangeRates` (`date`,`currencyPair`,`userId`);
