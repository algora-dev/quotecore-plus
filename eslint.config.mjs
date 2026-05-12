import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next + add our own.
  globalIgnores([
    // Defaults from eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Maintenance/refactor scripts at the repo root and under scripts/.
    // These are plain Node CLI helpers (run with `node script.js`); they
    // legitimately use `require()` and are not part of the Next app bundle.
    // Linting them as if they were Next app code produced 43 false
    // `no-require-imports` errors (Gerald audit M-02 baseline).
    "apply-*.js",
    "fix-*.js",
    "final-rounding.js",
    "find-duplicate.js",
    "round-corners.js",
    "simplify-colors.js",
    "update-design.js",
    "scripts/**",
  ]),
]);

export default eslintConfig;
