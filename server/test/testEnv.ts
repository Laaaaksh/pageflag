/**
 * Shared between vitest.config.ts (as `test.env`, applied to worker processes) and
 * globalSetup.ts (which runs in its own process and must set these values itself).
 * Matches the `pageflag-test-db` container the Makefile's `test-db` target starts,
 * and the postgres service in .github/workflows/ci.yml.
 */
export const TEST_ENV = {
  DATABASE_URL: "postgres://postgres:postgres@localhost:55444/pageflag_test",
  JWT_SECRET: "test-secret-do-not-use-in-production",
  NODE_ENV: "test",
  SCREENSHOT_DIR: "./.test-screenshots",
  DASHBOARD_ORIGIN: "http://localhost:5173",
  PORT: "4001",
};
