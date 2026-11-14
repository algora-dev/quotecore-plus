-- QuoteCore+ Pricing Setup. Additive only. Apply after verifying the migration ledger.
-- All draft and order writes are server-controlled using an authenticated company context.
CREATE TABLE IF NOT EXISTS public.pricing_setup_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  always_open_library boolean NOT NULL DEFAULT false,
  seen_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pricing_setup_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pricing_setup_preferences_own_read ON public.pricing_setup_preferences;
CREATE POLICY pricing_setup_preferences_own_read ON public.pricing_setup_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Only trusted server code may update preferences, never arbitrary client calls.

CREATE TABLE IF NOT EXISTS public.pricing_setup_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_kind text NOT NULL CHECK (source_kind IN ('csv','xlsx','pdf','image','text','voice')),
  source_name text NOT NULL DEFAULT 'Pasted pricing',
  source_basis text NOT NULL DEFAULT 'unknown' CHECK (source_basis IN ('unknown','purchase','selling','mixed')),
  extracted_count integer NOT NULL DEFAULT 0 CHECK (extracted_count BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pricing_setup_sessions_owner ON public.pricing_setup_sessions (user_id, created_at DESC);
ALTER TABLE public.pricing_setup_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pricing_setup_sessions_own_read ON public.pricing_setup_sessions;
CREATE POLICY pricing_setup_sessions_own_read ON public.pricing_setup_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.pricing_setup_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.pricing_setup_sessions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_index integer NOT NULL,
  source_excerpt text NOT NULL DEFAULT '',
  draft_data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'candidate' CHECK(status IN ('candidate','selected','confirmed','saved','skipped')),
  confirmed_hash text,
  confirmed_at timestamptz,
  component_id uuid REFERENCES public.component_library(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id,source_index)
);
CREATE INDEX IF NOT EXISTS pricing_setup_drafts_owner ON public.pricing_setup_drafts(user_id,session_id,status);
ALTER TABLE public.pricing_setup_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pricing_setup_drafts_own_read ON public.pricing_setup_drafts;
CREATE POLICY pricing_setup_drafts_own_read ON public.pricing_setup_drafts FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Idempotency anchor: imported components remain unique across retries/concurrent bulk saves.
ALTER TABLE public.component_library ADD COLUMN IF NOT EXISTS pricing_setup_draft_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS component_library_pricing_setup_draft_unique
  ON public.component_library(pricing_setup_draft_id) WHERE pricing_setup_draft_id IS NOT NULL;

-- Quota for free/workspace onboarding AI, independent from the general Smart Assistant.
CREATE TABLE IF NOT EXISTS public.pricing_setup_api_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_day date NOT NULL,
  operation text NOT NULL CHECK(operation IN ('extract','voice','explain')),
  calls integer NOT NULL DEFAULT 0 CHECK(calls >= 0),
  PRIMARY KEY(user_id,usage_day,operation)
);
ALTER TABLE public.pricing_setup_api_usage ENABLE ROW LEVEL SECURITY;
-- No client access. The SECURITY DEFINER function derives identity from auth.uid().
CREATE OR REPLACE FUNCTION public.pricing_setup_reserve_call(p_operation text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_limit integer; v_calls integer;
BEGIN
 IF auth.uid() IS NULL OR p_operation NOT IN ('extract','voice','explain') THEN RETURN false; END IF;
 v_limit := CASE p_operation WHEN 'extract' THEN 10 WHEN 'voice' THEN 20 ELSE 30 END;
 INSERT INTO public.pricing_setup_api_usage(user_id,usage_day,operation,calls)
 VALUES(auth.uid(),CURRENT_DATE,p_operation,1)
 ON CONFLICT (user_id,usage_day,operation) DO UPDATE
 SET calls = public.pricing_setup_api_usage.calls + 1
 WHERE public.pricing_setup_api_usage.calls < v_limit
 RETURNING calls INTO v_calls;
 RETURN v_calls IS NOT NULL;
END;$$;
REVOKE ALL ON FUNCTION public.pricing_setup_reserve_call(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pricing_setup_reserve_call(text) TO authenticated;

-- Human service orders are separate from subscriptions and component quotas.
CREATE TABLE IF NOT EXISTS public.pricing_quick_start_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 contact_email text NOT NULL,
 notes text NOT NULL DEFAULT '',
 file_paths text[] NOT NULL DEFAULT '{}',
 status text NOT NULL DEFAULT 'pending_payment' CHECK(status IN ('pending_payment','paid','in_progress','ready_for_review','completed','payment_failed','cancelled')),
 stripe_session_id text UNIQUE,
 paid_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pricing_quick_start_orders_owner ON public.pricing_quick_start_orders (company_id, created_at DESC);
ALTER TABLE public.pricing_quick_start_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pricing_quick_start_orders_own_read ON public.pricing_quick_start_orders;
CREATE POLICY pricing_quick_start_orders_own_read ON public.pricing_quick_start_orders FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Private server-managed bucket. No storage.objects policy means client-side access is denied.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('pricing-quick-start','pricing-quick-start',false,8388608,
 ARRAY['application/pdf','text/csv','text/plain','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/png','image/jpeg','image/webp'])
ON CONFLICT(id) DO NOTHING;
