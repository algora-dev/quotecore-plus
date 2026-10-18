-- Smart Assistant access rewire (owner 2026-10-17): the subscription decides
-- access. Custom plans include the Assistant when the purchased task
-- allowance is above zero; legacy plans do NOT include it. This RPC exposes
-- the explicit admin override row so the admin page can force access ON
-- (internal testing) or OFF (emergency kill switch). NULL = no override:
-- the subscription decides. Additive; no table changes.
CREATE OR REPLACE FUNCTION public.smart_assistant_override_state(p_company_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT CASE f.enabled
    WHEN true THEN 'force_on'
    WHEN false THEN 'force_off'
  END
  FROM public.assistant_feature_flags f
  WHERE f.company_id = p_company_id;
$$;

REVOKE EXECUTE ON FUNCTION public.smart_assistant_override_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.smart_assistant_override_state(uuid) TO authenticated;
