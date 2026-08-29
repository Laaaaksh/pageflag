import pg from "pg";
import { runMigrations } from "../src/lib/runMigrations.js";
import { TEST_ENV } from "./testEnv.js";

export default async function globalSetup(): Promise<void> {
  const pool = new pg.Pool({ connectionString: TEST_ENV.DATABASE_URL });
  await runMigrations(pool);
  await pool.end();
}
