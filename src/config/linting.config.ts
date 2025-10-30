import playwright from "eslint-plugin-playwright";
import tseslint from "typescript-eslint";

export class LintingConfig {
  public static readonly tseslintRecommended = tseslint.configs.recommended;

  public static readonly ignored = {
    ignores: [
      ".yarn/**",
      "eslint.config.mjs",
      ".pnp.cjs",
      ".pnp.loader.mjs",
      "format-v4-audit.cjs",
    ],
  };

  public static readonly tseslintPlugin = {
    files: ["**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
    },
  };

  public static readonly playwright = {
    ...playwright.configs["flat/recommended"],
    rules: {
      ...playwright.configs["flat/recommended"].rules,
      "playwright/expect-expect": "off",
    },
    files: ["**/*.ts"],
  };
}
