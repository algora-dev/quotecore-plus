-- QuoteCore+ P2 storage reservations. Never modify Supabase storage tables.
-- Storage deletion happens through the Storage API; SQL only verifies metadata.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.qcp_storage_holds (
 company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 storage_path text NOT NULL,
 bucket_id text,
 file_kind text NOT NULL CHECK(file_kind IN ('document','logo')),
 measured_bytes bigint NOT NULL CHECK(measured_bytes>=0),
 held_bytes bigint NOT NULL CHECK(held_bytes>=0),
 state text NOT NULL CHECK(state IN ('held','committed','delete_pending','released')),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(company_id,storage_path)
);
ALTER TABLE public.qcp_storage_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qcp_storage_holds FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.qcp_storage_holds TO service_role;

CREATE FUNCTION public.qcp_storage_pending_bytes(p_company_id uuid)
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT COALESCE(sum(held_bytes),0)::bigint FROM public.qcp_storage_holds
  WHERE company_id=p_company_id AND state IN ('held','delete_pending')
$$;
REVOKE ALL ON FUNCTION public.qcp_storage_pending_bytes(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qcp_storage_pending_bytes(uuid) TO service_role;

CREATE FUNCTION public.qcp_reserve_storage(p_company_id uuid,p_account_id text,p_mode text,
 p_bucket text,p_path text,p_size bigint,p_kind text DEFAULT 'document')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c jsonb; h public.qcp_storage_holds%ROWTYPE; current_n bigint; pending_n bigint;
 old_n bigint:=0; delta_n bigint; actual_n bigint; limit_n bigint; file_company uuid;
BEGIN
 PERFORM 1 FROM public.companies WHERE id=p_company_id FOR NO KEY UPDATE;
 c := public.qcp_usage_context(p_company_id);
 IF c IS NULL THEN RETURN jsonb_build_object('kind','legacy'); END IF;
 IF c->>'accountId' IS DISTINCT FROM p_account_id OR c->>'mode' IS DISTINCT FROM p_mode THEN
  RAISE EXCEPTION 'custom_scope_mismatch' USING ERRCODE='QCP01';
 END IF;
 IF p_size IS NULL OR p_size<0 OR p_kind IS NULL OR p_kind NOT IN ('document','logo')
  OR p_path IS NULL OR p_path NOT LIKE p_company_id::text||'/%'
  OR p_path LIKE '%..%' OR p_path LIKE '%//%' OR p_bucket IS NULL OR p_bucket='' THEN
   RAISE EXCEPTION 'invalid_storage_request' USING ERRCODE='22023';
 END IF;
 SELECT (metadata->>'size')::bigint INTO actual_n FROM storage.objects
  WHERE bucket_id=p_bucket AND name=p_path;
 IF actual_n IS NULL OR actual_n<>p_size THEN
   RAISE EXCEPTION 'storage_object_size_unverified' USING ERRCODE='QCP03';
 END IF;
 SELECT * INTO h FROM public.qcp_storage_holds WHERE company_id=p_company_id AND storage_path=p_path;
 IF FOUND AND h.state='delete_pending' THEN RAISE EXCEPTION 'storage_cleanup_in_progress' USING ERRCODE='QCP03'; END IF;
 IF FOUND AND h.state<>'released' AND (h.bucket_id IS DISTINCT FROM p_bucket OR h.file_kind<>p_kind) THEN
   RAISE EXCEPTION 'storage_path_conflict' USING ERRCODE='QCP03';
 END IF;
 SELECT company_id,file_size INTO file_company,old_n FROM public.quote_files WHERE storage_path=p_path;
 IF FOUND AND file_company<>p_company_id THEN RAISE EXCEPTION 'storage_path_conflict' USING ERRCODE='42501'; END IF;
 old_n:=COALESCE(old_n,0); delta_n:=GREATEST(p_size-old_n,0);
 SELECT storage_used_bytes INTO current_n FROM public.companies WHERE id=p_company_id;
 IF current_n IS NULL OR current_n<0 THEN RAISE EXCEPTION 'storage_accounting_invalid' USING ERRCODE='QCP01'; END IF;
 pending_n:=public.qcp_storage_pending_bytes(p_company_id)
  -CASE WHEN h.state IN ('held','delete_pending') THEN h.held_bytes ELSE 0 END;
 limit_n:=(c->'limits'->>'storageBytes')::bigint+(c->>'storageTopupBytes')::bigint;
 -- Zero-growth retry or shrink remains possible even while over the limit.
 IF delta_n>0 AND current_n+pending_n+delta_n>limit_n THEN
  RAISE EXCEPTION 'storage_quota_exceeded' USING ERRCODE='QCP06',
    DETAIL=jsonb_build_object('usedBytes',current_n+pending_n,'limitBytes',limit_n,'attemptedBytes',delta_n)::text;
 END IF;
 INSERT INTO public.qcp_storage_holds(company_id,storage_path,bucket_id,file_kind,measured_bytes,held_bytes,state)
 VALUES(p_company_id,p_path,p_bucket,p_kind,p_size,delta_n,'held')
 ON CONFLICT(company_id,storage_path) DO UPDATE SET bucket_id=EXCLUDED.bucket_id,
  file_kind=EXCLUDED.file_kind,measured_bytes=EXCLUDED.measured_bytes,
  held_bytes=EXCLUDED.held_bytes,state='held',updated_at=clock_timestamp();
 RETURN jsonb_build_object('kind','custom','size',p_size,'reservedBytes',delta_n);
END $$;
REVOKE ALL ON FUNCTION public.qcp_reserve_storage(uuid,text,text,text,text,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qcp_reserve_storage(uuid,text,text,text,text,bigint,text) TO service_role;

-- A server-verified hold is mandatory for each custom metadata write. Raw
-- client inserts cannot lie about size or skip the finalizer. Preserve legacy.
CREATE FUNCTION public.qcp_guard_file_metadata()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c jsonb; h public.qcp_storage_holds%ROWTYPE; actual_n bigint; old_n bigint:=0;
 current_n bigint; pending_n bigint; limit_n bigint;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.storage_path IS DISTINCT FROM OLD.storage_path)
  AND EXISTS(SELECT 1 FROM public.companies WHERE id IN (NEW.company_id,OLD.company_id) AND billing_model='custom_setup') THEN
   RAISE EXCEPTION 'custom_file_identity_immutable' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id=NEW.company_id AND billing_model='custom_setup') THEN RETURN NEW; END IF;
 -- Non-storage edits do not need to reserve the same object again.
 IF TG_OP='UPDATE' AND NEW.file_size IS NOT DISTINCT FROM OLD.file_size
  AND NEW.file_type IS NOT DISTINCT FROM OLD.file_type THEN RETURN NEW; END IF;
 PERFORM 1 FROM public.companies WHERE id=NEW.company_id FOR NO KEY UPDATE;
 c:=public.qcp_usage_context(NEW.company_id);
 SELECT * INTO h FROM public.qcp_storage_holds WHERE company_id=NEW.company_id AND storage_path=NEW.storage_path;
 IF NOT FOUND OR h.state NOT IN ('held','committed') OR h.measured_bytes<>NEW.file_size
  OR (h.file_kind='logo') IS DISTINCT FROM (NEW.file_type::text='logo') THEN
   RAISE EXCEPTION 'custom_storage_finalization_required' USING ERRCODE='QCP07';
 END IF;
 SELECT (metadata->>'size')::bigint INTO actual_n FROM storage.objects WHERE bucket_id=h.bucket_id AND name=h.storage_path;
 IF actual_n IS NULL OR actual_n<>NEW.file_size THEN RAISE EXCEPTION 'storage_object_size_unverified' USING ERRCODE='QCP03'; END IF;
 IF TG_OP='UPDATE' THEN old_n:=OLD.file_size;
 ELSE SELECT COALESCE(file_size,0) INTO old_n FROM public.quote_files
  WHERE company_id=NEW.company_id AND storage_path=NEW.storage_path;
  old_n:=COALESCE(old_n,0);
 END IF;
 SELECT storage_used_bytes INTO current_n FROM public.companies WHERE id=NEW.company_id;
 pending_n:=public.qcp_storage_pending_bytes(NEW.company_id)
  -CASE WHEN h.state='held' THEN h.held_bytes ELSE 0 END;
 limit_n:=(c->'limits'->>'storageBytes')::bigint+(c->>'storageTopupBytes')::bigint;
 IF NEW.file_size>old_n AND current_n+pending_n+NEW.file_size-old_n>limit_n THEN
   RAISE EXCEPTION 'storage_quota_exceeded' USING ERRCODE='QCP06',
    DETAIL=jsonb_build_object('usedBytes',current_n+pending_n,'limitBytes',limit_n,'attemptedBytes',NEW.file_size-old_n)::text;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.qcp_guard_file_metadata() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER qcp_guard_file_metadata BEFORE INSERT OR UPDATE ON public.quote_files
 FOR EACH ROW EXECUTE FUNCTION public.qcp_guard_file_metadata();

CREATE FUNCTION public.qcp_complete_file_metadata()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE co uuid;
BEGIN
 co:=CASE WHEN TG_OP='DELETE' THEN OLD.company_id ELSE NEW.company_id END;
 PERFORM 1 FROM public.companies WHERE id=co AND billing_model='custom_setup' FOR NO KEY UPDATE;
 IF NOT FOUND THEN RETURN COALESCE(NEW,OLD); END IF;
 IF TG_OP='DELETE' THEN
   -- Existing storage counter decrements separately in the same transaction.
   -- Keep the bytes held until Storage deletion is confirmed. No content FK.
   INSERT INTO public.qcp_storage_holds(company_id,storage_path,file_kind,measured_bytes,held_bytes,state)
    VALUES(co,OLD.storage_path,CASE WHEN OLD.file_type::text='logo' THEN 'logo' ELSE 'document' END,
       OLD.file_size,OLD.file_size,'delete_pending')
    ON CONFLICT(company_id,storage_path) DO UPDATE SET held_bytes=EXCLUDED.held_bytes,
      measured_bytes=EXCLUDED.measured_bytes,state='delete_pending',updated_at=clock_timestamp();
   RETURN OLD;
 END IF;
 UPDATE public.qcp_storage_holds SET held_bytes=0,state='committed',updated_at=clock_timestamp()
  WHERE company_id=co AND storage_path=NEW.storage_path AND state='held' AND measured_bytes=NEW.file_size;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.qcp_complete_file_metadata() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER qcp_complete_file_metadata AFTER INSERT OR UPDATE OR DELETE ON public.quote_files
 FOR EACH ROW EXECUTE FUNCTION public.qcp_complete_file_metadata();

-- Claim an UNREGISTERED object before deleting it. This closes the race with
-- a concurrent finalizer. A registered file is never deleted by this helper.
CREATE FUNCTION public.qcp_claim_storage_cleanup(p_company_id uuid,p_bucket text,p_path text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE n bigint; h public.qcp_storage_holds%ROWTYPE;
BEGIN
 PERFORM 1 FROM public.companies WHERE id=p_company_id AND billing_model='custom_setup' FOR NO KEY UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF p_bucket IS NULL OR p_bucket='' OR p_path IS NULL OR p_path NOT LIKE p_company_id::text||'/%' OR p_path LIKE '%..%' THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.quote_files WHERE storage_path=p_path) THEN RETURN false; END IF;
 SELECT * INTO h FROM public.qcp_storage_holds WHERE company_id=p_company_id AND storage_path=p_path;
 IF FOUND AND h.bucket_id IS NOT NULL AND h.bucket_id<>p_bucket THEN RETURN false; END IF;
 SELECT (metadata->>'size')::bigint INTO n FROM storage.objects WHERE bucket_id=p_bucket AND name=p_path;
 INSERT INTO public.qcp_storage_holds(company_id,storage_path,bucket_id,file_kind,measured_bytes,held_bytes,state)
  VALUES(p_company_id,p_path,p_bucket,COALESCE(h.file_kind,'document'),GREATEST(COALESCE(n,h.measured_bytes,0),0),
    GREATEST(COALESCE(n,h.held_bytes,0),0),'delete_pending')
 ON CONFLICT(company_id,storage_path) DO UPDATE SET bucket_id=EXCLUDED.bucket_id,
   measured_bytes=EXCLUDED.measured_bytes,held_bytes=EXCLUDED.held_bytes,
   state='delete_pending',updated_at=clock_timestamp();
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.qcp_claim_storage_cleanup(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qcp_claim_storage_cleanup(uuid,text,text) TO service_role;

CREATE FUNCTION public.qcp_ack_storage_removed(p_company_id uuid,p_bucket text,p_path text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM 1 FROM public.companies WHERE id=p_company_id FOR NO KEY UPDATE;
 IF p_bucket IS NULL OR p_bucket='' OR p_path IS NULL OR p_path NOT LIKE p_company_id::text||'/%' THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.quote_files WHERE storage_path=p_path)
  OR EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=p_bucket AND name=p_path) THEN RETURN false; END IF;
 UPDATE public.qcp_storage_holds SET held_bytes=0,state='released',updated_at=clock_timestamp()
  WHERE company_id=p_company_id AND storage_path=p_path AND state IN ('held','delete_pending')
    AND (bucket_id IS NULL OR bucket_id=p_bucket);
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.qcp_ack_storage_removed(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qcp_ack_storage_removed(uuid,text,text) TO service_role;
COMMIT;
