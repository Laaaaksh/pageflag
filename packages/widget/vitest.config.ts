import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: { url: "https://widget-test.example" },
    },
    // Node 22+'s own experimental global `localStorage` shadows jsdom's real
    // implementation unless disabled - see shared.test.ts's reporter-identity tests.
    poolOptions: {
      forks: { execArgv: ["--no-experimental-webstorage"] },
      threads: { execArgv: ["--no-experimental-webstorage"] },
    },
  },
});
