ALTER TABLE `expenses`
	ADD COLUMN `userId` int NULL;
--> statement-breakpoint
ALTER TABLE `exchangeRates`
	ADD COLUMN `userId` int NOT NULL DEFAULT 0;
--> statement-breakpoint
DROP INDEX `date_currency_unique` ON `exchangeRates`;
--> statement-breakpoint
CREATE UNIQUE INDEX `date_currency_user_unique` ON `exchangeRates` (`date`,`currencyPair`,`userId`);
