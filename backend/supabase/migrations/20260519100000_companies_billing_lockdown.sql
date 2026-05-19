-- Gerald audit C-01: Lock down direct UPDATE access to billing columns on
-- public.companies. The original `companies_update_own` RLS policy let any
-- authenticated company member update ANY column on their own company row,
-- including plan_code, subscription_status, Stripe IDs, comp_until,
-- storage_topup_bytes, and dunning timers. PostgREST-style direct writes
-- could self-upgrade tier or fake comp entitlement.
--
-- Strategy:
--   1. Revoke table-level UPDATE on public.companies from anon + authenticated.
--   2. Grant column-level UPDATE ONLY on the safe profile columns the app
--      legitimately edits from a user-context Supabase client.
--   3. Keep `companies_update_own` RLS policy in place so even those
--      column-level updates remain scoped to the user's own company.
--   4. service_role is unaffected (bypasses RLS + privileges) so the Stripe
--      webhook, crons, and admin client continue to manage billing state.
--
-- Whitelist derived from grep across app/ for `.from('companies').update(`
-- under a user-context (non-admin) supabase client:
--   - onboarding/actions.ts: default_currency, default_language,
--     default_measurement_system, onboarding_completed_at
--   - settings/actions.ts: name, default_currency, default_language,
--     default_measurement_system, default_material_margin_percent,
--     default_labor_margin_percent
--   - account/actions.ts: name, default_tax_rate, default_currency,
--     default_measurement_system
--   - lib/data/company-context.ts: slug (workspace-slug change flow)
--
-- Everything else (plan_code, subscription_status, stripe_*, seat_count,
-- storage_*, trial_*, dunning_*, cancel_*, comp_*, current_period_end) is
-- service-role only from here on.

BEGIN;

-- 1) Revoke broad UPDATE. Future column adds will need an explicit GRANT
-- here, so new billing/sensitive columns fail-closed to authenticated.
REVOKE UPDATE ON public.companies FROM anon;
REVOKE UPDATE ON public.companies FROM authenticated;

-- 2) Column-level UPDATE whitelist for authenticated users. Combined with
-- the `companies_update_own` RLS policy, an authenticated user can only
-- update these columns on their OWN company row.
GRANT UPDATE (
  name,
  slug,
  default_currency,
  default_language,
  default_tax_rate,
  default_measurement_system,
  default_material_margin_percent,
  default_labor_margin_percent,
  onboarding_completed_at,
  updated_at
) ON public.companies TO authenticated;

-- 3) Refresh the RLS policy. Functionally identical to the previous
-- companies_update_own, but pinned here so the dependency chain is
-- explicit and future audits see this migration as the canonical source.
DROP POLICY IF EXISTS companies_update_own ON public.companies;
CREATE POLICY companies_update_own ON public.companies
  FOR UPDATE
  TO authenticated
  USING (public.user_belongs_to_company(id))
  WITH CHECK (public.user_belongs_to_company(id));

-- 4) Defensive: also revoke INSERT and DELETE from authenticated. New
-- company rows are created via the signup flow (service-role) and a
-- direct INSERT path was never intended to be reachable from the client.
-- DELETE is admin-only.
REVOKE INSERT, DELETE ON public.companies FROM anon;
REVOKE INSERT, DELETE ON public.companies FROM authenticated;

-- 5) SELECT remains open under the existing companies_select_own RLS
-- policy. We DO NOT want to lock SELECT here because pages legitimately
-- read plan_code / subscription_status to render entitlement UI.
-- (Raw stripe_subscription_id etc are read by these same paths; if we
-- later want to hide them from client reads we'll add a view rather than
-- locking the table.)

COMMIT;
