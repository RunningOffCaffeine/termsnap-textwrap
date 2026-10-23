import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  // Ignore generated files
  globalIgnores([
    "dist/**",
    "node_modules/**",
    "coverage/**",
    ".vscode-test/**",
    "media/webview/html-to-image.min.js",
  ]),

  // VS Code extension (TypeScript / Node.js)
  {
    files: ["src/**/*.ts"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
    ],
    languageOptions: {
      globals: globals.node,
    },
  },

  // VS Code webview (Browser JavaScript)
  {
    files: ["media/webview/script.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.browser,
        acquireVsCodeApi: "readonly",
        htmlToImage: "readonly",
      },
    },
  },

  // Build scripts (Node.js)
  {
    files: ["esbuild.mjs", "eslint.config.mjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
