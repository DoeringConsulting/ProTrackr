-- Add commission/provision configuration to customers.
-- All fields default to "no commission" so existing customers behave identically.

ALTER TABLE `customers`
  ADD COLUMN `provisionEnabled` INT NOT NULL DEFAULT 0 AFTER `isArchived`;

ALTER TABLE `customers`
  ADD COLUMN `provisionMode` ENUM('deduction','surcharge') NOT NULL DEFAULT 'deduction' AFTER `provisionEnabled`;

ALTER TABLE `customers`
  ADD COLUMN `provisionType` ENUM('percentage','fixed','two_rate') NOT NULL DEFAULT 'percentage' AFTER `provisionMode`;

ALTER TABLE `customers`
  ADD COLUMN `provisionValueBp` INT NOT NULL DEFAULT 0 AFTER `provisionType`;

ALTER TABLE `customers`
  ADD COLUMN `provisionValueCents` INT NOT NULL DEFAULT 0 AFTER `provisionValueBp`;

ALTER TABLE `customers`
  ADD COLUMN `provisionUnit` ENUM('hour','day') NOT NULL DEFAULT 'day' AFTER `provisionValueCents`;

ALTER TABLE `customers`
  ADD COLUMN `provisionUserRate` INT NOT NULL DEFAULT 0 AFTER `provisionUnit`;

ALTER TABLE `customers`
  ADD COLUMN `provisionUserRateRemote` INT NOT NULL DEFAULT 0 AFTER `provisionUserRate`;
