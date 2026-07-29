# QuoteCore+ E2E Test Expansion Plan — Revised

**Date:** 2026-07-29  
**Author:** Gavin  
**Replaces:** `gerald-test-expansion-brief-2026-07-29.md` and `phase-2-5-e2e-test-expansion-plan.md`

---

## Goal

Automate breaking the system so we find real bugs before humans do. Every test must catch something that would actually break for a real user or cost us money. No vanity tests. No tests that pass but prove nothing.

**The failure mode we're avoiding:** tests that pass because they don't assert anything meaningful. Every test must have a concrete, checkable assertion that fails when the thing it's testing is broken.

---

## What Already Exists

**Phase 1 (30+ specs, 15 files):** Auth, routing, basic access boundaries, quote CRUD, customer CRUD, takeoff smoke, attachments, public surface crawl.

**Phase 2.5 (8 spec files):** Money-boundary calc matrix, server-side paid-feature enforcement, attachment tenant isolation, upload boundaries, suspended/expired enforcement, public-link privacy, mobile public smoke, AI takeoff real pipeline, document send flow, multi-page takeoff.

**Problem:** Many Phase 2.5 tests are scaffold-quality — they verify "page loads without 5xx" but don't assert actual correctness. These need to be hardened, not duplicated.

---

## What I Agree With From Gerald's Audit

1. **H-01 Tenant isolation across direct routes/APIs** — Yes. We have basic cross-workspace redirect tests but no direct API-level isolation tests. A broken RLS policy is the single most damaging bug we could ship. This is P0.

2. **H-02 Quote money-boundary correctness** — Partially. The existing `phase25-money-calc.spec.ts` is scaffold-quality — it checks "no 5xx" but doesn't verify actual numbers. The fix isn't adding more tests; it's making the existing ones assert real values. P0.

3. **H-03 Server-side paid-feature enforcement** — Partially. The existing `phase25-paid-feature-enforcement.spec.ts` already hits API routes directly and asserts 4xx. But it doesn't verify "no record created" or "no points debited". Adding those assertions is worthwhile. P0.

4. **H-04 Real AI queue canary** — Yes, but minimal. One real end-to-end test proving: job created → one debit → persisted result → refund on failure. The existing `phase26-ai-takeoff-pipeline.spec.ts` already attempts this but needs hardening. Keep it gated behind `E2E_AI_TAKEOFF_ENABLED=true`. P1 (not P0 — it costs real money per run).

5. **H-05 Catalogue conversion atomicity** — Yes. If a 21-row import fails, we need to prove zero components were created, not just that an error showed. P0.

## What I'm NOT Including From Gerald's Audit

- **M-01 Upload XSS/size boundary expansion** — We already have `phase25-upload-boundary.spec.ts` covering size limits, MIME mismatch, and fake files. Adding "one byte below/above" is brittle and doesn't catch real bugs. The existing tests are sufficient.

- **M-02 Notification recipient isolation** — Too low-risk for now. Notifications are a P2 feature. If we ship a notification to the wrong person, it's embarrassing but not data loss or revenue loss. Skip until notifications matter commercially.

- **M-03 Lead capture validation/consent/rate-limiting** — The free tool lead capture is a single email field. Rate-limiting and consent checkboxes aren't built yet. Can't test what doesn't exist. Skip.

- **Gerald's test design guidance (tags, serial projects, etc.)** — Good practice but over-engineering for our current stage. We're running tests locally, not in CI with parallel workers. Simple `@smoke`, `@mutation`, `@security` tags are enough.

---

## Revised Plan: 4 Phases, Hardened Tests

### Phase A: Harden Existing Scaffolds (8 tests)

**Why first:** We already have 8 spec files that claim to test these things but don't actually assert meaningful outcomes. Fixing these is the fastest path to real coverage. No new test files — just making existing ones bite.

| # | Spec File | What's Wrong Now | What It Should Assert |
|---|-----------|------------------|----------------------|
| A1 | `phase25-money-calc.spec.ts` | Checks "no 5xx" only | Add line items with known values → assert exact subtotal, tax, grand total visible on page. Use deterministic fixtures (e.g. 10.50 qty × 25.00 rate = 262.50). Assert the rendered total matches. |
| A2 | `phase25-money-calc.spec.ts` | Discount test doesn't check discount | Apply 10% discount → assert discounted total is 90% of original. Assert the number on the page. |
| A3 | `phase25-money-calc.spec.ts` | Tax test doesn't check tax | Set 20% tax rate → assert tax line shows correct amount and grand total includes it. |
| A4 | `phase25-paid-feature-enforcement.spec.ts` | Doesn't check "no record created" | After hitting AI scan API as trial user → query quotes/ takeoff pages → assert no new job/record exists. |
| A5 | `phase25-attachment-isolation.spec.ts` | Cross-tenant test is loose | Company D tries to access Company A's quote by direct URL → assert 404 or redirect, AND assert response body contains zero quote data (no customer names, no line items, no totals). |
| A6 | `phase25-upload-boundary.spec.ts` | Doesn't verify rejection | Upload 10MB+1 file → assert visible error message appears (not just "no 5xx"). Assert file does NOT appear in attachments list. |
| A7 | `takeoff-ai-ui.spec.ts` | Mocked AI test doesn't test flow | Mock the 3 scan endpoints → trigger AI assist → assert all 3 scans called in sequence → assert results modal appears with area data. |
| A8 | `phase26-ai-takeoff-pipeline.spec.ts` | Real pipeline test is loose | When enabled: assert job created in DB, exactly one points debit, results modal shows ≥1 area, apply works, canvas shows drawn areas. |

### Phase B: Tenant Isolation & Security (6 tests)

**Why second:** After hardening existing tests, the biggest untested risk is cross-tenant data leakage at the API level. RLS is our last line of defence and it's completely untested by the e2e suite.

| # | Test | What It Catches | Priority |
|---|------|-----------------|----------|
| B1 | Company D direct API call to list Company A's quotes → assert empty array or 403 | RLS policy broken on quotes table | P0 |
| B2 | Company D direct API call to list Company A's component library → assert empty or 403 | RLS policy broken on component_library | P0 |
| B3 | Company D direct API call to read Company A's takeoff data (areas, measurements) → assert empty or 403 | RLS policy broken on takeoff tables | P0 |
| B4 | Company D tries to save takeoff data to Company A's quote → assert 403/404, no data written | Write-side RLS broken on takeoff tables | P0 |
| B5 | Non-supplier company tries to access unpublished/private supplier catalogue → assert not in search results | Catalogue visibility filter broken | P1 |
| B6 | Company D tries to import components into Company A's library → assert 403, no components created | Import endpoint doesn't check target library ownership | P1 |

### Phase C: Supplier System & Catalogue (8 tests)

**Why third:** The supplier system is 10 phases of new code with zero coverage. This is where regressions will hide.

| # | Test | What It Catches | Priority |
|---|------|-----------------|----------|
| C1 | Upload CSV catalogue → convert to components → assert components exist with correct name, price, SKU | Conversion silently drops fields or creates wrong data | P0 |
| C2 | Upload 21-row CSV → assert blocked with error → assert ZERO components created (not 20) | Partial write on rejection — atomicity broken | P0 |
| C3 | Supplier publishes library → assert it appears in public directory → assert search finds it by keyword | Publishing doesn't update visibility or search index | P1 |
| C4 | Non-supplier user searches supplier directory → assert only published catalogues visible, no private ones | Search returns private catalogues | P1 |
| C5 | Import supplier components into own library → assert imported with correct pricing and SKU | Import drops price or SKU | P1 |
| C6 | Supplier updates published library → assert change notification created for importers | Update notifications not generated | P2 |
| C7 | CSV with special characters (commas in quoted fields, newlines in cells) → assert parsed correctly | CSV parser breaks on edge cases | P1 |
| C8 | CSV with description > 60 chars → assert name truncated at 60, notes has full text | Truncation off-by-one or doesn't apply | P1 |

### Phase D: Quote Builder & Takeoff Persistence (8 tests)

**Why last:** These are the core flows. Some coverage exists from Phase 1, but the calculation and persistence paths need real assertion tests.

| # | Test | What It Catches | Priority |
|---|------|-----------------|----------|
| D1 | Create quote → add line items with known values → assert exact subtotal, tax, grand total on page | Calculation engine returns wrong numbers | P0 |
| D2 | Save quote → reload → assert ALL line items, quantities, rates persist | Partial save — fields lost on reload | P0 |
| D3 | Save takeoff → reload → assert all areas, measurements, components persist | Takeoff save is partial (known bug pattern) | P0 |
| D4 | Multi-page takeoff → switch pages → assert each page keeps its own areas | Page switching corrupts or loses areas | P0 |
| D5 | Delete roof area → assert its components also removed | Orphaned components left behind | P1 |
| D6 | Add pitch to area → assert pitched area calculation correct | Pitch math wrong | P1 |
| D7 | Quote → apply percentage discount → assert discounted total correct | Discount math wrong | P1 |
| D8 | Quote → change tax rate → assert all items reflect new rate | Tax only applies to some items | P1 |

---

## What's NOT In This Plan (Intentionally)

- **Stripe billing flows** — Separate effort, needs webhook mocking. Not blocking launch.
- **PDF generation correctness** — Visual output, hard to assert programmatically. Manual test is sufficient for now.
- **Email sending** — No email provider configured for e2e. Skip.
- **Performance/load testing** — Wrong tool. Use k6 when needed.
- **Mobile device testing** — Desktop Chromium only. Mobile emulation is future.
- **Google OAuth** — Requires real Google session. Manual test only.
- **Notification recipient isolation** — P2 feature, low commercial risk. Skip.
- **Lead capture rate-limiting/consent** — Not built yet. Can't test what doesn't exist.
- **Upload XSS boundary expansion** — Existing tests sufficient.

---

## Summary

| Phase | Focus | Tests | P0 | P1 | P2 |
|-------|-------|-------|----|----|----|
| A | Harden existing scaffolds | 8 | 4 | 3 | 1 |
| B | Tenant isolation & security | 6 | 4 | 2 | 0 |
| C | Supplier system & catalogue | 8 | 2 | 5 | 1 |
| D | Quote builder & takeoff persistence | 8 | 4 | 4 | 0 |
| **Total** | | **30** | **14** | **14** | **2** |

## Build Approach

1. **Phase A first** — hardening existing tests is the fastest win. These files already exist, just need real assertions.
2. **Phase B second** — tenant isolation is the highest-risk untested area. New spec file.
3. **Phase C third** — supplier system has the most new untested code. New spec file.
4. **Phase D last** — quote/takeoff persistence. Builds on Phase A's hardened calc tests.

Each phase: build, run locally, fix any bugs found, move to next. No CI until all 4 phases pass locally.

## Success Criteria

- Every P0 test has a concrete assertion that fails when the feature is broken (not just "no 5xx")
- Running the full suite takes < 10 minutes (excluding real AI canary)
- Real AI canary costs < $1 per run and only runs on explicit opt-in
- At least 3 real bugs found and fixed during Phase A hardening (if zero bugs found, the tests aren't strict enough)
