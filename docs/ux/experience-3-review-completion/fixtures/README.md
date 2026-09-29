# Isolated source fixture

Not a deployed application, Next runtime or authentication test. `browser/` is self-contained static output of source modules with sample records and explicit service/router mocks. `browser/inventory.json` names the source and mocked modules; see the `build-fixture.cjs` shim definitions too. The mock router records a route only. No real server mutation or sending occurs.

`baseline/` contains the two original modified source files for parity checks only; never copy them into production. Runtime JS is recovered from an existing supplied validation fixture (React18.2), not the application's locked runtime. Core source edits use no added dependency.

To rerun with installed local tools from the repository root:

```sh
F=docs/ux/experience-3-review-completion/fixtures
node node_modules/typescript/bin/tsc -p "$F/tsconfig.json"
node --test "$F/controller.test.cjs"
node "$F/check-syntax.cjs"
node "$F/source-contracts.cjs"
node "$F/build-fixture.cjs"
node "$F/compile-tailwind.cjs"
python "$F/browser-tests.py"
```

The optional `QC_REPO_ROOT`, `QC_TYPESCRIPT` (module path), and `QC_TAILWIND_ROOT` variables select tool locations. Python Playwright and Chromium are required; change its `executable_path` only for your installed browser. Our sandbox used offline `set_content` injection because navigation is blocked. These tests do not change a security policy.

Final signed-off source counts/results are in `../validation/`. Running fixture tools again may generate new local logs/screens. Gavin's actual Next/TypeScript, authenticated flows and phone acceptance remain separate gates.
