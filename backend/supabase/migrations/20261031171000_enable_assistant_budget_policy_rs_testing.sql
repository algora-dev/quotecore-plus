-- Enable the reviewed assistant provider budget policy for the custom billing
-- scope used by RS Roofing on TESTING (owner authorization 2026-10-31, voice
-- note 13:07: "turn it on for this specific user, the RS Roofing test account").
--
-- Why: sa_admit_run inserts assistant_turn_reservations; the
-- qcp_assistant_budget_ready trigger requires an ENABLED
-- qcp_assistant_budget_policies row for custom_setup companies' billing scope.
-- No policy row existed for RS Roofing's (stripe_account_id, stripe_mode), so
-- every Smart Assistant turn for that account refused with QCP08
-- 'custom_assistant_provider_not_ready' -> 503 (verified in Vercel logs
-- 2026-10-31 13:05:45, deployment ls95fmbmu). Legacy companies skip the gate.
-- Limits are generous within the table CHECK constraints (testing scope).
BEGIN;
SET LOCAL lock_timeout='5s';
WITH scope AS (
  SELECT stripe_account_id, stripe_mode
  FROM public.company_custom_billing
  WHERE company_id = 'dd3b3943-c760-4c21-9a9a-3a516d0c3356'
)
INSERT INTO public.qcp_assistant_budget_policies (
  stripe_account_id, stripe_mode, enabled,
  max_calls_per_task, max_tokens_per_call, max_tokens_per_task, max_output_tokens,
  daily_user_tokens, daily_company_tokens, period_company_tokens, reviewed_by
)
SELECT stripe_account_id, stripe_mode, true,
  32, 1000000, 10000000, 100000,
  5000000, 10000000, 50000000, 'gavin-owner-authorized-2026-10-31'
FROM scope
ON CONFLICT (stripe_account_id, stripe_mode) DO UPDATE
  SET enabled = true, reviewed_by = EXCLUDED.reviewed_by, updated_at = clock_timestamp();
COMMIT;
