# Gerald Round 8 — Pre-Live Security & Go-Live Audit Brief

**Date:** 2026-05-25  
**Author:** Gavin (QuoteCore+ Agent)  
**Scope:** Full pre-production audit before switching the app to `app.quote-core.com`, enabling live Stripe payments, and opening to real paying users.

---

## Context

This is the final audit before QuoteCore+ goes properly live. The previous audit (Round 7) signed off the core platform. Since Round 7, significant new surface has been added. We also have a concrete go-live checklist that needs your sign-off before execution.

**Repo:** `github.com/algora-dev/quotecore-plus`  
**Branch under review:** `development` (HEAD `279f542`)  
**Target:** fast-forward merge into `main`, then cut over to `app.quote-core.com`

---

## What Has Changed Since Round 7

### 1. Generic Trades — fully shipped (flag-gated, phases 2–9)

The generic trades system is the largest surface added since your last audit. It is currently live on `development` behind two feature flags (`NEXT_PUBLIC_GENERIC_TRADES_V1=true` / `GENERIC_TRADES_V1_ENABLED=true`), both off on production.

**New DB objects (all applied to production Supabase):**
- Tables: `component_collections`, `takeoff_sessions`, `takeoff_pages`
- New columns: `companies.default_trade`, `quotes.trade`, `quotes.component_collection_id`, `component_library` (8 new Phase-2 cols: `pricing_strategy`, `pack_*`, `waste_unit`, `height_value_mm`, `depth_value_mm`), `quote_component_entries.combined_from + is_combined`, `quote_takeoff_measurements.page_id + unassigned`
- Enums extended: `measurement_type` (13 values), `waste_type` (added `fixed_per_segment`), `trade` (14 values)
- RPC: `ensure_company_has_collection(uuid)` — SECURITY DEFINER, service_role only
- RPC: `save_takeoff_atomic(...)` — scoped delete by `page_id`

**Key security patterns applied:**
- `assertComponentCompatibleWithQuote()` — server-side guard that a component's trade matches the quote's trade. Called by every server action that attaches a component.
- `create_quote_atomic()` is the only insert path into `public.quotes`
- Column-level GRANTs applied to `component_collections` (authenticated has no UPDATE on `is_bootstrap`)
- RLS on `component_collections`: SELECT/INSERT/UPDATE/DELETE — all scoped to `company_id = auth.uid()`'s company

**Please verify:**
- RLS on `takeoff_sessions` and `takeoff_pages` — company-scoped?
- RLS on `component_collections` — the UPDATE policy was recently widened (Round 8 migration `20260525110000`) to allow renaming bootstrap collections. Column-level grant prevents `is_bootstrap` change. Confirm this is watertight.
- `save_takeoff_atomic` — does the `page_id`-scoped delete have appropriate ownership checks so a user can't delete another company's takeoff data by supplying a foreign `page_id`?
- `assertComponentCompatibleWithQuote()` in `app/lib/trades/assertCompatible.ts` — verify it can't be bypassed

### 2. 14 new trade types added

Trades: landscaping, flooring, tiling, foundations, insulation, painting, fencing, concrete, construction (+ electrical, plumbing, cladding from prior sessions).

**Surface:** Purely TypeScript union widening + DB enum extension. No new RLS, no new tables, no new server actions. The trade value is written to `quotes.trade` at creation time (server action) and read back for UI gating. Review: does any server action trust the client-supplied trade value without validation?

### 3. Component library / collection system (new UI)

New server actions in `app/(auth)/[workspaceSlug]/components/actions.ts`:
- `loadComponentCollections()` — SELECT on `component_collections`, scoped to company
- `createComponentCollection(name)` — INSERT, non-bootstrap, scoped to company. Has `is_bootstrap: false` hardcoded.
- `renameComponentCollection(id, name)` — UPDATE on `name` only. Scoped with `company_id = profile.company_id`.

**Please verify:**
- `renameComponentCollection` — can a user supply an `id` belonging to another company and rename it? The `.eq('company_id', profile.company_id)` guard should prevent this, but confirm.
- `createComponentCollection` — can `is_bootstrap: true` be injected? The insert has `is_bootstrap: false` hardcoded and column-level INSERT grant for `authenticated` on `is_bootstrap` exists, but `WITH CHECK` on the INSERT policy has `AND (is_bootstrap = false)`. Confirm both layers hold.

### 4. Quote builder component filtering by collection

`loadComponentLibrary(collectionId?)` now accepts an optional collection filter. The `collectionId` comes from `quote.component_collection_id` (server-rendered, not user-supplied in this request). Confirm this filtering path is safe.

### 5. Email URL spam warning

Simple client-side URL count warning in `SendQuoteButton.tsx`. No new server surface.

### 6. DMARC added to `quote-core.com`

`_dmarc.quote-core.com TXT v=DMARC1; p=none; rua=mailto:info@quote-core.com` — DNS only, no code change.

---

## Go-Live Checklist (Needs Your Sign-Off)

The following is our planned go-live sequence. Please flag any step you disagree with or want changed.

### Pre-merge (before `development → main`)
- [ ] Gerald round-8 audit complete, all blockers resolved
- [ ] Shaun smoke-test sign-off on `development` preview

### Merge & deploy
- [ ] Fast-forward merge `development → main` (82+ commits ahead)
- [ ] Vercel: `quotecore-plus-main` auto-deploys from `main`

### Domain cutover
- [ ] Vercel: add `app.quote-core.com` as custom domain on `quotecore-plus-main`
- [ ] Cloudflare: CNAME `app` → Vercel DNS target
- [ ] Verify SSL cert provisioned

### App configuration
- [ ] Vercel env vars on `quotecore-plus-main`: set `NEXT_PUBLIC_SITE_URL=https://app.quote-core.com`
- [ ] Supabase dashboard: add `https://app.quote-core.com` to auth redirect URLs allowlist (Site URL + additional redirect URLs)
- [ ] Stripe: update webhook endpoint to `https://app.quote-core.com/api/webhooks/stripe`

### Go live on payments
- [ ] Set `STRIPE_MODE=live` on `quotecore-plus-main` Vercel env
- [ ] Seed live Stripe products (Starter, Growth, Professional, Pro Plus) matching the plan codes in `app/lib/billing/entitlements.ts`
- [ ] Confirm live webhook is active and signed with the correct `STRIPE_WEBHOOK_SECRET`
- [ ] Flip generic trades flags: `NEXT_PUBLIC_GENERIC_TRADES_V1=true` + `GENERIC_TRADES_V1_ENABLED=true` on `quotecore-plus-main`

---

## Paid Subscription Test Plan

Once live, we want to run two controlled Stripe test round-trips using real card details (small amounts, real refunded immediately after).

**You and I should agree on exactly what to test. My proposed test plan is below — please edit, add, or remove items.**

### Test Account A — Starter tier (basic)

1. Sign up fresh account at `app.quote-core.com`
2. Complete onboarding (company, name, security questions)
3. Confirm trial starts correctly (14-day, component cap = 10, quote cap applies)
4. Upgrade to **Starter** via Stripe Checkout — confirm:
   - Stripe payment succeeds
   - Webhook fires → `subscription_status = active`, `plan_code = starter`
   - `company_effective_plan_code()` returns `starter`
   - UI shows correct plan in billing page
5. Create a quote (Roofing trade), send to a test customer email
6. Customer accepts quote via `/accept/<token>` — confirm acceptance flow works on live domain
7. Attempt to exceed Starter component cap — confirm upgrade modal appears, hard block holds
8. Cancel subscription — confirm dunning flow starts correctly, status transitions to `past_due` or `cancelled`

### Test Account B — Pro Plus tier (full access)

1. Sign up second fresh account
2. Upgrade directly to **Pro Plus** 
3. Enable Generic Trades (if flag is on globally by this point, otherwise note)
4. Create quotes across 3 different trades (e.g. Roofing, Landscaping, Electrical)
5. Create multiple component libraries, assign components, create a quote using a specific library
6. Send quote via Messages pipeline — confirm email arrives at `app.quote-core.com` domain, no spam landing
7. Schedule a follow-up — confirm `quote_sent` trigger fires correctly
8. Create a material order and send to supplier
9. Test 2FA setup and login
10. Downgrade from Pro Plus to Starter — confirm entitlement cap enforcement kicks in (read-only on components over cap)

### Payment failure / dunning test
11. With Test Account A, update card to Stripe's `4000000000000341` (always fails on charge) and trigger a renewal cycle — confirm `past_due` → `grace` transition, grace period read-only behaviour, recovery via card update

---

## Open Items From Prior Audits (Still Parked)

| Item | Status |
|---|---|
| Webhook concurrent-retry lease pattern | Non-blocker, parked |
| Phase 2 data purge (export-before-delete for suspended accounts) | Parked |
| `takeoff_canvas_url` / `takeoff_lines_url` column drop | Post-go-live |
| EU/UK Article 27 representative + Costa Rica PRODHAB | Shaun parked until after paid testing |
| `database.types.ts` regen (stale on Phase 2 columns) | Pre-merge recommended |

---

## Questions for Gerald

1. Are you satisfied the `component_collections` RLS + column-grant combination is sufficient to protect `is_bootstrap` now that the UPDATE policy no longer checks `is_bootstrap = false` in the USING clause?
2. Do the `takeoff_sessions` and `takeoff_pages` tables have proper RLS? I don't see migrations for their policies in the reviewed set — please check.
3. Anything in the go-live checklist you'd change or add?
4. Any items in the paid subscription test plan you'd add or remove?

---

## Files to Focus On

```
app/lib/trades/assertCompatible.ts
app/lib/trades/measurement-type-whitelist.ts
app/(auth)/[workspaceSlug]/components/actions.ts         (new collection actions)
app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder.tsx (libraryComponents filter)
app/(auth)/[workspaceSlug]/quotes/[id]/page.tsx          (collectionId passed to loadComponentLibrary)
app/(auth)/[workspaceSlug]/quotes/[id]/build/page.tsx    (same)
app/lib/data/ensure-company-has-collection.ts
backend/supabase/migrations/20260525100000_trade_enum_remaining_8.sql
backend/supabase/migrations/20260525110000_collection_rename_allow_bootstrap.sql
```

---

*Please reply with: findings, severity ratings, any blockers before go-live, and your edits to the test plan. We'll run the checklist only after you've signed off.*
