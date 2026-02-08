CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(255) NOT NULL,
	`mandatenNr` varchar(50) NOT NULL,
	`projectName` varchar(255) NOT NULL,
	`location` varchar(255) NOT NULL,
	`onsiteRate` int NOT NULL,
	`onsiteRateCurrency` varchar(3) NOT NULL DEFAULT 'EUR',
	`remoteRate` int NOT NULL,
	`remoteRateCurrency` varchar(3) NOT NULL DEFAULT 'EUR',
	`kmRate` int NOT NULL,
	`kmRateCurrency` varchar(3) NOT NULL DEFAULT 'EUR',
	`mealRate` int NOT NULL,
	`mealRateCurrency` varchar(3) NOT NULL DEFAULT 'EUR',
	`costModel` enum('exclusive','inclusive') NOT NULL,
	`isArchived` int NOT NULL DEFAULT 0,
	`street` varchar(255),
	`postalCode` varchar(20),
	`city` varchar(100),
	`country` varchar(100),
	`vatId` varchar(50),
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
	`isManual` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exchangeRates_id` PRIMARY KEY(`id`),
	CONSTRAINT `date_currency_unique` UNIQUE(`date`,`currencyPair`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timeEntryId` int NOT NULL,
	`category` enum('car','train','flight','taxi','transport','hotel','fuel','meal','food','other') NOT NULL,
	`distance` int,
	`rate` int,
	`amount` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'EUR',
	`comment` text,
	`ticketNumber` varchar(100),
	`flightNumber` varchar(100),
	`departureTime` varchar(10),
	`arrivalTime` varchar(10),
	`checkInDate` timestamp,
	`checkOutDate` timestamp,
	`liters` int,
	`pricePerLiter` int,
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
	`currency` varchar(3) NOT NULL DEFAULT 'PLN',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fixedCosts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoiceNumbers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`number` int NOT NULL,
	`invoiceNumber` varchar(20) NOT NULL,
	`customerId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoiceNumbers_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoiceNumbers_invoiceNumber_unique` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64),
	`name` text,
	`email` varchar(320),
	`passwordHash` varchar(255),
	`resetToken` varchar(255),
	`resetTokenExpiry` timestamp,
	`emailVerified` int NOT NULL DEFAULT 0,
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
