import playwright from "eslint-plugin-playwright";
import tseslint from "typescript-eslint";

export default tseslint.config(
  tseslint.configs.recommended,
  {
    ignores: [
      ".yarn/**",
      "dist/**",
      "eslint.config.mjs",
      ".pnp.cjs",
      ".pnp.loader.mjs",
      "format-v4-audit.cjs",
      "recipes/**",
    ],
  },
  {
    files: ["**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.test.json"],
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      // Ban console usage in src to enforce structured logging; allow in tests via override below
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      // Allow console in tests for simple debugging without enforcing logger
      "no-console": "off",
    },
  },
  {
    // Currently doesn't do anything, but not removing unless we are sure it isn't needed
    ...playwright.configs["flat/recommended"],
    rules: {
      ...playwright.configs["flat/recommended"].rules,
      "playwright/expect-expect": "off",
    },
    files: ["playwright-e2e/**/*.ts"],
  }
);
