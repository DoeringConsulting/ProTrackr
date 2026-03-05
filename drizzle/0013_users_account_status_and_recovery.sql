SET @users_account_status_column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'accountStatus'
);
--> statement-breakpoint

SET @users_account_status_add_sql := IF(
  @users_account_status_column_exists = 0,
  "ALTER TABLE `users` ADD COLUMN `accountStatus` enum('active','suspended','deleted') NOT NULL DEFAULT 'active'",
  "SELECT 1"
);
--> statement-breakpoint

PREPARE users_account_status_stmt FROM @users_account_status_add_sql;
--> statement-breakpoint
EXECUTE users_account_status_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE users_account_status_stmt;
--> statement-breakpoint

UPDATE `users`
SET `accountStatus` = 'suspended'
WHERE `accountStatus` = 'active'
  AND `passwordHash` IS NULL;
