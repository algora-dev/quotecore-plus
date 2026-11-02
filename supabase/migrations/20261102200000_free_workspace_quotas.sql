-- Free Workspace quotas (owner-approved 2026-11-02 19:23).
-- Monthly windows for the admin-free full-access grant: the period rolls to
-- the current calendar month, so every ledger-enforced quota (quotes created,
-- scan tokens, assistant tasks) resets monthly with zero changes to the
-- enforcement RPCs. New per-item caps live as extra purchased_entitlements keys:
--   quotes 10 (creation trigger) / quoteSends 5 / scanTokens 12 /
--   assistantTasks 20 / storageBytes 1GB / componentLimit 15 (lifetime) /
--   offcutGenerations 2 (monthly)

-- 1. Idempotent period refresh; only ever touches admin-free marker rows.
CREATE OR REPLACE FUNCTION public.qcp_admin_free_period_refresh(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.company_custom_billing
     SET period_start = date_trunc('month', now()),
         period_end   = date_trunc('month', now()) + interval '1 month',
         reconciled_at = now()
   WHERE company_id = p_company_id
     AND stripe_customer_id = 'admin-granted'
     AND stripe_subscription_id LIKE 'admin-free-%'
     AND period_end <= now();
END;
$$;

REVOKE ALL ON FUNCTION public.qcp_admin_free_period_refresh(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qcp_admin_free_period_refresh(uuid) TO service_role;

COMMENT ON FUNCTION public.qcp_admin_free_period_refresh(uuid) IS 'Roll admin-free (Free Workspace) grants to the current calendar month so ledger quotas reset monthly. Forward-only, idempotent.';

-- 2. Existing free workspaces -> the new limits + current-month period.
--    jsonb merge keeps capacity/digitalTakeoff/offcuts flags already present.
UPDATE public.company_custom_billing
   SET purchased_entitlements = purchased_entitlements || jsonb_build_object(
         'quotes', 10,
         'quoteSends', 5,
         'scanTokens', 12,
         'assistantTasks', 20,
         'storageBytes', 1000000000,
         'componentLimit', 15,
         'offcutGenerations', 2
       ),
       period_start = date_trunc('month', now()),
       period_end   = date_trunc('month', now()) + interval '1 month',
       reconciled_at = now()
 WHERE stripe_customer_id = 'admin-granted'
   AND stripe_subscription_id LIKE 'admin-free-%';

-- 3. Daily safety net so stale periods never block usage (app refreshes on
--    workspace loads too). pg_cron replaces jobs scheduled with the same name.
SELECT cron.schedule(
  'qcp-admin-free-period-refresh',
  '17 3 * * *',
  $cron$
    SELECT public.qcp_admin_free_period_refresh(company_id)
      FROM public.company_custom_billing
     WHERE stripe_customer_id = 'admin-granted'
       AND stripe_subscription_id LIKE 'admin-free-%'
       AND period_end <= now();
  $cron$
);

-- 4. Demo toggle visibility + workspace activity metric (demo tracking).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS hide_demo_toggle boolean NOT NULL DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NULL;
