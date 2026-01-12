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
