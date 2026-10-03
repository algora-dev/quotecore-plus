-- READ-ONLY inventory helper. Not a migration or a substitute for function/RLS tests.
BEGIN READ ONLY;
SELECT current_database(), version();
SELECT schema, name, to_regclass(format('%I.%I',schema,name)) IS NOT NULL AS present
FROM (VALUES ('public','assistant_v2_actions'),('public','assistant_v2_draft_briefs'),
 ('public','assistant_v2_task_context'),('public','assistant_v2_task_runs'),
 ('public','assistant_v2_library_profiles'),('public','assistant_v2_library_members'),
 ('public','assistant_v2_concepts'),('public','assistant_v2_workflow_epochs'),
 ('public','pwa_push_subscriptions'),('public','pwa_push_deliveries'),
 ('public','quote_component_entries'),('public','quote_roof_area_entries')) AS v(schema,name);
SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS arguments,
 p.prosecdef AS security_definer, p.proconfig AS settings,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND (p.proname LIKE 'sa_v2_workflow_%'
 OR p.proname LIKE 'sa_v2_creation_%' OR p.proname LIKE '%pre_controller_v1'
 OR p.proname LIKE 'pwa_push_%' OR p.proname='sa_v2_draft_edit_clear')
ORDER BY p.proname,arguments;
SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes
WHERE schemaname='public' AND indexname IN ('sa_v2_created_quote_once','assistant_v2_library_one_default_per_concept');
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND (tablename LIKE 'pwa_push_%' OR tablename LIKE 'assistant_v2_concept%');
ROLLBACK;
