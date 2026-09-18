-- patch_042: Smart Assistant feature flag (dark launch)
-- Per-company exposure flag, separate from entitlements/billing.
-- DELIBERATELY NOT a column on companies: companies_update_own lets any member
-- UPDATE their company row, so a column there could be self-enabled from the
-- client. This table has SELECT-only RLS for members; all writes are
-- service-role (admin panel only). Flag off = assistant invisible everywhere.

-- 1) Flags table
CREATE TABLE IF NOT EXISTS public.assistant_feature_flags (
  company_id uuid NOT NULL PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id)
);

COMMENT ON TABLE public.assistant_feature_flags IS
  'Smart Assistant dark-launch exposure flag. Writes are service-role only (admin panel). Absence of a row = disabled.';

-- 2) RLS on, members can read (nav/route gating), nobody else.
ALTER TABLE public.assistant_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assistant_feature_flags_read_own ON public.assistant_feature_flags;
CREATE POLICY assistant_feature_flags_read_own ON public.assistant_feature_flags
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_company(company_id));

-- No INSERT/UPDATE/DELETE policies: writes are service-role only.

-- 3) Helper fn used by gating code (defensive default: disabled).
CREATE OR REPLACE FUNCTION public.smart_assistant_enabled(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT f.enabled FROM public.assistant_feature_flags f
      WHERE f.company_id = p_company_id),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.smart_assistant_enabled(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.smart_assistant_enabled(uuid) TO authenticated;

-- 4) Enable for Shaun's test company (owner secarter23@gmail.com).
INSERT INTO public.assistant_feature_flags (company_id, enabled)
SELECT u.company_id, true
FROM public.users u
WHERE u.email = 'secarter23@gmail.com' AND u.role = 'owner' AND u.company_id IS NOT NULL
ON CONFLICT (company_id) DO UPDATE SET enabled = true, updated_at = now();

-- Cross-tenant FK consistency: flags must point at real companies (FK enforces).
