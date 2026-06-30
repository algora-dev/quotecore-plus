# BUILD PLAN: Admin User Management & Subscription Control

**Date:** 2026-06-30
**Status:** Ready to build (Gerald v3 audit cleared with minor tightening notes incorporated below)
**Bundle HEAD at planning:** `400872f` (development branch)
**Gerald audit reports:**
- v1: `workspace-gerald/audits/quotecore-plus-admin-user-management-2026-06-30/04-report.md`
- v2: `workspace-gerald/audits/quotecore-plus-admin-user-management-v2-2026-06-30/04-report.md`
- v3: `workspace-gerald/audits/quotecore-plus-admin-user-management-v3-2026-06-30/04-report.md`
**Design briefs:** `docs/audits/GERALD-BRIEF-2026-06-30-ADMIN-USER-MANAGEMENT-V3.md` (supersedes v1, v2)

---

## 0. What We're Building

Full admin control over any user's subscription from the admin dashboard. A new `/admin/users` page (replacing "Delete account") with server-side search, and a per-user profile page at `/admin/users/[userId]` where Shaun can:

- View/edit company info (name, plan, status, Stripe IDs, storage)
- Override subscription tier (free comp to any plan — no Stripe charge)
- Change paid plan (swap Stripe subscription price)
- Apply/remove Stripe discount coupons
- Pause/resume access (lock user out without cancelling Stripe)
- Send password reset email
- Delete account (moved from current page)

**Core design principle:** `companies.plan_code` is Stripe-owned (webhook writes it). Admin overrides use separate `admin_override_plan_code` / `admin_override_until` / `admin_override_notes` columns. SQL function `company_effective_plan_code()` returns the override when active. Full decoupling — webhook can never break an admin override.

---

## 1. Gerald v3 Audit Tightening (incorporated into this plan)

The v3 brief was cleared by Gerald with 4 minor items to tighten. These are all incorporated below:

| Gerald v3 Finding | Fix |
|---|---|
| **H-01** Recovery link is a bearer token if shown to admin | Send reset email directly via Supabase mailer. Never return the URL to the browser. Only return success/failure. |
| **M-01** Plan references nonexistent `payment_dispute` table | Disputes use `support_tickets` with `category='payment_dispute'`. No separate table. Fixed all references. |
| **M-02** Pause/webhook guard missing `handleInvoiceFailed()` | All billing handlers get the guard. Explicit decision: **Option A** — while `admin_paused`, ALL billing webhooks log events but skip ALL local mutations (plan_code, subscription_status, timers). Resume does mandatory full Stripe reconciliation. |
| **M-03** Raw Stripe payload in `subscription_events` for paused events | Store only: event id, event type, from/to plan/status (unchanged), concise note. No `stripe_payload` for paused-event logs. |
| **L-01** Entitlements interface needs explicit fields | Add `adminPaused`, `adminOverridePlanCode`, `adminOverrideUntil` to `CompanyEntitlements` interface. |

---

## 2. Schema Changes

### Migration: `supabase/migrations/20260630163000_admin_user_management.sql`

#### 2.1 New columns on `companies`

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

Existing `comp_until` / `comp_notes` remain untouched. SQL function checks `admin_paused` first (in `_active`), then `admin_override_plan_code`, then existing `comp_until` logic.

#### 2.2 New `admin_actions` table

All FKs `ON DELETE SET NULL` so audit rows don't block account deletion. Immutable snapshot fields survive deletion. No client INSERT policy — service-role writes only.

```sql
CREATE TABLE admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  target_company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  admin_email_snapshot text NOT NULL,
  target_user_email_snapshot text,
  target_company_name_snapshot text,
  action_type text NOT NULL,
  reason text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_actions_admin_read ON admin_actions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
  ));
-- No INSERT policy: service-role client bypasses RLS for all writes.
```

#### 2.3 SQL function: `company_effective_plan_code()` — updated

Does NOT return `'free'` when paused (per Gerald v2 L-01). Returns underlying plan. Access lock lives in `_active`.

```sql
CREATE OR REPLACE FUNCTION public.company_effective_plan_code(p_company_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN c.admin_override_plan_code IS NOT NULL
         AND c.admin_override_until IS NOT NULL
         AND c.admin_override_until > now()
      THEN c.admin_override_plan_code
    WHEN c.comp_until IS NOT NULL AND c.comp_until > now()
      THEN c.plan_code
    WHEN c.subscription_status = 'trialing'
         AND c.trial_ends_at IS NOT NULL
         AND c.trial_ends_at < now()
         AND c.stripe_subscription_id IS NULL
      THEN 'free'
    WHEN c.subscription_status IN ('active','trialing','past_due','disputed')
      THEN c.plan_code
    WHEN c.subscription_status IN ('grace','pending_data_purge','cancellation_pending')
      THEN 'starter'
    ELSE 'starter'
  END
  FROM public.companies c
  WHERE c.id = p_company_id;
$function$;
```

#### 2.4 SQL function: `company_effective_plan_active()` — updated

`admin_paused` checked FIRST. Returns `false` when paused, before any other logic.

```sql
CREATE OR REPLACE FUNCTION public.company_effective_plan_active(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN c.admin_paused = true
      THEN false
    WHEN c.admin_override_plan_code IS NOT NULL
         AND c.admin_override_until IS NOT NULL
         AND c.admin_override_until > now()
      THEN true
    WHEN c.comp_until IS NOT NULL AND c.comp_until > now()
      THEN true
    WHEN c.subscription_status = 'trialing'
         AND c.trial_ends_at IS NOT NULL
         AND c.trial_ends_at < now()
         AND c.stripe_subscription_id IS NULL
      THEN true
    WHEN c.subscription_status IN ('active','trialing','past_due','disputed')
      THEN true
    WHEN c.subscription_status IN ('grace','pending_data_purge','cancellation_pending')
      THEN true
    ELSE false
  END
  FROM public.companies c
  WHERE c.id = p_company_id;
$function$;
```

---

## 3. Webhook Handler Update

**File:** `app/api/webhooks/stripe/route.ts`

**Decision (per Gerald v3 M-02): Option A** — while `admin_paused`, ALL billing webhooks log events but skip ALL local mutations (`plan_code`, `subscription_status`, `first_payment_failure_at`, `dunning_stage_entered_at`). Resume performs mandatory full Stripe reconciliation.

### 3.1 Handlers that get the `admin_paused` guard

All four billing handlers. Add `admin_paused` to the company `.select()` in each, then add the guard after company lookup.

**`handleSubscriptionEvent()` (line ~330):**
```typescript
.select('id, plan_code, subscription_status, stripe_subscription_id, admin_paused')
// ...after company lookup:
if (company.admin_paused) {
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
    notes: 'Event received while admin_paused; no mutation applied.',
  });
  return 'ok:admin_paused';
}
```
**Note (per Gerald v3 M-03):** Do NOT include `stripe_payload` in paused-event log rows. Store only event id, type, from/to state, concise note.

**`handleInvoicePaid()` (line ~483):**
Same guard pattern. Skip `subscription_status` / `first_payment_failure_at` / `dunning_stage_entered_at` mutations. Log event.

**`handleInvoiceFailed()` (line ~542):**
Same guard pattern. Skip `subscription_status = 'past_due'`, `first_payment_failure_at`, `dunning_stage_entered_at` mutations. Log event.

**`handleDisputeCreated()` (line ~594) — CRITICAL (per Gerald v2 M-03):**
- **Still create the `support_tickets` row** (category='payment_dispute', high priority, 48h auto-close).
- **Still write `subscription_events`** row (event_type='dispute_opened').
- **Do NOT set `subscription_status = 'disputed'`.**
- Chargebacks are never silently swallowed while paused.

**`handleDisputeClosed()` (line ~669):**
- **Still update the `support_tickets` row** (mark won/lost).
- **Still write `subscription_events`** row.
- **Do NOT set `subscription_status` to `'active'` or `'suspended'`.**

### 3.2 No guard for `admin_override`

Webhook freely writes `plan_code`. `company_effective_plan_code()` returns `admin_override_plan_code` when active. Safe.

### 3.3 `handleCheckoutCompleted()` (line ~292)

This handler writes `stripe_customer_id` / `stripe_subscription_id` to the company row on first checkout. It does NOT mutate `plan_code` or `subscription_status` (those come from the subsequent `customer.subscription.created` event). **No guard needed** — even if paused, we want to record the Stripe IDs. The subsequent subscription event will be guarded.

---

## 4. Entitlements Update

**File:** `app/lib/billing/entitlements.ts`

### 4.1 Add fields to `CompanyEntitlements` interface (per Gerald v3 L-01)

```typescript
// Add after compUntil:
adminPaused: boolean;
adminOverridePlanCode: string | null;
adminOverrideUntil: string | null;
```

### 4.2 Add to `EntitlementRowRaw` interface

```typescript
// Add to the raw row interface:
admin_paused: boolean;
admin_override_plan_code: string | null;
admin_override_until: string | null;
```

### 4.3 Update `loadCompanyEntitlements()`

Add the three new columns to the `.select()` query. Map them to the entitlements result:

```typescript
adminPaused: company.admin_paused,
adminOverridePlanCode: company.admin_override_plan_code,
adminOverrideUntil: company.admin_override_until,
```

---

## 5. Server Actions

### 5.1 `app/admin/(dashboard)/users/actions.ts` (modify)

Replace `listAccounts()` with server-side paginated search:

```typescript
export async function searchUsers(query: string, limit: number = 20, offset: number = 0): Promise<SearchResult>
```

- Search by email (ilike), then company name (ilike), then user full_name (ilike).
- Return `{ users: [{ id, email, fullName, companyId, companyName, planCode, subscriptionStatus, adminPaused }] }`.
- Keep existing `deleteAccount()` and `deleteAccounts()` — they move to the profile page but stay importable from here.

### 5.2 `app/admin/(dashboard)/users/[userId]/actions.ts` (new)

All actions gated behind `requireAdmin()`. Use service-role client. Write to `admin_actions` with snapshots.

**Actions:**

| Function | What it does |
|---|---|
| `getUserProfile(userId)` | Load user + company + subscription details for the profile page |
| `updateCompanyName(companyId, newName, reason)` | Update `companies.name`, audit to `admin_actions` |
| `adminOverridePlan(companyId, planCode, reason)` | Set `admin_override_plan_code/until/notes`, audit |
| `changePaidPlan(companyId, targetPlanCode)` | Stripe swap → update DB from response → clear override if active, audit |
| `removeOverride(companyId, reason)` | Clear `admin_override_*`, audit |
| `listAvailableCoupons()` | `stripe.coupons.list({ limit: 100 })` → filter in code: `valid === true`, `metadata.quotecore_admin_visible === 'true'` |
| `getCurrentCoupon(companyId)` | `stripe.subscriptions.retrieve(sub_id)` → read `discounts` |
| `applyCoupon(companyId, couponId, reason)` | `stripe.subscriptions.update(sub_id, { discounts: [{ coupon: couponId }] })`, audit |
| `removeCoupon(companyId, reason)` | `stripe.subscriptions.update(sub_id, { discounts: '' })`, audit |
| `pauseAccess(companyId, reason)` | Set `admin_paused=true/at/by/reason`, audit |
| `resumeAccess(companyId)` | Mandatory: `stripe.subscriptions.retrieve` → update DB → clear `admin_paused`, audit. If Stripe fails, stay paused. |
| `sendPasswordReset(userId)` | `supabase.auth.admin.generateLink('recovery', email)` → send via Supabase mailer. **Never return URL to client.** Return only success/failure. Audit. |
| `deleteAccount(companyId, confirmEmail)` | Existing logic. Write `admin_actions` row with snapshots BEFORE deletion. FKs `ON DELETE SET NULL` so deletion won't block. |

---

## 6. UI Components

### 6.1 `app/admin/(dashboard)/users/page.tsx` (modify)

- Rename page heading from "Delete account" to "Users".
- Server component that renders `UsersPanel`.

### 6.2 `app/admin/(dashboard)/users/UsersPanel.tsx` (new, replaces `DeleteAccountPanel.tsx`)

- Search input (email, name, or company name).
- Calls `searchUsers(query, limit, offset)` server action.
- Results table: email, name, company, plan badge, status badge, "Paused" badge if `adminPaused`.
- Click row → `router.push(/admin/users/${userId})`.
- Pagination controls (load more / next page).

### 6.3 `app/admin/(dashboard)/users/[userId]/page.tsx` (new)

- Server component. Calls `getUserProfile(userId)` server action.
- Renders `UserProfile` client component with the data.

### 6.4 `app/admin/(dashboard)/users/[userId]/UserProfile.tsx` (new)

Client component with sections:

**A. Company Info**
- Company name (editable inline with reason modal)
- Read-only: slug, plan code, subscription status badge, Stripe customer/subscription IDs (with dashboard links), current period end, storage used/limit, created date
- "Paused" badge if `admin_paused`
- "Admin Override" badge if override active

**B. Subscription Tier**
- Dropdown: free, starter, pro, pro_plus
- Three buttons: "Override (free)", "Change paid plan", "Remove override"
- Each opens a confirmation modal with reason field
- "Change paid plan" only enabled if `stripe_subscription_id` exists
- "Remove override" only enabled if override active

**C. Discount / Coupon**
- Shows current coupon (if any) with percent off + duration
- Dropdown of available coupons (filtered from `listAvailableCoupons()`)
- "Apply coupon" + "Remove coupon" buttons
- Only enabled if `stripe_subscription_id` exists

**D. Access Control**
- "Pause access" button (with reason modal) — sets `admin_paused`
- "Resume access" button — only visible if paused
- Warning text: "Pausing locks the user out of the app but does not cancel their Stripe subscription."

**E. Password Reset**
- "Send password reset email" button
- Confirmation modal explaining: "This sends a password reset email to {user email}. They will set their own new password."
- On success: "Reset email sent to {email}."

**F. Delete Account** (moved from current page)
- Same flow: type email to confirm, self-protection, cascade delete.
- Button at the bottom in a danger zone section.

**G. Add/Remove Users — Coming Soon**
- Static "Coming soon" placeholder.

### 6.5 `app/admin/(dashboard)/AdminNav.tsx` (modify)

Rename "Delete account" → "Users".

### 6.6 Delete `app/admin/(dashboard)/users/DeleteAccountPanel.tsx`

Replaced by `UsersPanel.tsx` + profile page.

---

## 7. Stripe Coupons (one-time setup)

Create 5 coupons in Stripe via script (test + live mode). Each with `metadata: { quotecore_admin_visible: 'true' }`:

| Coupon | percent_off | duration |
|---|---|---|
| 25% off forever | 25 | forever |
| 50% off forever | 50 | forever |
| 75% off forever | 75 | forever |
| 100% off forever | 100 | forever |
| 50% off once | 50 | once |

Script location: `scripts/create-admin-coupons.mjs` (one-off, run manually).

---

## 8. Files Summary

| File | Action |
|---|---|
| `supabase/migrations/20260630163000_admin_user_management.sql` | Create |
| `app/api/webhooks/stripe/route.ts` | Modify (4 handler guards) |
| `app/lib/billing/entitlements.ts` | Modify (3 new fields) |
| `app/admin/(dashboard)/users/actions.ts` | Modify (replace `listAccounts` with `searchUsers`) |
| `app/admin/(dashboard)/users/page.tsx` | Modify (rename, render `UsersPanel`) |
| `app/admin/(dashboard)/users/UsersPanel.tsx` | Create |
| `app/admin/(dashboard)/users/DeleteAccountPanel.tsx` | Delete |
| `app/admin/(dashboard)/users/[userId]/page.tsx` | Create |
| `app/admin/(dashboard)/users/[userId]/UserProfile.tsx` | Create |
| `app/admin/(dashboard)/users/[userId]/actions.ts` | Create |
| `app/admin/(dashboard)/AdminNav.tsx` | Modify (rename nav item) |
| `app/lib/supabase/database.types.ts` | Regenerate |
| `scripts/create-admin-coupons.mjs` | Create (one-off) |

---

## 9. Build Order

Execute in this exact order in the new session:

1. **Read this build plan** (`docs/plans/ADMIN-USER-MANAGEMENT-BUILD-PLAN.md`)
2. **Read `docs/DESIGN_SYSTEM.md`** before writing any UI
3. **Create migration** `20260630163000_admin_user_management.sql`
4. **Apply migration** to Supabase (Management API)
5. **Regenerate types** (`supabase gen types`)
6. **Update webhook handler** — add `admin_paused` guard to all 4 billing handlers + dispute special-case
7. **Update entitlements** — add 3 new fields to interface + select + mapping
8. **Create server actions** (`[userId]/actions.ts`) — all operations
9. **Modify `users/actions.ts`** — replace `listAccounts` with `searchUsers`
10. **Create `UsersPanel.tsx`** — search + results
11. **Modify `users/page.tsx`** — rename, render `UsersPanel`
12. **Create `[userId]/page.tsx`** — profile page server component
13. **Create `[userId]/UserProfile.tsx`** — all profile sections
14. **Modify `AdminNav.tsx`** — rename nav item
15. **Delete `DeleteAccountPanel.tsx`**
16. **Run `next build`** — must pass
17. **Commit + push to `development`**
18. **Create Stripe coupons** via script (`scripts/create-admin-coupons.mjs`)
19. **Smoke test on dev** — add items to `docs/smoke-tests/CHECKLIST.md`

---

## 10. Key Technical Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Override mechanism | Separate `admin_override_plan_code` column | Webhook can't break it (Gerald v1 H-01) |
| Pause mechanism | `admin_paused` boolean column | Doesn't conflict with dunning cron's `suspended` status (Gerald v1 H-02) |
| Pause webhook behavior | Option A: ALL handlers skip ALL mutations | Cleanest. Resume does full Stripe reconciliation (Gerald v3 M-02) |
| Resume | Mandatory Stripe sync before clearing pause | No stale state (Gerald v2 M-04) |
| Password reset | Send email via Supabase mailer, never return URL | No bearer token exposure (Gerald v3 H-01) |
| Coupon apply | `discounts: [{ coupon: id }]` | Current Stripe API shape (Gerald v2 M-02) |
| Coupon remove | `discounts: ''` (empty string) | Empty array does nothing (Gerald v2 M-01) |
| Coupon listing | `stripe.coupons.list({ limit: 100 })` + code filter | `{ active: true }` doesn't exist (Gerald v2 M-02) |
| Audit table | `admin_actions` with `ON DELETE SET NULL` + snapshots | Doesn't block deletion, survives row removal (Gerald v2 H-01) |
| Audit RLS | SELECT-only for admins, no client INSERT | Service-role writes only (Gerald v2 L-02) |
| `subscription_events` for paused logs | Event id/type + from/to state + note. No raw payload | Reduce sensitive data retention (Gerald v3 M-03) |
| `company_effective_plan_code()` when paused | Returns underlying plan (not `'free'`) | UI shows what they'll return to. Access lock is `_active=false` (Gerald v2 L-01) |
| Dispute handling while paused | Still create support tickets. Only skip `subscription_status` mutation | Chargebacks never silently swallowed (Gerald v2 M-03) |
| Migration timestamp | `20260630163000` | No collision with touch-support plan (Gerald v2 M-05) |

---

## 11. Safety Checklist (verify before shipping)

- [ ] Migration applies cleanly (additive only — no destructive changes)
- [ ] `next build` passes
- [ ] Existing webhook flow unaffected when `admin_paused = false` (default)
- [ ] Existing `comp_until` logic still works (backwards compat)
- [ ] Admin cannot pause/delete own company (self-protection)
- [ ] All admin actions write to `admin_actions` with snapshots
- [ ] Password reset never returns URL to client
- [ ] Coupon removal uses `discounts: ''` not `discounts: []`
- [ ] Resume from pause fails safely (stays paused if Stripe unreachable)
- [ ] Dispute tickets still created while paused
