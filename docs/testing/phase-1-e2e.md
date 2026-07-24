# Phase 1 E2E Test Harness — Documentation

## Overview

A Playwright browser regression harness that runs only against `https://quotecore-plus-dev.vercel.app`, using ordinary E2E users through real customer-facing paths.

## Quick Start

### Prerequisites

1. Node.js 24+
2. `.env.e2e` file in project root with account credentials (see `.env.e2e.example`)
3. Chromium installed (`npx playwright install chromium`)

### Running Tests

```bash
# Smoke tests (P0 journeys)
npm run e2e:smoke

# All tests (full deterministic suite)
npm run e2e

# Email opt-in tests (requires E2E_ALLOW_EMAIL_SEND=true)
npm run e2e:email

# Open the latest HTML report
npm run e2e:report

# Check for forbidden imports under e2e/
npm run e2e:check-imports

# Dry-run leftover report (never deletes)
npm run e2e:cleanup:dry-run
```

### Test Tags

- `@smoke` — P0 journeys, part of the default smoke set
- `@mutation` — creates/modifies data, zero retries
- `@read-only` — no data mutation, 1 retry allowed
- `@email-opt-in` — requires email send opt-in
- `@mocked-ai` — intercepts AI scan requests
- `@manual` — manual test only
- `@cross-tenant` — cross-tenant isolation test

## Account Fixtures

Five ordinary E2E accounts (created via Supabase Admin API):

| Fixture | Email | Plan | Purpose |
|---|---|---|---|
| trial-a | e2e-trial-a@quotecore.invalid | Trial | Trial restrictions |
| starter-b | e2e-starter-b@quotecore.invalid | Starter | Core paid flows |
| paid-c | e2e-paid-c@quotecore.invalid | Pro | Higher-tier access |
| cross-tenant-d | e2e-cross-d@quotecore.invalid | Starter | Tenant isolation |
| onboarding-e | e2e-onboard-e@quotecore.invalid | Trial | Incomplete onboarding |

Plus an admin account: `e2e-admin@quotecore.invalid` (for fixture management only, not used in Playwright tests).

All passwords are in `.env.e2e` (gitignored). Never commit credentials.

## Safety Rules

1. **Origin guard**: Tests abort before browser launch unless `E2E_BASE_URL` is exactly `https://quotecore-plus-dev.vercel.app`.
2. **Account guard**: Only `e2e-*` prefixed accounts are allowed.
3. **No privileged credentials**: No Supabase service role, Stripe, OpenAI, or admin keys in test code.
4. **No direct database access**: No Supabase client imports under `e2e/`.
5. **Single worker**: No parallel mutation tests.
6. **Zero retries** for mutation suites; 1 retry for read-only only.
7. **Entity prefixing**: All generated entities use `E2E-<run-id>-` prefix.
8. **Same-test cleanup only**: No standalone deletion commands.

## File Structure

```
playwright.config.ts          # Config with origin guard, workers=1
e2e/
  config/
    guard.ts                  # Origin & account guards
    accounts.ts               # 5 E2E account definitions (env-driven)
    account-matrix.ts         # Versioned fixture state matrix
    noise-allowlist.ts        # Console/network noise filter
  fixtures/
    base.ts                   # Combined fixture: auth, evidence, manifest
    auth.ts                   # Login with storage state caching
    evidence.ts               # Action recording for failures
    run-context.ts            # Run IDs, entity manifest, ownership
  pages/
    login.page.ts             # Login page object
    quotes.page.ts            # Quotes list page object
    quote-builder.page.ts     # Quote builder page object
    takeoff.page.ts           # Takeoff page object
  specs/
    auth-routing.spec.ts      # E2E-01, 02: Auth & session
    quotes-customers.spec.ts  # E2E-05, 06, 08, 11: Quotes
    invoices-orders.spec.ts   # E2E-13, 14: Invoices & orders
    calculations-catalogue.spec.ts  # E2E-17: Takeoff
    plans-entitlements.spec.ts # E2E-03, 04, 09, 10, 12, 15, 16
    takeoff-ai-ui.spec.ts     # E2E-18, 19, 21: AI mocks & concurrency
    resilience.spec.ts        # E2E-20, 22, 23: Resilience
    access-boundaries.spec.ts # E2E-24, 25: Access boundaries
    public-surface.spec.ts    # Public page crawl
    attachments-public.spec.ts # Email opt-in (skipped by default)
  scripts/
    check-imports.ts          # Static guard against forbidden imports
  test-data/
    roof-plan-sample.png      # Test fixture image
.env.e2e.example              # Template for .env.e2e
```

## Journey Catalogue (30 tests)

| ID | Journey | Status |
|---|---|---|
| E2E-01 | Login, reload persistence, logout | ✅ |
| E2E-02 | Invalid login, unauthenticated route | ✅ |
| E2E-03 | Password-reset request | ✅ |
| E2E-04 | Onboarding gate (User E + Starter B) | ✅ |
| E2E-05 | Quote required-field validation | ✅ |
| E2E-06 | Quote create/save/reload/edit | ✅ |
| E2E-08 | Builder calculation (no 5xx) | ✅ |
| E2E-09 | Catalogue/component page | ✅ |
| E2E-10 | Attachments page | ✅ |
| E2E-11 | Quote summary page | ✅ |
| E2E-12 | Public quote link (invalid token) | ✅ |
| E2E-13 | Invoice page + create modal | ✅ |
| E2E-14 | Material orders page | ✅ |
| E2E-15 | Account plan/quota (Starter + Trial) | ✅ |
| E2E-16 | Trial restrictions vs paid | ✅ |
| E2E-17 | Takeoff page loads | ✅ |
| E2E-18 | Mocked AI scan intercept | ✅ |
| E2E-19 | No real AI request | ✅ |
| E2E-20 | Rapid duplicate submit | ✅ |
| E2E-21 | Two-tab workspace | ✅ |
| E2E-22 | Refresh/back/forward recovery | ✅ |
| E2E-23 | Public route crawl | ✅ |
| E2E-24 | Cross-tenant denial | ✅ |
| E2E-25 | Admin route denial | ✅ |
| E2E-12-email | Email send (opt-in) | Scaffold (skipped) |
| Public surface | 7 public pages | ✅ |
| Signup page | Form verification | ✅ |

## Limitations

- Dev and main share the same Supabase project (no data isolation)
- No Stripe, real AI, or Google OAuth automation
- Chromium desktop only (no mobile/emulation)
- No CI integration yet (local runs only)
- Email send is scaffold-only (needs full quote fixture for send flow)
- Manual tests (Google OAuth, full onboarding, real AI canary) are documented but not automated

## Repeatability

Verified: 30/30 tests pass on two consecutive runs (~2.4m per run) with no data pollution or flakiness.
