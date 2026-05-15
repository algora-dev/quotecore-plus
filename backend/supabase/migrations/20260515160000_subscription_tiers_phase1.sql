-- ============================================================================
-- Subscription tiers — phase 1
-- ============================================================================
-- Implements the schema described in docs/internal/subscription-tiers-brief.md
-- (v3, post Gerald audit). One transactional migration; everything is wired
-- together at deploy time so no partial state can exist.
--
-- Sections:
--   1. subscription_plans (seeded with the 7-tier catalogue; phase 1 only
--      ships trial/starter/growth/pro, but rows for scaling/business/
--      enterprise exist so adding them later is a config row, not code)
--   2. companies: new columns for plan_code, subscription lifecycle,
--      Stripe linkage, dunning timers, cancellation flow, comp overrides
--   3. Effective-plan resolution functions (the heart of the H-05 split:
--      plan_code stays sacred; subscription_status drives the lifecycle;
--      these two functions compute what the company can ACTUALLY do today)
--   4. company_has_feature() — shared by app code AND RLS policies. One
--      source of truth for "is this feature available?"
--   5. company_quote_usage — per-company-per-month counter
--   6. subscription_events — audit trail + Stripe event idempotency
--   7. webhook_deliveries — raw event log; written FIRST in the webhook
--      handler, before any state mutation
--   8. support_tickets — extend existing table with 'payment_dispute'
--      category + Stripe dispute linkage + auto_close_at for the dispute
--      curve in §9.6 of the brief
--   9. create_quote_atomic — single RPC that all four quote-insert paths
--      collapse into. Advisory lock + entitlement check + monthly counter
--      increment + insert in one transaction. RAISE EXCEPTION with typed
--      error codes the app can pattern-match
--   10. BEFORE INSERT trigger on companies — defaults trial state even if
--       a future signup path forgets
--   11. RLS gates: tier-aware WITH CHECK on the five gated tables, using
--       company_has_feature() so we have a single check function
--   12. Day-0 grandfather: every existing company → plan_code='pro',
--       subscription_status='active' with one subscription_events row each
--
-- Notes on style:
--   * Uses CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE everywhere so
--     a re-run is idempotent (defensive — production should never re-run).
--   * SECURITY DEFINER on the helper functions so RLS policies and the
--     RPC can read companies/subscription_plans regardless of caller role.
--     search_path explicitly set to defeat search_path-hijack attacks.
--   * No DELETE policies anywhere; data lifecycle is via the dunning /
--     cancellation curves, never direct user delete.
--
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. subscription_plans
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  code                   text PRIMARY KEY,
  display_name           text NOT NULL,
  monthly_quote_limit    integer NOT NULL CHECK (monthly_quote_limit >= 0),
  storage_limit_bytes    bigint  NOT NULL CHECK (storage_limit_bytes  >= 0),
  included_seats         integer NOT NULL DEFAULT 1 CHECK (included_seats >= 1),
  -- Feature flags (boolean per gated capability). Adding a new flag is a
  -- schema migration plus a code update in company_has_feature() below.
  feat_digital_takeoff   boolean NOT NULL DEFAULT false,
  feat_flashings         boolean NOT NULL DEFAULT false,
  feat_material_orders   boolean NOT NULL DEFAULT false,
  feat_followups         boolean NOT NULL DEFAULT false,
  feat_email_send        boolean NOT NULL DEFAULT false,
  feat_activity_card     boolean NOT NULL DEFAULT false,
  price_cents_monthly    integer NOT NULL CHECK (price_cents_monthly >= 0),
  -- Stripe Price ID mapping. Live/test split so we don't end-flag-spaghetti.
  -- Both nullable until Stripe is wired up; until then plans are pickable
  -- only via admin override.
  stripe_price_id_live   text UNIQUE,
  stripe_price_id_test   text UNIQUE,
  sort_order             integer NOT NULL,
  active                 boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.subscription_plans IS
  'Tier definitions. Edit limits/features without a deploy. See subscription-tiers-brief.md.';

-- Seed: all seven tiers from §3 of the brief. Phase 1 will gate-render only
-- trial/starter/growth/pro in the upgrade UI, but the rows exist so we can
-- flip on scaling/business/enterprise from the admin tool when ready.
INSERT INTO public.subscription_plans (
  code, display_name, monthly_quote_limit, storage_limit_bytes, included_seats,
  feat_digital_takeoff, feat_flashings, feat_material_orders,
  feat_followups, feat_email_send, feat_activity_card,
  price_cents_monthly, sort_order, active
) VALUES
  -- 1 GiB = 1073741824. 200 MiB = 209715200. 3/5/10/20/50 GiB derived.
  ('trial',      '14-day Trial',         10,    209715200,    1,
                                          true,  false, false, false, false, true,
                                          0,     10, true),
  ('starter',    'Starter',              50,    1073741824,   1,
                                          false, false, false, false, false, false,
                                          1900,  20, true),
  ('growth',     'Growth',               100,   3221225472,   1,
                                          true,  false, false, false, true,  true,
                                          2900,  30, true),
  ('pro',        'Professional',         100,   5368709120,   1,
                                          true,  true,  true,  true,  true,  true,
                                          3900,  40, true),
  ('scaling',    'Scaling Contractor',   200,   10737418240,  2,
                                          true,  true,  true,  true,  true,  true,
                                          4900,  50, true),
  ('business',   'Business',             500,   21474836480,  3,
                                          true,  true,  true,  true,  true,  true,
                                          9900,  60, true),
  ('enterprise', 'Enterprise',           2000,  53687091200,  5,
                                          true,  true,  true,  true,  true,  true,
                                          24900, 70, true)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Any signed-in user can read the plan catalogue (needed for the pricing
-- page, upgrade modals, etc). Writes are service-role only.
DROP POLICY IF EXISTS subscription_plans_select_authenticated ON public.subscription_plans;
CREATE POLICY subscription_plans_select_authenticated
  ON public.subscription_plans
  FOR SELECT
  TO authenticated
  USING (true);

-- ----------------------------------------------------------------------------
-- 2. companies: subscription columns
-- ----------------------------------------------------------------------------
-- plan_code is the PURCHASED plan and is sacred — only changed by checkout,
-- explicit Stripe plan switch, or admin override. NEVER overwritten by
-- payment failures. The brief's H-05 finding is implemented by keeping this
-- column stable while subscription_status drives the lifecycle.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS plan_code text NOT NULL DEFAULT 'trial'
    REFERENCES public.subscription_plans(code),
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN (
      'trialing','active','past_due','grace','pending_data_purge',
      'disputed','cancellation_pending','suspended','canceled'
    )),
  ADD COLUMN IF NOT EXISTS plan_started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  -- Stripe linkage. Both nullable until first checkout.
  ADD COLUMN IF NOT EXISTS stripe_customer_id     text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_price_id        text,
  -- Seat capacity tracking. Phase 1 = single-seat for first four tiers, so
  -- this just mirrors subscription_plans.included_seats until we ship the
  -- team-management UI.
  ADD COLUMN IF NOT EXISTS seat_count integer NOT NULL DEFAULT 1
    CHECK (seat_count >= 1),
  -- Phase 2 storage top-up SKU lands here. Read paths compute effective
  -- storage limit as plan.storage_limit_bytes + companies.storage_topup_bytes.
  ADD COLUMN IF NOT EXISTS storage_topup_bytes bigint NOT NULL DEFAULT 0
    CHECK (storage_topup_bytes >= 0),
  -- Dunning timers. first_payment_failure_at is set on the first
  -- invoice.payment_failed webhook and cleared on invoice.paid. The cron
  -- reads it to decide which dunning stage we're in (§9.5).
  ADD COLUMN IF NOT EXISTS first_payment_failure_at timestamptz,
  ADD COLUMN IF NOT EXISTS dunning_stage_entered_at timestamptz,
  -- Admin override: comp_until > now() forces effective entitlement to
  -- the full plan_code regardless of Stripe state. Useful for time-bounded
  -- gifts and ongoing comp users. Notes column is human-readable context
  -- for the audit (e.g. "lifetime, gifted on 2026-05-15").
  ADD COLUMN IF NOT EXISTS comp_until timestamptz,
  ADD COLUMN IF NOT EXISTS comp_notes text,
  -- Cancellation refund flow (§9.7 Mode B). Set when admin issues a
  -- refund-with-cancellation; user has 14 days to confirm they're leaving
  -- (shortens the purge window to 7 days post-confirm) or take the full
  -- 14-day window. Both flow into the same purge job.
  ADD COLUMN IF NOT EXISTS cancellation_confirmation_required_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_confirmed_at timestamptz;

-- Useful read indexes for the cron (which scans by subscription_status +
-- dunning_stage_entered_at).
CREATE INDEX IF NOT EXISTS companies_subscription_status_idx
  ON public.companies (subscription_status)
  WHERE subscription_status NOT IN ('active','trialing');
CREATE INDEX IF NOT EXISTS companies_dunning_stage_idx
  ON public.companies (dunning_stage_entered_at)
  WHERE dunning_stage_entered_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS companies_comp_until_idx
  ON public.companies (comp_until)
  WHERE comp_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS companies_stripe_customer_idx
  ON public.companies (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. Effective-plan resolution functions (H-05)
-- ----------------------------------------------------------------------------
-- Two functions = one source of truth for "what plan is this company on
-- TODAY?" and "is this company allowed to do anything at all today?".
-- Used by company_has_feature() (and therefore by RLS policies and app
-- code) so we never compute this twice.

CREATE OR REPLACE FUNCTION public.company_effective_plan_code(p_company_id uuid)
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT CASE
    -- Admin comp override beats everything until comp_until.
    WHEN c.comp_until IS NOT NULL AND c.comp_until > now()
      THEN c.plan_code
    -- Trial expired with no Stripe subscription: collapses to starter.
    WHEN c.subscription_status = 'trialing'
         AND c.trial_ends_at IS NOT NULL
         AND c.trial_ends_at < now()
         AND c.stripe_subscription_id IS NULL
      THEN 'starter'
    -- Healthy states (active / trialing / past_due, plus disputed-with-
    -- ticket-open per §9.6) keep their purchased plan.
    WHEN c.subscription_status IN ('active','trialing','past_due','disputed')
      THEN c.plan_code
    -- Grace / pending_data_purge / cancellation_pending: collapse to starter
    -- (read-only on gated features; existing data still viewable). These are
    -- the "in-trouble" states the user can still recover from.
    WHEN c.subscription_status IN ('grace','pending_data_purge','cancellation_pending')
      THEN 'starter'
    -- Suspended / canceled: fully locked elsewhere via _active = false. The
    -- starter return here is irrelevant because mutations refuse first.
    ELSE 'starter'
  END
  FROM public.companies c
  WHERE c.id = p_company_id;
$$;

COMMENT ON FUNCTION public.company_effective_plan_code IS
  'Returns the plan code the company can actually use TODAY. Collapses to starter on grace/purge/cancellation/suspended. plan_code itself is never modified by these transitions.';

CREATE OR REPLACE FUNCTION public.company_effective_plan_active(p_company_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT CASE
    -- Comp users are always active.
    WHEN c.comp_until IS NOT NULL AND c.comp_until > now()
      THEN true
    -- Normal active states + disputed-with-ticket (still working with us).
    WHEN c.subscription_status IN ('active','trialing','past_due','disputed')
      THEN true
    -- "In trouble but still alive" states: account is in read-only mode.
    -- We return true here so existing data stays viewable and the user can
    -- still log in / download files / restart subscription. Mutations are
    -- prevented by company_has_feature() returning false on those tiers.
    WHEN c.subscription_status IN ('grace','pending_data_purge','cancellation_pending')
      THEN true
    -- Suspended / canceled: fully locked. UI shows account-suspended page.
    ELSE false
  END
  FROM public.companies c
  WHERE c.id = p_company_id;
$$;

COMMENT ON FUNCTION public.company_effective_plan_active IS
  'Returns true if the company can interact with the app at all. False only for suspended/canceled. Read access is preserved on grace/purge/cancellation_pending — gating is via company_has_feature for those.';

-- ----------------------------------------------------------------------------
-- 4. company_has_feature
-- ----------------------------------------------------------------------------
-- The shared truth function used by both the app's requireFeature() helper
-- and RLS policies on gated tables. New gated features are added by
-- extending the CASE expression below AND adding a column to
-- subscription_plans (see top of file).
--
-- Returns false for unknown features (defensive), and false when the
-- company's effective plan is the read-only fallback (grace etc).

CREATE OR REPLACE FUNCTION public.company_has_feature(p_company_id uuid, p_feature text)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_effective_code text;
  v_allowed boolean;
BEGIN
  v_effective_code := public.company_effective_plan_code(p_company_id);

  SELECT CASE p_feature
    WHEN 'digital_takeoff' THEN sp.feat_digital_takeoff
    WHEN 'flashings'       THEN sp.feat_flashings
    WHEN 'material_orders' THEN sp.feat_material_orders
    WHEN 'followups'       THEN sp.feat_followups
    WHEN 'email_send'      THEN sp.feat_email_send
    WHEN 'activity_card'   THEN sp.feat_activity_card
    ELSE false
  END
  INTO v_allowed
  FROM public.subscription_plans sp
  WHERE sp.code = v_effective_code;

  RETURN COALESCE(v_allowed, false);
END $$;

COMMENT ON FUNCTION public.company_has_feature IS
  'Single feature-check function used by app code AND RLS policies. Extend the CASE arm + add a column to subscription_plans when introducing a new gated feature.';

-- ----------------------------------------------------------------------------
-- 5. company_quote_usage
-- ----------------------------------------------------------------------------
-- Per-company-per-calendar-month counter. Upserted inside create_quote_atomic
-- so the increment is part of the same transaction as the insert.
--
-- period_start is the first of the month in UTC. Reading the current month
-- looks like:
--   SELECT * FROM company_quote_usage
--     WHERE company_id = $1
--       AND period_start = date_trunc('month', now() AT TIME ZONE 'UTC')::date;
CREATE TABLE IF NOT EXISTS public.company_quote_usage (
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_start    date NOT NULL,
  quotes_created  integer NOT NULL DEFAULT 0 CHECK (quotes_created >= 0),
  PRIMARY KEY (company_id, period_start)
);

CREATE INDEX IF NOT EXISTS company_quote_usage_period_idx
  ON public.company_quote_usage (period_start);

ALTER TABLE public.company_quote_usage ENABLE ROW LEVEL SECURITY;

-- Read-only to the owning company. Writes are service-role only (the RPC
-- runs as SECURITY DEFINER so it can update on behalf of the caller).
DROP POLICY IF EXISTS company_quote_usage_select_own ON public.company_quote_usage;
CREATE POLICY company_quote_usage_select_own
  ON public.company_quote_usage
  FOR SELECT
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

COMMENT ON TABLE public.company_quote_usage IS
  'Monthly counter; written only via create_quote_atomic. Resets implicitly: each new month creates its own row.';

-- ----------------------------------------------------------------------------
-- 6. subscription_events (audit + Stripe idempotency)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  event_type              text NOT NULL,    -- 'created','upgraded','downgraded','payment_failed','dunning_advanced','dispute_opened','dispute_closed','manual_override','data_purged','reactivated','grandfathered'
  from_plan_code          text,
  to_plan_code            text,
  from_status             text,
  to_status               text,
  -- Stripe idempotency. NULL for admin/system events.
  stripe_event_id         text UNIQUE,
  stripe_event_type       text,
  stripe_event_created    timestamptz,
  -- Raw Stripe payload (redacted in the webhook handler before insert if
  -- needed; full event for now). jsonb so we can JSON-query in support cases.
  stripe_payload          jsonb,
  -- Who did it (null for cron/webhook).
  actor_user_id           uuid REFERENCES public.users(id) ON DELETE SET NULL,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_events_company_idx
  ON public.subscription_events (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS subscription_events_stripe_idx
  ON public.subscription_events (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS subscription_events_type_idx
  ON public.subscription_events (event_type, created_at DESC);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- Company users can SEE their own audit trail (billing transparency). Phase 1
-- exposes this via /account/billing. Writes are service-role only.
DROP POLICY IF EXISTS subscription_events_select_own ON public.subscription_events;
CREATE POLICY subscription_events_select_own
  ON public.subscription_events
  FOR SELECT
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

COMMENT ON TABLE public.subscription_events IS
  'Append-only audit trail. Every plan / status transition writes one row. Stripe events deduped via stripe_event_id.';

-- ----------------------------------------------------------------------------
-- 7. webhook_deliveries (raw Stripe event log — M-05)
-- ----------------------------------------------------------------------------
-- Written FIRST in the Stripe webhook handler, before any state mutation.
-- If the handler crashes mid-processing we have the raw event to replay
-- and a deterministic idempotency key (provider + event_id).
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            text NOT NULL,                -- 'stripe'
  event_id            text NOT NULL,
  event_type          text NOT NULL,
  signature_verified  boolean NOT NULL,
  payload             jsonb NOT NULL,
  received_at         timestamptz NOT NULL DEFAULT now(),
  processed_at        timestamptz,
  processing_result   text,                         -- 'ok' | 'skipped_duplicate' | 'error:<reason>'
  UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS webhook_deliveries_received_idx
  ON public.webhook_deliveries (received_at DESC);
CREATE INDEX IF NOT EXISTS webhook_deliveries_unprocessed_idx
  ON public.webhook_deliveries (received_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- No SELECT policy: service-role only. Webhook log is operational data,
-- not user-facing.

COMMENT ON TABLE public.webhook_deliveries IS
  'Raw inbound webhook events. Written before mutation. UNIQUE(provider,event_id) is the idempotency key.';

-- ----------------------------------------------------------------------------
-- 8. support_tickets — extend for payment disputes (§9.6)
-- ----------------------------------------------------------------------------
-- The existing 2026-05-11 migration created support_tickets with a category
-- check that already includes 'billing'. We add a 'payment_dispute' category
-- so the auto-created dispute ticket has its own classification, plus two
-- columns for Stripe linkage and the auto-close timer.

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS related_stripe_dispute_id text,
  ADD COLUMN IF NOT EXISTS related_stripe_charge_id  text,
  ADD COLUMN IF NOT EXISTS auto_close_at             timestamptz,
  ADD COLUMN IF NOT EXISTS created_by_system         boolean NOT NULL DEFAULT false;

-- Widen the category CHECK constraint to include 'payment_dispute'. Postgres
-- doesn't allow modifying an existing CHECK in place; drop+recreate.
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_category_check;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_category_check
  CHECK (category IN ('bug','question','billing','feature_request','other','payment_dispute'));

CREATE INDEX IF NOT EXISTS support_tickets_dispute_idx
  ON public.support_tickets (related_stripe_dispute_id)
  WHERE related_stripe_dispute_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS support_tickets_auto_close_idx
  ON public.support_tickets (auto_close_at)
  WHERE auto_close_at IS NOT NULL AND status NOT IN ('resolved','closed');

-- ----------------------------------------------------------------------------
-- 9. create_quote_atomic (H-02)
-- ----------------------------------------------------------------------------
-- Single chokepoint for all four current quote-insert paths. Holds an
-- advisory lock keyed on company_id for the duration of the transaction so
-- two concurrent creates can't both pass the limit check. Counter increment
-- and quote insert happen in the same transaction; either both commit or
-- neither does.
--
-- p_payload is a jsonb object containing the columns the caller wants to set
-- on the new quotes row. The function projects ONLY known columns from it —
-- callers cannot inject arbitrary columns. Fields not present default to the
-- column default (or stay NULL).
--
-- Returns the new quote id (uuid). Raises:
--   * SQLSTATE P0001 'subscription_inactive' — effective plan is not active
--   * SQLSTATE P0002 'quote_limit_reached'   — monthly quota hit; DETAIL
--                                              includes used/limit/period
--   * SQLSTATE P0003 'unknown_company'       — company_id doesn't exist
--
-- Clones count against the monthly limit per Shaun's call: each clone gets
-- its own quote_number and counts as a new quote operationally.

CREATE OR REPLACE FUNCTION public.create_quote_atomic(
  p_company_id uuid,
  p_user_id    uuid,
  p_payload    jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_period date := date_trunc('month', (now() AT TIME ZONE 'UTC'))::date;
  v_used   integer;
  v_limit  integer;
  v_active boolean;
  v_effective_code text;
  v_quote_id uuid;
  v_company_exists boolean;
BEGIN
  -- Validate the company exists at all (defends against a stale UI passing
  -- a deleted company id).
  SELECT EXISTS(SELECT 1 FROM public.companies WHERE id = p_company_id) INTO v_company_exists;
  IF NOT v_company_exists THEN
    RAISE EXCEPTION 'unknown_company' USING ERRCODE = 'P0003';
  END IF;

  -- Advisory lock: serialise quote creation per company. 64-bit lock key
  -- derived from the company uuid. Released automatically at transaction end.
  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text)::bigint);

  -- Active-subscription check.
  v_active := public.company_effective_plan_active(p_company_id);
  IF NOT v_active THEN
    RAISE EXCEPTION 'subscription_inactive' USING ERRCODE = 'P0001';
  END IF;

  -- Monthly limit check (always; clones included).
  v_effective_code := public.company_effective_plan_code(p_company_id);

  SELECT sp.monthly_quote_limit
    INTO v_limit
    FROM public.subscription_plans sp
    WHERE sp.code = v_effective_code;

  IF v_limit IS NULL THEN
    -- Defensive: effective code resolved to something not in the catalogue.
    -- Should never happen since plan_code is FK-constrained, but bail loudly
    -- rather than letting it silently succeed.
    RAISE EXCEPTION 'plan_not_found:%', v_effective_code USING ERRCODE = 'P0003';
  END IF;

  SELECT COALESCE(quotes_created, 0)
    INTO v_used
    FROM public.company_quote_usage
    WHERE company_id = p_company_id AND period_start = v_period;

  IF v_used IS NULL THEN v_used := 0; END IF;

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'quote_limit_reached'
      USING ERRCODE = 'P0002',
            DETAIL = format('used=%s limit=%s period_start=%s plan=%s',
                            v_used, v_limit, v_period, v_effective_code);
  END IF;

  -- Insert the quote. We explicitly project columns from p_payload so callers
  -- can't sneak in (for example) company_id overrides or quote_number values.
  -- Any field the caller doesn't supply uses the column default.
  INSERT INTO public.quotes (
    company_id,
    template_id,
    customer_name,
    customer_email,
    customer_phone,
    job_name,
    site_address,
    tax_rate,
    notes_internal,
    created_by_user_id,
    global_pitch_degrees,
    measurement_system,
    cq_company_name,
    cq_company_address,
    cq_company_phone,
    cq_company_email,
    cq_company_logo_url,
    cq_footer_text,
    currency,
    entry_mode,
    material_margin_percent,
    labor_margin_percent,
    material_margin_enabled,
    labor_margin_enabled
  )
  VALUES (
    p_company_id,
    NULLIF(p_payload->>'template_id', '')::uuid,
    p_payload->>'customer_name',
    NULLIF(p_payload->>'customer_email', ''),
    NULLIF(p_payload->>'customer_phone', ''),
    NULLIF(p_payload->>'job_name', ''),
    NULLIF(p_payload->>'site_address', ''),
    COALESCE((p_payload->>'tax_rate')::numeric, 0),
    NULLIF(p_payload->>'notes_internal', ''),
    p_user_id,
    NULLIF(p_payload->>'global_pitch_degrees', '')::numeric,
    COALESCE((p_payload->>'measurement_system')::measurement_system, 'metric'::measurement_system),
    NULLIF(p_payload->>'cq_company_name', ''),
    NULLIF(p_payload->>'cq_company_address', ''),
    NULLIF(p_payload->>'cq_company_phone', ''),
    NULLIF(p_payload->>'cq_company_email', ''),
    NULLIF(p_payload->>'cq_company_logo_url', ''),
    NULLIF(p_payload->>'cq_footer_text', ''),
    COALESCE(NULLIF(p_payload->>'currency', ''), 'NZD'),
    COALESCE(NULLIF(p_payload->>'entry_mode', ''), 'manual'),
    NULLIF(p_payload->>'material_margin_percent', '')::numeric,
    NULLIF(p_payload->>'labor_margin_percent', '')::numeric,
    COALESCE((p_payload->>'material_margin_enabled')::boolean, false),
    COALESCE((p_payload->>'labor_margin_enabled')::boolean, false)
  )
  RETURNING id INTO v_quote_id;

  -- Increment the monthly counter. ON CONFLICT for the first-of-the-month case.
  INSERT INTO public.company_quote_usage (company_id, period_start, quotes_created)
  VALUES (p_company_id, v_period, 1)
  ON CONFLICT (company_id, period_start)
    DO UPDATE SET quotes_created = company_quote_usage.quotes_created + 1;

  RETURN v_quote_id;
END $$;

COMMENT ON FUNCTION public.create_quote_atomic IS
  'Single atomic chokepoint for all quote creation. Enforces effective-plan active state and monthly limit under an advisory lock. Clones count.';

-- ----------------------------------------------------------------------------
-- 10. BEFORE INSERT trigger on companies — default trial state (M-02)
-- ----------------------------------------------------------------------------
-- Belt-and-braces: even if a future signup code path forgets to set plan
-- fields, the trigger fills them in. Existing two signup paths
-- (app/signup/actions.ts, app/(auth)/onboarding/actions.ts) will be cleaned
-- up to set them explicitly, but the trigger means we can't regress.

CREATE OR REPLACE FUNCTION public.set_company_trial_defaults()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.plan_code IS NULL THEN
    NEW.plan_code := 'trial';
  END IF;
  IF NEW.subscription_status IS NULL THEN
    NEW.subscription_status := 'trialing';
  END IF;
  IF NEW.trial_ends_at IS NULL AND NEW.subscription_status = 'trialing' THEN
    NEW.trial_ends_at := now() + interval '14 days';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS companies_set_trial_defaults ON public.companies;
CREATE TRIGGER companies_set_trial_defaults
  BEFORE INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_trial_defaults();

-- ----------------------------------------------------------------------------
-- 11. RLS belt-and-braces on the five gated tables (M-01)
-- ----------------------------------------------------------------------------
-- Even if a future server action forgets requireFeature(), the DB refuses
-- the write. The check goes through company_has_feature() (SECURITY DEFINER)
-- so it works regardless of the caller's role.
--
-- IMPORTANT: Postgres OR-combines multiple policies for the SAME command. So
-- we can't just ADD a new feature-gate policy alongside the existing
-- company-scope policy — a row would only need to pass ONE of them. We must
-- DROP the existing policy and recreate it with the feature check folded in.
--
-- Existing policies (verified at migration-author time, 2026-05-15):
--   quote_takeoff_measurements:  takeoff_measurements_company_access      (cmd=ALL)
--   flashing_library:            flashing_library_company_access          (cmd=ALL)
--   material_orders:             material_orders_company_access           (cmd=ALL)
--   scheduled_messages:          scheduled_messages_{select,insert,update,delete}_own_company
--   outbound_messages:           outbound_messages_{select,delete}_own_company  (no INSERT today)
--
-- Reads stay open per §10.3 of the brief (M-04 — locked accounts must see
-- their existing data). Only INSERT and UPDATE get the feature gate. DELETE
-- stays open so users can clean up their own data on any tier.
--
-- The three ALL-policy tables get split: SELECT/DELETE stays at the
-- company-scope check; INSERT/UPDATE adds the feature gate.

-- quote_takeoff_measurements: replace the ALL policy with split policies
DROP POLICY IF EXISTS takeoff_measurements_company_access ON public.quote_takeoff_measurements;

CREATE POLICY takeoff_measurements_select
  ON public.quote_takeoff_measurements
  FOR SELECT
  TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY takeoff_measurements_insert
  ON public.quote_takeoff_measurements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.company_has_feature(company_id, 'digital_takeoff') = true
  );

CREATE POLICY takeoff_measurements_update
  ON public.quote_takeoff_measurements
  FOR UPDATE
  TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.company_has_feature(company_id, 'digital_takeoff') = true
  );

CREATE POLICY takeoff_measurements_delete
  ON public.quote_takeoff_measurements
  FOR DELETE
  TO authenticated
  USING (company_id = public.current_company_id());

-- flashing_library: same split
DROP POLICY IF EXISTS flashing_library_company_access ON public.flashing_library;

CREATE POLICY flashing_library_select
  ON public.flashing_library
  FOR SELECT
  TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY flashing_library_insert
  ON public.flashing_library
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.company_has_feature(company_id, 'flashings') = true
  );

CREATE POLICY flashing_library_update
  ON public.flashing_library
  FOR UPDATE
  TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.company_has_feature(company_id, 'flashings') = true
  );

CREATE POLICY flashing_library_delete
  ON public.flashing_library
  FOR DELETE
  TO authenticated
  USING (company_id = public.current_company_id());

-- material_orders: same split
DROP POLICY IF EXISTS material_orders_company_access ON public.material_orders;

CREATE POLICY material_orders_select
  ON public.material_orders
  FOR SELECT
  TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY material_orders_insert
  ON public.material_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.company_has_feature(company_id, 'material_orders') = true
  );

CREATE POLICY material_orders_update
  ON public.material_orders
  FOR UPDATE
  TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.company_has_feature(company_id, 'material_orders') = true
  );

CREATE POLICY material_orders_delete
  ON public.material_orders
  FOR DELETE
  TO authenticated
  USING (company_id = public.current_company_id());

-- scheduled_messages: existing INSERT and UPDATE policies already exist with
-- the right names; replace them with versions that include the feature gate.
-- SELECT and DELETE policies stay untouched.
DROP POLICY IF EXISTS scheduled_messages_insert_own_company ON public.scheduled_messages;
CREATE POLICY scheduled_messages_insert_own_company
  ON public.scheduled_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND public.company_has_feature(company_id, 'followups') = true
  );

DROP POLICY IF EXISTS scheduled_messages_update_own_company ON public.scheduled_messages;
CREATE POLICY scheduled_messages_update_own_company
  ON public.scheduled_messages
  FOR UPDATE
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND public.company_has_feature(company_id, 'followups') = true
  );

-- outbound_messages: no INSERT policy exists today (service-role only path).
-- We add one so any future authenticated-client insert path is gated.
-- Existing SELECT + DELETE policies stay untouched (reads always open).
DROP POLICY IF EXISTS outbound_messages_insert_own_company ON public.outbound_messages;
CREATE POLICY outbound_messages_insert_own_company
  ON public.outbound_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND public.company_has_feature(company_id, 'email_send') = true
  );

-- ----------------------------------------------------------------------------
-- 12. Day-0 grandfather
-- ----------------------------------------------------------------------------
-- Every pre-existing company is bumped to plan_code='pro' / status='active'.
-- Without this, the trigger's defaults would land them on 'trial' and we'd
-- ship a surprise downgrade to live users.
--
-- The condition `plan_started_at = now()` filter narrows the update to rows
-- that just got the new columns via the ALTER TABLE above (i.e. were created
-- before this migration ran). Trigger-driven defaults on future inserts
-- keep using 'trial'.

UPDATE public.companies
   SET plan_code           = 'pro',
       subscription_status = 'active',
       trial_ends_at       = NULL,
       plan_started_at     = created_at
 WHERE plan_code = 'trial'
   AND stripe_subscription_id IS NULL;

-- One audit row per grandfathered company.
INSERT INTO public.subscription_events (
  company_id, event_type, to_plan_code, to_status, notes
)
SELECT id, 'grandfathered', 'pro', 'active',
       'Grandfathered from pre-tier rollout (2026-05-15 migration)'
  FROM public.companies
 WHERE plan_code = 'pro'
   AND subscription_status = 'active'
   AND stripe_customer_id IS NULL;

COMMIT;

-- ============================================================================
-- End of subscription tiers phase 1 migration
-- ============================================================================
