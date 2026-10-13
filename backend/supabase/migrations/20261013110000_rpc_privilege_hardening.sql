-- Pre-live RPC privilege hardening (external audit 2026-10-13 C-01..C-04, verified live).
-- Worker/admin SECURITY DEFINER functions: revoke PUBLIC/anon/authenticated, service_role only.
-- App call sites that legitimately need these now use service-role clients:
--   scan-jobs route (submit/cancel), ai-scan-v3 route (points), scan-worker (queue),
--   takeoff page (points status + system seeding), supplier publish actions, entitlements,
--   seed lib, integrations dispatch, admin actions + stripe webhook (points reset).
-- save_takeoff_atomic stays authenticated-callable but gains a company-membership guard.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- AI scan queue (worker-only)
REVOKE ALL ON FUNCTION public.claim_ai_scan_job(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ai_scan_job(integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.complete_ai_scan_job(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ai_scan_job(uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.fail_ai_scan_job(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_ai_scan_job(uuid, text, text, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.requeue_stale_scan_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_stale_scan_jobs(integer) TO service_role;
REVOKE ALL ON FUNCTION public.update_scan_stage(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_scan_stage(uuid, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.submit_ai_scan_job(uuid, uuid, uuid, uuid, text, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_ai_scan_job(uuid, uuid, uuid, uuid, text, text, text, integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.cancel_ai_scan_job(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_ai_scan_job(uuid, uuid) TO service_role;

-- AI points quota (server-side admission only)
REVOKE ALL ON FUNCTION public.check_and_deduct_ai_points(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_deduct_ai_points(uuid, integer) TO service_role;
REVOKE ALL ON FUNCTION public.refund_ai_scan_points(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_ai_scan_points(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.reset_ai_assist_points(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_ai_assist_points(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_ai_assist_points_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_assist_points_status(uuid) TO service_role;

-- Takeoff seeding + unused legacy helpers
REVOKE ALL ON FUNCTION public.ensure_ai_system_components(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_ai_system_components(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.seed_starter_components(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_starter_components(uuid, uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.set_quote_created_by_email() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_quote_created_by_email() TO service_role;

-- Supplier publication + component-limit reconciliation (privileged mutations)
REVOKE ALL ON FUNCTION public.supplier_publish_update(uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_publish_update(uuid, jsonb, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.reconcile_company_component_limit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_company_component_limit(uuid) TO service_role;

-- Integration credential decryption (server-side key-gated flows only)
REVOKE ALL ON FUNCTION public.decrypt_credential(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_credential(text, text) TO service_role;
REVOKE ALL ON FUNCTION public.get_integration_credential(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_integration_credential(uuid, text, text) TO service_role;

-- Dead superseded save path (no callers in app or tarball)
REVOKE ALL ON FUNCTION public.save_takeoff_atomic_v2(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_takeoff_atomic_v2(uuid, jsonb) TO service_role;

-- save_takeoff_atomic: keep authenticated (client save path) but require the
-- caller to be a member of the company that owns the quote. Service role
-- bypasses for server-side flows. Minimal diff from the live definition.
CREATE OR REPLACE FUNCTION public.save_takeoff_atomic(p_quote_id uuid, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    PERFORM public.save_takeoff_atomic_internal(p_quote_id, p_payload);
    RETURN;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.quotes q
    JOIN public.users u ON u.company_id = q.company_id
    WHERE q.id = p_quote_id
      AND u.id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  PERFORM public.save_takeoff_atomic_internal(p_quote_id, p_payload);
END;
$function$;

COMMIT;
