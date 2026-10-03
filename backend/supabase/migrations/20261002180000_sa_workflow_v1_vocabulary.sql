-- Workflow Controller V1 / A: workspace vocabulary, explicit library mappings,
-- optimistic configuration epochs and transactional manager writes.
-- PREREQUISITE: 20260930120000_sa_v2_library_workflow.sql and its prerequisites.
-- This migration does not enable a rollout flag. Apply to staging first.
BEGIN;

CREATE TABLE public.assistant_v2_workflow_epochs (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  epoch bigint NOT NULL DEFAULT 1 CHECK(epoch > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.assistant_v2_workflow_epochs(company_id) SELECT id FROM public.companies;

CREATE TABLE public.assistant_v2_concepts (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key text NOT NULL CHECK(key ~ '^[a-z][a-z0-9_]{1,63}$'),
  display_name text NOT NULL CHECK(length(btrim(display_name)) BETWEEN 1 AND 80 AND display_name !~ '[[:cntrl:]]'),
  aliases text[] NOT NULL DEFAULT '{}' CHECK(cardinality(aliases) <= 24),
  behavior text NOT NULL CHECK(behavior IN ('roof_area','underlay','ridge','hip','valley','barge','spouting','fixings')),
  builtin boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(company_id,key),
  CHECK ((builtin AND key=behavior) OR (NOT builtin AND key LIKE 'custom\_%' ESCAPE '\'))
);
CREATE TABLE public.assistant_v2_concept_aliases (
  company_id uuid NOT NULL,
  normalized_alias text NOT NULL CHECK(length(normalized_alias) BETWEEN 1 AND 100),
  concept_key text NOT NULL,
  PRIMARY KEY(company_id,normalized_alias),
  FOREIGN KEY(company_id,concept_key) REFERENCES public.assistant_v2_concepts(company_id,key) ON DELETE CASCADE
);

-- Normalisation must match workflow-controller/vocabulary.ts exactly.
CREATE FUNCTION public.sa_v2_normalize_concept_alias(p_value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
  SELECT string_agg(CASE WHEN length(token)>3 AND right(token,1)='s' AND right(token,2)<>'ss'
    THEN left(token,length(token)-1) ELSE token END, ' ' ORDER BY ordinal)
  FROM regexp_split_to_table(btrim(regexp_replace(lower(p_value),'[^a-z0-9]+',' ','g')), '\s+') WITH ORDINALITY AS x(token,ordinal);
$$;
REVOKE ALL ON FUNCTION public.sa_v2_normalize_concept_alias(text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.sa_v2_bump_workflow_epoch() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE cid uuid;
BEGIN
 cid:=CASE WHEN TG_OP='DELETE' THEN OLD.company_id ELSE NEW.company_id END;
 UPDATE public.assistant_v2_workflow_epochs SET epoch=epoch+1,updated_at=clock_timestamp() WHERE company_id=cid;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_bump_workflow_epoch() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.sa_v2_concept_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE value text;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.company_id,NEW.key,NEW.behavior,NEW.builtin) IS DISTINCT FROM (OLD.company_id,OLD.key,OLD.behavior,OLD.builtin)
 THEN RAISE EXCEPTION 'concept_identity_immutable' USING ERRCODE='22023'; END IF;
 IF TG_OP='INSERT' AND NOT NEW.builtin THEN
   PERFORM 1 FROM public.assistant_v2_workflow_epochs WHERE company_id=NEW.company_id FOR UPDATE;
   IF (SELECT count(*) FROM public.assistant_v2_concepts WHERE company_id=NEW.company_id AND NOT builtin)>=12
   THEN RAISE EXCEPTION 'custom_concept_limit' USING ERRCODE='22023'; END IF;
 END IF;
 FOREACH value IN ARRAY NEW.aliases LOOP
   IF value IS NULL OR length(btrim(value)) NOT BETWEEN 1 AND 80 OR value ~ '[[:cntrl:]]'
   THEN RAISE EXCEPTION 'invalid_alias' USING ERRCODE='22023'; END IF;
 END LOOP;
 NEW.updated_at:=clock_timestamp();
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_concept_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sa_v2_concept_guard BEFORE INSERT OR UPDATE ON public.assistant_v2_concepts
 FOR EACH ROW EXECUTE FUNCTION public.sa_v2_concept_guard();

CREATE FUNCTION public.sa_v2_concept_alias_index() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE label text; normalized text;
BEGIN
 DELETE FROM public.assistant_v2_concept_aliases WHERE company_id=NEW.company_id AND concept_key=NEW.key;
 FOREACH label IN ARRAY ARRAY[NEW.key,NEW.display_name]||NEW.aliases LOOP
   normalized:=public.sa_v2_normalize_concept_alias(label);
   IF normalized IS NULL OR normalized='' THEN RAISE EXCEPTION 'empty_concept_alias' USING ERRCODE='22023'; END IF;
   INSERT INTO public.assistant_v2_concept_aliases(company_id,normalized_alias,concept_key)
     VALUES(NEW.company_id,normalized,NEW.key)
     ON CONFLICT(company_id,normalized_alias) DO UPDATE SET concept_key=EXCLUDED.concept_key
       WHERE assistant_v2_concept_aliases.concept_key=EXCLUDED.concept_key;
   IF NOT FOUND THEN RAISE EXCEPTION 'ambiguous_concept_alias' USING ERRCODE='23505'; END IF;
 END LOOP;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_concept_alias_index() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sa_v2_concept_alias_index AFTER INSERT OR UPDATE ON public.assistant_v2_concepts
 FOR EACH ROW EXECUTE FUNCTION public.sa_v2_concept_alias_index();

CREATE FUNCTION public.sa_v2_seed_workflow_vocabulary(p_company_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE concept jsonb;
BEGIN
 INSERT INTO public.assistant_v2_workflow_epochs(company_id) VALUES(p_company_id) ON CONFLICT DO NOTHING;
 FOR concept IN SELECT value FROM jsonb_array_elements('[{"key":"roof_area","displayName":"Roof covering","aliases":["roof","roof area","roof covering","covering"],"behavior":"roof_area","builtin":true},{"key":"underlay","displayName":"Underlay","aliases":["underlay","underlayment"],"behavior":"underlay","builtin":true},{"key":"ridge","displayName":"Ridge","aliases":["ridge","ridges","ridging"],"behavior":"ridge","builtin":true},{"key":"hip","displayName":"Hip","aliases":["hip","hips"],"behavior":"hip","builtin":true},{"key":"valley","displayName":"Valley","aliases":["valley","valleys"],"behavior":"valley","builtin":true},{"key":"barge","displayName":"Barge","aliases":["barge","barges"],"behavior":"barge","builtin":true},{"key":"spouting","displayName":"Spouting / gutter","aliases":["spouting","gutter","gutters","guttering"],"behavior":"spouting","builtin":true},{"key":"fixings","displayName":"Fixings","aliases":["fixing","fixings","fastener","fasteners"],"behavior":"fixings","builtin":true}]'::jsonb) LOOP
   INSERT INTO public.assistant_v2_concepts(company_id,key,display_name,aliases,behavior,builtin)
   VALUES(p_company_id,concept->>'key',concept->>'displayName',ARRAY(SELECT jsonb_array_elements_text(concept->'aliases')),concept->>'behavior',true)
   ON CONFLICT(company_id,key) DO NOTHING;
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_seed_workflow_vocabulary(uuid) FROM PUBLIC,anon,authenticated,service_role;
SELECT public.sa_v2_seed_workflow_vocabulary(id) FROM public.companies;
CREATE FUNCTION public.sa_v2_seed_company_workflow() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN PERFORM public.sa_v2_seed_workflow_vocabulary(NEW.id); RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_seed_company_workflow() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sa_v2_seed_company_workflow AFTER INSERT ON public.companies
 FOR EACH ROW EXECUTE FUNCTION public.sa_v2_seed_company_workflow();

ALTER TABLE public.assistant_v2_library_members ADD COLUMN concept_key text;
UPDATE public.assistant_v2_library_members SET concept_key=assistant_role;
ALTER TABLE public.assistant_v2_library_members ADD CONSTRAINT assistant_v2_member_concept_fk
 FOREIGN KEY(company_id,concept_key) REFERENCES public.assistant_v2_concepts(company_id,key);
DROP INDEX IF EXISTS public.assistant_v2_library_one_default_per_role;
CREATE UNIQUE INDEX assistant_v2_library_one_default_per_concept
 ON public.assistant_v2_library_members(company_id,collection_id,concept_key)
 WHERE included AND is_default AND concept_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sa_v2_library_member_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE role_name text; measurement text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.component_collections c WHERE c.id=NEW.collection_id AND c.company_id=NEW.company_id)
 THEN RAISE EXCEPTION 'collection_company_mismatch'; END IF;
 SELECT c.measurement_type::text INTO measurement FROM public.component_library c
   WHERE c.id=NEW.component_id AND c.collection_id=NEW.collection_id AND c.company_id=NEW.company_id AND c.is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'component_collection_mismatch'; END IF;
 IF NEW.concept_key IS NOT NULL THEN
   SELECT behavior INTO role_name FROM public.assistant_v2_concepts WHERE company_id=NEW.company_id AND key=NEW.concept_key;
   IF NOT FOUND THEN RAISE EXCEPTION 'concept_not_found'; END IF;
   IF NOT ((role_name IN ('roof_area','underlay') AND measurement='area')
     OR (role_name='fixings' AND measurement IN ('count','quantity','fixed','area'))
     OR (role_name IN ('ridge','hip','valley','barge','spouting') AND measurement IN ('lineal','linear')))
   THEN RAISE EXCEPTION 'concept_measurement_incompatible' USING ERRCODE='22023'; END IF;
 END IF;
 IF NEW.is_default AND (NOT NEW.included OR NEW.concept_key IS NULL) THEN RAISE EXCEPTION 'ineligible_default' USING ERRCODE='22023'; END IF;
 NEW.assistant_role:=role_name; NEW.updated_at:=clock_timestamp();
 RETURN NEW;
END; $$;

-- Epoch is for configuration. Component prices/active state and collection
-- defaults are additionally protected by the EXISTING exact library/context
-- snapshots at proposal/confirmation. Do not add an inverted component lock.
CREATE TRIGGER sa_v2_concept_epoch AFTER INSERT OR UPDATE OR DELETE ON public.assistant_v2_concepts
 FOR EACH ROW EXECUTE FUNCTION public.sa_v2_bump_workflow_epoch();
CREATE TRIGGER sa_v2_profile_epoch AFTER INSERT OR UPDATE OR DELETE ON public.assistant_v2_library_profiles
 FOR EACH ROW EXECUTE FUNCTION public.sa_v2_bump_workflow_epoch();
CREATE TRIGGER sa_v2_member_epoch AFTER INSERT OR UPDATE OR DELETE ON public.assistant_v2_library_members
 FOR EACH ROW EXECUTE FUNCTION public.sa_v2_bump_workflow_epoch();

ALTER TABLE public.assistant_v2_workflow_epochs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_v2_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_v2_concept_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY sa_workflow_epoch_read ON public.assistant_v2_workflow_epochs FOR SELECT TO authenticated
 USING(company_id IN (SELECT company_id FROM public.users WHERE id=auth.uid()));
CREATE POLICY sa_concept_read ON public.assistant_v2_concepts FOR SELECT TO authenticated
 USING(company_id IN (SELECT company_id FROM public.users WHERE id=auth.uid()));
CREATE POLICY sa_alias_read ON public.assistant_v2_concept_aliases FOR SELECT TO authenticated
 USING(company_id IN (SELECT company_id FROM public.users WHERE id=auth.uid()));
REVOKE ALL ON public.assistant_v2_workflow_epochs,public.assistant_v2_concepts,public.assistant_v2_concept_aliases FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.assistant_v2_workflow_epochs,public.assistant_v2_concepts,public.assistant_v2_concept_aliases TO authenticated;
GRANT ALL ON public.assistant_v2_workflow_epochs,public.assistant_v2_concepts,public.assistant_v2_concept_aliases TO service_role;

CREATE FUNCTION public.sa_v2_settings_actor(p_user_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE cid uuid; user_role text; members_manage boolean;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'trusted_only' USING ERRCODE='42501'; END IF;
 SELECT company_id,role::text INTO cid,user_role FROM public.users WHERE id=p_user_id FOR SHARE;
 IF cid IS NULL OR NOT coalesce(public.smart_assistant_enabled(cid),false) THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
 SELECT members_can_manage INTO members_manage FROM public.assistant_configs WHERE company_id=cid FOR SHARE;
 IF user_role NOT IN ('owner','admin') AND NOT coalesce(members_manage,false) THEN RAISE EXCEPTION 'manager_required' USING ERRCODE='42501'; END IF;
 RETURN cid;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_settings_actor(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.sa_v2_save_assistant_vocabulary(p_user_id uuid,p_expected_epoch bigint,p_concepts jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE cid uuid:=public.sa_v2_settings_actor(p_user_id); current_epoch bigint; concept jsonb; aliases text[];
BEGIN
 SELECT epoch INTO current_epoch FROM public.assistant_v2_workflow_epochs WHERE company_id=cid FOR UPDATE;
 IF current_epoch IS DISTINCT FROM p_expected_epoch THEN RAISE EXCEPTION 'workflow_config_changed' USING ERRCODE='23505'; END IF;
 IF jsonb_typeof(p_concepts) IS DISTINCT FROM 'array' OR jsonb_array_length(p_concepts) NOT BETWEEN 8 AND 20
 THEN RAISE EXCEPTION 'invalid_vocabulary' USING ERRCODE='22023'; END IF;
 IF (SELECT count(DISTINCT value->>'key') FROM jsonb_array_elements(p_concepts))<>jsonb_array_length(p_concepts)
   OR EXISTS(SELECT 1 FROM public.assistant_v2_concepts c WHERE c.company_id=cid AND c.builtin
     AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_concepts) j WHERE j->>'key'=c.key))
 THEN RAISE EXCEPTION 'concept_identity_required' USING ERRCODE='22023'; END IF;
 -- Whole-config save permits an intentional alias swap, but a collision in the
 -- final config rolls back EVERY row and the epoch. No partly saved settings.
 DELETE FROM public.assistant_v2_concept_aliases WHERE company_id=cid;
 DELETE FROM public.assistant_v2_concepts c WHERE company_id=cid AND NOT builtin
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_concepts) j WHERE j->>'key'=c.key);
 FOR concept IN SELECT value FROM jsonb_array_elements(p_concepts) LOOP
   IF jsonb_typeof(concept) IS DISTINCT FROM 'object' OR jsonb_typeof(concept->'aliases') IS DISTINCT FROM 'array'
     OR jsonb_typeof(concept->'builtin') IS DISTINCT FROM 'boolean'
   THEN RAISE EXCEPTION 'invalid_concept' USING ERRCODE='22023'; END IF;
   aliases:=ARRAY(SELECT jsonb_array_elements_text(concept->'aliases'));
   INSERT INTO public.assistant_v2_concepts(company_id,key,display_name,aliases,behavior,builtin)
   VALUES(cid,concept->>'key',concept->>'displayName',aliases,concept->>'behavior',(concept->>'builtin')::boolean)
   ON CONFLICT(company_id,key) DO UPDATE SET display_name=EXCLUDED.display_name,aliases=EXCLUDED.aliases,
     behavior=EXCLUDED.behavior,builtin=EXCLUDED.builtin;
 END LOOP;
 RETURN (SELECT epoch FROM public.assistant_v2_workflow_epochs WHERE company_id=cid);
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_save_assistant_vocabulary(uuid,bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_save_assistant_vocabulary(uuid,bigint,jsonb) TO service_role;

CREATE FUNCTION public.sa_v2_save_assistant_library(p_user_id uuid,p_expected_epoch bigint,p_collection_id uuid,p_enabled boolean,p_include_all boolean,p_members jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE cid uuid:=public.sa_v2_settings_actor(p_user_id); current_epoch bigint; member jsonb;
BEGIN
 SELECT epoch INTO current_epoch FROM public.assistant_v2_workflow_epochs WHERE company_id=cid FOR UPDATE;
 IF current_epoch IS DISTINCT FROM p_expected_epoch THEN RAISE EXCEPTION 'workflow_config_changed' USING ERRCODE='23505'; END IF;
 IF p_enabled IS NULL OR p_include_all IS NULL OR jsonb_typeof(p_members) IS DISTINCT FROM 'array' OR jsonb_array_length(p_members)>500
 THEN RAISE EXCEPTION 'invalid_library_config' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM public.component_collections WHERE id=p_collection_id AND company_id=cid FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'collection_company_mismatch' USING ERRCODE='42501'; END IF;
 IF (SELECT count(DISTINCT value->>'componentId') FROM jsonb_array_elements(p_members))<>jsonb_array_length(p_members)
 THEN RAISE EXCEPTION 'duplicate_component' USING ERRCODE='22023'; END IF;
 INSERT INTO public.assistant_v2_library_profiles(company_id,collection_id,enabled,include_all,updated_by)
 VALUES(cid,p_collection_id,p_enabled,p_include_all,p_user_id)
 ON CONFLICT(company_id,collection_id) DO UPDATE SET enabled=EXCLUDED.enabled,include_all=EXCLUDED.include_all,updated_by=p_user_id;
 -- This replaces SETTINGS rows atomically, not quote children. Failure of any
 -- membership/default/tenant check rolls back the profile and all mappings.
 DELETE FROM public.assistant_v2_library_members WHERE company_id=cid AND collection_id=p_collection_id;
 FOR member IN SELECT value FROM jsonb_array_elements(p_members) LOOP
   IF jsonb_typeof(member) IS DISTINCT FROM 'object' OR jsonb_typeof(member->'included') IS DISTINCT FROM 'boolean'
     OR jsonb_typeof(member->'isDefault') IS DISTINCT FROM 'boolean'
     OR (member->'conceptKey' IS NOT NULL AND jsonb_typeof(member->'conceptKey') NOT IN ('null','string'))
   THEN RAISE EXCEPTION 'invalid_library_member' USING ERRCODE='22023'; END IF;
   INSERT INTO public.assistant_v2_library_members(company_id,collection_id,component_id,included,concept_key,is_default,updated_by)
   VALUES(cid,p_collection_id,(member->>'componentId')::uuid,(member->>'included')::boolean,nullif(member->>'conceptKey',''),(member->>'isDefault')::boolean,p_user_id);
 END LOOP;
 RETURN (SELECT epoch FROM public.assistant_v2_workflow_epochs WHERE company_id=cid);
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_save_assistant_library(uuid,bigint,uuid,boolean,boolean,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_save_assistant_library(uuid,bigint,uuid,boolean,boolean,jsonb) TO service_role;
COMMIT;
