# Required live acceptance — do not substitute offline counts

Use the exact testing deployment and an existing installed PWA. Record build, stable origin, device/OS/browser version, timestamp, display mode and flags. Use disposable test users for security/revocation work. Do not paste passwords, access/refresh tokens, raw cookie headers, callback codes or unredacted HAR files into the handoff.

## First: reproduce the owner's sequence

1. Load the new build once in the **installed app context**, not just Safari; verify recovery build marker/trace. Do not uninstall or clear website data.
2. Sign in normally once if genuinely necessary. Close the app completely. Open from the home-screen icon.
3. If Login appears, let the bounded recovery check complete. Capture result and sanitized trace ID. Do not sign in again just to make the test pass.
4. Close again. Send a test alert through the normal push system. Tap its notification into the PWA. Verify actual authenticated destination, not just delivery receipt.
5. Close again. Open the home-screen icon. It should enter the correct account without credentials while the existing session is valid.
6. Repeat 5–10 cycles; include a background period crossing the ordinary access-token expiry and a device restart. Record first visible content, result, total time and each entry's cookie/refresh/verification trace.
7. Repeat without a notification between icon launches. Push must not be required to keep the account usable.

Pass: valid session enters the correct workspace consistently; no old Login screen persists, no repeated redirect/refresh loop, no duplicated assistant action, no cross-account destination. Failure: return trace pairs and exact entry origins before changing more code.

## Negative / security / return-path matrix

| Case | Required result |
|---|---|
| Explicit Logout | Existing sign-out behavior executes; recovery never undoes it. Close/open again requires authentication. |
| Expired/revoked/deleted session | API returns anonymous or verified failure; no fabricated login. |
| Auth/profile temporary outage or offline | No authenticated bypass or speculative sign-out; clear retry/form fallback. Original cookies not manually purged by our code. |
| MFA required at AAL1 | Challenge before protected workspace/notification. Correct destination retained after actual verification. |
| MFA settings read error | Fail closed; do not silently allow or report ordinary logout. |
| Valid other workspace/delivery ID | Resume selects authenticated own workspace; notification resolver rechecks delivery/user/company. No disclosure. |
| Invalid return (`//evil`, encoded backslash, credential endpoint) | Ignored/rejected; never off-origin navigation. |
| Password and Google login after expired notification tap | Proper authenticated notification destination, or normal safe fallback if record is gone. Confirm OAuth allowlist behavior with the query parameter. |
| Reset/magic link/signup/email confirmation/admin/impersonation | Existing flows still work; credential-bearing URL is not interrupted by auto-resume. |
| Demo and normal cookies coexist | Demo never resumes the paid account through this endpoint or overwrites normal scope. |
| Existing cookie refresh emits several chunks/deletions | Inspect actual **final** HTTP Set-Cookie and next request: all chunks/options arrive, including on MFA/login/error redirects. Values stay private. |
| Blocked sessionStorage | No crash; URL marker stops loops; manual retry works where session can be verified. |
| User typing credentials while foreground events fire | No redirect or replacement of their form by late recovery. |
| Immediate hide/reopen during a check | Old result cannot navigate; new check/form recovers, not a frozen checking screen. |
| Recovery flag off with newer client still loaded | API disabled result stops future probes; ordinary login remains. |
| Production cookie domain / stable testing alias | Verify behavior on the actual origin. Cross-origin storage is not assumed shared. |

## Devices and app smoke

Physical iPhone Safari and installed PWA; Android Chrome and installed PWA; desktop browser; short background, long background and restart. Actual Apple storage/bfcache behavior is not reproduced by injected events in Chromium.

Check existing Type/Voice/Attach, TTS, hide/reopen, layout/dock, push preferences and live delivery, quoted record navigation, draft create/revise/Confirm/idempotency, permissions and quotas. None of those source areas changed, but beta still needs integration smoke checks.

## Report back

Build/typecheck/lint and regression output; real cookie round-trip and Auth settings observation; redacted icon/notification trace pairs; MFA/logout/expiry results; device matrix and failures; exact source/deployment/flags used. Do not describe a few reopen tests as 180 days of endurance evidence.
