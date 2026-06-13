-- =====================================================================
-- 20260613150000_assistant_token_usage_atomic.sql
-- Gerald pre-live audit M-04: assistant token accounting can race and
-- undercount spend.
--
-- recordTokenUsage() did select -> (update | insert), so two concurrent
-- turns for the same (company,user,day) both read the same base and one
-- increment is lost, weakening the daily/monthly budget ceilings.
--
-- Replace with an atomic INSERT ... ON CONFLICT DO UPDATE that increments
-- in a single statement, keyed on the existing UNIQUE
-- (company_id, user_id, usage_date). service_role only (called from the
-- server cost guard via the service client).
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.increment_assistant_token_usage(
  p_company_id uuid,
  p_user_id    uuid,
  p_usage_date date,
  p_month_key  text,
  p_tokens     integer
)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  INSERT INTO public.assistant_token_usage
    (company_id, user_id, usage_date, month_key, total_tokens)
  VALUES
    (p_company_id, p_user_id, p_usage_date, p_month_key, GREATEST(p_tokens, 0))
  ON CONFLICT (company_id, user_id, usage_date)
  DO UPDATE SET
    total_tokens = public.assistant_token_usage.total_tokens + GREATEST(EXCLUDED.total_tokens, 0),
    updated_at   = now();
$$;

COMMENT ON FUNCTION public.increment_assistant_token_usage IS
  'M-04: atomic per-(company,user,day) token increment. Replaces the raceable select-then-update in recordTokenUsage so concurrent turns cannot lose increments.';

REVOKE ALL ON FUNCTION public.increment_assistant_token_usage(uuid, uuid, date, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_assistant_token_usage(uuid, uuid, date, text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_assistant_token_usage(uuid, uuid, date, text, integer) TO service_role;

COMMIT;
