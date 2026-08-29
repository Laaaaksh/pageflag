import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "..", "migrations");

export async function runMigrations(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  const { rows: applied } = await pool.query<{ version: string }>(
    "SELECT version FROM schema_migrations",
  );
  const appliedSet = new Set(applied.map((r) => r.version));

  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const sql = await readFile(path.join(migrationsDir, file), "utf-8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`applied migration: ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`migration ${file} failed: ${(err as Error).message}`, { cause: err });
    } finally {
      client.release();
    }
  }
}
