# Phase 8 source-review tools

These scripts are independent source/fixture checks, not an application test harness. No new package dependencies are added. TypeScript and Tailwind v4 must be available to Node; Python Playwright with Chromium is needed only for screenshots/layout checks. They were supplied by this environment, not installed into QuoteCore+.

Set absolute paths:

```sh
export QC_ROOT=/path/to/quotecore-plus
export QC_BASELINE=/path/to/quotecore-plus-phase8-ux-handoff-2026-09-27.zip
export QC_VALIDATION=/path/to/review-output
export QC_FIXTURES="$QC_VALIDATION/fixtures"
export QC_CHROMIUM=/path/to/chromium
# NODE_PATH may point to globally available validation modules, not the source app.
mkdir -p "$QC_VALIDATION" "$QC_FIXTURES"
python "$QC_ROOT/docs/ux/phase-8/validation/tools/compare-baseline.py"
python "$QC_ROOT/docs/ux/phase-8/validation/tools/invariant-checks.py"
node "$QC_ROOT/docs/ux/phase-8/validation/tools/check-source.cjs"
node "$QC_ROOT/docs/ux/phase-8/validation/tools/exports.cjs"
node "$QC_ROOT/docs/ux/phase-8/validation/tools/call-parity.cjs"
node "$QC_ROOT/docs/ux/phase-8/validation/tools/interaction-checks.cjs"
node "$QC_ROOT/docs/ux/phase-8/validation/tools/render-fixtures.cjs"
node "$QC_ROOT/docs/ux/phase-8/validation/tools/build-css.cjs"
python "$QC_ROOT/docs/ux/phase-8/validation/tools/browser-checks.py"
```

`compare-baseline` generates source-check inventory and normalized production diff. `invariant-checks` writes baseline-changed-source.json for call-parity (generated on demand; not a second application installation). Exact archive hashes remain raw bytes. These scripts are not the three-way merger.

`controller-harness.cjs` evaluates real selected functions with named state/ref substitutes. It temporarily exposes internal status component functions in memory, not in source. Effects and React scheduling do not run. Requests/downloads/actions are forbidden unless an individual test installs a deterministic mock. Expected error logs during fault injection are not test failures; consult interaction-report.json.

`view-harness.cjs` creates HTML from source JSX with sample hook states. No feature handlers run in browser specimens. Native dialog showModal and details keyboard behavior are checked in Chromium. Third-party icons may be placeholders and fonts use system fallbacks. Screenshots are not the live app.

Gavin must still run the normal dependency-complete TypeScript/lint/Next build and real workflow/device tests, including auth, mutations, file contents, native focus, accessibility and integration. Do not report these scripts as those tests.
