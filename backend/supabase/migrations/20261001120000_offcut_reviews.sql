-- REVIEW BEFORE APPLYING. Optional host integration, NOT run by the handoff installer.
-- Assumptions from supplied QuoteCore schema: public.quotes(id),
-- public.takeoff_pages(id,quote_id), public.quote_roof_areas(id,quote_id).
-- Quote visibility MUST be governed by the existing quotes RLS policy.
-- Account-private drafts. Team-wide draft sharing is intentionally not enabled.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='quotes' AND c.relrowsecurity) THEN
    RAISE EXCEPTION 'Review the host quote-access policy first: quotes RLS must be enabled';
  END IF;
END $$;
CREATE TABLE public.quote_offcut_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  page_id uuid NOT NULL REFERENCES public.takeoff_pages(id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.quote_roof_areas(id) ON DELETE CASCADE,
  area_key text GENERATED ALWAYS AS (coalesce(area_id::text,'page')) STORED,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id,quote_id,page_id,area_key),
  CHECK (octet_length(document::text) <= 12000000),
  CHECK ((jsonb_typeof(document) = 'object' AND document->>'kind' = 'quotecore-offcut-review'
    AND document->>'schemaVersion' = '1') IS TRUE),
  CHECK (((document#>>'{scope,quoteId}') = quote_id::text
    AND (document#>>'{scope,pageId}') = page_id::text
    AND (document#>>'{scope,areaScopeId}') IS NOT DISTINCT FROM area_id::text) IS TRUE),
  CHECK (((document#>>'{draft,roof,quoteId}') = quote_id::text
    AND (document#>>'{draft,roof,pageId}') = page_id::text
    AND (document#>>'{draft,roof,areaScopeId}') IS NOT DISTINCT FROM area_id::text) IS TRUE)
);
ALTER TABLE public.quote_offcut_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_offcut_reviews FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quote_offcut_reviews FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_offcut_reviews TO authenticated;

CREATE FUNCTION public.qc_offcut_review_scope_allowed(p_quote uuid,p_page uuid,p_area uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT (select auth.uid()) IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.quotes q WHERE q.id=p_quote)
    AND EXISTS (SELECT 1 FROM public.takeoff_pages p WHERE p.id=p_page AND p.quote_id=p_quote)
    AND (p_area IS NULL OR EXISTS(SELECT 1 FROM public.quote_roof_areas a WHERE a.id=p_area AND a.quote_id=p_quote));
$$;
REVOKE ALL ON FUNCTION public.qc_offcut_review_scope_allowed(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qc_offcut_review_scope_allowed(uuid,uuid,uuid) TO authenticated;
CREATE POLICY offcut_review_read ON public.quote_offcut_reviews FOR SELECT TO authenticated
  USING (owner_id=(select auth.uid()) AND public.qc_offcut_review_scope_allowed(quote_id,page_id,area_id));
CREATE POLICY offcut_review_create ON public.quote_offcut_reviews FOR INSERT TO authenticated
  WITH CHECK (owner_id=(select auth.uid()) AND public.qc_offcut_review_scope_allowed(quote_id,page_id,area_id));
CREATE POLICY offcut_review_update ON public.quote_offcut_reviews FOR UPDATE TO authenticated
  USING (owner_id=(select auth.uid()) AND public.qc_offcut_review_scope_allowed(quote_id,page_id,area_id))
  WITH CHECK (owner_id=(select auth.uid()) AND public.qc_offcut_review_scope_allowed(quote_id,page_id,area_id));
CREATE POLICY offcut_review_delete ON public.quote_offcut_reviews FOR DELETE TO authenticated
  USING (owner_id=(select auth.uid()) AND public.qc_offcut_review_scope_allowed(quote_id,page_id,area_id));

CREATE FUNCTION public.qc_offcut_review_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF (NEW.owner_id,NEW.quote_id,NEW.page_id,NEW.area_id,NEW.created_at)
      IS DISTINCT FROM (OLD.owner_id,OLD.quote_id,OLD.page_id,OLD.area_id,OLD.created_at) THEN
      RAISE EXCEPTION 'Review identity is immutable' USING ERRCODE='22023';
    END IF;
    IF NEW.revision <> OLD.revision+1 THEN
      RAISE EXCEPTION 'Review revision conflict' USING ERRCODE='23505';
    END IF;
  ELSE
    IF NEW.revision <> 1 THEN RAISE EXCEPTION 'A new review starts at revision 1' USING ERRCODE='22023'; END IF;
  END IF;
  NEW.updated_at=now(); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.qc_offcut_review_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER qc_offcut_review_guard BEFORE INSERT OR UPDATE ON public.quote_offcut_reviews
FOR EACH ROW EXECUTE FUNCTION public.qc_offcut_review_guard();

CREATE FUNCTION public.qc_offcut_review_load(p_quote uuid,p_page uuid,p_area uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.qc_offcut_review_scope_allowed(p_quote,p_page,p_area) THEN
    RAISE EXCEPTION 'Review scope not available' USING ERRCODE='42501';
  END IF;
  SELECT jsonb_build_object('revision',r.revision,'document',r.document) INTO result
    FROM public.quote_offcut_reviews r WHERE r.owner_id=(select auth.uid()) AND r.quote_id=p_quote
    AND r.page_id=p_page AND r.area_id IS NOT DISTINCT FROM p_area;
  RETURN result;
END $$;
CREATE FUNCTION public.qc_offcut_review_save(p_quote uuid,p_page uuid,p_area uuid,p_document jsonb,p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE saved public.quote_offcut_reviews;
BEGIN
  IF NOT public.qc_offcut_review_scope_allowed(p_quote,p_page,p_area) THEN
    RAISE EXCEPTION 'Review scope not available' USING ERRCODE='42501';
  END IF;
  IF p_expected_revision IS NULL OR p_expected_revision < 0 THEN RAISE EXCEPTION 'Invalid expected revision' USING ERRCODE='22023'; END IF;
  IF p_expected_revision=0 THEN
    INSERT INTO public.quote_offcut_reviews(owner_id,quote_id,page_id,area_id,document)
    VALUES((select auth.uid()),p_quote,p_page,p_area,p_document)
    ON CONFLICT(owner_id,quote_id,page_id,area_key) DO NOTHING RETURNING * INTO saved;
  ELSE
    UPDATE public.quote_offcut_reviews SET document=p_document,revision=revision+1
    WHERE owner_id=(select auth.uid()) AND quote_id=p_quote AND page_id=p_page
      AND area_id IS NOT DISTINCT FROM p_area AND revision=p_expected_revision RETURNING * INTO saved;
  END IF;
  IF saved.id IS NULL THEN RAISE EXCEPTION 'Review revision conflict' USING ERRCODE='23505'; END IF;
  RETURN jsonb_build_object('revision',saved.revision,'document',saved.document);
END $$;
REVOKE ALL ON FUNCTION public.qc_offcut_review_load(uuid,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.qc_offcut_review_save(uuid,uuid,uuid,jsonb,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qc_offcut_review_load(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qc_offcut_review_save(uuid,uuid,uuid,jsonb,bigint) TO authenticated;
COMMIT;
