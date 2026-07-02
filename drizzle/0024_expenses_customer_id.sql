-- Fehler #2 (Sobrietas exclusive), Phase 3a.
-- Direkte Kundenzuordnung für Standalone-Reisekosten. Nullable, KEIN Backfill
-- (Decision D: Alt-Belege vor 01.07.2026 bleiben unberührt/NULL; neue Mechanik
-- gilt nur für Belege ab 01.07.2026).

ALTER TABLE `expenses`
  ADD COLUMN `customerId` INT NULL AFTER `timeEntryId`;

ALTER TABLE `expenses`
  ADD CONSTRAINT `expenses_customerId_customers_id_fk`
  FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
