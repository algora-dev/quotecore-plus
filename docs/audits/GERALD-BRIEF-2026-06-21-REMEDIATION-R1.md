# Gerald Re-Audit Brief — 2026-06-21 Go-Live Remediation R1

**Responds to:** `workspace-gerald/audits/quotecore-plus-golive-security-2026-06-21/04-report.md`
**Remediation commit:** `35ca401` on `development`
**Re-audit range:** `70b0ca4..35ca401`
**Migration applied to Supabase (dev+main shared DB):** `supabase/migrations/20260621120000_golive_audit_hardening.sql`

## Blockers fixed (verify these for go-live clearance)

### H-01 — Non-transactional quote-line save → FIXED
- New SECURITY DEFINER RPC `public.replace_customer_quote_lines(p_quote_id, p_company_id, p_lines jsonb)`:
  - `pg_advisory_xact_lock(hashtext(quote_id))` serializes concurrent saves per quote.
  - Ownership re-check (`company_id` match) inside the function → raises `insufficient_privilege` on mismatch.
  - Delete + insert run in the **same transaction** — insert failure rolls back the delete.
- Caller `saveCustomerQuoteLines` (`quotes/actions.ts`) now calls the RPC instead of separate delete/insert.
- **Verify:** function exists ✅ (confirmed), EXECUTE granted to `authenticated, service_role` only, advisory lock present in body.

### H-02 — `base_unit_cost` outside canonical migrations → FIXED
- Column now added idempotently in the canonical timestamped migration `20260621120000_*` (`ADD COLUMN IF NOT EXISTS`).
- Backend patch 018 left in place (harmless/idempotent); canonical folder is now authoritative.
- **Verify:** column present ✅ (confirmed).

### H-03 — Invoice-from-quote URL tampering → FIXED
- `invoices/actions.ts`: added `selectionProvided` flag. When the caller passes `selectedLineIds` but the post-filter set is empty, the action now **throws** ("None of the selected quote lines could be found") instead of falling through to the all-components fallback.
- Fallback (`quote_components` import) now only runs when **no** selection was provided (genuine build-mode quote with empty `customer_quote_lines`).
- **Verify:** tamper `lines=<bogus>` → expect error, not full-component import.

### H-04 — Quote accept/decline race/expiry → FIXED
- `accept/[token]/actions.ts respondToQuote`: final UPDATE now carries lifecycle predicates: `eq(id)`, `eq(acceptance_token)`, `is(accepted_at,null)`, `is(declined_at,null)`, `is(withdrawn_at,null)`, plus `acceptance_token_expires_at IS NULL OR > now()` (via `.or()`).
- `.select('id')` returns affected rows; **0 rows → throws conflict and does NOT fire alerts/follow-ups.**
- **Verify:** concurrent accept/decline or post-expiry submit → exactly one wins, loser gets conflict error, no duplicate alerts.

## Same-day mediums fixed

### M-01 — Pricing/qty/margin bounds → FIXED
- CHECK constraints on `customer_quote_lines`: `quantity > 0 AND <= 1e6`, `unit_price >= 0` (nullable), `base_unit_cost >= 0` (nullable), `line_margin_percent` / `line_labor_margin_percent` bounded `-100..100000`.
- Added `NOT VALID` then validated (skips silently if a legacy dirty row exists; still enforced on all new writes).
- **Verify:** constraints present ✅ (confirmed). Direct API insert with negative qty rejected (check_violation).

### M-02 — `quote_component_id` cross-quote binding → FIXED
- `BEFORE INSERT OR UPDATE` trigger `trg_cql_component_same_quote` rejects any line whose `quote_component_id` does not belong to the line's own `quote_id`.
- **Verify:** trigger present ✅ (confirmed). Direct API attempt to point a line at another quote's component → check_violation.

### M-03 — Rate limiter fail-open on high-value routes → FIXED
- `{ failClosed: true }` added to: invoice dispute, invoice payment-sent, message reply (`m/[token]`), quote revision request (`accept/[token]`), order respond (IP + order buckets), and all 4 recovery limiters (`login/recover`).
- Lower-value read/view paths left fail-open by design.

## NOT addressed in this round (your call on timing)
- **M-04** quote_notes immutable-column trigger
- **M-05** dependency advisories (`ws`, `dompurify`) — separate patch branch
- **M-06** global HSTS + app CSP
- **L-01..L-04** auth-API rate limits, token+IP buckets, env startup validation, scanner allowlist

## Verification done
- `next build` passes clean.
- DB objects confirmed present: RPC, trigger, 5 CHECK constraints, `base_unit_cost` column.
- Types regenerated from live schema.

*Re-audit the four blockers + M-01..M-03 against `70b0ca4..35ca401`.*
