CREATE TABLE `taxSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`zusType` enum('percentage','fixed') NOT NULL DEFAULT 'percentage',
	`zusValue` int NOT NULL,
	`healthInsuranceType` enum('percentage','fixed') NOT NULL DEFAULT 'percentage',
	`healthInsuranceValue` int NOT NULL,
	`taxType` enum('percentage','fixed') NOT NULL DEFAULT 'percentage',
	`taxValue` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `taxSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `taxSettings_userId_unique` UNIQUE(`userId`)
);
