-- Live Demo foundation (Phase 1 of Architecture V2 — docs/demo/ARCHITECTURE_V2_2026-09-26.md)
-- All additive. Every switch defaults OFF (dark launch: nothing goes live until
-- the owner flips demo_control in the admin panel).

-- 1) Demo plan row. Not user-visible: the paywall filters plans by an explicit
--    visible-code set (app/lib/billing/paywall-plans.ts) and this row carries no
--    Stripe price ids, so it can never be surfaced for purchase. feat_email_send
--    stays false as defence-in-depth (demo tenants must never send email).
INSERT INTO public.subscription_plans (
  code, display_name, monthly_quote_limit, storage_limit_bytes, included_seats,
  feat_digital_takeoff, feat_flashings, feat_material_orders, feat_followups,
  feat_email_send, feat_activity_card, feat_invoices, feat_message_center,
  feat_catalogs, feat_attachment_library,
  price_cents_monthly, sort_order, active, coming_soon, tagline,
  component_limit, flashing_limit, monthly_material_order_limit, monthly_invoice_limit,
  catalog_limit, attachment_limit,
  monthly_ai_tokens, ai_assist_points_limit, monthly_ai_parse_limit
) VALUES (
  'demo', 'Live Demo', 100, 5368709120, 1,
  true, true, true, true,
  false, true, true, true,
  true, true,
  0, 99, true, true, 'Interactive sandbox — explore the real product',
  200, 100, 50, 50,
  10, 25,
  20000, 100, 20
) ON CONFLICT (code) DO NOTHING;

-- 2) Master kill switches (owner requirement 2026-09-28): demo off / AI off,
--    database-backed so a flip takes effect on the next request with no deploy.
CREATE TABLE IF NOT EXISTS public.demo_control (
  id integer PRIMARY KEY,
  demo_enabled boolean NOT NULL DEFAULT false,
  ai_enabled   boolean NOT NULL DEFAULT false,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid
);
INSERT INTO public.demo_control (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 3) Demo sessions (Architecture §7/§15). company_id is SET NULL on delete so
--    the session row survives as a tombstone after company cleanup.
CREATE TABLE IF NOT EXISTS public.demo_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  template_version text NOT NULL DEFAULT 'v0',
  ip_hmac text,
  status text NOT NULL DEFAULT 'provisioning'
    CHECK (status IN ('provisioning','active','terminating','expired','cleanup_pending','cleanup_failed','deleted','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  expires_at timestamptz,
  last_seen_at timestamptz,
  tutorial_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  reset_count integer NOT NULL DEFAULT 0,
  cleanup_started_at timestamptz,
  cleanup_finished_at timestamptz,
  failure_context jsonb
);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_company ON public.demo_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_anon   ON public.demo_sessions(anon_user_id);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_status ON public.demo_sessions(status);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_expires ON public.demo_sessions(expires_at);

-- 4) AI usage ledger (Architecture §11).
CREATE TABLE IF NOT EXISTS public.demo_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_session_id uuid NOT NULL REFERENCES public.demo_sessions(id) ON DELETE CASCADE,
  ip_hmac text,
  action_type text NOT NULL,
  action_variant text,
  reservation_credits integer NOT NULL DEFAULT 0,
  actual_credits integer,
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved','settled','released','denied')),
  provider text,
  model text,
  request_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_demo_usage_session ON public.demo_usage(demo_session_id);
CREATE INDEX IF NOT EXISTS idx_demo_usage_status  ON public.demo_usage(status);
CREATE INDEX IF NOT EXISTS idx_demo_usage_created ON public.demo_usage(created_at);

-- 5) Atomic budget counters (Architecture §11: session + IP scopes).
CREATE TABLE IF NOT EXISTS public.demo_budget_counters (
  scope text NOT NULL CHECK (scope IN ('session','ip')),
  scope_key text NOT NULL,
  window_start timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  reserved_credits integer NOT NULL DEFAULT 0,
  settled_credits integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, scope_key, window_start)
);

-- 6) RLS: enable on all demo tables with NO policies. Only the service role
--    (which bypasses RLS) may read/write them. Anonymous/authenticated users
--    get nothing, even if a route leaks.
ALTER TABLE public.demo_control         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_usage           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_budget_counters ENABLE ROW LEVEL SECURITY;

-- 7) Security fix flagged by Architecture §6: quote_files INSERT policy was
--    WITH CHECK(true) (any authenticated user could insert into any company).
--    Scope it to the user's own company, same shape as the table's other
--    policies. Legitimate own-company inserts are unaffected.
DROP POLICY IF EXISTS quote_files_insert_authenticated ON public.quote_files;
CREATE POLICY quote_files_insert_authenticated ON public.quote_files
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT users.company_id FROM public.users WHERE users.id = auth.uid())
  );

-- VERIFY AFTER APPLY:
--   SELECT code, active FROM subscription_plans WHERE code='demo';
--   SELECT demo_enabled, ai_enabled FROM demo_control WHERE id=1;
--   SELECT count(*) FROM pg_tables WHERE tablename LIKE 'demo_%';  -- expect 4
--   SELECT policyname, with_check FROM pg_policies WHERE tablename='quote_files' AND cmd='INSERT';
