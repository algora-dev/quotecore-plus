-- psql helper. Supply BOTH -v company_id=<UUID> and -v quote_id=<UUID>.
-- READ ONLY: outputs sensitive job details; store results securely, not public logs.
-- Compare with the exact intended brief and canonical engine, not model arithmetic.
BEGIN READ ONLY;
SELECT q.id,q.company_id,q.customer_name,q.job_name,q.site_address,q.status,q.entry_mode,
 q.measurement_system,q.global_pitch_degrees,q.currency,q.component_collection_id,q.created_by_user_id
FROM public.quotes q WHERE q.id=:'quote_id'::uuid AND q.company_id=:'company_id'::uuid;
SELECT a.* FROM public.quote_roof_areas a JOIN public.quotes q ON q.id=a.quote_id
WHERE q.id=:'quote_id'::uuid AND q.company_id=:'company_id'::uuid ORDER BY a.sort_order,a.id;
SELECT c.id,c.component_library_id,c.quote_roof_area_id,c.name,c.final_quantity,c.material_rate,c.labour_rate,
 c.waste_type,c.waste_percent,c.waste_fixed,c.material_cost,c.labour_cost,c.calc_audit
FROM public.quote_components c JOIN public.quotes q ON q.id=c.quote_id
WHERE q.id=:'quote_id'::uuid AND q.company_id=:'company_id'::uuid ORDER BY c.sort_order,c.id;
SELECT c.id AS component_id,c.name,e.id AS entry_id,e.raw_value,e.value_after_waste,e.pitch_degrees,e.sort_order
FROM public.quote_component_entries e JOIN public.quote_components c ON c.id=e.quote_component_id
JOIN public.quotes q ON q.id=c.quote_id WHERE q.id=:'quote_id'::uuid AND q.company_id=:'company_id'::uuid
ORDER BY c.sort_order,e.sort_order,e.id;
SELECT a.id,a.run_id,a.status,a.result_quote_id,a.log_id,a.payload->>'briefStateId' AS brief_id,
 a.payload->>'briefRevision' AS brief_revision,a.payload->>'editQuoteId' AS edited_quote_id
FROM public.assistant_v2_actions a WHERE a.company_id=:'company_id'::uuid AND a.result_quote_id=:'quote_id'::uuid ORDER BY a.created_at,a.id;
SELECT b.id,b.revision,b.workflow_state,b.produced_quote_id,b.action_id,b.conflict_reason
FROM public.assistant_v2_draft_briefs b WHERE b.company_id=:'company_id'::uuid AND b.produced_quote_id=:'quote_id'::uuid;
SELECT l.* FROM public.sa_action_log l JOIN public.assistant_v2_actions a ON a.log_id=l.id
WHERE a.company_id=:'company_id'::uuid AND a.result_quote_id=:'quote_id'::uuid ORDER BY a.created_at,a.id;
ROLLBACK;
