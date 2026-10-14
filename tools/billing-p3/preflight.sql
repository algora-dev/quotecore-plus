-- QuoteCore+ P3 completion preflight. READ ONLY.
-- Run against the intended database before applying 20261012233000.
\pset pager off
\echo 'P3 completion preflight - no writes'

SELECT current_database() AS database_name, now() AS checked_at;

SELECT billing_model, count(*) AS companies
FROM public.companies
GROUP BY billing_model
ORDER BY billing_model;

SELECT
  to_regclass('public.company_custom_billing') IS NOT NULL AS has_custom_snapshot,
  to_regclass('public.custom_billing_period_grants') IS NOT NULL AS has_period_grants,
  to_regclass('public.qcp_usage_ledger') IS NOT NULL AS has_usage_ledger,
  to_regprocedure('public.qcp_usage_context(uuid)') IS NOT NULL AS has_usage_context,
  to_regprocedure('public.qcp_usage_snapshot(uuid,text,text)') IS NOT NULL AS has_usage_snapshot;

SELECT id, billing_model, subscription_status, stripe_mode,
       stripe_subscription_id, first_payment_failure_at
FROM public.companies
WHERE billing_model='custom_setup'
ORDER BY created_at NULLS LAST, id;

SELECT company_id, stripe_mode, stripe_subscription_id, provider_status,
       period_start, period_end, last_paid_invoice_id
FROM public.company_custom_billing
ORDER BY company_id;

-- These should be absent before first application and present afterwards.
SELECT
  to_regclass('public.qcp_payment_attention') AS payment_attention_before,
  to_regclass('public.qcp_refund_observations') AS refund_observations_before,
  to_regclass('public.qcp_voice_budget_policies') AS voice_policies_before,
  to_regclass('public.qcp_voice_provider_calls') AS voice_calls_before;
