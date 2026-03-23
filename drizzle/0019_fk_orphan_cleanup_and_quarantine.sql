CREATE TABLE IF NOT EXISTS `orphan_quarantine` (
  `id` int AUTO_INCREMENT NOT NULL,
  `entityType` varchar(80) NOT NULL,
  `entityId` int,
  `payloadJson` text NOT NULL,
  `reason` varchar(255) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `expiresAt` timestamp NULL,
  CONSTRAINT `orphan_quarantine_id` PRIMARY KEY(`id`)
);

-- 1) Tokens ohne User sind unbrauchbar -> löschen
DELETE prt
FROM `passwordResetTokens` prt
LEFT JOIN `users` u ON prt.userId = u.id
WHERE u.id IS NULL;

-- 2) AI-Analysen ohne User verlieren Ownership -> in Quarantine sichern und löschen
INSERT INTO `orphan_quarantine` (`entityType`, `entityId`, `payloadJson`, `reason`, `expiresAt`)
SELECT
  'expenseAiAnalyses',
  eaa.id,
  JSON_OBJECT(
    'id', eaa.id,
    'userId', eaa.userId,
    'documentId', eaa.documentId,
    'status', eaa.status,
    'createdAt', eaa.createdAt
  ),
  'orphan userId in expenseAiAnalyses',
  DATE_ADD(NOW(), INTERVAL 90 DAY)
FROM `expenseAiAnalyses` eaa
LEFT JOIN `users` u ON eaa.userId = u.id
WHERE u.id IS NULL;

DELETE eaa
FROM `expenseAiAnalyses` eaa
LEFT JOIN `users` u ON eaa.userId = u.id
WHERE u.id IS NULL;

-- 3) Documents: verwaiste expense/timeEntry Referenzen auf NULL
UPDATE `documents` d
LEFT JOIN `expenses` e ON d.expenseId = e.id
SET d.expenseId = NULL
WHERE d.expenseId IS NOT NULL AND e.id IS NULL;

UPDATE `documents` d
LEFT JOIN `timeEntries` te ON d.timeEntryId = te.id
SET d.timeEntryId = NULL
WHERE d.timeEntryId IS NOT NULL AND te.id IS NULL;

-- 4) Expenses mit verwaister timeEntryId werden zu standalone (timeEntryId NULL)
UPDATE `expenses` e
LEFT JOIN `timeEntries` te ON e.timeEntryId = te.id
SET e.timeEntryId = NULL
WHERE e.timeEntryId IS NOT NULL AND te.id IS NULL;

-- 5) Customers ohne gültigen Owner nicht blind nullen:
--    a) Reassign auf ersten aktiven User im selben Mandant (wenn ableitbar)
UPDATE `customers` c
JOIN (
  SELECT te.customerId, MIN(te.userId) AS fallbackUserId
  FROM `timeEntries` te
  JOIN `users` u ON u.id = te.userId AND u.accountStatus = 'active'
  GROUP BY te.customerId
) map ON map.customerId = c.id
LEFT JOIN `users` ucheck ON c.userId = ucheck.id
SET c.userId = map.fallbackUserId
WHERE c.userId IS NOT NULL AND ucheck.id IS NULL;

--    b) Nicht auflösbare Owner -> in Quarantine sichern, dann userId NULL
INSERT INTO `orphan_quarantine` (`entityType`, `entityId`, `payloadJson`, `reason`, `expiresAt`)
SELECT
  'customers',
  c.id,
  JSON_OBJECT(
    'id', c.id,
    'provider', c.provider,
    'projectName', c.projectName,
    'userId', c.userId
  ),
  'customer owner missing; fallback reassignment unavailable',
  DATE_ADD(NOW(), INTERVAL 180 DAY)
FROM `customers` c
LEFT JOIN `users` u ON c.userId = u.id
WHERE c.userId IS NOT NULL AND u.id IS NULL;

UPDATE `customers` c
LEFT JOIN `users` u ON c.userId = u.id
SET c.userId = NULL
WHERE c.userId IS NOT NULL AND u.id IS NULL;

-- 6) ExchangeRates: verwaiste userId -> global fallback (bestehende Semantik)
UPDATE `exchangeRates` er
LEFT JOIN `users` u ON er.userId = u.id
SET er.userId = 0
WHERE er.userId <> 0 AND u.id IS NULL;
