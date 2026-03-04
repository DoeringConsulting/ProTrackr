SET @tax_mode_column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'taxProfiles'
    AND COLUMN_NAME = 'taxCalculationMode'
);
--> statement-breakpoint

SET @tax_mode_alter_sql := IF(
  @tax_mode_column_exists = 0,
  "ALTER TABLE `taxProfiles` ADD COLUMN `taxCalculationMode` enum('normal','zero') NOT NULL DEFAULT 'normal'",
  "SELECT 1"
);
--> statement-breakpoint

PREPARE tax_mode_stmt FROM @tax_mode_alter_sql;
--> statement-breakpoint
EXECUTE tax_mode_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE tax_mode_stmt;
