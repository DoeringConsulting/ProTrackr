ALTER TABLE `customers`
	ADD COLUMN `userId` int NULL;
--> statement-breakpoint
UPDATE `customers` c
JOIN (
	SELECT `customerId`, MIN(`userId`) AS `ownerUserId`
	FROM `timeEntries`
	GROUP BY `customerId`
) te ON te.`customerId` = c.`id`
SET c.`userId` = te.`ownerUserId`
WHERE c.`userId` IS NULL;
