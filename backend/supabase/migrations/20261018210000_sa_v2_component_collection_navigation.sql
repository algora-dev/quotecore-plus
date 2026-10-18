-- 20261018210000: Smart Assistant can find + open component libraries
-- Owner gap (2026-10-18 16:43 GMT-4): "take me to the Roofline Corrugate
-- library" failed because V2 search/navigation had no component_collection
-- kind - only individual library components. Libraries live in
-- component_collections and are the user-facing "library" concept.
-- Adds: sa_v2_search kind 'component_collection' (name/assistant_call_name
-- match, components-permission gated) and a sa_v2_record branch returning a
-- library hit, so find_records/open_record/resolve_records produce real
-- Open buttons routing to /{slug}/components?collection={id}.

CREATE OR REPLACE FUNCTION public.sa_v2_search(p_kind text, p_query text, p_limit integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path = 'pg_catalog', 'pg_temp'
AS $function$
DECLARE v jsonb := public.sa_v2_runtime(); p jsonb := v->'permissions'; result jsonb;
BEGIN
  IF NOT (v->'phases'->>'p1')::boolean THEN RAISE EXCEPTION 'phase_off' USING ERRCODE='42501'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('all','quote','draft_quote','order','invoice','component','component_collection','customer')
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
    SELECT 'component_collection',cc.id,'components',left('Library: '||cc.name,300),
      left('Component library | '||(SELECT count(*) FROM public.component_library lc WHERE lc.collection_id=cc.id)||' components',600),NULL::text,
      public.sa_v2_match_score(p_query,concat_ws(' ',cc.name,cc.assistant_call_name),NULL),
      jsonb_build_object('name',cc.name,'is_bootstrap',cc.is_bootstrap,'is_default_takeoff_library',cc.is_default_takeoff_library),cc.updated_at
    FROM public.component_collections cc WHERE cc.company_id=(v->>'company_id')::uuid AND p->>'components'<>'hidden' AND p_kind IN ('all','component_collection')
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
$function$;

CREATE OR REPLACE FUNCTION public.sa_v2_record(p_kind text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path = 'pg_catalog', 'pg_temp'
AS $function$
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
  ELSIF p_kind='component_collection' AND p->>'components'<>'hidden' THEN
    SELECT jsonb_build_object('kind','component_collection','id',cc.id,'section','components','label',left('Library: '||cc.name,300),
      'detail',left('Component library | '||(SELECT count(*) FROM public.component_library lc WHERE lc.collection_id=cc.id)||' components',600),'status',NULL,'score',100,
      'fields',jsonb_build_object('name',cc.name,'is_bootstrap',cc.is_bootstrap,'is_default_takeoff_library',cc.is_default_takeoff_library))
      INTO result FROM public.component_collections cc WHERE cc.id=p_id AND cc.company_id=(v->>'company_id')::uuid;
  END IF;
  RETURN result;
END;
$function$;
