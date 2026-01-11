CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(255) NOT NULL,
	`mandatenNr` varchar(50) NOT NULL,
	`projectName` varchar(255) NOT NULL,
	`location` varchar(255) NOT NULL,
	`onsiteRate` int NOT NULL,
	`remoteRate` int NOT NULL,
	`kmRate` int NOT NULL,
	`mealRate` int NOT NULL,
	`costModel` enum('exclusive','inclusive') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_mandatenNr_unique` UNIQUE(`mandatenNr`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`expenseId` int,
	`timeEntryId` int,
	`userId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSize` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exchangeRates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` timestamp NOT NULL,
	`currencyPair` varchar(10) NOT NULL DEFAULT 'EUR/PLN',
	`rate` int NOT NULL,
	`source` varchar(50) NOT NULL DEFAULT 'NBP',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exchangeRates_id` PRIMARY KEY(`id`),
	CONSTRAINT `exchangeRates_date_unique` UNIQUE(`date`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timeEntryId` int NOT NULL,
	`category` enum('car','train','flight','transport','meal','hotel','food','fuel','other') NOT NULL,
	`distance` int,
	`rate` int,
	`amount` int NOT NULL,
	`comment` text,
	`ticketNumber` varchar(100),
	`flightNumber` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fixedCosts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`category` varchar(100) NOT NULL,
	`amount` int NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fixedCosts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `timeEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`userId` int NOT NULL,
	`date` timestamp NOT NULL,
	`weekday` varchar(10) NOT NULL,
	`projectName` varchar(255) NOT NULL,
	`entryType` enum('onsite','remote','off_duty','business_trip') NOT NULL,
	`description` text,
	`hours` int NOT NULL,
	`rate` int NOT NULL,
	`calculatedAmount` int NOT NULL,
	`manDays` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `timeEntries_id` PRIMARY KEY(`id`)
);
