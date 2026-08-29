import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Framework instalado pelo AIOX — não é código do app, não seguimos as
    // regras de lint dele (ESLint escaneia o disco, não respeita .gitignore).
    ".claude/**",
    ".github/**",
    ".aiox-core/**",
    ".antigravity/**",
    ".codex/**",
    ".cursor/**",
    ".gemini/**",
    ".kimi/**",
  ]),
]);

export default eslintConfig;
