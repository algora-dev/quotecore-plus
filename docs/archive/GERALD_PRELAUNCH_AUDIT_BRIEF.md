# Pre-Launch Audit Brief - Gerald

## Context

**Project:** QuoteCore+ - construction/roofing quoting SaaS
**Repo:** `https://github.com/algora-dev/quotecore-plus`
**Branch:** `main` (HEAD: `eae35c5f`)
**Live site:** https://quote-core.com
**Testing site:** https://quotecore-plus-testing.vercel.app
**Date:** 2026-07-30

## What's Being Audited

We're about to go live with the full QuoteCore+ product. This is a final pre-launch audit before we start onboarding paying customers. The codebase has had significant work across multiple agents (Gavin - dev, Ron - SEO, Barry - content) and needs a second set of eyes.

## Scope of Audit

### 1. Security
- **Auth & RLS:** Supabase Auth handles authentication. Row-Level Security policies on all tables. Verify no data leakage between tenants.
- **API routes:** All API routes under `app/api/` should require authentication and return 401 (not 500) for unauthenticated requests. We just fixed `ai-scan-v3` returning 500 - check if other API routes have the same issue.
- **Middleware:** `middleware.ts` handles route protection. Verify no protected routes are accessible without auth.
- **Environment variables:** Confirm no secrets are exposed to client-side (`NEXT_PUBLIC_` prefix should only be on non-sensitive keys).
- **Stripe integration:** Billing flows in `app/api/stripe/` - verify webhook signature validation, no price manipulation possible from client.

### 2. Database Integrity
- **Migrations:** All migrations in `supabase/migrations/` - verify they're additive and non-destructive.
- **RLS policies:** Check that every table has appropriate RLS. Key tables: `quotes`, `quote_items`, `quote_roof_areas`, `quote_roof_area_entries`, `quote_components`, `quote_component_entries`, `component_library`, `component_collections`, `supplier_profiles`, `supplier_change_notifications`, `takeoff_pages`, `subscription_plans`, `companies`, `users`.
- **The `save_takeoff_atomic` RPC** (v8, migration `20260708160000`): This is the most complex DB operation. Verify it handles concurrent saves, page-scoped deletes, and data integrity correctly.

### 3. Code Quality
- **TypeScript strict mode:** No `any` types without justification. Check for type assertions that bypass safety.
- **Error handling:** API routes should have consistent error handling. Server actions should not leak internal errors to users.
- **Component structure:** Components under ~300 lines. Reusable patterns. No dead code.

### 4. E2E Test Coverage
- **85 mutation tests** across 23 spec files in `e2e/specs/`. All passing against the testing site.
- **Test fixtures:** `e2e/fixtures/` contains test accounts (starter-a, starter-b, professional, etc.) on real Supabase.
- **Gaps to check:** Are there critical user flows NOT covered by tests? Particularly: payment flows, subscription changes, supplier import flows, AI takeoff pipeline.

### 5. Recent Changes (High-Risk Areas)
These are the most recent changes that need the most scrutiny:

| Area | Commits | Risk |
|------|---------|------|
| **Supplier Component System** (10 phases) | `8dc3ec4` through `dd37f7b` | Multi-tenant data sharing, import/export, change notifications |
| **AI Takeoff V3** (3-scan pipeline) | `da21cb5`, `bb71244`, `b10b991` | GPT-5.6 vision API calls, cost per scan ~$0.25, unauth API fix |
| **Catalogue Converter** | Multiple commits | Large file handling (30K+ rows), batch processing, column mapping |
| **E2E Test Harness** | Recent fixes | `networkidle` -> `domcontentloaded`, `createQuote` helper fixes |
| **Unauth API 401 fix** | `91843494` | `ai-scan-v3` route now catches auth errors and returns 401 |

### 6. Billing & Subscriptions
- **Stripe integration:** `app/api/stripe/` - checkout sessions, webhook handling, subscription management.
- **Price drift checker:** `scripts/check-price-drift.mjs` - verifies DB prices match Stripe prices.
- **Plan enforcement:** `app/lib/entitlements.ts` - server-side checks for feature access.
- **Quota system:** Quote limits per plan, AI scan points, storage limits.

### 7. Performance
- **SSR/SSG:** Most marketing pages are statically generated. App pages are server-rendered.
- **Database queries:** Check for N+1 queries, missing indexes, slow joins.
- **Bundle size:** Check for large client-side bundles, especially Fabric.js and PDF generation.

## Known Issues (Not Blockers)

1. **Vercel deploy failures on `quotecore-plus-main`:** After initial successful deploy, subsequent deploys sometimes fail with UNKNOWN status. Local build passes clean. Likely Vercel build execution limit.
2. **Supabase Storage upload broken:** 403 "Invalid Compact JWS" on tenant logo uploads. Workaround: static assets in `public/` folder.
3. **Debug images in AI takeoff:** `saveDebugImage()` uploads scan debug images to Supabase storage. These are temporary and should be removed before launch or gated behind a debug flag.

## What We Need From Gerald

1. **Security audit** - Focus on API routes, RLS policies, auth bypass possibilities, Stripe webhook validation.
2. **Code quality review** - Focus on recent changes (supplier system, AI takeoff, catalogue converter).
3. **Test coverage gap analysis** - What critical flows are NOT tested?
4. **Go/no-go recommendation** - Any blockers for launching to paying customers?

## Key Files to Start With

- `app/api/takeoff/ai-scan-v3/route.ts` - AI pipeline entry point (just fixed unauth 500)
- `app/lib/supabase/server.ts` - Auth helpers (`requireCompanyContext`, `getCurrentProfile`)
- `app/lib/entitlements.ts` - Plan enforcement
- `supabase/migrations/20260708160000_*` - Latest RPC migration (save_takeoff_atomic v8)
- `app/(auth)/[workspaceSlug]/supplier-directory/actions.ts` - Supplier import logic
- `app/api/stripe/webhook/route.ts` - Stripe webhook handler
- `middleware.ts` - Route protection
- `e2e/` - Full test suite

## Coordination

- Gerald's audit reports land in `workspace-gerald/audits/...`
- Shaun coordinates when Gerald runs
- If Gerald finds issues, Gavin fixes them on `development` branch, then merges to `main` after Shaun's approval
