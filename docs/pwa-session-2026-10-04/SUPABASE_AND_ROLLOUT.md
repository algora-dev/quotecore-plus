# Supabase and rollout — simple operational instructions

## Required changes

**None to the database. No SQL migration in this package. No Supabase SDK dependency upgrade.** Use the supplied unchanged lockfile. Do not apply older outstanding migrations merely because they exist in the tree.

Add these **server environment flags** to the testing deployment:

```env
# Off until the integration build/security checks pass.
PWA_SESSION_RECOVERY_ENABLED=false
# Optional short-lived console diagnostics; do not leave on indefinitely.
PWA_SESSION_DIAGNOSTICS_ENABLED=false
```

After verification, set both to `true` on testing and redeploy. Do not use `NEXT_PUBLIC_` flags or expose keys. Login gets the recovery boolean from its dynamic server page; the API checks it independently. Disabling the API stops previously loaded new clients even before they refresh.

## Supabase Auth checks — read and record before changing anything

1. Verify testing and production point at the intended Supabase projects and stable hostnames. An installed icon pointing at an old preview/deployment origin is not fixed by changing another origin's cookies.
2. Record current session time-box, inactivity timeout and single-session settings where available. These are Auth policies, separate from cookie storage retention. Check Auth logs for refresh/session errors at the failed launch times. Never paste tokens or raw cookie/session records in a handoff.
3. Keep the current short-lived access JWT and refresh-token security behavior. **Do not make the JWT last 180 days**, disable MFA or rotate signing keys as a persistence fix. This package leaves the configured normal cookie retention at 180 days and the demo retention at one day; verify actual emitted cookie attributes with the pinned SDK rather than assuming a comment is authoritative.
4. Decide with the owner only if an existing policy conflicts with the agreed normal long-lived-session expectation. The package does not force an exact 180-day sign-out or override legitimate expiry, revocation, logout, lost storage or account restrictions.
5. Check OAuth redirect allowlist: the existing `/auth/callback` may now carry a URL-encoded `redirect` query to retain a notification destination. Keep allowed **origins exact** (production app plus intended testing alias). Confirm the current callback pattern accepts this query. If an exact no-query callback entry rejects it, add a narrowly scoped callback-with-query pattern for that same approved origin, e.g. `https://app.quote-core.com/auth/callback?redirect=**`, retaining the original callback entry. Do not use a global `https://**` rule or add random preview hosts. Confirm the live Google flow rather than assuming glob semantics.
6. Password/reset/magic-link/confirmation/impersonation still use existing mechanisms. The new helper must not intercept credential-bearing URLs. Retest them. Magic-link destination behavior itself was not redesigned here.

## Rollout sequence

- Merge on a branch; read the installed Next version's docs as instructed by `AGENTS.md`. Install with ordinary `npm ci` in the normal environment. Run real tsc/lint/build and complete the source/browser/device gates.
- Deploy with recovery OFF first. Confirm existing login, MFA, workspace entry, push entry and assistant still work. Cache/error/return-path changes are not behind the recovery flag.
- Enable diagnostics briefly and capture a baseline icon/push sequence. A restored Login document may not make any new server request; that absence is a lead, not proof of its cause.
- Enable recovery on testing. New login markup carries `data-qcp-session-recovery="pwa-session-20261004-r1"`; `/api/auth/resume` responses are private/no-store. With diagnostics on, response header `X-QCP-Session-Trace` matches console event IDs.
- Open a fresh document once to load the new build **without clearing cookies or uninstalling**. Then test ordinary subsequent closes/reopens. Stale previously-rendered HTML cannot execute JavaScript it never loaded.
- Do not reinstall or change manifest ID/start URL to manufacture a green result. PWA ID, start URL `/assistant`, worker and VAPID/subscriptions remain unchanged.
- Widen only after device and security acceptance. Turn diagnostics off afterward. Recovery can remain enabled; it only runs on login/restored-login, not every assistant turn.

## Rollback

Set `PWA_SESSION_RECOVERY_ENABLED=false`, redeploy; optionally set diagnostics false. Normal login remains available and the resume endpoint returns `disabled`. Revert the code diff if the broader auth hardening must also be rolled back. Preserve intervening changes; do not touch quota, tables, user data, push subscriptions, cookie namespaces, or global sign-out policy.
