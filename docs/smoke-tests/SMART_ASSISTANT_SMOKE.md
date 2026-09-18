# Smart Assistant V1 - Smoke Test (dark-launched via assistant_feature_flags)

Setup on test account (Dev = Production, test on the dev URL).

## A. Enable the feature (admin)
- [ ] Log in to dev as an admin (owner/admin role).
- [ ] Go to `/admin/smart-assistant`.
- [ ] Find the test company (T3 Play) and toggle the assistant feature flag ON (service-role write to `assistant_feature_flags`).
- [ ] Optionally set `quota_monthly_turns` (default 500) to a small number like 5 for quota testing.

## B. Configure (as the test company user)
- [ ] In the workspace, go to `/[ws]/account/smart-assistant`.
- [ ] Owner/admin can see and edit the config page by default.
- [ ] Toggle `members_can_manage` ON, then verify as a member: member can now open the config page, and CANNOT escalate other members (no owner/admin grant UI for them).
- [ ] Toggle `members_can_manage` OFF, verify member now gets denied on the config page.

## C. Chat happy path (`/[ws]/assistant`)
- [ ] Assistant nav item / entry point appears in the workspace once the flag is on.
- [ ] Open chat, send a simple question -> streaming reply completes.
- [ ] Ask something needing workspace records (e.g. "how many quotes do I have?") -> answers from real records only; no made-up numbers.
- [ ] Ask a maths-looking question -> the `calculate` tool is NOT invoked (deliberately unregistered); numbers must come from records/engine only.
- [ ] Knowledge search: ask something covered by uploaded knowledge chunks -> answer cites/uses them; `match_sa_chunks` derives company from auth.uid() (never trusts a passed company param).
- [ ] History: send 2-3 turns, reload page -> prior turns render (latest 30 prior messages).

## D. Quota + idempotency
- [ ] With `quota_monthly_turns` set low, keep sending turns -> refusal message once quota exhausted (quota = `assistant_turn_reservations`, company-serialized).
- [ ] Double-click / rapid-fire send of the SAME message (same request-id, same payload) -> one reply, no duplicate run.
- [ ] Same request-id with a DIFFERENT payload -> `request_id_conflict` error surfaced, checked BEFORE quota/flag refusal.

## E. Access control
- [ ] Anonymous/incognito -> assistant routes redirect to login.
- [ ] Company WITHOUT the flag -> `/[ws]/assistant` and config page deny access (no leak).
- [ ] Cross-tenant: user from company A cannot read company B chunks/history.

## F. Privacy / misc
- [ ] Chat root element has `data-clarity-mask` DOM attribute (Clarity masking).
- [ ] Stale-run recovery: close tab mid-turn, wait >5 min (or trigger the sweep), send a new message -> works, quota not double-charged.
- [ ] Runs finish only via service-role `sa_finish_run` (verify no user-scope errors in logs).
