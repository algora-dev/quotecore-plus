# Fable 5 Improvement Plan — QuoteCore+
**Date:** 2026-07-02 · Companion to `FABLE5-AUDIT-REPORT.md` (finding IDs referenced below)

## Quick wins (< 1 hour each)
1. **Fix middleware public-path matching** (F-01, 🔴) — segment-boundary match (`p === path || path.startsWith(p + '/')`); tighten `/m` to `/m/`. ~20 lines, closes the 2FA bypass. **Do first.**
2. **Verify + document scheduled-message dispatch** (F-02, 🔴) — check `cron.job` in prod; add cron entry to `vercel.json` or fix the route comment; add last-run timestamp to admin CronStatusTab.
3. **Rate-limit `loginAction` + `resendConfirmationAction`** (F-03) — reuse existing `checkRateLimit` with per-IP + per-email buckets, `failClosed` on resend.
4. **Delete dead root files** (F-18, F-20) — `middleware.diasbled.ts`, `middleware.disabled2.ts`, one-off `apply-*/fix-*` codemods, `test-query.ts`, `{output_folder}`; archive stale progress markdowns.
5. **Fix login error path** (F-14) — surface DB error instead of misrouting to onboarding.
6. **Reserved workspace-slug blocklist** (F-01 follow-up) — reject slugs colliding with public route prefixes at creation.
7. **Design-system CI grep** (F-25) — fail CI on `bg-orange-500`, button `rounded-lg`, `hover:bg-slate-50` list rows.

## Medium effort (1–4 hours)
8. **Silent £0 pack-pricing guard** (F-09) — recalc flags lines with qty>0, pack strategy, cost 0; ⚠ badge in quote builder.
9. **`checkRateLimitStrict` wrapper + audit of sensitive buckets** (F-04).
10. **Cheapen impersonation banner checks** (F-05) — cookie/flag-gated lookup instead of per-request service-role queries; add partial index on `admin_impersonation_sessions`.
11. **Structural `fixed_per_segment` waste** (F-12) — add `segmentCount` param to `applyWaste`; update takeoff call sites.
12. **Split display vs precise conversions** (F-11) — `toDisplayX()` vs full-precision `convertX()`; deprecate string-returning `convertArea`; sweep call sites doing math on rounded values.
13. **Webhook ordering replay** (F-13) — on `checkout.session.completed`, replay quarantined `customer_not_found` deliveries for that customer.
14. **Index migration** (F-17) — partial indexes: `scheduled_messages(status,fire_at) WHERE status='scheduled'`, impersonation sessions, alerts unread, quotes list filters. EXPLAIN first.
15. **`any` ratchet** (F-19) — ESLint `no-explicit-any` warn + CI count ceiling (225); burn down `app/lib/**` first.
16. **Hip/valley 45° disclosure** (F-10) — tooltip in takeoff/builder; optionally expose hip plan angle input later.

## Larger investments (4+ hours)
17. **Unify the send flow** (F-22, 💡 highest leverage) — shared `SendDocumentModal` + one send orchestrator with quote/order/invoice adapters. Removes ~100KB of triplicated UI and makes every future send feature 1× work instead of 3×.
18. **Decompose monster components** (F-15) — order of attack: SendQuoteButton (folds into #17) → quote-builder → order-create-form → TakeoffWorkstation → FlashingCanvas. Extract tabs/modals/pure helpers; `next/dynamic` heavy modals + canvas.
19. **Split mega action files** (F-16) — `quotes/actions.ts`, `messages/scheduled.ts`, admin user actions by domain with shared ownership assertions.
20. **Automated cross-company RLS test harness** (F-08) — two-tenant fixture script asserting zero leakage across all tenant tables; run in CI against a branch DB. Directly targets the bug class that's bitten three times already.

## Backlog (good ideas, not urgent)
21. Public token expiry/rotation for order & invoice UUID links (F-24).
22. Move copilot guide content out of the client bundle to JSON/MDX with dynamic loading (F-23).
23. Vercel-native IP source for rate limiting instead of raw XFF (F-06).
24. Unauthenticated smoke test asserting 401 on all non-public `/api/*` routes (F-07).
25. Comment-drift sweep of security/infra files (F-21).
26. Consider consolidating `template-manager.tsx` vs `template-manager-new.tsx` (material-orders) — apparent parallel implementations.

## Suggested sequencing
**Week 1:** items 1–7 (all quick wins; two criticals closed).
**Week 2:** items 8–11, 14 (correctness + perf guards).
**Week 3+:** item 17 then 18 incrementally; 20 as the durable safety net.
