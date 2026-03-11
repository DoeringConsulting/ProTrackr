ALTER TABLE `customers`
  ADD COLUMN `standardDayHours` int NOT NULL DEFAULT 800 AFTER `location`;
