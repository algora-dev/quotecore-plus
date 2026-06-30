# Gerald Brief v3: Admin User Management & Subscription Control

**Date:** 2026-06-30 (v3 revision)
**Scope:** New `/admin/users` page (replaces "Delete account"), per-user admin profile page, subscription tier overrides, Stripe coupon discounts, account pause, password reset.
**Bundle HEAD:** `131ef4f` (current `development`)
**Author:** Gavin
**Supersedes:** `GERALD-BRIEF-2026-06-30-ADMIN-USER-MANAGEMENT-V2.md` (v2)
**Incorporates:** All findings from Gerald v2 audit `quotecore-plus-admin-user-management-v2-2026-06-30/04-report.md`

---

## 1. Goal

Give Shaun full control over any user's subscription from the admin dashboard. Use cases: support overrides, payment-issue fixes, comping frustrated customers, applying discounts, pausing access.

**Design principle:** `companies.plan_code` is Stripe-owned — the webhook writes to it. Admin overrides use SEPARATE columns (`admin_override_plan_code`, `admin_override_until`, `admin_override_notes`) so they are fully decoupled from Stripe. The SQL function `company_effective_plan_code()` returns the admin override when active, otherwise the Stripe-driven `plan_code`.

## 2. Current State (what already exists)

### 2.1 Admin area
- `/admin/login` — email/password login, checks `users.is_admin = true`
- `/admin` — dashboard with counters
- `/admin/admins` — admin account management (shipped `bd523a8`)
- `/admin/users` — currently "Delete Account" page (search + wipe tenant). **This will be renamed and extended.**
- `/admin/support-tickets`, `/admin/suppressions` — existing tools

### 2.2 Subscription system
- `companies.plan_code` — purchased plan. **Webhook-owned.**
- `companies.subscription_status` — lifecycle status. **Webhook-owned.**
- `companies.comp_until` (timestamptz, nullable) — existing comp mechanism. Remains for legacy comps; new admin overrides use `admin_override_*` columns.
- `companies.comp_notes` (text, nullable) — existing.
- `subscription_plans` table — 10 plan codes, 4 active with Stripe prices (starter $19, growth $29 inactive, pro $39, pro_plus $59)
- `company_effective_plan_code(uuid)` SQL function — **will be updated.**
- `company_effective_plan_active(uuid)` — **will be updated.**
- Stripe webhook at `/api/webhooks/stripe/route.ts` — **will be updated** with `admin_paused` guard.

### 2.3 Stripe setup
- `STRIPE_MODE` env var (`test` | `live`)
- `app/lib/billing/stripe.ts` — SDK factory, `resolvePlanCodeForStripePrice()`, `resolveStripePriceForPlan()`, `priceIdColumn()`
- Live + test Price IDs configured for starter/pro/pro_plus (growth inactive)
- Stripe webhook secret configured on both Vercel projects

### 2.4 Existing `subscription_events` table
- Has `actor_user_id` and `notes` columns.
- **RLS allows company users to SELECT their own rows** (billing transparency).
- **Per Gerald v2 M-03:** Do NOT put admin-internal details here. Use `admin_actions` for sensitive audit.

## 3. Proposed Changes

### 3.1 Rename "Delete account" → "Users"

- **`/admin/users`** becomes the user search & management page.
- **Server-side paginated search** — `searchUsers(query, limit, offset)` server action. Searches email first (exact + ilike), then company name, then user full name. Returns only matching rows for the current page. Not a 500-row client filter.
- Click a user row → navigates to `/admin/users/[userId]` (admin profile page).
- Delete account functionality moves into the admin profile page.

### 3.2 New page: `/admin/users/[userId]` — Admin User Profile

#### A. Company info
- Company name (editable, with reason field)
- Company slug, plan code, subscription status, Stripe IDs, current period end, storage, created date (read-only)

**Company name edit (per Gerald v1 L-02):**
- Max length enforced, trimmed, non-empty.
- Requires a "reason" text field.
- Writes to `admin_actions` with old/new values + reason + snapshots.
- Updates `companies.name` directly.

#### B. Subscription tier control
Dropdown of active plan codes (`free`, `starter`, `pro`, `pro_plus`) + action buttons. Three modes:

**Mode 1: Admin override (no Stripe charge)**
- Sets `admin_override_plan_code`, `admin_override_until = '9999-12-31'`, `admin_override_notes`.
- Does NOT touch `plan_code` or `subscription_status` (Stripe-owned).
- Does NOT touch Stripe.
- `company_effective_plan_code()` returns `admin_override_plan_code` when active.
- **Reason field required.**
- Writes to `admin_actions`.
- **Webhook safety:** Webhook writes `plan_code` (Stripe-owned), NOT `admin_override_plan_code`. Override is untouched. **Core decoupling confirmed safe by Gerald.**

**Mode 2: Change paid plan (Stripe sync)**
- Only available if company has `stripe_subscription_id`.
- **Sequence (per Gerald v2 M-01):**
  1. Validate target plan has Stripe price for current mode.
  2. Call Stripe: `stripe.subscriptions.update(sub_id, { items: [{ id: current_item_id, price: new_price_id }], proration_behavior: 'create_prorations' })`.
  3. **After Stripe success:** Update local DB from returned Stripe subscription (same allowlist as webhook: `plan_code`, `subscription_status`, `stripe_price_id`, `current_period_end`, `cancel_at_period_end`, `cancel_at`, `trial_ends_at`).
  4. **After Stripe success:** If admin override was active, clear it (`admin_override_plan_code = null`, `admin_override_until = null`, `admin_override_notes = null`).
  5. If Stripe fails, return error. No DB mutation, no override cleared.
- Writes to `admin_actions`.

**Mode 3: Remove admin override (reconnect to Stripe)**
- Clears `admin_override_plan_code`, `admin_override_until`, `admin_override_notes`.
- Effective plan reverts to `plan_code` + `subscription_status` (Stripe-owned).
- Writes to `admin_actions`.
- **Reason field required.**

#### C. Discount / coupon control (per Gerald v2 M-01, M-02)

- Dropdown of available Stripe coupons.
- **Per Gerald v2 M-02:** Fetch via `stripe.coupons.list({ limit: 100 })` (NOT `{ active: true }` — that filter doesn't exist). Filter in code: `coupon.valid === true`, `metadata.quotecore_admin_visible === 'true'`, expected duration (`forever` or explicitly allowed `once`), expected `percent_off` set. Display `duration`, `percent_off`, redemption limits.
- Shows currently applied coupon if any (read from `stripe.subscriptions.retrieve(sub_id).discounts`).
- **Apply coupon:** `stripe.subscriptions.update(sub_id, { discounts: [{ coupon: couponId }] })`.
- **Remove coupon (per Gerald v2 M-01):** `stripe.subscriptions.update(sub_id, { discounts: '' })` — **empty STRING, not empty array.** Empty array leaves discounts unchanged; empty string clears them.
- Only available if company has `stripe_subscription_id`.
- Writes to `admin_actions` (coupon applied/removed, with reason).

**Coupons to create in Stripe upfront (manual or script, with `metadata.quotecore_admin_visible: 'true'`):**
- 25% off forever
- 50% off forever
- 75% off forever
- 100% off forever
- 50% off once (one-time goodwill)

#### D. Pause / suspend access (per Gerald v1 H-02, v2 M-03, v2 M-04)

- Button: "Pause access" — sets `admin_paused = true`, `admin_paused_at = now()`, `admin_paused_by = <admin user id>`, `admin_pause_reason = '<reason>'`.
- **`company_effective_plan_active()` returns `false` when `admin_paused = true`** — checked FIRST. User is locked out.
- Does NOT cancel Stripe subscription.
- Does NOT touch `subscription_status` (dunning cron and webhook still see real billing state).
- **Reason field required.**
- Writes to `admin_actions`.

**Resume access (per Gerald v2 M-04 — MANDATORY Stripe sync):**
- **Resume is atomic. Must re-sync from Stripe before clearing `admin_paused`.**
- Sequence:
  1. If `stripe_subscription_id` exists: call `stripe.subscriptions.retrieve(stripe_subscription_id)`.
  2. Resolve price through same allowlist as webhook (`resolvePlanCodeForStripePrice`).
  3. Update `plan_code`, `subscription_status`, `stripe_price_id`, `current_period_end`, `cancel_at_period_end`, `cancel_at` from live Stripe object.
  4. If no subscription exists or Stripe says canceled: set `subscription_status = 'canceled'`, `plan_code = 'free'`.
  5. **Only after DB sync completes:** clear `admin_paused`, `admin_paused_at`, `admin_paused_by`, `admin_pause_reason`.
  6. Write to `admin_actions`.
- **If Stripe API call fails during resume:** Return error. Do NOT clear `admin_paused`. User stays paused until Stripe is reachable. This is safer than unpausing with stale state.

**Webhook guard (per Gerald v2 M-03 — skip access mutation ONLY, not audit/support):**

In `handleSubscriptionChange()`:
```typescript
if (company.admin_paused) {
  // Log the event for audit but don't mutate plan_code or subscription_status.
  await admin.from('subscription_events').insert({
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
  return 'ok:admin_paused';
}
```

In `handleInvoicePaid()`:
- Same guard: log event, skip `subscription_status` mutation (e.g. don't clear `past_due`/`first_payment_failure_at`).

In `handleDispute()` (per Gerald v2 M-03 — CRITICAL):
- **Dispute support tickets MUST still be created.** The guard skips `subscription_status` mutation only.
- `charge.dispute.created`: Still create the high-priority support ticket. Still write `subscription_events` row. Still write `payment_dispute` row. Do NOT set `subscription_status = 'disputed'`.
- `charge.dispute.closed`: Still update `payment_dispute` row (won/lost). Still write `subscription_events` row. Do NOT set `subscription_status = 'active'` or `'suspended'`.
- This ensures chargebacks are never silently swallowed while paused.

**No guard needed for `admin_override`:** Webhook freely writes `plan_code`. `company_effective_plan_code()` returns `admin_override_plan_code` when active. Safe.

#### E. Password reset (per Gerald v1 H-03)

**Preferred: Send password reset link** (not direct password set).
- Button: "Send password reset link" — calls `supabase.auth.admin.generateLink('recovery', userEmail)`.
- Returns the link for admin to copy/send, or system sends directly via email.
- **No password visible to admin.** User sets their own new password via the link.
- Writes to `admin_actions` (action_type = 'password_reset_link').

**Fallback (only if Shaun explicitly asks): Direct password set with guardrails**
- Requires: reason field, typed email confirmation, second confirmation modal.
- Calls `supabase.auth.admin.updateUserById(userId, { password })`.
- **Revokes all active sessions** for that user after password change.
- Writes to `admin_actions` (action_type = 'direct_password_set').
- Password is NOT shown in logs or audit table.

#### F. Delete account (moved from current page)
- Existing `deleteAccount()` action moves here.
- Same confirmation flow (type email to confirm, self-protection, storage + auth + company cascade).
- **Per Gerald v2 H-01:** Write `admin_actions` row with snapshot fields BEFORE deletion. FKs use `ON DELETE SET NULL` so deletion is not blocked.
- Writes to `admin_actions` (action_type = 'delete_account', with target snapshots).

#### G. Future: Add/remove users (NOT in this build)
- Listed as "coming soon" on the profile page.

### 3.3 Nav update
- Rename "Delete account" → "Users" in `AdminNav.tsx`.

### 3.4 Server actions file
- New: `app/admin/(dashboard)/users/[userId]/actions.ts` — all server actions for the profile page.
- Modified: `app/admin/(dashboard)/users/actions.ts` — replace `listAccounts()` with `searchUsers(query, limit, offset)`. Keep `deleteAccount`/`deleteAccounts`.

## 4. Schema Changes

### 4.1 New columns on `companies` (migration `20260630163000`)

**Per Gerald v2 M-05:** Migration timestamp is `20260630163000` (not `20260630120000` which collides with touch-support plan).

```sql
-- Admin override (separate from plan_code so webhook can't break it)
ALTER TABLE companies ADD COLUMN admin_override_plan_code text REFERENCES subscription_plans(code);
ALTER TABLE companies ADD COLUMN admin_override_until timestamptz;
ALTER TABLE companies ADD COLUMN admin_override_notes text;

-- Admin pause (separate from subscription_status so dunning cron doesn't conflict)
ALTER TABLE companies ADD COLUMN admin_paused boolean NOT NULL DEFAULT false;
ALTER TABLE companies ADD COLUMN admin_paused_at timestamptz;
ALTER TABLE companies ADD COLUMN admin_paused_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE companies ADD COLUMN admin_pause_reason text;
```

**Note on `comp_until`:** Existing `comp_until` / `comp_notes` columns remain untouched. The SQL function checks `admin_paused` first, then `admin_override_plan_code`, then existing `comp_until` logic. No migration of existing comp data needed.

### 4.2 New `admin_actions` table (per Gerald v2 H-01, L-02)

**Per Gerald v2 H-01:** All FKs use `ON DELETE SET NULL` so audit rows don't block account deletion. Immutable snapshot fields preserve audit info after the referenced rows are deleted.

**Per Gerald v2 L-02:** No client insert policy. All writes via service-role server actions only. Remove the `WITH CHECK` insert policy entirely — RLS SELECT-only for admins.

```sql
CREATE TABLE admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  target_company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- Immutable snapshots (survive deletion of referenced rows, per Gerald v2 H-01)
  admin_email_snapshot text NOT NULL,
  target_user_email_snapshot text,
  target_company_name_snapshot text,
  action_type text NOT NULL,
  -- 'override_plan', 'change_paid_plan', 'remove_override', 'apply_coupon',
  -- 'remove_coupon', 'pause', 'resume', 'password_reset_link',
  -- 'direct_password_set', 'delete_account', 'edit_company_name'
  reason text,
  details jsonb,  -- old/new values, coupon id, plan codes, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: admin-only SELECT. No client INSERT (all writes via service role).
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_actions_admin_read ON admin_actions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
  ));
-- No INSERT policy: service-role client bypasses RLS for all writes.
```

### 4.3 SQL function updates (migration `20260630163000`)

**`company_effective_plan_code()` — updated (per Gerald v2 L-01):**

Per Gerald v2 L-01: returning `'free'` while paused may confuse UI display. Fix: return the underlying `plan_code` while paused (so display shows what they'll return to), and let `company_effective_plan_active() = false` be the real access lock. The UI will check `admin_paused` flag separately for display.

```sql
CREATE OR REPLACE FUNCTION public.company_effective_plan_code(p_company_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    -- Admin override beats everything until admin_override_until.
    -- (admin_paused does NOT change plan_code display — access is locked
    -- separately by company_effective_plan_active() returning false.)
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

**Key change from v2 (per Gerald v2 L-01):** `company_effective_plan_code()` no longer returns `'free'` when paused. It returns the underlying plan (override or Stripe-owned). Access is locked solely by `company_effective_plan_active() = false`. The UI reads `admin_paused` flag directly for display ("Paused" badge).

### 4.4 Webhook handler update

In `app/api/webhooks/stripe/route.ts`:

**Add `admin_paused` to the company select** in `handleSubscriptionChange()`, `handleInvoicePaid()`, and `handleDispute()`:
```typescript
.select('id, plan_code, subscription_status, stripe_subscription_id, admin_paused')
```

**`handleSubscriptionChange()` guard (after company lookup, before plan/status update):**
```typescript
if (company.admin_paused) {
  // Log the event but don't mutate plan_code or subscription_status.
  await admin.from('subscription_events').insert({
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
  return 'ok:admin_paused';
}
```

**`handleInvoicePaid()` guard:** Same pattern — log event, skip `subscription_status` / `first_payment_failure_at` / `dunning_stage_entered_at` mutations.

**`handleDispute()` guard (per Gerald v2 M-03 — CRITICAL):**
- `charge.dispute.created`: Still create high-priority support ticket. Still write `subscription_events` row. Still write `payment_dispute` row. **Do NOT set `subscription_status = 'disputed'`.**
- `charge.dispute.closed`: Still update `payment_dispute` row (won/lost). Still write `subscription_events` row. **Do NOT set `subscription_status` to `'active'` or `'suspended'`.**
- Chargebacks are never silently swallowed while paused.

**No guard needed for `admin_override`:** Webhook freely writes `plan_code`. `company_effective_plan_code()` returns `admin_override_plan_code` when active. Safe.

## 5. Security Considerations

1. **All actions gated behind `requireAdmin()`** — existing pattern.
2. **Service-role client** for all DB + Stripe + Auth operations.
3. **Self-protection:** Admin cannot pause/delete their own company.
4. **Stripe API keys:** Already configured. `requireStripe()` factory handles mode.
5. **Coupon application (per Gerald v2 M-01, M-02):** Use `discounts: [{ coupon: id }]` to apply, `discounts: ''` to clear. Fetch coupons via `stripe.coupons.list({ limit: 100 })` then filter in code: `valid === true`, `metadata.quotecore_admin_visible === 'true'`.
6. **Password reset:** Prefer reset link. Direct set requires reason + typed confirmation + session revocation.
7. **Audit trail (per Gerald v2 M-03, H-01, L-02):** `admin_actions` for sensitive ops (admin-only SELECT RLS, no client INSERT, FKs `ON DELETE SET NULL`, immutable snapshot fields). `subscription_events` for customer-safe billing transitions only.
8. **Company name edit:** Max length, trimmed, reason required, audited with old/new + snapshots.
9. **Resume from pause (per Gerald v2 M-04):** MANDATORY Stripe sync before clearing `admin_paused`. If Stripe unreachable, stay paused.

## 6. Files to Create/Modify

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260630163000_admin_user_management.sql` | Create | New columns + `admin_actions` table + SQL function updates |
| `app/admin/(dashboard)/users/page.tsx` | Modify | Rename to "Users", server-side search |
| `app/admin/(dashboard)/users/UsersPanel.tsx` | Create | Client component for search + results list |
| `app/admin/(dashboard)/users/[userId]/page.tsx` | Create | Admin user profile page |
| `app/admin/(dashboard)/users/[userId]/UserProfile.tsx` | Create | Client component for all profile sections |
| `app/admin/(dashboard)/users/[userId]/actions.ts` | Create | Server actions: search, override plan, change paid plan, apply/remove coupon, pause/resume, password reset, delete account, update company name |
| `app/admin/(dashboard)/users/actions.ts` | Modify | Replace `listAccounts()` with `searchUsers()`. Keep `deleteAccount`/`deleteAccounts`. |
| `app/admin/(dashboard)/users/DeleteAccountPanel.tsx` | Delete | Replaced by UsersPanel + profile page |
| `app/admin/(dashboard)/AdminNav.tsx` | Modify | Rename "Delete account" → "Users" |
| `app/api/webhooks/stripe/route.ts` | Modify | `admin_paused` guard in `handleSubscriptionChange`, `handleInvoicePaid`, `handleDispute` (skip access mutation only, still create dispute tickets) |
| `app/lib/billing/entitlements.ts` | Modify | Add `admin_paused` / `admin_override_*` to company select in `getEntitlements()` |
| `app/lib/supabase/database.types.ts` | Regenerate | After migration applied |

## 7. Summary of v2 → v3 Changes (Gerald v2 audit findings)

| Finding | Fix in v3 |
|---|---|
| **H-01** `admin_actions` FKs block deletion | All FKs `ON DELETE SET NULL` + immutable snapshot fields (`admin_email_snapshot`, `target_user_email_snapshot`, `target_company_name_snapshot`). `admin_user_id` nullable. |
| **M-01** Coupon removal wrong param | `discounts: ''` (empty string) not `discounts: []` (empty array). |
| **M-02** Coupon list filter invalid | `stripe.coupons.list({ limit: 100 })` then filter in code. No `{ active: true }`. |
| **M-03** Pause suppresses disputes | Dispute handler still creates support tickets + `payment_dispute` rows + `subscription_events`. Only skips `subscription_status` mutation. |
| **M-04** Resume sync optional | Resume is atomic: retrieve live Stripe subscription → update DB → clear `admin_paused`. If Stripe fails, stay paused. |
| **M-05** Migration timestamp collision | `20260630163000` (not `20260630120000`). |
| **L-01** Paused plan_code confusing | `company_effective_plan_code()` returns underlying plan (not `'free'`) while paused. Access locked by `_active = false`. UI reads `admin_paused` flag for display. |
| **L-02** `admin_actions` insert spoofing | No client INSERT policy. All writes via service-role server actions only. |

## 8. Build Order (after Gerald sign-off)

1. **Migration** `20260630163000` — new columns, `admin_actions` table, SQL function updates
2. **Apply migration** to Supabase + regenerate types
3. **Webhook handler update** — `admin_paused` guard (access mutation only, disputes still create tickets)
4. **Entitlements update** — add new columns to company select
5. **Server actions** (`[userId]/actions.ts`) — all operations
6. **User profile page + client component** (`[userId]/page.tsx` + `UserProfile.tsx`)
7. **Users list page rewrite** (`UsersPanel.tsx`, rename nav, server-side search)
8. **Build verification** (`next build`)
9. **Create Stripe coupons** (script with `metadata.quotecore_admin_visible`)
10. **Smoke test on dev**

## 9. Out of Scope (future work)

- Multi-user company management (add/remove users per company) — "coming soon"
- Custom per-user pricing (coupons achieve the same result)
- Admin dashboard metrics (user count, MRR, churn) — separate feature
- Bulk admin operations (batch pause, batch coupon) — add later if needed
