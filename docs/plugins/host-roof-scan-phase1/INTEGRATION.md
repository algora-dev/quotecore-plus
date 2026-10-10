> Historical Phase 1 reference. For this integrated package, use [Phase 1B integration instructions](../host-roof-scan-phase1b/INTEGRATION.md). They supersede the endpoint, environment and deployment steps below.

# Integration and staging deployment

## For Darren / the integration agent

This is an additive Phase 1 implementation, not just a brief. Merge it into the complete current repository after confirming baseline commit `3228415c` or reviewing divergence. The supplied source snapshot is lean and intentionally omits media. Do not delete missing assets or replace unrelated current application work.

The existing production source files were left byte-for-byte unchanged. The integration package contains new source and documentation only. Follow the manifest preflight before writing any file that unexpectedly already exists.

## 1. Validate the complete repository

```sh
npm ci
npx tsc --noEmit
npm run build
npx eslint app/lib/free-tools/host-roof-scan/*.ts app/mcp/host-scan/route.ts app/mcp/host-scan/review/route.ts app/api/public/host-roof-scan/route.ts
```

Record the existing baseline test errors separately from any new error. Do not claim a pass from the offline isolated-core checks. The authoring environment could not install npm dependencies and could not run the actual Next build or installed MCP SDK. It used a separately installed TypeScript/Sharp toolchain for the core tests.

No dependencies or root package scripts were changed. The project already declares the MCP SDK and Sharp.

## 2. Feature flag and environment

Copy the values below into the staging environment, not into source control with credentials. Generate a new independent HMAC secret.

```sh
# Leave false until staging storage and rate limiting are ready.
QC_HOST_SCAN_ENABLED=false
QC_HOST_SCAN_ORIGIN=https://YOUR-STAGING-ORIGIN.example
QC_HOST_SCAN_SECRET=GENERATE_A_RANDOM_SECRET_OF_AT_LEAST_32_BYTES
QC_HOST_SCAN_STORAGE=supabase
QC_HOST_SCAN_BUCKET=qc-host-outline-staging

# Existing server environment values, never expose them to the widget:
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_EXISTING_SERVER_SIDE_SERVICE_KEY

# Empty is safe. Inspect actual host file URLs, then allow exact HTTPS origins only.
QC_HOST_SCAN_FILE_ORIGINS=
# Comma-separated exact sandbox/host origins verified during real testing.
QC_HOST_SCAN_UI_ORIGINS=
```

Use a random generator, for example `openssl rand -hex 32`, for `QC_HOST_SCAN_SECRET`. This is not an OpenAI API key. Do not reuse a billing, session or signing secret.

`memory` storage is supported only for local nonproduction, non-Vercel testing. In that mode use `http://localhost:3000` or `http://127.0.0.1:3000` as origin. On Vercel or production-mode staging, private Supabase storage is required; the server will not silently fall back to process memory.

The canonical origin is configured, never inferred from an untrusted request Host header. Browser CORS uses no cookies. The origin guard permits the canonical origin, configured UI origins, no Origin header for server clients, and opaque `Origin: null` sandboxes. Origin is not identity. Signed capabilities protect image/review access.

## 3. Create isolated storage and retention

Provision a dedicated **private** Supabase Storage bucket with the exact configured name. Do not add public read/write policies or reuse a customer-document bucket. The service-role key accesses only the configured bucket through the new adapter. No SQL or RLS migration is supplied.

Image access references expire after 30 minutes. Physical deletion requires the cleanup utility, an equivalent bucket lifecycle or user deletion. Configure deletion before admitting real user data:

```sh
node docs/plugins/host-roof-scan-phase1/purge-expired.mjs
# Inspect the dry-run count, then explicitly execute:
node docs/plugins/host-roof-scan-phase1/purge-expired.mjs --execute
```

The script considers only `host-outline-v1/YYYY-MM-DD/<timestamp>-<uuid>` and images older than 35 minutes. It refuses a public bucket. Schedule it through an operator-approved mechanism; this package does not edit existing cron jobs. Expiration does not delete provider conversation copies or downloaded files.

Verify the existing `consume_rate_limit` RPC works. Production-mode guards fail closed. Limits are per source IP: 20 new images/hour, 360 MCP/review requests/hour, 240 review-page loads/hour. The staging global upload cap is 200/hour. Provider proxy IP sharing can affect testers; this is not a billing identity or production per-person allowance. Do not simply disable quotas to make a host test pass.

## 4. Enable staging and connect

Set `QC_HOST_SCAN_ENABLED=true` only on the staging deployment. The endpoint to connect to the AI host is:

```text
https://YOUR-STAGING-ORIGIN.example/mcp/host-scan
```

Use the host's current custom MCP / developer connection interface. Do not submit this prototype to a public directory. It is not a final plugin package. Start with ChatGPT, then certify other hosts separately.

The browser upload/review fallback is:

```text
https://YOUR-STAGING-ORIGIN.example/mcp/host-scan/review
```

GET on the MCP protocol URL intentionally returns 405 because this is a stateless POST transport, not a homepage or GET/SSE session server. OPTIONS returns CORS headers. POST initialize, tools/list and resources/read are the relevant MCP checks. The public browser review is GET 200 only when enabled.

Existing middleware covers the `/mcp` public prefix and public APIs. Confirm hostname routing on the actual staging domain. For ChatGPT, allow the sandbox origin actually observed during testing. Do not guess a universal host list or loosen the root site's security headers.

Native file ingestion stays off until `QC_HOST_SCAN_FILE_ORIGINS` has verified exact file origins. The UI upload works without that list. The downloader enforces HTTPS, public DNS resolution, address pinning, no redirects, no user credentials and size/time bounds. Temporary URLs may expire; refresh or use upload instead.

## 5. Run the automated staging smoke

Compile the isolated core using the repository's installed toolchain:

```sh
node docs/plugins/host-roof-scan-phase1/tests/build-core.cjs
node --test docs/plugins/host-roof-scan-phase1/tests/core.test.cjs
QC_STAGE_ORIGIN=https://YOUR-STAGING-ORIGIN.example node docs/plugins/host-roof-scan-phase1/tests/staging-smoke.mjs
```

The smoke script tests all four real SDK tool calls, UI resource retrieval, reviewed export and temporary-image deletion. It supplies synthetic coordinates itself and therefore is not an AI test or a human-review study.

For local software/browser testing:

```sh
node docs/plugins/host-roof-scan-phase1/tests/local-harness.cjs
# Separate terminal with Python Playwright and Chromium installed:
QC_EVIDENCE=/tmp/qc-outline-evidence python docs/plugins/host-roof-scan-phase1/tests/browser_smoke.py
```

Local harness logs explicitly say NOT SDK. Do not use it as a production server. Normal browser tests navigate real local pages. The recorded authoring run used `QC_OFFLINE_BROWSER=true` because browser navigation is blocked in this environment; that test-only mode injects a local HTTP adapter and does not certify deployed CORS/CSP or file download behavior.

## 6. Test real ChatGPT

Follow `LIVE_HOST_TEST.md`. Start without an OpenAI API key available to this feature. Use genuine plans, inspect the host's tool calls, and verify the returned image was actually visible. Record the unedited proposal and corrected output separately. Confirm no paid scan API traffic or account records changed.

## Rollback

Set `QC_HOST_SCAN_ENABLED=false` and redeploy. This disables the new MCP, upload and review handlers. Existing free tools, `/mcp` and paid AI Scan remain unchanged. Purge the dedicated test bucket after any retained evidence is handled appropriately. Rotate the separate HMAC secret to invalidate outstanding references if needed.
