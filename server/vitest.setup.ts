import { config } from "dotenv";
import path from "path";
import { afterAll } from "vitest";

config({ path: path.resolve(process.cwd(), ".env") });

/**
 * Global teardown — removes the rows the integration tests insert but
 * never clean up. Without this hook, every `npx vitest run` accumulates
 * ~6 fresh test customers + cascade plus 'Manual Test' exchange rates
 * in the dev DB (observed accumulation: hundreds of stale rows over time).
 *
 * Conservative match patterns — only fixtures known to be created by the
 * test suite are deleted. The literal names "Test Project", "Test Project 2",
 * "Update Test", "Address Test Project" are reserved fixture names and
 * must not be used for real customer projects.
 *
 * Set SKIP_TEST_CLEANUP=1 to disable (e.g. when debugging a flaky test
 * and you want the rows to remain for inspection).
 */
afterAll(async () => {
  if (process.env.SKIP_TEST_CLEANUP === "1") return;
  if (!process.env.DATABASE_URL) return;

  let mysql;
  try {
    mysql = await import("mysql2/promise");
  } catch {
    return;
  }

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [testCust] = (await conn.execute(
      `SELECT id FROM customers
         WHERE projectName IN ('Test Project', 'Test Project 2',
                               'Update Test', 'Address Test Project')`
    )) as any;
    const ids = (testCust as Array<{ id: number }>).map((r) => r.id);

    if (ids.length > 0) {
      const ph = ids.map(() => "?").join(",");
      await conn.execute(
        `DELETE FROM expenses WHERE timeEntryId IN
           (SELECT id FROM (SELECT id FROM timeEntries WHERE customerId IN (${ph})) AS x)`,
        ids
      );
      await conn.execute(`DELETE FROM timeEntries WHERE customerId IN (${ph})`, ids);
      await conn.execute(`DELETE FROM customers WHERE id IN (${ph})`, ids);
    }

    await conn.execute(`DELETE FROM exchangeRates WHERE source = 'Manual Test'`);
  } finally {
    await conn.end();
  }
}, 30000);
