ALTER TABLE `customers`
	DROP INDEX `customers_mandatenNr_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_user_mandaten_unique`
	ON `customers` (`userId`, `mandatenNr`);
