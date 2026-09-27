# Optional source/fixture evidence tools

Run from the complete repository with its installed dependencies. `node docs/ux/phase-6/validation/tools/check-source.cjs` compares modified TSX to preserved original source text (`.source.txt`, deliberately outside the TypeScript include patterns). Output is `source-parity-rerun.json`; it does not replace `npx tsc --noEmit` or `npm run build`.

The static fixture renderer and browser scripts are optional evidence tools, not the application test suite. They deliberately stub hooks/services and cannot prove React behavior. Build steps: `node .../render-fixtures.cjs`, `node .../build-css.cjs`, `python .../browser-checks.py`. Python Playwright and a Chromium executable are required for the last step; use `QC_CHROMIUM` to point to an existing compatible executable. Do not add packages/upgrade the app lockfile merely to run fixtures. Original run used system Tailwind4.1.10 and custom static JSX evaluation. `QC_ROOT`, `QC_FIXTURES`, `QC_TAILWIND_DIR` are optional local output/tool paths, not app env flags.

No fixture action calls backend services. Keep the explicit noAction/stub boundaries; do not reuse fixture plan amounts or customer data as product data. Real tests are in RUNTIME_CHECKLIST.md.
