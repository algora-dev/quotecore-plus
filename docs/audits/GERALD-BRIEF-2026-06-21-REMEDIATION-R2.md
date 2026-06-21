# Gerald Re-Audit Brief — 2026-06-21 Remediation R2

**Responds to:** `workspace-gerald/audits/quotecore-plus-golive-security-2026-06-21/05-reaudit-r1.md`
**Remediation commit:** `4b2dbb2` on `development`
**Re-audit range:** `35ca401..4b2dbb2`
**Migration applied:** `supabase/migrations/20260621130000_fix_rpc_auth_and_invoice_selection.sql`

## H-01-R1 — RPC caller-membership check → FIXED

**Change:** `replace_customer_quote_lines` now verifies `auth.uid()` belongs to `p_company_id` before any delete/insert:

```sql
IF auth.uid() IS NOT NULL THEN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Not authorized for company %' USING ERRCODE = 'insufficient_privilege';
  END IF;
END IF;
```

- `auth.uid() IS NULL` path: service_role only (runs from Gavin's server actions which already gate on `requireCompanyContext()`). Direct `authenticated` callers always have a non-null `auth.uid()` and must be members.
- Existing quote-ownership check (`v_owner <> p_company_id`) retained as belt-and-braces after the membership check.
- GRANT/REVOKE unchanged: `authenticated, service_role` only.

**Verify:** authenticated caller with a valid session for company A cannot call the RPC with company B's `quote_id` + `company_id` → `insufficient_privilege`.

## H-03-R1 — Empty `lines` key still imports all lines → FIXED

**Two-layer fix:**

**`new-from-quote/page.tsx`:** `searchParams` awaited once into `resolvedSearchParams`; key presence detected with `'lines' in resolvedSearchParams` (not truthiness of the value):
```ts
const linesKeyPresent = 'lines' in resolvedSearchParams;
const selectedLineIds = linesKeyPresent
  ? (lines ?? '').split(',').filter(Boolean)   // [] if blank/commas-only
  : undefined;                                  // key absent = no selection
```

**`invoices/actions.ts`:** `selectionProvided` now means `selectedLineIds !== undefined` (key was present), not `length > 0`. Empty array throws immediately, before the filter or fallback:
```ts
const selectionProvided = selectedLineIds !== undefined;
if (selectionProvided && selectedLineIds!.length === 0) {
  throw new Error('No valid line IDs provided...');
}
```

This closes all three tamper vectors:
- `?lines=<bogus>` → filters to `[]` → `selectionProvided=true`, length 0 → throws (was already fixed in R1)
- `?lines=` → `linesKeyPresent=true`, value is `""` → filters to `[]` → throws (new)
- `?lines=,,,` → `linesKeyPresent=true`, all tokens empty → `[]` → throws (new)
- No `lines` key → `selectedLineIds=undefined` → `selectionProvided=false` → legitimate fallback for build-mode quotes

**Verify:** `?quoteId=<valid>&lines=` → error; `?quoteId=<valid>&lines=,,,` → error; no `lines` key → legitimate fallback still works.

## Build status
`next build` passes clean. Migration applied to shared Supabase DB.

## Remaining deferred (Shaun's call)
M-04, M-05, M-06, L-01–L-04 — unchanged from R1.
