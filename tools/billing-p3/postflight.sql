-- QuoteCore+ P3 completion postflight. READ ONLY.
-- Run after the migration in a disposable DB first, then after reviewed shared-DB apply.
\pset pager off
\echo 'P3 completion postflight - no writes'

SELECT
  to_regclass('public.qcp_payment_attention') IS NOT NULL AS payment_attention,
  to_regclass('public.qcp_refund_observations') IS NOT NULL AS refund_observations,
  to_regclass('public.qcp_voice_budget_policies') IS NOT NULL AS voice_policies,
  to_regclass('public.qcp_voice_provider_calls') IS NOT NULL AS voice_calls,
  to_regprocedure('public.qcp_begin_voice_call(uuid,uuid,text,text,text,text,bigint,bigint)') IS NOT NULL AS begin_voice,
  to_regprocedure('public.qcp_finish_voice_call(uuid,uuid,bigint)') IS NOT NULL AS finish_voice,
  to_regprocedure('public.qcp_usage_context(uuid)') IS NOT NULL AS usage_context,
  to_regprocedure('public.qcp_usage_snapshot(uuid,text,text)') IS NOT NULL AS usage_snapshot;

SELECT count(*) AS enabled_voice_policies
FROM public.qcp_voice_budget_policies
WHERE enabled;

SELECT
  has_table_privilege('authenticated','public.qcp_payment_attention','SELECT') AS authenticated_can_read_attention,
  has_table_privilege('authenticated','public.qcp_refund_observations','SELECT') AS authenticated_can_read_refunds,
  has_table_privilege('authenticated','public.qcp_voice_provider_calls','SELECT') AS authenticated_can_read_voice_calls;

SELECT position('paymentGrace' in pg_get_functiondef('public.qcp_usage_snapshot(uuid,text,text)'::regprocedure)) > 0
  AS snapshot_exposes_payment_grace;
SELECT position('interval ''7 days''' in pg_get_functiondef('public.qcp_usage_context(uuid)'::regprocedure)) > 0
  AS usage_context_has_bounded_grace;
SELECT position('qcp_payment_attention' in pg_get_functiondef('public.company_effective_plan_code(uuid)'::regprocedure)) > 0
  AS effective_plan_uses_payment_attention;
