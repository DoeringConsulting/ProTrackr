CREATE TABLE `taxProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`taxForm` enum('liniowy_19') NOT NULL DEFAULT 'liniowy_19',
	`zusRegime` enum('ulga_na_start','preferencyjny_zus','maly_zus_plus','pelny_zus') NOT NULL DEFAULT 'pelny_zus',
	`choroboweEnabled` int NOT NULL DEFAULT 0,
	`fpFsEnabled` int NOT NULL DEFAULT 1,
	`wypadkowaRateBp` int NOT NULL DEFAULT 167,
	`zdrowotnaRateLiniowyBp` int NOT NULL DEFAULT 490,
	`pitRateBp` int NOT NULL DEFAULT 1900,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `taxProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `taxProfiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `taxConfigPl` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`socialMinBaseCents` int NOT NULL,
	`zdrowotnaMinBaseCents` int NOT NULL,
	`zdrowotnaMinAmountCents` int NOT NULL,
	`zdrowotnaDeductionLimitYearlyCents` int NOT NULL,
	`socialContributionRateBp` int NOT NULL DEFAULT 1952,
	`choroboweRateBp` int NOT NULL DEFAULT 245,
	`fpFsRateBp` int NOT NULL DEFAULT 245,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `taxConfigPl_id` PRIMARY KEY(`id`),
	CONSTRAINT `taxConfigPl_year_unique` UNIQUE(`year`)
);
