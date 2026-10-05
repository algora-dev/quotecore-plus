-- DRAFT / NOT APPLIED. P1.5 bounded read-only facts. Requires integrated P0/P1 only.
-- No quotas, billing, pricing formulas, auth infrastructure or existing RPCs changed.
-- Enable SMART_ASSISTANT_FACTS_ENABLED only after the integration gates pass.
BEGIN;

-- Scope table is private. This narrow helper checks the authenticated owner,
-- company, active admitted run and CURRENT revision before any new fact reader.
CREATE FUNCTION public.sa_v2_speed_scope(p_run_id uuid,p_revision integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb:=public.sa_v2_runtime();
BEGIN
 IF NOT COALESCE((v->'phases'->>'p1')::boolean,false)
   OR p_revision IS DISTINCT FROM (v->>'permission_revision')::integer
   OR NOT EXISTS(SELECT 1 FROM public.assistant_v2_run_scopes sc
      JOIN public.smart_assistant_runs r ON r.id=sc.run_id
      JOIN public.smart_assistant_conversations c ON c.id=r.conversation_id
      WHERE sc.run_id=p_run_id AND sc.user_id=auth.uid() AND sc.company_id=(v->>'company_id')::uuid
       AND sc.permission_revision=p_revision AND r.user_id=auth.uid() AND r.company_id=sc.company_id
       AND c.user_id=auth.uid() AND c.company_id=sc.company_id AND r.status IN ('accepted','running')) THEN
   RAISE EXCEPTION 'access_changed' USING ERRCODE='42501';
 END IF;
 RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_speed_scope(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_speed_scope(uuid,integer) TO authenticated;

CREATE FUNCTION public.sa_v2_speed_count(p_run_id uuid,p_revision integer,p_kind text,p_period text,p_owner text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp SET statement_timeout='5s' AS $$
DECLARE v jsonb:=public.sa_v2_speed_scope(p_run_id,p_revision); n bigint; start_at timestamptz; end_at timestamptz; section text;
BEGIN
 IF p_kind IS NULL OR p_kind NOT IN ('quote','draft_quote') OR p_period IS NULL OR p_period NOT IN ('all_time','this_month')
   OR p_owner IS NULL OR p_owner NOT IN ('workspace','me') THEN RAISE EXCEPTION 'invalid_query' USING ERRCODE='22023'; END IF;
 section:=CASE WHEN p_kind='draft_quote' THEN 'draft_quotes' ELSE 'quotes' END;
 IF COALESCE(v->'permissions'->>section,'hidden')='hidden' THEN RAISE EXCEPTION 'section_hidden' USING ERRCODE='42501'; END IF;
 start_at:=date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 end_at:=(date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'UTC')+interval '1 month') AT TIME ZONE 'UTC';
 SELECT count(*) INTO n FROM public.quotes q WHERE q.company_id=(v->>'company_id')::uuid
   AND ((p_kind='draft_quote' AND q.status::text='draft') OR (p_kind='quote' AND q.status::text<>'draft'))
   AND (p_owner='workspace' OR q.created_by_user_id=auth.uid())
   AND (p_period='all_time' OR (q.created_at>=start_at AND q.created_at<end_at));
 RETURN jsonb_build_object('count',n::text,'kind',p_kind,'period',p_period,'owner',p_owner,'timezone','UTC',
   'as_of',CURRENT_TIMESTAMP,'complete',true);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_speed_count(uuid,integer,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_speed_count(uuid,integer,text,text,text) TO authenticated;

-- One MVCC read snapshot, never PostgREST's truncated default page presented as
-- a total. Returns engine inputs, NOT an alternative SQL price formula.
CREATE FUNCTION public.sa_v2_speed_quote_snapshot(p_run_id uuid,p_revision integer,p_quote_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp SET statement_timeout='5s' AS $$
DECLARE v jsonb:=public.sa_v2_speed_scope(p_run_id,p_revision); q record; section text; components jsonb; lines jsonb; taxes jsonb; currency text;
BEGIN
 SELECT t.id,t.status,t.currency,t.material_margin_percent,t.labor_margin_percent,t.tax_rate INTO q
 FROM public.quotes t WHERE t.id=p_quote_id AND t.company_id=(v->>'company_id')::uuid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 section:=CASE WHEN q.status::text='draft' THEN 'draft_quotes' ELSE 'quotes' END;
 IF COALESCE(v->'permissions'->>section,'hidden')='hidden' THEN RETURN NULL; END IF;
 SELECT COALESCE(c.default_currency,'NZD') INTO currency FROM public.companies c WHERE c.id=(v->>'company_id')::uuid;
 IF COALESCE(v->'permissions'->>'components','hidden')<>'hidden' THEN
   SELECT COALESCE(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO components FROM
     (SELECT c.material_cost,c.labour_cost FROM public.quote_components c WHERE c.quote_id=p_quote_id ORDER BY c.sort_order,c.id LIMIT 501) x;
 END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO lines FROM
   (SELECT l.custom_amount,l.include_in_total,l.is_visible,l.line_type FROM public.customer_quote_lines l WHERE l.quote_id=p_quote_id ORDER BY l.sort_order,l.id LIMIT 501) x;
 SELECT COALESCE(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO taxes FROM
   (SELECT t.id,t.name,t.rate_percent,t.include_in_quote,t.include_in_labor FROM public.quote_taxes t WHERE t.quote_id=p_quote_id ORDER BY t.sort_order,t.created_at,t.id LIMIT 101) x;
 IF COALESCE(jsonb_array_length(components),0)>500 OR jsonb_array_length(lines)>500 OR jsonb_array_length(taxes)>100 THEN
   RETURN jsonb_build_object('complete',false,'as_of',CURRENT_TIMESTAMP);
 END IF;
 RETURN jsonb_build_object('complete',true,'as_of',CURRENT_TIMESTAMP,'quote',to_jsonb(q),'default_currency',currency,
   'components',components,'lines',lines,'taxes',taxes);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_speed_quote_snapshot(uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_speed_quote_snapshot(uuid,integer,uuid) TO authenticated;
COMMIT;
