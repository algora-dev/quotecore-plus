import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Project-wide rule tweaks.
  //
  // `_`-prefix is our convention for intentionally-unused identifiers
  // (destructured fields we don't read, callback args required by signature,
  // captured types, etc.). Without this allowance, code like
  // `({ a, b: _b }) => a` produces a no-unused-vars error even though the
  // underscore is exactly the signal we use to mean "unused on purpose".
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      // 162 explicit `any` annotations are legitimate technical debt: most
      // are quick `(row as any).newColumn` accesses pre-dating the column
      // landing in generated DB types, plus untyped callback args in
      // .map/.filter chains. A wholesale rewrite would mostly produce
      // `unknown` followed by `as` casts at every use site, which is
      // negative value over keeping `any` while we slowly type things
      // properly. Downgrade to warning so the count stays visible without
      // gating new work; revisit when we regenerate the Supabase types
      // and tackle untyped callbacks together.
      '@typescript-eslint/no-explicit-any': 'warn',

      // `<img>` is intentional in this codebase for:
      //   - small static brand assets on public auth pages (logos)
      //   - user-uploaded content served via Supabase signed URLs
      //   - data-URI QR codes (next/image rejects data URIs)
      //   - PDF / print previews where next/image layout is awkward
      // Each call site has been reviewed; switching to `<Image>` would add
      // layout/size complexity for negligible LCP gain. Disabling the rule
      // project-wide is the honest expression of our intent. Revisit
      // alongside a dedicated LCP pass.
      '@next/next/no-img-element': 'off',
    },
  },
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
