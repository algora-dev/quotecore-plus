-- AGENT-TODO P2: reconcile attention counts and unavailable-source behaviour with real authorised fixture rows before enabling.
-- DRAFT P2. Read-only attention aggregation; does not schedule or send messages.
BEGIN;
CREATE FUNCTION public.sa_v2_attention() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb:=public.sa_v2_runtime(); p jsonb:=v->'permissions'; cid uuid:=(v->>'company_id')::uuid;
  checked timestamptz:=statement_timestamp(); groups jsonb:='[]'; n bigint; items jsonb;
BEGIN
  IF NOT (v->'phases'->>'p2')::boolean THEN RAISE EXCEPTION 'phase_off' USING ERRCODE='42501'; END IF;
  IF p->>'quotes'<>'hidden' THEN
    BEGIN
      WITH hits AS (
 SELECT 'quote'::text kind,q.id,left('Quote '||COALESCE('#'||q.quote_number::text,'')||' - '||q.customer_name,300) label,
   left(COALESCE(q.job_name,'')||' | viewed '||q.viewed_at::text,600) detail,q.viewed_at due
 FROM public.quotes q WHERE q.company_id=cid AND q.viewed_at IS NOT NULL AND q.viewed_at<=checked
   AND q.status::text IN ('confirmed','sent') AND q.accepted_at IS NULL AND q.declined_at IS NULL AND q.withdrawn_at IS NULL
)
      SELECT (SELECT count(*) FROM hits),
        COALESCE((SELECT jsonb_agg(to_jsonb(x)-'due' ORDER BY x.due,x.id) FROM
          (SELECT * FROM (SELECT DISTINCT ON (kind,id) kind,id,label,detail,due FROM hits ORDER BY kind,id,due) unique_hits ORDER BY due,id LIMIT 10) x),'[]'::jsonb)
      INTO n,items;
      groups:=groups||jsonb_build_array(jsonb_build_object('key','viewed_quotes','title','Quotes viewed, awaiting a decision','state','available','count',n,'items',items,'note','Viewed pending quotes only; drafts and completed or withdrawn quotes are excluded. Up to 10 shown.'));
    EXCEPTION WHEN undefined_table OR undefined_column OR insufficient_privilege THEN
      groups:=groups||jsonb_build_array(jsonb_build_object('key','viewed_quotes','title','Quotes viewed, awaiting a decision','state','unavailable','count',NULL,'items','[]'::jsonb,'note','This source could not be read. It is not a zero result. Ask your administrator to check the P2 migration and data access.'));
    END;
  ELSE
    groups:=groups||jsonb_build_array(jsonb_build_object('key','viewed_quotes','title','Quotes viewed, awaiting a decision','state','hidden','count',NULL,'items','[]'::jsonb,'note','Not included with current assistant permissions.'));
  END IF;
  IF p->>'orders'<>'hidden' THEN
    BEGIN
      WITH hits AS (
 SELECT 'order'::text kind,o.id,left('Order '||o.order_number||' - '||COALESCE(o.supplier_name,''),300) label,
   left(COALESCE(o.job_name,'')||' | '||o.status,600) detail,o.created_at due
 FROM public.material_orders o WHERE o.company_id=cid AND o.is_sent IS TRUE
   AND o.status NOT IN ('cancelled','declined','confirmed','archived') AND o.last_supplier_response_at IS NULL
   AND o.confirmed_at IS NULL AND o.declined_at IS NULL AND o.changes_requested_at IS NULL AND o.info_requested_at IS NULL
)
      SELECT (SELECT count(*) FROM hits),
        COALESCE((SELECT jsonb_agg(to_jsonb(x)-'due' ORDER BY x.due,x.id) FROM
          (SELECT * FROM (SELECT DISTINCT ON (kind,id) kind,id,label,detail,due FROM hits ORDER BY kind,id,due) unique_hits ORDER BY due,id LIMIT 10) x),'[]'::jsonb)
      INTO n,items;
      groups:=groups||jsonb_build_array(jsonb_build_object('key','supplier_waiting','title','Orders awaiting supplier response','state','available','count',n,'items',items,'note','Sent orders with no supplier response recorded. Up to 10 shown; opening one does not send a follow-up.'));
    EXCEPTION WHEN undefined_table OR undefined_column OR insufficient_privilege THEN
      groups:=groups||jsonb_build_array(jsonb_build_object('key','supplier_waiting','title','Orders awaiting supplier response','state','unavailable','count',NULL,'items','[]'::jsonb,'note','This source could not be read. It is not a zero result. Ask your administrator to check the P2 migration and data access.'));
    END;
  ELSE
    groups:=groups||jsonb_build_array(jsonb_build_object('key','supplier_waiting','title','Orders awaiting supplier response','state','hidden','count',NULL,'items','[]'::jsonb,'note','Not included with current assistant permissions.'));
  END IF;
  IF p->>'invoices'<>'hidden' THEN
    BEGIN
      WITH hits AS (
 SELECT 'invoice'::text kind,i.id,left('Invoice '||i.invoice_number||' - '||i.customer_name,300) label,
   left('Due '||i.due_date::text||' | '||i.currency||' '||i.total::text||' | '||i.status::text,600) detail,i.due_date::timestamptz due
 FROM public.invoices i WHERE i.company_id=cid AND i.status::text IN ('sent','viewed','payment_reported','disputed')
   AND i.due_date<(checked AT TIME ZONE 'UTC')::date AND i.paid_at IS NULL AND i.cancelled_at IS NULL
)
      SELECT (SELECT count(*) FROM hits),
        COALESCE((SELECT jsonb_agg(to_jsonb(x)-'due' ORDER BY x.due,x.id) FROM
          (SELECT * FROM (SELECT DISTINCT ON (kind,id) kind,id,label,detail,due FROM hits ORDER BY kind,id,due) unique_hits ORDER BY due,id LIMIT 10) x),'[]'::jsonb)
      INTO n,items;
      groups:=groups||jsonb_build_array(jsonb_build_object('key','overdue_invoices','title','Overdue invoices','state','available','count',n,'items',items,'note','Due dates before today in UTC, not a guessed company timezone. Payment-reported and disputed invoices remain labelled until paid. Amounts are stored invoice totals, not calculated balances.'));
    EXCEPTION WHEN undefined_table OR undefined_column OR insufficient_privilege THEN
      groups:=groups||jsonb_build_array(jsonb_build_object('key','overdue_invoices','title','Overdue invoices','state','unavailable','count',NULL,'items','[]'::jsonb,'note','This source could not be read. It is not a zero result. Ask your administrator to check the P2 migration and data access.'));
    END;
  ELSE
    groups:=groups||jsonb_build_array(jsonb_build_object('key','overdue_invoices','title','Overdue invoices','state','hidden','count',NULL,'items','[]'::jsonb,'note','Not included with current assistant permissions.'));
  END IF;
  IF p->>'emails'<>'hidden' THEN
    BEGIN
      WITH hits AS (
 SELECT CASE WHEN q.id IS NOT NULL THEN CASE WHEN q.status::text='draft' THEN 'draft_quote' ELSE 'quote' END WHEN o.id IS NOT NULL THEN 'order' ELSE 'invoice' END kind,
   COALESCE(q.id,o.id,i.id) id,
   left(CASE WHEN q.id IS NOT NULL THEN 'Quote follow-up - '||q.customer_name WHEN o.id IS NOT NULL THEN 'Order follow-up - '||o.order_number ELSE 'Invoice follow-up - '||i.invoice_number END,300) label,
   'Scheduled for '||m.fire_at::text detail,m.fire_at due
 FROM public.scheduled_messages m
 LEFT JOIN public.quotes q ON q.id=m.quote_id AND q.company_id=cid AND (CASE WHEN q.status::text='draft' THEN p->>'draft_quotes' ELSE p->>'quotes' END)<>'hidden'
 LEFT JOIN public.material_orders o ON o.id=m.order_id AND o.company_id=cid AND p->>'orders'<>'hidden'
 LEFT JOIN public.invoices i ON i.id=m.invoice_id AND i.company_id=cid AND p->>'invoices'<>'hidden'
 WHERE m.company_id=cid AND m.status='scheduled' AND m.fire_at<=checked AND COALESCE(q.id,o.id,i.id) IS NOT NULL
)
      SELECT (SELECT count(*) FROM hits),
        COALESCE((SELECT jsonb_agg(to_jsonb(x)-'due' ORDER BY x.due,x.id) FROM
          (SELECT * FROM (SELECT DISTINCT ON (kind,id) kind,id,label,detail,due FROM hits ORDER BY kind,id,due) unique_hits ORDER BY due,id LIMIT 10) x),'[]'::jsonb)
      INTO n,items;
      groups:=groups||jsonb_build_array(jsonb_build_object('key','followups','title','Scheduled follow-ups due','state','available','count',n,'items',items,'note','Scheduled records due now, not a promise of delivery: existing response and quiet-hours rules still apply. Requires Emails View and permission for the source record. Count is follow-ups; links are deduplicated.'));
    EXCEPTION WHEN undefined_table OR undefined_column OR insufficient_privilege THEN
      groups:=groups||jsonb_build_array(jsonb_build_object('key','followups','title','Scheduled follow-ups due','state','unavailable','count',NULL,'items','[]'::jsonb,'note','This source could not be read. It is not a zero result. Ask your administrator to check the P2 migration and data access.'));
    END;
  ELSE
    groups:=groups||jsonb_build_array(jsonb_build_object('key','followups','title','Scheduled follow-ups due','state','hidden','count',NULL,'items','[]'::jsonb,'note','Not included with current assistant permissions.'));
  END IF;
  RETURN jsonb_build_object('asOf',checked,'groups',groups,'note','Read-only account snapshot. Counts are source records, not a severity score. Hidden or unavailable sources are not zero.');
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_attention() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_attention() TO authenticated;
COMMIT;
