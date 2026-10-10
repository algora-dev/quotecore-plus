# Required host bindings and remaining gaps

These are launch blockers, not optional enhancements. Complete them in the full repository and return the relevant code/test evidence. Do not work around a guard by falling back to a legacy unlimited plan.

## 1. Roof Scan Assist UI and workers

The supplied synchronous endpoint has three technical stages: outline, component-line detection, then classification. Customer billing remains two operations. The final classification tail is tied to exactly one successful paid component result.

Integrate `scan-client.ts` at the real scan caller:

1. Create one immutable request ID/body per intended paid operation, outside any retry loop.
2. Keep it for a transport retry. Do not generate a fresh UUID on every retry or double-click.
3. Send `Idempotency-Key` and the same `clientRequestId` in the body.
4. Carry `billingOperationId` from the paid scan2 response as `scanOperationId` on scan3. Use the returned lines, outline and dimensions unchanged for that continuation.
5. Keep quality, image, page, calibration and canvas dimensions consistent. User edits belong after the continuation or in a genuinely new scan.
6. A pending result is not permission to run the provider again. An explicit new attempt after a refunded failure gets a new ID.

Debug image URLs are omitted from custom durable responses. Geometry/result content is cached for replay. Review retention/access requirements and bound result size.

The active caller and queue worker are absent. Both the HTTP queue/calibration routes and direct `ai_scan_jobs`/`calibration_runs` writes are blocked for custom accounts until adapted. Manual calibration remains possible through existing digital takeoff tooling. Either complete those workers using equivalent paid reservations/idempotency/refunds, or explicitly route custom scans to the synchronous protocol after testing. Do not silently do this in a catch handler.

The supplied calibration source references a newer refine-parent function not included in the packet. Preserve its real safety logic. Do not substitute the older 049 function wholesale.

## 2. Smart Assistant provider loop and voice

`app/lib/smart-assistant/turn.ts` imports `./orchestrator`. That active file is not supplied. `app/lib/assistant/orchestrator.ts` is a different guide assistant, not a substitute.

Place `withAssistantProviderBudget()` at EVERY actual paid provider boundary for custom tasks. Include planning, tool iterations, retries, final synthesis and any billable vision/embedding work. Keep existing legacy guards. Use `customScope()` from the server to pass account ID/mode, never browser values.

The adapter requires:

- An accepted run ID and unique internal call key.
- A server-owned input-token upper bound including history, tools, framing and image allowance.
- A real provider output cap and a cancellation signal actually passed to the SDK.
- Actual input/output usage on success; uncertain usage retains the reserved ceiling.

Review the provider/model allowlist and different model costs. Token caps are operational limits, not a guarantee of dollar margin. Budget all retries and avoid SDK automatic retries that escape a separate reservation. Bound the number of tool/provider loops.

The new policy is deliberately disabled/missing by default. Until instrumented, new custom requests fail before the run/message/task transaction commits. Existing admitted duplicates still resolve. Set budget ceilings sufficiently high for legitimate Heavy usage, and treat a safety refusal as an operational issue, not an instruction to buy tasks.

Voice transcription happens before a task and is NOT a second Assistant Task. The supplied audio endpoint currently has no equivalent measured cost/retry budget. It is blocked for custom accounts until you implement a separate internal audio bound and retry/rate protection. Return that binding, plus TTS/other voice endpoints if used. Do not simply remove the guard.

A task means one accepted user request, even if several model/tool calls follow. Replies and internal steps do not add customer tasks. Deleting runs does not restore tasks. Automatic Assistant failure refunds are not added by P2; existing accepted-request semantics remain. Any support credit requires an explicit audited adjustment design.

## 3. Storage lifecycle and bucket policies

The patch protects server finalization and metadata accounting. It does not by itself cap all physical bytes before upload.

Required audit:

- All document, plan, logo, library and attachment uploads must reach a measured finalizer. The supplied document finalizer and `saveFileMetadata` are patched.
- Prefer a new immutable object path per upload. A client must not overwrite a registered object with a larger blob while leaving old metadata/usage in place. Audit `storage.objects` INSERT/UPDATE policies and signed upload issuance.
- Enforce bucket per-file limits, upload admission/rate limits, and cleanup of interrupted/raw uploads. A browser-declared size alone is insufficient.
- For deletion, call the Storage API and delete metadata, then `releaseRemovedCustomObject()`. Either order is tolerated; capacity releases only when both are gone.
- The document orphan cron now claims a tombstone before removal and revisits old holds, including already-missing objects. It does not sweep logos because logos can have additional references outside `quote_files`.
- Reconcile the existing storage counter before rollout. Do not silently set it to zero or assume all files are in one table/bucket.

Supply the actual Storage policies, upload issuance and all finalization/deletion callers. Do not directly DELETE from `storage.objects` in application code; the SQL fixture does that only to simulate completed API removal.

## 4. Quote status trigger and legacy regressions

The supplied live `create_quote_atomic` checks the legacy counter but does not increment it; `fn_quote_status_usage_delta` counts status changes. Its body is not supplied. P2 uses an independent creation ledger for custom accounts and leaves legacy behavior intact.

Return the live status-trigger body and test custom create/status/delete/clone against it. Confirm it neither refuses custom operations using a legacy cap nor underflows a legacy status counter on deletion. If adaptation is necessary, preserve exact legacy behavior and use a reviewed custom branch. Do not guess its logic from its name.

The original public function OIDs are preserved by P2. Verify existing policies and dependent functions now resolve through the guarded public functions. All server quote entry points must still use `createQuoteAtomic()`; inspect direct quote inserts and imports as well.

## 5. Offcuts and other execution boundaries

The actual Offcut execution endpoint/worker is absent. Call `requirePurchasedTool(companyId, 'offcuts')` after real company/quote authorization and before work, preserving the caller's original legacy permission check. Do not rely on hiding a button. Digital Takeoff and other generic feature gates use the updated SQL `company_has_feature` path, but audit direct table/worker paths that bypass it.

## 6. Billing UI, limits and admin tools

Expose `usagePeriodStart`, `usagePeriodEnd`, current usage and selected limits from the entitlement snapshot. Storage is active bytes, not a monthly reset; use decimal GB consistently with the catalogue. Include pending deletions in the displayed accounted storage and explain pending cleanup.

Show custom quote creation, Scan Tokens and Assistant Tasks separately. `usagePeriodEnd` is the renewal boundary; do not display the first of next month. Handle structured QCP refusal codes without raw SQL messages. Error details are for usage/remaining values, not trusted pricing.

P1 subscription changes remain disabled. Link to the configured setup/support comparison flow without claiming an immediate upgrade is already supported.

Existing admin quota-reset/comp tools are legacy-oriented. Do not reset custom usage by clearing old counters or deleting P2 ledger rows. Preserve legacy admin overrides. A legacy comp override does not replace a custom paid grant; manual custom grants need a distinct reviewed path. The supplied report says none exist, but verify that now.
