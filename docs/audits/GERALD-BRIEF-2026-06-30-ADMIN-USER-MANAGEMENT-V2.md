# Gerald Brief v2: Admin User Management & Subscription Control

**Date:** 2026-06-30 (revised)
**Scope:** New `/admin/users` page (replaces "Delete account"), per-user admin profile page, subscription tier overrides, Stripe coupon discounts, account pause, password reset.
**Bundle HEAD:** `dfa84a5` (current `development`)
**Author:** Gavin
**Supersedes:** `GERALD-BRIEF-2026-06-30-ADMIN-USER-MANAGEMENT.md` (v1)
**Incorporates:** All findings from Gerald audit `quotecore-plus-admin-user-management-2026-06-30/04-report.md`

---

## 1. Goal

Give Shaun full control over any user's subscription from the admin dashboard. Use cases: support overrides, payment-issue fixes, comping frustrated customers, applying discounts, pausing access.

**Design principle (revised per Gerald H-01):** `companies.plan_code` is Stripe-owned — the webhook writes to it. Admin overrides use SEPARATE columns (`admin_override_plan_code`, `admin_override_until`, `admin_override_notes`) so they are fully decoupled from Stripe. The SQL function `company_effective_plan_code()` returns the admin override when active, otherwise the Stripe-driven `plan_code`.

## 2. Current State (what already exists)

### 2.1 Admin area
- `/admin/login` — email/password login, checks `users.is_admin = true`
- `/admin` — dashboard with counters
- `/admin/admins` — admin account management (shipped `bd523a8`)
- `/admin/users` — currently "Delete Account" page (search + wipe tenant). **This will be renamed and extended.**
- `/admin/support-tickets`, `/admin/suppressions` — existing tools

### 2.2 Subscription system
- `companies.plan_code` — purchased plan (text: `trial`, `free`, `starter`, `growth`, `pro`, `pro_plus`, etc.). **Webhook-owned.**
- `companies.subscription_status` — lifecycle status (`trialing`, `active`, `past_due`, `grace`, `suspended`, `canceled`, `disputed`, etc.). **Webhook-owned.**
- `companies.comp_until` (timestamptz, nullable) — existing comp mechanism. **Will be DEPRECATED for admin overrides** (see §4.1). Still works for legacy comps; new admin overrides use `admin_override_*` columns instead.
- `companies.comp_notes` (text, nullable) — existing.
- `subscription_plans` table — 10 plan codes, 4 active with Stripe prices (starter $19, growth $29 inactive, pro $39, pro_plus $59)
- `company_effective_plan_code(uuid)` SQL function — returns effective plan. Currently checks `comp_until` first, then billing states. **Will be updated** to check `admin_paused` first, then `admin_override_plan_code`, then existing logic.
- `company_effective_plan_active(uuid)` — returns false for suspended/canceled. **Will be updated** to return `false` when `admin_paused = true` before any other checks.
- Stripe webhook at `/api/webhooks/stripe/route.ts` — handles `customer.subscription.created/.updated/.deleted`, `invoice.payment_succeeded/.payment_failed`, `charge.dispute.created/.closed`. **Will be updated** to skip plan/status mutations while `admin_paused = true` or `admin_override_until > now()`.

### 2.3 Stripe setup
- `STRIPE_MODE` env var (`test` | `live`)
- `app/lib/billing/stripe.ts` — SDK factory, `resolvePlanCodeForStripePrice()`, `resolveStripePriceForPlan()`, `priceIdColumn()`
- Live + test Price IDs configured for starter/pro/pro_plus (growth inactive)
- Stripe webhook secret configured on both Vercel projects

### 2.4 Existing `subscription_events` table
- Has `actor_user_id` and `notes` columns.
- **RLS allows company users to SELECT their own rows** (billing transparency).
- **Per Gerald M-03:** Do NOT put admin-internal details here. Use new `admin_actions` table for sensitive audit.

## 3. Proposed Changes

### 3.1 Rename "Delete account" → "Users"

- **`/admin/users`** becomes the user search & management page (not just delete).
- **Server-side paginated search** (per Gerald M-04) — search by email, name, or company name via server action with `limit` + `offset`. Not a 500-row client filter.
- Click a user row → navigates to `/admin/users/[userId]` (admin profile page).
- Delete account functionality moves into the admin profile page as one of many actions.

### 3.2 New page: `/admin/users/[userId]` — Admin User Profile

Single page with full control over the user's company + subscription. Sections:

#### A. Company info
- Company name (editable text field + save, with reason field per Gerald L-02)
- Company slug (read-only display)
- Plan code (read-only display — Stripe-owned, changed via subscription controls below)
- Subscription status (read-only badge)
- Stripe customer ID (read-only, with link to Stripe dashboard if present)
- Stripe subscription ID (read-only, with link to Stripe dashboard if present)
- Current period end (read-only)
- Storage used / limit (read-only)
- Created date (read-only)

**Company name edit (per Gerald L-02):**
- Max length enforced, trimmed, non-empty.
- Requires a "reason" text field (e.g. "typo in company name").
- Writes to `admin_actions` table with old value + new value + reason + admin email.
- Updates `companies.name` directly.

#### B. Subscription tier control
A dropdown of active plan codes (`free`, `starter`, `pro`, `pro_plus`) + action buttons. Three modes:

**Mode 1: Admin override (no Stripe charge)**
- Sets `companies.admin_override_plan_code = '<selected plan>'`.
- Sets `companies.admin_override_until = '9999-12-31'` (effectively forever).
- Sets `companies.admin_override_notes = 'Admin override by <admin_email> on <date>: <reason>'`.
- Does NOT touch `plan_code` or `subscription_status` (those stay Stripe-owned).
- Does NOT touch Stripe (no subscription created/updated).
- `company_effective_plan_code()` returns `admin_override_plan_code` when `admin_override_until > now()` — **the user gets the overridden plan regardless of what Stripe says.**
- **Reason field required** (e.g. "Customer had payment issues, comping to Pro for 3 months").
- Writes to `admin_actions` table.
- **Webhook safety (per Gerald H-01):** The webhook writes to `plan_code` and `subscription_status`, NOT to `admin_override_plan_code`. So even if a Stripe event fires, the override is untouched. The effective plan stays as the admin override. **This is the core fix from Gerald's audit.**

**Mode 2: Change paid plan (Stripe sync)**
- Only available if the company has a `stripe_subscription_id`.
- **Sequence (per Gerald M-01):**
  1. Validate target plan has a Stripe price for the current mode (`stripe_price_id_test` or `stripe_price_id_live`).
  2. Call Stripe API: `stripe.subscriptions.update(sub_id, { items: [{ id: current_item_id, price: new_price_id }], proration_behavior: 'create_prorations' })`.
  3. **After Stripe success:** Update local DB from the returned Stripe subscription object (same allowlist logic as webhook: `plan_code`, `subscription_status`, `stripe_price_id`, `current_period_end`). Don't wait for the webhook.
  4. **Only after Stripe success:** If an admin override was active, clear it (`admin_override_until = null`, `admin_override_plan_code = null`, `admin_override_notes = null`). The Stripe-driven `plan_code` is now the effective plan.
  5. If Stripe API call fails, return error to admin. No DB mutation, no override cleared.
- **UI state:** Show "syncing" indicator if Stripe succeeded but local DB is pending (shouldn't happen since we update synchronously, but belt-and-braces).

**Mode 3: Remove admin override (reconnect to Stripe)**
- Clears `admin_override_plan_code`, `admin_override_until`, `admin_override_notes`.
- The effective plan reverts to whatever `plan_code` + `subscription_status` say (Stripe-owned state).
- If the company has no Stripe subscription, they fall back to whatever `plan_code` is (likely `free` or `trial`).
- Writes to `admin_actions` table.
- **Reason field required.**

#### C. Discount / coupon control
- Dropdown of available Stripe coupons (fetched from Stripe API: `stripe.coupons.list({ active: true })`).
- **Per Gerald M-02:** Filter to `valid === true`, expected duration (`forever` or explicitly allowed `once`), and preferably `metadata.quotecore_admin_visible === 'true'`. Display `duration`, `percent_off`, and redemption limits.
- Shows currently applied coupon if any (read from `stripe.subscriptions.retrieve(sub_id).discounts`).
- **Apply coupon:** `stripe.subscriptions.update(sub_id, { discounts: [{ coupon: couponId }] })` (per Gerald M-02, use `discounts` array not old `coupon:` field).
- **Remove coupon:** `stripe.subscriptions.update(sub_id, { discounts: [] })`.
- Only available if the company has a `stripe_subscription_id`.
- **No new DB columns needed** — coupon state lives in Stripe.
- Writes to `admin_actions` table (coupon applied/removed, with reason).

**Coupons to create in Stripe upfront (manual, via Stripe Dashboard or API script):**
- 25% off forever — `metadata: { quotecore_admin_visible: 'true' }`
- 50% off forever — `metadata: { quotecore_admin_visible: 'true' }`
- 75% off forever — `metadata: { quotecore_admin_visible: 'true' }`
- 100% off forever — `metadata: { quotecore_admin_visible: 'true' }`
- 50% off once (one-time goodwill) — `metadata: { quotecore_admin_visible: 'true' }`

#### D. Pause / suspend access (per Gerald H-02)

- Button: "Pause access" — sets `companies.admin_paused = true`, `admin_paused_at = now()`, `admin_paused_by = <admin user id>`, `admin_pause_reason = '<reason>'`.
- **`company_effective_plan_active()` returns `false` when `admin_paused = true`** — checked FIRST, before comp_until, before any billing state. User is locked out of the app.
- Does NOT cancel Stripe subscription (so it can be resumed quickly).
- Does NOT touch `subscription_status` (so dunning cron and webhook still see the "real" billing state).
- **Reason field required.**
- Button: "Resume access" — clears `admin_paused`, `admin_paused_at`, `admin_paused_by`, `admin_pause_reason`.
  - **Per Gerald H-02:** Resume should NOT blindly set `active`. Instead, clear `admin_paused` and let the existing `subscription_status` (which was untouched during pause) determine the effective state. If Stripe says `active`, they're active. If Stripe says `past_due`, they're past_due.
- Writes to `admin_actions` table.

**Webhook guard (per Gerald H-02):**
The webhook handler at `app/api/webhooks/stripe/route.ts` needs guards in `handleSubscriptionChange` and `handleInvoicePaid` and `handleDispute`:

```typescript
// Skip plan/status mutations while admin_paused or admin_override active.
// Log the event for audit but don't overwrite entitlements.
if (company.admin_paused) {
  // Insert subscription_events row for logging, but don't update plan_code/subscription_status.
  return 'ok:admin_paused';
}
```

This means: while paused, Stripe events are still received and logged (for audit), but they don't change `plan_code` or `subscription_status`. When unpaused, the latest Stripe state is already in the DB (from the last event before pause, or we can optionally re-fetch from Stripe on resume).

**Wait — actually the guard should be simpler.** Per Gerald H-02: "skip status/plan mutation while `admin_paused=true` except for safe logging." And for admin override: the webhook can freely write `plan_code` (it's Stripe-owned), but `company_effective_plan_code()` will return `admin_override_plan_code` instead. So we only need the webhook guard for `admin_paused`, not for `admin_override`.

**Revised webhook guard:**
```typescript
// In handleSubscriptionChange, after loading company:
if (company.admin_paused) {
  // Log the event but don't mutate plan_code or subscription_status.
  await admin.from('subscription_events').insert({ ... });
  return 'ok:admin_paused';
}
```

For `admin_override`: no webhook guard needed. The webhook writes `plan_code` freely. `company_effective_plan_code()` returns `admin_override_plan_code` when active, so the override is safe. When the override is cleared, the latest `plan_code` (written by the webhook) takes effect. **This is the correct decoupling.**

#### E. Password reset (per Gerald H-03)

**Preferred: Send password reset link** (not direct password set).
- Button: "Send password reset link" — calls `supabase.auth.admin.generateLink('recovery', userEmail)` and returns the link.
- Admin can copy the link and send it to the user, or the system sends it directly via email.
- **No password visible to admin.** User sets their own new password via the link.

**Fallback (if direct set is needed): Direct password set with guardrails**
- Requires: reason field, typed email confirmation (type the user's email to confirm), second confirmation modal.
- Calls `supabase.auth.admin.updateUserById(userId, { password })`.
- **Revokes all active sessions** for that user after password change.
- Writes to `admin_actions` table with reason + admin email.
- Password is NOT shown in logs or audit table.

**Recommendation:** Build the reset link approach first. Only add direct set if Shaun specifically asks for it.

#### F. Delete account (moved from current page)
- Existing `deleteAccount()` action moves here unchanged.
- Same confirmation flow (type email to confirm, self-protection, storage + auth + company cascade).
- Writes to `admin_actions` table.

#### G. Future: Add/remove users (NOT in this build)
- Listed as "coming soon" on the profile page.
- Multi-user companies are a later feature.

### 3.3 Nav update
- Rename "Delete account" → "Users" in `AdminNav.tsx`.

### 3.4 Server actions file
- New: `app/admin/(dashboard)/users/[userId]/actions.ts` — all server actions for the profile page.
- Modified: `app/admin/(dashboard)/users/actions.ts` — replace `listAccounts()` with server-side paginated `searchUsers(query, limit, offset)`. Keep `lookupAccount`/`deleteAccount`/`deleteAccounts` for reuse.

## 4. Schema Changes

### 4.1 New columns on `companies` (migration `20260630120000`)

```sql
-- Admin override (separate from plan_code so webhook can't break it)
ALTER TABLE companies ADD COLUMN admin_override_plan_code text REFERENCES subscription_plans(code);
ALTER TABLE companies ADD COLUMN admin_override_until timestamptz;
ALTER TABLE companies ADD COLUMN admin_override_notes text;

-- Admin pause (separate from subscription_status so dunning cron doesn't conflict)
ALTER TABLE companies ADD COLUMN admin_paused boolean NOT NULL DEFAULT false;
ALTER TABLE companies ADD COLUMN admin_paused_at timestamptz;
ALTER TABLE companies ADD COLUMN admin_paused_by uuid REFERENCES public.users(id);
ALTER TABLE companies ADD COLUMN admin_pause_reason text;
```

**Note on `comp_until`:** The existing `comp_until` / `comp_notes` columns remain untouched. They still work for legacy comps. New admin overrides use `admin_override_*` columns. The SQL function checks `admin_paused` first, then `admin_override_plan_code`, then the existing `comp_until` logic. No migration of existing comp data needed.

### 4.2 New `admin_actions` table (migration `20260630120000`)

```sql
CREATE TABLE admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES public.users(id),
  target_company_id uuid REFERENCES companies(id),
  target_user_id uuid REFERENCES public.users(id),
  action_type text NOT NULL,  -- 'override_plan', 'change_paid_plan', 'remove_override', 'apply_coupon', 'remove_coupon', 'pause', 'resume', 'password_reset_link', 'direct_password_set', 'delete_account', 'edit_company_name'
  reason text,
  details jsonb,              -- old/new values, coupon id, plan codes, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Admin-only RLS: only is_admin users can read.
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_actions_admin_read ON admin_actions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
  ));
CREATE POLICY admin_actions_admin_write ON admin_actions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
  ));
```

### 4.3 SQL function updates (migration `20260630120000`)

**`company_effective_plan_code()` — updated:**
```sql
CREATE OR REPLACE FUNCTION public.company_effective_plan_code(p_company_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    -- Admin pause: no plan access at all.
    WHEN c.admin_paused = true
      THEN 'free'
    -- Admin override beats everything until admin_override_until.
    WHEN c.admin_override_plan_code IS NOT NULL
         AND c.admin_override_until IS NOT NULL
         AND c.admin_override_until > now()
      THEN c.admin_override_plan_code
    -- Legacy comp_until support (backwards compat).
    WHEN c.comp_until IS NOT NULL AND c.comp_until > now()
      THEN c.plan_code
    -- Trial expired with no Stripe subscription: roll into FREE.
    WHEN c.subscription_status = 'trialing'
         AND c.trial_ends_at IS NOT NULL
         AND c.trial_ends_at < now()
         AND c.stripe_subscription_id IS NULL
      THEN 'free'
    -- Healthy states keep their purchased plan.
    WHEN c.subscription_status IN ('active','trialing','past_due','disputed')
      THEN c.plan_code
    -- Grace / pending_data_purge / cancellation_pending: collapse to starter.
    WHEN c.subscription_status IN ('grace','pending_data_purge','cancellation_pending')
      THEN 'starter'
    -- Suspended / canceled: fully locked elsewhere via _active = false.
    ELSE 'starter'
  END
  FROM public.companies c
  WHERE c.id = p_company_id;
$function$;
```

**`company_effective_plan_active()` — updated:**
```sql
CREATE OR REPLACE FUNCTION public.company_effective_plan_active(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    -- Admin pause: always inactive, beats everything.
    WHEN c.admin_paused = true
      THEN false
    -- Admin override: always active while override is in effect.
    WHEN c.admin_override_plan_code IS NOT NULL
         AND c.admin_override_until IS NOT NULL
         AND c.admin_override_until > now()
      THEN true
    -- Legacy comp_until support.
    WHEN c.comp_until IS NOT NULL AND c.comp_until > now()
      THEN true
    -- Expired trial with no paid Stripe subscription: ACTIVE on FREE.
    WHEN c.subscription_status = 'trialing'
         AND c.trial_ends_at IS NOT NULL
         AND c.trial_ends_at < now()
         AND c.stripe_subscription_id IS NULL
      THEN true
    -- Normal active states + disputed-with-ticket.
    WHEN c.subscription_status IN ('active','trialing','past_due','disputed')
      THEN true
    -- "In trouble but still alive" states: read-only but viewable.
    WHEN c.subscription_status IN ('grace','pending_data_purge','cancellation_pending')
      THEN true
    -- Suspended / canceled: fully locked.
    ELSE false
  END
  FROM public.companies c
  WHERE c.id = p_company_id;
$function$;
```

### 4.4 Webhook handler update

In `app/api/webhooks/stripe/route.ts`, `handleSubscriptionChange()` function:

**Add `admin_paused` to the company select:**
```typescript
.select('id, plan_code, subscription_status, stripe_subscription_id, admin_paused')
```

**Add guard after company lookup, before the plan/status update:**
```typescript
// Gerald audit H-02: skip plan/status mutations while admin_paused.
// Log the event for audit but don't overwrite entitlements.
if (company.admin_paused) {
  const { error: auditErr } = await admin.from('subscription_events').insert({
    company_id: company.id,
    event_type: 'paused_event_logged',
    from_plan_code: company.plan_code,
    to_plan_code: company.plan_code,
    from_status: company.subscription_status,
    to_status: company.subscription_status,
    stripe_event_id: event.id,
    stripe_event_type: event.type,
    stripe_event_created: new Date(event.created * 1000).toISOString(),
    stripe_payload: eventJson as never,
    notes: 'Event received while admin_paused; no mutation applied.',
  });
  if (auditErr) throw retryable(`subscription_events insert (paused): ${auditErr.message}`);
  return 'ok:admin_paused';
}
```

**No guard needed for `admin_override`:** The webhook freely writes `plan_code` (Stripe-owned). `company_effective_plan_code()` returns `admin_override_plan_code` when active, so the override is safe regardless of what the webhook writes to `plan_code`.

**`handleInvoicePaid()` and `handleDispute()`:** Add the same `admin_paused` guard. These handlers also mutate `subscription_status` (e.g. clearing past_due on payment success), and should not do so while paused.

**On resume:** When admin unpauses, we should optionally re-fetch the live Stripe subscription state and sync `plan_code`/`subscription_status` from Stripe. This ensures the DB reflects the latest Stripe state, not the stale state from when pause began. Implementation: in the `resumeAccess()` server action, after clearing `admin_paused`, call `stripe.subscriptions.retrieve(stripe_subscription_id)` and update `plan_code`/`subscription_status`/`current_period_end` from the live Stripe object.

## 5. Security Considerations

1. **All actions gated behind `requireAdmin()`** — existing pattern, no change.
2. **Service-role client** for all DB + Stripe + Auth operations (bypasses RLS). Already the pattern in `actions.ts`.
3. **Self-protection:** Admin cannot pause/delete their own company (existing pattern from delete).
4. **Stripe API keys:** Already configured in Vercel env. `requireStripe()` factory handles mode switching.
5. **Coupon application:** Only affects Stripe subscriptions — no DB write needed. Stripe is the source of truth for discounts. **Per Gerald M-02:** filter coupons to valid + admin-visible only.
6. **Password reset (per Gerald H-03):** Prefer reset link over direct set. If direct set kept, require reason + typed confirmation + session revocation + audit to `admin_actions`.
7. **Audit trail (per Gerald M-03):** Sensitive admin actions go to `admin_actions` (admin-only RLS). Customer-safe billing transitions go to `subscription_events` (customer-visible RLS). Never put admin emails, reasons, or password-reset records in `subscription_events.notes`.
8. **Company name edit (per Gerald L-02):** Max length, trimmed non-empty, reason required, audited in `admin_actions` with old/new values.

## 6. Files to Create/Modify

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260630120000_admin_user_management.sql` | Create | New columns + `admin_actions` table + SQL function updates |
| `app/admin/(dashboard)/users/page.tsx` | Modify | Rename to "Users", add server-side search |
| `app/admin/(dashboard)/users/UsersPanel.tsx` | Create | Client component for search + results list |
| `app/admin/(dashboard)/users/[userId]/page.tsx` | Create | Admin user profile page |
| `app/admin/(dashboard)/users/[userId]/UserProfile.tsx` | Create | Client component for all profile sections |
| `app/admin/(dashboard)/users/[userId]/actions.ts` | Create | Server actions: override plan, change paid plan, apply/remove coupon, pause/resume, password reset, delete account, update company name, search users |
| `app/admin/(dashboard)/users/actions.ts` | Modify | Replace `listAccounts()` with `searchUsers(query, limit, offset)`. Keep `deleteAccount`/`deleteAccounts`. |
| `app/admin/(dashboard)/users/DeleteAccountPanel.tsx` | Delete | Replaced by UsersPanel + profile page |
| `app/admin/(dashboard)/AdminNav.tsx` | Modify | Rename "Delete account" → "Users" |
| `app/api/webhooks/stripe/route.ts` | Modify | Add `admin_paused` guard in `handleSubscriptionChange`, `handleInvoicePaid`, `handleDispute` |
| `app/lib/billing/entitlements.ts` | Modify | Add `admin_paused` / `admin_override_*` to company select in `getEntitlements()` |
| `app/lib/supabase/database.types.ts` | Regenerate | After migration applied |

## 7. Answers to Gerald's Questions (from v1 brief)

1. **Pause approach:** Option B, implemented fully. `admin_paused` boolean + `admin_paused_at` + `admin_paused_by` + `admin_pause_reason`. SQL function checks `admin_paused` FIRST. Webhooks skip status/plan mutations while paused. Resume clears `admin_paused` and re-syncs from Stripe.

2. **Webhook override safety:** No, `comp_until` was not sufficient (Gerald H-01 confirmed). Fix: separate `admin_override_plan_code` column. Webhook writes `plan_code` (Stripe-owned), SQL function returns `admin_override_plan_code` when active. Full decoupling.

3. **Stripe subscription swap:** Update local DB from the successful Stripe response in the same action (belt-and-braces). Don't wait for webhook. Clear admin override only after Stripe success. Show "syncing" state if needed.

4. **Coupon listing:** Filter to `valid === true`, `metadata.quotecore_admin_visible === 'true'`, expected duration. Show `duration`, `percent_off`. Per Gerald M-02.

5. **Audit trail:** `subscription_events` for customer-safe billing transitions only. New `admin_actions` table for sensitive admin operations (password reset, pause reason, coupon applied/removed, company name edit, delete account). Per Gerald M-03.

6. **Company name edit:** Allowed with max length, trimmed non-empty, reason required, audited in `admin_actions` with old/new values. Per Gerald L-02.

## 8. Build Order (after Gerald sign-off)

1. **Migration** — new columns, `admin_actions` table, SQL function updates
2. **Apply migration** to Supabase + regenerate types
3. **Webhook handler update** — add `admin_paused` guard
4. **Entitlements update** — add new columns to company select
5. **Server actions** (`[userId]/actions.ts`) — all operations
6. **User profile page + client component** (`[userId]/page.tsx` + `UserProfile.tsx`)
7. **Users list page rewrite** (`UsersPanel.tsx`, rename nav, server-side search)
8. **Build verification** (`next build`)
9. **Create Stripe coupons** (manual or script, with `metadata.quotecore_admin_visible`)
10. **Smoke test on dev**

## 9. Out of Scope (future work)

- Multi-user company management (add/remove users per company) — listed as "coming soon"
- Custom per-user pricing (not needed — coupons achieve the same result)
- Admin dashboard metrics (user count, MRR, churn) — separate feature
- Bulk admin operations (batch pause, batch coupon) — add later if needed
