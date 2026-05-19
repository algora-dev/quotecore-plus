-- Gerald audit M-02: keep raw Stripe payloads service-role only.
--
-- The phase-1 subscription_events migration set up
-- `subscription_events_select_own` letting any company member SELECT
-- their own audit rows including `stripe_payload jsonb` (full webhook
-- event payload from Stripe). Stripe payloads can include customer
-- metadata, payment-source fingerprints, and other internal billing
-- detail that shouldn't be visible to non-admin company users.
--
-- Strategy:
--   1. DROP the user-facing SELECT policy on subscription_events. Only
--      service_role (admin client / webhooks / crons) retains access.
--   2. Add a redacted view `subscription_events_audit_v1` exposing only
--      the user-visible fields (event_type, plan/status transitions,
--      notes, timestamps) for future audit-trail UI. The view does NOT
--      expose stripe_payload, stripe_event_id, or stripe_event_type.
--   3. Grant SELECT on the view to authenticated under the same tenant
--      scoping the dropped policy enforced.
--
-- App code today doesn't SELECT subscription_events from a user-context
-- client (verified via grep on 2026-05-19 \u2014 all reads/writes are via the
-- service-role admin client), so this change is non-breaking for
-- shipped UI.

BEGIN;

-- 1) Remove the user-facing SELECT policy. RLS remains ENABLED so the
-- default-deny applies; service_role bypasses RLS.
DROP POLICY IF EXISTS subscription_events_select_own ON public.subscription_events;

-- Defensive: revoke any direct SELECT from authenticated even though
-- the policy was the actual gate.
REVOKE SELECT ON public.subscription_events FROM authenticated;
REVOKE SELECT ON public.subscription_events FROM anon;

-- 2) Redacted view for future audit-trail UI. SECURITY INVOKER (default)
-- so RLS on subscription_events doesn't apply through the view \u2014 the
-- view's own grants + the WHERE clause are the access boundary.
-- Postgres 15+ defaults to security_invoker=true for views, but we set
-- it explicitly here for clarity and forward-compat.
CREATE OR REPLACE VIEW public.subscription_events_audit_v1
WITH (security_invoker = on)
AS
SELECT
  id,
  company_id,
  event_type,
  from_plan_code,
  to_plan_code,
  from_status,
  to_status,
  notes,
  actor_user_id,
  created_at
FROM public.subscription_events
WHERE public.user_belongs_to_company(company_id);

COMMENT ON VIEW public.subscription_events_audit_v1 IS
  'User-visible audit trail of subscription transitions. Excludes raw Stripe payload, stripe_event_id, and stripe_event_type. Scoped to caller''s company via user_belongs_to_company().';

GRANT SELECT ON public.subscription_events_audit_v1 TO authenticated;

COMMIT;
