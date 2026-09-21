-- patch_054: Mobile takeoff owner-run diagnostics capture (M9).
-- Lightweight client-side event buffer is POSTed by the "Send diagnostics"
-- menu action to /api/takeoff-diagnostics, which inserts with the SERVICE
-- ROLE (bypasses RLS; clients never write directly). Members can SELECT their
-- own company's rows so support can pull a reported reference id.
-- Additive ONLY - no existing object touched.

-- 1) Diagnostics table.
CREATE TABLE IF NOT EXISTS public.takeoff_diagnostics (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  user_agent text NOT NULL DEFAULT '',
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.takeoff_diagnostics IS
  'Owner-run mobile takeoff diagnostics uploads (M9). Written only by the service role via /api/takeoff-diagnostics; readable by members of the owning company.';

CREATE INDEX IF NOT EXISTS takeoff_diagnostics_company_created_idx
  ON public.takeoff_diagnostics (company_id, created_at DESC);

-- 2) RLS: members of the owning company may read; nobody writes via client
--    roles (insert is service-role only - no INSERT policy).
ALTER TABLE public.takeoff_diagnostics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS takeoff_diagnostics_read_own ON public.takeoff_diagnostics;
CREATE POLICY takeoff_diagnostics_read_own ON public.takeoff_diagnostics
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_company(company_id));

GRANT SELECT ON public.takeoff_diagnostics TO authenticated;
