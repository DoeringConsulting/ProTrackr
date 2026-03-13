CREATE TABLE `expenseAiAnalyses` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `documentId` int,
  `source` varchar(30) NOT NULL DEFAULT 'manual_text',
  `modelName` varchar(120) NOT NULL DEFAULT 'heuristic-v1',
  `ocrText` text,
  `extractionPayload` text,
  `normalizedPayload` text,
  `validationPayload` text,
  `matchingPayload` text,
  `dedupeHash` varchar(80),
  `status` varchar(30) NOT NULL DEFAULT 'needs_review',
  `approvedExpenseId` int,
  `confidence` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `expenseAiAnalyses_id` PRIMARY KEY(`id`)
);
