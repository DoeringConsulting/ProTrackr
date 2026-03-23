-- Phase I (read-only): orphan analysis before FK rollout
SELECT u.id, u.email, u.mandantId
FROM users u
LEFT JOIN mandanten m ON u.mandantId = m.id
WHERE m.id IS NULL;

SELECT c.id, c.provider, c.userId
FROM customers c
LEFT JOIN users u ON c.userId = u.id
WHERE c.userId IS NOT NULL AND u.id IS NULL;

SELECT te.id, te.customerId
FROM timeEntries te
LEFT JOIN customers c ON te.customerId = c.id
WHERE c.id IS NULL;

SELECT te.id, te.userId
FROM timeEntries te
LEFT JOIN users u ON te.userId = u.id
WHERE u.id IS NULL;

SELECT e.id, e.timeEntryId
FROM expenses e
LEFT JOIN timeEntries te ON e.timeEntryId = te.id
WHERE e.timeEntryId IS NOT NULL AND te.id IS NULL;

SELECT e.id, e.userId
FROM expenses e
LEFT JOIN users u ON e.userId = u.id
WHERE e.userId IS NOT NULL AND u.id IS NULL;

SELECT d.id, d.userId
FROM documents d
LEFT JOIN users u ON d.userId = u.id
WHERE u.id IS NULL;

SELECT d.id, d.expenseId
FROM documents d
LEFT JOIN expenses e ON d.expenseId = e.id
WHERE d.expenseId IS NOT NULL AND e.id IS NULL;

SELECT d.id, d.timeEntryId
FROM documents d
LEFT JOIN timeEntries te ON d.timeEntryId = te.id
WHERE d.timeEntryId IS NOT NULL AND te.id IS NULL;

SELECT inv.id, inv.customerId
FROM invoiceNumbers inv
LEFT JOIN customers c ON inv.customerId = c.id
WHERE c.id IS NULL;

SELECT prt.id, prt.userId
FROM passwordResetTokens prt
LEFT JOIN users u ON prt.userId = u.id
WHERE u.id IS NULL;

SELECT eaa.id, eaa.userId
FROM expenseAiAnalyses eaa
LEFT JOIN users u ON eaa.userId = u.id
WHERE u.id IS NULL;

SELECT eaa.id, eaa.documentId
FROM expenseAiAnalyses eaa
LEFT JOIN documents d ON eaa.documentId = d.id
WHERE eaa.documentId IS NOT NULL AND d.id IS NULL;

SELECT eaa.id, eaa.approvedExpenseId
FROM expenseAiAnalyses eaa
LEFT JOIN expenses e ON eaa.approvedExpenseId = e.id
WHERE eaa.approvedExpenseId IS NOT NULL AND e.id IS NULL;

SELECT 'fixedCosts' AS tbl, fc.id
FROM fixedCosts fc
LEFT JOIN users u ON fc.userId = u.id
WHERE u.id IS NULL
UNION ALL
SELECT 'taxSettings' AS tbl, ts.id
FROM taxSettings ts
LEFT JOIN users u ON ts.userId = u.id
WHERE u.id IS NULL
UNION ALL
SELECT 'taxProfiles' AS tbl, tp.id
FROM taxProfiles tp
LEFT JOIN users u ON tp.userId = u.id
WHERE u.id IS NULL
UNION ALL
SELECT 'accountSettings' AS tbl, acs.id
FROM accountSettings acs
LEFT JOIN users u ON acs.userId = u.id
WHERE u.id IS NULL;

SELECT er.id, er.userId
FROM exchangeRates er
LEFT JOIN users u ON er.userId = u.id
WHERE er.userId != 0 AND u.id IS NULL;
