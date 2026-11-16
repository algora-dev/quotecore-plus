-- QuoteCore+ Measurements Import (upload a file/photo -> extract measurement
-- lines -> map to pricing-library components -> confirm into the quote).
-- Additive only. Mirrors the pricing_setup_sessions / drafts pattern:
-- all writes are server-controlled; clients get read-only RLS.

CREATE TABLE IF NOT EXISTS public.quote_measurement_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_kind text NOT NULL CHECK (source_kind IN ('csv','xlsx','pdf','image','text')),
  source_name text NOT NULL DEFAULT 'Pasted measurements',
  library_id uuid REFERENCES public.component_collections(id) ON DELETE SET NULL,
  default_basis text NOT NULL DEFAULT 'plan' CHECK (default_basis IN ('plan','actual')),
  extracted_count integer NOT NULL DEFAULT 0 CHECK (extracted_count BETWEEN 0 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quote_measurement_imports_quote
  ON public.quote_measurement_imports (quote_id, created_at DESC);
ALTER TABLE public.quote_measurement_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quote_measurement_imports_own_read ON public.quote_measurement_imports;
CREATE POLICY quote_measurement_imports_own_read ON public.quote_measurement_imports
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.quote_measurement_import_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.quote_measurement_imports(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_index integer NOT NULL,
  source_excerpt text NOT NULL DEFAULT '',
  line_data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'candidate' CHECK(status IN ('candidate','selected','imported','skipped')),
  component_id uuid REFERENCES public.quote_components(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(import_id, source_index)
);
CREATE INDEX IF NOT EXISTS quote_measurement_import_lines_owner
  ON public.quote_measurement_import_lines (user_id, import_id, status);
ALTER TABLE public.quote_measurement_import_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quote_measurement_import_lines_own_read ON public.quote_measurement_import_lines;
CREATE POLICY quote_measurement_import_lines_own_read ON public.quote_measurement_import_lines
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Idempotency anchor: a confirmed line can never create two quote components,
-- even across retries or concurrent confirms (same pattern as
-- component_library.pricing_setup_draft_id).
ALTER TABLE public.quote_components ADD COLUMN IF NOT EXISTS measurement_import_line_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS quote_components_measurement_import_line_unique
  ON public.quote_components(measurement_import_line_id) WHERE measurement_import_line_id IS NOT NULL;

-- Daily AI-extract quota for measurements import, independent from pricing setup.
CREATE TABLE IF NOT EXISTS public.measurement_import_api_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_day date NOT NULL,
  operation text NOT NULL CHECK(operation IN ('extract')),
  calls integer NOT NULL DEFAULT 0 CHECK (calls >= 0),
  PRIMARY KEY(user_id, usage_day, operation)
);
ALTER TABLE public.measurement_import_api_usage ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.measurement_import_reserve_call(p_operation text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_limit integer; v_calls integer;
BEGIN
 IF auth.uid() IS NULL OR p_operation NOT IN ('extract') THEN RETURN false; END IF;
 v_limit := 15;
 INSERT INTO public.measurement_import_api_usage(user_id,usage_day,operation,calls)
 VALUES(auth.uid(),CURRENT_DATE,p_operation,1)
 ON CONFLICT (user_id,usage_day,operation) DO UPDATE
 SET calls = public.measurement_import_api_usage.calls + 1
 WHERE public.measurement_import_api_usage.calls < v_limit
 RETURNING calls INTO v_calls;
 RETURN v_calls IS NOT NULL;
END;$$;
REVOKE ALL ON FUNCTION public.measurement_import_reserve_call(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.measurement_import_reserve_call(text) TO authenticated;
