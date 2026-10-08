-- V2.20 HOST MIGRATION (required to enable account checkpoint saving). The handoff never executes this file.
-- Preflight: confirm qc_offcut_review_scope_allowed(uuid,uuid,uuid) already
-- exists and quotes/takeoff_pages RLS is enabled. Do NOT recreate review RPCs.
-- This table stores editable recovery state, NOT priced quote measurements.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.qc_offcut_review_scope_allowed(uuid,uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Existing offcut review scope/RLS helper is required; inspect the live schema first';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN('quotes','takeoff_pages') AND NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'Quote and page RLS must be enabled';
  END IF;
END $$;
CREATE TABLE public.quote_takeoff_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  page_id uuid NOT NULL REFERENCES public.takeoff_pages(id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.quote_roof_areas(id) ON DELETE CASCADE,
  area_key text GENERATED ALWAYS AS (coalesce(area_id::text,'page')) STORED,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id,quote_id,page_id,area_key),
  CHECK (octet_length(document::text)<=12000000),
  CHECK ((jsonb_typeof(document)='object' AND document->>'schemaVersion'='1'
    AND document->>'kind'='quotecore-takeoff-recovery'
    AND document->>'status' IN('active','completed','discarded')) IS TRUE),
  CHECK (((document#>>'{scope,quoteId}')=quote_id::text AND (document#>>'{scope,pageId}')=page_id::text
    AND (document#>>'{scope,areaScopeId}') IS NOT DISTINCT FROM area_id::text) IS TRUE),
  CHECK (((document#>>'{capture,snapshot,quoteId}')=quote_id::text AND (document#>>'{capture,snapshot,pageId}')=page_id::text
    AND (document#>>'{capture,snapshot,areaScopeId}') IS NOT DISTINCT FROM area_id::text) IS TRUE)
);
ALTER TABLE public.quote_takeoff_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_takeoff_checkpoints FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_takeoff_checkpoints FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.quote_takeoff_checkpoints TO authenticated;
CREATE POLICY takeoff_checkpoint_read ON public.quote_takeoff_checkpoints FOR SELECT TO authenticated
  USING(owner_id=(select auth.uid()) AND public.qc_offcut_review_scope_allowed(quote_id,page_id,area_id));
CREATE POLICY takeoff_checkpoint_insert ON public.quote_takeoff_checkpoints FOR INSERT TO authenticated
  WITH CHECK(owner_id=(select auth.uid()) AND public.qc_offcut_review_scope_allowed(quote_id,page_id,area_id));
CREATE POLICY takeoff_checkpoint_update ON public.quote_takeoff_checkpoints FOR UPDATE TO authenticated
  USING(owner_id=(select auth.uid()) AND public.qc_offcut_review_scope_allowed(quote_id,page_id,area_id))
  WITH CHECK(owner_id=(select auth.uid()) AND public.qc_offcut_review_scope_allowed(quote_id,page_id,area_id));
CREATE POLICY takeoff_checkpoint_delete ON public.quote_takeoff_checkpoints FOR DELETE TO authenticated
  USING(owner_id=(select auth.uid()) AND public.qc_offcut_review_scope_allowed(quote_id,page_id,area_id));
CREATE FUNCTION public.qc_takeoff_checkpoint_guard_v220() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF (NEW.owner_id,NEW.quote_id,NEW.page_id,NEW.area_id,NEW.created_at) IS DISTINCT FROM
       (OLD.owner_id,OLD.quote_id,OLD.page_id,OLD.area_id,OLD.created_at) THEN
      RAISE EXCEPTION 'Checkpoint identity is immutable' USING ERRCODE='22023';
    END IF;
    IF NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Checkpoint revision conflict' USING ERRCODE='23505'; END IF;
  ELSIF NEW.revision<>1 THEN RAISE EXCEPTION 'New checkpoints start at revision 1' USING ERRCODE='22023';
  END IF;
  NEW.updated_at=now(); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.qc_takeoff_checkpoint_guard_v220() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER takeoff_checkpoint_guard BEFORE INSERT OR UPDATE ON public.quote_takeoff_checkpoints
FOR EACH ROW EXECUTE FUNCTION public.qc_takeoff_checkpoint_guard_v220();
CREATE FUNCTION public.qc_takeoff_checkpoint_load(p_quote uuid,p_page uuid,p_area uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.qc_offcut_review_scope_allowed(p_quote,p_page,p_area) THEN RAISE EXCEPTION 'Checkpoint scope unavailable' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object('revision',r.revision,'document',r.document) INTO result FROM public.quote_takeoff_checkpoints r
    WHERE r.owner_id=(select auth.uid()) AND r.quote_id=p_quote AND r.page_id=p_page AND r.area_id IS NOT DISTINCT FROM p_area;
  RETURN result;
END $$;
CREATE FUNCTION public.qc_takeoff_checkpoint_save(p_quote uuid,p_page uuid,p_area uuid,p_document jsonb,p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE saved public.quote_takeoff_checkpoints;
BEGIN
  IF NOT public.qc_offcut_review_scope_allowed(p_quote,p_page,p_area) THEN RAISE EXCEPTION 'Checkpoint scope unavailable' USING ERRCODE='42501'; END IF;
  IF p_expected_revision IS NULL OR p_expected_revision<0 THEN RAISE EXCEPTION 'Invalid expected checkpoint revision' USING ERRCODE='22023'; END IF;
  IF p_expected_revision=0 THEN
    INSERT INTO public.quote_takeoff_checkpoints(owner_id,quote_id,page_id,area_id,document)
      VALUES((select auth.uid()),p_quote,p_page,p_area,p_document)
      ON CONFLICT(owner_id,quote_id,page_id,area_key) DO NOTHING RETURNING * INTO saved;
  ELSE
    UPDATE public.quote_takeoff_checkpoints SET document=p_document,revision=revision+1
      WHERE owner_id=(select auth.uid()) AND quote_id=p_quote AND page_id=p_page
      AND area_id IS NOT DISTINCT FROM p_area AND revision=p_expected_revision RETURNING * INTO saved;
  END IF;
  IF saved.id IS NULL THEN RAISE EXCEPTION 'Checkpoint revision conflict' USING ERRCODE='23505'; END IF;
  RETURN jsonb_build_object('revision',saved.revision,'document',saved.document);
END $$;
REVOKE ALL ON FUNCTION public.qc_takeoff_checkpoint_load(uuid,uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.qc_takeoff_checkpoint_save(uuid,uuid,uuid,jsonb,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qc_takeoff_checkpoint_load(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qc_takeoff_checkpoint_save(uuid,uuid,uuid,jsonb,bigint) TO authenticated;
-- Lightweight per-page discovery: no geometry or prices exposed here.
CREATE FUNCTION public.qc_takeoff_checkpoint_list(p_quote uuid,p_page uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('scope',r.document->'scope','savedAt',r.document->>'savedAt',
    'imageKey',r.document->>'imageKey','status',r.document->>'status') ORDER BY r.updated_at DESC),'[]'::jsonb)
  FROM public.quote_takeoff_checkpoints r WHERE r.owner_id=(select auth.uid()) AND r.quote_id=p_quote AND r.page_id=p_page;
$$;
REVOKE ALL ON FUNCTION public.qc_takeoff_checkpoint_list(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qc_takeoff_checkpoint_list(uuid,uuid) TO authenticated;
COMMIT;
