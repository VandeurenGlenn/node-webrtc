import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "build/**",
      "lib/**",
      "test/web-platform-tests/tests/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-redeclare": "off",
      "no-useless-catch": "off",
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },
  {
    files: ["test/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
    },
  },
];
