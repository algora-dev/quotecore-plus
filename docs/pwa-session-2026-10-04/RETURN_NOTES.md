# Return notes — PWA Session Hardening (2026-10-04)

## Provenance and status

Baseline: `quotecore-plus-2f597a14-pwa-session-handoff-lean.zip`; reported source commit **2f597a14**.
SHA-256: `07f3b501a7f3ba8a324e17419e9fd3a70f9e75fca75eb621b286b848cbc146f4`.
The archive is the source of truth. Older root handoffs are historical; the lean export omits some documents they reference. Previous root return notes are preserved in `docs/pwa-session-2026-10-04/BASELINE_RETURN_NOTES.md`.

**Implementation candidate only. Not deployed. No live Supabase/device test. No SQL or Auth configuration changed. The recovery feature defaults OFF.**

## Why this pass

The owner can open a notification inside the installed PWA as an authenticated user, but opening its home-screen icon shows Login. Push delivery alone says nothing about authentication; the existing `/pwa/open` resolver does check authentication and ownership.

Confirmed source gaps: `/login` is a public client form with no existing-session check; a restored Login document therefore cannot correct itself. No-cookie-write middleware redirects had no explicit private/no-store policy. `/assistant` called a throwing profile helper before a null check and mixed `next` with the form's `redirect` parameter. These are real gaps, **not proof of the exact iOS cause**.

## Implemented

- Opt-in server verification of an **existing** normal cookie session through `/api/auth/resume`: `getUser`, own profile/company, MFA, safe destination. No password/token recovery, sign-in call, admin client, bearer-token shortcut or client-provided tenant identity.
- Login checks on initial load, persisted `pageshow`, foreground and reconnect. One in-flight check, bounded timeout, explicit error/form fallback, no polling. A URL marker plus an optional storage timestamp prevents loops when storage is blocked. Credential entry and explicit logout suppress recovery; suspended requests cannot redirect later or strand the UI.
- Correctly preserve safe `redirect` / legacy `next` destinations, notification return through password/Google/MFA, and the existing OAuth free-tool draft handoff priority. Harden protocol-relative/encoded hostile return paths. Other signup/magic-link/reset/impersonation behavior remains unchanged.
- Private/no-store for login and authenticated middleware responses/redirects even when no cookie changes occur. Existing cookie-batch accumulator is retained; all final response branches use it. MFA/provider lookup failures fail closed instead of looking like a successful session check or a confirmed logout.
- `/assistant` resolves its verified workspace directly and distinguishes a temporary lookup failure from anonymous login. Installed manifest ID/start URL/scope are unchanged.
- Optional sanitized `qcp_session_trace` console diagnostics: entry type, original cookie names/counts/chunk gaps, actual refresh attempt/status, emitted cookie names/deletions, auth/profile/MFA/company stages, response category and timings. No token/cookie values, user/session IDs, email, raw URL/query, private body or service-role DB logging.
- Old anonymous auth-debug POST becomes an opt-in, bounded compatibility sink; no debug SQL/table deletion.

## Protected boundaries

SDK pins and dependency manifests, cookie name/domain/numeric retention settings, browser/server Supabase factories, MFA policy, sign-out scope, push worker/routes/outbox/subscriptions, existing SQL, assistant layout/retrieval/workflow/P3/P4/pricing/quota/replay/finish are not changed. Check `PWA_SESSION_CHANGES.json` and the packaging verification for exact counts/hashes. This is not an audit of every pre-existing auth or app behavior.

## Testing actually performed

- **81 source-level tests passed** using the actual new handlers/controller and explicit Next/Supabase mocks.
- **13 Chromium DOM/lifecycle tests passed** using production controller/event bindings with injected auth, navigation, storage and restoration signals; not real React/Next/PWA authentication.
- **73 retained executable workflow/push checks passed**. Their combined runner is **not green**: a historical static checker expects old source strings, and the lean baseline itself lacks its referenced protected manifest. Nothing was silently weakened to make it green.
- Strict isolated typecheck of the dependency-free return-path/controller core passed; edited/new TypeScript syntax and byte protections are checked separately.
- Dependency install attempted; npm failed with registry DNS errors and `Exit handler never called!`. Full project typecheck failed on both baseline and candidate with missing dependencies. Build failed because `next` is absent; lint failed because `eslint` is absent.
- Local HTTP browser fixture tests were blocked by this container's `ERR_BLOCKED_BY_ADMINISTRATOR` policy. The passing DOM checks do not replace those HTTP tests.

See `docs/pwa-session-2026-10-04/validation/VALIDATION.md` and raw logs. No real cookie round-trip, production build, actual provider, physical iPhone/Android, push delivery, revocation or 180-day endurance claim.

## Integration / rollback

Read `SUPABASE_AND_ROLLOUT.md`. Initially keep `PWA_SESSION_RECOVERY_ENABLED=false`. After build/security gates, enable it on testing; optionally enable `PWA_SESSION_DIAGNOSTICS_ENABLED=true` briefly. Run the owner's exact icon → notification → icon sequence without signing in between attempts or clearing app data. Explicit logout is a separate negative test.

**No SQL migration or Supabase upgrade is required.** Inspect Auth session policies and OAuth callback allowlist; do not change JWT duration or session policy speculatively. Code cannot guarantee storage retention for 180 days on every device.

To stop auto-recovery, set its flag false and redeploy. API returns `disabled` so already-loaded new clients stop probing. Cache/return-path/error hardening remains. Reverting the source patch is the broader rollback; preserve intervening agent fixes. Do not uninstall the PWA, clear cookies, rotate VAPID keys or apply unrelated migrations as a rollback.

## Must return after testing

Actual deployment/flag versions, icon/push launch trace pairs, real cookie presence/refresh persistence (values redacted), MFA/logout/expiry tests, physical PWA matrix, build/regression results, and any remaining reproducible failure. Beta release requires those gates, not this offline count.
