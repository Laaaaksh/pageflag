import { defineConfig } from "vitest/config";
import { TEST_ENV } from "./test/testEnv.js";

export default defineConfig({
  test: {
    environment: "node",
    // Every test file shares one Postgres database and truncates between tests,
    // so files must not run concurrently against it.
    fileParallelism: false,
    env: TEST_ENV,
    globalSetup: ["./test/globalSetup.ts"],
  },
});
