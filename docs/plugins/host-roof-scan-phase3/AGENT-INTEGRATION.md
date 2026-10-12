# QuoteCore+ MCP roof-outline reliability patch

**Target source:** `qcp-tools-plugin-source-20261011-285c0d81.zip`, supplied on 2026-10-11.
**Source archive SHA-256:** `cd1eff9db41383cca07e89edc91de326435d1af0e2ba2533c9f3f2facd478c41`.
**Status:** implemented, locally unit-tested integration candidate. Not deployed; full-repository, browser, real-storage and ChatGPT acceptance gates remain mandatory.

This document supersedes earlier implementation advice where it conflicts with the actual latest source. In particular, the archive's `README-AGENT.md` still names the older `0fdc59d5` commit; the supplied archive and its newer status update identify `285c0d81`. Verify file hashes rather than relying on that old README. The archive is a source slice, not a standalone installable repository.

## 1. Objective and boundary

Keep the real five-tool MCP outline workflow. Fix temporary references, correct review navigation and schema compatibility, and make failed image/review requests diagnosable. Do not introduce an external paid scan, invent base64 data, infer pitch, or substitute unrelated geometry code.

The source status update reports that panel upload + an exact canonical attachment + MCP proposal submission already worked in ChatGPT. That report is not independent evidence from this patch's tests. This patch preserves that route rather than promising to change how ChatGPT renders MCP image blocks.

The intended loop is:

1. Upload an image to the panel, or use a genuine supported `plan` file object / actual bounded `image_data` bytes. The panel receives a short `planToken` when opaque mode is enabled.
2. Call `qc_prepare_roof_outline` with that exact reference. Inspect its canonical raster. If metadata only, call `qc_get_roof_outline_image` once; use the exact downloaded canonical attachment if necessary. Never derive a transform from a different thumbnail or original.
3. Submit one exterior polygon through `qc_submit_roof_outline`, with `observedImageId` matching the frame and `pitch_degrees: null`.
4. Show the returned `resultUrl` verbatim, including the fragment. A second open-tool call is not needed merely to obtain the browser link; `qc_open_roof_outline_review` remains available for embedded review.
5. The user reviews and explicitly confirms in the panel. Optional calibration and pitch are reviewer inputs. Export through `qc_export_reviewed_roof_outline` using the reviewed reference.

## 2. Changes implemented

### Short, shared-store references

`references.ts` adds versioned, purpose-bound references of the form `qcr1p_<expiry>_<nonce>` (plan), `qcr1o_...` (proposal), and `qcr1r_...` (reviewed). They are approximately 37 characters today, with a 128-bit random nonce—not guessable short invitation codes. The public parameter names stay `planToken`, `proposalToken`, and `reviewToken` for compatibility.

The server resolves them to the existing signed tickets in a separate private store. The record has an HMAC binding to the exact reference and signed payload. Storage keys contain a SHA-256 digest of the reference, not the raw capability. Wrong purpose, malformed/modified references, changed records, missing storage, and expiry fail closed. No approximate matching or automatic repair occurs.

The default remains `signed`. Enabling `opaque` requires shared reference storage on staging. Old signed tokens remain readable in opaque mode. Returning to signed issuance can still read existing opaque references if the new code, signing secret, and reference bucket configuration are retained. The underlying session remains **30 minutes from upload**, without sliding renewal; edits do not extend it.

`reference-store.ts` supports memory for local tests and Supabase for staging. The Supabase reference bucket is **separate from the image bucket**, private, restricted to `application/json`, and capped at exactly 65,536 bytes per object. No new runtime dependencies, database tables, RLS changes, or public download URLs are introduced.

### Review links and recoverable errors

The review panel now accepts a complete saved link, resolves it through the API, verifies the canonical raster, and preserves the current confirmed snapshot in the standalone URL fragment. Bare links show a clear missing-reference state rather than silently restoring an old proposal. A failed link switch disables confirmation of the old session. Expiry blocks confirmation.

JSON error codes such as `ORIGIN_NOT_ALLOWED`, `INVALID_REFERENCE`, `REFERENCE_NOT_FOUND`, and `EXPIRED` are visible. HTML/non-JSON access-protection errors are distinguished as `HTTP_<status>_NON_JSON`. Network errors and timeouts are distinct; no raw HTML or credentials are copied into diagnostics.

The panel can reopen a confirmed snapshot, edit calibration/pitch without retracing, and explicitly confirm a new immutable snapshot. Prior reviewed links remain prior snapshots. Pending scale edits cannot silently use the old scale. Export can be retried without making another confirmation. Middle-button/Space pan and Enter-to-apply-scale remain in the existing UI.

### Schema and input fixes

Model proposal input still requires null pitch, now enforced inside the service as well as in the MCP input schema. Reviewer output supports the numeric pitch already allowed by the panel, plus calibration and the existing measurement fields. This fixes the previous mismatch between returned data and the declared output schema; it does not introduce a new pitch-inference algorithm.

The isolated `/mcp/host-scan` route now uses the same bounded MCP JSON limit as `/mcp` so inline image requests above the old 128 KiB limit can reach the existing decoder. The decoded upload limit remains 3 MiB and the prepared image limit remains 2 MiB; existing upload rate limits remain. A deployment/host may impose a lower envelope limit than the application's 5 MiB ceiling. Test the actual route rather than assuming every allowed application body will reach it.

The UI resource is versioned to `ui://quotecore/host-roof-outline-v3-session-reliability.html`. Active smoke/diagnostic tests have been updated accordingly. The tool set remains 3 legacy takeoff tools plus 5 outline tools; no confirmation MCP tool was added.

### Deliberately unchanged

Remote file fetching, DNS/IP checks, exact file-host allowlists, canonical image preparation, shared precision geometry, legacy calculation logic, and staging-only protection are not replaced or loosened. Local sandbox paths are still not image transfer. `image_data` is an existing alternate byte-input path, not a guarantee that a ChatGPT connector will supply it.

## 3. Apply to the full repository

Start from the current full repository on a clean integration branch. Do not overwrite the entire repository with the uploaded source slice. The distribution contains `patch.diff`, `files/` with changed/new repository-relative files, and a per-file `MANIFEST.json` with before/after SHA-256 values. Use **one** integration method, not both.

Preferred:

```bash
git switch -c fix/qcp-outline-reliability
git status --short
# Review MANIFEST.json and patch.diff; resolve any source drift deliberately.
git apply --check /absolute/path/to/patch.diff
git apply /absolute/path/to/patch.diff
git diff --check
```

An alternative is to merge the files under `files/` into the matching repository paths, checking the manifest. Do not force an application over conflicting newer source. There are no requested changes to `package.json`, the dependency lockfile, calculation packages, application tables or production middleware.

The optional source-slice test helpers under `tests/` are diagnostic tools, not production substitutes. In particular, **never copy the generated contents of an adapter-backed test build into `app/`**. `install-slice-adapters.cjs` refuses a complete repo and emits only into an explicit external test directory. The full verification runner does not invoke it.

## 4. Required full-repository gates

Use the full repository's committed dependency lockfile and private package artifacts. Do not upgrade dependencies to make this patch install. With approved repository-local test/build environment values available:

```bash
npm ci
node docs/plugins/host-roof-scan-phase3/verify.mjs --out /tmp/qcp-phase3-evidence
```

The runner invokes the previous baseline verification (whole-project TypeScript, scoped lint, actual MCP SDK route tests, normal prebuild/Next build), image-delivery tests, and the new reference/service/UI-function/operations regressions. The SDK suite now covers opaque references, numeric reviewer output, immutable reopening, both MCP routes' larger inline requests, upper size bounds, upload rate guards, and the original three tools. These SDK assertions were written and syntax-checked here but could not run without the full repository dependencies.

Do not waive new TypeScript, lint, build or regression failures. Existing unrelated baseline failures need a before/after comparison and an explicit owner decision—not a changed test expectation that hides a regression. The old test that rejected reviewer pitch was updated because the supplied current geometry parser already supports reviewer pitch; the model prohibition has separate service and schema tests.

### Browser gate

Use the real core build produced by the verification runner, not a slice-adapter build. It is normally at `/tmp/qcp-phase3-evidence/baseline-gates/baseline-gates/core-build`; the runner also records it as `coreBuild` in its report.

In one terminal:

```bash
QC_TEST_OUT=/tmp/qcp-phase3-evidence/baseline-gates/baseline-gates/core-build \
  node docs/plugins/host-roof-scan-phase3/tests/browser-harness.cjs
```

In another terminal, using the agent's approved Python Playwright/Chromium installation:

```bash
QC_BROWSER_OUT=/tmp/qcp-browser-evidence \
QC_CHROMIUM_PATH=/absolute/path/to/approved/chromium \
  python docs/plugins/host-roof-scan-phase3/tests/browser-reliability.py
```

The harness binds only to `127.0.0.1:4770`. It exercises the actual widget and service with a synthetic software fixture, not Next routing, real Supabase, ChatGPT, or model vision. The browser scenario checks full-link recovery, missing/invalid/expired references, reviewer recalibration and pitch, stale export invalidation, retry without duplicate confirmation, canonical download hashing, and visible origin/HTML errors. Review its screenshot and test output. Do not disable an organizational browser policy to run it; use an approved test browser/environment.

## 5. Staging configuration and storage

Keep the existing image bucket and signing secret. Introduce a **new** reference bucket, for example `qc-host-outline-refs-staging` (operator-chosen name, not a secret). Add these staging-only settings:

```dotenv
QC_HOST_SCAN_REFERENCE_MODE=opaque
QC_HOST_SCAN_REFERENCE_BUCKET=qc-host-outline-refs-staging
```

The existing required settings remain: `QC_HOST_SCAN_STORAGE=supabase`, the private image bucket, Supabase project URL and server-only service key, `QC_HOST_SCAN_SECRET`, `QC_HOST_SCAN_ORIGIN`, feature flags and exact UI/file origins. The root `.env.example` is a names-only template, not a runnable deployment configuration. Do not leave `QC_HOST_SCAN_REFERENCE_MODE` as an empty string: omit it for signed default or explicitly set `signed`/`opaque`.

Set `QC_HOST_SCAN_ORIGIN` to the stable branch-preview origin actually used by ChatGPT and the panel. A preview alias page still calls the configured canonical API origin; legitimate alternate UI origins must be explicitly reviewed/configured in `QC_HOST_SCAN_UI_ORIGINS`. Do not add wildcard domains or arbitrary file hosts. Existing source permits the same request origin and its documented opaque-host case; this patch does not broaden those rules.

**Safe rollout order:** deploy the new code with `signed` issuance first if necessary; provision/check the dedicated bucket; set its name; then enable `opaque` and redeploy/restart. Configuration is read into a runtime singleton, so toggling an environment value requires a new process/deployment.

With the staging operator's existing credentials loaded securely, first check the target:

```bash
node docs/plugins/host-roof-scan-phase3/reference-ops.mjs check
# If it is missing, and the operator has reviewed the target bucket name:
node docs/plugins/host-roof-scan-phase3/reference-ops.mjs create
node docs/plugins/host-roof-scan-phase3/reference-ops.mjs check
```

`create` only creates the explicitly named missing private bucket. It will not rewrite an existing bucket or broaden image MIME restrictions. No command was executed against your real storage during this review.

### Retention

Reference expiry denies use but is not physical deletion. Arrange an approved staging cleanup job alongside existing image cleanup. Reference cleanup is **dry-run by default**:

```bash
node docs/plugins/host-roof-scan-phase3/reference-ops.mjs purge
# Explicit deletion after reviewing the dry-run:
node docs/plugins/host-roof-scan-phase3/reference-ops.mjs purge --delete
```

The job only considers `host-outline-refs-v1/<UTC-date>/<expiry>-<SHA256>.json` in the dedicated bucket, requires expiry at least five minutes in the past, validates date/filename matching, and collects a bounded complete listing before deletion. Unknown names and active records are skipped. Default caps are 1,000 listing requests and 10,000 candidates; a cap is an operator-visible failure before deletion, not permission to delete a broader prefix. It reports counts rather than capability values. Existing image retention still must run separately.

Deleting an image prevents reopening/verification of that image, but does not revoke an already-issued reviewed geometry snapshot. Such geometry can still export until its original expiry; downloaded and ChatGPT copies are also not deleted. This preserves existing semantics and is not a new account-level deletion or revocation system.

## 6. Deployed software smoke

The existing staging-only guards are intentionally retained: setting `VERCEL_ENV=production` or using a protected production origin disables this experiment. For this round, “live testing” means the hosted **branch preview/staging environment**, not production promotion. A public production rollout requires a separate explicit security/operations decision.

After deployment, use the actual staging origin:

```bash
QC_STAGE_ORIGIN=https://YOUR-APPROVED-STAGING-ORIGIN \
  node docs/plugins/host-roof-scan-phase1b/smoke.mjs \
  --expect-enabled --exercise --confirm-staging --expect-opaque

QC_STAGE_ORIGIN=https://YOUR-APPROVED-STAGING-ORIGIN \
  node docs/plugins/host-roof-scan-phase1b/smoke.mjs \
  --expect-enabled --exercise --confirm-staging --expect-opaque --isolated
```

These are explicit synthetic uploads/confirmations, not user roof reviews or paid AI calls. The smoke verifies opaque reference resolution and numeric reviewer output over HTTP, then deletes its synthetic source image. Geometry reference records are cleaned by retention after expiry. Run normal unassisted host/browser access too: a smoke test using a deployment-protection bypass header does not establish ChatGPT access.

Confirm a short plan can be reopened after a cold instance/restart against the same Supabase bucket and signing secret. Capture safe diagnostic codes and the deployed commit. Do not log raw signed tickets, short bearer references, review URLs, image bytes or service keys.

## 7. Real ChatGPT acceptance (mandatory)

Refresh/rescan the connector and ensure it is enabled for the test conversation. Verify live discovery shows the v3 UI resource, direct-resultUrl submission instructions, `reviewToken` on open, all four file-object schema properties, and eight total tools when enabled on `/mcp`. A stale catalog is not proof that the patch failed.

Start a **fresh** upload; do not reuse the old 2026-10-11 plan token from this conversation. Confirm panel upload returns `qcr1p_...`. If native file transfer is available, inspect the genuine `plan` file object received by the server using safe diagnostics; never pass a `/mnt/data/...` string as if it were a remote file.

Use the same canonical file and frame for host vision. Inspect actual model visibility; hashing/serialization alone does not prove the model saw pixels. If prepare and the once-only reader are metadata-only, attach the exact prepared download by filename/hash/dimensions. Without a visible matching image, stop rather than fabricate an outline. This fallback still uses QCP MCP for validation, review and export; it is not independent roof calculation.

Submit one exterior outline with null pitch. Show the submission's exact review URL. The panel must open the correct proposal on its first use, with no manual copying of a long signed token. Use the **13.7 m** mark only for reviewer calibration, not for generating pixel coordinates. Explicitly confirm, export via MCP, then edit scale/pitch, reconfirm and export again without retracing. Refresh the confirmed link and verify the saved values persist. Verify missing, invalid and expired links visibly fail and cannot confirm a stale proposal.

Success requires the actual host-proposed geometry, the user's confirmation and a matching MCP export. The synthetic tests and unit counts are not substitutes.

## 8. Rollback and remaining limits

To roll back reference issuance only, keep this resolver code, reference bucket name, backing store and signing secret; set `QC_HOST_SCAN_REFERENCE_MODE=signed` and redeploy. Existing short references remain valid only until their original expiry. Switching to old pre-patch code immediately will not resolve short references; allow their 30-minute window to expire first or intentionally invalidate sessions with clear user communication.

To disable the experiment, use existing feature flags. Do not rotate the signing secret casually: doing so invalidates both legacy tokens and stored references. No storage/table migration is needed to keep the legacy three calculation tools running.

This patch does not certify model image visibility, roof geometry accuracy, a production authorization model, the full Next build, or compatibility with every ChatGPT UI surface. It repairs specific source-level reliability paths and provides explicit acceptance gates. The agent should return the integrated commit, verification reports, staging origin, reference-mode/bucket-check result, and host-test outcome, with secrets and bearer references redacted.

## Primary implementation references

Checked 2026-10-11. These document interface contracts, not proof of this deployment:

- OpenAI plugin reference: https://developers.openai.com/plugins/reference — top-level file parameters receive structured file objects; widget file APIs are optional and require feature detection. Retain the existing file descriptor rather than treating a sandbox path as file transfer.
- MCP tools specification: https://modelcontextprotocol.io/specification/2025-11-25/server/tools — declared structured output schemas must match returned structured results; this motivates the reviewer-pitch schema correction.
- Supabase bucket configuration: https://supabase.com/docs/reference/javascript/storage-createbucket — private buckets support file-size and MIME constraints; the new reference bucket is configured separately from images.
