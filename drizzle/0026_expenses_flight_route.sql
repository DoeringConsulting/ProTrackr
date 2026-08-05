-- Befund B3 — Flugstrecke und Hin-/Rückflug-Kennzeichnung.
-- Konzept: docs/KONZEPT-flugrichtung.md v1.1.0 (freigegeben 2026-08-05).
--
-- Vor dieser Migration existierte KEINE Richtungsinformation: `flightRouteType`
-- unterscheidet Inland/Ausland (Geografie, kein Hin/Rück), `checkOutDate` trägt das
-- Rückflugdatum nur bei Round-Trip auf einem Ticket. Flughafencodes waren nirgends
-- gespeichert — die Annahme aus SPEC-Reisekosten-Abgrenzung §3.2, die Richtung sei
-- "deterministisch aus den Flughafencodes ableitbar, ohne neues Datenfeld", trug nicht.
--
-- Additiv und nullable: keine Bestandszeile wird berührt, kein Backfill erzwungen.
-- Bestandsbelege bleiben leer; Nachtragen ist über die normale Bearbeiten-Maske
-- jederzeit möglich (Entscheidung des Account-Inhabers, Konzept §3.5).
--
-- VARCHAR(3) statt ENUM für die Flughäfen: Flughäfen sind eine offene Menge, ein ENUM
-- müsste bei jedem neuen Ziel migriert werden — und ENUM-Änderungen sind in diesem
-- Projekt teuer (siehe Memory project_db_migration_drift).
-- `flightDirection` dagegen ist eine geschlossene Menge mit genau zwei Werten; die
-- Werte stehen von Anfang an fest, es wird nichts in der Mitte eingefügt.

ALTER TABLE `expenses`
  ADD COLUMN `departureAirport` VARCHAR(3) NULL AFTER `flightNumber`,
  ADD COLUMN `arrivalAirport`   VARCHAR(3) NULL AFTER `departureAirport`,
  ADD COLUMN `flightDirection`  ENUM('outbound','return') NULL AFTER `arrivalAirport`;
