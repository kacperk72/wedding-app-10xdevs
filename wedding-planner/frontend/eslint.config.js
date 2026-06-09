const js = require("@eslint/js");
const angular = require("@angular-eslint/eslint-plugin");
const angularTemplate = require("@angular-eslint/eslint-plugin-template");
const angularTemplateParser = require("@angular-eslint/template-parser");
const globals = require("globals");
const tseslint = require("typescript-eslint");

module.exports = [
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**", "playwright-report/**", "test-results/**"],
  },
  ...tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      files: ["src/**/*.ts"],
      processor: "@angular-eslint/template/extract-inline-html",
      languageOptions: {
        parserOptions: {
          project: ["./tsconfig.app.json", "./tsconfig.spec.json"],
          tsconfigRootDir: __dirname,
        },
        globals: {
          ...globals.browser,
          ...globals.es2022,
        },
      },
      plugins: {
        "@angular-eslint": angular,
        "@angular-eslint/template": angularTemplate,
      },
      rules: {
        "@angular-eslint/contextual-lifecycle": "error",
        "@angular-eslint/no-empty-lifecycle-method": "error",
        "@angular-eslint/no-input-rename": "error",
        "@angular-eslint/no-output-native": "error",
        "@angular-eslint/no-output-on-prefix": "error",
        "@angular-eslint/no-output-rename": "error",
        "@angular-eslint/use-lifecycle-interface": "warn",
      },
    },
    {
      files: ["src/**/*.html"],
      languageOptions: {
        parser: angularTemplateParser,
      },
      plugins: {
        "@angular-eslint/template": angularTemplate,
      },
      rules: {
        "@angular-eslint/template/banana-in-box": "error",
        "@angular-eslint/template/eqeqeq": "error",
        "@angular-eslint/template/no-negated-async": "error",
      },
    },
  ),
];
