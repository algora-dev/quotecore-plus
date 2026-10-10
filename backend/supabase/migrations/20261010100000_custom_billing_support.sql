-- Custom billing support (Pricing V5 phase P2 — owner directives 2026-10-05 16:14, 2026-10-10 10:36):
-- additive storage for the calculator-driven subscription model. Does NOT replace
-- plan_code, legacy subscription_plans, effective-plan functions, RLS checks, dunning
-- or usage enforcement. No subscriptions are migrated by this file. No Stripe calls.
-- All existing companies default to billing_model 'legacy' — zero behaviour change.
-- Reference: QuoteCore-Pricing-Selector-V5.1-Handoff integration/sql/001_custom_billing_support.sql.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS billing_model text NOT NULL DEFAULT 'legacy';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qc_companies_billing_model_v5_check') THEN
    ALTER TABLE public.companies ADD CONSTRAINT qc_companies_billing_model_v5_check
      CHECK (billing_model IN ('legacy','custom_setup'));
  END IF;
END $$;

COMMENT ON COLUMN public.companies.billing_model IS 'Billing path discriminator: legacy (plan_code + subscription_plans) or custom_setup (V5 calculator multi-item subscription, read from company_custom_billing).';

-- Mode-scoped registry of the immutable Stripe prices the server will accept.
CREATE TABLE IF NOT EXISTS public.custom_billing_price_map (
  stripe_account_id text NOT NULL,
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test','live')),
  catalog_id text NOT NULL,
  catalog_revision text NOT NULL,
  component_code text NOT NULL,
  stripe_product_id text NOT NULL,
  stripe_price_id text NOT NULL,
  currency text NOT NULL,
  monthly_cents bigint NOT NULL CHECK (monthly_cents >= 0),
  -- Separate new-sale eligibility from continued recognition for existing subscribers.
  available_for_new_setups boolean NOT NULL DEFAULT false,
  entitlements jsonb NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stripe_account_id, stripe_mode, stripe_price_id),
  UNIQUE (stripe_account_id, stripe_mode, catalog_id, catalog_revision, component_code)
);

-- The purchased snapshot: one row per company on the custom path. Purchase detail
-- is not itself an access grant; existing lifecycle gates still apply.
CREATE TABLE IF NOT EXISTS public.company_custom_billing (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id),
  stripe_account_id text NOT NULL,
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test','live')),
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text NOT NULL,
  catalog_id text NOT NULL,
  catalog_revision text NOT NULL,
  component_codes jsonb NOT NULL,
  purchased_entitlements jsonb NOT NULL,
  provider_status text NOT NULL,
  currency text NOT NULL,
  monthly_cents bigint NOT NULL CHECK (monthly_cents >= 0),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL CHECK (period_end > period_start),
  last_paid_invoice_id text,
  legacy_plan_code_snapshot text,
  reconciled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stripe_account_id, stripe_mode, stripe_subscription_id)
);

-- Durable per-company operation log (checkout / change / legacy switch) with a
-- single-open-operation guard per company+mode.
CREATE TABLE IF NOT EXISTS public.custom_billing_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test','live')),
  operation_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('checkout','change','legacy_switch','renewal')),
  status text NOT NULL CHECK (status IN ('proposed','confirmed','pending','applied','failed','canceled')),
  subscription_id text,
  catalog_revision text NOT NULL,
  proposed_component_codes jsonb NOT NULL,
  provider_invoice_id text,
  provider_checkout_id text,
  provider_schedule_id text,
  requested_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, stripe_mode, operation_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS custom_billing_one_open_change
ON public.custom_billing_operations (company_id, stripe_mode)
WHERE kind IN ('checkout','change','legacy_switch') AND status IN ('confirmed','pending');

-- One period-open record per subscription period, not one reset per webhook/invoice.
CREATE TABLE IF NOT EXISTS public.custom_billing_period_grants (
  company_id uuid NOT NULL REFERENCES public.companies(id),
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test','live')),
  subscription_id text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  invoice_id text NOT NULL,
  granted_limits jsonb NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, stripe_mode, subscription_id, period_start),
  UNIQUE (stripe_mode, invoice_id),
  CHECK (period_end > period_start)
);

-- All writes and reads go through authenticated, company-authorized server code /
-- service role. Never expose these tables through client-accessible queries.
ALTER TABLE public.custom_billing_price_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_custom_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_billing_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_billing_period_grants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.custom_billing_price_map, public.company_custom_billing,
  public.custom_billing_operations, public.custom_billing_period_grants FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_billing_price_map, public.company_custom_billing,
  public.custom_billing_operations, public.custom_billing_period_grants TO service_role;
