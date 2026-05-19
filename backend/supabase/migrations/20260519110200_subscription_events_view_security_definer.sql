-- Gerald pass-3 evidence: M-02 redacted view must be readable by
-- authenticated users.
--
-- The 20260519100400 migration created subscription_events_audit_v1 as a
-- security_invoker view. That requires the caller to have SELECT on the
-- underlying table, which we just revoked. The view consequently returns
-- "permission denied for table subscription_events".
--
-- Fix: switch to security_invoker=off (security_definer view). The view
-- runs with the view-owner's privileges (postgres / supabase_admin), which
-- has SELECT on the underlying table. The view's own WHERE clause +
-- column projection are the access boundary: it excludes stripe_payload /
-- stripe_event_id / stripe_event_type and scopes rows via
-- user_belongs_to_company(company_id). authenticated still has SELECT on
-- the view itself (granted in the original migration).

BEGIN;

ALTER VIEW public.subscription_events_audit_v1 SET (security_invoker = off);

COMMIT;
