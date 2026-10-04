# Gavin integration gate — testing database only

**No executable migration or live DB change is included in this return.** This file is a reviewable integration contract. Check the actual catalog and baseline migrations before adapting/applying anything. The app remains behind `DEMO_V2_TEST_ENABLED` and existing demo controls.

## Existing schema expected

The supplied snapshot already describes `demo_control`, `demo_sessions`, `demo_usage`, `demo_budget_counters` and a `subscription_plans.code='demo'` row. This package uses those existing columns; it does not invent a replacement schema. Run the read-only readiness script and compare to the actual catalog. If a column/constraint/grant differs, stop and reconcile rather than making silent production edits.

Keep `feat_email_send=false` for the demo plan. Optional self-send is a separately verified server-only path. Existing takeoff, material-order, assistant and cap features must permit the internally seeded records. The schema-shape check does not prove SQL CHECK constraints, triggers, RLS or storage privileges are correct in the deployed database.

## Why the Smart Assistant cleanup prerequisite exists

In the supplied migration `backend/supabase/migrations/20260924132000_sa_v2_p3_actions.sql`, `assistant_v2_actions` is a private operational journal with no company cascade. Its `log_id` references `sa_action_log`. The service role is deliberately granted SELECT/INSERT/UPDATE, not blanket DELETE. Normal company cleanup alone therefore cannot safely remove demo assistant artifacts.

`app/lib/demo/integration.server.ts` expects:

- `public.demo_cleanup_assistant_artifacts(p_company_id uuid) returns jsonb`
- server/service-role-only invocation;
- explicit verified demo company, retiring session and no active/in-flight work;
- remove only that company's action journal first, then its action log;
- return deleted counts; throw on any mismatch/failure;
- idempotent retry while the demo company exists;
- **never general audit-table DELETE grants or production tenant cleanup**.

Real demo assistant activation additionally requires `DEMO_SA_CLEANUP_RPC_READY=true` and `DEMO_SA_WRITES_APPROVED=true`. Do not set them as a shortcut. Test the helper and confirm the existing proposal/confirmation policies first.

### Proposed narrow helper for Gavin to review

The following is a **proposal inside documentation**, not an applied migration. Verify exact table/status/column names and ownership against the testing catalog. Use the normal migration/review workflow and least-privilege owner. An authenticated/anonymous request must never acquire execution rights.

```sql
CREATE OR REPLACE FUNCTION public.demo_cleanup_assistant_artifacts(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
  v_plan text;
  v_actions bigint := 0;
  v_logs bigint := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_only' USING ERRCODE = '42501';
  END IF;
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_required' USING ERRCODE = '22023';
  END IF;

  SELECT c.plan_code INTO v_plan
    FROM public.companies c WHERE c.id = p_company_id FOR UPDATE;
  IF NOT FOUND OR v_plan IS DISTINCT FROM 'demo' THEN
    RAISE EXCEPTION 'verified_demo_required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.demo_sessions ds
    WHERE ds.company_id = p_company_id
      AND ds.status IN ('cleanup_pending', 'cleanup_failed', 'expired', 'terminating', 'failed')
  ) OR EXISTS (
    SELECT 1 FROM public.demo_sessions ds
    WHERE ds.company_id = p_company_id
      AND ds.status IN ('active', 'provisioning')
      AND (ds.expires_at > clock_timestamp() OR ds.status = 'provisioning')
  ) THEN
    RAISE EXCEPTION 'retired_demo_required' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.smart_assistant_runs r
    WHERE r.company_id = p_company_id AND r.status IN ('accepted', 'running')
      AND r.started_at > clock_timestamp() - interval '10 minutes'
  ) OR EXISTS (
    SELECT 1 FROM public.assistant_v2_actions a
    WHERE a.company_id = p_company_id AND a.status = 'applying'
      AND a.updated_at > clock_timestamp() - interval '10 minutes'
  ) THEN
    RAISE EXCEPTION 'assistant_operation_in_flight' USING ERRCODE = '55000';
  END IF;

  DELETE FROM public.assistant_v2_actions WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_actions = ROW_COUNT;
  DELETE FROM public.sa_action_log WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_logs = ROW_COUNT;
  RETURN jsonb_build_object('actions_deleted', v_actions, 'logs_deleted', v_logs);
END;
$function$;

-- In the integration migration, explicitly set an appropriately privileged owner.
-- Owner must be able to delete these two tables without broadening client grants.
ALTER FUNCTION public.demo_cleanup_assistant_artifacts(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.demo_cleanup_assistant_artifacts(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_cleanup_assistant_artifacts(uuid) TO service_role;
```

Ten minutes is an in-flight grace guard, not a proof that an arbitrarily long-running worker has stopped. Reconcile this with the actual assistant execution limits, cancel/drain jobs before cleanup and extend the grace interval if needed. The helper is one narrow transaction; storage/auth deletion remain separately retryable operations. If later schema adds restrictive references to these journals, update the cleanup contract explicitly rather than disabling constraints.

### Helper tests before setting the readiness flag

Check rejection for a permanent/non-demo company, unknown company, active demo, authenticated/anonymous caller, and recent in-flight run/action. Check deletion of only one retired demo's actions/logs, retention of another demo and a normal tenant, FK ordering and harmless second invocation. Then perform full app cleanup and verify no orphan journals remain. Do not substitute a successful function call for checking remaining rows.

## Direct-data security gates — required before internet exposure

Application middleware cannot police a direct call to Supabase REST, RPC, Storage or Auth. Test with the actual anonymous JWT and public key, not the service key:

1. `quote_files` inserts enforce both company ownership and quote ownership; no WITH CHECK(true) bypass survives.
2. An anonymous user cannot change `users.company_id`, role/admin/security flags or other identity/tenant authority. A normal user's existing permissions must not be broadened.
3. A demo cannot change `companies.plan_code`, billing/feature/cap fields, supplier publication ownership or external credentials. Existing billing-column lock-down migrations suggest protection; verify live grants rather than assume.
4. Demo bookkeeping/resource tables are not writable by the browser. Active guide state is a server capability, not a client-supplied chapter number.
5. Expired/terminating demo users cannot continue to read/write tenant records via a still-valid access token until cleanup catches up. Confirm the actual RLS helper/policy handles logical expiry. If not, Gavin must add the narrow expired-demo policy/helper guard before public exposure. The app's getCurrentProfile/route checks do **not** by themselves close this direct-DB gap.
6. Storage is owned-folder scoped; demo users cannot upload into another company's folder, replace shared assets, or exploit public logo/supplier buckets. Set sensible count/byte caps; no upload cannot-fail claim follows from a UI button being hidden.
7. SECURITY DEFINER routines use a safe search_path, narrow EXECUTE grants and tenant checks. Never grant a new anonymous service-role path.
8. Supabase anonymous signup, refresh/2FA behavior and two-cookie coexistence are tested in the real deployment. Paid users and normal signup must remain unchanged.

If a prerequisite is missing, leave the demo disabled or keep it in a genuinely private testing environment until Gavin resolves it. Do not silently enable anonymous internet access on the strength of unit tests.

## Operations / retention

The app deletes retired tenant data/storage/auth identities; after seven days it purges deleted session tombstones (with dependent usage rows under the existing FK) and expired allowance counters. Check the actual FK behavior/grants. Provider email logs/backups have separate retention. HMAC identifiers are pseudonymous, not proof of anonymization; limit access, avoid logging secrets/raw recipient addresses and document operational retention. This document does not make legal compliance claims.
