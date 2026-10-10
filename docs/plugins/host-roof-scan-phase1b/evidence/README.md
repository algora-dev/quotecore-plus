# Authoring evidence

The core and configuration tests used the locally available TypeScript/Sharp versions printed in `core-typecheck.log`, not the repository's unavailable locked packages.

`browser-results.json` and the desktop/mobile screenshots come from the actual widget/service with a synthetic fixture and mock host through the documented test-only offline HTTP adapter. This authoring environment rejected direct Chromium navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. These checks therefore do NOT validate real SDK transport, deployment, CSP/CORS, file download behavior or actual phone hardware.

The polygon was supplied by the software test, not traced by ChatGPT. Images are synthetic and labelled as such. No real customer plan is included.

`locked-sdk-tests.log` records the actual attempted test failing before execution because `tsx` was unavailable. `production-build.log` records `next: not found`. `registry-access.log` records npm-registry DNS failure. These are blockers, not passed tests. `source-checks.json` is syntax/AST verification only.
