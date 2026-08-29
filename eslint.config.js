import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.test-screenshots/**", "dashboard/dist/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
  {
    files: ["**/*.config.js", "eslint.config.js"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["dashboard/src/**", "packages/widget/src/**", "packages/widget/test/**"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ["server/src/**", "server/test/**"],
    languageOptions: { globals: globals.node },
  },
);
