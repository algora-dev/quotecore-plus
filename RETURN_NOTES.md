# RETURN NOTES — Smart Assistant Workflow Controller V1 integration candidate

**Date: 2 October 2026. Source implementation delivered; NOT deployed, NOT live-validated.**

## Start here

Read `AGENT_INTEGRATION_WORKFLOW_V1.md`, then this return's `TEST_RESULTS.md`, `MIGRATIONS.md`, and `LIVE_ACCEPTANCE.md` in `docs/sa-workflow-controller-v1-2026-10-02/`.

This return is based on the supplied **October 2 lean ZIP**, not on the abandoned previous agent's environment. The old September 30 return notes are preserved as `PREVIOUS_RETURN_NOTES.md` in that folder. Older root and documentation claims about live testing refer to earlier releases, **not this return**. `WORKFLOW_V1_CHANGED_FILES.json` is this return's change manifest; the older root manifests remain historical.

## Implemented

**A — Workspace vocabulary and explicit library mappings.** Eight stable built-in concepts; editable names/aliases; normalized singular/plural variants; up to twelve custom concepts inheriting an existing safe measurement behavior. Existing library profiles/members are extended, not replaced by a second product catalogue. Settings saves are transactional and epoch-checked; one default per concept/library; deliberate mappings override Takeoff suggestions. The server resolves requested product → configured default → sole compatible product → grouped real alternatives.

**B — Workflow Controller V1.** Durable versioned working briefs with server-generated stable area, component-group and individual-entry IDs. Separate intent-to-brief and typed-correction tools; paginated measurement reader; grouped partial choices; explicit workflow/card states; task visibility and closure checks. The model cannot rebuild an active brief through the new-job tool or bypass it through registered legacy low-level correction tools. Clear new goals use the existing task-boundary system, rather than attaching to an old produced quote. Correct rollout therefore includes the existing task-context/resolver capability.

**C — Same-draft incremental revision.** Existing parent creation, quota/admission and P4 explicit confirmation remain in place. A committed quote, canonical plan and exact quote snapshot are bound to the brief in the finalizer transaction. Revisions use stable-ID structural differences and an atomic trusted child writer, retaining unchanged rows, rates/waste settings and audit timestamps. The old clear/rebuild helper is explicitly disabled and revoked. The unique result-quote index is corrected to allow multiple edit actions without allowing duplicate parent creation. External edits, sent/accepted/deleted drafts, stale revisions/configuration and uncertain creation outcomes fail closed; no silent rebase or replacement draft.

**D — PWA authentication/launch.** Supabase SSR 0.9.0 batched cookies preserve every refreshed chunk/deletion across normal, demo and redirect responses. No cookie lifetime extension or indefinite session policy was introduced. Transient authentication verification failures return a retryable unavailable response instead of treating the request as authenticated. The global `/assistant` launch route resolves the authenticated workspace; no tenant is hard-coded into the manifest. Login redirects retain safe deep-link query parameters.

**E — Opt-in alert-backed push.** Subscription settings, per-device categories, owner/tenant RLS, current membership/MFA checks, alert-triggered durable outbox, leased dispatch, bounded retries/cleanup and authenticated tap resolution. Lock-screen payloads contain an opaque delivery ID, not customer names or amounts. The push-only service worker does not cache application/auth responses or navigate an open unsaved builder away. Native Node Web Push transport is covered by the RFC known-answer vector and independent decryption/signature tests; real provider/device interoperability still requires testing. No new npm dependencies or key material were added.

## Actual verification in this environment

- New offline tests: **30 controller/engine/cookie tests, 20 service orchestration tests using mocked transport/access, 23 push/protocol/service-worker tests — all pass.**
- New static source assertions pass. **367 protected baseline files are byte-identical**, including pricing/billing/trade helpers, quote creation actions, retrieval/resolver implementations, dependency manifests, and all original SQL migrations.
- Syntax transpilation: **42 new/changed TypeScript/TSX files**, zero syntax diagnostics. This is not a semantic typecheck or a Next build.
- Selected existing offline suites pass; others could not run or failed their harness checks because this environment lacks installed dependencies or the lean archive omits historical fixtures. Full command-level results are included.
- `npm ci` attempted but network/DNS failures prevented dependency installation. Full typecheck was attempted and blocked by missing packages/types. Lint and build were attempted but `eslint`/`next` executables are unavailable. No clean build claim is made.
- **No SQL migration was applied. No live database/RLS/race, real model conversation, browser/device, push-provider delivery or latency acceptance was run.**

## Integration controls

Keep `SMART_ASSISTANT_LIBRARY_WORKFLOW_ENABLED=false` and `PWA_PUSH_ENABLED=false` during integration. Inventory existing migrations across the repository's migration directories. Apply the four new migrations in the documented order on staging, review the renamed/wrapped RPCs, regenerate database types, complete dependency/type/lint/build gates and live acceptance, then enable a test workspace deliberately.

Do not run the old `supabase/migrations/20261002150000_draft_brief_edit_in_place.sql` after the new controller migration: it would recreate a destructive legacy helper. Do not downgrade the database helpers during an application rollback.

## Scope and limits

This is an integration candidate, not a production-release certification. Same-draft continuation starts with a controller-created manual draft; it does not adopt arbitrary old drafts or automatically rebase external builder edits. Initial push is generic event delivery, not AI-written notifications or a proactive attention digest. Voice/text/TTS are preserved; no Realtime/WebRTC or image understanding was added. See `KNOWN_LIMITATIONS.md` for operating bounds, recovery guidance and unverified gates.
