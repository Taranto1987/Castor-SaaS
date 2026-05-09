import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  // ── Files to skip entirely ───────────────────────────────────────────
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.cjs",
      // Orval-generated — do not edit manually
      "lib/api-client-react/src/generated/**",
      "lib/api-zod/src/generated/**",
      "lib/api-client-react/src/custom-fetch.ts",
    ],
  },

  // ── Backend (api-server) — strict ────────────────────────────────────
  {
    files: ["artifacts/api-server/**/*.ts", "lib/**/*.ts", "scripts/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-explicit-any": "off",
      "no-eval": "error",
      "no-new-func": "error",
      "eqeqeq": ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
    },
  },

  // ── Frontend (castor-orcamento) — relaxed on unused imports ──────────
  // Dead icon imports are cosmetic debt — warn so CI doesn't block, but
  // they show up in the output as reminders to clean up.
  {
    files: ["artifacts/castor-orcamento/**/*.tsx", "artifacts/castor-orcamento/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-explicit-any": "off",
      "no-eval": "error",
      "no-new-func": "error",
      "eqeqeq": ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
    },
  },
];
