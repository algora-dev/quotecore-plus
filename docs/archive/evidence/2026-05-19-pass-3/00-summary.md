# Pass-3 Evidence for Gerald
**Branch:** `feature/tier-gating-v2`  **HEAD:** `a7ce3a3`  **Date:** 2026-05-19

Verbatim outputs for the seven test categories you requested before Shaun smoke testing. Each item has its own log file in this directory.

| # | Topic | Log file | Result |
|---|---|---|---|
| 1 | M-01R-P2 trial trigger evidence (Test 7) | `01-m01r-p2-trial-trigger.txt` | 14/14 PASS |
| 2 | Stripe retry/idempotency adversarial test | `02-stripe-retry-and-stale-sub.txt` | 16/16 PASS |
| 3 | Stripe stale-subscription quarantine | covered by item 2 (Test 4) | included above |
| 4 | Real test-mode Stripe smoke (Checkout + cancel-at-period-end + invoice failed + invoice paid) | `04-stripe-testmode-flow.txt` | 13/13 PASS |
| 5 | Combined DB-boundary adversarial run (companies / SECDEF fns / subscription_events / support_tickets) | `05-db-boundary-adversarial.txt` | 55/55 PASS (20 + 20 + 15) |
| 6 | Signed-upload + quota (incl. wrong-path + server-measured size) | `06-signed-upload-and-quota.txt` | 8/8 PASS |
| 7 | Migration safety + Gerald's orphan query | `07-migration-safety.txt` | All checks pass; orphan query returns 0 rows |

**Totals across all suites: 121 new pass-3 checks. Combined with the 117/117 regression matrix: 238 PASS / 0 FAIL.**

---

## Key things you specifically asked for

### Gerald's orphan query
```sql
SELECT id, slug, subscription_status, trial_ends_at, trial_started_at
FROM companies
WHERE trial_ends_at IS NOT NULL AND trial_started_at IS NULL;
```
**Result: 0 rows.** Captured in `07-migration-safety.txt`.

### Stripe retry/idempotency proof (item 2)
The test verifies the full lifecycle:
- First event attempt inserts `webhook_deliveries` row → `[PASS]` quarantined no-op returns 200 with `processed_at` SET
- Simulated retryable failure → `[PASS]` H-01R test plants a `processed_at=NULL` row and POSTs the same event id; handler **reprocesses** (not silent 200), `processed_at` becomes SET, `processing_result` advances past `retryable_error:`
- Subsequent duplicate of a fully-processed event → `[PASS]` 200 with `idempotent:true`

### Stale subscription quarantine (item 3, embedded in item 2)
Test 4 in `02-stripe-retry-and-stale-sub.txt`:
- Event customer matches company → check passes
- Event sub.id does NOT match `companies.stripe_subscription_id` → `processing_result='quarantined:stale_subscription:<event_sub>_vs_current_<our_sub>'`
- Company `subscription_status` remains 'active'
- Company `first_payment_failure_at` remains null
- Event is marked processed (not retried forever)

### Real test-mode Stripe smoke (item 4)
Real Stripe SDK calls into test mode, real Customer + PaymentMethod + Subscription created (`sub_1TYm1gPIfO8jS1dmUmgHWFVY`), then synthesised webhooks driving the lifecycle:
- A. subscription.created → `company.plan_code='starter' status='active' stripe_subscription_id` linked
- B. H-02 guard would block fresh Checkout (status=active + sub_id present)
- C. cancel_at_period_end set → status stays 'active' → guard still blocks
- D. invoice.payment_failed → status='past_due', first_payment_failure_at stamped
- E. invoice.payment_succeeded → status='active', first_payment_failure_at cleared, subscription_events 'reactivated' row written

**Test isolation note:** Stripe TEST account has a webhook endpoint at `https://quotecore-plus-dev.vercel.app/api/webhooks/stripe` registered, which writes to the same Supabase project. Without isolation, live Stripe-fired webhooks (from real API calls in the test) race the synthesised ones — ~30% flake observed during authoring. Fix: test disables that live endpoint at setup and re-enables it at teardown. With isolation: 10/10 runs deterministic. See test source header comment for details.

### DB-boundary security (item 5)
One combined adversarial run authenticated as a throwaway user via real JWT:
- 9 `companies` billing columns → all blocked with PG `42501 permission denied for table`
- 7 service-role-only SECURITY DEFINER functions → all blocked (cross-tenant `create_quote_atomic` attempt also blocked)
- 7 RLS-helper SECDEF functions → all callable as expected (`company_has_feature`, etc.)
- Anon role → blocked from every RPC
- Service role → both privileged RPCs succeed (sanity)
- Raw `subscription_events` SELECT → blocked
- Redacted `subscription_events_audit_v1` SELECT → returns rows; verified `stripe_payload`/`stripe_event_id`/`stripe_event_type` columns are absent
- 9 `support_tickets` workflow columns (status, priority, category, assignee, related_stripe_*, auto_close_at, created_by_system, resolved_at) → all blocked
- 3 whitelisted columns (email_forwarded_at, email_forward_error, messages) → allowed
- Direct `.upload()` to QUOTE-DOCUMENTS → blocked (own folder AND cross-company)

### Signed-upload + quota (item 6)
Adversarial:
- Direct `.upload()` to QUOTE-DOCUMENTS → `new row violates row-level security policy`
- Same attempt against another company's folder → same RLS violation
- SELECT own folder → 1 object visible
- Cross-company SELECT → empty (RLS hides rows)
- Signed-upload-URL flow end-to-end → uploaded to `{companyId}/_pending/signed-<ts>.png`
- `mintQuoteDocumentUploadUrl` source-level path scoping → confirmed only ever builds paths under caller's `companyId`
- `upload-finaliser` source-level real-size verification → re-reads `storage.objects.metadata.size` server-side + deletes on overage
- `company-logos` direct upload → still permitted (phase-2 scope per launch brief)

### Migration safety (item 7)
- All 9 pass-3 migrations re-applied cleanly against the current DB state (idempotent; use `IF NOT EXISTS` / `DROP IF EXISTS` / `CREATE OR REPLACE`)
- Gerald's orphan query: 0 rows
- 11 state invariants verified post-re-apply (trigger function bodies, trigger existence, ACLs on functions/tables, policy presence, column-level GRANTs)

---

## How to reproduce

```powershell
cd projects/quotecore-plus
npm run dev -- --port 3333   # in a separate shell (needed for items 2, 4)
$env:WEBHOOK_TEST_URL = 'http://localhost:3333'
node scripts/test-trial-reactivation-blocked.mjs              # item 1
node scripts/test-webhook-retry-semantics.mjs                 # items 2, 3
node scripts/test-stripe-live-flow.mjs                        # item 4
node scripts/test-rls-companies-billing-lockdown.mjs          # item 5 (part 1)
node scripts/test-rls-secdef-lockdown.mjs                     # item 5 (part 2)
node scripts/test-rls-subevents-and-support-lockdown.mjs      # item 5 (part 3)
node scripts/test-storage-signed-upload-only.mjs              # item 6
# item 7: re-apply migrations + run the orphan query, captured by SQL endpoint
```

`test-stripe-live-flow.mjs` requires `STRIPE_SECRET_KEY` (test mode) + `STRIPE_WEBHOOK_SECRET` in `.env.local` and will refuse to run if a live key is detected.
