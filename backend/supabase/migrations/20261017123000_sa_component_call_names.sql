-- Smart Assistant call names / shortcuts.
-- User-facing names remain canonical for QuoteCore outputs. These optional aliases
-- exist only to make library/component selection deterministic in Smart Assistant.
BEGIN;

ALTER TABLE public.component_collections
  ADD COLUMN IF NOT EXISTS assistant_call_name text;
ALTER TABLE public.component_library
  ADD COLUMN IF NOT EXISTS assistant_call_name text;

ALTER TABLE public.component_collections
  DROP CONSTRAINT IF EXISTS component_collections_assistant_call_name_check;
ALTER TABLE public.component_collections
  ADD CONSTRAINT component_collections_assistant_call_name_check
  CHECK (assistant_call_name IS NULL OR (
    length(btrim(assistant_call_name)) BETWEEN 1 AND 80
    AND assistant_call_name !~ '[[:cntrl:]]'
  ));

ALTER TABLE public.component_library
  DROP CONSTRAINT IF EXISTS component_library_assistant_call_name_check;
ALTER TABLE public.component_library
  ADD CONSTRAINT component_library_assistant_call_name_check
  CHECK (assistant_call_name IS NULL OR (
    length(btrim(assistant_call_name)) BETWEEN 1 AND 80
    AND assistant_call_name !~ '[[:cntrl:]]'
  ));

CREATE OR REPLACE FUNCTION public.sa_v2_normalize_call_name(p_value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
  SELECT nullif(btrim(regexp_replace(lower(coalesce(p_value,'')), '[^[:alnum:]]+', ' ', 'g')), '');
$$;
REVOKE ALL ON FUNCTION public.sa_v2_normalize_call_name(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_normalize_call_name(text) TO service_role;

-- Library shortcuts must be unique within a workspace. Component shortcuts need
-- only be unique inside their library, which intentionally allows "1" in more
-- than one library when the user names the library in the request.
CREATE UNIQUE INDEX IF NOT EXISTS component_collections_assistant_call_name_uq
  ON public.component_collections(company_id, public.sa_v2_normalize_call_name(assistant_call_name))
  WHERE assistant_call_name IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS component_library_assistant_call_name_uq
  ON public.component_library(company_id, collection_id, public.sa_v2_normalize_call_name(assistant_call_name))
  WHERE assistant_call_name IS NOT NULL AND collection_id IS NOT NULL;

-- A shortcut must not shadow another real name in the same scope. Without
-- this guard, saying an exact real name could resolve to somebody else's call
-- name because call names deliberately have first priority in the resolver.
CREATE OR REPLACE FUNCTION public.sa_v2_guard_collection_call_name() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE
  call_key text:=public.sa_v2_normalize_call_name(NEW.assistant_call_name);
  name_key text:=public.sa_v2_normalize_call_name(NEW.name);
BEGIN
  IF call_key IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.component_collections c
    WHERE c.company_id=NEW.company_id AND c.id<>NEW.id
      AND public.sa_v2_normalize_call_name(c.name)=call_key
  ) THEN RAISE EXCEPTION 'assistant_call_name_conflicts_with_library_name' USING ERRCODE='23505'; END IF;
  IF name_key IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.component_collections c
    WHERE c.company_id=NEW.company_id AND c.id<>NEW.id
      AND public.sa_v2_normalize_call_name(c.assistant_call_name)=name_key
  ) THEN RAISE EXCEPTION 'library_name_conflicts_with_assistant_call_name' USING ERRCODE='23505'; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_guard_collection_call_name() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS sa_v2_guard_collection_call_name ON public.component_collections;
CREATE TRIGGER sa_v2_guard_collection_call_name
BEFORE INSERT OR UPDATE ON public.component_collections
FOR EACH ROW EXECUTE FUNCTION public.sa_v2_guard_collection_call_name();

CREATE OR REPLACE FUNCTION public.sa_v2_guard_component_call_name() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE
  call_key text:=public.sa_v2_normalize_call_name(NEW.assistant_call_name);
  name_key text:=public.sa_v2_normalize_call_name(NEW.name);
BEGIN
  IF call_key IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.component_library c
    WHERE c.company_id=NEW.company_id AND c.id<>NEW.id
      AND c.collection_id IS NOT DISTINCT FROM NEW.collection_id
      AND public.sa_v2_normalize_call_name(c.name)=call_key
  ) THEN RAISE EXCEPTION 'assistant_call_name_conflicts_with_component_name' USING ERRCODE='23505'; END IF;
  IF name_key IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.component_library c
    WHERE c.company_id=NEW.company_id AND c.id<>NEW.id
      AND c.collection_id IS NOT DISTINCT FROM NEW.collection_id
      AND public.sa_v2_normalize_call_name(c.assistant_call_name)=name_key
  ) THEN RAISE EXCEPTION 'component_name_conflicts_with_assistant_call_name' USING ERRCODE='23505'; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_guard_component_call_name() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS sa_v2_guard_component_call_name ON public.component_library;
CREATE TRIGGER sa_v2_guard_component_call_name
BEFORE INSERT OR UPDATE ON public.component_library
FOR EACH ROW EXECUTE FUNCTION public.sa_v2_guard_component_call_name();

-- Alias changes alter deterministic workflow resolution, so invalidate current
-- automatic selections exactly like other workflow settings do.
DROP TRIGGER IF EXISTS sa_v2_collection_call_name_epoch ON public.component_collections;
CREATE TRIGGER sa_v2_collection_call_name_epoch
AFTER UPDATE OF assistant_call_name ON public.component_collections
FOR EACH ROW
WHEN (OLD.assistant_call_name IS DISTINCT FROM NEW.assistant_call_name)
EXECUTE FUNCTION public.sa_v2_bump_workflow_epoch();

DROP TRIGGER IF EXISTS sa_v2_component_call_name_epoch ON public.component_library;
CREATE TRIGGER sa_v2_component_call_name_epoch
AFTER UPDATE OF assistant_call_name ON public.component_library
FOR EACH ROW
WHEN (OLD.assistant_call_name IS DISTINCT FROM NEW.assistant_call_name)
EXECUTE FUNCTION public.sa_v2_bump_workflow_epoch();

-- One atomic settings save: assistant access/mapping + human-friendly call names.
CREATE OR REPLACE FUNCTION public.sa_v2_save_assistant_library_v2(
  p_user_id uuid,
  p_expected_epoch bigint,
  p_collection_id uuid,
  p_enabled boolean,
  p_include_all boolean,
  p_library_call_name text,
  p_members jsonb
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE
  cid uuid:=public.sa_v2_settings_actor(p_user_id);
  current_epoch bigint;
  member jsonb;
  normalized_library text;
BEGIN
  SELECT epoch INTO current_epoch FROM public.assistant_v2_workflow_epochs WHERE company_id=cid FOR UPDATE;
  IF current_epoch IS DISTINCT FROM p_expected_epoch THEN RAISE EXCEPTION 'workflow_config_changed' USING ERRCODE='40001'; END IF;
  IF p_enabled IS NULL OR p_include_all IS NULL OR jsonb_typeof(p_members) IS DISTINCT FROM 'array' OR jsonb_array_length(p_members)>500
  THEN RAISE EXCEPTION 'invalid_library_config' USING ERRCODE='22023'; END IF;

  normalized_library:=public.sa_v2_normalize_call_name(p_library_call_name);
  IF p_library_call_name IS NOT NULL AND (normalized_library IS NULL OR length(p_library_call_name)>80 OR p_library_call_name ~ '[[:cntrl:]]')
  THEN RAISE EXCEPTION 'invalid_library_call_name' USING ERRCODE='22023'; END IF;

  PERFORM 1 FROM public.component_collections WHERE id=p_collection_id AND company_id=cid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'collection_company_mismatch' USING ERRCODE='42501'; END IF;

  IF (SELECT count(DISTINCT value->>'componentId') FROM jsonb_array_elements(p_members))<>jsonb_array_length(p_members)
  THEN RAISE EXCEPTION 'duplicate_component' USING ERRCODE='22023'; END IF;

  UPDATE public.component_collections
    SET assistant_call_name=nullif(btrim(p_library_call_name),'')
    WHERE id=p_collection_id AND company_id=cid;

  INSERT INTO public.assistant_v2_library_profiles(company_id,collection_id,enabled,include_all,updated_by)
  VALUES(cid,p_collection_id,p_enabled,p_include_all,p_user_id)
  ON CONFLICT(company_id,collection_id) DO UPDATE
    SET enabled=EXCLUDED.enabled,include_all=EXCLUDED.include_all,updated_by=p_user_id;

  DELETE FROM public.assistant_v2_library_members WHERE company_id=cid AND collection_id=p_collection_id;

  FOR member IN SELECT value FROM jsonb_array_elements(p_members) LOOP
    IF jsonb_typeof(member) IS DISTINCT FROM 'object'
      OR jsonb_typeof(member->'included') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(member->'isDefault') IS DISTINCT FROM 'boolean'
      OR (member->'conceptKey' IS NOT NULL AND jsonb_typeof(member->'conceptKey') NOT IN ('null','string'))
      OR (member->'callName' IS NOT NULL AND jsonb_typeof(member->'callName') NOT IN ('null','string'))
    THEN RAISE EXCEPTION 'invalid_library_member' USING ERRCODE='22023'; END IF;

    IF member->>'callName' IS NOT NULL AND (
      public.sa_v2_normalize_call_name(member->>'callName') IS NULL
      OR length(member->>'callName')>80
      OR (member->>'callName') ~ '[[:cntrl:]]'
    ) THEN RAISE EXCEPTION 'invalid_component_call_name' USING ERRCODE='22023'; END IF;

    UPDATE public.component_library
      SET assistant_call_name=nullif(btrim(member->>'callName'),'')
      WHERE id=(member->>'componentId')::uuid AND company_id=cid AND collection_id=p_collection_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'component_collection_mismatch' USING ERRCODE='42501'; END IF;

    INSERT INTO public.assistant_v2_library_members(company_id,collection_id,component_id,included,concept_key,is_default,updated_by)
    VALUES(cid,p_collection_id,(member->>'componentId')::uuid,(member->>'included')::boolean,nullif(member->>'conceptKey',''),(member->>'isDefault')::boolean,p_user_id);
  END LOOP;

  RETURN (SELECT epoch FROM public.assistant_v2_workflow_epochs WHERE company_id=cid);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'assistant_call_name_ambiguous' USING ERRCODE='23505';
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_save_assistant_library_v2(uuid,bigint,uuid,boolean,boolean,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_save_assistant_library_v2(uuid,bigint,uuid,boolean,boolean,text,jsonb) TO service_role;

COMMIT;
