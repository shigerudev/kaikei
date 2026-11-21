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
    // Standalone Remotion pitch video with its own deps and tsconfig.
    "pitch-video/**",
    // Agent git worktrees (full repo copies) live here; never lint them as part of this tree.
    ".claude/**",
  ]),
]);

export default eslintConfig;
