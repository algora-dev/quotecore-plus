# QuoteCore+ - Domain Authority Map

**Status:** Active  
**Owner:** Gavin  
**Last reviewed:** 2026-08-05  
**Related:** `docs/current/CURRENT_TRUTH.md`  

---

> This document names the authoritative location for each business-critical calculation or service. Where two implementations exist, the authority is named here. No consolidation happens without investigation and comparison tests.

## Purpose

Business logic in QuoteCore+ lives across server actions, API handlers, shared `app/lib` modules, UI components, and database functions/triggers. This map makes domain ownership discoverable and prevents duplicate calculations from being created.

## Priority Domains

### 1. Takeoff Persistence

- **Authority:** `save_takeoff_atomic` RPC (database function)
- **Migration source:** `backend/supabase/migrations/20260505180000_save_takeoff_atomic.sql` (original) through `20260526160000_fix_save_takeoff_atomic_overload.sql` (latest fix)
- **Signature:** `save_takeoff_atomic(p_quote_id, p_payload)` - 2-arg, page-scoped deletes
- **Called from:** `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/actions.ts`
- **Also involved:** `app/(auth)/[workspaceSlug]/quotes/actions.ts` (quote-level save), `app/lib/reconstructCanvas.ts` (canvas rebuild from stored points)
- **Tests:** E2E plans in `docs/plans/e2e-test-expansion-revised-2026-07-29.md`; Playwright specs in `e2e/specs/`
- **Do not consolidate without:** Multi-page, multi-area persistence tests covering component scoping, page-scoped deletes, and canvas reconstruction

### 2. Smart Component Calculations (Pitch, Waste, Quantity)

- **Authority:** `app/lib/pricing/engine.ts` - pure functions, no side effects
- **Key functions:** `rafterPitchFactor()`, `hipValleyPitchFactor()`, `pitchFactor()`, `applyWaste()`, `applyPitchAndWaste()`, `computeRoofArea()`, `totalRoofArea()`
- **Called from:** `app/(auth)/[workspaceSlug]/quotes/actions.ts` (recalc on save), `app/(auth)/[workspaceSlug]/quotes/actions-bulk.ts` (bulk recalc), `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/` components (live preview)
- **Types:** `app/lib/types.ts` (MeasurementType, WasteType, PitchType, ComponentType, InputMode)
- **Do not consolidate without:** Golden calculation fixtures covering all pitch types (rafter, valley_hip, none), waste types (percent, fixed, fixed_per_segment), and input modes (final, plan)

### 3. Material Cost (Pricing Strategies)

- **Authority:** `app/lib/pricing/engine.ts` - `computeMaterialCostByStrategy()` and `computePackCount()`
- **Strategies:** `per_unit`, `per_pack_length`, `per_pack_area`, `per_pack_volume`, `per_pack_coverage`
- **Called from:** Quote recalc server actions; `calcTracer.ts` instruments these calls
- **Database constraints:** `ck_component_library_pack_values_positive` CHECK on `component_library`
- **Do not consolidate without:** Tests for each strategy with valid and missing pack data (packDataMissing flag)

### 4. Quote Totals (Margin, Tax, Grand Total)

- **Authority:** `app/lib/pricing/engine.ts` - `computeQuoteTotals()`
- **Inputs:** Array of `QuoteComponent` + `QuoteContext` (materialMarginPct, labourMarginPct, taxRate)
- **Output:** `QuoteTotals` (totalMaterials, totalLabour, subtotal, margins, subtotalWithMargins, tax, grandTotal)
- **Called from:** `app/(auth)/[workspaceSlug]/quotes/actions.ts`, `actions-bulk.ts`, quote-builder UI
- **Do not consolidate without:** Quote totals reproducibility tests with known component sets, margin combinations, and tax rates

### 5. Calculation Audit Trace

- **Authority:** `app/lib/pricing/calcTracer.ts` - instruments pricing logic, produces audit objects
- **Storage:** `quote_components.calc_audit` JSONB column
- **UI:** `CalcAuditPanel.tsx` (admin-only)
- **Functions:** `traceComponentCalc()` (snapshot), `appendOverride()` (push previous audit to overrides[])
- **Do not consolidate without:** Audit shape compatibility tests - the audit JSONB must remain readable by the admin panel

### 6. Quote-to-Order Conversion

- **Authority:** `app/(auth)/[workspaceSlug]/material-orders/order-actions.ts`
- **Entry point:** `app/(auth)/[workspaceSlug]/material-orders/create/order-from-quote/` UI
- **Line selector:** `InvoiceLineSelector.tsx` pattern (shared with invoice conversion)
- **Database:** `material_orders` table, `material_order_lines` table
- **Do not consolidate without:** Quote-to-order totals mapping tests; visibility mapping tests (customer-visible vs internal lines)

### 7. Quote-to-Invoice Conversion

- **Authority:** `app/(auth)/[workspaceSlug]/invoices/actions.ts`
- **Entry point:** `app/(auth)/[workspaceSlug]/invoices/invoice-from-quote/[quoteId]/` UI
- **Line selector:** `InvoiceLineSelector.tsx`
- **Database:** `invoices` table, `invoice_lines` table
- **Do not consolidate without:** Invoice conversion + visibility mapping tests; tax/margin carry-over tests

### 8. Billing and Entitlements

- **Authority:** `app/lib/billing/entitlements.ts` - `loadCompanyEntitlements()` (cached per request)
- **Stripe webhook:** `app/api/webhooks/stripe/route.ts` - every handler returns `'ok' | 'quarantined:<reason>' | 'ignored:phase_2'`
- **Stripe client:** `app/lib/billing/stripe.ts`
- **UI:** `app/(auth)/[workspaceSlug]/account/billing/BillingPanel.tsx`
- **Banner:** `app/components/billing/EntitlementBanner.tsx`
- **Database:** `subscription_plans` table, `subscription_events_audit_v1` (security_invoker=off - do not flip), `companies.billing_lockdown`
- **SQL functions:** Four effective-plan functions added by 2026-05-15 subscription tiers migration
- **Price drift check:** `scripts/check-price-drift.mjs`
- **Tests:** `e2e/specs/plans-entitlements.spec.ts`; `scripts/test-entitlements.mjs`; `scripts/test-stripe-live-flow.mjs`; `scripts/test-webhook-retry-semantics.mjs`
- **Do not consolidate without:** Entitlement enforcement tests under concurrent requests; Stripe webhook idempotency tests; price drift validation

### 9. Supplier-Price Provenance

- **Authority:** `app/lib/supplier-pricing/supplierPricingService.ts`
- **Tests:** `app/lib/supplier-pricing/supplierPricingService.test.ts`
- **Database:** `component_collections`, `supplier_profiles`, `supplier_pricing` tables
- **Known issue:** `supplier_profiles_owner_read` RLS policy broken (`company_id = auth.uid()` compares company UUID to user UUID). `public_read` policy compensates for approved suppliers.
- **Do not consolidate without:** Provenance preservation tests (library context stored with takeoff results); pricing freshness tests

### 10. AI Scan Quotas and Result Processing

- **Authority (quotas):** `app/lib/billing/entitlements.ts` (AI quota checks) + `app/lib/free-tools/resolveTier.ts` (free-tool AI limits)
- **Authority (scan API):** `app/api/ai-scan-v3/route.ts`
- **Authority (result processing):** `app/lib/applyAiResults.ts` - post-processing, `perimeterAccountingPass()` for barge/spouting
- **Authority (prompts):** `app/lib/ai-prompt-v3.ts`
- **Authority (geometry):** `app/lib/outlineGeometry.ts` - convex/concave vertex math for hip/valley correction
- **Component registry:** `app/lib/aiComponentRegistry.ts`
- **UI:** `AiResultsModal.tsx`
- **Database:** AI scan job/queue tables, `ai_assist_points_quota` (migration `20260722200000`)
- **Do not consolidate without:** Quota charging + result acceptance tests; barge/spouting classification tests; vertex classification tests

### 11. Free-Tool Quotas and Document Limits

- **Authority:** `app/lib/free-tools/tiers.ts` (T1/T2/T3 definitions) + `app/lib/free-tools/resolveTier.ts` (tier resolution)
- **Enforcement:** Server-side in free-tool API routes
- **Database:** `free_document_drafts` table, free-tool usage tracking
- **Limits:** T1 anon 3 docs/day + 1 AI/day; T2 authed 10 docs/day + 3 AI/day; T3 onboarded unlimited docs + 10 AI/day. AI combined across types. Docs combined across quote+invoice+PO.
- **Do not consolidate without:** Tier boundary tests (T1->T2, T2->T3); concurrent request quota tests; daily reset tests

### 12. Public Token Access (Quotes, Invoices, Orders, Messages)

- **Authority (HMAC tokens):** `app/lib/security/hmacToken.ts`
- **Authority (reply tokens):** `app/lib/messages/replyToken.ts`
- **Public views:** `app/accept/[token]/` (quotes), `app/invoice/[token]/PublicInvoiceView.tsx`, `app/orders/[token]/`, `app/m/[token]/` (messages)
- **Database:** Acceptance token expiry (`20260429140000_acceptance_token_expiry.sql`)
- **Tests:** `e2e/specs/phase25-public-link-privacy.spec.ts`, `e2e/specs/public-surface.spec.ts`
- **Do not consolidate without:** Public token scoping/expiration tests; ID enumeration tests; cross-tenant access tests

### 13. Tenant Isolation

- **Authority:** RLS policies (database-level) + `app/lib/contextResolver.ts` (server-side workspace context)
- **Context resolution:** `app/lib/company-context.ts`, `app/lib/contextResolver.ts`
- **Tests:** Gerald's mutation harness (90/90 passing); `scripts/test-rls-companies-billing-lockdown.mjs`
- **Security pattern:** Column-level GRANT on sensitive tables; SECURITY DEFINER functions explicitly REVOKE/GRANTed; service-role-only RPCs via `createAdminClient().rpc(...)`
- **Do not consolidate without:** Tenant isolation tests for reads, writes, attachments, public tokens, and admin impersonation across all domain tables

### 14. Email and Follow-up Dispatch

- **Authority (send):** `app/lib/send.ts` + `app/lib/messages/send.ts`
- **Authority (scheduling):** `app/lib/scheduled.ts` + `app/lib/scheduled-types.ts`
- **Authority (dispatch):** `app/lib/dispatch.ts`
- **Authority (queue):** `app/lib/queue.ts`
- **Templates:** `app/lib/outboundMessage.ts`, `app/lib/mergeVars.ts`
- **Database:** `message_templates`, `scheduled_messages`, `sent_messages` tables
- **Cron:** Vercel cron endpoint dispatches scheduled messages
- **Do not consolidate without:** Deliverability tests; cron idempotency tests; suppression list enforcement tests

## Maintenance Rules

1. When adding a new calculation or service, add it to this map with its authoritative location.
2. When two implementations exist, document which is authoritative and mark the other as compatibility/legacy.
3. Do not consolidate duplicate implementations without comparison tests proving identical behaviour.
4. Update this map when moving logic between layers (e.g., UI to server action, server action to RPC).
5. The pricing engine (`app/lib/pricing/engine.ts`) is the authority for all calculation math. UI components may call these functions for preview but must not re-implement the math.

## Changelog

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-08-05 | Initial complete map. 14 priority domains with authorities traced through codebase. |
| v0.1 | 2026-08-05 | Initial stub created. Priority domains identified. |
