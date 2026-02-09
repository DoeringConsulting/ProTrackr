ALTER TABLE `expenses` MODIFY COLUMN `timeEntryId` int;--> statement-breakpoint
ALTER TABLE `expenses` ADD `date` timestamp NOT NULL;