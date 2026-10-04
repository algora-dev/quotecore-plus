# Engineering handoff — PWA session entry/recovery

## Diagnosis: confirmed versus inferred

The reported icon-versus-push behavior is consistent with stale/restored Login UI or an entry-path failure while an existing valid session remains. It does **not** prove that WebKit lost cookies, that notifications sign people in, or that cookie expiry is the cause. No device trace or live Supabase project access is available in this environment.

Verified baseline code:

- `app/login/page.tsx` was client-only; middleware allowed it without auth and it never checked an existing session. It could display Login while valid cookies existed.
- `/assistant` used throwing `getCurrentProfile()` before `if (!profile)`, repeated auth/context reads, and supplied `next`; the form consumed `redirect` only.
- Existing `createAuthCookieBatch()` was already the right accumulation mechanism. It is preserved, not replaced by another cookie jar. No-cookie-write auth redirects lacked explicit private/no-store.
- `/pwa/open` checks `pushActor()`, current user/company, delivery ownership and RLS entity existence; its payload has no sign-in credential. The worker has no `fetch` cache interception. Neither is rewritten here.
- Password/MFA navigation checked only `startsWith('/')`, allowing protocol-relative return paths. OAuth dropped the requested destination. These are corrected as part of reliable return routing.
- The legacy debug endpoint accepted anonymous JSON into a service-role table. The compatibility endpoint now consumes at most 1KB and emits only opt-in sanitized console metadata; no DB write.

## Execution

Normal icon launch stays `/assistant` → ordinary middleware auth/refresh/MFA → verified own workspace. No new manifest/bootstrap origin is introduced. The happy authenticated path does not load the recovery controller or add an LLM call.

When Login actually renders/restores and recovery is enabled:

1. Determine safe requested return (`redirect`, legacy `next`, or `/assistant`). Exclude explicit sign-out, signup errors/credential callbacks and redirect-loop markers.
2. One same-origin, no-store GET to `/api/auth/resume`. A normal-cookie name must be present; that is only an admission optimization, **not authentication**. Ignore any bearer/body/query identity or token.
3. Normal request-scoped SSR client uses the existing cookie namespace/domain/settings. `auth.getUser()` verifies; SDK owns normal refresh. Then read the verified user's profile, check MFA and current company.
4. Return an allowlisted outcome: authenticated, MFA required, onboarding, anonymous, unavailable, or disabled. Destinations are current-workspace-scoped or the existing protected `/pwa/open` delivery resolver. No customer/profile data is returned.
5. Copy every accumulated SDK cookie change to the **final response**, including errors after a successful token refresh. Set private/no-store even if no cookies were written. Request budget 6.5s for backend fetches; client timeout 10s. No guarantee that platform/network abort can recover a cookie response already lost in transit.
6. Client validates the result again. `location.replace` performs fresh navigation. The destination retains all its original authorization/entitlement checks. No `setSession`, `refreshSession`, admin auth, push token or local token backup exists in this path.

## Lifecycle / concurrency

Production controller and native event binding live separately in `app/lib/auth/login-recovery.ts`, React wiring in `LoginSessionRecovery.tsx`. One probe in flight; foreground/pageshow/online events coalesce. Hiding/pagehide aborts and fences old results; immediate foreground can start again without waiting behind the throttle. Credential focus/pointer/submission suppresses late recovery. Ten-second timeout exposes the ordinary form, not indefinite blank UI.

A timestamp in sessionStorage limits repeated automatic redirection; storage failures are tolerated. A `__qcp_resume=1` navigation marker catches middleware-return loops when storage is unavailable. Neither grants access. A rapid returned Login page may deliberately show a manual Check rather than loop. Explicit logout uses `signedOut=1` and is never undone by this controller. A valid session can be checked manually after a loop without retyping, but a revoked/expired session cannot be restored by the client.

## Security/reliability boundaries

- Required MFA remains required; settings lookup/network failure cannot count as success. Middleware handles temporary/throttled/unknown auth errors as unavailable rather than guessing anonymous or allowing through.
- The user's product policy `mfa_required=false` is preserved; existing routes continue their own gates. This is not a replacement for all app API authentication.
- Safe return parsing rejects external/protocol-relative URLs, encoded separators/control characters, credential/API/demo destinations and deeply encoded tricks. Scope still comes from the authenticated actor, not this parser.
- New resume route rejects cross-origin callers and demo namespace. A deliberately absent/invalid cookie is not refreshed into a new account.
- This pass does not change normal/demo cookies, SDK versions, sign-out scope, notifications subscriptions/dispatch, SQL or assistant business logic.
- Signup, reset, magic link and impersonation are retained, not declared newly live-tested. OAuth draft-restoration priority stays ahead of the new general return target.

## Trace reading

Enable `PWA_SESSION_DIAGNOSTICS_ENABLED=true` temporarily. Events are named `qcp_session_trace`, build `pwa-session-20261004-r1`.

`received.normalCount/base/chunks/chunkGap/duplicateNames` describes the ORIGINAL request cookie names only; `emittedCookieNames/deletions` describes the pending final response. `refreshRequests/refreshStatuses` records actual SDK refresh network attempts observed by the fetch adapter, not a guessed boolean. `steps` distinguishes auth/profile/MFA/company resolution with elapsed time. No values or raw query, email, user/session IDs or provider response bodies are logged. Headers supplied by a browser are clamped diagnostic labels, never authentication.

Interpretation examples:

| Evidence | Next investigation |
|---|---|
| Login shown, no fresh server event until resume | Restored/cached document or stale bundle; verify current build and connectivity. |
| Resume receives normal cookies, verifies, routes correctly | Existing session was valid; Login UI was not authoritative. Repeat cold icon tests to establish fix. |
| No normal cookies on icon but present on push | Compare exact installed origin, entry URL and isolated storage context. Do not increase TTL as proof. |
| Chunk gaps/duplicate names | Inspect real cookie attributes/scopes in devtools, without sharing values. Do not delete all cookies or upgrade SDK blindly. |
| Refresh succeeds but no emitted batch | Verify actual pinned SDK cookie callbacks/Next response handling. Mock tests cannot prove live serialization. |
| Auth invalid/revoked | Show sign-in; never bypass. Compare Supabase Auth policy/logs with the intended retention expectation. |
| Auth verified, profile/company/MFA unavailable | Correct that specific data/config/network failure. It is not an anonymous session. |

## Known limits

A PWA whose cookies really were removed has no safe credential to recover. A notification can still arrive after logout; its click must authenticate independently. This package cannot prove or promise 180-day device storage survival.

The historical workflow source checker is literal-string-based. Its cookie test expects `setAll(changes)`, direct `cookieUpdates.apply(NextResponse.redirect(url))` and inline `encodeURIComponent(slug)`. These responsibilities now live in `finishAuth`, the shared resolver and optional SDK-header argument. Reconcile that check to assert preserved semantics and run the new executable handler/cookie tests. Do not remove tenant/quota/mutation protections. The old protected-baseline manifest is absent from the lean ZIP even before our changes; restore it from the canonical branch, not invented data.

## External references consulted (separate from source evidence)

- Supabase SSR advanced guide: https://supabase.com/docs/guides/auth/server-side/advanced-guide
- Supabase session policies: https://supabase.com/docs/guides/auth/sessions
- Supabase Next SSR setup: https://supabase.com/docs/guides/auth/server-side/nextjs
- WebKit Home Screen cookie-copy/storage context background: https://webkit.org/blog/14787/webkit-features-in-safari-17-2/
- MDN `pageshow`: https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event
- Next route handlers/cookies: https://nextjs.org/docs/app/getting-started/route-handlers and https://nextjs.org/docs/app/api-reference/functions/cookies

The baseline pins `@supabase/ssr` 0.9.0. Its installed source was unavailable here; current online docs are not proof of that version's exact emitted cookie behavior. No version upgrade was made.
