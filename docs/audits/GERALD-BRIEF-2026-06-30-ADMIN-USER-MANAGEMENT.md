# Gerald Brief: Admin User Management & Subscription Control

**Date:** 2026-06-30
**Scope:** New `/admin/users` page (replaces "Delete account"), per-user admin profile page, subscription tier overrides, Stripe coupon discounts, account pause.
**Bundle HEAD:** `bd523a8` (current `development`)
**Author:** Gavin

---

## 1. Goal

Give Shaun full control over any user's subscription from the admin dashboard. Use cases: support overrides, payment-issue fixes, comping frustrated customers, applying discounts, pausing access.

**Design principle:** `companies.plan_code` is the source of truth for what the user GETS. Stripe is the source of truth for what they PAY. Admin can decouple those two.

## 2. Current State (what already exists)

### 2.1 Admin area
- `/admin/login` — email/password login, checks `users.is_admin = true`
- `/admin` — dashboard with counters
- `/admin/admins` — admin account management (just shipped, `bd523a8`)
- `/admin/users` — currently "Delete Account" page (search + wipe tenant). **This will be renamed and extended.**
- `/admin/support-tickets`, `/admin/suppressions` — existing tools

### 2.2 Subscription system
- `companies.plan_code` — purchased plan (text: `trial`, `free`, `starter`, `growth`, `pro`, `pro_plus`, etc.)
- `companies.subscription_status` — lifecycle status (`trialing`, `active`, `past_due`, `grace`, `suspended`, `canceled`, `disputed`, etc.)
- `companies.comp_until` (timestamptz, nullable) — **already exists and already works.** When `comp_until > now()`, `company_effective_plan_code()` returns `plan_code` regardless of subscription_status. This is the existing admin-override mechanism.
- `companies.comp_notes` (text, nullable) — already exists for admin notes.
- `subscription_plans` table — 10 plan codes, 4 active with Stripe prices (starter $19, growth $29 inactive, pro $39, pro_plus $59)
- `company_effective_plan_code(uuid)` SQL function — source of truth for entitlements. Already respects `comp_until`.
- `company_effective_plan_active(uuid)` — returns false for suspended/canceled.
- Stripe webhook at `/api/webhooks/stripe/route.ts` — handles `customer.subscription.created/.updated/.deleted`, `invoice.payment_succeeded/.payment_failed`, `charge.dispute.created/.closed`. Updates `plan_code` + `subscription_status` from Stripe events.

### 2.3 Stripe setup
- `STRIPE_MODE` env var (`test` | `live`)
- `app/lib/billing/stripe.ts` — SDK factory, `resolvePlanCodeForStripePrice()`, `resolveStripePriceForPlan()`, `priceIdColumn()`
- Live + test Price IDs configured for starter/pro/pro_plus (growth inactive)
- Stripe webhook secret configured on both Vercel projects

## 3. Proposed Changes

### 3.1 Rename "Delete account" → "Users"

- **`/admin/users`** becomes the user search & management page (not just delete).
- Search by email, name, or company name.
- Click a user row → navigates to `/admin/users/[userId]` (admin profile page).
- Delete account functionality moves into the admin profile page as one of many actions.

### 3.2 New page: `/admin/users/[userId]` — Admin User Profile

Single page with full control over the user's company + subscription. Sections:

#### A. Company info
- Company name (editable text field + save)
- Company slug (read-only display)
- Plan code (read-only display — use a dropdown to change it, see below)
- Subscription status (read-only badge)
- Stripe customer ID (read-only, with link to Stripe dashboard if present)
- Stripe subscription ID (read-only, with link to Stripe dashboard if present)
- Current period end (read-only)
- Storage used / limit (read-only)
- Created date (read-only)

#### B. Subscription tier control
A dropdown of active plan codes (`free`, `starter`, `pro`, `pro_plus`) + an action button. Two modes:

**Mode 1: Admin override (no Stripe charge)**
- Sets `companies.plan_code` to the selected tier.
- Sets `companies.subscription_status = 'active'`.
- Sets `companies.comp_until = '9999-12-31'` (effectively forever) and `comp_notes = 'Admin override by <admin_email> on <date>: <reason>'`.
- Does NOT touch Stripe (no subscription created/updated).
- The existing `company_effective_plan_code()` function already handles this — when `comp_until > now()`, it returns `plan_code` regardless of Stripe status.
- **Webhook safety:** If a stale Stripe event fires for this company, the webhook updates `plan_code` + `subscription_status` from Stripe — BUT `comp_until` is still set, so `company_effective_plan_code()` still returns the admin-overridden plan. The user keeps their tier. The webhook can overwrite `plan_code` in the DB, but the effective plan doesn't change because `comp_until` wins. This is safe.
  - **Edge case:** If the admin override is removed (clear `comp_until`) and the Stripe subscription was still active, the `plan_code` written by the last webhook event becomes effective. This is correct behaviour — the user gets what Stripe says they're paying for.
  - **Concern:** The webhook could set `plan_code` to something different from what the admin set (e.g. admin set `pro`, Stripe event says `starter`). When `comp_until` is active, this doesn't matter (effective plan = `pro`). When `comp_until` is cleared, the Stripe-driven `plan_code` takes over. **This is the correct behaviour — no data loss, no race condition.**

**Mode 2: Change paid plan (Stripe sync)**
- Only available if the company has a `stripe_subscription_id`.
- Calls Stripe API: `stripe.subscriptions.update(sub_id, { items: [{ id: current_item_id, price: new_price_id }], proration_behavior: 'create_prorations' })`.
- Stripe fires `customer.subscription.updated` webhook → webhook handler updates `plan_code` + `subscription_status` in DB.
- If `comp_until` is set (admin override active), clear it first so the Stripe-driven plan takes effect.
- **Error handling:** If Stripe API call fails, return error to admin. No DB mutation.

**Mode 3: Remove admin override (reconnect to Stripe)**
- Clears `comp_until` and `comp_notes`.
- The effective plan reverts to whatever `plan_code` + `subscription_status` say (which may have been updated by a webhook event while the override was active).
- If the company has no Stripe subscription, they fall back to whatever `plan_code` is set to (likely `free` or `trial`).

#### C. Discount / coupon control
- Dropdown of available Stripe coupons (fetched from Stripe API: `stripe.coupons.list()`).
- Shows currently applied coupon if any (read from `stripe.subscriptions.retrieve(sub_id).discount.coupon`).
- **Apply coupon:** `stripe.subscriptions.update(sub_id, { coupon: coupon_id })`.
- **Remove coupon:** `stripe.subscriptions.update(sub_id, { coupon: '' })` or `stripe.subscriptions.deleteDiscount(sub_id)`.
- Only available if the company has a `stripe_subscription_id`.
- Coupons must be pre-created in Stripe dashboard. The admin panel lists what Stripe returns.
- **No new DB columns needed** — coupon state lives in Stripe.

**Coupons to create in Stripe upfront (manual, via Stripe Dashboard):**
- 25% off forever
- 50% off forever
- 75% off forever
- 100% off forever
- 50% off once (one-time goodwill)
- These are one-time setup tasks in Stripe, not code.

#### D. Pause / suspend access
- Button: "Pause access" — sets `companies.subscription_status = 'suspended'`.
- `company_effective_plan_active()` returns false → user is locked out of the app.
- Does NOT cancel Stripe subscription (so it can be resumed quickly).
- Button: "Resume access" — sets `subscription_status = 'active'` (or `past_due` if there was an issue).
- **Webhook safety:** If a Stripe event fires while paused, the webhook could un-suspend the user. To prevent this, we need a flag. **Options:**
  - **Option A (preferred):** Reuse `comp_until` semantics — when admin pauses, set `comp_until = null` and `subscription_status = 'suspended'`. The webhook handler already updates `subscription_status` from Stripe events, so it could un-suspend. We need to add a check in the webhook: if `subscription_status` is currently `suspended` AND the event is not `customer.subscription.deleted`, skip the status update. This requires a small webhook change.
  - **Option B:** Add a new `admin_paused` boolean column. Webhook skips status updates when `admin_paused = true`. Simpler to reason about, but adds a column.
  - **Gerald's input requested:** Which approach is safer? Option A means modifying the webhook handler's status-update logic. Option B adds a column but keeps the webhook logic simpler.

#### E. Delete account (moved from current page)
- Existing `deleteAccount()` action moves here unchanged.
- Same confirmation flow (type email to confirm, self-protection, storage + auth + company cascade).

#### F. Change password (for this user)
- Admin can set a new password for the user via `supabase.auth.admin.updateUserById()`.
- Same pattern as the admin password change we just built.

#### G. Future: Add/remove users (NOT in this build)
- Listed as "coming soon" on the profile page.
- Multi-user companies are a later feature.

### 3.3 Nav update
- Rename "Delete account" → "Users" in `AdminNav.tsx`.

### 3.4 Server actions file
- New: `app/admin/(dashboard)/users/[userId]/actions.ts` — all server actions for the profile page.
- Existing: `app/admin/(dashboard)/users/actions.ts` — keep `listAccounts()` (for search), move `lookupAccount`/`deleteAccount`/`deleteAccounts` to be importable from the profile page too.

## 4. Schema Changes

### 4.1 NO new columns (preferred approach)

The existing `comp_until` + `comp_notes` columns already provide the admin-override mechanism. No new columns needed for the core override feature.

**Exception:** If Gerald recommends `admin_paused` (Option B for pause), that's one new boolean column:
```sql
ALTER TABLE companies ADD COLUMN admin_paused boolean NOT NULL DEFAULT false;
```

### 4.2 Webhook handler change (if needed for pause)

If we go with Option A (pause via `suspended` status + webhook skip), the webhook handler at `app/api/webhooks/stripe/route.ts` needs a guard in the `handleSubscriptionChange` function:

```typescript
// Before updating subscription_status from Stripe:
if (company.subscription_status === 'suspended' && event.type !== 'customer.subscription.deleted') {
  // Admin paused this account; skip status update from Stripe.
  return 'ok';
}
```

If we go with Option B (`admin_paused` column), the guard becomes:
```typescript
if (company.admin_paused) {
  return 'ok'; // skip all status updates
}
```

## 5. Security Considerations

1. **All actions gated behind `requireAdmin()`** — existing pattern, no change.
2. **Service-role client** for all DB + Stripe + Auth operations (bypasses RLS). Already the pattern in `actions.ts`.
3. **Self-protection:** Admin cannot pause/delete their own company (existing pattern from delete).
4. **Stripe API keys:** Already configured in Vercel env. `requireStripe()` factory handles mode switching.
5. **Coupon application:** Only affects Stripe subscriptions — no DB write needed. Stripe is the source of truth for discounts.
6. **Password reset:** Uses `supabase.auth.admin.updateUserById()` — same pattern as admin password change.
7. **Audit trail:** All subscription changes should write to `subscription_events` table (existing pattern). Admin overrides should write an audit row with `event_type = 'admin_override'`, `from_plan_code`, `to_plan_code`, admin email in notes.

## 6. Files to Create/Modify

| File | Action | Purpose |
|---|---|---|
| `app/admin/(dashboard)/users/page.tsx` | Modify | Rename to "Users", add search, link to profile |
| `app/admin/(dashboard)/users/UsersPanel.tsx` | Create | Client component for search + results list (replaces DeleteAccountPanel on the list page) |
| `app/admin/(dashboard)/users/[userId]/page.tsx` | Create | Admin user profile page |
| `app/admin/(dashboard)/users/[userId]/UserProfile.tsx` | Create | Client component for all profile sections |
| `app/admin/(dashboard)/users/[userId]/actions.ts` | Create | Server actions: override plan, change paid plan, apply/remove coupon, pause/resume, change password, delete account, update company name |
| `app/admin/(dashboard)/users/actions.ts` | Modify | Keep `listAccounts()`, export `lookupAccount`/`deleteAccount` for reuse |
| `app/admin/(dashboard)/users/DeleteAccountPanel.tsx` | Delete | Replaced by UsersPanel + profile page |
| `app/admin/(dashboard)/AdminNav.tsx` | Modify | Rename "Delete account" → "Users" |
| `app/api/webhooks/stripe/route.ts` | Modify (maybe) | Add pause-skip guard (if Option A) |
| Migration `20260630120000_admin_paused.sql` | Create (maybe) | Add `admin_paused` column (if Option B) |

## 7. Questions for Gerald

1. **Pause approach:** Option A (reuse `suspended` status + webhook guard) or Option B (new `admin_paused` column)? Which is safer and less likely to cause webhook race conditions?

2. **Webhook override safety:** Is the `comp_until` mechanism sufficient for protecting admin-overridden plans from Stripe webhook mutations? The webhook can overwrite `plan_code` in the DB, but `company_effective_plan_code()` always returns the overridden plan while `comp_until > now()`. Is there any scenario where this breaks?

3. **Stripe subscription swap (Mode 2):** When changing a paid plan via Stripe, we rely on the webhook to update `plan_code` in the DB. There's a delay (Stripe → webhook → DB). Is this acceptable, or should we also write `plan_code` directly in the admin action (belt-and-braces)? If we write directly, we risk a race with the webhook. Current thinking: let the webhook do it, show a "syncing" state in the UI.

4. **Coupon listing:** Is it safe to list ALL Stripe coupons in the admin dropdown, or should we filter to only `forever` duration / percentage-based? The admin is trusted, but listing expired or one-time coupons could cause confusion.

5. **Audit trail:** Should admin overrides write to `subscription_events` (existing table) or a new `admin_actions` table? `subscription_events` has `event_type` as free text, so we can use `admin_override`, `admin_pause`, `admin_coupon_applied`, etc. But it also has Stripe-specific columns that'd be null. Is that OK?

6. **Company name edit:** Should we allow admin to edit `companies.name` directly, or should that go through a separate audit? It's a low-risk change but it does affect the user's visible workspace name.

## 8. Build Order (after Gerald sign-off)

1. Server actions (`[userId]/actions.ts`) — all the subscription/Stripe/auth operations
2. User profile page + client component (`[userId]/page.tsx` + `UserProfile.tsx`)
3. Users list page rewrite (`UsersPanel.tsx`, rename nav)
4. Webhook guard (if Option A approved)
5. Migration (if Option B approved)
6. Build verification
7. Create Stripe coupons (manual, Shaun to do or I script it)
8. Smoke test on dev
