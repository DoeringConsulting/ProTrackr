ALTER TABLE `taxProfiles`
	ADD COLUMN `taxCalculationMode` enum('normal','zero') NOT NULL DEFAULT 'normal';
