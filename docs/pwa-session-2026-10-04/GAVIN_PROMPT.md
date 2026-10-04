# Gavin — integrate the focused PWA session fix

Please merge this package into the latest branch, preserving newer work. Its baseline is `quotecore-plus-2f597a14-pwa-session-handoff-lean.zip`.

Read `RETURN_NOTES.md`, then `docs/pwa-session-2026-10-04/ENGINEERING_HANDOFF.md`, `SUPABASE_AND_ROLLOUT.md`, and `LIVE_ACCEPTANCE.md`.

The change makes a restored Login page recheck an existing session server-side, preserves refreshed cookie batches and safe return destinations, and adds optional redacted diagnostics. It does not extend authentication, change SDK versions, alter the PWA manifest, or modify assistant/push business behavior.

1. Keep `PWA_SESSION_RECOVERY_ENABLED=false` through install/typecheck/lint/build/security checks. Run `node --test scripts/pwa-session/test-resume.cjs` and the existing regression suites. The old workflow static checker needs its missing canonical manifest and assertions reconciled with the new helper structure; do not bypass its invariants.
2. Enable recovery only on testing; temporarily set `PWA_SESSION_DIAGNOSTICS_ENABLED=true`. Confirm the deployed build is `pwa-session-20261004-r1`, not an old restored bundle. No SQL or SDK upgrade is required.
3. On the actual installed iPhone PWA, test **icon → notification → icon**, repeatedly, with no intervening sign-in. Also test real logout, expiry/revocation, MFA, offline/reconnect, Google/password return to a notification, and Android/browser smoke paths. Do not clear storage or reinstall as the first test.
4. If it still fails, return paired `qcp_session_trace` events and entry origins/paths (no credentials/cookie values), rather than changing cookie lifetime or guessing another workaround.

Return the latest source, actual build/security/device evidence and remaining failures. Keep assistant layout, workflows, pricing, quota, confirmation, push worker and existing notification settings intact.
