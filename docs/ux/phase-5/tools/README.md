# Optional offline evidence tools

These tools are **not application tests** and are not imported by the application. They do not save, send, connect to Supabase or invoke protected actions. They are supplied to explain/reproduce the attached static evidence, not as a substitute for the actual build and parity checklist.

`render-static-fixtures.cjs` evaluates the actual TSX using inert hook shims and fictional state. It needs existing locally installed TypeScript and Tailwind 4; no package changes are included. `check-static-layout.py` needs Python Playwright and an available Chromium executable; set `QC_CHROMIUM` when using a system browser. It checks page overflow at five widths and representative CSS states. `check-source-bindings.cjs` compares selected AST expressions against a separate extraction of the input archive.

From the repository root, after installing its existing dependencies in an approved environment:

```sh
node docs/ux/phase-5/tools/render-static-fixtures.cjs
python docs/ux/phase-5/tools/check-static-layout.py
QC_BASELINE_ROOT=/absolute/path/to/extracted-input node docs/ux/phase-5/tools/check-source-bindings.cjs
```

Override `QC_SOURCE_ROOT`, `QC_FIXTURE_OUT`, `QC_TYPESCRIPT_MODULE`, `QC_TAILWIND_MODULE`, `QC_TAILWIND_ROOT` only when necessary. The supplied run used TypeScript 5.8.3, Tailwind 4.1.10 and system Chromium. The app's locked build was **not run**. Fixtures intentionally cannot demonstrate React effects, keyboard state transitions, save failures, email delivery or PDF fidelity.
