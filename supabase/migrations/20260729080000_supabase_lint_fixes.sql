-- 20260729080000_supabase_lint_fixes.sql
-- Fixes for Supabase Performance & Security Lints email (2026-07-29)
-- All 3 issues resolved: 1 SECURITY DEFINER view, 2 RLS-disabled tables

-- 1. Recreate subscription_events_audit_v1 as SECURITY INVOKER (default)
--    Was SECURITY DEFINER, which bypasses RLS on underlying subscription_events.
--    Now the view runs as the querying user, and a new RLS policy on
--    subscription_events allows users to read their own company's events.
DROP VIEW IF EXISTS public.subscription_events_audit_v1;
CREATE VIEW public.subscription_events_audit_v1 AS
SELECT id,
    company_id,
    event_type,
    from_plan_code,
    to_plan_code,
    from_status,
    to_status,
    notes,
    actor_user_id,
    created_at
FROM subscription_events
WHERE user_belongs_to_company(company_id);

-- RLS policy on subscription_events (was RLS-enabled but had zero policies)
CREATE POLICY "Users can read own company subscription events"
ON public.subscription_events
FOR SELECT
USING (user_belongs_to_company(company_id));

-- 2. Enable RLS on ai_scan_jobs (was public with no RLS)
ALTER TABLE public.ai_scan_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own company AI scan jobs"
ON public.ai_scan_jobs
FOR SELECT
USING (company_id = current_company_id());

CREATE POLICY "Users can insert own company AI scan jobs"
ON public.ai_scan_jobs
FOR INSERT
WITH CHECK (company_id = current_company_id());

CREATE POLICY "Users can update own company AI scan jobs"
ON public.ai_scan_jobs
FOR UPDATE
USING (company_id = current_company_id())
WITH CHECK (company_id = current_company_id());

-- 3. Enable RLS on company_quota_offsets (was public with no RLS)
ALTER TABLE public.company_quota_offsets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own company quota offsets"
ON public.company_quota_offsets
FOR SELECT
USING (company_id = current_company_id());
