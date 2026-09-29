# Verification record

Performed here against the returned source:
- 10 changed/new TS/TSX files: TypeScript transpilation syntax checks, no syntax diagnostics.
- Pure component tester: strict semantic typecheck using actual unions, engine, conversion helpers and generated database types. The server import is replaced only with its existing type re-exports to avoid requiring Next/Supabase runtime packages. No diagnostics. This is NOT full application typecheck.
- 67 isolated adapter/engine checks, passed: representative purchase strategies and measurement types, waste, pitch, conversions, invalid/zero/overflow values and stale-field isolation.
- 73 isolated React/Chromium interaction/layout checks, passed: real source editor/list/Home/import/guide, mocked actions/navigation/transport. Includes Enter/no-save, FormData isolation, retained test state, draft copy, create/failure/at-cap, subscription off, existing warning, flag-off payload, Home contexts, import mapping and deliberate completion, and 1440/1024/768/390/320 layout checks.
- AST comparison: both original create/update `input` expressions and both generic payload expressions unchanged; existing MAX_ROWS/NAME_CHAR_LIMIT unchanged.
- Baseline/protected bytes and archive/manifest integrity: see PROTECTED_FILE_REPORT.json and final package verification.

## Honest limits

The application dependencies (Next16.2.12, React18.3.1 etc.) are not installed here. No full actual Next build, lint or authenticated runtime was performed. The offline browser harness uses locally available React/ReactDOM18.2.0 plus global Tailwind4 utility compilation, actual source-scoped CSS, and Chromium. The app's own locked dependency pipeline is authoritative. Fixture navigation/provider replies are mocks; no real company/quote/data was written, no downloads, payments or emails sent.

Fixtures are not image-generation concepts and not deployed screenshots: they render actual new components with synthetic example records. The fixture shell is illustrative; it does not replace the application's shell/logo/navigation. Preserve this distinction in owner review.

The browser harness asserts no page-wide overflow at sampled sizes; it cannot prove real device keyboard, browser zoom, PWA/safe-area or full-shell behaviour. List/import/provider failure coverage is isolated only. Existing multi-route/Takeoff regressions require Gavin's test gate.

## Re-running source checks

With the project's actual dependencies installed, from the repo root:
```
QC_ROOT="$PWD" node docs/ux/experience-1-pricing-activation/validation/test-engine.cjs
QC_ROOT="$PWD" QC_BASELINE="/absolute/path/to/extracted/baseline/quotecore-plus" node docs/ux/experience-1-pricing-activation/validation/check-source.cjs
```

The source-comparison script intentionally requires the exact baseline to compare payload expressions. Browser fixture code and captured bundle are retained as test evidence; use the real app for acceptance, rather than treating offline mocks as integration tests.
