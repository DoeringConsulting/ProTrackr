-- P3/M1: Persistenter Session-Store (express-mysql-session v3).
-- Ersetzt den fluechtigen In-Memory-Store — Sessions ueberleben ab jetzt
-- Container-Restarts/Deploys. Schema EXAKT nach express-mysql-session
-- (node_modules/express-mysql-session/schema.sql), damit die Middleware mit
-- createDatabaseTable:false laeuft (kein Runtime-DDL noetig).
--
-- NICHT ins Backup aufnehmen: server/backup.ts listet die gesicherten Tabellen
-- explizit; `sessions` bleibt bewusst ausgeschlossen (fluechtige Auth-Sessions,
-- kein Geschaefts-/Stammdatum).
CREATE TABLE IF NOT EXISTS `sessions` (
  `session_id` varchar(128) COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) unsigned NOT NULL,
  `data` mediumtext COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB;
