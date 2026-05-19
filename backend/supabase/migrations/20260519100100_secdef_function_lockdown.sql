-- Gerald audit C-02 + audit of every SECURITY DEFINER function in public.
--
-- Background: Postgres functions default to EXECUTE granted to PUBLIC.
-- Combined with SECURITY DEFINER, that means any authenticated (or anon!)
-- caller can invoke the function with the OWNER's privileges, ignoring
-- caller-side RLS on whatever the function touches. Some of our helpers
-- are MEANT to be PUBLIC (they back RLS policies and need to be reachable
-- from `authenticated`). Others are intended to be server-side only and
-- were never locked down.
--
-- This migration explicitly REVOKEs + GRANTs every SECURITY DEFINER
-- function under public, so the policy is documented as code rather than
-- inherited default.
--
-- Decisions (verified via current pg_proc.proacl inventory 2026-05-19):
--
--   SERVICE-ROLE ONLY (mutating or sensitive-by-callsite):
--     - create_quote_atomic(uuid, uuid, jsonb)         [Gerald C-02 — was PUBLIC]
--     - get_next_quote_number(uuid)                    [mutates quote_number_counters]
--     - require_component_slot(uuid)                   [advisory-lock + cap check; only meaningful from inside a transaction the server controls]
--     - require_flashing_slot(uuid)                    [same]
--     - handle_new_auth_user()                         [auth.users trigger, must remain callable by postgres/supabase_auth_admin; not user-callable]
--     - prune_rate_limits()                            [was accidentally EXECUTE-to-anon/authenticated; should be service-role/cron only]
--
--   AUTHENTICATED OK (read-only, backs RLS policies or UI counts):
--     - company_has_feature(uuid, text)
--     - company_effective_plan_code(uuid)
--     - company_effective_plan_active(uuid)
--     - user_belongs_to_company(uuid)
--     - current_company_id()
--     - company_component_count(uuid)
--     - company_flashing_count(uuid)
--
--   ALREADY LOCKED (verified, no change):
--     - consume_rate_limit(text, int, int)             [service_role only — H-01 closure migration]

BEGIN;

-- =============================================================================
-- Service-role-only functions
-- =============================================================================

REVOKE ALL ON FUNCTION public.create_quote_atomic(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_quote_atomic(uuid, uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.get_next_quote_number(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_next_quote_number(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.require_component_slot(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.require_component_slot(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.require_flashing_slot(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.require_flashing_slot(uuid) TO service_role;

-- handle_new_auth_user is wired as a trigger on auth.users. It executes
-- with the owner's privileges automatically; callers do not invoke it
-- directly. Lock down PUBLIC just so a sneaky `SELECT public.handle_new_auth_user();`
-- can't be used to provision rows out of band.
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
-- (No GRANT needed; the trigger fires under the table owner's authority.)

-- prune_rate_limits is called from the (yet-to-wire) Vercel cron route
-- under the service-role client. There is no scenario where authenticated
-- or anon should reach it.
REVOKE ALL ON FUNCTION public.prune_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.prune_rate_limits() TO service_role;

-- =============================================================================
-- Authenticated-callable functions (revoke anon, re-grant authenticated only)
-- =============================================================================
-- These back RLS policies under `{authenticated}` roles (verified via
-- pg_policies 2026-05-19). No public/accept route needs them as anon; the
-- public accept-quote page goes through service-role with its own scoping.

REVOKE ALL ON FUNCTION public.company_has_feature(uuid, text)            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.company_effective_plan_code(uuid)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.company_effective_plan_active(uuid)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_belongs_to_company(uuid)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_company_id()                       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.company_component_count(uuid)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.company_flashing_count(uuid)               FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.company_has_feature(uuid, text)            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.company_effective_plan_code(uuid)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.company_effective_plan_active(uuid)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_company(uuid)              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_company_id()                       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.company_component_count(uuid)              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.company_flashing_count(uuid)               TO authenticated, service_role;

COMMIT;
