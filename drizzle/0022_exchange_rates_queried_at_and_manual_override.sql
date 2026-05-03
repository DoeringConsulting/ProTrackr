-- Add queriedAt to exchangeRates so we can record when each rate was actually fetched
-- (NBP publishes once per day; the same effective date may yield different rates if
-- queried before vs. after the daily NBP publish window).
ALTER TABLE `exchangeRates`
  ADD COLUMN `queriedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `isManual`;

-- Backfill queriedAt for existing rows from createdAt. Without this, the new
-- column would default to CURRENT_TIMESTAMP at migration time and every stale
-- rate would look "fresh" to the cache check.
UPDATE `exchangeRates` SET `queriedAt` = `createdAt`;

-- Drop the unique constraint on (date, currencyPair, userId). Multiple rows for the
-- same effective date are now allowed (intra-day rate changes). Replace with a
-- non-unique lookup index for performance.
ALTER TABLE `exchangeRates` DROP INDEX `date_currency_user_unique`;
ALTER TABLE `exchangeRates` ADD INDEX `date_currency_user_idx` (`date`, `currencyPair`, `userId`);

-- Global per-user override: when 1, all reports use the latest manually entered rate
-- for each currency pair instead of the auto-fetched NBP rate.
ALTER TABLE `accountSettings`
  ADD COLUMN `useManualExchangeRate` INT NOT NULL DEFAULT 0 AFTER `swift`;
