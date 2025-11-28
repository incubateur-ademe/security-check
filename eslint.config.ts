import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import importPlugin from "eslint-plugin-import";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

export default defineConfig([
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    settings: {
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
      },
    },
  },
  {
    ignores: ["node_modules/**", "dist/**"],
  },
  {
    rules: {
      "@typescript-eslint/explicit-member-accessibility": [
        "error",
        {
          accessibility: "explicit",
          overrides: {
            accessors: "no-public",
            constructors: "no-public",
          },
        },
      ],
      "@typescript-eslint/member-delimiter-style": [
        "off",
        {
          multiline: {
            delimiter: "none",
            requireLast: true,
          },
          singleline: {
            delimiter: "semi",
            requireLast: false,
          },
        },
      ],

      "@typescript-eslint/adjacent-overload-signatures": "error",
      "@typescript-eslint/array-type": [
        "error",
        {
          default: "array-simple",
        },
      ],
    },
  },
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
      import: importPlugin,
      "unused-imports": unusedImports,
    },
    rules: {
      // Import sorting
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      // Remove unused imports automatically
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "import/order": "off",
      "import/no-extraneous-dependencies": "off",
      "import/no-internal-modules": "off",
      "import/newline-after-import": "error",
      "import/export": "off",
      "import/no-useless-path-segments": "warn",
      "import/no-absolute-path": "warn",
      "import/no-named-as-default": "off",
      "import/consistent-type-specifier-style": ["error", "prefer-inline"],
      "import/no-duplicates": [
        "error",
        {
          "prefer-inline": true,
        },
      ],
      "sort-import": "off",

      // Common import checks
      "import/no-unresolved": "error",

      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
          disallowTypeAnnotations: false,
        },
      ],
      "@typescript-eslint/sort-type-constituents": "warn",
    },
  },
  {
    rules: {
      // Prettier formatting as lint errors
      "prettier/prettier": [
        "error",
        {
          tabWidth: 2,
          trailingComma: "all",
          printWidth: 120,
          singleQuote: false,
          parser: "typescript",
          arrowParens: "avoid",
        },
      ],
    },
  },
  eslintPluginPrettierRecommended,
]);
