# Import-Templates v1

Diese Dateien sind für den strukturierten Import in **/import** vorgesehen.

## Excel

- `reisekosten-import-template-v1.xlsx` – leere Vorlage (3 Sheets)
- `reisekosten-import-testdaten-v1.xlsx` – Beispiel/Testdaten

## CSV (Delimiter `;`, UTF-8)

- `kunden-template-v1.csv`
- `zeiteintraege-template-v1.csv`
- `reisekosten-template-v1.csv`
- `kunden-testdaten-v1.csv`
- `zeiteintraege-testdaten-v1.csv`
- `reisekosten-testdaten-v1.csv`

## Pflicht-Sheetnamen in Excel

- `Kunden`
- `Zeiteintraege`
- `Reisekosten`

## Wichtige Formatregeln (Reisekosten)

- `date` ist **immer Pflicht** im Format `YYYY-MM-DD` (auch wenn `time_entry_external_id` gesetzt ist).
- `amount` muss > 0 sein.
- `currency` muss ISO-3 sein (z. B. `EUR`, `PLN`).
- `full_day` nur `0` oder `1`.
- Kategorie `flight`: `date` = Hinflugdatum; bei `flight_route_type=international` sind `departure_time` und `arrival_time` Pflicht (`HH:MM`).
- Kategorie `hotel`: `check_in_date` Pflicht, dazu entweder `nights` oder `check_out_date`.
