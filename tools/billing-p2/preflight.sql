-- READ ONLY. Capture results for review; do not include secrets/customer content.
SELECT billing_model,stripe_mode,count(*) AS companies
 FROM public.companies GROUP BY billing_model,stripe_mode ORDER BY 1,2;
SELECT count(*) AS custom_snapshots FROM public.company_custom_billing;
SELECT count(*) AS paid_period_grants FROM public.custom_billing_period_grants;
SELECT to_regclass('public.qcp_usage_ledger') AS p2_already_present,
 to_regclass('public.ai_scan_jobs') AS scan_queue,
 to_regclass('public.calibration_runs') AS calibration_ledger;
SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,p.prosecdef,p.provolatile,p.proconfig,
 pg_get_functiondef(p.oid) AS definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN
 ('create_quote_atomic','company_has_feature','get_ai_assist_points_status','sa_admit_run','sa_check_turn_quota',
 'fn_quote_status_usage_delta','update_company_storage_usage','cal_admit_run','cal_finish_run','cal_verify_refine_parent','submit_ai_scan_job');
SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid) AS definition
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgrelid IN('public.quotes'::regclass,'public.quote_files'::regclass,'public.companies'::regclass);
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
 WHERE (schemaname='storage' AND tablename='objects')
 OR (schemaname='public' AND tablename IN('quotes','quote_files','ai_scan_jobs','calibration_runs','assistant_turn_reservations'));
SELECT column_name,has_column_privilege('authenticated','public.companies',column_name,'UPDATE') AS client_can_update
 FROM information_schema.columns WHERE table_schema='public' AND table_name='companies'
 AND column_name IN('billing_model','stripe_mode','stripe_subscription_id','plan_code','subscription_status','storage_used_bytes','storage_topup_bytes','ai_assist_points_used');
SELECT count(*) AS mismatched_storage_counters
 FROM public.companies c LEFT JOIN(SELECT company_id,sum(file_size)::bigint n FROM public.quote_files GROUP BY company_id) f ON f.company_id=c.id
 WHERE c.storage_used_bytes IS DISTINCT FROM COALESCE(f.n,0);
