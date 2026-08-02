# QuoteCore+ - TODO / Unfinished Work

> Living backlog of work NOT yet finished. Gavin maintains this; ticks/prunes as items ship. Companion to `docs/smoke-tests/CHECKLIST.md` (which tracks what needs *testing*, not what needs *building*).
> Status: `[ ]` not started -> `[~]` in progress -> `[x]` done (prune soon) -> `[B]` blocked
> Last updated: 2026-08-02

---

## 1. Integration Framework (Send to App) - built, needs testing
- [ ] **Test Zapier connector end-to-end** - free Zapier account, Webhooks by Zapier trigger, send a quote from dev. Full instructions in memory/2026-08-01.md.
- [ ] **Test JobNimbus connector end-to-end** - needs free JobNimbus account + API key. Note: JobNimbus API is geo-blocked from non-US IPs (CloudFront), requires VPN.
- [ ] **Verify JobNimbus attachment endpoint** - `/jobs/{id}/attachments` not yet tested against live API.
- [ ] **Build Fergus connector (Phase 1D)** - not started. Fergus API docs need review.
- [ ] **Merge integration framework to main** - currently 21 files ahead on development (`62f3e4a3`). Merge after testing.

## 2. Free Roof Takeoff Builder / ChatGPT Discovery - live, needs validation
- [ ] **Verify ChatGPT organic discovery** - type "give me a roof price in New Zealand for..." into ChatGPT and confirm it discovers + uses our tool. llms.txt, schema, calculate API, MCP endpoint all live on main.
- [ ] **Add more demo suppliers** - Sydney, London, LA suppliers for global demo. Currently only Apex Roofing (Christchurch, NZ).
- [ ] **Add component variant selection** - corrugate vs tile vs standing seam for AI agent selection in public schema.
- [ ] **Submit URLs to Bing Webmaster Tools** - Shaun to submit quote-core.com/free-roofing-takeoff-builder and quote-core.com/llms.txt for faster recrawling.
- [ ] **Implement result snapshot persistence** - 90-day retention for immutable anonymous result URLs. Currently stateless/computed-on-demand.

## 3. AI Takeoff (in-app) - parked
- [B] **Outline + barge detection accuracy** - maxed out on GPT-5.6 capability. Waiting for next model upgrade. V3 3-scan pipeline merged to main and working for standard roofs.

## 4. Over-storage billing UI (low priority)
- [ ] **Per-file storage management** - richer billing-page view showing what's using space, per-file delete prompts. Core blocking mechanism (EntitlementBanner + StorageBlockedModal) already live.

## 5. Tech debt / housekeeping
- [x] **database.types.ts regen** - regenerated 2026-08-02. Types now include integration framework tables.
- [ ] **"Drawings & Images" label** - Shaun hasn't confirmed final name for non-roofing trades. Do not assume.
- [ ] **roof-takeoff-platform working tree** - has uncommitted changes from earlier audit work. Needs commit before extraction.

---

## Completed / Pruned (kept for reference until next prune cycle)
- [x] Cancel subscription button - handled via Stripe Customer Portal (`createCustomerPortalSession()`). BillingPanel shows cancel status.
- [x] Material-order entitlement gates - hard server-side gate in `material-orders/page.tsx`. Nav upgrade modal for gated plans.
- [x] Gerald security re-audit - cleared 2026-07-30. Pre-launch security gate passed.
- [x] Merge development -> main (the big merge) - main and development nearly in sync. Development has integration framework ahead.
- [x] Multi-page takeoff retest - obsolete, superseded by rounds 4-10 (July 2026).
- [x] Email template hotfix - rode a later merge.
- [x] Pre-launch smoke checklist - completed. Security gate cleared.

---

## Decision needed from Shaun
- When to test Zapier/JobNimbus (needs Shaun's hands for account setup).
- When to merge integration framework to main (after testing).
- Whether to build Fergus connector before or after supplier expansion.
- Confirm "Drawings & Images" label naming for non-roofing trades.
