# Phase 1B integration and staging instructions

**Authoritative handoff for this package.** Do not combine it with the earlier `Host_Powered_Scan` package. This incorporates the latest `Host_Powered_Outline` Phase 1 source and supersedes its deployment instructions. No production enablement is authorised.

## 1. Preserve the latest repository and record its baseline

Extract the delivery ZIP outside the repository. Set these paths to real local locations:

```sh
PACK=/absolute/path/to/QuoteCore_Host_Outline_Phase1B
REPO=/absolute/path/to/current/quotecore-plus
EVIDENCE=/absolute/path/outside-repo/phase1b-agent-evidence
mkdir -p "$EVIDENCE"
python3 "$PACK/repackage-return.py" --repo "$REPO" --snapshot "$EVIDENCE/before-source.json"
cd "$REPO"
npm ci
# Capture baseline status before applying, including pre-existing failures:
node node_modules/typescript/bin/tsc --noEmit --incremental false > "$EVIDENCE/baseline-tsc.log" 2>&1
npm run build > "$EVIDENCE/baseline-build.log" 2>&1
```

Use the full current repository with its original assets and vendored `packages/*.tgz`. The provided `quotecore-plus/` reference folder originates from a lean snapshot and cannot restore omitted media. Do not delete files absent from it or overwrite newer application changes. Read the repo's current `AGENTS.md` and installed Next documentation before resolving integration conflicts.

No new dependency is requested. The code targets the existing locked MCP SDK, Zod, Sharp and Next packages. Do not fix unavailable dependencies by silently upgrading them.

## 2. Apply only the supplied delta

```sh
python3 "$PACK/package-tests.py"
python3 "$PACK/apply-package.py" --repo "$REPO"
# Review the dry run. Then apply with a backup outside the repository:
python3 "$PACK/apply-package.py" --repo "$REPO" --apply --backup "$EVIDENCE/before-overwrite"
```

The helper checks every payload hash and current target hash before writing anything. It accepts the supplied lean baseline or the exact latest outline-only Phase 1 files, as recorded in `source-manifest.json`. It is idempotent. A newer conflicting file makes it stop without writing. There is intentionally no force flag.

If `/mcp` or any new path already differs, merge the narrow changes manually and record the reason in the agent report. `existing-mcp.patch` shows the only original-file diff. Never overwrite another implementation merely because this package is newer in this conversation. `source-manifest.json` is the source-of-truth delta; the full reference folder is for inspection.

## 3. Run the integration gates using the real installed dependencies

```sh
cd "$REPO"
node docs/plugins/host-roof-scan-phase1b/verify.mjs --out "$EVIDENCE/verification"
```

This runs whole-project TypeScript, scoped production-file ESLint, isolated core compilation, the 36 existing core tests, configuration/request tests, staging-helper tests, the actual locked MCP SDK route suite, project prebuild and Next build. It exits nonzero if any gate fails. Compare pre-existing errors against the before logs; disclose them rather than calling a failing build green.

The authoring environment could not install npm packages. Actual SDK, Zod registration typing, Next build, deployed CSP and hosting middleware integration MUST be checked here. The included SDK tests exercise real route handlers and the SDK, but mock the distributed rate-limit network and supply synthetic coordinates. They are not vision tests.

Optional UI regression with Python Playwright and Chromium installed:

```sh
QC_TEST_OUT="$EVIDENCE/verification/core-build" \
  node docs/plugins/host-roof-scan-phase1/tests/local-harness.cjs
# In another terminal:
QC_EVIDENCE="$EVIDENCE/browser" \
  python3 docs/plugins/host-roof-scan-phase1/tests/browser_smoke.py
```

The local harness is a test adapter, NOT the deployable MCP server. Use normal browser navigation on the agent's machine. The author's offline browser mode is not a deployed security check.

## 4. Choose the staging origin and configure server-only environment

Use one stable-for-the-test HTTPS preview deployment, for example an actual unique Vercel preview hostname. Do not use `quote-core.com`, `app.quote-core.com`, the demo domain or country domains. The baseline middleware also redirects several stable Vercel aliases, including `quotecore-plus-dev.vercel.app`, to production. Those aliases are blocked by the setup guard. Prefer a verified preview URL rather than changing middleware.

Review `env.example`. Set the following in the staging deployment's server environment, never in committed source or a browser-exposed variable:

```dotenv
QC_HOST_SCAN_ENABLED=false
QC_HOST_SCAN_ON_MAIN_MCP=false
QC_HOST_SCAN_ORIGIN=https://ACTUAL-STAGING-HOST
QC_HOST_SCAN_STORAGE=supabase
QC_HOST_SCAN_BUCKET=qc-host-outline-staging
QC_HOST_SCAN_SECRET=GENERATE_A_SEPARATE_RANDOM_SECRET
NEXT_PUBLIC_SUPABASE_URL=https://ACTUAL-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=EXISTING_SERVER_SIDE_SERVICE_ROLE_KEY
QC_HOST_SCAN_FILE_ORIGINS=
QC_HOST_SCAN_UI_ORIGINS=
```

Generate the independent signing secret with `openssl rand -hex 32`, and place it directly in the environment manager. This is not an OpenAI API key. Keep the same secret and canonical origin across instances of that staging deployment. Changing the secret invalidates existing temporary sessions.

Reuse the approved server-side Supabase project connection. Prefer a staging project. Use only the new dedicated private bucket. No public bucket policy, user-account permission or SQL/RLS change is needed by this package.

`memory` mode is local-only and refused on Vercel or production-mode processes. A Vercel preview normally uses `NODE_ENV=production`; it still works with `QC_HOST_SCAN_STORAGE=supabase` and `VERCEL_ENV=preview`. The code refuses activation on `VERCEL_ENV=production` and known production/redirect origins. This is a safety guard, not automatic verification that an arbitrary custom domain is a safe staging host.

## 5. Provision and check the existing infrastructure

Load the actual staging values into the operator's shell using the approved secret manager. Do not paste secrets into command-line arguments or the returned report.

```sh
cd "$REPO"
node docs/plugins/host-roof-scan-phase1b/setup-staging.mjs --check
# Only if the dedicated bucket is missing and its name has been checked:
node docs/plugins/host-roof-scan-phase1b/setup-staging.mjs --create-bucket --probe
# If it already exists:
node docs/plugins/host-roof-scan-phase1b/setup-staging.mjs --probe
```

The setup helper never makes an existing bucket public, rewrites its policies, changes another bucket or edits a scheduler. It confirms the existing `consume_rate_limit` RPC allows one request and rejects the second under a disposable test key. Its image probe writes, reads and deletes only its synthetic test object.

If that existing RPC is absent/broken in staging, stop and restore the project's existing rate-limit infrastructure. Do not invent a permissive fallback. Vercel/production-mode host-outline operations fail closed.

Before real plan uploads, arrange staging retention using the operator's scheduler:

```sh
node docs/plugins/host-roof-scan-phase1b/retention.mjs --dry-run
# Review the count and dedicated bucket, then:
node docs/plugins/host-roof-scan-phase1b/retention.mjs --execute
```

Run it regularly, for example every 15 minutes, with the same staging environment. It only deletes objects under the host-outline prefix older than 35 minutes. Access capabilities expire after 30 minutes. Access expiry alone does not delete physical storage, and neither deletes copies already held by an AI host or downloaded by a user.

## 6. Deploy disabled first, then opt in on staging

Deploy with both flags false. The existing endpoint should still expose only the original three tools:

```sh
QC_STAGE_ORIGIN=https://ACTUAL-STAGING-HOST \
 node docs/plugins/host-roof-scan-phase1b/smoke.mjs --expect-disabled
```

After storage, rate limiting, retention and build gates are acceptable, set both flags to `true` in staging and redeploy:

```dotenv
QC_HOST_SCAN_ENABLED=true
QC_HOST_SCAN_ON_MAIN_MCP=true
```

Then test:

```sh
QC_STAGE_ORIGIN=https://ACTUAL-STAGING-HOST \
 node docs/plugins/host-roof-scan-phase1b/smoke.mjs --expect-enabled
QC_STAGE_ORIGIN=https://ACTUAL-STAGING-HOST \
 node docs/plugins/host-roof-scan-phase1b/smoke.mjs --expect-enabled --exercise --confirm-staging
# Optional parity check of the isolated compatibility endpoint:
QC_STAGE_ORIGIN=https://ACTUAL-STAGING-HOST \
 node docs/plugins/host-roof-scan-phase1b/smoke.mjs --expect-enabled --isolated
```

The synthetic exercise uploads its labelled fixture, submits known coordinates, verifies that unreviewed export is rejected, confirms through the software review API, exports and deletes the image. This proves software wiring, not AI tracing quality or a real person's review.

Inspect response headers in the actual deployment. `GET /mcp` and `GET /mcp/host-scan` intentionally return 405; those are protocol endpoints, not webpages. `POST initialize`, `tools/list`, `resources/read` and `tools/call` are the important checks. `OPTIONS` returns 204. `GET /mcp/host-scan/review` returns the fallback HTML when enabled.

If the preview requires Vercel authentication, the AI host will not inherit your browser cookies. `QC_STAGE_PROTECTION_BYPASS` can be used only for CLI diagnostics, and a successful bypassed smoke does NOT prove host accessibility. Configure operator-approved staging access for the actual host and sandbox. Never put bypass secrets into a public URL, MCP description, tool arguments, browser code or returned ZIP. Do not weaken production protection or global security headers.

## 7. Connect the real ChatGPT host

Connection URL:

```text
https://ACTUAL-STAGING-HOST/mcp
```

OpenAI's current documented path is ChatGPT Plugins, plus, Add custom MCP server. Enter the HTTPS MCP URL and a clearly experimental connection name, select the appropriate no-auth option, review the warning, create/install the custom plugin and select it in a new conversation. Workspace permissions can affect availability. This prototype does not link customer accounts and is not a public directory submission.

Refresh the connection after changing tools, schemas or metadata. This package also versions the UI resource as `ui://quotecore/host-roof-outline-v1b.html` to separate it from the earlier panel.

First use the browser/upload panel so native ChatGPT file-download origins are not a prerequisite. The panel can send a request through the host bridge or provide copyable instructions. The host must call `qc_prepare_roof_outline` with that plan token, receive the actual prepared image and then perform its own tracing before calling `qc_submit_roof_outline`. The panel does not silently run a paid model in the background.

After this works, inspect a real host-provided attachment reference and allow only its exact HTTPS origin in `QC_HOST_SCAN_FILE_ORIGINS`. Never use a wildcard or disable DNS/redirect checks. A native file has declared `download_url`, `file_id` and optional `mime_type`/`file_name` fields. Expired links should fail with a useful error; re-upload rather than bypass validation.

For the embedded UI, allow the sandbox origin actually observed if it is not opaque or same-origin. `QC_HOST_SCAN_UI_ORIGINS` takes exact origins only. Server calls may have no Origin, and sandboxed UI may send `Origin: null`; neither is proof of identity. The temporary capabilities protect access. The `_meta` review gate keeps the ordinary model tool path from confirming its own proposal, but is not proof of human identity against a deliberately scripted client.

The host embeds the HTML **resource**, not the browser fallback URL. Leave the fallback `frame-ancestors 'none'` and global site iframe restrictions intact. Test other AI hosts separately; a shared MCP backend does not certify identical UI behavior or discovery.

## 8. Live acceptance and rollback

Use `LIVE_HOST_ACCEPTANCE.md`. Use a real image for which no expected coordinates have been supplied to the model. Save the model's raw proposal, the reviewed export, corrections and errors. Do not count the supplied synthetic coordinates as AI evidence.

Rollback the experiment by setting `QC_HOST_SCAN_ENABLED=false` and `QC_HOST_SCAN_ON_MAIN_MCP=false`, redeploying and refreshing the custom connection. The three legacy tools remain. To remove it only from the combined endpoint while retaining isolated staging diagnostics, turn off just `QC_HOST_SCAN_ON_MAIN_MCP`. Keep retention running long enough to clear temporary objects. Do not delete shared storage/RPCs or restore an old whole repository.

## 9. Return the complete integrated source to the owner

Fill `AGENT_HANDOFF_RESPONSE.md` at package root. Include the real staging MCP URL, deployed commit, flag states, gate statuses, known errors and the live-host test findings. Do not include credentials, signed temporary references or private plan contents.

```sh
python3 "$PACK/repackage-return.py" --repo "$REPO" \
 --before "$EVIDENCE/before-source.json" \
 --output /absolute/path/QuoteCore_Phase1B_Agent_Integrated_Return.zip \
 --evidence /absolute/path/to/SCRUBBED-notes-only
```

The return includes `quotecore-plus/`, all current source and integration changes, `AGENT_FILE_CHANGES.json`, `SOURCE_TREE.json` and checksums. The helper excludes environment secrets, build outputs, dependency directories and font files. It retains local dependency tarballs needed for installation. Manually review ordinary source/log contents for accidentally hardcoded secrets before sharing; filename filters cannot prove they contain no sensitive data.

Return the complete source ZIP, not merely this original input package or a screenshot of a successful deploy.
