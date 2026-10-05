# Reproduce the isolated evidence

Set paths to the extracted return and its exact baseline. Use your existing development toolchain; do not upload credentials or dependency bundles.

```sh
export QC_ROOT="/absolute/path/to/quotecore-plus"
export QC_BASELINE="/absolute/path/to/clean-phase9-handoff/quotecore-plus"
export QC_VALIDATION="$QC_ROOT/docs/ux/phase-9/validation"
export QC_FIXTURES="$QC_VALIDATION/fixtures"
node "$QC_VALIDATION/tools/source-check.cjs" > "$QC_VALIDATION/source-report.json"
node "$QC_VALIDATION/tools/contract-checks.cjs"
node "$QC_VALIDATION/tools/interaction-checks.cjs"
node "$QC_VALIDATION/tools/invariant-checks.cjs"
node "$QC_VALIDATION/tools/route-audit.cjs"
node "$QC_VALIDATION/tools/build-css.cjs"
node "$QC_VALIDATION/tools/render-fixtures.cjs"
python "$QC_VALIDATION/tools/browser-checks.py"
```

Node scripts resolve TypeScript/Tailwind through the development installation or NODE_PATH. The browser script uses Python Playwright and `/usr/bin/chromium` (set that local path for another workstation). It loads specimens through `set_content`, inlines styles/assets and blocks external requests. A localhost web app was not used.

`view-harness.cjs` transpiles actual TSX into a custom JSX tree. Hook values are samples, all effects are off, and boundaries throw unless explicitly substituted. `controller-harness.cjs` executes selected returned callbacks with deterministic local state. This is not React reconciliation, hook ordering certification or application E2E. `contract-checks.cjs` calls actual handlers against substituted guards/providers. No live stores are touched.

Calc branches are checked against the unchanged existing pure calculator, not an independent engineering or measurement-accuracy certification. The visible drawing canvas is explicitly labelled as a placeholder and is excluded from engine testing.

Open `fixtures/*.html` or `PREVIEWS.html` for review. Screenshots use only sample data and supplied local help illustrations. No image-generated concept is being presented as a working application screenshot.

The full code archive intentionally retains original package/lock/config files. New shared components add no application dependencies. All raw baseline hashes are from the supplied archive; statements are compared after canonical LF/comment/trivia normalization only where documented.
