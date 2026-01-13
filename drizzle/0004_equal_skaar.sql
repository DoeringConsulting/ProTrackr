ALTER TABLE `exchangeRates` DROP INDEX `exchangeRates_date_unique`;--> statement-breakpoint
ALTER TABLE `exchangeRates` ADD CONSTRAINT `date_currency_unique` UNIQUE(`date`,`currencyPair`);