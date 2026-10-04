# Validation evidence — 4 October 2026

## Passed in this environment

| Check | Result | Scope |
|---|---:|---|
| `node --test scripts/pwa-session/test-resume.cjs` | **81/81** | Actual source handlers/controller, explicitly mocked Next/Supabase/client transports. No live authentication. |
| `python scripts/pwa-session/test-browser-dom.py` | **13/13** | Chromium native DOM events with production recovery controller; injected auth/storage/navigation/restoration. Not React rendering or real PWA. |
| `tsc -p scripts/pwa-session/tsconfig.core.json` | pass | Strict semantic typecheck of the two dependency-free contract/controller modules only. |
| `node scripts/pwa-session/check-syntax.cjs` | **20 files, zero parse issues** | Syntax only for every changed/new application TypeScript file. |
| Existing workflow/push executable suites | **30 + 20 + 23 = 73** | Existing pure/service/crypto tests; mocked services, not RLS/device proof. |
| Byte comparison to supplied baseline | **2,488 / 2,501 original files unchanged** | Only 12 existing application source files and root RETURN_NOTES changed. Eight new app source files. No deletion. |
| Existing SQL and dependency manifests | **329 SQL files + both manifests unchanged** | Includes every baseline SQL file, not only one migration directory. |
| Whitespace check | pass with CR-at-EOL recognized | Original modified source CRLF convention preserved. New files use LF. |

Commands used global TypeScript via `TYPESCRIPT_PATH=/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript` where local dependencies were unavailable. Normal checkout should resolve its locked local TypeScript instead.

An initial full tsc run exposed a real discriminant-narrowing error in the new controller; it was corrected, the isolated strict check passes, and the final full attempt was rerun. A quick hide/show fixture also caught a cancelled-check throttle edge case; source and native-event regression tests now cover it.

## Not passed / not available — do not relabel green

- Dependency install (`npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=5000`) failed: registry DNS `EAI_AGAIN`, npm `Exit handler never called!`. Inspection install deliberately disabled lifecycle scripts; Gavin must run the normal locked install. Partial node_modules was removed from the returned source.
- Full project tsc exit 2 on both pristine baseline and candidate: **67,138 / 67,187** diagnostics in the dependency-incomplete environment. Many are missing React/Next/Supabase/Node and cascading types. Do not assume all project errors disappear after install. Full raw logs included.
- Build exit 127: server-dependency declaration precheck passed, then `next` was unavailable. Not a production build pass.
- Lint exit 127: `eslint` unavailable.
- Existing combined workflow runner exit 1. Its 73 executable tests passed; its historical static source assertion expects old direct cookie/slug source strings. The **baseline** combined runner also exits 1 later because `docs/sa-workflow-controller-v1-2026-10-02/PROTECTED_BASELINE.json` was omitted from the supplied lean export. Old checks were not modified or bypassed. See ENGINEERING_HANDOFF for reconciliation instructions.
- Local HTTP browser harness: 13 cases blocked before application execution by Chromium `ERR_BLOCKED_BY_ADMINISTRATOR` for loopback in this environment. `test-browser.py` remains an optional HTTP fixture for an unrestricted local environment. The separately passing in-memory DOM harness does not prove HTTP cookies, response serialization, React hydration or BFCache behavior.
- No actual SDK cookie round-trip, Next render, Supabase Auth/RLS, MFA provider, OAuth, push delivery, physical iPhone/Android/PWA, session revocation or 180-day endurance test was run.

## Evidence files

`session-tests.log`, `browser-dom-results.json`, `browser-dom.log`, `core-typecheck.log`, `syntax.json`, `source-protection.json`, `dependencies.log`, both `*-typecheck.log`, `typecheck-comparison.json`, `build.log`, `lint.log`, `retained-offline.log`, `baseline-retained.log`, `browser-results.json` and `browser.log`.

Archive integrity, actual source/changed-file hashes and clean-baseline patch reproduction are recorded in the separate delivered **packaging verification JSON** after packaging. They establish file delivery integrity, not release readiness.

## Release gate

The owner must be able to use the existing installed icon repeatedly, with and without a notification in between, while a valid session exists. Real logout/MFA/expiry must still work. The definitive steps are `../LIVE_ACCEPTANCE.md`; passing mocked tests is not a substitute.
