# Agent integration instructions

## Apply and validate

1. Use the latest complete repository. This package's `source/` is the updated supplied snapshot, not permission to overwrite newer application work. Review `source-manifest.json`.
2. From the unpacked package root run `node apply.mjs --target /absolute/latest/repo --check`. The helper checks every before/after SHA and stops on conflicts. Then run with `--apply`; it backs up replaced files. Resolve conflicts deliberately, especially if someone has changed the outline widget or tool registration since `86eb8e97`.
3. Run `npm ci` using the unchanged lockfile. Do not upgrade dependencies to make this patch compile. The author environment could not install dependencies because npm DNS failed.
4. Run `node docs/plugins/host-roof-scan-phase2/verify.mjs --out /absolute/outside/repo/evidence`. This invokes existing TypeScript, lint, SDK route, core and build gates plus new tests. The source handoff reports 80 pre-existing test-file TypeScript errors; verify that baseline rather than assuming it is current. The runner does not waive failures.
5. Run browser tests with the actual HTTPS/localhost environment, without `QC_OFFLINE_BROWSER`. Start `browser-harness.cjs` with `QC_TEST_OUT` pointing at the compiled core directory, then run `browser-delivery.py`. Python Playwright is a test-only dependency, not an app dependency. The author tested this with explicitly labelled offline HTTP/digest adapters; real secure-context/CSP behavior is an integration gate.

## Deploy

Retain the same staging endpoint and existing Phase 1B configuration. No separate server or paid AI key is needed.

- `QC_HOST_SCAN_ENABLED=true`
- `QC_HOST_SCAN_ON_MAIN_MCP=true`
- `QC_HOST_SCAN_ORIGIN` equals the actual staging HTTPS origin, never a production host.
- Existing `QC_HOST_SCAN_SECRET`, Supabase credentials/private bucket, allowed origins and rate-limit settings remain private and unchanged.
- Optional new `QC_HOST_SCAN_DIAGNOSTICS=true` logs safe content-type, size and hash metadata with correlation IDs. It never intentionally logs pixels, input arguments, signed tokens, URLs or filenames. Disable after diagnosis if not needed. Do not enable general raw RPC/body logging.

Use the existing `qc-host-outline-staging` bucket. Do not recreate public buckets, change SQL/RLS, alter retention, loosen host restrictions or globally change headers. Keep this staging-only. Review the existing preview-protection exception; restore protection after the experiment. A smoke test's bypass header is not inherited by ChatGPT.

## Verify the deployed protocol

Run the updated existing checks:

```sh
export QC_STAGE_ORIGIN='https://YOUR-STAGING-HOST'
node docs/plugins/host-roof-scan-phase1b/smoke.mjs --expect-enabled
node docs/plugins/host-roof-scan-phase1b/smoke.mjs --expect-enabled --exercise --confirm-staging
node docs/plugins/host-roof-scan-phase2/diagnose.mjs --exercise --confirm-staging --out /absolute/private/evidence
```

The exercise uploads a small synthetic fixture and removes it in cleanup. It does not call any AI API. Diagnostic output includes byte length, SHA, real image dimensions, content types, whether structuredContent is present and server request IDs. It deliberately reports `hostVisibility: NOT_TESTED`.

To inspect an existing user plan instead, store its fresh planToken in a private file with restrictive permissions and use `--plan-token-file /private/token.txt --out ...`. Do not put tokens in shell arguments/history, logs, source ZIPs or public tickets. The script does not delete user plans supplied this way.

Expected: 8 tools on combined `/mcp`; reader has NO outputSchema; prepare keeps its outputSchema; resource URI contains `v2-image-delivery`. The two image results must have the same SHA, dimensions and MIME. If this raw-wire test fails, fix the server/transport before retesting the host. If it passes but ChatGPT sees metadata only, use the panel or exact-file fallback.

## Connect to ChatGPT

Keep the existing staging `/mcp` connector URL. Refresh/reconnect it to reload tool descriptors, then start a fresh chat. Ensure `qc_get_roof_outline_image` is visible and the new review resource is served. Follow `LIVE_TEST.md`. Do not interpret a green SDK test, a browser image or a server `image_ready` response as proof that the model saw the image.

If the host renders no widget, require it to show the returned browser review link. From the normal browser page the Share button cannot call ChatGPT's private runtime. The page correctly offers **Download prepared image** and **Copy request** instead.

## Return to the owner

Use `node pack-return.mjs --repo /absolute/latest/repo --out /absolute/agent-return.zip` from this package root. It creates a complete source ZIP with the current app, this integration, extra agent changes, manifest, checksums and a root return note. It excludes `.env*` except safe examples/templates, dependency/build directories, .git and obvious private-key files. Review the file list for other secrets before sharing; filename filters are not a secrets scanner.

Put actual verification logs and a short live-test record in `docs/plugins/host-roof-scan-phase2/agent-results/` before packaging. Redact real tokens, signed URLs, uploaded plans and personal/customer data. Include:
- Current commit/branch and deployed staging origin.
- Tests passed, baseline failures and new failures separately.
- Whether ChatGPT actually saw an image, which delivery path worked, and whether the outline was model-generated or synthetic.
- Whether the user edited/confirmed/calibrated and exported.
- Any extra agent code changes and remaining blockers.

Do not enable production, remove manual review, change the paid scan, or start component detection in this integration step.
