# Subscription Tiers Implementation Brief

**Status:** v2 (post Gerald audit)
**Author:** Gavin (Shaun's full-stack agent)
**Auditor:** Gerald — audit at `workspace-gerald/audits/quotecore-plus/subscription-tiers-prebuild-2026-05-15.md`
**Date:** 2026-05-15 (v2 same-day revision)
**Repo head at v2 draft:** `c84129f` (development) / `b6c97c0` (main)

## 0. What changed in v2

Gerald's audit (verdict: **proceed but tighten**) flagged five High findings and five Mediums. All five Highs are now treated as build blockers, not optional polish. Key revisions vs v1:

1. **§5 reworked**: enforcement is now via domain helpers + DB RPCs, not "one-line `requireFeature` per action". The page-action check is the second layer, not the only one. (H-01)
2. **§6 new**: quote creation goes through one atomic DB RPC `create_quote_atomic(...)` that gates and increments usage in the same transaction. All four current insert paths (`createQuoteWithDetails`, `createQuoteFromTemplate`, `createBlankQuote`, `cloneQuote`) route through it. (H-02)
3. **§7 hardened**: storage quota now enforced at upload finalisation — not in the client, not optional. Existing direct-route bypasses (`quotes/new/upload-plan`, `uploadRoofPlanFile`, `createFlashing`) get fixed. Quota scope explicitly defined: `quote_files` only in phase 1; flashings + logos in phase 2. (H-03)
4. **§8 new**: scheduled-message dispatch gates on entitlement AT FIRE TIME, not only at scheduling time. (H-04)
5. **§9 reworked**: split `plan_code` (purchased) from effective entitlements (computed from plan + status). Payment failure does not silently rewrite `plan_code`. (H-05)
6. **§4 hardened**: tier-gating RLS uses a stable SQL function `company_has_feature(...)` not inline subselects. (M-01)
7. **§10 hardened**: trial defaults live in DB column defaults + a trigger, not only in app code. (M-02)
8. **§11 hardened**: Stripe webhook stores raw payload, fetches live state from Stripe before applying transitions, maps plans only from allowlisted Stripe Price IDs. (M-05)
9. **§12 new**: Tier 1 (Starter) explicitly loses the Activity card. Bell-icon alerts + email notifications are sufficient at that tier.

## 1. Purpose

QuoteCore+ ships today with a single feature set available to every authenticated company. We need a multi-tier subscription system that (a) gates feature access by tier, (b) enforces numeric limits (quotes/month, storage), (c) supports team-seat caps, (d) reacts to Stripe billing events including missed payments, and (e) cannot be bypassed except by changing the tier of record.

## 2. What we already have (informs scope)

### 2.1 Auth and request context
- `requireCompanyContext()` in `app/lib/supabase/server.ts:109`. Returns profile only. React-cached per request.
- `loadCompanyContext()` in `app/lib/data/company-context.ts:40`. Returns `{ profile, company }`. Selects only identity/onboarding columns.
- `requireAdmin()` for the `/admin/*` surface.
- Middleware enforces sign-in. `PUBLIC_PATHS` whitelist exists for token-resolved customer/supplier pages.

### 2.2 Schema, today
- `companies` row already has `storage_used_bytes BIGINT NOT NULL DEFAULT 0` and `storage_limit_bytes BIGINT NOT NULL DEFAULT 1073741824` (1 GiB). **No plan/tier/Stripe columns yet.**
- `users.company_id` foreign-keys users to a company. No per-company seat counter exists.
- `quotes.company_id` is mandatory. `quote_number` via `get_next_quote_number(company_id)` RPC.
- RLS pattern: every customer table is company-scoped via `users.company_id = auth.uid()` policies. Service role bypasses for admin/cron paths.

### 2.3 Storage today (partial enforcement — H-03)
- `BUCKETS.QUOTE_DOCUMENTS` (private) and `BUCKETS.COMPANY_LOGOS` (public).
- `checkStorageQuota()` exists at `app/lib/files/storage-actions.ts:46`.
- Confirmed-good callers: `QuoteDetailsForm.tsx:60-76`, `FilesManager.tsx:45-58`.
- **Bypass paths Gerald confirmed:**
  - `app/(auth)/[workspaceSlug]/quotes/new/upload-plan/route.ts` — direct upload + insert, never calls `checkStorageQuota`.
  - `uploadRoofPlanFile()` in `app/(auth)/[workspaceSlug]/quotes/new/actions.ts:91`.
  - `createFlashing()` in `app/(auth)/[workspaceSlug]/flashings/actions.ts:67` — uploads to `company-logos` without `quote_files` row, so the trigger doesn't account it.
- `saveFileMetadata` already re-reads actual object size server-side (good pattern to extend).

### 2.4 The five feature surfaces to gate

| Feature | Primary entry points | Hard write paths |
|---|---|---|
| Digital takeoff | `/[ws]/quotes/[id]/takeoff` + `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/actions.ts` | `quote_takeoff_measurements` + storage upload of `takeoff_canvas_path` / `takeoff_lines_path` |
| Flashings (draw + storage) | `/[ws]/flashings`, `/[ws]/flashings/draw` + `app/(auth)/[workspaceSlug]/flashings/actions.ts` | `flashing_library` + bucket uploads |
| Material orders | `/[ws]/material-orders/*` (multiple) + several action files | `material_orders`, `material_order_lines`, `material_order_templates`, supplier `/orders/<token>` |
| Follow-up message system | `scheduleQuoteFollowUp`, `activateEventScheduledMessages` (`app/lib/messages/scheduled.ts:124`); cron at `/api/cron/dispatch-scheduled-messages` | `scheduled_messages` |
| "Send from QuoteCore+" email pipeline | `sendOutboundMessage` (`app/lib/messages/send.ts:180`); entry actions in `send-message-actions.ts`, `m/[token]/actions.ts`, `orders/[token]/actions.ts` | `outbound_messages` + Resend API |

### 2.5 Quote creation paths (Gerald counted four)
- `createQuoteWithDetails()` — `app/(auth)/[workspaceSlug]/quotes/new/actions.ts:29`
- `createQuoteFromTemplate()` — `app/(auth)/[workspaceSlug]/quotes/actions.ts:83`
- `createBlankQuote()` — `app/(auth)/[workspaceSlug]/quotes/actions.ts:434`
- `cloneQuote()` — `app/(auth)/[workspaceSlug]/quotes/actions.ts:888`

All four route through `quotes.insert`. The atomic RPC pattern in §6 collapses them.

### 2.6 Stripe
Not started. No `stripe` npm dep, no webhook endpoint, no plan columns. Greenfield. Account/billing UI is a placeholder at `app/(auth)/[workspaceSlug]/account/page.tsx`.

## 3. Proposed tiers

Phase 1 ships **trial → starter → growth → pro**. The four higher tiers reuse the same gating primitives, so adding them later is config rows, not code.

| Tier code | Display name | Price | Quotes/mo | Storage | Seats | Features |
|---|---|---|---|---|---|---|
| `trial` | 14-day Trial | Free | 10 | 200 MB | 1 | Same gates as Starter |
| `starter` | Starter | $19 / $39 | 50 | 1 GB | 1 | Manual + blank quote modes only. PDF export, client + job records |
| `growth` | Growth | $29 / $59 | 100 | 3 GB | 1 | Adds digital takeoff + email-via-QuoteCore+ |
| `pro` | Professional | $39 / $89 | 100 | 5 GB | 1 | Adds flashings + material orders + follow-up automation |
| `scaling` | Scaling Contractor | $49 / $109 | 200 | 10 GB | 2 | Pro + PM mode (future) |
| `business` | Business | $99 / $199 | 500 | 20 GB | 3 | All features + teams + advanced workflows |
| `enterprise` | Enterprise | $249 / $499 | 2000 | 50 GB | 5 | Enterprise workflows + priority support |

**Feature matrix (boolean gates):**

| Tier | digital_takeoff | flashings | material_orders | followups | email_send | activity_card |
|---|---|---|---|---|---|---|
| trial | yes | no | no | no | no | yes |
| starter | no | no | no | no | no | **no** |
| growth | yes | no | no | no | yes | yes |
| pro | yes | yes | yes | yes | yes | yes |
| scaling+ | yes | yes | yes | yes | yes | yes |

**Tier 1 (Starter) is intentionally minimal:** Starter users get bell-icon alerts + the existing email notification setting for customer activity. The Activity card on the quote summary (Unresolved / Scheduled / Sent tabs) is hidden entirely. This trims the surface dramatically and avoids paying for unused tabs. Trial gets the Activity card so users experience the upgrade pitch firsthand.

## 4. Schema proposal

### 4.1 New: `subscription_plans` (config table, seeded)
Tier definitions live in DB so we can adjust limits without a deploy.

```sql
CREATE TABLE public.subscription_plans (
  code text PRIMARY KEY,
  display_name text NOT NULL,
  monthly_quote_limit integer NOT NULL,
  storage_limit_bytes bigint NOT NULL,
  included_seats integer NOT NULL DEFAULT 1,
  feat_digital_takeoff boolean NOT NULL DEFAULT false,
  feat_flashings boolean NOT NULL DEFAULT false,
  feat_material_orders boolean NOT NULL DEFAULT false,
  feat_followups boolean NOT NULL DEFAULT false,
  feat_email_send boolean NOT NULL DEFAULT false,
  feat_activity_card boolean NOT NULL DEFAULT false,
  price_cents_monthly integer NOT NULL,
  stripe_price_id_live text UNIQUE,
  stripe_price_id_test text UNIQUE,
  sort_order integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Stripe Price IDs are split live/test so we can map without env-flag spaghetti.

### 4.2 Stable feature-check function (M-01)
RLS policies and app code both go through ONE function. No inline subselects, no drift.

```sql
CREATE OR REPLACE FUNCTION public.company_has_feature(p_company_id uuid, p_feature text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  SELECT CASE p_feature
    WHEN 'digital_takeoff'  THEN sp.feat_digital_takeoff
    WHEN 'flashings'        THEN sp.feat_flashings
    WHEN 'material_orders'  THEN sp.feat_material_orders
    WHEN 'followups'        THEN sp.feat_followups
    WHEN 'email_send'       THEN sp.feat_email_send
    WHEN 'activity_card'    THEN sp.feat_activity_card
    ELSE false
  END
  INTO v_allowed
  FROM public.companies c
  JOIN public.subscription_plans sp ON sp.code = public.company_effective_plan_code(c.id)
  WHERE c.id = p_company_id
    AND public.company_effective_plan_active(c.id) = true;
  RETURN COALESCE(v_allowed, false);
END $$;
```

Note `company_effective_plan_code(...)` and `company_effective_plan_active(...)` — both helpers reflect the H-05 split between purchased and effective. See §9.

### 4.3 New columns on `companies` (H-05 split)
```sql
ALTER TABLE public.companies
  -- Purchased plan (what Stripe says they're paying for; never overwritten by payment failures)
  ADD COLUMN plan_code text NOT NULL DEFAULT 'trial'
    REFERENCES public.subscription_plans(code),

  -- Subscription lifecycle state
  ADD COLUMN subscription_status text NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing','active','past_due','grace','suspended','canceled')),

  -- Effective entitlements: usually equal to plan_code, but if grace/suspended/canceled
  -- the entitlement layer collapses to 'starter' (read-only on gated features).
  -- Computed by company_effective_plan_code() below — not stored, to avoid drift.

  ADD COLUMN plan_started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN trial_ends_at timestamptz,
  ADD COLUMN current_period_end timestamptz,
  ADD COLUMN cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN grace_ends_at timestamptz,                  -- set when subscription_status enters 'grace'
  ADD COLUMN stripe_customer_id text UNIQUE,
  ADD COLUMN stripe_subscription_id text UNIQUE,
  ADD COLUMN stripe_price_id text,                       -- mirrors active Stripe price
  ADD COLUMN seat_count integer NOT NULL DEFAULT 1,
  ADD COLUMN storage_topup_bytes bigint NOT NULL DEFAULT 0;
```

### 4.4 Effective-plan resolution functions (H-05)
```sql
CREATE OR REPLACE FUNCTION public.company_effective_plan_code(p_company_id uuid)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
    -- Trial expired without subscription -> behave like 'suspended'
    WHEN c.subscription_status = 'trialing'
         AND c.trial_ends_at IS NOT NULL
         AND c.trial_ends_at < now() THEN 'starter'
    -- Subscription in good standing or just past_due (still in grace per Stripe's first dunning email)
    WHEN c.subscription_status IN ('active','trialing','past_due') THEN c.plan_code
    -- Grace, suspended, canceled -> collapse to free-tier-equivalent (read-only on gated)
    ELSE 'starter'
  END
  FROM public.companies c
  WHERE c.id = p_company_id;
$$;

CREATE OR REPLACE FUNCTION public.company_effective_plan_active(p_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN c.subscription_status IN ('active','trialing','past_due') THEN true
    WHEN c.subscription_status = 'grace' AND c.grace_ends_at > now() THEN true
    ELSE false
  END
  FROM public.companies c
  WHERE c.id = p_company_id;
$$;
```

Why this shape: when payment recovers and Stripe flips back to `active`, **we don't have to remember what plan they had** — `plan_code` was never overwritten. Effective entitlements computed in two functions; one source of truth.

### 4.5 New: `company_quote_usage` (per-month counter)
```sql
CREATE TABLE public.company_quote_usage (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_start date NOT NULL,                             -- date_trunc('month', now() AT TIME ZONE 'UTC')
  quotes_created integer NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, period_start)
);
CREATE INDEX company_quote_usage_period_idx ON public.company_quote_usage (period_start);
```

Incremented inside `create_quote_atomic(...)` (§6). Clones count by default; documented behaviour, can be excluded by flagging the call.

### 4.6 New: `subscription_events` (audit + idempotency)
```sql
CREATE TABLE public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  from_plan_code text,
  to_plan_code text,
  from_status text,
  to_status text,
  stripe_event_id text UNIQUE,                            -- nullable for admin/manual events
  stripe_event_type text,
  stripe_payload jsonb,                                   -- raw event payload, redacted via webhook handler
  stripe_event_created timestamptz,                       -- Stripe's `created` field, for ordering
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscription_events_company_idx ON public.subscription_events (company_id, created_at DESC);
CREATE INDEX subscription_events_stripe_idx ON public.subscription_events (stripe_event_id) WHERE stripe_event_id IS NOT NULL;
```

### 4.7 New: `webhook_deliveries` (raw event log; M-05)
```sql
CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,                                 -- 'stripe'
  event_id text NOT NULL,                                 -- Stripe event id
  event_type text NOT NULL,
  signature_verified boolean NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_result text,                                 -- 'ok' | 'skipped_duplicate' | 'error:<reason>'
  UNIQUE (provider, event_id)
);
```

Webhook handler writes this row FIRST, before any state mutation. Defends against the "endpoint crashed, replay missed" case Gerald flagged.

### 4.8 Default-trial trigger (M-02)
```sql
CREATE OR REPLACE FUNCTION public.set_company_trial_defaults()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.plan_code IS NULL THEN NEW.plan_code := 'trial'; END IF;
  IF NEW.subscription_status IS NULL THEN NEW.subscription_status := 'trialing'; END IF;
  IF NEW.trial_ends_at IS NULL AND NEW.subscription_status = 'trialing' THEN
    NEW.trial_ends_at := now() + interval '14 days';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER companies_set_trial_defaults
  BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_company_trial_defaults();
```

So even if a future signup path forgets to set plan fields, the DB does. Existing two signup paths (`app/signup/actions.ts:27`, `app/(auth)/onboarding/actions.ts:52`) get cleaned up but the trigger is belt-and-braces.

## 5. Server-side entitlements module (H-01)

New module: `app/lib/billing/entitlements.ts`. Exports the only entitlement API the rest of the app should use.

```ts
export type Feature =
  | 'digital_takeoff' | 'flashings' | 'material_orders'
  | 'followups' | 'email_send' | 'activity_card';

export interface CompanyEntitlements {
  companyId: string;
  purchasedPlanCode: string;       // what Stripe says they pay for
  effectivePlanCode: string;       // what they can use today
  subscriptionStatus: 'trialing'|'active'|'past_due'|'grace'|'suspended'|'canceled';
  isActive: boolean;               // computed by company_effective_plan_active()
  monthlyQuoteLimit: number;
  storageLimitBytes: number;       // plan + topup
  storageUsedBytes: number;
  storageTopupBytes: number;
  includedSeats: number;
  features: Record<Feature, boolean>;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
}

// One DB read per request, cached via React cache().
export const loadCompanyEntitlements: (companyId: string) => Promise<CompanyEntitlements>;

// Throws FeatureGatedError on failure.
export async function requireFeature(companyId: string, feature: Feature): Promise<void>;

// Throws SubscriptionInactiveError if not in (active|trialing|past_due|grace-within-window).
export async function requireActiveSubscription(companyId: string): Promise<void>;

// Throws QuoteLimitReachedError. Called from create_quote_atomic, NOT from app code.
// Exposed only for prefetch-style UI hints ("you have 3 quotes left this month").

// Storage helpers wrap checkStorageQuota with entitlements-aware limit calculation.
export async function assertCanUseStorage(companyId: string, additionalBytes: number): Promise<void>;

// Manual + scheduled send gate. `mode` is 'manual' | 'scheduled_dispatch'.
export async function assertCanSendMessage(companyId: string, mode: 'manual'|'scheduled_dispatch'): Promise<void>;
```

`loadCompanyEntitlements` extends `loadCompanyContext` — they're now both called from the same chokepoint. Concretely:
```ts
// app/lib/data/company-context.ts becomes:
export type CompanyContext = {
  profile: ...;
  company: ...;
  entitlements: CompanyEntitlements;   // new
};
```
Every existing call site gets entitlements for free.

### 5.1 Typed errors (so callers can render upgrade UI without parsing strings)
```ts
export class FeatureGatedError extends Error {
  constructor(public feature: Feature, public requiredPlan: string, public currentPlan: string) { ... }
}
export class SubscriptionInactiveError extends Error { ... }
export class QuoteLimitReachedError extends Error { ... }
export class StorageQuotaExceededError extends Error { ... }
```

Server actions catch and return `{ ok: false, code: 'feature_gated', feature, requiredPlan }` to the client. UI renders inline upgrade card.

## 6. Atomic quote creation (H-02)

ALL quote insert paths call ONE RPC. The RPC enforces, increments, and inserts in a single transaction with an advisory lock.

```sql
CREATE OR REPLACE FUNCTION public.create_quote_atomic(
  p_company_id uuid,
  p_user_id uuid,
  p_payload jsonb,                  -- all columns the caller wants on the new quotes row
  p_count_against_limit boolean DEFAULT true
)
RETURNS uuid                        -- the new quote id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period date := date_trunc('month', now() AT TIME ZONE 'UTC')::date;
  v_used integer;
  v_limit integer;
  v_active boolean;
  v_quote_id uuid;
BEGIN
  -- Advisory lock: serialise quote creation per company for the brief window we need.
  -- 64-bit lock key derived from company uuid.
  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text)::bigint);

  -- Active-subscription check
  SELECT company_effective_plan_active(p_company_id) INTO v_active;
  IF NOT v_active THEN
    RAISE EXCEPTION 'subscription_inactive' USING ERRCODE = 'P0001';
  END IF;

  IF p_count_against_limit THEN
    SELECT sp.monthly_quote_limit
      INTO v_limit
      FROM subscription_plans sp
      WHERE sp.code = company_effective_plan_code(p_company_id);

    SELECT COALESCE(quotes_created, 0) INTO v_used
      FROM company_quote_usage
      WHERE company_id = p_company_id AND period_start = v_period;

    IF v_used IS NULL THEN v_used := 0; END IF;

    IF v_used >= v_limit THEN
      RAISE EXCEPTION 'quote_limit_reached' USING
        ERRCODE = 'P0002',
        DETAIL = format('used=%s limit=%s period_start=%s', v_used, v_limit, v_period);
    END IF;
  END IF;

  -- Insert the quote. p_payload columns get applied via jsonb_to_record-style expansion;
  -- see the migration for the explicit column projection (kept narrow so callers can't
  -- inject arbitrary columns).
  INSERT INTO public.quotes (...projected from p_payload...)
  VALUES (...)
  RETURNING id INTO v_quote_id;

  IF p_count_against_limit THEN
    INSERT INTO public.company_quote_usage (company_id, period_start, quotes_created)
    VALUES (p_company_id, v_period, 1)
    ON CONFLICT (company_id, period_start)
    DO UPDATE SET quotes_created = company_quote_usage.quotes_created + 1;
  END IF;

  RETURN v_quote_id;
END $$;
```

**App-side conversion plan:**
- `createQuoteWithDetails`, `createQuoteFromTemplate`, `createBlankQuote`, `cloneQuote` all become thin wrappers that build the `p_payload` and call the RPC.
- The `quotes.insert` direct call inside each is removed.
- Cloning sets `p_count_against_limit = false` if Shaun decides clones shouldn't count — confirmable later, default-on for now.
- Bulk import paths (when we build them) must use this RPC or a `create_quotes_atomic_bulk(...)` variant; never write to `quotes` directly.

**Lint rule (phase 1 stretch):** an ESLint rule banning `.from('quotes').insert(` outside the RPC wrapper file.

## 7. Storage quota enforcement (H-03)

### 7.1 Scope decision (phase 1)
- **Counted:** every object whose path starts with `{companyId}/...` in `QUOTE-DOCUMENTS`. This is `quote_files` rows + takeoff canvas snapshots + takeoff lines snapshots. The existing `storage_used_bytes` trigger already handles QUOTE-DOCUMENTS.
- **NOT counted in phase 1:** `company-logos` bucket (logos, flashing reference images). Tiny in practice; will roll into quota phase 2 alongside top-ups.
- **NOT counted ever:** Resend / Stripe / 3rd-party attachments cached in their own systems.

This decision is published in the brief so support can answer "why does my storage usage not show my logo?" without confusion.

### 7.2 Universal upload finaliser
New helper `app/lib/files/upload-finaliser.ts`. Every server route or action that writes to `QUOTE-DOCUMENTS` must call this AFTER the bucket write to:
1. Re-read actual `storage.objects.size` for the path (server-trusted, not client-supplied).
2. Call `assertCanUseStorage(companyId, actualSize)`.
3. If over, DELETE the just-uploaded object and throw `StorageQuotaExceededError`.
4. Otherwise, insert/update the `quote_files` (or equivalent) row with the actual size.

This wraps the post-fact detection model Gerald accepted as adequate for now. We're not relying on a Supabase storage hook (which may not exist on Pro plan).

### 7.3 Fix the three bypass paths
- `app/(auth)/[workspaceSlug]/quotes/new/upload-plan/route.ts` → route through `upload-finaliser`.
- `uploadRoofPlanFile()` in `quotes/new/actions.ts:91` → route through it.
- `createFlashing()` → out of phase-1 scope (logos bucket), but flag a TODO so we don't lose it.

### 7.4 Orphan sweep
Daily Vercel cron `/api/cron/sweep-orphan-objects` lists `QUOTE-DOCUMENTS` paths whose company_id matches a real company but whose path doesn't appear in `quote_files`, `quotes.takeoff_canvas_path`, or `quotes.takeoff_lines_path`. Deletes them after a 7-day grace. Defends against a finaliser crash that leaves a bucket object un-tracked.

## 8. Scheduled message dispatch gate (H-04)

`dispatchOne` in `app/lib/messages/scheduled.ts` currently calls `sendOutboundMessage` regardless of the company's current entitlement. Gerald confirmed this is a leak: a company schedules follow-ups while paid, downgrades, then cron keeps sending.

**Fix:** add an entitlement check inside `dispatchOne` BEFORE it calls `sendOutboundMessage`.

```ts
// Inside dispatchOne, after loading the scheduled_messages row:
try {
  await assertCanSendMessage(row.company_id, 'scheduled_dispatch');
  await requireFeature(row.company_id, 'followups');
} catch (err) {
  if (err instanceof FeatureGatedError || err instanceof SubscriptionInactiveError) {
    // Don't send. Mark the row as skipped, write an alert, leave audit trail.
    await admin.from('scheduled_messages').update({
      status: 'skipped',
      skipped_reason: `entitlement: ${err.constructor.name}`,
      skipped_at: new Date().toISOString(),
    }).eq('id', row.id);
    await admin.from('alerts').insert({
      company_id: row.company_id,
      quote_id: row.quote_id,
      alert_type: 'followup_skipped_entitlement',
      title: 'Follow-up not sent — feature unavailable on current plan',
      message: `A scheduled follow-up was skipped because your plan no longer includes ${err instanceof FeatureGatedError ? err.feature : 'this'}. Reactivate to resume automated follow-ups.`,
    });
    return;
  }
  throw err;
}
```

Same gate on `sendOutboundMessage` itself for the manual path: `assertCanSendMessage(companyId, 'manual')` checks `feat_email_send`.

`scheduled_messages` gains two columns: `skipped_reason text` and `skipped_at timestamptz`. UI shows skipped rows with an amber "Plan downgrade — not sent" pill.

## 9. Stripe state model (H-05, M-05)

### 9.1 Plan code vs effective entitlement (recap from §4.3)
- `companies.plan_code` = what the customer is paying for. ONLY ever changed by:
  - `checkout.session.completed` (new subscription).
  - `customer.subscription.updated` where `items.data[0].price.id` changes (real plan switch).
  - Admin override.
- `companies.subscription_status` = lifecycle (`trialing`/`active`/`past_due`/`grace`/`suspended`/`canceled`).
- **Payment failure does NOT touch `plan_code`.** It moves status to `past_due` then `grace` then `suspended`. When payment recovers, status flips back; effective plan automatically restores because `plan_code` was preserved.

### 9.2 Status transitions

| From | Stripe event | To status | Notes |
|---|---|---|---|
| trialing | `checkout.session.completed` | active | First successful charge inside trial |
| trialing | trial_ends_at < now() AND no subscription | (effective) starter | Computed by `company_effective_plan_code`; status row stays `trialing` until cron flips it |
| active | `invoice.payment_failed` (first) | past_due | Email user; do not change `plan_code`; UI shows banner |
| past_due | `invoice.payment_failed` (final) | grace | Set `grace_ends_at = now()+3 days`; effective plan collapses to starter for gated features only |
| grace | `customer.subscription.updated` status=`unpaid` or `canceled` | suspended | All gated features read-only |
| suspended | `invoice.paid` AND `customer.subscription.updated` status=`active` | active | `plan_code` was preserved — instant restoration |
| any | admin manual override | (any) | Audit row required |

### 9.3 Webhook handler structure (M-05)

`POST /api/webhooks/stripe`:
1. Verify Stripe signature via `STRIPE_WEBHOOK_SECRET`.
2. **First DB write:** `INSERT INTO webhook_deliveries(...) RETURNING id` with the raw payload. If `event_id` already exists, skip — but still 200 OK so Stripe doesn't retry.
3. **Before applying:** Fetch the live `subscription.retrieve(...)` from Stripe API for major events. This defends against out-of-order delivery (Gerald's M-05). For `invoice.paid` and `invoice.payment_failed` we additionally fetch the parent subscription so we use canonical current state, not stale event payload.
4. Resolve `plan_code` ONLY from `stripe_price_id` lookup against `subscription_plans.stripe_price_id_live` / `_test`. Refuse to process if no match — log to `subscription_events` with `notes='unknown_price_id'` so we notice before it bites in production.
5. Verify `company_id` resolution: every Checkout Session created from our app sets `metadata.company_id`. Subsequent events resolve company via `stripe_customer_id` lookup. If they mismatch, abort and log.
6. Apply state transition. Write `subscription_events` audit row.
7. Mark `webhook_deliveries.processed_at` + `processing_result='ok'`.

### 9.4 Checkout & Customer Portal
Phase 1 uses Stripe-hosted Checkout + Customer Portal. We do not build custom upgrade/downgrade UI. Two server actions:
- `createCheckoutSession(planCode)` → returns Stripe URL.
- `createBillingPortalSession()` → returns Stripe URL.

The Portal handles prorate, plan switching, card update, cancellation. Saves 2–3 days of work.

### 9.5 Reconciliation cron (phase 2)
Nightly job that lists all `companies` with `stripe_subscription_id IS NOT NULL`, fetches the live subscription from Stripe, and corrects any drift on `subscription_status` / `current_period_end` / `stripe_price_id`. Phase 1 ships without it; we rely on webhook idempotency + raw event log. If we see drift in production we accelerate this.

## 10. Gating: how the source of truth flows out

### 10.1 Server side (the security boundary)
- Every server action that mutates a gated surface calls `await requireFeature(companyId, '<feature>')` after `requireCompanyContext`. One line.
- Numeric limits go through `create_quote_atomic` (quotes) or `assertCanUseStorage` (storage) — not page-action checks.
- Message send goes through `assertCanSendMessage(companyId, mode)` inside `sendOutboundMessage`. Single chokepoint covers manual + scheduled dispatch + supplier order send.

### 10.2 RLS belt-and-braces (M-01)
On every gated table's INSERT/UPDATE/DELETE policy, add:
```sql
... AND public.company_has_feature(company_id, '<feature>') = true
```
Gerald accepted this is OK at our scale. We run EXPLAIN on the policies before rollout.

### 10.3 Route guards (read paths stay open — M-04)
- `RequireFeatureGate` server component wraps routes whose UI mutates: `/[ws]/material-orders/*`, `/[ws]/flashings/*`, `/[ws]/quotes/[id]/takeoff`.
- **Loaders never call `requireFeature`.** A locked or downgraded user MUST be able to view existing data. Per Gerald M-04, separate `requireCompanyContext()` (read access, almost always allowed) from `requireFeature()` (gated mutation only).
- The Activity card component renders only when `entitlements.features.activity_card === true`. Starter sees the quote summary without the card; alerts still come through the bell icon + email notification setting.

### 10.4 UI hints (cosmetic, not the boundary)
- Nav items for gated features render with a lock icon + "Upgrade" tooltip when the user's plan doesn't include them.
- Quote creation form disables "Digital takeoff" radio for Starter with inline upsell.
- Storage usage bar in `/account` (used/limit, amber at 80%, red at 95%).
- Quotes-this-month counter in topbar for trial/starter.
- Plan status banners for `past_due`, `grace`, `suspended` states.

## 11. What happens to data when you downgrade (M-04 confirmed)

| Scenario | Behaviour |
|---|---|
| Pro user with active material orders downgrades to Starter | Orders READ-ONLY. Banner: "Material orders is no longer included; existing orders visible but uneditable. Reactivate Pro to resume." No deletion. |
| Pro user with stored flashings drops to Starter | Files remain. Cannot create or upload new. |
| Stored 4 GB drops to Starter (1 GB cap) | All files stay accessible. No automatic deletion. Banner: "You're over your storage cap. Upgrade or delete to upload more." |
| 80 quotes created this month, downgrades to Starter (50 cap) | Existing quotes untouched. New creation refuses until next billing month. Counter: "92 / 50 — upgrade to create more." |
| Account `suspended` | Login works; dashboard read-only; accept tokens still resolve; NO mutations across the app. Reactivating instantly restores. |
| Pro user scheduled 5 follow-ups, then downgrades | Scheduled rows stay in DB. At fire time the dispatch gate (§8) skips them with `skipped_reason='entitlement:FeatureGatedError'` and writes an in-app alert. |

**Principle: we never delete customer data on downgrade.** Hard delete only on company deletion request (GDPR Article 17).

### 11.1 Regression tests (M-04)
Phase-1 test matrix: a script logs in as a synthetic company in each status (active/past_due/grace/suspended/canceled/trial-expired) and verifies:
- Can list quotes, view quote, view files. ✓ all
- Can download PDFs. ✓ all
- Can create new quote. ✗ for suspended/canceled/trial-expired/over-limit
- Can use digital takeoff. ✗ for non-licensed
- Can send manual email. ✗ for non-licensed
- Scheduled dispatch fires. ✓ only if licensed at fire time

## 12. Plan migration (existing users)

**Day 0 of rollout:**
1. Migration creates new tables/columns/functions/triggers/RLS. `companies.plan_code` defaults to `trial` schemawide, but the rollout migration immediately runs:
   ```sql
   UPDATE public.companies
     SET plan_code = 'pro', subscription_status = 'active',
         trial_ends_at = NULL, plan_started_at = created_at;
   ```
   So every pre-existing company starts on `pro` with status `active`, grandfathered.
2. One `subscription_events` row per company: `event_type='created', to_plan_code='pro', notes='Grandfathered'`.
3. Gates deployed. `plan_code='pro'` includes every feature → zero behaviour change for existing users.
4. New signups (going forward) get `plan_code='trial'` via the trigger.
5. Stripe checkout/portal/webhook ships.

Existing companies are never silently downgraded. Shaun manually decides who gets grandfather discounts vs upgrade prompts.

## 13. Touchpoints

| Layer | Files touched (approx) |
|---|---|
| SQL migrations | 1 (subscription_plans + companies columns + helpers + RLS + trigger + create_quote_atomic RPC + tables) |
| Server library: `app/lib/billing/entitlements.ts` + typed errors + `upload-finaliser.ts` | ~5 new files |
| Quote action conversion to RPC | 4 files (the four insert paths) |
| Server actions: add `requireFeature` | ~30 actions across 5 surfaces; one line each |
| `dispatchOne` + `sendOutboundMessage` gates | 2 changes |
| Route guards / upsell pages | 3 page wrappers + 3 upsell pages |
| Stripe webhook + actions | 3 new files |
| Trial expiry cron + orphan sweep cron | 2 new (`vercel.json` entries) |
| UI: lock-icons, usage bar, banners, upgrade modals | ~6 components |
| Admin: tier override UI + audit-trail viewer | 1 page |
| Regression tests | ~3 |

**Effort estimate: 6–9 working days for phase 1**, +1 day overhead vs v1 because of the RPC conversion and the storage finaliser refactor.

## 14. Build order (Gerald's recommendation, adopted)

1. **Migrations first.** Plans, company billing columns, quote usage, subscription events, webhook deliveries, indexes, `company_has_feature` / `company_effective_plan_code` / `company_effective_plan_active`, `create_quote_atomic` RPC, default-trial trigger. RLS policies. Generate `database.types.ts`.
2. **Entitlement loader + typed errors.** `app/lib/billing/entitlements.ts`. Extend `loadCompanyContext` to also return entitlements.
3. **Convert quote creation to RPC.** All four insert paths become thin wrappers around `create_quote_atomic`.
4. **Gate feature write surfaces.** Add `requireFeature` to ~30 actions. Add `assertCanSendMessage` to `sendOutboundMessage` + `dispatchOne`. Add `assertCanUseStorage` to the upload finaliser + fix the three bypass paths.
5. **Stripe checkout/portal/webhook.** Raw event log; live-state reconciliation on receipt; `subscription_events` audit.
6. **UI: banners, usage bars, lock icons, upgrade CTAs.** Activity card hidden for Starter.
7. **Regression test matrix.** Run before merge to `main`.

## 15. Phase split

**Phase 1 (6–9 days):**
- All schema + RLS + RPCs.
- Entitlements module + typed errors.
- Atomic quote creation.
- Five feature surfaces gated server-side + UI lock icons.
- Storage finaliser + bypass fixes.
- Stripe checkout + portal + webhook for 4 tiers (trial, starter, growth, pro).
- Trial expiry cron + orphan sweep cron.
- Grandfather existing users to `pro`.
- No paid launch yet — phase 1 is internal dry-run with Shaun's testing account.

**Phase 2 (post-audit):**
- Storage top-up SKU.
- Higher tiers (scaling, business, enterprise).
- PM mode flag (when PM mode exists).
- Reconciliation cron for Stripe drift.
- `company-logos` brought into storage quota.
- Compliance work: EU Article 27 rep, Costa Rica PRODHAB.
- Annual billing.

## 16. Out of scope

- Promo codes / coupons (Stripe can plug in later).
- Affiliate / partner payouts.
- Team-member add/remove UI (single-seat for first four tiers).
- Localised pricing.

## 17. Open items for Shaun

1. **Clones count against the monthly quote limit?** Default: yes. Confirm.
2. **Trial signup gate:** card-on-file required or not? Phase-1 recommendation: not required, monitor for abuse.
3. **What happens to existing users you've gifted/comped?** Default: everyone grandfathered to `pro`. You manually open `/admin` later to discount or migrate.
4. **First test customer for the paid flow.** Recommend one of your roofing-business friends willing to put a real card in for a real $19/month — that's the highest-confidence smoke test.
5. **Compliance gate before paid launch.** EU Article 27 + Costa Rica PRODHAB are still open. Resolve before flipping signup to "card required".

---

**Diff vs v1:** atomic RPC for quote creation; effective-vs-purchased plan split; dispatch-time entitlement gate; storage finaliser + bypass path fixes; raw webhook delivery log; `company_has_feature` SQL function; default-trial trigger; Starter loses Activity card.
