# PWA session regression checks

Use the project's locked dependencies. No real credentials are needed by these fixtures.

```sh
node --test scripts/pwa-session/test-resume.cjs
npx --no-install tsc -p scripts/pwa-session/tsconfig.core.json
node scripts/pwa-session/check-syntax.cjs
```

These tests use the existing source transpile loader with explicit Next/Supabase mocks. Syntax and core tsc are not a full app build. In a restricted runner, set `TYPESCRIPT_PATH` to an already-installed TypeScript module; do not download a different SDK to force a pass.

Optional Python Playwright/Chromium fixtures:

```sh
python scripts/pwa-session/test-browser-dom.py
python scripts/pwa-session/test-browser.py
```

DOM fixture has injected auth/navigation/storage and no network. HTTP fixture runs on an ephemeral loopback port and intercepts auth responses; it was blocked by this environment's browser policy. Neither is a real Supabase/physical-device test. Use `CHROMIUM_BIN` if your installed browser path differs from `/usr/bin/chromium`.

Real release/device gates are in `docs/pwa-session-2026-10-04/LIVE_ACCEPTANCE.md`.
