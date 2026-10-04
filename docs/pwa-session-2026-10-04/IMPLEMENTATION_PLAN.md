# PWA session hardening — implementation record

Baseline: `quotecore-plus-2f597a14-pwa-session-handoff-lean.zip`.
No live credentials, device logs or Supabase project settings are available here.

## Verified source gaps

- `/login` is a client page, public in middleware, and never verifies an already-existing session. Restoring that document can keep showing a login form regardless of current authentication.
- `/assistant` uses throwing `getCurrentProfile()` before a null check, repeats auth/company lookups and supplies `next` while the password login form reads `redirect`.
- Middleware unauthenticated redirects have no explicit private/no-store policy when the SDK emits no cookie changes. The batching fix for actual refreshed cookies is already present and must be preserved.
- Password login and the MFA return path accept `//...` as a root-relative destination. Google callback currently drops the requested destination.
- Existing unauthenticated auth-debug POST writes through a service-role client without an opt-in flag, same-origin bound or size bound; its once-per-session browser gate is insufficient to compare repeated launches.
- Push receipt by itself is not login. `/pwa/open` requires getUser, workspace ownership and MFA before it resolves an alert. No credential restoration from notification payload exists.

## Focused changes

1. Preserve the current SDK pins and cookie names/domains/lifetimes. Correct documentation, not session policy.
2. Add opt-in, bounded login/resume verification against existing normal cookies using getUser, MFA and current membership. No token from query/body/storage. No new session or service-role auth bypass.
3. Check restored/foreground login pages; honor explicit logout, credential entry and failure; fence late results and prevent redirect loops even if storage fails.
4. Preserve safe same-origin return destinations and callback/MFA flow; unify parameter handling.
5. Apply private/no-store to relevant auth entry/redirect paths even with zero emitted cookies. Preserve all refreshed chunks on final responses.
6. Add optional sanitized server diagnostics comparing entry and resume paths. No cookie/token values, user/session IDs, email or raw query URLs.
7. Regression-test source logic with explicit mocks. Deliver separate live-device/Supabase acceptance gates. Do not claim actual iPhone root cause or 180-day endurance proven here.

No changes to assistant layout, retrieval, workflow/controller, pricing, quota,
notifications delivery/SQL or the existing migrations are planned.
