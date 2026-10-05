-- AGENT-TODO P1: verify live schema/pg_trgm and apply through the migration ledger; enable only after the P1 acceptance gate.
-- DRAFT. Apply after the accepted P0 migration. No quota/auth/pricing changes.
-- All rollout writes remain service-role only. Defaults keep every phase OFF.
BEGIN;
CREATE TABLE public.assistant_v2_rollout (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  p1 boolean NOT NULL DEFAULT false, p2 boolean NOT NULL DEFAULT false,
  p3 boolean NOT NULL DEFAULT false, p4 boolean NOT NULL DEFAULT false,
  write_policy text CHECK (write_policy IS NULL OR write_policy = 'propose_then_confirm'),
  confirmation_policy text CHECK (confirmation_policy IS NULL OR confirmation_policy = 'requester_button'),
  ledger_policy text CHECK (ledger_policy IS NULL OR ledger_policy = 'retain_action_fields'),
  enabled_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (NOT p2 OR p1), CHECK (NOT p3 OR p2), CHECK (NOT p4 OR p3),
  CHECK (NOT p3 OR (write_policy IS NOT NULL AND confirmation_policy IS NOT NULL AND ledger_policy IS NOT NULL))
);
ALTER TABLE public.assistant_v2_rollout ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_v2_rollout FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_v2_rollout TO service_role;
COMMENT ON TABLE public.assistant_v2_rollout IS 'Assistant-owned per-company phase gates. Never a companies column or quota flag-row lock. P3 policy values require explicit owner approval recorded by the integrator.';

CREATE FUNCTION public.sa_v2_runtime() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid(); v_company uuid; v_slug text; v_perm record;
  v_flags public.assistant_v2_rollout%ROWTYPE; v_enabled boolean; v_ready boolean;
BEGIN
  SELECT u.company_id, c.slug INTO v_company, v_slug
    FROM public.users u JOIN public.companies c ON c.id = u.company_id WHERE u.id = v_user;
  IF v_user IS NULL OR v_company IS NULL OR NOT COALESCE(public.smart_assistant_enabled(v_company), false) THEN
    RAISE EXCEPTION 'sa_v2_access_denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_perm FROM public.sa_v2_permissions_read();
  SELECT r.* INTO v_flags FROM public.assistant_v2_rollout r WHERE r.company_id = v_company;
  v_enabled := COALESCE(v_flags.p1, false);
  v_ready := v_flags.write_policy = 'propose_then_confirm' AND v_flags.confirmation_policy = 'requester_button' AND v_flags.ledger_policy = 'retain_action_fields';
  RETURN jsonb_build_object('user_id',v_user,'company_id',v_company,'workspace_slug',v_slug,
    'phases',jsonb_build_object('p1',v_enabled,'p2',v_enabled AND COALESCE(v_flags.p2,false),
      'p3',v_enabled AND COALESCE(v_flags.p2 AND v_flags.p3 AND v_ready,false),
      'p4',v_enabled AND COALESCE(v_flags.p2 AND v_flags.p3 AND v_flags.p4 AND v_ready,false)),
    'permissions',v_perm.permissions,'permission_revision',v_perm.revision,
    'history_after',GREATEST(v_flags.enabled_at,v_perm.updated_at), 'write_policy',v_flags.write_policy);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_runtime() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_runtime() TO authenticated;

-- A timestamp alone cannot distinguish V1 turns written during a rollback.
-- Every V2 model run gets a trusted scope marker before tools/history are used.
CREATE TABLE public.assistant_v2_run_scopes (
  run_id uuid PRIMARY KEY REFERENCES public.smart_assistant_runs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission_revision integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.assistant_v2_run_scopes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_v2_run_scopes FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.assistant_v2_run_scopes TO service_role;
CREATE FUNCTION public.sa_v2_run_scope_add(p_run_id uuid,p_user_id uuid,p_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE r public.smart_assistant_runs%ROWTYPE; current_revision integer; actual_revision integer;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'trusted_only' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.smart_assistant_runs WHERE id=p_run_id AND user_id=p_user_id;
 IF NOT FOUND OR r.status NOT IN ('accepted','running')
   OR NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=p_user_id AND u.company_id=r.company_id)
   OR NOT COALESCE(public.smart_assistant_enabled(r.company_id),false)
   OR NOT EXISTS(SELECT 1 FROM public.assistant_v2_rollout f WHERE f.company_id=r.company_id AND f.p1) THEN
   RAISE EXCEPTION 'invalid_run' USING ERRCODE='42501';
 END IF;
 SELECT COALESCE((SELECT p.revision FROM public.assistant_section_permissions p WHERE p.company_id=r.company_id),0) INTO current_revision;
 IF p_revision IS DISTINCT FROM current_revision THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 INSERT INTO public.assistant_v2_run_scopes(run_id,company_id,user_id,permission_revision)
   VALUES(r.id,r.company_id,p_user_id,p_revision) ON CONFLICT(run_id) DO NOTHING;
 SELECT x.permission_revision INTO actual_revision FROM public.assistant_v2_run_scopes x WHERE x.run_id=r.id AND x.user_id=p_user_id AND x.company_id=r.company_id;
 IF actual_revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('ok',true);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_run_scope_add(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_run_scope_add(uuid,uuid,integer) TO service_role;

CREATE TABLE public.assistant_v2_context (
  conversation_id uuid PRIMARY KEY REFERENCES public.smart_assistant_conversations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pathname text CHECK (pathname IS NULL OR length(pathname) <= 500),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.assistant_v2_context ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_v2_context FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_v2_context TO service_role;
CREATE TABLE public.assistant_v2_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.smart_assistant_conversations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.smart_assistant_runs(id) ON DELETE CASCADE,
  card_key text NOT NULL CHECK (length(card_key) BETWEEN 1 AND 200),
  sections text[] NOT NULL,
  content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object' AND pg_column_size(content) < 64000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(run_id, card_key)
);
CREATE INDEX sa_v2_cards_conversation ON public.assistant_v2_cards(conversation_id, created_at);
ALTER TABLE public.assistant_v2_cards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_v2_cards FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_v2_cards TO service_role;
-- Read through identity-derived RPCs only. Models/browsers cannot forge cards.

CREATE FUNCTION public.sa_v2_context_set(p_conversation_id uuid, p_pathname text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE v jsonb := public.sa_v2_runtime(); v_prefix text;
BEGIN
  IF NOT (v->'phases'->>'p1')::boolean THEN RAISE EXCEPTION 'phase_off' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.smart_assistant_conversations c WHERE c.id=p_conversation_id
    AND c.user_id=auth.uid() AND c.company_id=(v->>'company_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
  v_prefix := '/' || (v->>'workspace_slug') || '/';
  IF p_pathname IS NOT NULL AND (length(p_pathname)>500 OR left(p_pathname,length(v_prefix))<>v_prefix
     OR p_pathname ~ '[\\%?#[:cntrl:][:space:]]' OR position('..' in p_pathname)>0) THEN
    RAISE EXCEPTION 'invalid_path' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.assistant_v2_context(conversation_id,company_id,user_id,pathname)
    VALUES(p_conversation_id,(v->>'company_id')::uuid,auth.uid(),p_pathname)
    ON CONFLICT(conversation_id) DO UPDATE SET pathname=EXCLUDED.pathname,updated_at=clock_timestamp();
  RETURN jsonb_build_object('ok',true);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_context_set(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_context_set(uuid,text) TO authenticated;

-- pg_trgm is already required by the supplied catalog-library migration.
-- Resolve its installed schema instead of assuming public vs extensions.
DO $migration$
DECLARE ns text;
BEGIN
  SELECT n.nspname INTO ns FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_trgm';
  IF ns IS NULL THEN RAISE EXCEPTION 'P1 requires the existing catalog pg_trgm extension. Review catalog migration before applying P1.'; END IF;
  EXECUTE format($ddl$
    CREATE FUNCTION public.sa_v2_match_score(p_query text,p_text text,p_number text) RETURNS double precision
    LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $fn$
      SELECT CASE
        WHEN btrim(p_query)='' THEN 1::double precision
        WHEN lower(btrim(p_query))=lower(COALESCE(p_number,'')) AND p_number IS NOT NULL THEN 100
        WHEN lower(btrim(p_query))=lower(btrim(p_text)) THEN 95
        WHEN position(lower(btrim(p_query)) in lower(p_text))>0 THEN 85
        ELSE 70 * %I.word_similarity(lower(left(p_query,120)),lower(left(p_text,1200))) END;
    $fn$;
  $ddl$,ns);
END;
$migration$;
REVOKE ALL ON FUNCTION public.sa_v2_match_score(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_match_score(text,text,text) TO authenticated,service_role;

CREATE FUNCTION public.sa_v2_search(p_kind text,p_query text,p_limit integer DEFAULT 10) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb := public.sa_v2_runtime(); p jsonb := v->'permissions'; result jsonb;
BEGIN
  IF NOT (v->'phases'->>'p1')::boolean THEN RAISE EXCEPTION 'phase_off' USING ERRCODE='42501'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('all','quote','draft_quote','order','invoice','component','customer')
    OR p_query IS NULL OR length(p_query)>120 OR p_limit IS NULL OR p_limit<1 OR p_limit>10 THEN
    RAISE EXCEPTION 'invalid_search' USING ERRCODE='22023';
  END IF;
  WITH candidates AS (
    SELECT CASE WHEN q.status::text='draft' THEN 'draft_quote' ELSE 'quote' END AS kind,q.id,
      CASE WHEN q.status::text='draft' THEN 'draft_quotes' ELSE 'quotes' END AS section,
      left(CASE WHEN q.status::text='draft' THEN 'Draft' ELSE 'Quote' END || COALESCE(' #'||q.quote_number::text,'') || ' - '||q.customer_name,300) AS label,
      left(COALESCE(q.job_name,'') || ' | ' || q.status::text,600) AS detail,q.status::text,
      public.sa_v2_match_score(p_query,concat_ws(' ',q.customer_name,q.job_name,q.quote_number::text,q.status::text),q.quote_number::text) AS score,
      jsonb_build_object('customer_name',q.customer_name,'job_name',q.job_name,'quote_number',q.quote_number,'entry_mode',q.entry_mode,'measurement_system',q.measurement_system,'created_at',q.created_at) AS fields,
      q.updated_at AS touched
    FROM public.quotes q WHERE q.company_id=(v->>'company_id')::uuid
      AND (CASE WHEN q.status::text='draft' THEN p->>'draft_quotes' ELSE p->>'quotes' END)<>'hidden'
      AND (p_kind='all' OR (p_kind='draft_quote' AND q.status::text='draft') OR (p_kind='quote' AND q.status::text<>'draft'))
    UNION ALL
    SELECT 'order',o.id,'orders',left('Order '||o.order_number||' - '||COALESCE(o.job_name,o.supplier_name,''),300),
      left(COALESCE(o.supplier_name,'')||' | '||o.status,600),o.status,
      public.sa_v2_match_score(p_query,concat_ws(' ',o.order_number,o.job_name,o.supplier_name,o.status),o.order_number),
      jsonb_build_object('order_number',o.order_number,'job_name',o.job_name,'supplier_name',o.supplier_name,'delivery_date',o.delivery_date),o.updated_at
    FROM public.material_orders o WHERE o.company_id=(v->>'company_id')::uuid AND p->>'orders'<>'hidden' AND p_kind IN ('all','order')
    UNION ALL
    SELECT 'invoice',i.id,'invoices',left('Invoice '||i.invoice_number||' - '||i.customer_name,300),left(i.status::text||' | '||i.currency||' '||i.total::text,600),i.status::text,
      public.sa_v2_match_score(p_query,concat_ws(' ',i.invoice_number,i.customer_name,i.status::text),i.invoice_number),
      jsonb_build_object('invoice_number',i.invoice_number,'customer_name',i.customer_name,'currency',i.currency,'total',i.total,'due_date',i.due_date),i.updated_at
    FROM public.invoices i WHERE i.company_id=(v->>'company_id')::uuid AND p->>'invoices'<>'hidden' AND p_kind IN ('all','invoice')
    UNION ALL
    SELECT 'component',c.id,'components',left(c.name,300),left(c.measurement_type::text||' | '||COALESCE(c.sku,'')||CASE WHEN c.is_active THEN '' ELSE ' | inactive' END,600),
      CASE WHEN c.is_active THEN 'active' ELSE 'inactive' END,
      public.sa_v2_match_score(p_query,concat_ws(' ',c.name,c.sku,c.measurement_type::text),c.sku),
      jsonb_build_object('measurement_type',c.measurement_type,'sku',c.sku,'collection_id',c.collection_id,'is_active',c.is_active),c.updated_at
    FROM public.component_library c WHERE c.company_id=(v->>'company_id')::uuid AND p->>'components'<>'hidden' AND p_kind IN ('all','component')
    UNION ALL
    SELECT 'customer',c.id,'customers',left(c.customer_name,300),left('Contact from '||CASE WHEN c.status::text='draft' THEN 'draft' ELSE 'quote' END||COALESCE(' #'||c.quote_number::text,'')||' | '||COALESCE(c.job_name,''),600),NULL::text,
      public.sa_v2_match_score(p_query,concat_ws(' ',c.customer_name,c.customer_email,c.customer_phone),NULL),
      jsonb_build_object('customer_name',c.customer_name,'customer_email',c.customer_email,'source_status',c.status,'entry_mode',c.entry_mode,'source_quote_id',c.id),c.updated_at
    FROM (SELECT DISTINCT ON (lower(btrim(q.customer_name)),lower(COALESCE(q.customer_email,''))) q.*
      FROM public.quotes q WHERE q.company_id=(v->>'company_id')::uuid AND length(btrim(q.customer_name))>0
      AND (CASE WHEN q.status::text='draft' THEN p->>'draft_quotes' ELSE p->>'quotes' END)<>'hidden'
      ORDER BY lower(btrim(q.customer_name)),lower(COALESCE(q.customer_email,'')),q.updated_at DESC,q.id) c
      WHERE p->>'customers'<>'hidden' AND p_kind IN ('all','customer')
  ), ranked AS (SELECT * FROM candidates WHERE p_query='' OR score>=28 ORDER BY score DESC,touched DESC,id LIMIT p_limit)
  SELECT COALESCE(jsonb_agg(to_jsonb(r)-'touched' ORDER BY r.score DESC,r.touched DESC,r.id),'[]'::jsonb) INTO result FROM ranked r;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_search(text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_search(text,text,integer) TO authenticated;

CREATE FUNCTION public.sa_v2_record(p_kind text,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb:=public.sa_v2_runtime(); p jsonb:=v->'permissions'; result jsonb; q record; row_json jsonb; k text; section text;
BEGIN
  IF NOT (v->'phases'->>'p1')::boolean THEN RAISE EXCEPTION 'phase_off' USING ERRCODE='42501'; END IF;
  IF p_kind IN ('quote','draft_quote','customer') THEN
    SELECT t.id,t.customer_name,t.customer_email,t.customer_phone,t.job_name,t.site_address,t.status,t.entry_mode,t.quote_number,
      t.currency,t.measurement_system,t.global_pitch_degrees,t.created_at,t.updated_at,t.viewed_at,t.accepted_at,t.trade,t.component_collection_id
      INTO q FROM public.quotes t WHERE t.id=p_id AND t.company_id=(v->>'company_id')::uuid;
    IF NOT FOUND THEN RETURN NULL; END IF;
    k:=CASE WHEN q.status::text='draft' THEN 'draft_quote' ELSE 'quote' END;
    section:=CASE WHEN k='draft_quote' THEN 'draft_quotes' ELSE 'quotes' END;
    IF p->>section='hidden' OR (p_kind='customer' AND p->>'customers'='hidden') OR (p_kind='draft_quote' AND k<>'draft_quote') THEN RETURN NULL; END IF;
    row_json:=to_jsonb(q);
    IF p->>'customers'='hidden' THEN
      row_json:=row_json-'customer_email'-'customer_phone'-'site_address';
    END IF;
    IF p_kind='customer' THEN
      RETURN jsonb_build_object('kind','customer','id',q.id,'section','customers','label',left(q.customer_name,300),'detail','Contact details from an authorised quote','status',NULL,'score',100,
        'fields',jsonb_build_object('customer_name',q.customer_name,'customer_email',q.customer_email,'customer_phone',q.customer_phone,'site_address',q.site_address,'source_status',q.status,'source_quote_id',q.id,'entry_mode',q.entry_mode));
    END IF;
    IF p->>'components'<>'hidden' THEN
      row_json:=row_json || jsonb_build_object('components',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'measurement_type',c.measurement_type,'material_rate',c.material_rate,'labour_rate',c.labour_rate,'waste_type',c.waste_type,'waste_percent',c.waste_percent,'pitch_type',c.pitch_type,'custom_pitch_degrees',c.custom_pitch_degrees,'use_custom_pitch',c.use_custom_pitch,'final_quantity',c.final_quantity,'material_cost',c.material_cost,'labour_cost',c.labour_cost) ORDER BY c.sort_order,c.id) FROM (SELECT * FROM public.quote_components WHERE quote_id=p_id ORDER BY sort_order,id LIMIT 40) c),'[]'::jsonb));
    END IF;
    row_json:=row_json || jsonb_build_object('roof_areas',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'label',a.label,'computed_sqm',a.computed_sqm,'calc_plan_sqm',a.calc_plan_sqm,'pitch_degrees',a.calc_pitch_degrees,'is_locked',a.is_locked) ORDER BY a.sort_order,a.id) FROM (SELECT * FROM public.quote_roof_areas WHERE quote_id=p_id ORDER BY sort_order,id LIMIT 20) a),'[]'::jsonb),'children_note','At most 40 components and 20 areas. Values are stored values, not a complete customer total.');
    RETURN jsonb_build_object('kind',k,'id',q.id,'section',section,'label',left(CASE WHEN k='draft_quote' THEN 'Draft' ELSE 'Quote' END||COALESCE(' #'||q.quote_number::text,'')||' - '||q.customer_name,300),'detail',left(COALESCE(q.job_name,'')||' | '||q.status::text,600),'status',q.status,'score',100,'fields',row_json);
  ELSIF p_kind='order' AND p->>'orders'<>'hidden' THEN
    SELECT jsonb_build_object('kind','order','id',o.id,'section','orders','label',left('Order '||o.order_number,300),'detail',left(COALESCE(o.job_name,'')||' | '||o.status,600),'status',o.status,'score',100,
      'fields',jsonb_build_object('order_number',o.order_number,'job_name',o.job_name,'supplier_name',o.supplier_name,'status',o.status,'order_date',o.order_date,'delivery_date',o.delivery_date,'confirmed_at',o.confirmed_at,'last_supplier_response_at',o.last_supplier_response_at))
      INTO result FROM public.material_orders o WHERE o.id=p_id AND o.company_id=(v->>'company_id')::uuid;
  ELSIF p_kind='invoice' AND p->>'invoices'<>'hidden' THEN
    SELECT jsonb_build_object('kind','invoice','id',i.id,'section','invoices','label',left('Invoice '||i.invoice_number,300),'detail',left(i.customer_name||' | '||i.status::text,600),'status',i.status,'score',100,
      'fields',jsonb_build_object('invoice_number',i.invoice_number,'customer_name',i.customer_name,'status',i.status,'invoice_date',i.invoice_date,'due_date',i.due_date,'paid_at',i.paid_at,'currency',i.currency,'total',i.total))
      INTO result FROM public.invoices i WHERE i.id=p_id AND i.company_id=(v->>'company_id')::uuid;
  ELSIF p_kind='component' AND p->>'components'<>'hidden' THEN
    SELECT jsonb_build_object('kind','component','id',c.id,'section','components','label',left(c.name,300),'detail',c.measurement_type::text,'status',CASE WHEN c.is_active THEN 'active' ELSE 'inactive' END,'score',100,
      'fields',jsonb_build_object('name',c.name,'measurement_type',c.measurement_type,'component_type',c.component_type,'default_material_rate',c.default_material_rate,'default_labour_rate',c.default_labour_rate,'default_pitch_type',c.default_pitch_type,'default_waste_type',c.default_waste_type,'default_waste_percent',c.default_waste_percent,'default_waste_fixed',c.default_waste_fixed,'pricing_strategy',c.pricing_strategy,'pack_price',c.pack_price,'pack_size',c.pack_size,'pack_coverage_m2',c.pack_coverage_m2,'collection_id',c.collection_id,'is_active',c.is_active))
      INTO result FROM public.component_library c WHERE c.id=p_id AND c.company_id=(v->>'company_id')::uuid;
  END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_record(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_record(text,uuid) TO authenticated;

CREATE FUNCTION public.sa_v2_card_add(p_run_id uuid,p_user_id uuid,p_key text,p_sections text[],p_content jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE r public.smart_assistant_runs%ROWTYPE; card_id uuid;
BEGIN
  -- Only server code can produce executable card references; not the model/browser.
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'trusted_only' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.smart_assistant_runs WHERE id=p_run_id AND user_id=p_user_id;
  IF NOT FOUND OR r.status NOT IN ('accepted','running') OR NOT public.smart_assistant_enabled(r.company_id) THEN RAISE EXCEPTION 'invalid_run' USING ERRCODE='42501'; END IF;
  IF p_key IS NULL OR length(p_key) NOT BETWEEN 1 AND 200 OR jsonb_typeof(p_content)<>'object'
    OR p_sections IS NULL OR cardinality(p_sections)>9 OR NOT p_sections <@ ARRAY['quotes','draft_quotes','orders','invoices','components','customers','emails','billing','settings']::text[] THEN
    RAISE EXCEPTION 'invalid_card' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.assistant_v2_cards(conversation_id,company_id,user_id,run_id,card_key,sections,content)
    VALUES(r.conversation_id,r.company_id,r.user_id,r.id,p_key,p_sections,p_content)
    ON CONFLICT(run_id,card_key) DO UPDATE SET content=EXCLUDED.content,sections=EXCLUDED.sections
    RETURNING id INTO card_id;
  RETURN jsonb_build_object('id',card_id);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_card_add(uuid,uuid,text,text[],jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_card_add(uuid,uuid,text,text[],jsonb) TO service_role;

CREATE FUNCTION public.sa_v2_session_read(p_conversation_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb:=public.sa_v2_runtime(); cards jsonb; page_path text; messages jsonb; active_id uuid; run_state text; recent_runs jsonb;
BEGIN
  IF NOT (v->'phases'->>'p1')::boolean THEN RAISE EXCEPTION 'phase_off' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.smart_assistant_conversations c WHERE c.id=p_conversation_id AND c.user_id=auth.uid() AND c.company_id=(v->>'company_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
  SELECT c.pathname INTO page_path FROM public.assistant_v2_context c WHERE c.conversation_id=p_conversation_id AND c.user_id=auth.uid();
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at,x.id),'[]'::jsonb) INTO cards FROM (
    SELECT c.id,c.run_id,c.content,c.created_at FROM public.assistant_v2_cards c JOIN public.smart_assistant_runs r ON r.id=c.run_id
    WHERE c.conversation_id=p_conversation_id AND c.user_id=auth.uid() AND c.company_id=(v->>'company_id')::uuid
      AND EXISTS(SELECT 1 FROM public.assistant_v2_run_scopes sc WHERE sc.run_id=r.id AND sc.user_id=auth.uid() AND sc.company_id=(v->>'company_id')::uuid AND sc.permission_revision=(v->>'permission_revision')::integer)
      AND r.status='completed' AND c.created_at >= (v->>'history_after')::timestamptz AND r.started_at >= (v->>'history_after')::timestamptz
      AND NOT EXISTS(SELECT 1 FROM unnest(c.sections) AS sec WHERE COALESCE(v->'permissions'->>sec,'hidden')='hidden')
    ORDER BY c.created_at DESC,c.id LIMIT 80
  ) x;
  SELECT c.active_run_id,r.status INTO active_id,run_state FROM public.smart_assistant_conversations c
    LEFT JOIN public.smart_assistant_runs r ON r.id=c.active_run_id WHERE c.id=p_conversation_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at,x.id),'[]'::jsonb) INTO messages FROM (
    SELECT m.id,m.role,m.content,m.run_id,m.created_at FROM public.smart_assistant_messages m
    WHERE m.conversation_id=p_conversation_id AND m.role IN ('user','assistant')
      AND EXISTS(SELECT 1 FROM public.assistant_v2_run_scopes sc WHERE sc.run_id=m.run_id AND sc.user_id=auth.uid() AND sc.company_id=(v->>'company_id')::uuid AND sc.permission_revision=(v->>'permission_revision')::integer)
      AND EXISTS(SELECT 1 FROM public.smart_assistant_runs mr WHERE mr.id=m.run_id AND mr.started_at >= (v->>'history_after')::timestamptz)
      AND m.created_at >= (v->>'history_after')::timestamptz
    ORDER BY m.created_at DESC,m.id DESC LIMIT 100
  ) x;
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.started_at),'[]'::jsonb) INTO recent_runs FROM (
    SELECT r.id,r.client_request_id,r.status,r.started_at FROM public.smart_assistant_runs r
    WHERE r.conversation_id=p_conversation_id AND r.user_id=auth.uid() AND r.company_id=(v->>'company_id')::uuid
      AND r.started_at >= (v->>'history_after')::timestamptz ORDER BY r.started_at DESC LIMIT 20
  ) x;
  RETURN jsonb_build_object('cards',cards,'actions','[]'::jsonb,'pathname',page_path,
    'messages',messages,'recent_runs',recent_runs,'active_run_id',active_id,'run_status',run_state);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_session_read(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_session_read(uuid) TO authenticated;
COMMIT;
