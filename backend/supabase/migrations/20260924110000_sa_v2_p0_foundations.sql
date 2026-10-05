-- DRAFT ONLY - Smart Assistant V2 P0, source main@20b3f54c.
-- Gavin reviews/applies on an isolated database before rollout. NOT applied here.
-- New objects only. No quota, billing, auth, pricing, feature-flag or V1 RPC changes.
-- Transactional and single-application: an existing conflicting object fails the
-- migration, rather than silently replacing an unknown deployed definition.
BEGIN;

-- Complete nine-section JSON map. Draft quotes were added by the owner after
-- the original V2 plan. Unknown keys, absent keys, JSON null and bad levels fail.
CREATE FUNCTION public.sa_v2_permissions_valid(p_permissions jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_keys constant text[] := ARRAY[
    'quotes','draft_quotes','orders','invoices','components','customers',
    'emails','billing','settings'
  ];
  v_key text;
BEGIN
  IF p_permissions IS NULL OR jsonb_typeof(p_permissions) <> 'object' THEN RETURN false; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_permissions)) <> cardinality(v_keys) THEN RETURN false; END IF;
  FOREACH v_key IN ARRAY v_keys LOOP
    IF NOT (p_permissions ? v_key)
       OR jsonb_typeof(p_permissions -> v_key) IS DISTINCT FROM 'string'
       OR (p_permissions ->> v_key) NOT IN ('hidden','read_only','edit') THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_permissions_valid(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_permissions_valid(jsonb) TO service_role;

CREATE FUNCTION public.sa_v2_permissions_defaults()
RETURNS jsonb
LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT '{"quotes":"read_only","draft_quotes":"read_only","orders":"read_only","invoices":"read_only","components":"read_only","customers":"read_only","emails":"hidden","billing":"hidden","settings":"hidden"}'::jsonb
$$;
REVOKE ALL ON FUNCTION public.sa_v2_permissions_defaults() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_permissions_defaults() TO service_role;

-- Company-config child storage, separate from assistant_configs so the existing
-- service-role persona/knowledge save cannot overwrite or delegate these rights.
-- No config/flag rows are created and no companies are enabled by this migration.
CREATE TABLE public.assistant_section_permissions (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  permissions jsonb NOT NULL CHECK (public.sa_v2_permissions_valid(permissions)),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0 AND revision < 2147483647),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);
COMMENT ON TABLE public.assistant_section_permissions IS
  'V2 prepared permission map. P0 does not change V1 tool admission. Absence of a row means documented read-only/hidden defaults, not an error fallback.';
ALTER TABLE public.assistant_section_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_section_permissions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.assistant_section_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_section_permissions TO service_role;
CREATE POLICY sa_v2_permissions_read_own ON public.assistant_section_permissions
  FOR SELECT TO authenticated USING (
    company_id = public.sa_user_company_id()
    AND public.smart_assistant_enabled(company_id)
  );
-- No authenticated INSERT/UPDATE/DELETE policy or table grant. All customer
-- changes use the identity-derived RPC below, including direct API attempts.

CREATE FUNCTION public.sa_v2_permissions_read()
RETURNS TABLE (company_id uuid, permissions jsonb, revision integer, source text, updated_at timestamptz, can_manage boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_company uuid;
  v_role text;
  v_saved public.assistant_section_permissions%ROWTYPE;
BEGIN
  SELECT u.company_id, u.role INTO v_company, v_role FROM public.users u WHERE u.id = v_user;
  IF v_user IS NULL OR v_company IS NULL OR NOT COALESCE(public.smart_assistant_enabled(v_company), false) THEN
    RAISE EXCEPTION 'sa_v2_access_denied' USING ERRCODE = '42501';
  END IF;
  SELECT p.* INTO v_saved FROM public.assistant_section_permissions p WHERE p.company_id = v_company;
  IF FOUND THEN
    RETURN QUERY SELECT v_company, v_saved.permissions, v_saved.revision, 'saved'::text,
      v_saved.updated_at, COALESCE(v_role IN ('owner','admin'), false);
  ELSE
    RETURN QUERY SELECT v_company, public.sa_v2_permissions_defaults(), 0, 'default'::text,
      NULL::timestamptz, COALESCE(v_role IN ('owner','admin'), false);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_permissions_read() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_permissions_read() TO authenticated;

CREATE FUNCTION public.sa_v2_permissions_save(p_permissions jsonb, p_expected_revision integer, p_expected_company_id uuid)
RETURNS TABLE (company_id uuid, permissions jsonb, revision integer, source text, updated_at timestamptz, can_manage boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_company uuid;
  v_role text;
  v_saved public.assistant_section_permissions%ROWTYPE;
BEGIN
  SELECT u.company_id, u.role INTO v_company, v_role FROM public.users u WHERE u.id = v_user;
  IF v_user IS NULL OR v_company IS NULL OR v_role IS NULL OR v_role NOT IN ('owner','admin')
     OR NOT COALESCE(public.smart_assistant_enabled(v_company), false) THEN
    RAISE EXCEPTION 'sa_v2_access_denied' USING ERRCODE = '42501';
  END IF;
  -- Prevent a stale tab from writing A's draft into a newly signed-in workspace B.
  -- This is comparison-only; selectors always use v_company from auth.uid().
  IF p_expected_company_id IS DISTINCT FROM v_company THEN
    RAISE EXCEPTION 'sa_v2_workspace_changed' USING ERRCODE = '42501';
  END IF;
  IF NOT public.sa_v2_permissions_valid(p_permissions)
     OR p_expected_revision IS NULL OR p_expected_revision < 0 OR p_expected_revision >= 2147483646 THEN
    RAISE EXCEPTION 'sa_v2_invalid_permissions' USING ERRCODE = '22023';
  END IF;

  -- Materialise only on explicit save. Concurrent first saves serialize on this
  -- new row, NOT on the V1 quota/flag-row lock. Stale versions fail atomically.
  INSERT INTO public.assistant_section_permissions (company_id, permissions, updated_by)
  VALUES (v_company, public.sa_v2_permissions_defaults(), v_user)
  ON CONFLICT ON CONSTRAINT assistant_section_permissions_pkey DO NOTHING;
  SELECT p.* INTO v_saved FROM public.assistant_section_permissions p
    WHERE p.company_id = v_company FOR UPDATE;
  IF v_saved.revision <> p_expected_revision THEN
    RAISE EXCEPTION 'sa_v2_revision_conflict' USING ERRCODE = '40001';
  END IF;
  UPDATE public.assistant_section_permissions p
    SET permissions = p_permissions, revision = p.revision + 1,
        updated_at = clock_timestamp(), updated_by = v_user
    WHERE p.company_id = v_company
    RETURNING p.* INTO v_saved;
  RETURN QUERY SELECT v_company, v_saved.permissions, v_saved.revision, 'saved'::text, v_saved.updated_at, true;
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_permissions_save(jsonb, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_permissions_save(jsonb, integer, uuid) TO authenticated;

-- Ledger scaffold only. P0 creates NO actions, confirmation endpoints or tools.
-- Identity UUIDs intentionally have NO cascading FKs to conversations/runs/users
-- or companies: deleting a transcript must not delete evidence, and the new
-- table must not silently change account-deletion behaviour. P3's trusted writer
-- must validate all company/user/run associations before recording an action.
-- AGENT-TODO: confirm retention/redaction on account deletion before P3 writes.
CREATE TABLE public.sa_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  run_id uuid,
  action_type text NOT NULL CHECK (length(btrim(action_type)) BETWEEN 1 AND 120),
  entity_type text NOT NULL CHECK (length(btrim(entity_type)) BETWEEN 1 AND 120),
  entity_id text CHECK (entity_id IS NULL OR length(btrim(entity_id)) BETWEEN 1 AND 256),
  payload_before jsonb,
  payload_after jsonb,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','confirmed','committed','reverted','expired')),
  verification_mode text CHECK (verification_mode IN ('chat_summary','navigate_and_show')),
  confirmation_method text CHECK (confirmation_method IN ('button','voice')),
  confirmation_phrase text,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sa_v2_confirmation_complete CHECK (
    (confirmation_method IS NULL AND confirmed_by IS NULL AND confirmed_at IS NULL AND confirmation_phrase IS NULL)
    OR
    (confirmation_method IS NOT NULL AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL
      AND verification_mode IS NOT NULL
      AND ((confirmation_method = 'button' AND confirmation_phrase IS NULL)
        OR (confirmation_method = 'voice' AND confirmation_phrase IS NOT NULL
          AND length(btrim(confirmation_phrase)) BETWEEN 1 AND 16000)))
  ),
  CONSTRAINT sa_v2_committed_needs_confirmation CHECK (
    status NOT IN ('confirmed','committed') OR confirmed_at IS NOT NULL
  ),
  CONSTRAINT sa_v2_proposed_not_confirmed CHECK (
    status <> 'proposed' OR confirmed_at IS NULL
  )
);
COMMENT ON TABLE public.sa_action_log IS
  'P0 audit scaffold, unused until P3. Clients cannot insert, edit or delete proof. Trusted writers may stage/finalise rows. No automatic retention purge.';
COMMENT ON COLUMN public.sa_action_log.confirmation_phrase IS
  'Only the explicit voice confirmation, verbatim; never the full conversation transcript. Text-confirmation enum policy is a P3 open decision.';
COMMENT ON COLUMN public.sa_action_log.confirmed_by IS
  'The authenticated human who confirms, distinct from the requesting user_id. Cross-user confirmations require an explicit P3 policy.';
CREATE INDEX sa_v2_action_log_company_created ON public.sa_action_log (company_id, created_at DESC);
CREATE INDEX sa_v2_action_log_run ON public.sa_action_log (run_id) WHERE run_id IS NOT NULL;
CREATE INDEX sa_v2_action_log_company_status ON public.sa_action_log (company_id, status, created_at DESC);
ALTER TABLE public.sa_action_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sa_action_log FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.sa_action_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sa_action_log TO service_role;
CREATE POLICY sa_v2_action_log_owner_admin_read ON public.sa_action_log
  FOR SELECT TO authenticated USING (
    company_id = public.sa_user_company_id()
    AND public.smart_assistant_enabled(company_id)
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('owner','admin'))
  );
-- No client mutation policies or write RPC. No changes to private transcript RLS.
COMMIT;
