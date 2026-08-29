import { pool } from "./db.js";
import { runMigrations } from "./lib/runMigrations.js";

runMigrations(pool)
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
    return pool.end();
  });
